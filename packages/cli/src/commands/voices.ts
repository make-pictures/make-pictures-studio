import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import {
  DEFAULT_ELEVENLABS_MODEL_ID,
  ELEVENLABS_TTS_MODELS,
  getCuratedVoices,
  getDefaultVoiceIdForLang,
  getKnownEnglishVoiceName,
  getRecommendedVoiceSettings,
  supportsLanguageCodeParam,
  type CuratedVoiceProfile,
  type ElevenLabsModelInfo,
} from '../../../core/src/audio/voices';
import { hasActiveElevenLabsApiKey } from './audio';
import { resolveWorkspaceContext } from './workspace-paths';

export interface DiscoveredVoiceEntry {
  voiceId: string;
  name: string;
  source: 'curated' | 'account' | 'shared';
  language?: string;
  gender?: string;
  useCase?: string;
  category?: string;
  description?: string;
  previewUrl?: string;
  freeUsersAllowed?: boolean;
  rate?: number;
}

export interface VoicesCommandOptions {
  rootDir?: string;
  cwd?: string;
  dir?: string;
  lang?: string;
  gender?: string;
  query?: string;
  mine?: boolean;
  limit?: number;
  json?: boolean;
  audition?: string;
  voice?: string;
  model?: string;
  out?: string;
  deps?: VoicesCommandDeps;
}

export interface VoicesCommandDeps {
  hasApiKey?: () => boolean;
  fetchAccountVoices?: () => Promise<DiscoveredVoiceEntry[]>;
  fetchSharedVoices?: (params: {
    lang?: string;
    gender?: string;
    query?: string;
    limit: number;
  }) => Promise<DiscoveredVoiceEntry[]>;
  synthesizeAudition?: (params: {
    voiceId: string;
    modelId: string;
    languageCode?: string;
    text: string;
  }) => Promise<Buffer>;
  log?: (line: string) => void;
}

export interface VoicesCommandResult {
  configured: boolean;
  lang: string;
  gender?: string;
  query?: string;
  recommended: CuratedVoiceProfile[];
  account: DiscoveredVoiceEntry[];
  shared: DiscoveredVoiceEntry[];
  models: ReadonlyArray<ElevenLabsModelInfo>;
  audition?: {
    voiceId: string;
    modelId: string;
    languageCode?: string;
    text: string;
    outFile: string;
    bytes: number;
  };
  warning?: string;
}

function normalizeLanguageFilter(raw?: string): string | undefined {
  if (!raw) return undefined;
  const clean = raw.trim().toLowerCase();
  if (!clean || clean === 'all') return undefined;
  return clean;
}

function normalizeGenderFilter(raw?: string): string | undefined {
  if (!raw) return undefined;
  const clean = raw.trim().toLowerCase();
  if (clean === 'female' || clean === 'male') return clean;
  return undefined;
}

function matchesAccountVoiceFilters(
  entry: DiscoveredVoiceEntry,
  filters: { lang?: string; gender?: string; query?: string }
): boolean {
  if (filters.lang) {
    const voiceLang = (entry.language ?? '').toLowerCase();
    // Account voices without explicit language label are still kept only when no lang filter,
    // or if their label/name mentions the language.
    if (voiceLang) {
      if (voiceLang !== filters.lang && !voiceLang.startsWith(`${filters.lang}-`)) {
        return false;
      }
    } else {
      const hay = `${entry.name} ${entry.description ?? ''}`.toLowerCase();
      const langKeywords =
        filters.lang === 'pl' ? ['polish', 'polsk'] : [filters.lang];
      if (!langKeywords.some((kw) => hay.includes(kw))) {
        return false;
      }
    }
  }
  if (filters.gender && entry.gender) {
    if (entry.gender.toLowerCase() !== filters.gender) {
      return false;
    }
  }
  if (filters.query) {
    const q = filters.query.toLowerCase();
    const hay =
      `${entry.name} ${entry.description ?? ''} ${entry.useCase ?? ''} ${entry.voiceId}`.toLowerCase();
    if (!hay.includes(q)) {
      return false;
    }
  }
  return true;
}

async function defaultFetchAccountVoices(): Promise<DiscoveredVoiceEntry[]> {
  const client = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY?.trim() || 'offline-fallback-key',
  });
  const res = await client.voices.getAll();
  const voices = Array.isArray(res.voices) ? res.voices : [];
  return voices.map((v) => {
    const labels = (v.labels ?? {}) as Record<string, string | undefined>;
    const verifiedFirst = Array.isArray(v.verifiedLanguages)
      ? v.verifiedLanguages[0]?.language
      : undefined;
    return {
      voiceId: v.voiceId,
      name: v.name ?? v.voiceId,
      source: 'account' as const,
      language: labels.language || verifiedFirst || undefined,
      gender: labels.gender || undefined,
      useCase: labels.use_case || labels.useCase || undefined,
      category: v.category || undefined,
      description: v.description || undefined,
      previewUrl: v.previewUrl || undefined,
    };
  });
}

async function defaultFetchSharedVoices(params: {
  lang?: string;
  gender?: string;
  query?: string;
  limit: number;
}): Promise<DiscoveredVoiceEntry[]> {
  const client = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY?.trim() || 'offline-fallback-key',
  });
  const res = await client.voices.getShared({
    pageSize: Math.min(Math.max(params.limit, 1), 30),
    ...(params.lang ? { language: params.lang } : {}),
    ...(params.gender ? { gender: params.gender } : {}),
    ...(params.query ? { search: params.query } : {}),
  });
  const voices = Array.isArray(res.voices) ? res.voices : [];
  return voices.map((v) => ({
    voiceId: v.voiceId,
    name: v.name,
    source: 'shared' as const,
    language: v.language || params.lang,
    gender: v.gender || undefined,
    useCase: v.useCase || undefined,
    category: v.category || undefined,
    description: v.description || undefined,
    previewUrl: v.previewUrl || undefined,
    freeUsersAllowed:
      typeof v.freeUsersAllowed === 'boolean' ? v.freeUsersAllowed : undefined,
    rate: typeof v.rate === 'number' ? v.rate : undefined,
  }));
}

async function defaultSynthesizeAudition(params: {
  voiceId: string;
  modelId: string;
  languageCode?: string;
  text: string;
}): Promise<Buffer> {
  const client = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY?.trim() || 'offline-fallback-key',
  });
  const effectiveLanguageCode =
    params.languageCode && supportsLanguageCodeParam(params.modelId)
      ? params.languageCode.toLowerCase()
      : undefined;

  const response = await client.textToSpeech.convertWithTimestamps(
    params.voiceId,
    {
      text: params.text,
      modelId: params.modelId,
      ...(effectiveLanguageCode ? { languageCode: effectiveLanguageCode } : {}),
      voiceSettings: getRecommendedVoiceSettings(params.voiceId),
    }
  );
  return Buffer.from(response.audioBase64, 'base64');
}

export async function runVoicesCommand(
  options: VoicesCommandOptions = {}
): Promise<VoicesCommandResult> {
  const { rootDir, studioDir } = resolveWorkspaceContext({
    cwd: options.cwd ?? options.rootDir,
    dir: options.dir,
  });
  dotenv.config({ path: path.join(rootDir, '.env.local') });
  dotenv.config({ path: path.join(rootDir, '.env') });

  const log = options.deps?.log ?? ((line: string) => console.log(line));
  const langFilter = normalizeLanguageFilter(options.lang);
  const genderFilter = normalizeGenderFilter(options.gender);
  const queryFilter = options.query?.trim() || undefined;
  const limit = Math.min(Math.max(options.limit ?? 12, 1), 30);
  const configured = options.deps?.hasApiKey
    ? options.deps.hasApiKey()
    : hasActiveElevenLabsApiKey();

  const recommended = getCuratedVoices({
    lang: langFilter,
    gender: genderFilter,
  });

  // Optional 1-sentence voice audition mode
  if (options.audition && options.audition.trim().length > 0) {
    if (!configured) {
      throw new Error(
        'Audition requires an active ELEVENLABS_API_KEY in .env.local. Run `npx make-pictures onboard` first.'
      );
    }
    const voiceId =
      options.voice?.trim() ||
      process.env.ELEVENLABS_VOICE_ID?.trim() ||
      getDefaultVoiceIdForLang(langFilter ?? 'pl');
    const modelId =
      options.model?.trim() ||
      process.env.ELEVENLABS_MODEL_ID?.trim() ||
      DEFAULT_ELEVENLABS_MODEL_ID;
    const text = options.audition.trim();
    const outPath = options.out
      ? path.resolve(rootDir, options.out)
      : path.join(studioDir, 'out', 'voice-audition', `${voiceId}.mp3`);

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const synth = options.deps?.synthesizeAudition ?? defaultSynthesizeAudition;
    const buf = await synth({
      voiceId,
      modelId,
      languageCode: langFilter,
      text,
    });
    fs.writeFileSync(outPath, buf);

    const relOut = path.relative(rootDir, outPath) || outPath;
    const result: VoicesCommandResult = {
      configured,
      lang: langFilter ?? 'all',
      gender: genderFilter,
      query: queryFilter,
      recommended,
      account: [],
      shared: [],
      models: ELEVENLABS_TTS_MODELS,
      audition: {
        voiceId,
        modelId,
        languageCode:
          langFilter && supportsLanguageCodeParam(modelId)
            ? langFilter
            : undefined,
        text,
        outFile: relOut,
        bytes: buf.length,
      },
    };

    if (options.json) {
      log(JSON.stringify(result, null, 2));
    } else {
      const englishWarn =
        langFilter === 'pl' ? getKnownEnglishVoiceName(voiceId) : null;
      if (englishWarn) {
        log(
          `⚠️  Uwaga: "${englishWarn}" (${voiceId}) to głos anglojęzyczny — dla języka polskiego wybierz natywny głos PL (--lang=pl).`
        );
      }
      log(
        `✅ Audition sample saved: ${relOut} (${(buf.length / 1024).toFixed(1)} KB, voice: ${voiceId}, model: ${modelId})`
      );
    }
    return result;
  }

  let account: DiscoveredVoiceEntry[] = [];
  let shared: DiscoveredVoiceEntry[] = [];
  let warning: string | undefined;

  if (configured) {
    try {
      const fetchAccount =
        options.deps?.fetchAccountVoices ?? defaultFetchAccountVoices;
      const rawAccount = await fetchAccount();
      // Keep non-premade / custom account voices matching filter first,
      // and avoid flooding Polish queries with English premade voices
      account = rawAccount.filter((v) => {
        if (langFilter === 'pl' && getKnownEnglishVoiceName(v.voiceId)) {
          return false;
        }
        return matchesAccountVoiceFilters(v, {
          lang: langFilter,
          gender: genderFilter,
          query: queryFilter,
        });
      });
    } catch (err) {
      warning = `Could not list account voices: ${err instanceof Error ? err.message : String(err)}`;
    }

    if (!options.mine) {
      try {
        const fetchShared =
          options.deps?.fetchSharedVoices ?? defaultFetchSharedVoices;
        shared = await fetchShared({
          lang: langFilter,
          gender: genderFilter,
          query: queryFilter,
          limit,
        });
      } catch (err) {
        const msg = `Could not search ElevenLabs Voice Library: ${err instanceof Error ? err.message : String(err)}`;
        warning = warning ? `${warning}; ${msg}` : msg;
      }
    }
  } else {
    warning =
      'ELEVENLABS_API_KEY not configured — showing curated native studio voices only. Run `npx make-pictures onboard` to search your account and ElevenLabs Voice Library.';
  }

  const result: VoicesCommandResult = {
    configured,
    lang: langFilter ?? 'all',
    gender: genderFilter,
    query: queryFilter,
    recommended,
    account,
    shared,
    models: ELEVENLABS_TTS_MODELS,
    ...(warning ? { warning } : {}),
  };

  if (options.json) {
    log(JSON.stringify(result, null, 2));
    return result;
  }

  log('==============================================================');
  log(
    ` 🎙️  make.pictures — Native ElevenLabs Voices (lang=${result.lang}${genderFilter ? `, gender=${genderFilter}` : ''}${queryFilter ? `, q="${queryFilter}"` : ''})`
  );
  log('==============================================================');

  if (recommended.length > 0) {
    log('\n⭐ Curated Native Studio Voices (verified direct voiceId):');
    for (const v of recommended) {
      log(
        `  • ${v.name} [${v.lang.toUpperCase()} / ${v.gender}] — ${v.voiceId}`
      );
      log(`    ${v.role} (archetype: ${v.archetype})`);
    }
  }

  if (account.length > 0) {
    log(`\n👤 Your ElevenLabs Account Voices (${account.length}):`);
    for (const v of account) {
      const meta = [v.language?.toUpperCase(), v.gender, v.category]
        .filter(Boolean)
        .join(' / ');
      log(`  • ${v.name}${meta ? ` [${meta}]` : ''} — ${v.voiceId}`);
      if (v.previewUrl) log(`    preview (0 credits): ${v.previewUrl}`);
    }
  }

  if (!options.mine && shared.length > 0) {
    log(`\n🌐 ElevenLabs Voice Library (${shared.length}):`);
    for (const v of shared) {
      const meta = [
        v.language?.toUpperCase(),
        v.gender,
        v.useCase,
        v.freeUsersAllowed === true ? 'free-ok' : undefined,
      ]
        .filter(Boolean)
        .join(' / ');
      log(`  • ${v.name}${meta ? ` [${meta}]` : ''} — ${v.voiceId}`);
      if (v.previewUrl) log(`    preview (0 credits): ${v.previewUrl}`);
    }
  }

  if (warning) {
    log(`\nℹ️  ${warning}`);
  }

  log(
    `\n💡 Audition 1 short sentence before full synthesis:\n   npx make-pictures voices --voice=<voiceId> --lang=${langFilter ?? 'pl'} --audition="Przykładowe zdanie testowe."`
  );

  return result;
}
