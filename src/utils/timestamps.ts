import { VOICEOVER_MANIFEST } from '../generated/voiceover-data';
import type { SceneVoiceoverData, WordTimestamp } from '../types/scene';

/**
 * Retrieves the voiceover data for a scene by ID.
 */
export function getSceneVoiceover(
  sceneId: string
): SceneVoiceoverData | undefined {
  return VOICEOVER_MANIFEST[sceneId];
}

/**
 * Finds the first word matching a substring or exact normalized token
 * and returns its startFrame (or fallbackFrame if not found).
 */
export function getWordTriggerFrame(
  sceneId: string,
  targetWord: string,
  fallbackFrame: number
): number {
  const voiceover = VOICEOVER_MANIFEST[sceneId];
  if (!voiceover || !voiceover.words.length) {
    return fallbackFrame;
  }

  const needle = targetWord
    .replace(/^[.,!?;:"'()[\]{}—–-]+|[.,!?;:"'()[\]{}—–-]+$/g, '')
    .toLowerCase();

  const exactMatch = voiceover.words.find((w) => w.normalizedWord === needle);
  if (exactMatch) {
    return exactMatch.startFrame;
  }

  const partialMatch = voiceover.words.find((w) =>
    w.normalizedWord.includes(needle)
  );
  return partialMatch ? partialMatch.startFrame : fallbackFrame;
}

/**
 * Returns the word currently being spoken at a given frame, along with word index.
 */
export function getActiveWordAtFrame(
  sceneId: string,
  frame: number
): { word: WordTimestamp; index: number } | null {
  const voiceover = VOICEOVER_MANIFEST[sceneId];
  if (!voiceover) return null;

  for (let i = 0; i < voiceover.words.length; i++) {
    const w = voiceover.words[i];
    if (frame >= w.startFrame && frame <= w.endFrame + 6) {
      return { word: w, index: i };
    }
  }
  return null;
}
