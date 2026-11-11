import { interpolate, spring } from 'remotion';
import type { SceneVoiceoverData } from '../types/scene';
import { SPRING_PRESETS } from '../theme/tokens';
import { getSceneVoiceover } from './timestamps';

/**
 * Computes a smooth 0..1 pose weight that eases in at `startFrame` and eases out at `endFrame`
 * using `SPRING_PRESETS.calmPose` (~0.75s transition at 60 FPS) so 3D character poses never snap.
 */
export function getSmoothPoseWindow(
  frame: number,
  fps: number,
  startFrame: number,
  endFrame?: number
): number {
  const enter = spring({
    frame: frame - startFrame,
    fps,
    config: SPRING_PRESETS.calmPose,
  });
  if (endFrame === undefined) {
    return enter;
  }
  const exit = spring({
    frame: frame - endFrame,
    fps,
    config: SPRING_PRESETS.calmPose,
  });
  return Math.max(0, enter - exit);
}

export interface SpeechState {
  /** True while the character is in the middle of their dialogue turn */
  isSpeaking: boolean;
  /**
   * Smooth turn-level weight (0..1) that eases in at the start of a sentence,
   * stays steady at 1.0 across inter-word micro-pauses, and eases out at the end.
   * Use this for body posture, aura glow, and speaker card activation.
   */
  speakingWeight: number;
  /**
   * Low-pass smoothed syllable energy (0..1) for visor mouth bars and audio meters.
   */
  energy: number;
  currentWord: string | null;
  wordIndex: number;
}

function rawWordEnergyAtFrame(
  words: { word: string; startFrame: number; endFrame: number }[],
  localFrame: number
): { rawEnergy: number; currentWord: string | null; wordIndex: number } {
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (localFrame >= w.startFrame && localFrame <= w.endFrame) {
      const duration = Math.max(1, w.endFrame - w.startFrame);
      const progress = (localFrame - w.startFrame) / duration;
      const envelope = Math.sin(progress * Math.PI);
      const syllableWave = 0.72 + 0.28 * Math.sin(localFrame * 0.22 + i * 1.1);
      return {
        rawEnergy: Math.min(1, envelope * syllableWave),
        currentWord: w.word,
        wordIndex: i,
      };
    }
  }
  return { rawEnergy: 0, currentWord: null, wordIndex: -1 };
}

/**
 * Computes calm, low-pass smoothed speech state and continuous turn-level weight
 * for a character's dialogue line at a given local frame.
 */
export function getSpeechStateAtFrame(
  sceneId: string,
  localFrame: number,
  manifest?: Record<string, SceneVoiceoverData>
): SpeechState {
  const data = getSceneVoiceover(sceneId, manifest);
  if (!data || data.words.length === 0 || localFrame < -20) {
    return {
      isSpeaking: false,
      speakingWeight: 0,
      energy: 0,
      currentWord: null,
      wordIndex: -1,
    };
  }

  const firstStart = data.words[0].startFrame;
  const lastEnd = data.words[data.words.length - 1].endFrame;

  // Continuous turn-level envelope (eases in over 22 frames, stays 1.0 across the sentence, eases out over 26 frames)
  const fadeIn = interpolate(
    localFrame,
    [firstStart - 14, firstStart + 8],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const fadeOut = interpolate(
    localFrame,
    [lastEnd - 6, lastEnd + 20],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  // Smoothstep easing for organic transition
  const rawTurnWeight = fadeIn * fadeOut;
  const speakingWeight =
    rawTurnWeight * rawTurnWeight * (3 - 2 * rawTurnWeight);

  // 7-tap moving average low-pass filter on word energy to eliminate micro-jitter
  const offsets = [-6, -4, -2, 0, 2, 4, 6];
  const weights = [0.08, 0.14, 0.2, 0.26, 0.2, 0.14, 0.08];
  let smoothedEnergy = 0;
  for (let k = 0; k < offsets.length; k++) {
    const sample = rawWordEnergyAtFrame(data.words, localFrame + offsets[k]);
    smoothedEnergy += sample.rawEnergy * weights[k];
  }

  const centerSample = rawWordEnergyAtFrame(data.words, localFrame);
  const finalEnergy = Math.min(
    1,
    Math.max(smoothedEnergy, speakingWeight * 0.16)
  );

  return {
    isSpeaking: speakingWeight > 0.02,
    speakingWeight,
    energy: finalEnergy * speakingWeight,
    currentWord: centerSample.currentWord,
    wordIndex: centerSample.wordIndex,
  };
}
