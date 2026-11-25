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
  type StylePreset,
} from "../..";

export interface BarRaceKeyframe {
  frame: number;
  value: number;
}

export interface BarRaceItem {
  id: string;
  label: string;
  /** Target value (or initial value when `keyframes` are provided) */
  value: number;
  /** Optional time-series keyframes enabling live rank overtaking at 60 FPS */
  keyframes?: ReadonlyArray<BarRaceKeyframe>;
  color?: string;
  badge?: string;
  icon?: React.ReactNode;
}

export interface AnimatedBarRaceProps {
  items: ReadonlyArray<BarRaceItem>;
  orientation?: 'horizontal' | 'vertical';
  title?: string;
  subtitle?: string;
  valuePrefix?: string;
  valueSuffix?: string;
  decimals?: number;
  maxItems?: number;
  enterFrame?: number;
  startFrame?: number;
  staggerFrames?: number;
  variant?: 'dark' | 'light';
  safeBox9x16?: boolean;
  style?: React.CSSProperties;
}

function sanitizePatternToken(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function evaluateItemValueAtFrame(item: BarRaceItem, f: number): number {
  const kf = item.keyframes;
  if (!kf || kf.length === 0) {
    return item.value;
  }
  const sorted = [...kf].sort((a, b) => a.frame - b.frame);
  if (f <= sorted[0]!.frame) return sorted[0]!.value;
  if (f >= sorted[sorted.length - 1]!.frame) {
    return sorted[sorted.length - 1]!.value;
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (f >= a.frame && f <= b.frame) {
      return interpolate(
        f,
        [a.frame, Math.max(a.frame + 1, b.frame)],
        [a.value, b.value],
        {
          easing: Easing.inOut(Easing.cubic),
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }
      );
    }
  }
  return item.value;
}

function getExactRanksAtFrame(
  items: ReadonlyArray<BarRaceItem>,
  f: number
): Map<string, number> {
  const scored = items.map((item, origIdx) => ({
    id: item.id,
    val: evaluateItemValueAtFrame(item, f),
    origIdx,
  }));
  scored.sort((a, b) => (b.val !== a.val ? b.val - a.val : a.origIdx - b.origIdx));
  const map = new Map<string, number>();
  scored.forEach((entry, rank) => {
    map.set(entry.id, rank);
  });
  return map;
}

/**
 * Pure deterministic raised-cosine kernel rank smoother (`f(frame)` with zero mutable state)
 * so overtaking bars glide cleanly past each other over ~22 frames instead of snapping.
 */
export function getSmoothedRanks(
  items: ReadonlyArray<BarRaceItem>,
  frame: number
): Map<string, number> {
  const hasKeyframes = items.some((it) => it.keyframes && it.keyframes.length > 1);
  if (!hasKeyframes) {
    return getExactRanksAtFrame(items, frame);
  }

  const radius = 12;
  const accum = new Map<string, number>();
  let weightSum = 0;

  for (let df = -radius; df <= radius; df++) {
    const w = 0.5 * (1 + Math.cos((Math.PI * df) / (radius + 1)));
    weightSum += w;
    const ranks = getExactRanksAtFrame(items, Math.max(0, frame + df));
    for (const [id, r] of ranks.entries()) {
      accum.set(id, (accum.get(id) ?? 0) + r * w);
    }
  }

  const result = new Map<string, number>();
  for (const [id, sum] of accum.entries()) {
    result.set(id, sum / Math.max(1e-6, weightSum));
  }
  return result;
}

/**
 * Resolves disciplined editorial/tonal bar fill from the active `StylePreset`
 * instead of hardcoded rainbow swatches. Explicit `explicitColor` always wins.
 */
export function resolveTonalBarFill(
  studioStyle: StylePreset,
  discreteRank: number,
  explicitColor?: string
): string {
  if (explicitColor) {
    return explicitColor;
  }
  if (discreteRank <= 0) {
    return studioStyle.palette.accentPrimary;
  }
  if (discreteRank === 1) {
    return studioStyle.palette.accentSecondary;
  }
  return studioStyle.palette.textSecondary;
}

/**
 * Editorial Data Cartography 60 FPS Ranked Bar Chart with tonal hierarchy,
 * vertical hairline scale gridlines, tabular figures, and polymorphic finishes.
 */
export const AnimatedBarRace: React.FC<AnimatedBarRaceProps> = ({
  items,
  orientation = 'horizontal',
  title,
  subtitle,
  valuePrefix = '',
  valueSuffix = '',
  decimals = 0,
  maxItems = 6,
  enterFrame,
  startFrame,
  staggerFrames = 5,
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
  if (frame < effectiveStart || items.length === 0) {
    return null;
  }

  const cardEnter = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(studioStyle, 'enter'),
  });
  if (cardEnter <= 0.005) {
    return null;
  }

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

  const visibleCount = Math.min(items.length, Math.max(1, maxItems));
  const smoothedRanks = getSmoothedRanks(items, frame);

  const evaluated = items.map((item, idx) => {
    const rawVal = evaluateItemValueAtFrame(item, frame);
    const rank = smoothedRanks.get(item.id) ?? idx;
    const discreteRank = Math.max(0, Math.round(rank));
    const color = resolveTonalBarFill(studioStyle, discreteRank, item.color);
    return {
      item,
      idx,
      rawVal,
      rank,
      discreteRank,
      color,
    };
  });

  const maxVal = Math.max(1e-6, ...evaluated.map((e) => e.rawVal));
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
        ? 'rgba(148, 163, 184, 0.24)'
        : 'rgba(15, 23, 42, 0.16)'
      : studioStyle.palette.inkBorder;

  const cardWidth =
    isVerticalViewport && safeBox9x16
      ? Math.min(788, Math.round(width * 0.73))
      : 980;
  const rowHeight = isVerticalViewport ? 68 : 72;
  const rowGap = 12;

  const surfaceBase = getTactileSurfaceStyle(studioStyle, {
    elevation: 'lifted',
    overrides: {
      position: 'relative',
      width: cardWidth,
      maxWidth: '100%',
      padding: isVerticalViewport ? '26px 28px' : '32px 38px',
      boxSizing: 'border-box',
      borderRadius:
        grammar === 'risograph-poster'
          ? 0
          : Math.max(0, Math.round(6 * studioStyle.surface.radiusScale)),
      ...(variant !== undefined
        ? {
            backgroundColor: isDark ? '#0D1321' : '#FAF8F4',
            borderColor,
          }
        : {}),
      opacity: cardEnter,
      transform: `translateY(${interpolate(cardEnter, [0, 1], [20, 0]).toFixed(2)}px) scale(${interpolate(cardEnter, [0, 1], [0.97, 1]).toFixed(4)})`,
      ...style,
    },
  });

  return (
    <div data-bar-grammar={grammar} style={surfaceBase}>
      <ClippedSurfaceChrome
        topBarHeight={grammar === 'risograph-poster' ? 5 : 3}
        topBarColor={studioStyle.palette.accentPrimary}
        specularRim={!isDark}
        tintGradient={
          isDark
            ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, transparent 48%)'
            : 'linear-gradient(180deg, rgba(255, 255, 255, 0.62) 0%, rgba(255, 255, 255, 0) 48%)'
        }
      />

      {(title || subtitle) && (
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            marginBottom: 20,
            paddingBottom: 12,
            borderBottom: `1px solid ${borderColor}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 16,
          }}
        >
          <div>
            {title && (
              <div
                style={{
                  fontFamily: displayFontCss,
                  fontSize: isVerticalViewport ? 28 : 32,
                  fontWeight: 700,
                  letterSpacing: `${studioStyle.typography.displayTrackingEm}em`,
                  color: textPrimary,
                }}
              >
                {variant !== undefined
                  ? title
                  : formatHeadingText(title, studioStyle)}
              </div>
            )}
            {subtitle && (
              <div
                style={{
                  marginTop: 4,
                  fontFamily: bodyFontCss,
                  fontSize: 19,
                  color: textSecondary,
                }}
              >
                {subtitle}
              </div>
            )}
          </div>
          <span
            style={{
              fontFamily: monoFontCss,
              fontVariantNumeric: 'tabular-nums',
              fontSize: 18,
              letterSpacing: '0.08em',
              color: textSecondary,
              flexShrink: 0,
            }}
          >
            MAX {valuePrefix}
            {maxVal.toFixed(decimals)}
            {valueSuffix}
          </span>
        </div>
      )}

      {orientation === 'horizontal' ? (
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            style={{
              position: 'relative',
              height: visibleCount * (rowHeight + rowGap) - rowGap,
            }}
          >
            {/* Hairline Vertical Reference Gridlines (25% / 50% / 75% / 100%) */}
            <div
              data-bar-grid="true"
              style={{
                position: 'absolute',
                left: 48,
                right: 0,
                top: 0,
                bottom: 0,
                pointerEvents: 'none',
              }}
            >
              {[0.25, 0.5, 0.75, 1].map((tick) => (
                <div
                  key={tick}
                  style={{
                    position: 'absolute',
                    left: `${tick * 100}%`,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    backgroundColor: borderColor,
                    opacity: isDark ? 0.32 : 0.45,
                  }}
                />
              ))}
            </div>

            {evaluated.map(({ item, idx, rawVal, rank, discreteRank, color }) => {
              if (rank > visibleCount - 0.15) return null;

              const barGrow = spring({
                frame: frame - (effectiveStart + 4 + idx * staggerFrames),
                fps,
                config: SPRING_PRESETS.smooth,
              });

              const fillRatio = Math.max(0.03, (rawVal / maxVal) * barGrow);
              const displayVal = rawVal * barGrow;
              const yTop = rank * (rowHeight + rowGap);
              const rankBadge = Math.min(visibleCount, discreteRank + 1);
              const isLeader = rankBadge === 1;
              const barOpacity = isLeader
                ? 1
                : discreteRank === 1
                  ? 0.86
                  : Math.max(0.45, 0.72 - (discreteRank - 2) * 0.1);
              const patternId = `riso-bar-hatch-${sanitizePatternToken(studioStyle.id)}-${sanitizePatternToken(item.id)}`;

              return (
                <div
                  key={item.id}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    height: rowHeight,
                    transform: `translate3d(0, ${yTop.toFixed(2)}px, 0)`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    opacity: barGrow,
                  }}
                >
                  {/* Tabular Index Stamp (Zero rounded pills) */}
                  <div
                    style={{
                      width: 34,
                      height: 30,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: monoFontCss,
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: 18,
                      fontWeight: 700,
                      color:
                        isLeader && grammar === 'risograph-poster'
                          ? '#FFFFFF'
                          : isLeader
                            ? studioStyle.palette.accentPrimary
                            : textSecondary,
                      backgroundColor:
                        isLeader && grammar === 'risograph-poster'
                          ? color
                          : 'transparent',
                      borderBottom:
                        grammar !== 'risograph-poster'
                          ? `2px solid ${isLeader ? color : borderColor}`
                          : undefined,
                      border:
                        grammar === 'risograph-poster'
                          ? `1.5px solid ${borderColor}`
                          : undefined,
                    }}
                  >
                    {String(rankBadge).padStart(2, '0')}
                  </div>

                  {/* Label + Sharp Editorial / Telemetry / Risograph Bar */}
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontFamily: bodyFontCss,
                          fontSize: 19,
                          fontWeight: isLeader ? 700 : 600,
                          color: textPrimary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                        {item.badge ? (
                          <span
                            style={{
                              fontFamily: monoFontCss,
                              fontSize: 18,
                              fontWeight: 700,
                              padding: '1px 6px',
                              border: `1px solid ${color}`,
                              color,
                            }}
                          >
                            {item.badge}
                          </span>
                        ) : null}
                      </div>

                      <span
                        style={{
                          fontFamily: monoFontCss,
                          fontVariantNumeric: 'tabular-nums',
                          fontSize: 18,
                          fontWeight: isLeader ? 800 : 600,
                          color: isLeader ? color : textPrimary,
                        }}
                      >
                        {valuePrefix}
                        {displayVal.toFixed(decimals)}
                        {valueSuffix}
                      </span>
                    </div>

                    {/* Sharp Rectangular Track */}
                    <div
                      style={{
                        position: 'relative',
                        width: '100%',
                        height: isLeader ? 15 : 12,
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.06)'
                          : 'rgba(15, 23, 42, 0.05)',
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          width: `${(fillRatio * 100).toFixed(2)}%`,
                          height: '100%',
                          boxSizing: 'border-box',
                          opacity: barOpacity,
                          backgroundColor:
                            grammar === 'risograph-poster' && !isLeader
                              ? 'transparent'
                              : color,
                          border:
                            grammar === 'risograph-poster'
                              ? `1.5px solid ${borderColor}`
                              : undefined,
                          borderRight:
                            grammar === 'swiss-spatial' && isLeader
                              ? `2.5px solid ${textPrimary}`
                              : grammar === 'optical-gate' && isLeader
                                ? '2px solid #FFFFFF'
                                : undefined,
                          boxShadow:
                            grammar === 'optical-gate' &&
                            isLeader &&
                            optics.halation > 0.05
                              ? `0 0 ${Math.round(10 + optics.halation * 18)}px ${color}66`
                              : 'none',
                          overflow: 'hidden',
                        }}
                      >
                        {grammar === 'risograph-poster' && !isLeader ? (
                          <svg
                            width="100%"
                            height="100%"
                            style={{
                              position: 'absolute',
                              inset: 0,
                              display: 'block',
                            }}
                          >
                            <defs>
                              <pattern
                                id={patternId}
                                width="8"
                                height="8"
                                patternUnits="userSpaceOnUse"
                                patternTransform="rotate(45)"
                              >
                                <line
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="8"
                                  stroke={color}
                                  strokeWidth="3.2"
                                />
                              </pattern>
                            </defs>
                            <rect
                              width="100%"
                              height="100%"
                              fill={`url(#${patternId})`}
                            />
                          </svg>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Discreet Scale Axis Footer (25% · 50% · 75% · 100%) */}
          <div
            style={{
              position: 'relative',
              marginLeft: 48,
              height: 22,
              borderTop: `1px solid ${borderColor}`,
              fontFamily: monoFontCss,
              fontVariantNumeric: 'tabular-nums',
              fontSize: 18,
              letterSpacing: '0.06em',
              color: textSecondary,
              opacity: 0.72,
            }}
          >
            {[25, 50, 75, 100].map((pct) => (
              <span
                key={pct}
                style={{
                  position: 'absolute',
                  left: `${pct}%`,
                  top: 3,
                  transform: pct === 100 ? 'translateX(-100%)' : 'translateX(-50%)',
                }}
              >
                {pct}%
              </span>
            ))}
          </div>
        </div>
      ) : (
        /* Vertical Column Chart Mode */
        <div
          data-bar-grid="true"
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 18,
            height: isVerticalViewport ? 320 : 300,
            paddingTop: 24,
            borderBottom: `1.5px solid ${borderColor}`,
          }}
        >
          {/* Horizontal Reference Gridlines (25% / 50% / 75% / 100%) */}
          {[0.25, 0.5, 0.75, 1].map((tick) => (
            <div
              key={tick}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: `${tick * 74}%`,
                height: 1,
                backgroundColor: borderColor,
                opacity: isDark ? 0.28 : 0.4,
                pointerEvents: 'none',
              }}
            />
          ))}

          {[...evaluated]
            .sort((a, b) => a.rank - b.rank)
            .slice(0, visibleCount)
            .map(({ item, idx, rawVal, discreteRank, color }) => {
              const barGrow = spring({
                frame: frame - (effectiveStart + 4 + idx * staggerFrames),
                fps,
                config: SPRING_PRESETS.smooth,
              });
              const fillRatio = Math.max(0.05, (rawVal / maxVal) * barGrow);
              const displayVal = rawVal * barGrow;
              const isLeader = discreteRank === 0;
              const patternId = `riso-col-hatch-${sanitizePatternToken(studioStyle.id)}-${sanitizePatternToken(item.id)}`;

              return (
                <div
                  key={item.id}
                  style={{
                    position: 'relative',
                    flex: 1,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 8,
                    opacity: barGrow,
                  }}
                >
                  <div
                    style={{
                      fontFamily: monoFontCss,
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: 18,
                      fontWeight: isLeader ? 800 : 600,
                      color: isLeader ? color : textSecondary,
                    }}
                  >
                    {valuePrefix}
                    {displayVal.toFixed(decimals)}
                    {valueSuffix}
                  </div>
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      maxWidth: 68,
                      height: `${(fillRatio * 74).toFixed(2)}%`,
                      boxSizing: 'border-box',
                      backgroundColor:
                        grammar === 'risograph-poster' && !isLeader
                          ? 'transparent'
                          : color,
                      opacity: isLeader ? 1 : 0.78,
                      borderTop: `2.5px solid ${textPrimary}`,
                      border:
                        grammar === 'risograph-poster'
                          ? `1.5px solid ${borderColor}`
                          : undefined,
                      overflow: 'hidden',
                    }}
                  >
                    {grammar === 'risograph-poster' && !isLeader ? (
                      <svg
                        width="100%"
                        height="100%"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'block',
                        }}
                      >
                        <defs>
                          <pattern
                            id={patternId}
                            width="8"
                            height="8"
                            patternUnits="userSpaceOnUse"
                            patternTransform="rotate(45)"
                          >
                            <line
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="8"
                              stroke={color}
                              strokeWidth="3.2"
                            />
                          </pattern>
                        </defs>
                        <rect
                          width="100%"
                          height="100%"
                          fill={`url(#${patternId})`}
                        />
                      </svg>
                    ) : null}
                  </div>
                  <div
                    style={{
                      paddingTop: 6,
                      fontFamily: bodyFontCss,
                      fontSize: 18,
                      fontWeight: isLeader ? 700 : 600,
                      textAlign: 'center',
                      color: textPrimary,
                    }}
                  >
                    {item.label}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};
