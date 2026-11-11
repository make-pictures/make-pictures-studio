import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import type {
  SfxAssetSpec,
  SfxFallbackPreset,
} from '@make-pictures/core';

export interface GeneratedSfxMetadata {
  id: string;
  prompt: string;
  provider: 'elevenlabs-sfx' | 'procedural-fallback';
  specHash: string;
  audioFile: string;
  durationSeconds: number;
  loop: boolean;
  generatedAt: string;
}

export interface GenerateSfxOptions {
  outputDir: string;
  /** Public-relative prefix before `<id>.mp3`, e.g. `_productions/my-film/sfx` or `sfx` */
  publicRelPrefix: string;
  useLiveApi: boolean;
  force?: boolean;
  apiKey?: string;
}

const PROCEDURAL_SFX_PRESETS: Record<
  SfxFallbackPreset,
  { filter: string; defaultDuration: number }
> = {
  whoosh: {
    filter:
      'aevalsrc=0.14*sin(2*PI*(140+280*t)*t)*exp(-4.5*t):s=44100:d=0.4',
    defaultDuration: 0.4,
  },
  pop: {
    filter:
      'aevalsrc=0.18*sin(2*PI*(520-260*t)*t)*exp(-18*t):s=44100:d=0.16',
    defaultDuration: 0.16,
  },
  click: {
    filter: 'aevalsrc=0.15*sin(2*PI*1100*t)*exp(-35*t):s=44100:d=0.08',
    defaultDuration: 0.08,
  },
  chime: {
    filter:
      'aevalsrc=0.14*(sin(2*PI*523.25*t)*exp(-2.8*t)+0.8*sin(2*PI*783.99*max(0\\,t-0.08))*exp(-2.5*max(0\\,t-0.08))+0.7*sin(2*PI*1046.5*max(0\\,t-0.16))*exp(-2.2*max(0\\,t-0.16))):s=44100:d=1.1',
    defaultDuration: 1.1,
  },
  wind: {
    filter:
      'anoisesrc=d=1.8:c=pink:r=44100:a=0.12,bandpass=f=680:w=520,afade=t=in:st=0:d=0.25,afade=t=out:st=1.2:d=0.6',
    defaultDuration: 1.8,
  },
  impact: {
    filter:
      'aevalsrc=0.26*(sin(2*PI*(95-55*min(1\\,t*3))*t)*exp(-4.2*t)+0.35*sin(2*PI*190*t)*exp(-9*t)):s=44100:d=0.85',
    defaultDuration: 0.85,
  },
  'ambient-hum': {
    filter:
      'aevalsrc=0.06*(sin(2*PI*65.41*t)+0.6*sin(2*PI*130.81*t+0.2*sin(2*PI*0.3*t))+0.3*sin(2*PI*196*t)):s=44100:d=4.0,lowpass=f=900,afade=t=in:st=0:d=0.3,afade=t=out:st=3.7:d=0.3',
    defaultDuration: 4.0,
  },
};

/**
 * All 13 baseline SFX assets in `public/sfx/` + `public/recordings/sample-ui.mp4`
 * required by built-in example scenes (`StarterStory`, `PaperDioramaDemo`, `ProductPromo`, etc.).
 */
const BASELINE_STUDIO_SFX: Array<{
  file: string;
  filter: string;
  duration: string;
}> = [
  {
    file: 'whoosh.wav',
    filter:
      'aevalsrc=0.12*sin(2*PI*(140+280*t)*t)*exp(-4.5*t):s=44100:d=0.35',
    duration: '0.35',
  },
  {
    file: 'pop.wav',
    filter:
      'aevalsrc=0.16*sin(2*PI*(520-260*t)*t)*exp(-18*t):s=44100:d=0.14',
    duration: '0.14',
  },
  {
    file: 'click.wav',
    filter: 'aevalsrc=0.14*sin(2*PI*1100*t)*exp(-35*t):s=44100:d=0.07',
    duration: '0.07',
  },
  {
    file: 'harp-strings.wav',
    filter:
      'aevalsrc=0.11*(sin(2*PI*440*t)*exp(-3.2*t)+sin(2*PI*554.37*max(0\\,t-0.12))*exp(-3.2*max(0\\,t-0.12))+sin(2*PI*659.25*max(0\\,t-0.24))*exp(-3.0*max(0\\,t-0.24))+sin(2*PI*880*max(0\\,t-0.36))*exp(-2.8*max(0\\,t-0.36))):s=44100:d=1.4',
    duration: '1.4',
  },
  {
    file: 'spring-bend.wav',
    filter:
      'aevalsrc=0.18*sin(2*PI*(240+95*sin(2*PI*9*t))*t)*exp(-2.8*t):s=44100:d=0.75',
    duration: '0.75',
  },
  {
    file: 'paper-rip-wind.wav',
    filter:
      'anoisesrc=d=1.2:c=pink:r=44100:a=0.14,bandpass=f=950:w=700,afade=t=in:st=0:d=0.08,afade=t=out:st=0.7:d=0.5',
    duration: '1.2',
  },
  {
    file: 'triumph-chord.wav',
    filter:
      'aevalsrc=0.12*(sin(2*PI*523.25*t)+sin(2*PI*659.25*t)+sin(2*PI*783.99*t)+sin(2*PI*1046.5*t))*exp(-2.2*t):s=44100:d=1.2',
    duration: '1.2',
  },
  {
    file: 'bubble-pop.wav',
    filter:
      'aevalsrc=0.16*sin(2*PI*(340+480*t)*t)*exp(-16*t):s=44100:d=0.22',
    duration: '0.22',
  },
  {
    file: 'pizzicato-woodblock.wav',
    filter:
      'aevalsrc=0.22*(sin(2*PI*740*t)*exp(-28*t)+0.8*sin(2*PI*392*max(0\\,t-0.14))*exp(-18*max(0\\,t-0.14))):s=44100:d=0.45',
    duration: '0.45',
  },
  {
    file: 'zoom-out-whoosh.wav',
    filter:
      'anoisesrc=d=2.2:c=pink:r=44100:a=0.11,bandpass=f=380:w=260,afade=t=in:st=0:d=0.5,afade=t=out:st=1.2:d=1.0',
    duration: '2.2',
  },
  {
    file: 'shock-sting.wav',
    filter:
      'aevalsrc=0.22*(sin(2*PI*587.33*t)*exp(-4.5*t)+0.85*sin(2*PI*880*max(0\\,t-0.06))*exp(-3.2*max(0\\,t-0.06))+0.75*sin(2*PI*1174.66*max(0\\,t-0.12))*exp(-2.4*max(0\\,t-0.12))):s=44100:d=1.1',
    duration: '1.1',
  },
  {
    file: 'comedy-accent.wav',
    filter:
      'aevalsrc=0.18*(sin(2*PI*523.25*t)*exp(-24*t)+0.9*sin(2*PI*659.25*max(0\\,t-0.11))*exp(-22*max(0\\,t-0.11))+1.1*sin(2*PI*783.99*max(0\\,t-0.22))*exp(-16*max(0\\,t-0.22))):s=44100:d=0.55',
    duration: '0.55',
  },
  {
    file: 'bgm-paper-expedition.wav',
    filter:
      'aevalsrc=0.055*((sin(2*PI*261.63*t)+0.5*sin(2*PI*392.00*t))*exp(-1.8*mod(t\\,1.0))+0.8*(sin(2*PI*329.63*t)+0.4*sin(2*PI*523.25*t))*exp(-2.2*mod(t+0.5\\,1.0))+0.35*sin(2*PI*130.81*t)):s=44100:d=8.0,lowpass=f=1200,afade=t=in:st=0:d=0.25,afade=t=out:st=7.75:d=0.25',
    duration: '8.0',
  },
];

export function ensureBaselineStudioAssets(rootDir = process.cwd()): void {
  const sfxDir = path.join(rootDir, 'public', 'sfx');
  const recordingsDir = path.join(rootDir, 'public', 'recordings');
  fs.mkdirSync(sfxDir, { recursive: true });
  fs.mkdirSync(recordingsDir, { recursive: true });

  for (const sfx of BASELINE_STUDIO_SFX) {
    const targetPath = path.join(sfxDir, sfx.file);
    if (!fs.existsSync(targetPath)) {
      execFileSync(
        'ffmpeg',
        ['-y', '-f', 'lavfi', '-i', sfx.filter, '-t', sfx.duration, targetPath],
        { stdio: 'ignore' }
      );
      console.log(`  [SFX] Wygenerowano zasób bazowy: public/sfx/${sfx.file}`);
    }
  }

  const sampleVideoPath = path.join(recordingsDir, 'sample-ui.mp4');
  if (!fs.existsSync(sampleVideoPath)) {
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'color=c=0x0B0E17:s=1600x1000:r=60:d=6',
        '-vf',
        [
          'drawgrid=w=80:h=80:t=1:c=0x1E293B@0.35',
          'drawbox=x=48:y=48:w=340:h=904:color=0x111827@0.85:t=fill',
          'drawbox=x=420:y=48:w=1132:h=260:color=0x0F172A@0.9:t=fill',
          'drawbox=x=420:y=340:w=550:h=612:color=0x0F172A@0.85:t=fill',
          'drawbox=x=1002:y=340:w=550:h=612:color=0x0F172A@0.85:t=fill',
        ].join(','),
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        sampleVideoPath,
      ],
      { stdio: 'ignore' }
    );
    console.log(
      `  [RECORDING] Utworzono przykładowe nagranie ekranu: public/recordings/sample-ui.mp4`
    );
  }
}

export function computeSfxSpecHash(spec: SfxAssetSpec): string {
  const canonical = JSON.stringify({
    id: spec.id,
    prompt: spec.prompt,
    durationSeconds: spec.durationSeconds ?? null,
    loop: spec.loop ?? false,
    promptInfluence: spec.promptInfluence ?? 0.35,
    fallbackPreset: spec.fallbackPreset ?? null,
    customFfmpegFilter: spec.customFfmpegFilter ?? null,
  });
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function inferPresetFromPrompt(prompt: string): SfxFallbackPreset {
  const lower = prompt.toLowerCase();
  if (/whoosh|swoosh|swipe|transition|pan/.test(lower)) return 'whoosh';
  if (/click|tap|key|switch|snap/.test(lower)) return 'click';
  if (/pop|bubble|card/.test(lower)) return 'pop';
  if (/chime|bell|sparkle|ding|magic|success/.test(lower)) return 'chime';
  if (/wind|breeze|paper|air/.test(lower)) return 'wind';
  if (/impact|boom|hit|thud|slam|drop/.test(lower)) return 'impact';
  if (/hum|drone|room|ambient|atmosphere/.test(lower)) return 'ambient-hum';
  return 'pop';
}

async function streamToBuffer(
  stream: ReadableStream<Uint8Array>
): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
    }
  }
  return Buffer.concat(chunks);
}

/**
 * Generates or retrieves a cached Foley/SFX asset via ElevenLabs Sound Effects API
 * (`client.textToSoundEffects.convert`) or procedural `ffmpeg` synthesis fallback.
 */
export async function generateSfxAsset(
  spec: SfxAssetSpec,
  options: GenerateSfxOptions
): Promise<GeneratedSfxMetadata> {
  fs.mkdirSync(options.outputDir, { recursive: true });

  const specHash = computeSfxSpecHash(spec);
  const mp3Path = path.join(options.outputDir, `${spec.id}.mp3`);
  const jsonPath = path.join(options.outputDir, `${spec.id}.json`);
  const relPrefix = options.publicRelPrefix.replace(/^\/+|\/+$/g, '');
  const audioFile = relPrefix ? `${relPrefix}/${spec.id}.mp3` : `${spec.id}.mp3`;

  // SHA-256 Cache Check
  if (!options.force && fs.existsSync(mp3Path) && fs.existsSync(jsonPath)) {
    try {
      const existing = JSON.parse(
        fs.readFileSync(jsonPath, 'utf8')
      ) as GeneratedSfxMetadata;
      const providerMatches =
        !options.useLiveApi || existing.provider === 'elevenlabs-sfx';
      if (existing.specHash === specHash && providerMatches) {
        console.log(
          `  [SFX CACHE]   "${spec.id}" (SHA-256: ${specHash.slice(0, 12)}…) — cache hit.`
        );
        return existing;
      }
    } catch {
      // Regenerate on corrupt cache
    }
  }

  if (options.useLiveApi) {
    try {
      const client = new ElevenLabsClient({
        apiKey: options.apiKey || process.env.ELEVENLABS_API_KEY?.trim(),
      });

      const clampedDuration =
        spec.durationSeconds !== undefined
          ? Math.max(0.5, Math.min(30, spec.durationSeconds))
          : undefined;

      console.log(
        `  [ELEVENLABS SFX] Generating "${spec.id}" (${spec.prompt.slice(0, 56)}…)`
      );

      const audioStream = await client.textToSoundEffects.convert({
        text: spec.prompt,
        ...(clampedDuration !== undefined
          ? { durationSeconds: clampedDuration }
          : {}),
        ...(spec.loop !== undefined ? { loop: spec.loop } : {}),
        promptInfluence: spec.promptInfluence ?? 0.35,
      });

      const rawBuffer = await streamToBuffer(audioStream);
      const rawTmpPath = `${mp3Path}.raw.mp3`;
      fs.writeFileSync(rawTmpPath, rawBuffer);

      const postFilter = spec.loop
        ? 'alimiter=limit=0.95'
        : 'alimiter=limit=0.95,apad=pad_dur=0.06';

      execFileSync(
        'ffmpeg',
        [
          '-y',
          '-i',
          rawTmpPath,
          '-af',
          postFilter,
          '-c:a',
          'libmp3lame',
          '-q:a',
          '2',
          mp3Path,
        ],
        { stdio: 'ignore' }
      );
      fs.unlinkSync(rawTmpPath);

      const metadata: GeneratedSfxMetadata = {
        id: spec.id,
        prompt: spec.prompt,
        provider: 'elevenlabs-sfx',
        specHash,
        audioFile,
        durationSeconds: clampedDuration ?? 1.0,
        loop: Boolean(spec.loop),
        generatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2), 'utf8');
      console.log(`  [SFX SAVED]   ${audioFile} (ElevenLabs SFX API)`);
      return metadata;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(
        `  [SFX FALLBACK] ElevenLabs SFX API unavailable (${reason}). Using procedural synth…`
      );
    }
  }

  const presetKey = spec.fallbackPreset ?? inferPresetFromPrompt(spec.prompt);
  const preset =
    PROCEDURAL_SFX_PRESETS[presetKey] ?? PROCEDURAL_SFX_PRESETS.pop;
  const durationSec = spec.durationSeconds ?? preset.defaultDuration;
  const lavfiFilter = spec.customFfmpegFilter ?? preset.filter;

  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      lavfiFilter,
      '-t',
      String(Math.max(0.05, durationSec)),
      '-c:a',
      'libmp3lame',
      '-q:a',
      '2',
      mp3Path,
    ],
    { stdio: 'ignore' }
  );

  const fallbackMeta: GeneratedSfxMetadata = {
    id: spec.id,
    prompt: spec.prompt,
    provider: 'procedural-fallback',
    specHash,
    audioFile,
    durationSeconds: durationSec,
    loop: Boolean(spec.loop),
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(jsonPath, JSON.stringify(fallbackMeta, null, 2), 'utf8');
  console.log(`  [SFX SAVED]   ${audioFile} (procedural "${presetKey}")`);
  return fallbackMeta;
}
