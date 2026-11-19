import type {
  ElevenLabsModelInfo,
  SceneDefinition,
  VoiceAcousticPreset,
  VoiceSettingsConfig,
} from '@make-pictures/core';

export type InspectorTabId = 'params' | 'script' | 'json';

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

export interface StudioCapsuleScenesGroup {
  id: string;
  title: string;
  origin: 'root' | 'production';
  manifestFile: string;
  fps: number;
  lang?: 'pl' | 'en';
  scenes: SceneDefinition[];
}

export interface StudioVoiceItem {
  voiceId: string;
  name: string;
  source: 'curated' | 'account' | 'shared';
  language?: string;
  gender?: string;
  role?: string;
  useCase?: string;
  category?: string;
  description?: string;
  previewUrl?: string;
  freeUsersAllowed?: boolean;
  recommendedSettings?: VoiceSettingsConfig;
}

export interface StudioVoicesResponse {
  ok: boolean;
  configured: boolean;
  lang: string;
  gender?: string;
  query?: string;
  recommended: StudioVoiceItem[];
  account: StudioVoiceItem[];
  shared: StudioVoiceItem[];
  models: ElevenLabsModelInfo[];
  warning?: string;
}

export interface StudioScenesResponse {
  ok: boolean;
  hasApiKey: boolean;
  groups: StudioCapsuleScenesGroup[];
  audioStatus: Record<string, SceneAudioStatusItem>;
}

export interface StudioScenePatch {
  text?: string;
  title?: string;
  speaker?: string;
  voiceId?: string;
  modelId?: string;
  languageCode?: string;
  durationInSeconds?: number;
  voiceEffect?: VoiceAcousticPreset;
  voiceSettings?: VoiceSettingsConfig;
}

export interface SaveStudioScenePayload {
  targetId: string;
  sceneId: string;
  patch: StudioScenePatch;
}
