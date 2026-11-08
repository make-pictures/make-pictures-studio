import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { THEME } from './tokens';

export interface AmbientBackgroundProps {
  primaryGlowColor?: string;
  secondaryGlowColor?: string;
  tertiaryGlowColor?: string;
  gridOpacity?: number;
}

export const AmbientBackground: React.FC<AmbientBackgroundProps> = ({
  primaryGlowColor = THEME.colors.accents.cyan,
  secondaryGlowColor = THEME.colors.accents.violet,
  tertiaryGlowColor = THEME.colors.accents.emerald,
  gridOpacity = 0.28,
}) => {
  const frame = useCurrentFrame();

  const driftX = interpolate(Math.sin(frame / 95), [-1, 1], [-45, 45]);
  const driftY = interpolate(Math.cos(frame / 115), [-1, 1], [-30, 30]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: THEME.colors.bgPrimary,
        overflow: 'hidden',
      }}
    >
      {/* Ambient Aurora Radial Glows */}
      <div
        style={{
          position: 'absolute',
          width: 960,
          height: 960,
          left: 160 + driftX,
          top: -260 + driftY,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${primaryGlowColor}1A 0%, ${primaryGlowColor}05 45%, transparent 72%)`,
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 1080,
          height: 1080,
          right: 80 - driftX,
          top: -180 - driftY,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${secondaryGlowColor}1F 0%, ${secondaryGlowColor}06 48%, transparent 74%)`,
          filter: 'blur(48px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 920,
          height: 920,
          right: 180 + driftY,
          bottom: -360 + driftX * 0.5,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${tertiaryGlowColor}16 0%, transparent 70%)`,
          filter: 'blur(44px)',
          pointerEvents: 'none',
        }}
      />

      {/* Precision Linear + Dot Grid with Radial Vignette Mask */}
      <AbsoluteFill
        style={{
          opacity: gridOpacity,
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.045) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.045) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
          WebkitMaskImage:
            'radial-gradient(ellipse 82% 76% at 50% 48%, #000 35%, transparent 100%)',
          maskImage:
            'radial-gradient(ellipse 82% 76% at 50% 48%, #000 35%, transparent 100%)',
        }}
      />

      {/* Micro Dot Matrix Overlay */}
      <AbsoluteFill
        style={{
          opacity: gridOpacity * 0.85,
          backgroundImage:
            'radial-gradient(rgba(255, 255, 255, 0.14) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          backgroundPosition: '16px 16px',
          WebkitMaskImage:
            'radial-gradient(ellipse 68% 64% at 50% 48%, #000 20%, transparent 92%)',
          maskImage:
            'radial-gradient(ellipse 68% 64% at 50% 48%, #000 20%, transparent 92%)',
        }}
      />

      {/* Top Subtle Specular Horizon Line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '10%',
          right: '10%',
          height: 1,
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)',
        }}
      />
    </AbsoluteFill>
  );
};
