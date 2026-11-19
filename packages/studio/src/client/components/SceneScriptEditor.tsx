import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  KeyRound,
  Mic,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Square,
} from 'lucide-react';
import {
  ELEVENLABS_TTS_MODELS,
  getCuratedVoices,
  getDefaultVoiceIdForLang,
  getKnownEnglishVoiceName,
  getSceneVoiceover,
  type SceneDefinition,
  type StudioCompositionEntry,
  type VoiceAcousticPreset,
  type VoiceSettingsConfig,
} from '@make-pictures/core';
import { consumePostSseStream } from '../sseClient';
import type {
  SaveStudioScenePayload,
  SceneAudioStatusItem,
  StudioScenePatch,
  StudioScenesResponse,
  StudioStatusResponse,
  StudioVoiceItem,
  StudioVoicesResponse,
} from '../types';

export interface SceneScriptEditorProps {
  composition: StudioCompositionEntry;
  scenesResponse: StudioScenesResponse | null;
  studioStatus: StudioStatusResponse | null;
  isLoadingScenes?: boolean;
  onSaveScene: (
    payload: SaveStudioScenePayload
  ) => Promise<{ ok: boolean; error?: string }>;
  onRefreshScenesAndStatus: () => void;
}

interface ResolvedSceneEntry {
  targetId: string;
  manifestFile: string;
  scene: SceneDefinition;
  isReadOnly: boolean;
  inTimeline: boolean;
}

interface SceneDraftState {
  text: string;
  speaker: string;
  durationInSeconds: number;
  voiceEffect: VoiceAcousticPreset;
  voiceId: string;
  modelId: string;
  hasVoiceSettings: boolean;
  stability: number;
  similarityBoost: number;
  style: number;
  speed: number;
  useSpeakerBoost: boolean;
}

interface SceneSaveFeedback {
  status: 'saving' | 'saved' | 'error';
  message?: string;
}

const VOICE_EFFECT_OPTIONS: Array<{
  value: VoiceAcousticPreset;
  label: string;
}> = [
  { value: 'clean', label: 'Czysty studyjny (clean)' },
  { value: 'telephone', label: 'Telefon (telephone)' },
  { value: 'radio-walkie', label: 'Krótkofalówka (radio-walkie)' },
  { value: 'cathedral', label: 'Katedra / pogłos (cathedral)' },
  { value: 'megaphone', label: 'Megafon (megaphone)' },
  { value: 'excitement-boost', label: 'Ekscytacja (excitement-boost)' },
];

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function roundTwo(num: number): number {
  return Math.round(num * 100) / 100;
}

function sceneToDraft(scene: SceneDefinition): SceneDraftState {
  const vs = scene.voiceSettings;
  const hasVs = Boolean(
    vs &&
      (vs.stability !== undefined ||
        vs.similarityBoost !== undefined ||
        vs.style !== undefined ||
        vs.speed !== undefined ||
        vs.useSpeakerBoost !== undefined)
  );

  return {
    text: scene.text ?? '',
    speaker: scene.speaker ?? '',
    durationInSeconds:
      typeof scene.durationInSeconds === 'number' &&
      Number.isFinite(scene.durationInSeconds)
        ? roundTwo(scene.durationInSeconds)
        : 4,
    voiceEffect: scene.voiceEffect ?? 'clean',
    voiceId: scene.voiceId ?? '',
    modelId: scene.modelId ?? '',
    hasVoiceSettings: hasVs,
    stability: vs?.stability ?? 0.5,
    similarityBoost: vs?.similarityBoost ?? 0.75,
    style: vs?.style ?? 0,
    speed: vs?.speed ?? 1,
    useSpeakerBoost: vs?.useSpeakerBoost ?? true,
  };
}

function isDraftDifferentFromScene(
  draft: SceneDraftState,
  scene: SceneDefinition
): boolean {
  const base = sceneToDraft(scene);
  if (draft.text !== base.text) return true;
  if (draft.speaker.trim() !== base.speaker.trim()) return true;
  if (Math.abs(draft.durationInSeconds - base.durationInSeconds) > 0.001) {
    return true;
  }
  if (draft.voiceEffect !== base.voiceEffect) return true;
  if (draft.voiceId.trim() !== base.voiceId.trim()) return true;
  if (draft.modelId.trim() !== base.modelId.trim()) return true;
  if (draft.hasVoiceSettings !== base.hasVoiceSettings) return true;
  if (draft.hasVoiceSettings) {
    if (Math.abs(draft.stability - base.stability) > 0.001) return true;
    if (Math.abs(draft.similarityBoost - base.similarityBoost) > 0.001) {
      return true;
    }
    if (Math.abs(draft.style - base.style) > 0.001) return true;
    if (Math.abs(draft.speed - base.speed) > 0.001) return true;
    if (draft.useSpeakerBoost !== base.useSpeakerBoost) return true;
  }
  return false;
}

function buildScenePatch(
  draft: SceneDraftState,
  scene: SceneDefinition
): StudioScenePatch {
  const patch: StudioScenePatch = {
    text: draft.text,
    speaker: draft.speaker.trim(),
    voiceId: draft.voiceId.trim(),
    durationInSeconds: roundTwo(draft.durationInSeconds),
  };

  if (draft.modelId.trim() !== '' || scene.modelId !== undefined) {
    patch.modelId = draft.modelId.trim();
  }

  if (draft.voiceEffect !== 'clean' || scene.voiceEffect !== undefined) {
    patch.voiceEffect = draft.voiceEffect;
  }

  if (draft.hasVoiceSettings) {
    const vs: VoiceSettingsConfig = {
      stability: roundTwo(draft.stability),
      similarityBoost: roundTwo(draft.similarityBoost),
      style: roundTwo(draft.style),
      speed: roundTwo(draft.speed),
      useSpeakerBoost: draft.useSpeakerBoost,
    };
    patch.voiceSettings = vs;
  }

  return patch;
}

export const SceneScriptEditor: React.FC<SceneScriptEditorProps> = ({
  composition,
  scenesResponse,
  studioStatus,
  isLoadingScenes = false,
  onSaveScene,
  onRefreshScenesAndStatus,
}) => {
  const resolvedEntries = useMemo<ResolvedSceneEntry[]>(() => {
    const timelineOrder: string[] = [];
    const seenTimeline = new Set<string>();
    const segmentBySceneId = new Map<
      string,
      { durationInSeconds: number; label?: string }
    >();

    for (const seg of composition.sceneTimeline) {
      if (!seenTimeline.has(seg.sceneId)) {
        seenTimeline.add(seg.sceneId);
        timelineOrder.push(seg.sceneId);
        segmentBySceneId.set(seg.sceneId, {
          durationInSeconds:
            composition.fps > 0
              ? roundTwo(seg.durationInFrames / composition.fps)
              : 4,
          label: seg.label,
        });
      }
    }

    const buildFallbackScene = (sceneId: string): SceneDefinition => {
      const vo = getSceneVoiceover(sceneId);
      const statusItem =
        scenesResponse?.audioStatus[sceneId] ?? studioStatus?.scenes[sceneId];
      const segMeta = segmentBySceneId.get(sceneId);
      return {
        id: sceneId,
        title: statusItem?.title ?? segMeta?.label ?? sceneId,
        speaker: statusItem?.speaker,
        text: vo?.text ?? '',
        voiceId: vo?.voiceId && vo.voiceId !== 'synthetic-fallback' ? vo.voiceId : undefined,
        durationInSeconds:
          vo?.durationInSeconds ??
          statusItem?.durationInSeconds ??
          segMeta?.durationInSeconds ??
          4,
      };
    };

    const isProdCapsule =
      composition.origin === 'production' && Boolean(composition.productionId);

    if (isProdCapsule && composition.productionId) {
      const prodId = composition.productionId;
      const manifestFile = `productions/${prodId}/production.json`;
      const prodGroup = scenesResponse?.groups.find((g) => g.id === prodId);

      if (prodGroup) {
        const byId = new Map<string, SceneDefinition>();
        for (const s of prodGroup.scenes) {
          byId.set(s.id, s);
        }

        const ordered: ResolvedSceneEntry[] = [];
        const included = new Set<string>();

        // 1. Scenes referenced in composition.sceneTimeline first
        for (const sceneId of timelineOrder) {
          const found = byId.get(sceneId);
          if (found) {
            ordered.push({
              targetId: prodGroup.id,
              manifestFile: prodGroup.manifestFile,
              scene: found,
              isReadOnly: false,
              inTimeline: true,
            });
            included.add(sceneId);
          } else {
            ordered.push({
              targetId: prodGroup.id,
              manifestFile: prodGroup.manifestFile,
              scene: buildFallbackScene(sceneId),
              isReadOnly: true,
              inTimeline: true,
            });
            included.add(sceneId);
          }
        }

        // 2. Plus any other scenes defined in that capsule
        for (const s of prodGroup.scenes) {
          if (!included.has(s.id)) {
            ordered.push({
              targetId: prodGroup.id,
              manifestFile: prodGroup.manifestFile,
              scene: s,
              isReadOnly: false,
              inTimeline: false,
            });
            included.add(s.id);
          }
        }

        return ordered;
      }

      // Offline / static fallback for production capsule
      return timelineOrder.map((sceneId) => ({
        targetId: prodId,
        manifestFile,
        scene: buildFallbackScene(sceneId),
        isReadOnly: true,
        inTimeline: true,
      }));
    }

    // Root / example compositions -> match against group id === 'root'
    const rootGroup = scenesResponse?.groups.find((g) => g.id === 'root');
    const rootById = new Map<string, SceneDefinition>();
    if (rootGroup) {
      for (const s of rootGroup.scenes) {
        rootById.set(s.id, s);
      }
    }

    return timelineOrder.map((sceneId) => {
      const found = rootById.get(sceneId);
      if (found && rootGroup) {
        return {
          targetId: 'root',
          manifestFile: rootGroup.manifestFile,
          scene: found,
          isReadOnly: false,
          inTimeline: true,
        };
      }
      return {
        targetId: 'root',
        manifestFile: rootGroup?.manifestFile ?? 'scenes.json',
        scene: buildFallbackScene(sceneId),
        isReadOnly: true,
        inTimeline: true,
      };
    });
  }, [
    composition.fps,
    composition.origin,
    composition.productionId,
    composition.sceneTimeline,
    scenesResponse,
    studioStatus,
  ]);

  const [draftsByKey, setDraftsByKey] = useState<
    Record<string, SceneDraftState>
  >({});
  const prevDiskSceneJsonRef = useRef<Record<string, string>>({});
  const [expandedVoiceSettings, setExpandedVoiceSettings] = useState<
    Record<string, boolean>
  >({});
  const [expandedVoiceBrowser, setExpandedVoiceBrowser] = useState<
    Record<string, boolean>
  >({});
  const [feedbackByKey, setFeedbackByKey] = useState<
    Record<string, SceneSaveFeedback | undefined>
  >({});

  const activeGroupLang = useMemo<'pl' | 'en'>(() => {
    if (composition.origin === 'production' && composition.productionId) {
      const grp = scenesResponse?.groups.find(
        (g) => g.id === composition.productionId
      );
      if (grp?.lang === 'pl' || grp?.lang === 'en') {
        return grp.lang;
      }
    }
    const sampleText = resolvedEntries
      .map((e) => e.scene.text)
      .join(' ');
    if (/[ąćęłńśźżĄĆĘŁŃŚŹŻ]/.test(sampleText)) {
      return 'pl';
    }
    return 'en';
  }, [
    composition.origin,
    composition.productionId,
    resolvedEntries,
    scenesResponse?.groups,
  ]);

  const [voiceFilterLang, setVoiceFilterLang] = useState<'pl' | 'en' | 'all'>(
    activeGroupLang
  );
  const [voiceFilterGender, setVoiceFilterGender] = useState<
    'all' | 'female' | 'male'
  >('all');
  const [voiceSearchQuery, setVoiceSearchQuery] = useState('');
  const [voicesCatalog, setVoicesCatalog] =
    useState<StudioVoicesResponse | null>(null);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setVoiceFilterLang(activeGroupLang);
  }, [activeGroupLang]);

  const fetchVoices = useCallback(
    async (opts?: {
      lang?: string;
      gender?: string;
      query?: string;
      refresh?: boolean;
    }) => {
      setIsLoadingVoices(true);
      try {
        const sp = new URLSearchParams();
        const lang = opts?.lang ?? voiceFilterLang;
        const gender = opts?.gender ?? voiceFilterGender;
        const q = (opts?.query ?? voiceSearchQuery).trim();
        if (lang && lang !== 'all') sp.set('lang', lang);
        if (gender && gender !== 'all') sp.set('gender', gender);
        if (q) sp.set('q', q);
        if (opts?.refresh) sp.set('refresh', '1');
        const res = await fetch(`/api/studio/voices?${sp.toString()}`);
        if (res.ok) {
          const data = (await res.json()) as StudioVoicesResponse;
          if (data && data.ok) {
            setVoicesCatalog(data);
          }
        }
      } catch {
        // Keep curated offline fallback
      } finally {
        setIsLoadingVoices(false);
      }
    },
    [voiceFilterGender, voiceFilterLang, voiceSearchQuery]
  );

  useEffect(() => {
    void fetchVoices({ lang: voiceFilterLang, gender: voiceFilterGender });
  }, [voiceFilterLang, voiceFilterGender, fetchVoices]);

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const toggleVoicePreview = useCallback((voice: StudioVoiceItem) => {
    if (!voice.previewUrl) return;
    if (playingPreviewId === voice.voiceId) {
      previewAudioRef.current?.pause();
      previewAudioRef.current = null;
      setPlayingPreviewId(null);
      return;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    const audio = new Audio(voice.previewUrl);
    previewAudioRef.current = audio;
    setPlayingPreviewId(voice.voiceId);
    audio.onended = () => {
      setPlayingPreviewId((cur) => (cur === voice.voiceId ? null : cur));
    };
    audio.onerror = () => {
      setPlayingPreviewId((cur) => (cur === voice.voiceId ? null : cur));
    };
    void audio.play().catch(() => {
      setPlayingPreviewId((cur) => (cur === voice.voiceId ? null : cur));
    });
  }, [playingPreviewId]);

  const curatedFallbackVoices = useMemo<StudioVoiceItem[]>(
    () =>
      getCuratedVoices({
        lang: voiceFilterLang === 'all' ? undefined : voiceFilterLang,
        gender: voiceFilterGender === 'all' ? undefined : voiceFilterGender,
      }).map((v) => ({
        voiceId: v.voiceId,
        name: v.name,
        source: 'curated',
        language: v.lang,
        gender: v.gender,
        role: v.role,
        description: v.description,
        freeUsersAllowed: true,
        recommendedSettings: v.recommendedSettings,
      })),
    [voiceFilterGender, voiceFilterLang]
  );

  const recommendedVoices = voicesCatalog?.recommended ?? curatedFallbackVoices;
  const accountVoices = voicesCatalog?.account ?? [];
  const sharedVoices = voicesCatalog?.shared ?? [];
  const ttsModels = voicesCatalog?.models ?? ELEVENLABS_TTS_MODELS;
  const allKnownVoiceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const v of recommendedVoices) ids.add(v.voiceId);
    for (const v of accountVoices) ids.add(v.voiceId);
    for (const v of sharedVoices) ids.add(v.voiceId);
    return ids;
  }, [accountVoices, recommendedVoices, sharedVoices]);

  // Sync incoming disk scenes into drafts without clobbering active unsaved edits
  useEffect(() => {
    setDraftsByKey((prev) => {
      let mutated = false;
      const next = { ...prev };

      for (const item of resolvedEntries) {
        const key = `${item.targetId}:${item.scene.id}`;
        const diskJson = JSON.stringify(item.scene);
        const prevDiskJson = prevDiskSceneJsonRef.current[key];

        if (!(key in next)) {
          next[key] = sceneToDraft(item.scene);
          prevDiskSceneJsonRef.current[key] = diskJson;
          mutated = true;
          continue;
        }

        if (prevDiskJson !== diskJson) {
          prevDiskSceneJsonRef.current[key] = diskJson;
          // Update draft if user had not modified it relative to previous baseline,
          // or if new disk state already matches their saved draft
          if (!isDraftDifferentFromScene(next[key], item.scene)) {
            next[key] = sceneToDraft(item.scene);
            mutated = true;
          } else if (prevDiskJson) {
            try {
              const oldScene = JSON.parse(prevDiskJson) as SceneDefinition;
              if (!isDraftDifferentFromScene(next[key], oldScene)) {
                next[key] = sceneToDraft(item.scene);
                mutated = true;
              }
            } catch {
              // keep user's local draft
            }
          }
        }
      }

      return mutated ? next : prev;
    });
  }, [resolvedEntries]);

  const updateDraft = useCallback(
    (
      key: string,
      fallbackScene: SceneDefinition,
      updater: (prev: SceneDraftState) => SceneDraftState
    ) => {
      setDraftsByKey((prev) => {
        const current = prev[key] ?? sceneToDraft(fallbackScene);
        return {
          ...prev,
          [key]: updater(current),
        };
      });
      setFeedbackByKey((prev) => {
        if (!prev[key] || prev[key]?.status === 'saving') return prev;
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    },
    []
  );

  const handleRevertScene = useCallback(
    (item: ResolvedSceneEntry) => {
      const key = `${item.targetId}:${item.scene.id}`;
      setDraftsByKey((prev) => ({
        ...prev,
        [key]: sceneToDraft(item.scene),
      }));
      setFeedbackByKey((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    },
    []
  );

  const handleSaveScene = useCallback(
    async (item: ResolvedSceneEntry) => {
      const key = `${item.targetId}:${item.scene.id}`;
      const draft = draftsByKey[key] ?? sceneToDraft(item.scene);

      if (draft.text.trim().length === 0) {
        setFeedbackByKey((prev) => ({
          ...prev,
          [key]: {
            status: 'error',
            message: 'Tekst lektora nie może być pusty.',
          },
        }));
        return;
      }

      if (
        !Number.isFinite(draft.durationInSeconds) ||
        draft.durationInSeconds <= 0.2 ||
        draft.durationInSeconds > 600
      ) {
        setFeedbackByKey((prev) => ({
          ...prev,
          [key]: {
            status: 'error',
            message: 'Czas trwania musi mieścić się w przedziale 0.3–600 s.',
          },
        }));
        return;
      }

      setFeedbackByKey((prev) => ({
        ...prev,
        [key]: { status: 'saving' },
      }));

      try {
        const patch = buildScenePatch(draft, item.scene);
        const result = await onSaveScene({
          targetId: item.targetId,
          sceneId: item.scene.id,
          patch,
        });

        if (!result.ok) {
          setFeedbackByKey((prev) => ({
            ...prev,
            [key]: {
              status: 'error',
              message: result.error ?? 'Nie udało się zapisać sceny.',
            },
          }));
          return;
        }

        setFeedbackByKey((prev) => ({
          ...prev,
          [key]: {
            status: 'saved',
            message: 'Zapisano kwestię na dysku',
          },
        }));
        onRefreshScenesAndStatus();
      } catch (err) {
        setFeedbackByKey((prev) => ({
          ...prev,
          [key]: {
            status: 'error',
            message:
              err instanceof Error
                ? err.message
                : 'Błąd połączenia z serwerem Studio.',
          },
        }));
      }
    },
    [draftsByKey, onSaveScene, onRefreshScenesAndStatus]
  );

  // ==================== VOICEOVER SSE REGENERATION ====================
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<boolean>(false);
  const [forceAudio, setForceAudio] = useState<boolean>(false);
  const [audioLog, setAudioLog] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  const handleRegenerateAudio = useCallback(async () => {
    if (isGeneratingAudio) return;
    setIsGeneratingAudio(true);
    setAudioError(null);
    const productionId =
      composition.origin === 'production'
        ? composition.productionId
        : undefined;
    setAudioLog(
      productionId
        ? `Uruchamianie audio dla productions/${productionId}…`
        : 'Uruchamianie generatora audio…'
    );

    try {
      await consumePostSseStream<{
        type: 'start' | 'log' | 'done' | 'error';
        line?: string;
        message?: string;
        error?: string;
      }>(
        '/api/studio/voiceover',
        { force: forceAudio, productionId },
        (evt) => {
          if (evt.type === 'start' && evt.message) {
            setAudioLog(evt.message);
          } else if (evt.type === 'log' && evt.line) {
            setAudioLog(evt.line);
          } else if (evt.type === 'done') {
            setAudioLog('Zaktualizowano pliki .mp3 i timestampy słów.');
            onRefreshScenesAndStatus();
          } else if (evt.type === 'error') {
            setAudioError(evt.error ?? 'Błąd generatora audio');
          }
        }
      );
    } catch (err) {
      setAudioError(
        err instanceof Error ? err.message : 'Nie udało się przeliczyć audio.'
      );
    } finally {
      setIsGeneratingAudio(false);
      onRefreshScenesAndStatus();
    }
  }, [
    composition.origin,
    composition.productionId,
    forceAudio,
    isGeneratingAudio,
    onRefreshScenesAndStatus,
  ]);

  const hasApiKey =
    scenesResponse?.hasApiKey ?? studioStatus?.hasApiKey ?? false;
  const primaryManifestFile =
    resolvedEntries[0]?.manifestFile ??
    (composition.origin === 'production' && composition.productionId
      ? `productions/${composition.productionId}/production.json`
      : 'scenes.json');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* ==================== ELEVENLABS API KEY STATUS BANNER ==================== */}
      <div
        className="mp-inspector-card"
        style={{
          marginBottom: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              minWidth: 0,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: hasApiKey
                  ? 'var(--mp-emerald)'
                  : 'var(--mp-amber)',
                boxShadow: hasApiKey
                  ? '0 0 0 3px var(--mp-emerald-soft)'
                  : '0 0 0 3px var(--mp-amber-soft)',
                flexShrink: 0,
              }}
            />
            <KeyRound
              size={12}
              style={{
                color: hasApiKey
                  ? 'var(--mp-emerald-text)'
                  : 'var(--mp-amber-text)',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: 'var(--mp-text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {hasApiKey
                ? 'Klucz ElevenLabs aktywny'
                : 'Tryb próbny — deterministyczny fallback'}
            </span>
          </div>

          <button
            type="button"
            className="mp-icon-btn"
            style={{ height: 26, padding: '0 8px', fontSize: 11 }}
            onClick={onRefreshScenesAndStatus}
            disabled={isLoadingScenes || isGeneratingAudio}
            title="Odśwież manifest scen i status plików audio z dysku"
            aria-label="Odśwież skrypt i status audio"
          >
            <RefreshCw size={11} />
            <span>Odśwież</span>
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            fontSize: 10.5,
            fontFamily: 'var(--mp-font-mono)',
            color: 'var(--mp-text-muted)',
          }}
        >
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={primaryManifestFile}
          >
            {primaryManifestFile}
          </span>
          <span>{resolvedEntries.length} kwestii</span>
        </div>
      </div>

      {/* ==================== SCENE SCRIPT CARDS ==================== */}
      {resolvedEntries.length === 0 ? (
        <div className="mp-inspector-card" style={{ marginBottom: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: 'var(--mp-text-secondary)',
              lineHeight: 1.5,
            }}
          >
            <Mic size={15} style={{ color: 'var(--mp-accent)', flexShrink: 0 }} />
            <span>
              Ta kompozycja nie definiuje jeszcze kwestii lektorskich w{' '}
              <code>sceneTimeline</code> ani w manifeście kapsuły.
            </span>
          </div>
        </div>
      ) : (
        <div className="mp-script-list">
          {resolvedEntries.map((item) => {
            const key = `${item.targetId}:${item.scene.id}`;
            const draft = draftsByKey[key] ?? sceneToDraft(item.scene);
            const isDraftDirty =
              !item.isReadOnly && isDraftDifferentFromScene(draft, item.scene);
            const feedback = feedbackByKey[key];
            const isSavingThis = feedback?.status === 'saving';
            const isVsOpen = Boolean(expandedVoiceSettings[key]);

            const audioItem: SceneAudioStatusItem | undefined =
              scenesResponse?.audioStatus[item.scene.id] ??
              studioStatus?.scenes[item.scene.id];
            const manifestVo = getSceneVoiceover(item.scene.id);

            const provider =
              audioItem?.provider ?? manifestVo?.provider ?? 'missing';
            const isHashCurrent = audioItem
              ? audioItem.isHashCurrent
              : Boolean(manifestVo);
            const isTextOutdated =
              isDraftDirty || (provider !== 'missing' && !isHashCurrent);

            let badgeLabel = 'Brak pliku';
            let badgeClass = 'is-missing';
            if (isTextOutdated) {
              badgeLabel = 'Zmieniony tekst';
              badgeClass = isDraftDirty ? 'is-fallback' : 'is-missing';
            } else if (provider === 'elevenlabs') {
              badgeLabel = 'ElevenLabs';
              badgeClass = 'is-ok';
            } else if (provider === 'synthetic-fallback') {
              badgeLabel = 'Tryb próbny';
              badgeClass = 'is-fallback';
            }

            const liveWords = countWords(draft.text);
            const displayDuration =
              audioItem?.durationInSeconds ??
              manifestVo?.durationInSeconds ??
              draft.durationInSeconds;

            const textId = `mp-script-text-${key}`;
            const speakerId = `mp-script-speaker-${key}`;
            const durationId = `mp-script-dur-${key}`;
            const effectId = `mp-script-eff-${key}`;
            const voiceIdInput = `mp-script-vid-${key}`;

            return (
              <div
                key={key}
                className={`mp-script-card ${isDraftDirty ? 'is-dirty' : ''}`}
              >
                {/* Header */}
                <div className="mp-script-card-header">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      minWidth: 0,
                      flexWrap: 'wrap',
                    }}
                  >
                    <code
                      className="mp-mini-badge"
                      style={{
                        color: 'var(--mp-accent)',
                        backgroundColor: 'var(--mp-accent-soft)',
                        borderColor: 'var(--mp-accent-border)',
                      }}
                    >
                      {item.scene.id}
                    </code>
                    {item.scene.title && item.scene.title !== item.scene.id && (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--mp-text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.scene.title}
                      </span>
                    )}
                    {!item.inTimeline && (
                      <span
                        className="mp-mini-badge"
                        title="Scena zdefiniowana w manifeście kapsuły poza bieżącą osią kompozycji"
                      >
                        kapsuła
                      </span>
                    )}
                  </div>

                  <span className={`mp-status-pill ${badgeClass}`}>
                    {badgeLabel}
                  </span>
                </div>

                {/* Sub-header telemetry: word count & duration */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    fontSize: 11,
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--mp-text-muted)',
                  }}
                >
                  <span>
                    {liveWords} słów • {draft.text.length} zn.
                  </span>
                  <span style={{ fontFamily: 'var(--mp-font-mono)' }}>
                    audio: {displayDuration.toFixed(1)}s
                  </span>
                </div>

                {/* Tekst lektora */}
                <div className="mp-field" style={{ marginBottom: 2 }}>
                  <div className="mp-field-label-row">
                    <label htmlFor={textId} className="mp-field-label">
                      Tekst lektora
                    </label>
                    {item.isReadOnly && (
                      <span className="mp-mini-badge">Tylko odczyt</span>
                    )}
                  </div>
                  <textarea
                    id={textId}
                    className="mp-textarea"
                    rows={3}
                    disabled={item.isReadOnly}
                    value={draft.text}
                    placeholder="Wpisz kwestię lektora…"
                    onChange={(e) =>
                      updateDraft(key, item.scene, (prev) => ({
                        ...prev,
                        text: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* 2-Column Metadata Grid */}
                <div className="mp-script-meta-grid">
                  <div className="mp-field" style={{ marginBottom: 0 }}>
                    <label htmlFor={speakerId} className="mp-field-label">
                      Mówca
                    </label>
                    <input
                      id={speakerId}
                      type="text"
                      className="mp-input-text"
                      disabled={item.isReadOnly}
                      value={draft.speaker}
                      placeholder="Narrator"
                      onChange={(e) =>
                        updateDraft(key, item.scene, (prev) => ({
                          ...prev,
                          speaker: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="mp-field" style={{ marginBottom: 0 }}>
                    <label htmlFor={durationId} className="mp-field-label">
                      Czas (s)
                    </label>
                    <input
                      id={durationId}
                      type="number"
                      className="mp-input-number"
                      disabled={item.isReadOnly}
                      min={0.3}
                      max={600}
                      step={0.1}
                      value={draft.durationInSeconds}
                      onChange={(e) => {
                        const parsed = Number(e.target.value);
                        if (Number.isFinite(parsed)) {
                          updateDraft(key, item.scene, (prev) => ({
                            ...prev,
                            durationInSeconds: parsed,
                          }));
                        }
                      }}
                    />
                  </div>

                  <div className="mp-field" style={{ marginBottom: 0 }}>
                    <label htmlFor={effectId} className="mp-field-label">
                      Efekt akustyczny
                    </label>
                    <select
                      id={effectId}
                      className="mp-input-select"
                      disabled={item.isReadOnly}
                      value={draft.voiceEffect}
                      onChange={(e) =>
                        updateDraft(key, item.scene, (prev) => ({
                          ...prev,
                          voiceEffect: e.target.value as VoiceAcousticPreset,
                        }))
                      }
                    >
                      {VOICE_EFFECT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mp-field" style={{ marginBottom: 0 }}>
                    <label htmlFor={voiceIdInput} className="mp-field-label">
                      Głos ElevenLabs
                    </label>
                    <select
                      id={`${voiceIdInput}-select`}
                      className="mp-input-select"
                      disabled={item.isReadOnly}
                      value={
                        draft.voiceId === ''
                          ? ''
                          : allKnownVoiceIds.has(draft.voiceId)
                            ? draft.voiceId
                            : '__custom__'
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__custom__') return;
                        updateDraft(key, item.scene, (prev) => ({
                          ...prev,
                          voiceId: val,
                        }));
                      }}
                    >
                      <option value="">
                        Domyślny ({activeGroupLang === 'pl' ? 'Luiza PL / .env' : 'Liam EN / .env'})
                      </option>
                      {recommendedVoices.length > 0 && (
                        <optgroup label="⭐ Natywne rekomendowane">
                          {recommendedVoices.map((v) => (
                            <option key={`rec-${v.voiceId}`} value={v.voiceId}>
                              {v.name} ({(v.language ?? '').toUpperCase()}
                              {v.gender === 'female'
                                ? ' ♀'
                                : v.gender === 'male'
                                  ? ' ♂'
                                  : ''}
                              ) — {v.role ?? v.voiceId}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {accountVoices.length > 0 && (
                        <optgroup label="👤 Twoje konto ElevenLabs">
                          {accountVoices.map((v) => (
                            <option key={`acc-${v.voiceId}`} value={v.voiceId}>
                              {v.name}
                              {v.language ? ` (${v.language.toUpperCase()})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {sharedVoices.length > 0 && (
                        <optgroup label="🌐 Biblioteka ElevenLabs">
                          {sharedVoices.map((v) => (
                            <option key={`sh-${v.voiceId}`} value={v.voiceId}>
                              {v.name}
                              {v.language ? ` (${v.language.toUpperCase()})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {draft.voiceId && !allKnownVoiceIds.has(draft.voiceId) && (
                        <option value="__custom__">
                          Własne ID ({draft.voiceId})
                        </option>
                      )}
                    </select>
                    <input
                      id={voiceIdInput}
                      type="text"
                      className="mp-input-text"
                      style={{
                        fontFamily: 'var(--mp-font-mono)',
                        fontSize: 11,
                        marginTop: 4,
                      }}
                      disabled={item.isReadOnly}
                      spellCheck={false}
                      value={draft.voiceId}
                      placeholder="Lub wklej własne voiceId…"
                      onChange={(e) =>
                        updateDraft(key, item.scene, (prev) => ({
                          ...prev,
                          voiceId: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                {/* English-voice-in-Polish warning banner */}
                {(() => {
                  const isPolishScene =
                    activeGroupLang === 'pl' ||
                    /[ąćęłńśźżĄĆĘŁŃŚŹŻ]/.test(draft.text);
                  const englishVoiceName = isPolishScene
                    ? getKnownEnglishVoiceName(draft.voiceId)
                    : null;
                  if (!englishVoiceName) return null;
                  const nativePlDefault = getDefaultVoiceIdForLang('pl');
                  return (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '6px 8px',
                        borderRadius: 6,
                        background: 'rgba(245, 158, 11, 0.12)',
                        border: '0.5px solid rgba(245, 158, 11, 0.45)',
                        fontSize: 11.5,
                        color: 'var(--mp-text-primary)',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <AlertTriangle size={13} color="#F59E0B" />
                        <span>
                          <strong>{englishVoiceName}</strong> to głos anglojęzyczny —
                          po polsku daje obcy akcent na liczbach.
                        </span>
                      </span>
                      {!item.isReadOnly && (
                        <button
                          type="button"
                          className="mp-icon-btn"
                          style={{
                            height: 24,
                            fontSize: 11,
                            whiteSpace: 'nowrap',
                          }}
                          onClick={() =>
                            updateDraft(key, item.scene, (prev) => ({
                              ...prev,
                              voiceId: nativePlDefault,
                            }))
                          }
                        >
                          Zmień na Luizę (PL)
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Collapsible ElevenLabs Voice Library Browser (0-credit preview) */}
                {!item.isReadOnly && (
                  <div
                    style={{
                      borderTop: '0.5px solid var(--mp-border-hairline)',
                      paddingTop: 6,
                    }}
                  >
                    <button
                      type="button"
                      className="mp-section-header-btn"
                      style={{ padding: '2px 0' }}
                      aria-expanded={Boolean(expandedVoiceBrowser[key])}
                      onClick={() =>
                        setExpandedVoiceBrowser((prev) => ({
                          ...prev,
                          [key]: !prev[key],
                        }))
                      }
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <Search size={12} />
                        <span>Przeglądaj i odsłuchaj głosy ElevenLabs</span>
                        {voicesCatalog?.configured && (
                          <span className="mp-mini-badge is-prod">
                            {accountVoices.length + sharedVoices.length} live
                          </span>
                        )}
                      </span>
                      <ChevronDown
                        size={13}
                        style={{
                          transform: expandedVoiceBrowser[key]
                            ? 'rotate(0deg)'
                            : 'rotate(-90deg)',
                          transition: 'transform 0.16s var(--mp-ease-spring)',
                        }}
                      />
                    </button>

                    {expandedVoiceBrowser[key] && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          paddingTop: 6,
                        }}
                      >
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '76px 92px 1fr auto',
                            gap: 4,
                          }}
                        >
                          <select
                            aria-label="Język głosu"
                            className="mp-input-select"
                            value={voiceFilterLang}
                            onChange={(e) =>
                              setVoiceFilterLang(
                                e.target.value as 'pl' | 'en' | 'all'
                              )
                            }
                          >
                            <option value="pl">PL</option>
                            <option value="en">EN</option>
                            <option value="all">Wszystkie</option>
                          </select>
                          <select
                            aria-label="Płeć głosu"
                            className="mp-input-select"
                            value={voiceFilterGender}
                            onChange={(e) =>
                              setVoiceFilterGender(
                                e.target.value as 'all' | 'female' | 'male'
                              )
                            }
                          >
                            <option value="all">Każda płeć</option>
                            <option value="female">Kobiecy</option>
                            <option value="male">Męski</option>
                          </select>
                          <input
                            type="text"
                            className="mp-input-text"
                            placeholder="Szukaj (np. teacher, warm)…"
                            value={voiceSearchQuery}
                            onChange={(e) => setVoiceSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void fetchVoices({
                                  query: voiceSearchQuery,
                                  refresh: true,
                                });
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="mp-icon-btn"
                            title="Szukaj w ElevenLabs"
                            disabled={isLoadingVoices}
                            onClick={() =>
                              void fetchVoices({
                                query: voiceSearchQuery,
                                refresh: true,
                              })
                            }
                          >
                            <RefreshCw
                              size={12}
                              className={isLoadingVoices ? 'mp-spin' : ''}
                            />
                          </button>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                            maxHeight: 170,
                            overflowY: 'auto',
                            paddingRight: 2,
                          }}
                        >
                          {[
                            ...recommendedVoices,
                            ...accountVoices,
                            ...sharedVoices,
                          ].map((voice) => {
                            const isSelected = draft.voiceId === voice.voiceId;
                            const isPlaying =
                              playingPreviewId === voice.voiceId;
                            return (
                              <div
                                key={`${voice.source}-${voice.voiceId}`}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 6,
                                  padding: '5px 7px',
                                  borderRadius: 6,
                                  border: isSelected
                                    ? '1px solid var(--mp-accent)'
                                    : '0.5px solid var(--mp-border-hairline)',
                                  background: isSelected
                                    ? 'rgba(59, 130, 246, 0.1)'
                                    : 'rgba(255, 255, 255, 0.02)',
                                  fontSize: 11.5,
                                }}
                              >
                                <div
                                  style={{
                                    minWidth: 0,
                                    flex: 1,
                                    overflow: 'hidden',
                                  }}
                                >
                                  <div
                                    style={{
                                      fontWeight: 600,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {voice.name}{' '}
                                    <span
                                      style={{
                                        opacity: 0.65,
                                        fontWeight: 400,
                                        fontSize: 10.5,
                                      }}
                                    >
                                      [
                                      {voice.source === 'curated'
                                        ? 'studio'
                                        : voice.source === 'account'
                                          ? 'konto'
                                          : 'biblioteka'}
                                      {voice.language
                                        ? ` · ${voice.language.toUpperCase()}`
                                        : ''}
                                      ]
                                    </span>
                                  </div>
                                  {(voice.role || voice.useCase || voice.description) && (
                                    <div
                                      style={{
                                        opacity: 0.72,
                                        fontSize: 10.5,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                      }}
                                    >
                                      {voice.role ||
                                        voice.useCase ||
                                        voice.description}
                                    </div>
                                  )}
                                </div>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    flexShrink: 0,
                                  }}
                                >
                                  {voice.previewUrl && (
                                    <button
                                      type="button"
                                      className="mp-icon-btn"
                                      style={{ height: 24, padding: '0 6px' }}
                                      title="Odsłuchaj darmową próbkę (0 kredytów)"
                                      onClick={() => toggleVoicePreview(voice)}
                                    >
                                      {isPlaying ? (
                                        <Square size={10} />
                                      ) : (
                                        <Play size={10} />
                                      )}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className={`mp-icon-btn ${
                                      isSelected ? 'is-primary' : ''
                                    }`}
                                    style={{ height: 24, fontSize: 10.5 }}
                                    onClick={() =>
                                      updateDraft(key, item.scene, (prev) => ({
                                        ...prev,
                                        voiceId: voice.voiceId,
                                        ...(voice.recommendedSettings
                                          ? {
                                              hasVoiceSettings: true,
                                              stability:
                                                voice.recommendedSettings
                                                  .stability ?? prev.stability,
                                              similarityBoost:
                                                voice.recommendedSettings
                                                  .similarityBoost ??
                                                prev.similarityBoost,
                                              style:
                                                voice.recommendedSettings
                                                  .style ?? prev.style,
                                              speed:
                                                voice.recommendedSettings
                                                  .speed ?? prev.speed,
                                              useSpeakerBoost:
                                                voice.recommendedSettings
                                                  .useSpeakerBoost ??
                                                prev.useSpeakerBoost,
                                            }
                                          : {}),
                                      }))
                                    }
                                  >
                                    {isSelected ? 'Wybrany' : 'Wybierz'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible ElevenLabs Voice Settings Disclosure */}
                {!item.isReadOnly && (
                  <div
                    style={{
                      borderTop: '0.5px solid var(--mp-border-hairline)',
                      paddingTop: 6,
                    }}
                  >
                    <button
                      type="button"
                      className="mp-section-header-btn"
                      style={{ padding: '2px 0' }}
                      aria-expanded={isVsOpen}
                      onClick={() =>
                        setExpandedVoiceSettings((prev) => ({
                          ...prev,
                          [key]: !prev[key],
                        }))
                      }
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <SlidersHorizontal size={12} />
                        <span>Ustawienia głosu ElevenLabs</span>
                        {draft.hasVoiceSettings && (
                          <span className="mp-mini-badge is-prod">własne</span>
                        )}
                      </span>
                      <ChevronDown
                        size={13}
                        style={{
                          transform: isVsOpen
                            ? 'rotate(0deg)'
                            : 'rotate(-90deg)',
                          transition: 'transform 0.16s var(--mp-ease-spring)',
                        }}
                      />
                    </button>

                    {isVsOpen && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          paddingTop: 8,
                        }}
                      >
                        {/* TTS Model override */}
                        <div className="mp-field" style={{ marginBottom: 0 }}>
                          <label
                            htmlFor={`${voiceIdInput}-model`}
                            className="mp-field-label"
                          >
                            Model TTS (modelId)
                          </label>
                          <select
                            id={`${voiceIdInput}-model`}
                            className="mp-input-select"
                            value={draft.modelId}
                            onChange={(e) =>
                              updateDraft(key, item.scene, (prev) => ({
                                ...prev,
                                modelId: e.target.value,
                              }))
                            }
                          >
                            <option value="">
                              Domyślny (z production.json / .env)
                            </option>
                            {ttsModels.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.label} ({m.id})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Stability */}
                        <div className="mp-field" style={{ marginBottom: 0 }}>
                          <div className="mp-field-label-row">
                            <span className="mp-field-label">
                              Stabilność (stability)
                            </span>
                            <span className="mp-field-val-tag">
                              {draft.stability.toFixed(2)}
                            </span>
                          </div>
                          <input
                            type="range"
                            className="mp-range-slider"
                            min={0}
                            max={1}
                            step={0.05}
                            value={draft.stability}
                            onChange={(e) =>
                              updateDraft(key, item.scene, (prev) => ({
                                ...prev,
                                hasVoiceSettings: true,
                                stability: Number(e.target.value),
                              }))
                            }
                          />
                        </div>

                        {/* Similarity Boost */}
                        <div className="mp-field" style={{ marginBottom: 0 }}>
                          <div className="mp-field-label-row">
                            <span className="mp-field-label">
                              Wierność barwy (similarityBoost)
                            </span>
                            <span className="mp-field-val-tag">
                              {draft.similarityBoost.toFixed(2)}
                            </span>
                          </div>
                          <input
                            type="range"
                            className="mp-range-slider"
                            min={0}
                            max={1}
                            step={0.05}
                            value={draft.similarityBoost}
                            onChange={(e) =>
                              updateDraft(key, item.scene, (prev) => ({
                                ...prev,
                                hasVoiceSettings: true,
                                similarityBoost: Number(e.target.value),
                              }))
                            }
                          />
                        </div>

                        {/* Style Exaggeration */}
                        <div className="mp-field" style={{ marginBottom: 0 }}>
                          <div className="mp-field-label-row">
                            <span className="mp-field-label">
                              Ekspresja stylu (style)
                            </span>
                            <span className="mp-field-val-tag">
                              {draft.style.toFixed(2)}
                            </span>
                          </div>
                          <input
                            type="range"
                            className="mp-range-slider"
                            min={0}
                            max={1}
                            step={0.05}
                            value={draft.style}
                            onChange={(e) =>
                              updateDraft(key, item.scene, (prev) => ({
                                ...prev,
                                hasVoiceSettings: true,
                                style: Number(e.target.value),
                              }))
                            }
                          />
                        </div>

                        {/* Speed */}
                        <div className="mp-field" style={{ marginBottom: 0 }}>
                          <div className="mp-field-label-row">
                            <span className="mp-field-label">
                              Tempo mowy (speed)
                            </span>
                            <span className="mp-field-val-tag">
                              {draft.speed.toFixed(2)}×
                            </span>
                          </div>
                          <input
                            type="range"
                            className="mp-range-slider"
                            min={0.5}
                            max={2.0}
                            step={0.05}
                            value={draft.speed}
                            onChange={(e) =>
                              updateDraft(key, item.scene, (prev) => ({
                                ...prev,
                                hasVoiceSettings: true,
                                speed: Number(e.target.value),
                              }))
                            }
                          />
                        </div>

                        {/* Speaker Boost */}
                        <div className="mp-bool-row">
                          <span className="mp-field-label">
                            Wzmocnienie prezencji (useSpeakerBoost)
                          </span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={draft.useSpeakerBoost}
                            className={`mp-switch ${
                              draft.useSpeakerBoost ? 'is-on' : ''
                            }`}
                            onClick={() =>
                              updateDraft(key, item.scene, (prev) => ({
                                ...prev,
                                hasVoiceSettings: true,
                                useSpeakerBoost: !prev.useSpeakerBoost,
                              }))
                            }
                          >
                            <span className="mp-switch-thumb" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Per-Scene Save & Revert Actions */}
                {!item.isReadOnly && (
                  <div className="mp-script-actions">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <button
                        type="button"
                        className="mp-icon-btn is-primary"
                        style={{ height: 28, fontSize: 11.5 }}
                        disabled={!isDraftDirty || isSavingThis}
                        onClick={() => void handleSaveScene(item)}
                      >
                        <Save size={12} />
                        <span>
                          {isSavingThis ? 'Zapisywanie…' : 'Zapisz kwestię'}
                        </span>
                      </button>

                      <button
                        type="button"
                        className="mp-icon-btn"
                        style={{ height: 28, fontSize: 11.5 }}
                        disabled={!isDraftDirty || isSavingThis}
                        onClick={() => handleRevertScene(item)}
                      >
                        <RotateCcw size={12} />
                        <span>Cofnij</span>
                      </button>
                    </div>

                    {feedback?.status === 'saved' && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'var(--mp-emerald-text)',
                        }}
                      >
                        <Check size={12} />
                        <span>{feedback.message}</span>
                      </span>
                    )}
                  </div>
                )}

                {feedback?.status === 'error' && feedback.message && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      color: 'var(--mp-rose-text)',
                      backgroundColor: 'var(--mp-rose-soft)',
                      border: '0.5px solid var(--mp-rose-border)',
                      borderRadius: 8,
                      padding: '5px 8px',
                    }}
                  >
                    <AlertCircle size={13} style={{ flexShrink: 0 }} />
                    <span>{feedback.message}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ==================== STICKY / CARD VOICEOVER REGENERATION BAR ==================== */}
      <div
        className="mp-section-card"
        style={{
          position: 'sticky',
          bottom: 0,
          marginBottom: 0,
          zIndex: 5,
          backdropFilter: 'var(--mp-glass-blur)',
          WebkitBackdropFilter: 'var(--mp-glass-blur)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--mp-text-secondary)',
            }}
          >
            Wymuś pełną regenerację (--force)
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={forceAudio}
            aria-label="Wymuś (--force)"
            disabled={isGeneratingAudio}
            className={`mp-switch ${forceAudio ? 'is-on' : ''}`}
            onClick={() => setForceAudio((prev) => !prev)}
          >
            <span className="mp-switch-thumb" />
          </button>
        </div>

        <button
          type="button"
          className="mp-icon-btn is-primary"
          style={{ width: '100%', height: 34, fontSize: 12 }}
          disabled={isGeneratingAudio}
          onClick={() => void handleRegenerateAudio()}
        >
          <Sparkles size={13} />
          <span>
            {isGeneratingAudio
              ? 'Generowanie ścieżek lektora…'
              : 'Przelicz audio dla kompozycji'}
          </span>
        </button>

        {audioError ? (
          <div
            className="mp-audio-gen-log"
            style={{
              color: 'var(--mp-rose-text)',
              backgroundColor: 'var(--mp-rose-soft)',
              borderColor: 'var(--mp-rose-border)',
              whiteSpace: 'normal',
            }}
            title={audioError}
          >
            {audioError}
          </div>
        ) : audioLog ? (
          <div className="mp-audio-gen-log" title={audioLog}>
            {audioLog}
          </div>
        ) : null}
      </div>
    </div>
  );
};
