import React from 'react';
import {
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  formatFontFamilyCss,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioFontsReady,
  useStudioStyle,
  type StyleTypographyGrammar,
} from "../..";

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
  /** Optional delta stamp badge (e.g. `"+240%"`) */
  badge?: string;
  /** Typographic grammar override (defaults to `studioStyle.optics.typographyGrammar`) */
  grammar?: StyleTypographyGrammar;
  /** Highlight accent color (defaults to `studioStyle.palette.accentPrimary`) */
  accentColor?: string;
  /** Presentation mode (`'inline'` renders pure tabular text without card chrome) */
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
  const sign = intPart!.startsWith('-') ? '-' : '';
  const digits = sign ? intPart!.slice(1) : intPart!;
  const grouped = thousandSeparator
    ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSeparator)
    : digits;
  return decPart !== undefined
    ? `${sign}${grouped}.${decPart}`
    : `${sign}${grouped}`;
}

const VERNIER_TICKS = 21;

/**
 * Smooth 60 FPS Interpolated Number / Currency / Percentage Ticker
 * with precision SVG Vernier scale (`swiss-spatial`, `optical-gate`) or Risograph block meter (`risograph-poster`).
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
  grammar,
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

  const effectiveStart = Math.max(2, startFrame);
  const dur = Math.max(6, durationInFrames);

  const enter =
    frame < effectiveStart
      ? 0
      : spring({
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
    if (frame < effectiveStart) {
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
        borderRadius: resolvedGrammar === 'risograph-poster' ? 0 : 8,
        backgroundColor: isLight
          ? 'rgba(255, 255, 255, 0.88)'
          : 'rgba(13, 15, 26, 0.88)',
        border: isLight
          ? '1.5px solid rgba(203, 213, 225, 0.55)'
          : '1.5px solid rgba(255, 255, 255, 0.14)',
        boxShadow: isLight
          ? '0 32px 64px -12px rgba(37, 99, 235, 0.16), 0 12px 28px -8px rgba(15, 23, 42, 0.08)'
          : `0 0 18px ${resolvedAccent}44, 0 0 44px ${resolvedAccent}26, 0 20px 50px rgba(0, 0, 0, 0.75)`,
      }
    : getTactileSurfaceStyle(studioStyle, {
        elevation: 'resting',
        overrides: {
          borderRadius:
            resolvedGrammar === 'risograph-poster'
              ? 0
              : Math.max(0, Math.round(6 * studioStyle.surface.radiusScale)),
        },
      });

  const textPrimary = hasExplicitVariant
    ? isLight
      ? '#0F172A'
      : '#F8FAFC'
    : studioStyle.palette.textPrimary;

  const textSecondary = hasExplicitVariant
    ? isLight
      ? '#475569'
      : '#94A3B8'
    : studioStyle.palette.textSecondary;

  const litTicks = Math.round(countProgress * (VERNIER_TICKS - 1));

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
        ...(resolvedGrammar === 'risograph-poster' && !hasExplicitVariant
          ? {
              border: `2.5px solid ${studioStyle.palette.inkBorder}`,
              boxShadow: `5px 5px 0px ${studioStyle.palette.inkBorder}`,
            }
          : {}),
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [18, 0]).toFixed(2)}px)`,
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
            textShadow:
              resolvedGrammar === 'optical-gate' && optics.halation > 0.12
                ? `0 0 ${Math.round(14 + optics.halation * 22)}px ${resolvedAccent}55`
                : 'none',
          }}
        >
          {formatted}
        </span>

        {badge ? (
          <span
            style={{
              fontFamily: monoFontCss,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '0.06em',
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

      {label ? (
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
      ) : null}

      {/* Vernier Scale Ticks (swiss-spatial / optical-gate) vs Segmented Stamp Meter (risograph-poster) */}
      {resolvedGrammar === 'risograph-poster' ? (
        <div
          data-risograph-meter="true"
          style={{
            display: 'flex',
            gap: 4,
            marginTop: 4,
            width: '100%',
          }}
        >
          {Array.from({ length: 10 }).map((_, idx) => {
            const active = idx < Math.round(countProgress * 10);
            return (
              <div
                key={idx}
                style={{
                  flex: 1,
                  height: 8,
                  backgroundColor: active
                    ? resolvedAccent
                    : studioStyle.palette.bgElevated,
                  border: `1.5px solid ${studioStyle.palette.inkBorder}`,
                }}
              />
            );
          })}
        </div>
      ) : (
        <svg
          data-vernier-scale="true"
          viewBox="0 0 240 16"
          style={{
            width: '100%',
            minWidth: 200,
            height: 16,
            marginTop: 4,
            overflow: 'visible',
          }}
        >
          {Array.from({ length: VERNIER_TICKS }).map((_, idx) => {
            const x = (idx / (VERNIER_TICKS - 1)) * 236 + 2;
            const isMajor = idx % 5 === 0;
            const isActive = idx <= litTicks;
            return (
              <line
                key={idx}
                x1={x}
                y1={isMajor ? 1 : 5}
                x2={x}
                y2={15}
                stroke={isActive ? resolvedAccent : studioStyle.palette.inkBorder}
                strokeWidth={isMajor ? 2 : 1.2}
                opacity={isActive ? 1 : 0.45}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
};
