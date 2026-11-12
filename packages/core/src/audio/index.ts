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
