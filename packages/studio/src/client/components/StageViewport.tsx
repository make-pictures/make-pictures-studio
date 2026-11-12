import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Film,
  FolderOpen,
  Grid3x3,
  Maximize2,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Smartphone,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  isVerticalComposition,
  type StudioCompositionEntry,
} from '@make-pictures/core';
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

function formatTimecode(frame: number, fps: number): string {
  const totalSec = frame / fps;
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  const hundredths = Math.floor((totalSec - Math.floor(totalSec)) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(
    2,
    '0'
  )}.${String(hundredths).padStart(2, '0')}`;
}

export const StageViewport: React.FC<StageViewportProps> = ({
  composition,
  inputProps,
  overlays,
  onToggleOverlay,
  onFrameChange,
  onPlayingChange,
  onFpsMeasure,
}) => {
  const playerRef = useRef<PlayerRef>(null);
  const stageAreaRef = useRef<HTMLDivElement>(null);

  // Persistent frame ref across HMR updates so timeline position is never lost
  const currentFrameRef = useRef<number>(0);
  const prevCompIdRef = useRef<string>(composition.id);

  const [displayFrame, setDisplayFrame] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [loop, setLoop] = useState<boolean>(true);
  const [muted, setMuted] = useState<boolean>(false);
  const [stageBox, setStageBox] = useState<{ w: number; h: number }>({
    w: 960,
    h: 540,
  });
  const [retryNonce, setRetryNonce] = useState<number>(0);
  const [webglLostError, setWebglLostError] = useState<Error | null>(null);

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

  const handleStartRender = useCallback(async () => {
    if (renderState.status === 'running') return;
    playerRef.current?.pause();

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

  // Reset timeline to 0 only when switching to a DIFFERENT composition (not on HMR!)
  if (prevCompIdRef.current !== composition.id) {
    prevCompIdRef.current = composition.id;
    currentFrameRef.current = 0;
  }

  useEffect(() => {
    setDisplayFrame(currentFrameRef.current);
  }, [composition.id]);

  // Fit 16:9 or 9:16 composition cleanly into available center stage viewport
  useEffect(() => {
    const el = stageAreaRef.current;
    if (!el) return;

    const computeFit = () => {
      const rect = el.getBoundingClientRect();
      const availW = Math.max(240, rect.width - 48);
      const availH = Math.max(180, rect.height - 40);
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

  // Subscribe to Remotion Player events (frameupdate, play, pause)
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    let frameSamples = 0;
    let windowStart = performance.now();

    const handleFrameUpdate = (e: { detail: { frame: number } }) => {
      const f = e.detail.frame;
      currentFrameRef.current = f;
      setDisplayFrame(f);
      onFrameChange?.(f);

      const now = performance.now();
      frameSamples += 1;
      const elapsed = now - windowStart;
      if (elapsed >= 500) {
        const measured = Math.min(
          composition.fps,
          Math.round((frameSamples * 1000) / elapsed)
        );
        onFpsMeasure?.(measured > 0 ? measured : composition.fps);
        frameSamples = 0;
        windowStart = now;
      }
    };

    const handlePlay = () => {
      frameSamples = 0;
      windowStart = performance.now();
      setIsPlaying(true);
      onPlayingChange?.(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
      onPlayingChange?.(false);
      onFpsMeasure?.(composition.fps);
    };

    player.addEventListener('frameupdate', handleFrameUpdate);
    player.addEventListener('play', handlePlay);
    player.addEventListener('pause', handlePause);

    return () => {
      player.removeEventListener('frameupdate', handleFrameUpdate);
      player.removeEventListener('play', handlePlay);
      player.removeEventListener('pause', handlePause);
    };
  }, [
    composition.id,
    composition.fps,
    retryNonce,
    onFrameChange,
    onPlayingChange,
    onFpsMeasure,
  ]);

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

  const seekToFrame = useCallback(
    (target: number) => {
      const clamped = Math.max(
        0,
        Math.min(composition.durationInFrames - 1, Math.round(target))
      );
      currentFrameRef.current = clamped;
      setDisplayFrame(clamped);
      onFrameChange?.(clamped);
      playerRef.current?.seekTo(clamped);
    },
    [composition.durationInFrames, onFrameChange]
  );

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isPlaying()) {
      player.pause();
    } else {
      player.play();
    }
  }, []);

  // Keyboard shortcuts (when not typing in an input/textarea)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        playerRef.current?.pause();
        seekToFrame(currentFrameRef.current - (e.shiftKey ? 10 : 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        playerRef.current?.pause();
        seekToFrame(currentFrameRef.current + (e.shiftKey ? 10 : 1));
      } else if (e.key === '0' || e.key === 'Home') {
        e.preventDefault();
        playerRef.current?.pause();
        seekToFrame(0);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [seekToFrame, togglePlay]);

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
    [composition, inputProps, handleRetry]
  );

  const isVertical = isVerticalComposition(composition);
  const componentSignature = `${composition.id}:${retryNonce}:${String(
    composition.component
  ).slice(0, 64)}`;

  return (
    <main className="mp-center-col">
      {/* ==================== DIRECTOR OVERLAYS TOOLBAR ==================== */}
      <div className="mp-stage-toolbar">
        <div className="mp-toolbar-group">
          <button
            type="button"
            className={`mp-toggle-btn is-safebox ${
              overlays.goldenSafeBox ? 'is-active' : ''
            }`}
            onClick={() => onToggleOverlay('goldenSafeBox')}
            title="Bezpieczny kadr (Golden Safe Box) — strefy martwe YouTube Shorts / Reels / TikTok (AGENTS.md)"
          >
            <Smartphone size={14} />
            <span>Bezpieczny kadr {isVertical ? '(9:16)' : ''}</span>
          </button>

          <button
            type="button"
            className={`mp-toggle-btn ${
              overlays.ruleOfThirds ? 'is-active' : ''
            }`}
            onClick={() => onToggleOverlay('ruleOfThirds')}
            title="Siatka kompozycyjna trójpodziału (Rule of Thirds)"
          >
            <Grid3x3 size={14} />
            <span>Siatka 3×3</span>
          </button>

          <button
            type="button"
            className={`mp-toggle-btn ${
              overlays.safeMargins ? 'is-active' : ''
            }`}
            onClick={() => onToggleOverlay('safeMargins')}
            title="Bezpieczne marginesy Action Safe 90% / Title Safe 80%"
          >
            <Maximize2 size={14} />
            <span>Marginesy 16:9</span>
          </button>
        </div>

        <div className="mp-toolbar-group">
          <button
            type="button"
            className="mp-toggle-btn"
            onClick={() => {
              playerRef.current?.pause();
              seekToFrame(0);
            }}
            title="Skocz do klatki 0 (weryfikacja czystej planszy startowej wg AGENTS.md)"
          >
            <RotateCcw size={13} />
            <span>Klatka 0</span>
          </button>

          <button
            type="button"
            className="mp-icon-btn is-primary"
            style={{
              height: 30,
              fontSize: 12,
              opacity: renderState.status === 'running' ? 0.65 : 1,
            }}
            disabled={renderState.status === 'running'}
            onClick={() => void handleStartRender()}
            title={`Eksportuj ${composition.id} do pliku MP4 (${composition.fps} FPS${
              composition.usesThree ? ', --gl=angle' : ''
            })`}
          >
            <Film size={13} />
            <span>
              {renderState.status === 'running'
                ? `Renderowanie ${renderState.percent}%…`
                : 'Eksportuj MP4'}
            </span>
          </button>
        </div>
      </div>

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
                color:
                  renderState.status === 'done'
                    ? '#047857'
                    : renderState.status === 'error'
                    ? '#BE123C'
                    : 'var(--mp-text-primary)',
              }}
            >
              {renderState.status === 'done' && <CheckCircle2 size={15} />}
              <span>{renderState.label}</span>
              {renderState.outputFile && (
                <code
                  style={{
                    fontFamily: 'var(--mp-font-mono)',
                    fontSize: 11,
                    backgroundColor: 'rgba(15, 23, 42, 0.06)',
                    padding: '2px 6px',
                    borderRadius: 5,
                  }}
                >
                  {renderState.outputFile}
                </code>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {renderState.status === 'running' && (
                <>
                  <span
                    style={{
                      fontFamily: 'var(--mp-font-mono)',
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: 'var(--mp-brand-600)',
                    }}
                  >
                    {renderState.percent}%
                  </span>
                  <button
                    type="button"
                    className="mp-icon-btn"
                    style={{ height: 26, fontSize: 11, padding: '0 8px' }}
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
                    borderColor: '#A7F3D0',
                    backgroundColor: '#FFFFFF',
                    color: '#047857',
                  }}
                  onClick={() => void handleOpenOutput(renderState.outputFile)}
                >
                  <FolderOpen size={13} />
                  <span>Pokaż w folderze out/</span>
                </button>
              )}

              {renderState.status !== 'running' && (
                <button
                  type="button"
                  className="mp-icon-btn"
                  style={{ height: 26, padding: '0 6px' }}
                  onClick={() =>
                    setRenderState({
                      status: 'idle',
                      percent: 0,
                      label: '',
                      outputFile: null,
                    })
                  }
                  title="Zamknij komunikat"
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
                ref={playerRef}
                component={composition.component}
                inputProps={inputProps}
                durationInFrames={composition.durationInFrames}
                compositionWidth={composition.width}
                compositionHeight={composition.height}
                fps={composition.fps}
                initialFrame={Math.min(
                  currentFrameRef.current,
                  composition.durationInFrames - 1
                )}
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

      {/* ==================== STUDIO TIMELINE & TRANSPORT BAR ==================== */}
      <div className="mp-transport-bar">
        <div className="mp-scrubber-row">
          <span
            style={{
              fontFamily: 'var(--mp-font-mono)',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--mp-brand-600)',
              minWidth: 44,
            }}
          >
            f:{displayFrame}
          </span>
          <input
            type="range"
            className="mp-timeline-slider"
            min={0}
            max={Math.max(1, composition.durationInFrames - 1)}
            value={Math.min(displayFrame, composition.durationInFrames - 1)}
            aria-label="Oś czasu klatek"
            onChange={(e) => {
              playerRef.current?.pause();
              seekToFrame(Number(e.target.value));
            }}
          />
          <span
            style={{
              fontFamily: 'var(--mp-font-mono)',
              fontSize: 11,
              color: 'var(--mp-text-muted)',
              minWidth: 48,
              textAlign: 'right',
            }}
          >
            /{composition.durationInFrames - 1}
          </span>
        </div>

        <div className="mp-transport-controls">
          <div className="mp-toolbar-group">
            <button
              type="button"
              className="mp-icon-btn is-primary"
              onClick={togglePlay}
              title="Odtwarzaj / Pauza (Spacja)"
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              <span>{isPlaying ? 'Pauza' : 'Odtwarzaj'}</span>
            </button>

            <button
              type="button"
              className="mp-icon-btn"
              onClick={() => {
                playerRef.current?.pause();
                seekToFrame(displayFrame - 10);
              }}
              title="-10 klatek (Shift + ←)"
            >
              <ChevronsLeft size={14} />
            </button>

            <button
              type="button"
              className="mp-icon-btn"
              onClick={() => {
                playerRef.current?.pause();
                seekToFrame(displayFrame - 1);
              }}
              title="-1 klatka (←)"
            >
              <ChevronLeft size={14} />
            </button>

            <button
              type="button"
              className="mp-icon-btn"
              onClick={() => {
                playerRef.current?.pause();
                seekToFrame(displayFrame + 1);
              }}
              title="+1 klatka (→)"
            >
              <ChevronRight size={14} />
            </button>

            <button
              type="button"
              className="mp-icon-btn"
              onClick={() => {
                playerRef.current?.pause();
                seekToFrame(displayFrame + 10);
              }}
              title="+10 klatek (Shift + →)"
            >
              <ChevronsRight size={14} />
            </button>
          </div>

          <div className="mp-timecode">
            {formatTimecode(displayFrame, composition.fps)} /{' '}
            {formatTimecode(composition.durationInFrames, composition.fps)}
          </div>

          <div className="mp-toolbar-group">
            <button
              type="button"
              className={`mp-toggle-btn ${loop ? 'is-active' : ''}`}
              onClick={() => setLoop((v) => !v)}
              title="Zapętlanie odtwarzania"
            >
              <Repeat size={13} />
              <span>Pętla</span>
            </button>

            <button
              type="button"
              className={`mp-toggle-btn ${muted ? 'is-active' : ''}`}
              onClick={() => {
                const next = !muted;
                setMuted(next);
                if (next) {
                  playerRef.current?.mute();
                } else {
                  playerRef.current?.unmute();
                }
              }}
              title={muted ? 'Włącz dźwięk' : 'Wycisz podgląd'}
            >
              {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* ==================== MULTI-TRACK DIRECTOR TIMELINE & QA ==================== */}
      <DirectorTimelinePanel
        composition={composition}
        currentFrame={displayFrame}
        onSeek={(target) => {
          playerRef.current?.pause();
          seekToFrame(target);
        }}
        onOpenOutputFile={(f) => void handleOpenOutput(f)}
      />

      {/* ==================== INTERACTIVE LIVE WORD TRANSCRIPT ==================== */}
      <LiveTranscriptBar
        composition={composition}
        currentFrame={displayFrame}
        onSeek={(target) => {
          playerRef.current?.pause();
          seekToFrame(target);
        }}
      />
    </main>
  );
};
