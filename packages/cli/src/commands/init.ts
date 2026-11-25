import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { DimensionalSpace } from '@make-pictures/remotion/style/presets';
import {
  defaultKitAndStyleForSpace,
  runNewProductionCommand,
  type ScaffoldKitId,
} from './new-production';
import { ensureWorkspaceStylesDir } from './styles';
import {
  DEFAULT_MAKE_PICTURES_CONFIG,
  loadMakePicturesConfig,
  resolveWorkspaceContext,
  syncBundledSkillsToProject,
} from './workspace-paths';
import { getNpxCommand } from '../utils/cli-helpers';

export interface InitCommandOptions {
  cwd?: string;
  dir?: string;
  space?: DimensionalSpace;
  kit?: ScaffoldKitId;
  style?: string;
  voice?: string;
  lang?: 'pl' | 'en';
  force?: boolean;
  skipRemotionSkills?: boolean;
  remotionSkillsRunner?: (rootDir: string) => boolean;
}

export const REQUIRED_RUNTIME_PACKAGES = [
  '@make-pictures/remotion',
  '@make-pictures/cli',
  'remotion',
  '@remotion/cli',
  '@remotion/bundler',
  '@remotion/renderer',
  '@remotion/google-fonts',
  '@remotion/media-utils',
  '@remotion/zod-types',
  'lucide-react',
  'zod',
] as const;

function hasExistingVideos(videosRoot: string): boolean {
  if (!fs.existsSync(videosRoot)) return false;
  for (const entry of fs.readdirSync(videosRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidateDir = path.join(videosRoot, entry.name);
    if (
      fs.existsSync(path.join(candidateDir, 'audio.json')) ||
      fs.existsSync(path.join(candidateDir, 'index.ts')) ||
      fs.existsSync(path.join(candidateDir, 'index.tsx'))
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

function defaultRunRemotionSkillsAdd(rootDir: string): boolean {
  try {
    const res = spawnSync(getNpxCommand(), ['-y', 'remotion', 'skills', 'add'], {
      cwd: rootDir,
      stdio: 'pipe',
      timeout: 15_000,
    });
    return res.status === 0;
  } catch {
    return false;
  }
}

function buildStarterEntrySource(): string {
  return `import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';

registerRoot(RemotionRoot);
`;
}

function buildStarterRootSource(): string {
  return `import React from 'react';
import { Composition } from 'remotion';
import {
  DEFAULT_STYLE_LAB_PROPS,
  StyleLabComposition,
  StyleLabSchema,
} from '@make-pictures/remotion/style-lab';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="StyleLab"
        component={StyleLabComposition}
        schema={StyleLabSchema}
        defaultProps={DEFAULT_STYLE_LAB_PROPS}
        durationInFrames={360}
        fps={60}
        width={1920}
        height={1080}
      />
    </>
  );
};
`;
}

/**
 * Initializes `make.pictures` inside an existing Remotion repository (in-place, preserving `src/Root.tsx`)
 * or inside a subdirectory of an existing app (e.g. `npx make-pictures init --dir=videos`).
 */
export async function runInitCommand(
  options: InitCommandOptions = {}
): Promise<{
  studioDir: string;
  entryPath: string;
  rootTsxPath: string;
  preservedExistingRoot: boolean;
  skillsDir: string;
  claudeSkillsDir: string;
  remotionSkillsAdded: boolean;
}> {
  const { rootDir, studioDir, dirRel } = resolveWorkspaceContext({
    cwd: options.cwd,
    dir: options.dir,
  });

  const spaceDefaults = options.space
    ? defaultKitAndStyleForSpace(options.space)
    : undefined;
  const kit: ScaffoldKitId =
    options.kit ?? spaceDefaults?.kit ?? 'vector-scene-2d';
  const style = options.style ?? spaceDefaults?.styleId;
  const lang: 'pl' | 'en' = options.lang ?? 'en';
  const force = Boolean(options.force);

  const configPath = path.join(studioDir, 'make-pictures.json');
  if (!fs.existsSync(configPath) || force) {
    fs.mkdirSync(studioDir, { recursive: true });
    fs.writeFileSync(
      configPath,
      `${JSON.stringify({ ...DEFAULT_MAKE_PICTURES_CONFIG, lang }, null, 2)}\n`,
      'utf8'
    );
  }

  const config = loadMakePicturesConfig(studioDir);
  const videosRoot = path.resolve(studioDir, config.videosDir);
  const publicDir = path.resolve(studioDir, config.publicDir);
  fs.mkdirSync(videosRoot, { recursive: true });
  fs.mkdirSync(publicDir, { recursive: true });
  ensureWorkspaceStylesDir(studioDir);

  const entryPath = path.resolve(studioDir, config.entryPoint);
  const rootTsxPath = path.join(path.dirname(entryPath), 'Root.tsx');
  const hadExistingRoot = fs.existsSync(rootTsxPath);

  fs.mkdirSync(path.dirname(entryPath), { recursive: true });
  if (!fs.existsSync(entryPath)) {
    fs.writeFileSync(entryPath, buildStarterEntrySource(), 'utf8');
  }
  if (!hadExistingRoot) {
    fs.writeFileSync(rootTsxPath, buildStarterRootSource(), 'utf8');
  }

  // Only scaffold a starter video when initializing a fresh studio root without an existing src/Root.tsx.
  // Existing Remotion repos keep their src/Root.tsx completely untouched.
  if (!hadExistingRoot && (!hasExistingVideos(videosRoot) || force)) {
    await runNewProductionCommand({
      cwd: rootDir,
      dir: dirRel,
      slug: 'hello-studio',
      space: options.space,
      kit,
      style,
      voice: options.voice,
      lang,
      force,
      prepopulateTimestamps: true,
    });
  }

  const { agentsSkillsDir, claudeSkillsDir, agentsMdPath } =
    syncBundledSkillsToProject(rootDir, { force });

  const remotionSkillsAdded = options.skipRemotionSkills
    ? false
    : (options.remotionSkillsRunner ?? defaultRunRemotionSkillsAdd)(rootDir);

  const dirFlag = dirRel !== '.' ? ` --dir=${dirRel}` : '';
  const missingPkgs = findMissingPackages(rootDir);

  console.log('\n==============================================================');
  console.log(' ✨ Initialized make.pictures v3 Toolkit');
  console.log('==============================================================');
  console.log(`  • Workspace Root:  ${dirRel === '.' ? '.' : dirRel}`);
  console.log(`  • Remotion Entry:  ${path.relative(rootDir, entryPath)}`);
  console.log(
    `  • Remotion Root:   ${path.relative(rootDir, rootTsxPath)}${hadExistingRoot ? ' (preserved existing)' : ' (created with StyleLab)'}`
  );
  console.log(`  • AI Skills:       ${path.relative(rootDir, agentsSkillsDir)}`);
  console.log(`  • Claude Skills:   ${path.relative(rootDir, claudeSkillsDir)}`);
  console.log(`  • Agent Rules:     ${path.relative(rootDir, agentsMdPath)}`);
  if (remotionSkillsAdded) {
    console.log('  • Remotion Skills: installed via `npx remotion skills add`');
  } else if (!options.skipRemotionSkills) {
    console.log(
      '  • Remotion Skills: run `npx remotion skills add` once online for official Remotion skills'
    );
  }

  if (missingPkgs.length > 0) {
    console.log('\n📦 Install missing v3 packages:');
    console.log(`   npm install ${missingPkgs.join(' ')}`);
  }

  console.log('\n🚀 Next commands:');
  console.log(`   1. npx make-pictures onboard${dirFlag}`);
  console.log(
    dirRel === '.'
      ? '   2. npx remotion studio'
      : `   2. npx make-pictures studio${dirFlag}`
  );
  console.log(`   3. npx make-pictures new my-film --space=2d${dirFlag}`);
  console.log(`   4. npx make-pictures qa MyFilm${dirFlag}`);

  return {
    studioDir,
    entryPath,
    rootTsxPath,
    preservedExistingRoot: hadExistingRoot,
    skillsDir: agentsSkillsDir,
    claudeSkillsDir,
    remotionSkillsAdded,
  };
}
