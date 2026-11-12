import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  SPRING_PRESETS,
  THEME,
  formatFontFamilyCss,
  formatHeadingText,
  getCardChromeStyle,
  getStyleSpringConfig,
  useStudioStyle,
} from '@make-pictures/core';

export interface SystemNodeProps {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  statusText: string;
  activeStatusText?: string;
  icon: LucideIcon;
  x: number;
  y: number;
  width?: number;
  height?: number;
  accentColor?: string;
  variant?: 'dark' | 'light';
  enterFrame?: number;
  activeRanges?: Array<[number, number]>;
  metricsLabel?: string;
  metricsValue?: string;
}

export const SystemNode: React.FC<SystemNodeProps> = ({
  title,
  subtitle,
  badge,
  statusText,
  activeStatusText,
  icon: Icon,
  x,
  y,
  width = 340,
  height = 188,
  accentColor,
  variant,
  enterFrame = 0,
  activeRanges = [],
  metricsLabel,
  metricsValue,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
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

  const enterProgress = spring({
    frame: frame - enterFrame,
    fps,
    config: getStyleSpringConfig(studioStyle, 'enter'),
  });

  if (enterProgress <= 0.002) {
    return null;
  }

  let activeStrength = 0;
  for (const [start, end] of activeRanges) {
    if (frame >= start - 8 && frame <= end + 24) {
      const rampIn = spring({
        frame: frame - start,
        fps,
        config: SPRING_PRESETS.smooth,
      });
      const rampOut = interpolate(frame, [end, end + 22], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      activeStrength = Math.max(activeStrength, rampIn * rampOut);
    }
  }

  const isCurrentlyActive = activeStrength > 0.35;
  const pulseWave = interpolate(
    Math.sin((frame - enterFrame) * 0.045),
    [-1, 1],
    [0.82, 1.1]
  );
  const glowIntensity = activeStrength * pulseWave;

  const scale =
    interpolate(enterProgress, [0, 1], [0.88, 1]) +
    interpolate(activeStrength, [0, 1], [0, 0.024]);
  const translateY = interpolate(enterProgress, [0, 1], [28, 0]);
  const opacity = interpolate(enterProgress, [0, 0.65, 1], [0, 0.9, 1]);

  const displayedStatus =
    isCurrentlyActive && activeStatusText ? activeStatusText : statusText;

  const isDark =
    variant === 'dark'
      ? true
      : variant === 'light'
        ? false
        : studioStyle.surface.isDark;

  const baseChrome =
    variant === 'dark'
      ? {
          borderRadius: THEME.radii.lg,
          backgroundColor: 'rgba(15, 18, 29, 0.95)',
          border: `1px solid ${
            isCurrentlyActive ? `${resolvedAccent}88` : 'rgba(255, 255, 255, 0.09)'
          }`,
          boxShadow:
            activeStrength > 0.02
              ? THEME.shadows.glow(resolvedAccent, glowIntensity)
              : THEME.shadows.card,
        }
      : getCardChromeStyle(studioStyle, {
          ...(isCurrentlyActive
            ? {
                border: `1.5px solid ${resolvedAccent}AA`,
                boxShadow: THEME.shadows.glow(resolvedAccent, glowIntensity),
              }
            : {}),
        });

  const textPrimary =
    variant === 'dark' ? THEME.colors.textPrimary : studioStyle.palette.textPrimary;
  const textSecondary =
    variant === 'dark'
      ? THEME.colors.textSecondary
      : studioStyle.palette.textSecondary;
  const dividerColor = isDark
    ? 'rgba(255, 255, 255, 0.07)'
    : `${studioStyle.palette.inkBorder}AA`;

  return (
    <div
      style={{
        position: 'absolute',
        left: x - width / 2,
        top: y - height / 2,
        width,
        height,
        opacity,
        willChange: 'transform, opacity',
        transform: `translate3d(0, ${translateY}px, 0) scale(${scale})`,
        ...baseChrome,
        backgroundImage: isDark
          ? `radial-gradient(130% 110% at 50% 0%, ${resolvedAccent}${
              isCurrentlyActive ? '26' : '0E'
            } 0%, rgba(15, 18, 29, 0.6) 68%)`
          : `radial-gradient(130% 110% at 50% 0%, ${resolvedAccent}${
              isCurrentlyActive ? '20' : '0A'
            } 0%, transparent 72%)`,
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '12%',
          right: '12%',
          height: 1.5,
          background: `linear-gradient(90deg, transparent, ${
            isCurrentlyActive ? resolvedAccent : studioStyle.palette.inkBorder
          }, transparent)`,
          opacity: interpolate(activeStrength, [0, 1], [0.55, 1]),
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: Math.max(
              0,
              Math.round(12 * studioStyle.surface.radiusScale)
            ),
            backgroundColor: `${resolvedAccent}${isCurrentlyActive ? '28' : '14'}`,
            border: `1px solid ${resolvedAccent}${isCurrentlyActive ? '77' : '33'}`,
            boxShadow: isCurrentlyActive
              ? `0 0 22px ${resolvedAccent}55`
              : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            size={22}
            color={isCurrentlyActive && isDark ? '#FFFFFF' : resolvedAccent}
            strokeWidth={2}
          />
        </div>

        <div
          style={{
            padding: '4px 10px',
            borderRadius: THEME.radii.pill,
            backgroundColor: isDark
              ? 'rgba(255, 255, 255, 0.045)'
              : studioStyle.palette.bgElevated,
            border: `1px solid ${
              isDark ? 'rgba(255, 255, 255, 0.08)' : studioStyle.palette.inkBorder
            }`,
            fontFamily: monoFontCss,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: isCurrentlyActive ? resolvedAccent : textSecondary,
          }}
        >
          {badge}
        </div>
      </div>

      <div style={{ marginTop: 6 }}>
        <div
          style={{
            fontFamily: displayFontCss,
            fontSize: 21,
            fontWeight: 600,
            letterSpacing: `${studioStyle.typography.displayTrackingEm}em`,
            color: textPrimary,
            lineHeight: 1.2,
          }}
        >
          {variant === 'dark' ? title : formatHeadingText(title, studioStyle)}
        </div>
        <div
          style={{
            fontFamily: bodyFontCss,
            fontSize: 13,
            fontWeight: 400,
            color: textSecondary,
            marginTop: 4,
            lineHeight: 1.35,
          }}
        >
          {subtitle}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 10,
          borderTop: `1px solid ${dividerColor}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: isCurrentlyActive
                ? resolvedAccent
                : 'rgba(148, 163, 184, 0.45)',
              boxShadow: isCurrentlyActive
                ? `0 0 12px ${resolvedAccent}, 0 0 24px ${resolvedAccent}`
                : 'none',
            }}
          />
          <span
            style={{
              fontFamily: monoFontCss,
              fontSize: 11.5,
              fontWeight: 500,
              color: isCurrentlyActive ? textPrimary : textSecondary,
              letterSpacing: '0.02em',
            }}
          >
            {displayedStatus}
          </span>
        </div>

        {metricsLabel && metricsValue && (
          <div
            style={{
              fontFamily: monoFontCss,
              fontSize: 11,
              color: textSecondary,
            }}
          >
            <span style={{ color: textSecondary }}>{metricsLabel}: </span>
            <span style={{ color: isCurrentlyActive ? resolvedAccent : textPrimary }}>
              {metricsValue}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
