import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  ClippedSurfaceChrome,
  createSeededRandom,
  formatFontFamilyCss,
  formatHeadingText,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioStyle,
} from '@make-pictures/core';

export interface StoryCard2DProps {
  title: string;
  subtitle?: string;
  badge?: string;
  icon?: React.ReactNode;
  /** Optional plate index stamp (omitted by default — rendered only when explicitly non-empty) */
  plateCode?: string;
  tiltDeg?: number;
  compact?: boolean;
  startFrame?: number;
  accentColor?: string;
  styleOverrides?: React.CSSProperties;
}

export const StoryCard2D: React.FC<StoryCard2DProps> = ({
  title,
  subtitle,
  badge,
  icon,
  plateCode,
  tiltDeg,
  compact = false,
  startFrame = 2,
  accentColor,
  styleOverrides,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const optics = resolveStyleOptics(style);
  const grammar = optics.typographyGrammar;
  const isVertical = height > width;

  const effectiveStart = Math.max(2, startFrame);
  if (frame < effectiveStart) return null;

  const enter = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const accent = accentColor ?? style.palette.accentPrimary;

  // Optical pull-in blur with strict < 0.25px vector sharpness deadzone
  const pullProgress = interpolate(
    frame - effectiveStart,
    [0, 16],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const rawBlur = (1 - pullProgress) * (2.2 + optics.aperture * 2.8);
  const filterCss = rawBlur < 0.25 ? 'none' : `blur(${rawBlur.toFixed(2)}px)`;

  const defaultTilt =
    optics.lightingRig === 'studio-macro'
      ? 0
      : grammar === 'risograph-poster'
        ? (createSeededRandom(`story-plate:${title}`)() - 0.5) * 1.8
        : 0;
  const maxTilt = isVertical ? 0.9 : 1.2;
  const effectiveTilt = Math.max(
    -maxTilt,
    Math.min(maxTilt, tiltDeg ?? defaultTilt)
  );

  const glyphIndex = Math.floor(
    createSeededRandom(`story-glyph:${title}`)() * 3
  );

  const cleanBadge = badge?.trim() ? badge.trim() : undefined;
  const cleanPlateCode = plateCode?.trim() ? plateCode.trim() : undefined;
  const hasHeader = Boolean(cleanBadge || cleanPlateCode);

  const displayFont = formatFontFamilyCss(
    style.typography.displayFont,
    'display'
  );
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');

  const medallionSize = compact ? 52 : 60;

  return (
    <div
      data-medallion-grammar={grammar}
      style={getTactileSurfaceStyle(style, {
        elevation: 'lifted',
        tiltDeg: effectiveTilt,
        overrides: {
          boxSizing: 'border-box',
          position: 'relative',
          padding: compact
            ? '24px 28px'
            : isVertical
              ? '30px 34px'
              : '36px 42px',
          borderRadius:
            grammar === 'risograph-poster'
              ? 0
              : Math.max(0, Math.round(6 * style.surface.radiusScale)),
          display: 'flex',
          flexDirection: 'column',
          gap: compact ? 14 : 18,
          opacity: enter,
          filter: filterCss,
          transform: `translateY(${Number(interpolate(enter, [0, 1], [20, 0]).toFixed(2))}px) scale(${Number(interpolate(enter, [0, 1], [0.975, 1]).toFixed(4))})`,
          ...styleOverrides,
        },
      })}
    >
      <ClippedSurfaceChrome
        topBarHeight={grammar === 'risograph-poster' ? 5 : 3}
        topBarColor={accent}
        specularRim={!style.surface.isDark}
        tintGradient={
          style.surface.isDark
            ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, transparent 48%)'
            : 'linear-gradient(180deg, rgba(255, 255, 255, 0.64) 0%, rgba(255, 255, 255, 0) 50%)'
        }
      />

      {/* Optional Eyebrow Header (only rendered when badge or plateCode is explicitly passed) */}
      {hasHeader && (
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            paddingBottom: 10,
            borderBottom: `1px solid ${style.palette.inkBorder}`,
            fontFamily: monoFont,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '0.12em',
          }}
        >
          {cleanBadge ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: grammar === 'risograph-poster' ? 10 : 3,
                  height: 14,
                  backgroundColor: accent,
                }}
              />
              <span
                style={{
                  color:
                    grammar === 'risograph-poster'
                      ? style.palette.textPrimary
                      : accent,
                }}
              >
                {cleanBadge}
              </span>
            </div>
          ) : (
            <span />
          )}

          {cleanPlateCode ? (
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: style.palette.textSecondary,
              }}
            >
              {cleanPlateCode}
            </span>
          ) : null}
        </div>
      )}

      {/* Main Plate Body: Engraved Geometric Medallion + Headline/Copy */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'flex-start',
          gap: compact ? 18 : 22,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: medallionSize,
            height: medallionSize,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accent,
            boxShadow:
              grammar === 'optical-gate' && optics.halation > 0.05
                ? `0 0 ${Math.round(12 + optics.halation * 20)}px ${accent}44`
                : grammar === 'risograph-poster'
                  ? `3px 3px 0px ${style.palette.inkBorder}`
                  : 'none',
            backgroundColor:
              grammar === 'risograph-poster'
                ? style.palette.bgElevated
                : grammar === 'optical-gate'
                  ? style.surface.isDark
                    ? style.palette.bgCanvas
                    : '#0F172A'
                  : 'transparent',
            border:
              grammar === 'risograph-poster'
                ? `1.5px solid ${style.palette.inkBorder}`
                : grammar === 'optical-gate'
                  ? `1px solid ${style.palette.inkBorder}`
                  : 'none',
          }}
        >
          <svg
            width={medallionSize}
            height={medallionSize}
            viewBox="0 0 60 60"
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            {grammar === 'swiss-spatial' && (
              <>
                <circle
                  cx="30"
                  cy="30"
                  r="27"
                  fill="none"
                  stroke={style.palette.inkBorder}
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <circle
                  cx="30"
                  cy="30"
                  r="20"
                  fill={accent}
                  fillOpacity="0.1"
                  stroke={accent}
                  strokeWidth="1.5"
                />
                <line
                  x1="30"
                  y1="0"
                  x2="30"
                  y2="8"
                  stroke={style.palette.textSecondary}
                  strokeWidth="1.2"
                />
                <line
                  x1="30"
                  y1="52"
                  x2="30"
                  y2="60"
                  stroke={style.palette.textSecondary}
                  strokeWidth="1.2"
                />
                <line
                  x1="0"
                  y1="30"
                  x2="8"
                  y2="30"
                  stroke={style.palette.textSecondary}
                  strokeWidth="1.2"
                />
                <line
                  x1="52"
                  y1="30"
                  x2="60"
                  y2="30"
                  stroke={style.palette.textSecondary}
                  strokeWidth="1.2"
                />
              </>
            )}

            {grammar === 'optical-gate' && (
              <>
                <path
                  d="M4 16 V4 H16 M44 4 H56 V16 M56 44 V56 H44 M16 56 H4 V44"
                  fill="none"
                  stroke={accent}
                  strokeWidth="1.6"
                />
                <circle
                  cx="30"
                  cy="30"
                  r="18"
                  fill={accent}
                  fillOpacity="0.14"
                  stroke={accent}
                  strokeWidth="1.2"
                  opacity={0.85}
                />
              </>
            )}

            {grammar === 'risograph-poster' && (
              <rect
                x="6"
                y="6"
                width="48"
                height="48"
                fill={accent}
                fillOpacity="0.12"
                stroke={accent}
                strokeWidth="2"
              />
            )}

            {!icon && glyphIndex === 0 && (
              <polygon
                points="30,18 41,38 19,38"
                fill="none"
                stroke={accent}
                strokeWidth="1.8"
              />
            )}
            {!icon && glyphIndex === 1 && (
              <polygon
                points="30,17 43,30 30,43 17,30"
                fill="none"
                stroke={accent}
                strokeWidth="1.8"
              />
            )}
            {!icon && glyphIndex === 2 && (
              <polygon
                points="30,17 41,23.5 41,36.5 30,43 19,36.5 19,23.5"
                fill="none"
                stroke={accent}
                strokeWidth="1.8"
              />
            )}
          </svg>

          {icon ? (
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: compact ? 24 : 26,
              }}
            >
              {icon}
            </div>
          ) : null}
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div
            style={{
              fontFamily: displayFont,
              fontSize: compact ? 34 : isVertical ? 38 : 42,
              fontWeight: 700,
              lineHeight: 1.14,
              letterSpacing: `${style.typography.displayTrackingEm}em`,
              color: style.palette.textPrimary,
            }}
          >
            {formatHeadingText(title, style)}
          </div>

          {subtitle ? (
            <div
              style={{
                fontFamily: bodyFont,
                fontSize: compact ? 21 : 24,
                lineHeight: 1.4,
                color: style.palette.textSecondary,
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
