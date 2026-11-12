import React from 'react';
import { ArrowRight } from 'lucide-react';
import {
  Easing,
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

export interface MetricComparisonCardProps {
  title?: string;
  beforeLabel: string;
  beforeValue: number;
  afterLabel: string;
  afterValue: number;
  /** Optional reference ceiling for progress rings/bars */
  maxValue?: number;
  prefix?: string;
  unit?: string;
  decimals?: number;
  /** Custom delta badge (auto-computed when omitted, e.g. `"+180%"` or `"-65%"`) */
  deltaBadge?: string;
  /** Visual gauge representation (default `'rings'`) */
  mode?: 'rings' | 'bars';
  beforeColor?: string;
  afterColor?: string;
  enterFrame?: number;
  startFrame?: number;
  variant?: 'dark' | 'light';
  safeBox9x16?: boolean;
  style?: React.CSSProperties;
}

function computeAutoDelta(before: number, after: number): string {
  if (Math.abs(before) < 1e-6) {
    return after >= 0 ? `+${after.toFixed(0)}` : `${after.toFixed(0)}`;
  }
  const pct = ((after - before) / Math.abs(before)) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${Math.round(pct)}%`;
}

interface RadialGaugeProps {
  fraction: number;
  color: string;
  textLabel: string;
  isLight: boolean;
  size: number;
  displayFontCss: string;
  textColor: string;
}

const RadialGauge: React.FC<RadialGaugeProps> = ({
  fraction,
  color,
  textLabel,
  isLight,
  size,
  displayFontCss,
  textColor,
}) => {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, fraction));
  const dashOffset = circumference * (1 - clamped);

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.10)'}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <span
        style={{
          position: 'absolute',
          fontFamily: displayFontCss,
          fontVariantNumeric: 'tabular-nums',
          fontSize: size >= 156 ? 32 : 28,
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: textColor,
        }}
      >
        {textLabel}
      </span>
    </div>
  );
};

/**
 * Before / After (A/B) 60 FPS Visual Delta Comparison Card with animated
 * radial progress rings or bars, tabular counters, and delta pill.
 */
export const MetricComparisonCard: React.FC<MetricComparisonCardProps> = ({
  title,
  beforeLabel,
  beforeValue,
  afterLabel,
  afterValue,
  maxValue,
  prefix = '',
  unit = '',
  decimals = 0,
  deltaBadge,
  mode = 'rings',
  beforeColor,
  afterColor,
  enterFrame,
  startFrame,
  variant,
  safeBox9x16 = true,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  useStudioFontsReady();
  const studioStyle = useStudioStyle();

  const resolvedBeforeColor = beforeColor ?? studioStyle.palette.textSecondary;
  const resolvedAfterColor = afterColor ?? studioStyle.palette.accentPrimary;
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

  if (enter <= 0.005) {
    return null;
  }

  const beforeProgress = interpolate(
    frame,
    [effectiveStart + 4, effectiveStart + 44],
    [0, 1],
    {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );
  const afterProgress = interpolate(
    frame,
    [effectiveStart + 14, effectiveStart + 60],
    [0, 1],
    {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );
  const badgePop = spring({
    frame: frame - (effectiveStart + 24),
    fps,
    config: SPRING_PRESETS.snappy,
  });

  const ceiling = Math.max(
    1e-6,
    maxValue ?? Math.max(Math.abs(beforeValue), Math.abs(afterValue)) * 1.12
  );

  const curBefore = beforeValue * beforeProgress;
  const curAfter = afterValue * afterProgress;
  const beforeFrac = Math.abs(curBefore) / ceiling;
  const afterFrac = Math.abs(curAfter) / ceiling;

  const formattedBefore = `${prefix}${curBefore.toFixed(decimals)}${unit}`;
  const formattedAfter = `${prefix}${curAfter.toFixed(decimals)}${unit}`;
  const resolvedDelta = deltaBadge ?? computeAutoDelta(beforeValue, afterValue);

  const isVerticalViewport = height > width;
  const hasExplicitVariant = variant !== undefined;
  const isLight = hasExplicitVariant
    ? variant === 'light'
    : !studioStyle.surface.isDark;
  const cardWidth =
    isVerticalViewport && safeBox9x16 ? Math.min(830, width - 90) : 880;
  const gaugeSize = isVerticalViewport ? 148 : 164;

  const chromeStyle: React.CSSProperties = hasExplicitVariant
    ? {
        borderRadius: 26,
        backgroundColor: isLight
          ? STUDIO_THEME.colors.bgSurfaceGlass
          : 'rgba(13, 15, 26, 0.88)',
        border: isLight
          ? `1.5px solid ${STUDIO_THEME.colors.border.subtle}`
          : '1.5px solid rgba(255, 255, 255, 0.12)',
        boxShadow: isLight
          ? STUDIO_THEME.shadows.cardElevated
          : THEME.shadows.glow(resolvedAfterColor, 0.7),
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

  return (
    <div
      style={{
        width: cardWidth,
        padding: isVerticalViewport ? '28px 30px' : '34px 42px',
        boxSizing: 'border-box',
        ...chromeStyle,
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [24, 0]).toFixed(2)}px) scale(${interpolate(enter, [0, 1], [0.95, 1]).toFixed(4)})`,
        ...style,
      }}
    >
      {/* Header + Delta Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 26,
        }}
      >
        {title ? (
          <div
            style={{
              fontFamily: displayFontCss,
              fontSize: isVerticalViewport ? 28 : 30,
              fontWeight: 800,
              letterSpacing: `${studioStyle.typography.displayTrackingEm}em`,
              color: textPrimary,
            }}
          >
            {hasExplicitVariant ? title : formatHeadingText(title, studioStyle)}
          </div>
        ) : (
          <div />
        )}

        <div
          style={{
            fontFamily: monoFontCss,
            fontSize: 17,
            fontWeight: 800,
            padding: '6px 16px',
            borderRadius: 9999,
            color: '#FFFFFF',
            backgroundColor: resolvedAfterColor,
            boxShadow: `0 8px 24px ${resolvedAfterColor}55`,
            opacity: badgePop,
            transform: `scale(${interpolate(badgePop, [0, 1], [0.85, 1]).toFixed(3)})`,
          }}
        >
          {resolvedDelta}
        </div>
      </div>

      {mode === 'rings' ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            gap: 20,
          }}
        >
          {/* BEFORE RING */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <RadialGauge
              fraction={beforeFrac}
              color={resolvedBeforeColor}
              textLabel={formattedBefore}
              isLight={isLight}
              size={gaugeSize}
              displayFontCss={displayFontCss}
              textColor={textPrimary}
            />
            <span
              style={{
                fontFamily: bodyFontCss,
                fontSize: 19,
                fontWeight: 600,
                color: textSecondary,
              }}
            >
              {beforeLabel}
            </span>
          </div>

          {/* CENTER ARROW */}
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: hasExplicitVariant
                ? isLight
                  ? 'rgba(15, 23, 42, 0.06)'
                  : 'rgba(255, 255, 255, 0.08)'
                : studioStyle.palette.bgElevated,
              opacity: badgePop,
            }}
          >
            <ArrowRight size={26} color={resolvedAfterColor} strokeWidth={2.8} />
          </div>

          {/* AFTER RING */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <RadialGauge
              fraction={afterFrac}
              color={resolvedAfterColor}
              textLabel={formattedAfter}
              isLight={isLight}
              size={gaugeSize}
              displayFontCss={displayFontCss}
              textColor={textPrimary}
            />
            <span
              style={{
                fontFamily: bodyFontCss,
                fontSize: 19,
                fontWeight: 700,
                color: textPrimary,
              }}
            >
              {afterLabel}
            </span>
          </div>
        </div>
      ) : (
        /* Horizontal Bars Mode */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {[
            {
              lbl: beforeLabel,
              txt: formattedBefore,
              frac: beforeFrac,
              col: resolvedBeforeColor,
              bold: false,
            },
            {
              lbl: afterLabel,
              txt: formattedAfter,
              frac: afterFrac,
              col: resolvedAfterColor,
              bold: true,
            },
          ].map((row, idx) => (
            <div
              key={idx}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontFamily: bodyFontCss,
                    fontSize: 20,
                    fontWeight: row.bold ? 700 : 600,
                    color: row.bold ? textPrimary : textSecondary,
                  }}
                >
                  {row.lbl}
                </span>
                <span
                  style={{
                    fontFamily: monoFontCss,
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 22,
                    fontWeight: 800,
                    color: row.bold ? row.col : textSecondary,
                  }}
                >
                  {row.txt}
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: 18,
                  borderRadius: 9999,
                  backgroundColor: isLight
                    ? 'rgba(15, 23, 42, 0.08)'
                    : 'rgba(255, 255, 255, 0.09)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.max(4, row.frac * 100).toFixed(2)}%`,
                    height: '100%',
                    borderRadius: 9999,
                    backgroundColor: row.col,
                    boxShadow: row.bold ? `0 0 18px ${row.col}66` : 'none',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
