import React from 'react';
import { Audio, Sequence, staticFile, useVideoConfig } from 'remotion';
import type { SceneVoiceoverData } from '../types/scene';

/**
 * Default extra tail padding (in seconds) added to `durationInSeconds` on `<VoiceoverTrack />`
 * so the `250 ms` FFmpeg `apad` consonant tail never gets clipped before unmounting.
 */
export const VOICEOVER_TAIL_PADDING_SECONDS = 0.35;

export interface VoiceoverTrackProps {
  /** Scene voiceover record from `VOICEOVER_MANIFEST[sceneId]`. */
  voiceover?: Pick<SceneVoiceoverData, 'audioFile' | 'durationInSeconds'> | null;
  /** Optional explicit audio URL (overrides `staticFile(voiceover.audioFile)`). */
  src?: string;
  /** Composition frame at which narration begins (`default: 0`). */
  fromFrame?: number;
  /** Explicit duration in frames (overrides `durationInSeconds` calculation). */
  durationInFrames?: number;
  /** Explicit duration in seconds (fallback when passing `src` without `voiceover`). */
  durationInSeconds?: number;
  /** Extra padding in seconds before unmounting (`default: 0.35`). */
  tailPaddingSeconds?: number;
  /** Linear volume multiplier (`default: 1`). */
  volume?: number;
  /** Playback rate (`default: 1`). */
  playbackRate?: number;
}

export interface ResolveVoiceoverDurationParams {
  fromFrame: number;
  compositionDurationInFrames: number;
  fps: number;
  durationInFrames?: number;
  durationInSeconds?: number;
  playbackRate?: number;
  tailPaddingSeconds?: number;
}

/**
 * Computes a guaranteed-finite `<Sequence>` duration (in frames) for a scene voiceover
 * so narration tracks unmount cleanly after finishing and release `@remotion/player` audio slots.
 */
export function resolveVoiceoverDurationInFrames(
  params: ResolveVoiceoverDurationParams
): number {
  const {
    fromFrame,
    compositionDurationInFrames,
    fps,
    durationInFrames,
    durationInSeconds,
    playbackRate = 1,
    tailPaddingSeconds = VOICEOVER_TAIL_PADDING_SECONDS,
  } = params;

  const safeStart = Math.max(0, Math.round(fromFrame));
  if (safeStart >= compositionDurationInFrames) {
    return 0;
  }

  const remaining = Math.max(1, compositionDurationInFrames - safeStart);
  const safeFps = fps > 0 ? fps : 60;
  const safeRate = playbackRate > 0 ? playbackRate : 1;

  if (
    typeof durationInFrames === 'number' &&
    Number.isFinite(durationInFrames) &&
    durationInFrames > 0
  ) {
    return Math.max(1, Math.min(remaining, Math.round(durationInFrames)));
  }

  if (
    typeof durationInSeconds === 'number' &&
    Number.isFinite(durationInSeconds) &&
    durationInSeconds > 0
  ) {
    const padded = Math.ceil(
      (durationInSeconds / safeRate + Math.max(0, tailPaddingSeconds)) * safeFps
    );
    return Math.max(1, Math.min(remaining, padded));
  }

  return remaining;
}

function resolveVoiceoverAudioSrc(
  explicitSrc?: string,
  voiceoverFile?: string
): string | null {
  const raw = (explicitSrc ?? voiceoverFile ?? '').trim();
  if (!raw) {
    return null;
  }
  if (
    raw.startsWith('http://') ||
    raw.startsWith('https://') ||
    raw.startsWith('data:') ||
    raw.startsWith('blob:') ||
    raw.startsWith('/')
  ) {
    return raw;
  }
  return staticFile(raw.replace(/^\/+/, ''));
}

/**
 * Bounded scene narration component that automatically unmounts after `voiceover.durationInSeconds`
 * (`+ 0.35s` consonant safety tail), preventing `<Html5Audio />` pool exhaustion in multi-scene films.
 */
export const VoiceoverTrack: React.FC<VoiceoverTrackProps> = ({
  voiceover,
  src,
  fromFrame = 0,
  durationInFrames,
  durationInSeconds,
  tailPaddingSeconds = VOICEOVER_TAIL_PADDING_SECONDS,
  volume = 1,
  playbackRate = 1,
}) => {
  const { durationInFrames: compositionDurationInFrames, fps } = useVideoConfig();

  const resolvedSrc = resolveVoiceoverAudioSrc(src, voiceover?.audioFile);
  if (!resolvedSrc) {
    return null;
  }

  const clampedStart = Math.max(0, Math.round(fromFrame));
  const resolvedDuration = resolveVoiceoverDurationInFrames({
    fromFrame: clampedStart,
    compositionDurationInFrames,
    fps,
    durationInFrames,
    durationInSeconds: durationInSeconds ?? voiceover?.durationInSeconds,
    playbackRate,
    tailPaddingSeconds,
  });

  if (resolvedDuration <= 0) {
    return null;
  }

  return (
    <Sequence
      from={clampedStart}
      durationInFrames={resolvedDuration}
      layout="none"
    >
      <Audio
        src={resolvedSrc}
        volume={volume}
        playbackRate={playbackRate}
        loop={false}
      />
    </Sequence>
  );
};
