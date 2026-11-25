import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import dotenv from 'dotenv';
import {
  DEFAULT_ELEVENLABS_MODEL_ID,
  getDefaultVoiceIdForLang,
} from '@make-pictures/remotion/audio/voices';
import { auditStudioAudioLifetimes } from '../audio/audit-audio-tags';
import { discoverAudioManifests } from './audio';
import {
  findInstalledPackageJson,
  loadMakePicturesConfig,
  resolveWorkspaceContext,
} from './workspace-paths';

export interface DoctorCommandOptions {
  cwd?: string;
  dir?: string;
  setup?: boolean;
}

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

/**
 * Runs environment health checks for Node.js, FFmpeg, `.env.local` / ElevenLabs API,
 * `audio.json` manifests, Remotion Studio/Renderer, and AI skills.
 */
export async function runDoctorCommand(
  options: DoctorCommandOptions = {}
): Promise<void> {
  const { rootDir, studioDir, dirRel } = resolveWorkspaceContext({
    cwd: options.cwd,
    dir: options.dir,
  });
  const config = loadMakePicturesConfig(studioDir, rootDir);

  const envLocalPath = path.join(rootDir, '.env.local');
  const envExamplePath = path.join(rootDir, '.env.example');

  console.log('==============================================================');
  console.log(' 🎬 make.pictures — Remotion Toolkit Environment Doctor');
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
      detail: `v${nodeVersion} — please upgrade to Node.js 18 or 22+`,
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
        'ffmpeg not found in PATH — install via `brew install ffmpeg` (macOS), `sudo apt install ffmpeg` (Linux), or `winget install Gyan.FFmpeg` (Windows)',
    });
  }

  // 3. .env.local & ElevenLabs API Key check
  if (!fs.existsSync(envLocalPath) && options.setup) {
    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envLocalPath);
      try {
        fs.chmodSync(envLocalPath, 0o600);
      } catch {
        // Ignore chmod failures on filesystems that do not support POSIX modes
      }
    } else {
      const defaultVoice = getDefaultVoiceIdForLang(config.lang);
      fs.writeFileSync(
        envLocalPath,
        `ELEVENLABS_API_KEY=your_elevenlabs_api_key_here\nELEVENLABS_VOICE_ID=${defaultVoice}\nELEVENLABS_MODEL_ID=${DEFAULT_ELEVENLABS_MODEL_ID}\n`,
        { mode: 0o600 }
      );
    }
    console.log('📄 Created `.env.local` template.\n');
  }

  dotenv.config({ path: envLocalPath });
  dotenv.config({ path: path.join(rootDir, '.env') });

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim() ?? '';
  const hasEnvLocal = fs.existsSync(envLocalPath);
  const isPlaceholder =
    !apiKey ||
    apiKey === 'your_elevenlabs_api_key_here' ||
    apiKey === 'twoj_klucz_api_elevenlabs';

  if (!hasEnvLocal && isPlaceholder) {
    results.push({
      name: 'Environment File (.env.local)',
      status: 'warn',
      detail:
        'Missing `.env.local`. Run `npx make-pictures onboard` (or use `audio --mock` for offline mode).',
    });
  } else if (isPlaceholder) {
    results.push({
      name: 'ElevenLabs API Key',
      status: 'warn',
      detail:
        '`ELEVENLABS_API_KEY` in `.env.local` is set to placeholder. Use `--mock` until connected.',
    });
  } else {
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
    } catch {
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
          )}). Offline \`--mock\` remains available.`,
        });
      }
    }
  }

  // 4. Audio manifests (`<videosDir>/*/audio.json`) & Audio Tag Pool Safety
  const audioManifests = discoverAudioManifests(studioDir, config.videosDir);
  if (audioManifests.length > 0) {
    try {
      let totalScenes = 0;
      for (const m of audioManifests) {
        const parsed = JSON.parse(fs.readFileSync(m.manifestPath, 'utf8')) as {
          scenes?: unknown[];
        };
        totalScenes += Array.isArray(parsed.scenes) ? parsed.scenes.length : 0;
      }
      results.push({
        name: 'Audio Manifests (audio.json)',
        status: 'ok',
        detail: `${audioManifests.length} video(s) in ${config.videosDir} (${totalScenes} scenes @ ${config.fps} FPS)`,
      });

      const audioWarnings = auditStudioAudioLifetimes(studioDir);
      if (audioWarnings.length === 0) {
        results.push({
          name: 'Audio Tag Pool Safety',
          status: 'ok',
          detail:
            'All <Audio /> sequences specify finite lifetimes (no <Html5Audio /> tag leaks)',
        });
      } else {
        const first = audioWarnings[0];
        const relFile = path.relative(rootDir, first.filePath);
        results.push({
          name: 'Audio Tag Pool Safety',
          status: 'warn',
          detail: `${audioWarnings.length} unbounded <Sequence><Audio /></Sequence> block(s) (e.g. ${relFile}:${first.line}) — add \`durationInFrames\` or use \`<VoiceoverTrack />\``,
        });
      }
    } catch (err) {
      results.push({
        name: 'Audio Manifests (audio.json)',
        status: 'fail',
        detail: `Invalid JSON in audio.json: ${
          err instanceof Error ? err.message : String(err)
        }`,
      });
    }
  } else {
    results.push({
      name: 'Audio Manifests (audio.json)',
      status: 'warn',
      detail: `No audio.json found yet in ${config.videosDir}. Run \`npx make-pictures new hello-studio${dirRel !== '.' ? ` --dir=${dirRel}` : ''}\` to scaffold one.`,
    });
  }

  // 5. Remotion CLI & Entrypoint check
  const remotionPkgPath = findInstalledPackageJson(rootDir, 'remotion');
  const cliPkgPath = findInstalledPackageJson(rootDir, '@remotion/cli');
  if (remotionPkgPath && cliPkgPath) {
    const remotionPkg = JSON.parse(
      fs.readFileSync(remotionPkgPath, 'utf8')
    ) as { version?: string };
    const remotionVer = remotionPkg.version ?? '4.x';
    const configuredEntry = path.resolve(studioDir, config.entryPoint);
    const foundEntry = fs.existsSync(configuredEntry)
      ? configuredEntry
      : [
          path.join(studioDir, 'src', 'index.ts'),
          path.join(studioDir, 'src', 'index.tsx'),
          path.join(rootDir, 'src', 'index.ts'),
        ].find((p) => fs.existsSync(p));

    results.push({
      name: 'Remotion Studio & Renderer',
      status: foundEntry ? 'ok' : 'warn',
      detail: foundEntry
        ? `Remotion v${remotionVer} ready (entry: ${path.relative(rootDir, foundEntry)})`
        : `Remotion v${remotionVer} installed (no entry found at ${config.entryPoint}; run \`npx make-pictures init\`)`,
    });
  } else {
    results.push({
      name: 'Remotion Studio & Renderer',
      status: 'fail',
      detail: 'Missing `remotion` or `@remotion/cli`. Run `npm install remotion @remotion/cli`.',
    });
  }

  // 6. @make-pictures/remotion & AI Skills check
  const mpRemotionPkg = findInstalledPackageJson(
    rootDir,
    '@make-pictures/remotion'
  );
  const isMonorepo = fs.existsSync(
    path.join(rootDir, 'packages', 'remotion', 'src', 'index.ts')
  );
  if (mpRemotionPkg || isMonorepo) {
    results.push({
      name: '@make-pictures/remotion',
      status: 'ok',
      detail: isMonorepo
        ? 'Monorepo source (packages/remotion/src)'
        : 'Installed in node_modules/@make-pictures/remotion',
    });
  } else {
    results.push({
      name: '@make-pictures/remotion',
      status: 'warn',
      detail:
        'Not installed yet. Run `npm install @make-pictures/remotion` to use visual kits & StyleLab.',
    });
  }

  for (const r of results) {
    console.log(`${formatIcon(r.status)} ${r.name.padEnd(30)} ${r.detail}`);
  }

  const hasFailures = results.some((r) => r.status === 'fail');
  console.log('\n--------------------------------------------------------------');
  if (hasFailures) {
    throw new Error('Some required environment checks failed.');
  }

  const dirFlag = dirRel !== '.' ? ` --dir=${dirRel}` : '';
  console.log('✨ Remotion toolkit environment is ready! Next steps:');
  console.log('   1. Launch Remotion Studio:     npx remotion studio');
  console.log('   2. Connect ElevenLabs API key: npx make-pictures onboard');
  console.log(`   3. Build audio & timestamps:   npx make-pictures audio${dirFlag}`);
}
