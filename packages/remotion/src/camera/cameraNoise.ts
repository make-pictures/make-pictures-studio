import { createSeededRandom } from '../utils/prng';
import type { CameraImpulse } from './shotTypes';

export interface HandheldNoiseResult {
  /** Smooth 3D position offset in meters/world units */
  posOffset: [number, number, number];
  /** Subtle 3D look-at drift in world units */
  lookOffset: [number, number, number];
  /** Gentle horizon roll in degrees */
  rollDeg: number;
  /** 2D canvas X drift in pixels */
  x2D: number;
  /** 2D canvas Y drift in pixels */
  y2D: number;
}

export interface ImpactShakeResult {
  /** Damped 3D trauma displacement in world units */
  posOffset: [number, number, number];
  /** Damped roll impulse in degrees */
  rollDeg: number;
  /** Damped 2D horizontal shake in pixels */
  x2D: number;
  /** Damped 2D vertical shake in pixels */
  y2D: number;
  /** Aggregate normalized trauma level in [0, 1] */
  trauma: number;
}

/**
 * Pure deterministic low-frequency handheld operator breathing & sway.
 * Uses calm angular frequencies (`0.030 .. 0.054` rad/frame @ 60 FPS -> 2.0–3.5s cycles)
 * seeded via `createSeededRandom` so camera motion feels organic without ever jittering.
 */
export function evaluateHandheldNoise(
  frame: number,
  fps: number,
  seed = 42,
  intensity = 1
): HandheldNoiseResult {
  if (intensity <= 0 || fps <= 0) {
    return {
      posOffset: [0, 0, 0],
      lookOffset: [0, 0, 0],
      rollDeg: 0,
      x2D: 0,
      y2D: 0,
    };
  }

  const rand = createSeededRandom(`handheld:${seed}`);
  const p0 = rand() * Math.PI * 2;
  const p1 = rand() * Math.PI * 2;
  const p2 = rand() * Math.PI * 2;
  const p3 = rand() * Math.PI * 2;
  const p4 = rand() * Math.PI * 2;
  const p5 = rand() * Math.PI * 2;
  const p6 = rand() * Math.PI * 2;

  // Normalize frame rate to 60 FPS reference so 0.03..0.055 rad/frame invariant holds at any fps
  const f60 = frame * (60 / fps);

  const nx =
    Math.sin(f60 * 0.031 + p0) * 0.62 + Math.cos(f60 * 0.047 + p1) * 0.38;
  const ny =
    Math.sin(f60 * 0.036 + p2) * 0.66 + Math.sin(f60 * 0.052 + p3) * 0.34;
  const nz =
    Math.cos(f60 * 0.033 + p4) * 0.7 + Math.sin(f60 * 0.044 + p5) * 0.3;
  const nRoll =
    Math.sin(f60 * 0.03 + p6) * 0.65 + Math.cos(f60 * 0.049 + p0) * 0.35;

  const amp = Math.max(0, intensity);

  return {
    posOffset: [nx * 0.085 * amp, ny * 0.065 * amp, nz * 0.055 * amp],
    lookOffset: [nx * 0.028 * amp, ny * 0.024 * amp, 0],
    rollDeg: nRoll * 0.42 * amp,
    x2D: nx * 6.5 * amp,
    y2D: ny * 5.2 * amp,
  };
}

/**
 * Pure deterministic damped harmonic trauma shake triggered at explicit `CameraImpulse` frames.
 * Decays cleanly to exact `0` at `frame >= impulse.frame + decayFrames` with zero state accumulation.
 */
export function evaluateImpactShake(
  frame: number,
  fps: number,
  impulses: ReadonlyArray<CameraImpulse> = [],
  seed = 101
): ImpactShakeResult {
  if (!impulses.length || fps <= 0) {
    return {
      posOffset: [0, 0, 0],
      rollDeg: 0,
      x2D: 0,
      y2D: 0,
      trauma: 0,
    };
  }

  let sx = 0;
  let sy = 0;
  let sz = 0;
  let sRoll = 0;
  let totalTrauma = 0;

  for (let i = 0; i < impulses.length; i++) {
    const imp = impulses[i];
    const dtFrames = frame - imp.frame;
    const decayFrames = Math.max(6, imp.decayFrames ?? Math.round(fps * 0.42));

    if (dtFrames < 0 || dtFrames >= decayFrames) {
      continue;
    }

    const strength = Math.max(0, imp.intensity ?? 1);
    const u = dtFrames / decayFrames; // 0..1
    // Smooth quadratic + exponential envelope guaranteed to hit 0 at u = 1
    const envelope = (1 - u) * (1 - u) * Math.exp(-3.2 * u) * strength;
    totalTrauma = Math.min(1, totalTrauma + envelope);

    const rand = createSeededRandom(`impulse:${seed}:${i}:${imp.frame}`);
    const phaseX = rand() * Math.PI * 2;
    const phaseY = rand() * Math.PI * 2;
    const phaseZ = rand() * Math.PI * 2;
    const phaseR = rand() * Math.PI * 2;
    const signR = rand() > 0.5 ? 1 : -1;

    const tSec = dtFrames / fps;
    // Crisp cinematic impact thud (~11–16 Hz damped harmonic)
    const oscX = Math.sin(tSec * Math.PI * 2 * 13.5 + phaseX);
    const oscY = Math.cos(tSec * Math.PI * 2 * 15.2 + phaseY);
    const oscZ = Math.sin(tSec * Math.PI * 2 * 10.8 + phaseZ);
    const oscR = Math.sin(tSec * Math.PI * 2 * 12.0 + phaseR) * signR;

    sx += oscX * envelope;
    sy += oscY * envelope;
    sz += oscZ * envelope;
    sRoll += oscR * envelope;
  }

  return {
    posOffset: [sx * 0.16, sy * 0.14, sz * 0.09],
    rollDeg: sRoll * 1.65,
    x2D: sx * 18,
    y2D: sy * 15,
    trauma: totalTrauma,
  };
}
