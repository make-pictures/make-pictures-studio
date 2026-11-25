import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface WorkspaceOptions {
  cwd?: string;
  dir?: string;
}

export interface WorkspaceContext {
  rootDir: string;
  studioDir: string;
  dirRel: string;
  isEngineMonorepo: boolean;
}

export interface MakePicturesConfig {
  entryPoint: string;
  publicDir: string;
  videosDir: string;
  stylesDir: string;
  lang: 'pl' | 'en';
  fps: number;
}

export const DEFAULT_MAKE_PICTURES_CONFIG: MakePicturesConfig = {
  entryPoint: 'src/index.ts',
  publicDir: 'public',
  videosDir: 'src/videos',
  stylesDir: 'styles',
  lang: 'en',
  fps: 60,
};

/**
 * Resolves `rootDir` (`--cwd` or `process.cwd()`) and `studioDir` (`--dir`, e.g. `videos` in a SaaS repo),
 * plus detects whether we are executing inside the `make-pictures-studio` engine monorepo.
 */
export function resolveWorkspaceContext(
  options: WorkspaceOptions = {}
): WorkspaceContext {
  const rootDir = path.resolve(options.cwd || process.cwd());
  const rawDir = options.dir?.trim() || '.';
  const studioDir = path.resolve(rootDir, rawDir);
  const dirRel = path.relative(rootDir, studioDir) || '.';
  const isEngineMonorepo = fs.existsSync(
    path.join(rootDir, 'packages', 'remotion', 'src', 'index.ts')
  );

  return {
    rootDir,
    studioDir,
    dirRel,
    isEngineMonorepo,
  };
}

/**
 * Reads optional `make-pictures.json` from `rootDir` and merges with standard Remotion defaults.
 * Zero lock-in: works cleanly when no `make-pictures.json` file exists.
 */
export function loadMakePicturesConfig(rootDir: string): MakePicturesConfig {
  const configPath = path.join(rootDir, 'make-pictures.json');
  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_MAKE_PICTURES_CONFIG };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    throw new Error(
      `Invalid JSON in ${configPath}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Invalid make-pictures.json at ${configPath}: expected a JSON object.`);
  }

  const obj = raw as Record<string, unknown>;
  const str = (key: keyof MakePicturesConfig, fallback: string): string => {
    const val = obj[key];
    return typeof val === 'string' && val.trim().length > 0
      ? val.trim()
      : fallback;
  };

  const langRaw = obj.lang;
  const lang: 'pl' | 'en' =
    langRaw === 'pl' ? 'pl' : langRaw === 'en' ? 'en' : DEFAULT_MAKE_PICTURES_CONFIG.lang;

  const fpsRaw = obj.fps;
  const fps =
    typeof fpsRaw === 'number' && Number.isFinite(fpsRaw) && fpsRaw > 0
      ? Math.round(fpsRaw)
      : DEFAULT_MAKE_PICTURES_CONFIG.fps;

  return {
    entryPoint: str('entryPoint', DEFAULT_MAKE_PICTURES_CONFIG.entryPoint),
    publicDir: str('publicDir', DEFAULT_MAKE_PICTURES_CONFIG.publicDir),
    videosDir: str('videosDir', DEFAULT_MAKE_PICTURES_CONFIG.videosDir),
    stylesDir: str('stylesDir', DEFAULT_MAKE_PICTURES_CONFIG.stylesDir),
    lang,
    fps,
  };
}

/**
 * Resolves the Remotion `registerRoot` entry file for `studio`, `qa`, and `render`.
 * Checks in order:
 * 1. Explicit `--entry`
 * 2. Configured `entryPoint` in `make-pictures.json`
 * 3. Standard Remotion paths (`src/index.ts`, `src/index.tsx`, `index.ts`, `index.tsx`)
 */
export function resolveRemotionEntryPoint(params: {
  rootDir: string;
  studioDir: string;
  explicitEntry?: string;
}): string {
  const { rootDir, studioDir, explicitEntry } = params;

  if (explicitEntry) {
    const resolvedExplicit = path.resolve(rootDir, explicitEntry);
    if (!fs.existsSync(resolvedExplicit)) {
      throw new Error(
        `Remotion entry file not found: ${resolvedExplicit}\nPass a valid path with --entry=<path> or set "entryPoint" in make-pictures.json.`
      );
    }
    return resolvedExplicit;
  }

  const config = loadMakePicturesConfig(studioDir);
  const rootConfig =
    path.resolve(studioDir) !== path.resolve(rootDir)
      ? loadMakePicturesConfig(rootDir)
      : config;

  const candidates = [
    path.resolve(studioDir, config.entryPoint),
    path.join(studioDir, 'src', 'index.ts'),
    path.join(studioDir, 'src', 'index.tsx'),
    path.join(studioDir, 'index.ts'),
    path.join(studioDir, 'index.tsx'),
    path.resolve(rootDir, rootConfig.entryPoint),
    path.join(rootDir, 'src', 'index.ts'),
    path.join(rootDir, 'src', 'index.tsx'),
  ];

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Could not find a Remotion entry point (checked ${path.relative(rootDir, path.resolve(studioDir, config.entryPoint)) || config.entryPoint} and src/index.ts).\nRun \`npx make-pictures init\` to set up a Remotion project, or pass \`--entry=<path>\`.`
  );
}

/**
 * Checks whether `ffmpeg` is available on PATH and fails fast with OS-specific install commands.
 */
export function assertFfmpegInstalled(context = 'this command'): void {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  } catch {
    throw new Error(
      `FFmpeg is required for ${context}, but \`ffmpeg\` was not found in PATH.\nInstall FFmpeg and retry:\n  • macOS:   brew install ffmpeg\n  • Ubuntu:  sudo apt install ffmpeg\n  • Windows: winget install Gyan.FFmpeg`
    );
  }
}

/**
 * Walks upward from `startDir` looking for a package in `node_modules`.
 */
export function findInstalledPackageJson(
  startDir: string,
  pkgName: string
): string | null {
  const parts = pkgName.split('/');
  let current = path.resolve(startDir);
  while (true) {
    const candidate = path.join(current, 'node_modules', ...parts, 'package.json');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

/**
 * Locates the local `remotion` CLI binary by walking up from `startDir`.
 */
export function resolveLocalRemotionBin(startDir: string): string | null {
  const ext = process.platform === 'win32' ? '.cmd' : '';
  let current = path.resolve(startDir);
  while (true) {
    const candidate = path.join(current, 'node_modules', '.bin', `remotion${ext}`);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

/**
 * Ensures `remotion` and `@remotion/cli` are installed in the target workspace before invoking
 * Remotion Studio, QA bundling, or rendering.
 */
export function assertRemotionInstalled(
  rootDir: string,
  requiredPackages: ReadonlyArray<string> = ['remotion', '@remotion/cli']
): string {
  const missing = requiredPackages.filter(
    (pkg) => !findInstalledPackageJson(rootDir, pkg)
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing required Remotion package(s) in this project: ${missing.join(', ')}.\nInstall them first:\n  npm install ${missing.join(' ')}`
    );
  }
  const bin = resolveLocalRemotionBin(rootDir);
  if (!bin) {
    throw new Error(
      `Could not locate local \`remotion\` binary in node_modules/.bin.\nRun \`npm install remotion @remotion/cli\` and retry.`
    );
  }
  return bin;
}

function getModuleDir(): string {
  if (typeof __dirname === 'string') {
    return __dirname;
  }
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    return path.dirname(fileURLToPath(import.meta.url));
  }
  return process.cwd();
}

function copyDirRecursive(srcDir: string, destDir: string): void {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export const FALLBACK_AGENTS_MD = `# AGENTS.md — make.pictures v3 Toolkit Rules

Production & Audio/QA Toolkit for **Remotion 4 + AI Agents**.

## Tandem Skills
- Load official Remotion API rules from \`remotion-dev/skills\` (\`npx remotion skills add\`).
- Load make.pictures production rules from \`.agents/skills/\` (or \`.claude/skills/\`):
  1. \`make-pictures-director\` — workflow, pacing (\`>= 4.5s\`), breathing room, \`ContinuousSceneFlow\`, \`qa\`, \`render\`
  2. \`art-direction-and-styles\` — \`DimensionalSpace ('2d' | '2.5d' | '3d') × 10 BUILT_IN_STYLES\`, \`StyleLab\`, \`>= 18px\` typography, \`image\`/\`cutout\`/\`assets\`
  3. \`sound-and-music-design\` — ElevenLabs \`eleven_v4\`, \`dialogueInputs\`, native voices, PL/EN phonetics, \`SmartMusicBed\`, \`-14 LUFS\`
  4. \`kits-2d\` — \`editorial-collage\`, \`vector-scene-2d\`, \`motion-diagrams-2d\`, \`kinetic-typography\`, \`data-storytelling\`, \`product-frames\`
  5. \`kits-3d-and-kinematics\` — \`paper-diorama-3d\`, \`isometric-3d\`, \`tactile-3d\`, Disney kinematics, Shot DSL, OBB SAT 0-collision audit

## Core Invariants
1. Preview and edit compositions in native \`npx remotion studio\` (\`src/Root.tsx\` with standard \`<Composition schema={...} defaultProps={...} />\`).
2. Keep Frame \`0\` 100% uniform \`bgCanvas\` (entrance springs start at \`frame - 2\`). Always use \`<Img>\` from \`'remotion'\`.
3. Import runtime primitives from \`@make-pictures/remotion\` and kits from \`@make-pictures/remotion/kits/<kit>\` (\`DirectorCamera3D\` from \`@make-pictures/remotion/camera\`).
4. Never print \`.env.local\` or ask for \`ELEVENLABS_API_KEY\` in chat. Use \`npx make-pictures audio <slug>\` (or \`--mock\` offline).
5. Run \`npx make-pictures qa <CompositionId>\` and \`npm run typecheck\` before \`npx make-pictures render <CompositionId>\`.
`;

export const FALLBACK_CLAUDE_MD = `# CLAUDE.md — Claude Code Instructions for make.pictures v3

Read \`AGENTS.md\` and load skills progressively from \`.claude/skills/\` alongside official \`remotion-dev/skills\`.

## Key Commands
- \`npx remotion studio\` (or \`npm run studio\`) — live 60 FPS preview & Props Inspector (includes \`StyleLab\`)
- \`npx make-pictures new <slug> [--space=2d|2.5d|3d] [--kit=...] [--style=...] [--lang=pl|en]\` — scaffold \`src/videos/<slug>/\` and register in \`src/Root.tsx\`
- \`npx make-pictures styles [--space=2d|2.5d|3d]\` / \`npx make-pictures style new <slug>\` — browse or create \`styles/*.style.json\`
- \`npx make-pictures audio [slug] [--mock]\` — generate ElevenLabs TTS/Dialogue/Music/SFX into \`public/audio/<slug>/\` + \`generated/audio-manifest.ts\`
- \`npx make-pictures qa <CompositionId>\` — Director QA Gate + Contact-Sheet PNG (\`out/qa-<CompositionId>.png\`)
- \`npx make-pictures render <CompositionId>\` — 60 FPS render + \`-14 LUFS\` loudness mastering
`;

/**
 * Copies bundled `make.pictures` AI skills from `packages/cli/assets/skills/` (or monorepo `skills/`)
 * into `<rootDir>/.agents/skills/` and `<rootDir>/.claude/skills/`, and creates `<rootDir>/AGENTS.md`
 * and `<rootDir>/CLAUDE.md` if absent.
 */
export function syncBundledSkillsToProject(
  rootDir: string,
  options?: { force?: boolean }
): {
  skillsSourceDir: string | null;
  agentsSkillsDir: string;
  claudeSkillsDir: string;
  agentsMdPath: string;
  claudeMdPath: string;
  syncedSkills: string[];
} {
  const modDir = getModuleDir();

  const candidates = [
    path.resolve(modDir, '..', 'assets', 'skills'),
    path.resolve(modDir, '..', '..', 'assets', 'skills'),
    path.resolve(modDir, '..', '..', '..', '..', 'skills'),
    path.resolve(
      rootDir,
      'node_modules',
      '@make-pictures',
      'cli',
      'assets',
      'skills'
    ),
  ];

  const hasSkillSubdirs = (dir: string): boolean => {
    if (!fs.existsSync(dir)) return false;
    try {
      return fs
        .readdirSync(dir, { withFileTypes: true })
        .some(
          (entry) =>
            entry.isDirectory() &&
            fs.existsSync(path.join(dir, entry.name, 'SKILL.md'))
        );
    } catch {
      return false;
    }
  };

  const skillsSourceDir = candidates.find(hasSkillSubdirs) ?? null;
  const agentsSkillsDir = path.join(rootDir, '.agents', 'skills');
  const claudeSkillsDir = path.join(rootDir, '.claude', 'skills');
  const syncedSkills: string[] = [];

  fs.mkdirSync(agentsSkillsDir, { recursive: true });
  fs.mkdirSync(claudeSkillsDir, { recursive: true });

  if (skillsSourceDir) {
    const skillDirs = fs
      .readdirSync(skillsSourceDir, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          fs.existsSync(path.join(skillsSourceDir, entry.name, 'SKILL.md'))
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of skillDirs) {
      const srcSkill = path.join(skillsSourceDir, entry.name);
      const agentsDest = path.join(agentsSkillsDir, entry.name);
      const claudeDest = path.join(claudeSkillsDir, entry.name);
      if (options?.force) {
        fs.rmSync(agentsDest, { recursive: true, force: true });
        fs.rmSync(claudeDest, { recursive: true, force: true });
      }
      copyDirRecursive(srcSkill, agentsDest);
      copyDirRecursive(srcSkill, claudeDest);
      syncedSkills.push(entry.name);
    }
  }

  const agentsMdPath = path.join(rootDir, 'AGENTS.md');
  if (!fs.existsSync(agentsMdPath) || options?.force) {
    fs.writeFileSync(agentsMdPath, FALLBACK_AGENTS_MD, 'utf8');
  }

  const claudeMdPath = path.join(rootDir, 'CLAUDE.md');
  if (!fs.existsSync(claudeMdPath) || options?.force) {
    fs.writeFileSync(claudeMdPath, FALLBACK_CLAUDE_MD, 'utf8');
  }

  return {
    skillsSourceDir,
    agentsSkillsDir,
    claudeSkillsDir,
    agentsMdPath,
    claudeMdPath,
    syncedSkills,
  };
}
