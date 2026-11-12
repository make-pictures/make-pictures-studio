import React from 'react';
import {
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  STUDIO_THEME,
  THEME,
  formatFontFamilyCss,
  getCardChromeStyle,
  getStyleSpringConfig,
  useStudioFontsReady,
  useStudioStyle,
} from '@make-pictures/core';

export interface AnimatedMetricCounterProps {
  /** Target numeric value */
  value: number;
  /** Starting numeric value (default `0`) */
  fromValue?: number;
  /** Leading symbol/unit (e.g. `'$'`, `'+'`) */
  prefix?: string;
  /** Trailing symbol/unit (e.g. `'%'`, `' FPS'`, `'×'`) */
  suffix?: string;
  /** Fixed decimal places (default `0`) */
  decimals?: number;
  /** Frame when the ticker starts counting (default `2`, obeying Frame 0 clean board rule) */
  startFrame?: number;
  /** Count-up duration in frames at 60 FPS (default `54`) */
  durationInFrames?: number;
  /** Optional concise 2–3 word label below the counter */
  label?: string;
  /** Optional delta pill badge (e.g. `"+240%"`) */
  badge?: string;
  /** Highlight accent color (defaults to `studioStyle.palette.accentPrimary`) */
  accentColor?: string;
  /** Presentation mode (`'inline'` renders pure tabular text without card chrome; inherits `StylePreset` card chrome when omitted) */
  variant?: 'dark' | 'light' | 'inline';
  /** Thousands separator character (default `','`) */
  thousandSeparator?: string;
  /** Font size in px for the main number */
  fontSize?: number;
  style?: React.CSSProperties;
}

export function formatTabularMetric(
  val: number,
  decimals = 0,
  thousandSeparator = ','
): string {
  const safeDecimals = Math.max(0, Math.min(6, Math.round(decimals)));
  const fixed = val.toFixed(safeDecimals);
  const [intPart, decPart] = fixed.split('.');
  const sign = intPart.startsWith('-') ? '-' : '';
  const digits = sign ? intPart.slice(1) : intPart;
  const grouped = thousandSeparator
    ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSeparator)
    : digits;
  return decPart !== undefined ? `${sign}${grouped}.${decPart}` : `${sign}${grouped}`;
}

/**
 * Smooth 60 FPS Interpolated Number / Currency / Percentage Ticker.
 * Uses `tabular-nums` so digits never jump horizontally while counting.
 */
export const AnimatedMetricCounter: React.FC<AnimatedMetricCounterProps> = ({
  value,
  fromValue = 0,
  prefix = '',
  suffix = '',
  decimals = 0,
  startFrame = 2,
  durationInFrames = 54,
  label,
  badge,
  accentColor,
  variant,
  thousandSeparator = ',',
  fontSize,
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

  const effectiveStart = Math.max(2, startFrame);
  const dur = Math.max(6, durationInFrames);

  const enter = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(studioStyle, 'enter'),
  });

  const countProgress = interpolate(
    frame,
    [effectiveStart, effectiveStart + dur],
    [0, 1],
    {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  const currentVal = fromValue + (value - fromValue) * countProgress;
  const formatted = `${prefix}${formatTabularMetric(
    currentVal,
    decimals,
    thousandSeparator
  )}${suffix}`;

  if (variant === 'inline') {
    if (frame === 0 && startFrame >= 1) {
      return null;
    }
    return (
      <span
        style={{
          fontFamily: displayFontCss,
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          fontSize: fontSize ?? 56,
          color: studioStyle.palette.textPrimary,
          opacity: enter,
          ...style,
        }}
      >
        {formatted}
      </span>
    );
  }

  if (enter <= 0.005) {
    return null;
  }

  const isVertical = height > width;
  const hasExplicitVariant = variant !== undefined;
  const isLight = hasExplicitVariant
    ? variant === 'light'
    : !studioStyle.surface.isDark;
  const resolvedFontSize = fontSize ?? (isVertical ? 68 : 76);

  const chromeStyle: React.CSSProperties = hasExplicitVariant
    ? {
        borderRadius: 24,
        backgroundColor: isLight
          ? STUDIO_THEME.colors.bgSurfaceGlass
          : 'rgba(13, 15, 26, 0.86)',
        border: isLight
          ? `1.5px solid ${STUDIO_THEME.colors.border.subtle}`
          : '1.5px solid rgba(255, 255, 255, 0.12)',
        boxShadow: isLight
          ? STUDIO_THEME.shadows.cardElevated
          : THEME.shadows.glow(resolvedAccent, 0.75),
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

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 10,
        padding: isVertical ? '26px 32px' : '30px 38px',
        boxSizing: 'border-box',
        ...chromeStyle,
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [22, 0]).toFixed(2)}px) scale(${interpolate(enter, [0, 1], [0.94, 1]).toFixed(4)})`,
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 14,
        }}
      >
        <span
          style={{
            fontFamily: displayFontCss,
            fontVariantNumeric: 'tabular-nums',
            fontSize: resolvedFontSize,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: '-0.035em',
            color: textPrimary,
          }}
        >
          {formatted}
        </span>

        {badge && (
          <span
            style={{
              fontFamily: monoFontCss,
              fontSize: 15,
              fontWeight: 700,
              padding: '5px 12px',
              borderRadius: 9999,
              color: '#FFFFFF',
              backgroundColor: resolvedAccent,
            }}
          >
            {badge}
          </span>
        )}
      </div>

      {label && (
        <div
          style={{
            fontFamily: bodyFontCss,
            fontSize: isVertical ? 20 : 21,
            fontWeight: 600,
            color: textSecondary,
          }}
        >
          {label}
        </div>
      )}

      {/* Animated Progress Underline */}
      <div
        style={{
          width: '100%',
          height: 5,
          marginTop: 4,
          borderRadius: 9999,
          backgroundColor: isLight
            ? 'rgba(15, 23, 42, 0.08)'
            : 'rgba(255, 255, 255, 0.12)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.round(countProgress * 100)}%`,
            height: '100%',
            borderRadius: 9999,
            backgroundColor: resolvedAccent,
          }}
        />
      </div>
    </div>
  );
};
