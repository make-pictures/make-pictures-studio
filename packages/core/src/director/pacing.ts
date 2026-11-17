import { spring } from 'remotion';

export const DIRECTOR_PACING_BUDGET = {
  minSceneDurationFrames: 270,
  preSpeechSettleFrames: 42,
  minPreSpeechSettleFrames: 36,
  postSpeechHoldFrames: 96,
  minPostSpeechHoldFrames: 90,
  finalScenePostHoldFrames: 144,
  minFinalScenePostHoldFrames: 132,
  maxSubViewsPerScene: 2,
  defaultCrossDissolveFrames: 54,
  minSettleHoldFrames: 45,
  maxWordsPerSecond: 2.8,
} as const;

export interface SceneTimingOptions {
  fps?: number;
  isFinalScene?: boolean;
  preSettleSeconds?: number;
  postHoldSeconds?: number;
  minDurationSeconds?: number;
}

export interface ComputedSceneTiming {
  voiceoverStartFrame: number;
  voiceoverDurationFrames: number;
  voiceoverEndFrame: number;
  postHoldFrames: number;
  durationInFrames: number;
}

export function computeSceneTimingFromVoiceover(
  voiceoverDurationSeconds: number,
  options: SceneTimingOptions = {}
): ComputedSceneTiming {
  const fps =
    typeof options.fps === 'number' && Number.isFinite(options.fps) && options.fps > 0
      ? options.fps
      : 60;
  const preSec =
    typeof options.preSettleSeconds === 'number' &&
    Number.isFinite(options.preSettleSeconds)
      ? Math.max(0, options.preSettleSeconds)
      : 0.7;
  const preFrames = Math.round(preSec * fps);
  const defaultPostSec = options.isFinalScene ? 2.4 : 1.6;
  const postSec =
    typeof options.postHoldSeconds === 'number' &&
    Number.isFinite(options.postHoldSeconds)
      ? Math.max(0, options.postHoldSeconds)
      : defaultPostSec;
  const postFrames = Math.round(postSec * fps);
  const safeVoSec =
    typeof voiceoverDurationSeconds === 'number' &&
    Number.isFinite(voiceoverDurationSeconds)
      ? Math.max(0, voiceoverDurationSeconds)
      : 0;
  const voFrames =
    safeVoSec <= 0 ? 0 : Math.ceil(Math.max(0, safeVoSec * fps - 1e-9));
  const minSec =
    typeof options.minDurationSeconds === 'number' &&
    Number.isFinite(options.minDurationSeconds)
      ? Math.max(0, options.minDurationSeconds)
      : 4.5;
  const minFrames = Math.round(minSec * fps);

  const rawTotal = preFrames + voFrames + postFrames;
  const durationInFrames = Math.max(minFrames, rawTotal);

  return {
    voiceoverStartFrame: preFrames,
    voiceoverDurationFrames: voFrames,
    voiceoverEndFrame: preFrames + voFrames,
    postHoldFrames: durationInFrames - (preFrames + voFrames),
    durationInFrames,
  };
}

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
