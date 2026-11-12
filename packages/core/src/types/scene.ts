export type VoiceAcousticPreset =
  | 'clean'
  | 'telephone'
  | 'radio-walkie'
  | 'cathedral'
  | 'megaphone'
  | 'excitement-boost';

export type SfxFallbackPreset =
  | 'whoosh'
  | 'pop'
  | 'click'
  | 'chime'
  | 'wind'
  | 'impact'
  | 'ambient-hum';

export type MusicMoodPreset =
  | 'ambient-tech'
  | 'warm-story'
  | 'news-pulse'
  | 'cinematic-drone'
  | 'cinematic-epic'
  | 'paper-expedition'
  | 'upbeat-launch';

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
  title?: string;
  component?: string;
  durationInSeconds: number;
  durationInFrames?: number;
  text: string;
  voiceId?: string;
  speaker?: string;
  voiceSettings?: VoiceSettingsConfig;
  voiceEffect?: VoiceAcousticPreset;
  previousText?: string;
  nextText?: string;
  recordingFile?: string;
  windowTitle?: string;
  triggerWords?: Record<string, string>;
  cues?: Record<string, number>;
}

export interface SfxAssetSpec {
  id: string;
  prompt: string;
  durationSeconds?: number;
  loop?: boolean;
  promptInfluence?: number;
  fallbackPreset?: SfxFallbackPreset;
  customFfmpegFilter?: string;
}

export interface ScoreSectionSpec {
  name: string;
  durationMs: number;
  positiveLocalStyles: string[];
  negativeLocalStyles?: string[];
}

export interface MusicScoreSpec {
  id: string;
  mode: 'prompt' | 'composition-plan' | 'procedural-fallback';
  prompt?: string;
  moodPreset?: MusicMoodPreset;
  forceInstrumental?: boolean;
  durationSeconds?: number;
  sections?: ScoreSectionSpec[];
  baseVolume?: number;
  duckedVolume?: number;
}

export interface ProductionSfxCue {
  sfxId: string;
  fromFrame: number;
  label?: string;
  volume?: number;
}

export interface ProductionCameraCut {
  shotLabel: string;
  fromFrame: number;
  durationInFrames: number;
}

export interface ProductionManifest {
  id: string;
  title: string;
  fps: number;
  scenes: SceneDefinition[];
  sfx?: SfxAssetSpec[];
  score?: MusicScoreSpec;
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
