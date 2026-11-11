import React, { useLayoutEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import * as THREE from 'three';
import { createSeededRandom } from '../../../core/src/utils/prng';

const radialShadowTextureCache = new Map<string, THREE.CanvasTexture>();
const spotlightBeamTextureCache = new Map<string, THREE.CanvasTexture>();

function getRadialDiscTexture(colorHex: string): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const cached = radialShadowTextureCache.get(colorHex);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 124);
    grad.addColorStop(0, colorHex);
    grad.addColorStop(0.45, colorHex);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }

  // Soft Gaussian-like alpha falloff via pixel pass
  if (ctx) {
    const img = ctx.getImageData(0, 0, 256, 256);
    const data = img.data;
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const dx = (x - 128) / 124;
        const dy = (y - 128) / 124;
        const r2 = dx * dx + dy * dy;
        const idx = (y * 256 + x) * 4;
        if (r2 >= 1) {
          data[idx + 3] = 0;
        } else {
          const smooth = Math.pow(1 - r2, 2.2);
          data[idx + 3] = Math.round(smooth * 255);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  radialShadowTextureCache.set(colorHex, tex);
  return tex;
}

function getVolumetricConeTexture(key: string): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const cached = spotlightBeamTextureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Vertical gradient: soft near emitter top, smooth atmospheric fade to floor
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
    grad.addColorStop(0.14, 'rgba(255, 255, 255, 0.92)');
    grad.addColorStop(0.58, 'rgba(255, 255, 255, 0.45)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 256);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  spotlightBeamTextureCache.set(key, tex);
  return tex;
}

export interface ContactShadowDisc3DProps {
  position?: [number, number, number];
  radius?: number;
  opacity?: number;
  color?: string;
  scaleX?: number;
  scaleZ?: number;
}

/**
 * Grounded radial soft contact shadow disc for 3D props and characters.
 * Uses `polygonOffset` and `depthWrite={false}` to guarantee zero Z-fighting.
 */
export const ContactShadowDisc3D: React.FC<ContactShadowDisc3DProps> = ({
  position = [0, 0.012, 0],
  radius = 0.85,
  opacity = 0.3,
  color = '#0F172A',
  scaleX = 1,
  scaleZ = 1,
}) => {
  const tex = useMemo(() => getRadialDiscTexture(color), [color]);

  return (
    <mesh
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[scaleX, scaleZ, 1]}
      renderOrder={1}
    >
      <planeGeometry args={[radius * 2, radius * 2]} />
      <meshBasicMaterial
        map={tex ?? undefined}
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </mesh>
  );
};

export interface StagePostProcessing3DProps {
  /** Exponential atmospheric fog color (default `'#F8F9FF'`) */
  fogColor?: string;
  /** Exponential fog density (`0` disables scene fog, default `0.02`) */
  fogDensity?: number;
  /** Enable volumetric spotlight cones (`true` = 2 beams, `false` = 0, or explicit count) */
  spotlightBeams?: boolean | number;
  /** Spotlight volumetric tint color (default `'#FFF7ED'`) */
  beamColor?: string;
  /** Peak volumetric beam opacity (default `0.075`) */
  beamOpacity?: number;
  /** Primary emitter world position (default `[-4.2, 8.2, 2.8]`) */
  beamOrigin?: [number, number, number];
  /** Primary spotlight target on floor (default `[0, 0, 0]`) */
  beamTarget?: [number, number, number];
  /** Render soft atmospheric depth-haze planes behind the stage (default `true`) */
  depthHaze?: boolean;
  /** Depth-haze tint color (default `'#E0E7FF'`) */
  hazeColor?: string;
  /** Depth-haze opacity (default `0.16`) */
  hazeOpacity?: number;
  /** Deterministic PRNG seed for volumetric motes & beam phases (default `303`) */
  seed?: number;
}

interface BeamSpec {
  origin: [number, number, number];
  target: [number, number, number];
  topRadius: number;
  bottomRadius: number;
  phase: number;
}

/**
 * Drop-in 3D Atmospheric & Volumetric Stage Post-Processing child for `<ThreeCanvas>`.
 * Attaches `THREE.FogExp2`, renders deterministic additive volumetric spotlight dust-beams,
 * floating 3D dust motes, and subtle background depth-haze planes using zero external post-fx packages.
 */
export const StagePostProcessing3D: React.FC<StagePostProcessing3DProps> = ({
  fogColor = '#F8F9FF',
  fogDensity = 0.02,
  spotlightBeams = true,
  beamColor = '#FFF7ED',
  beamOpacity = 0.075,
  beamOrigin = [-4.2, 8.2, 2.8],
  beamTarget = [0, 0, 0],
  depthHaze = true,
  hazeColor = '#E0E7FF',
  hazeOpacity = 0.16,
  seed = 303,
}) => {
  const scene = useThree((state) => state.scene);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  useLayoutEffect(() => {
    const previousFog = scene.fog;
    if (fogDensity > 0) {
      scene.fog = new THREE.FogExp2(fogColor, fogDensity);
    } else {
      scene.fog = null;
    }
    return () => {
      scene.fog = previousFog;
    };
  }, [scene, fogColor, fogDensity]);

  const beamCount =
    typeof spotlightBeams === 'number'
      ? Math.max(0, Math.min(6, Math.round(spotlightBeams)))
      : spotlightBeams
        ? 2
        : 0;

  const beams = useMemo<BeamSpec[]>(() => {
    if (beamCount === 0) return [];
    const rand = createSeededRandom(`beams3d:${seed}`);
    const list: BeamSpec[] = [];

    for (let i = 0; i < beamCount; i++) {
      const spreadX = i === 0 ? 0 : (i % 2 === 1 ? 1 : -1) * (3.6 + rand() * 1.8);
      const targetSpreadX = i === 0 ? 0 : spreadX * 0.32;
      list.push({
        origin: [
          beamOrigin[0] + spreadX,
          beamOrigin[1] + (i === 0 ? 0 : rand() * 0.8),
          beamOrigin[2] - i * 0.9,
        ],
        target: [
          beamTarget[0] + targetSpreadX,
          beamTarget[1],
          beamTarget[2] - i * 0.35,
        ],
        topRadius: 0.28 + rand() * 0.12,
        bottomRadius: 2.15 + rand() * 0.65,
        phase: rand() * Math.PI * 2,
      });
    }
    return list;
  }, [beamCount, beamOrigin, beamTarget, seed]);

  const motes = useMemo(() => {
    const rand = createSeededRandom(`motes3d:${seed}`);
    return Array.from({ length: 16 }, (_, idx) => ({
      id: idx,
      baseX: (rand() - 0.5) * 7.2,
      baseY: 0.6 + rand() * 4.2,
      baseZ: (rand() - 0.4) * 5.2,
      radius: 0.024 + rand() * 0.032,
      phase: rand() * Math.PI * 2,
      freq: 0.031 + rand() * 0.02,
    }));
  }, [seed]);

  const coneTex = useMemo(() => getVolumetricConeTexture('default'), []);
  const hazeTex = useMemo(() => getRadialDiscTexture('#FFFFFF'), []);

  const f60 = frame * (60 / Math.max(1, fps));

  return (
    <group name="stage-post-processing-3d">
      {/* 1. Volumetric Spotlight Dust-Beams */}
      {beams.map((b, idx) => {
        const dir = new THREE.Vector3(
          b.target[0] - b.origin[0],
          b.target[1] - b.origin[1],
          b.target[2] - b.origin[2]
        );
        const len = Math.max(0.5, dir.length());
        const mid: [number, number, number] = [
          (b.origin[0] + b.target[0]) * 0.5,
          (b.origin[1] + b.target[1]) * 0.5,
          (b.origin[2] + b.target[2]) * 0.5,
        ];
        // CylinderGeometry axis is +Y; align -Y (top -> bottom) along `dir`
        const quat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, -1, 0),
          dir.clone().normalize()
        );
        const euler = new THREE.Euler().setFromQuaternion(quat);
        const breathe = 0.86 + 0.14 * Math.sin(f60 * 0.033 + b.phase);

        return (
          <mesh
            key={`beam-${idx}`}
            position={mid}
            rotation={[euler.x, euler.y, euler.z]}
            renderOrder={10}
          >
            <cylinderGeometry
              args={[b.topRadius, b.bottomRadius, len, 32, 1, true]}
            />
            <meshBasicMaterial
              map={coneTex ?? undefined}
              color={beamColor}
              transparent
              opacity={beamOpacity * breathe}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}

      {/* 2. Calm 3D Volumetric Dust Motes */}
      {beamCount > 0 &&
        motes.map((m) => {
          const x = m.baseX + Math.sin(f60 * m.freq + m.phase) * 0.22;
          const y = m.baseY + Math.cos(f60 * (m.freq * 0.85) + m.phase) * 0.18;
          const z = m.baseZ + Math.sin(f60 * 0.03 + m.phase * 1.3) * 0.16;
          const twinkle = 0.45 + 0.55 * Math.sin(f60 * 0.042 + m.phase);
          return (
            <mesh key={`mote-${m.id}`} position={[x, y, z]} renderOrder={11}>
              <sphereGeometry args={[m.radius, 10, 10]} />
              <meshBasicMaterial
                color={beamColor}
                transparent
                opacity={Math.min(0.65, beamOpacity * 5.2 * twinkle)}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          );
        })}

      {/* 3. Subtle Atmospheric Depth-Haze Planes (distinct Z layers to prevent Z-fighting) */}
      {depthHaze && (
        <>
          <mesh position={[-2.2, 2.8, -5.8]} renderOrder={2}>
            <planeGeometry args={[14, 7.5]} />
            <meshBasicMaterial
              map={hazeTex ?? undefined}
              color={hazeColor}
              transparent
              opacity={hazeOpacity}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[2.4, 3.2, -7.6]} renderOrder={2}>
            <planeGeometry args={[16, 8.5]} />
            <meshBasicMaterial
              map={hazeTex ?? undefined}
              color={hazeColor}
              transparent
              opacity={hazeOpacity * 0.78}
              depthWrite={false}
            />
          </mesh>
        </>
      )}
    </group>
  );
};
