import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  ClippedSurfaceChrome,
  createSeededRandom,
  formatFontFamilyCss,
  formatHeadingText,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioStyle,
} from "../..";

export interface ComparisonSideSpec {
  tag: string;
  title: string;
  detail: string;
}

export interface ComparisonSplit2DProps {
  left: ComparisonSideSpec;
  right: ComparisonSideSpec;
  startFrame?: number;
  rightDelayFrames?: number;
  /** Optional composition frame at which optical focus shifts from `left` (baseline) to `right` (payoff) */
  focusShiftFrame?: number;
  /** Initial focal behavior before `focusShiftFrame` (`'left'` when `focusShiftFrame` is set, otherwise `'both'`) */
  initialFocus?: 'both' | 'left';
  /** Chrome badge language (`'pl'` renders `'BAZA'`/`'TEZA'`, `'en'` renders `'BASELINE'`/`'THESIS'`; auto-inferred when omitted) */
  lang?: 'pl' | 'en';
}

function resolveComparisonLang(
  explicitLang: 'pl' | 'en' | undefined,
  left: ComparisonSideSpec,
  right: ComparisonSideSpec
): 'pl' | 'en' {
  if (explicitLang === 'pl' || explicitLang === 'en') {
    return explicitLang;
  }
  const corpus = `${left.tag} ${left.title} ${left.detail} ${right.tag} ${right.title} ${right.detail}`;
  if (
    /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(corpus) ||
    /\b(przed|po|pierwsza|druga|punkt|kierunek|lewa|prawa|opis|baza|teza|wynik|szablon|optyka)\b/i.test(
      corpus
    )
  ) {
    return 'pl';
  }
  if (
    /\b(the|before|after|baseline|thesis|payoff|old|new|legacy|modern|with|without|from|into|vs|versus)\b/i.test(
      corpus
    )
  ) {
    return 'en';
  }
  return 'pl';
}

export function computeSafeSplitBounds(
  width: number,
  height: number
): {
  isVertical: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
} {
  const isVertical = height > width;
  if (isVertical) {
    const scaleX = width / 1080;
    const scaleY = height / 1920;
    return {
      isVertical: true,
      left: Math.round(76 * scaleX),
      top: Math.round(268 * scaleY),
      width: Math.round(788 * scaleX),
      height: Math.round(1040 * scaleY),
    };
  }
  return {
    isVertical: false,
    left: 130,
    top: 210,
    width: width - 260,
    height: height - 420,
  };
}

export const ComparisonSplit2D: React.FC<ComparisonSplit2DProps> = ({
  left,
  right,
  startFrame = 2,
  rightDelayFrames = 14,
  focusShiftFrame,
  initialFocus,
  lang,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const optics = resolveStyleOptics(style);
  const grammar = optics.typographyGrammar;
  const isDark = style.surface.isDark;
  const resolvedLang = resolveComparisonLang(lang, left, right);

  const effectiveStart = Math.max(2, startFrame);
  if (frame < effectiveStart) return null;

  const bounds = computeSafeSplitBounds(width, height);
  const leftEnter = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const rightStartFrame = effectiveStart + rightDelayFrames;
  const rightEnter =
    frame < rightStartFrame
      ? 0
      : spring({
          frame: frame - rightStartFrame,
          fps,
          config: getStyleSpringConfig(style, 'enter'),
        });

  const rackMode =
    initialFocus ?? (typeof focusShiftFrame === 'number' ? 'left' : 'both');

  const shiftProgress =
    typeof focusShiftFrame === 'number' && frame >= focusShiftFrame
      ? spring({
          frame: frame - focusShiftFrame,
          fps,
          config: getStyleSpringConfig(style, 'camera'),
        })
      : 0;

  // Dignified light-mode rack focus: cap blur <= 2.0px & preserve opacity >= 0.88 on light surfaces
  const maxBlur = isDark
    ? Math.max(1.6, optics.aperture * 6.5)
    : Math.min(2.0, Math.max(1.5, optics.aperture * 4.2));
  const recessedOpacity = isDark ? 0.78 : 0.88;

  const leftRecess = rackMode === 'both' ? 0 : shiftProgress;
  const rightRecess = rackMode === 'both' ? 0 : 1 - shiftProgress;

  const leftBlur = leftRecess * maxBlur;
  const rightBlur = rightRecess * maxBlur;

  const leftScale =
    rackMode === 'both'
      ? 1
      : interpolate(shiftProgress, [0, 1], [1, isDark ? 0.982 : 0.986]);
  const rightScale =
    rackMode === 'both'
      ? 1
      : interpolate(shiftProgress, [0, 1], [isDark ? 0.982 : 0.986, 1]);

  const leftDim =
    rackMode === 'both'
      ? 1
      : interpolate(shiftProgress, [0, 1], [1, recessedOpacity]);
  const rightDim =
    rackMode === 'both'
      ? 1
      : interpolate(shiftProgress, [0, 1], [recessedOpacity, 1]);

  const tiltSeed = createSeededRandom(
    `split:${left.title}:${right.title}`
  )();
  const maxTilt = bounds.isVertical ? 0.42 : 0.8;
  const rightTilt =
    grammar === 'risograph-poster' && optics.lightingRig !== 'studio-macro'
      ? (tiltSeed - 0.5) * 2 * maxTilt
      : 0;

  const displayFont = formatFontFamilyCss(
    style.typography.displayFont,
    'display'
  );
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');

  const formatRackFilter = (blurPx: number, recessWeight: number): string => {
    if (blurPx < 0.25) return 'none';
    if (isDark) return `blur(${blurPx.toFixed(2)}px)`;
    const sat = Number((1 - 0.12 * Math.max(0, Math.min(1, recessWeight))).toFixed(2));
    return `blur(${blurPx.toFixed(2)}px) saturate(${sat})`;
  };

  const renderPlate = (params: {
    item: ComparisonSideSpec;
    side: 'left' | 'right';
    enter: number;
    blurPx: number;
    recessWeight: number;
    focusScale: number;
    focusOpacity: number;
    tiltDeg: number;
  }) => {
    const {
      item,
      side,
      enter,
      blurPx,
      recessWeight,
      focusScale,
      focusOpacity,
      tiltDeg,
    } = params;
    const isPayoff = side === 'right';
    const accent = isPayoff
      ? style.palette.accentPrimary
      : style.palette.textSecondary;

    return (
      <div
        style={getTactileSurfaceStyle(style, {
          elevation: isPayoff ? 'floating' : 'resting',
          tiltDeg,
          overrides: {
            position: 'relative',
            boxSizing: 'border-box',
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            padding: bounds.isVertical ? '26px 32px' : '40px 44px',
            borderRadius:
              grammar === 'risograph-poster'
                ? 0
                : Math.max(0, Math.round(6 * style.surface.radiusScale)),
            borderColor: isPayoff
              ? style.palette.accentPrimary
              : style.palette.inkBorder,
            opacity: enter * focusOpacity,
            filter: formatRackFilter(blurPx, recessWeight),
            transform: `translateY(${Number(interpolate(enter, [0, 1], [20, 0]).toFixed(2))}px) scale(${Number(focusScale.toFixed(4))})`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: bounds.isVertical ? 12 : 16,
          },
        })}
      >
        <ClippedSurfaceChrome
          topBarHeight={isPayoff ? (grammar === 'risograph-poster' ? 5 : 3) : 2}
          topBarColor={
            isPayoff ? style.palette.accentPrimary : style.palette.inkBorder
          }
          specularRim={!isDark}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: 8,
            borderBottom: `1px ${isPayoff ? 'solid' : 'dashed'} ${style.palette.inkBorder}`,
            fontFamily: monoFont,
            fontSize: 18,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: accent,
          }}
        >
          <span>{item.tag}</span>
          <span style={{ fontSize: 18, opacity: 0.72 }}>
            {isPayoff
              ? resolvedLang === 'en'
                ? 'THESIS'
                : 'TEZA'
              : resolvedLang === 'en'
                ? 'BASELINE'
                : 'BAZA'}
          </span>
        </div>

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            fontFamily: displayFont,
            fontSize: bounds.isVertical ? 38 : 48,
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: `${style.typography.displayTrackingEm}em`,
            color: style.palette.textPrimary,
          }}
        >
          {formatHeadingText(item.title, style)}
        </div>

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            fontFamily: bodyFont,
            fontSize: bounds.isVertical ? 22 : 25,
            lineHeight: 1.38,
            color: style.palette.textSecondary,
          }}
        >
          {item.detail}
        </div>
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        data-comparison-rack={rackMode}
        style={{
          position: 'absolute',
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: bounds.isVertical ? 'column' : 'row',
          alignItems: 'stretch',
          gap: bounds.isVertical ? 18 : 24,
        }}
      >
        {renderPlate({
          item: left,
          side: 'left',
          enter: leftEnter,
          blurPx: leftBlur,
          recessWeight: leftRecess,
          focusScale: leftScale,
          focusOpacity: leftDim,
          tiltDeg: 0,
        })}

        {/* Central Calibration Axis Divider */}
        <div
          data-comparison-axis="true"
          style={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: bounds.isVertical ? 'row' : 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            opacity: Math.max(leftEnter, rightEnter) * 0.78,
          }}
        >
          <div
            style={{
              flex: 1,
              width: bounds.isVertical ? undefined : 1,
              height: bounds.isVertical ? 1 : undefined,
              backgroundColor: style.palette.inkBorder,
            }}
          />
          <span
            style={{
              fontFamily: monoFont,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: style.palette.accentPrimary,
            }}
          >
            ┼
          </span>
          <div
            style={{
              flex: 1,
              width: bounds.isVertical ? undefined : 1,
              height: bounds.isVertical ? 1 : undefined,
              backgroundColor: style.palette.inkBorder,
            }}
          />
        </div>

        {renderPlate({
          item: right,
          side: 'right',
          enter: rightEnter,
          blurPx: rightBlur,
          recessWeight: rightRecess,
          focusScale: rightScale,
          focusOpacity: rightDim,
          tiltDeg: rightTilt,
        })}
      </div>
    </AbsoluteFill>
  );
};
