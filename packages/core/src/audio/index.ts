export {
  VOICE_ACOUSTIC_FILTERS,
  VOICE_ACOUSTIC_PRESET_NAMES,
  getVoiceAcousticFilter,
  isVoiceAcousticPreset,
  type VoiceAcousticPreset,
} from './acousticPresets';

export {
  SmartMusicBed,
  computeMusicBedVolumeAtFrame,
  computeSpeechDuckingEnvelopeAtFrame,
  useMusicBeatPulse,
  type DialogueDuckingSegment,
  type MusicBeatPulseOptions,
  type SmartMusicBedProps,
} from './SmartMusicBed';

export {
  DEFAULT_SOUND_CUE_MAX_SECONDS,
  SOUND_CUE_TAIL_PADDING_SECONDS,
  SoundCue,
  resolveSoundCueDurationInFrames,
  resolveSoundCueFrame,
  type ResolveSoundCueDurationParams,
  type SoundCueAtFrameProps,
  type SoundCueCommonProps,
  type SoundCueProps,
  type SoundCueWordSyncProps,
} from './SoundCue';

export {
  VOICEOVER_TAIL_PADDING_SECONDS,
  VoiceoverTrack,
  resolveVoiceoverDurationInFrames,
  type ResolveVoiceoverDurationParams,
  type VoiceoverTrackProps,
} from './VoiceoverTrack';

export {
  CURATED_VOICES,
  DEFAULT_ELEVENLABS_MODEL_ID,
  DEFAULT_VOICE_ID_BY_LANG,
  ELEVENLABS_TTS_MODELS,
  KNOWN_ENGLISH_PREMADE_VOICES,
  VOICE_ARCHETYPE_TO_ELEVENLABS_ID_BY_LANG,
  findCuratedVoiceById,
  getCuratedVoices,
  getDefaultVoiceIdForArchetype,
  getDefaultVoiceIdForLang,
  getKnownEnglishVoiceName,
  getRecommendedVoiceSettings,
  isKnownEnglishPremadeVoice,
  normalizeVoiceLang,
  supportsLanguageCodeParam,
  type CuratedVoiceProfile,
  type ElevenLabsModelInfo,
  type VoiceGender,
  type VoiceLanguage,
} from './voices';
