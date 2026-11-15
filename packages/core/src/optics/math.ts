import { spring } from 'remotion';
import {
  evaluateDirectorCamera2D,
  resolveShotsToKeyframes2D,
  type CameraImpulse,
  type CameraKeyframe2D,
  type CameraTransitionMode2D,
  type DirectorCameraTelemetry,
  type StageNode2D,
} from '../camera';
import {
  getStyleSpringConfig,
  resolveStyleOptics,
  type StylePreset,
} from '../style';

export interface OpticalShot2D {
  fromFrame: number;
  /** Named target(s) in `nodes`, or omit to center on `(x, y)` / viewport center */
  target?: string | string[];
  x?: number;
  y?: number;
  zoom?: number;
  rotateZ?: number;
  /** Active focal plane Z for this shot (default `0`) */
  focalZ?: number;
  /** Optional per-shot aperture override in `[0, 1]` */
  aperture?: number;
  transition?: CameraTransitionMode2D;
  padding?: number;
  label?: string;
}

export interface EvaluateOpticalCamera2DParams {
  frame: number;
  fps: number;
  stageWidth: number;
  stageHeight: number;
  style: StylePreset;
  nodes?: Record<string, StageNode2D>;
  shots?: ReadonlyArray<OpticalShot2D>;
  safeBox9x16Compensation?: boolean;
  handheldIntensity?: number;
  impulses?: ReadonlyArray<CameraImpulse>;
  seed?: number;
}

export interface ResolvedOpticalCameraState2D {
  x: number;
  y: number;
  zoom: number;
  rotateZ: number;
  focalZ: number;
  aperture: number;
  telemetry: DirectorCameraTelemetry;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Computes physical 2.5D parallax multiplier for plane `z` (`z ∈ [-2.0, +1.5]`).
 * Foreground (`z > 0`) translates faster than `z = 0`; background (`z < 0`) translates slower.
 */
export function computeParallaxFactor(z: number): number {
  const safeDenom = Math.max(0.25, 1 - z * 0.28);
  return clamp(1 / safeDenom, 0.52, 1.72);
}

/**
 * Computes Circle of Confusion blur radius in pixels for plane `z`.
 * Enforces a strict `< 0.25px` sharp deadzone returning `0` so vector fonts
 * on the active focal plane render with `filter: 'none'`.
 */
export function computeCircleOfConfusionPx(
  z: number,
  focalZ: number,
  aperture: number
): number {
  const clampedAperture = clamp(aperture, 0, 1);
  const rawBlur = Math.abs(z - focalZ) * clampedAperture * 14;
  if (rawBlur < 0.25) {
    return 0;
  }
  return clamp(rawBlur, 0.25, 18);
}

/**
 * Gentle atmospheric contrast/opacity falloff for background planes behind `focalZ - 0.5`.
 */
export function computePlaneAtmosphericOpacity(
  z: number,
  focalZ: number
): number {
  const behind = focalZ - z;
  if (behind <= 0.5) {
    return 1;
  }
  return clamp(1 - (behind - 0.5) * 0.18, 0.72, 1);
}

function buildKeyframesFromOpticalShots(
  shots: ReadonlyArray<OpticalShot2D>,
  nodes: Record<string, StageNode2D> | undefined,
  stageWidth: number,
  stageHeight: number,
  safeBox9x16Compensation: boolean
): CameraKeyframe2D[] {
  const sorted = [...shots].sort((a, b) => a.fromFrame - b.fromFrame);
  const centerX = stageWidth / 2;
  const centerY = stageHeight / 2;

  return sorted.map((shot) => {
    if (shot.target && nodes && Object.keys(nodes).length > 0) {
      const [resolved] = resolveShotsToKeyframes2D(
        nodes,
        [
          {
            fromFrame: shot.fromFrame,
            target: shot.target,
            transition: shot.transition,
            padding: shot.padding,
            zoom: shot.zoom,
            rotateZ: shot.rotateZ,
            label: shot.label,
          },
        ],
        stageWidth,
        stageHeight,
        safeBox9x16Compensation
      );
      if (resolved) {
        return {
          ...resolved,
          x: shot.x ?? resolved.x,
          y: shot.y ?? resolved.y,
        };
      }
    }

    return {
      startFrame: shot.fromFrame,
      x: shot.x ?? centerX,
      y: shot.y ?? centerY,
      zoom: shot.zoom ?? 1,
      rotateZ: shot.rotateZ ?? 0,
      transition: shot.transition ?? 'glide',
      label: shot.label,
    };
  });
}

/**
 * Pure deterministic 2.5D multi-plane optical camera & rack-focus solver.
 */
export function evaluateOpticalCamera2D(
  params: EvaluateOpticalCamera2DParams
): ResolvedOpticalCameraState2D {
  const {
    frame,
    fps,
    stageWidth,
    stageHeight,
    style,
    nodes,
    shots,
    safeBox9x16Compensation = true,
    handheldIntensity,
    impulses,
    seed = 2026,
  } = params;

  const optics = resolveStyleOptics(style);
  const effectiveHandheld = handheldIntensity ?? style.motion.cameraHandheld;

  const sortedShots =
    shots && shots.length > 0
      ? [...shots].sort((a, b) => a.fromFrame - b.fromFrame)
      : [
          {
            fromFrame: 0,
            x: stageWidth / 2,
            y: stageHeight / 2,
            zoom: 1,
            rotateZ: 0,
            focalZ: 0,
            aperture: optics.aperture,
          } satisfies OpticalShot2D,
        ];

  const keyframes = buildKeyframesFromOpticalShots(
    sortedShots,
    nodes,
    stageWidth,
    stageHeight,
    safeBox9x16Compensation
  );

  const baseCam = evaluateDirectorCamera2D({
    frame,
    fps,
    stageWidth,
    stageHeight,
    keyframes,
    safeBox9x16Compensation,
    handheldIntensity: effectiveHandheld,
    impulses,
    seed,
  });

  const cameraSpring = getStyleSpringConfig(style, 'camera');
  let focalZ = sortedShots[0]?.focalZ ?? 0;
  let aperture = clamp(sortedShots[0]?.aperture ?? optics.aperture, 0, 1);

  for (let i = 1; i < sortedShots.length; i++) {
    const prevShot = sortedShots[i - 1]!;
    const currShot = sortedShots[i]!;
    if (frame < currShot.fromFrame) {
      break;
    }

    const prevFocal = prevShot.focalZ ?? 0;
    const currFocal = currShot.focalZ ?? 0;
    const prevAperture = clamp(prevShot.aperture ?? optics.aperture, 0, 1);
    const currAperture = clamp(currShot.aperture ?? optics.aperture, 0, 1);
    const mode = currShot.transition ?? 'glide';

    if (mode === 'cut') {
      focalZ = currFocal;
      aperture = currAperture;
      continue;
    }

    const p = spring({
      frame: frame - currShot.fromFrame,
      fps,
      config:
        mode === 'whip'
          ? { damping: 200, stiffness: 150, mass: 0.78 }
          : cameraSpring,
    });
    focalZ += (currFocal - prevFocal) * p;
    aperture = clamp(aperture + (currAperture - prevAperture) * p, 0, 1);
  }

  const telemetry: DirectorCameraTelemetry = {
    ...baseCam.telemetry,
    focalZ,
    aperture,
  };

  return {
    x: baseCam.x,
    y: baseCam.y,
    zoom: baseCam.zoom,
    rotateZ: baseCam.rotateZ,
    focalZ,
    aperture,
    telemetry,
  };
}
