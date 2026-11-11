import type { VoiceAcousticPreset } from '../types/scene';

export type { VoiceAcousticPreset };

/**
 * Declarative ffmpeg `-af` filter chains for character and scene voice acoustics.
 * Every preset preserves a 250ms silent tail (`apad=pad_dur=0.25`) so word endings
 * never clip during playback or MP4 stitching.
 */
export const VOICE_ACOUSTIC_FILTERS: Record<VoiceAcousticPreset, string> = {
  clean: 'apad=pad_dur=0.25',
  telephone:
    'highpass=f=340,lowpass=f=3200,acompressor=threshold=-16dB:ratio=3.5:attack=5:release=60,volume=1.18,apad=pad_dur=0.25',
  'radio-walkie':
    'highpass=f=480,lowpass=f=2700,acrusher=bits=10:mix=0.28,acompressor=threshold=-18dB:ratio=4:attack=4:release=50,volume=1.22,apad=pad_dur=0.25',
  cathedral:
    'highpass=f=140,aecho=0.82:0.78:48|96:0.32|0.18,lowpass=f=7800,volume=1.08,apad=pad_dur=0.25',
  megaphone:
    'highpass=f=230,lowpass=f=3100,aecho=0.85:0.75:16:0.22,volume=1.15,apad=pad_dur=0.25',
  'excitement-boost':
    'highpass=f=85,treble=g=2.0:f=4200,volume=1.32,alimiter=limit=0.96,apad=pad_dur=0.25',
};

export const VOICE_ACOUSTIC_PRESET_NAMES = Object.keys(
  VOICE_ACOUSTIC_FILTERS
) as VoiceAcousticPreset[];

export function isVoiceAcousticPreset(
  value: unknown
): value is VoiceAcousticPreset {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(VOICE_ACOUSTIC_FILTERS, value)
  );
}

/**
 * Resolves a declarative `VoiceAcousticPreset` name to an `ffmpeg -af` filter string.
 * Defaults safely to `'clean'` (`apad=pad_dur=0.25`).
 */
export function getVoiceAcousticFilter(preset?: VoiceAcousticPreset): string {
  if (!preset || !isVoiceAcousticPreset(preset)) {
    return VOICE_ACOUSTIC_FILTERS.clean;
  }
  return VOICE_ACOUSTIC_FILTERS[preset];
}
