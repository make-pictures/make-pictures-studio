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

  const driftX = interpolate(Math.sin(frame * 0.012), [-1, 1], [-45, 45]);
  const driftY = interpolate(Math.cos(frame * 0.01), [-1, 1], [-30, 30]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: THEME.colors.bgPrimary,
        overflow: 'hidden',
      }}
    >
      {/* GPU-Composited Ambient Aurora Radial Glows (zero CSS filter:blur or layout reflow) */}
      <div
        style={{
          position: 'absolute',
          width: 1120,
          height: 1120,
          left: 80,
          top: -340,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${primaryGlowColor}20 0%, ${primaryGlowColor}0B 34%, ${primaryGlowColor}03 56%, transparent 72%)`,
          transform: `translate3d(${driftX}px, ${driftY}px, 0)`,
          willChange: 'transform',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 1240,
          height: 1240,
          right: 0,
          top: -260,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${secondaryGlowColor}24 0%, ${secondaryGlowColor}0C 36%, ${secondaryGlowColor}03 58%, transparent 74%)`,
          transform: `translate3d(${-driftX}px, ${-driftY}px, 0)`,
          willChange: 'transform',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 1080,
          height: 1080,
          right: 100,
          bottom: -440,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${tertiaryGlowColor}1A 0%, ${tertiaryGlowColor}08 38%, transparent 70%)`,
          transform: `translate3d(${driftY}px, ${driftX * 0.5}px, 0)`,
          willChange: 'transform',
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
          pointerEvents: 'none',
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
          pointerEvents: 'none',
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
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
