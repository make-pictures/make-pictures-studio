export interface WordTimestamp {
  word: string;
  normalizedWord: string;
  start: number;
  end: number;
  startFrame: number;
  endFrame: number;
}

export interface CharacterAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export interface SceneVoiceoverData {
  sceneId: string;
  text: string;
  textHash: string;
  voiceId: string;
  modelId: string;
  provider: 'elevenlabs' | 'synthetic-fallback';
  fps: number;
  durationInSeconds: number;
  audioFile: string;
  generatedAt: string;
  words: WordTimestamp[];
  alignment?: CharacterAlignment;
}

export interface VoiceSettingsConfig {
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speed?: number;
  useSpeakerBoost?: boolean;
}

export interface SceneDefinition {
  id: string;
  title: string;
  component: string;
  durationInSeconds: number;
  durationInFrames: number;
  text: string;
  voiceId?: string;
  speaker?: string;
  voiceSettings?: VoiceSettingsConfig;
  recordingFile?: string;
  windowTitle?: string;
  triggerWords?: Record<string, string>;
  cues?: Record<string, number>;
}

export interface ScenesManifest {
  project: {
    title: string;
    fps: number;
    defaultResolution: {
      width: number;
      height: number;
    };
    uhdResolution: {
      width: number;
      height: number;
    };
  };
  scenes: SceneDefinition[];
}
