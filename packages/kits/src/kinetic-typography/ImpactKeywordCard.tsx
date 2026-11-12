import React from 'react';
import { Sparkles } from 'lucide-react';
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
  getCardChromeStyle,
  getStyleSpringConfig,
  useStudioFontsReady,
  useStudioStyle,
} from '@make-pictures/core';

export interface ImpactKeywordCardProps {
  /** Primary bold statement (keep concise: 2–4 words per AGENTS.md) */
  keyword: string;
  /** Optional small category eyebrow above the keyword */
  eyebrow?: string;
  /** Optional concise 2–4 word takeaway sublabel */
  sublabel?: string;
  /** Optional status pill badge (e.g. `"60 FPS"`, `"-14 LUFS"`) */
  badge?: string;
  /** Custom icon node (`lucide-react`); defaults to `<Sparkles />` unless `icon={null}` */
  icon?: React.ReactNode;
  /** Accent bar & glow color (defaults to `studioStyle.palette.accentPrimary`) */
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
 * Bold 60 FPS Typographic Hero Card with glowing accent bar, icon badge,
 * and high-damping (`damping: 200`) spring entrance.
 */
export const ImpactKeywordCard: React.FC<ImpactKeywordCardProps> = ({
  keyword,
  eyebrow,
  sublabel,
  badge,
  icon,
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

  const enter = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(studioStyle, 'enter'),
  });

  const exit =
    typeof exitFrame === 'number'
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

  const translateY = interpolate(enter, [0, 1], [28, 0]) - exit * 18;
  const scale = interpolate(visibility, [0, 1], [0.93, 1]);
  const accentBarScale = spring({
    frame: frame - effectiveStart - 4,
    fps,
    config: SPRING_PRESETS.smooth,
  });

  const resolvedIcon =
    icon === undefined ? (
      <Sparkles size={isVertical ? 30 : 34} color="#FFFFFF" strokeWidth={2.4} />
    ) : (
      icon
    );

  const chromeStyle: React.CSSProperties = hasExplicitVariant
    ? {
        borderRadius: 26,
        backgroundColor: isLight
          ? STUDIO_THEME.colors.bgSurfaceGlass
          : 'rgba(13, 15, 26, 0.86)',
        border: isLight
          ? `1.5px solid ${STUDIO_THEME.colors.border.subtle}`
          : '1.5px solid rgba(255, 255, 255, 0.14)',
        boxShadow: isLight
          ? STUDIO_THEME.shadows.cardElevated
          : THEME.shadows.glow(resolvedAccent, 0.9),
        backdropFilter: 'blur(16px)',
      }
    : getCardChromeStyle(studioStyle);

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

  const eyebrowColor = hasExplicitVariant
    ? isLight
      ? STUDIO_THEME.colors.text.muted
      : THEME.colors.textSecondary
    : studioStyle.palette.textSecondary;

  const iconRadius = hasExplicitVariant
    ? 20
    : Math.max(0, Math.round(18 * studioStyle.surface.radiusScale));

  const displayedKeyword = hasExplicitVariant
    ? keyword
    : formatHeadingText(keyword, studioStyle);

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: isVertical ? 22 : 28,
        maxWidth: isVertical && safeBox9x16 ? 830 : 1080,
        padding: isVertical ? '28px 34px' : '32px 42px',
        boxSizing: 'border-box',
        ...chromeStyle,
        opacity: visibility,
        transform: `translate3d(0, ${translateY.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`,
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Left Vertical Accent Bar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 8,
          backgroundColor: resolvedAccent,
          transformOrigin: 'top center',
          transform: `scaleY(${accentBarScale.toFixed(4)})`,
        }}
      />

      {/* Icon Tile */}
      {resolvedIcon && (
        <div
          style={{
            width: isVertical ? 64 : 72,
            height: isVertical ? 64 : 72,
            borderRadius: iconRadius,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(135deg, ${resolvedAccent} 0%, ${resolvedAccent}CC 100%)`,
            boxShadow: `0 12px 28px ${resolvedAccent}55`,
          }}
        >
          {resolvedIcon}
        </div>
      )}

      {/* Typography Column */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          minWidth: 0,
        }}
      >
        {(eyebrow || badge) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            {eyebrow && (
              <span
                style={{
                  fontFamily: monoFontCss,
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: eyebrowColor,
                }}
              >
                {eyebrow}
              </span>
            )}
            {badge && (
              <span
                style={{
                  fontFamily: monoFontCss,
                  fontSize: 14,
                  fontWeight: 700,
                  padding: '3px 11px',
                  borderRadius: 9999,
                  color: '#FFFFFF',
                  backgroundColor: resolvedAccent,
                }}
              >
                {badge}
              </span>
            )}
          </div>
        )}

        <div
          style={{
            fontFamily: displayFontCss,
            fontSize: isVertical ? 44 : 52,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: `${studioStyle.typography.displayTrackingEm}em`,
            color: textPrimary,
          }}
        >
          {displayedKeyword}
        </div>

        {sublabel && (
          <div
            style={{
              fontFamily: bodyFontCss,
              fontSize: isVertical ? 20 : 22,
              fontWeight: 500,
              color: textSecondary,
            }}
          >
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
};
