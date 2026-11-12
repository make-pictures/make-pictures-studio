import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { resolveWorkspaceContext } from './workspace-paths';

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
  isPortOpen?: (port: number, host?: string) => Promise<boolean>;
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
    'Tell the user `say`, then end your turn and wait for their answer. Read AGENTS.md and .agents/plugins/make-pictures/skills/ to guide them through creating their 60 FPS animation.',
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

function isMakePicturesWorkspaceDir(dirPath: string): {
  isWorkspace: boolean;
  autoDir?: string;
} {
  if (!fs.existsSync(dirPath)) {
    return { isWorkspace: false };
  }

  // 1. Engine monorepo
  if (
    fs.existsSync(path.join(dirPath, 'packages', 'core', 'src', 'index.ts')) &&
    fs.existsSync(path.join(dirPath, 'packages', 'kits', 'src', 'index.ts'))
  ) {
    return { isWorkspace: true };
  }

  // 2. Existing capsule directories
  if (fs.existsSync(path.join(dirPath, 'productions'))) {
    return { isWorkspace: true };
  }
  if (fs.existsSync(path.join(dirPath, 'videos', 'productions'))) {
    return { isWorkspace: true, autoDir: 'videos' };
  }

  // 3. package.json declaring @make-pictures/* or make-pictures scripts
  const pkgPath = path.join(dirPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        scripts?: Record<string, string>;
      };
      const allDeps = [
        ...Object.keys(pkg.dependencies ?? {}),
        ...Object.keys(pkg.devDependencies ?? {}),
      ];
      if (allDeps.some((dep) => dep.startsWith('@make-pictures/'))) {
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
    } catch {
      // Ignore malformed package.json
    }
  }

  return { isWorkspace: false };
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
  const pkgPath = path.join(rootDir, 'package.json');
  let scripts: Record<string, string> = {};
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
        scripts?: Record<string, string>;
      };
      scripts = pkg.scripts ?? {};
    } catch {
      // Ignore malformed package.json
    }
  }

  const hasOnboardScript = Boolean(scripts.onboard);
  const hasStudioScript = Boolean(scripts.studio);
  const hasDoctorScript = Boolean(scripts.doctor);
  const hasSetupScript = Boolean(scripts.setup);

  const dirRel = options?.dir && options.dir !== '.' ? options.dir : undefined;
  const dirFlag = dirRel ? ` --dir=${dirRel}` : '';
  const langFlag = options?.explicitLang ? ` --lang=${options.explicitLang}` : '';
  const jsonSuffix = options?.preserveJsonFlag ? ' --json' : '';
  const cwdFlag = options?.resumedSubdir ? ` --cwd=${options.resumedSubdir}` : '';

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
    studioCmd:
      hasStudioScript && !dirRel
        ? 'npm run studio'
        : `npx make-pictures studio${dirFlag}`,
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
  return (
    fs.existsSync(
      path.join(rootDir, 'node_modules', 'remotion', 'package.json')
    ) &&
    fs.existsSync(
      path.join(rootDir, 'node_modules', '@remotion', 'player', 'package.json')
    ) &&
    (fs.existsSync(
      path.join(
        rootDir,
        'node_modules',
        '@elevenlabs',
        'elevenlabs-js',
        'package.json'
      )
    ) ||
      fs.existsSync(
        path.join(rootDir, 'node_modules', '@make-pictures', 'cli', 'package.json')
      ))
  );
}

function defaultHasFfmpeg(): boolean {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function defaultInstallDeps(rootDir: string): boolean {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const res = spawnSync(npmCmd, ['install'], {
    cwd: rootDir,
    stdio: 'inherit',
  });
  return res.status === 0;
}

function defaultIsPortOpen(
  port = 3000,
  host = '127.0.0.1'
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    const finish = (open: boolean): void => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(250);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
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
  envExamplePath: string
): void {
  if (fs.existsSync(envLocalPath)) return;
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envLocalPath);
  } else {
    fs.writeFileSync(
      envLocalPath,
      'ELEVENLABS_API_KEY=your_elevenlabs_api_key_here\nELEVENLABS_VOICE_ID=TX3LPaxmHKxFdv7VOQHJ\nELEVENLABS_MODEL_ID=eleven_multilingual_v2\n',
      { mode: 0o600 }
    );
  }
}

function ensureVoiceDefaultsInEnvLocal(
  rootDir: string,
  envLocalPath: string
): void {
  ensureGitignore(rootDir);
  if (!fs.existsSync(envLocalPath)) return;
  let content = fs.readFileSync(envLocalPath, 'utf8');
  let updated = false;
  if (!content.includes('ELEVENLABS_VOICE_ID=')) {
    content = `${content.trimEnd()}\nELEVENLABS_VOICE_ID=TX3LPaxmHKxFdv7VOQHJ\n`;
    updated = true;
  }
  if (!content.includes('ELEVENLABS_MODEL_ID=')) {
    content = `${content.trimEnd()}\nELEVENLABS_MODEL_ID=eleven_multilingual_v2\n`;
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
    'npx',
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
 * Onboarding workflow supporting both:
 * 1. Zero-terminal one-paste bootstrap + deterministic JSON state machine
 *    (`bootstrap` -> `init` -> `connect` -> `wait` -> `check` -> background Studio Web)
 *    for AI coding agents (Google Antigravity, Claude Code, Cursor, Codex).
 * 2. Interactive terminal UX for human creators (`npm run onboard`).
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
  const isPortOpen = options.deps?.isPortOpen ?? defaultIsPortOpen;
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
  // Phase 0: Workspace Bootstrap Detection (when run in a directory without make.pictures yet)
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
      writeLine(' 🎬 make.pictures — Video-as-Code Studio Onboarding');
      writeLine('==============================================================\n');
      if (bootstrap.state === 'empty_dir') {
        writeLine('📦 Empty directory detected — run:');
        writeLine(`   npx -y create-make-pictures@latest . ${langFlag}`);
        writeLine('   npm run onboard');
      } else if (bootstrap.state === 'existing_app') {
        writeLine('📦 Existing app detected — choose one:');
        writeLine(
          `   • Inside this app (videos/): npx make-pictures init --dir=videos ${langFlag}`
        );
        writeLine(
          `   • Separate folder (my-films/): npx -y create-make-pictures@latest my-films ${langFlag}`
        );
      } else {
        writeLine('📦 Create a new make.pictures Studio project:');
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
          ? 'Instaluję projekt studia filmowego make.pictures bezpośrednio w tym folderze (Remotion 60 FPS, Three.js, ElevenLabs oraz skille AI).'
          : "I'll install make.pictures Studio directly in this folder (Remotion 60 FPS, Three.js, ElevenLabs, and AI skills).",
        run: `npx -y create-make-pictures@latest . ${langFlag} && npm run onboard -- init ${langFlag}${jsonSuffix}`,
      });
      return;
    }

    if (bootstrap.state === 'general_non_empty') {
      const sub = bootstrap.targetSubdir;
      emit({
        next: 'run',
        say: isPl
          ? `Tworzę nowy projekt studia filmowego make.pictures w podfolderze \`${sub}/\` i instaluję pakiety.`
          : `I'll create a new make.pictures Studio project in \`${sub}/\` and install its packages.`,
        run: `npx -y create-make-pictures@latest ${sub} ${langFlag} && npx -y @make-pictures/cli@latest onboard init --cwd=${sub} ${langFlag}${jsonSuffix}`,
        details: {
          workspace_dir: sub,
        },
      });
      return;
    }

    // bootstrap.state === 'existing_app'
    const saasDir = options.dir?.trim() || 'videos';
    const standaloneTarget = findAvailableSubdir(
      initialRootDir,
      options.target?.trim() || 'my-films'
    );

    if (options.mode === 'saas') {
      emit({
        next: 'run',
        say: isPl
          ? `Dodaję studio filmowe make.pictures w podfolderze \`${saasDir}/\` Twojej aplikacji i instaluję wymagane pakiety.`
          : `I'll add make.pictures Studio inside \`${saasDir}/\` of your existing app and install the required packages.`,
        run: `npm install -D @make-pictures/core@latest @make-pictures/kits@latest @make-pictures/studio@latest @make-pictures/cli@latest remotion @remotion/cli @remotion/player @remotion/bundler @remotion/renderer zod lucide-react && npx make-pictures init --dir=${saasDir} ${langFlag} && npx make-pictures onboard init --dir=${saasDir} ${langFlag}${jsonSuffix}`,
        details: {
          mode: 'saas',
          dir: saasDir,
        },
      });
      return;
    }

    if (options.mode === 'standalone') {
      emit({
        next: 'run',
        say: isPl
          ? `Tworzę osobny projekt studia make.pictures w podfolderze \`${standaloneTarget}/\`.`
          : `I'll create a separate standalone make.pictures Studio project in \`${standaloneTarget}/\`.`,
        run: `npx -y create-make-pictures@latest ${standaloneTarget} ${langFlag} && npx -y @make-pictures/cli@latest onboard init --cwd=${standaloneTarget} ${langFlag}${jsonSuffix}`,
        details: {
          mode: 'standalone',
          workspace_dir: standaloneTarget,
        },
      });
      return;
    }

    const saasChoiceCmd = `npx -y @make-pictures/cli@latest onboard --mode=saas --dir=${saasDir} ${langFlag}${jsonSuffix}`;
    const standaloneChoiceCmd = `npx -y @make-pictures/cli@latest onboard --mode=standalone --target=${standaloneTarget} ${langFlag}${jsonSuffix}`;

    emit({
      next: 'ask_choice',
      instruction:
        'Ask the user `say` and wait for their answer. If they choose inside this app (`videos/`), run `details.choices.saas`. If they choose a separate project (`my-films/`), run `details.choices.standalone`.',
      say: isPl
        ? `W tym folderze znajduje się już istniejąca aplikacja. Czy mam dodać studio filmowe w podfolderze \`${saasDir}/\` tej aplikacji, czy utworzyć osobny projekt w podfolderze \`${standaloneTarget}/\`?`
        : `I detected an existing application in this folder. Would you like to add make.pictures Studio inside \`${saasDir}/\` of this app, or create a separate standalone project in \`${standaloneTarget}/\`?`,
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
    writeLine(' 🎬 make.pictures — Video-as-Code Studio Onboarding');
    writeLine('==============================================================\n');

    ensureGitignore(rootDir);

    if (!hasNodeModules(rootDir)) {
      if (rawStep === 'check' || rawStep === 'status') {
        writeLine('❌ Studio dependencies are not installed yet.');
        writeLine(
          '   Run `npm install` first, then re-run `' + humanOnboardCmd + '`.'
        );
        return;
      }
      writeLine(
        '📦 Installing make.pictures Studio dependencies (npm install)...'
      );
      const installed = installDeps(rootDir);
      if (!installed || !hasNodeModules(rootDir)) {
        throw new Error(
          `Dependency installation did not complete. Please run \`npm install\` and re-run \`${humanOnboardCmd}\`.`
        );
      }
    }
    writeLine('✅ Studio packages verified (Remotion 60 FPS + ElevenLabs SDK)');

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
      ensureVoiceDefaultsInEnvLocal(rootDir, envLocalPath);
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
      writeLine('✨ make.pictures Studio is ready!');
      writeLine(
        '   • In Antigravity or Claude Code: just describe the film you want to create.'
      );
      writeLine(
        `   • Visual 60 FPS preview:         ${studioCmd}  (http://127.0.0.1:3000)`
      );
    };

    const existingKey = resolveValidKey();

    if (rawStep === 'check' || rawStep === 'status') {
      if (!existingKey) {
        writeLine('\n⚠️  ElevenLabs API key is not configured in .env.local yet.');
        writeLine(`   • Authorize in browser: ${humanOnboardCmd}`);
        writeLine(`   • Work offline (--mock): ${doctorSetupCmd}`);
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
      fs.unlinkSync(envLocalPath);
    }

    writeLine('\n🔑 Connecting ElevenLabs (Voiceovers, AI Music & SFX)...');
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
      ensureEnvLocalTemplate(envLocalPath, envExamplePath);
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
        `   3. Verify with \`${doctorCmd}\` (or run \`${studioCmd}\` in offline \`--mock\` mode)`
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
      ? `${workspaceDirRel}/.agents/plugins/make-pictures/skills/`
      : '.agents/plugins/make-pictures/skills/';
  const studioLaunchCmd =
    workspaceDirRel !== '.' ? `cd ${workspaceDirRel} && ${studioCmd}` : studioCmd;

  const rules = [
    `Never open, print or cat .env.local; run \`${onboardCmd('check')}\` or \`${doctorCmd}\` to verify it.`,
    'Never ask for an API key in chat, and never accept one pasted there.',
    'Never put the API key in code; tools read ELEVENLABS_API_KEY from .env.local.',
    `Always read ${agentsMdRel} and ${skillsDirRel} before writing or rendering any animation.`,
  ];

  const handleCheck = async (): Promise<void> => {
    ensureVoiceDefaultsInEnvLocal(rootDir, envLocalPath);
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

    const studioAlreadyRunning = await isPortOpen(3000, '127.0.0.1');
    const keyLast4 = key.slice(-4);

    const finalInstruction = studioAlreadyRunning
      ? `Studio Web is already running at http://127.0.0.1:3000. Read \`${agentsMdRel}\` (and load relevant skills from \`${skillsDirRel}\` when building scenes). Do NOT synthesize demo voiceovers during setup so zero ElevenLabs credits are spent upfront. Tell the user \`say\` and end your turn to wait for their film idea.`
      : `Start \`${studioLaunchCmd}\` as a background/daemon process using your command tool's background/daemon option so Studio Web stays live at http://127.0.0.1:3000 without blocking your turn. Read \`${agentsMdRel}\` (and load relevant skills from \`${skillsDirRel}\` when building scenes). Do NOT synthesize demo voiceovers during setup so zero ElevenLabs credits are spent upfront. Tell the user \`say\` and end your turn to wait for their film idea.`;

    emit({
      next: 'ask_what_to_build',
      instruction: finalInstruction,
      say: isPl
        ? `Środowisko make.pictures jest gotowe! Klucz ElevenLabs (końcówka ${keyLast4}) został zapisany w .env.local, a podgląd 60 FPS Studio Web działa pod adresem http://127.0.0.1:3000. Jaki film chcesz stworzyć? Opisz krótko temat (i opcjonalnie czy wolisz format poziomy 16:9 czy pionowy Short 9:16).`
        : `make.pictures Studio is ready! Your ElevenLabs API key (ending in ${keyLast4}) is saved in .env.local, and the 60 FPS Studio Web preview is live at http://127.0.0.1:3000. What film would you like to create? Describe the topic (and optionally 16:9 landscape or 9:16 vertical).`,
      rules,
      details: {
        env_file: '.env.local',
        key_last4: keyLast4,
        workspace_dir: workspaceDirRel,
        studio_web_url: 'http://127.0.0.1:3000',
        studio_command: studioLaunchCmd,
        studio_already_running: studioAlreadyRunning,
        visual_kits: [
          'paper-diorama-3d',
          'isometric-3d',
          'motion-diagrams-2d',
          'kinetic-typography',
          'data-storytelling',
        ],
        docs: [agentsMdRel, skillsDirRel],
      },
    });
  };

  const handleInit = async (): Promise<void> => {
    ensureGitignore(rootDir);

    if (!hasNodeModules(rootDir)) {
      const installPrefix =
        workspaceDirRel !== '.' ? `cd ${workspaceDirRel} && npm install` : 'npm install';
      emit({
        next: 'run',
        say: isPl
          ? 'Instaluję zależności studia make.pictures (Remotion 60 FPS, Three.js oraz ElevenLabs SDK).'
          : "First, I'll install the make.pictures Studio dependencies (Remotion 60 FPS, Three.js, and ElevenLabs SDK).",
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
      fs.unlinkSync(envLocalPath);
    }

    emit({
      next: 'run',
      say: isPl
        ? 'Teraz otworzę stronę autoryzacji ElevenLabs w Twojej przeglądarce. Zaloguj się (lub załóż konto) i kliknij Authorize — klucz API zapisze się bezpośrednio w `.env.local` bez pojawiania się na czacie.'
        : "Next, I'll open the ElevenLabs approval page in your browser. Sign in (or create an account) and click Authorize — your API key will be saved directly to `.env.local` without ever appearing in chat.",
      run: onboardCmd('connect'),
      rules,
      details: {
        env_file: '.env.local',
        fallback_note: isPl
          ? `Jeśli wolisz teraz pracować offline bez klucza ElevenLabs, powiedz mi o tym, a uruchomię \`${doctorSetupCmd}\`.`
          : `If you prefer to use the studio offline without an ElevenLabs key right now, tell me and run \`${doctorSetupCmd}\`.`,
      },
    });
  };

  const handleConnect = async (extraArgs: string[]): Promise<void> => {
    ensureGitignore(rootDir);
    const reply = elevenLabsRunner(rootDir, ['connect', ...extraArgs]);

    if (!reply) {
      ensureEnvLocalTemplate(envLocalPath, envExamplePath);
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
