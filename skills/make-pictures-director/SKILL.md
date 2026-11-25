---
name: make-pictures-director
description: >-
  End-to-end 6-step production workflow for 60 FPS Remotion videos with
  @make-pictures/remotion and @make-pictures/cli (onboard, init, new, doctor,
  styles, audio, voices, music, sfx, image, cutout, assets, qa, render,
  elements). Use whenever starting a new film, writing audio.json manifests,
  configuring make-pictures.json, pacing scenes (>= 4.5 s) with
  ContinuousSceneFlow, previewing in native npx remotion studio, running the
  hard Director QA gate, exporting Remotion Elements, or rendering -14 LUFS MP4s.
---

# make.pictures Director — 6-Step Production Workflow (`60 FPS`)

> **Tandem Skills Contract (`remotion-dev/skills`):** Base Remotion APIs (`<Composition>`, `spring()`, `interpolate()`, `<Img>`, `<OffthreadVideo>`, `<Sequence>`, `calculateMetadata`, Remotion Studio, and `remotion render`) are owned by official **`remotion-dev/skills`** (installed via `npx remotion skills add`). Load `remotion-dev/skills` for base Remotion API questions, and use `make.pictures` skills strictly for art direction, visual kits, ElevenLabs audio/mastering, and Director QA.

---

## 1. Workspace Modes, Zero Lock-In & Native `npx remotion studio`

`@make-pictures/cli` (`npx make-pictures <command>`) works in any standard Remotion 4 project with zero proprietary IDE and zero composition-registry magic:

1. **Fresh Project (`npx create-make-pictures@latest my-films` or `npx -y @make-pictures/cli@latest onboard`):**
   - Scaffolds a standard Remotion 4 + React 19 project (`src/index.ts`, `src/Root.tsx` registering `StyleLab` from `@make-pictures/remotion/style-lab`, `remotion.config.ts`, `tsconfig.json`, `package.json`).
2. **Existing Remotion Project (`npx make-pictures init`):**
   - Installs `@make-pictures/remotion` + `@make-pictures/cli`, installs tandem `remotion-dev/skills` + the 5 `make.pictures` skills, and leaves your existing `src/Root.tsx` untouched.
3. **Embedded Inside a SaaS / App Repo (`npx make-pictures init --dir=videos`):**
   - Scopes video source under `videos/` while keeping AI skills at repo root so agents can render real React components into `60 FPS` launch videos.
4. **Live Web Embeds:** Import any `@make-pictures/remotion/kits/*` wrapped in `<StyleProvider>` inside `@remotion/player` (`<Player numberOfSharedAudioTags={32} />`) with zero MP4 rendering.

### Optional `make-pictures.json` & Per-Film Layout

CLI commands work without any config file; an optional root `make-pictures.json` overrides defaults:

```json
{
  "entryPoint": "src/index.ts",
  "publicDir": "public",
  "videosDir": "src/videos",
  "stylesDir": "styles",
  "lang": "pl",
  "fps": 60
}
```

```text
styles/<brand-or-era>.style.json         # Optional custom StylePreset presets
src/Root.tsx                             # Native Remotion <Composition schema={...} defaultProps={...} />
src/videos/<slug>/
├── audio.json                           # Unified audio manifest: scenes (TTS/Dialogue), score (Music), sfx
├── <PascalSlug>.tsx                     # 60 FPS Remotion composition wrapped in <StyleProvider>
├── SOURCES.md                           # External archival/media attributions & licenses
└── generated/audio-manifest.ts          # Auto-generated typed durations, words[] & voiceSegments[]
public/audio/<slug>/*.mp3                # Generated voiceovers, AI score & SFX
```

Launch interactive preview at any time with **`npx remotion studio`** (or thin alias `npx make-pictures studio`).

---

## 2. The 6-Step Interactive Production Process

### Step 1: Creative Brief & Mandatory Art Direction Gate (`art-direction-and-styles`)

> **MANDATORY GATE:** Load **`art-direction-and-styles`** FIRST! **Never** default blindly to `paper-diorama-3d` or `3×2` blinking tile grids. Match topic, era, emotion, and brand on the 2-axis matrix **`DimensionalSpace ('2d' | '2.5d' | '3d') × StylePreset`** (10 `BUILT_IN_STYLES` or custom `styles/<slug>.style.json`).

Confirm with the user (or propose 2–3 distinct creative directions):
1. **Topic, audience, language (`pl` | `en`), and aspect ratio** (`16:9` `1920×1080`, `9:16` `1080×1920`, or both).
2. **Dimensional Space (`--space=2d|2.5d|3d`), Visual Kit(s), and Style (`--style=<styleId>`):**
   - **2D (`kits-2d`):** `editorial-collage`, `vector-scene-2d`, `motion-diagrams-2d`, `kinetic-typography`, `data-storytelling`, `product-frames`, `vfx`.
   - **2.5D / 3D (`kits-3d-and-kinematics`):** `paper-diorama-3d`, `isometric-3d`, `tactile-3d`.
   - Inspect presets via `npx make-pictures styles [--space=2d|2.5d|3d]`, create custom presets via `npx make-pictures style new <slug> --from=soft-clay`, or inspect `StyleLab` live in `npx remotion studio`.
3. Scaffold the film and register its `<Composition>` in `src/Root.tsx`:

```bash
npx make-pictures new <slug> --space=3d --lang=pl
npx make-pictures new <slug> --space=2.5d --lang=pl
npx make-pictures new <slug> --space=2d --style=retro-pc --lang=pl
npx make-pictures new <slug> --kit=editorial-collage --style=editorial-press --lang=pl
```

---

### Step 2: Storyboard Pacing & `audio.json` Manifest

Load **`sound-and-music-design`** and write `src/videos/<slug>/audio.json` conforming to `AudioManifestFile` (`@make-pictures/remotion/types`):

```json
{
  "id": "printing-revolution",
  "title": "Jak prasa drukarska przyspieszyła naukę",
  "fps": 60,
  "lang": "pl",
  "modelId": "eleven_v4",
  "scenes": [
    {
      "id": "s1-hook",
      "durationInSeconds": 4.5,
      "speaker": "Narrator",
      "voiceId": "F9eb9uZYeJuHuO7Uvs1R",
      "acousticPreset": "clean",
      "text": "[thoughtful] W ciągu zaledwie pięćdziesięciu lat koszt książki spadł o osiemdziesiąt procent."
    }
  ],
  "score": {
    "id": "main-score",
    "mode": "prompt",
    "moodPreset": "news-pulse",
    "prompt": "Warm modern documentary piano and subtle felt strings pulse, instrumental",
    "forceInstrumental": true,
    "baseVolume": 0.24,
    "duckedVolume": 0.08
  },
  "sfx": [
    {
      "id": "reveal-whoosh",
      "prompt": "Subtle warm editorial card transition whoosh",
      "durationSeconds": 1.0,
      "fallbackPreset": "whoosh"
    }
  ]
}
```

#### Director Pacing Law & Breathing Budget (Enforced by `npx make-pictures qa`)
- **Minimum `4.5 s` (`270` Frames) & `computeSceneTimingFromVoiceover`:** Every visual scene MUST span **`>= 270` frames (`4.5 s` @ `60 FPS`)**, connected via `<ContinuousSceneFlow scenes={...} crossDissolveFrames={54} />` (`@make-pictures/remotion/director`) inside one top-level `<StyleProvider style={props.styleId} renderBackdrop>`. Always derive scene durations from real voiceover lengths using `computeSceneTimingFromVoiceover(voiceoverDurationSeconds, { isFinalScene })`:
  1. **Pre-Speech Settle:** **`~0.7 s` (`42f`; hard minimum `36f`)** before the first spoken syllable.
  2. **Post-Speech Hold:** **`~1.5–1.7 s` (`90–102f`; default `96f`, hard minimum `90f`)** after the last word.
  3. **Final-Scene Outro Hold:** **`+2.2–2.5 s` (`132–150f`; default `144f`, hard minimum `132f`)** paired with `<SmartMusicBed fadeOutFrames={90} />`.
- **Sub-View Budget (`<= 2` Sub-Views via `<SceneSubViewDissolve />`):** Keep at most **1 evolving layout** or **2 spacious sub-views (`View A → View B`)** connected via `<SceneSubViewDissolve switchAtFrame={...} dissolveFrames={54} />` (`48–60f`). **3+ sub-views in one scene are banned** — split into separate scenes in `audio.json`.
- **Single Focal Point (`useFocalStagger` & `CINEMATIC_SPRINGS`):** Stagger `lead` (`frame >= 2`), `support` (`+22f`), and `ambient` (`+40f`). **Never** mount `<WordByWordStage>` alongside `<ImpactKeywordCard>`, `<StoryCard2D>`, `<MetricComparisonCard>`, or `<SystemNode>`.
- **Audience-Focused Copy, Calm Cadence (`<= 2.8 words/s`) & Polish Sentence Case:** Never flex internal engine specs (`"60 FPS"`, `"-14 LUFS"`, `"0 kolizji"`, `"GPU"`, `"PBR"`, `"SAT"`) or catalog SKUs (`DK-940X-TB4`) in titles or narration. Omit bottom subtitles by default unless requested; write Polish headings in *Sentence case*.
- **1080p Legibility (`>= 18 px`), Card Hygiene & `<ClippedSurfaceChrome />`:** Enforce `TYPOGRAPHY_FLOOR_1080P` (`>= 18–19 px`), **"Headline (`26–32 px`, `2–5` words) + 1 concise sentence (`19–22 px`, `6–11` words)"**, `height: 'auto'`, `justifyContent: 'center'`, `boxSizing: 'border-box'` (zero `space-between` voids), `<ClippedSurfaceChrome />` on `overflow: 'visible'` rounded cards, and Remotion `<Img>` (never raw `<img>`).

---

### Step 3: Pilot Demo, Fact-Check, Audio Generation & Asset Hygiene

1. **Pilot Demo (`2–3` Key Shots) & Mandatory Fact-Check Gate:**
   - For multi-act 3D, archival, or custom-rig films, build and preview a short **Pilot Demo** (`10–15 s`, `2–3` key shots) to lock materials, framing, and overlay legibility before synthesizing all voiceovers.
   - Verify every date, proper noun, measurement, and quotation **before** paid ElevenLabs synthesis or final MP4 render.
2. **Environment & Native Voices:** Run `npx make-pictures doctor` if needed. Pick language-native voices via `npx make-pictures voices --lang=pl --json` (never English premade voices like Liam/Sarah/Brian/George for Polish!) and audition 1 sentence with `--audition="..." --voice=<id>`.
3. **Synthesize & Lint Audio:**
   ```bash
   npx make-pictures audio <slug>           # or --manifest=path/to/audio.json; add --mock for zero-credit dry runs, --force to bypass SHA-256 cache
   ```
   Shortcuts: `npx make-pictures music`, `npx make-pictures sfx`.
   - Writes `.mp3` assets to `public/audio/<slug>/` and generates `src/videos/<slug>/generated/audio-manifest.ts` (`durationInSeconds`, `words[]`, `voiceSegments[]`).
   - **MANDATORY `.mp3` AUDITION:** Listen to every newly generated `.mp3` via `read_file` to verify phonetics and unclipped word endings, then compute exact scene frame spans with `computeSceneTimingFromVoiceover`.
4. **Asset Hygiene (`image --style`, `cutout`, `assets clean-scan`, `assets sheet`, `SOURCES.md`):**
   - Style-anchored AI illustrations (zero raster text): `npx make-pictures image "<subject>" --style=<styleId> --out=public/images/<slug>/hero.png`
   - Bright objects on white backgrounds / PDFs (lossless PDF `/SMask` or Exterior Border Flood-Fill — **never** global white thresholding `rgb > 245 => alpha = 0`!):
     `npx make-pictures cutout <source.pdf|photo.png> --out=public/images/<slug>/subject.png` — always inspect the dark-checkerboard (`#0F172A`/`#1E293B`) QA PNG with `read_file`.
   - Archival scan borders & contact sheet:
     `npx make-pictures assets clean-scan raw/plate.png --out=public/images/<slug>/plate-clean.png`
     `npx make-pictures assets sheet public/images/<slug> --out=out/qa-assets-<slug>.png`
   - Record every external archival/public-domain source URL, author, and license in `SOURCES.md`.

---

### Step 4: `60 FPS` Implementation & Native `src/Root.tsx` Registration

1. Load **`kits-2d`** and/or **`kits-3d-and-kinematics`**.
2. Wrap the composition in `<StyleProvider style={props.styleId} renderBackdrop>` (export a Zod `schema` with `styleId` + `defaultProps` and register `<Composition>` directly in `src/Root.tsx` — editable at `60 FPS` inside native `npx remotion studio`).
3. Enforce **Clean Frame `0`**: pure uniform `palette.bgCanvas` (`0.00` RGB variance), entrance springs starting at `frame - 2`, deterministic `createSeededRandom(seed)` (zero `Math.random()`, zero cross-frame `useRef`).
4. Sequence multi-scene arcs with `<ContinuousSceneFlow crossDissolveFrames={54} />` (`usesThree: true` enforces `<= 1` WebGL `<ThreeCanvas>` mounted per frame) and synchronize audio via `<VoiceoverTrack />`, `<SmartMusicBed />`, `<SoundCue />`, `getWordTriggerFrame`, and `getSpeechStateAtFrame`.

---

### Step 5: 3D Zero-Collision Test & Hard Director QA Gate (`qa`)

1. **3D Zero-Collision Unit Gate:** For 3D/2.5D physical choreography, run a deterministic unit test using `auditSceneCollisions3D` and `computeDeformedSheetAabb3D` (`@make-pictures/remotion/kinematics`, zero `three` imports).
2. **Hard Director QA + Auto-Grid Contact Sheet (`npx make-pictures qa`):**
   Uses native `@remotion/renderer` (`bundle()` + `selectComposition()`) — works in any standard Remotion project with automatic neighbor `audio.json` / `generated/audio-manifest.ts` discovery (or `--audio=<path>`):
   ```bash
   npx make-pictures qa <CompositionId>
   ```
   *(Flags: `--grid=auto|4x3`, `--audio=<path>`, `--out=out/qa-<CompositionId>.png`, `--allow-fast-cuts` ONLY for intentional fast-cut `9:16` poster reels.)*
   - Enforces: `MIN_SCENE_SPAN` (`>= 270f`), `INSUFFICIENT_BREATHING_ROOM` (`pre >= 36f`, `post >= 90f`, `outro >= 132f`), `READING_CADENCE_OVER_BUDGET` (`<= 2.8 words/s`), `EXCESSIVE_SUBVIEWS` (`<= 2`), `COMPETING_FOCAL_POINT`, `CHOPPY_SCENE_TRANSITION`, `UNCLIPPED_CARD_BAR`, `RAW_HTML_IMG_TAG`, `FONT_BELOW_1080P_FLOOR` (`>= 18px`), `CARD_VERTICAL_VOID`, and `DIRTY_FRAME_ZERO` (`0.00` RGB variance).
   - **MANDATORY VISUAL INSPECTION:** Open `out/qa-<CompositionId>.png` via `read_file` and inspect `f=0`, `sceneId/subViewId` badges, `latin-ext` glyphs, `>= 18px` legibility, `Δx = 0.00px` callouts, and `9:16` **Golden Safe Box `x ∈ [40, 910], y ∈ [220, 1380]`**.

---

### Step 6: Typecheck, Broadcast Render (`-14 LUFS`) & Final `.mp4` Audition

```bash
npm run typecheck
npx make-pictures render <CompositionId> out/<slug>.mp4
```

- Automatically applies `60 FPS`, `--concurrency=100%`, `--gl=angle` when Three.js is detected, and EBU R128 `-14 LUFS` loudness mastering (`ffmpeg loudnorm`, pass `--no-master` to disable).
- **MANDATORY FINAL `.mp4` MIX AUDITION:** Verify `<SmartMusicBed fadeOutFrames={90} />` ducking, subtle `<SoundCue />` levels (`0.14–0.26`), Polish phonetics (`"api"` vs `"u-es-be"`), and unclipped endings.

---

## 3. Remotion Elements Export (`@make-pictures/remotion/elements`)

Publish standalone, copy-pasteable components compatible with `npx remotion elements use <url>` (`@remotion/studio-protocol`, with `version: null` for all `@remotion/*` dependencies):

```bash
npx make-pictures elements build --out=dist/elements
```

Generates `<out>/<slug>.json`, `<out>/<slug>/index.html`, and `<out>/index.json` for the 7 flagship elements: `editorial-media-card`, `floating-editorial-display`, `animated-bar-race`, `product-browser-frame`, `motion-diagram-stage`, `paper-cutout-3d`, and `smart-music-bed`.
