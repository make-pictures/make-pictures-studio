import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import dotenv from 'dotenv';
import { resolveWorkspaceContext } from './workspace-paths';

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

function discoverProductionManifests(studioDir: string): string[] {
  const productionsDir = path.join(studioDir, 'productions');
  if (!fs.existsSync(productionsDir)) return [];
  const found: string[] = [];
  for (const entry of fs.readdirSync(productionsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(
      productionsDir,
      entry.name,
      'production.json'
    );
    if (fs.existsSync(manifestPath)) {
      found.push(manifestPath);
    }
  }
  return found.sort();
}

/**
 * Runs environment health checks for Node.js, FFmpeg, `.env.local` / ElevenLabs API,
 * production capsules (or monorepo `scenes.json`), Remotion renderer, and Studio Web.
 */
export async function runDoctorCommand(
  options: DoctorCommandOptions = {}
): Promise<void> {
  const { rootDir, studioDir, dirRel } = resolveWorkspaceContext({
    cwd: options.cwd,
    dir: options.dir,
  });

  const envLocalPath = path.join(rootDir, '.env.local');
  const envExamplePath = path.join(rootDir, '.env.example');
  const scenesPath = path.join(rootDir, 'scenes.json');

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
        'ffmpeg not found in PATH (recommended for procedural SFX, QA contact sheets & -14 LUFS mastering: `brew install ffmpeg`)',
    });
  }

  // 3. .env.local & ElevenLabs API Key check
  if (!fs.existsSync(envLocalPath) && options.setup) {
    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envLocalPath);
    } else {
      fs.writeFileSync(
        envLocalPath,
        'ELEVENLABS_API_KEY=your_elevenlabs_api_key_here\nELEVENLABS_VOICE_ID=TX3LPaxmHKxFdv7VOQHJ\nELEVENLABS_MODEL_ID=eleven_multilingual_v2\n',
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
        'Missing `.env.local`. Run `npx make-pictures onboard` (or `npx make-pictures doctor --setup` for offline mode).',
    });
  } else if (isPlaceholder) {
    results.push({
      name: 'ElevenLabs API Key',
      status: 'warn',
      detail:
        '`ELEVENLABS_API_KEY` in `.env.local` is set to placeholder. Audio will use deterministic offline fallback (`--mock`) until connected.',
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
          )}). Offline fallback remains available.`,
        });
      }
    }
  }

  // 4. Productions & Manifests check (`productions/*/production.json` and/or `scenes.json`)
  const capsuleManifests = discoverProductionManifests(studioDir);
  if (capsuleManifests.length > 0) {
    try {
      let totalScenes = 0;
      for (const mp of capsuleManifests) {
        const parsed = JSON.parse(fs.readFileSync(mp, 'utf8')) as {
          scenes?: unknown[];
        };
        totalScenes += Array.isArray(parsed.scenes) ? parsed.scenes.length : 0;
      }
      results.push({
        name: 'Production Capsules',
        status: 'ok',
        detail: `${capsuleManifests.length} capsule(s) in ${path.relative(rootDir, path.join(studioDir, 'productions')) || 'productions'} (${totalScenes} scenes @ 60 FPS)`,
      });
    } catch (err) {
      results.push({
        name: 'Production Capsules',
        status: 'fail',
        detail: `Invalid JSON in production manifest: ${
          err instanceof Error ? err.message : String(err)
        }`,
      });
    }
  } else if (fs.existsSync(scenesPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(scenesPath, 'utf8')) as {
        scenes?: unknown[];
        project?: { fps?: number };
      };
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
      name: 'Production Capsules',
      status: 'warn',
      detail: `No capsules yet. Run \`npx make-pictures new hello-studio${dirRel !== '.' ? ` --dir=${dirRel}` : ''}\` to scaffold one.`,
    });
  }

  // 5. Remotion CLI & Entrypoint check
  try {
    const remotionPkgPath = path.join(
      rootDir,
      'node_modules',
      'remotion',
      'package.json'
    );
    const cliPkgPath = path.join(
      rootDir,
      'node_modules',
      '@remotion',
      'cli',
      'package.json'
    );
    if (!fs.existsSync(remotionPkgPath) || !fs.existsSync(cliPkgPath)) {
      throw new Error('Missing remotion packages in node_modules');
    }
    const remotionPkg = JSON.parse(
      fs.readFileSync(remotionPkgPath, 'utf8')
    ) as { version?: string };
    const remotionVer = remotionPkg.version ?? '4.x';

    const entryCandidates = [
      path.join(studioDir, 'src', 'index.ts'),
      path.join(studioDir, 'index.ts'),
      path.join(rootDir, 'src', 'index.ts'),
      path.join(rootDir, 'videos', 'index.ts'),
    ];
    const foundEntry = entryCandidates.find((p) => fs.existsSync(p));
    results.push({
      name: 'Remotion 60 FPS Renderer',
      status: foundEntry ? 'ok' : 'warn',
      detail: foundEntry
        ? `Remotion v${remotionVer} ready (entrypoint: ${path.relative(rootDir, foundEntry)})`
        : `Remotion v${remotionVer} installed (entrypoint will auto-scaffold on qa/render)`,
    });
  } catch {
    results.push({
      name: 'Remotion 60 FPS Renderer',
      status: 'fail',
      detail: 'Remotion CLI not available. Run `npm install` first.',
    });
  }

  // 6. Local Studio Web check
  try {
    const vitePkgPath = path.join(
      rootDir,
      'node_modules',
      'vite',
      'package.json'
    );
    const playerPkgPath = path.join(
      rootDir,
      'node_modules',
      '@remotion',
      'player',
      'package.json'
    );
    if (!fs.existsSync(vitePkgPath) || !fs.existsSync(playerPkgPath)) {
      throw new Error('Missing Vite or @remotion/player in node_modules');
    }
    const vitePkg = JSON.parse(fs.readFileSync(vitePkgPath, 'utf8')) as {
      version?: string;
    };
    const hasStudioPkg =
      fs.existsSync(
        path.join(
          rootDir,
          'node_modules',
          '@make-pictures',
          'studio',
          'package.json'
        )
      ) ||
      fs.existsSync(path.join(rootDir, 'src', 'compositions', 'registry.ts'));

    results.push({
      name: 'Studio Web Workstation',
      status: hasStudioPkg ? 'ok' : 'warn',
      detail: hasStudioPkg
        ? `Vite v${vitePkg.version ?? '6.x'} + @remotion/player + Props Inspector ready (http://127.0.0.1:3000)`
        : 'Install `@make-pictures/studio` to launch `npx make-pictures studio`',
    });
  } catch {
    results.push({
      name: 'Studio Web Workstation',
      status: 'fail',
      detail: 'Studio Web packages missing. Run `npm install` first.',
    });
  }

  for (const r of results) {
    console.log(`${formatIcon(r.status)} ${r.name.padEnd(30)} ${r.detail}`);
  }

  const hasFailures = results.some((r) => r.status === 'fail');
  console.log('\n--------------------------------------------------------------');
  if (hasFailures) {
    throw new Error('Some required studio environment checks failed.');
  }

  const dirFlag = dirRel !== '.' ? ` --dir=${dirRel}` : '';
  console.log('✨ Studio environment is ready! Next steps:');
  console.log('   1. Connect ElevenLabs API key: npx make-pictures onboard');
  console.log(`   2. Launch Studio Web (60 FPS): npx make-pictures studio${dirFlag}`);
  console.log(
    `   3. Build audio & timestamps:   npx make-pictures audio${dirFlag}`
  );
}
