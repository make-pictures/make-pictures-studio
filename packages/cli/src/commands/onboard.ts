import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkspaceContext } from './workspace-paths';

export type OnboardStep = 'init' | 'connect' | 'wait' | 'check' | 'status';

export interface OnboardCommandOptions {
  cwd?: string;
  step?: string;
  extraArgs?: string[];
}

interface OnboardReply {
  next: string;
  instruction?: string;
  run?: string;
  say: string;
  rules?: string[];
  details?: Record<string, unknown>;
}

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

function emit(reply: OnboardReply): void {
  const payload = {
    next: reply.next,
    instruction:
      reply.instruction || INSTRUCTIONS[reply.next] || INSTRUCTIONS.run,
    ...(reply.run ? { run: reply.run } : {}),
    say: reply.say,
    ...(reply.rules ? { rules: reply.rules } : {}),
    ...(reply.details ? { details: reply.details } : {}),
  };
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function getCommandRunners(rootDir: string): {
  onboardCmd: (step: string) => string;
  studioCmd: string;
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
  const hasSetupScript = Boolean(scripts.setup);

  return {
    onboardCmd: (step: string) =>
      hasOnboardScript
        ? `npm run onboard -- ${step}`
        : `npx make-pictures onboard ${step}`,
    studioCmd: hasStudioScript ? 'npm run studio' : 'npx make-pictures studio',
    doctorSetupCmd: hasSetupScript
      ? 'npm run setup'
      : 'npx make-pictures doctor --setup',
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

function hasFfmpeg(): boolean {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
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

function runElevenLabsOnboard(
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
    ],
    {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  const stdout = (res.stdout || '').trim();
  const lastLine = stdout.split(/\r?\n/).filter(Boolean).pop() || '';
  try {
    return JSON.parse(lastLine) as OnboardReply;
  } catch {
    return null;
  }
}

/**
 * Deterministic JSON agent-onboarding state machine (`init` -> `connect` -> `wait` -> `check`).
 */
export async function runOnboardCommand(
  options: OnboardCommandOptions = {}
): Promise<void> {
  const { rootDir } = resolveWorkspaceContext({ cwd: options.cwd });
  const envLocalPath = path.join(rootDir, '.env.local');
  const envExamplePath = path.join(rootDir, '.env.example');
  const { onboardCmd, studioCmd, doctorSetupCmd } = getCommandRunners(rootDir);

  const rules = [
    `Never open, print or cat .env.local; run \`${onboardCmd('check')}\` or \`npx make-pictures doctor\` to verify it.`,
    'Never ask for an API key in chat, and never accept one pasted there.',
    'Never put the API key in code; tools read ELEVENLABS_API_KEY from .env.local.',
    'Always read AGENTS.md and .agents/plugins/make-pictures/skills/ before writing or rendering any animation.',
  ];

  const handleCheck = (): void => {
    ensureVoiceDefaultsInEnvLocal(rootDir, envLocalPath);
    const key =
      readApiKeyFromEnvLocal(envLocalPath) || process.env.ELEVENLABS_API_KEY;

    if (!key || key === 'your_elevenlabs_api_key_here') {
      handleInit();
      return;
    }

    const checkReply = runElevenLabsOnboard(rootDir, ['check']);
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

    if (!hasFfmpeg()) {
      emit({
        next: 'fix',
        say: 'FFmpeg is required for audio duration detection, loudness mastering (-14 LUFS), and 60 FPS video rendering. Please install FFmpeg (e.g. `brew install ffmpeg` on macOS, `sudo apt install ffmpeg` on Ubuntu/Debian, or `winget install Gyan.FFmpeg` on Windows).',
        run: onboardCmd('init'),
        rules,
      });
      return;
    }

    const existingKey =
      readApiKeyFromEnvLocal(envLocalPath) || process.env.ELEVENLABS_API_KEY;
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
    const reply = runElevenLabsOnboard(rootDir, ['connect', ...extraArgs]);

    if (!reply) {
      if (!fs.existsSync(envLocalPath)) {
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
      emit({
        next: 'ask_user',
        say: 'I created `.env.local`. Create an ElevenLabs API key at https://elevenlabs.io/app/settings/api-keys and save it as `ELEVENLABS_API_KEY` in `.env.local` (do not paste it in chat), then tell me when you are ready.',
        run: onboardCmd('check'),
        rules,
      });
      return;
    }

    if (
      reply.next === 'wait' ||
      (reply.run && reply.run.includes('connect --wait'))
    ) {
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
