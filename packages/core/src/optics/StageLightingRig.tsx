import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { useDirectorCameraTelemetry } from '../camera';
import {
  resolveStyleOptics,
  useStudioStyle,
  withStyleColorAlpha,
  type StyleLightingRig,
  type StylePreset,
} from '../style';
import { createSeededRandom } from '../utils';
import { useOpticalStage } from './OpticalStage2D';

export interface StageLightingRigProps {
  style?: StylePreset;
  /** Optional override of `style.optics.lightingRig` */
  rig?: StyleLightingRig;
  /** Deterministic PRNG seed for analog grain & light drift */
  seed?: string | number;
  /** Render solid `palette.bgCanvas` base fill behind light layers (default `true`) */
  renderBaseFill?: boolean;
  className?: string;
}

/**
 * Directional 60 FPS Stage Lighting Rig (`window-gobo`, `darkroom-halation`, `studio-macro`).
 * Enforces Clean Frame 0 (`frame <= 0` renders pure `palette.bgCanvas` with zero patterns or grain).
 */
export const StageLightingRig: React.FC<StageLightingRigProps> = ({
  style: styleProp,
  rig: rigOverride,
  seed = 'stage-lighting-v1',
  renderBaseFill = true,
  className,
}) => {
  const frame = useCurrentFrame();
  const contextStyle = useStudioStyle();
  const style = styleProp ?? contextStyle;
  const telemetry = useDirectorCameraTelemetry();
  const opticalStage = useOpticalStage();

  const { palette, surface } = style;

  // Clean Frame 0 invariant: pure canvas color only.
  if (frame <= 0) {
    return renderBaseFill ? (
      <AbsoluteFill
        className={className}
        style={{ backgroundColor: palette.bgCanvas, pointerEvents: 'none' }}
      />
    ) : null;
  }

  const optics = resolveStyleOptics(style);
  const activeRig = rigOverride ?? optics.lightingRig;
  const angle = optics.lightAngleDeg;
  const halation = optics.halation;

  // Deterministic subtle breathing & grain jitter per frame (seeded PRNG only)
  const grainRng = createSeededRandom(`${seed}:f:${frame}`);
  const grainOffsetX = Math.round(grainRng() * 11);
  const grainOffsetY = Math.round(grainRng() * 11);
  const goboDriftPx = Math.sin(frame * 0.014) * 18;
  const camShiftPct = opticalStage
    ? ((opticalStage.camera.x - opticalStage.stageWidth / 2) /
        Math.max(1, opticalStage.stageWidth)) *
        42 +
      ((opticalStage.camera.y - opticalStage.stageHeight / 2) /
        Math.max(1, opticalStage.stageHeight)) *
        24
    : 0;
  const sweepProgress =
    50 + camShiftPct + Math.sin(frame * 0.02 + angle * 0.03) * 18;

  const lightGradientAngle = 135 + angle;

  return (
    <AbsoluteFill
      className={className}
      data-lighting-rig={activeRig}
      style={{
        backgroundColor: renderBaseFill ? palette.bgCanvas : 'transparent',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {/* 1. Regime-Specific Directional Key Light & Gobo / Lightbox / Specular Layer */}
      {activeRig === 'window-gobo' && (
        <>
          <AbsoluteFill
            style={{
              backgroundImage: surface.isDark
                ? `linear-gradient(${lightGradientAngle}deg, ${withStyleColorAlpha(palette.bgElevated, 0.67)} 0%, transparent 62%), radial-gradient(circle at 22% 18%, ${withStyleColorAlpha(palette.accentPrimary, 0.12)} 0%, transparent 56%)`
                : `linear-gradient(${lightGradientAngle}deg, rgba(255, 252, 244, 0.78) 0%, transparent 58%), radial-gradient(circle at 84% 88%, ${withStyleColorAlpha(palette.bgElevated, 0.8)} 0%, transparent 62%)`,
            }}
          />
          {/* Soft penumbra window mullion / blind gobo bars */}
          <AbsoluteFill
            style={{
              opacity: surface.isDark ? 0.22 : 0.14,
              mixBlendMode: surface.isDark ? 'screen' : 'multiply',
              filter: 'blur(14px)',
              transform: `translate3d(${goboDriftPx.toFixed(2)}px, 0, 0) rotate(${angle * 0.55}deg) scale(1.22)`,
              backgroundImage: surface.isDark
                ? `repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0px, rgba(255,255,255,0.12) 54px, transparent 54px, transparent 138px)`
                : `repeating-linear-gradient(90deg, ${withStyleColorAlpha(palette.inkBorder, 0.53)} 0px, ${withStyleColorAlpha(palette.inkBorder, 0.53)} 46px, transparent 46px, transparent 136px)`,
            }}
          />
          <AbsoluteFill
            style={{
              backgroundImage: surface.isDark
                ? 'radial-gradient(circle at 50% 48%, transparent 52%, rgba(0, 0, 0, 0.48) 100%)'
                : `radial-gradient(circle at 50% 48%, transparent 56%, ${withStyleColorAlpha(palette.inkBorder, 0.26)} 100%)`,
            }}
          />
        </>
      )}

      {activeRig === 'darkroom-halation' && (
        <>
          {/* Central lightbox / darkroom enlarger glow + edge falloff */}
          <AbsoluteFill
            style={{
              backgroundImage: surface.isDark
                ? `radial-gradient(ellipse at 50% 46%, ${withStyleColorAlpha(palette.bgElevated, 0.9)} 0%, ${palette.bgCanvas} 76%), radial-gradient(circle at ${38 - angle * 0.25}% 34%, ${withStyleColorAlpha(
                    palette.accentPrimary,
                    0.12 + halation * 0.22
                  )} 0%, transparent 56%)`
                : `radial-gradient(ellipse at 50% 46%, #FFFFFF 0%, ${palette.bgCanvas} 72%), radial-gradient(circle at 50% 48%, ${withStyleColorAlpha(
                    palette.accentPrimary,
                    0.12
                  )} 0%, transparent 58%)`,
            }}
          />
          {/* Anamorphic streak coupled to halation + camera velocity */}
          <AbsoluteFill
            style={{
              opacity: Math.min(0.85, 0.18 + halation * 0.42 + telemetry.velocity * 0.28),
              backgroundImage: `linear-gradient(${90 + angle * 0.2}deg, transparent 8%, ${withStyleColorAlpha(
                palette.accentPrimary,
                0.15
              )} 48%, ${withStyleColorAlpha(palette.accentSecondary, 0.13)} 54%, transparent 92%)`,
              filter: 'blur(22px)',
            }}
          />
          <AbsoluteFill
            style={{
              backgroundImage: surface.isDark
                ? 'radial-gradient(circle at 50% 50%, transparent 44%, rgba(2, 4, 10, 0.68) 100%)'
                : `radial-gradient(circle at 50% 50%, transparent 52%, ${withStyleColorAlpha(
                    palette.inkBorder,
                    0.33
                  )} 100%)`,
            }}
          />
        </>
      )}

      {activeRig === 'studio-macro' && (
        <>
          <AbsoluteFill
            style={{
              backgroundImage: surface.isDark
                ? `linear-gradient(${lightGradientAngle}deg, ${withStyleColorAlpha(
                    palette.bgElevated,
                    0.73
                  )} 0%, ${palette.bgCanvas} 74%)`
                : `linear-gradient(${lightGradientAngle}deg, #FFFFFF 0%, ${palette.bgCanvas} 64%, ${withStyleColorAlpha(
                    palette.bgElevated,
                    0.68
                  )} 100%)`,
            }}
          />
          {/* Soft studio cyclorama horizon gradient + gentle architectural vignette */}
          <AbsoluteFill
            data-cyclorama-horizon="true"
            style={{
              backgroundImage: surface.isDark
                ? `linear-gradient(180deg, transparent 0%, transparent 58%, ${withStyleColorAlpha(
                    palette.bgElevated,
                    0.52
                  )} 74%, ${palette.bgCanvas} 100%), radial-gradient(ellipse 90% 36% at 50% 78%, ${withStyleColorAlpha(
                    palette.accentPrimary,
                    0.09
                  )} 0%, transparent 72%)`
                : `linear-gradient(180deg, rgba(255, 255, 255, 0.52) 0%, transparent 52%, ${withStyleColorAlpha(
                    palette.inkBorder,
                    0.34
                  )} 72%, ${withStyleColorAlpha(
                    palette.bgElevated,
                    0.82
                  )} 86%, rgba(255, 255, 255, 0.58) 100%), radial-gradient(circle at 50% 48%, transparent 54%, ${withStyleColorAlpha(
                    palette.inkBorder,
                    0.3
                  )} 100%)`,
            }}
          />
          {/* Moving softbox specular sweep */}
          <AbsoluteFill
            style={{
              opacity: surface.isDark ? 0.16 : 0.46,
              backgroundImage: `linear-gradient(${108 + angle * 0.4}deg, transparent ${sweepProgress - 18}%, rgba(255, 255, 255, 0.72) ${sweepProgress}%, transparent ${sweepProgress + 18}%)`,
              filter: 'blur(18px)',
            }}
          />
        </>
      )}

      {/* 2. Deterministic Per-Frame Analog Film Grain */}
      {surface.grainOpacity > 0 && (
        <AbsoluteFill
          style={{
            opacity: surface.grainOpacity,
            backgroundImage:
              'radial-gradient(rgba(128, 128, 128, 0.48) 0.8px, transparent 0.8px)',
            backgroundSize: '6px 6px',
            backgroundPosition: `${grainOffsetX}px ${grainOffsetY}px`,
            mixBlendMode: surface.isDark ? 'screen' : 'multiply',
          }}
        />
      )}
    </AbsoluteFill>
  );
};
