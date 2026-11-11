import React, { useCallback } from 'react';
import { useAudioData, visualizeAudio } from '@remotion/media-utils';
import {
  Audio,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { getSceneVoiceover } from '../utils/timestamps';
import type { SceneVoiceoverData } from '../types/scene';

export interface DialogueDuckingSegment {
  sceneId: string;
  fromFrame: number;
  durationInFrames: number;
}

export interface SmartMusicBedProps {
  src: string;
  dialogueSegments?: DialogueDuckingSegment[];
  voiceoverManifest?: Record<string, SceneVoiceoverData>;
  baseVolume?: number;
  duckedVolume?: number;
  lookaheadFrames?: number;
  releaseFrames?: number;
  fadeInFrames?: number;
  fadeOutFrames?: number;
  loop?: boolean;
}

export interface MusicBeatPulseOptions {
  lowBinCount?: number;
  smoothingFrames?: number;
}

// Minimal 46-byte silent 16-bit PCM WAV so `useAudioData` stays hook-order safe when `audioSrc` is null
const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAAAAA==';

function smoothstep01(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

interface FrameSpan {
  start: number;
  end: number;
}

/**
 * Merges consecutive words in a scene into continuous phrase spans so inter-word
 * micro-pauses stay steadily ducked while genuine pauses (> ~0.8s) let the score breathe up.
 */
function buildPhraseSpansForSegment(
  segment: DialogueDuckingSegment,
  manifest: Record<string, SceneVoiceoverData> | undefined,
  mergeGapFrames: number
): FrameSpan[] {
  const vo = getSceneVoiceover(segment.sceneId, manifest);
  const segStart = segment.fromFrame;
  const segEnd = segment.fromFrame + Math.max(1, segment.durationInFrames);

  if (!vo || !Array.isArray(vo.words) || vo.words.length === 0) {
    return [{ start: segStart, end: segEnd }];
  }

  const spans: FrameSpan[] = [];
  for (const word of vo.words) {
    const absStart = segStart + word.startFrame;
    const absEnd = Math.min(segEnd + 18, segStart + Math.max(word.startFrame + 2, word.endFrame));
    const prev = spans[spans.length - 1];
    if (prev && absStart - prev.end <= mergeGapFrames) {
      prev.end = Math.max(prev.end, absEnd);
    } else {
      spans.push({ start: absStart, end: absEnd });
    }
  }

  return spans;
}

/**
 * Computes the continuous speech ducking weight in `0..1` (`0` = no speech / full music,
 * `1` = active speech / ducked music) at `frame`, with smooth lookahead and release ramps.
 */
export function computeSpeechDuckingEnvelopeAtFrame(params: {
  frame: number;
  dialogueSegments?: DialogueDuckingSegment[];
  voiceoverManifest?: Record<string, SceneVoiceoverData>;
  lookaheadFrames?: number;
  releaseFrames?: number;
}): number {
  const {
    frame,
    dialogueSegments = [],
    voiceoverManifest,
    lookaheadFrames = 12,
    releaseFrames = 28,
  } = params;

  if (dialogueSegments.length === 0) {
    return 0;
  }

  const attack = Math.max(1, lookaheadFrames);
  const release = Math.max(1, releaseFrames);
  const mergeGap = attack + release + 10;

  let maxWeight = 0;

  for (const seg of dialogueSegments) {
    const spans = buildPhraseSpansForSegment(seg, voiceoverManifest, mergeGap);
    for (const span of spans) {
      const rampIn = interpolate(
        frame,
        [span.start - attack, span.start + 4],
        [0, 1],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      const rampOut = interpolate(
        frame,
        [span.end - 2, span.end + release],
        [1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      const weight = smoothstep01(rampIn) * smoothstep01(rampOut);
      if (weight > maxWeight) {
        maxWeight = weight;
      }
    }
  }

  return maxWeight;
}

/**
 * Computes the final music bed volume at `frame` combining intro/outro master fades
 * and smooth sidechain speech ducking.
 */
export function computeMusicBedVolumeAtFrame(params: {
  frame: number;
  durationInFrames: number;
  dialogueSegments?: DialogueDuckingSegment[];
  voiceoverManifest?: Record<string, SceneVoiceoverData>;
  baseVolume?: number;
  duckedVolume?: number;
  lookaheadFrames?: number;
  releaseFrames?: number;
  fadeInFrames?: number;
  fadeOutFrames?: number;
}): number {
  const {
    frame,
    durationInFrames,
    dialogueSegments = [],
    voiceoverManifest,
    baseVolume = 0.26,
    duckedVolume = 0.085,
    lookaheadFrames = 12,
    releaseFrames = 28,
    fadeInFrames = 30,
    fadeOutFrames = 45,
  } = params;

  const duckWeight = computeSpeechDuckingEnvelopeAtFrame({
    frame,
    dialogueSegments,
    voiceoverManifest,
    lookaheadFrames,
    releaseFrames,
  });

  const duckedGain = baseVolume + (duckedVolume - baseVolume) * duckWeight;

  const rawFadeIn =
    fadeInFrames > 0
      ? interpolate(frame, [0, fadeInFrames], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1;

  const fadeOutStart = Math.max(0, durationInFrames - Math.max(0, fadeOutFrames));
  const rawFadeOut =
    fadeOutFrames > 0
      ? interpolate(frame, [fadeOutStart, durationInFrames], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1;

  const masterEnvelope = smoothstep01(rawFadeIn) * smoothstep01(rawFadeOut);
  return Math.max(0, Number((duckedGain * masterEnvelope).toFixed(5)));
}

/**
 * Broadcast-grade background music component with lookahead sidechain auto-ducking.
 * Breathes up in intros, scene transitions, and pauses while ducking smoothly under dialogue.
 */
export const SmartMusicBed: React.FC<SmartMusicBedProps> = ({
  src,
  dialogueSegments = [],
  voiceoverManifest,
  baseVolume = 0.26,
  duckedVolume = 0.085,
  lookaheadFrames = 12,
  releaseFrames = 28,
  fadeInFrames = 30,
  fadeOutFrames = 45,
  loop = true,
}) => {
  const { durationInFrames } = useVideoConfig();

  const volumeAtFrame = useCallback(
    (f: number) =>
      computeMusicBedVolumeAtFrame({
        frame: f,
        durationInFrames,
        dialogueSegments,
        voiceoverManifest,
        baseVolume,
        duckedVolume,
        lookaheadFrames,
        releaseFrames,
        fadeInFrames,
        fadeOutFrames,
      }),
    [
      durationInFrames,
      dialogueSegments,
      voiceoverManifest,
      baseVolume,
      duckedVolume,
      lookaheadFrames,
      releaseFrames,
      fadeInFrames,
      fadeOutFrames,
    ]
  );

  if (!src) {
    return null;
  }

  return (
    <Sequence from={0} durationInFrames={durationInFrames} layout="none">
      <Audio
        src={src}
        loop={loop}
        loopVolumeCurveBehavior="extend"
        volume={volumeAtFrame}
      />
    </Sequence>
  );
};

/**
 * Extracts a smooth, normalized `0..1` low-frequency kick/bass transient pulse from `audioSrc`
 * using `@remotion/media-utils` (`useAudioData` + `visualizeAudio`).
 * Safely returns `0` when `audioSrc` is `null`, empty, or still loading.
 */
export function useMusicBeatPulse(
  audioSrc: string | null,
  options?: MusicBeatPulseOptions
): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hasSource = Boolean(audioSrc && audioSrc.trim().length > 0);
  const audioData = useAudioData(hasSource ? audioSrc! : SILENT_WAV_DATA_URI);

  if (!hasSource || !audioData) {
    return 0;
  }

  const totalAudioFrames = Math.max(
    1,
    Math.floor(audioData.durationInSeconds * fps)
  );
  const binCount = Math.max(1, Math.min(16, options?.lowBinCount ?? 4));
  const windowSize = Math.max(1, Math.min(9, options?.smoothingFrames ?? 3));
  const halfWindow = Math.floor(windowSize / 2);

  let energySum = 0;
  let sampleCount = 0;

  for (let offset = -halfWindow; offset <= halfWindow; offset++) {
    const wrappedFrame =
      (((frame + offset) % totalAudioFrames) + totalAudioFrames) %
      totalAudioFrames;
    const spectrum = visualizeAudio({
      audioData,
      frame: wrappedFrame,
      fps,
      numberOfSamples: 32,
      smoothing: true,
    });
    let frameBass = 0;
    for (let b = 0; b < binCount; b++) {
      frameBass += spectrum[b] ?? 0;
    }
    energySum += frameBass / binCount;
    sampleCount += 1;
  }

  const avgBass = sampleCount > 0 ? energySum / sampleCount : 0;
  // Shape subtle bass energy into a responsive 0..1 visual pulse without clipping
  return Math.max(0, Math.min(1, Math.pow(avgBass * 2.4, 1.15)));
}
