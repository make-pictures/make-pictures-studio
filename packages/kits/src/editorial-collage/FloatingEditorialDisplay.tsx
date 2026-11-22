import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  TYPOGRAPHY_FLOOR_1080P,
  formatFontFamilyCss,
  formatHeadingText,
  getStyleSpringConfig,
  useStudioFontsReady,
  useStudioStyle,
} from '@make-pictures/core';

export interface FloatingEditorialDisplayProps {
  headline: string;
  subline?: string;
  eyebrow?: string;
  align?: 'left' | 'center' | 'right';
  tone?: 'auto' | 'light-on-dark' | 'dark-on-light';
  position?: 'top' | 'center' | 'bottom';
  headlinePx?: number;
  sublinePx?: number;
  monoSubline?: boolean;
  accentRule?: boolean;
  enterFrame?: number;
  opacity?: number;
  style?: React.CSSProperties;
}

function parseHexLuminance(color: string): number | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return null;
  let hex = match[1]!;
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

const HIGH_CONTRAST_LIGHT_ACCENT = '#F3C98B';

/**
 * Frameless editorial typography overlay directly over 3D/2.5D stages —
 * zero dark box chrome, soft contrast text shadow, strict `>= 19px` floor.
 */
export const FloatingEditorialDisplay: React.FC<
  FloatingEditorialDisplayProps
> = ({
  headline,
  subline,
  eyebrow,
  align = 'left',
  tone = 'auto',
  position = 'top',
  headlinePx = 64,
  sublinePx = 23,
  monoSubline = false,
  accentRule = true,
  enterFrame = 2,
  opacity = 1,
  style: customStyle,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  useStudioFontsReady();
  const studioStyle = useStudioStyle();

  const effectiveStart = Math.max(2, enterFrame);
  if (frame <= 0 || frame < effectiveStart) {
    return null;
  }

  const enter = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(studioStyle, 'enter'),
  });
  const finalOpacity = Math.max(0, Math.min(1, enter * opacity));
  if (finalOpacity <= 0.005) {
    return null;
  }

  const isLightOnDark =
    tone === 'light-on-dark' || (tone === 'auto' && studioStyle.surface.isDark);

  const primaryColor = isLightOnDark
    ? '#FAF3E3'
    : studioStyle.palette.textPrimary;
  const secondaryColor = isLightOnDark
    ? 'rgba(250, 243, 227, 0.86)'
    : studioStyle.palette.textSecondary;
  const accentLuminance = parseHexLuminance(studioStyle.palette.accentPrimary);
  const accentColor =
    isLightOnDark &&
    !studioStyle.surface.isDark &&
    (accentLuminance === null || accentLuminance < 0.35)
      ? HIGH_CONTRAST_LIGHT_ACCENT
      : studioStyle.palette.accentPrimary;
  const textShadow = isLightOnDark
    ? '0 4px 24px rgba(8, 15, 32, 0.65), 0 1px 4px rgba(8, 15, 32, 0.45)'
    : '0 2px 14px rgba(255, 253, 248, 0.72), 0 1px 2px rgba(255, 253, 248, 0.55)';

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

  const safeHeadlinePx = Math.max(32, headlinePx);
  const safeSublinePx = Math.max(
    TYPOGRAPHY_FLOOR_1080P.cardSentencePx,
    sublinePx
  );
  const formattedHeadline = formatHeadingText(headline, studioStyle);

  const justifyItems =
    align === 'center'
      ? 'center'
      : align === 'right'
        ? 'flex-end'
        : 'flex-start';

  const isVertical = height > width;
  const scaleX = width / 1080;
  const scaleY = height / 1920;

  // Strictly inside 9:16 Golden Safe Box: x in [40, 910], y in [220, 1380]
  const horizontalLeft = isVertical ? Math.round(40 * scaleX) : 68;
  const horizontalRight = isVertical ? Math.round(170 * scaleX) : 68;

  const verticalPlacement: React.CSSProperties =
    position === 'center'
      ? {
          top: isVertical ? Math.round(800 * scaleY) : '50%',
          transform: `translateY(calc(-50% + ${((1 - enter) * 14).toFixed(2)}px))`,
        }
      : position === 'bottom'
        ? {
            bottom: isVertical ? Math.round(540 * scaleY) : 118,
            transform: `translateY(${((1 - enter) * 14).toFixed(2)}px)`,
          }
        : {
            top: isVertical ? Math.round(220 * scaleY) : 44,
            transform: `translateY(${((1 - enter) * -14).toFixed(2)}px)`,
          };

  return (
    <div
      data-component="floating-editorial-display"
      style={{
        position: 'absolute',
        left: horizontalLeft,
        right: horizontalRight,
        ...verticalPlacement,
        display: 'flex',
        flexDirection: 'column',
        alignItems: justifyItems,
        textAlign: align,
        background: 'transparent',
        pointerEvents: 'none',
        opacity: finalOpacity,
        boxSizing: 'border-box',
        ...customStyle,
      }}
    >
      {eyebrow && (
        <div
          style={{
            fontFamily: monoFontCss,
            fontSize: 19,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: accentColor,
            textShadow,
            marginBottom: 8,
            lineHeight: 1.2,
            boxSizing: 'border-box',
          }}
        >
          {eyebrow}
        </div>
      )}

      <div
        style={{
          fontFamily: displayFontCss,
          fontSize: safeHeadlinePx,
          fontWeight: 700,
          letterSpacing: `${studioStyle.typography.displayTrackingEm}em`,
          color: primaryColor,
          textShadow,
          lineHeight: 1.08,
          maxWidth: isVertical ? '100%' : 1120,
          boxSizing: 'border-box',
        }}
      >
        {formattedHeadline}
      </div>

      {accentRule && (
        <div
          style={{
            width: 72,
            height: 3,
            marginTop: 14,
            marginBottom: subline ? 14 : 0,
            borderRadius: 2,
            backgroundColor: accentColor,
            boxSizing: 'border-box',
          }}
        />
      )}

      {subline && (
        <div
          style={{
            fontFamily: monoSubline ? monoFontCss : bodyFontCss,
            fontSize: safeSublinePx,
            fontWeight: 500,
            fontVariantNumeric: monoSubline ? 'tabular-nums' : 'normal',
            color: secondaryColor,
            textShadow,
            lineHeight: 1.38,
            maxWidth: isVertical ? '100%' : 980,
            boxSizing: 'border-box',
          }}
        >
          {subline}
        </div>
      )}
    </div>
  );
};
