import React from 'react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  SPRING_PRESETS,
  STUDIO_THEME,
  THEME,
  formatFontFamilyCss,
  formatHeadingText,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioFontsReady,
  useStudioStyle,
  type StyleTypographyGrammar,
} from '@make-pictures/core';

export interface ImpactKeywordCardProps {
  /** Primary bold statement (keep concise: 2–4 words per AGENTS.md) */
  keyword: string;
  /** Optional small category eyebrow above the keyword */
  eyebrow?: string;
  /** Optional concise 2–4 word takeaway sublabel */
  sublabel?: string;
  /** Optional technical index / stamp badge (e.g. `"60 FPS"`, `"-14 LUFS"`) */
  badge?: string;
  /** Optional custom typographic mark; defaults to `null` (no generic icon square) */
  icon?: React.ReactNode;
  /** Typographic grammar override (defaults to `studioStyle.optics.typographyGrammar`) */
  grammar?: StyleTypographyGrammar;
  /** Accent color (defaults to `studioStyle.palette.accentPrimary`) */
  accentColor?: string;
  /** Optional explicit surface mode override (`'dark'` | `'light'`); inherits active `StylePreset` when omitted */
  variant?: 'dark' | 'light';
  /** Entrance frame (default `2`, obeying Frame 0 clean board rule) */
  enterFrame?: number;
  /** Alias for `enterFrame` */
  startFrame?: number;
  /** Optional exit frame for smooth spring dismissal */
  exitFrame?: number;
  /** Constrain max width cleanly inside `9:16 Golden Safe Box` when vertical (default `true`) */
  safeBox9x16?: boolean;
  style?: React.CSSProperties;
}

/**
 * Polymorphic 60 FPS Typographic Statement Card (`swiss-spatial`, `optical-gate`, `risograph-poster`).
 */
export const ImpactKeywordCard: React.FC<ImpactKeywordCardProps> = ({
  keyword,
  eyebrow,
  sublabel,
  badge,
  icon = null,
  grammar,
  accentColor,
  variant,
  enterFrame,
  startFrame,
  exitFrame,
  safeBox9x16 = true,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  useStudioFontsReady();
  const studioStyle = useStudioStyle();
  const optics = resolveStyleOptics(studioStyle);
  const resolvedGrammar = grammar ?? optics.typographyGrammar;

  const resolvedAccent = accentColor ?? studioStyle.palette.accentPrimary;
  const displayFontCss = formatFontFamilyCss(
    studioStyle.typography.displayFont,
    'display'
  );
  const bodyFontCss = formatFontFamilyCss(
    studioStyle.typography.bodyFont,
    'body'
  );
  const monoFontCss = formatFontFamilyCss(
    studioStyle.typography.monoFont,
    'mono'
  );

  const effectiveStart = Math.max(2, startFrame ?? enterFrame ?? 2);
  if (frame < effectiveStart) {
    return null;
  }

  const enter = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(studioStyle, 'enter'),
  });

  const exit =
    typeof exitFrame === 'number' && frame >= exitFrame
      ? spring({
          frame: frame - exitFrame,
          fps,
          config: SPRING_PRESETS.smooth,
        })
      : 0;

  const visibility = Math.max(0, enter * (1 - exit));
  if (visibility <= 0.005) {
    return null;
  }

  const isVertical = height > width;
  const hasExplicitVariant = variant !== undefined;
  const isLight = variant === 'light';

  const translateY = interpolate(enter, [0, 1], [22, 0]) - exit * 16;
  const scale = interpolate(visibility, [0, 1], [0.96, 1]);
  const accentRuleScale = spring({
    frame: frame - effectiveStart - 3,
    fps,
    config: SPRING_PRESETS.smooth,
  });

  const textPrimary = hasExplicitVariant
    ? isLight
      ? STUDIO_THEME.colors.text.slate900
      : THEME.colors.textPrimary
    : studioStyle.palette.textPrimary;

  const textSecondary = hasExplicitVariant
    ? isLight
      ? STUDIO_THEME.colors.text.secondary
      : THEME.colors.textSecondary
    : studioStyle.palette.textSecondary;

  const displayedKeyword = hasExplicitVariant
    ? keyword
    : formatHeadingText(keyword, studioStyle);

  const baseSurface = hasExplicitVariant
    ? {
        backgroundColor: isLight
          ? STUDIO_THEME.colors.bgSurfaceGlass
          : 'rgba(13, 15, 26, 0.9)',
        border: isLight
          ? `1.5px solid ${STUDIO_THEME.colors.border.subtle}`
          : `1.5px solid ${resolvedAccent}55`,
        boxShadow: isLight
          ? STUDIO_THEME.shadows.cardElevated
          : THEME.shadows.glow(resolvedAccent, 0.7),
      }
    : getTactileSurfaceStyle(studioStyle, {
        elevation: 'lifted',
        tiltDeg: resolvedGrammar === 'risograph-poster' ? -0.7 : 0,
      });

  const cornerRadius =
    resolvedGrammar === 'risograph-poster'
      ? 0
      : resolvedGrammar === 'optical-gate'
        ? Math.max(0, Math.round(4 * studioStyle.surface.radiusScale))
        : Math.max(0, Math.round(8 * studioStyle.surface.radiusScale));

  return (
    <div
      data-card-grammar={resolvedGrammar}
      style={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        gap: 12,
        maxWidth: isVertical && safeBox9x16 ? 820 : 1080,
        padding: isVertical ? '28px 34px' : '34px 44px',
        boxSizing: 'border-box',
        ...baseSurface,
        borderRadius: cornerRadius,
        ...(resolvedGrammar === 'risograph-poster'
          ? {
              border: `2.5px solid ${studioStyle.palette.inkBorder}`,
              boxShadow: `6px 6px 0px ${studioStyle.palette.accentSecondary}`,
            }
          : {}),
        opacity: visibility,
        transform: `translate3d(0, ${translateY.toFixed(2)}px, 0) scale(${scale.toFixed(4)})${
          resolvedGrammar === 'risograph-poster' ? ' rotate(-0.7deg)' : ''
        }`,
        ...style,
      }}
    >
      {/* Top Swiss Register Rule or Risograph Diagonal Bar */}
      {resolvedGrammar === 'swiss-spatial' && (
        <div
          style={{
            width: '100%',
            height: 2,
            backgroundColor: studioStyle.palette.inkBorder,
            marginBottom: 4,
          }}
        >
          <div
            style={{
              width: `${Math.round(accentRuleScale * 38)}%`,
              height: 3,
              marginTop: -0.5,
              backgroundColor: resolvedAccent,
            }}
          />
        </div>
      )}

      {resolvedGrammar === 'optical-gate' && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: monoFontCss,
            fontSize: 13,
            color: resolvedAccent,
            opacity: 0.78,
          }}
        >
          <span>+</span>
          <span>+</span>
        </div>
      )}

      {(eyebrow || badge || icon) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {icon ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: resolvedAccent,
                }}
              >
                {icon}
              </span>
            ) : null}
            {eyebrow ? (
              <span
                style={{
                  fontFamily: monoFontCss,
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: textSecondary,
                }}
              >
                {eyebrow}
              </span>
            ) : null}
          </div>

          {badge ? (
            <span
              style={{
                fontFamily: monoFontCss,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '0.08em',
                padding: '3px 10px',
                borderRadius: 0,
                color:
                  resolvedGrammar === 'risograph-poster'
                    ? '#FFFFFF'
                    : resolvedAccent,
                backgroundColor:
                  resolvedGrammar === 'risograph-poster'
                    ? resolvedAccent
                    : 'transparent',
                border: `1.5px solid ${resolvedAccent}`,
              }}
            >
              {badge}
            </span>
          ) : null}
        </div>
      )}

      <div
        style={{
          fontFamily: displayFontCss,
          fontSize: isVertical ? 46 : 54,
          fontWeight: 800,
          lineHeight: 1.08,
          letterSpacing: `${studioStyle.typography.displayTrackingEm}em`,
          color: textPrimary,
          textShadow:
            resolvedGrammar === 'optical-gate' && optics.halation > 0.1
              ? `0 0 ${Math.round(16 + optics.halation * 24)}px ${resolvedAccent}55`
              : 'none',
        }}
      >
        {displayedKeyword}
      </div>

      {sublabel ? (
        <div
          style={{
            fontFamily: bodyFontCss,
            fontSize: isVertical ? 20 : 22,
            fontWeight: 500,
            lineHeight: 1.38,
            color: textSecondary,
          }}
        >
          {sublabel}
        </div>
      ) : null}
    </div>
  );
};
