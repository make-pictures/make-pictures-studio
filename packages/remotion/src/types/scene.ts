export const BUILTIN_VISUAL_KIT_IDS = [
  'editorial-collage',
  'vector-scene-2d',
  'motion-diagrams-2d',
  'kinetic-typography',
  'data-storytelling',
  'product-frames',
  'vfx',
  'paper-diorama-3d',
  'isometric-3d',
  'tactile-3d',
] as const;

export type BuiltinVisualKitId = (typeof BUILTIN_VISUAL_KIT_IDS)[number];

export type VisualKitId = BuiltinVisualKitId | (string & {});

export interface CompositionSubViewSegment {
  id?: string;
  /** Offset of the sub-view start relative to `scene.fromFrame` (in frames) */
  fromOffsetFrames: number;
  label?: string;
}

export interface CompositionSceneSegment {
  sceneId: string;
  fromFrame: number;
  durationInFrames: number;
  label?: string;
  subViews?: CompositionSubViewSegment[];
}

export function isVerticalComposition(comp: {
  width: number;
  height: number;
}): boolean {
  return comp.height > comp.width;
}

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

export interface DialogueInputTurn {
  text: string;
  voiceId: string;
  speaker?: string;
}

export interface DialogueVoiceSegment {
  voiceId: string;
  speaker?: string;
  dialogueInputIndex: number;
  startTimeSeconds: number;
  endTimeSeconds: number;
  characterStartIndex?: number;
  characterEndIndex?: number;
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
  voiceSegments?: DialogueVoiceSegment[];
}

export interface VoiceSettingsConfig {
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speed?: number;
  useSpeakerBoost?: boolean;
}

export interface AudioSceneSpec {
  id: string;
  title?: string;
  durationInSeconds?: number;
  durationInFrames?: number;
  text: string;
  dialogueInputs?: DialogueInputTurn[];
  voiceId?: string;
  modelId?: string;
  languageCode?: string;
  speaker?: string;
  voiceSettings?: VoiceSettingsConfig;
  acousticPreset?: VoiceAcousticPreset;
  voiceEffect?: VoiceAcousticPreset;
  previousText?: string;
  nextText?: string;
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

export interface AudioManifestFile {
  id: string;
  title?: string;
  fps?: number;
  lang?: 'pl' | 'en';
  voiceId?: string;
  modelId?: string;
  languageCode?: string;
  voiceSettings?: VoiceSettingsConfig;
  scenes: AudioSceneSpec[];
  sfx?: SfxAssetSpec[];
  score?: MusicScoreSpec;
}
