# CLAUDE.md — make.pictures v3.0 Instructions (Remotion Toolkit)

**make.pictures** ([https://make.pictures](https://make.pictures)) is a `60 FPS` **Production & Audio/QA Toolkit for Remotion + AI Agents**: `@make-pictures/remotion` (2D/2.5D/3D kits, 10 styles, StyleLab, Remotion Elements, Disney kinematics, 3D SAT collision proofs), `@make-pictures/cli`, and ultra-thin `create-make-pictures`.

> **Tandem Skills Contract:** Load official **`remotion-dev/skills`** (`npx remotion skills add`) for base Remotion APIs (`<Composition>`, `spring()`, `interpolate()`, `<Img>`, `<OffthreadVideo>`, `npx remotion studio`, `remotion render`). Read [`AGENTS.md`](./AGENTS.md) and progressively load the **5 canonical skills** in [`skills/`](./skills/) for make.pictures art direction, kits, audio, and QA.

## Workspace Modes & Native Remotion Workflow
1. **Fresh Project (`npx create-make-pictures@latest my-films` / `npx -y @make-pictures/cli@latest onboard`):** Standard Remotion 4 + React 19 repo (`src/index.ts`, `src/Root.tsx` with `StyleLab` from `@make-pictures/remotion/style-lab`, `remotion.config.ts`).
2. **Existing Remotion Project (`npx make-pictures init`):** Add-on in-place without modifying your existing `src/Root.tsx`. Optional root `make-pictures.json` overrides `{ entryPoint, publicDir, videosDir, stylesDir, lang, fps }`.
3. **Embedded in SaaS Repo (`npx make-pictures init --dir=videos`)** or **Live Web Embeds (`@remotion/player` with `numberOfSharedAudioTags={32}`)**.

## Quick Reference CLI (`npx make-pictures`)
- `onboard` / `init [--dir=videos]` / `doctor` — 3-mode setup (`create-make-pictures` | existing Remotion | SaaS `--dir=videos`), tandem `remotion-dev/skills` + 5 local skills, `ffmpeg` check, optional `ELEVENLABS_API_KEY` into `.env.local` (never print `.env.local`; `--mock` works offline).
- `styles [--space=2d|2.5d|3d] [--json]` / `style new <slug> --from=<id>` — Browse all 10 built-in styles and scaffold custom `styles/<slug>.style.json`.
- `new <slug> [--space=2d|2.5d|3d] [--kit=...] [--style=...] [--lang=pl|en]` — Scaffold `src/videos/<slug>/` (`audio.json` + `<Comp>.tsx`) and register `<Composition>` directly in `src/Root.tsx`.
- `voices [--lang=pl|en] [--audition="..." --voice=<id>]` — Browse native ElevenLabs voices (never use English premade voices like Liam/Sarah/Brian/George for Polish!).
- `audio [slug] [--mock] [--force]` (shortcuts: `music`, `sfx`) — Lint phonetics & `eleven_v4`/`eleven_v3` tags/stability, synthesize `public/audio/<slug>/*.mp3` + `generated/audio-manifest.ts` (TTS, `dialogueInputs` Text-to-Dialogue with `voiceSegments`, AI Music, AI SFX).
- `image "<prompt>" --style=<id> --out=...` / `cutout <file> --out=...` / `assets clean-scan|sheet` — Style-anchored zero-text rasters, lossless `/SMask` or Exterior Border Flood-Fill cutouts (never global white thresholding `rgb > 245 => alpha = 0`), scan border cleanup, and dark-checkerboard contact sheets.
- `studio` — Thin passthrough launching native **`npx remotion studio`** (edit Zod `schema` props & `StyleLab` live at `60 FPS`).
- `qa <CompositionId> [--grid=auto] [--audio=<path>]` — Native `@remotion/renderer` `selectComposition` Director QA Gate + Auto-Grid Contact Sheet (`out/qa-<CompositionId>.png`).
- `render <CompositionId> [outPath]` — `60 FPS` render (`--concurrency=100%`, auto `--gl=angle` for 3D) + EBU R128 `-14 LUFS` mastering.
- `elements build [--out=dist/elements]` — Export the 7 flagship `@remotion/studio-protocol` Remotion Elements (`version: null` for `@remotion/*`).

## Core Production Invariants
1. **Step 1 Art Direction Gate (`DimensionalSpace × StylePreset`):** Never blindly default to `paper-diorama-3d` or `3×2` blinking tile grids. Match topic/era across `2d | 2.5d | 3d` × 10 `BUILT_IN_STYLES` (`minimal-product`, `editorial-press`, `archival-chronicle`, `cyber-telemetry`, `brutalist-poster`, `sketch-notebook`, `tactile-craft`, `retro-pc`, `soft-clay`, `glass-studio`) or `styles/*.style.json` inside one top-level `<StyleProvider style={props.styleId} renderBackdrop>`.
2. **Pacing (`>= 4.5 s` / `270f`) & Breathing Room:** Sequence scenes via `<ContinuousSceneFlow crossDissolveFrames={54} />` (`<= 2` sub-views via `<SceneSubViewDissolve />`). Compute durations via `computeSceneTimingFromVoiceover`: `~42f` pre-speech settle, `90–102f` post-speech hold, `132–150f` final outro hold (`<SmartMusicBed fadeOutFrames={90} />`).
3. **Determinism, Clean `f=0`, `<Img>` & Typography Floor (`>= 18 px`):** Frame `0` is uniform `bgCanvas` (`0.00` variance); start springs at `frame - 2`; zero `Math.random()` (`createSeededRandom`) or cross-frame `useRef`; always use `<Img>`, `<ClippedSurfaceChrome />` on `overflow: 'visible'` rounded cards, `boxSizing: 'border-box'`, single-source `buildCubicBezierPath`/`evaluateCubicBezier` (`packetCount={0}`), and `<PinnedMediaStage />` (`Δx = 0.00 px`). Follow `TYPOGRAPHY_FLOOR_1080P`: **Headline (`26–32 px`, `2–5` words) + 1 sentence (`19–22 px`, `6–11` words)**, `height: 'auto'`, `justifyContent: 'center'` (no `space-between` voids), `>= 60%` primary visual fill.
4. **3D Physics, Sync IBL & Zero Collisions:** Root `@make-pictures/remotion` and `@make-pictures/remotion/kinematics` have zero `three` imports. Use `@make-pictures/remotion/kinematics` (`disneyEase`, `evaluateArc3D`, 15-axis OBB SAT `obbClearanceSat3D` / `auditSceneCollisions3D`), `@make-pictures/remotion/camera` (`DirectorCamera3D`, `computeCameraBasis3D`), `@make-pictures/remotion/kits/tactile-3d` (`DeformableSheet3D`, `ScreenGlassLayer3D`, `SyncStudioIbl3D`, `getProceduralPbrMaps`, `DaylightArcRig3D`), and frameless `<FloatingEditorialDisplay />` / `<PaperRibbonTimeline />`.
5. **Expressive `eleven_v4` Audio & Quality Gates:** Default to `eleven_v4` (`[thoughtful]`, `[warmly]`, `[playful]`, `[amazed]`; discrete `stability ∈ {0.0, 0.5, 1.0}` for `eleven_v3`), `dialogueInputs` for multi-speaker dialogues, Polish **głoskowce** (`"api"`) vs hyphenated **literowce** (`"u-es-be"`), sparse Foley (`3–5` cues at `0.14–0.26`), and viewer-focused copy (zero engine-spec flexing or SKUs). Always run: Pilot Demo (`2–3` shots) + fact-check → `.mp3` audition → `auditSceneCollisions3D` (3D) → `npx make-pictures qa` (`out/qa-<Id>.png`, `9:16` Safe Box `x ∈ [40, 910], y ∈ [220, 1380]`) → `npm run typecheck` → `npx make-pictures render` → final `.mp4` mix audition.

## Progressive Skill Library (5 Canonical Skills in `skills/`)
| Task / Layer | Skill (`skills/<name>/SKILL.md`) |
| :--- | :--- |
| 6-step workflow, `audio.json`, `make-pictures.json`, `src/Root.tsx`, pacing, `qa`, `render`, `elements` | `make-pictures-director` |
| `DimensionalSpace × 10 styles`, `StyleLab`, `>= 18px` typography, `image` / `cutout` / `assets` hygiene | `art-direction-and-styles` |
| ElevenLabs `eleven_v4`/`v3`, `dialogueInputs`, native PL/EN voices, phonetics, `SmartMusicBed`, `SoundCue`, `-14 LUFS` | `sound-and-music-design` |
| All 2D kits (`editorial-collage`, `vector-scene-2d`, `motion-diagrams-2d`, `kinetic-typography`, `data-storytelling`, `product-frames`, `vfx`), optics & 2D camera | `kits-2d` |
| 2.5D/3D kits (`paper-diorama-3d`, `isometric-3d`, `tactile-3d`), Disney kinematics, 3D Shot DSL camera & 15-axis OBB SAT collision audit | `kits-3d-and-kinematics` |
