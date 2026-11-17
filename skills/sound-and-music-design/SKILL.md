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
`eleven_multilingual_v2` can mispronounce raw uppercase acronyms, digits, or brand/style slugs in non-English scripts. Write natural phonetic spellings directly in `scene.text`:
- **Brand & style names (CRITICAL):**
  - `make.pictures`: write **`mejk pikczers`** in Polish and **`make pictures`** in English (**NEVER** write literal punctuation words like *„mejk kropka pikczers”* or *“make dot pictures”*!).
  - `retro-pc`: write **`retro pi si`** in Polish and **`retro pee see`** in English (never *„retro pe ce”* or raw `retro-pc`).
  - Dimensional spaces & numbers: spell out naturally (`dwa de`, `dwa i pół de`, `trzy de`, `jedenaście` in PL; `two dee`, `two point five dee`, `three dee`, `eleven` in EN — zero raw digits or uppercase acronyms in `scene.text`).
- **Polish technical acronyms — Głoskowce vs Literowce (CRITICAL — never confuse the two!):**
  1. **Głoskowce (word-acronyms spoken as a single Polish word — NEVER lettered!):**
     Write in lowercase as one cohesive word:
     - `API` → **`"api"`** (**NEVER** `"a-pe-i"`, `"a pe i"`, or English `"ej-pi-aj"`!)
     - `LED` → `"led"`, `RAM` → `"ram"`, `LAN` → `"lan"`, `PIN` → `"pin"`, `SIM` → `"sim"`, `CAD` → `"kad"`, `SaaS` → `"sas"`, `JSON` → `"dżejson"`.
  2. **Literowce (lettered acronyms spelled with mandatory hyphens `-`, never spaces):**
     Spaces between letters (`"e er p"`, `"es ku el"`) cause `eleven_multilingual_v2` to slur adjacent syllables; always join letter names with hyphens (`-`):
     - `USB` → `"u-es-be"`, `SQL` → `"es-ku-el"`, `CRM` → `"ce-er-em"`, `ERP` → `"e-er-pe"`, `GSM` → `"gie-es-em"`, `PDF` → `"pe-de-ef"`, `HTML` → `"ha-te-em-el"`, `SDK` → `"es-de-ka"`, `HTTPS` → `"ha-te-te-pe-es"`, `CPU` → `"ce-pe-u"`.
  3. **Colloquial engineering digit grouping in standards & norms:**
     Group digits in pairs or single digits the way Polish engineers actually speak — never force long thousand-ordinals or literal `"kropka"`:
     - `ISO 8601` → `"izo osiemdziesiąt sześć zero jeden"`, `RFC 9110` → `"er-ef-ce dziewięćdziesiąt jeden dziesięć"`, `IEEE 802.11` → `"osiemset dwa jedenaście"`, `USB 3.2` → `"u-es-be trzy dwa"`, `HTTP 404` → `"błąd cztery-zero-cztery"`, `x86-64` → `"iks osiemdziesiąt sześć sześćdziesiąt cztery"`.
     - Spell out all numerals in the proper grammatical case (*„poniżej dwudziestu milisekund”*).
  4. **Zero catalog SKU / part numbers in `scene.text`:**
     Never read hardware SKUs or model strings (`DK-940X-TB4`, `PD-140W-G2`) aloud — speak the concrete function and user benefit in narration, and place model badges visually on the card (`badge="Seria 940"`). `npx make-pictures audio` runs `lintManifestVoiceovers` (`phonetics-lint.ts`) automatically before synthesis.
- **Context continuity (`previousText` / `nextText`):** Pass optional `previousText` and `nextText` (prefixed with `. ` or `... ` to prevent trailing phoneme bleed) on `SceneDefinition` so multi-scene monologues maintain seamless prosody across cuts.

### Proven Studio Voice Profiles & Natural `0.98–1.00` Speech Speed

Keep `voiceSettings.speed` in the natural **`0.98–1.00`** range (`0.99` CLI default) for Polish and English explainers, product presentations, and essays — speeds `>= 1.10` rush phrasing and clip Polish consonant endings.

1. **Dynamic Narrator / Young Hero (`Liam` — default):** `TX3LPaxmHKxFdv7VOQHJ`
   - `voiceSettings`: `{ stability: 0.42, similarityBoost: 0.78, style: 0.45, speed: 0.99, useSpeakerBoost: true }`
   - Suitable for launch films and product stories; use exclamation marks sparingly.
2. **Calm / Analytical Explainer:** `CLuTGacrAhcIhaJslbXt`
   - `voiceSettings`: `{ stability: 0.58, similarityBoost: 0.80, style: 0.18, speed: 0.99, useSpeakerBoost: true }`
   - Always end sentences with periods (`.`), never `!`, to keep word endings crisp and unclipped.
3. **Broadcast Journalist / Documentary Anchor (`Daniel — Steady Broadcaster`):** `onwK4e9ZLuTAKqWW03F9`
   - `voiceSettings`: `{ stability: 0.62, similarityBoost: 0.84, style: 0.22, speed: 1.00, useSpeakerBoost: true }`
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
- **`mode: 'procedural-fallback'` (or `--mock` offline mode):** Synthesizes clean loopable stereo beds across 7 named `moodPreset` options:
  `'ambient-tech' | 'warm-story' | 'news-pulse' | 'cinematic-drone' | 'cinematic-epic' | 'paper-expedition' | 'upbeat-launch'`.

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
    { sceneId: 's1-hook', fromFrame: 42, durationInFrames: 210 },
    { sceneId: 's2-reveal', fromFrame: 390, durationInFrames: 240 },
  ]}
  voiceoverManifest={AUDIO_MANIFEST}
  baseVolume={0.25}
  duckedVolume={0.085}
  lookaheadFrames={12}
  releaseFrames={28}
  fadeInFrames={30}
  fadeOutFrames={90}
  loop
/>
```

- `<SmartMusicBed />` merges words within a sentence into continuous phrase spans, ramps down `12` frames **before** the first syllable (`lookaheadFrames`), holds steady across inter-word micro-pauses, and breathes back up (`releaseFrames: 28`) during real scene transitions (`> ~0.8 s`).
- `useMusicBeatPulse(audioSrc)` returns a smooth `0..1` bass/kick transient envelope (safely returning `0` while loading or if `null`) for subtle glow or scale accents.

---

## 3. Scene Voiceovers (`<VoiceoverTrack />`) & Word-Synced Foley (`<SoundCue />`)

### `<Html5Audio />` Pool Hygiene (CRITICAL)
`@remotion/player` only frees a shared `<Html5Audio />` slot when its `<Audio />` element **unmounts**. **Never** wrap `<Audio />` in an unbounded `<Sequence from={...}>` without `durationInFrames` — otherwise finished voiceovers and SFX stay mounted until the end of the film!
- **For scene narration:** Mount `<VoiceoverTrack voiceover={VOICEOVER_MANIFEST[sceneId]} fromFrame={...} volume={...} />` from `@make-pictures/core` (it automatically computes finite `durationInFrames` from `voiceover.durationInSeconds + 0.35s` consonant safety tail).
- **For Foley / SFX:** Mount `<SoundCue />` from `@make-pictures/core` and pass `durationSeconds={sfx.durationSeconds}` when available (even when omitted, `<SoundCue />` auto-unmounts after a finite `6s` window unless `loop` is set).
- **Live Web Embeds:** When embedding compositions in your own custom `<Player />` from `@remotion/player`, pass `numberOfSharedAudioTags={32}` (Studio Web configures `STUDIO_SHARED_AUDIO_TAGS = 32` automatically).

### Sparse Foley Budget (`3–5` Cues per Film at `volume: 0.14–0.26`) & `sfx` in `production.json`
Never attach a whoosh or pop to every single card entrance or scene cut. Across a `60–90 s` explainer or product film, place **at most `3–5` subtle Foley accents** (chapter opening, key metric shift, closing resolve) mixed quietly at **`volume: 0.14–0.26`** so they never mask spoken consonants. Each entry in `sfx` generates a cached `.mp3` via ElevenLabs Text-to-Sound-Effects (`prompt`, `durationSeconds`, `loop?: boolean`, `promptInfluence?: number` default `0.35`) with offline `fallbackPreset` (`'whoosh' | 'pop' | 'click' | 'chime' | 'wind' | 'impact' | 'ambient-hum'`).

### Mounting `<VoiceoverTrack />` & `<SoundCue />`

```tsx
import { SoundCue, VoiceoverTrack } from '@make-pictures/core';
import { SFX_MANIFEST, VOICEOVER_MANIFEST } from '../generated/audio-manifest';

{/* 1. Bounded scene voiceover starting after ~42f (0.7s) Pre-Speech Settle */}
<VoiceoverTrack
  voiceover={VOICEOVER_MANIFEST['s2-reveal']}
  fromFrame={42}
  volume={1.0}
/>

{/* 2. Subtle Foley cue mixed at 0.14..0.26 */}
<SoundCue
  src={staticFile(SFX_MANIFEST['page-slide'].audioFile)}
  atFrame={38}
  durationSeconds={SFX_MANIFEST['page-slide'].durationSeconds}
  volume={0.20}
/>

{/* 3. SFX automatically synced to a spoken word in the voiceover! */}
<SoundCue
  src={staticFile(SFX_MANIFEST['chime-reveal'].audioFile)}
  sceneId="s2-reveal"
  onWord="odkrycie"
  sceneStartFrame={42}
  offsetFrames={-3}
  fallbackFrame={60}
  durationSeconds={SFX_MANIFEST['chime-reveal'].durationSeconds}
  voiceoverManifest={VOICEOVER_MANIFEST}
  volume={0.22}
/>
```

---

## 4. Mandatory `.mp3` & Final Mastered `.mp4` (`-14 LUFS`) Audition Gate

1. **Generate & lint capsule audio:** `npx make-pictures audio --production=<slug>` (runs `lintManifestVoiceovers` automatically; pass `--mock` for zero-credit procedural dry runs).
2. **Pre-render `.mp3` check:** Inspect every newly generated `assets/voiceovers/*.mp3` with `read_file` and recalculate each scene's `durationInFrames` with `computeSceneTimingFromVoiceover` (`~42f` pre-speech settle + `~96f` post-speech hold, `+144f` outro hold).
3. **Broadcast EBU R128 Mastering (`-14 LUFS`) & Mandatory Final `.mp4` Audition:** `npx make-pictures render <CompositionId>` automatically runs `ffmpeg` `loudnorm=I=-14:TP=-1.5:LRA=11`. **Listening to `.mp3` voiceovers alone is not enough** — after rendering `.mp4`, always inspect the mastered `.mp4` mix to verify `<SmartMusicBed fadeOutFrames={90} />` ducking, `<SoundCue />` balance (`0.14–0.26`), Polish `"api"` vs `"u-es-be"` pronunciation, and unclipped outro tails.
