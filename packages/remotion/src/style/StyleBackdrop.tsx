import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { withStyleColorAlpha } from './interpolate';
import type { StylePreset } from './schema';
import { useStudioStyle } from './StyleProvider';

export interface StyleBackdropProps {
  style?: StylePreset;
  className?: string;
}

export const StyleBackdrop: React.FC<StyleBackdropProps> = ({
  style: styleProp,
  className,
}) => {
  const contextStyle = useStudioStyle();
  const style = styleProp ?? contextStyle;
  const frame = useCurrentFrame();

  const { palette, surface } = style;

  // Clean Frame 0 invariant: frame 0 renders pure canvas background color.
  if (frame <= 0) {
    return (
      <AbsoluteFill
        className={className}
        style={{ backgroundColor: palette.bgCanvas }}
      />
    );
  }

  let patternLayer: React.CSSProperties | null = null;

  switch (surface.backdropType) {
    case 'editorial-paper':
      patternLayer = {
        backgroundImage: `radial-gradient(circle at 20% 18%, ${withStyleColorAlpha(palette.bgElevated, 0.6)} 0%, transparent 58%), radial-gradient(circle at 82% 84%, ${withStyleColorAlpha(palette.accentSecondary, 0.08)} 0%, transparent 52%), repeating-linear-gradient(0deg, transparent 0px, transparent 31px, ${withStyleColorAlpha(palette.inkBorder, 0.19)} 32px)`,
      };
      break;

    case 'blueprint-grid':
      patternLayer = {
        backgroundImage: `linear-gradient(to right, ${withStyleColorAlpha(palette.inkBorder, 0.22)} 1px, transparent 1px), linear-gradient(to bottom, ${withStyleColorAlpha(palette.inkBorder, 0.22)} 1px, transparent 1px)`,
        backgroundSize: '48px 48px',
      };
      break;

    case 'mesh-aura': {
      const driftX = Math.sin(frame * 0.015) * 3;
      const driftY = Math.cos(frame * 0.012) * 3;
      patternLayer = {
        backgroundImage: `radial-gradient(circle at ${24 + driftX}% ${26 + driftY}%, ${withStyleColorAlpha(palette.accentPrimary, 0.15)} 0%, transparent 52%), radial-gradient(circle at ${78 - driftX}% ${74 - driftY}%, ${withStyleColorAlpha(palette.accentSecondary, 0.14)} 0%, transparent 55%)`,
      };
      break;
    }

    case 'halftone-dots':
      patternLayer = {
        backgroundImage: `radial-gradient(${withStyleColorAlpha(palette.inkBorder, 0.15)} 1.5px, transparent 1.5px)`,
        backgroundSize: '22px 22px',
      };
      break;

    case 'dark-vignette':
      patternLayer = {
        backgroundImage: `radial-gradient(circle at 50% 45%, ${withStyleColorAlpha(palette.bgElevated, 0.4)} 0%, ${palette.bgCanvas} 76%)`,
      };
      break;

    case 'solid':
    default:
      patternLayer = null;
      break;
  }

  return (
    <AbsoluteFill
      className={className}
      style={{
        backgroundColor: palette.bgCanvas,
        pointerEvents: 'none',
        isolation: 'isolate',
        contain: 'layout paint style',
      }}
    >
      {patternLayer ? <AbsoluteFill style={patternLayer} /> : null}
      {surface.grainOpacity > 0 ? (
        <AbsoluteFill
          style={{
            opacity: surface.grainOpacity,
            backgroundImage: surface.isDark
              ? 'radial-gradient(rgba(255,255,255,0.28) 0.75px, transparent 0.75px)'
              : 'radial-gradient(rgba(24,22,21,0.24) 0.75px, transparent 0.75px)',
            backgroundSize: '5px 5px',
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
