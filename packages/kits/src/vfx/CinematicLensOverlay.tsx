import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { useDirectorCameraTelemetry } from '../../../core/src/camera';
import { createSeededRandom } from '../../../core/src/utils/prng';

export interface CinematicLensOverlayProps {
  /** Radial vignette edge darkening in [0, 1] (default `0.36`) */
  vignetteIntensity?: number;
  /** Deterministic 35mm film grain opacity in [0, 0.18] (default `0.045`) */
  grainOpacity?: number;
  /**
   * Lateral red/cyan chromatic aberration in [0, 1].
   * When omitted, automatically reads `velocity` from `DirectorCameraTelemetryContext`
   * so edge fringe appears organically during whip-pans and drops to `0` when still.
   */
  chromaticAberration?: number;
  /** Multiplier applied when reading camera `velocity` automatically (default `0.85`) */
  velocityAberrationScale?: number;
  /** Slow organic warm anamorphic corner glow in [0, 1] (default `0.16`) */
  warmLightLeak?: number;
  /** Tint color for the warm corner light leak (default `'#F59E0B'`) */
  lightLeakColor?: string;
  /** Deterministic PRNG seed (default `77`) */
  seed?: number;
  /** Layer z-index (default `60`) */
  zIndex?: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Deterministic 60 FPS Cinema Optical Lens Overlay (`pointerEvents: 'none'`).
 * Combines radial optical vignette, velocity-reactive red/cyan chromatic fringe,
 * organic corner light-leak breathe, and seeded `<feTurbulence>` film grain.
 */
export const CinematicLensOverlay: React.FC<CinematicLensOverlayProps> = ({
  vignetteIntensity = 0.36,
  grainOpacity = 0.045,
  chromaticAberration,
  velocityAberrationScale = 0.85,
  warmLightLeak = 0.16,
  lightLeakColor = '#F59E0B',
  seed = 77,
  zIndex = 60,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const telemetry = useDirectorCameraTelemetry();

  const leakTraits = useMemo(() => {
    const rand = createSeededRandom(`lens-leak:${seed}`);
    return {
      phaseA: rand() * Math.PI * 2,
      phaseB: rand() * Math.PI * 2,
      baseX: 8 + rand() * 14,
      baseY: 6 + rand() * 14,
    };
  }, [seed]);

  const vig = clamp(vignetteIntensity, 0, 1);
  const grain = clamp(grainOpacity, 0, 0.18);
  const leak = clamp(warmLightLeak, 0, 1);

  const rawCa =
    typeof chromaticAberration === 'number'
      ? chromaticAberration
      : telemetry.velocity * velocityAberrationScale;
  const ca = clamp(rawCa, 0, 1);

  const f60 = frame * (60 / Math.max(1, fps));
  const leakPulse =
    0.72 +
    0.28 *
      (0.5 * Math.sin(f60 * 0.032 + leakTraits.phaseA) +
        0.5 * Math.cos(f60 * 0.045 + leakTraits.phaseB));
  const leakX = leakTraits.baseX + Math.sin(f60 * 0.031 + leakTraits.phaseA) * 5;
  const leakY = leakTraits.baseY + Math.cos(f60 * 0.037 + leakTraits.phaseB) * 4;

  const grainSeed = ((Math.abs(Math.floor(frame)) + Math.abs(seed)) % 97) + 1;
  const filterId = `mp-film-grain-${Math.abs(seed)}`;
  const fringePx = Math.round(ca * Math.max(width, height) * 0.018);

  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex,
      }}
    >
      {/* 1. Velocity-Driven Lateral Chromatic Aberration (0 DOM cost when still) */}
      {ca > 0.015 && fringePx > 0 && (
        <AbsoluteFill
          style={{
            mixBlendMode: 'screen',
            opacity: clamp(ca * 0.78, 0, 0.72),
            boxShadow: `
              inset ${fringePx}px 0 ${fringePx * 2}px -${Math.max(1, Math.floor(fringePx * 0.35))}px rgba(255, 42, 84, 0.62),
              inset -${fringePx}px 0 ${fringePx * 2}px -${Math.max(1, Math.floor(fringePx * 0.35))}px rgba(0, 240, 255, 0.62)
            `,
          }}
        />
      )}

      {/* 2. Organic Warm Anamorphic Light Leak */}
      {leak > 0.005 && (
        <AbsoluteFill
          style={{
            mixBlendMode: 'screen',
            opacity: clamp(leak * leakPulse, 0, 0.85),
            backgroundImage: `
              radial-gradient(ellipse 52% 44% at ${leakX.toFixed(2)}% ${leakY.toFixed(2)}%, ${lightLeakColor}66 0%, ${lightLeakColor}22 46%, transparent 78%),
              radial-gradient(ellipse 40% 36% at ${(100 - leakX * 0.7).toFixed(2)}% ${(96 - leakY * 0.6).toFixed(2)}%, #FB718538 0%, transparent 72%)
            `,
          }}
        />
      )}

      {/* 3. Smooth Optical Vignette */}
      {vig > 0.005 && (
        <AbsoluteFill
          style={{
            backgroundImage: `radial-gradient(ellipse 76% 74% at 50% 50%, transparent 48%, rgba(9, 10, 18, ${(vig * 0.42).toFixed(3)}) 80%, rgba(5, 6, 12, ${(vig * 0.82).toFixed(3)}) 100%)`,
          }}
        />
      )}

      {/* 4. Deterministic Seeded SVG Film Grain */}
      {grain > 0.002 && (
        <svg
          width="100%"
          height="100%"
          style={{
            position: 'absolute',
            inset: 0,
            opacity: grain,
            mixBlendMode: 'overlay',
            pointerEvents: 'none',
          }}
        >
          <defs>
            <filter id={filterId} x="0%" y="0%" width="100%" height="100%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.78"
                numOctaves={2}
                seed={grainSeed}
                stitchTiles="stitch"
              />
              <feColorMatrix type="saturate" values="0" />
            </filter>
          </defs>
          <rect width="100%" height="100%" filter={`url(#${filterId})`} />
        </svg>
      )}
    </AbsoluteFill>
  );
};
