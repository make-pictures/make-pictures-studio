#!/usr/bin/env node
/**
 * `npm run onboard` — Agent-driven onboarding workflow for make.pictures Studio.
 *
 * Inspired by `@elevenlabs/cli onboard`: each step prints a deterministic JSON
 * instruction (`{ next, instruction, run, say, rules, details }`) so coding agents
 * (Google Antigravity, Claude Code, Cursor, Codex) follow the exact setup flow
 * without guessing commands or asking users to paste secret API keys into chat.
 *
 * Zero external dependencies — works immediately after `git clone` even before `npm install`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const ENV_LOCAL_PATH = path.join(ROOT_DIR, '.env.local');
const ENV_EXAMPLE_PATH = path.join(ROOT_DIR, '.env.example');
const GITIGNORE_PATH = path.join(ROOT_DIR, '.gitignore');

const RULES = [
  'Never open, print or cat .env.local; run `npm run onboard -- check` or `npm run doctor` to verify it.',
  'Never ask for an API key in chat, and never accept one pasted there.',
  'Never put the API key in code; scripts read ELEVENLABS_API_KEY from .env.local.',
  'Always read AGENTS.md and src/kits/README.md before writing or rendering any animation.',
];

const INSTRUCTIONS = {
  run: 'Tell the user `say`, then run `run`.',
  wait:
    'Show the user `say`, then run `run` right away, without ending your turn: it waits while they approve in the browser. Whenever you give them the link, copy it whole, exactly as printed.',
  fix: 'Do what `say` describes, then run `run`.',
  ask_user: 'Ask the user what `say` says and wait for their answer, then run `run`, unless they said no.',
  ask_what_to_build:
    'Tell the user `say`, then end your turn and wait for their answer. Read AGENTS.md and src/kits/README.md to guide them through creating their 60 FPS animation or launching `npm run studio`.',
  done: 'Tell the user `say`. Setup is complete.',
};

function emit(reply) {
  const payload = {
    next: reply.next,
    instruction: reply.instruction || INSTRUCTIONS[reply.next] || INSTRUCTIONS.run,
    ...(reply.run ? { run: reply.run } : {}),
    say: reply.say,
    ...(reply.rules ? { rules: reply.rules } : {}),
    ...(reply.details ? { details: reply.details } : {}),
  };
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function hasNodeModules() {
  return (
    fs.existsSync(path.join(ROOT_DIR, 'node_modules', 'remotion', 'package.json')) &&
    fs.existsSync(path.join(ROOT_DIR, 'node_modules', '@elevenlabs', 'elevenlabs-js', 'package.json'))
  );
}

function hasFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function ensureGitignore() {
  if (!fs.existsSync(GITIGNORE_PATH)) {
    fs.writeFileSync(GITIGNORE_PATH, '.env.local\n', 'utf-8');
    return;
  }
  const content = fs.readFileSync(GITIGNORE_PATH, 'utf-8');
  if (!content.split(/\r?\n/).some((line) => line.trim() === '.env.local')) {
    fs.appendFileSync(GITIGNORE_PATH, '\n.env.local\n', 'utf-8');
  }
}

function readApiKeyFromEnvLocal() {
  if (!fs.existsSync(ENV_LOCAL_PATH)) return null;
  const content = fs.readFileSync(ENV_LOCAL_PATH, 'utf-8');
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
    if (key === 'ELEVENLABS_API_KEY' && val && val !== 'your_elevenlabs_api_key_here' && val !== 'twoj_klucz_api_elevenlabs') {
      return val;
    }
  }
  return null;
}

function ensureVoiceDefaultsInEnvLocal() {
  ensureGitignore();
  if (!fs.existsSync(ENV_LOCAL_PATH)) return;
  let content = fs.readFileSync(ENV_LOCAL_PATH, 'utf-8');
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
    fs.writeFileSync(ENV_LOCAL_PATH, content, { mode: 0o600 });
  }
}

function runElevenLabsOnboard(subcommandArgs) {
  const res = spawnSync(
    'npx',
    ['-y', '@elevenlabs/cli@latest', 'onboard', ...subcommandArgs, '--env-path', '.env.local'],
    {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const stdout = (res.stdout || '').trim();
  const lastLine = stdout.split(/\r?\n/).filter(Boolean).pop() || '';
  try {
    return JSON.parse(lastLine);
  } catch {
    return null;
  }
}

function handleInit() {
  ensureGitignore();

  // 1. Check node_modules
  if (!hasNodeModules()) {
    emit({
      next: 'run',
      say: "First, I'll install the make.pictures Studio dependencies (Remotion 60 FPS, Three.js, and ElevenLabs SDK).",
      run: 'npm install && npm run onboard -- init',
      rules: RULES,
    });
    return;
  }

  // 2. Check FFmpeg
  if (!hasFfmpeg()) {
    emit({
      next: 'fix',
      say: 'FFmpeg is required for audio duration detection and 60 FPS video rendering. Please install FFmpeg (e.g. `brew install ffmpeg` on macOS, `sudo apt install ffmpeg` on Ubuntu/Debian, or `winget install Gyan.FFmpeg` on Windows).',
      run: 'npm run onboard -- init',
      rules: RULES,
    });
    return;
  }

  // 3. Check if ELEVENLABS_API_KEY is already configured
  const existingKey = readApiKeyFromEnvLocal() || process.env.ELEVENLABS_API_KEY;
  if (existingKey && existingKey !== 'your_elevenlabs_api_key_here') {
    handleCheck();
    return;
  }

  // Remove placeholder-only .env.local so `@elevenlabs/cli onboard` can cleanly create & populate it via browser OAuth
  if (fs.existsSync(ENV_LOCAL_PATH) && !readApiKeyFromEnvLocal()) {
    fs.unlinkSync(ENV_LOCAL_PATH);
  }

  emit({
    next: 'run',
    say: "Next, I'll open the ElevenLabs approval page in your browser. Sign in (or create an account) and click Authorize — your API key will be saved directly to `.env.local` without ever appearing in chat.",
    run: 'npm run onboard -- connect',
    rules: RULES,
    details: {
      env_file: '.env.local',
      fallback_note: 'If you prefer to use the studio offline without an ElevenLabs key right now, tell me and run `npm run setup`.',
    },
  });
}

function handleConnect(extraArgs) {
  ensureGitignore();
  const reply = runElevenLabsOnboard(['connect', ...extraArgs]);

  if (!reply) {
    // Fallback if npx @elevenlabs/cli could not reach the network
    if (!fs.existsSync(ENV_LOCAL_PATH) && fs.existsSync(ENV_EXAMPLE_PATH)) {
      fs.copyFileSync(ENV_EXAMPLE_PATH, ENV_LOCAL_PATH);
    }
    emit({
      next: 'ask_user',
      say: 'I created `.env.local`. Create an ElevenLabs API key at https://elevenlabs.io/app/settings/api-keys and save it as `ELEVENLABS_API_KEY` in `.env.local` (do not paste it in chat), then tell me when you are ready.',
      run: 'npm run onboard -- check',
      rules: RULES,
    });
    return;
  }

  // If @elevenlabs/cli is waiting for browser approval, rewrite `run` to keep driving through `npm run onboard -- wait`
  if (reply.next === 'wait' || (reply.run && reply.run.includes('connect --wait'))) {
    emit({
      next: 'wait',
      instruction: reply.instruction,
      say: reply.say,
      run: 'npm run onboard -- wait',
      rules: RULES,
      details: reply.details,
    });
    return;
  }

  // If key is now stored or already exists, finalize via check
  if (readApiKeyFromEnvLocal() || (reply.run && reply.run.includes('onboard check'))) {
    handleCheck();
    return;
  }

  emit({
    next: reply.next || 'run',
    instruction: reply.instruction,
    say: reply.say,
    run: 'npm run onboard -- check',
    rules: RULES,
    details: reply.details,
  });
}

function handleCheck() {
  ensureVoiceDefaultsInEnvLocal();
  const key = readApiKeyFromEnvLocal() || process.env.ELEVENLABS_API_KEY;

  if (!key) {
    handleInit();
    return;
  }

  const checkReply = runElevenLabsOnboard(['check']);
  if (checkReply && (checkReply.next === 'fix' || checkReply.next === 'ask_user')) {
    emit({
      next: checkReply.next,
      instruction: checkReply.instruction,
      say: checkReply.say,
      run: 'npm run onboard -- check',
      rules: RULES,
      details: checkReply.details,
    });
    return;
  }

  const keyLast4 = key.slice(-4);
  emit({
    next: 'ask_what_to_build',
    say: `make.pictures Studio is set up and ready! Your ElevenLabs API key (ending in ${keyLast4}) is saved in .env.local, and FFmpeg + Remotion 60 FPS are verified. Would you like to preview the showcase animations in Remotion Studio (\`npm run studio\`), or create a new 60 FPS animation right now? (Tell me the topic, language PL/EN, aspect ratio 16:9 or 9:16, and visual style: paper-diorama-3d, isometric-3d, motion-diagrams-2d, or a brand-new custom kit.)`,
    rules: RULES,
    details: {
      env_file: '.env.local',
      key_last4: keyLast4,
      visual_kits: ['paper-diorama-3d', 'isometric-3d', 'motion-diagrams-2d', 'custom-kit'],
      docs: ['AGENTS.md', 'src/kits/README.md'],
    },
  });
}

const step = process.argv[2] || 'init';
if (step === 'init') {
  handleInit();
} else if (step === 'connect') {
  handleConnect([]);
} else if (step === 'wait') {
  handleConnect(['--wait']);
} else if (step === 'check' || step === 'status') {
  handleCheck();
} else {
  handleInit();
}
