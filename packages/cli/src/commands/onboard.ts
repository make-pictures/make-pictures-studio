import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
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
  elevenLabsRunner?: (
    rootDir: string,
    subcommandArgs: string[]
  ) => OnboardReply | null;
  maxWaitAttempts?: number;
}

export interface OnboardCommandOptions {
  cwd?: string;
  step?: string;
  extraArgs?: string[];
  json?: boolean;
  human?: boolean;
  deps?: OnboardRuntimeDeps;
}

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
  ask_what_to_build:
    'Tell the user `say`, then end your turn and wait for their answer. Read AGENTS.md and .agents/plugins/make-pictures/skills/ to guide them through creating their 60 FPS animation or launching Studio Web.',
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

function getCommandRunners(
  rootDir: string,
  options?: { preserveJsonFlag?: boolean }
): {
  onboardCmd: (step: string) => string;
  humanOnboardCmd: string;
  studioCmd: string;
  doctorCmd: string;
  doctorSetupCmd: string;
  audioCmd: string;
  newFilmCmd: string;
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
  const hasAudioScript = Boolean(scripts.audio);
  const hasNewScript = Boolean(scripts.new);
  const jsonSuffix = options?.preserveJsonFlag ? ' --json' : '';

  return {
    onboardCmd: (step: string) =>
      hasOnboardScript
        ? `npm run onboard -- ${step}${jsonSuffix}`
        : `npx make-pictures onboard ${step}${jsonSuffix}`,
    humanOnboardCmd: hasOnboardScript
      ? 'npm run onboard'
      : 'npx make-pictures onboard',
    studioCmd: hasStudioScript ? 'npm run studio' : 'npx make-pictures studio',
    doctorCmd: hasDoctorScript ? 'npm run doctor' : 'npx make-pictures doctor',
    doctorSetupCmd: hasSetupScript
      ? 'npm run setup'
      : 'npx make-pictures doctor --setup',
    audioCmd: hasAudioScript
      ? 'npm run audio -- --production=hello-studio'
      : 'npx make-pictures audio --production=hello-studio',
    newFilmCmd: hasNewScript
      ? 'npm run new -- my-film --kit=paper-diorama-3d --lang=pl'
      : 'npx make-pictures new my-film --kit=paper-diorama-3d --lang=pl',
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
    fs.existsSync(
      path.join(
        rootDir,
        'node_modules',
        '@elevenlabs',
        'elevenlabs-js',
        'package.json'
      )
    )
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
 * 1. Interactive terminal UX for human creators (`npm run onboard` / `npx make-pictures onboard`)
 * 2. Deterministic single-line JSON state machine (`init` -> `connect` -> `wait` -> `check`)
 *    for AI coding agents, non-TTY pipes, and `--json`.
 */
export async function runOnboardCommand(
  options: OnboardCommandOptions = {}
): Promise<void> {
  const { rootDir } = resolveWorkspaceContext({ cwd: options.cwd });
  const envLocalPath = path.join(rootDir, '.env.local');
  const envExamplePath = path.join(rootDir, '.env.example');

  const stdout = options.deps?.stdout ?? process.stdout;
  const env = options.deps?.env ?? process.env;
  const checkFfmpeg = options.deps?.checkFfmpeg ?? defaultHasFfmpeg;
  const installDeps = options.deps?.installDeps ?? defaultInstallDeps;
  const elevenLabsRunner =
    options.deps?.elevenLabsRunner ?? defaultRunElevenLabsOnboard;
  const maxWaitAttempts = options.deps?.maxWaitAttempts ?? 10;

  const useJson = shouldUseJsonOutput({
    json: options.json,
    human: options.human,
    isTTY: Boolean(stdout.isTTY),
    env,
  });

  const {
    onboardCmd,
    humanOnboardCmd,
    studioCmd,
    doctorCmd,
    doctorSetupCmd,
    audioCmd,
    newFilmCmd,
  } = getCommandRunners(rootDir, {
    preserveJsonFlag: Boolean(options.json),
  });

  const writeLine = (line = ''): void => {
    stdout.write(`${line}\n`);
  };

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
        writeLine('   Run `npm install` first, then re-run `' + humanOnboardCmd + '`.');
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
      writeLine('✨ make.pictures Studio is ready! Next steps:');
      writeLine(`   1. Launch Studio Web (60 FPS): ${studioCmd}  (http://127.0.0.1:3000)`);
      writeLine(`   2. Generate capsule audio:     ${audioCmd}`);
      writeLine(`   3. Create a new film capsule:  ${newFilmCmd}`);
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
    writeLine(
      '   Opening the ElevenLabs approval page in your browser.'
    );
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

  const rules = [
    `Never open, print or cat .env.local; run \`${onboardCmd('check')}\` or \`npx make-pictures doctor\` to verify it.`,
    'Never ask for an API key in chat, and never accept one pasted there.',
    'Never put the API key in code; tools read ELEVENLABS_API_KEY from .env.local.',
    'Always read AGENTS.md and .agents/plugins/make-pictures/skills/ before writing or rendering any animation.',
  ];

  const handleCheck = (): void => {
    ensureVoiceDefaultsInEnvLocal(rootDir, envLocalPath);
    const key =
      readApiKeyFromEnvLocal(envLocalPath) || env.ELEVENLABS_API_KEY?.trim();

    if (!key || key === 'your_elevenlabs_api_key_here') {
      handleInit();
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
    emit({
      next: 'ask_what_to_build',
      say: `make.pictures Studio is set up and ready! Your ElevenLabs API key (ending in ${keyLast4}) is saved in .env.local, and FFmpeg + Studio Web + Remotion 60 FPS are verified. Would you like to open the local Studio Web director's workstation (\`${studioCmd}\` at http://127.0.0.1:3000 with 60 FPS HMR preview, Golden Safe Box overlays, and Props Inspector), or create a new 60 FPS animation right now? (Tell me the topic, language PL/EN, aspect ratio 16:9 or 9:16, and visual style: paper-diorama-3d, isometric-3d, motion-diagrams-2d, kinetic-typography, or data-storytelling.)`,
      rules,
      details: {
        env_file: '.env.local',
        key_last4: keyLast4,
        studio_web_url: 'http://127.0.0.1:3000',
        studio_command: studioCmd,
        visual_kits: [
          'paper-diorama-3d',
          'isometric-3d',
          'motion-diagrams-2d',
          'kinetic-typography',
          'data-storytelling',
        ],
        docs: ['AGENTS.md', '.agents/plugins/make-pictures/skills/'],
      },
    });
  };

  const handleInit = (): void => {
    ensureGitignore(rootDir);

    if (!hasNodeModules(rootDir)) {
      emit({
        next: 'run',
        say: "First, I'll install the make.pictures Studio dependencies (Remotion 60 FPS, Three.js, and ElevenLabs SDK).",
        run: `npm install && ${onboardCmd('init')}`,
        rules,
      });
      return;
    }

    if (!checkFfmpeg()) {
      emit({
        next: 'fix',
        say: 'FFmpeg is required for audio duration detection, loudness mastering (-14 LUFS), and 60 FPS video rendering. Please install FFmpeg (e.g. `brew install ffmpeg` on macOS, `sudo apt install ffmpeg` on Ubuntu/Debian, or `winget install Gyan.FFmpeg` on Windows).',
        run: onboardCmd('init'),
        rules,
      });
      return;
    }

    const existingKey =
      readApiKeyFromEnvLocal(envLocalPath) || env.ELEVENLABS_API_KEY?.trim();
    if (existingKey && existingKey !== 'your_elevenlabs_api_key_here') {
      handleCheck();
      return;
    }

    if (fs.existsSync(envLocalPath) && !readApiKeyFromEnvLocal(envLocalPath)) {
      fs.unlinkSync(envLocalPath);
    }

    emit({
      next: 'run',
      say: "Next, I'll open the ElevenLabs approval page in your browser. Sign in (or create an account) and click Authorize — your API key will be saved directly to `.env.local` without ever appearing in chat.",
      run: onboardCmd('connect'),
      rules,
      details: {
        env_file: '.env.local',
        fallback_note: `If you prefer to use the studio offline without an ElevenLabs key right now, tell me and run \`${doctorSetupCmd}\`.`,
      },
    });
  };

  const handleConnect = (extraArgs: string[]): void => {
    ensureGitignore(rootDir);
    const reply = elevenLabsRunner(rootDir, ['connect', ...extraArgs]);

    if (!reply) {
      ensureEnvLocalTemplate(envLocalPath, envExamplePath);
      emit({
        next: 'ask_user',
        say: 'I created `.env.local`. Create an ElevenLabs API key at https://elevenlabs.io/app/settings/api-keys and save it as `ELEVENLABS_API_KEY` in `.env.local` (do not paste it in chat), then tell me when you are ready.',
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
      handleCheck();
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
    handleConnect(options.extraArgs ?? []);
  } else if (step === 'wait') {
    handleConnect(['--wait', ...(options.extraArgs ?? [])]);
  } else if (step === 'check' || step === 'status') {
    handleCheck();
  } else {
    handleInit();
  }
}
