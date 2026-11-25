import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  ClippedSurfaceChrome,
  createSeededRandom,
  formatFontFamilyCss,
  formatHeadingText,
  getCardChromeStyle,
  getStyleSpringConfig,
  useStudioStyle,
} from "../..";

export interface HorizontalFeatureItem {
  id: string;
  icon?: React.ReactNode;
  title: string;
  sentence: string;
  accentColor?: string;
}

export type FeatureGridItem = HorizontalFeatureItem;

export interface HorizontalFeatureGridBounds {
  isVertical: boolean;
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

export function computeHorizontalFeatureGridBounds(
  viewportWidth: number,
  viewportHeight: number
): HorizontalFeatureGridBounds {
  const isVertical = viewportHeight > viewportWidth;
  if (isVertical) {
    const sx = viewportWidth / 1080;
    const sy = viewportHeight / 1920;
    return {
      isVertical: true,
      left: Math.round(64 * sx),
      top: Math.round(248 * sy),
      width: Math.round(812 * sx),
      maxHeight: Math.round(1096 * sy),
    };
  }

  return {
    isVertical: false,
    left: Math.round(viewportWidth * 0.08),
    top: Math.round(viewportHeight * 0.14),
    width: Math.round(viewportWidth * 0.84),
    maxHeight: Math.round(viewportHeight * 0.72),
  };
}

export interface HorizontalFeatureGrid2x2Props {
  items: ReadonlyArray<HorizontalFeatureItem>;
  startFrame?: number;
  staggerFrames?: number;
  maxWidth?: number;
  styleOverrides?: React.CSSProperties;
}

export const HorizontalFeatureGrid2x2: React.FC<
  HorizontalFeatureGrid2x2Props
> = ({
  items,
  startFrame = 2,
  staggerFrames = 10,
  maxWidth = 1560,
  styleOverrides,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();

  const effectiveStart = Math.max(2, startFrame);
  if (frame <= 0 || frame < effectiveStart) return null;

  const bounds = computeHorizontalFeatureGridBounds(width, height);
  const displayFont = formatFontFamilyCss(
    style.typography.displayFont,
    'display'
  );
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const visibleItems = items.slice(0, 4);

  const gridElement = (
    <div
      data-feature-grid-2x2="true"
      style={{
        width: '100%',
        maxWidth: bounds.isVertical ? bounds.width : maxWidth,
        display: 'grid',
        gridTemplateColumns: bounds.isVertical
          ? 'minmax(0, 1fr)'
          : 'repeat(2, minmax(0, 1fr))',
        alignItems: 'center',
        gap: bounds.isVertical ? 18 : 28,
        boxSizing: 'border-box',
        ...styleOverrides,
      }}
    >
      {visibleItems.map((item, idx) => {
        const cardStart = effectiveStart + idx * Math.max(0, staggerFrames);
        const enter =
          frame < cardStart
            ? 0
            : spring({
                frame: frame - cardStart,
                fps,
                config: getStyleSpringConfig(style, 'enter'),
              });
        if (enter <= 0.001) return null;

        const accent = item.accentColor ?? style.palette.accentPrimary;
        const glyphIdx = Math.floor(
          createSeededRandom(`hgrid-glyph:${item.id}:${item.title}`)() * 3
        );
        const translateY = interpolate(enter, [0, 1], [16, 0]);

        return (
          <div
            key={item.id}
            style={getCardChromeStyle(style, {
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: '64px 1fr',
              alignItems: 'center',
              gap: 24,
              padding: bounds.isVertical ? '20px 26px' : '28px 32px',
              height: 'auto',
              boxSizing: 'border-box',
              opacity: enter,
              transform: `translateY(${translateY.toFixed(2)}px)`,
            })}
          >
            <ClippedSurfaceChrome
              topBarHeight={3}
              topBarColor={accent}
              specularRim={!style.surface.isDark}
            />

            <div
              style={{
                position: 'relative',
                zIndex: 1,
                width: 64,
                height: 64,
                borderRadius: Math.max(
                  0,
                  Math.round(18 * style.surface.radiusScale)
                ),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `${accent}18`,
                color: accent,
                boxSizing: 'border-box',
              }}
            >
              {item.icon ?? (
                <svg
                  width={30}
                  height={30}
                  viewBox="0 0 30 30"
                  style={{ display: 'block' }}
                >
                  {glyphIdx === 0 && (
                    <circle
                      cx="15"
                      cy="15"
                      r="9"
                      fill="none"
                      stroke={accent}
                      strokeWidth="2.2"
                    />
                  )}
                  {glyphIdx === 1 && (
                    <polygon
                      points="15,5 25,15 15,25 5,15"
                      fill="none"
                      stroke={accent}
                      strokeWidth="2.2"
                    />
                  )}
                  {glyphIdx === 2 && (
                    <rect
                      x="6"
                      y="6"
                      width="18"
                      height="18"
                      rx="4"
                      fill="none"
                      stroke={accent}
                      strokeWidth="2.2"
                    />
                  )}
                </svg>
              )}
            </div>

            <div
              style={{
                position: 'relative',
                zIndex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <div
                style={{
                  fontFamily: displayFont,
                  fontSize: 28,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  color: style.palette.textPrimary,
                }}
              >
                {formatHeadingText(item.title, style)}
              </div>
              <div
                style={{
                  fontFamily: bodyFont,
                  fontSize: 20,
                  lineHeight: 1.42,
                  color: style.palette.textSecondary,
                }}
              >
                {item.sentence}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (bounds.isVertical) {
    return (
      <div
        style={{
          position: 'absolute',
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          maxHeight: bounds.maxHeight,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}
      >
        {gridElement}
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 80px',
        boxSizing: 'border-box',
      }}
    >
      {gridElement}
    </div>
  );
};
