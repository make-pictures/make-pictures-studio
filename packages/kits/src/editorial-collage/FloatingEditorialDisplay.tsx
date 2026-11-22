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
  const { fps } = useVideoConfig();
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

  const verticalPlacement: React.CSSProperties =
    position === 'center'
      ? {
          top: '50%',
          transform: `translateY(calc(-50% + ${((1 - enter) * 14).toFixed(2)}px))`,
        }
      : position === 'bottom'
        ? {
            bottom: 118,
            transform: `translateY(${((1 - enter) * 14).toFixed(2)}px)`,
          }
        : {
            top: 44,
            transform: `translateY(${((1 - enter) * -14).toFixed(2)}px)`,
          };

  return (
    <div
      data-component="floating-editorial-display"
      style={{
        position: 'absolute',
        left: 68,
        right: 68,
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
            color: studioStyle.palette.accentPrimary,
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
          maxWidth: 1120,
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
            backgroundColor: studioStyle.palette.accentPrimary,
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
            maxWidth: 980,
            boxSizing: 'border-box',
          }}
        >
          {subline}
        </div>
      )}
    </div>
  );
};
