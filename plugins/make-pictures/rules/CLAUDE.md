# CLAUDE.md — Claude Code Instructions for `make.pictures` Studio

Welcome to **make.pictures** ([https://make.pictures](https://make.pictures)) — an open-source `60 FPS` Video-as-Code studio and npm ecosystem (`create-make-pictures`, `@make-pictures/core`, `@make-pictures/kits`, `@make-pictures/studio`, `@make-pictures/cli`) built with **Remotion**, **Three.js (`@remotion/three`)**, **TypeScript**, **Zod**, and **ElevenLabs** (TTS + AI Music + AI SFX).

> **IMPORTANT:** Read [`AGENTS.md`](./AGENTS.md) alongside this file for universal studio invariants, and use **Progressive Skill Loading** from `.claude/skills/` / `.agents/plugins/make-pictures/skills/` (or [`plugins/make-pictures/skills/`](./plugins/make-pictures/skills/) in the engine monorepo) so you load only the exact domain rules needed for your active task.

---

## 3 Official Workspace Modes

`make.pictures` supports three first-class workflows via the `@make-pictures/cli` binary (`npx make-pictures <command>`):

1. **Standalone Video Studio (`npx create-make-pictures@latest my-films`):**
   - `productions/*` and custom `styles/*.style.json` presets are the user's Git-tracked source code; the engine runs cleanly from `node_modules/@make-pictures/*`.
2. **Embedded Inside an Existing SaaS / App Repo (`npx make-pictures init --dir=videos`):**
   - Adds `videos/productions/` + `videos/styles/` and syncs `.agents/plugins/make-pictures` AI skills (plus `.claude/skills/`) into a Next.js/Vite/monorepo codebase so agents can turn real UI components into `60 FPS` launch videos. Pass `--dir=videos` to CLI commands (`npx make-pictures studio --dir=videos`, `npx make-pictures qa <Id> --dir=videos`).
3. **Live Interactive Web Embeds (`npm i @make-pictures/core @make-pictures/kits`):**
   - Import subpath kits (e.g., `@make-pictures/kits/vector-scene-2d`, `@make-pictures/kits/editorial-collage`, `@make-pictures/kits/motion-diagrams-2d`, `@make-pictures/kits/isometric-3d`) wrapped in `<StyleProvider style="minimal-product" renderBackdrop>` directly inside `<Player numberOfSharedAudioTags={32} />` from `@remotion/player` on React/Next.js pages without rendering MP4 files.

*(When developing inside the `make-pictures-studio` engine monorepo itself: `packages/*` holds publishable packages, `examples/*` holds showcases, `styles/*.style.json` holds local custom art direction presets, and `productions/<slug>/` holds isolated user films.)*

---

## Quick Reference Commands (`npx make-pictures` / `npm run`)

- `npx make-pictures onboard` (`npm run onboard`; pass `--json` for explicit agent JSON mode) — Interactive terminal setup (or agent JSON workflow when run by an AI agent / `--json`): verifies `node_modules` & `ffmpeg`, authorizes `ELEVENLABS_API_KEY` into `.env.local` (powering TTS, Music & SFX; never print `.env.local` in chat!), and checks `60 FPS` readiness.
- `npx make-pictures doctor` (`npm run doctor`) — Validate Node.js, FFmpeg, `.env.local`, ElevenLabs API connectivity, and Remotion readiness.
- `npx make-pictures init [--dir=videos] [--space=2d|2.5d|3d] [--kit=vector-scene-2d] [--style=minimal-product] [--lang=pl|en]` — Initialize `make.pictures`, `styles/`, and `.agents/plugins/make-pictures` inside an existing SaaS/app repository.
- `npx make-pictures styles [--space=2d|2.5d|3d] [--json] [--dir=.]` — List all **10 built-in styles** (`minimal-product`, `sketch-notebook`, `retro-pc`, `brutalist-poster`, `cyber-telemetry`, `tactile-craft`, `editorial-press`, `archival-chronicle`, `soft-clay`, `glass-studio`) across `DimensionalSpace ('2d' | '2.5d' | '3d')` (e.g., `npx make-pictures styles --space=3d`), custom workspace presets in `styles/*.style.json`, and all **7 visual kits**.
- `npx make-pictures style new <slug> [--from=soft-clay] [--force] [--dir=.]` — Scaffold a reusable custom art direction preset at `styles/<slug>.style.json`.
- `npx make-pictures new <slug> [--space=2d|2.5d|3d] [--kit=vector-scene-2d|editorial-collage|kinetic-typography|data-storytelling|motion-diagrams-2d|paper-diorama-3d|isometric-3d] [--style=<styleId>] [--voice=<voiceId>] [--lang=pl|en] [--dir=.]` — Scaffold a clean production capsule in `productions/<slug>/` (e.g., `npx make-pictures new <slug> --space=3d`, `--space=2d --style=retro-pc`, or `--kit=editorial-collage --style=editorial-press`).
- `npx make-pictures audio [--production=<slug>] [--mock] [--force] [--dir=.]` — Lint Polish/English TTS phonetics (`głoskowce` `"api"` vs hyphenated `literowce` `"u-es-be"`, SKU codes), synthesize word-aligned `.mp3`/`.json` voiceovers (`speed: 0.99`), AI Music score, and AI SFX (`productions/<slug>/generated/audio-manifest.ts`). Shortcuts: `music`, `sfx`.
- `npx make-pictures image "<prompt>" --out=<file.png> [--style=<styleId>]` — Generate style-anchored illustration assets with an automatic `Base Style Anchor` and unconditional no-raster-text guard clause.
- `npx make-pictures cutout <source.pdf|photo.png> --out=<file.png> [--page=1]` — Extract lossless PDF `/SMask` RGBA streams or run Exterior Border Flood-Fill (never global white thresholding!) with interior alpha-hole detection and a `#0F172A`/`#1E293B` Dark Checkerboard QA sheet.
- `npx make-pictures studio [--port=3000] [--dir=.]` (`npm run studio`) — Launch **Studio Web** (`http://127.0.0.1:3000`): `60 FPS` HMR `<Player />`, **`🎬 Filmy` | `🎨 Style Lab` (`?view=styles`)** live `[ 2D ] [ 2.5D ] [ 3D ]` × 10 built-in & custom style previewer, Origin Filter (`All | Examples | Productions`), Multi-Track Director Timeline, *Golden Safe Box `9:16`*, and Props Inspector (`zod` ↔ `*.props.json` & `styles/*.style.json`).
- `npx make-pictures qa <CompositionId> [--grid=auto|4x3] [--dir=.]` (`npm run qa -- <CompositionId>`) — Run the hard **Director QA Gate** (`>= 4.5 s` scenes, `pre >= 36f` / `post >= 90f` / `outro >= 132f` breathing room, `<= 2` sub-views, `<Img>`, `>= 18px` 1080p typography floor, card void check, Clean `f=0` `0.00` variance) and render an auto-sized **Contact-Sheet QA** PNG (`out/qa-<CompositionId>.png`, `--grid=auto` covering 100% of scenes & sub-views) with `sceneId/subViewId` badges and `9:16` Golden Safe Box overlays.
- `npm run typecheck` — Run `tsc --noEmit` across the workspace.
- `npx make-pictures render <CompositionId> [outPath] [--dir=.]` (`npm run render -- <CompositionId>`) — Render `60 FPS` MP4 (`--concurrency=100%`, automatic `--gl=angle` for 3D) with broadcast `-14 LUFS` EBU R128 loudness mastering, then audition the final mastered `.mp4` mix.

---

## Core Architectural Invariants

1. **Mandatory Step 1 Art Direction Gate (`DimensionalSpace ('2d' | '2.5d' | '3d') × StylePreset`):**
   - **Never default blindly to `paper-diorama-3d` or rigid `3×2` blinking tile grids.** Match topic, era, and brand across **`DimensionalSpace ('2d' | '2.5d' | '3d') × StylePreset`** (`7` scene kits × `10 BUILT_IN_STYLES` or custom `styles/*.style.json`) wrapped in a single top-level `<StyleProvider style={props.styleId} renderBackdrop>`. Visualize multi-category enumerations via `<EditorialPanoramaTrack />`, layered editorial collage, or spatial cross-sections.
2. **Clean Capsule Architecture (`productions/<slug>/`), Voiceover Breathing Budget & Sub-View Limit:**
   - Every user video lives inside `productions/<slug>/`. Compute scene durations with `computeSceneTimingFromVoiceover`: **`~0.7 s` (`42f`)** pre-speech settle, **`~1.5–1.7 s` (`90–102f`)** post-speech hold, and **`+2.2–2.5 s` (`132–150f`)** outro hold (`<SmartMusicBed fadeOutFrames={90} />`).
   - Sequence multi-scene films via `<ContinuousSceneFlow crossDissolveFrames={54} />` + `<OpticalCrossDissolve />` (with `<ClippedSurfaceChrome />` on `overflow: 'visible'` rounded cards). Limit each scene to at most `1` evolving layout or `2` sub-views via `<SceneSubViewDissolve />` (`48–60f`; `3+` sub-views per scene are banned).
3. **100% Determinism, `<Img>` Hygiene, Single-Source Bezier & Typography Floor (`>= 18px`):**
   - **Frame `0` is 100% uniform `bgCanvas` (`0.00` RGB variance):** Start entrance springs at `frame - 2`, always use `<Img>` from `'remotion'` (never raw `<img>`), avoid visual noise (packet clouds, radar rings), compute SVG curves & pulses from one `buildCubicBezierPath` / `evaluateCubicBezier` (`packetCount={0}` default), and pin media callouts with `<PinnedMediaStage />` (`Δx = 0.00 px`).
   - **1080p Legibility & Card Density (`TYPOGRAPHY_FLOOR_1080P`):** Never render screen text `< 18px`. Follow **"Headline (`26–32 px`, `2–5` words) + 1 concise sentence (`19–22 px`, `6–11` words)"**, use `boxSizing: 'border-box'` on all containers/`WorldBox`, center card content (`height: 'auto'`, `justifyContent: 'center'` — never stretch sparse cards with `space-between`; use `<HorizontalFeatureGrid2x2 />` for `2×2` summaries), and keep sparse Foley (`3–5` cues at `0.14–0.26`).
   - **Zero `Math.random()`, zero cross-frame `useRef`, finite `<Audio />` lifetimes:** Use `createSeededRandom(seed)`, offline `<StudioHdrRig3D />`, `<VoiceoverTrack />`, and `<SoundCue />`.
4. **Props & Style Contract (`zod` ↔ `*.props.json` & `styles/*.style.json`):**
   - Export a `z.object` schema with `.describe('Section :: Label')` (including `styleId`) and store defaults in `<CompositionId>.props.json`. **Always read `*.props.json` and `styles/*.style.json` from disk before editing** to preserve live tweaks saved in **Studio Web** and **🎨 Style Lab**.
5. **Mandatory Quality Gates Before & After Render:**
   - **Phonetics & Asset QA:** Verify Polish **głoskowce** (`"api"`, `"ram"`, `"lan"`, `"led"`) vs hyphenated **literowce** (`"u-es-be"`, `"es-ku-el"`, `"ce-er-em"`), listen to `.mp3` voiceovers, and inspect dark-checkerboard PNGs from `npx make-pictures cutout`.
   - **Hard Director Gate & Auto-Grid Contact-Sheet QA:** Run `npx make-pictures qa <CompositionId>` (`--grid=auto`) and inspect `out/qa-<CompositionId>.png` (`100%` scene/sub-view coverage, `f=0` clean board, `>= 18px` legibility, `9:16` **Golden Safe Box `x ∈ [40, 910], y ∈ [220, 1380]`**).
   - **Typecheck & Final `.mp4` Audition:** Run `npm run typecheck`, render via `npx make-pictures render <CompositionId>`, and audition the mastered `-14 LUFS` `.mp4` mix.

---

## Progressive Skill Library (9 Skills in `.claude/skills/` / `.agents/plugins/make-pictures/skills/`)

Load the relevant `SKILL.md` **before** choosing styles, authoring scripts, audio specs, cameras, or visual scenes:

| Task / Layer | Skill Name |
| :--- | :--- |
| **6-Step Director Workflow, `production.json`, `--space=2d\|2.5d\|3d`, `ContinuousSceneFlow` (`>= 4.5 s` / `>= 270f`) & Hard `qa` Gate** | `make-pictures-director` |
| **Step 1 Art Direction Gate: `DimensionalSpace ('2d' \| '2.5d' \| '3d') × 10 BUILT_IN_STYLES` + `styles/*.style.json`, `<StyleProvider>`, `material3d` & 🎨 Style Lab** | `style-and-art-direction` |
| **Editorial Collage (`ChapterTitleCard`, `EditorialMediaCard`, `HighlightQuoteStage`, `SplitStoryLayout`) & Vector Scene 2D (`StoryCard2D`, `AnnotatedCallout2D`, `ComparisonSplit2D`)** | `kit-editorial-and-vector` |
| **2.5D Layered Cutout Stage (`DioramaStage3D`, `PaperCutout3D`, `PopUpHinge3D`, and the 9 `ScenicCutoutMotifs` including Apollo 11 `StarryCosmosBackdropCutout3D`, `EarthriseCutout3D`, `LunarCraterRidgeCutout3D`, `LunarLanderCutout3D`)** | `kit-paper-diorama-3d` |
| **2D Infinite-Canvas & Retro-PC Diagrams (`RetroPcWindowStage2D`, `MotionDiagramStage2D`, `SystemNode`, `DataFlowEdge`, `NodeBox` Ports, `FlowCurve`)** | `kit-motion-diagrams-2d` |
| **SaaS `.mp4` Screen Recordings (`@make-pictures/kits/product-frames`: `BrowserFrame`, `PhoneFrame`, `ScreenSpotlightOverlay`)** | `kit-motion-diagrams-2d` + `make-pictures-director` |
| **3D Soft-Clay, Offline Spatial IBL & Isometric Studio (`StudioHdrRig3D`, `ClayCharacter3D`, `PodcastStudioSet3D`, `IsometricStage3D`, `Stylized3DCharacter`)** | `kit-isometric-3d` |
| **Kinetic Typography & Data Storytelling (`WordByWordStage`, `ImpactKeywordCard`, `AnimatedMetricCounter`, `AnimatedBarRace`, `TimelineTrack`, `MetricComparisonCard`)** | `kit-kinetic-and-data` |
| **ElevenLabs Voices, PL/EN Phonetics, AI Music (`SmartMusicBed`, 7 `moodPreset`s) & AI SFX (`SoundCue`, `-14 LUFS`)** | `sound-and-music-design` |
| **Continuous Scene Flow & Shot DSL (`ContinuousSceneFlow`, `OpticalCrossDissolve`, `ClippedSurfaceChrome`, `ScenicBackdropLayers`, `DirectorCamera3D/2D`, `9:16` Safe Box & VFX)** | `cinematography-and-vfx` |
