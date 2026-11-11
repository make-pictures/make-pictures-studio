import type { SceneVoiceoverData, WordTimestamp } from '../types/scene';

const REGISTERED_VOICEOVER_MANIFEST: Record<string, SceneVoiceoverData> = {};

/**
 * Registers additional scene voiceover records (e.g. from isolated `productions/<slug>` capsules
 * or root manifests) into the shared runtime lookup table used by Studio Web and helper utilities.
 */
export function registerVoiceoverManifest(
  manifest?: Record<string, SceneVoiceoverData> | null
): void {
  if (!manifest) return;
  for (const [sceneId, data] of Object.entries(manifest)) {
    if (data && typeof data === 'object') {
      REGISTERED_VOICEOVER_MANIFEST[sceneId] = data;
    }
  }
}

export function getRegisteredVoiceoverManifest(): Record<
  string,
  SceneVoiceoverData
> {
  return REGISTERED_VOICEOVER_MANIFEST;
}

/**
 * Retrieves the voiceover data for a scene by ID.
 */
export function getSceneVoiceover(
  sceneId: string,
  manifest?: Record<string, SceneVoiceoverData>
): SceneVoiceoverData | undefined {
  if (manifest && manifest[sceneId]) {
    return manifest[sceneId];
  }
  return REGISTERED_VOICEOVER_MANIFEST[sceneId];
}

/**
 * Finds the first word matching a substring or exact normalized token
 * and returns its startFrame (or fallbackFrame if not found).
 */
export function getWordTriggerFrame(
  sceneId: string,
  targetWord: string,
  fallbackFrame: number,
  manifest?: Record<string, SceneVoiceoverData>
): number {
  const voiceover = getSceneVoiceover(sceneId, manifest);
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
  frame: number,
  manifest?: Record<string, SceneVoiceoverData>
): { word: WordTimestamp; index: number } | null {
  const voiceover = getSceneVoiceover(sceneId, manifest);
  if (!voiceover) return null;

  for (let i = 0; i < voiceover.words.length; i++) {
    const w = voiceover.words[i];
    if (frame >= w.startFrame && frame <= w.endFrame + 6) {
      return { word: w, index: i };
    }
  }
  return null;
}
