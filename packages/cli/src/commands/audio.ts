import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import type {
  CharacterAlignment,
  MusicMoodPreset,
  MusicScoreSpec,
  ProductionManifest,
  SceneDefinition,
  ScenesManifest,
  SceneVoiceoverData,
  SfxAssetSpec,
  SfxFallbackPreset,
  VoiceAcousticPreset,
  VoiceSettingsConfig,
  WordTimestamp,
} from '@make-pictures/core';
import {
  generateMusicScore,
  type GeneratedMusicMetadata,
} from '../audio/generate-music';
import {
  ensureBaselineStudioAssets,
  generateSfxAsset,
  type GeneratedSfxMetadata,
} from '../audio/generate-sfx';
import { resolveWorkspaceContext } from './workspace-paths';

const CLI_VOICE_ACOUSTIC_FILTERS: Record<VoiceAcousticPreset, string> = {
  clean: 'apad=pad_dur=0.25',
  telephone:
    'highpass=f=340,lowpass=f=3200,acompressor=threshold=-16dB:ratio=3.5:attack=5:release=60,volume=1.18,apad=pad_dur=0.25',
  'radio-walkie':
    'highpass=f=480,lowpass=f=2700,acrusher=bits=10:mix=0.28,acompressor=threshold=-18dB:ratio=4:attack=4:release=50,volume=1.22,apad=pad_dur=0.25',
  cathedral:
    'highpass=f=140,aecho=0.82:0.78:48|96:0.32|0.18,lowpass=f=7800,volume=1.08,apad=pad_dur=0.25',
  megaphone:
    'highpass=f=230,lowpass=f=3100,aecho=0.85:0.75:16:0.22,volume=1.15,apad=pad_dur=0.25',
  'excitement-boost':
    'highpass=f=85,treble=g=2.0:f=4200,volume=1.32,alimiter=limit=0.96,apad=pad_dur=0.25',
};

function getVoiceAcousticFilter(preset?: VoiceAcousticPreset): string {
  if (!preset || !(preset in CLI_VOICE_ACOUSTIC_FILTERS)) {
    return CLI_VOICE_ACOUSTIC_FILTERS.clean;
  }
  return CLI_VOICE_ACOUSTIC_FILTERS[preset];
}

const DEFAULT_VOICE_ID = 'TX3LPaxmHKxFdv7VOQHJ';
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2';

export interface AudioCommandOptions {
  rootDir?: string;
  cwd?: string;
  dir?: string;
  productionSlug?: string;
  mock?: boolean;
  force?: boolean;
}

export function hasActiveElevenLabsApiKey(): boolean {
  const raw = process.env.ELEVENLABS_API_KEY?.trim();
  return (
    Boolean(raw) &&
    raw !== 'your_elevenlabs_api_key_here' &&
    raw !== 'twoj_klucz_api_elevenlabs' &&
    raw !== 'offline-fallback-key'
  );
}

function getElevenLabsClient(): ElevenLabsClient {
  return new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY?.trim() || 'offline-fallback-key',
  });
}

/**
 * Computes SHA-256 hash of a string payload.
 */
export function computeTextHash(text: string): string {
  return crypto.createHash('sha256').update(text.trim(), 'utf8').digest('hex');
}

export function computeSceneCacheHash(scene: SceneDefinition): string {
  const baseKey = scene.voiceSettings
    ? `${scene.text}|${JSON.stringify(scene.voiceSettings)}`
    : scene.text;

  const extraParts: string[] = [];
  if (scene.voiceEffect && scene.voiceEffect !== 'clean') {
    extraParts.push(`fx:${scene.voiceEffect}`);
  }
  if (scene.previousText) {
    extraParts.push(`prev:${scene.previousText}`);
  }
  if (scene.nextText) {
    extraParts.push(`next:${scene.nextText}`);
  }

  return computeTextHash(
    extraParts.length > 0 ? `${baseKey}|${extraParts.join('|')}` : baseKey
  );
}

function normalizeWord(raw: string): string {
  return raw
    .replace(/^[.,!?;:"'()[\]{}—–-]+|[.,!?;:"'()[\]{}—–-]+$/g, '')
    .toLowerCase();
}

/**
 * Converts ElevenLabs character-level alignment arrays into word-level timestamps.
 */
export function extractWordsFromAlignment(
  alignment: CharacterAlignment,
  fps: number
): WordTimestamp[] {
  const {
    characters,
    character_start_times_seconds: starts,
    character_end_times_seconds: ends,
  } = alignment;

  const words: WordTimestamp[] = [];
  let currentChars = '';
  let wordStart: number | null = null;
  let wordEnd = 0;

  const flushWord = () => {
    const trimmed = currentChars.trim();
    if (trimmed.length > 0 && wordStart !== null) {
      const startSec = Number(wordStart.toFixed(4));
      const endSec = Number(Math.max(wordEnd, startSec + 0.04).toFixed(4));
      words.push({
        word: trimmed,
        normalizedWord: normalizeWord(trimmed),
        start: startSec,
        end: endSec,
        startFrame: Math.round(startSec * fps),
        endFrame: Math.round(endSec * fps),
      });
    }
    currentChars = '';
    wordStart = null;
  };

  for (let i = 0; i < characters.length; i++) {
    const ch = characters[i] ?? '';
    const st = starts[i] ?? wordEnd;
    const en = ends[i] ?? st;

    if (/\s/.test(ch)) {
      flushWord();
    } else {
      if (wordStart === null) {
        wordStart = st;
      }
      currentChars += ch;
      wordEnd = en;
    }
  }
  flushWord();

  return words;
}

/**
 * Builds deterministic word timestamps when running in `--mock` / offline fallback mode.
 */
export function buildSyntheticWordTimestamps(
  text: string,
  durationInSeconds: number,
  fps: number
): { words: WordTimestamp[]; alignment: CharacterAlignment } {
  const rawTokens = text
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const leadInSec = 0.24;
  const tailOutSec = 0.4;
  const usableDuration = Math.max(
    1.0,
    durationInSeconds - leadInSec - tailOutSec
  );

  const weights = rawTokens.map((token) => {
    const base = Math.max(3, token.length);
    const pauseBonus = /[.,!?;:]$/.test(token) ? 3.5 : 0.8;
    return base + pauseBonus;
  });
  const totalWeight = weights.reduce((acc, w) => acc + w, 0) || 1;

  const words: WordTimestamp[] = [];
  const characters: string[] = [];
  const character_start_times_seconds: number[] = [];
  const character_end_times_seconds: number[] = [];

  let cursor = leadInSec;

  rawTokens.forEach((token, idx) => {
    const slotDuration = (weights[idx] / totalWeight) * usableDuration;
    const pauseFraction = /[.,!?;:]$/.test(token) ? 0.24 : 0.1;
    const speakDuration = slotDuration * (1 - pauseFraction);
    const startSec = Number(cursor.toFixed(4));
    const endSec = Number((cursor + speakDuration).toFixed(4));

    words.push({
      word: token,
      normalizedWord: normalizeWord(token),
      start: startSec,
      end: endSec,
      startFrame: Math.round(startSec * fps),
      endFrame: Math.round(endSec * fps),
    });

    const chars = Array.from(token);
    const charStep = speakDuration / Math.max(1, chars.length);
    chars.forEach((ch, cIdx) => {
      const cStart = Number((startSec + cIdx * charStep).toFixed(4));
      const cEnd = Number((cStart + charStep).toFixed(4));
      characters.push(ch);
      character_start_times_seconds.push(cStart);
      character_end_times_seconds.push(cEnd);
    });

    if (idx < rawTokens.length - 1) {
      characters.push(' ');
      character_start_times_seconds.push(endSec);
      character_end_times_seconds.push(
        Number((cursor + slotDuration).toFixed(4))
      );
    }

    cursor += slotDuration;
  });

  return {
    words,
    alignment: {
      characters,
      character_start_times_seconds,
      character_end_times_seconds,
    },
  };
}

function generateSyntheticMp3(outputPath: string, durationInSeconds: number): void {
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'anullsrc=r=44100:cl=stereo',
      '-t',
      String(Math.max(0.5, durationInSeconds)),
      '-q:a',
      '9',
      '-acodec',
      'libmp3lame',
      outputPath,
    ],
    { stdio: 'ignore' }
  );
}

async function synthesizeSceneVoiceoverViaSdk(params: {
  voiceId: string;
  modelId: string;
  text: string;
  voiceSettings?: VoiceSettingsConfig;
  previousText?: string;
  nextText?: string;
}): Promise<{ audioBase64: string; alignment?: CharacterAlignment }> {
  const { voiceId, modelId, text, voiceSettings, previousText, nextText } =
    params;

  const isLiam = voiceId === 'TX3LPaxmHKxFdv7VOQHJ';
  const defaultSettings = isLiam
    ? {
        stability: 0.35,
        similarityBoost: 0.78,
        style: 0.55,
        speed: 1.1,
        useSpeakerBoost: true,
      }
    : {
        stability: 0.58,
        similarityBoost: 0.8,
        style: 0.18,
        speed: 1.0,
        useSpeakerBoost: true,
      };

  const client = getElevenLabsClient();
  const response = await client.textToSpeech.convertWithTimestamps(voiceId, {
    text,
    modelId,
    ...(previousText ? { previousText } : {}),
    ...(nextText ? { nextText } : {}),
    voiceSettings: {
      ...defaultSettings,
      ...voiceSettings,
    },
  });

  const rawAlignment = response.alignment ?? response.normalizedAlignment;
  const alignment: CharacterAlignment | undefined = rawAlignment
    ? {
        characters: rawAlignment.characters,
        character_start_times_seconds:
          rawAlignment.characterStartTimesSeconds,
        character_end_times_seconds: rawAlignment.characterEndTimesSeconds,
      }
    : undefined;

  return {
    audioBase64: response.audioBase64,
    alignment,
  };
}

async function processSceneVoiceover(params: {
  scene: SceneDefinition;
  fps: number;
  voiceoversDir: string;
  audioFileRelPrefix: string;
  defaultVoiceId: string;
  modelId: string;
  force: boolean;
  useLiveApi: boolean;
}): Promise<SceneVoiceoverData> {
  const {
    scene,
    fps,
    voiceoversDir,
    audioFileRelPrefix,
    defaultVoiceId,
    modelId,
    force,
    useLiveApi,
  } = params;

  fs.mkdirSync(voiceoversDir, { recursive: true });

  const sceneVoiceId = scene.voiceId || defaultVoiceId;
  const fallbackDurationSec =
    typeof scene.durationInSeconds === 'number' &&
    Number.isFinite(scene.durationInSeconds) &&
    scene.durationInSeconds > 0
      ? scene.durationInSeconds
      : Math.max(
          2.5,
          Number(
            (
              scene.text.trim().split(/\s+/).filter(Boolean).length / 2.4 +
              0.6
            ).toFixed(2)
          )
        );
  const textHash = computeSceneCacheHash(scene);
  const mp3Path = path.join(voiceoversDir, `${scene.id}.mp3`);
  const jsonPath = path.join(voiceoversDir, `${scene.id}.json`);
  const cleanPrefix = audioFileRelPrefix.replace(/^\/+|\/+$/g, '');
  const audioFile = `${cleanPrefix}/${scene.id}.mp3`;

  // SHA-256 Cache Check
  if (!force && fs.existsSync(jsonPath) && fs.existsSync(mp3Path)) {
    try {
      const existing = JSON.parse(
        fs.readFileSync(jsonPath, 'utf8')
      ) as SceneVoiceoverData;

      if (
        existing.textHash === textHash &&
        existing.voiceId === sceneVoiceId &&
        (!useLiveApi || existing.provider === 'elevenlabs')
      ) {
        console.log(
          `  [CACHE HIT]  Scene "${scene.id}" (SHA-256: ${textHash.slice(0, 12)}…) — skipping.`
        );
        if (existing.audioFile !== audioFile) {
          const updated = { ...existing, audioFile };
          fs.writeFileSync(jsonPath, JSON.stringify(updated, null, 2), 'utf8');
          return updated;
        }
        return existing;
      }
    } catch {
      // Regenerate on invalid cache file
    }
  }

  if (useLiveApi) {
    console.log(
      `  [ELEVENLABS] Synthesizing voiceover + timestamps for "${scene.id}" (voice: ${sceneVoiceId}, effect: ${scene.voiceEffect ?? 'clean'})…`
    );
    const result = await synthesizeSceneVoiceoverViaSdk({
      voiceId: sceneVoiceId,
      modelId,
      text: scene.text,
      voiceSettings: scene.voiceSettings,
      previousText: scene.previousText,
      nextText: scene.nextText,
    });

    const audioBuffer = Buffer.from(result.audioBase64, 'base64');
    const rawMp3Path = `${mp3Path}.raw.mp3`;
    fs.writeFileSync(rawMp3Path, audioBuffer);

    const acousticFilter = getVoiceAcousticFilter(scene.voiceEffect);
    execFileSync(
      'ffmpeg',
      ['-y', '-i', rawMp3Path, '-af', acousticFilter, mp3Path],
      { stdio: 'ignore' }
    );
    fs.unlinkSync(rawMp3Path);

    const alignment = result.alignment;
    const words = alignment
      ? extractWordsFromAlignment(alignment, fps)
      : buildSyntheticWordTimestamps(scene.text, fallbackDurationSec, fps)
          .words;

    const lastWordEnd =
      words.length > 0 ? words[words.length - 1].end : fallbackDurationSec;

    const payload: SceneVoiceoverData = {
      sceneId: scene.id,
      text: scene.text,
      textHash,
      voiceId: sceneVoiceId,
      modelId,
      provider: 'elevenlabs',
      fps,
      durationInSeconds: Number(
        Math.max(fallbackDurationSec, lastWordEnd + 0.25).toFixed(2)
      ),
      audioFile,
      generatedAt: new Date().toISOString(),
      words,
      alignment,
    };

    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`  [SAVED]      ${audioFile} + .json (${words.length} words)`);
    return payload;
  }

  console.log(
    `  [FALLBACK]   Generating deterministic mock voiceover + word timestamps for "${scene.id}"…`
  );
  generateSyntheticMp3(mp3Path, fallbackDurationSec);
  const { words, alignment } = buildSyntheticWordTimestamps(
    scene.text,
    fallbackDurationSec,
    fps
  );

  const payload: SceneVoiceoverData = {
    sceneId: scene.id,
    text: scene.text,
    textHash,
    voiceId: sceneVoiceId,
    modelId,
    provider: 'synthetic-fallback',
    fps,
    durationInSeconds: fallbackDurationSec,
    audioFile,
    generatedAt: new Date().toISOString(),
    words,
    alignment,
  };

  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`  [SAVED]      ${audioFile} + .json (${words.length} words)`);
  return payload;
}

/**
 * Ensures `<studioDir>/public/_productions/<slug>` points cleanly to `../../productions/<slug>/assets`.
 */
export function ensureProductionPublicSymlink(
  studioDir: string,
  slug: string
): string {
  const assetsDir = path.join(studioDir, 'productions', slug, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  const publicProductionsDir = path.join(studioDir, 'public', '_productions');
  fs.mkdirSync(publicProductionsDir, { recursive: true });

  const linkPath = path.join(publicProductionsDir, slug);
  const relativeTarget = path.relative(publicProductionsDir, assetsDir);

  try {
    const stat = fs.lstatSync(linkPath);
    if (stat.isSymbolicLink()) {
      const existingTarget = fs.readlinkSync(linkPath);
      const resolvedExisting = path.resolve(publicProductionsDir, existingTarget);
      if (resolvedExisting === path.resolve(assetsDir)) {
        return linkPath;
      }
      fs.unlinkSync(linkPath);
    } else {
      return linkPath;
    }
  } catch {
    // linkPath does not exist yet
  }

  const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
  fs.symlinkSync(relativeTarget, linkPath, symlinkType);
  return linkPath;
}

function writeRootVoiceoverManifest(
  studioDir: string,
  records: Record<string, SceneVoiceoverData>
): void {
  const generatedDir = path.join(studioDir, 'src', 'generated');
  fs.mkdirSync(generatedDir, { recursive: true });
  const targetFile = path.join(generatedDir, 'voiceover-data.ts');

  const fileContents = `// AUTO-GENERATED BY make.pictures audio CLI — DO NOT EDIT MANUALLY
import type { SceneVoiceoverData } from '../types/scene';

export const VOICEOVER_MANIFEST: Record<string, SceneVoiceoverData> = ${JSON.stringify(
    records,
    null,
    2
  )};
`;

  fs.writeFileSync(targetFile, fileContents, 'utf8');
}

export function writeProductionAudioManifest(params: {
  productionDir: string;
  voiceovers: Record<string, SceneVoiceoverData>;
  music: GeneratedMusicMetadata | null;
  sfx: Record<string, GeneratedSfxMetadata>;
}): string {
  const generatedDir = path.join(params.productionDir, 'generated');
  fs.mkdirSync(generatedDir, { recursive: true });
  const targetFile = path.join(generatedDir, 'audio-manifest.ts');

  const fileContents = `// AUTO-GENERATED BY @make-pictures/cli — DO NOT EDIT MANUALLY
import type { SceneVoiceoverData } from '@make-pictures/core';

export interface ProductionMusicEntry {
  id: string;
  mode: 'prompt' | 'composition-plan' | 'procedural-fallback';
  provider: 'elevenlabs-music' | 'procedural-fallback';
  specHash: string;
  audioFile: string;
  durationInSeconds: number;
  moodPreset: string;
  generatedAt: string;
  songTitle?: string;
  genres?: string[];
}

export interface ProductionSfxEntry {
  id: string;
  prompt: string;
  provider: 'elevenlabs-sfx' | 'procedural-fallback';
  specHash: string;
  audioFile: string;
  durationSeconds: number;
  loop: boolean;
  generatedAt: string;
}

export const VOICEOVER_MANIFEST: Record<string, SceneVoiceoverData> = ${JSON.stringify(
    params.voiceovers,
    null,
    2
  )};

export const AUDIO_MANIFEST = VOICEOVER_MANIFEST;

export const MUSIC_MANIFEST: ProductionMusicEntry | null = ${JSON.stringify(
    params.music,
    null,
    2
  )};

export const SFX_MANIFEST: Record<string, ProductionSfxEntry> = ${JSON.stringify(
    params.sfx,
    null,
    2
  )};
`;

  fs.writeFileSync(targetFile, fileContents, 'utf8');
  return targetFile;
}

async function processProductionCapsule(params: {
  rootDir: string;
  studioDir: string;
  slug: string;
  defaultVoiceId: string;
  modelId: string;
  force: boolean;
  useLiveApi: boolean;
}): Promise<void> {
  const { rootDir, studioDir, slug, defaultVoiceId, modelId, force, useLiveApi } =
    params;
  const productionDir = path.join(studioDir, 'productions', slug);
  const manifestPath = path.join(productionDir, 'production.json');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Production manifest not found at ${path.relative(
        rootDir,
        manifestPath
      )}`
    );
  }

  console.log(`\n🎬 Production Capsule: "${slug}"`);
  ensureProductionPublicSymlink(studioDir, slug);

  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, 'utf8')
  ) as ProductionManifest;
  const fps = manifest.fps || 60;

  const assetsDir = path.join(productionDir, 'assets');
  const voiceoversDir = path.join(assetsDir, 'voiceovers');
  const musicDir = path.join(assetsDir, 'music');
  const sfxDir = path.join(assetsDir, 'sfx');

  const voiceovers: Record<string, SceneVoiceoverData> = {};
  let totalSceneSeconds = 0;

  for (const scene of manifest.scenes ?? []) {
    const vo = await processSceneVoiceover({
      scene,
      fps,
      voiceoversDir,
      audioFileRelPrefix: `_productions/${slug}/voiceovers`,
      defaultVoiceId,
      modelId,
      force,
      useLiveApi,
    });
    voiceovers[scene.id] = vo;
    totalSceneSeconds += vo.durationInSeconds;
  }

  let musicMeta: GeneratedMusicMetadata | null = null;
  if (manifest.score) {
    musicMeta = await generateMusicScore(manifest.score, {
      outputDir: musicDir,
      publicRelPrefix: `_productions/${slug}/music`,
      useLiveApi,
      force,
      fallbackDurationSeconds: Math.max(8, totalSceneSeconds + 1.5),
    });
  }

  const sfxRecords: Record<string, GeneratedSfxMetadata> = {};
  for (const sfxSpec of manifest.sfx ?? []) {
    const sfxMeta = await generateSfxAsset(sfxSpec, {
      outputDir: sfxDir,
      publicRelPrefix: `_productions/${slug}/sfx`,
      useLiveApi,
      force,
    });
    sfxRecords[sfxSpec.id] = sfxMeta;
  }

  const manifestOut = writeProductionAudioManifest({
    productionDir,
    voiceovers,
    music: musicMeta,
    sfx: sfxRecords,
  });
  console.log(
    `  ✨ Updated capsule manifest: ${path.relative(rootDir, manifestOut)}`
  );
}

function discoverProductionSlugs(studioDir: string): string[] {
  const productionsRoot = path.join(studioDir, 'productions');
  if (!fs.existsSync(productionsRoot)) {
    return [];
  }

  const entries = fs.readdirSync(productionsRoot, { withFileTypes: true });
  const slugs: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const manifestFile = path.join(
      productionsRoot,
      entry.name,
      'production.json'
    );
    if (fs.existsSync(manifestFile)) {
      slugs.push(entry.name);
    }
  }
  return slugs.sort();
}

/**
 * Unified AI Audio Studio build command:
 * - With `--production=<slug>`: builds voiceovers + score + SFX for that isolated capsule.
 * - Without `--production`: builds root `scenes.json` (if present) + all `<studioDir>/productions/*` capsules.
 */
export async function runAudioCommand(
  options: AudioCommandOptions = {}
): Promise<void> {
  const { rootDir, studioDir } = resolveWorkspaceContext({
    cwd: options.cwd ?? options.rootDir,
    dir: options.dir,
  });

  dotenv.config({ path: path.join(rootDir, '.env.local') });
  dotenv.config({ path: path.join(rootDir, '.env') });

  const force = Boolean(options.force);
  const mock = Boolean(options.mock);
  const hasKey = hasActiveElevenLabsApiKey();
  const useLiveApi = hasKey && !mock;

  const defaultVoiceId =
    process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_MODEL_ID;

  console.log('==============================================================');
  console.log(' 🎙️  make.pictures — Unified AI Audio Studio (TTS • Music • SFX)');
  console.log('==============================================================');

  if (!useLiveApi) {
    console.log(
      'ℹ️  Running in deterministic local mode (--mock or no ELEVENLABS_API_KEY).'
    );
  } else {
    console.log(
      `✅ Live ElevenLabs API active | Default Voice: ${defaultVoiceId} | Model: ${modelId}`
    );
  }

  if (options.productionSlug) {
    await processProductionCapsule({
      rootDir,
      studioDir,
      slug: options.productionSlug,
      defaultVoiceId,
      modelId,
      force,
      useLiveApi,
    });
    console.log('\n✅ Production audio pipeline complete!');
    return;
  }

  // Root `scenes.json` + baseline assets (only when `scenes.json` exists, e.g. engine monorepo)
  const scenesPath = path.join(studioDir, 'scenes.json');
  if (fs.existsSync(scenesPath)) {
    ensureBaselineStudioAssets(studioDir);
    console.log('\n📦 Root Studio Scenes (scenes.json)');
    const manifest = JSON.parse(
      fs.readFileSync(scenesPath, 'utf8')
    ) as ScenesManifest;
    const fps = manifest.project?.fps || 60;
    const voiceoversDir = path.join(studioDir, 'public', 'voiceovers');

    const rootVoiceovers: Record<string, SceneVoiceoverData> = {};
    for (const scene of manifest.scenes ?? []) {
      const data = await processSceneVoiceover({
        scene,
        fps,
        voiceoversDir,
        audioFileRelPrefix: 'voiceovers',
        defaultVoiceId,
        modelId,
        force,
        useLiveApi,
      });
      rootVoiceovers[scene.id] = data;
    }

    writeRootVoiceoverManifest(studioDir, rootVoiceovers);
    console.log('  ✨ Updated src/generated/voiceover-data.ts');
  }

  // Process all isolated capsules in `<studioDir>/productions/*`
  const slugs = discoverProductionSlugs(studioDir);
  for (const slug of slugs) {
    await processProductionCapsule({
      rootDir,
      studioDir,
      slug,
      defaultVoiceId,
      modelId,
      force,
      useLiveApi,
    });
  }

  console.log('\n✅ Audio Studio pipeline complete!');
}

export async function runMusicShortcutCommand(params: {
  rootDir?: string;
  cwd?: string;
  dir?: string;
  productionSlug?: string;
  id?: string;
  prompt?: string;
  moodPreset?: MusicMoodPreset;
  durationSeconds?: number;
  mode?: MusicScoreSpec['mode'];
  mock?: boolean;
  force?: boolean;
}): Promise<void> {
  const { rootDir, studioDir } = resolveWorkspaceContext({
    cwd: params.cwd ?? params.rootDir,
    dir: params.dir,
  });
  dotenv.config({ path: path.join(rootDir, '.env.local') });
  const useLiveApi = hasActiveElevenLabsApiKey() && !params.mock;

  if (params.productionSlug) {
    const productionDir = path.join(
      studioDir,
      'productions',
      params.productionSlug
    );
    const manifestPath = path.join(productionDir, 'production.json');
    if (fs.existsSync(manifestPath)) {
      ensureProductionPublicSymlink(studioDir, params.productionSlug);
      const manifest = JSON.parse(
        fs.readFileSync(manifestPath, 'utf8')
      ) as ProductionManifest;
      const spec: MusicScoreSpec = manifest.score ?? {
        id: params.id || 'main-score',
        mode: params.mode ?? 'prompt',
        prompt: params.prompt,
        moodPreset: params.moodPreset ?? 'ambient-tech',
        durationSeconds: params.durationSeconds ?? 16,
        forceInstrumental: true,
      };
      await generateMusicScore(spec, {
        outputDir: path.join(productionDir, 'assets', 'music'),
        publicRelPrefix: `_productions/${params.productionSlug}/music`,
        useLiveApi,
        force: params.force,
      });
      return;
    }
  }

  const scoreId = params.id || 'studio-score';
  await generateMusicScore(
    {
      id: scoreId,
      mode: params.mode ?? (params.prompt ? 'prompt' : 'procedural-fallback'),
      prompt: params.prompt,
      moodPreset: params.moodPreset ?? 'ambient-tech',
      durationSeconds: params.durationSeconds ?? 16,
      forceInstrumental: true,
    },
    {
      outputDir: path.join(studioDir, 'public', 'music'),
      publicRelPrefix: 'music',
      useLiveApi,
      force: params.force,
    }
  );
}

export async function runSfxShortcutCommand(params: {
  rootDir?: string;
  cwd?: string;
  dir?: string;
  productionSlug?: string;
  id?: string;
  prompt?: string;
  fallbackPreset?: SfxFallbackPreset;
  durationSeconds?: number;
  loop?: boolean;
  mock?: boolean;
  force?: boolean;
}): Promise<void> {
  const { rootDir, studioDir } = resolveWorkspaceContext({
    cwd: params.cwd ?? params.rootDir,
    dir: params.dir,
  });
  dotenv.config({ path: path.join(rootDir, '.env.local') });
  const useLiveApi = hasActiveElevenLabsApiKey() && !params.mock;

  if (params.productionSlug && !params.prompt) {
    const productionDir = path.join(
      studioDir,
      'productions',
      params.productionSlug
    );
    const manifestPath = path.join(productionDir, 'production.json');
    if (fs.existsSync(manifestPath)) {
      ensureProductionPublicSymlink(studioDir, params.productionSlug);
      const manifest = JSON.parse(
        fs.readFileSync(manifestPath, 'utf8')
      ) as ProductionManifest;
      for (const spec of manifest.sfx ?? []) {
        await generateSfxAsset(spec, {
          outputDir: path.join(productionDir, 'assets', 'sfx'),
          publicRelPrefix: `_productions/${params.productionSlug}/sfx`,
          useLiveApi,
          force: params.force,
        });
      }
      return;
    }
  }

  if (!params.prompt && !params.fallbackPreset) {
    ensureBaselineStudioAssets(studioDir);
    return;
  }

  const spec: SfxAssetSpec = {
    id: params.id || params.fallbackPreset || 'custom-sfx',
    prompt:
      params.prompt || `Clean studio ${params.fallbackPreset ?? 'pop'} sound effect`,
    durationSeconds: params.durationSeconds,
    loop: params.loop,
    fallbackPreset: params.fallbackPreset,
  };

  const outDir = params.productionSlug
    ? path.join(
        studioDir,
        'productions',
        params.productionSlug,
        'assets',
        'sfx'
      )
    : path.join(studioDir, 'public', 'sfx');
  const relPrefix = params.productionSlug
    ? `_productions/${params.productionSlug}/sfx`
    : 'sfx';

  if (params.productionSlug) {
    ensureProductionPublicSymlink(studioDir, params.productionSlug);
  }

  await generateSfxAsset(spec, {
    outputDir: outDir,
    publicRelPrefix: relPrefix,
    useLiveApi,
    force: params.force,
  });
}
