import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { getStyleSpringConfig, useStudioStyle } from '@make-pictures/core';
import { FrameMedia, type FrameMediaProps } from './frameMedia';

export interface PhoneFrameProps extends FrameMediaProps {
  /** Bezel style (default `'dynamic-island'`) */
  variant?: 'dynamic-island' | 'minimal';
  /** Bezel theme (`'dark'` | `'light'`; defaults to `studioStyle.surface.isDark` when omitted) */
  theme?: 'dark' | 'light';
  /** Outer device width in px (default `520` — fits the 9:16 Golden Safe Box `x ∈ [40, 910]`) */
  width?: number;
  /** Device aspect ratio (default `'9 / 19.5'`, ignored when `height` is set) */
  aspectRatio?: string | number;
  /** Explicit outer device height in px */
  height?: number;
  /** Entrance frame (default `2`, so `frame === 0` renders `opacity: 0`) */
  enterFrame?: number;
  style?: React.CSSProperties;
}

function parseAspectRatio(ar: string | number): number {
  if (typeof ar === 'number') return ar > 0 ? ar : 9 / 19.5;
  const parts = ar.split('/').map((p) => parseFloat(p.trim()));
  if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
    return parts[0] / parts[1];
  }
  const single = parseFloat(ar);
  return single > 0 ? single : 9 / 19.5;
}

/**
 * Mobile 9:16 device bezel (titanium frame, Dynamic Island, home indicator) wrapping
 * an `.mp4` screencast, screenshot or children. Default `520×1127` fits inside the
 * vertical Golden Safe Box (`y ∈ [220, 1380]` → 1160 px tall).
 */
export const PhoneFrame: React.FC<PhoneFrameProps> = ({
  variant = 'dynamic-island',
  theme,
  width = 520,
  aspectRatio = '9 / 19.5',
  height,
  enterFrame = 2,
  style,
  ...media
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const studioStyle = useStudioStyle();

  const enter = spring({
    frame: frame - Math.max(2, enterFrame),
    fps,
    config: getStyleSpringConfig(studioStyle, 'enter'),
  });

  const hasExplicitTheme = theme !== undefined;
  const isDark = hasExplicitTheme ? theme === 'dark' : studioStyle.surface.isDark;
  const outerH =
    typeof height === 'number'
      ? height
      : Math.round(width / parseAspectRatio(aspectRatio));

  const bezel = Math.max(10, Math.round(width * 0.03));
  const outerRadius = Math.round(width * 0.135);
  const innerRadius = Math.max(8, outerRadius - bezel);

  const titanium = isDark
    ? 'linear-gradient(145deg, #3A3D46 0%, #1C1E24 40%, #2A2C33 70%, #45484F 100%)'
    : `linear-gradient(145deg, ${studioStyle.palette.bgElevated} 0%, ${studioStyle.palette.inkBorder} 45%, ${studioStyle.palette.bgSurface} 80%, #FFFFFF 100%)`;

  const translateY = interpolate(enter, [0, 1], [42, 0]);
  const scale = interpolate(enter, [0, 1], [0.93, 1]);

  const islandW = Math.round(width * 0.3);
  const islandH = Math.round(width * 0.068);

  return (
    <div
      style={{
        position: 'relative',
        width,
        height: outerH,
        borderRadius: outerRadius,
        padding: bezel,
        boxSizing: 'border-box',
        background: titanium,
        boxShadow: isDark
          ? '0 60px 120px -24px rgba(0,0,0,0.75), inset 0 0 0 1.5px rgba(255,255,255,0.12)'
          : `0 50px 110px -24px rgba(15,23,42,0.32), inset 0 0 0 1.5px ${studioStyle.palette.inkBorder}`,
        opacity: enter,
        transform: `translate3d(0, ${translateY.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`,
        transformOrigin: 'center center',
        ...style,
      }}
    >
      {/* Side buttons */}
      <div
        style={{
          position: 'absolute',
          left: -3,
          top: outerH * 0.2,
          width: 4,
          height: outerH * 0.06,
          borderRadius: 4,
          background: isDark ? '#2A2C33' : studioStyle.palette.inkBorder,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: -3,
          top: outerH * 0.26,
          width: 4,
          height: outerH * 0.1,
          borderRadius: 4,
          background: isDark ? '#2A2C33' : studioStyle.palette.inkBorder,
        }}
      />

      {/* Screen */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: innerRadius,
          overflow: 'hidden',
          backgroundColor: hasExplicitTheme
            ? '#000000'
            : isDark
              ? '#000000'
              : studioStyle.palette.bgCanvas,
        }}
      >
        <FrameMedia {...media} />

        {variant === 'dynamic-island' && (
          <div
            style={{
              position: 'absolute',
              top: Math.round(width * 0.03),
              left: '50%',
              width: islandW,
              height: islandH,
              marginLeft: -islandW / 2,
              borderRadius: 9999,
              backgroundColor: '#000000',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.04)',
              zIndex: 5,
            }}
          />
        )}

        {/* Home indicator */}
        <div
          style={{
            position: 'absolute',
            bottom: Math.round(width * 0.022),
            left: '50%',
            width: Math.round(width * 0.34),
            height: Math.max(4, Math.round(width * 0.011)),
            marginLeft: -Math.round(width * 0.17),
            borderRadius: 9999,
            backgroundColor: 'rgba(255,255,255,0.82)',
            boxShadow: '0 0 0 0.5px rgba(0,0,0,0.3)',
            zIndex: 5,
          }}
        />
      </div>
    </div>
  );
};
