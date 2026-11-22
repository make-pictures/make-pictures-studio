import type { Vec3 } from '../kinematics/disney';
import type {
  CameraBasis3D,
  CameraImpulse,
  CameraKeyframe3D,
  EvaluatedCameraBasis3D,
  GlassLightingBlend,
  ScreenGlassPose3D,
} from './shotTypes';

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function smoothstepCubic(t: number): number {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function normalize(v: Vec3, fallback: Vec3 = [0, 0, -1]): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len <= 1e-8) return [...fallback];
  return [v[0] / len, v[1] / len, v[2] / len];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/**
 * Computes an orthonormal camera basis (`forward`, `right`, `up`) with an automatic
 * overhead gimbal singularity guard (`|forward.y| > 0.995` switches `worldUp` to `[0, 0, -1]`).
 */
export function computeCameraBasis3D(
  position: Vec3,
  target: Vec3,
  rollRad = 0
): CameraBasis3D {
  const forward = normalize([
    target[0] - position[0],
    target[1] - position[1],
    target[2] - position[2],
  ]);

  const worldUp: Vec3 = Math.abs(forward[1]) > 0.995 ? [0, 0, -1] : [0, 1, 0];
  let right = normalize(cross(forward, worldUp), [1, 0, 0]);
  let up = normalize(cross(right, forward), [0, 1, 0]);

  if (Math.abs(rollRad) > 1e-6) {
    const c = Math.cos(rollRad);
    const s = Math.sin(rollRad);
    const rRoll: Vec3 = [
      right[0] * c + up[0] * s,
      right[1] * c + up[1] * s,
      right[2] * c + up[2] * s,
    ];
    const uRoll: Vec3 = [
      -right[0] * s + up[0] * c,
      -right[1] * s + up[1] * c,
      -right[2] * s + up[2] * c,
    ];
    right = normalize(rRoll, right);
    up = normalize(uRoll, up);
  }

  return {
    position: [...position],
    target: [...target],
    roll: rollRad,
    forward,
    right,
    up,
  };
}

/**
 * Evaluates a deterministic one-shot 3D camera keyframe timeline with calm handheld breathing
 * and decaying micro-recoil impulses.
 */
export function evaluateCameraKeyframes3D(
  frame: number,
  keyframes: ReadonlyArray<CameraKeyframe3D>,
  impulses: ReadonlyArray<CameraImpulse> = [],
  handheldIntensity = 0.012,
  seed = 42
): EvaluatedCameraBasis3D {
  if (keyframes.length === 0) {
    return {
      ...computeCameraBasis3D([0, 3, 6], [0, 0, 0], 0),
      fov: 36,
    };
  }

  let activeIdx = 0;
  for (let i = 0; i < keyframes.length; i++) {
    if (frame >= keyframes[i].fromFrame) activeIdx = i;
  }

  const curr = keyframes[activeIdx];
  const prev = activeIdx > 0 ? keyframes[activeIdx - 1] : curr;

  let position: Vec3 = [...curr.position];
  let target: Vec3 = [...curr.target];
  let fov = curr.fov;
  let roll = curr.roll ?? 0;

  if (activeIdx > 0 && curr.transition !== 'cut') {
    const dur = Math.max(1, curr.transitionFrames ?? 48);
    const t = smoothstepCubic((frame - curr.fromFrame) / dur);
    position = lerpVec3(prev.position, curr.position, t);
    target = lerpVec3(prev.target, curr.target, t);
    fov = lerp(prev.fov, curr.fov, t);
    roll = lerp(prev.roll ?? 0, curr.roll ?? 0, t);
  }

  if (handheldIntensity > 0) {
    const phase = seed * 0.37;
    position[0] += Math.sin(frame * 0.032 + phase) * handheldIntensity * 0.6;
    position[1] += Math.cos(frame * 0.041 + phase * 1.7) * handheldIntensity * 0.45;
    roll += Math.sin(frame * 0.029 + phase * 2.1) * handheldIntensity * 0.12;
  }

  for (const imp of impulses) {
    const dt = frame - imp.frame;
    const decayFrames = imp.decayFrames ?? 12;
    const intensity = imp.intensity ?? 0.35;
    if (dt >= 0 && dt < decayFrames) {
      const env = Math.pow(1 - dt / decayFrames, 2.2);
      const osc = Math.cos(dt * 1.45);
      position[1] -= intensity * env * osc * 0.65;
      position[2] += intensity * env * 0.85;
      roll += intensity * env * Math.sin(dt * 1.8) * 0.14;
    }
  }

  return {
    ...computeCameraBasis3D(position, target, roll),
    fov,
  };
}

/**
 * Projects normalized screen coordinates (`ndcX`, `ndcY` in `[-1, 1]`) onto an
 * invisible glass plane `glassDistance` units in front of the camera.
 */
export function projectScreenGlassPose(
  camera: EvaluatedCameraBasis3D,
  ndcX: number,
  ndcY: number,
  glassDistance = 2.2,
  aspect = 16 / 9
): ScreenGlassPose3D {
  const fovRad = (camera.fov * Math.PI) / 180;
  const visibleHeight = 2 * glassDistance * Math.tan(fovRad * 0.5);
  const visibleWidth = visibleHeight * aspect;
  const offsetX = ndcX * (visibleWidth * 0.5);
  const offsetY = ndcY * (visibleHeight * 0.5);

  const position: Vec3 = [
    camera.position[0] +
      camera.forward[0] * glassDistance +
      camera.right[0] * offsetX +
      camera.up[0] * offsetY,
    camera.position[1] +
      camera.forward[1] * glassDistance +
      camera.right[1] * offsetX +
      camera.up[1] * offsetY,
    camera.position[2] +
      camera.forward[2] * glassDistance +
      camera.right[2] * offsetX +
      camera.up[2] * offsetY,
  ];

  return {
    position,
    basisForward: camera.forward,
    basisRight: camera.right,
    basisUp: camera.up,
    visibleHeight,
    visibleWidth,
  };
}

/**
 * Coordinates lighting separation when an object pins onto the screen glass:
 * gently dims main scene light by `dimStrength`, ramps warm lens-side fill light,
 * and disables distant tabletop shadow casting past `glassProgress > 0.5`.
 */
export function computeGlassLightingBlend(
  rawGlassProgress: number,
  dimStrength = 0.18
): GlassLightingBlend {
  const g = clamp(rawGlassProgress, 0, 1);
  return {
    sceneLampMultiplier: 1 - dimStrength * g,
    lensFillIntensity: 0.85 * g,
    castSceneShadow: g <= 0.5,
  };
}
