import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

const ROOT_DIR = process.cwd();
const ENV_LOCAL_PATH = path.join(ROOT_DIR, '.env.local');
const ENV_EXAMPLE_PATH = path.join(ROOT_DIR, '.env.example');
const SCENES_PATH = path.join(ROOT_DIR, 'scenes.json');
const INDEX_PATH = path.join(ROOT_DIR, 'src', 'index.ts');

interface CheckResult {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
}

function formatIcon(status: CheckResult['status']): string {
  if (status === 'ok') return '✅';
  if (status === 'warn') return '⚠️ ';
  return '❌';
}

async function runDoctor(): Promise<void> {
  const isSetup = process.argv.includes('--setup');

  console.log('==============================================================');
  console.log(' 🎬 make.pictures — Video-as-Code Studio Environment Doctor');
  console.log('    https://make.pictures');
  console.log('==============================================================\n');

  const results: CheckResult[] = [];

  // 1. Node.js version check
  const nodeVersion = process.versions.node;
  const major = Number(nodeVersion.split('.')[0] ?? 0);
  if (major >= 18) {
    results.push({
      name: 'Node.js Runtime',
      status: 'ok',
      detail: `v${nodeVersion} (required >= 18.0.0)`,
    });
  } else {
    results.push({
      name: 'Node.js Runtime',
      status: 'fail',
      detail: `v${nodeVersion} — please upgrade to Node.js 18 or 20+`,
    });
  }

  // 2. FFmpeg binary check
  try {
    const ffmpegOut = execFileSync('ffmpeg', ['-version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const firstLine = ffmpegOut.split('\n')[0]?.trim() ?? 'ffmpeg found';
    results.push({
      name: 'FFmpeg Audio/Video Engine',
      status: 'ok',
      detail: firstLine,
    });
  } catch {
    results.push({
      name: 'FFmpeg Audio/Video Engine',
      status: 'warn',
      detail:
        'ffmpeg not found in PATH (recommended for procedural SFX & voiceover mastering: `brew install ffmpeg`)',
    });
  }

  // 3. .env.local & ElevenLabs API Key check
  if (!fs.existsSync(ENV_LOCAL_PATH) && isSetup && fs.existsSync(ENV_EXAMPLE_PATH)) {
    fs.copyFileSync(ENV_EXAMPLE_PATH, ENV_LOCAL_PATH);
    console.log('📄 Created `.env.local` from `.env.example`.\n');
  }

  dotenv.config({ path: ENV_LOCAL_PATH });
  dotenv.config();

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim() ?? '';
  const hasEnvLocal = fs.existsSync(ENV_LOCAL_PATH);
  const isPlaceholder =
    !apiKey || apiKey === 'your_elevenlabs_api_key_here';

  if (!hasEnvLocal && isPlaceholder) {
    results.push({
      name: 'Environment File (.env.local)',
      status: 'warn',
      detail:
        'Missing `.env.local`. Run `cp .env.example .env.local` and set `ELEVENLABS_API_KEY` (or run `npm run setup`).',
    });
  } else if (isPlaceholder) {
    results.push({
      name: 'ElevenLabs API Key',
      status: 'warn',
      detail:
        '`ELEVENLABS_API_KEY` in `.env.local` is still set to the placeholder value. Voiceovers will use deterministic offline fallback until you add your key.',
    });
  } else {
    // Verify ElevenLabs API connectivity
    try {
      const client = new ElevenLabsClient({ apiKey });
      const userResponse = await client.user.get();
      const tier = userResponse.subscription?.tier ?? 'active';
      const charCount = userResponse.subscription?.characterCount ?? 0;
      const charLimit = userResponse.subscription?.characterLimit ?? 0;
      results.push({
        name: 'ElevenLabs API Connection',
        status: 'ok',
        detail: `Connected! Plan: ${tier} (${charCount.toLocaleString()} / ${charLimit.toLocaleString()} characters used)`,
      });
    } catch (err) {
      // Fallback check via voices.getAll in case key is scoped only to TTS/voices
      try {
        const client = new ElevenLabsClient({ apiKey });
        const voices = await client.voices.getAll();
        results.push({
          name: 'ElevenLabs API Connection',
          status: 'ok',
          detail: `Connected! (${voices.voices?.length ?? 0} voices available)`,
        });
      } catch (innerErr) {
        const msg =
          innerErr instanceof Error ? innerErr.message : String(innerErr);
        results.push({
          name: 'ElevenLabs API Connection',
          status: 'warn',
          detail: `API key present, but live check could not complete (${msg.slice(
            0,
            90
          )}). Offline fallback remains available.`,
        });
      }
    }
  }

  // 4. Scenes manifest & Visual Kits check
  if (fs.existsSync(SCENES_PATH)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(SCENES_PATH, 'utf8'));
      const count = Array.isArray(manifest.scenes) ? manifest.scenes.length : 0;
      results.push({
        name: 'Scenes Manifest (scenes.json)',
        status: 'ok',
        detail: `Valid JSON (${count} scenes configured @ ${manifest.project?.fps ?? 60} FPS)`,
      });
    } catch (err) {
      results.push({
        name: 'Scenes Manifest (scenes.json)',
        status: 'fail',
        detail: `Invalid JSON in scenes.json: ${
          err instanceof Error ? err.message : String(err)
        }`,
      });
    }
  } else {
    results.push({
      name: 'Scenes Manifest (scenes.json)',
      status: 'fail',
      detail: 'Missing scenes.json in project root',
    });
  }

  // 5. Remotion CLI & Entrypoint check
  try {
    const remotionPkgPath = path.join(
      ROOT_DIR,
      'node_modules',
      'remotion',
      'package.json'
    );
    const cliPkgPath = path.join(
      ROOT_DIR,
      'node_modules',
      '@remotion',
      'cli',
      'package.json'
    );
    if (!fs.existsSync(remotionPkgPath) || !fs.existsSync(cliPkgPath)) {
      throw new Error('Missing remotion packages in node_modules');
    }
    const remotionPkg = JSON.parse(fs.readFileSync(remotionPkgPath, 'utf8'));
    const remotionVer = remotionPkg.version ?? '4.x';
    const indexExists = fs.existsSync(INDEX_PATH);
    results.push({
      name: 'Remotion 60 FPS Renderer',
      status: indexExists ? 'ok' : 'fail',
      detail: indexExists
        ? `Remotion v${remotionVer} ready (entrypoint: src/index.ts)`
        : 'Missing src/index.ts entrypoint',
    });
  } catch {
    results.push({
      name: 'Remotion 60 FPS Renderer',
      status: 'fail',
      detail: 'Remotion CLI not available. Run `npm install` first.',
    });
  }

  // Print report
  for (const r of results) {
    console.log(`${formatIcon(r.status)} ${r.name.padEnd(30)} ${r.detail}`);
  }

  const hasFailures = results.some((r) => r.status === 'fail');
  console.log('\n--------------------------------------------------------------');
  if (hasFailures) {
    console.log('❌ Some required checks failed. Please fix the issues above.');
    process.exit(1);
  } else {
    console.log('✨ Studio environment is ready! Next steps:');
    console.log('   1. Set ELEVENLABS_API_KEY in `.env.local` (if not set yet)');
    console.log('   2. Generate voiceovers & word timestamps: npm run voiceover');
    console.log('   3. Launch interactive 60 FPS preview:     npm run studio');
    console.log('   4. Or ask Google Antigravity / Claude Code to create a new film!');
  }
}

runDoctor().catch((err) => {
  console.error('❌ Doctor script failed:', err);
  process.exit(1);
});
