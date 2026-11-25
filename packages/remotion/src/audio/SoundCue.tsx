import React from 'react';
import { Audio, Sequence, useVideoConfig } from 'remotion';
import type { SceneVoiceoverData } from '../types/scene';
import { getWordTriggerFrame } from '../utils/timestamps';

/**
 * Default finite lifetime (in seconds) for one-shot `<SoundCue />` instances when
 * neither `durationInFrames` nor `durationSeconds` is explicitly passed.
 * Ensures finished SFX unmount cleanly and release `<Html5Audio />` pool slots in `@remotion/player`.
 */
export const DEFAULT_SOUND_CUE_MAX_SECONDS = 6;

/**
 * Extra acoustic tail buffer (in seconds) added on top of `durationSeconds`
 * so reverb tails never clip before the enclosing `<Sequence>` unmounts.
 */
export const SOUND_CUE_TAIL_PADDING_SECONDS = 0.35;

export interface SoundCueCommonProps {
  src: string;
  volume?: number;
  playbackRate?: number;
  durationInFrames?: number;
  durationSeconds?: number;
  loop?: boolean;
  offsetFrames?: number;
}

export interface SoundCueAtFrameProps extends SoundCueCommonProps {
  atFrame: number;
  sceneId?: undefined;
  onWord?: undefined;
  sceneStartFrame?: undefined;
  fallbackFrame?: undefined;
  voiceoverManifest?: undefined;
}

export interface SoundCueWordSyncProps extends SoundCueCommonProps {
  atFrame?: undefined;
  sceneId: string;
  onWord: string;
  sceneStartFrame?: number;
  fallbackFrame?: number;
  voiceoverManifest?: Record<string, SceneVoiceoverData>;
}

export type SoundCueProps = SoundCueAtFrameProps | SoundCueWordSyncProps;

/**
 * Resolves the exact composition frame (`>= 0`) at which a `<SoundCue />` fires.
 */
export function resolveSoundCueFrame(props: SoundCueProps): number {
  const offset = props.offsetFrames ?? 0;

  if (typeof props.atFrame === 'number') {
    return Math.max(0, Math.round(props.atFrame + offset));
  }

  const sceneStart = props.sceneStartFrame ?? 0;
  const fallback = props.fallbackFrame ?? 0;
  const localWordFrame = getWordTriggerFrame(
    props.sceneId,
    props.onWord,
    fallback,
    props.voiceoverManifest
  );

  return Math.max(0, Math.round(sceneStart + localWordFrame + offset));
}

export interface ResolveSoundCueDurationParams {
  resolvedFrame: number;
  compositionDurationInFrames: number;
  fps: number;
  durationInFrames?: number;
  durationSeconds?: number;
  playbackRate?: number;
  loop?: boolean;
}

/**
 * Computes a guaranteed-finite `<Sequence>` duration (in frames) for `<SoundCue />`
 * so one-shot Foley cues release their `@remotion/player` shared `<Html5Audio />` tag
 * once finished instead of staying mounted until the end of the film.
 */
export function resolveSoundCueDurationInFrames(
  params: ResolveSoundCueDurationParams
): number {
  const {
    resolvedFrame,
    compositionDurationInFrames,
    fps,
    durationInFrames,
    durationSeconds,
    playbackRate = 1,
    loop = false,
  } = params;

  const safeStart = Math.max(0, Math.round(resolvedFrame));
  if (safeStart >= compositionDurationInFrames) {
    return 0;
  }

  const remaining = Math.max(1, compositionDurationInFrames - safeStart);
  const safeFps = fps > 0 ? fps : 60;
  const safeRate = playbackRate > 0 ? playbackRate : 1;

  if (typeof durationInFrames === 'number' && Number.isFinite(durationInFrames) && durationInFrames > 0) {
    return Math.max(1, Math.min(remaining, Math.round(durationInFrames)));
  }

  if (loop) {
    return remaining;
  }

  if (typeof durationSeconds === 'number' && Number.isFinite(durationSeconds) && durationSeconds > 0) {
    const paddedFrames = Math.ceil(
      (durationSeconds / safeRate + SOUND_CUE_TAIL_PADDING_SECONDS) * safeFps
    );
    return Math.max(1, Math.min(remaining, paddedFrames));
  }

  const defaultWindowFrames = Math.ceil(DEFAULT_SOUND_CUE_MAX_SECONDS * safeFps);
  return Math.max(1, Math.min(remaining, defaultWindowFrames));
}

/**
 * Declarative Foley & SFX component supporting either explicit `atFrame` timing
 * or automatic word-level synchronization (`sceneId` + `onWord`).
 * Automatically unmounts after playback so `@remotion/player` shared audio tags never leak.
 */
export const SoundCue: React.FC<SoundCueProps> = (props) => {
  const {
    src,
    volume = 0.4,
    playbackRate = 1,
    durationInFrames,
    durationSeconds,
    loop = false,
  } = props;
  const { durationInFrames: compositionDurationInFrames, fps } = useVideoConfig();

  if (!src) {
    return null;
  }

  const resolvedFrame = resolveSoundCueFrame(props);
  const resolvedDuration = resolveSoundCueDurationInFrames({
    resolvedFrame,
    compositionDurationInFrames,
    fps,
    durationInFrames,
    durationSeconds,
    playbackRate,
    loop,
  });

  if (resolvedDuration <= 0) {
    return null;
  }

  return (
    <Sequence
      from={resolvedFrame}
      durationInFrames={resolvedDuration}
      layout="none"
    >
      <Audio
        src={src}
        volume={volume}
        playbackRate={playbackRate}
        loop={loop}
      />
    </Sequence>
  );
};
