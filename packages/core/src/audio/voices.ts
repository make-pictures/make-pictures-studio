import type { VoiceArchetype } from '../style/schema';
import type { VoiceSettingsConfig } from '../types/scene';

export type VoiceLanguage = 'pl' | 'en';
export type VoiceGender = 'female' | 'male';

export interface CuratedVoiceProfile {
  voiceId: string;
  name: string;
  lang: VoiceLanguage;
  gender: VoiceGender;
  archetype: VoiceArchetype;
  role: string;
  description: string;
  recommendedSettings: VoiceSettingsConfig;
}

export interface ElevenLabsModelInfo {
  id: string;
  label: string;
  supportsLanguageCode: boolean;
  supportsTimestamps: boolean;
  notes: string;
}

export const DEFAULT_ELEVENLABS_MODEL_ID = 'eleven_multilingual_v2';

export const ELEVENLABS_TTS_MODELS: ReadonlyArray<ElevenLabsModelInfo> = [
  {
    id: 'eleven_multilingual_v2',
    label: 'Multilingual v2 (domyślny)',
    supportsLanguageCode: false,
    supportsTimestamps: true,
    notes:
      'Wysoka jakość i ciągłość prozodyczna previousText/nextText. Nie przyjmuje languageCode — kluczowy jest dobór natywnego głosu dla języka scenariusza.',
  },
  {
    id: 'eleven_v3',
    label: 'Eleven v3 (ekspresyjny)',
    supportsLanguageCode: true,
    supportsTimestamps: true,
    notes:
      'Nowa generacja z wysoką ekspresją i wsparciem wymuszania języka (languageCode).',
  },
  {
    id: 'eleven_turbo_v2_5',
    label: 'Turbo v2.5 (szybki + languageCode)',
    supportsLanguageCode: true,
    supportsTimestamps: true,
    notes:
      'Szybka synteza z obsługą ISO 639-1 languageCode (np. "pl") wymuszającą polską wymowę.',
  },
  {
    id: 'eleven_flash_v2_5',
    label: 'Flash v2.5 (ultra-szybki + languageCode)',
    supportsLanguageCode: true,
    supportsTimestamps: true,
    notes:
      'Najniższe opóźnienie i koszt kredytów z obsługą ISO 639-1 languageCode.',
  },
];

/**
 * Curated, verified native voices per language (`pl` & `en`).
 * All Polish entries are native `language: pl` voices (never English cross-lingual fallbacks)
 * with `free_users_allowed: true` and direct `voiceId` synthesis support.
 */
export const CURATED_VOICES: ReadonlyArray<CuratedVoiceProfile> = [
  // Native Polish (`language: pl`)
  {
    voiceId: 'C8ZVSJxcymeT86xT429O',
    name: 'Luiza',
    lang: 'pl',
    gender: 'female',
    archetype: 'storyteller-expressive',
    role: 'Ciepła narratorka / nauczycielka (PL)',
    description:
      'Natywny polski głos kobiecy — ciepły, naturalny akcent na złożonych liczebnikach, żywa intonacja edukacyjna i storytellingowa.',
    recommendedSettings: {
      stability: 0.48,
      similarityBoost: 0.8,
      style: 0.3,
      speed: 0.99,
      useSpeakerBoost: true,
    },
  },
  {
    voiceId: 'Bz1e1clEKwgN71Vx7cxj',
    name: 'Asia',
    lang: 'pl',
    gender: 'female',
    archetype: 'crisp-tech',
    role: 'Nowoczesna prezenterka / produkt (PL)',
    description:
      'Natywny polski głos kobiecy — czysty, przyjazny, lekko dynamiczny ton idealny do explainerów SaaS, produktów i tutoriali.',
    recommendedSettings: {
      stability: 0.45,
      similarityBoost: 0.8,
      style: 0.32,
      speed: 0.99,
      useSpeakerBoost: true,
    },
  },
  {
    voiceId: 'F9eb9uZYeJuHuO7Uvs1R',
    name: 'Arleta',
    lang: 'pl',
    gender: 'female',
    archetype: 'calm-editorial',
    role: 'Spokojna instruktorka / redakcja (PL)',
    description:
      'Natywny polski głos kobiecy — spokojna, wyraźna dykcja wykładowczyni do esejów, instrukcji i dokumentów redakcyjnych.',
    recommendedSettings: {
      stability: 0.56,
      similarityBoost: 0.82,
      style: 0.18,
      speed: 0.99,
      useSpeakerBoost: true,
    },
  },
  {
    voiceId: 'CLuTGacrAhcIhaJslbXt',
    name: 'Rafał',
    lang: 'pl',
    gender: 'male',
    archetype: 'documentary-warm',
    role: 'Spokojny lektor męski / dokument (PL)',
    description:
      'Natywny polski głos męski — naturalny, analityczny i ciepły ton do dokumentów, architektury i spokojnych prezentacji.',
    recommendedSettings: {
      stability: 0.58,
      similarityBoost: 0.8,
      style: 0.18,
      speed: 0.99,
      useSpeakerBoost: true,
    },
  },

  // Native English (`language: en`)
  {
    voiceId: 'TX3LPaxmHKxFdv7VOQHJ',
    name: 'Liam',
    lang: 'en',
    gender: 'male',
    archetype: 'crisp-tech',
    role: 'Dynamic Tech & Product Narrator (EN)',
    description:
      'Native English male voice — energetic modern product launches and tech explainers.',
    recommendedSettings: {
      stability: 0.35,
      similarityBoost: 0.78,
      style: 0.55,
      speed: 0.99,
      useSpeakerBoost: true,
    },
  },
  {
    voiceId: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Sarah',
    lang: 'en',
    gender: 'female',
    archetype: 'calm-editorial',
    role: 'Calm Editorial & Science Anchor (EN)',
    description:
      'Native English female voice — measured, clear magazine and science narration.',
    recommendedSettings: {
      stability: 0.54,
      similarityBoost: 0.8,
      style: 0.22,
      speed: 0.99,
      useSpeakerBoost: true,
    },
  },
  {
    voiceId: 'nPczCjzI2devNBz1zQrb',
    name: 'Brian',
    lang: 'en',
    gender: 'male',
    archetype: 'documentary-warm',
    role: 'Warm Documentary Authority (EN)',
    description:
      'Native English male voice — warm, resonant documentary and historical storytelling.',
    recommendedSettings: {
      stability: 0.58,
      similarityBoost: 0.8,
      style: 0.18,
      speed: 0.99,
      useSpeakerBoost: true,
    },
  },
  {
    voiceId: 'JBFqnCBsd6RMkjVDRZzb',
    name: 'George',
    lang: 'en',
    gender: 'male',
    archetype: 'storyteller-expressive',
    role: 'Expressive Storyteller (EN)',
    description:
      'Native English male voice — warm, expressive British storyteller cadence.',
    recommendedSettings: {
      stability: 0.5,
      similarityBoost: 0.8,
      style: 0.32,
      speed: 0.99,
      useSpeakerBoost: true,
    },
  },
];

export const VOICE_ARCHETYPE_TO_ELEVENLABS_ID_BY_LANG: Record<
  VoiceLanguage,
  Record<VoiceArchetype, string>
> = {
  pl: {
    'crisp-tech': 'Bz1e1clEKwgN71Vx7cxj', // Asia (native PL)
    'calm-editorial': 'F9eb9uZYeJuHuO7Uvs1R', // Arleta (native PL)
    'documentary-warm': 'CLuTGacrAhcIhaJslbXt', // Rafał (native PL)
    'storyteller-expressive': 'C8ZVSJxcymeT86xT429O', // Luiza (native PL)
  },
  en: {
    'crisp-tech': 'TX3LPaxmHKxFdv7VOQHJ', // Liam (native EN)
    'calm-editorial': 'EXAVITQu4vr4xnSDxMaL', // Sarah (native EN)
    'documentary-warm': 'nPczCjzI2devNBz1zQrb', // Brian (native EN)
    'storyteller-expressive': 'JBFqnCBsd6RMkjVDRZzb', // George (native EN)
  },
};

export const DEFAULT_VOICE_ID_BY_LANG: Record<VoiceLanguage, string> = {
  pl: 'C8ZVSJxcymeT86xT429O', // Luiza (native PL)
  en: 'TX3LPaxmHKxFdv7VOQHJ', // Liam (native EN)
};

/**
 * Known English-native premade ElevenLabs voices that speak Polish only via
 * cross-lingual transfer (often causing foreign accent & unnatural numeral stress).
 */
export const KNOWN_ENGLISH_PREMADE_VOICES: Readonly<Record<string, string>> = {
  TX3LPaxmHKxFdv7VOQHJ: 'Liam',
  EXAVITQu4vr4xnSDxMaL: 'Sarah',
  nPczCjzI2devNBz1zQrb: 'Brian',
  JBFqnCBsd6RMkjVDRZzb: 'George',
  onwK4e9ZLuTAKqWW03F9: 'Daniel',
  pNInz6obpgDQGcFmaJgB: 'Adam',
  N2lVS1w4EtoT3dr4eOWO: 'Callum',
  pqHfZKP75CvOlQylNhV4: 'Bill',
  Xb7hH8MSUJpSbSDYk0k2: 'Alice',
  pFZP5JQG7iQjIQuC4Bku: 'Lily',
  cgSgspJ2msm6clMCkdW9: 'Jessica',
  SAz9YHcvj6GT2YYXdXww: 'River',
  CwhRBWXzGAHq8TQ4Fs17: 'Roger',
  IKne3meq5aSn9XLyUdCD: 'Charlie',
  FGY2WhTYpPnrIDTdsKH5: 'Laura',
  cjVigY5qzO86Huf0OWal: 'Eric',
  iP95p4xoKVk53GoZ742B: 'Chris',
  bIHbv24MWmeRgasZH58o: 'Will',
  '21m00Tcm4TlvDq8ikWAM': 'Rachel',
};

export function normalizeVoiceLang(lang?: string): VoiceLanguage {
  const clean = (lang ?? '').trim().toLowerCase();
  if (clean === 'pl' || clean.startsWith('pl-') || clean.startsWith('pl_')) {
    return 'pl';
  }
  return 'en';
}

export function getDefaultVoiceIdForLang(lang?: string): string {
  return DEFAULT_VOICE_ID_BY_LANG[normalizeVoiceLang(lang)];
}

export function getDefaultVoiceIdForArchetype(
  archetype: VoiceArchetype,
  lang?: string
): string {
  const normalized = normalizeVoiceLang(lang);
  return VOICE_ARCHETYPE_TO_ELEVENLABS_ID_BY_LANG[normalized][archetype];
}

export function getCuratedVoices(filter?: {
  lang?: string;
  gender?: string;
}): CuratedVoiceProfile[] {
  const langFilter = filter?.lang?.trim().toLowerCase();
  const genderFilter = filter?.gender?.trim().toLowerCase();
  return CURATED_VOICES.filter((voice) => {
    if (langFilter && langFilter !== 'all' && voice.lang !== langFilter) {
      return false;
    }
    if (
      genderFilter &&
      genderFilter !== 'all' &&
      voice.gender !== genderFilter
    ) {
      return false;
    }
    return true;
  });
}

export function findCuratedVoiceById(
  voiceId?: string
): CuratedVoiceProfile | undefined {
  if (!voiceId) return undefined;
  const clean = voiceId.trim();
  return CURATED_VOICES.find((v) => v.voiceId === clean);
}

const ELEVENLABS_V3_DISCRETE_STABILITY = [0, 0.5, 1] as const;

/**
 * ElevenLabs `eleven_v3` strictly accepts discrete stability values `{0, 0.5, 1}`
 * (Creative / Natural / Robust). Snaps any continuous stability to the nearest
 * allowed discrete value when targeting `eleven_v3*`, leaving other models untouched.
 */
export function snapStabilityForElevenLabsModel(
  stability: number,
  modelId?: string
): number {
  const cleanModel = (modelId ?? '').trim();
  if (!/^eleven_v3/i.test(cleanModel)) {
    return stability;
  }
  if (!Number.isFinite(stability)) {
    return 0.5;
  }
  const clamped = Math.min(1, Math.max(0, stability));
  const snapped = Math.round(clamped * 2) / 2;
  return ELEVENLABS_V3_DISCRETE_STABILITY.includes(
    snapped as (typeof ELEVENLABS_V3_DISCRETE_STABILITY)[number]
  )
    ? snapped
    : 0.5;
}

export function getRecommendedVoiceSettings(
  voiceId?: string,
  modelId?: string
): VoiceSettingsConfig {
  const curated = findCuratedVoiceById(voiceId);
  const settings: VoiceSettingsConfig = curated
    ? { ...curated.recommendedSettings }
    : {
        stability: 0.56,
        similarityBoost: 0.8,
        style: 0.2,
        speed: 0.99,
        useSpeakerBoost: true,
      };
  if (modelId && /^eleven_v3/i.test(modelId.trim())) {
    const snapped = snapStabilityForElevenLabsModel(
      settings.stability ?? 0.5,
      modelId
    );
    settings.stability = ELEVENLABS_V3_DISCRETE_STABILITY.includes(
      snapped as (typeof ELEVENLABS_V3_DISCRETE_STABILITY)[number]
    )
      ? snapped
      : 0.5;
  }
  return settings;
}

export function getKnownEnglishVoiceName(voiceId?: string): string | null {
  if (!voiceId) return null;
  return KNOWN_ENGLISH_PREMADE_VOICES[voiceId.trim()] ?? null;
}

export function isKnownEnglishPremadeVoice(voiceId?: string): boolean {
  return getKnownEnglishVoiceName(voiceId) !== null;
}

/**
 * ElevenLabs `languageCode` (ISO 639-1) is NOT supported by `eleven_multilingual_v2`
 * or `eleven_monolingual_v1`, but IS supported by `eleven_turbo_v2_5`,
 * `eleven_flash_v2_5`, `eleven_v3`, and `eleven_v4*`.
 */
export function supportsLanguageCodeParam(modelId?: string): boolean {
  const clean = (modelId ?? DEFAULT_ELEVENLABS_MODEL_ID).trim().toLowerCase();
  if (!clean) return false;
  if (clean.includes('multilingual_v2') || clean.includes('monolingual_v1')) {
    return false;
  }
  return (
    clean.includes('turbo_v2_5') ||
    clean.includes('flash_v2_5') ||
    clean.startsWith('eleven_v3') ||
    clean.startsWith('eleven_v4')
  );
}
