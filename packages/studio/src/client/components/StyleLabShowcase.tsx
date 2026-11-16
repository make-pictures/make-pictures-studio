import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Player } from '@remotion/player';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Grid3x3,
  Monitor,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Smartphone,
} from 'lucide-react';
import type {
  BuiltinVisualKitId,
  DimensionalSpace,
  StylePreset,
} from '@make-pictures/core';
import { useRemotionPlayer } from '../hooks/useRemotionPlayer';
import type { OverlaySettings } from '../types';
import { DirectorOverlays } from './DirectorOverlays';
import { StyleLabPreviewComposition } from './style-lab/StyleLabPreviewComposition';
import {
  STYLE_LAB_DURATION_IN_FRAMES,
  STYLE_LAB_FPS,
  STYLE_LAB_KITS,
  STYLE_LAB_SPACES,
  defaultBuiltInStyleForSpace,
  defaultPreviewKitForSpace,
  formatTimecode,
  getSafeStageBounds,
  resolveCompatibleKitForStyle,
  resolveKitDimensionalSpace,
  type SafeStageBounds,
  type StyleLabAspectRatio,
  type StyleLabCompositionProps,
} from './style-lab/styleLabTypes';

export {
  STYLE_LAB_DURATION_IN_FRAMES,
  STYLE_LAB_FPS,
  STYLE_LAB_KITS,
  STYLE_LAB_SPACES,
  StyleLabPreviewComposition,
  defaultBuiltInStyleForSpace,
  defaultPreviewKitForSpace,
  formatTimecode,
  getSafeStageBounds,
  resolveCompatibleKitForStyle,
  resolveKitDimensionalSpace,
  type SafeStageBounds,
  type StyleLabAspectRatio,
  type StyleLabCompositionProps,
};

const preventButtonFocus = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.preventDefault();
};

export interface StyleLabShowcaseProps {
  activeStyle: StylePreset;
  activeKit: BuiltinVisualKitId;
  onSelectKit: (kit: BuiltinVisualKitId) => void;
  onSelectSpace?: (space: DimensionalSpace) => void;
  aspectRatio: StyleLabAspectRatio;
  onChangeAspectRatio: (ratio: StyleLabAspectRatio) => void;
  overlays: OverlaySettings;
  onToggleOverlay: (key: keyof OverlaySettings) => void;
  onPlayingChange?: (playing: boolean) => void;
  onFpsMeasure?: (fps: number) => void;
}

export const StyleLabShowcase: React.FC<StyleLabShowcaseProps> = ({
  activeStyle,
  activeKit,
  onSelectKit,
  onSelectSpace,
  aspectRatio,
  onChangeAspectRatio,
  overlays,
  onToggleOverlay,
  onPlayingChange,
  onFpsMeasure,
}) => {
  const stageAreaRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copiedCli, setCopiedCli] = useState<boolean>(false);

  const {
    playerRefCallback,
    displayFrame,
    currentFrameRef,
    isPlaying,
    loop,
    setLoop,
    seekToFrame,
    togglePlay,
    pause,
  } = useRemotionPlayer({
    fps: STYLE_LAB_FPS,
    durationInFrames: STYLE_LAB_DURATION_IN_FRAMES,
    resetKey: 'stylelab',
    initialFrame: 48,
    onPlayingChange,
    onFpsMeasure,
  });

  const [stageBox, setStageBox] = useState<{ w: number; h: number }>({
    w: 960,
    h: 540,
  });

  const compWidth = aspectRatio === '9:16' ? 1080 : 1920;
  const compHeight = aspectRatio === '9:16' ? 1920 : 1080;
  const maxFrameIndex = STYLE_LAB_DURATION_IN_FRAMES - 1;
  const activeSpace = resolveKitDimensionalSpace(activeKit);
  const cliCommand = `npx make-pictures new moj-film --space=${activeSpace} --kit=${activeKit} --style=${activeStyle.id}`;

  const inputProps = useMemo<StyleLabCompositionProps>(
    () => ({
      style: activeStyle,
      kit: activeKit,
    }),
    [activeStyle, activeKit]
  );

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopyCli = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(cliCommand);
      }
      setCopiedCli(true);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => {
        setCopiedCli(false);
      }, 1800);
    } catch {
      // ignore clipboard restrictions
    }
  }, [cliCommand]);

  // Fit 16:9 or 9:16 preview stage cleanly into center viewport with generous breathing room
  useEffect(() => {
    const el = stageAreaRef.current;
    if (!el) return;

    const computeFit = () => {
      const rect = el.getBoundingClientRect();
      const padX = rect.width < 640 ? 20 : 52;
      const padY = rect.height < 480 ? 20 : 36;
      const availW = Math.max(200, rect.width - padX);
      const availH = Math.max(150, rect.height - padY);
      const aspect = compWidth / compHeight;

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
  }, [compWidth, compHeight]);

  return (
    <main className="mp-center-col">
      {/* ==================== 2D / 2.5D / 3D SPACE SWITCHER + 7 VISUAL KITS + ASPECT RATIO + COPYABLE CLI TOP BAR ==================== */}
      <div className="mp-stage-top-bar">
        <div
          className="mp-segmented mp-stylelab-space-switcher"
          role="group"
          aria-label="Przestrzeń wymiarowa (2D / 2.5D / 3D)"
        >
          {STYLE_LAB_SPACES.map((sp) => {
            const isSpaceActive = activeSpace === sp.id;
            return (
              <button
                key={sp.id}
                type="button"
                data-space-pill={sp.id}
                aria-pressed={isSpaceActive}
                className={`mp-aspect-btn ${isSpaceActive ? 'is-active' : ''}`}
                onMouseDown={preventButtonFocus}
                onClick={() => {
                  if (onSelectSpace) {
                    onSelectSpace(sp.id);
                  } else {
                    onSelectKit(defaultPreviewKitForSpace(sp.id));
                  }
                }}
                title={sp.title}
              >
                <span>{sp.label}</span>
              </button>
            );
          })}
        </div>

        <div
          className="mp-stylelab-kit-strip"
          role="tablist"
          aria-label="Testowany zestaw sceniczny (Visual Kit)"
        >
          {STYLE_LAB_KITS.map((item) => {
            const active = item.id === activeKit;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`mp-kit-pill ${active ? 'is-active' : ''}`}
                onMouseDown={preventButtonFocus}
                onClick={() => onSelectKit(item.id)}
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span className="mp-kit-pill-badge">{item.badge}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mp-toolbar-group" style={{ flexShrink: 0 }}>
          <div className="mp-aspect-toggle" role="group" aria-label="Format kadru">
            <button
              type="button"
              aria-pressed={aspectRatio === '16:9'}
              className={`mp-aspect-btn ${
                aspectRatio === '16:9' ? 'is-active' : ''
              }`}
              onMouseDown={preventButtonFocus}
              onClick={() => onChangeAspectRatio('16:9')}
              title="Format poziomy 1920×1080 (16:9 HD)"
            >
              <Monitor size={13} />
              <span>16:9</span>
            </button>
            <button
              type="button"
              aria-pressed={aspectRatio === '9:16'}
              className={`mp-aspect-btn ${
                aspectRatio === '9:16' ? 'is-active' : ''
              }`}
              onMouseDown={preventButtonFocus}
              onClick={() => onChangeAspectRatio('9:16')}
              title="Format pionowy 1080×1920 (9:16 Shorts / Reels)"
            >
              <Smartphone size={13} />
              <span>9:16</span>
            </button>
          </div>

          <button
            type="button"
            className="mp-stylelab-cli-hint"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 28,
              padding: '0 10px',
              cursor: 'pointer',
              maxWidth: 340,
              borderColor: copiedCli
                ? 'var(--mp-emerald-border)'
                : 'var(--mp-border-hairline)',
              backgroundColor: copiedCli
                ? 'var(--mp-emerald-soft)'
                : 'var(--mp-bg-subtle)',
              color: copiedCli
                ? 'var(--mp-emerald-text)'
                : 'var(--mp-text-secondary)',
            }}
            onMouseDown={preventButtonFocus}
            onClick={() => void handleCopyCli()}
            title={`Kliknij, aby skopiować: ${cliCommand}`}
            aria-label={`Skopiuj komendę CLI: ${cliCommand}`}
          >
            {copiedCli ? (
              <Check size={12} style={{ flexShrink: 0 }} />
            ) : (
              <Copy size={12} style={{ flexShrink: 0 }} />
            )}
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {cliCommand}
            </span>
          </button>
        </div>
      </div>

      {/* ==================== 60 FPS STYLE LAB STAGE ==================== */}
      <div className="mp-stage-canvas-area" ref={stageAreaRef}>
        <div
          className="mp-player-frame"
          style={{ width: stageBox.w, height: stageBox.h }}
        >
          <Player
            key={`stylelab:${aspectRatio}`}
            ref={playerRefCallback}
            component={StyleLabPreviewComposition}
            inputProps={inputProps}
            durationInFrames={STYLE_LAB_DURATION_IN_FRAMES}
            compositionWidth={compWidth}
            compositionHeight={compHeight}
            fps={STYLE_LAB_FPS}
            initialFrame={Math.min(currentFrameRef.current, maxFrameIndex)}
            loop={loop}
            controls={false}
            clickToPlay={true}
            spaceKeyToPlayOrPause={false}
            acknowledgeRemotionLicense={true}
            style={{
              width: '100%',
              height: '100%',
            }}
          />

          <DirectorOverlays
            width={compWidth}
            height={compHeight}
            overlays={overlays}
          />
        </div>
      </div>

      {/* ==================== FLOATING LIQUID GLASS TRANSPORT CAPSULE ==================== */}
      <div className="mp-floating-dock-wrap">
        <div
          className="mp-floating-transport"
          style={{ width: 'min(940px, 100%)' }}
          role="region"
          aria-label="Sterowanie podglądem Style Lab"
        >
          {/* Primary Play/Pause FAB */}
          <button
            type="button"
            className="mp-play-fab"
            aria-pressed={isPlaying}
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
          <div
            className="mp-transport-step-group"
            role="group"
            aria-label="Nawigacja klatkowa"
          >
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
              title="Skocz do klatki 0 (weryfikacja czystego tła startowego)"
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
              max={maxFrameIndex}
              value={Math.min(displayFrame, maxFrameIndex)}
              aria-label="Oś czasu podglądu stylu"
              onChange={(e) => {
                pause();
                seekToFrame(Number(e.target.value));
              }}
            />
            <span className="mp-timecode-pill mp-tabular">
              {formatTimecode(displayFrame, STYLE_LAB_FPS)} • f:{displayFrame}/
              {maxFrameIndex}
            </span>
          </div>

          {/* Loop, Safe Box, Grid 3×3 & Frame 0 */}
          <div className="mp-toolbar-group" style={{ flexShrink: 0 }}>
            <button
              type="button"
              className={`mp-icon-btn ${loop ? 'is-active' : 'is-ghost'}`}
              style={{ width: 32, height: 32, padding: 0, borderRadius: '50%' }}
              aria-pressed={loop}
              aria-label="Zapętlanie podglądu"
              title={loop ? 'Pętla włączona' : 'Pętla wyłączona'}
              onMouseDown={preventButtonFocus}
              onClick={() => setLoop((v) => !v)}
            >
              <Repeat size={14} />
            </button>

            <button
              type="button"
              className={`mp-drawer-toggle-btn ${
                overlays.goldenSafeBox ? 'is-active' : ''
              }`}
              aria-pressed={overlays.goldenSafeBox}
              onMouseDown={preventButtonFocus}
              onClick={() => onToggleOverlay('goldenSafeBox')}
              title="Bezpieczny kadr (Golden Safe Box)"
            >
              <Smartphone size={13} />
              <span>Safe Box</span>
            </button>

            <button
              type="button"
              className={`mp-drawer-toggle-btn ${
                overlays.ruleOfThirds ? 'is-active' : ''
              }`}
              aria-pressed={overlays.ruleOfThirds}
              onMouseDown={preventButtonFocus}
              onClick={() => onToggleOverlay('ruleOfThirds')}
              title="Siatka kompozycyjna 3×3"
            >
              <Grid3x3 size={13} />
              <span className="mp-hide-mobile">3×3</span>
            </button>

            <button
              type="button"
              className="mp-drawer-toggle-btn"
              onMouseDown={preventButtonFocus}
              onClick={() => {
                pause();
                seekToFrame(0);
              }}
              title="Skocz do klatki 0 (weryfikacja czystego tła startowego)"
            >
              <RotateCcw size={13} />
              <span className="mp-hide-mobile">Klatka 0</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};
