import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Player } from '@remotion/player';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Film,
  FolderOpen,
  Grid3x3,
  Layers,
  LayoutGrid,
  Loader2,
  Maximize2,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Scan,
  Smartphone,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  isVerticalComposition,
  type StudioCompositionEntry,
} from '@make-pictures/core';
import { useRemotionPlayer } from '../hooks/useRemotionPlayer';
import { consumePostSseStream } from '../sseClient';
import type { OverlaySettings } from '../types';
import { DirectorOverlays } from './DirectorOverlays';
import { DirectorTimelinePanel } from './DirectorTimelinePanel';
import { LiveTranscriptBar } from './LiveTranscriptBar';
import { StageErrorBoundary, StageErrorCard } from './StageErrorBoundary';

/**
 * Shared silent `<Html5Audio />` pool size pre-mounted by `@remotion/player` in Studio Web.
 * Remotion defaults to `5`, which overflows in multi-scene films with music + dialogue + layered SFX.
 */
export const STUDIO_SHARED_AUDIO_TAGS = 32;

export interface StageViewportProps {
  composition: StudioCompositionEntry;
  inputProps: Record<string, unknown>;
  overlays: OverlaySettings;
  onToggleOverlay: (key: keyof OverlaySettings) => void;
  onFrameChange?: (frame: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  onFpsMeasure?: (fps: number) => void;
}

type DrawerSubView = 'all' | 'timeline' | 'transcript';

function formatTimecode(frame: number, fps: number): string {
  const safeFps = fps > 0 ? fps : 60;
  const totalSec = Math.max(0, frame) / safeFps;
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  const hundredths = Math.floor((totalSec - Math.floor(totalSec)) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(
    2,
    '0'
  )}.${String(hundredths).padStart(2, '0')}`;
}

const preventButtonFocus = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.preventDefault();
};

export const StageViewport: React.FC<StageViewportProps> = ({
  composition,
  inputProps,
  overlays,
  onToggleOverlay,
  onFrameChange,
  onPlayingChange,
  onFpsMeasure,
}) => {
  const stageAreaRef = useRef<HTMLDivElement>(null);
  const overlaysMenuRef = useRef<HTMLDivElement>(null);

  const {
    playerRefCallback,
    displayFrame,
    currentFrameRef,
    isPlaying,
    loop,
    setLoop,
    muted,
    toggleMute,
    seekToFrame,
    togglePlay,
    pause,
  } = useRemotionPlayer({
    fps: composition.fps,
    durationInFrames: composition.durationInFrames,
    resetKey: composition.id,
    initialFrame: 0,
    onFrameChange,
    onPlayingChange,
    onFpsMeasure,
  });

  const [stageBox, setStageBox] = useState<{ w: number; h: number }>({
    w: 960,
    h: 540,
  });
  const [retryNonce, setRetryNonce] = useState<number>(0);
  const [webglLostError, setWebglLostError] = useState<Error | null>(null);

  // Floating Liquid Glass controls state
  const [overlaysMenuOpen, setOverlaysMenuOpen] = useState<boolean>(false);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerSubView, setDrawerSubView] = useState<DrawerSubView>('all');

  // Root-level QA Contact Sheet state (shared between "Kadr & QA" popover and bottom drawer)
  const [qaState, setQaState] = useState<{
    status: 'idle' | 'running' | 'done' | 'error';
    contactSheetUrl: string | null;
    outputFile: string | null;
    error: string | null;
  }>({
    status: 'idle',
    contactSheetUrl: null,
    outputFile: null,
    error: null,
  });
  const [showQaModal, setShowQaModal] = useState<boolean>(false);

  useEffect(() => {
    setQaState({
      status: 'idle',
      contactSheetUrl: null,
      outputFile: null,
      error: null,
    });
    setShowQaModal(false);
  }, [composition.id]);

  // Local 60 FPS MP4 render state
  const renderAbortRef = useRef<AbortController | null>(null);
  const [renderState, setRenderState] = useState<{
    status: 'idle' | 'running' | 'done' | 'error';
    percent: number;
    label: string;
    outputFile: string | null;
  }>({
    status: 'idle',
    percent: 0,
    label: '',
    outputFile: null,
  });

  useEffect(() => {
    return () => {
      renderAbortRef.current?.abort();
    };
  }, []);

  // Close "Kadr & QA" popover and QA modal on Escape / outside pointerdown
  useEffect(() => {
    if (!overlaysMenuOpen && !showQaModal) return;
    if (typeof window === 'undefined') return;

    const onPointerDown = (e: MouseEvent | PointerEvent) => {
      if (!overlaysMenuOpen) return;
      const wrap = overlaysMenuRef.current;
      if (wrap && !wrap.contains(e.target as Node)) {
        setOverlaysMenuOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (overlaysMenuOpen) {
          setOverlaysMenuOpen(false);
        } else if (showQaModal) {
          setShowQaModal(false);
        }
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [overlaysMenuOpen, showQaModal]);

  const handleStartRender = useCallback(async () => {
    if (renderState.status === 'running') return;
    pause();

    const controller = new AbortController();
    renderAbortRef.current = controller;

    setRenderState({
      status: 'running',
      percent: 2,
      label: `Inicjalizacja renderera 60 FPS (${composition.id})…`,
      outputFile: null,
    });

    try {
      await consumePostSseStream<{
        type: 'progress' | 'done' | 'error' | 'cancelled';
        percent?: number;
        label?: string;
        outputFile?: string;
        error?: string;
        message?: string;
      }>(
        '/api/studio/render',
        {
          compositionId: composition.id,
          usesThree: composition.usesThree,
          props: inputProps,
        },
        (evt) => {
          if (evt.type === 'progress') {
            setRenderState((prev) => ({
              status: 'running',
              percent: evt.percent ?? prev.percent,
              label: evt.label ?? prev.label,
              outputFile: evt.outputFile ?? prev.outputFile,
            }));
          } else if (evt.type === 'done') {
            setRenderState({
              status: 'done',
              percent: 100,
              label: `Wyrenderowano plik MP4 (${composition.fps} FPS)`,
              outputFile: evt.outputFile ?? null,
            });
          } else if (evt.type === 'cancelled') {
            setRenderState({
              status: 'idle',
              percent: 0,
              label: '',
              outputFile: null,
            });
          } else if (evt.type === 'error') {
            setRenderState({
              status: 'error',
              percent: 0,
              label: evt.error ?? 'Błąd podczas renderowania MP4',
              outputFile: null,
            });
          }
        },
        controller.signal
      );
    } catch (err) {
      if (controller.signal.aborted) {
        setRenderState({
          status: 'idle',
          percent: 0,
          label: '',
          outputFile: null,
        });
        return;
      }
      setRenderState({
        status: 'error',
        percent: 0,
        label:
          err instanceof Error ? err.message : 'Nie udało się uruchomić renderu',
        outputFile: null,
      });
    } finally {
      if (renderAbortRef.current === controller) {
        renderAbortRef.current = null;
      }
    }
  }, [
    renderState.status,
    pause,
    composition.id,
    composition.usesThree,
    composition.fps,
    inputProps,
  ]);

  const handleCancelRender = useCallback(() => {
    renderAbortRef.current?.abort();
    renderAbortRef.current = null;
    setRenderState({
      status: 'idle',
      percent: 0,
      label: '',
      outputFile: null,
    });
  }, []);

  const handleOpenOutput = useCallback(async (outputFile: string | null) => {
    try {
      await fetch('/api/studio/open-output', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputFile: outputFile ?? undefined }),
      });
    } catch {
      // ignore offline
    }
  }, []);

  const handleGenerateQaSheet = useCallback(async () => {
    if (qaState.status === 'running') return;
    pause();
    setQaState({
      status: 'running',
      contactSheetUrl: null,
      outputFile: null,
      error: null,
    });

    try {
      const res = await fetch('/api/studio/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compositionId: composition.id }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        contactSheetUrl?: string;
        outputFile?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.contactSheetUrl) {
        throw new Error(
          data.error ?? `Nie udało się wygenerować arkusza QA (HTTP ${res.status})`
        );
      }

      setQaState({
        status: 'done',
        contactSheetUrl: data.contactSheetUrl,
        outputFile: data.outputFile ?? null,
        error: null,
      });
      setShowQaModal(true);
    } catch (err) {
      setQaState({
        status: 'error',
        contactSheetUrl: null,
        outputFile: null,
        error:
          err instanceof Error
            ? err.message
            : 'Błąd podczas generowania arkusza QA',
      });
    }
  }, [composition.id, pause, qaState.status]);

  // Fit 16:9 or 9:16 composition cleanly into center stage viewport with generous breathing room
  useEffect(() => {
    const el = stageAreaRef.current;
    if (!el) return;

    const computeFit = () => {
      const rect = el.getBoundingClientRect();
      const padX = rect.width < 640 ? 20 : 52;
      const padY = rect.height < 480 ? 20 : 36;
      const availW = Math.max(200, rect.width - padX);
      const availH = Math.max(150, rect.height - padY);
      const aspect = composition.width / composition.height;

      let fitW = availW;
      let fitH = fitW / aspect;
      if (fitH > availH) {
        fitH = availH;
        fitW = fitH * aspect;
      }

      setStageBox({
        w: Math.round(fitW),
        h: Math.round(fitH),
      });
    };

    computeFit();
    const ro = new ResizeObserver(computeFit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [composition.width, composition.height]);

  // Guard against WebGL context loss during heavy 3D sessions
  useEffect(() => {
    const el = stageAreaRef.current;
    if (!el) return;

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglLostError(
        new Error(
          'WebGL context lost: Przeglądarka zwolniła kontekst GPU. Kliknij „Spróbuj ponownie”, aby bezpiecznie odtworzyć scenę 3D.'
        )
      );
    };

    const onContextRestored = () => {
      setWebglLostError(null);
      setRetryNonce((n) => n + 1);
    };

    el.addEventListener('webglcontextlost', onContextLost, true);
    el.addEventListener('webglcontextrestored', onContextRestored, true);
    return () => {
      el.removeEventListener('webglcontextlost', onContextLost, true);
      el.removeEventListener('webglcontextrestored', onContextRestored, true);
    };
  }, []);

  const handleRetry = useCallback(() => {
    setWebglLostError(null);
    setRetryNonce((n) => n + 1);
  }, []);

  const renderPlayerErrorFallback = useCallback(
    ({ error }: { error: Error }) => (
      <StageErrorCard
        error={error}
        composition={composition}
        frame={currentFrameRef.current}
        propsSnapshot={inputProps}
        onRetry={handleRetry}
      />
    ),
    [composition, currentFrameRef, inputProps, handleRetry]
  );

  const isVertical = isVerticalComposition(composition);
  const maxFrameIndex = Math.max(0, composition.durationInFrames - 1);
  const hasActiveOverlay =
    overlays.goldenSafeBox || overlays.ruleOfThirds || overlays.safeMargins;
  const componentSignature = `${composition.id}:${retryNonce}:${String(
    composition.component
  ).slice(0, 64)}`;

  return (
    <main className="mp-center-col">
      {/* ==================== INLINE MP4 RENDER PROGRESS BANNER ==================== */}
      {renderState.status !== 'idle' && (
        <div
          className={`mp-render-banner ${
            renderState.status === 'done'
              ? 'is-done'
              : renderState.status === 'error'
              ? 'is-error'
              : ''
          }`}
        >
          <div className="mp-render-top">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 600,
                minWidth: 0,
                color:
                  renderState.status === 'done'
                    ? 'var(--mp-emerald-text)'
                    : renderState.status === 'error'
                    ? 'var(--mp-rose-text)'
                    : 'var(--mp-text-primary)',
              }}
            >
              {renderState.status === 'done' && (
                <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
              )}
              {renderState.status === 'error' && (
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
              )}
              {renderState.status === 'running' && (
                <Loader2
                  size={14}
                  className="mp-spin"
                  style={{ color: 'var(--mp-accent)', flexShrink: 0 }}
                />
              )}
              <span>{renderState.label}</span>
              {renderState.outputFile && (
                <code
                  style={{
                    fontFamily: 'var(--mp-font-mono)',
                    fontSize: 11,
                    backgroundColor: 'var(--mp-bg-subtle)',
                    border: '0.5px solid var(--mp-border-hairline)',
                    color: 'var(--mp-text-secondary)',
                    padding: '2px 7px',
                    borderRadius: 6,
                  }}
                >
                  {renderState.outputFile}
                </code>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {renderState.status === 'running' && (
                <>
                  <span
                    className="mp-tabular"
                    style={{
                      fontFamily: 'var(--mp-font-mono)',
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: 'var(--mp-accent)',
                    }}
                  >
                    {renderState.percent}%
                  </span>
                  <button
                    type="button"
                    className="mp-icon-btn"
                    style={{ height: 26, fontSize: 11, padding: '0 9px' }}
                    onMouseDown={preventButtonFocus}
                    onClick={handleCancelRender}
                  >
                    Anuluj
                  </button>
                </>
              )}

              {renderState.status === 'done' && (
                <button
                  type="button"
                  className="mp-icon-btn"
                  style={{
                    height: 27,
                    fontSize: 11.5,
                    borderColor: 'var(--mp-emerald-border)',
                    backgroundColor: 'var(--mp-emerald-soft)',
                    color: 'var(--mp-emerald-text)',
                  }}
                  onMouseDown={preventButtonFocus}
                  onClick={() => void handleOpenOutput(renderState.outputFile)}
                >
                  <FolderOpen size={13} />
                  <span>Pokaż w folderze out/</span>
                </button>
              )}

              {renderState.status !== 'running' && (
                <button
                  type="button"
                  className="mp-icon-btn is-ghost"
                  style={{ height: 26, padding: '0 6px' }}
                  onMouseDown={preventButtonFocus}
                  onClick={() =>
                    setRenderState({
                      status: 'idle',
                      percent: 0,
                      label: '',
                      outputFile: null,
                    })
                  }
                  title="Zamknij komunikat"
                  aria-label="Zamknij komunikat"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {renderState.status === 'running' && (
            <div className="mp-render-progress-track">
              <div
                className="mp-render-progress-fill"
                style={{ width: `${renderState.percent}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* ==================== QA SHEET STATUS BANNER (WHEN DRAWER CLOSED) ==================== */}
      {!drawerOpen &&
        (qaState.status === 'running' || qaState.status === 'error') && (
          <div
            className={`mp-render-banner ${
              qaState.status === 'error' ? 'is-error' : ''
            }`}
          >
            <div className="mp-render-top">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontWeight: 600,
                  color:
                    qaState.status === 'error'
                      ? 'var(--mp-rose-text)'
                      : 'var(--mp-text-primary)',
                }}
              >
                {qaState.status === 'running' ? (
                  <Loader2
                    size={14}
                    className="mp-spin"
                    style={{ color: 'var(--mp-accent)', flexShrink: 0 }}
                  />
                ) : (
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                )}
                <span>
                  {qaState.status === 'running'
                    ? `Generowanie arkusza kontrolnego QA (12 klatek) dla ${composition.id}…`
                    : qaState.error ?? 'Błąd podczas generowania arkusza QA'}
                </span>
              </div>

              {qaState.status === 'error' && (
                <button
                  type="button"
                  className="mp-icon-btn is-ghost"
                  style={{ height: 26, padding: '0 6px' }}
                  onMouseDown={preventButtonFocus}
                  onClick={() =>
                    setQaState({
                      status: 'idle',
                      contactSheetUrl: null,
                      outputFile: null,
                      error: null,
                    })
                  }
                  aria-label="Zamknij komunikat błędu QA"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        )}

      {/* ==================== 60 FPS STAGE VIEWPORT ==================== */}
      <div className="mp-stage-canvas-area" ref={stageAreaRef}>
        <div
          className="mp-player-frame"
          style={{ width: stageBox.w, height: stageBox.h }}
        >
          {webglLostError ? (
            <StageErrorCard
              error={webglLostError}
              composition={composition}
              frame={currentFrameRef.current}
              propsSnapshot={inputProps}
              onRetry={handleRetry}
            />
          ) : (
            <StageErrorBoundary
              resetKey={componentSignature}
              composition={composition}
              getCurrentFrame={() => currentFrameRef.current}
              propsSnapshot={inputProps}
              onManualRetry={handleRetry}
            >
              <Player
                key={`${composition.id}:${retryNonce}`}
                ref={playerRefCallback}
                component={composition.component}
                inputProps={inputProps}
                durationInFrames={composition.durationInFrames}
                compositionWidth={composition.width}
                compositionHeight={composition.height}
                fps={composition.fps}
                initialFrame={Math.min(currentFrameRef.current, maxFrameIndex)}
                loop={loop}
                controls={false}
                clickToPlay={true}
                spaceKeyToPlayOrPause={false}
                initiallyMuted={muted}
                numberOfSharedAudioTags={STUDIO_SHARED_AUDIO_TAGS}
                acknowledgeRemotionLicense={true}
                errorFallback={renderPlayerErrorFallback}
                style={{
                  width: '100%',
                  height: '100%',
                }}
              />
            </StageErrorBoundary>
          )}

          {/* Pixel-exact SVG Composition Overlays */}
          <DirectorOverlays
            width={composition.width}
            height={composition.height}
            overlays={overlays}
          />
        </div>
      </div>

      {/* ==================== FLOATING LIQUID GLASS TRANSPORT CAPSULE ==================== */}
      <div className="mp-floating-dock-wrap">
        <div
          className="mp-floating-transport"
          style={{ width: 'min(960px, 100%)' }}
          role="region"
          aria-label="Sterowanie odtwarzaniem i eksportem"
        >
          {/* Primary Play/Pause FAB */}
          <button
            type="button"
            className="mp-play-fab"
            aria-label={isPlaying ? 'Pauza' : 'Odtwarzaj'}
            title={isPlaying ? 'Pauza (Spacja / K)' : 'Odtwarzaj (Spacja / K)'}
            onMouseDown={preventButtonFocus}
            onClick={togglePlay}
          >
            {isPlaying ? (
              <Pause size={16} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" style={{ marginLeft: 1.5 }} />
            )}
          </button>

          {/* Compact Frame Steppers (-10, -1, +1, +10, Klatka 0) */}
          <div className="mp-transport-step-group" role="group" aria-label="Nawigacja klatkowa">
            <button
              type="button"
              className="mp-icon-btn"
              onMouseDown={preventButtonFocus}
              onClick={() => {
                pause();
                seekToFrame(displayFrame - 10);
              }}
              title="-10 klatek (J / Shift + ←)"
              aria-label="Cofnij o 10 klatek"
            >
              <ChevronsLeft size={14} />
            </button>

            <button
              type="button"
              className="mp-icon-btn"
              onMouseDown={preventButtonFocus}
              onClick={() => {
                pause();
                seekToFrame(displayFrame - 1);
              }}
              title="-1 klatka (←)"
              aria-label="Poprzednia klatka"
            >
              <ChevronLeft size={14} />
            </button>

            <button
              type="button"
              className="mp-icon-btn"
              onMouseDown={preventButtonFocus}
              onClick={() => {
                pause();
                seekToFrame(displayFrame + 1);
              }}
              title="+1 klatka (→)"
              aria-label="Następna klatka"
            >
              <ChevronRight size={14} />
            </button>

            <button
              type="button"
              className="mp-icon-btn"
              onMouseDown={preventButtonFocus}
              onClick={() => {
                pause();
                seekToFrame(displayFrame + 10);
              }}
              title="+10 klatek (L / Shift + →)"
              aria-label="Przeskocz o 10 klatek"
            >
              <ChevronsRight size={14} />
            </button>

            <button
              type="button"
              className="mp-icon-btn"
              onMouseDown={preventButtonFocus}
              onClick={() => {
                pause();
                seekToFrame(0);
              }}
              title="Klatka 0 — weryfikacja czystego tła startowego (0 / Home)"
              aria-label="Skocz do klatki 0"
            >
              <RotateCcw size={13} />
            </button>
          </div>

          {/* Smooth Scrubber + Tabular Timecode Pill */}
          <div className="mp-scrubber-wrap">
            <input
              type="range"
              className="mp-timeline-slider"
              min={0}
              max={Math.max(1, maxFrameIndex)}
              value={Math.min(displayFrame, maxFrameIndex)}
              aria-label="Oś czasu klatek"
              onChange={(e) => {
                pause();
                seekToFrame(Number(e.target.value));
              }}
            />
            <span className="mp-timecode-pill mp-tabular">
              {formatTimecode(displayFrame, composition.fps)} • f:{displayFrame}/
              {maxFrameIndex}
            </span>
          </div>

          {/* Loop & Mute Toggles */}
          <div className="mp-transport-step-group" role="group" aria-label="Pętla i dźwięk">
            <button
              type="button"
              className={`mp-icon-btn ${loop ? 'is-active' : ''}`}
              aria-pressed={loop}
              aria-label="Zapętlanie odtwarzania"
              title={loop ? 'Pętla włączona' : 'Pętla wyłączona'}
              onMouseDown={preventButtonFocus}
              onClick={() => setLoop((v) => !v)}
            >
              <Repeat size={14} />
            </button>

            <button
              type="button"
              className={`mp-icon-btn ${muted ? 'is-active' : ''}`}
              aria-pressed={muted}
              aria-label={muted ? 'Włącz dźwięk' : 'Wycisz podgląd'}
              title={muted ? 'Włącz dźwięk' : 'Wycisz podgląd'}
              onMouseDown={preventButtonFocus}
              onClick={toggleMute}
            >
              {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
          </div>

          {/* "Kadr & QA" Liquid Glass Popover Menu */}
          <div className="mp-overlays-popover-wrap" ref={overlaysMenuRef}>
            <button
              type="button"
              className={`mp-drawer-toggle-btn ${
                overlaysMenuOpen || hasActiveOverlay ? 'is-active' : ''
              }`}
              aria-haspopup="menu"
              aria-expanded={overlaysMenuOpen}
              title="Linie pomocnicze kadru i arkusz kontrolny QA (12 klatek)"
              onMouseDown={preventButtonFocus}
              onClick={() => setOverlaysMenuOpen((v) => !v)}
            >
              <Scan size={13} />
              <span>Kadr &amp; QA</span>
            </button>

            {overlaysMenuOpen && (
              <div
                className="mp-overlays-popover"
                role="menu"
                aria-label="Kadr i narzędzia QA"
              >
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={overlays.goldenSafeBox}
                  className={`mp-overlays-popover-item ${
                    overlays.goldenSafeBox ? 'is-active' : ''
                  }`}
                  onMouseDown={preventButtonFocus}
                  onClick={() => onToggleOverlay('goldenSafeBox')}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Smartphone size={14} />
                    <span>
                      Bezpieczny kadr (Golden Safe Box){' '}
                      {isVertical ? '9:16' : ''}
                    </span>
                  </span>
                  {overlays.goldenSafeBox && <Check size={14} />}
                </button>

                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={overlays.ruleOfThirds}
                  className={`mp-overlays-popover-item ${
                    overlays.ruleOfThirds ? 'is-active' : ''
                  }`}
                  onMouseDown={preventButtonFocus}
                  onClick={() => onToggleOverlay('ruleOfThirds')}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Grid3x3 size={14} />
                    <span>Siatka kompozycyjna 3×3</span>
                  </span>
                  {overlays.ruleOfThirds && <Check size={14} />}
                </button>

                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={overlays.safeMargins}
                  className={`mp-overlays-popover-item ${
                    overlays.safeMargins ? 'is-active' : ''
                  }`}
                  onMouseDown={preventButtonFocus}
                  onClick={() => onToggleOverlay('safeMargins')}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Maximize2 size={14} />
                    <span>Bezpieczne marginesy 16:9</span>
                  </span>
                  {overlays.safeMargins && <Check size={14} />}
                </button>

                <div
                  style={{
                    height: '0.5px',
                    backgroundColor: 'var(--mp-border-hairline)',
                    margin: '3px 6px',
                  }}
                />

                <button
                  type="button"
                  role="menuitem"
                  className="mp-overlays-popover-item"
                  onMouseDown={preventButtonFocus}
                  onClick={() => {
                    pause();
                    seekToFrame(0);
                    setOverlaysMenuOpen(false);
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <RotateCcw size={14} />
                    <span>Skocz do klatki 0</span>
                  </span>
                  <span className="mp-mini-badge">f:0</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  className={`mp-overlays-popover-item ${
                    qaState.status === 'done' ? 'is-active' : ''
                  }`}
                  disabled={qaState.status === 'running'}
                  onMouseDown={preventButtonFocus}
                  onClick={() => {
                    setOverlaysMenuOpen(false);
                    void handleGenerateQaSheet();
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {qaState.status === 'running' ? (
                      <Loader2 size={14} className="mp-spin" />
                    ) : (
                      <LayoutGrid size={14} />
                    )}
                    <span>
                      {qaState.status === 'running'
                        ? 'Renderowanie QA (12 klatek)…'
                        : 'Arkusz QA (12 klatek)'}
                    </span>
                  </span>
                </button>

                {qaState.status === 'done' && qaState.contactSheetUrl && (
                  <button
                    type="button"
                    role="menuitem"
                    className="mp-overlays-popover-item"
                    onMouseDown={preventButtonFocus}
                    onClick={() => {
                      setOverlaysMenuOpen(false);
                      setShowQaModal(true);
                    }}
                  >
                    <span
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    >
                      <ExternalLink size={14} />
                      <span>Podgląd ostatniego arkusza QA</span>
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Expandable Bottom Timeline & Transcript Drawer Toggle Pill */}
          <button
            type="button"
            className={`mp-drawer-toggle-btn ${drawerOpen ? 'is-active' : ''}`}
            aria-expanded={drawerOpen}
            title={
              drawerOpen
                ? 'Zwiń oś reżyserską i transkrypt'
                : 'Pokaż wielościeżkową oś reżyserską i transkrypt słów'
            }
            onMouseDown={preventButtonFocus}
            onClick={() => setDrawerOpen((v) => !v)}
          >
            <Layers size={13} />
            <span>Oś czasu</span>
          </button>

          {/* Primary Eksportuj MP4 Pill Button */}
          <button
            type="button"
            className="mp-icon-btn is-primary"
            style={{
              height: 34,
              borderRadius: 999,
              fontSize: 12,
              padding: '0 13px',
              flexShrink: 0,
            }}
            disabled={renderState.status === 'running'}
            onMouseDown={preventButtonFocus}
            onClick={() => void handleStartRender()}
            title={`Eksportuj ${composition.id} do pliku MP4 (${composition.fps} FPS${
              composition.usesThree ? ', --gl=angle' : ''
            })`}
          >
            {renderState.status === 'running' ? (
              <Loader2 size={13} className="mp-spin" />
            ) : (
              <Film size={13} />
            )}
            <span>
              {renderState.status === 'running'
                ? `Renderowanie ${renderState.percent}%…`
                : 'Eksportuj MP4'}
            </span>
          </button>
        </div>
      </div>

      {/* ==================== EXPANDABLE BOTTOM DRAWER (TIMELINE + TRANSCRIPT) ==================== */}
      <div
        className={`mp-bottom-drawer ${drawerOpen ? 'is-open' : ''}`}
        aria-hidden={!drawerOpen}
      >
        <div className="mp-drawer-header">
          <div className="mp-segmented" role="tablist" aria-label="Widok dolnej szuflady">
            <button
              type="button"
              role="tab"
              aria-selected={drawerSubView === 'all'}
              className={`mp-segmented-btn ${
                drawerSubView === 'all' ? 'is-active' : ''
              }`}
              onMouseDown={preventButtonFocus}
              onClick={() => setDrawerSubView('all')}
            >
              Wszystko
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={drawerSubView === 'timeline'}
              className={`mp-segmented-btn ${
                drawerSubView === 'timeline' ? 'is-active' : ''
              }`}
              onMouseDown={preventButtonFocus}
              onClick={() => setDrawerSubView('timeline')}
            >
              Oś reżyserska
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={drawerSubView === 'transcript'}
              className={`mp-segmented-btn ${
                drawerSubView === 'transcript' ? 'is-active' : ''
              }`}
              onMouseDown={preventButtonFocus}
              onClick={() => setDrawerSubView('transcript')}
            >
              Transkrypt
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {qaState.status === 'error' && qaState.error && (
              <span className="mp-dt-qa-err" title={qaState.error}>
                {qaState.error}
              </span>
            )}

            {qaState.status === 'done' && qaState.contactSheetUrl && (
              <button
                type="button"
                className="mp-toggle-btn is-active"
                style={{ height: 26, fontSize: 11 }}
                onMouseDown={preventButtonFocus}
                onClick={() => setShowQaModal(true)}
                title="Otwórz wygenerowany arkusz kontrolny 12 klatek"
              >
                <ExternalLink size={12} />
                <span>Podgląd arkusza QA</span>
              </button>
            )}

            <button
              type="button"
              className="mp-toggle-btn"
              style={{
                height: 26,
                fontSize: 11.5,
                padding: '0 10px',
                opacity: qaState.status === 'running' ? 0.7 : 1,
              }}
              disabled={qaState.status === 'running'}
              onMouseDown={preventButtonFocus}
              onClick={() => void handleGenerateQaSheet()}
              title={`Wygeneruj 12-klatkowy arkusz kontrolny QA dla ${composition.id} (out/qa-*.png)`}
            >
              {qaState.status === 'running' ? (
                <Loader2 size={12} className="mp-spin" />
              ) : (
                <LayoutGrid size={12} />
              )}
              <span>
                {qaState.status === 'running'
                  ? 'Renderowanie QA (12 klatek)…'
                  : 'Arkusz QA (12 klatek)'}
              </span>
            </button>

            <button
              type="button"
              className="mp-icon-btn is-ghost"
              style={{ width: 26, height: 26, padding: 0 }}
              onMouseDown={preventButtonFocus}
              onClick={() => setDrawerOpen(false)}
              title="Zwiń panel osi czasu"
              aria-label="Zwiń panel osi czasu"
            >
              <ChevronDown size={15} />
            </button>
          </div>
        </div>

        {(drawerSubView === 'all' || drawerSubView === 'timeline') && (
          <DirectorTimelinePanel
            composition={composition}
            currentFrame={displayFrame}
            hideQaActions
            onSeek={(target) => {
              pause();
              seekToFrame(target);
            }}
            onOpenOutputFile={(f) => void handleOpenOutput(f)}
          />
        )}

        {(drawerSubView === 'all' || drawerSubView === 'transcript') && (
          <LiveTranscriptBar
            composition={composition}
            currentFrame={displayFrame}
            onSeek={(target) => {
              pause();
              seekToFrame(target);
            }}
          />
        )}
      </div>

      {/* ==================== ROOT-LEVEL QA CONTACT SHEET MODAL ==================== */}
      {showQaModal && qaState.contactSheetUrl && (
        <div
          className="mp-qa-modal-backdrop"
          onClick={() => setShowQaModal(false)}
        >
          <div
            className="mp-qa-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mp-qa-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <LayoutGrid
                  size={16}
                  style={{ color: 'var(--mp-accent)', flexShrink: 0 }}
                />
                <strong>Arkusz QA (12 klatek) — {composition.title}</strong>
                {qaState.outputFile && (
                  <code className="mp-qa-file-pill">{qaState.outputFile}</code>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <a
                  href={qaState.contactSheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mp-icon-btn"
                  style={{
                    height: 28,
                    fontSize: 11.5,
                    textDecoration: 'none',
                  }}
                >
                  <ExternalLink size={12} />
                  <span>Otwórz 1:1 w nowej karcie</span>
                </a>

                {qaState.outputFile && (
                  <button
                    type="button"
                    className="mp-icon-btn"
                    style={{ height: 28, fontSize: 11.5 }}
                    onMouseDown={preventButtonFocus}
                    onClick={() => void handleOpenOutput(qaState.outputFile)}
                  >
                    <FolderOpen size={12} />
                    <span>Pokaż w out/</span>
                  </button>
                )}

                <button
                  type="button"
                  className="mp-icon-btn"
                  style={{ height: 28, padding: '0 8px' }}
                  onMouseDown={preventButtonFocus}
                  onClick={() => setShowQaModal(false)}
                  aria-label="Zamknij"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="mp-qa-modal-body">
              <img
                src={qaState.contactSheetUrl}
                alt={`Arkusz QA dla ${composition.id}`}
                className="mp-qa-modal-img"
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
