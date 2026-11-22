import React, { useMemo } from 'react';
import { useCurrentFrame } from 'remotion';
import {
  resolveStyleMaterial3D,
  useStudioStyle,
  type StyleStudioHdrPreset,
} from '@make-pictures/core';
import { SyncStudioIbl3D } from '../tactile-3d/SyncStudioIbl3D';
import { ContactShadowDisc3D } from '../vfx/StagePostProcessing3D';

export interface StudioLightformerPanelSpec {
  id: string;
  form: 'rect' | 'ring' | 'circle';
  color: string;
  intensity: number;
  position: [number, number, number];
  scale: [number, number, number];
  rotation?: [number, number, number];
  target?: [number, number, number];
}

export interface StudioHdrRigSpec {
  preset: StyleStudioHdrPreset;
  environmentIntensity: number;
  lightformers: StudioLightformerPanelSpec[];
  directionalPosition: [number, number, number];
  directionalColor: string;
  directionalIntensity: number;
  fillPosition: [number, number, number];
  fillColor: string;
  fillIntensity: number;
  hemiSkyColor: string;
  hemiGroundColor: string;
  hemiIntensity: number;
  contactShadowColor: string;
  defaultContactShadowOpacity: number;
}

export interface StudioHdrRig3DProps {
  preset?: StyleStudioHdrPreset;
  contactShadowY?: number;
  contactShadowScale?: number;
  contactShadowOpacity?: number;
  intensity?: number;
}

export function resolveStudioHdrRigSpec(
  preset: StyleStudioHdrPreset,
  intensity = 1
): StudioHdrRigSpec {
  const k = Math.max(0, intensity);

  if (preset === 'clean-atelier') {
    return {
      preset,
      environmentIntensity: 0.92 * k,
      lightformers: [
        {
          id: 'atelier-overhead',
          form: 'rect',
          color: '#F8FAFC',
          intensity: 2.1 * k,
          position: [0, 8.5, 0.4],
          rotation: [Math.PI / 2, 0, 0],
          scale: [11, 6.5, 1],
        },
        {
          id: 'atelier-key-strip',
          form: 'rect',
          color: '#FFFFFF',
          intensity: 2.55 * k,
          position: [-6.4, 4.8, 5.2],
          target: [0, 1.2, 0],
          scale: [3.6, 7.2, 1],
        },
        {
          id: 'atelier-cool-fill',
          form: 'rect',
          color: '#E0F2FE',
          intensity: 1.3 * k,
          position: [6.6, 3.2, 4.2],
          target: [0, 1.1, 0],
          scale: [5.6, 4.4, 1],
        },
        {
          id: 'atelier-pearl-rim',
          form: 'rect',
          color: '#C7D2FE',
          intensity: 1.85 * k,
          position: [4.6, 4.2, -5.8],
          target: [0, 1.35, 0],
          scale: [7.6, 1.8, 1],
        },
        {
          id: 'atelier-cyan-ring',
          form: 'ring',
          color: '#A5F3FC',
          intensity: 1.45 * k,
          position: [-5.0, 3.6, -5.2],
          target: [0, 1.2, 0],
          scale: [3.6, 3.6, 1],
        },
      ],
      directionalPosition: [-5.2, 8.0, 5.4],
      directionalColor: '#F8FAFC',
      directionalIntensity: 1.38 * k,
      fillPosition: [5.4, 3.6, 4.8],
      fillColor: '#E0E7FF',
      fillIntensity: 0.48 * k,
      hemiSkyColor: '#F1F5F9',
      hemiGroundColor: '#CBD5E1',
      hemiIntensity: 0.58 * k,
      contactShadowColor: '#1E293B',
      defaultContactShadowOpacity: 0.36,
    };
  }

  if (preset === 'neon-grid') {
    return {
      preset,
      environmentIntensity: 0.96 * k,
      lightformers: [
        {
          id: 'neon-overhead-slate',
          form: 'rect',
          color: '#1E3A5F',
          intensity: 1.5 * k,
          position: [0, 8.2, 0],
          rotation: [Math.PI / 2, 0, 0],
          scale: [10, 8, 1],
        },
        {
          id: 'neon-cyan-key',
          form: 'rect',
          color: '#38BDF8',
          intensity: 2.5 * k,
          position: [-6.2, 4.3, 5.0],
          target: [0, 1.2, 0],
          scale: [5.8, 4.2, 1],
        },
        {
          id: 'neon-amber-fill',
          form: 'rect',
          color: '#F59E0B',
          intensity: 2.15 * k,
          position: [6.2, 3.6, 4.2],
          target: [0, 1.1, 0],
          scale: [5.2, 3.8, 1],
        },
        {
          id: 'neon-phosphor-rim',
          form: 'rect',
          color: '#4ADE80',
          intensity: 2.0 * k,
          position: [0, 4.1, -6.2],
          target: [0, 1.3, 0],
          scale: [8.2, 1.9, 1],
        },
        {
          id: 'neon-amber-ring',
          form: 'ring',
          color: '#FBBF24',
          intensity: 1.6 * k,
          position: [-4.6, 3.4, -5.0],
          target: [0, 1.2, 0],
          scale: [3.4, 3.4, 1],
        },
      ],
      directionalPosition: [-4.8, 7.4, 5.2],
      directionalColor: '#BAE6FD',
      directionalIntensity: 1.28 * k,
      fillPosition: [5.0, 3.2, 4.4],
      fillColor: '#FDE68A',
      fillIntensity: 0.42 * k,
      hemiSkyColor: '#38BDF8',
      hemiGroundColor: '#0F172A',
      hemiIntensity: 0.5 * k,
      contactShadowColor: '#020617',
      defaultContactShadowOpacity: 0.5,
    };
  }

  // Default: 'warm-softbox' (Blender Soft-Clay / cozy miniature photography studio)
  return {
    preset: 'warm-softbox',
    environmentIntensity: 0.88 * k,
    lightformers: [
      {
        id: 'softbox-creamy-overhead',
        form: 'rect',
        color: '#FFF4E4',
        intensity: 1.9 * k,
        position: [0, 8.2, 0.5],
        rotation: [Math.PI / 2, 0, 0],
        scale: [10.5, 8.2, 1],
      },
      {
        id: 'softbox-warm-key',
        form: 'rect',
        color: '#FFE0B5',
        intensity: 2.25 * k,
        position: [-6.0, 4.6, 5.4],
        target: [0, 1.2, 0],
        scale: [7.2, 5.2, 1],
      },
      {
        id: 'softbox-peach-fill',
        form: 'rect',
        color: '#FFEDD5',
        intensity: 1.25 * k,
        position: [6.4, 3.0, 4.4],
        target: [0, 1.05, 0],
        scale: [6.2, 4.4, 1],
      },
      {
        id: 'softbox-teal-rim',
        form: 'rect',
        color: '#99F6E4',
        intensity: 1.35 * k,
        position: [5.4, 3.9, -5.6],
        target: [0, 1.3, 0],
        scale: [6.4, 2.2, 1],
      },
      {
        id: 'softbox-peach-rim-ring',
        form: 'ring',
        color: '#FDBA74',
        intensity: 1.3 * k,
        position: [-4.8, 3.7, -5.2],
        target: [0, 1.3, 0],
        scale: [3.8, 3.8, 1],
      },
      {
        id: 'softbox-warm-bounce',
        form: 'circle',
        color: '#FDE6D2',
        intensity: 0.6 * k,
        position: [0, -3.6, 1.0],
        rotation: [-Math.PI / 2, 0, 0],
        scale: [10, 10, 1],
      },
    ],
    directionalPosition: [-4.8, 7.6, 5.6],
    directionalColor: '#FFF5E6',
    directionalIntensity: 1.36 * k,
    fillPosition: [5.2, 3.4, 4.8],
    fillColor: '#FFE8CC',
    fillIntensity: 0.52 * k,
    hemiSkyColor: '#FFF8EE',
    hemiGroundColor: '#E7C8AE',
    hemiIntensity: 0.64 * k,
    contactShadowColor: '#3B2316',
    defaultContactShadowOpacity: 0.42,
  };
}

function defaultContactShadowOpacityForPreset(
  preset: StyleStudioHdrPreset
): number {
  if (preset === 'clean-atelier') return 0.36;
  if (preset === 'neon-grid') return 0.5;
  return 0.42;
}

interface StudioHdrRigInnerProps {
  resolvedPreset: StyleStudioHdrPreset;
  intensity: number;
  contactShadowY: number;
  contactShadowScale: number;
  resolvedShadowOpacity: number;
}

const MemoizedStudioHdrRigInner = React.memo<StudioHdrRigInnerProps>(
  function StudioHdrRigInner({
    resolvedPreset,
    intensity,
    contactShadowY,
    contactShadowScale,
    resolvedShadowOpacity,
  }) {
    const spec = useMemo(
      () => resolveStudioHdrRigSpec(resolvedPreset, intensity),
      [resolvedPreset, intensity]
    );

    return (
      <group name={`studio-hdr-rig-3d-${resolvedPreset}`}>
        <SyncStudioIbl3D
          panels={spec.lightformers}
          environmentIntensity={spec.environmentIntensity}
        />

        <hemisphereLight
          args={[spec.hemiSkyColor, spec.hemiGroundColor, spec.hemiIntensity]}
        />

        <directionalLight
          position={spec.directionalPosition}
          intensity={spec.directionalIntensity}
          color={spec.directionalColor}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
          shadow-camera-near={0.5}
          shadow-camera-far={22}
          shadow-camera-left={-6.2}
          shadow-camera-right={6.2}
          shadow-camera-top={6.2}
          shadow-camera-bottom={-6.2}
        />

        <directionalLight
          position={spec.fillPosition}
          intensity={spec.fillIntensity}
          color={spec.fillColor}
        />

        <ContactShadowDisc3D
          position={[0, contactShadowY, 0]}
          radius={contactShadowScale * 0.48}
          opacity={resolvedShadowOpacity}
          color={spec.contactShadowColor}
          cleanFrameZero={false}
        />
      </group>
    );
  }
);

/**
 * Hermetic 100% offline GPU image-based lighting rig (synchronous `SyncStudioIbl3D`
 * via `THREE.PMREMGenerator` + key shadow-casting directional light + deterministic zero-FBO `ContactShadowDisc3D`).
 */
export const StudioHdrRig3D: React.FC<StudioHdrRig3DProps> = ({
  preset,
  contactShadowY = 0.01,
  contactShadowScale = 12,
  contactShadowOpacity,
  intensity = 1,
}) => {
  const frame = useCurrentFrame();
  const style = useStudioStyle();

  if (frame <= 0) {
    return null;
  }

  const resolvedPreset = preset ?? resolveStyleMaterial3D(style).studioHdr;
  const resolvedShadowOpacity =
    contactShadowOpacity ??
    defaultContactShadowOpacityForPreset(resolvedPreset);

  return (
    <MemoizedStudioHdrRigInner
      resolvedPreset={resolvedPreset}
      intensity={intensity}
      contactShadowY={contactShadowY}
      contactShadowScale={contactShadowScale}
      resolvedShadowOpacity={resolvedShadowOpacity}
    />
  );
};
