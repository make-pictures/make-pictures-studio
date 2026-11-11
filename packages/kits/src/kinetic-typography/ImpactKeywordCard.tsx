import React from 'react';
import { Sparkles } from 'lucide-react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  FONTS,
  SPRING_PRESETS,
  STUDIO_THEME,
  THEME,
  useStudioFontsReady,
} from '../../../core/src/theme';

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
  /** Accent bar & glow color (default `STUDIO_THEME.colors.brand[600]`) */
  accentColor?: string;
  /** Theme surface mode (default `'dark'`) */
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
  accentColor = STUDIO_THEME.colors.brand[600],
  variant = 'dark',
  enterFrame,
  startFrame,
  exitFrame,
  safeBox9x16 = true,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  useStudioFontsReady();

  const effectiveStart = Math.max(2, startFrame ?? enterFrame ?? 2);

  const enter = spring({
    frame: frame - effectiveStart,
    fps,
    config: SPRING_PRESETS.snappy,
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

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: isVertical ? 22 : 28,
        maxWidth: isVertical && safeBox9x16 ? 830 : 1080,
        padding: isVertical ? '28px 34px' : '32px 42px',
        borderRadius: 26,
        boxSizing: 'border-box',
        backgroundColor: isLight
          ? STUDIO_THEME.colors.bgSurfaceGlass
          : 'rgba(13, 15, 26, 0.86)',
        border: isLight
          ? `1.5px solid ${STUDIO_THEME.colors.border.subtle}`
          : `1.5px solid rgba(255, 255, 255, 0.14)`,
        boxShadow: isLight
          ? STUDIO_THEME.shadows.cardElevated
          : THEME.shadows.glow(accentColor, 0.9),
        backdropFilter: 'blur(16px)',
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
          backgroundColor: accentColor,
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
            borderRadius: 20,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}CC 100%)`,
            boxShadow: `0 12px 28px ${accentColor}55`,
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
                  fontFamily: FONTS.mono,
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: isLight
                    ? STUDIO_THEME.colors.text.muted
                    : THEME.colors.textSecondary,
                }}
              >
                {eyebrow}
              </span>
            )}
            {badge && (
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 14,
                  fontWeight: 700,
                  padding: '3px 11px',
                  borderRadius: 9999,
                  color: '#FFFFFF',
                  backgroundColor: accentColor,
                }}
              >
                {badge}
              </span>
            )}
          </div>
        )}

        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: isVertical ? 44 : 52,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.025em',
            color: isLight
              ? STUDIO_THEME.colors.text.slate900
              : THEME.colors.textPrimary,
          }}
        >
          {keyword}
        </div>

        {sublabel && (
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: isVertical ? 20 : 22,
              fontWeight: 500,
              color: isLight
                ? STUDIO_THEME.colors.text.secondary
                : THEME.colors.textSecondary,
            }}
          >
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
};
