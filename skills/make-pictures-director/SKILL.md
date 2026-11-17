---
name: make-pictures-director
description: >-
  End-to-end 6-step production workflow for creating 60 FPS animated videos in
  make.pictures Studio (standalone create-make-pictures repos, embedded SaaS
  repos via make-pictures init --dir=videos, or the engine monorepo). Use this
  skill whenever starting a new film, selecting visual kits & styles,
  scaffolding productions/<slug>/, authoring production.json storyboards,
  running audio generation, inspecting Auto-Grid Contact-Sheet QA PNGs, or
  rendering mastered -14 LUFS MP4 videos.
---

# make.pictures Director — 6-Step Production Workflow (`60 FPS`)

Use this runbook to guide every new film from initial user idea and Art Direction matching to broadcast-mastered `60 FPS` MP4 across any `make.pictures` workspace.

---

## Project Modes & Universal CLI (`npx make-pictures`)

`make.pictures` runs identically across **3 workspace layouts** via the `@make-pictures/cli` binary (`npx make-pictures <command>`, also wired to `npm run <command>` in standalone and monorepo `package.json` files):

1. **Standalone Video Studio (`npx create-make-pictures@latest my-films`):**
   - Engine packages (`@make-pictures/{core,kits,studio,cli}`) live in `node_modules/`.
   - `productions/<slug>/` and reusable `styles/*.style.json` presets are the user's Git-tracked source code!
   - Commands: `npx make-pictures styles [--space=2d|2.5d|3d]`, `npx make-pictures style new <slug>`, `npx make-pictures new <slug> [--space=2d|2.5d|3d]`, `npx make-pictures audio`, `npx make-pictures studio`, `npx make-pictures qa <Id>`, `npx make-pictures render <Id>`.
2. **Embedded Inside an Existing SaaS / Web Repo (`npx make-pictures init --dir=videos [--space=2d|2.5d|3d]`):**
   - Keeps video capsules and custom brand styles neatly scoped under `<dir>/productions/<slug>/` and `<dir>/styles/` while `.agents/plugins/make-pictures` sits at repo root so agents can import real app UI components into `60 FPS` product videos.
   - Pass `--dir=videos` to CLI commands (`npx make-pictures styles --space=2d|2.5d|3d --dir=videos`, `npx make-pictures new <slug> --space=2d|2.5d|3d --dir=videos`, `npx make-pictures audio --production=<slug> --dir=videos`, `npx make-pictures studio --dir=videos`, `npx make-pictures qa <Id> --dir=videos`, `npx make-pictures render <Id> --dir=videos`).
3. **Engine Monorepo (`make-pictures-studio`):**
   - `packages/*` holds engine source; `examples/*` holds showcase demos; `styles/*.style.json` holds custom style presets; `productions/<slug>/` holds isolated user films (`npm run new -- <slug>` or `npx make-pictures new <slug>`). Never hardcode user scene IDs inside `packages/` or `scripts/`.

*(Bonus Mode — **Live Web Embeds**: applications can also `npm i @make-pictures/core @make-pictures/kits` and mount kits wrapped in `<StyleProvider style="minimal-product" renderBackdrop>` directly inside `<Player numberOfSharedAudioTags={32} />` from `@remotion/player` on React/Next.js pages with zero MP4 rendering!)*

### Capsule & Workspace Styles Layout

```text
styles/
└── <brand-or-era>.style.json        # Reusable custom StylePreset auto-discovered in Studio Web, QA & Render
productions/<slug>/
├── production.json                  # Unified manifest: scenes (TTS), score (Music), sfx (Foley)
├── index.ts                         # defineProduction(...) auto-discovered by Studio Web & Remotion
├── compositions/
│   ├── <PascalSlug>.tsx             # 60 FPS Remotion composition wrapped in <StyleProvider style={props.styleId}>
│   └── <PascalSlug>.props.json      # Disk-backed Props Inspector state (includes styleId)
├── assets/                          # Cached .mp3/.json voiceovers, AI score, SFX, videos/, and images
└── generated/
    └── audio-manifest.ts            # Auto-generated typed voiceover timestamps & asset paths
```

Static assets inside `productions/<slug>/assets/` are mirrored/symlinked to `public/_productions/<slug>`. Always resolve URLs with `staticFile(productionAssetPath(slug, relPath))` from `@make-pictures/core`.

---

## The 6-Step Interactive Production Process

### Step 1: Creative Brief & Mandatory Art Direction Gate (`style-and-art-direction`)

> **MANDATORY GATE:** Load `style-and-art-direction` FIRST! **Never** default blindly to `paper-diorama-3d`. Match the film's topic, era, emotion, and brand to both a **Visual Kit** (or multi-kit combination across acts) and a **`StylePreset`** (`BUILT_IN_STYLES` or a custom `styles/<slug>.style.json`).

Confirm with the user (or propose 2–3 tailored art direction options if given creative freedom):
1. **Topic, goal, and audience** (documentary essay, SaaS launch promo, architecture explainer, social reel, studio dialogue).
2. **Language & aspect ratio:** `pl` or `en`; horizontal `16:9` (`1920×1080`), vertical `9:16` (`1080×1920` Shorts/Reels/TikTok), or both.
3. **Visual Kit(s) — choose from all 7 scene kits** (load the matching `kit-*` skill before coding!):
   - `editorial-collage` — Magazine chapters, deterministic Ken Burns media frames, word-synced quote highlights & split layouts (`kit-editorial-and-vector`)
   - `vector-scene-2d` — Clean 2D story cards, pointer callouts & side-by-side comparisons (`kit-editorial-and-vector`)
   - `kinetic-typography` — High-retention word-by-word spotlights, impact badges & KPI tickers (`kit-kinetic-and-data`)
   - `data-storytelling` — Animated bar races, chronological timelines & before/after metric cards (`kit-kinetic-and-data`)
   - `motion-diagrams-2d` — Infinite-canvas 2D system architecture, API flows & SaaS product frames (`kit-motion-diagrams-2d`)
   - `paper-diorama-3d` — Tactile 2.5D layered cutouts on neutral `DioramaStage3D` (`kit-paper-diorama-3d`)
   - `isometric-3d` — Multi-character 3D dialogue on neutral `IsometricStage3D` (`kit-isometric-3d`)
4. **Dimensional Space (`--space=2d|2.5d|3d`) & Art Direction Style (`--style=<styleId>`):**
   - **2-Axis `DimensionalSpace × 10 Built-in Styles` (`ArtWorld`):**
     - **`2d`** (`--space=2d` defaults to `motion-diagrams-2d` + `minimal-product`): `minimal-product`, `retro-pc`, `cyber-telemetry` (`atelier`); `sketch-notebook` (`illustrative`); `brutalist-poster` (`editorial-gallery`)
     - **`2.5d`** (`--space=2.5d` defaults to `paper-diorama-3d` + `tactile-craft`): `tactile-craft` (`illustrative`); `editorial-press`, `archival-chronicle` (`editorial-gallery`)
     - **`3d`** (`--space=3d` defaults to `isometric-3d` + `soft-clay`): `soft-clay` (`illustrative`); `glass-studio`, `retro-pc`, `cyber-telemetry` (`atelier`)
     - Inspect via `npx make-pictures styles [--space=2d|2.5d|3d]` or preview live at `60 FPS` in **Studio Web → `🎨 Style Lab`** at `http://127.0.0.1:3000?view=styles`. To morph smoothly between two styles mid-scene without cutting, use `interpolateStylePresets(fromStyle, toStyle, progress)` from `@make-pictures/core`.
   - **Custom Brand / Era Style (`styles/<slug>.style.json`):** Create a bespoke style via `npx make-pictures style new <slug> --from=soft-clay` (including optional `preferredSpace`, `spaces`, `material3d`, and `artWorld: 'atelier' | 'illustrative' | 'editorial-gallery'`) and customize its palette, 13 `latin-ext` Google Fonts, surface chrome, and motion profile.

Scaffold the capsule immediately (append `--dir=<subdir>` if working inside a subdirectory studio):

```bash
# Quick space-first scaffolding (--space=2d|2.5d|3d picks flagship kit + style automatically unless overridden):
npx make-pictures new <slug> --space=3d --lang=pl
npx make-pictures new <slug> --space=2.5d --lang=pl
npx make-pictures new <slug> --space=2d --style=retro-pc --lang=pl

# Explicit kit + style scaffolding:
npx make-pictures new <slug> --kit=vector-scene-2d --style=minimal-product --lang=pl
npx make-pictures new <slug> --kit=editorial-collage --style=editorial-press --lang=pl
```

*(Supports `--space=2d|2.5d|3d`, all 7 kits via `--kit=...`, any of the 10 built-in or custom style slugs via `--style=...`, optional `--voice=<voiceId>` override, and `--lang=pl|en`. By default, `new` sets `styleId` in `*.props.json` and pairs `voiceId` + `score.moodPreset` in `production.json` from `style.audioDefaults` via `VOICE_ARCHETYPE_TO_ELEVENLABS_ID`.)*

---

### Step 2: Storyboard Pacing & `production.json` Manifest

Load `sound-and-music-design` and write `productions/<slug>/production.json` conforming to `ProductionManifest`:

```json
{
  "id": "printing-revolution",
  "title": "Jak prasa drukarska przyspieszyła naukę",
  "fps": 60,
  "scenes": [
    {
      "id": "s1-hook",
      "durationInSeconds": 4.5,
      "speaker": "Narrator",
      "voiceId": "EXAVITQu4vr4xnSDxMaL",
      "voiceEffect": "clean",
      "text": "W ciągu zaledwie pięćdziesięciu lat koszt książki spadł o osiemdziesiąt procent."
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

#### Director Pacing Law, Breathing Budget & Editorial Rules (`60 FPS` — Enforced by `npx make-pictures qa`)
- **Minimum `4.5 s` (`270` Frames) & Voiceover Breathing Formula (`computeSceneTimingFromVoiceover`):** Every visual scene in a `production` film MUST span **`>= 270` frames (`4.5 s` @ `60 FPS`)**, sequenced via `<ContinuousSceneFlow scenes={...} crossDissolveFrames={54} />` over a single top-level `<StyleProvider style={props.styleId} renderBackdrop>`. Always calculate each scene's duration from the real `.mp3` voiceover length using `computeSceneTimingFromVoiceover(voiceoverDurationSeconds, { isFinalScene })`:
  1. **Pre-Speech Settle:** **`~0.7 s` (`42` frames; hard minimum `36f`)** so the visual card/shot settles before the first spoken syllable.
  2. **Post-Speech Hold:** **`~1.5–1.7 s` (`90–102` frames; default `96f`, hard minimum `90f`)** of calm visual & musical breathing room after the last word.
  3. **Final-Scene Outro Hold:** **`+2.2–2.5 s` (`132–150` frames; default `144f`, hard minimum `132f`)** paired with `<SmartMusicBed fadeOutFrames={90} />`.
- **Sub-View Budget (`<= 2` Sub-Views via `<SceneSubViewDissolve />`):** Keep at most **1 evolving layout** OR **2 spacious sub-views (`View A → View B`)** connected via `<SceneSubViewDissolve switchAtFrame={...} dissolveFrames={54} />` (`48–60` frames). **3+ sub-views inside one scene are banned** — split them into separate scenes in `production.json`.
- **Single Focal Point (`useFocalStagger` & `CINEMATIC_SPRINGS`):** Keep at most **1 primary focal hero** entering at once (`useFocalStagger(frame, fps)` staggers `lead` at `frame >= 2`, `support` at `+22f`, and `ambient` at `+40f`). **Never** mount `<WordByWordStage>` in the same scene/component as `<ImpactKeywordCard>`, `<StoryCard2D>`, `<MetricComparisonCard>`, or `<SystemNode>`.
- **Conversational Script, Calm Cadence (`<= 2.8 words/s`) & Zero SKU Codes:** Open `s1-hook` in clear, conversational language (never buzzword soup). Never read catalog SKUs or hardware part numbers (`DK-940X-TB4`) aloud in `scene.text` — state the concrete user benefit in speech and place model series in a visual `badge`. Set natural `voiceSettings.speed: 0.98–1.00`.
- **1080p Legibility (`>= 18–19 px`) & "Headline + 1 Concise Sentence" Card Rule:** Never render screen text `< 18px` (`TYPOGRAPHY_FLOOR_1080P`). Write cards as **Headline (`26–32 px`, `2–5` words) + 1 concise sentence (`19–22 px`, `6–11` words)** (`height: 'auto'`, `justifyContent: 'center'`, `boxSizing: 'border-box'` — never empty `space-between` voids; use `<HorizontalFeatureGrid2x2 />` for `2×2` summaries and `<EditorialPanoramaTrack />` instead of `3×2` tile grids).
- **Rounded-Card Clipping Precision (`<ClippedSurfaceChrome />`) & Remotion `<Img>`:** Wrap internal top accent bars on `overflow: 'visible'` cards inside `<ClippedSurfaceChrome />`, and always use `<Img>` from `'remotion'` (never raw HTML `<img>`).
- **No Bottom Subtitles by Default & Polish Sentence Case:** Omit burned-in bottom captions unless requested; write Polish headings in *Sentence case* (`Jak działa pamięć podręczna`), never Anglo-Saxon Title Case.

---

### Step 3: Unified Audio Generation, Asset Cutout Hygiene & Mandatory `.mp3` Audition

1. Run `npx make-pictures doctor` (or `npx make-pictures onboard`) if this is the first session.
2. Generate voiceovers + word timestamps + AI music score + AI SFX (automatically runs `lintManifestVoiceovers` checking Polish **głoskowce** `"api"` vs hyphenated **literowce** `"u-es-be"` and catalog SKUs):
   ```bash
   npx make-pictures audio --production=<slug>
   ```
   *(Add `--mock` for offline/zero-credit procedural synthesis, `--force` to bypass SHA-256 cache, or `--dir=<subdir>` in embedded SaaS repos.)*
3. **MANDATORY `.mp3` LISTEN GATE & TIMING RECALCULATION:** Inspect every newly generated `.mp3` inside `productions/<slug>/assets/` via `read_file` to verify pronunciation and unclipped word endings, then compute exact scene frame spans via `computeSceneTimingFromVoiceover`.
4. **Style-Anchored AI Illustrations & Safe Cutout Protocol (`image --style` & `cutout`):**
   - Generate cohesive raster illustrations via `npx make-pictures image "<subject>" --style=<styleId> --out=productions/<slug>/assets/hero.png` (automatically prepends the style's `Base Style Anchor` and appends a strict no-text guard clause).
   - When extracting bright objects or hardware from PDFs or white-background photos, **NEVER** apply global white thresholding (`rgb > 245 => alpha = 0` or `colorkey=white`), which punches transparent holes inside silver/white enclosures! Always run:
     ```bash
     npx make-pictures cutout <source.pdf|photo.png> --out=productions/<slug>/assets/device.png
     ```
     which extracts native PDF `/SMask` RGBA streams or runs **Exterior Border Flood-Fill**, checks `detectInteriorAlphaHoles`, and emits a `#0F172A`/`#1E293B` Dark Checkerboard QA PNG that you MUST inspect with `read_file`.

---

### Step 4: `60 FPS` Implementation, `<StyleProvider>`, `zod` Schema & Director Timeline Metadata

1. **Read `<PascalSlug>.props.json` (and any `styles/*.style.json`) from disk first** before editing existing files so you never overwrite tweaks saved by the creator in **Studio Web** (`npx make-pictures studio`).
2. Wrap the composition in `<StyleProvider style={props.styleId} renderBackdrop>` and keep `styleId: z.string().describe('Kolory & Styl :: Styl bazowy (Style ID)')` in your exported `zod` schema alongside `'Section :: Label'` props (`'Teksty & Napisy :: Tytuł'`, `'Audio :: Głośność muzyki'`).
3. Load `cinematography-and-vfx` + your chosen `kit-*` skill(s). Compose multi-scene arcs with `<ContinuousSceneFlow scenes={...} crossDissolveFrames={54} />` (which automatically hands off `usesThree: true` → `usesThree: true` transitions via a luminous veil so **at most 1 WebGL `<ThreeCanvas>`** is mounted on any frame) and `interpolateStylePresets` for liquid style morphing. Synchronize visuals and audio via `getWordTriggerFrame(sceneId, word, fallbackFrame, voiceoverManifest?)`, `getSpeechStateAtFrame(sceneId, localFrame, voiceoverManifest?)`, `<VoiceoverTrack />`, `<SmartMusicBed />`, and `<SoundCue />` (never wrap `<Audio />` in `<Sequence>` without `durationInFrames`).
4. Wrap `productions/<slug>/index.ts` with `defineProduction({ id: '<slug>', manifest, voiceoverManifest, compositions: [...] })` from `@make-pictures/core` (auto-registering capsule timestamps and setting `origin: 'production'`, `productionId`, `sceneTimeline`, `cameraTimeline`, `sfxTimeline`, and `hasMusicScore`) so the Multi-Track Director Timeline in **Studio Web** visualizes every cut, voiceover segment, SFX cue, and ducking envelope.

---

### Step 5: Hard Director QA Gate & Auto-Grid Contact-Sheet Visual QA (`qa`)

Before running a full MP4 render, run the automated Director QA Gate + Auto-Grid Contact-Sheet PNG (`--grid=auto` by default, guaranteeing **100% scene and `subViews` coverage** even on 8–12 scene narratives):

```bash
npx make-pictures qa <CompositionId>
```

*(Optional flags: `--grid=auto|4x3`, `--out=out/qa-<CompositionId>.png`, `--dir=<subdir>`, and `--allow-fast-cuts` ONLY for intentional fast-cut `9:16` poster reel exceptions.)*

**Automated Hard Director Gate (`auditCompositionDirection`, `verifyCleanFrameZeroImage` & Chromium DOM Audit):**
By default, `npx make-pictures qa` fails fast with a `DirectorAuditError` if any of these invariants are violated:
1. **`MIN_SCENE_SPAN` (`>= 4.5 s` / `270f`):** Every visual scene span in `sceneTimeline` and every visual `<Sequence durationInFrames={N}>` (without `layout="none"`) in `origin: 'production'` must be `>= 270` frames.
2. **`INSUFFICIENT_BREATHING_ROOM` & `READING_CADENCE_OVER_BUDGET`:** Verifies `<= 2.8` words/s plus **`pre >= 36f` (`0.6s`, target `42f`)**, **`post >= 90f` (`1.5s`, target `96f`)**, and **`outro >= 132f` (`2.2s`, target `144f`)** around every scene voiceover.
3. **`EXCESSIVE_SUBVIEWS` & `COMPETING_FOCAL_POINT`:** Rejects `> 2` `subViews` or multiple `<SceneSubViewDissolve>` blocks in one scene, and blocks mounting `<WordByWordStage>` alongside cards/nodes.
4. **`CHOPPY_SCENE_TRANSITION` & `UNCLIPPED_CARD_BAR`:** Rejects abrupt `<SceneTransition>` cuts/wipes and unclipped `top: 0` bars on `overflow: 'visible'` cards without `<ClippedSurfaceChrome>`.
5. **`RAW_HTML_IMG_TAG`, `FONT_BELOW_1080P_FLOOR` & `CARD_VERTICAL_VOID`:** Rejects raw `<img>` (use `<Img>` from `'remotion'`), rejects explicit or rendered text `< 18px` at `1080p`, and rejects vertical flex cards with `> 42%` (`> 140px`) dead empty space between children.
6. **`DIRTY_FRAME_ZERO` (`0.00` Full-Resolution Variance + Empty DOM):** Decodes full-resolution `raw-0.png` RGB24 pixels requiring exact `0.00` RGB channel variance & spread, plus zero visible foreground DOM elements on `f=0`.

**MANDATORY VISUAL INSPECTION:** Open `out/qa-<CompositionId>.png` with `read_file` and verify every tile (`f=0` clean board, `sceneId/subViewId` badges covering 100% of scenes/sub-views, `>= 18–19px` legibility, "Headline + 1 sentence" card balance, `Δx = 0.00px` on `<PinnedMediaStage />`, and `9:16` elements strictly inside the green **Golden Safe Box `x ∈ [40, 910], y ∈ [220, 1380]`**).

---

### Step 6: Typecheck, Broadcast-Mastered Render (`-14 LUFS`) & Final `.mp4` Audition

1. Validate TypeScript across the project:
   ```bash
   npm run typecheck
   ```
2. Render the final `60 FPS` MP4 (automatically enables `--concurrency=100%`, `--gl=angle` for 3D, and EBU R128 `-14 LUFS` loudness mastering; pass `--no-master` only if raw unmastered audio is explicitly requested):
   ```bash
   npx make-pictures render <CompositionId> out/<slug>.mp4
   ```
3. **MANDATORY FINAL `.mp4` MIX AUDITION:** After rendering, check the mastered `out/<slug>.mp4` audio-visual mix (verifying `<SmartMusicBed fadeOutFrames={90} />` ducking, `<SoundCue />` subtlety, Polish `"api"` vs `"u-es-be"` phonetics, and unclipped scene transitions).

---

## Embedding `.mp4` Screen Recordings (`<OffthreadVideo />` + `@make-pictures/kits/product-frames`)

SaaS walkthroughs and product demos usually start from a real screencast. Every capsule ships with `productions/<slug>/assets/videos/` for exactly this.

1. Drop the recording into `productions/<slug>/assets/videos/demo.mp4` (H.264 MP4 at 30 or 60 FPS works best).
2. It is mirrored to `public/_productions/<slug>/videos/demo.mp4`, so reference it with `staticFile('_productions/<slug>/videos/demo.mp4')` (or `staticFile(productionAssetPath('<slug>', 'videos/demo.mp4'))`).
3. Wrap it in a device frame inside `<StyleProvider>`. Both frames inherit theme accents from `useStudioStyle()` and render the video through Remotion `<OffthreadVideo />`, so the output is frame-accurate under `--concurrency=100%`:

```tsx
import { staticFile } from 'remotion';
import { StyleProvider, productionAssetPath } from '@make-pictures/core';
import {
  BrowserFrame,
  PhoneFrame,
  ScreenSpotlightOverlay,
} from '@make-pictures/kits/product-frames';

const DEMO = staticFile(productionAssetPath('my-film', 'videos/demo.mp4'));

<StyleProvider style={props.styleId} renderBackdrop>
  {/* 16:9 desktop SaaS */}
  <BrowserFrame url="app.example.com/dashboard" videoSrc={DEMO} startFrom={0} width={1360} enterFrame={2}>
    <ScreenSpotlightOverlay x={62} y={18} width={30} height={14} startFrame={90} endFrame={210} label="Nowy raport" />
  </BrowserFrame>

  {/* 9:16 mobile app (default 520 px wide, fits the Golden Safe Box x ∈ [40, 910], y ∈ [220, 1380]) */}
  <PhoneFrame videoSrc={DEMO} variant="dynamic-island" />
</StyleProvider>
```

- **`BrowserFrame` props:** `url`, `title`, `variant: 'macos' | 'arc' | 'minimal'`, `theme: 'dark' | 'light'`, `width` (default `1360`), `aspectRatio` (default `'16 / 10'`) or `height`, `enterFrame` (default `2`), `accentColor`, plus media props `videoSrc` / `imageSrc` / `startFrom` / `endAt` / `playbackRate` / `muted` (default `true`) / `volume` / `objectFit`.
- **`PhoneFrame` props:** `variant: 'dynamic-island' | 'minimal'`, `theme`, `width` (default `520`), `aspectRatio` (default `'9 / 19.5'`) or `height`, `enterFrame`, plus the same media props.
- **`ScreenSpotlightOverlay` props:** `x`, `y`, `width`, `height` (percent `0..100` by default, or `unit="px"`), `startFrame`, `endFrame?`, `label?` (2–3 words), `accentColor` (defaults to `useStudioStyle().palette.accentPrimary`), `dimOpacity` (default `0.45`), `borderRadius` (default `14`), `labelPosition: 'auto' | 'top' | 'bottom'`.
- **Zoom shots:** Put the frame inside `<DirectorCamera2D nodes={{ app: { cx, cy, w, h }, cta: {...} }} shots={[...]}>` to push in on the spotlighted region (`transition: 'glide'`) the way Screen Studio does.
- Keep `muted` on unless the recording's own audio matters. The voiceover and `SmartMusicBed` carry the soundtrack.
- Check in `npx make-pictures qa <CompositionId>` that `f=0` is clean (frames start at `opacity: 0`) and that the spotlight ring sits exactly on the intended UI element.
