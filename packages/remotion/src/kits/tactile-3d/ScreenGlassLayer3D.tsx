import React, { createContext, useContext, useMemo } from 'react';
import { useCurrentFrame } from 'remotion';
import * as THREE from 'three';
import {
  computeGlassLightingBlend,
  projectScreenGlassPose,
  type EvaluatedCameraBasis3D,
} from "../../camera";

export interface ScreenGlassItemEntry {
  id: string;
  ndcX: number;
  ndcY: number;
  /** Normalized 0..1 glass stick progress (controls shadow fade & lens fill lighting). */
  glassProgress: number;
  /** Optional explicit contact shadow opacity (e.g. from `evaluateSurfaceImpact().contactShadowOpacity`). */
  contactShadowOpacity?: number;
  /** Item width in glass-plane world units (default 1.0). */
  width?: number;
  /** Item height in glass-plane world units (default 1.4). */
  height?: number;
  /** Optional XY scale matching squash & stretch on impact. */
  scale?: [number, number] | number;
  /** Optional Z-axis ring angle in radians matching `evaluateSurfaceImpact().rotZ`. */
  rotZ?: number;
}

export interface ScreenGlassLayer3DProps {
  camera: EvaluatedCameraBasis3D;
  items?: ReadonlyArray<ScreenGlassItemEntry>;
  glassDistance?: number;
  aspect?: number;
  showLensFillLight?: boolean;
  fillLightColor?: string;
  cleanFrameZero?: boolean;
  children?: React.ReactNode;
}

export interface ScreenGlassPoseTransform {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  visibleWidth: number;
  visibleHeight: number;
}

export interface ScreenGlassSlotProps {
  ndcX?: number;
  ndcY?: number;
  zOffset?: number;
  children?: React.ReactNode;
}

export const SCREEN_GLASS_SHADOW_OFFSET_Z = -0.075;

const ScreenGlassMetricsContext = createContext<{
  visibleWidth: number;
  visibleHeight: number;
}>({ visibleWidth: 1, visibleHeight: 1 });

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

let cachedGlassShadowTexture: THREE.Texture | null = null;

/**
 * Generates a deterministic soft radial rounded-box contact shadow texture
 * via exact 2D signed-distance Gaussian falloff (zero Canvas2D filter dependency).
 */
export function getGlassContactShadowTexture(): THREE.Texture {
  if (cachedGlassShadowTexture) {
    return cachedGlassShadowTexture;
  }

  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const bx = 0.54;
  const by = 0.58;
  const br = 0.06;
  const sigma = 0.13;
  const twoSigmaSq = 2 * sigma * sigma;

  for (let y = 0; y < size; y++) {
    const ny = (y / (size - 1)) * 2 - 1;
    for (let x = 0; x < size; x++) {
      const nx = (x / (size - 1)) * 2 - 1;
      const qx = Math.abs(nx) - bx;
      const qy = Math.abs(ny) - by;
      const sdf =
        Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
        Math.min(Math.max(qx, qy), 0) -
        br;

      const gauss = sdf <= 0 ? 1 : Math.exp(-(sdf * sdf) / twoSigmaSq);
      const edgeFade = 1 - smoothstep(0.3, 0.4, sdf);
      const alpha = Math.round(clamp(gauss * edgeFade * 0.82, 0, 1) * 255);

      const idx = (y * size + x) * 4;
      data[idx] = 8;
      data[idx + 1] = 12;
      data[idx + 2] = 10;
      data[idx + 3] = alpha;
    }
  }

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imgData = ctx.createImageData(size, size);
      imgData.data.set(data);
      ctx.putImageData(imgData, 0, 0);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
      cachedGlassShadowTexture = tex;
      return tex;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  cachedGlassShadowTexture = tex;
  return tex;
}

/**
 * Pure helper computing the exact world transform of the camera-locked screen
 * glass plane (`+X = right`, `+Y = up`, `+Z = -forward`).
 */
export function computeScreenGlassTransform(
  camera: EvaluatedCameraBasis3D,
  glassDistance = 2.2,
  aspect = 16 / 9
): ScreenGlassPoseTransform {
  const centerPose = projectScreenGlassPose(camera, 0, 0, glassDistance, aspect);
  const rightVec = new THREE.Vector3(
    centerPose.basisRight[0],
    centerPose.basisRight[1],
    centerPose.basisRight[2]
  );
  const upVec = new THREE.Vector3(
    centerPose.basisUp[0],
    centerPose.basisUp[1],
    centerPose.basisUp[2]
  );
  const negForwardVec = new THREE.Vector3(
    -centerPose.basisForward[0],
    -centerPose.basisForward[1],
    -centerPose.basisForward[2]
  );

  const basisMat = new THREE.Matrix4().makeBasis(rightVec, upVec, negForwardVec);
  const quat = new THREE.Quaternion().setFromRotationMatrix(basisMat);

  return {
    position: centerPose.position,
    quaternion: [quat.x, quat.y, quat.z, quat.w],
    visibleWidth: centerPose.visibleWidth,
    visibleHeight: centerPose.visibleHeight,
  };
}

/**
 * Places any child 3D object at normalized screen coordinates `(ndcX, ndcY)`
 * inside an enclosing `<ScreenGlassLayer3D>`.
 */
export const ScreenGlassSlot: React.FC<ScreenGlassSlotProps> = ({
  ndcX = 0,
  ndcY = 0,
  zOffset = 0,
  children,
}) => {
  const { visibleWidth, visibleHeight } = useContext(ScreenGlassMetricsContext);
  const x = ndcX * (visibleWidth * 0.5);
  const y = ndcY * (visibleHeight * 0.5);
  return <group position={[x, y, zOffset]}>{children}</group>;
};

export const ScreenGlassLayer3D: React.FC<ScreenGlassLayer3DProps> = ({
  camera,
  items = [],
  glassDistance = 2.2,
  aspect = 16 / 9,
  showLensFillLight = true,
  fillLightColor = '#FFF1D8',
  cleanFrameZero = true,
  children,
}) => {
  const frame = useCurrentFrame();
  const shadowTexture = useMemo(() => getGlassContactShadowTexture(), []);

  const glassTransform = useMemo(
    () => computeScreenGlassTransform(camera, glassDistance, aspect),
    [
      camera.position[0],
      camera.position[1],
      camera.position[2],
      camera.forward[0],
      camera.forward[1],
      camera.forward[2],
      camera.right[0],
      camera.right[1],
      camera.right[2],
      camera.up[0],
      camera.up[1],
      camera.up[2],
      camera.fov,
      glassDistance,
      aspect,
    ]
  );

  const metrics = useMemo(
    () => ({
      visibleWidth: glassTransform.visibleWidth,
      visibleHeight: glassTransform.visibleHeight,
    }),
    [glassTransform.visibleWidth, glassTransform.visibleHeight]
  );

  if (cleanFrameZero && frame <= 0) {
    return null;
  }

  const maxGlassProgress = items.reduce(
    (max, item) => Math.max(max, clamp(item.glassProgress, 0, 1)),
    0
  );
  const { lensFillIntensity } = computeGlassLightingBlend(maxGlassProgress);

  return (
    <ScreenGlassMetricsContext.Provider value={metrics}>
      <group
        name="screen-glass-layer-3d"
        position={glassTransform.position}
        quaternion={glassTransform.quaternion}
      >
        {items.map((item) => {
          const g = clamp(item.glassProgress, 0, 1);
          const rawOpacity = item.contactShadowOpacity ?? g * 0.42;
          const opacity = clamp(rawOpacity * g, 0, 0.85);
          if (opacity <= 0.004) return null;

          const x = item.ndcX * (glassTransform.visibleWidth * 0.5);
          const y = item.ndcY * (glassTransform.visibleHeight * 0.5);
          const w = (item.width ?? 1.0) * 1.48;
          const h = (item.height ?? 1.4) * 1.42;
          const sx = Array.isArray(item.scale) ? item.scale[0] : (item.scale ?? 1);
          const sy = Array.isArray(item.scale) ? item.scale[1] : (item.scale ?? 1);

          return (
            <mesh
              key={item.id}
              name={`glass-contact-shadow-${item.id}`}
              position={[x, y, SCREEN_GLASS_SHADOW_OFFSET_Z]}
              rotation={[0, 0, item.rotZ ?? 0]}
              scale={[w * sx, h * sy, 1]}
              renderOrder={1}
            >
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial
                map={shadowTexture}
                transparent
                opacity={opacity}
                depthWrite={false}
              />
            </mesh>
          );
        })}

        {children}

        {showLensFillLight && (
          <pointLight
            name="screen-glass-lens-fill"
            visible={lensFillIntensity > 0.004}
            position={[1.35, 1.05, 2.25]}
            intensity={lensFillIntensity * 0.72}
            distance={7.5}
            decay={1.35}
            color={fillLightColor}
          />
        )}
      </group>
    </ScreenGlassMetricsContext.Provider>
  );
};
