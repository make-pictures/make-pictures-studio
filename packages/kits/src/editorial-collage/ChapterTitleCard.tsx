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
  resolveStyleOptics,
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
  const optics = resolveStyleOptics(style);
  const isVertical = height > width;

  const effectiveStart = Math.max(2, startFrame);
  if (frame < effectiveStart) return null;

  const localFrame = frame - effectiveStart;
  const enter = spring({
    frame: localFrame,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });

  // Optical lens focus pull: settles from soft 5px defocus into crisp filter:none within ~18 frames
  const rawFocusPullBlur = interpolate(
    localFrame,
    [0, 18],
    [3.6 + optics.aperture * 3.2, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const focusFilter =
    rawFocusPullBlur < 0.25 ? 'none' : `blur(${rawFocusPullBlur.toFixed(2)}px)`;

  const accent = accentColor ?? style.palette.accentPrimary;
  const translateY = interpolate(enter, [0, 1], [18, 0]);
  const focusScale = interpolate(enter, [0, 1], [1.038, 1]);

  return (
    <AbsoluteFill
      style={{
        boxSizing: 'border-box',
        justifyContent: isVertical ? 'flex-start' : 'center',
        alignItems: 'flex-start',
        paddingLeft: isVertical ? 68 : 168,
        paddingRight: isVertical ? 196 : 168,
        paddingTop: isVertical ? 312 : 0,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          maxWidth: isVertical ? 792 : 1260,
          width: '100%',
          opacity: enter,
          filter: focusFilter,
          transformOrigin: 'left center',
          transform: `translateY(${translateY.toFixed(2)}px) scale(${focusScale.toFixed(4)})`,
        }}
      >
        {/* Editorial Crop-Mark Registration Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 18,
          }}
        >
          <span
            style={{
              fontFamily: formatFontFamilyCss(style.typography.monoFont, 'mono'),
              fontSize: 18,
              fontWeight: 700,
              color: style.palette.inkBorder,
            }}
          >
            ┼
          </span>
          <span
            style={{
              fontFamily: formatFontFamilyCss(style.typography.monoFont, 'mono'),
              fontSize: isVertical ? 21 : 20,
              fontWeight: 600,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: accent,
            }}
          >
            {chapterLabel}
          </span>
        </div>

        {/* Hairline Cutter Rule + Accent Lead */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: isVertical ? 760 : 920,
            height: 1.5,
            backgroundColor: style.palette.inkBorder,
            transformOrigin: 'left center',
            transform: `scaleX(${enter.toFixed(4)})`,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: Math.round(132 * enter),
              height: 3.5,
              marginTop: -1,
              backgroundColor: accent,
            }}
          />
        </div>

        <div
          style={{
            fontFamily: formatFontFamilyCss(
              style.typography.displayFont,
              'display'
            ),
            fontSize: isVertical ? 74 : 92,
            fontWeight: 700,
            lineHeight: 1.06,
            letterSpacing: `${style.typography.displayTrackingEm}em`,
            color: style.palette.textPrimary,
            textShadow:
              style.surface.isDark && optics.halation > 0.2
                ? `0 0 ${Math.round(20 * optics.halation)}px ${accent}44`
                : 'none',
          }}
        >
          {formatHeadingText(title, style)}
        </div>

        {subtitle ? (
          <div
            style={{
              marginTop: 22,
              maxWidth: isVertical ? 780 : 980,
              fontFamily: formatFontFamilyCss(style.typography.bodyFont, 'body'),
              fontSize: isVertical ? 30 : 33,
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
