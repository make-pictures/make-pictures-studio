import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CopyPlus, RefreshCw, Sparkles, Terminal } from 'lucide-react';
import {
  BUILT_IN_STYLE_IDS,
  BUILT_IN_STYLES,
  StylePresetSchema,
  isBuiltInStyleId,
  isVerticalComposition,
  listAllStudioStyles,
  registerCustomStyles,
  type BuiltinVisualKitId,
  type StudioCompositionEntry,
  type StylePreset,
} from '@make-pictures/core';
import { BrandMarkSvg } from './components/BrandLogo';
import { PropsInspector } from './components/PropsInspector';
import { StageViewport } from './components/StageViewport';
import {
  STYLE_LAB_DURATION_IN_FRAMES,
  STYLE_LAB_FPS,
  StyleLabPreviewComposition,
  StyleLabShowcase,
  type StyleLabAspectRatio,
} from './components/StyleLabShowcase';
import { Topbar, type StudioViewMode } from './components/Topbar';
import { useStudioTheme } from './hooks/useStudioTheme';
import type {
  OverlaySettings,
  SaveStudioScenePayload,
  StudioScenesResponse,
  StudioStatusResponse,
} from './types';

export interface StudioAppProps {
  compositions?: StudioCompositionEntry[];
}

const EMPTY_COMPOSITIONS: StudioCompositionEntry[] = [];
const STYLE_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

function findComposition(
  list: StudioCompositionEntry[],
  id: string
): StudioCompositionEntry | undefined {
  return list.find((item) => item.id === id);
}

function readInitialViewMode(): StudioViewMode {
  if (typeof window === 'undefined') return 'films';
  const params = new URLSearchParams(window.location.search);
  return params.get('view') === 'styles' ? 'styles' : 'films';
}

function readInitialStyleId(): string {
  if (typeof window === 'undefined') return 'minimal-product';
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('style')?.trim();
  if (requested && STYLE_SLUG_RE.test(requested)) {
    return requested;
  }
  return 'minimal-product';
}

function readInitialCompId(list: StudioCompositionEntry[]): string {
  if (list.length === 0) return '';
  if (typeof window === 'undefined') return list[0].id;
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('comp');
  if (requested && findComposition(list, requested)) {
    return requested;
  }
  return list[0].id;
}

function cloneProps<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

function suggestNewStyleSlug(baseId: string, existingCustomIds: Set<string>): string {
  const stem = baseId.replace(/-custom(-\d+)?$/, '').slice(0, 48) || 'moj-styl';
  const first = `${stem}-custom`;
  if (!existingCustomIds.has(first) && !isBuiltInStyleId(first)) {
    return first;
  }
  for (let i = 2; i <= 99; i++) {
    const candidate = `${stem}-custom-${i}`;
    if (!existingCustomIds.has(candidate) && !isBuiltInStyleId(candidate)) {
      return candidate;
    }
  }
  return `${stem}-v2`;
}

export const StudioApp: React.FC<StudioAppProps> = ({
  compositions = EMPTY_COMPOSITIONS,
}) => {
  const { themeMode, resolvedTheme, cycleThemeMode, setThemeMode } =
    useStudioTheme();

  const [viewMode, setViewMode] = useState<StudioViewMode>(() =>
    readInitialViewMode()
  );

  // SSR-safe default `true` so SSR markup includes PropsInspector;
  // collapses automatically on <1100px viewports when mounted in browser.
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 1100
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth < 1100) {
      setInspectorOpen(false);
    }
  }, []);

  const handleToggleInspector = useCallback(() => {
    setInspectorOpen((prev) => !prev);
  }, []);

  const [selectedId, setSelectedId] = useState<string>(() =>
    readInitialCompId(compositions)
  );
  const [overlays, setOverlays] = useState<OverlaySettings>(() => {
    const initial = findComposition(
      compositions,
      readInitialCompId(compositions)
    );
    return {
      goldenSafeBox: initial ? isVerticalComposition(initial) : false,
      ruleOfThirds: false,
      safeMargins: false,
    };
  });
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [measuredFps, setMeasuredFps] = useState<number>(60);
  const [studioStatus, setStudioStatus] =
    useState<StudioStatusResponse | null>(null);
  const [scenesResponse, setScenesResponse] =
    useState<StudioScenesResponse | null>(null);

  // ==================== FILMS PROPS INSPECTOR STATE ====================
  const [propsByComp, setPropsByComp] = useState<
    Record<string, Record<string, unknown>>
  >(() => {
    const map: Record<string, Record<string, unknown>> = {};
    for (const comp of compositions) {
      map[comp.id] = cloneProps(comp.defaultProps);
    }
    return map;
  });

  const [savedBaselineByComp, setSavedBaselineByComp] = useState<
    Record<string, string>
  >(() => {
    const map: Record<string, string> = {};
    for (const comp of compositions) {
      map[comp.id] = JSON.stringify(comp.defaultProps);
    }
    return map;
  });

  const [autoSave, setAutoSave] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const prevHmrDiskJsonRef = useRef<Record<string, string>>(
    Object.fromEntries(
      compositions.map((c) => [c.id, JSON.stringify(c.defaultProps)])
    )
  );
  const lastClientSavedJsonRef = useRef<Record<string, string>>({});

  // ==================== STYLE LAB STATE ====================
  const builtInStyles = useMemo<StylePreset[]>(
    () => BUILT_IN_STYLE_IDS.map((id) => BUILT_IN_STYLES[id]),
    []
  );

  const [customStyles, setCustomStyles] = useState<StylePreset[]>(() =>
    listAllStudioStyles()
      .filter((entry) => entry.origin === 'custom')
      .map((entry) => entry.preset)
  );
  const [styleWarnings, setStyleWarnings] = useState<string[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<string>(() =>
    readInitialStyleId()
  );
  const [styleLabKit, setStyleLabKit] =
    useState<BuiltinVisualKitId>('editorial-collage');
  const [styleLabAspect, setStyleLabAspect] =
    useState<StyleLabAspectRatio>('16:9');
  const [styleLabOverlays, setStyleLabOverlays] = useState<OverlaySettings>({
    goldenSafeBox: false,
    ruleOfThirds: false,
    safeMargins: false,
  });

  const availableStyles = useMemo<
    Array<{ preset: StylePreset; origin: 'built-in' | 'custom' }>
  >(
    () => [
      ...builtInStyles.map((preset) => ({
        preset,
        origin: 'built-in' as const,
      })),
      ...customStyles.map((preset) => ({
        preset,
        origin: 'custom' as const,
      })),
    ],
    [builtInStyles, customStyles]
  );

  const [styleDraftsById, setStyleDraftsById] = useState<
    Record<string, Record<string, unknown>>
  >(() => {
    const map: Record<string, Record<string, unknown>> = {};
    for (const item of listAllStudioStyles()) {
      map[item.preset.id] = cloneProps(
        item.preset as unknown as Record<string, unknown>
      );
    }
    return map;
  });

  const [savedStyleBaselineById, setSavedStyleBaselineById] = useState<
    Record<string, string>
  >(() => {
    const map: Record<string, string> = {};
    for (const item of listAllStudioStyles()) {
      map[item.preset.id] = JSON.stringify(item.preset);
    }
    return map;
  });

  const [styleAutoSave, setStyleAutoSave] = useState<boolean>(false);
  const [isSavingStyle, setIsSavingStyle] = useState<boolean>(false);
  const [styleSaveError, setStyleSaveError] = useState<string | null>(null);
  const [styleLastSavedAt, setStyleLastSavedAt] = useState<string | null>(null);

  const [showSaveAsCustomForm, setShowSaveAsCustomForm] =
    useState<boolean>(false);
  const [saveAsSlugDraft, setSaveAsSlugDraft] = useState<string>('');
  const [saveAsSlugError, setSaveAsSlugError] = useState<string | null>(null);
  const lastValidatedStyleRef = useRef<StylePreset>(
    BUILT_IN_STYLES['minimal-product']
  );

  // Sync URL query string helper
  const syncUrlParams = useCallback(
    (nextMode: StudioViewMode, nextStyleId?: string, nextCompId?: string) => {
      if (typeof window === 'undefined') return;
      const url = new URL(window.location.href);
      if (nextMode === 'styles') {
        url.searchParams.set('view', 'styles');
        if (nextStyleId) {
          url.searchParams.set('style', nextStyleId);
        }
      } else {
        url.searchParams.delete('view');
        url.searchParams.delete('style');
        if (nextCompId) {
          url.searchParams.set('comp', nextCompId);
        }
      }
      window.history.replaceState({}, '', url.toString());
    },
    []
  );

  const handleChangeViewMode = useCallback(
    (nextMode: StudioViewMode) => {
      setViewMode(nextMode);
      setIsPlaying(false);
      setMeasuredFps(60);
      syncUrlParams(nextMode, selectedStyleId, selectedId || undefined);
    },
    [selectedStyleId, selectedId, syncUrlParams]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPopState = () => {
      setViewMode(readInitialViewMode());
      setSelectedStyleId(readInitialStyleId());
      if (compositions.length > 0) {
        setSelectedId(readInitialCompId(compositions));
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [compositions]);

  // Fetch custom styles from `/api/studio/styles`
  const fetchCustomStyles = useCallback(async () => {
    try {
      const res = await fetch('/api/studio/styles');
      if (!res.ok) return;
      const data = (await res.json()) as {
        ok?: boolean;
        styles?: StylePreset[];
        warnings?: string[];
      };
      if (!data.ok || !Array.isArray(data.styles)) return;

      registerCustomStyles(data.styles);
      setCustomStyles(data.styles);
      setStyleWarnings(Array.isArray(data.warnings) ? data.warnings : []);

      setStyleDraftsById((prev) => {
        const next = { ...prev };
        for (const preset of data.styles ?? []) {
          if (!(preset.id in next)) {
            next[preset.id] = cloneProps(
              preset as unknown as Record<string, unknown>
            );
          }
        }
        return next;
      });

      setSavedStyleBaselineById((prev) => {
        const next = { ...prev };
        for (const preset of data.styles ?? []) {
          if (!(preset.id in next)) {
            next[preset.id] = JSON.stringify(preset);
          }
        }
        return next;
      });
    } catch {
      // Static build / offline mode falls back to already-registered custom styles
    }
  }, []);

  useEffect(() => {
    void fetchCustomStyles();
  }, [fetchCustomStyles]);

  const handleRefreshStyles = useCallback(() => {
    void fetchCustomStyles();
  }, [fetchCustomStyles]);

  // Keep selectedId & props maps populated when new compositions are added dynamically via HMR
  useEffect(() => {
    if (compositions.length === 0) return;
    if (!selectedId || !findComposition(compositions, selectedId)) {
      setSelectedId(readInitialCompId(compositions));
    }

    setPropsByComp((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const comp of compositions) {
        if (!(comp.id in next)) {
          next[comp.id] = cloneProps(comp.defaultProps);
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    setSavedBaselineByComp((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const comp of compositions) {
        if (!(comp.id in next)) {
          next[comp.id] = JSON.stringify(comp.defaultProps);
          prevHmrDiskJsonRef.current[comp.id] = next[comp.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [compositions, selectedId]);

  const activeComposition: StudioCompositionEntry | null =
    compositions.length > 0
      ? findComposition(compositions, selectedId) ?? compositions[0]
      : null;

  const currentModuleDiskJson = activeComposition
    ? JSON.stringify(activeComposition.defaultProps)
    : '{}';

  useEffect(() => {
    if (!activeComposition) return;
    const compId = activeComposition.id;
    const prevDiskJson = prevHmrDiskJsonRef.current[compId];
    if (prevDiskJson === currentModuleDiskJson) return;

    prevHmrDiskJsonRef.current[compId] = currentModuleDiskJson;
    setSavedBaselineByComp((prev) => ({
      ...prev,
      [compId]: currentModuleDiskJson,
    }));

    if (lastClientSavedJsonRef.current[compId] !== currentModuleDiskJson) {
      setPropsByComp((prev) => ({
        ...prev,
        [compId]: cloneProps(activeComposition.defaultProps),
      }));
      setSaveError(null);
    }
  }, [activeComposition, currentModuleDiskJson]);

  const activeLiveProps = useMemo(
    () =>
      activeComposition
        ? propsByComp[activeComposition.id] ?? activeComposition.defaultProps
        : {},
    [propsByComp, activeComposition]
  );

  const activeBaselineJson = activeComposition
    ? savedBaselineByComp[activeComposition.id] ?? currentModuleDiskJson
    : '{}';
  const activeLiveJson = useMemo(
    () => JSON.stringify(activeLiveProps),
    [activeLiveProps]
  );
  const isDirty =
    Boolean(activeComposition) && activeLiveJson !== activeBaselineJson;

  // ==================== STUDIO STATUS & SCENES API ====================
  const fetchStudioStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/studio/status');
      if (!res.ok) return;
      const data = (await res.json()) as StudioStatusResponse;
      setStudioStatus(data);
    } catch {
      // Offline / static fallback uses registered voiceover manifest
    }
  }, []);

  const fetchScenes = useCallback(async () => {
    try {
      const res = await fetch('/api/studio/scenes');
      if (!res.ok) return;
      const data = (await res.json()) as StudioScenesResponse;
      if (data && data.ok && Array.isArray(data.groups)) {
        setScenesResponse(data);
      }
    } catch {
      // Offline / static fallback uses registered voiceover manifest
    }
  }, []);

  useEffect(() => {
    void fetchStudioStatus();
    void fetchScenes();
  }, [fetchStudioStatus, fetchScenes]);

  const handleRefreshScenesAndStatus = useCallback(() => {
    void fetchStudioStatus();
    void fetchScenes();
  }, [fetchStudioStatus, fetchScenes]);

  const handleSaveScene = useCallback(
    async (
      payload: SaveStudioScenePayload
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/studio/scenes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          return {
            ok: false,
            error: data.error ?? `Błąd zapisu sceny (HTTP ${res.status})`,
          };
        }
        await Promise.all([fetchScenes(), fetchStudioStatus()]);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : 'Nie udało się zapisać sceny na dysku.',
        };
      }
    },
    [fetchScenes, fetchStudioStatus]
  );

  const handleSelectComposition = useCallback(
    (id: string) => {
      setSelectedId(id);
      setIsPlaying(false);
      setSaveError(null);
      const nextComp = findComposition(compositions, id);
      if (nextComp) {
        setMeasuredFps(nextComp.fps);
        setOverlays((prev) => ({
          ...prev,
          goldenSafeBox: isVerticalComposition(nextComp),
        }));
      }
      syncUrlParams('films', undefined, id);
    },
    [compositions, syncUrlParams]
  );

  const handleToggleOverlay = useCallback((key: keyof OverlaySettings) => {
    setOverlays((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const handleToggleStyleLabOverlay = useCallback(
    (key: keyof OverlaySettings) => {
      setStyleLabOverlays((prev) => ({
        ...prev,
        [key]: !prev[key],
      }));
    },
    []
  );

  const handleChangeStyleLabAspect = useCallback(
    (ratio: StyleLabAspectRatio) => {
      setStyleLabAspect(ratio);
      setStyleLabOverlays((prev) => ({
        ...prev,
        goldenSafeBox: ratio === '9:16',
      }));
    },
    []
  );

  const handleChangeLiveProps = useCallback(
    (nextProps: Record<string, unknown>) => {
      if (!activeComposition) return;
      const compId = activeComposition.id;
      setSaveError(null);
      setPropsByComp((prev) => ({
        ...prev,
        [compId]: nextProps,
      }));
    },
    [activeComposition]
  );

  const savePropsToDisk = useCallback(
    async (
      compId: string,
      propsFile: string,
      propsPayload: Record<string, unknown>
    ) => {
      const serialized = JSON.stringify(propsPayload);
      setIsSaving(true);
      setSaveError(null);

      try {
        lastClientSavedJsonRef.current[compId] = serialized;
        const res = await fetch('/api/studio/props', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            propsFile,
            props: propsPayload,
          }),
        });

        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          savedAt?: string;
        };

        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? `Błąd zapisu HTTP ${res.status}`);
        }

        setSavedBaselineByComp((prev) => ({
          ...prev,
          [compId]: serialized,
        }));
        setLastSavedAt(data.savedAt ?? new Date().toISOString());
      } catch (err) {
        delete lastClientSavedJsonRef.current[compId];
        setSaveError(
          err instanceof Error
            ? err.message
            : 'Nie udało się zapisać pliku JSON'
        );
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  const handleSaveActive = useCallback(() => {
    if (!activeComposition || !isDirty || isSaving) return;
    void savePropsToDisk(
      activeComposition.id,
      activeComposition.propsFile,
      activeLiveProps
    );
  }, [
    activeComposition,
    isDirty,
    isSaving,
    savePropsToDisk,
    activeLiveProps,
  ]);

  const handleResetActive = useCallback(() => {
    if (!activeComposition) return;
    const compId = activeComposition.id;
    const baselineRaw = savedBaselineByComp[compId];
    const restored = baselineRaw
      ? (JSON.parse(baselineRaw) as Record<string, unknown>)
      : cloneProps(activeComposition.defaultProps);

    setSaveError(null);
    setPropsByComp((prev) => ({
      ...prev,
      [compId]: restored,
    }));
  }, [activeComposition, savedBaselineByComp]);

  // Debounced 450 ms Auto-Save for Film props
  useEffect(() => {
    if (
      viewMode !== 'films' ||
      !activeComposition ||
      !autoSave ||
      !isDirty ||
      isSaving
    ) {
      return;
    }
    const timer = setTimeout(() => {
      void savePropsToDisk(
        activeComposition.id,
        activeComposition.propsFile,
        activeLiveProps
      );
    }, 450);
    return () => clearTimeout(timer);
  }, [
    viewMode,
    activeComposition,
    autoSave,
    isDirty,
    isSaving,
    savePropsToDisk,
    activeLiveProps,
  ]);

  // ==================== STYLE LAB DERIVED MODELS & ACTIONS ====================
  const activeBaselineStyle = useMemo<StylePreset>(() => {
    const foundCustom = customStyles.find((s) => s.id === selectedStyleId);
    if (foundCustom) return foundCustom;
    if (isBuiltInStyleId(selectedStyleId)) {
      return BUILT_IN_STYLES[selectedStyleId];
    }
    return BUILT_IN_STYLES['minimal-product'];
  }, [customStyles, selectedStyleId]);

  const activeStyleId = activeBaselineStyle.id;
  const isActiveStyleBuiltIn = isBuiltInStyleId(activeStyleId);

  const activeLiveStyleRaw = useMemo<Record<string, unknown>>(
    () =>
      styleDraftsById[activeStyleId] ??
      (activeBaselineStyle as unknown as Record<string, unknown>),
    [styleDraftsById, activeStyleId, activeBaselineStyle]
  );

  const activeLiveStylePreset = useMemo<StylePreset>(() => {
    const parsed = StylePresetSchema.safeParse({
      ...activeLiveStyleRaw,
      id: activeStyleId,
    });
    if (parsed.success) {
      lastValidatedStyleRef.current = parsed.data;
      return parsed.data;
    }
    return lastValidatedStyleRef.current.id === activeStyleId
      ? lastValidatedStyleRef.current
      : activeBaselineStyle;
  }, [activeLiveStyleRaw, activeStyleId, activeBaselineStyle]);

  const activeStyleBaselineJson =
    savedStyleBaselineById[activeStyleId] ??
    JSON.stringify(activeBaselineStyle);
  const activeStyleLiveJson = useMemo(
    () => JSON.stringify(activeLiveStyleRaw),
    [activeLiveStyleRaw]
  );
  const isStyleDirty = activeStyleLiveJson !== activeStyleBaselineJson;

  const syntheticStyleComposition = useMemo<StudioCompositionEntry>(() => {
    const w = styleLabAspect === '9:16' ? 1080 : 1920;
    const h = styleLabAspect === '9:16' ? 1920 : 1080;
    return {
      id: `style-${activeStyleId}`,
      title: activeBaselineStyle.name,
      subtitle: activeBaselineStyle.description,
      group: isActiveStyleBuiltIn ? 'Style wbudowane' : 'Twoje style',
      kit: styleLabKit,
      component:
        StyleLabPreviewComposition as unknown as React.FC<
          Record<string, unknown>
        >,
      schema: StylePresetSchema,
      defaultProps: activeBaselineStyle as unknown as Record<string, unknown>,
      propsFile: isActiveStyleBuiltIn
        ? `built-in:${activeStyleId} (tylko odczyt)`
        : `styles/${activeStyleId}.style.json`,
      width: w,
      height: h,
      fps: STYLE_LAB_FPS,
      durationInFrames: STYLE_LAB_DURATION_IN_FRAMES,
      usesThree: false,
      sceneTimeline: [],
    };
  }, [
    activeStyleId,
    activeBaselineStyle,
    isActiveStyleBuiltIn,
    styleLabKit,
    styleLabAspect,
  ]);

  const handleSelectStyle = useCallback(
    (styleId: string) => {
      setSelectedStyleId(styleId);
      setStyleSaveError(null);
      setShowSaveAsCustomForm(false);
      setSaveAsSlugError(null);
      syncUrlParams('styles', styleId);
    },
    [syncUrlParams]
  );

  const handleOpenStyleLab = useCallback(
    (styleId: string) => {
      setSelectedStyleId(styleId);
      setStyleSaveError(null);
      setShowSaveAsCustomForm(false);
      setSaveAsSlugError(null);
      handleChangeViewMode('styles');
      syncUrlParams('styles', styleId);
    },
    [handleChangeViewMode, syncUrlParams]
  );

  const handleChangeStyleDraft = useCallback(
    (nextDraft: Record<string, unknown>) => {
      setStyleSaveError(null);
      setStyleDraftsById((prev) => ({
        ...prev,
        [activeStyleId]: {
          ...nextDraft,
          id: activeStyleId,
        },
      }));
    },
    [activeStyleId]
  );

  const persistStyleToServer = useCallback(
    async (
      targetSlug: string,
      stylePayload: Record<string, unknown>,
      switchAfterSave: boolean
    ): Promise<boolean> => {
      setIsSavingStyle(true);
      setStyleSaveError(null);

      try {
        const res = await fetch('/api/studio/styles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: targetSlug,
            style: {
              ...stylePayload,
              id: targetSlug,
            },
          }),
        });

        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          style?: StylePreset;
          savedAt?: string;
        };

        if (!res.ok || !data.ok || !data.style) {
          throw new Error(
            data.error ?? `Błąd zapisu stylu HTTP ${res.status}`
          );
        }

        const savedPreset = data.style;
        registerCustomStyles([savedPreset]);

        setCustomStyles((prev) => {
          const filtered = prev.filter((item) => item.id !== savedPreset.id);
          return [...filtered, savedPreset].sort((a, b) =>
            a.id.localeCompare(b.id)
          );
        });

        const serialized = JSON.stringify(savedPreset);
        setStyleDraftsById((prev) => ({
          ...prev,
          [savedPreset.id]: cloneProps(
            savedPreset as unknown as Record<string, unknown>
          ),
        }));
        setSavedStyleBaselineById((prev) => ({
          ...prev,
          [savedPreset.id]: serialized,
        }));
        setStyleLastSavedAt(data.savedAt ?? new Date().toISOString());

        if (switchAfterSave) {
          setSelectedStyleId(savedPreset.id);
          syncUrlParams('styles', savedPreset.id);
        }
        return true;
      } catch (err) {
        setStyleSaveError(
          err instanceof Error
            ? err.message
            : 'Nie udało się zapisać pliku *.style.json'
        );
        return false;
      } finally {
        setIsSavingStyle(false);
      }
    },
    [syncUrlParams]
  );

  const openSaveAsCustomPrompt = useCallback(() => {
    const existingIds = new Set(customStyles.map((s) => s.id));
    setSaveAsSlugDraft(suggestNewStyleSlug(activeStyleId, existingIds));
    setSaveAsSlugError(null);
    setShowSaveAsCustomForm(true);
  }, [activeStyleId, customStyles]);

  const handleSaveActiveStyle = useCallback(() => {
    if (isSavingStyle) return;
    if (isActiveStyleBuiltIn) {
      openSaveAsCustomPrompt();
      return;
    }
    if (!isStyleDirty) return;
    void persistStyleToServer(activeStyleId, activeLiveStyleRaw, false);
  }, [
    isSavingStyle,
    isActiveStyleBuiltIn,
    isStyleDirty,
    openSaveAsCustomPrompt,
    persistStyleToServer,
    activeStyleId,
    activeLiveStyleRaw,
  ]);

  const handleSubmitSaveAsCustom = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const cleaned = saveAsSlugDraft.trim().toLowerCase();
      if (!STYLE_SLUG_RE.test(cleaned)) {
        setSaveAsSlugError(
          'Podaj poprawny slug: małe litery, cyfry i myślniki (np. marka-pro).'
        );
        return;
      }
      if (isBuiltInStyleId(cleaned)) {
        setSaveAsSlugError(
          `Nazwa „${cleaned}” jest zarezerwowana dla stylu wbudowanego.`
        );
        return;
      }

      const humanName =
        activeLiveStyleRaw.name === activeBaselineStyle.name &&
        isActiveStyleBuiltIn
          ? `${activeBaselineStyle.name} (${cleaned})`
          : String(activeLiveStyleRaw.name ?? cleaned);

      const ok = await persistStyleToServer(
        cleaned,
        {
          ...activeLiveStyleRaw,
          id: cleaned,
          name: humanName,
        },
        true
      );
      if (ok) {
        setShowSaveAsCustomForm(false);
        setSaveAsSlugError(null);
      }
    },
    [
      saveAsSlugDraft,
      activeLiveStyleRaw,
      activeBaselineStyle.name,
      isActiveStyleBuiltIn,
      persistStyleToServer,
    ]
  );

  const handleDuplicateStyle = useCallback(
    async (newSlug: string, sourceStyle: StylePreset) => {
      const humanLabel = newSlug
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
      await persistStyleToServer(
        newSlug,
        {
          ...(sourceStyle as unknown as Record<string, unknown>),
          id: newSlug,
          name: humanLabel,
        },
        true
      );
    },
    [persistStyleToServer]
  );

  const handleResetActiveStyle = useCallback(() => {
    const baselineRaw = savedStyleBaselineById[activeStyleId];
    const restored = baselineRaw
      ? (JSON.parse(baselineRaw) as Record<string, unknown>)
      : cloneProps(activeBaselineStyle as unknown as Record<string, unknown>);

    setStyleSaveError(null);
    setStyleDraftsById((prev) => ({
      ...prev,
      [activeStyleId]: restored,
    }));
  }, [activeStyleId, savedStyleBaselineById, activeBaselineStyle]);

  // Debounced 450 ms Auto-Save for custom styles in Style Lab
  useEffect(() => {
    if (
      viewMode !== 'styles' ||
      isActiveStyleBuiltIn ||
      !styleAutoSave ||
      !isStyleDirty ||
      isSavingStyle
    ) {
      return;
    }
    const timer = setTimeout(() => {
      void persistStyleToServer(activeStyleId, activeLiveStyleRaw, false);
    }, 450);
    return () => clearTimeout(timer);
  }, [
    viewMode,
    isActiveStyleBuiltIn,
    styleAutoSave,
    isStyleDirty,
    isSavingStyle,
    persistStyleToServer,
    activeStyleId,
    activeLiveStyleRaw,
  ]);

  // Global Cmd/Ctrl + S (save) and Cmd/Ctrl + I (toggle inspector) shortcuts
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const key = e.key.toLowerCase();

      if (!e.shiftKey && key === 'i') {
        if (e.defaultPrevented) return;
        e.preventDefault();
        setInspectorOpen((prev) => !prev);
        return;
      }

      if (key === 's') {
        if (e.defaultPrevented) return;
        e.preventDefault();
        if (viewMode === 'styles') {
          handleSaveActiveStyle();
        } else {
          handleSaveActive();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewMode, handleSaveActive, handleSaveActiveStyle]);

  const styleLabRatioLabel =
    styleLabAspect === '9:16'
      ? '1080×1920 • 9:16 Shorts'
      : '1920×1080 • 16:9 HD';

  const topbarSharedProps = {
    compositions,
    activeComposition,
    onSelectComposition: handleSelectComposition,
    measuredFps,
    viewMode,
    onChangeViewMode: handleChangeViewMode,
    styleLabTitle: `${activeLiveStylePreset.name} (${activeStyleId})`,
    styleLabRatioLabel,
    builtInStyles,
    customStyles,
    activeStyleId,
    activeStyle: activeLiveStylePreset,
    styleWarnings,
    isSavingStyle,
    onSelectStyle: handleSelectStyle,
    onDuplicateStyle: handleDuplicateStyle,
    onRefreshStyles: handleRefreshStyles,
    isDirty: viewMode === 'styles' ? isStyleDirty : isDirty,
    themeMode,
    resolvedTheme,
    onCycleTheme: cycleThemeMode,
    onChangeThemeMode: setThemeMode,
  };

  // ==================== VIEW 1: STYLE LAB (60 FPS) ====================
  if (viewMode === 'styles') {
    const styleSaveAsBanner = isActiveStyleBuiltIn ? (
      <div className="mp-style-saveas-banner">
        <div className="mp-style-saveas-info">
          <Sparkles
            size={13}
            style={{ flexShrink: 0, color: 'var(--mp-brand-coral)' }}
            aria-hidden="true"
          />
          <span>
            Edytujesz podgląd presetu wbudowanego <code>{activeStyleId}</code>.
          </span>
        </div>

        {!showSaveAsCustomForm ? (
          <button
            type="button"
            className="mp-icon-btn is-primary"
            style={{ width: '100%', height: 31, fontSize: 11.5 }}
            disabled={isSavingStyle}
            onClick={openSaveAsCustomPrompt}
          >
            <CopyPlus size={13} />
            <span>Zapisz jako nowy własny styl…</span>
          </button>
        ) : (
          <form
            className="mp-style-dup-form"
            onSubmit={(e) => void handleSubmitSaveAsCustom(e)}
          >
            <input
              type="text"
              className="mp-input-text"
              style={{
                fontFamily: 'var(--mp-font-mono)',
                fontSize: 12,
              }}
              value={saveAsSlugDraft}
              autoFocus
              spellCheck={false}
              placeholder="np. moja-marka"
              aria-label="Slug nowego własnego stylu"
              onChange={(e) => {
                setSaveAsSlugDraft(e.target.value);
                setSaveAsSlugError(null);
              }}
            />
            {saveAsSlugError && (
              <div className="mp-style-inline-err">{saveAsSlugError}</div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="submit"
                className="mp-icon-btn is-primary"
                style={{ flex: 1, height: 29, fontSize: 11.5 }}
                disabled={isSavingStyle}
              >
                Zapisz do styles/
              </button>
              <button
                type="button"
                className="mp-icon-btn"
                style={{ height: 29, fontSize: 11.5 }}
                onClick={() => {
                  setShowSaveAsCustomForm(false);
                  setSaveAsSlugError(null);
                }}
              >
                Anuluj
              </button>
            </div>
          </form>
        )}
      </div>
    ) : undefined;

    return (
      <div className="mp-shell" data-theme={resolvedTheme}>
        <Topbar
          {...topbarSharedProps}
          isPlaying={isPlaying}
          inspectorOpen={inspectorOpen}
          onToggleInspector={handleToggleInspector}
        />

        <div
          className={`mp-workspace ${
            inspectorOpen ? '' : 'is-inspector-closed'
          }`.trim()}
        >
          <StyleLabShowcase
            activeStyle={activeLiveStylePreset}
            activeKit={styleLabKit}
            onSelectKit={setStyleLabKit}
            aspectRatio={styleLabAspect}
            onChangeAspectRatio={handleChangeStyleLabAspect}
            overlays={styleLabOverlays}
            onToggleOverlay={handleToggleStyleLabOverlay}
            onPlayingChange={setIsPlaying}
            onFpsMeasure={setMeasuredFps}
          />

          <PropsInspector
            mode="styles"
            composition={syntheticStyleComposition}
            liveProps={activeLiveStyleRaw}
            isDirty={isStyleDirty}
            isSaving={isSavingStyle}
            autoSave={isActiveStyleBuiltIn ? false : styleAutoSave}
            saveError={styleSaveError}
            lastSavedAt={styleLastSavedAt}
            onChangeProps={handleChangeStyleDraft}
            onSave={handleSaveActiveStyle}
            onToggleAutoSave={() => {
              if (isActiveStyleBuiltIn) {
                openSaveAsCustomPrompt();
              } else {
                setStyleAutoSave((v) => !v);
              }
            }}
            onResetToDisk={handleResetActiveStyle}
            availableStyles={availableStyles}
            isMobileOpen={inspectorOpen}
            onCloseMobile={() => setInspectorOpen(false)}
            styleSaveAsBanner={styleSaveAsBanner}
          />
        </div>

        <div
          className={`mp-inspector-backdrop ${
            inspectorOpen ? '' : 'is-hidden'
          }`.trim()}
          onClick={() => setInspectorOpen(false)}
          aria-hidden="true"
        />
      </div>
    );
  }

  // ==================== VIEW 2: EMPTY PRODUCTIONS WELCOME ====================
  if (!activeComposition) {
    return (
      <div className="mp-shell" data-theme={resolvedTheme}>
        <Topbar {...topbarSharedProps} activeComposition={null} isPlaying={false} />

        <main className="mp-empty-studio-screen">
          <div className="mp-empty-studio-card">
            <div className="mp-empty-studio-icon">
              <BrandMarkSvg size={54} title="make.pictures" />
            </div>
            <h1 className="mp-empty-studio-heading">
              Gotowe do pracy — utwórz swój pierwszy film
            </h1>
            <p className="mp-empty-studio-copy">
              W katalogu <code>productions/</code> nie ma jeszcze żadnej kapsuły
              wideo. Wybierz kierunek plastyczny w <strong>Style Lab</strong>{' '}
              lub wygeneruj nowy projekt z terminala / przez agenta AI:
            </p>
            <div className="mp-empty-studio-commands">
              <div className="mp-empty-studio-cmd-row">
                <Terminal
                  size={13}
                  style={{ flexShrink: 0, color: 'var(--mp-accent)' }}
                  aria-hidden="true"
                />
                <code>npx make-pictures new moj-pierwszy-film</code>
              </div>
              <div className="mp-empty-studio-cmd-row">
                <Terminal
                  size={13}
                  style={{ flexShrink: 0, color: 'var(--mp-emerald)' }}
                  aria-hidden="true"
                />
                <code>npx make-pictures audio --production=moj-pierwszy-film</code>
              </div>
            </div>

            <div className="mp-empty-studio-actions">
              <button
                type="button"
                className="mp-icon-btn is-primary"
                style={{ height: 38, padding: '0 16px', fontSize: 12.5 }}
                onClick={() => handleChangeViewMode('styles')}
              >
                <span>🎨 Otwórz Style Lab (podgląd stylów 60 FPS)</span>
              </button>

              <button
                type="button"
                className="mp-icon-btn"
                style={{ height: 38, padding: '0 14px', fontSize: 12.5 }}
                onClick={() => window.location.reload()}
              >
                <RefreshCw size={13} />
                <span>Odśwież widok Studio</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ==================== VIEW 3: FILMS WORKSPACE ====================
  return (
    <div className="mp-shell" data-theme={resolvedTheme}>
      <Topbar
        {...topbarSharedProps}
        isPlaying={isPlaying}
        inspectorOpen={inspectorOpen}
        onToggleInspector={handleToggleInspector}
      />

      <div
        className={`mp-workspace ${
          inspectorOpen ? '' : 'is-inspector-closed'
        }`.trim()}
      >
        <StageViewport
          composition={activeComposition}
          inputProps={activeLiveProps}
          overlays={overlays}
          onToggleOverlay={handleToggleOverlay}
          onPlayingChange={setIsPlaying}
          onFpsMeasure={setMeasuredFps}
        />

        <PropsInspector
          mode="films"
          composition={activeComposition}
          liveProps={activeLiveProps}
          isDirty={isDirty}
          isSaving={isSaving}
          autoSave={autoSave}
          saveError={saveError}
          lastSavedAt={lastSavedAt}
          onChangeProps={handleChangeLiveProps}
          onSave={handleSaveActive}
          onToggleAutoSave={() => setAutoSave((v) => !v)}
          onResetToDisk={handleResetActive}
          availableStyles={availableStyles}
          onOpenStyleLab={handleOpenStyleLab}
          scenesResponse={scenesResponse}
          studioStatus={studioStatus}
          onSaveScene={handleSaveScene}
          onRefreshScenesAndStatus={handleRefreshScenesAndStatus}
          isMobileOpen={inspectorOpen}
          onCloseMobile={() => setInspectorOpen(false)}
        />
      </div>

      <div
        className={`mp-inspector-backdrop ${
          inspectorOpen ? '' : 'is-hidden'
        }`.trim()}
        onClick={() => setInspectorOpen(false)}
        aria-hidden="true"
      />
    </div>
  );
};
