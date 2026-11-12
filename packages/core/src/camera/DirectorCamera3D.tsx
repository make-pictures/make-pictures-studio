import React, {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { SPRING_PRESETS } from '../theme/tokens';
import { evaluateHandheldNoise, evaluateImpactShake } from './cameraNoise';
import {
  type CameraImpulse,
  DEFAULT_CAMERA_TELEMETRY,
  type DirectorCameraTelemetry,
  DirectorCameraTelemetryContext,
  publishFrameCameraTelemetry,
  readFrameCameraTelemetry,
  type ShotSpec3D,
  type StageAnchor3D,
  subscribeFrameCameraTelemetry,
} from './shotTypes';

export interface ResolvedCameraPose3D {
  position: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
  rollDeg: number;
  telemetry: DirectorCameraTelemetry;
}

export interface EvaluateDirectorCamera3DParams {
  frame: number;
  fps: number;
  width: number;
  height: number;
  durationInFrames?: number;
  anchors: Record<string, StageAnchor3D>;
  shots: ReadonlyArray<ShotSpec3D>;
  handheldIntensity?: number;
  impulses?: ReadonlyArray<CameraImpulse>;
  safeBox9x16Compensation?: boolean;
  fovOffset?: number;
  distanceScale?: number;
  seed?: number;
}

const ExplicitTelemetryProviderContext = React.createContext<boolean>(false);

/**
 * Reads live camera telemetry (`velocity`, `focusDistance`, `activeShotIndex`)
 * from either an enclosing `<DirectorCamera2D>` / `<DirectorCameraTelemetryProvider>`
 * OR a sibling `<DirectorCamera3D>` inside `<ThreeCanvas>` at the exact current `frame`.
 */
export function useDirectorCameraTelemetry(): DirectorCameraTelemetry {
  const frame = useCurrentFrame();
  const hasExplicitProvider = useContext(ExplicitTelemetryProviderContext);
  const ctxTelemetry = useContext(DirectorCameraTelemetryContext);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (hasExplicitProvider) return;
    return subscribeFrameCameraTelemetry((updatedFrame) => {
      if (updatedFrame === frame) {
        setTick((n) => n + 1);
      }
    });
  }, [frame, hasExplicitProvider]);

  if (hasExplicitProvider) {
    return ctxTelemetry;
  }

  return readFrameCameraTelemetry(frame) ?? DEFAULT_CAMERA_TELEMETRY;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function addVec3(
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function lerpVec3(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function distVec3(
  a: [number, number, number],
  b: [number, number, number]
): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function getStageCentroid(anchors: Record<string, StageAnchor3D>): StageAnchor3D {
  const entries = Object.values(anchors);
  if (entries.length === 0) {
    return { position: [0, 0, 0], height: 1.7, radius: 1.2 };
  }
  let sx = 0;
  let sy = 0;
  let sz = 0;
  let sh = 0;
  let maxDist = 1.2;

  for (const a of entries) {
    sx += a.position[0];
    sy += a.position[1];
    sz += a.position[2];
    sh += a.height ?? 1.7;
  }
  const n = entries.length;
  const cx = sx / n;
  const cy = sy / n;
  const cz = sz / n;

  for (const a of entries) {
    const d = Math.hypot(a.position[0] - cx, a.position[2] - cz) + (a.radius ?? 0.7);
    if (d > maxDist) maxDist = d;
  }

  return {
    position: [cx, cy, cz],
    height: sh / n,
    radius: maxDist,
  };
}

function resolveSingleShotPose(
  shot: ShotSpec3D,
  nextShotFrame: number,
  frame: number,
  fps: number,
  anchors: Record<string, StageAnchor3D>,
  isVertical9x16: boolean,
  safeBox9x16Compensation: boolean,
  fovOffset: number,
  distanceScale: number
): { pos: [number, number, number]; lookAt: [number, number, number]; fov: number } {
  const anchorKeys = Object.keys(anchors);
  const centroid = getStageCentroid(anchors);

  const primary: StageAnchor3D =
    (shot.target && anchors[shot.target]) ||
    (shot.shot === 'establishing-wide' || shot.shot === 'high-crane'
      ? centroid
      : anchorKeys.length > 0
        ? anchors[anchorKeys[0]]
        : centroid);

  const secondary: StageAnchor3D | undefined = shot.secondaryTarget
    ? anchors[shot.secondaryTarget]
    : anchorKeys.length > 1
      ? anchors[anchorKeys.find((k) => k !== shot.target) ?? anchorKeys[1]]
      : undefined;

  const h = primary.height ?? 1.7;
  const r = primary.radius ?? 0.7;
  const lookOff = primary.lookOffset ?? [0, 0, 0];

  let basePos: [number, number, number] = [0, 3.4, 9.2];
  let baseLook: [number, number, number] = addVec3(
    [primary.position[0], primary.position[1] + h * 0.65, primary.position[2]],
    lookOff
  );
  let baseFov = shot.fov ?? 34;

  const localFrame = Math.max(0, frame - shot.fromFrame);
  const orbitDegPerSec =
    shot.orbitSpeedDegPerSec ?? (shot.transition === 'orbit' ? 10 : 0);
  const extraOrbitDeg = (localFrame / Math.max(1, fps)) * orbitDegPerSec;

  if (shot.shot === 'custom') {
    basePos = shot.customPos ? [...shot.customPos] : [0, 3.6, 9.2];
    baseLook = shot.customLookAt
      ? [...shot.customLookAt]
      : addVec3(
          [primary.position[0], primary.position[1] + h * 0.62, primary.position[2]],
          lookOff
        );
    baseFov = shot.fov ?? 34;

    if (Math.abs(extraOrbitDeg) > 1e-4) {
      const dx = basePos[0] - baseLook[0];
      const dz = basePos[2] - baseLook[2];
      const rad = (extraOrbitDeg * Math.PI) / 180;
      const cosR = Math.cos(rad);
      const sinR = Math.sin(rad);
      basePos = [
        baseLook[0] + dx * cosR + dz * sinR,
        basePos[1],
        baseLook[2] - dx * sinR + dz * cosR,
      ];
    }
  } else if (shot.shot === 'over-the-shoulder' && secondary) {
    const sh = secondary.height ?? 1.7;
    const targetLook: [number, number, number] = addVec3(
      [primary.position[0], primary.position[1] + h * 0.76, primary.position[2]],
      lookOff
    );
    const dx = primary.position[0] - secondary.position[0];
    const dz = primary.position[2] - secondary.position[2];
    const len = Math.max(0.001, Math.hypot(dx, dz));
    const dirX = dx / len;
    const dirZ = dz / len;
    // Right vector in XZ plane: cross((dirX, 0, dirZ), (0, 1, 0)) = (-dirZ, 0, dirX)
    const rightX = -dirZ;
    const rightZ = dirX;
    const shoulderSign = (shot.angleDeg ?? 1) >= 0 ? 1 : -1;

    baseLook = targetLook;
    basePos = [
      secondary.position[0] - dirX * 1.45 + rightX * 0.52 * shoulderSign,
      secondary.position[1] + sh * 0.88,
      secondary.position[2] - dirZ * 1.45 + rightZ * 0.52 * shoulderSign + 0.65,
    ];
    baseFov = shot.fov ?? 33;
  } else if (shot.shot === 'medium-two-shot' && secondary) {
    const sh = secondary.height ?? 1.7;
    const avgH = (h + sh) * 0.5;
    const midX = (primary.position[0] + secondary.position[0]) * 0.5;
    const midY = (primary.position[1] + secondary.position[1]) * 0.5;
    const midZ = (primary.position[2] + secondary.position[2]) * 0.5;
    const span = Math.hypot(
      primary.position[0] - secondary.position[0],
      primary.position[2] - secondary.position[2]
    );
    const dist = Math.max(5.8, span * 1.65 + 2.6);
    const angleRad = (((shot.angleDeg ?? 0) + extraOrbitDeg) * Math.PI) / 180;

    baseLook = [midX, midY + avgH * 0.65, midZ];
    basePos = [
      midX + Math.sin(angleRad) * dist,
      midY + avgH * 0.82 + 0.35,
      midZ + Math.cos(angleRad) * dist,
    ];
    baseFov = shot.fov ?? 34;
  } else {
    let defaultAngle = 12;
    let dist = 6.5;
    let camY = primary.position[1] + h * 0.82;
    let lookY = primary.position[1] + h * 0.66;

    switch (shot.shot) {
      case 'establishing-wide':
        defaultAngle = 12;
        baseFov = shot.fov ?? 36;
        dist = Math.max(8.8, r * 3.1 + 3.2);
        camY = primary.position[1] + h * 1.45 + 1.35;
        lookY = primary.position[1] + h * 0.58;
        break;
      case 'medium':
        defaultAngle = 14;
        baseFov = shot.fov ?? 32;
        dist = Math.max(4.6, r * 4.0 + 1.6);
        camY = primary.position[1] + h * 0.8 + 0.25;
        lookY = primary.position[1] + h * 0.68;
        break;
      case 'medium-two-shot':
        defaultAngle = 6;
        baseFov = shot.fov ?? 34;
        dist = Math.max(6.2, r * 4.4 + 2.4);
        camY = primary.position[1] + h * 0.85 + 0.35;
        lookY = primary.position[1] + h * 0.65;
        break;
      case 'close-up':
        defaultAngle = 10;
        baseFov = shot.fov ?? 27;
        dist = Math.max(2.65, r * 2.5 + 0.85);
        camY = primary.position[1] + h * 0.84;
        lookY = primary.position[1] + h * 0.8;
        break;
      case 'over-the-shoulder':
        defaultAngle = 22;
        baseFov = shot.fov ?? 33;
        dist = Math.max(3.8, r * 3.2 + 1.2);
        camY = primary.position[1] + h * 0.88;
        lookY = primary.position[1] + h * 0.76;
        break;
      case 'low-angle-hero':
        defaultAngle = -16;
        baseFov = shot.fov ?? 38;
        dist = Math.max(3.6, r * 3.0 + 1.3);
        camY = primary.position[1] + h * 0.32;
        lookY = primary.position[1] + h * 0.78;
        break;
      case 'high-crane':
        defaultAngle = 24;
        baseFov = shot.fov ?? 38;
        dist = Math.max(9.2, r * 3.5 + 3.6);
        camY = primary.position[1] + h * 2.25 + 3.1;
        lookY = primary.position[1] + h * 0.46;
        break;
      default:
        break;
    }

    const angleRad =
      (((shot.angleDeg ?? defaultAngle) + extraOrbitDeg) * Math.PI) / 180;
    baseLook = addVec3([primary.position[0], lookY, primary.position[2]], lookOff);
    basePos = [
      baseLook[0] + Math.sin(angleRad) * dist,
      camY + lookOff[1],
      baseLook[2] + Math.cos(angleRad) * dist,
    ];
  }

  // Apply user distanceScale & fovOffset
  let effectiveFov = clamp(baseFov + fovOffset, 14, 85);
  let relX = (basePos[0] - baseLook[0]) * distanceScale;
  let relY = (basePos[1] - baseLook[1]) * distanceScale;
  let relZ = (basePos[2] - baseLook[2]) * distanceScale;

  // Vertigo Effect (Dolly-Zoom): lock foreground subject framing via dist * tan(fov / 2) = const
  if (shot.dollyZoomDeltaFov && Math.abs(shot.dollyZoomDeltaFov) > 0.01) {
    const shotDuration = Math.max(24, nextShotFrame - shot.fromFrame);
    const dzProgress = interpolate(localFrame, [0, shotDuration], [0, 1], {
      easing: Easing.inOut(Easing.sin),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const targetFov = clamp(
      effectiveFov + shot.dollyZoomDeltaFov * dzProgress,
      14,
      85
    );
    const opticalRatio =
      Math.tan((effectiveFov * Math.PI) / 360) /
      Math.max(0.05, Math.tan((targetFov * Math.PI) / 360));
    relX *= opticalRatio;
    relY *= opticalRatio;
    relZ *= opticalRatio;
    effectiveFov = targetFov;
  }

  let finalLook: [number, number, number] = [...baseLook];

  // 9:16 Golden Safe Box Auto-Framing (`y ∈ [220, 1380]` out of 1920 -> center @ y=800 vs 960):
  // Widens vertical FOV, pulls camera back so horizontal two-shots fit cleanly inside `x ∈ [40, 910]`,
  // and shifts `lookAt.y` slightly downward so the subject projects upward into the Safe Box
  // well clear of the bottom 480 px YouTube Shorts / Reels UI dead zone.
  if (isVertical9x16 && safeBox9x16Compensation) {
    effectiveFov = clamp(effectiveFov + 7.5, 16, 86);
    const verticalPullback = 1.32;
    relX *= verticalPullback;
    relY *= 1.12;
    relZ *= verticalPullback;

    const compensatedDist = Math.hypot(relX, relY, relZ);
    const halfHeightWorld =
      compensatedDist * Math.tan((effectiveFov * Math.PI) / 360);
    // Shift lookAt.y downward by ~15.5% of frustum half-height -> lifts subject ~150px above screen center
    finalLook = [
      finalLook[0] + 0.03 * halfHeightWorld,
      finalLook[1] - 0.155 * halfHeightWorld,
      finalLook[2],
    ];
  }

  const finalPos: [number, number, number] = [
    finalLook[0] + relX,
    finalLook[1] + relY,
    finalLook[2] + relZ,
  ];

  return {
    pos: finalPos,
    lookAt: finalLook,
    fov: effectiveFov,
  };
}

/**
 * Pure deterministic 3D Shot DSL evaluator (`f(frame, fps, width, height, props)`).
 */
export function evaluateDirectorCamera3D(
  params: EvaluateDirectorCamera3DParams
): ResolvedCameraPose3D {
  const {
    frame,
    fps,
    width,
    height,
    durationInFrames = 600,
    anchors,
    shots,
    handheldIntensity = 0.22,
    impulses = [],
    safeBox9x16Compensation = true,
    fovOffset = 0,
    distanceScale = 1,
    seed = 1337,
  } = params;

  const isVertical9x16 = height > width;

  if (!shots.length) {
    const fallbackDist = isVertical9x16 && safeBox9x16Compensation ? 11.8 : 9.0;
    const fallbackFov = (isVertical9x16 && safeBox9x16Compensation ? 41 : 34) + fovOffset;
    const fallbackLookY = isVertical9x16 && safeBox9x16Compensation ? 0.55 : 1.1;
    return {
      position: [0, 3.4, fallbackDist * distanceScale],
      lookAt: [0, fallbackLookY, 0],
      fov: fallbackFov,
      rollDeg: 0,
      telemetry: {
        velocity: 0,
        focusDistance: fallbackDist * distanceScale,
        activeShotIndex: 0,
      },
    };
  }

  const sortedShots = [...shots].sort((a, b) => a.fromFrame - b.fromFrame);
  const resolvedPoses = sortedShots.map((s, idx) => {
    const nextStart =
      idx + 1 < sortedShots.length
        ? sortedShots[idx + 1].fromFrame
        : durationInFrames;
    return resolveSingleShotPose(
      s,
      nextStart,
      frame,
      fps,
      anchors,
      isVertical9x16,
      safeBox9x16Compensation,
      fovOffset,
      distanceScale
    );
  });

  let pos: [number, number, number] = [...resolvedPoses[0].pos];
  let lookAt: [number, number, number] = [...resolvedPoses[0].lookAt];
  let fov = resolvedPoses[0].fov;
  let rollDeg = 0;
  let velocity = 0;
  let activeShotIndex = 0;

  for (let i = 1; i < sortedShots.length; i++) {
    const currShot = sortedShots[i];
    if (frame < currShot.fromFrame) {
      break;
    }

    activeShotIndex = i;
    const prevPose = resolvedPoses[i - 1];
    const currPose = resolvedPoses[i];
    const mode = currShot.transition ?? 'glide';

    if (mode === 'cut') {
      pos = [...currPose.pos];
      lookAt = [...currPose.lookAt];
      fov = currPose.fov;
      continue;
    }

    if (mode === 'whip') {
      const p = spring({
        frame: frame - currShot.fromFrame,
        fps,
        config: {
          damping: 200,
          stiffness: 155,
          mass: 0.78,
        },
      });
      const clampedP = clamp(p, 0, 1);
      const whipArc = Math.sin(Math.PI * clampedP);
      const lateralDir =
        currPose.lookAt[0] - prevPose.lookAt[0] >= 0 ? 1 : -1;

      pos = lerpVec3(prevPose.pos, currPose.pos, p);
      lookAt = lerpVec3(prevPose.lookAt, currPose.lookAt, p);
      fov = prevPose.fov + (currPose.fov - prevPose.fov) * p + whipArc * 2.4;
      rollDeg += lateralDir * -3.6 * whipArc;
      velocity = Math.max(velocity, whipArc);
      continue;
    }

    if (mode === 'orbit') {
      const p = spring({
        frame: frame - currShot.fromFrame,
        fps,
        config: {
          damping: 200,
          stiffness: 30,
          mass: 1.4,
        },
      });
      const blendedLook = lerpVec3(prevPose.lookAt, currPose.lookAt, p);
      const r0x = prevPose.pos[0] - prevPose.lookAt[0];
      const r0z = prevPose.pos[2] - prevPose.lookAt[2];
      const r1x = currPose.pos[0] - currPose.lookAt[0];
      const r1z = currPose.pos[2] - currPose.lookAt[2];

      const rad0 = Math.max(0.1, Math.hypot(r0x, r0z));
      const rad1 = Math.max(0.1, Math.hypot(r1x, r1z));
      const a0 = Math.atan2(r0x, r0z);
      let a1 = Math.atan2(r1x, r1z);
      // Shortest angular path around Y
      while (a1 - a0 > Math.PI) a1 -= Math.PI * 2;
      while (a1 - a0 < -Math.PI) a1 += Math.PI * 2;

      const angle = a0 + (a1 - a0) * p;
      const radius = rad0 + (rad1 - rad0) * p;
      const camY = prevPose.pos[1] + (currPose.pos[1] - prevPose.pos[1]) * p;
      const midArc = Math.sin(Math.PI * clamp(p, 0, 1));

      lookAt = blendedLook;
      pos = [
        blendedLook[0] + Math.sin(angle) * radius,
        camY,
        blendedLook[2] + Math.cos(angle) * radius,
      ];
      fov = prevPose.fov + (currPose.fov - prevPose.fov) * p;
      velocity = Math.max(velocity, midArc * 0.42);
      continue;
    }

    // Default: 'glide' on calm damped spring (SPRING_PRESETS.calmCamera)
    const p = spring({
      frame: frame - currShot.fromFrame,
      fps,
      config: SPRING_PRESETS.calmCamera,
    });
    const midArc = 0.5 * (1 - Math.cos(2 * Math.PI * clamp(p, 0, 1)));
    pos = lerpVec3(prevPose.pos, currPose.pos, p);
    lookAt = lerpVec3(prevPose.lookAt, currPose.lookAt, p);
    fov = prevPose.fov + (currPose.fov - prevPose.fov) * p;
    velocity = Math.max(velocity, midArc * 0.32);
  }

  // Deterministic handheld breathing + impact shake
  const handheld = evaluateHandheldNoise(frame, fps, seed, handheldIntensity);
  const shake = evaluateImpactShake(frame, fps, impulses, seed + 17);

  const finalPos: [number, number, number] = [
    pos[0] + handheld.posOffset[0] + shake.posOffset[0],
    pos[1] + handheld.posOffset[1] + shake.posOffset[1],
    pos[2] + handheld.posOffset[2] + shake.posOffset[2],
  ];
  const finalLookAt: [number, number, number] = [
    lookAt[0] + handheld.lookOffset[0],
    lookAt[1] + handheld.lookOffset[1],
    lookAt[2] + handheld.lookOffset[2],
  ];
  const finalRollDeg = rollDeg + handheld.rollDeg + shake.rollDeg;
  const focusDistance = distVec3(finalPos, finalLookAt);
  const totalVelocity = clamp(Math.max(velocity, shake.trauma * 0.85), 0, 1);

  const activeSpec = sortedShots[activeShotIndex];
  const telemetry: DirectorCameraTelemetry = {
    velocity: totalVelocity,
    focusDistance,
    activeShotIndex,
    activeShotLabel:
      activeSpec?.label ??
      (activeSpec?.target
        ? `${activeSpec.shot} (${activeSpec.target})`
        : activeSpec?.shot),
  };

  return {
    position: finalPos,
    lookAt: finalLookAt,
    fov,
    rollDeg: finalRollDeg,
    telemetry,
  };
}

export interface DirectorCameraTelemetryProviderProps {
  telemetry: DirectorCameraTelemetry;
  children: React.ReactNode;
}

export const DirectorCameraTelemetryProvider: React.FC<
  DirectorCameraTelemetryProviderProps
> = ({ telemetry, children }) => (
  <ExplicitTelemetryProviderContext.Provider value={true}>
    <DirectorCameraTelemetryContext.Provider value={telemetry}>
      {children}
    </DirectorCameraTelemetryContext.Provider>
  </ExplicitTelemetryProviderContext.Provider>
);

export interface DirectorCamera3DProps {
  anchors: Record<string, StageAnchor3D>;
  shots: ShotSpec3D[];
  handheldIntensity?: number;
  impulses?: CameraImpulse[];
  safeBox9x16Compensation?: boolean;
  fovOffset?: number;
  distanceScale?: number;
  seed?: number;
  children?: React.ReactNode;
}

interface R3FCameraLike {
  up: { set(x: number, y: number, z: number): void };
  position: { set(x: number, y: number, z: number): void };
  lookAt(x: number, y: number, z: number): void;
  rotateZ(radians: number): void;
  updateProjectionMatrix(): void;
  isPerspectiveCamera?: boolean;
  fov?: number;
}

interface R3FRootStateLike {
  camera?: R3FCameraLike;
  invalidate?: () => void;
}

interface R3FRootStoreLike {
  getState?: () => R3FRootStateLike;
  (): R3FRootStateLike | { getState?: () => R3FRootStateLike };
}

interface R3FGroupInstanceLike {
  __r3f?: {
    root?: R3FRootStoreLike;
  };
}

function resolveR3FRootState(
  node: R3FGroupInstanceLike | null
): R3FRootStateLike | null {
  const root = node?.__r3f?.root;
  if (!root) return null;
  if (typeof root.getState === 'function') {
    return root.getState();
  }
  if (typeof root === 'function') {
    const res = root();
    if (res && typeof (res as { getState?: unknown }).getState === 'function') {
      return (res as { getState: () => R3FRootStateLike }).getState();
    }
    return (res as R3FRootStateLike) ?? null;
  }
  return null;
}

/**
 * Declarative 3D Shot-DSL Camera Rig for `@remotion/three` (`<ThreeCanvas>`).
 * Resolves named `StageAnchor3D` targets and cinematic shot presets, automatically
 * re-framing vertical `9:16` Shorts compositions into the Golden Safe Box (`y ∈ [220, 1380]`).
 *
 * Accesses the active R3F `camera` via the mounted `<group>` fiber instance (`__r3f.root`)
 * so `@make-pictures/core` carries zero top-level runtime imports of `three` or `@react-three/fiber`
 * in 2D-only projects and Node CLI environments.
 */
export const DirectorCamera3D: React.FC<DirectorCamera3DProps> = ({
  anchors,
  shots,
  handheldIntensity = 0.22,
  impulses,
  safeBox9x16Compensation = true,
  fovOffset = 0,
  distanceScale = 1,
  seed = 1337,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const rigGroupRef = useRef<R3FGroupInstanceLike | null>(null);

  const solved = useMemo(
    () =>
      evaluateDirectorCamera3D({
        frame,
        fps,
        width,
        height,
        durationInFrames,
        anchors,
        shots,
        handheldIntensity,
        impulses,
        safeBox9x16Compensation,
        fovOffset,
        distanceScale,
        seed,
      }),
    [
      frame,
      fps,
      width,
      height,
      durationInFrames,
      anchors,
      shots,
      handheldIntensity,
      impulses,
      safeBox9x16Compensation,
      fovOffset,
      distanceScale,
      seed,
    ]
  );

  const [px, py, pz] = solved.position;
  const [lx, ly, lz] = solved.lookAt;
  const { fov, rollDeg, telemetry } = solved;

  useLayoutEffect(() => {
    const r3fState = resolveR3FRootState(rigGroupRef.current);
    const camera = r3fState?.camera;
    if (camera) {
      camera.up.set(0, 1, 0);
      camera.position.set(px, py, pz);
      if (camera.isPerspectiveCamera && typeof camera.fov === 'number') {
        camera.fov = fov;
      }
      camera.lookAt(lx, ly, lz);
      if (Math.abs(rollDeg) > 1e-4) {
        camera.rotateZ((rollDeg * Math.PI) / 180);
      }
      camera.updateProjectionMatrix();
      r3fState?.invalidate?.();
    }

    publishFrameCameraTelemetry(frame, telemetry);
  }, [px, py, pz, lx, ly, lz, fov, rollDeg, frame, telemetry]);

  if (!children) {
    return React.createElement('group', { ref: rigGroupRef });
  }

  return (
    <DirectorCameraTelemetryProvider telemetry={telemetry}>
      {React.createElement('group', { ref: rigGroupRef }, children)}
    </DirectorCameraTelemetryProvider>
  );
};
