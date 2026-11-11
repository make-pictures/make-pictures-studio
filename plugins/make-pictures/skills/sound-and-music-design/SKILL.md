---
name: sound-and-music-design
description: >-
  Complete audio direction guide for make.pictures Studio: ElevenLabs voice
  profiles, Polish/English phonetic spelling rules, VoiceAcousticPreset filters,
  ElevenLabs Music score & compositionPlan sync, SmartMusicBed sidechain
  auto-ducking, useMusicBeatPulse, ElevenLabs Sound Effects, word-synced
  SoundCue foley, and -14 LUFS EBU R128 mastering. Use whenever writing scripts,
  configuring production.json audio, or placing music and SFX in compositions.
---

# Sound & Music Design (`@make-pictures/core` & `@make-pictures/cli`)

Design broadcast-ready, `-14 LUFS` mastered soundtracks combining word-aligned **ElevenLabs TTS**, **AI Music Scores** with lookahead sidechain auto-ducking, and **word-synced AI Sound Effects (Foley)**—all powered by a single `ELEVENLABS_API_KEY`.

---

## 1. ElevenLabs Voice Cast & Phonetic Spelling (`eleven_multilingual_v2`)

### Phonetic Spelling Rules in `production.json` / `scenes.json`
`eleven_multilingual_v2` can mispronounce raw uppercase acronyms or URLs in non-English scripts. Write phonetic spellings directly in `scene.text`:
- **Polish lettered acronyms:** Spell each letter separately with Polish phonetics (e.g., `e er p` instead of `ERP`, `a pe i` instead of `API`, `es ku el` instead of `SQL`).
- **Domain names & URLs:** Write spoken words (`mejk kropka pikczers` in PL, `make dot pictures` in EN).
- **Context continuity (`previousText` / `nextText`):** Pass optional `previousText` and `nextText` on `SceneDefinition` so multi-scene monologues maintain seamless prosody across cuts.

### Proven Studio Voice Profiles

1. **Dynamic Narrator / Young Hero (`Liam` — default):** `TX3LPaxmHKxFdv7VOQHJ`
   - `voiceSettings`: `{ stability: 0.35, similarityBoost: 0.78, style: 0.55, speed: 1.1, useSpeakerBoost: true }`
   - Responds well to exclamation marks (`!`) on energetic hook/climax sentences.
2. **Calm / Analytical Explainer:** `CLuTGacrAhcIhaJslbXt`
   - `voiceSettings`: `{ stability: 0.58, similarityBoost: 0.80, style: 0.18, speed: 1.0, useSpeakerBoost: true }`
   - Always end sentences with periods (`.`), never `!`, to keep word endings crisp and unclipped.
3. **Broadcast Journalist / Documentary Anchor (`Daniel — Steady Broadcaster`):** `onwK4e9ZLuTAKqWW03F9`
   - `voiceSettings`: `{ stability: 0.62, similarityBoost: 0.84, style: 0.22, speed: 1.18, useSpeakerBoost: true }`
   - **Zero exclamation marks (`!`)** in news/documentary scripts—use periods (`.`) and em-dashes (`—`) for authoritative TV anchor cadence.
4. **Multi-Character Dialogue Ensemble:**
   - `nPczCjzI2devNBz1zQrb` (*Brian* — senior authority / colonel)
   - `pNInz6obpgDQGcFmaJgB` (*Adam* — director / documentary narrator)
   - `N2lVS1w4EtoT3dr4eOWO` (*Callum* — assistant / analyst)
   - `pqHfZKP75CvOlQylNhV4` (*Bill* — elderly aristocrat / mentor)

### Declarative Voice Acoustic Filters (`voiceEffect`)
Never hardcode scene IDs in audio scripts. Set `voiceEffect?: VoiceAcousticPreset` directly on any scene in `production.json`:
- `'clean'` (default — preserves `250 ms` `apad` silent tail so final consonants never clip)
- `'telephone'` (bandpass `340–3200 Hz` + compressor)
- `'radio-walkie'` (narrow band + subtle bitcrush + radio compression)
- `'cathedral'` (spacious multi-tap acoustic echo)
- `'megaphone'` (projected mid-band PA horn)
- `'excitement-boost'` (crisp `4.2 kHz` presence lift + limiter)

---

## 2. AI Music Score & Sidechain Auto-Ducking (`<SmartMusicBed />`)

### Declaring `score` in `production.json` (`MusicScoreSpec`)
- **`mode: 'prompt'`:** Generates a custom instrumental track via ElevenLabs Music (`composeDetailed`) from `prompt`, `durationSeconds`, and `forceInstrumental: true`.
- **`mode: 'composition-plan'`:** Maps musical intensity arcs directly to your story acts via `sections: ScoreSectionSpec[]` (`{ name, durationMs, positiveLocalStyles, negativeLocalStyles }`).
- **`mode: 'procedural-fallback'` (or `--mock` offline mode):** Synthesizes clean loopable stereo beds across 6 named `moodPreset` options:
  `'ambient-tech' | 'warm-story' | 'news-pulse' | 'cinematic-drone' | 'paper-expedition' | 'upbeat-launch'`.

### Runtime Auto-Ducking & Beat-Reactive Visuals

```tsx
import { staticFile } from 'remotion';
import {
  SmartMusicBed,
  useMusicBeatPulse,
  productionAssetPath,
} from '@make-pictures/core';

const scoreSrc = staticFile(productionAssetPath('my-film', 'music/main-score.mp3'));
const beatPulse = useMusicBeatPulse(scoreSrc, { lowBinCount: 4, smoothingFrames: 3 });

<SmartMusicBed
  src={scoreSrc}
  dialogueSegments={[
    { sceneId: 's1-hook', fromFrame: 24, durationInFrames: 210 },
    { sceneId: 's2-reveal', fromFrame: 270, durationInFrames: 240 },
  ]}
  voiceoverManifest={AUDIO_MANIFEST}
  baseVolume={0.26}
  duckedVolume={0.085}
  lookaheadFrames={12}
  releaseFrames={28}
  fadeInFrames={30}
  fadeOutFrames={45}
  loop
/>
```

- `<SmartMusicBed />` merges words within a sentence into continuous phrase spans, ramps down `12` frames **before** the first syllable (`lookaheadFrames`), holds steady across inter-word micro-pauses, and breathes back up (`releaseFrames: 28`) during real scene transitions (`> ~0.8 s`).
- `useMusicBeatPulse(audioSrc)` returns a smooth `0..1` bass/kick transient envelope (safely returning `0` while loading or if `null`) for subtle glow or scale accents.

---

## 3. AI Sound Effects & Word-Synced Foley (`<SoundCue />`)

### Declaring `sfx` in `production.json` (`SfxAssetSpec`)
Each entry in `sfx` generates a cached `.mp3` via ElevenLabs Text-to-Sound-Effects (`prompt`, `durationSeconds`, `loop?: boolean` for seamless room/wind ambients, `promptInfluence?: number` default `0.35`) with offline `fallbackPreset` (`'whoosh' | 'pop' | 'click' | 'chime' | 'wind' | 'impact' | 'ambient-hum'`).

### Mounting `<SoundCue />` (Frame-Exact or Word-Synced)

```tsx
import { SoundCue } from '@make-pictures/core';

{/* 1. Triggered at an exact composition frame (e.g. camera whip-pan or page turn) */}
<SoundCue
  src={staticFile(productionAssetPath('my-film', 'sfx/page-slide.mp3'))}
  atFrame={180}
  volume={0.38}
/>

{/* 2. Automatically synced to a spoken word in the voiceover! */}
<SoundCue
  src={staticFile(productionAssetPath('my-film', 'sfx/chime-reveal.mp3'))}
  sceneId="s2-reveal"
  onWord="odkrycie"
  sceneStartFrame={270}
  offsetFrames={-3}
  fallbackFrame={60}
  voiceoverManifest={AUDIO_MANIFEST}
  volume={0.42}
/>
```

---

## 4. Mandatory `.mp3` Audition & `-14 LUFS` Loudness Mastering

1. **Generate all capsule audio:** `npm run audio -- --production=<slug>` (or `--mock` for zero-credit procedural dry runs; shortcuts `npm run music` and `npm run sfx` are also available).
2. **Mandatory listen check:** Always inspect every newly generated voiceover `.mp3` with `read_file` before rendering video.
3. **Broadcast EBU R128 Mastering (`-14 LUFS`):** `npm run render -- <CompositionId>` automatically runs `ffmpeg` `loudnorm=I=-14:TP=-1.5:LRA=11` (`-1.5 dBTP` true-peak ceiling) so exported MP4s hit YouTube, Shorts, Reels, and TikTok loudness targets out of the box.
