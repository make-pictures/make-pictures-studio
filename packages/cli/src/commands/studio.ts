import { spawn } from 'node:child_process';
import path from 'node:path';
import {
  assertRemotionInstalled,
  resolveRemotionEntryPoint,
  resolveWorkspaceContext,
} from './workspace-paths';

export interface StudioCommandOptions {
  cwd?: string;
  dir?: string;
  entryPoint?: string;
  port?: number;
  host?: string;
}

/**
 * Thin passthrough launching native `remotion studio <entryPoint>`
 * after verifying that Remotion and a valid entry point exist.
 */
export async function runStudioCommand(
  options: StudioCommandOptions = {}
): Promise<void> {
  const { rootDir, studioDir, dirRel } = resolveWorkspaceContext({
    cwd: options.cwd,
    dir: options.dir,
  });

  const remotionBin = assertRemotionInstalled(rootDir, [
    'remotion',
    '@remotion/cli',
  ]);
  const entryPoint = resolveRemotionEntryPoint({
    rootDir,
    studioDir,
    explicitEntry: options.entryPoint,
  });
  const relEntry = path.relative(rootDir, entryPoint) || entryPoint;

  const args = ['studio', relEntry];
  if (typeof options.port === 'number' && Number.isFinite(options.port)) {
    args.push(`--port=${Math.round(options.port)}`);
  }
  if (options.host && options.host.trim().length > 0) {
    args.push(`--host=${options.host.trim()}`);
  }

  console.log('==============================================================');
  console.log(' 🎬 make.pictures — Launching Native Remotion Studio');
  console.log('==============================================================');
  console.log(`  • Entry:      ${relEntry}`);
  console.log(
    `  • Workspace:  ${dirRel === '.' ? rootDir : `${rootDir} (--dir=${dirRel})`}`
  );
  console.log(`  • Command:    remotion ${args.join(' ')}`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(remotionBin, args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('error', (err) => {
      reject(
        new Error(
          `Failed to launch Remotion Studio: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    });

    child.on('exit', (code, signal) => {
      if (signal === 'SIGINT' || signal === 'SIGTERM' || code === 0 || code === null) {
        resolve();
        return;
      }
      reject(new Error(`Remotion Studio exited with code ${code}.`));
    });
  });
}
