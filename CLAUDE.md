# CLAUDE.md — Claude Code Instructions for `make.pictures` Studio

Welcome to **make.pictures** ([https://make.pictures](https://make.pictures)) — an open-source `60 FPS` Video-as-Code studio and npm ecosystem (`create-make-pictures`, `@make-pictures/core`, `@make-pictures/kits`, `@make-pictures/studio`, `@make-pictures/cli`) built with **Remotion**, **Three.js (`@remotion/three`)**, **TypeScript**, **Zod**, and **ElevenLabs** (TTS + AI Music + AI SFX).

> **IMPORTANT:** Read [`AGENTS.md`](./AGENTS.md) alongside this file for universal studio invariants, and use **Progressive Skill Loading** from `.agents/plugins/make-pictures/skills/` (or [`plugins/make-pictures/skills/`](./plugins/make-pictures/skills/)) so you load only the exact domain rules needed for your active task.

---

## 3 Official Workspace Modes

`make.pictures` supports three first-class workflows via the `@make-pictures/cli` binary (`npx make-pictures <command>`):

1. **Standalone Video Studio (`npx create-make-pictures@latest my-films`):**
   - `productions/*` is the user's Git-tracked source code; the engine runs cleanly from `node_modules/@make-pictures/*`.
2. **Embedded Inside an Existing SaaS / App Repo (`npx make-pictures init --dir=videos`):**
   - Adds `videos/productions/` + syncs `.agents/plugins/make-pictures` AI skills into a Next.js/Vite/monorepo codebase so agents can turn real UI components into `60 FPS` launch videos. Pass `--dir=videos` to CLI commands (`npx make-pictures studio --dir=videos`, `npx make-pictures qa <Id> --dir=videos`).
3. **Live Interactive Web Embeds (`npm i @make-pictures/core @make-pictures/kits`):**
   - Import subpath kits (e.g., `@make-pictures/kits/motion-diagrams-2d`) directly inside `<Player />` from `@remotion/player` on React/Next.js pages without rendering MP4 files.

*(When developing inside the `make-pictures-studio` engine monorepo itself: `packages/*` holds publishable packages, `examples/*` holds showcases, and `productions/<slug>/` holds isolated user films.)*

---

## Quick Reference Commands (`npx make-pictures` / `npm run`)

- `npx make-pictures onboard` (`npm run onboard`; pass `--json` for explicit agent JSON mode) — Interactive terminal setup (or agent JSON workflow when run by an AI agent / `--json`): verifies `node_modules` & `ffmpeg`, authorizes `ELEVENLABS_API_KEY` into `.env.local` (powering TTS, Music & SFX; never print `.env.local` in chat!), and checks `60 FPS` readiness.
- `npx make-pictures doctor` (`npm run doctor`) — Validate Node.js, FFmpeg, `.env.local`, ElevenLabs API connectivity, and Remotion readiness.
- `npx make-pictures init [--dir=videos] [--kit=paper-diorama-3d] [--lang=pl|en]` — Initialize `make.pictures` + `.agents/plugins/make-pictures` inside an existing SaaS/app repository.
- `npx make-pictures new <slug> [--kit=paper-diorama-3d|motion-diagrams-2d|isometric-3d|kinetic-typography|data-storytelling] [--lang=pl|en] [--dir=. ]` — Scaffold a clean production capsule in `productions/<slug>/`.
- `npx make-pictures audio [--production=<slug>] [--mock] [--force] [--dir=.]` — Generate word-aligned `.mp3`/`.json` voiceovers, AI Music score, and AI SFX (writing `productions/<slug>/generated/audio-manifest.ts`). Shortcuts: `music`, `sfx`.
- `npx make-pictures studio [--port=3000] [--dir=.]` (`npm run studio`) — Launch **Studio Web** (`http://127.0.0.1:3000`): `60 FPS` HMR `<Player />`, Origin Filter (`All | Examples | Productions`), Multi-Track Director Timeline, *Golden Safe Box `9:16`*, and Props Inspector (`zod` ↔ `*.props.json`).
- `npx make-pictures qa <CompositionId> [--dir=.]` (`npm run qa -- <CompositionId>`) — Render a 12-frame **Contact-Sheet QA** PNG (`out/qa-<CompositionId>.png`) with frame badges and `9:16` Golden Safe Box overlays.
- `npm run typecheck` — Run `tsc --noEmit` across the workspace.
- `npx make-pictures render <CompositionId> [outPath] [--dir=.]` (`npm run render -- <CompositionId>`) — Render `60 FPS` MP4 (`--concurrency=100%`, automatic `--gl=angle` for 3D) with broadcast `-14 LUFS` EBU R128 loudness mastering.

---

## Core Architectural Invariants

1. **Clean Capsule Architecture (`productions/<slug>/`):**
   - Every user video lives inside `productions/<slug>/` with its own `production.json`, `compositions/`, `assets/`, and `generated/audio-manifest.ts`. Never hardcode film-specific scene IDs inside engine packages or scripts.
2. **100% Determinism & Audio Tag Pool Hygiene at `60 FPS`:**
   - **Frame `0` is clean:** Start initial entrance springs at `frame - 2` (`spring({ frame: frame - 2, fps, config: SPRING_PRESETS.snappy })`) so `frame === 0` renders a clean empty background.
   - **Zero `Math.random()` & zero cross-frame `useRef` state:** Always use `createSeededRandom(seed)` from `@make-pictures/core` and `SPRING_PRESETS` (`damping: 200`).
   - **Finite `<Audio />` lifetimes:** Always use `<VoiceoverTrack />` and `<SoundCue />` from `@make-pictures/core`; never mount raw `<Audio />` inside `<Sequence>` without an explicit finite `durationInFrames`.
3. **Props Contract (`zod` ↔ `*.props.json`):**
   - Export a `z.object` schema with `.describe('Section :: Label')` and store defaults in `<CompositionId>.props.json`. **Always read `*.props.json` from disk before editing** to preserve live tweaks saved by the user in **Studio Web**.
4. **Mandatory Quality Gates Before Final Render:**
   - **Listen to `.mp3`:** Inspect newly generated voiceover `.mp3` files with `Read` / `read_file` to verify pronunciation and unclipped word endings.
   - **Visual Contact-Sheet QA:** Run `npx make-pictures qa <CompositionId>` and visually inspect `out/qa-<CompositionId>.png` (`f=0` clean board, zero clipped text or 3D Z-fighting, and `9:16` elements strictly inside the **Golden Safe Box `x ∈ [40, 910], y ∈ [220, 1380]`**).
   - **Typecheck:** Run `npm run typecheck` (`0` errors) before rendering MP4.

---

## Progressive Skill Library (`.agents/plugins/make-pictures/skills/`)

Load the relevant `SKILL.md` **before** authoring scripts, audio specs, cameras, or visual scenes:

| Task / Layer | Skill Name |
| :--- | :--- |
| **6-Step Director Workflow, `production.json`, Workspace Modes & QA** | `make-pictures-director` |
| **2.5D Paper Pop-Up Book (`PaperCutout3D`, `ImageCutout3D`, `Δz`, 3-Phase Page Turns)** | `kit-paper-diorama-3d` |
| **2D Infinite-Canvas Diagrams (`NodeBox` Ports, `FlowCurve`, `92–120f` Packets)** | `kit-motion-diagrams-2d` |
| **SaaS `.mp4` Screen Recordings (`@make-pictures/kits/product-frames`: `BrowserFrame`, `PhoneFrame`, `ScreenSpotlightOverlay`)** | `kit-motion-diagrams-2d` + `make-pictures-director` |
| **3D Isometric Dialogue (`Stylized3DCharacter`, `speakingWeight` vs `speechEnergy`)** | `kit-isometric-3d` |
| **Kinetic Typography & Data Storytelling (`WordByWordStage`, `AnimatedBarRace`)** | `kit-kinetic-and-data` |
| **ElevenLabs Voices, Phonetics, AI Music (`SmartMusicBed`) & AI SFX (`SoundCue`)** | `sound-and-music-design` |
| **Shot DSL Camera (`DirectorCamera3D/2D`), `9:16` Safe Box & Deterministic VFX** | `cinematography-and-vfx` |
