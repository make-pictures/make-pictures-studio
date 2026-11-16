import React, { useMemo } from 'react';
import { useCurrentFrame } from 'remotion';
import { useStudioStyle, type ArtWorld } from '@make-pictures/core';
import {
  ContactShadowDisc3D,
  StagePostProcessing3D,
} from '../vfx/StagePostProcessing3D';
import { IsometricScenicSet3D } from './IsometricScenicSet3D';
import { computeIsometricLightRig } from './isometricMaterials';

export interface IsometricStage3DProps {
  radius?: number;
  showGrid?: boolean;
  /** Mount the 3D architectural studio room behind & around speakers (default `true`) */
  showScenicSet?: boolean;
  /** Optional explicit scenic room world override (`'auto'` uses `resolveArtWorld(style)`) */
  scenicVariant?: 'auto' | ArtWorld;
  accentColor?: string;
  surfaceColor?: string;
  /** Render atmospheric volumetric light cones on window-gobo / darkroom-halation rigs */
  atmosphericBeams?: boolean;
  seed?: number;
  children?: React.ReactNode;
}

export const IsometricStage3D: React.FC<IsometricStage3DProps> = ({
  radius = 5.4,
  showGrid = false,
  showScenicSet = true,
  scenicVariant = 'auto',
  accentColor,
  surfaceColor,
  atmosphericBeams,
  seed = 303,
  children,
}) => {
  const frame = useCurrentFrame();
  const style = useStudioStyle();

  const degreeTicks = useMemo(
    () =>
      Array.from({ length: 24 }, (_, idx) => {
        const angle = (idx / 24) * Math.PI * 2;
        const isCardinal = idx % 6 === 0;
        const tickLen = isCardinal ? radius * 0.075 : radius * 0.04;
        const rMid = radius * 0.91 - tickLen * 0.5;
        return {
          idx,
          x: Math.cos(angle) * rMid,
          z: Math.sin(angle) * rMid,
          rotY: -angle,
          len: tickLen,
          width: isCardinal ? 0.045 : 0.022,
          isCardinal,
        };
      }),
    [radius]
  );

  // Clean Frame 0 invariant
  if (frame <= 0) {
    return null;
  }

  const resolvedSurface = surfaceColor ?? style.palette.bgSurface;
  const resolvedAccent = accentColor ?? style.palette.accentPrimary;
  const lightRig = computeIsometricLightRig(style);
  const showBeams = atmosphericBeams ?? lightRig.enableBeamsByDefault;

  return (
    <group name="isometric-stage-3d">
      <ambientLight intensity={lightRig.ambientIntensity} />
      <directionalLight
        position={lightRig.keyPosition}
        intensity={lightRig.keyIntensity}
        color={lightRig.keyColor}
        castShadow
      />
      <pointLight
        position={lightRig.rimPosition}
        intensity={lightRig.rimIntensity}
        color={lightRig.rimColor}
      />
      <pointLight
        position={lightRig.fillPosition}
        intensity={lightRig.fillIntensity}
        color={style.palette.bgElevated}
      />

      <StagePostProcessing3D
        fogColor={style.palette.bgCanvas}
        fogDensity={0.012}
        spotlightBeams={showBeams ? 2 : 0}
        beamOrigin={lightRig.beamOrigin}
        beamColor={lightRig.beamColor}
        beamOpacity={lightRig.beamOpacity}
        depthHaze={false}
        seed={seed}
      />

      {/* Grounded Contact Shadow Disc under Architectural Plinth */}
      <ContactShadowDisc3D
        position={[0, -0.382, 0]}
        radius={radius * 1.16}
        opacity={lightRig.contactShadowOpacity * 0.85}
        color={lightRig.contactShadowColor}
      />

      {/* Lower Architectural Plinth Tier (chamfered frustum) */}
      <mesh position={[0, -0.24, 0]} receiveShadow>
        <cylinderGeometry args={[radius * 1.05, radius * 1.09, 0.28, 64]} />
        <meshStandardMaterial
          color={style.palette.bgElevated}
          roughness={0.86}
          metalness={0.04}
        />
      </mesh>

      {/* Upper Calibrated Turntable Deck (chamfered bevel) */}
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <cylinderGeometry args={[radius, radius * 1.02, 0.12, 64]} />
        <meshStandardMaterial
          color={resolvedSurface}
          roughness={0.8}
          metalness={0.04}
        />
      </mesh>

      {/* Outer Accent Rim (y = 0.004) */}
      <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.955, radius * 0.99, 64]} />
        <meshStandardMaterial
          color={resolvedAccent}
          roughness={0.72}
          metalness={0.08}
          transparent
          opacity={0.72}
        />
      </mesh>

      {/* Inner Calibration Track (y = 0.006) */}
      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.915, radius * 0.928, 64]} />
        <meshBasicMaterial
          color={style.palette.inkBorder}
          transparent
          opacity={0.48}
        />
      </mesh>

      {/* 24 Angular Degree Ticks (y = 0.009 — distinct Y plane, zero Z-fighting) */}
      {degreeTicks.map((t) => (
        <mesh
          key={t.idx}
          position={[t.x, 0.009, t.z]}
          rotation={[-Math.PI / 2, 0, t.rotY]}
        >
          <planeGeometry args={[t.len, t.width]} />
          <meshBasicMaterial
            color={t.isCardinal ? resolvedAccent : style.palette.inkBorder}
            transparent
            opacity={t.isCardinal ? 0.82 : 0.42}
          />
        </mesh>
      ))}

      {showGrid ? (
        <gridHelper
          args={[
            radius * 0.96,
            8,
            resolvedAccent,
            style.palette.inkBorder,
          ]}
          position={[0, 0.002, 0]}
        />
      ) : null}

      {showScenicSet ? (
        <IsometricScenicSet3D
          radius={radius}
          variant={scenicVariant}
          accentColor={resolvedAccent}
          surfaceColor={surfaceColor}
        />
      ) : null}

      {children}
    </group>
  );
};
