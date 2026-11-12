import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  formatFontFamilyCss,
  formatHeadingText,
  getCardChromeStyle,
  getStyleSpringConfig,
  useStudioStyle,
} from '@make-pictures/core';

export interface StoryCard2DProps {
  title: string;
  subtitle?: string;
  badge?: string;
  icon?: React.ReactNode;
  startFrame?: number;
  accentColor?: string;
  styleOverrides?: React.CSSProperties;
}

export const StoryCard2D: React.FC<StoryCard2DProps> = ({
  title,
  subtitle,
  badge,
  icon,
  startFrame = 2,
  accentColor,
  styleOverrides,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = useStudioStyle();

  const effectiveStart = Math.max(2, startFrame);
  if (frame < effectiveStart) return null;

  const enter = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const accent = accentColor ?? style.palette.accentPrimary;

  return (
    <div
      style={getCardChromeStyle(style, {
        boxSizing: 'border-box',
        padding: '34px 38px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [24, 0])}px) scale(${interpolate(enter, [0, 1], [0.96, 1])})`,
        ...styleOverrides,
      })}
    >
      {icon || badge ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          {icon ? (
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: Math.round(14 * style.surface.radiusScale),
                backgroundColor: `${accent}1F`,
                color: accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
              }}
            >
              {icon}
            </div>
          ) : (
            <span />
          )}
          {badge ? (
            <span
              style={{
                padding: '6px 14px',
                borderRadius: Math.round(
                  999 * Math.max(0.2, style.surface.radiusScale)
                ),
                backgroundColor: style.palette.bgElevated,
                border: `1px solid ${style.palette.inkBorder}`,
                fontFamily: formatFontFamilyCss(
                  style.typography.monoFont,
                  'mono'
                ),
                fontSize: 17,
                fontWeight: 600,
                color: accent,
              }}
            >
              {badge}
            </span>
          ) : null}
        </div>
      ) : null}

      <div
        style={{
          fontFamily: formatFontFamilyCss(
            style.typography.displayFont,
            'display'
          ),
          fontSize: 40,
          fontWeight: 700,
          lineHeight: 1.15,
          letterSpacing: `${style.typography.displayTrackingEm}em`,
          color: style.palette.textPrimary,
        }}
      >
        {formatHeadingText(title, style)}
      </div>

      {subtitle ? (
        <div
          style={{
            fontFamily: formatFontFamilyCss(style.typography.bodyFont, 'body'),
            fontSize: 24,
            lineHeight: 1.4,
            color: style.palette.textSecondary,
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
};
