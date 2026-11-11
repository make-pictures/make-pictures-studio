export interface OverlaySettings {
  goldenSafeBox: boolean;
  ruleOfThirds: boolean;
  safeMargins: boolean;
}

export interface SceneAudioStatusItem {
  sceneId: string;
  title: string;
  speaker?: string;
  mp3Exists: boolean;
  jsonExists: boolean;
  provider: 'elevenlabs' | 'synthetic-fallback' | 'missing';
  isHashCurrent: boolean;
  wordCount: number;
  durationInSeconds: number;
}

export interface StudioStatusResponse {
  hasApiKey: boolean;
  scenes: Record<string, SceneAudioStatusItem>;
}
