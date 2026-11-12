import React from 'react';
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

const FALLBACK_BAR_SWATCHES = ['#10B981', '#F59E0B', '#F43F5E', '#A855F7'];

function evaluateItemValueAtFrame(item: BarRaceItem, f: number): number {
  const kf = item.keyframes;
  if (!kf || kf.length === 0) {
    return item.value;
  }
  const sorted = [...kf].sort((a, b) => a.frame - b.frame);
  if (f <= sorted[0].frame) return sorted[0].value;
  if (f >= sorted[sorted.length - 1].frame) {
    return sorted[sorted.length - 1].value;
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (f >= a.frame && f <= b.frame) {
      return interpolate(f, [a.frame, Math.max(a.frame + 1, b.frame)], [a.value, b.value], {
        easing: Easing.inOut(Easing.cubic),
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
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
function getSmoothedRanks(
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
 * Crisp 60 FPS Ranked Horizontal / Vertical Bar Race Chart with high-damping
 * spring entrances, dynamic rank overtaking, and tabular value pills.
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
  const cardEnter = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(studioStyle, 'enter'),
  });

  if (cardEnter <= 0.005 || items.length === 0) {
    return null;
  }

  const barPalette = [
    studioStyle.palette.accentPrimary,
    studioStyle.palette.accentSecondary,
    ...FALLBACK_BAR_SWATCHES,
  ];

  const visibleCount = Math.min(items.length, Math.max(1, maxItems));
  const smoothedRanks = getSmoothedRanks(items, frame);

  const evaluated = items.map((item, idx) => {
    const rawVal = evaluateItemValueAtFrame(item, frame);
    const rank = smoothedRanks.get(item.id) ?? idx;
    const color = item.color ?? barPalette[idx % barPalette.length];
    return {
      item,
      idx,
      rawVal,
      rank,
      color,
    };
  });

  const maxVal = Math.max(1e-6, ...evaluated.map((e) => e.rawVal));
  const isVerticalViewport = height > width;
  const hasExplicitVariant = variant !== undefined;
  const isLight = hasExplicitVariant
    ? variant === 'light'
    : !studioStyle.surface.isDark;

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
          : THEME.shadows.card,
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

  const cardWidth =
    isVerticalViewport && safeBox9x16 ? Math.min(830, width - 90) : 980;
  const rowHeight = isVerticalViewport ? 72 : 76;
  const rowGap = 14;
  const rankRadius = hasExplicitVariant
    ? 12
    : Math.max(0, Math.round(12 * studioStyle.surface.radiusScale));

  return (
    <div
      style={{
        width: cardWidth,
        padding: isVerticalViewport ? '28px 30px' : '34px 40px',
        boxSizing: 'border-box',
        ...chromeStyle,
        opacity: cardEnter,
        transform: `translateY(${interpolate(cardEnter, [0, 1], [24, 0]).toFixed(2)}px) scale(${interpolate(cardEnter, [0, 1], [0.95, 1]).toFixed(4)})`,
        ...style,
      }}
    >
      {(title || subtitle) && (
        <div style={{ marginBottom: 24 }}>
          {title && (
            <div
              style={{
                fontFamily: displayFontCss,
                fontSize: isVerticalViewport ? 30 : 34,
                fontWeight: 800,
                letterSpacing: `${studioStyle.typography.displayTrackingEm}em`,
                color: textPrimary,
              }}
            >
              {hasExplicitVariant ? title : formatHeadingText(title, studioStyle)}
            </div>
          )}
          {subtitle && (
            <div
              style={{
                marginTop: 4,
                fontFamily: bodyFontCss,
                fontSize: 18,
                fontWeight: 500,
                color: textSecondary,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      )}

      {orientation === 'horizontal' ? (
        <div
          style={{
            position: 'relative',
            height: visibleCount * (rowHeight + rowGap) - rowGap,
          }}
        >
          {evaluated.map(({ item, idx, rawVal, rank, color }) => {
            if (rank > visibleCount - 0.15) return null;

            const barGrow = spring({
              frame: frame - (effectiveStart + 4 + idx * staggerFrames),
              fps,
              config: SPRING_PRESETS.smooth,
            });

            const fillRatio = Math.max(0.04, (rawVal / maxVal) * barGrow);
            const displayVal = rawVal * barGrow;
            const yTop = rank * (rowHeight + rowGap);
            const rankBadge = Math.min(visibleCount, Math.round(rank) + 1);

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
                  gap: 16,
                  opacity: barGrow,
                }}
              >
                {/* Rank Pill */}
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: rankRadius,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: monoFontCss,
                    fontSize: 16,
                    fontWeight: 800,
                    color: rankBadge === 1 ? '#FFFFFF' : textSecondary,
                    backgroundColor:
                      rankBadge === 1
                        ? color
                        : hasExplicitVariant
                          ? isLight
                            ? 'rgba(15, 23, 42, 0.07)'
                            : 'rgba(255, 255, 255, 0.08)'
                          : studioStyle.palette.bgElevated,
                  }}
                >
                  {rankBadge}
                </div>

                {/* Bar Track + Label + Value Pill */}
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
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
                        fontSize: 20,
                        fontWeight: 700,
                        color: textPrimary,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                      {item.badge && (
                        <span
                          style={{
                            fontFamily: monoFontCss,
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 9999,
                            color,
                            backgroundColor: `${color}22`,
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>

                    {/* Value Pill */}
                    <div
                      style={{
                        fontFamily: monoFontCss,
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: 17,
                        fontWeight: 700,
                        padding: '4px 12px',
                        borderRadius: 9999,
                        color: '#FFFFFF',
                        backgroundColor: color,
                        boxShadow: `0 4px 14px ${color}44`,
                      }}
                    >
                      {valuePrefix}
                      {displayVal.toFixed(decimals)}
                      {valueSuffix}
                    </div>
                  </div>

                  {/* Animated Bar Track */}
                  <div
                    style={{
                      width: '100%',
                      height: 16,
                      borderRadius: 9999,
                      backgroundColor: isLight
                        ? 'rgba(15, 23, 42, 0.07)'
                        : 'rgba(255, 255, 255, 0.08)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${(fillRatio * 100).toFixed(2)}%`,
                        height: '100%',
                        borderRadius: 9999,
                        background: `linear-gradient(90deg, ${color}CC 0%, ${color} 100%)`,
                        boxShadow: `0 0 18px ${color}66`,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Vertical Column Chart Mode */
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 18,
            height: isVerticalViewport ? 340 : 320,
            paddingTop: 28,
          }}
        >
          {[...evaluated]
            .sort((a, b) => a.rank - b.rank)
            .slice(0, visibleCount)
            .map(({ item, idx, rawVal, color }) => {
              const barGrow = spring({
                frame: frame - (effectiveStart + 4 + idx * staggerFrames),
                fps,
                config: SPRING_PRESETS.smooth,
              });
              const fillRatio = Math.max(0.06, (rawVal / maxVal) * barGrow);
              const displayVal = rawVal * barGrow;

              return (
                <div
                  key={item.id}
                  style={{
                    flex: 1,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 10,
                    opacity: barGrow,
                  }}
                >
                  <div
                    style={{
                      fontFamily: monoFontCss,
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: 15,
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 9999,
                      color: '#FFFFFF',
                      backgroundColor: color,
                    }}
                  >
                    {valuePrefix}
                    {displayVal.toFixed(decimals)}
                    {valueSuffix}
                  </div>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 74,
                      height: `${(fillRatio * 74).toFixed(2)}%`,
                      borderRadius: `${Math.round(14 * studioStyle.surface.radiusScale)}px ${Math.round(14 * studioStyle.surface.radiusScale)}px 6px 6px`,
                      background: `linear-gradient(180deg, ${color} 0%, ${color}AA 100%)`,
                      boxShadow: `0 8px 24px ${color}44`,
                    }}
                  />
                  <div
                    style={{
                      fontFamily: bodyFontCss,
                      fontSize: 16,
                      fontWeight: 700,
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
