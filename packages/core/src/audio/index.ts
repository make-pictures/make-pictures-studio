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
  SoundCue,
  resolveSoundCueFrame,
  type SoundCueAtFrameProps,
  type SoundCueCommonProps,
  type SoundCueProps,
  type SoundCueWordSyncProps,
} from './SoundCue';
