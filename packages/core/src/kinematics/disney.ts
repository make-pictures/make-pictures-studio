export type Vec3 = [number, number, number];

export type DisneyEaseMode = 'launch' | 'hang' | 'slap' | 'settle';

export interface SheetDeformParams {
  bendX: number;
  bendY: number;
  twist: number;
  cornerWhip: number;
  velocityStretch: number;
}

export const ZERO_SHEET_DEFORM: Readonly<SheetDeformParams> = {
  bendX: 0,
  bendY: 0,
  twist: 0,
  cornerWhip: 0,
  velocityStretch: 0,
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function cubicBezier1D(t: number, p1: number, p2: number): number {
  const u = 1 - t;
  return 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t;
}

/**
 * Asymmetric Disney timing curves:
 * - 'launch': snappy initial burst off a resting surface, soft deceleration
 * - 'hang': fast-in, lingering apex hang-time, fast-out
 * - 'slap': controlled windup accelerating sharply into surface impact
 * - 'settle': smooth critically damped ease-out
 */
export function disneyEase(rawT: number, mode: DisneyEaseMode): number {
  const t = clamp(rawT, 0, 1);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  switch (mode) {
    case 'launch':
      return 1 - Math.pow(1 - t, 3.2);
    case 'hang':
      return cubicBezier1D(t, 0.85, 0.15);
    case 'slap':
      return Math.pow(t, 2.35);
    case 'settle':
      return 1 - Math.pow(1 - t, 4.0);
  }
}

/**
 * Disney Principle — Anticipation: counter-motion dip & backward bow
 * over normalized progress [0, 1] prior to launch.
 */
export function evaluateAnticipation(
  rawProgress: number,
  intensity = 1.0
): { offsetY: number; offsetZ: number; bendY: number; tiltX: number } {
  const p = clamp(rawProgress, 0, 1);
  if (p <= 0 || p >= 1) {
    return { offsetY: 0, offsetZ: 0, bendY: 0, tiltX: 0 };
  }
  const envelope = Math.sin(p * Math.PI);
  const sharp = Math.pow(envelope, 1.35) * intensity;
  return {
    offsetY: -0.045 * sharp,
    offsetZ: -0.07 * sharp,
    bendY: -0.26 * sharp,
    tiltX: 0.14 * sharp,
  };
}

/**
 * Disney Principle — Arcs: 3D cubic Bézier trajectory with analytic velocity
 * and aerodynamic banking roll coupled to lateral travel.
 */
export function evaluateArc3D(
  p0: Vec3,
  p1: Vec3,
  p2: Vec3,
  p3: Vec3,
  rawT: number,
  bankFactor = 0.085,
  maxBankRad = 0.42
): { position: Vec3; velocity: Vec3; bankRoll: number } {
  const t = clamp(rawT, 0, 1);
  const u = 1 - t;
  const u2 = u * u;
  const t2 = t * t;

  const position: Vec3 = [
    u2 * u * p0[0] + 3 * u2 * t * p1[0] + 3 * u * t2 * p2[0] + t2 * t * p3[0],
    u2 * u * p0[1] + 3 * u2 * t * p1[1] + 3 * u * t2 * p2[1] + t2 * t * p3[1],
    u2 * u * p0[2] + 3 * u2 * t * p1[2] + 3 * u * t2 * p2[2] + t2 * t * p3[2],
  ];

  const velocity: Vec3 = [
    3 * u2 * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t2 * (p3[0] - p2[0]),
    3 * u2 * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t2 * (p3[1] - p2[1]),
    3 * u2 * (p1[2] - p0[2]) + 6 * u * t * (p2[2] - p1[2]) + 3 * t2 * (p3[2] - p2[2]),
  ];

  const bankRoll = clamp(-velocity[0] * bankFactor, -maxBankRad, maxBankRad);
  return { position, velocity, bankRoll };
}

/**
 * Disney Principles — Squash & Stretch + Follow-Through / Overlapping Action:
 * Center sticks to the target plane at t = 0 while area-preserving squash
 * (`scaleX * scaleY === 1`) and damped corner-whip oscillations settle to exact 0.
 */
export function evaluateSurfaceImpact(
  framesSinceImpact: number,
  strength = 1.0
): {
  scaleX: number;
  scaleY: number;
  cornerWhip: number;
  rotZ: number;
  contactShadowOpacity: number;
} {
  if (framesSinceImpact < 0) {
    return {
      scaleX: 1,
      scaleY: 1,
      cornerWhip: 0,
      rotZ: 0,
      contactShadowOpacity: 0,
    };
  }

  const t = framesSinceImpact;
  const squashEnv =
    Math.exp(-t * 0.34) *
    Math.sin(clamp(t / 1.4, 0, 1) * (Math.PI * 0.5) + t * 0.55);
  const squashDelta = clamp(0.052 * strength * squashEnv, -0.05, 0.065);
  const scaleX = 1 + squashDelta;
  const scaleY = 1 / scaleX;

  const cornerWhip =
    t > 36 ? 0 : 0.24 * strength * Math.exp(-t * 0.22) * Math.cos(t * 0.92);

  const rotZ =
    t > 36 ? 0 : 0.027 * strength * Math.exp(-t * 0.24) * Math.sin(t * 1.05);

  const shadowRise = clamp(t / 2.5, 0, 1);
  const contactShadowOpacity = shadowRise * (0.36 + 0.12 * Math.exp(-t * 0.25));

  return { scaleX, scaleY, cornerWhip, rotZ, contactShadowOpacity };
}

/**
 * Cinema motion-blur feel via velocity-aligned Disney stretch.
 */
export function evaluateVelocityStretch(
  velocity: Vec3,
  threshold = 1.4,
  maxStretch = 0.085
): number {
  const speed = Math.hypot(velocity[0], velocity[1], velocity[2]);
  if (speed <= threshold) return 0;
  return clamp(((speed - threshold) / (threshold * 4.5)) * maxStretch, 0, maxStretch);
}

/**
 * Disney Principle — Secondary Action: top `maxAffected` neighboring items
 * beneath a launched item subtly rustle and settle in a decaying depth cascade.
 */
export function evaluateSecondaryCascade(
  framesSinceTrigger: number,
  depthIndex: number,
  maxAffected = 4
): { offsetY: number; rotZ: number; bendY: number } {
  const localT = framesSinceTrigger - depthIndex * 1.5;
  if (localT <= 0 || localT >= 28 || depthIndex < 0 || depthIndex >= maxAffected) {
    return { offsetY: 0, rotZ: 0, bendY: 0 };
  }
  const depthAtten = Math.pow(0.58, depthIndex);
  const decay = Math.exp(-localT * 0.22);
  const wave = Math.sin(localT * 0.85);
  const sign = depthIndex % 2 === 0 ? 1 : -1;
  return {
    offsetY: Math.max(0, wave) * 0.018 * depthAtten * decay,
    rotZ: sign * wave * 0.016 * depthAtten * decay,
    bendY: wave * 0.055 * depthAtten * decay,
  };
}
