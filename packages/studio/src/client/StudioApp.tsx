import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Terminal } from 'lucide-react';
import {
  isVerticalComposition,
  type StudioCompositionEntry,
} from '@make-pictures/core';
import { BrandLogo, BrandMarkSvg } from './components/BrandLogo';
import { LeftSidebar } from './components/LeftSidebar';
import { PropsInspector } from './components/PropsInspector';
import { StageViewport } from './components/StageViewport';
import { Topbar } from './components/Topbar';
import type { OverlaySettings, StudioStatusResponse } from './types';

export interface StudioAppProps {
  compositions?: StudioCompositionEntry[];
}

const EMPTY_COMPOSITIONS: StudioCompositionEntry[] = [];

function findComposition(
  list: StudioCompositionEntry[],
  id: string
): StudioCompositionEntry | undefined {
  return list.find((item) => item.id === id);
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

function cloneProps(obj: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(obj)) as Record<string, unknown>;
}

export const StudioApp: React.FC<StudioAppProps> = ({
  compositions = EMPTY_COMPOSITIONS,
}) => {
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

  // Props Inspector state (per composition)
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

  // Bidirectional HMR sync: if an external AI agent edits *.props.json on disk,
  // adopt the new disk defaults automatically without clobbering our own save echo.
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
  const isDirty = Boolean(activeComposition) && activeLiveJson !== activeBaselineJson;

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

  useEffect(() => {
    void fetchStudioStatus();
  }, [fetchStudioStatus]);

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
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('comp', id);
        window.history.replaceState({}, '', url.toString());
      }
    },
    [compositions]
  );

  const handleToggleOverlay = useCallback((key: keyof OverlaySettings) => {
    setOverlays((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

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

  // Debounced 450 ms Auto-Save when enabled
  useEffect(() => {
    if (!activeComposition || !autoSave || !isDirty || isSaving) return;
    const timer = setTimeout(() => {
      void savePropsToDisk(
        activeComposition.id,
        activeComposition.propsFile,
        activeLiveProps
      );
    }, 450);
    return () => clearTimeout(timer);
  }, [
    activeComposition,
    autoSave,
    isDirty,
    isSaving,
    savePropsToDisk,
    activeLiveProps,
  ]);

  // Global Cmd/Ctrl + S shortcut for immediate props persistence
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveActive();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSaveActive]);

  if (!activeComposition) {
    return (
      <div className="mp-shell">
        <header className="mp-topbar">
          <a
            href="https://make.pictures"
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: 'none' }}
            aria-label="make.pictures"
          >
            <BrandLogo size="sm" />
          </a>
        </header>

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
              wideo. Wygeneruj nowy projekt filmowy z poziomu terminala lub
              poproś o to swojego agenta AI:
            </p>
            <div className="mp-empty-studio-commands">
              <div className="mp-empty-studio-cmd-row">
                <Terminal size={13} color="#A5B4FC" />
                <code>npx make-pictures new my-first-film --kit=paper-diorama-3d</code>
              </div>
              <div className="mp-empty-studio-cmd-row">
                <Terminal size={13} color="#6EE7B7" />
                <code>npx make-pictures audio --production=my-first-film</code>
              </div>
            </div>
            <button
              type="button"
              className="mp-icon-btn is-primary"
              style={{ marginTop: 8, height: 36 }}
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={13} />
              <span>Odśwież widok Studio</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="mp-shell">
      <Topbar
        compositions={compositions}
        activeComposition={activeComposition}
        onSelectComposition={handleSelectComposition}
        measuredFps={measuredFps}
        isPlaying={isPlaying}
      />

      <div className="mp-workspace">
        <LeftSidebar
          compositions={compositions}
          activeComposition={activeComposition}
          onSelectComposition={handleSelectComposition}
          studioStatus={studioStatus}
          onRefreshStatus={fetchStudioStatus}
        />

        <StageViewport
          composition={activeComposition}
          inputProps={activeLiveProps}
          overlays={overlays}
          onToggleOverlay={handleToggleOverlay}
          onPlayingChange={setIsPlaying}
          onFpsMeasure={setMeasuredFps}
        />

        <PropsInspector
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
        />
      </div>
    </div>
  );
};
