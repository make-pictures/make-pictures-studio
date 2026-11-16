import React from 'react';
import {
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  ClippedSurfaceChrome,
  SPRING_PRESETS,
  formatFontFamilyCss,
  formatHeadingText,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioFontsReady,
  useStudioStyle,
} from '@make-pictures/core';

export interface MetricComparisonCardProps {
  title?: string;
  beforeLabel: string;
  beforeValue: number;
  afterLabel: string;
  afterValue: number;
  /** Optional reference ceiling for gauges/bars */
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

function sanitizePatternToken(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function computeAutoDelta(before: number, after: number): string {
  if (Math.abs(before) < 1e-6) {
    return after >= 0 ? `+${after.toFixed(0)}` : `${after.toFixed(0)}`;
  }
  const pct = ((after - before) / Math.abs(before)) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${Math.round(pct)}%`;
}

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleFromTopDeg: number
): { x: number; y: number } {
  const rad = ((angleFromTopDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc240(
  cx: number,
  cy: number,
  r: number,
  fraction: number
): string {
  const clamped = Math.max(0, Math.min(1, fraction));
  if (clamped <= 0.002) {
    return '';
  }
  const startDeg = -120;
  const sweepDeg = clamped * 240;
  const endDeg = startDeg + sweepDeg;
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

interface CalibratedDialProps {
  fraction: number;
  color: string;
  needleColor: string;
  tickColor: string;
  textLabel: string;
  size: number;
  displayFontCss: string;
  textColor: string;
}

const CalibratedDial240: React.FC<CalibratedDialProps> = ({
  fraction,
  color,
  needleColor,
  tickColor,
  textLabel,
  size,
  displayFontCss,
  textColor,
}) => {
  const cx = size / 2;
  const cy = size * 0.54;
  const outerR = size * 0.44;
  const arcR = size * 0.36;
  const clamped = Math.max(0, Math.min(1, fraction));
  const needleAngle = -120 + clamped * 240;
  const needleTip = polarToCartesian(cx, cy, arcR - 6, needleAngle);
  const trackPath = describeArc240(cx, cy, arcR, 1);
  const valuePath = describeArc240(cx, cy, arcR, clamped);

  return (
    <div
      data-instrument-arc="240"
      style={{
        position: 'relative',
        width: size,
        height: Math.round(size * 0.88),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
    >
      <svg
        width={size}
        height={Math.round(size * 0.88)}
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
      >
        {/* 25 Calibrated Degree Ticks (-120° .. +120° from top every 10°) */}
        {Array.from({ length: 25 }).map((_, idx) => {
          const deg = -120 + idx * 10;
          const isMajor = idx % 6 === 0;
          const pOut = polarToCartesian(cx, cy, outerR, deg);
          const pIn = polarToCartesian(
            cx,
            cy,
            outerR - (isMajor ? 7 : 4),
            deg
          );
          return (
            <line
              key={idx}
              x1={pIn.x.toFixed(2)}
              y1={pIn.y.toFixed(2)}
              x2={pOut.x.toFixed(2)}
              y2={pOut.y.toFixed(2)}
              stroke={idx / 24 <= clamped + 0.01 ? color : tickColor}
              strokeWidth={isMajor ? 1.6 : 1}
              opacity={idx / 24 <= clamped + 0.01 ? 0.95 : 0.45}
            />
          );
        })}

        {/* Reference Track Arc */}
        {trackPath ? (
          <path
            d={trackPath}
            fill="none"
            stroke={tickColor}
            strokeWidth={4}
            strokeLinecap="butt"
            opacity={0.3}
          />
        ) : null}

        {/* Active Value Arc (butt cap, zero smartwatch round caps) */}
        {valuePath ? (
          <path
            d={valuePath}
            fill="none"
            stroke={color}
            strokeWidth={5.5}
            strokeLinecap="butt"
          />
        ) : null}

        {/* Indicator Needle + Pivot */}
        <line
          x1={cx}
          y1={cy}
          x2={needleTip.x.toFixed(2)}
          y2={needleTip.y.toFixed(2)}
          stroke={needleColor}
          strokeWidth={1.8}
        />
        <circle cx={cx} cy={cy} r={3.5} fill={needleColor} />
      </svg>

      <span
        style={{
          position: 'relative',
          fontFamily: displayFontCss,
          fontVariantNumeric: 'tabular-nums',
          fontSize: size >= 156 ? 28 : 24,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: textColor,
        }}
      >
        {textLabel}
      </span>
    </div>
  );
};

/**
 * Calibrated 240° Instrument Dial (`mode="rings"`) & Hatched Delta Span Comparator (`mode="bars"`).
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
  const optics = resolveStyleOptics(studioStyle);
  const grammar = optics.typographyGrammar;

  const effectiveStart = Math.max(2, startFrame ?? enterFrame ?? 2);
  if (frame < effectiveStart) {
    return null;
  }

  const enter = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(studioStyle, 'enter'),
  });
  if (enter <= 0.005) {
    return null;
  }

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
    frame: frame - (effectiveStart + 22),
    fps,
    config: SPRING_PRESETS.snappy,
  });

  const ceiling = Math.max(
    1e-6,
    maxValue ?? Math.max(Math.abs(beforeValue), Math.abs(afterValue)) * 1.12
  );

  const curBefore = beforeValue * beforeProgress;
  const curAfter = afterValue * afterProgress;
  const beforeFrac = Math.min(1, Math.abs(curBefore) / ceiling);
  const afterFrac = Math.min(1, Math.abs(curAfter) / ceiling);

  const formattedBefore = `${prefix}${curBefore.toFixed(decimals)}${unit}`;
  const formattedAfter = `${prefix}${curAfter.toFixed(decimals)}${unit}`;
  const resolvedDelta = deltaBadge ?? computeAutoDelta(beforeValue, afterValue);

  const isVerticalViewport = height > width;
  const isDark =
    variant !== undefined ? variant === 'dark' : studioStyle.surface.isDark;
  const textPrimary =
    variant !== undefined
      ? isDark
        ? '#F8FAFC'
        : '#0F172A'
      : studioStyle.palette.textPrimary;
  const textSecondary =
    variant !== undefined
      ? isDark
        ? '#94A3B8'
        : '#475569'
      : studioStyle.palette.textSecondary;
  const borderColor =
    variant !== undefined
      ? isDark
        ? 'rgba(148, 163, 184, 0.28)'
        : 'rgba(15, 23, 42, 0.2)'
      : studioStyle.palette.inkBorder;

  const cardWidth =
    isVerticalViewport && safeBox9x16
      ? Math.min(788, Math.round(width * 0.73))
      : 880;
  const gaugeSize = isVerticalViewport ? 148 : 166;

  const minSpanFrac = Math.min(beforeFrac, afterFrac);
  const maxSpanFrac = Math.max(beforeFrac, afterFrac);
  const deltaHatchId = `delta-hatch-${sanitizePatternToken(studioStyle.id)}-${sanitizePatternToken(beforeLabel)}-${sanitizePatternToken(afterLabel)}`;

  return (
    <div
      style={getTactileSurfaceStyle(studioStyle, {
        elevation: 'lifted',
        overrides: {
          position: 'relative',
          width: cardWidth,
          maxWidth: '100%',
          padding: isVerticalViewport ? '26px 28px' : '32px 40px',
          boxSizing: 'border-box',
          borderRadius:
            grammar === 'risograph-poster'
              ? 0
              : Math.max(0, Math.round(14 * studioStyle.surface.radiusScale)),
          ...(variant !== undefined
            ? {
                backgroundColor: isDark ? '#0D1321' : '#FAF8F4',
                borderColor,
              }
            : {}),
          opacity: enter,
          transform: `translateY(${interpolate(enter, [0, 1], [20, 0]).toFixed(2)}px) scale(${interpolate(enter, [0, 1], [0.97, 1]).toFixed(4)})`,
          ...style,
        },
      })}
    >
      <ClippedSurfaceChrome
        topBarHeight={grammar === 'risograph-poster' ? 5 : 3}
        topBarColor={resolvedAfterColor}
        specularRim={!isDark}
        tintGradient={
          isDark
            ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, transparent 48%)'
            : 'linear-gradient(180deg, rgba(255, 255, 255, 0.62) 0%, rgba(255, 255, 255, 0) 48%)'
        }
      />

      {/* Header + Tabular Rectangular Delta Stamp */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          paddingBottom: 14,
          marginBottom: 22,
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        {title ? (
          <div
            style={{
              fontFamily: displayFontCss,
              fontSize: isVerticalViewport ? 26 : 30,
              fontWeight: 700,
              letterSpacing: `${studioStyle.typography.displayTrackingEm}em`,
              color: textPrimary,
            }}
          >
            {variant !== undefined
              ? title
              : formatHeadingText(title, studioStyle)}
          </div>
        ) : (
          <span />
        )}

        <div
          style={{
            fontFamily: monoFontCss,
            fontVariantNumeric: 'tabular-nums',
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: '0.06em',
            padding: '5px 12px',
            border: `1.5px solid ${resolvedAfterColor}`,
            color:
              grammar === 'risograph-poster' ? '#FFFFFF' : resolvedAfterColor,
            backgroundColor:
              grammar === 'risograph-poster'
                ? resolvedAfterColor
                : `${resolvedAfterColor}14`,
            boxShadow:
              grammar === 'optical-gate' && optics.halation > 0.05
                ? `0 0 ${Math.round(10 + optics.halation * 18)}px ${resolvedAfterColor}44`
                : 'none',
            opacity: badgePop,
          }}
        >
          Δ {resolvedDelta}
        </div>
      </div>

      {mode === 'rings' ? (
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            gap: 16,
          }}
        >
          {/* Baseline Calibrated 240° Dial */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CalibratedDial240
              fraction={beforeFrac}
              color={resolvedBeforeColor}
              needleColor={textSecondary}
              tickColor={borderColor}
              textLabel={formattedBefore}
              size={gaugeSize}
              displayFontCss={displayFontCss}
              textColor={textSecondary}
            />
            <span
              style={{
                fontFamily: bodyFontCss,
                fontSize: 18,
                fontWeight: 600,
                color: textSecondary,
              }}
            >
              {beforeLabel}
            </span>
          </div>

          {/* Technical Datum Bridge */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              opacity: badgePop,
              fontFamily: monoFontCss,
              fontSize: 12,
              letterSpacing: '0.14em',
              color: textSecondary,
            }}
          >
            <span>BAZA ──┼── WYNIK</span>
            <div
              style={{
                width: isVerticalViewport ? 48 : 72,
                height: 1.5,
                backgroundColor: resolvedAfterColor,
              }}
            />
          </div>

          {/* Target Calibrated 240° Dial */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CalibratedDial240
              fraction={afterFrac}
              color={resolvedAfterColor}
              needleColor={textPrimary}
              tickColor={borderColor}
              textLabel={formattedAfter}
              size={gaugeSize}
              displayFontCss={displayFontCss}
              textColor={textPrimary}
            />
            <span
              style={{
                fontFamily: bodyFontCss,
                fontSize: 18,
                fontWeight: 700,
                color: textPrimary,
              }}
            >
              {afterLabel}
            </span>
          </div>
        </div>
      ) : (
        /* Dual-Track Sharp Comparator + 45° SVG Hatched Delta Span Mode */
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              fontFamily: monoFontCss,
              fontVariantNumeric: 'tabular-nums',
              fontSize: 16,
            }}
          >
            <span style={{ color: textSecondary }}>
              {beforeLabel}: <strong>{formattedBefore}</strong>
            </span>
            <span style={{ color: resolvedAfterColor, fontWeight: 700 }}>
              {afterLabel}: {formattedAfter}
            </span>
          </div>

          {/* Baseline Track + Target Track with Vertical beforeFrac Datum & 45° SVG Hatched Delta Span */}
          <div
            data-delta-hatch="true"
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: '6px 0',
              borderLeft: `2px solid ${textPrimary}`,
            }}
          >
            {/* Track 1: Baseline (`beforeFrac`) */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: 12,
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.06)'
                  : 'rgba(15, 23, 42, 0.05)',
              }}
            >
              <div
                style={{
                  width: `${(beforeFrac * 100).toFixed(2)}%`,
                  height: '100%',
                  backgroundColor: resolvedBeforeColor,
                  opacity: 0.78,
                }}
              />
            </div>

            {/* Track 2: Outcome + 45° SVG Hatched Delta Span (`[minSpanFrac, maxSpanFrac]`) */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: 18,
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.06)'
                  : 'rgba(15, 23, 42, 0.05)',
              }}
            >
              {/* Solid common span */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${(minSpanFrac * 100).toFixed(2)}%`,
                  backgroundColor:
                    afterFrac >= beforeFrac
                      ? resolvedBeforeColor
                      : resolvedAfterColor,
                  opacity: afterFrac >= beforeFrac ? 0.68 : 0.92,
                }}
              />

              {/* 45° SVG Hatched Delta Interval */}
              <div
                style={{
                  position: 'absolute',
                  left: `${(minSpanFrac * 100).toFixed(2)}%`,
                  top: 0,
                  bottom: 0,
                  width: `${Math.max(0, (maxSpanFrac - minSpanFrac) * 100).toFixed(2)}%`,
                  boxSizing: 'border-box',
                  borderRight: `2.5px solid ${resolvedAfterColor}`,
                  overflow: 'hidden',
                }}
              >
                <svg
                  width="100%"
                  height="100%"
                  style={{ position: 'absolute', inset: 0, display: 'block' }}
                >
                  <defs>
                    <pattern
                      id={deltaHatchId}
                      width="8"
                      height="8"
                      patternUnits="userSpaceOnUse"
                      patternTransform="rotate(45)"
                    >
                      <rect
                        width="8"
                        height="8"
                        fill={`${resolvedAfterColor}24`}
                      />
                      <line
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="8"
                        stroke={resolvedAfterColor}
                        strokeWidth="3"
                      />
                    </pattern>
                  </defs>
                  <rect
                    width="100%"
                    height="100%"
                    fill={`url(#${deltaHatchId})`}
                  />
                </svg>
              </div>
            </div>

            {/* Vertical Reference Datum Line at `beforeFrac` spanning both comparator tracks */}
            <div
              style={{
                position: 'absolute',
                left: `${(beforeFrac * 100).toFixed(2)}%`,
                top: 0,
                bottom: 0,
                width: 1.5,
                backgroundColor: textPrimary,
                opacity: 0.72,
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
