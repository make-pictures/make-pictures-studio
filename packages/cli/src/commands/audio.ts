import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import type {
  AudioManifestFile,
  AudioSceneSpec,
  CharacterAlignment,
  DialogueInputTurn,
  DialogueVoiceSegment,
  MusicMoodPreset,
  MusicScoreSpec,
  SceneVoiceoverData,
  SfxAssetSpec,
  SfxFallbackPreset,
  VoiceAcousticPreset,
  VoiceSettingsConfig,
  WordTimestamp,
} from '@make-pictures/remotion/types';
import {
  DEFAULT_ELEVENLABS_MODEL_ID,
  getDefaultVoiceIdForLang,
  getRecommendedVoiceSettings,
  snapStabilityForElevenLabsModel,
  supportsLanguageCodeParam,
} from '@make-pictures/remotion/audio/voices';
import {
  generateMusicScore,
  type GeneratedMusicMetadata,
} from '../audio/generate-music';
import {
  ensureBaselineStudioAssets,
  generateSfxAsset,
  type GeneratedSfxMetadata,
} from '../audio/generate-sfx';
import {
  lintManifestVoiceovers,
  stripElevenLabsV3Tags,
} from '../audio/phonetics-lint';
import {
  assertFfmpegInstalled,
  loadMakePicturesConfig,
  resolveWorkspaceContext,
} from './workspace-paths';
import { assertSafeIdSegment } from '../utils/cli-helpers';

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

const DEFAULT_VOICE_ID = getDefaultVoiceIdForLang('en');
const DEFAULT_MODEL_ID = DEFAULT_ELEVENLABS_MODEL_ID;

export interface AudioCommandOptions {
  rootDir?: string;
  cwd?: string;
  dir?: string;
  productionSlug?: string;
  manifestPath?: string;
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

export function assertElevenLabsApiKeyOrMock(mock: boolean): void {
  if (mock || hasActiveElevenLabsApiKey()) {
    return;
  }
  throw new Error(
    'ELEVENLABS_API_KEY is not configured.\n  • Connect ElevenLabs: npx make-pictures onboard\n  • Or generate deterministic offline mock audio: re-run with --mock'
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

export function isDialogueScene(
  scene: AudioSceneSpec
): scene is AudioSceneSpec & { dialogueInputs: DialogueInputTurn[] } {
  return Array.isArray(scene.dialogueInputs) && scene.dialogueInputs.length >= 2;
}

export function resolveEffectiveDialogueModelId(
  sceneModelId?: string,
  fallbackModelId?: string
): string {
  const explicit = sceneModelId?.trim();
  if (explicit) return explicit;
  const fallback = fallbackModelId?.trim();
  if (fallback && /^(?:eleven_v3|eleven_v4)/i.test(fallback)) {
    return fallback;
  }
  return 'eleven_v4';
}

export function computeSceneCacheHash(
  scene: AudioSceneSpec,
  options?: {
    effectiveLanguageCode?: string;
    effectiveVoiceSettings?: VoiceSettingsConfig;
  }
): string {
  const mergedVoiceSettings =
    options?.effectiveVoiceSettings ?? scene.voiceSettings;
  const baseKey = mergedVoiceSettings
    ? `${scene.text ?? ''}|${JSON.stringify(mergedVoiceSettings)}`
    : (scene.text ?? '');

  const extraParts: string[] = [];
  if (isDialogueScene(scene)) {
    extraParts.push(
      `dialogue:${JSON.stringify(
        scene.dialogueInputs.map((turn) => ({
          text: turn.text,
          voiceId: turn.voiceId.trim(),
          ...(turn.speaker ? { speaker: turn.speaker } : {}),
        }))
      )}`
    );
  }
  const acoustic = scene.acousticPreset ?? scene.voiceEffect;
  if (acoustic && acoustic !== 'clean') {
    extraParts.push(`fx:${acoustic}`);
  }
  if (scene.previousText) {
    extraParts.push(`prev:${scene.previousText}`);
  }
  if (scene.nextText) {
    extraParts.push(`next:${scene.nextText}`);
  }
  const explicitLang =
    options?.effectiveLanguageCode?.trim() || scene.languageCode?.trim();
  if (explicitLang) {
    extraParts.push(`lang:${explicitLang.toLowerCase()}`);
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
 * When `segmentBoundaries` is provided (from Text-to-Dialogue `voiceSegments`),
 * flushes words cleanly across speaker turn boundaries even if no whitespace separates them.
 */
export function extractWordsFromAlignment(
  alignment: CharacterAlignment,
  fps: number,
  segmentBoundaries?: ReadonlyArray<number>
): WordTimestamp[] {
  const {
    characters,
    character_start_times_seconds: starts,
    character_end_times_seconds: ends,
  } = alignment;

  const boundarySet =
    segmentBoundaries && segmentBoundaries.length > 0
      ? new Set(segmentBoundaries.filter((idx) => idx > 0))
      : null;

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
    if (boundarySet?.has(i)) {
      flushWord();
    }
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
  const spokenText = stripElevenLabsV3Tags(text);
  const rawTokens = spokenText
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

/**
 * Builds deterministic proportional multi-speaker `voiceSegments`, `words`, and
 * `alignment` for Text-to-Dialogue scenes when running in `--mock` / offline mode.
 */
export function buildSyntheticDialogueTimestamps(
  dialogueInputs: ReadonlyArray<DialogueInputTurn>,
  durationInSeconds: number,
  fps: number
): {
  words: WordTimestamp[];
  alignment: CharacterAlignment;
  voiceSegments: DialogueVoiceSegment[];
} {
  const safeDuration = Math.max(1.0, durationInSeconds);
  const leadInSec = Math.min(0.24, safeDuration * 0.08);
  const tailOutSec = Math.min(0.4, safeDuration * 0.12);
  const turnCount = Math.max(1, dialogueInputs.length);
  const gapCount = Math.max(0, turnCount - 1);
  const interTurnGapSec =
    gapCount > 0
      ? Math.min(
          0.22,
          Math.max(
            0.05,
            (safeDuration - leadInSec - tailOutSec) / (turnCount * 6)
          )
        )
      : 0;
  const usableSpeechSec = Math.max(
    0.5,
    safeDuration - leadInSec - tailOutSec - interTurnGapSec * gapCount
  );

  const parsedTurns = dialogueInputs.map((turn) => {
    const spokenText = stripElevenLabsV3Tags(turn.text);
    const tokens = spokenText.trim().split(/\s+/).filter(Boolean);
    const tokenWeights = tokens.map((token) => {
      const base = Math.max(3, token.length);
      const pauseBonus = /[.,!?;:]$/.test(token) ? 3.5 : 0.8;
      return base + pauseBonus;
    });
    const turnWeight = Math.max(
      4,
      tokenWeights.reduce((acc, w) => acc + w, 0)
    );
    return { turn, tokens, tokenWeights, turnWeight };
  });

  const totalWeight =
    parsedTurns.reduce((acc, t) => acc + t.turnWeight, 0) || 1;

  const words: WordTimestamp[] = [];
  const characters: string[] = [];
  const character_start_times_seconds: number[] = [];
  const character_end_times_seconds: number[] = [];
  const voiceSegments: DialogueVoiceSegment[] = [];

  let cursor = leadInSec;

  parsedTurns.forEach(({ turn, tokens, tokenWeights, turnWeight }, turnIdx) => {
    const turnDuration = (turnWeight / totalWeight) * usableSpeechSec;
    const turnStart = Number(cursor.toFixed(4));
    const turnEnd = Number((cursor + turnDuration).toFixed(4));
    const characterStartIndex = characters.length;

    const localTotalWeight =
      tokenWeights.reduce((acc, w) => acc + w, 0) || 1;
    let wordCursor = turnStart;

    tokens.forEach((token, tokenIdx) => {
      const slotDuration = (tokenWeights[tokenIdx] / localTotalWeight) * turnDuration;
      const pauseFraction = /[.,!?;:]$/.test(token) ? 0.2 : 0.08;
      const speakDuration = Math.max(0.04, slotDuration * (1 - pauseFraction));
      const startSec = Number(wordCursor.toFixed(4));
      const endSec = Number(
        Math.min(turnEnd, wordCursor + speakDuration).toFixed(4)
      );

      words.push({
        word: token,
        normalizedWord: normalizeWord(token),
        start: startSec,
        end: Math.max(endSec, Number((startSec + 0.04).toFixed(4))),
        startFrame: Math.round(startSec * fps),
        endFrame: Math.round(
          Math.max(endSec, Number((startSec + 0.04).toFixed(4))) * fps
        ),
      });

      const chars = Array.from(token);
      const charStep = Math.max(0.005, (endSec - startSec) / Math.max(1, chars.length));
      chars.forEach((ch, cIdx) => {
        const cStart = Number((startSec + cIdx * charStep).toFixed(4));
        const cEnd = Number((cStart + charStep).toFixed(4));
        characters.push(ch);
        character_start_times_seconds.push(cStart);
        character_end_times_seconds.push(cEnd);
      });

      if (tokenIdx < tokens.length - 1) {
        characters.push(' ');
        character_start_times_seconds.push(endSec);
        character_end_times_seconds.push(
          Number(Math.min(turnEnd, wordCursor + slotDuration).toFixed(4))
        );
      }

      wordCursor += slotDuration;
    });

    const characterEndIndex = characters.length;
    voiceSegments.push({
      voiceId: turn.voiceId.trim(),
      ...(turn.speaker ? { speaker: turn.speaker } : {}),
      dialogueInputIndex: turnIdx,
      startTimeSeconds: turnStart,
      endTimeSeconds: turnEnd,
      characterStartIndex,
      characterEndIndex,
    });

    if (turnIdx < parsedTurns.length - 1) {
      const nextTurnStart = Number((turnEnd + interTurnGapSec).toFixed(4));
      characters.push(' ');
      character_start_times_seconds.push(turnEnd);
      character_end_times_seconds.push(nextTurnStart);
      cursor = nextTurnStart;
    } else {
      cursor = turnEnd;
    }
  });

  return {
    words,
    alignment: {
      characters,
      character_start_times_seconds,
      character_end_times_seconds,
    },
    voiceSegments,
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
  languageCode?: string;
  text: string;
  voiceSettings?: VoiceSettingsConfig;
  previousText?: string;
  nextText?: string;
}): Promise<{ audioBase64: string; alignment?: CharacterAlignment }> {
  const {
    voiceId,
    modelId,
    languageCode,
    text,
    voiceSettings,
    previousText,
    nextText,
  } = params;

  const defaultSettings = getRecommendedVoiceSettings(voiceId, modelId);
  const effectiveVoiceSettings: VoiceSettingsConfig = {
    ...defaultSettings,
    ...voiceSettings,
  };
  if (typeof effectiveVoiceSettings.stability === 'number') {
    effectiveVoiceSettings.stability = snapStabilityForElevenLabsModel(
      effectiveVoiceSettings.stability,
      modelId
    );
  }
  const effectiveLanguageCode =
    languageCode && supportsLanguageCodeParam(modelId)
      ? languageCode.trim().toLowerCase()
      : undefined;

  const client = getElevenLabsClient();
  const response = await client.textToSpeech.convertWithTimestamps(voiceId, {
    text,
    modelId,
    ...(effectiveLanguageCode ? { languageCode: effectiveLanguageCode } : {}),
    ...(previousText ? { previousText } : {}),
    ...(nextText ? { nextText } : {}),
    voiceSettings: effectiveVoiceSettings,
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

export interface TextToDialogueClientLike {
  textToDialogue: {
    convertWithTimestamps: ElevenLabsClient['textToDialogue']['convertWithTimestamps'];
  };
}

export async function synthesizeSceneDialogueViaSdk(params: {
  dialogueInputs: ReadonlyArray<DialogueInputTurn>;
  modelId: string;
  languageCode?: string;
  voiceSettings?: VoiceSettingsConfig;
  previousText?: string;
  nextText?: string;
  client?: TextToDialogueClientLike;
}): Promise<{
  audioBase64: string;
  alignment?: CharacterAlignment;
  voiceSegments: DialogueVoiceSegment[];
}> {
  const {
    dialogueInputs,
    modelId,
    languageCode,
    voiceSettings,
    previousText,
    nextText,
  } = params;

  const firstVoiceId = dialogueInputs[0]?.voiceId?.trim();
  const defaultSettings = getRecommendedVoiceSettings(firstVoiceId, modelId);
  const rawStability =
    typeof voiceSettings?.stability === 'number'
      ? voiceSettings.stability
      : defaultSettings.stability;
  const snappedStability =
    typeof rawStability === 'number'
      ? snapStabilityForElevenLabsModel(rawStability, modelId)
      : 0.5;

  const effectiveLanguageCode =
    languageCode && supportsLanguageCodeParam(modelId)
      ? languageCode.trim().toLowerCase()
      : undefined;

  const client = params.client ?? getElevenLabsClient();
  const response = await client.textToDialogue.convertWithTimestamps({
    inputs: dialogueInputs.map((turn) => ({
      text: turn.text,
      voiceId: turn.voiceId.trim(),
    })),
    modelId,
    ...(effectiveLanguageCode ? { languageCode: effectiveLanguageCode } : {}),
    settings: {
      stability: snappedStability,
    },
    outputFormat: 'mp3_44100_128',
    ...(previousText ? { previousText: previousText.slice(0, 100) } : {}),
    ...(nextText ? { futureText: nextText.slice(0, 100) } : {}),
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

  const voiceSegments: DialogueVoiceSegment[] = (
    response.voiceSegments ?? []
  ).map((seg) => {
    const matchedInput = dialogueInputs[seg.dialogueInputIndex];
    return {
      voiceId: seg.voiceId,
      ...(matchedInput?.speaker ? { speaker: matchedInput.speaker } : {}),
      dialogueInputIndex: seg.dialogueInputIndex,
      startTimeSeconds: Number(seg.startTimeSeconds.toFixed(4)),
      endTimeSeconds: Number(seg.endTimeSeconds.toFixed(4)),
      characterStartIndex: seg.characterStartIndex,
      characterEndIndex: seg.characterEndIndex,
    };
  });

  return {
    audioBase64: response.audioBase64,
    alignment,
    voiceSegments,
  };
}

async function processSceneVoiceover(params: {
  scene: AudioSceneSpec;
  fps: number;
  voiceoversDir: string;
  audioFileRelPrefix: string;
  defaultVoiceId: string;
  modelId: string;
  defaultLanguageCode?: string;
  defaultVoiceSettings?: VoiceSettingsConfig;
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
    defaultLanguageCode,
    defaultVoiceSettings,
    force,
    useLiveApi,
  } = params;

  const safeSceneId = assertSafeIdSegment(scene.id, 'scene.id');
  fs.mkdirSync(voiceoversDir, { recursive: true });

  const isDialogue = isDialogueScene(scene);
  const effectiveText =
    scene.text?.trim() ||
    (isDialogue ? scene.dialogueInputs.map((t) => t.text).join(' ') : '');
  const sceneVoiceId =
    scene.voiceId?.trim() ||
    (isDialogue ? scene.dialogueInputs[0]?.voiceId?.trim() : undefined) ||
    defaultVoiceId;
  const effectiveModelId = isDialogue
    ? resolveEffectiveDialogueModelId(scene.modelId, modelId)
    : scene.modelId?.trim() || modelId;
  const rawLangCode =
    scene.languageCode?.trim() || defaultLanguageCode?.trim() || undefined;
  const effectiveLanguageCode =
    rawLangCode && supportsLanguageCodeParam(effectiveModelId)
      ? rawLangCode.toLowerCase()
      : undefined;
  const effectiveVoiceSettings: VoiceSettingsConfig | undefined =
    defaultVoiceSettings || scene.voiceSettings
      ? { ...defaultVoiceSettings, ...scene.voiceSettings }
      : undefined;
  const spokenWordCount = stripElevenLabsV3Tags(
    isDialogue
      ? scene.dialogueInputs.map((t) => t.text).join(' ')
      : effectiveText
  )
    .split(/\s+/)
    .filter(Boolean).length;
  const fallbackDurationSec =
    typeof scene.durationInSeconds === 'number' &&
    Number.isFinite(scene.durationInSeconds) &&
    scene.durationInSeconds > 0
      ? scene.durationInSeconds
      : Math.max(
          2.5,
          Number(
            (
              spokenWordCount / 2.4 +
              0.6 +
              (isDialogue ? (scene.dialogueInputs.length - 1) * 0.25 : 0)
            ).toFixed(2)
          )
        );
  const textHash = computeSceneCacheHash(scene, {
    effectiveLanguageCode,
    effectiveVoiceSettings,
  });
  const mp3Path = path.join(voiceoversDir, `${safeSceneId}.mp3`);
  const jsonPath = path.join(voiceoversDir, `${safeSceneId}.json`);
  const cleanPrefix = audioFileRelPrefix.replace(/^\/+|\/+$/g, '');
  const audioFile = `${cleanPrefix}/${safeSceneId}.mp3`;

  // SHA-256 Cache Check
  if (!force && fs.existsSync(jsonPath) && fs.existsSync(mp3Path)) {
    try {
      const existing = JSON.parse(
        fs.readFileSync(jsonPath, 'utf8')
      ) as SceneVoiceoverData;

      if (
        existing.textHash === textHash &&
        existing.voiceId === sceneVoiceId &&
        existing.modelId === effectiveModelId &&
        (!useLiveApi || existing.provider === 'elevenlabs') &&
        (!isDialogue ||
          (Array.isArray(existing.voiceSegments) &&
            existing.voiceSegments.length > 0))
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

  if (useLiveApi && isDialogue) {
    const turnSummary = scene.dialogueInputs
      .map((t) => t.speaker || t.voiceId.trim().slice(0, 8))
      .join(' ↔ ');
    console.log(
      `  [ELEVENLABS DIALOGUE] Synthesizing ${scene.dialogueInputs.length}-turn dialogue + timestamps for "${scene.id}" (${turnSummary}, model: ${effectiveModelId}${effectiveLanguageCode ? `, lang: ${effectiveLanguageCode}` : ''}, effect: ${scene.voiceEffect ?? 'clean'})…`
    );

    const result = await synthesizeSceneDialogueViaSdk({
      dialogueInputs: scene.dialogueInputs,
      modelId: effectiveModelId,
      languageCode: effectiveLanguageCode,
      voiceSettings: effectiveVoiceSettings,
      previousText: scene.previousText,
      nextText: scene.nextText,
    });

    const audioBuffer = Buffer.from(result.audioBase64, 'base64');
    const rawMp3Path = `${mp3Path}.raw.mp3`;
    fs.writeFileSync(rawMp3Path, audioBuffer);

    try {
      const acousticPreset = scene.acousticPreset ?? scene.voiceEffect;
      const acousticFilter = getVoiceAcousticFilter(acousticPreset);
      execFileSync(
        'ffmpeg',
        ['-y', '-i', rawMp3Path, '-af', acousticFilter, mp3Path],
        { stdio: 'ignore' }
      );
    } finally {
      if (fs.existsSync(rawMp3Path)) {
        try {
          fs.unlinkSync(rawMp3Path);
        } catch {
          // ignore cleanup error
        }
      }
    }

    const alignment = result.alignment;
    const segmentStartIndices = result.voiceSegments
      .map((s) => s.characterStartIndex)
      .filter((idx): idx is number => typeof idx === 'number' && idx > 0);
    const words = alignment
      ? extractWordsFromAlignment(alignment, fps, segmentStartIndices)
      : buildSyntheticDialogueTimestamps(
          scene.dialogueInputs,
          fallbackDurationSec,
          fps
        ).words;

    const lastWordEnd =
      words.length > 0 ? words[words.length - 1].end : fallbackDurationSec;
    const lastSegmentEnd =
      result.voiceSegments.length > 0
        ? Math.max(...result.voiceSegments.map((s) => s.endTimeSeconds))
        : 0;
    const speechEnd = Math.max(lastWordEnd, lastSegmentEnd);

    const payload: SceneVoiceoverData = {
      sceneId: scene.id,
      text: effectiveText,
      textHash,
      voiceId: sceneVoiceId,
      modelId: effectiveModelId,
      provider: 'elevenlabs',
      fps,
      durationInSeconds: Number(
        Math.max(fallbackDurationSec, speechEnd + 0.25).toFixed(2)
      ),
      audioFile,
      generatedAt: new Date().toISOString(),
      words,
      alignment,
      voiceSegments: result.voiceSegments,
    };

    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(
      `  [SAVED]      ${audioFile} + .json (${words.length} words, ${result.voiceSegments.length} dialogue segments)`
    );
    return payload;
  }

  if (useLiveApi) {
    console.log(
      `  [ELEVENLABS] Synthesizing voiceover + timestamps for "${scene.id}" (voice: ${sceneVoiceId}, model: ${effectiveModelId}${effectiveLanguageCode ? `, lang: ${effectiveLanguageCode}` : ''}, effect: ${scene.voiceEffect ?? 'clean'})…`
    );
    const result = await synthesizeSceneVoiceoverViaSdk({
      voiceId: sceneVoiceId,
      modelId: effectiveModelId,
      languageCode: effectiveLanguageCode,
      text: effectiveText,
      voiceSettings: effectiveVoiceSettings,
      previousText: scene.previousText,
      nextText: scene.nextText,
    });

    const audioBuffer = Buffer.from(result.audioBase64, 'base64');
    const rawMp3Path = `${mp3Path}.raw.mp3`;
    fs.writeFileSync(rawMp3Path, audioBuffer);

    try {
      const acousticPreset = scene.acousticPreset ?? scene.voiceEffect;
      const acousticFilter = getVoiceAcousticFilter(acousticPreset);
      execFileSync(
        'ffmpeg',
        ['-y', '-i', rawMp3Path, '-af', acousticFilter, mp3Path],
        { stdio: 'ignore' }
      );
    } finally {
      if (fs.existsSync(rawMp3Path)) {
        try {
          fs.unlinkSync(rawMp3Path);
        } catch {
          // ignore cleanup error
        }
      }
    }

    const alignment = result.alignment;
    const words = alignment
      ? extractWordsFromAlignment(alignment, fps)
      : buildSyntheticWordTimestamps(effectiveText, fallbackDurationSec, fps)
          .words;

    const lastWordEnd =
      words.length > 0 ? words[words.length - 1].end : fallbackDurationSec;

    const payload: SceneVoiceoverData = {
      sceneId: scene.id,
      text: effectiveText,
      textHash,
      voiceId: sceneVoiceId,
      modelId: effectiveModelId,
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

  if (isDialogue) {
    console.log(
      `  [FALLBACK DIALOGUE] Generating deterministic mock ${scene.dialogueInputs.length}-turn dialogue + voiceSegments for "${scene.id}"…`
    );
    generateSyntheticMp3(mp3Path, fallbackDurationSec);
    const { words, alignment, voiceSegments } =
      buildSyntheticDialogueTimestamps(
        scene.dialogueInputs,
        fallbackDurationSec,
        fps
      );

    const payload: SceneVoiceoverData = {
      sceneId: scene.id,
      text: effectiveText,
      textHash,
      voiceId: sceneVoiceId,
      modelId: effectiveModelId,
      provider: 'synthetic-fallback',
      fps,
      durationInSeconds: fallbackDurationSec,
      audioFile,
      generatedAt: new Date().toISOString(),
      words,
      alignment,
      voiceSegments,
    };

    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(
      `  [SAVED]      ${audioFile} + .json (${words.length} words, ${voiceSegments.length} dialogue segments)`
    );
    return payload;
  }

  console.log(
    `  [FALLBACK]   Generating deterministic mock voiceover + word timestamps for "${scene.id}"…`
  );
  generateSyntheticMp3(mp3Path, fallbackDurationSec);
  const { words, alignment } = buildSyntheticWordTimestamps(
    effectiveText,
    fallbackDurationSec,
    fps
  );

  const payload: SceneVoiceoverData = {
    sceneId: scene.id,
    text: effectiveText,
    textHash,
    voiceId: sceneVoiceId,
    modelId: effectiveModelId,
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
import type { SceneVoiceoverData } from '@make-pictures/remotion/types';

export interface ProductionMusicEntry {
  id: string;
  mode: 'prompt' | 'composition-plan' | 'procedural-fallback';
  provider: 'elevenlabs-music' | 'procedural-fallback';
  specHash: string;
  audioFile: string;
  durationInSeconds: number;
  moodPreset: string;
  generatedAt: string;
  songTitle?: string | null;
  genres?: string[] | null;
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

interface DiscoveredAudioManifest {
  slug: string;
  videoDir: string;
  manifestPath: string;
}

function getAudioManifestSearchRoots(
  studioDir: string,
  videosDirRel: string
): string[] {
  return [
    path.resolve(studioDir, videosDirRel),
    path.join(studioDir, 'examples'),
    path.join(studioDir, 'productions'),
  ];
}

function parseAndValidateAudioManifest(
  manifestPath: string,
  displayPath: string
): AudioManifestFile {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    throw new Error(
      `Invalid JSON in ${displayPath}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(
      `Invalid audio manifest at ${displayPath}: expected a JSON object.`
    );
  }

  const obj = raw as Record<string, unknown>;
  if (obj.id !== undefined) {
    if (typeof obj.id !== 'string') {
      throw new Error(
        `Invalid "id" in ${displayPath}: expected a non-empty string.`
      );
    }
    assertSafeIdSegment(obj.id, 'manifest.id');
  }

  if (!Array.isArray(obj.scenes)) {
    throw new Error(
      `Invalid audio manifest at ${displayPath}: expected "scenes" to be an array.`
    );
  }

  for (let i = 0; i < obj.scenes.length; i++) {
    const scene = obj.scenes[i];
    if (!scene || typeof scene !== 'object' || Array.isArray(scene)) {
      throw new Error(
        `Invalid scene at scenes[${i}] in ${displayPath}: expected an object.`
      );
    }
    const s = scene as Record<string, unknown>;
    if (typeof s.id !== 'string') {
      throw new Error(
        `Invalid scene at scenes[${i}] in ${displayPath}: missing string "id".`
      );
    }
    assertSafeIdSegment(s.id, `scenes[${i}].id`);

    const hasDialogue =
      Array.isArray(s.dialogueInputs) && s.dialogueInputs.length >= 2;
    if (hasDialogue) {
      for (let t = 0; t < (s.dialogueInputs as unknown[]).length; t++) {
        const turn = (s.dialogueInputs as unknown[])[t];
        if (!turn || typeof turn !== 'object' || Array.isArray(turn)) {
          throw new Error(
            `Invalid dialogue turn scenes[${i}].dialogueInputs[${t}] in ${displayPath}: expected an object.`
          );
        }
        const turnObj = turn as Record<string, unknown>;
        if (typeof turnObj.text !== 'string' || !turnObj.text.trim()) {
          throw new Error(
            `Invalid dialogue turn scenes[${i}].dialogueInputs[${t}] in ${displayPath}: missing non-empty "text".`
          );
        }
        if (typeof turnObj.voiceId !== 'string' || !turnObj.voiceId.trim()) {
          throw new Error(
            `Invalid dialogue turn scenes[${i}].dialogueInputs[${t}] in ${displayPath}: missing non-empty "voiceId".`
          );
        }
      }
    } else if (typeof s.text !== 'string' || !s.text.trim()) {
      throw new Error(
        `Invalid scene "${s.id}" in ${displayPath}: expected non-empty "text" (or "dialogueInputs" with >= 2 turns).`
      );
    }
  }

  if (obj.score !== undefined) {
    if (!obj.score || typeof obj.score !== 'object' || Array.isArray(obj.score)) {
      throw new Error(
        `Invalid "score" in ${displayPath}: expected an object.`
      );
    }
    const scoreObj = obj.score as Record<string, unknown>;
    if (typeof scoreObj.id !== 'string') {
      throw new Error(
        `Invalid "score.id" in ${displayPath}: expected a non-empty string.`
      );
    }
    assertSafeIdSegment(scoreObj.id, 'score.id');
  }

  if (obj.sfx !== undefined) {
    if (!Array.isArray(obj.sfx)) {
      throw new Error(
        `Invalid "sfx" in ${displayPath}: expected an array.`
      );
    }
    for (let i = 0; i < obj.sfx.length; i++) {
      const item = obj.sfx[i];
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error(
          `Invalid sfx[${i}] in ${displayPath}: expected an object.`
        );
      }
      const sfxObj = item as Record<string, unknown>;
      if (typeof sfxObj.id !== 'string') {
        throw new Error(
          `Invalid sfx[${i}].id in ${displayPath}: expected a non-empty string.`
        );
      }
      assertSafeIdSegment(sfxObj.id, `sfx[${i}].id`);
      if (typeof sfxObj.prompt !== 'string') {
        throw new Error(
          `Invalid sfx[${i}].prompt in ${displayPath}: expected a string.`
        );
      }
    }
  }

  return obj as unknown as AudioManifestFile;
}

function resolveAudioManifestForSlug(
  studioDir: string,
  videosDirRel: string,
  slug: string
): DiscoveredAudioManifest | null {
  const safeSlug = assertSafeIdSegment(slug, 'production slug');
  const candidates = getAudioManifestSearchRoots(studioDir, videosDirRel).map(
    (root) => path.join(root, safeSlug, 'audio.json')
  );
  for (const manifestPath of candidates) {
    if (fs.existsSync(manifestPath)) {
      return {
        slug: safeSlug,
        videoDir: path.dirname(manifestPath),
        manifestPath,
      };
    }
  }
  return null;
}

export function discoverAudioManifests(
  studioDir: string,
  videosDirRel?: string
): DiscoveredAudioManifest[] {
  const config = loadMakePicturesConfig(studioDir);
  const effectiveVideosDir = videosDirRel ?? config.videosDir;
  const searchRoots = getAudioManifestSearchRoots(studioDir, effectiveVideosDir);

  const found: DiscoveredAudioManifest[] = [];
  const seenDirs = new Set<string>();

  for (const root of searchRoots) {
    if (!fs.existsSync(root)) continue;
    const entries = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const videoDir = path.join(root, entry.name);
      if (seenDirs.has(videoDir)) continue;
      const manifestPath = path.join(videoDir, 'audio.json');
      if (fs.existsSync(manifestPath)) {
        seenDirs.add(videoDir);
        found.push({
          slug: entry.name,
          videoDir,
          manifestPath,
        });
      }
    }
  }

  return found;
}

async function processAudioManifest(params: {
  rootDir: string;
  studioDir: string;
  publicDirRel: string;
  slug: string;
  videoDir: string;
  manifestPath: string;
  defaultVoiceId: string;
  modelId: string;
  force: boolean;
  useLiveApi: boolean;
}): Promise<void> {
  const {
    rootDir,
    studioDir,
    publicDirRel,
    slug,
    videoDir,
    manifestPath,
    defaultVoiceId,
    modelId,
    force,
    useLiveApi,
  } = params;

  const relManifest = path.relative(rootDir, manifestPath) || manifestPath;
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Audio manifest not found at ${relManifest}`);
  }

  const manifest = parseAndValidateAudioManifest(manifestPath, relManifest);
  const effectiveSlug = assertSafeIdSegment(
    manifest.id?.trim() || slug,
    'manifest.id'
  );
  console.log(`\n🎬 Audio Manifest: "${effectiveSlug}" (${relManifest})`);

  const fps = manifest.fps || 60;
  const hasExplicitEnvVoice = Boolean(process.env.ELEVENLABS_VOICE_ID?.trim());
  const defaultManifestVoiceId =
    manifest.voiceId?.trim() ||
    (hasExplicitEnvVoice
      ? defaultVoiceId
      : getDefaultVoiceIdForLang(manifest.lang));
  const manifestModelId = manifest.modelId?.trim() || modelId;
  const manifestLanguageCode =
    manifest.languageCode?.trim() || manifest.lang?.trim() || undefined;

  const phoneticsWarnings = lintManifestVoiceovers(manifest, {
    defaultVoiceId: defaultManifestVoiceId,
    defaultModelId: manifestModelId,
  });
  for (const warn of phoneticsWarnings) {
    console.warn(`  ⚠️  ${warn}`);
  }

  const publicAudioBase = path.resolve(
    studioDir,
    publicDirRel,
    'audio',
    effectiveSlug
  );
  const voiceoversDir = path.join(publicAudioBase, 'voiceovers');
  const musicDir = path.join(publicAudioBase, 'music');
  const sfxDir = path.join(publicAudioBase, 'sfx');

  const voiceovers: Record<string, SceneVoiceoverData> = {};
  let totalSceneSeconds = 0;

  for (const scene of manifest.scenes ?? []) {
    const vo = await processSceneVoiceover({
      scene,
      fps,
      voiceoversDir,
      audioFileRelPrefix: `audio/${effectiveSlug}/voiceovers`,
      defaultVoiceId: defaultManifestVoiceId,
      modelId: manifestModelId,
      defaultLanguageCode: manifestLanguageCode,
      defaultVoiceSettings: manifest.voiceSettings,
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
      publicRelPrefix: `audio/${effectiveSlug}/music`,
      useLiveApi,
      force,
      fallbackDurationSeconds: Math.max(8, totalSceneSeconds + 1.5),
    });
  }

  const sfxRecords: Record<string, GeneratedSfxMetadata> = {};
  for (const sfxSpec of manifest.sfx ?? []) {
    const sfxMeta = await generateSfxAsset(sfxSpec, {
      outputDir: sfxDir,
      publicRelPrefix: `audio/${effectiveSlug}/sfx`,
      useLiveApi,
      force,
    });
    sfxRecords[sfxSpec.id] = sfxMeta;
  }

  const manifestOut = writeProductionAudioManifest({
    productionDir: videoDir,
    voiceovers,
    music: musicMeta,
    sfx: sfxRecords,
  });
  console.log(
    `  ✨ Updated audio manifest: ${path.relative(rootDir, manifestOut)}`
  );
}

/**
 * Unified AI Audio Studio build command:
 * - Reads `audio.json` in `<videosDir>/<slug>/audio.json` (or explicit `--manifest=<path>`).
 * - Writes `.mp3` assets to `<publicDir>/audio/<slug>/` and generates `<videoDir>/generated/audio-manifest.ts`.
 * - Fails fast with clear actionable messages when `ELEVENLABS_API_KEY` (without `--mock`) or `ffmpeg` is missing.
 */
export async function runAudioCommand(
  options: AudioCommandOptions = {}
): Promise<void> {
  const { rootDir, studioDir } = resolveWorkspaceContext({
    cwd: options.cwd ?? options.rootDir,
    dir: options.dir,
  });
  const config = loadMakePicturesConfig(studioDir, rootDir);

  dotenv.config({ path: path.join(rootDir, '.env.local') });
  dotenv.config({ path: path.join(rootDir, '.env') });

  const force = Boolean(options.force);
  const mock = Boolean(options.mock);

  assertFfmpegInstalled('audio synthesis');
  assertElevenLabsApiKeyOrMock(mock);

  const useLiveApi = hasActiveElevenLabsApiKey() && !mock;
  const defaultVoiceId =
    process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_MODEL_ID;

  console.log('==============================================================');
  console.log(' 🎙️  make.pictures — Unified AI Audio Studio (TTS • Music • SFX)');
  console.log('==============================================================');

  if (!useLiveApi) {
    console.log('ℹ️  Running in deterministic offline mock mode (--mock).');
  } else {
    console.log(
      `✅ Live ElevenLabs API active | Default Voice: ${defaultVoiceId} | Model: ${modelId}`
    );
  }

  if (options.manifestPath) {
    const resolvedManifest = path.resolve(rootDir, options.manifestPath);
    if (!fs.existsSync(resolvedManifest)) {
      throw new Error(
        `Audio manifest not found: ${path.relative(rootDir, resolvedManifest)}`
      );
    }
    const videoDir = path.dirname(resolvedManifest);
    const slug = path.basename(videoDir);
    await processAudioManifest({
      rootDir,
      studioDir,
      publicDirRel: config.publicDir,
      slug,
      videoDir,
      manifestPath: resolvedManifest,
      defaultVoiceId,
      modelId,
      force,
      useLiveApi,
    });
    console.log('\n✅ Audio pipeline complete!');
    return;
  }

  if (options.productionSlug) {
    const target = resolveAudioManifestForSlug(
      studioDir,
      config.videosDir,
      options.productionSlug
    );
    if (!target) {
      throw new Error(
        `Audio manifest not found for "${options.productionSlug}". Expected ${path.join(config.videosDir, options.productionSlug, 'audio.json')} (or pass --manifest=<path>).`
      );
    }
    await processAudioManifest({
      rootDir,
      studioDir,
      publicDirRel: config.publicDir,
      slug: target.slug,
      videoDir: target.videoDir,
      manifestPath: target.manifestPath,
      defaultVoiceId,
      modelId,
      force,
      useLiveApi,
    });
    console.log('\n✅ Audio pipeline complete!');
    return;
  }

  const manifests = discoverAudioManifests(studioDir, config.videosDir);
  if (manifests.length === 0) {
    console.log(
      `ℹ️  No audio.json manifests found in ${config.videosDir}/*/audio.json. Run \`npx make-pictures new <slug>\` or pass \`--manifest=<path>\`.`
    );
    return;
  }

  for (const target of manifests) {
    await processAudioManifest({
      rootDir,
      studioDir,
      publicDirRel: config.publicDir,
      slug: target.slug,
      videoDir: target.videoDir,
      manifestPath: target.manifestPath,
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
  const config = loadMakePicturesConfig(studioDir, rootDir);
  dotenv.config({ path: path.join(rootDir, '.env.local') });
  dotenv.config({ path: path.join(rootDir, '.env') });

  const mock = Boolean(params.mock);
  assertFfmpegInstalled('music generation');
  assertElevenLabsApiKeyOrMock(mock);
  const useLiveApi = hasActiveElevenLabsApiKey() && !mock;

  if (params.productionSlug) {
    const target = resolveAudioManifestForSlug(
      studioDir,
      config.videosDir,
      params.productionSlug
    );
    if (!target) {
      throw new Error(
        `Audio manifest not found for "${params.productionSlug}". Expected ${path.join(config.videosDir, params.productionSlug, 'audio.json')}.`
      );
    }
    const relManifest =
      path.relative(rootDir, target.manifestPath) || target.manifestPath;
    const manifest = parseAndValidateAudioManifest(
      target.manifestPath,
      relManifest
    );
    const slug = assertSafeIdSegment(
      manifest.id?.trim() || target.slug,
      'manifest.id'
    );
    const spec: MusicScoreSpec = manifest.score ?? {
      id: assertSafeIdSegment(params.id || 'main-score', 'score.id'),
      mode: params.mode ?? 'prompt',
      prompt: params.prompt,
      moodPreset: params.moodPreset ?? 'ambient-tech',
      durationSeconds: params.durationSeconds ?? 16,
      forceInstrumental: true,
    };
    await generateMusicScore(spec, {
      outputDir: path.resolve(studioDir, config.publicDir, 'audio', slug, 'music'),
      publicRelPrefix: `audio/${slug}/music`,
      useLiveApi,
      force: params.force,
    });
    return;
  }

  const scoreId = assertSafeIdSegment(params.id || 'studio-score', 'score.id');
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
      outputDir: path.resolve(studioDir, config.publicDir, 'music'),
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
  const config = loadMakePicturesConfig(studioDir, rootDir);
  dotenv.config({ path: path.join(rootDir, '.env.local') });
  dotenv.config({ path: path.join(rootDir, '.env') });

  const mock = Boolean(params.mock);
  assertFfmpegInstalled('SFX generation');
  assertElevenLabsApiKeyOrMock(mock);
  const useLiveApi = hasActiveElevenLabsApiKey() && !mock;

  if (params.productionSlug && !params.prompt) {
    const target = resolveAudioManifestForSlug(
      studioDir,
      config.videosDir,
      params.productionSlug
    );
    if (!target) {
      throw new Error(
        `Audio manifest not found for "${params.productionSlug}". Expected ${path.join(config.videosDir, params.productionSlug, 'audio.json')}.`
      );
    }
    const relManifest =
      path.relative(rootDir, target.manifestPath) || target.manifestPath;
    const manifest = parseAndValidateAudioManifest(
      target.manifestPath,
      relManifest
    );
    const slug = assertSafeIdSegment(
      manifest.id?.trim() || target.slug,
      'manifest.id'
    );
    for (const spec of manifest.sfx ?? []) {
      await generateSfxAsset(spec, {
        outputDir: path.resolve(studioDir, config.publicDir, 'audio', slug, 'sfx'),
        publicRelPrefix: `audio/${slug}/sfx`,
        useLiveApi,
        force: params.force,
      });
    }
    return;
  }

  if (!params.prompt && !params.fallbackPreset) {
    ensureBaselineStudioAssets(studioDir);
    return;
  }

  const safeProdSlug = params.productionSlug
    ? assertSafeIdSegment(params.productionSlug, 'production slug')
    : undefined;
  const spec: SfxAssetSpec = {
    id: assertSafeIdSegment(
      params.id || params.fallbackPreset || 'custom-sfx',
      'spec.id'
    ),
    prompt:
      params.prompt || `Clean studio ${params.fallbackPreset ?? 'pop'} sound effect`,
    durationSeconds: params.durationSeconds,
    loop: params.loop,
    fallbackPreset: params.fallbackPreset,
  };

  const outDir = safeProdSlug
    ? path.resolve(
        studioDir,
        config.publicDir,
        'audio',
        safeProdSlug,
        'sfx'
      )
    : path.resolve(studioDir, config.publicDir, 'sfx');
  const relPrefix = safeProdSlug ? `audio/${safeProdSlug}/sfx` : 'sfx';

  await generateSfxAsset(spec, {
    outputDir: outDir,
    publicRelPrefix: relPrefix,
    useLiveApi,
    force: params.force,
  });
}
