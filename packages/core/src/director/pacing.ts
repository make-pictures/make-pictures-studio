import { spring } from 'remotion';

export const DIRECTOR_PACING_BUDGET = {
  minSceneDurationFrames: 270,
  minSettleHoldFrames: 45,
  maxWordsPerSecond: 2.8,
  defaultCrossDissolveFrames: 54,
} as const;

export const CINEMATIC_SPRINGS = {
  entrance: { mass: 1.45, damping: 200, stiffness: 58 },
  drift: { mass: 1.8, damping: 200, stiffness: 34 },
  emphasis: { mass: 1.25, damping: 200, stiffness: 72 },
} as const;

export interface FocalStaggerOptions {
  startFrame?: number;
  supportDelayFrames?: number;
  ambientDelayFrames?: number;
}

export interface FocalStaggerValues {
  lead: number;
  support: number;
  ambient: number;
}

/**
 * Enforces the Single Focal Point Law across a scene entrance:
 * `lead` enters first (`startFrame >= 2` to preserve Clean Frame 0),
 * `support` waits `+22` frames, and `ambient` waits `+40` frames,
 * each driven by critically damped `CINEMATIC_SPRINGS.entrance`.
 */
export function computeFocalStagger(
  frame: number,
  fps: number,
  options?: FocalStaggerOptions
): FocalStaggerValues {
  if (frame <= 0) {
    return { lead: 0, support: 0, ambient: 0 };
  }

  const safeFps = Math.max(1, fps);
  const effectiveStart = Math.max(2, options?.startFrame ?? 2);
  const supportDelay = Math.max(0, options?.supportDelayFrames ?? 22);
  const ambientDelay = Math.max(supportDelay, options?.ambientDelayFrames ?? 40);

  const lead =
    frame <= effectiveStart
      ? 0
      : spring({
          frame: frame - effectiveStart,
          fps: safeFps,
          config: CINEMATIC_SPRINGS.entrance,
        });

  const supportStart = effectiveStart + supportDelay;
  const support =
    frame <= supportStart
      ? 0
      : spring({
          frame: frame - supportStart,
          fps: safeFps,
          config: CINEMATIC_SPRINGS.entrance,
        });

  const ambientStart = effectiveStart + ambientDelay;
  const ambient =
    frame <= ambientStart
      ? 0
      : spring({
          frame: frame - ambientStart,
          fps: safeFps,
          config: CINEMATIC_SPRINGS.entrance,
        });

  return { lead, support, ambient };
}

/**
 * Backwards-compatible alias for `computeFocalStagger`.
 */
export const useFocalStagger = computeFocalStagger;
