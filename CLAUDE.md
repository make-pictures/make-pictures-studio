# CLAUDE.md — Claude Code Instructions for `make.pictures` (Video-as-Code Studio)

Welcome to **make.pictures** ([https://make.pictures](https://make.pictures)) — an open-source `60 FPS` Video-as-Code studio built with **Remotion**, **Three.js (`@remotion/three`)**, **TypeScript**, and **ElevenLabs**.

> **IMPORTANT:** Always read and follow all rules in [`AGENTS.md`](./AGENTS.md) alongside this file. `AGENTS.md` contains the complete visual, mathematical, and audio production rules shared across **Claude Code** and **Google Antigravity**.

---

## Quick Reference Commands

- `npm run onboard` — Agent-driven onboarding flow (`scripts/onboard.mjs` + `@elevenlabs/cli onboard`): installs dependencies, opens browser to authorize ElevenLabs into `.env.local`, and verifies 60 FPS Remotion readiness.
- `npm run doctor` — Verify Node.js, FFmpeg, `.env.local` (`ELEVENLABS_API_KEY`), ElevenLabs API connection, and Remotion readiness.
- `npm run setup` — Initialize `.env.local` from `.env.example` and run the environment doctor.
- `npm run voiceover` — Generate `.mp3` voiceovers and word-level `.json` timestamps from `scenes.json` (with SHA-256 caching and automatic offline fallback), updating `src/generated/voiceover-data.ts`.
- `npm run studio` — Open interactive Remotion Studio preview in the browser.
- `npm run typecheck` — Run `tsc --noEmit` to validate TypeScript types.
- `npx remotion still src/index.ts <CompositionId> out/check.png --frame=<frame> --gl=angle` — Render a single PNG inspection frame before full video rendering.
- `npm run render` — Render `StarterStory` (`16:9` @ `60 FPS`) to `out/starter-story.mp4`.
- `npm run render:vertical` — Render `StarterStoryVertical` (`9:16` @ `60 FPS`) to `out/starter-story-vertical.mp4`.
- `npm run render:paper` — Render `PaperDioramaDemo` (2.5D Paper Pop-Up Book @ `60 FPS` with GPU ANGLE).
- `npm run render:iso` — Render `IsometricDialogueDemo` (3D Isometric Studio @ `60 FPS` with GPU ANGLE).
- `npm run render:diagrams` — Render `ArchitectureDemo` (2D Motion Diagrams @ `60 FPS`).

---

## Step-by-Step Agent Workflow: From User Idea to 60 FPS Video

When a user asks you to create a new video or animation:

1. **Clarify & Pick a Visual Kit (`src/kits/`):**
   - Ask or confirm: topic, language (PL/EN), target aspect ratio (`16:9`, `9:16`, or both), and visual style:
     - `src/kits/paper-diorama-3d/` — 2.5D Paper Pop-Up Book (`PaperCutout3D`, `PopUpHinge3D`, `PaperBookPageTurn3D`, `PaperStageLighting3D`)
     - `src/kits/isometric-3d/` — 3D Isometric Studio with characters (`Stylized3DCharacter`, `IsometricStudioEnvironment`)
     - `src/kits/motion-diagrams-2d/` — 2D Motion Diagrams & One-Shot Camera (`CameraRig`, `NodeBox`, `portTop/Bottom/Left/Right`, `FlowCurve`, `DataFlowEdge`)
     - **Custom Kit (`src/kits/<new-kit>/`)** — If the user wants a brand-new visual aesthetic (e.g., Flat Vector 2D, Kinetic Typography, Low-Poly 3D, Retro Pixel, Data Storytelling), create a new kit folder under `src/kits/`.

2. **Write the Script in `scenes.json`:**
   - Add the scene(s) or dialogue turns to `scenes.json`.
   - Use phonetic spelling for acronyms and domain names when using `eleven_multilingual_v2` (see `AGENTS.md` Section 5).

3. **Generate & Audit Voiceovers (`npm run voiceover`):**
   - Run `npm run voiceover`.
   - **Mandatory check:** Inspect/listen to every newly generated `/public/voiceovers/{sceneId}.mp3` file using your file reading tool (`read_file` / `Read`) to verify pronunciation and ensure no word endings are clipped before rendering video.

4. **Build the 60 FPS Composition (`src/compositions/`):**
   - Synchronize animations with word timestamps using `getWordTriggerFrame(sceneId, word, fallback)` (`src/utils/timestamps.ts`) and `getSpeechStateAtFrame(sceneId, localFrame)` (`src/utils/dialogue.ts`).
   - Follow all 9 core rules in `AGENTS.md`:
     - **Frame 0 is empty:** Start first entrance springs at `frame - 2`.
     - **Springs use `damping: 200`:** Use `SPRING_PRESETS` from `src/theme/tokens.ts`.
     - **2D Ports:** Never guess SVG line coordinates; use `NodeBox` + `portTop`, `portBottom`, `portLeft`, `portRight`.
     - **3D Character Calmness:** Use `speakingWeight` (sentence envelope) for body posture/gestures and `speechEnergy` (syllable envelope) only for mouth/equalizer bars.
     - **2.5D Paper Cutouts:** Maintain `Δz >= thickness_A / 2 + thickness_B / 2 + 0.03` to prevent WebGL Z-fighting, keep `whiteBorderPx + lineWidth + 12px` canvas padding, and fold scenes flat (`PopUpHinge3D` `foldProgress <= 0.02`) before sliding `PaperBookPageTurn3D`.

5. **Inspect Still Frames (`npx remotion still`):**
   - Render key frames (`frame=0`, transitions, main scenes) to PNG and inspect them visually before launching a full MP4 render.

6. **Render Final MP4 (`60 FPS`):**
   - Run `npm run typecheck` and render with `--fps=60 --gl=angle --concurrency=100%`.
