import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { BUILT_IN_STYLE_IDS } from '@make-pictures/remotion/style/presets';
import {
  DEFAULT_ELEVENLABS_MODEL_ID,
  getDefaultVoiceIdForLang,
} from '@make-pictures/remotion/audio/voices';
import { SCENES_KIT_IDS } from './new-production';
import { resolveWorkspaceContext } from './workspace-paths';
import {
  getNpmCommand,
  getNpxCommand,
  shellQuoteArg,
} from '../utils/cli-helpers';

export type OnboardStep = 'init' | 'connect' | 'wait' | 'check' | 'status';

export interface OnboardReply {
  next: string;
  instruction?: string;
  run?: string;
  say: string;
  rules?: string[];
  details?: Record<string, unknown>;
}

export interface OnboardRuntimeDeps {
  stdout?: Pick<NodeJS.WriteStream, 'write'> & { isTTY?: boolean };
  env?: NodeJS.ProcessEnv;
  checkFfmpeg?: () => boolean;
  installDeps?: (rootDir: string) => boolean;
  elevenLabsRunner?: (
    rootDir: string,
    subcommandArgs: string[]
  ) => OnboardReply | null;
  maxWaitAttempts?: number;
}

export interface OnboardCommandOptions {
  cwd?: string;
  dir?: string;
  step?: string;
  lang?: 'pl' | 'en';
  mode?: 'standalone' | 'saas';
  target?: string;
  extraArgs?: string[];
  json?: boolean;
  human?: boolean;
  deps?: OnboardRuntimeDeps;
}

export type WorkspaceBootstrapState =
  | {
      state: 'ready';
      effectiveRootDir: string;
      effectiveDir?: string;
      resumedSubdir?: string;
    }
  | {
      state: 'empty_dir';
      effectiveRootDir: string;
    }
  | {
      state: 'existing_remotion';
      effectiveRootDir: string;
    }
  | {
      state: 'existing_app';
      effectiveRootDir: string;
    }
  | {
      state: 'general_non_empty';
      effectiveRootDir: string;
      targetSubdir: string;
    };

const IGNORABLE_EMPTY_DIR_ENTRIES: ReadonlySet<string> = new Set([
  '.DS_Store',
  'Thumbs.db',
  '.git',
  '.gitignore',
  '.vscode',
  '.idea',
  '.claude',
  '.agents',
  '.antigravity',
  '.cursor',
]);

const AGENT_ENV_KEYS = [
  'ANTIGRAVITY_AGENT',
  'ANTIGRAVITY_CONVERSATION_ID',
  'CLAUDECODE',
  'CLAUDE_CODE',
  'CODEX_SANDBOX',
  'CODEX_CI',
  'CURSOR_AGENT',
  'GEMINI_CLI',
  'AIDER',
] as const;

const INSTRUCTIONS: Record<string, string> = {
  run: 'Tell the user `say`, then run `run`.',
  wait: 'Show the user `say`, then run `run` right away, without ending your turn: it waits while they approve in the browser. Whenever you give them the link, copy it whole, exactly as printed.',
  fix: 'Do what `say` describes, then run `run`.',
  ask_user:
    'Ask the user what `say` says and wait for their answer, then run `run`, unless they said no.',
  ask_choice:
    'Ask the user what `say` says and wait for their choice, then run the matching command from `details.choices`.',
  ask_what_to_build:
    'Tell the user `say`, then end your turn and wait for their answer. Read AGENTS.md and .agents/skills/ alongside remotion-dev/skills to guide them through creating their 60 FPS animation.',
  done: 'Tell the user `say`. Setup is complete.',
};

function isEnvTruthy(val: string | undefined): boolean {
  if (!val) return false;
  const normalized = val.trim().toLowerCase();
  return normalized !== '' && normalized !== '0' && normalized !== 'false';
}

export function shouldUseJsonOutput(params: {
  json?: boolean;
  human?: boolean;
  isTTY: boolean;
  env: NodeJS.ProcessEnv;
}): boolean {
  if (params.json) return true;
  if (params.human) return false;
  if (isEnvTruthy(params.env.CI)) return true;
  for (const key of AGENT_ENV_KEYS) {
    if (isEnvTruthy(params.env[key])) {
      return true;
    }
  }
  return !params.isTTY;
}

export function resolveOnboardLang(
  explicitLang: 'pl' | 'en' | undefined,
  env: NodeJS.ProcessEnv
): 'pl' | 'en' {
  if (explicitLang === 'pl' || explicitLang === 'en') {
    return explicitLang;
  }
  const sysLang = (env.LC_ALL || env.LC_MESSAGES || env.LANG || '').toLowerCase();
  if (sysLang.startsWith('pl')) {
    return 'pl';
  }
  return 'en';
}

function isEffectivelyEmptyDir(dirPath: string): boolean {
  if (!fs.existsSync(dirPath)) return true;
  const entries = fs.readdirSync(dirPath);
  return entries.every((entry) => IGNORABLE_EMPTY_DIR_ENTRIES.has(entry));
}

function readPackageJson(dirPath: string): {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
} | null {
  const pkgPath = path.join(dirPath, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
  } catch {
    return null;
  }
}

function isMakePicturesWorkspaceDir(dirPath: string): {
  isWorkspace: boolean;
  autoDir?: string;
} {
  if (!fs.existsSync(dirPath)) {
    return { isWorkspace: false };
  }

  // 1. Engine monorepo
  if (fs.existsSync(path.join(dirPath, 'packages', 'remotion', 'src', 'index.ts'))) {
    return { isWorkspace: true };
  }

  // 2. Explicit v3 make-pictures.json config
  if (fs.existsSync(path.join(dirPath, 'make-pictures.json'))) {
    return { isWorkspace: true };
  }
  if (fs.existsSync(path.join(dirPath, 'videos', 'make-pictures.json'))) {
    return { isWorkspace: true, autoDir: 'videos' };
  }

  // 3. package.json declaring @make-pictures/remotion, @make-pictures/cli, or make-pictures scripts
  const pkg = readPackageJson(dirPath);
  if (pkg) {
    const allDeps = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ];
    if (
      allDeps.includes('@make-pictures/remotion') ||
      allDeps.includes('@make-pictures/cli')
    ) {
      return { isWorkspace: true };
    }
    const scripts = pkg.scripts ?? {};
    if (
      Object.values(scripts).some(
        (cmd) => typeof cmd === 'string' && cmd.includes('make-pictures')
      )
    ) {
      return { isWorkspace: true };
    }
  }

  return { isWorkspace: false };
}

function isExistingRemotionRepo(dirPath: string): boolean {
  const pkg = readPackageJson(dirPath);
  if (pkg) {
    const allDeps = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ];
    if (allDeps.includes('remotion') || allDeps.includes('@remotion/cli')) {
      return true;
    }
  }
  return (
    fs.existsSync(path.join(dirPath, 'remotion.config.ts')) ||
    fs.existsSync(path.join(dirPath, 'remotion.config.mjs'))
  );
}

function findAvailableSubdir(parentDir: string, baseName: string): string {
  const sanitized =
    baseName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'my-films';

  const firstPath = path.join(parentDir, sanitized);
  if (!fs.existsSync(firstPath) || isEffectivelyEmptyDir(firstPath)) {
    return sanitized;
  }

  for (let idx = 2; idx <= 50; idx++) {
    const candidate = `${sanitized}-${idx}`;
    const candidatePath = path.join(parentDir, candidate);
    if (!fs.existsSync(candidatePath) || isEffectivelyEmptyDir(candidatePath)) {
      return candidate;
    }
  }
  return `${sanitized}-${Date.now()}`;
}

export function detectWorkspaceBootstrapState(
  rootDir: string,
  options: { dir?: string; target?: string } = {}
): WorkspaceBootstrapState {
  const direct = isMakePicturesWorkspaceDir(rootDir);
  if (direct.isWorkspace) {
    return {
      state: 'ready',
      effectiveRootDir: rootDir,
      effectiveDir: options.dir || direct.autoDir,
    };
  }

  const pkgPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    if (isEffectivelyEmptyDir(rootDir)) {
      return {
        state: 'empty_dir',
        effectiveRootDir: rootDir,
      };
    }

    const preferredName = options.target?.trim() || 'my-films';
    const candidateExisting = path.join(rootDir, preferredName);
    const subWorkspace = isMakePicturesWorkspaceDir(candidateExisting);
    if (subWorkspace.isWorkspace) {
      return {
        state: 'ready',
        effectiveRootDir: candidateExisting,
        effectiveDir: options.dir || subWorkspace.autoDir,
        resumedSubdir: preferredName,
      };
    }

    return {
      state: 'general_non_empty',
      effectiveRootDir: rootDir,
      targetSubdir: findAvailableSubdir(rootDir, preferredName),
    };
  }

  if (isExistingRemotionRepo(rootDir)) {
    return {
      state: 'existing_remotion',
      effectiveRootDir: rootDir,
    };
  }

  return {
    state: 'existing_app',
    effectiveRootDir: rootDir,
  };
}

function getCommandRunners(
  rootDir: string,
  options?: {
    preserveJsonFlag?: boolean;
    explicitLang?: 'pl' | 'en';
    dir?: string;
    resumedSubdir?: string;
  }
): {
  onboardCmd: (step: string) => string;
  humanOnboardCmd: string;
  studioCmd: string;
  doctorCmd: string;
  doctorSetupCmd: string;
} {
  const pkg = readPackageJson(rootDir);
  const scripts = pkg?.scripts ?? {};

  const hasOnboardScript = Boolean(scripts.onboard);
  const hasStudioScript = Boolean(scripts.studio);
  const hasDoctorScript = Boolean(scripts.doctor);
  const hasSetupScript = Boolean(scripts.setup);

  const dirRel = options?.dir && options.dir !== '.' ? options.dir : undefined;
  const dirFlag = dirRel
    ? ` ${shellQuoteArg(`--dir=${dirRel}`, '--dir')}`
    : '';
  const langFlag = options?.explicitLang ? ` --lang=${options.explicitLang}` : '';
  const jsonSuffix = options?.preserveJsonFlag ? ' --json' : '';
  const cwdFlag = options?.resumedSubdir
    ? ` ${shellQuoteArg(`--cwd=${options.resumedSubdir}`, '--cwd')}`
    : '';

  return {
    onboardCmd: (step: string) => {
      if (options?.resumedSubdir) {
        return `npx -y @make-pictures/cli@latest onboard ${step}${cwdFlag}${dirFlag}${langFlag}${jsonSuffix}`;
      }
      return hasOnboardScript && !dirRel
        ? `npm run onboard -- ${step}${langFlag}${jsonSuffix}`
        : `npx make-pictures onboard ${step}${dirFlag}${langFlag}${jsonSuffix}`;
    },
    humanOnboardCmd:
      hasOnboardScript && !dirRel
        ? 'npm run onboard'
        : `npx make-pictures onboard${dirFlag}`,
    studioCmd: dirRel
      ? `npx make-pictures studio${dirFlag}`
      : hasStudioScript
        ? 'npm run studio'
        : 'npx remotion studio',
    doctorCmd:
      hasDoctorScript && !dirRel
        ? 'npm run doctor'
        : `npx make-pictures doctor${dirFlag}`,
    doctorSetupCmd:
      hasSetupScript && !dirRel
        ? 'npm run setup'
        : `npx make-pictures doctor --setup${dirFlag}`,
  };
}

function hasNodeModules(rootDir: string): boolean {
  const hasRemotion = fs.existsSync(
    path.join(rootDir, 'node_modules', 'remotion', 'package.json')
  );
  if (!hasRemotion) return false;
  return (
    fs.existsSync(
      path.join(rootDir, 'node_modules', '@make-pictures', 'remotion', 'package.json')
    ) ||
    fs.existsSync(
      path.join(rootDir, 'node_modules', '@make-pictures', 'cli', 'package.json')
    ) ||
    fs.existsSync(
      path.join(rootDir, 'node_modules', '@elevenlabs', 'elevenlabs-js', 'package.json')
    ) ||
    fs.existsSync(path.join(rootDir, 'packages', 'remotion', 'src', 'index.ts'))
  );
}

function defaultHasFfmpeg(): boolean {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function defaultInstallDeps(rootDir: string): boolean {
  const npmCmd = getNpmCommand();
  const res = spawnSync(npmCmd, ['install'], {
    cwd: rootDir,
    stdio: 'inherit',
  });
  return res.status === 0;
}

function ensureGitignore(rootDir: string): void {
  const gitignorePath = path.join(rootDir, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, '.env.local\n', 'utf8');
    return;
  }
  const content = fs.readFileSync(gitignorePath, 'utf8');
  if (!content.split(/\r?\n/).some((line) => line.trim() === '.env.local')) {
    fs.appendFileSync(gitignorePath, '\n.env.local\n', 'utf8');
  }
}

function readApiKeyFromEnvLocal(envLocalPath: string): string | null {
  if (!fs.existsSync(envLocalPath)) return null;
  const content = fs.readFileSync(envLocalPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line
      .slice(eqIdx + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    if (
      key === 'ELEVENLABS_API_KEY' &&
      val &&
      val !== 'your_elevenlabs_api_key_here' &&
      val !== 'twoj_klucz_api_elevenlabs'
    ) {
      return val;
    }
  }
  return null;
}

function ensureEnvLocalTemplate(
  envLocalPath: string,
  envExamplePath: string,
  lang: 'pl' | 'en' = 'en'
): void {
  if (fs.existsSync(envLocalPath)) {
    // Preserve any existing .env.local secrets and append ELEVENLABS_API_KEY placeholder only if missing
    const existing = fs.readFileSync(envLocalPath, 'utf8');
    const hasKeyLine = existing
      .split(/\r?\n/)
      .some((raw) => raw.trim().startsWith('ELEVENLABS_API_KEY='));
    if (!hasKeyLine) {
      const defaultVoiceId = getDefaultVoiceIdForLang(lang);
      const additions: string[] = ['ELEVENLABS_API_KEY=your_elevenlabs_api_key_here'];
      if (!existing.includes('ELEVENLABS_VOICE_ID=')) {
        additions.push(`ELEVENLABS_VOICE_ID=${defaultVoiceId}`);
      }
      if (!existing.includes('ELEVENLABS_MODEL_ID=')) {
        additions.push(`ELEVENLABS_MODEL_ID=${DEFAULT_ELEVENLABS_MODEL_ID}`);
      }
      const prefix = existing.length === 0 || existing.endsWith('\n') ? '' : '\n';
      fs.writeFileSync(
        envLocalPath,
        `${existing}${prefix}${additions.join('\n')}\n`,
        { mode: 0o600 }
      );
      try {
        fs.chmodSync(envLocalPath, 0o600);
      } catch {
        // Ignore chmod errors on non-POSIX filesystems
      }
    }
    return;
  }
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envLocalPath);
    try {
      fs.chmodSync(envLocalPath, 0o600);
    } catch {
      // Ignore chmod errors on non-POSIX filesystems
    }
  } else {
    const defaultVoiceId = getDefaultVoiceIdForLang(lang);
    fs.writeFileSync(
      envLocalPath,
      `ELEVENLABS_API_KEY=your_elevenlabs_api_key_here\nELEVENLABS_VOICE_ID=${defaultVoiceId}\nELEVENLABS_MODEL_ID=${DEFAULT_ELEVENLABS_MODEL_ID}\n`,
      { mode: 0o600 }
    );
  }
}

/**
 * Non-destructively strips only placeholder `ELEVENLABS_API_KEY=...` lines from an existing
 * `.env.local` while preserving all other user secrets (`DATABASE_URL`, `GEMINI_API_KEY`, etc.).
 * Never deletes `.env.local`.
 */
function stripPlaceholderElevenLabsKeyInPlace(envLocalPath: string): void {
  if (!fs.existsSync(envLocalPath)) return;
  const content = fs.readFileSync(envLocalPath, 'utf8');
  const lines = content.split(/\r?\n/);
  let changed = false;
  const kept: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed
          .slice(eqIdx + 1)
          .trim()
          .replace(/^['"]|['"]$/g, '');
        if (
          key === 'ELEVENLABS_API_KEY' &&
          (!val ||
            val === 'your_elevenlabs_api_key_here' ||
            val === 'twoj_klucz_api_elevenlabs')
        ) {
          changed = true;
          continue;
        }
      }
    }
    kept.push(rawLine);
  }

  if (changed) {
    const nextContent = kept.join('\n').replace(/^\n+/, '');
    fs.writeFileSync(
      envLocalPath,
      nextContent.length > 0 && !nextContent.endsWith('\n')
        ? `${nextContent}\n`
        : nextContent,
      { mode: 0o600 }
    );
    try {
      fs.chmodSync(envLocalPath, 0o600);
    } catch {
      // Ignore chmod errors on non-POSIX filesystems
    }
  }
}

function ensureVoiceDefaultsInEnvLocal(
  rootDir: string,
  envLocalPath: string,
  lang: 'pl' | 'en' = 'en'
): void {
  ensureGitignore(rootDir);
  if (!fs.existsSync(envLocalPath)) return;
  let content = fs.readFileSync(envLocalPath, 'utf8');
  let updated = false;
  if (!content.includes('ELEVENLABS_VOICE_ID=')) {
    const defaultVoiceId = getDefaultVoiceIdForLang(lang);
    content = `${content.trimEnd()}\nELEVENLABS_VOICE_ID=${defaultVoiceId}\n`;
    updated = true;
  }
  if (!content.includes('ELEVENLABS_MODEL_ID=')) {
    content = `${content.trimEnd()}\nELEVENLABS_MODEL_ID=${DEFAULT_ELEVENLABS_MODEL_ID}\n`;
    updated = true;
  }
  if (updated) {
    fs.writeFileSync(envLocalPath, content, { mode: 0o600 });
  }
}

function defaultRunElevenLabsOnboard(
  rootDir: string,
  subcommandArgs: string[]
): OnboardReply | null {
  const res = spawnSync(
    getNpxCommand(),
    [
      '-y',
      '@elevenlabs/cli@latest',
      'onboard',
      ...subcommandArgs,
      '--env-path',
      '.env.local',
      '--format',
      'json',
    ],
    {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  if (res.signal === 'SIGINT' || res.status === 130) {
    return { next: 'cancelled', say: 'Cancelled by user.' };
  }
  const stdout = (res.stdout || '').trim();
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(lines[i]) as OnboardReply;
    } catch {
      // Try earlier line if npx emitted an info line
    }
  }
  return null;
}

function isWaitReply(reply: OnboardReply | null): boolean {
  if (!reply) return false;
  return (
    reply.next === 'wait' ||
    Boolean(reply.run && reply.run.includes('connect --wait'))
  );
}

/**
 * Remotion-first onboarding workflow supporting:
 * 1. 3-mode workspace bootstrap (`empty_dir` -> `create-make-pictures`, `existing_remotion` -> `init` in-place,
 *    `existing_app` -> `init --dir=videos` vs standalone) + tandem AI skills (`npx remotion skills add` + bundled skills).
 * 2. Optional ElevenLabs browser authorization (`--env-path .env.local`) or offline `--mock` workflow.
 * 3. Native Remotion Studio launch (`npx remotion studio`).
 */
export async function runOnboardCommand(
  options: OnboardCommandOptions = {}
): Promise<void> {
  const { rootDir: initialRootDir } = resolveWorkspaceContext({
    cwd: options.cwd,
  });

  const stdout = options.deps?.stdout ?? process.stdout;
  const env = options.deps?.env ?? process.env;
  const checkFfmpeg = options.deps?.checkFfmpeg ?? defaultHasFfmpeg;
  const installDeps = options.deps?.installDeps ?? defaultInstallDeps;
  const elevenLabsRunner =
    options.deps?.elevenLabsRunner ?? defaultRunElevenLabsOnboard;
  const maxWaitAttempts = options.deps?.maxWaitAttempts ?? 10;

  const lang = resolveOnboardLang(options.lang, env);
  const isPl = lang === 'pl';

  const useJson = shouldUseJsonOutput({
    json: options.json,
    human: options.human,
    isTTY: Boolean(stdout.isTTY),
    env,
  });

  const emit = (reply: OnboardReply): void => {
    const payload = {
      next: reply.next,
      instruction:
        reply.instruction || INSTRUCTIONS[reply.next] || INSTRUCTIONS.run,
      ...(reply.run ? { run: reply.run } : {}),
      say: reply.say,
      ...(reply.rules ? { rules: reply.rules } : {}),
      ...(reply.details ? { details: reply.details } : {}),
    };
    stdout.write(`${JSON.stringify(payload)}\n`);
  };

  const writeLine = (line = ''): void => {
    stdout.write(`${line}\n`);
  };

  // ---------------------------------------------------------------------------
  // Phase 0: 3-Mode Workspace Bootstrap Detection
  // ---------------------------------------------------------------------------
  const bootstrap = detectWorkspaceBootstrapState(initialRootDir, {
    dir: options.dir,
    target: options.target,
  });

  if (bootstrap.state !== 'ready') {
    const jsonSuffix = options.json ? ' --json' : '';
    const langFlag = `--lang=${lang}`;

    if (!useJson) {
      writeLine('==============================================================');
      writeLine(' 🎬 make.pictures v3 — Remotion Toolkit Onboarding');
      writeLine('==============================================================\n');
      if (bootstrap.state === 'empty_dir') {
        writeLine('📦 Empty directory detected — scaffold a native Remotion 4 project:');
        writeLine(`   npx -y create-make-pictures@latest . ${langFlag}`);
        writeLine('   npx remotion skills add');
        writeLine('   npm run onboard');
      } else if (bootstrap.state === 'existing_remotion') {
        writeLine(
          '📦 Existing Remotion project detected — add make.pictures in-place (preserves src/Root.tsx):'
        );
        writeLine('   npm install @make-pictures/remotion @make-pictures/cli');
        writeLine(`   npx make-pictures init ${langFlag}`);
        writeLine('   npx remotion skills add');
        writeLine(`   npx make-pictures onboard ${langFlag}`);
      } else if (bootstrap.state === 'existing_app') {
        writeLine('📦 Existing app detected — choose one:');
        writeLine(
          `   • Inside this app (videos/): npx make-pictures init --dir=videos ${langFlag}`
        );
        writeLine(
          `   • Separate folder (my-films/): npx -y create-make-pictures@latest my-films ${langFlag}`
        );
      } else {
        writeLine('📦 Create a new make.pictures Remotion project:');
        writeLine(
          `   npx -y create-make-pictures@latest ${bootstrap.targetSubdir} ${langFlag}`
        );
        writeLine(`   cd ${bootstrap.targetSubdir} && npm run onboard`);
      }
      return;
    }

    if (bootstrap.state === 'empty_dir') {
      emit({
        next: 'run',
        say: isPl
          ? 'Tworzę natywny projekt Remotion 4 + make.pictures v3 w tym folderze i instaluję skille w tandemie (`remotion-dev/skills` + make.pictures).'
          : "I'll scaffold a native Remotion 4 + make.pictures v3 project in this folder and install tandem AI skills (`remotion-dev/skills` + make.pictures).",
        run: `npx -y create-make-pictures@latest . ${langFlag} && npx make-pictures init ${langFlag} && npx -y remotion skills add && npm run onboard -- init ${langFlag}${jsonSuffix}`,
        details: {
          mode: 'empty_dir',
          remotion_skills_command: 'npx remotion skills add',
        },
      });
      return;
    }

    if (bootstrap.state === 'existing_remotion') {
      emit({
        next: 'run',
        say: isPl
          ? 'Wykryłem istniejący projekt Remotion. Dodaję `@make-pictures/remotion` i `@make-pictures/cli` bezpośrednio w tym repozytorium (bez nadpisywania `src/Root.tsx`) oraz instaluję skille w tandemie (`npx remotion skills add`).'
          : 'I detected an existing Remotion repository. Adding `@make-pictures/remotion` and `@make-pictures/cli` in-place (preserving your `src/Root.tsx`) and syncing tandem skills (`npx remotion skills add`).',
        run: `npm install @make-pictures/remotion@latest @make-pictures/cli@latest && npx make-pictures init ${langFlag} && npx -y remotion skills add && npx make-pictures onboard init ${langFlag}${jsonSuffix}`,
        details: {
          mode: 'existing_remotion',
          preserves_root_tsx: true,
          remotion_skills_command: 'npx remotion skills add',
        },
      });
      return;
    }

    if (bootstrap.state === 'general_non_empty') {
      const sub = bootstrap.targetSubdir;
      const qSub = shellQuoteArg(sub, 'target directory');
      const qCwdSub = shellQuoteArg(`--cwd=${sub}`, '--cwd');
      emit({
        next: 'run',
        say: isPl
          ? `Tworzę nowy projekt Remotion 4 + make.pictures v3 w podfolderze \`${sub}/\` i instaluję skille AI w tandemie.`
          : `I'll create a new Remotion 4 + make.pictures v3 project in \`${sub}/\` and install tandem AI skills.`,
        run: `npx -y create-make-pictures@latest ${qSub} ${langFlag} && npx -y @make-pictures/cli@latest init ${qCwdSub} ${langFlag} && (cd ${qSub} && npx -y remotion skills add) && npx -y @make-pictures/cli@latest onboard init ${qCwdSub} ${langFlag}${jsonSuffix}`,
        details: {
          workspace_dir: sub,
          remotion_skills_command: 'npx remotion skills add',
        },
      });
      return;
    }

    // bootstrap.state === 'existing_app'
    const saasDir = options.dir?.trim() || 'videos';
    const qSaasDirFlag = shellQuoteArg(`--dir=${saasDir}`, '--dir');
    const standaloneTarget = findAvailableSubdir(
      initialRootDir,
      options.target?.trim() || 'my-films'
    );
    const qStandaloneTarget = shellQuoteArg(standaloneTarget, 'target directory');
    const qStandaloneCwdFlag = shellQuoteArg(
      `--cwd=${standaloneTarget}`,
      '--cwd'
    );
    const qStandaloneTargetFlag = shellQuoteArg(
      `--target=${standaloneTarget}`,
      '--target'
    );

    if (options.mode === 'saas') {
      emit({
        next: 'run',
        say: isPl
          ? `Dodaję Remotion + make.pictures v3 w podfolderze \`${saasDir}/\` Twojej aplikacji i instaluję skille w tandemie.`
          : `I'll add Remotion + make.pictures v3 inside \`${saasDir}/\` of your existing app and install tandem skills.`,
        run: `npm install -D @make-pictures/remotion@latest @make-pictures/cli@latest remotion @remotion/cli @remotion/bundler @remotion/renderer @remotion/google-fonts @remotion/media-utils @remotion/zod-types lucide-react zod && npx make-pictures init ${qSaasDirFlag} ${langFlag} && npx -y remotion skills add && npx make-pictures onboard init ${qSaasDirFlag} ${langFlag}${jsonSuffix}`,
        details: {
          mode: 'saas',
          dir: saasDir,
          remotion_skills_command: 'npx remotion skills add',
        },
      });
      return;
    }

    if (options.mode === 'standalone') {
      emit({
        next: 'run',
        say: isPl
          ? `Tworzę osobny projekt Remotion 4 + make.pictures v3 w podfolderze \`${standaloneTarget}/\`.`
          : `I'll create a separate standalone Remotion 4 + make.pictures v3 project in \`${standaloneTarget}/\`.`,
        run: `npx -y create-make-pictures@latest ${qStandaloneTarget} ${langFlag} && npx -y @make-pictures/cli@latest init ${qStandaloneCwdFlag} ${langFlag} && (cd ${qStandaloneTarget} && npx -y remotion skills add) && npx -y @make-pictures/cli@latest onboard init ${qStandaloneCwdFlag} ${langFlag}${jsonSuffix}`,
        details: {
          mode: 'standalone',
          workspace_dir: standaloneTarget,
          remotion_skills_command: 'npx remotion skills add',
        },
      });
      return;
    }

    const saasChoiceCmd = `npx -y @make-pictures/cli@latest onboard --mode=saas ${qSaasDirFlag} ${langFlag}${jsonSuffix}`;
    const standaloneChoiceCmd = `npx -y @make-pictures/cli@latest onboard --mode=standalone ${qStandaloneTargetFlag} ${langFlag}${jsonSuffix}`;

    emit({
      next: 'ask_choice',
      instruction:
        'Ask the user `say` and wait for their answer. If they choose inside this app (`videos/`), run `details.choices.saas`. If they choose a separate project (`my-films/`), run `details.choices.standalone`.',
      say: isPl
        ? `W tym folderze znajduje się już istniejąca aplikacja. Czy mam dodać Remotion + make.pictures w podfolderze \`${saasDir}/\` tej aplikacji, czy utworzyć osobny projekt w podfolderze \`${standaloneTarget}/\`?`
        : `I detected an existing application in this folder. Would you like to add Remotion + make.pictures inside \`${saasDir}/\` of this app, or create a separate standalone project in \`${standaloneTarget}/\`?`,
      details: {
        choices: {
          saas: saasChoiceCmd,
          standalone: standaloneChoiceCmd,
        },
      },
    });
    return;
  }

  const rootDir = bootstrap.effectiveRootDir;
  const effectiveDir = bootstrap.effectiveDir;
  const resumedSubdir = bootstrap.resumedSubdir;
  const envLocalPath = path.join(rootDir, '.env.local');
  const envExamplePath = path.join(rootDir, '.env.example');

  const {
    onboardCmd,
    humanOnboardCmd,
    studioCmd,
    doctorCmd,
    doctorSetupCmd,
  } = getCommandRunners(rootDir, {
    preserveJsonFlag: Boolean(options.json),
    explicitLang: options.lang,
    dir: effectiveDir,
    resumedSubdir,
  });

  // ---------------------------------------------------------------------------
  // Human Interactive Terminal UX
  // ---------------------------------------------------------------------------
  if (!useJson) {
    const rawStep = options.step?.toLowerCase();
    const extraArgs = options.extraArgs ?? [];
    const forceReplace = extraArgs.includes('--replace');

    writeLine('==============================================================');
    writeLine(' 🎬 make.pictures v3 — Remotion Toolkit Onboarding');
    writeLine('==============================================================\n');

    ensureGitignore(rootDir);

    if (!hasNodeModules(rootDir)) {
      if (rawStep === 'check' || rawStep === 'status') {
        writeLine('❌ Project dependencies are not installed yet.');
        writeLine(
          '   Run `npm install` first, then re-run `' + humanOnboardCmd + '`.'
        );
        return;
      }
      writeLine('📦 Installing Remotion & make.pictures dependencies (npm install)...');
      const installed = installDeps(rootDir);
      if (!installed || !hasNodeModules(rootDir)) {
        throw new Error(
          `Dependency installation did not complete. Please run \`npm install\` and re-run \`${humanOnboardCmd}\`.`
        );
      }
    }
    writeLine('✅ Remotion 4 + make.pictures packages verified');

    if (checkFfmpeg()) {
      writeLine('✅ FFmpeg audio/video engine ready');
    } else {
      writeLine(
        '⚠️  FFmpeg not found in PATH (install via `brew install ffmpeg` on macOS, `sudo apt install ffmpeg` on Linux, or `winget install Gyan.FFmpeg` on Windows before rendering).'
      );
    }

    const resolveValidKey = (): string | null => {
      const candidate =
        readApiKeyFromEnvLocal(envLocalPath) || env.ELEVENLABS_API_KEY?.trim();
      if (
        !candidate ||
        candidate === 'your_elevenlabs_api_key_here' ||
        candidate === 'twoj_klucz_api_elevenlabs'
      ) {
        return null;
      }
      return candidate;
    };

    const printReadySummary = (key: string): void => {
      ensureVoiceDefaultsInEnvLocal(rootDir, envLocalPath, lang);
      const checkReply = elevenLabsRunner(rootDir, ['check']);
      if (
        checkReply &&
        (checkReply.next === 'fix' || checkReply.next === 'ask_user')
      ) {
        writeLine(`\n⚠️  ${checkReply.say}`);
        return;
      }

      const keyLast4 = key.slice(-4);
      writeLine(
        `✅ ElevenLabs API key (...${keyLast4}) verified in .env.local!\n`
      );
      writeLine('✨ make.pictures v3 is ready!');
      writeLine('   • Tandem AI skills:    npx remotion skills add');
      writeLine(`   • Native preview:      ${studioCmd}  (Remotion Studio)`);
      writeLine('   • New composition:     npx make-pictures new my-film');
    };

    const existingKey = resolveValidKey();

    if (rawStep === 'check' || rawStep === 'status') {
      if (!existingKey) {
        writeLine('\n⚠️  ElevenLabs API key is not configured in .env.local yet (optional).');
        writeLine(`   • Authorize in browser: ${humanOnboardCmd}`);
        writeLine(`   • Work offline (--mock): ${doctorSetupCmd}`);
        writeLine(`   • Launch Remotion Studio: ${studioCmd}`);
        return;
      }
      printReadySummary(existingKey);
      return;
    }

    if (
      existingKey &&
      rawStep !== 'connect' &&
      rawStep !== 'wait' &&
      !forceReplace
    ) {
      printReadySummary(existingKey);
      return;
    }

    if (fs.existsSync(envLocalPath) && !readApiKeyFromEnvLocal(envLocalPath)) {
      stripPlaceholderElevenLabsKeyInPlace(envLocalPath);
    }

    writeLine('\n🔑 Connecting ElevenLabs (Optional — Voiceovers, AI Music & SFX)...');
    writeLine('   Opening the ElevenLabs approval page in your browser.');
    writeLine(
      '   Sign in (or create an account) and click "Authorize" — your API key'
    );
    writeLine('   will be saved directly to `.env.local`.');
    writeLine(
      `   (Prefer offline mode without an API key right now? Press Ctrl+C and run \`${doctorSetupCmd}\`.)\n`
    );

    const connectArgs =
      rawStep === 'wait'
        ? ['connect', '--wait', ...extraArgs.filter((a) => a !== '--wait')]
        : ['connect', ...extraArgs];

    let reply = elevenLabsRunner(rootDir, connectArgs);

    if (reply?.next === 'cancelled') {
      writeLine(
        `⏹️  Onboarding cancelled. Run \`${doctorSetupCmd}\` if you prefer to work offline without an ElevenLabs key.`
      );
      return;
    }

    if (!reply) {
      ensureEnvLocalTemplate(envLocalPath, envExamplePath, lang);
      writeLine('⚠️  Could not launch browser authorization automatically.');
      writeLine('📄 Created `.env.local` template.\n');
      writeLine('Next steps:');
      writeLine(
        '   1. Create an ElevenLabs API key at https://elevenlabs.io/app/settings/api-keys'
      );
      writeLine(
        '   2. Save it as `ELEVENLABS_API_KEY=...` inside `.env.local`'
      );
      writeLine(
        `   3. Verify with \`${doctorCmd}\` or launch Remotion Studio with \`${studioCmd}\``
      );
      return;
    }

    if (isWaitReply(reply)) {
      if (reply.say) {
        writeLine(`   ${reply.say}`);
      }
      writeLine('⏳ Waiting for browser authorization...');

      const waitExtra = extraArgs.filter(
        (a) => a !== '--wait' && a !== '--no-browser'
      );
      for (let attempt = 0; attempt < maxWaitAttempts; attempt++) {
        if (resolveValidKey()) break;
        reply = elevenLabsRunner(rootDir, ['connect', '--wait', ...waitExtra]);
        if (
          reply?.next === 'cancelled' ||
          resolveValidKey() ||
          !isWaitReply(reply)
        ) {
          break;
        }
      }
    }

    if (reply?.next === 'cancelled') {
      writeLine(
        `\n⏹️  Onboarding cancelled. Run \`${doctorSetupCmd}\` if you prefer to work offline without an ElevenLabs key.`
      );
      return;
    }

    const connectedKey = resolveValidKey();
    if (connectedKey) {
      printReadySummary(connectedKey);
      return;
    }

    if (reply?.say) {
      writeLine(`\n⚠️  ${reply.say}`);
    } else {
      writeLine('\n⚠️  Browser authorization did not complete.');
    }
    writeLine(
      `   Re-run \`${humanOnboardCmd}\` to try again, or run \`${doctorSetupCmd}\` for offline mode.`
    );
    return;
  }

  // ---------------------------------------------------------------------------
  // Agent / Non-TTY Deterministic JSON State Machine (`init` -> `connect` -> `wait` -> `check`)
  // ---------------------------------------------------------------------------
  const workspaceDirRel = path.relative(initialRootDir, rootDir) || '.';
  const agentsMdRel =
    workspaceDirRel !== '.' ? `${workspaceDirRel}/AGENTS.md` : 'AGENTS.md';
  const skillsDirRel =
    workspaceDirRel !== '.'
      ? `${workspaceDirRel}/.agents/skills/`
      : '.agents/skills/';
  const qWorkspaceDirRel =
    workspaceDirRel !== '.'
      ? shellQuoteArg(workspaceDirRel, 'workspace directory')
      : '.';
  const studioLaunchCmd =
    workspaceDirRel !== '.' ? `cd ${qWorkspaceDirRel} && ${studioCmd}` : studioCmd;

  const rules = [
    `Never open, print or cat .env.local; run \`${onboardCmd('check')}\` or \`${doctorCmd}\` to verify it.`,
    'Never ask for an API key in chat, and never accept one pasted there.',
    'Never put the API key in code; tools read ELEVENLABS_API_KEY from .env.local.',
    `Always read ${agentsMdRel} and ${skillsDirRel} alongside official \`remotion-dev/skills\` (\`npx remotion skills add\`) before writing or rendering any animation.`,
  ];

  const handleCheck = async (): Promise<void> => {
    ensureVoiceDefaultsInEnvLocal(rootDir, envLocalPath, lang);
    const key =
      readApiKeyFromEnvLocal(envLocalPath) || env.ELEVENLABS_API_KEY?.trim();

    if (
      !key ||
      key === 'your_elevenlabs_api_key_here' ||
      key === 'twoj_klucz_api_elevenlabs'
    ) {
      await handleInit();
      return;
    }

    const checkReply = elevenLabsRunner(rootDir, ['check']);
    if (
      checkReply &&
      (checkReply.next === 'fix' || checkReply.next === 'ask_user')
    ) {
      emit({
        next: checkReply.next,
        instruction: checkReply.instruction,
        say: checkReply.say,
        run: onboardCmd('check'),
        rules,
        details: checkReply.details,
      });
      return;
    }

    const keyLast4 = key.slice(-4);
    const finalInstruction = `Ensure tandem skills are installed (\`npx remotion skills add\` + \`${skillsDirRel}\`). Start native Remotion Studio (\`${studioLaunchCmd}\` or \`npx remotion studio\`) as a background/daemon process without blocking your turn. Read \`${agentsMdRel}\` and load relevant skills from \`${skillsDirRel}\` when building scenes. Do NOT synthesize demo voiceovers during setup so zero ElevenLabs credits are spent upfront. Tell the user \`say\` and end your turn to wait for their film idea.`;

    emit({
      next: 'ask_what_to_build',
      instruction: finalInstruction,
      say: isPl
        ? `Środowisko make.pictures v3 + Remotion jest gotowe! Klucz ElevenLabs (końcówka ${keyLast4}) został zapisany w .env.local, a natywne Remotion Studio (z wbudowaną kompozycją StyleLab i inspektorem Zod) możesz uruchomić poleceniem \`${studioLaunchCmd}\`. Jaki film chcesz stworzyć? Opisz krótko temat, klimat plastyczny i opcjonalnie czy wolisz format poziomy 16:9 czy pionowy Short 9:16.`
        : `make.pictures v3 + Remotion is ready! Your ElevenLabs API key (ending in ${keyLast4}) is saved in .env.local, and native Remotion Studio (with the built-in StyleLab composition and Zod Props Inspector) runs via \`${studioLaunchCmd}\`. What film would you like to create? Describe the topic, visual mood/style, and optionally 16:9 landscape or 9:16 vertical.`,
      rules,
      details: {
        env_file: '.env.local',
        key_last4: keyLast4,
        workspace_dir: workspaceDirRel,
        remotion_studio: true,
        studio_command: studioLaunchCmd,
        remotion_skills_command: 'npx remotion skills add',
        visual_kits: [...SCENES_KIT_IDS],
        built_in_styles: [...BUILT_IN_STYLE_IDS],
        docs: [agentsMdRel, skillsDirRel],
      },
    });
  };

  const handleInit = async (): Promise<void> => {
    ensureGitignore(rootDir);

    if (!hasNodeModules(rootDir)) {
      const installPrefix =
        workspaceDirRel !== '.'
          ? `cd ${qWorkspaceDirRel} && npm install`
          : 'npm install';
      emit({
        next: 'run',
        say: isPl
          ? 'Instaluję zależności Remotion 4 i make.pictures v3.'
          : "First, I'll install the Remotion 4 and make.pictures v3 dependencies.",
        run: `${installPrefix} && ${onboardCmd('init')}`,
        rules,
      });
      return;
    }

    if (!checkFfmpeg()) {
      emit({
        next: 'fix',
        say: isPl
          ? 'Do detekcji czasu audio, masteringu głośności (-14 LUFS) i renderu wideo 60 FPS wymagany jest FFmpeg. Zainstaluj proszę FFmpeg (np. `brew install ffmpeg` na macOS, `sudo apt install ffmpeg` na Ubuntu/Debian lub `winget install Gyan.FFmpeg` na Windows).'
          : 'FFmpeg is required for audio duration detection, loudness mastering (-14 LUFS), and 60 FPS video rendering. Please install FFmpeg (e.g. `brew install ffmpeg` on macOS, `sudo apt install ffmpeg` on Ubuntu/Debian, or `winget install Gyan.FFmpeg` on Windows).',
        run: onboardCmd('init'),
        rules,
      });
      return;
    }

    const existingKey =
      readApiKeyFromEnvLocal(envLocalPath) || env.ELEVENLABS_API_KEY?.trim();
    if (
      existingKey &&
      existingKey !== 'your_elevenlabs_api_key_here' &&
      existingKey !== 'twoj_klucz_api_elevenlabs'
    ) {
      await handleCheck();
      return;
    }

    if (fs.existsSync(envLocalPath) && !readApiKeyFromEnvLocal(envLocalPath)) {
      stripPlaceholderElevenLabsKeyInPlace(envLocalPath);
    }

    emit({
      next: 'run',
      say: isPl
        ? 'Teraz (opcjonalnie) połączę ElevenLabs w Twojej przeglądarce. Zaloguj się i kliknij Authorize — klucz API zapisze się bezpośrednio w `.env.local` bez pojawiania się na czacie (możesz też pracować całkowicie offline z flagą `--mock`).'
        : "Next, I'll optionally open the ElevenLabs approval page in your browser. Sign in and click Authorize — your API key will be saved directly to `.env.local` without ever appearing in chat (or you can work offline with `--mock`).",
      run: onboardCmd('connect'),
      rules,
      details: {
        env_file: '.env.local',
        optional: true,
        remotion_skills_command: 'npx remotion skills add',
        fallback_note: isPl
          ? `Jeśli wolisz teraz pracować offline bez klucza ElevenLabs, powiedz mi o tym, a uruchomię \`${doctorSetupCmd}\` oraz \`${studioLaunchCmd}\`.`
          : `If you prefer to work offline without an ElevenLabs key right now, tell me and run \`${doctorSetupCmd}\` and \`${studioLaunchCmd}\`.`,
      },
    });
  };

  const handleConnect = async (extraArgs: string[]): Promise<void> => {
    ensureGitignore(rootDir);
    const reply = elevenLabsRunner(rootDir, ['connect', ...extraArgs]);

    if (!reply) {
      ensureEnvLocalTemplate(envLocalPath, envExamplePath, lang);
      emit({
        next: 'ask_user',
        say: isPl
          ? 'Utworzyłem plik `.env.local`. Wygeneruj klucz API na stronie https://elevenlabs.io/app/settings/api-keys i wklej go jako `ELEVENLABS_API_KEY` bezpośrednio w pliku `.env.local` (nie wklejaj klucza na czacie), a potem daj mi znać.'
          : 'I created `.env.local`. Create an ElevenLabs API key at https://elevenlabs.io/app/settings/api-keys and save it as `ELEVENLABS_API_KEY` in `.env.local` (do not paste it in chat), then tell me when you are ready.',
        run: onboardCmd('check'),
        rules,
      });
      return;
    }

    if (isWaitReply(reply)) {
      emit({
        next: 'wait',
        instruction: reply.instruction,
        say: reply.say,
        run: onboardCmd('wait'),
        rules,
        details: reply.details,
      });
      return;
    }

    if (
      readApiKeyFromEnvLocal(envLocalPath) ||
      (reply.run && reply.run.includes('onboard check'))
    ) {
      await handleCheck();
      return;
    }

    emit({
      next: reply.next || 'run',
      instruction: reply.instruction,
      say: reply.say,
      run: onboardCmd('check'),
      rules,
      details: reply.details,
    });
  };

  const step = (options.step || 'init').toLowerCase();
  if (step === 'connect') {
    await handleConnect(options.extraArgs ?? []);
  } else if (step === 'wait') {
    await handleConnect(['--wait', ...(options.extraArgs ?? [])]);
  } else if (step === 'check' || step === 'status') {
    await handleCheck();
  } else {
    await handleInit();
  }
}
