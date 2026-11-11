import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONTS, SPRING_PRESETS, useStudioFontsReady } from '@make-pictures/core';
import { FrameMedia, type FrameMediaProps } from './frameMedia';

export interface BrowserFrameProps extends FrameMediaProps {
  /** Address bar text, e.g. `'app.make.pictures/studio'` */
  url?: string;
  /** Optional tab / window title */
  title?: string;
  /** Window chrome style (default `'macos'`) */
  variant?: 'macos' | 'arc' | 'minimal';
  /** Chrome theme (default `'dark'`) */
  theme?: 'dark' | 'light';
  /** Outer window width in px (default `1360`) */
  width?: number;
  /** Viewport aspect ratio below the toolbar (default `'16 / 10'`, ignored when `height` is set) */
  aspectRatio?: string | number;
  /** Explicit outer window height in px (overrides `aspectRatio`) */
  height?: number;
  /** Entrance frame (default `2`, so `frame === 0` renders `opacity: 0`) */
  enterFrame?: number;
  /** Accent used for the secure-lock dot & focus ring (default `'#38bdf8'`) */
  accentColor?: string;
  style?: React.CSSProperties;
}

const TOOLBAR_HEIGHT: Record<NonNullable<BrowserFrameProps['variant']>, number> = {
  macos: 52,
  arc: 46,
  minimal: 36,
};

function parseAspectRatio(ar: string | number): number {
  if (typeof ar === 'number') return ar > 0 ? ar : 1.6;
  const parts = ar.split('/').map((p) => parseFloat(p.trim()));
  if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
    return parts[0] / parts[1];
  }
  const single = parseFloat(ar);
  return single > 0 ? single : 1.6;
}

/**
 * Desktop / SaaS browser window chrome wrapping an `.mp4` screencast (`<OffthreadVideo />`),
 * a screenshot (`<Img />`) or arbitrary children. Deterministic 60 FPS spring entrance.
 */
export const BrowserFrame: React.FC<BrowserFrameProps> = ({
  url,
  title,
  variant = 'macos',
  theme = 'dark',
  width = 1360,
  aspectRatio = '16 / 10',
  height,
  enterFrame = 2,
  accentColor = '#38bdf8',
  style,
  ...media
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  useStudioFontsReady();

  const enter = spring({
    frame: frame - Math.max(2, enterFrame),
    fps,
    config: SPRING_PRESETS.snappy,
  });

  const isDark = theme === 'dark';
  const toolbarH = TOOLBAR_HEIGHT[variant];
  const viewportH =
    typeof height === 'number'
      ? Math.max(40, height - toolbarH)
      : Math.round(width / parseAspectRatio(aspectRatio));
  const outerH = viewportH + toolbarH;

  const chromeBg = isDark ? '#14161F' : '#F1F5F9';
  const chromeBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
  const pillBg = isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF';
  const textColor = isDark ? '#CBD5E1' : '#334155';
  const mutedText = isDark ? '#64748B' : '#94A3B8';
  const radius = variant === 'arc' ? 22 : variant === 'minimal' ? 14 : 18;

  const translateY = interpolate(enter, [0, 1], [36, 0]);
  const scale = interpolate(enter, [0, 1], [0.94, 1]);

  return (
    <div
      style={{
        position: 'relative',
        width,
        height: outerH,
        borderRadius: radius,
        overflow: 'hidden',
        boxSizing: 'border-box',
        backgroundColor: isDark ? '#0B0D14' : '#FFFFFF',
        border: `1px solid ${chromeBorder}`,
        boxShadow: isDark
          ? '0 50px 120px -20px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04) inset'
          : '0 40px 100px -20px rgba(15,23,42,0.28), 0 8px 24px -8px rgba(15,23,42,0.12)',
        opacity: enter,
        transform: `translate3d(0, ${translateY.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`,
        transformOrigin: 'center center',
        ...style,
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: toolbarH,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '0 18px',
          boxSizing: 'border-box',
          backgroundColor: variant === 'arc' ? 'transparent' : chromeBg,
          borderBottom: variant === 'arc' ? 'none' : `1px solid ${chromeBorder}`,
          fontFamily: FONTS.sans,
        }}
      >
        {variant !== 'minimal' && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
              <div
                key={c}
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 9999,
                  backgroundColor: c,
                  boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.25)',
                }}
              />
            ))}
          </div>
        )}

        {title && variant === 'macos' && (
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: mutedText,
              whiteSpace: 'nowrap',
              maxWidth: 220,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          {(url || variant !== 'minimal') && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                height: variant === 'minimal' ? 22 : 30,
                minWidth: Math.min(520, width * 0.42),
                maxWidth: width * 0.6,
                padding: '0 16px',
                borderRadius: 9999,
                backgroundColor: pillBg,
                border: `1px solid ${chromeBorder}`,
                boxSizing: 'border-box',
                fontFamily: FONTS.mono,
                fontSize: variant === 'minimal' ? 12 : 14,
                fontWeight: 500,
                color: textColor,
                justifyContent: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 9999,
                  backgroundColor: accentColor,
                  flexShrink: 0,
                }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {url ?? title ?? ''}
              </span>
            </div>
          )}
        </div>

        {variant !== 'minimal' && <div style={{ width: 55, flexShrink: 0 }} />}
      </div>

      {/* Viewport */}
      <div
        style={{
          position: 'absolute',
          left: variant === 'arc' ? 8 : 0,
          right: variant === 'arc' ? 8 : 0,
          bottom: variant === 'arc' ? 8 : 0,
          top: toolbarH,
          borderRadius: variant === 'arc' ? 14 : 0,
          overflow: 'hidden',
          backgroundColor: isDark ? '#05060A' : '#F8FAFC',
        }}
      >
        <FrameMedia {...media} />
      </div>
    </div>
  );
};
