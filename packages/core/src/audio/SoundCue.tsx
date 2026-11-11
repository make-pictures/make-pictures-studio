import React from 'react';
import { Audio, Sequence } from 'remotion';
import type { SceneVoiceoverData } from '../types/scene';
import { getWordTriggerFrame } from '../utils/timestamps';

export interface SoundCueCommonProps {
  src: string;
  volume?: number;
  playbackRate?: number;
  durationInFrames?: number;
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

/**
 * Declarative Foley & SFX component supporting either explicit `atFrame` timing
 * or automatic word-level synchronization (`sceneId` + `onWord`).
 * Uses `layout="none"` so it can be mounted safely inside both 2D HTML trees and 3D stages.
 */
export const SoundCue: React.FC<SoundCueProps> = (props) => {
  const {
    src,
    volume = 0.4,
    playbackRate = 1,
    durationInFrames,
  } = props;

  if (!src) {
    return null;
  }

  const resolvedFrame = resolveSoundCueFrame(props);

  return (
    <Sequence
      from={resolvedFrame}
      durationInFrames={durationInFrames}
      layout="none"
    >
      <Audio src={src} volume={volume} playbackRate={playbackRate} />
    </Sequence>
  );
};
