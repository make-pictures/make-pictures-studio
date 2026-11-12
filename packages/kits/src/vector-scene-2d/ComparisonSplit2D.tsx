import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  formatFontFamilyCss,
  formatHeadingText,
  getCardChromeStyle,
  getStyleSpringConfig,
  useStudioStyle,
} from '@make-pictures/core';

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
      left: Math.round(54 * scaleX),
      top: Math.round(250 * scaleY),
      width: Math.round(836 * scaleX),
      height: Math.round(1080 * scaleY),
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
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();

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

  const renderCard = (
    item: ComparisonSideSpec,
    progress: number,
    accent: string
  ) => (
    <div
      style={getCardChromeStyle(style, {
        boxSizing: 'border-box',
        flex: 1,
        minWidth: 0,
        padding: bounds.isVertical ? '32px 36px' : '44px 48px',
        opacity: progress,
        transform: `translateY(${interpolate(progress, [0, 1], [24, 0])}px)`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 14,
      })}
    >
      <div
        style={{
          fontFamily: formatFontFamilyCss(style.typography.monoFont, 'mono'),
          fontSize: 19,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: accent,
        }}
      >
        {item.tag}
      </div>
      <div
        style={{
          fontFamily: formatFontFamilyCss(
            style.typography.displayFont,
            'display'
          ),
          fontSize: bounds.isVertical ? 44 : 52,
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
          fontFamily: formatFontFamilyCss(style.typography.bodyFont, 'body'),
          fontSize: bounds.isVertical ? 25 : 27,
          lineHeight: 1.4,
          color: style.palette.textSecondary,
        }}
      >
        {item.detail}
      </div>
    </div>
  );

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: bounds.isVertical ? 'column' : 'row',
          gap: 32,
        }}
      >
        {renderCard(left, leftEnter, style.palette.textSecondary)}
        {renderCard(right, rightEnter, style.palette.accentPrimary)}
      </div>
    </AbsoluteFill>
  );
};
