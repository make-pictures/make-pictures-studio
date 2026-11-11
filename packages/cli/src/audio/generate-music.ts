import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ElevenLabsClient, type Music } from '@elevenlabs/elevenlabs-js';
import type {
  MusicMoodPreset,
  MusicScoreSpec,
} from '@make-pictures/core';

export interface GeneratedMusicMetadata {
  id: string;
  mode: MusicScoreSpec['mode'];
  provider: 'elevenlabs-music' | 'procedural-fallback';
  specHash: string;
  audioFile: string;
  durationInSeconds: number;
  moodPreset: MusicMoodPreset;
  generatedAt: string;
  songTitle?: string;
  genres?: string[];
}

export interface GenerateMusicOptions {
  outputDir: string;
  /** Public-relative prefix before `<id>.mp3`, e.g. `_productions/my-film/music` or `music` */
  publicRelPrefix: string;
  useLiveApi: boolean;
  force?: boolean;
  apiKey?: string;
  fallbackDurationSeconds?: number;
}

/**
 * Six pleasant, warm, loopable stereo `ffmpeg` `lavfi` synthesis presets (`c0|c1`).
 */
const MOOD_PRESET_FILTERS: Record<
  MusicMoodPreset,
  (durationSec: number) => string
> = {
  'ambient-tech': (d) => {
    const fadeOutStart = Math.max(0.2, d - 0.45).toFixed(2);
    return [
      `aevalsrc='0.055*(sin(2*PI*73.42*t)+0.65*sin(2*PI*146.83*t+0.3*sin(2*PI*0.25*t))+0.45*sin(2*PI*220*t)*exp(-1.4*mod(t\\,2.0))+0.35*sin(2*PI*329.63*t)*exp(-2.1*mod(t+1.0\\,2.0)))|0.055*(sin(2*PI*73.42*t)+0.65*sin(2*PI*146.83*t+0.3*cos(2*PI*0.25*t))+0.45*sin(2*PI*261.63*t)*exp(-1.5*mod(t+0.5\\,2.0))+0.35*sin(2*PI*329.63*t)*exp(-2.1*mod(t+1.5\\,2.0)))':s=44100:d=${d}`,
      'lowpass=f=1650',
      'afade=t=in:st=0:d=0.45',
      `afade=t=out:st=${fadeOutStart}:d=0.45`,
    ].join(',');
  },
  'warm-story': (d) => {
    const fadeOutStart = Math.max(0.2, d - 0.45).toFixed(2);
    return [
      `aevalsrc='0.06*((sin(2*PI*130.81*t)+0.5*sin(2*PI*196.00*t))+0.55*sin(2*PI*246.94*t)*exp(-1.6*mod(t\\,1.5))+0.45*sin(2*PI*329.63*t)*exp(-1.9*mod(t+0.75\\,1.5)))|0.06*((sin(2*PI*130.81*t)+0.5*sin(2*PI*196.00*t))+0.55*sin(2*PI*293.66*t)*exp(-1.6*mod(t+0.375\\,1.5))+0.45*sin(2*PI*392.00*t)*exp(-1.9*mod(t+1.125\\,1.5)))':s=44100:d=${d}`,
      'lowpass=f=1500',
      'afade=t=in:st=0:d=0.45',
      `afade=t=out:st=${fadeOutStart}:d=0.45`,
    ].join(',');
  },
  'news-pulse': (d) => {
    const fadeOutStart = Math.max(0.2, d - 0.35).toFixed(2);
    return [
      `aevalsrc='0.058*(0.7*sin(2*PI*98.00*t)*exp(-3.2*mod(t\\,0.5))+0.55*sin(2*PI*196.00*t)*exp(-4.5*mod(t+0.25\\,0.5))+0.4*sin(2*PI*293.66*t)*exp(-2.5*mod(t\\,1.0)))|0.058*(0.7*sin(2*PI*98.00*t)*exp(-3.2*mod(t\\,0.5))+0.55*sin(2*PI*233.08*t)*exp(-4.5*mod(t+0.25\\,0.5))+0.4*sin(2*PI*392.00*t)*exp(-2.5*mod(t+0.5\\,1.0)))':s=44100:d=${d}`,
      'lowpass=f=1900',
      'afade=t=in:st=0:d=0.35',
      `afade=t=out:st=${fadeOutStart}:d=0.35`,
    ].join(',');
  },
  'cinematic-drone': (d) => {
    const fadeOutStart = Math.max(0.2, d - 0.6).toFixed(2);
    return [
      `aevalsrc='0.065*(sin(2*PI*55.00*t)+0.75*sin(2*PI*110.00*t+0.25*sin(2*PI*0.15*t))+0.45*sin(2*PI*164.81*t)+0.28*sin(2*PI*220.00*t+0.2*cos(2*PI*0.18*t)))|0.065*(sin(2*PI*55.00*t)+0.75*sin(2*PI*110.00*t+0.25*cos(2*PI*0.15*t))+0.45*sin(2*PI*130.81*t)+0.28*sin(2*PI*246.94*t+0.2*sin(2*PI*0.18*t)))':s=44100:d=${d}`,
      'lowpass=f=1150',
      'afade=t=in:st=0:d=0.6',
      `afade=t=out:st=${fadeOutStart}:d=0.6`,
    ].join(',');
  },
  'paper-expedition': (d) => {
    const fadeOutStart = Math.max(0.2, d - 0.35).toFixed(2);
    return [
      `aevalsrc='0.058*((sin(2*PI*261.63*t)+0.5*sin(2*PI*392.00*t))*exp(-1.8*mod(t\\,1.0))+0.8*(sin(2*PI*329.63*t)+0.4*sin(2*PI*523.25*t))*exp(-2.2*mod(t+0.5\\,1.0))+0.38*sin(2*PI*130.81*t))|0.058*((sin(2*PI*261.63*t)+0.5*sin(2*PI*329.63*t))*exp(-1.8*mod(t\\,1.0))+0.8*(sin(2*PI*392.00*t)+0.4*sin(2*PI*587.33*t))*exp(-2.2*mod(t+0.5\\,1.0))+0.38*sin(2*PI*130.81*t))':s=44100:d=${d}`,
      'lowpass=f=1350',
      'afade=t=in:st=0:d=0.35',
      `afade=t=out:st=${fadeOutStart}:d=0.35`,
    ].join(',');
  },
  'upbeat-launch': (d) => {
    const fadeOutStart = Math.max(0.2, d - 0.35).toFixed(2);
    return [
      `aevalsrc='0.056*(0.65*sin(2*PI*87.31*t)*exp(-2.6*mod(t\\,0.5))+0.55*sin(2*PI*261.63*t)*exp(-2.2*mod(t\\,1.0))+0.5*sin(2*PI*349.23*t)*exp(-2.2*mod(t+0.25\\,1.0))+0.45*sin(2*PI*440.00*t)*exp(-2.2*mod(t+0.5\\,1.0)))|0.056*(0.65*sin(2*PI*87.31*t)*exp(-2.6*mod(t\\,0.5))+0.55*sin(2*PI*220.00*t)*exp(-2.2*mod(t\\,1.0))+0.5*sin(2*PI*329.63*t)*exp(-2.2*mod(t+0.25\\,1.0))+0.45*sin(2*PI*523.25*t)*exp(-2.2*mod(t+0.75\\,1.0)))':s=44100:d=${d}`,
      'lowpass=f=2100',
      'afade=t=in:st=0:d=0.35',
      `afade=t=out:st=${fadeOutStart}:d=0.35`,
    ].join(',');
  },
};

export function computeMusicSpecHash(score: MusicScoreSpec): string {
  const canonical = JSON.stringify({
    id: score.id,
    mode: score.mode,
    prompt: score.prompt ?? '',
    moodPreset: score.moodPreset ?? 'ambient-tech',
    forceInstrumental: score.forceInstrumental ?? true,
    durationSeconds: score.durationSeconds ?? null,
    sections: score.sections ?? null,
  });
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function synthesizeProceduralMusicMp3(
  outputPath: string,
  moodPreset: MusicMoodPreset,
  durationSec: number
): void {
  const safeDuration = Math.max(4, Math.min(180, Number(durationSec.toFixed(2))));
  const filterBuilder =
    MOOD_PRESET_FILTERS[moodPreset] ?? MOOD_PRESET_FILTERS['ambient-tech'];
  const lavfiGraph = filterBuilder(safeDuration);

  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      lavfiGraph,
      '-t',
      String(safeDuration),
      '-c:a',
      'libmp3lame',
      '-q:a',
      '2',
      outputPath,
    ],
    { stdio: 'ignore' }
  );
}

/**
 * Generates or retrieves a cached musical score via ElevenLabs Music API (`composeDetailed`)
 * or procedural stereo synthesis fallback (`--mock`, offline, or `procedural-fallback` mode).
 */
export async function generateMusicScore(
  score: MusicScoreSpec,
  options: GenerateMusicOptions
): Promise<GeneratedMusicMetadata> {
  fs.mkdirSync(options.outputDir, { recursive: true });

  const moodPreset: MusicMoodPreset = score.moodPreset ?? 'ambient-tech';
  const specHash = computeMusicSpecHash(score);
  const mp3Path = path.join(options.outputDir, `${score.id}.mp3`);
  const jsonPath = path.join(options.outputDir, `${score.id}.json`);
  const relPrefix = options.publicRelPrefix.replace(/^\/+|\/+$/g, '');
  const audioFile = relPrefix ? `${relPrefix}/${score.id}.mp3` : `${score.id}.mp3`;

  const sectionTotalSec =
    score.sections && score.sections.length > 0
      ? score.sections.reduce((acc, s) => acc + s.durationMs / 1000, 0)
      : undefined;

  const targetDurationSec = Number(
    (
      score.durationSeconds ??
      sectionTotalSec ??
      options.fallbackDurationSeconds ??
      16
    ).toFixed(2)
  );

  // SHA-256 Cache Check
  if (!options.force && fs.existsSync(mp3Path) && fs.existsSync(jsonPath)) {
    try {
      const existing = JSON.parse(
        fs.readFileSync(jsonPath, 'utf8')
      ) as GeneratedMusicMetadata;
      const providerMatches =
        !options.useLiveApi ||
        score.mode === 'procedural-fallback' ||
        existing.provider === 'elevenlabs-music';
      if (existing.specHash === specHash && providerMatches) {
        console.log(
          `  [MUSIC CACHE] "${score.id}" (SHA-256: ${specHash.slice(0, 12)}…) — cache hit.`
        );
        return existing;
      }
    } catch {
      // Regenerate on corrupt metadata
    }
  }

  if (options.useLiveApi && score.mode !== 'procedural-fallback') {
    try {
      const client = new ElevenLabsClient({
        apiKey: options.apiKey || process.env.ELEVENLABS_API_KEY?.trim(),
      });
      const musicClient = client.music as unknown as Music;

      const clampedDurationMs = Math.max(
        10000,
        Math.min(300000, Math.round(targetDurationSec * 1000))
      );

      if (score.mode === 'composition-plan') {
        console.log(
          `  [ELEVENLABS MUSIC] Composing section-aligned score "${score.id}" (${clampedDurationMs}ms)…`
        );
        const compositionPlan =
          score.sections && score.sections.length > 0
            ? {
                positiveGlobalStyles: score.prompt
                  ? [
                      score.prompt,
                      'instrumental background score',
                      'clean studio mix',
                    ]
                  : ['instrumental background score', 'clean studio mix'],
                negativeGlobalStyles: [
                  'vocals',
                  'singing',
                  'spoken word',
                  'clipping',
                ],
                sections: score.sections.map((sec) => ({
                  sectionName: sec.name.slice(0, 100),
                  durationMs: Math.max(
                    3000,
                    Math.min(120000, Math.round(sec.durationMs))
                  ),
                  positiveLocalStyles:
                    sec.positiveLocalStyles.length > 0
                      ? sec.positiveLocalStyles
                      : ['cinematic instrumental'],
                  negativeLocalStyles: sec.negativeLocalStyles ?? [
                    'vocals',
                    'singing',
                  ],
                  lines: [] as string[],
                })),
              }
            : await musicClient.compositionPlan.create({
                prompt:
                  score.prompt ||
                  `Instrumental ${moodPreset} background score for video storytelling`,
                musicLengthMs: clampedDurationMs,
              });

        const detailed = await musicClient.composeDetailed({
          compositionPlan,
          respectSectionsDurations: true,
        });

        fs.writeFileSync(mp3Path, detailed.audio);
        const metadata: GeneratedMusicMetadata = {
          id: score.id,
          mode: score.mode,
          provider: 'elevenlabs-music',
          specHash,
          audioFile,
          durationInSeconds: targetDurationSec,
          moodPreset,
          generatedAt: new Date().toISOString(),
          songTitle: detailed.json?.songMetadata?.title,
          genres: detailed.json?.songMetadata?.genres,
        };
        fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2), 'utf8');
        console.log(`  [MUSIC SAVED] ${audioFile} (ElevenLabs Composition Plan)`);
        return metadata;
      }

      console.log(
        `  [ELEVENLABS MUSIC] Composing score "${score.id}" from prompt (${clampedDurationMs}ms)…`
      );
      const detailed = await musicClient.composeDetailed({
        prompt:
          score.prompt ||
          `Warm instrumental ${moodPreset} soundtrack for modern motion design`,
        musicLengthMs: clampedDurationMs,
        forceInstrumental: score.forceInstrumental ?? true,
      });

      fs.writeFileSync(mp3Path, detailed.audio);
      const metadata: GeneratedMusicMetadata = {
        id: score.id,
        mode: score.mode,
        provider: 'elevenlabs-music',
        specHash,
        audioFile,
        durationInSeconds: targetDurationSec,
        moodPreset,
        generatedAt: new Date().toISOString(),
        songTitle: detailed.json?.songMetadata?.title,
        genres: detailed.json?.songMetadata?.genres,
      };
      fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2), 'utf8');
      console.log(`  [MUSIC SAVED] ${audioFile} (ElevenLabs Music API)`);
      return metadata;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(
        `  [MUSIC FALLBACK] ElevenLabs Music API unavailable (${reason}). Synthesizing "${moodPreset}" stereo track locally…`
      );
    }
  } else {
    console.log(
      `  [MUSIC SYNTH] Generating stereo "${moodPreset}" score "${score.id}" (${targetDurationSec}s)…`
    );
  }

  synthesizeProceduralMusicMp3(mp3Path, moodPreset, targetDurationSec);

  const fallbackMeta: GeneratedMusicMetadata = {
    id: score.id,
    mode: score.mode,
    provider: 'procedural-fallback',
    specHash,
    audioFile,
    durationInSeconds: Math.max(4, targetDurationSec),
    moodPreset,
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(jsonPath, JSON.stringify(fallbackMeta, null, 2), 'utf8');
  console.log(`  [MUSIC SAVED] ${audioFile} (procedural stereo "${moodPreset}")`);
  return fallbackMeta;
}
