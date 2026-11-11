import fs from 'node:fs';
import path from 'node:path';
import {
  runNewProductionCommand,
  type ScaffoldKitId,
} from './new-production';
import {
  ensureConsumerRemotionEntry,
  resolveWorkspaceContext,
  syncBundledAiPluginToProject,
} from './workspace-paths';

export interface InitCommandOptions {
  cwd?: string;
  dir?: string;
  kit?: ScaffoldKitId;
  lang?: 'pl' | 'en';
  force?: boolean;
}

const REQUIRED_RUNTIME_PACKAGES = [
  '@make-pictures/core',
  '@make-pictures/kits',
  '@make-pictures/studio',
  '@make-pictures/cli',
  'remotion',
  '@remotion/cli',
  '@remotion/player',
  'zod',
];

function hasExistingProductions(productionsRoot: string): boolean {
  if (!fs.existsSync(productionsRoot)) return false;
  for (const entry of fs.readdirSync(productionsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (
      fs.existsSync(
        path.join(productionsRoot, entry.name, 'production.json')
      )
    ) {
      return true;
    }
  }
  return false;
}

function findMissingPackages(rootDir: string): string[] {
  const pkgJsonPath = path.join(rootDir, 'package.json');
  let declaredDeps = new Set<string>();
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      declaredDeps = new Set([
        ...Object.keys(parsed.dependencies ?? {}),
        ...Object.keys(parsed.devDependencies ?? {}),
      ]);
    } catch {
      // Ignore malformed package.json
    }
  }

  return REQUIRED_RUNTIME_PACKAGES.filter((pkgName) => {
    if (declaredDeps.has(pkgName)) return false;
    const parts = pkgName.split('/');
    return !fs.existsSync(
      path.join(rootDir, 'node_modules', ...parts, 'package.json')
    );
  });
}

/**
 * Initializes `make.pictures` Studio inside an existing repository (e.g. a Next.js / SaaS monorepo
 * via `npx make-pictures init --dir=videos`).
 */
export async function runInitCommand(
  options: InitCommandOptions = {}
): Promise<{
  studioDir: string;
  entryPath: string;
  pluginDir: string;
}> {
  const { rootDir, studioDir, dirRel } = resolveWorkspaceContext({
    cwd: options.cwd,
    dir: options.dir,
  });

  const kit: ScaffoldKitId = options.kit ?? 'paper-diorama-3d';
  const lang: 'pl' | 'en' = options.lang ?? 'en';
  const force = Boolean(options.force);

  const productionsRoot = path.join(studioDir, 'productions');
  const publicDir = path.join(studioDir, 'public');
  fs.mkdirSync(productionsRoot, { recursive: true });
  fs.mkdirSync(publicDir, { recursive: true });

  const entryPath = ensureConsumerRemotionEntry(studioDir, rootDir, force);

  if (!hasExistingProductions(productionsRoot) || force) {
    await runNewProductionCommand({
      cwd: rootDir,
      dir: dirRel,
      slug: 'hello-studio',
      kit,
      lang,
      force,
      prepopulateTimestamps: true,
    });
  }

  const { pluginDestDir, agentsMdPath } = syncBundledAiPluginToProject(rootDir, {
    force,
  });

  const dirFlag = dirRel !== '.' ? ` --dir=${dirRel}` : '';
  const missingPkgs = findMissingPackages(rootDir);

  console.log('\n==============================================================');
  console.log(' ✨ Initialized make.pictures Studio in Existing Project');
  console.log('==============================================================');
  console.log(
    `  • Studio Root:    ${dirRel === '.' ? '.' : dirRel}`
  );
  console.log(
    `  • Remotion Entry: ${path.relative(rootDir, entryPath)}`
  );
  console.log(
    `  • AI Skills:      ${path.relative(rootDir, pluginDestDir)}`
  );
  console.log(
    `  • Agent Rules:    ${path.relative(rootDir, agentsMdPath)}`
  );

  if (missingPkgs.length > 0) {
    console.log('\n📦 Install studio packages if not installed yet:');
    console.log(
      '   npm install @make-pictures/core @make-pictures/kits @make-pictures/studio @make-pictures/cli remotion @remotion/cli @remotion/player @remotion/three three @types/three react react-dom zod'
    );
  }

  console.log('\n🚀 Next commands:');
  console.log(`   1. npx make-pictures onboard`);
  console.log(`   2. npx make-pictures studio${dirFlag}`);
  console.log(
    `   3. npx make-pictures audio --production=hello-studio${dirFlag}`
  );
  console.log(`   4. npx make-pictures qa HelloStudio${dirFlag}`);

  return {
    studioDir,
    entryPath,
    pluginDir: pluginDestDir,
  };
}
