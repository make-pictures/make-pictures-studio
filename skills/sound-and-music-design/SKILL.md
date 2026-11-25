---
name: sound-and-music-design
description: >-
  Complete audio direction guide for @make-pictures/remotion/audio and
  @make-pictures/cli: ElevenLabs eleven_v4 default & eleven_v3 discrete
  stability, Text-to-Dialogue (dialogueInputs + voiceSegments), native PL/EN
  voice casting, Polish/English phonetics (głoskowce "api" vs hyphenated
  literowce "u-es-be"), acousticPresets, AI Music (SmartMusicBed sidechain
  auto-ducking, useMusicBeatPulse), word-synced SoundCue foley, and -14 LUFS
  EBU R128 mastering. Use whenever writing scripts, authoring audio.json, or
  wiring voiceovers, music, and SFX into Remotion compositions.
---

# Sound & Music Design (`@make-pictures/remotion/audio` & `@make-pictures/cli`)

> **Tandem Skills Contract (`remotion-dev/skills`):** Base Remotion audio mounting (`<Audio>`, `<Sequence>`, `staticFile()`, `@remotion/media-utils`) is covered in **`remotion-dev/skills`** (`npx remotion skills add`). Use this skill for `make.pictures` ElevenLabs TTS/Dialogue/Music/SFX generation (`audio.json`), Polish/English phonetics, sidechain ducking, audio pool hygiene, and `-14 LUFS` broadcast mastering.

All audio generation (TTS, Text-to-Dialogue, AI Music, AI SFX) is powered by a single `ELEVENLABS_API_KEY` in `.env.local` (configured via `npx make-pictures onboard`; use `--mock` for zero-credit offline synthesis).

---

## 1. Phonetic Spelling Rules in `audio.json` (`eleven_v4` Default)

`eleven_v4` is the studio default (`DEFAULT_ELEVENLABS_MODEL_ID = 'eleven_v4'`). Always write clean phonetic spellings directly inside `scene.text` and every turn of `scene.dialogueInputs`:

- **Brand & style names (CRITICAL):**
  - `make.pictures` → **`"mejk pikczers"`** (PL) / **`"make pictures"`** (EN) — never *"mejk kropka pikczers"* or *"make dot pictures"*.
  - `retro-pc` → **`"retro pi si"`** (PL) / **`"retro pee see"`** (EN) — never *"retro pe ce"* or raw `retro-pc`.
  - Spell out dimensional spaces & numbers naturally (`dwa de`, `dwa i pół de`, `trzy de`, `jedenaście` in PL; `two dee`, `two point five dee`, `three dee` in EN).
- **Polish Technical Acronyms — Głoskowce vs. Literowce (CRITICAL):**
  1. **Głoskowce (spoken as one Polish word — NEVER lettered!):**
     Write in lowercase as a single cohesive word:
     - `API` → **`"api"`** (NEVER `"a-pe-i"` or English `"ej-pi-aj"`!)
     - `LED` → `"led"`, `RAM` → `"ram"`, `LAN` → `"lan"`, `PIN` → `"pin"`, `SIM` → `"sim"`, `CAD` → `"kad"`, `SaaS` → `"sas"`, `JSON` → `"dżejson"`.
  2. **Literowce (lettered acronyms with mandatory hyphens `-`, never spaces):**
     Spaces between letters slur syllables; always join letter names with hyphens:
     - `USB` → `"u-es-be"`, `SQL` → `"es-ku-el"`, `CRM` → `"ce-er-em"`, `ERP` → `"e-er-pe"`, `GSM` → `"gie-es-em"`, `PDF` → `"pe-de-ef"`, `HTML` → `"ha-te-em-el"`, `SDK` → `"es-de-ka"`, `HTTPS` → `"ha-te-te-pe-es"`, `CPU` → `"ce-pe-u"`.
  3. **Colloquial Engineering Digit Grouping:**
     Group standard/norm numbers the way Polish engineers speak (zero literal `"kropka"`):
     - `ISO 8601` → `"izo osiemdziesiąt sześć zero jeden"`, `RFC 9110` → `"er-ef-ce dziewięćdziesiąt jeden dziesięć"`, `IEEE 802.11` → `"osiemset dwa jedenaście"`, `USB 3.2` → `"u-es-be trzy dwa"`, `HTTP 404` → `"błąd cztery-zero-cztery"`, `x86-64` → `"iks osiemdziesiąt sześć sześćdziesiąt cztery"`.
     - Spell out numerals in the proper grammatical case (*„poniżej dwudziestu milisekund”*).
  4. **Zero Catalog SKUs or Engine-Spec Flexing in Spoken Copy:**
     Never read part numbers (`DK-940X-TB4`) or internal specs (`60 FPS`, `-14 LUFS`, `0 kolizji`, `GPU`, `PBR`) aloud. `npx make-pictures audio` runs `lintManifestVoiceovers` automatically before synthesis.
- **Prosody Continuity:** Pass optional `previousText` / `nextText` (prefixed with `. ` or `... `) on scenes in `audio.json` to preserve natural intonation across cuts.

---

## 2. Native Voice Selection (`voices --lang`) & Proven Profiles

> **HARD RULE:** **Never use English premade voices** (**Liam** `TX3LPaxmHKxFdv7VOQHJ`, **Sarah** `EXAVITQu4vr4xnSDxMaL`, **Brian** `nPczCjzI2devNBz1zQrb`, **George** `JBFqnCBsd6RMkjVDRZzb`, **Daniel** `onwK4e9ZLuTAKqWW03F9`, **Adam**, **Callum**, **Bill**) **for Polish scripts** — cross-lingual transfer corrupts Polish prosody and numeral stress.

1. Discover voices (curated + user account + Voice Library with 0-credit preview URLs):
   `npx make-pictures voices --lang=pl --json` (or `--lang=en`, `--gender=female|male`, `--query="..."`).
2. Audition **1 short sentence** before full synthesis:
   ```bash
   npx make-pictures voices --voice=C8ZVSJxcymeT86xT429O --lang=pl --model=eleven_v4 --audition="[thoughtful] Ten detal zmienia wszystko… [warmly] i zaraz zobaczysz dlaczego."
   ```
3. Keep natural **`voiceSettings.speed: 0.98–1.00`** (`0.99` CLI default) so Polish consonant endings never clip (`>= 1.10` rushes phrasing).

### Verified Native Polish (`lang: 'pl'`) Voices (`@make-pictures/remotion/audio/voices`)
- **Luiza** (`C8ZVSJxcymeT86xT429O`, default PL female — warm storyteller/educator): `{ stability: 0.48, similarityBoost: 0.80, style: 0.30, speed: 0.99, useSpeakerBoost: true }`
- **Asia** (`Bz1e1clEKwgN71Vx7cxj`, PL female — crisp SaaS/product presenter): `{ stability: 0.45, similarityBoost: 0.80, style: 0.32, speed: 0.99, useSpeakerBoost: true }`
- **Arleta** (`F9eb9uZYeJuHuO7Uvs1R`, PL female — calm editorial/instructor): `{ stability: 0.56, similarityBoost: 0.82, style: 0.18, speed: 0.99, useSpeakerBoost: true }`
- **Rafał** (`CLuTGacrAhcIhaJslbXt`, PL male — analytical/documentary; end sentences with `.`, never `!`): `{ stability: 0.58, similarityBoost: 0.80, style: 0.18, speed: 0.99, useSpeakerBoost: true }`

### Verified Native English (`lang: 'en'`) Voices (English Scripts ONLY!)
- **Liam** (`TX3LPaxmHKxFdv7VOQHJ`, default EN male — tech/launch), **Sarah** (`EXAVITQu4vr4xnSDxMaL`, EN female — calm editorial/science), **Daniel** (`onwK4e9ZLuTAKqWW03F9`, EN male — broadcast documentary, zero `!`), **Brian** (`nPczCjzI2devNBz1zQrb`), **George** (`JBFqnCBsd6RMkjVDRZzb`), **Adam** (`pNInz6obpgDQGcFmaJgB`), **Callum** (`N2lVS1w4EtoT3dr4eOWO`), **Bill** (`pqHfZKP75CvOlQylNhV4`).

---

## 3. Expressive Direction (`eleven_v4` / `eleven_v3`), Micro-Segments & `dialogueInputs`

1. **Inline Audio Tags (`eleven_v4` default & `eleven_v3` ONLY):**
   - Use concise cues inside `text` or `dialogueInputs[].text`: `[thoughtful]`, `[warmly]`, `[playful]`, `[amazed]`, `[excited]`, `[whispers]`, `[sighs]`, `[curious]`.
   - **Cross-Model Safety (`[v3-audio-tags]`):** Never leave `[tags]` on legacy `eleven_multilingual_v2` (v2 reads them aloud!). `lintManifestVoiceovers` flags this across `pl` and `en`.
2. **Discrete `stability` on `eleven_v3` (`[v3-stability]`):**
   - When explicitly targeting `eleven_v3`, `voiceSettings.stability` MUST be discrete: **`0.0` (Creative), `0.5` (Natural — default), or `1.0` (Robust)**.
3. **Micro-Segment Splitting (`a/b/c`):**
   - Split long acts into short scenes (`s02a-setup`, `s02b-twist`, `s02c-resolve`) in `audio.json` so physical pauses (`0.6–1.4 s`) breathe naturally and SHA-256 caching re-synthesizes only edited lines.
4. **Multi-Speaker Text-to-Dialogue (`dialogueInputs` → `convertWithTimestamps` + `voiceSegments`):**
   - For 2+ speaker conversations (podcast, interview, co-host banter), declare `dialogueInputs` directly on the scene in `audio.json` — `@make-pictures/cli` calls `elevenlabs.textToDialogue.convertWithTimestamps`, producing **one cohesive `.mp3`** with per-turn `voiceSegments` (`{ voiceId, speaker?, dialogueInputIndex, startTimeSeconds, endTimeSeconds }`) for exact lip-sync and camera cuts (and deterministic proportional `voiceSegments` under `--mock`):

```json
{
  "id": "s4-studio-dialogue",
  "durationInSeconds": 7.0,
  "modelId": "eleven_v4",
  "languageCode": "pl",
  "voiceSettings": { "stability": 0.5, "speed": 0.99 },
  "text": "[playful] Chcesz pogadać z widzem? [warmly] Światło i rozmowa w jednym miejscu.",
  "dialogueInputs": [
    { "speaker": "Luiza", "voiceId": "C8ZVSJxcymeT86xT429O", "text": "[playful] Chcesz pogadać z widzem? Wskakujemy do ciepłego studia trzy de!" },
    { "speaker": "Rafał", "voiceId": "CLuTGacrAhcIhaJslbXt", "text": "[warmly] Światło, uśmiech i dobra rozmowa w jednym miejscu." }
  ]
}
```

5. **Declarative Voice Acoustic Presets (`acousticPreset` / `voiceEffect`):**
   `'clean'` (default, `250 ms` `apad` tail so final consonants never clip), `'telephone'`, `'radio-walkie'`, `'cathedral'`, `'megaphone'`, `'excitement-boost'`.

---

## 4. AI Music (`<SmartMusicBed />`), Foley (`<SoundCue />`) & Audio Pool Hygiene

### `<Html5Audio />` Pool Hygiene (CRITICAL)
`@remotion/player` frees a shared audio tag only when its `<Audio />` unmounts. **Never** wrap `<Audio />` in an unbounded `<Sequence>` without `durationInFrames`.
- Use **`<VoiceoverTrack />`** from `@make-pictures/remotion/audio` (automatically bounds `durationInFrames` to `durationInSeconds + 0.35s` safety tail).
- Use **`<SoundCue />`** with `durationSeconds={sfx.durationSeconds}` (auto-bounds even if omitted, unless `loop`).
- Pass `numberOfSharedAudioTags={32}` when mounting custom `<Player />` embeds.
- **Sparse Foley Budget:** Place **at most `3–5` subtle cues** per `60–90 s` film at **`volume: 0.14–0.26`** (fallback presets: `'whoosh' | 'pop' | 'click' | 'chime' | 'wind' | 'impact' | 'ambient-hum'`).

### Mounting Music, Voiceover & Word-Synced SFX

```tsx
import { staticFile } from 'remotion';
import {
  SmartMusicBed,
  SoundCue,
  VoiceoverTrack,
  useMusicBeatPulse,
} from '@make-pictures/remotion/audio';
import { SFX_MANIFEST, VOICEOVER_MANIFEST } from './generated/audio-manifest';

const scoreSrc = staticFile('audio/my-film/main-score.mp3');
const beatPulse = useMusicBeatPulse(scoreSrc, { lowBinCount: 4, smoothingFrames: 3 });

<SmartMusicBed
  src={scoreSrc}
  dialogueSegments={[{ sceneId: 's1-hook', fromFrame: 42, durationInFrames: 210 }]}
  voiceoverManifest={VOICEOVER_MANIFEST}
  baseVolume={0.25}
  duckedVolume={0.085}
  lookaheadFrames={12}
  releaseFrames={28}
  fadeInFrames={30}
  fadeOutFrames={90}
  loop
/>
<VoiceoverTrack voiceover={VOICEOVER_MANIFEST['s1-hook']} fromFrame={42} volume={1.0} />
<SoundCue
  src={staticFile(SFX_MANIFEST['chime-reveal'].audioFile)}
  sceneId="s1-hook"
  onWord="odkrycie"
  sceneStartFrame={42}
  offsetFrames={-3}
  fallbackFrame={60}
  durationSeconds={SFX_MANIFEST['chime-reveal'].durationSeconds}
  voiceoverManifest={VOICEOVER_MANIFEST}
  volume={0.20}
/>
```

- `score.mode` in `audio.json`: `'prompt'` (ElevenLabs Music `composeDetailed`, `forceInstrumental: true`), `'composition-plan'` (`sections: ScoreSectionSpec[]`), or `'procedural-fallback'` (`moodPreset`: `'ambient-tech' | 'warm-story' | 'news-pulse' | 'cinematic-drone' | 'cinematic-epic' | 'paper-expedition' | 'upbeat-launch'`).
- Optional `<VoiceoverCaptionBar />` is also exported from `@make-pictures/remotion/audio` (omit bottom subtitles by default unless explicitly requested).

---

## 5. Mandatory `.mp3` & Final `-14 LUFS` `.mp4` Audition Gate

1. Generate & lint: `npx make-pictures audio <slug>` (or `--mock` offline).
2. Listen to generated `public/audio/<slug>/*.mp3` files via `read_file` and compute scene durations with `computeSceneTimingFromVoiceover` (`~42f` pre-speech, `~96f` post-speech, `+144f` outro).
3. Render via `npx make-pictures render <CompositionId>` (runs EBU R128 `ffmpeg loudnorm=I=-14:TP=-1.5:LRA=11` mastering automatically) and **audition the final `.mp4` mix** to verify ducking, SFX balance, Polish `"api"` vs `"u-es-be"` diction, and clean outro tails.
