import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveWorkspaceContext } from './workspace-paths';

export interface StudioCommandOptions {
  cwd?: string;
  dir?: string;
  port?: number;
  host?: string;
}

export interface StudioServerOptions {
  rootDir?: string;
  studioDir?: string;
  port?: number;
  host?: string;
}

export interface StudioServerHandle {
  url: string;
  close: () => Promise<void>;
}

interface StudioServerModule {
  startStudioServer: (
    options?: StudioServerOptions
  ) => Promise<StudioServerHandle>;
}

async function loadStudioServerModule(
  rootDir: string
): Promise<StudioServerModule> {
  const pkgSpecifier = '@make-pictures/studio/server';

  try {
    return (await import(pkgSpecifier)) as StudioServerModule;
  } catch {
    // Try resolving from consumer rootDir's node_modules (e.g. when invoked with --cwd)
    try {
      const rootPkgJson = path.join(rootDir, 'package.json');
      if (fs.existsSync(rootPkgJson)) {
        const req = createRequire(rootPkgJson);
        const resolvedPath = req.resolve(pkgSpecifier);
        return (await import(
          pathToFileURL(resolvedPath).href
        )) as StudioServerModule;
      }
    } catch {
      // Fall through to monorepo source check
    }

    const monorepoSrc = path.join(
      rootDir,
      'packages',
      'studio',
      'src',
      'server',
      'index.ts'
    );
    if (fs.existsSync(monorepoSrc)) {
      return (await import(
        pathToFileURL(monorepoSrc).href
      )) as StudioServerModule;
    }

    throw new Error(
      'Could not load "@make-pictures/studio/server". Run `npm install @make-pictures/studio` (or `npm run build:packages` in the engine monorepo).'
    );
  }
}

/**
 * Starts the make.pictures Studio Web 60 FPS workstation (`@make-pictures/studio/server`)
 * and keeps serving until interrupted via SIGINT / SIGTERM.
 */
export async function runStudioCommand(
  options: StudioCommandOptions = {}
): Promise<void> {
  const { rootDir, studioDir, dirRel } = resolveWorkspaceContext({
    cwd: options.cwd,
    dir: options.dir,
  });

  const port = options.port ?? 3000;
  const host = options.host ?? '127.0.0.1';

  const { startStudioServer } = await loadStudioServerModule(rootDir);
  const server = await startStudioServer({
    rootDir,
    studioDir,
    port,
    host,
  });

  console.log('==============================================================');
  console.log(' 🎬 make.pictures studio — 60 FPS Workstation');
  console.log('==============================================================');
  console.log(`  • URL:        ${server.url}`);
  console.log(
    `  • Workspace:  ${dirRel === '.' ? rootDir : `${rootDir} (--dir=${dirRel})`}`
  );
  console.log('  • Press Ctrl+C to stop');

  await new Promise<void>((resolve) => {
    let closing = false;
    const shutdown = () => {
      if (closing) return;
      closing = true;
      void server
        .close()
        .catch(() => undefined)
        .finally(() => {
          process.off('SIGINT', shutdown);
          process.off('SIGTERM', shutdown);
          resolve();
        });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
}
