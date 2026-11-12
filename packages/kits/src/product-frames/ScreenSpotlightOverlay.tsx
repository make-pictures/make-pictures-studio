import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  SPRING_PRESETS,
  formatFontFamilyCss,
  getStyleSpringConfig,
  useStudioFontsReady,
  useStudioStyle,
} from '@make-pictures/core';

export interface ScreenSpotlightOverlayProps {
  /** Highlight left edge (percent `0..100` of parent by default, or px with `unit="px"`) */
  x: number;
  /** Highlight top edge */
  y: number;
  /** Highlight width */
  width: number;
  /** Highlight height */
  height: number;
  /** Coordinate unit (default `'percent'` — resolution-independent over any `.mp4`) */
  unit?: 'percent' | 'px';
  /** Frame (local to parent `<Sequence>`) when the spotlight starts */
  startFrame: number;
  /** Optional frame when the spotlight dismisses */
  endFrame?: number;
  /** Short 2–3 word callout pill */
  label?: string;
  /** Ring & pill accent (defaults to `studioStyle.palette.accentPrimary`) */
  accentColor?: string;
  /** Darkening applied outside the highlight (default `0.45`) */
  dimOpacity?: number;
  /** Highlight corner radius in px (scales with `studioStyle.surface.radiusScale` when omitted) */
  borderRadius?: number;
  /** Label placement relative to the highlight (default `'auto'`) */
  labelPosition?: 'auto' | 'top' | 'bottom';
}

/**
 * Screen-Studio-style deterministic spotlight callout. Place as a child of
 * `<BrowserFrame>` / `<PhoneFrame>` over a `.mp4` screencast. Dims everything outside
 * the target rect (CSS `box-shadow` spread inside the parent's `overflow: hidden`),
 * draws a breathing accent ring, and pops a short label pill.
 */
export const ScreenSpotlightOverlay: React.FC<ScreenSpotlightOverlayProps> = ({
  x,
  y,
  width,
  height,
  unit = 'percent',
  startFrame,
  endFrame,
  label,
  accentColor,
  dimOpacity = 0.45,
  borderRadius,
  labelPosition = 'auto',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  useStudioFontsReady();
  const studioStyle = useStudioStyle();

  const resolvedAccent = accentColor ?? studioStyle.palette.accentPrimary;
  const resolvedRadius =
    borderRadius ?? Math.max(0, Math.round(14 * studioStyle.surface.radiusScale));
  const bodyFontCss = formatFontFamilyCss(
    studioStyle.typography.bodyFont,
    'body'
  );

  const effectiveStart = Math.max(2, startFrame);
  const enter = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(studioStyle, 'enter'),
  });
  const exit =
    typeof endFrame === 'number'
      ? spring({ frame: frame - endFrame, fps, config: SPRING_PRESETS.smooth })
      : 0;
  const visibility = Math.max(0, Math.min(1, enter * (1 - exit)));

  if (visibility <= 0.005) {
    return null;
  }

  const u = unit === 'percent' ? '%' : 'px';
  // Ring tightens from slightly larger rect onto the target as it enters
  const grow = interpolate(enter, [0, 1], [unit === 'percent' ? 3 : 24, 0]);
  const left = x - grow;
  const top = y - grow;
  const w = width + grow * 2;
  const h = height + grow * 2;

  const f60 = frame * (60 / Math.max(1, fps));
  const breathe = 0.5 + 0.5 * Math.sin(f60 * 0.045);
  const ringGlow = 14 + breathe * 10;

  const labelPop = spring({
    frame: frame - effectiveStart - 8,
    fps,
    config: getStyleSpringConfig(studioStyle, 'emphasis'),
  });

  const placeTop =
    labelPosition === 'top' ||
    (labelPosition === 'auto' && (unit === 'percent' ? y > 18 : y > 90));

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: `${left}${u}`,
          top: `${top}${u}`,
          width: `${w}${u}`,
          height: `${h}${u}`,
          borderRadius: resolvedRadius,
          boxShadow: `0 0 0 9999px rgba(2, 6, 23, ${(dimOpacity * visibility).toFixed(3)})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: `${left}${u}`,
          top: `${top}${u}`,
          width: `${w}${u}`,
          height: `${h}${u}`,
          borderRadius: resolvedRadius,
          border: `3px solid ${resolvedAccent}`,
          boxSizing: 'border-box',
          boxShadow: `0 0 ${ringGlow.toFixed(1)}px ${resolvedAccent}AA, inset 0 0 ${(ringGlow * 0.6).toFixed(1)}px ${resolvedAccent}55`,
          opacity: visibility,
        }}
      >
        {label && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              ...(placeTop ? { bottom: '100%', marginBottom: 12 } : { top: '100%', marginTop: 12 }),
              transform: `translateX(-50%) translateY(${interpolate(labelPop, [0, 1], [placeTop ? 8 : -8, 0]).toFixed(2)}px) scale(${interpolate(labelPop, [0, 1], [0.85, 1]).toFixed(3)})`,
              opacity: labelPop * visibility,
              padding: '7px 16px',
              borderRadius: 9999,
              backgroundColor: resolvedAccent,
              color: '#FFFFFF',
              fontFamily: bodyFontCss,
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              boxShadow: `0 10px 28px ${resolvedAccent}66`,
            }}
          >
            {label}
          </div>
        )}
      </div>
    </div>
  );
};
