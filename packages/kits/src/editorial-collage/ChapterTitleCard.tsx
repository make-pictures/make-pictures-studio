import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  formatFontFamilyCss,
  formatHeadingText,
  getStyleSpringConfig,
  useStudioStyle,
} from '@make-pictures/core';

export interface ChapterTitleCardProps {
  chapterLabel: string;
  title: string;
  subtitle?: string;
  startFrame?: number;
  accentColor?: string;
}

export const ChapterTitleCard: React.FC<ChapterTitleCardProps> = ({
  chapterLabel,
  title,
  subtitle,
  startFrame = 2,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const isVertical = height > width;

  const effectiveStart = Math.max(2, startFrame);
  if (frame < effectiveStart) return null;

  const enter = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });

  const accent = accentColor ?? style.palette.accentPrimary;
  const translateY = interpolate(enter, [0, 1], [28, 0]);

  return (
    <AbsoluteFill
      style={{
        boxSizing: 'border-box',
        justifyContent: isVertical ? 'flex-start' : 'center',
        alignItems: isVertical ? 'flex-start' : 'center',
        paddingLeft: isVertical ? 64 : 140,
        paddingRight: isVertical ? 190 : 140,
        paddingTop: isVertical ? 320 : 0,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          maxWidth: isVertical ? 810 : 1240,
          opacity: enter,
          transform: `translateY(${translateY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: formatFontFamilyCss(style.typography.monoFont, 'mono'),
            fontSize: isVertical ? 24 : 22,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: accent,
            marginBottom: 18,
          }}
        >
          {chapterLabel}
        </div>
        <div
          style={{
            width: Math.round(140 * enter),
            height: 4,
            backgroundColor: accent,
            marginBottom: 26,
          }}
        />
        <div
          style={{
            fontFamily: formatFontFamilyCss(
              style.typography.displayFont,
              'display'
            ),
            fontSize: isVertical ? 76 : 92,
            fontWeight: 700,
            lineHeight: 1.06,
            letterSpacing: `${style.typography.displayTrackingEm}em`,
            color: style.palette.textPrimary,
          }}
        >
          {formatHeadingText(title, style)}
        </div>
        {subtitle ? (
          <div
            style={{
              marginTop: 22,
              fontFamily: formatFontFamilyCss(style.typography.bodyFont, 'body'),
              fontSize: isVertical ? 32 : 34,
              lineHeight: 1.4,
              color: style.palette.textSecondary,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
