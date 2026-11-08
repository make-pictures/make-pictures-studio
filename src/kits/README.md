# Visual Kits Architecture (`src/kits/`)

**make.pictures** is completely domain-agnostic and style-agnostic. Visual styles are organized into modular **Visual Kits** inside `src/kits/`. Each kit provides reusable 60 FPS primitives that synchronize directly with ElevenLabs word-level timestamps (`src/utils/timestamps.ts` and `src/utils/dialogue.ts`).

---

## Built-in Starter Kits

### 1. `src/kits/paper-diorama-3d/` — 2.5D Paper Pop-Up Book (`@remotion/three`)
Tactile, multi-plane 3D paper cutout theatre inspired by *Paper Mario* and classic Victorian pop-up books.
- **`PaperCutout3D`** — Renders any 2D `CanvasRenderingContext2D` illustration into a physical 3D cardboard cutout with an automatic dilated cream-white die-cut border (`whiteBorderPx`), fiber grain, 3D thickness (`thickness`), and custom silhouette shadow casting (`MeshDepthMaterial`).
- **`PopUpHinge3D`** — Parallel-hinge 3D transformation matrix that folds entire multi-plane stage groups flat onto the book page (`foldProgress: 0`) or stands them upright (`foldProgress: 1`).
- **`PaperBookPageTurn3D` & `PopUpBookBase3D`** — Hardcover pop-up book base with procedural floor textures (`mint-plains`, `checkerboard-tile`, `warm-parquet`, `valley-terrace`) and a flat-sliding page transition that never slices standing actors.
- **`PaperStageLighting3D` & `PaperCameraRig3D`** — Theatrical key/rim/hemisphere lighting with `2048×2048` soft shadow maps and deterministic 3D camera choreography.
- **Reference Showcase:** `src/compositions/PaperDioramaDemo.tsx`.

### 2. `src/kits/isometric-3d/` — 3D Isometric Studio & Characters (`@remotion/three`)
Orthographic 3D isometric diorama with expressive procedural characters and multi-voice dialogue choreography.
- **`Stylized3DCharacter`** — Rigged 3D character driven by continuous sentence envelope (`speakingWeight`), low-pass syllable equalizer (`speechEnergy`), and spring-damped pose transitions (`gestureWeights`: `shrug`, `presentLeft`, `presentRight`, `celebrate`, `listenNod`).
- **`IsometricStudioEnvironment`** — Cutaway architectural 3D studio slab, grid, lighting, and interactive hologram props.
- **Reference Showcase:** `src/compositions/IsometricDialogueDemo.tsx`.

### 3. `src/kits/motion-diagrams-2d/` — 2D Motion Diagrams & One-Shot Camera
High-craft 2D infinite canvas for technical architecture, product explainers, and system workflows.
- **`CameraRig`** — One-shot 2D camera (`x, y, zoom, rotateZ`) with a viewport-pinned infinite technical grid (zero GPU texture clipping at any zoom level, supporting `'light'` and `'dark'` variants).
- **`NodeBox` & Mathematical Ports (`portTop`, `portBottom`, `portLeft`, `portRight`, `WorldBox`, `FlowCurve`)** — Single source of truth for card coordinates and cubic Bézier wires with flowing data packets.
- **`DataFlowEdge`, `SystemNode`, `CodePayloadToast`** — Glassmorphic system cards, glowing neon edges, and live JSON/SQL telemetry toasts.
- **Reference Showcases:** `src/compositions/StarterStory.tsx` (`16:9` & `9:16`) and `src/scenes/ArchitectureDemoScene.tsx`.

---

## Creating a New Visual Kit with an AI Agent (Google Antigravity / Claude Code)

You are never limited to the three built-in kits! You can ask **Google Antigravity** or **Claude Code** to create a brand-new kit in `src/kits/<your-kit-name>/` tailored to your story:

- **`src/kits/flat-vector-2d/`** — Bold geometric 2D vector illustrations (*Kurzgesagt* / editorial explainer style)
- **`src/kits/kinetic-typography/`** — High-energy rhythmic typography synchronized word-by-word to ElevenLabs timestamps
- **`src/kits/data-storytelling/`** — Animated 60 FPS charts, maps, timelines, and financial/scientific visualizations
- **`src/kits/low-poly-3d/`** — Stylized low-poly 3D worlds and vehicles in `@remotion/three`
- **`src/kits/retro-pixel/`** — Crisp pixel-art canvas shaders and retro CRT HUDs

### Blueprint for Every New Kit (`src/kits/<kit-name>/`)
1. **Frame 0 Rule:** Frame `0` must render a clean background before the first spring entrance (`spring({ frame: frame - 2, fps, config: SPRING_PRESETS.snappy })`).
2. **Damped 60 FPS Springs:** Always use `SPRING_PRESETS` (`damping: 200`) from `src/theme/tokens.ts` so motion is crisp and never rubbery.
3. **Audio-Driven Timing:** Drive entrances and state changes from `getWordTriggerFrame(sceneId, word, fallbackFrame)` or `getSpeechStateAtFrame(sceneId, localFrame)` rather than hardcoded magic numbers.
4. **Export Clean Primitives:** Export your kit's components from `src/kits/<kit-name>/index.ts` and re-export them in `src/kits/index.ts`.
