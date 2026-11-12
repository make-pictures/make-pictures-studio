import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
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
        backgroundImage: `radial-gradient(circle at 20% 18%, ${palette.bgElevated}99 0%, transparent 58%), radial-gradient(circle at 82% 84%, ${palette.accentSecondary}14 0%, transparent 52%), repeating-linear-gradient(0deg, transparent 0px, transparent 31px, ${palette.inkBorder}30 32px)`,
      };
      break;

    case 'blueprint-grid':
      patternLayer = {
        backgroundImage: `linear-gradient(to right, ${palette.inkBorder}38 1px, transparent 1px), linear-gradient(to bottom, ${palette.inkBorder}38 1px, transparent 1px)`,
        backgroundSize: '48px 48px',
      };
      break;

    case 'mesh-aura': {
      const driftX = Math.sin(frame * 0.015) * 3;
      const driftY = Math.cos(frame * 0.012) * 3;
      patternLayer = {
        backgroundImage: `radial-gradient(circle at ${24 + driftX}% ${26 + driftY}%, ${palette.accentPrimary}26 0%, transparent 52%), radial-gradient(circle at ${78 - driftX}% ${74 - driftY}%, ${palette.accentSecondary}24 0%, transparent 55%)`,
      };
      break;
    }

    case 'halftone-dots':
      patternLayer = {
        backgroundImage: `radial-gradient(${palette.inkBorder}26 1.5px, transparent 1.5px)`,
        backgroundSize: '22px 22px',
      };
      break;

    case 'dark-vignette':
      patternLayer = {
        backgroundImage: `radial-gradient(circle at 50% 45%, ${palette.bgElevated}66 0%, ${palette.bgCanvas} 76%)`,
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
      style={{ backgroundColor: palette.bgCanvas, pointerEvents: 'none' }}
    >
      {patternLayer ? <AbsoluteFill style={patternLayer} /> : null}
      {surface.grainOpacity > 0 ? (
        <AbsoluteFill
          style={{
            opacity: surface.grainOpacity,
            backgroundImage:
              'radial-gradient(rgba(128,128,128,0.45) 0.75px, transparent 0.75px)',
            backgroundSize: '5px 5px',
            mixBlendMode: surface.isDark ? 'screen' : 'multiply',
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
