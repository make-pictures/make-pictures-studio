import React from 'react';
import { Img, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  ClippedSurfaceChrome,
  formatFontFamilyCss,
  getCardChromeStyle,
  getStyleSpringConfig,
  useStudioStyle,
} from '@make-pictures/core';

export interface MediaPinSpec {
  id: string;
  /** X coordinate of the detail center in source image pixels (0..sourceWidth) */
  cx: number;
  /** Y coordinate of the detail center in source image pixels (0..sourceHeight) */
  cy: number;
  /** Concise label (>= 18-19 px) */
  label: string;
  /** Label placement relative to reticle ring (default 'top') */
  placement?: 'top' | 'bottom';
  /** Reticle ring radius in px (default 22) */
  ringRadiusPx?: number;
  /** Local entrance frame of the pin (>= 2) */
  startFrame?: number;
  accentColor?: string;
}

export interface PinnedMediaStageProps {
  src: string;
  /** Exact pixel width of the source bitmap (e.g. from PNG dimensions) */
  sourceWidth: number;
  /** Exact pixel height of the source bitmap */
  sourceHeight: number;
  pins: ReadonlyArray<MediaPinSpec>;
  /** Maximum scenic width in px (default 1360) */
  maxWidth?: number;
  /** Maximum scenic height in px (default 780) */
  maxHeight?: number;
  startFrame?: number;
}

const LABEL_BOX_HALF_WIDTH = 240;

export const PinnedMediaStage: React.FC<PinnedMediaStageProps> = ({
  src,
  sourceWidth,
  sourceHeight,
  pins,
  maxWidth = 1360,
  maxHeight = 780,
  startFrame = 2,
}) => {
  const frame = useCurrentFrame();
  const { fps, width: viewportWidth, height: viewportHeight } = useVideoConfig();
  const style = useStudioStyle();

  const effectiveStart = Math.max(2, startFrame);
  if (frame <= 0 || frame < effectiveStart) return null;

  const stageEnter = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });

  const safeSourceWidth =
    typeof sourceWidth === 'number' &&
    Number.isFinite(sourceWidth) &&
    sourceWidth > 0
      ? sourceWidth
      : 1600;
  const safeSourceHeight =
    typeof sourceHeight === 'number' &&
    Number.isFinite(sourceHeight) &&
    sourceHeight > 0
      ? sourceHeight
      : 900;

  const isVertical = viewportHeight > viewportWidth;
  const sx = viewportWidth / 1080;
  const sy = viewportHeight / 1920;
  const safeMaxWidth = isVertical
    ? Math.min(maxWidth, Math.round(812 * sx))
    : maxWidth;
  const safeMaxHeight = isVertical
    ? Math.min(maxHeight, Math.round(980 * sy))
    : maxHeight;
  const aspect = safeSourceWidth / safeSourceHeight;
  const fittedWidth = Math.min(safeMaxWidth, safeMaxHeight * aspect);

  return (
    <div
      data-pinned-media-stage="true"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isVertical
          ? `${Math.round(240 * sy)}px ${Math.round(180 * sx)}px ${Math.round(560 * sy)}px ${Math.round(64 * sx)}px`
          : undefined,
        boxSizing: 'border-box',
        opacity: stageEnter,
      }}
    >
      {/* Inner wrapper locked 1:1 to source bitmap aspectRatio (zero contain letterbox/pillarbox drift) */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: fittedWidth,
          aspectRatio: `${safeSourceWidth} / ${safeSourceHeight}`,
          boxSizing: 'border-box',
        }}
      >
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            borderRadius: Math.round(16 * style.surface.radiusScale),
          }}
        />

        {pins.map((pin) => {
          const pinStart = Math.max(2, pin.startFrame ?? effectiveStart + 18);
          if (frame < pinStart) return null;

          const pinEnter = spring({
            frame: frame - pinStart,
            fps,
            config: getStyleSpringConfig(style, 'emphasis'),
          });
          if (pinEnter <= 0.001) return null;

          const r = pin.ringRadiusPx ?? 22;
          const accent = pin.accentColor ?? style.palette.accentPrimary;
          const placement = pin.placement ?? 'top';
          const labelOffsetY = placement === 'top' ? -(r + 54) : r + 14;

          return (
            <div
              key={pin.id}
              data-media-pin={pin.id}
              style={{
                position: 'absolute',
                left: `${(pin.cx / safeSourceWidth) * 100}%`,
                top: `${(pin.cy / safeSourceHeight) * 100}%`,
                width: 0,
                height: 0,
                pointerEvents: 'none',
              }}
            >
              {/* Symmetric reticle ring around (0, 0) */}
              <div
                style={{
                  position: 'absolute',
                  left: -r,
                  top: -r,
                  width: r * 2,
                  height: r * 2,
                  borderRadius: '50%',
                  border: `3px solid ${accent}`,
                  boxShadow: '0 0 0 4px rgba(255, 255, 255, 0.85)',
                  boxSizing: 'border-box',
                  opacity: pinEnter,
                  transform: `scale(${Number((0.75 + 0.25 * pinEnter).toFixed(4))})`,
                  transformOrigin: 'center center',
                }}
              />

              {/* Symmetrically centered label box (Δx = 0.00 px regardless of label length) */}
              <div
                style={{
                  position: 'absolute',
                  left: -LABEL_BOX_HALF_WIDTH,
                  width: LABEL_BOX_HALF_WIDTH * 2,
                  top: labelOffsetY,
                  display: 'flex',
                  justifyContent: 'center',
                  opacity: pinEnter,
                  transform: `scale(${Number((0.92 + 0.08 * pinEnter).toFixed(4))})`,
                  transformOrigin: 'center center',
                }}
              >
                <div
                  style={getCardChromeStyle(style, {
                    position: 'relative',
                    padding: '8px 16px',
                    fontSize: 19,
                    fontWeight: 600,
                    lineHeight: 1.25,
                    whiteSpace: 'nowrap',
                    boxSizing: 'border-box',
                    borderColor: accent,
                    fontFamily: formatFontFamilyCss(
                      style.typography.bodyFont,
                      'body'
                    ),
                  })}
                >
                  <ClippedSurfaceChrome
                    topBarHeight={2}
                    topBarColor={accent}
                    specularRim={!style.surface.isDark}
                  />
                  <span style={{ position: 'relative', zIndex: 1 }}>
                    {pin.label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
