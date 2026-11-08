import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import dotenv from 'dotenv';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import type {
  CharacterAlignment,
  SceneDefinition,
  ScenesManifest,
  SceneVoiceoverData,
  VoiceSettingsConfig,
  WordTimestamp,
} from '../src/types/scene';

// Load .env.local first, then .env as fallback
dotenv.config({ path: '.env.local' });
dotenv.config();

const ROOT_DIR = process.cwd();
const SCENES_PATH = path.join(ROOT_DIR, 'scenes.json');
const VOICEOVERS_DIR = path.join(ROOT_DIR, 'public', 'voiceovers');
const RECORDINGS_DIR = path.join(ROOT_DIR, 'public', 'recordings');
const SFX_DIR = path.join(ROOT_DIR, 'public', 'sfx');
const GENERATED_DIR = path.join(ROOT_DIR, 'src', 'generated');

const DEFAULT_VOICE_ID = 'TX3LPaxmHKxFdv7VOQHJ';
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2';

function getElevenLabsClient(): ElevenLabsClient {
  return new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY?.trim() || 'offline-fallback-key',
  });
}

/**
 * Computes SHA-256 hash of a scene's narration text.
 */
export function computeTextHash(text: string): string {
  return crypto.createHash('sha256').update(text.trim(), 'utf8').digest('hex');
}

/**
 * Normalizes a word token (strips punctuation, lowercases) for easy matching.
 */
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
 * Builds deterministic word timestamps when running in offline/fallback mode.
 */
function buildSyntheticWordTimestamps(
  text: string,
  durationInSeconds: number,
  fps: number
): { words: WordTimestamp[]; alignment: CharacterAlignment } {
  const rawTokens = text
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const leadInSec = 0.28;
  const tailOutSec = 0.45;
  const usableDuration = Math.max(
    1.2,
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

function generateSyntheticMp3(outputPath: string, durationInSeconds: number) {
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `anullsrc=r=44100:cl=stereo`,
      '-t',
      String(durationInSeconds),
      '-q:a',
      '9',
      '-acodec',
      'libmp3lame',
      outputPath,
    ],
    { stdio: 'ignore' }
  );
}

function ensureStudioAssets() {
  fs.mkdirSync(SFX_DIR, { recursive: true });
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

  const sfxSpecs: Array<{ file: string; filter: string; duration: string }> = [
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
      filter:
        'aevalsrc=0.14*sin(2*PI*1100*t)*exp(-35*t):s=44100:d=0.07',
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

  for (const sfx of sfxSpecs) {
    const targetPath = path.join(SFX_DIR, sfx.file);
    if (!fs.existsSync(targetPath)) {
      execFileSync(
        'ffmpeg',
        ['-y', '-f', 'lavfi', '-i', sfx.filter, '-t', sfx.duration, targetPath],
        { stdio: 'ignore' }
      );
      console.log(`  [SFX] Wygenerowano zasób dźwiękowy: public/sfx/${sfx.file}`);
    }
  }

  const sampleVideoPath = path.join(RECORDINGS_DIR, 'sample-ui.mp4');
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

async function generateSceneWithElevenLabsSdk(params: {
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
    nextText: nextText ?? 'Tak jest, natychmiast idziemy dalej.',
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

async function processScene(
  scene: SceneDefinition,
  fps: number,
  options: {
    voiceId: string;
    modelId: string;
    force: boolean;
    useLiveApi: boolean;
  }
): Promise<SceneVoiceoverData> {
  const sceneVoiceId = scene.voiceId || options.voiceId;
  const textHash = computeTextHash(
    scene.voiceSettings
      ? `${scene.text}|${JSON.stringify(scene.voiceSettings)}`
      : scene.text
  );
  const mp3Path = path.join(VOICEOVERS_DIR, `${scene.id}.mp3`);
  const jsonPath = path.join(VOICEOVERS_DIR, `${scene.id}.json`);

  // SHA-256 Cache Check
  if (!options.force && fs.existsSync(jsonPath) && fs.existsSync(mp3Path)) {
    try {
      const existing = JSON.parse(
        fs.readFileSync(jsonPath, 'utf8')
      ) as SceneVoiceoverData;

      if (
        existing.textHash === textHash &&
        existing.voiceId === sceneVoiceId
      ) {
        console.log(
          `  [CACHE HIT]  Scena "${scene.id}" (SHA-256: ${textHash.slice(
            0,
            12
          )}…) — pomijam generowanie.`
        );
        return existing;
      }
    } catch {
      // Regenerate on invalid cache file
    }
  }

  if (options.useLiveApi) {
    console.log(
      `  [ELEVENLABS] Generowanie audio + timestampów dla sceny "${scene.id}" (voice: ${sceneVoiceId}, model: ${options.modelId})…`
    );
    const result = await generateSceneWithElevenLabsSdk({
      voiceId: sceneVoiceId,
      modelId: options.modelId,
      text: scene.text,
      voiceSettings: scene.voiceSettings,
      previousText:
        scene.id === 'ev-s3-2b'
          ? 'Spojrzał na wynik i aż podskoczył w ogromnym szoku, krzycząc głośno z zachwytem:'
          : scene.id === 'ev-en-s3-2b'
          ? 'He stared at the result and leaped up in utter shock, shouting aloud in amazement:'
          : scene.id === 'ev-s3-4'
          ? 'Zerwał się na równe nogi i krzyknął z wielkim entuzjazmem:'
          : scene.id === 'ev-en-s3-4'
          ? 'He jumped to his feet and shouted with tremendous enthusiasm:'
          : undefined,
      nextText:
        scene.id === 'ev-s3-2b' || scene.id === 'ev-s3-4'
          ? '— wykrzyknął głośno i entuzjastycznie!'
          : scene.id === 'ev-en-s3-2b' || scene.id === 'ev-en-s3-4'
          ? '— he exclaimed loudly and enthusiastically!'
          : scene.id.startsWith('ev-en-') || scene.id === 'ev-btc-en'
          ? 'Indeed, we shall proceed immediately.'
          : undefined,
    });

    const audioBuffer = Buffer.from(result.audioBase64, 'base64');
    const rawMp3Path = `${mp3Path}.raw.mp3`;
    fs.writeFileSync(rawMp3Path, audioBuffer);
    const audioFilter =
      scene.id === 'ev-s5-3' || scene.id === 'ev-en-s5-3'
        ? 'highpass=f=230,lowpass=f=3100,aecho=0.85:0.75:16:0.22,volume=1.15,apad=pad_dur=0.25'
        : scene.id === 'ev-s3-2b' ||
          scene.id === 'ev-s3-4' ||
          scene.id === 'ev-en-s3-2b' ||
          scene.id === 'ev-en-s3-4'
        ? 'volume=1.32,apad=pad_dur=0.25'
        : 'apad=pad_dur=0.25';
    execFileSync(
      'ffmpeg',
      ['-y', '-i', rawMp3Path, '-af', audioFilter, mp3Path],
      { stdio: 'ignore' }
    );
    fs.unlinkSync(rawMp3Path);

    const alignment = result.alignment;
    const words = alignment
      ? extractWordsFromAlignment(alignment, fps)
      : buildSyntheticWordTimestamps(scene.text, scene.durationInSeconds, fps)
          .words;

    const lastWordEnd =
      words.length > 0 ? words[words.length - 1].end : scene.durationInSeconds;

    const payload: SceneVoiceoverData = {
      sceneId: scene.id,
      text: scene.text,
      textHash,
      voiceId: sceneVoiceId,
      modelId: options.modelId,
      provider: 'elevenlabs',
      fps,
      durationInSeconds: Number(
        Math.max(scene.durationInSeconds, lastWordEnd + 0.25).toFixed(2)
      ),
      audioFile: `voiceovers/${scene.id}.mp3`,
      generatedAt: new Date().toISOString(),
      words,
      alignment,
    };

    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(
      `  [SAVED]      public/voiceovers/${scene.id}.mp3 + .json (${words.length} słów)`
    );
    return payload;
  }

  // Fallback synthetic generation
  console.log(
    `  [FALLBACK]   Generowanie lokalnych timestampów i ścieżki .mp3 dla sceny "${scene.id}" (SHA-256: ${textHash.slice(
      0,
      12
    )}…)…`
  );
  generateSyntheticMp3(mp3Path, scene.durationInSeconds);
  const { words, alignment } = buildSyntheticWordTimestamps(
    scene.text,
    scene.durationInSeconds,
    fps
  );

  const payload: SceneVoiceoverData = {
    sceneId: scene.id,
    text: scene.text,
    textHash,
    voiceId: sceneVoiceId,
    modelId: options.modelId,
    provider: 'synthetic-fallback',
    fps,
    durationInSeconds: scene.durationInSeconds,
    audioFile: `voiceovers/${scene.id}.mp3`,
    generatedAt: new Date().toISOString(),
    words,
    alignment,
  };

  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(
    `  [SAVED]      public/voiceovers/${scene.id}.mp3 + .json (${words.length} słów)`
  );
  return payload;
}

function writeTypeScriptManifest(
  records: Record<string, SceneVoiceoverData>
): void {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  const targetFile = path.join(GENERATED_DIR, 'voiceover-data.ts');

  const fileContents = `// AUTO-GENERATED BY scripts/generate-voiceover.ts — DO NOT EDIT MANUALLY
import type { SceneVoiceoverData } from '../types/scene';

export const VOICEOVER_MANIFEST: Record<string, SceneVoiceoverData> = ${JSON.stringify(
    records,
    null,
    2
  )};
`;

  fs.writeFileSync(targetFile, fileContents, 'utf8');
}

async function main() {
  console.log('==============================================================');
  console.log(' 🎙️  make.pictures — Generator Lektora & Timestampów (SHA-256)');
  console.log('==============================================================');

  if (!fs.existsSync(SCENES_PATH)) {
    throw new Error(`Nie znaleziono pliku scenariusza: ${SCENES_PATH}`);
  }

  fs.mkdirSync(VOICEOVERS_DIR, { recursive: true });
  ensureStudioAssets();

  const manifest = JSON.parse(
    fs.readFileSync(SCENES_PATH, 'utf8')
  ) as ScenesManifest;

  const fps = manifest.project.fps || 60;
  const hasApiKey =
    Boolean(process.env.ELEVENLABS_API_KEY?.trim()) &&
    process.env.ELEVENLABS_API_KEY?.trim() !== 'your_elevenlabs_api_key_here';
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_MODEL_ID;
  const force = process.argv.includes('--force');
  const forceMock = process.argv.includes('--mock');

  const useLiveApi = hasApiKey && !forceMock;

  if (!useLiveApi) {
    console.log(
      'ℹ️  Brak aktywnego klucza ELEVENLABS_API_KEY (lub użyto --mock).'
    );
    console.log(
      '   Używam trybu deterministycznego (generowanie .mp3 + dokładnych timestampów słów .json).\n'
    );
  } else {
    console.log(
      `✅ Wykryto klucz ElevenLabs API | Voice ID: ${voiceId} | Model: ${modelId}\n`
    );
  }

  const allVoiceovers: Record<string, SceneVoiceoverData> = {};

  for (const scene of manifest.scenes) {
    const data = await processScene(scene, fps, {
      voiceId,
      modelId,
      force,
      useLiveApi,
    });
    allVoiceovers[scene.id] = data;
  }

  writeTypeScriptManifest(allVoiceovers);
  console.log(
    '\n✨ Zaktualizowano manifest TypeScript: src/generated/voiceover-data.ts'
  );
  console.log('✅ Gotowe!');
}

main().catch((err) => {
  console.error('❌ Błąd podczas generowania lektora:', err);
  process.exit(1);
});
