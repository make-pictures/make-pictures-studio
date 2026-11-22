# Changelog

All notable changes to **`make.pictures`** (`create-make-pictures` and `@make-pictures/{core,kits,studio,cli}`) are documented in this file.

The project adheres to [Semantic Versioning](https://semver.org/) and is released under the [MIT License](./LICENSE).

---

## [2.4.1] — 2026-11-22

### Fixed
- **R3F Per-Frame Stability & Offline PBR Seams (`@make-pictures/kits`):** Eliminated per-frame light, geometry, and shader-material churn in `<DaylightArcRig3D />`, `<StudioHdrRig3D />`, `<ScreenGlassLayer3D />`, and `<DeformableSheet3D />`; wired `DaylightArcRig3D` tone-mapping exposure sync with clean unmount restore; ensured immediate `PMREMGenerator` disposal and `environmentIntensity` restore in `<SyncStudioIbl3D />`; hardened `usePreloadedTextures3D` against synchronous loader exceptions, duplicate `continueRender` calls, and anisotropy cache collisions; and fixed procedural PBR texture generators (`linen-weave`, `wood-grain`, `brushed-metal`, `cotton-paper`) to tile seamlessly with exact integer harmonics.
- **9:16 Safe Box & Contrast in Editorial Overlays (`@make-pictures/kits/editorial-collage`):** Adapted `<PaperRibbonTimeline />` and `<FloatingEditorialDisplay />` for vertical `9:16` Golden Safe Box bounds, made `resolveActivePaperMilestoneId` order-independent, and added high-contrast accent fallbacks for `light-on-dark` overlays on light styles.
- **3D Kinematics, Camera Recoil & Showcase Collision Proof (`@make-pictures/core`, `examples/tactile-3d-showcase`):** Upgraded `computeDeformedSheetAabb3D` to a `9×9` deformed surface grid, sorted keyframes and applied impulse recoil along camera `up`/`-forward` in `evaluateCameraKeyframes3D`, fixed `evaluateSecondaryCascade` index bounds, and hardened `Tactile3DShowcase` with 0 deformed-sheet pairwise penetration across all 360 frames and smooth continuous quaternion orientation.
- **ElevenLabs `eleven_v3` Stability Snapping & Audio Tag Linting (`@make-pictures/core`, `@make-pictures/cli`):** Added `snapStabilityForElevenLabsModel` (snapping `eleven_v3` stability to discrete `{0.0, 0.5, 1.0}`) across `voices.ts`, `commands/audio.ts`, and `commands/voices.ts`; broadened `ELEVENLABS_V3_TAG_RE` for timing/descriptive tags while ignoring numeric footnotes; and stripped v3 tags in synthetic mock word timestamps.
- **Assets CLI Premultiplied Alpha, Flag Validation & Subpath Packaging (`@make-pictures/cli`, `create-make-pictures`, `scripts/build-packages.ts`):** Switched `assets sheet` resampling to premultiplied-alpha bilinear interpolation (eliminating dark fringe halos on transparent cutouts), added dimension/tile/canvas-pixel bounds, tiny-image corner caps, Polish diacritic normalization + `[ ] @ ,` 5×7 glyphs, negative/valueless numeric CLI flag validation, `--dir`-relative asset path resolution, clean `@make-pictures/core/kinematics` subpath mapping in built kits, and synced v2.4.1 fallback rules + `voices`/`assets` package scripts.

🔗 [GitHub Release `v2.4.1`](https://github.com/make-pictures/make-pictures-studio/releases/tag/v2.4.1)

---

## [2.4.0] — 2026-11-22

### Added
- **Disney Kinematics & 3D Collision Guard (`@make-pictures/core/kinematics`):** Added a zero-`three` kinematics and geometry subpath featuring deterministic Disney animation curves (`disneyEase`, `evaluateAnticipation`, `evaluateArc3D`, `evaluateSurfaceImpact`, `evaluateVelocityStretch`, `evaluateSecondaryCascade`) alongside 3D AABB, GPU-deformed sheet bounds (`computeDeformedSheetAabb3D`), 15-axis 3D OBB SAT (`obbClearanceSat3D`, `obbIntersectsSat3D`), and `auditSceneCollisions3D`.
- **Tactile 3D Kit (`@make-pictures/kits/tactile-3d`):** Added domain-agnostic physical 3D primitives: parametric 3-material rounded `<DeformableSheet3D />` with GPU vertex bending (`attachSheetBendShader`) and true curved shadows (`createBentSheetDepthMaterial`), camera-locked `<ScreenGlassLayer3D />` + `<ScreenGlassSlot />` with analytical 2D SDF contact shadows, synchronous Frame-1 offline HDR `<SyncStudioIbl3D />` (`THREE.PMREMGenerator`), deterministic `usePreloadedTextures3D`, offline procedural PBR map generators (`getProceduralPbrMaps`: `linen-weave`, `wood-grain`, `cotton-paper`, `brushed-metal`), 5 `SHEET_MATERIAL_FINISHES` presets, and `<DaylightArcRig3D />` (`evaluateTimeOfDayLighting`).
- **Orthonormal 3D Camera Basis, `'macro'` Shot & Screen-Glass Projection (`@make-pictures/core/camera`):** Added `computeCameraBasis3D` with automatic overhead gimbal-singularity protection (`|forward.y| > 0.995`), `'macro'` framing in `DirectorCamera3D`, `evaluateCameraKeyframes3D`, `projectScreenGlassPose`, and `computeGlassLightingBlend`.
- **Frameless Editorial Overlays (`@make-pictures/kits/editorial-collage`):** Added `<PaperRibbonTimeline />` and `<FloatingEditorialDisplay />` (`>= 19–22 px` typography floor, zero dark box chrome, Clean Frame `0`).
- **Asset & Scan Hygiene CLI (`@make-pictures/cli`):** Added `npx make-pictures assets clean-scan` (exterior perimeter flood-fill removing dark scanner corner artifacts while protecting interior ink) and `npx make-pictures assets sheet` (checkerboard QA contact sheet with 5×7 bitmap labels, zero dependencies beyond `ffmpeg`).
- **Domain-Agnostic Showcase (`examples/tactile-3d-showcase`):** Added `Tactile3DShowcase` verified across all 360 frames with an exhaustive 0-collision OBB SAT proof and Director QA.

### Improved
- **Synchronous Frame-1 HDR in `StudioHdrRig3D` (`@make-pictures/kits/isometric-3d`):** Upgraded `StudioHdrRig3D` to use synchronous `<SyncStudioIbl3D />` (`PMREMGenerator`) so existing 3D kits render rich HDR reflections from Frame 1 under Remotion `frameloop="never"`.
- **ElevenLabs `eleven_v3` Audio-Tag & Stability Linting (`@make-pictures/cli`):** Updated `phonetics-lint.ts` to strip `[thoughtful]`/`[warmly]` v3 tags before phonetic analysis, warn when v3 tags are used on non-v3 models (preventing literal spoken tags), and validate discrete `eleven_v3` `stability ∈ {0.0, 0.5, 1.0}` across both PL and EN productions.
- **Canonical Agent Skills & Rules (`plugins/make-pictures/`):** Synced all 9 canonical skills, `AGENTS.md`, and `CLAUDE.md` with tactile 3D, SAT collision tests, `eleven_v3` expressive acting direction, pilot-demo workflows, and mandatory pre-audio fact-checking.

🔗 [GitHub Release `v2.4.0`](https://github.com/make-pictures/make-pictures-studio/releases/tag/v2.4.0)

---

## [2.3.2] — 2026-11-19

### Added
- **Native Language Voice Catalog (`@make-pictures/core/audio/voices`):** Added a React-free voice catalog with verified native Polish (`Luiza`, `Asia`, `Arleta`, `Rafał`) and native English voice archetypes (`VOICE_ARCHETYPE_TO_ELEVENLABS_ID_BY_LANG`), so `--lang=pl` projects scaffold and onboard with native Polish voices instead of English cross-lingual premades.
- **Voice Discovery & Audition CLI (`@make-pictures/cli`):** Added `npx make-pictures voices [--lang=pl|en|all] [--gender=female|male] [--query="..."] [--mine] [--json] [--audition="..." --voice=<id>]` to browse curated native presets, user account voices, and ElevenLabs Voice Library entries with 0-credit preview URLs and 1-sentence sample auditions.
- **Studio Web Voice Picker (`@make-pictures/studio`):** Added `GET /api/studio/voices` and an interactive Voice Picker in `SceneScriptEditor` featuring 0-credit preview playback, TTS model override (`modelId`), and a 1-click native Polish fix banner when an English premade voice is detected in a Polish scene.
- **Per-Scene & Per-Manifest `modelId` / `languageCode` (`@make-pictures/core`, `@make-pictures/cli`):** Added `modelId` and `languageCode` support to `ProductionManifest` and `SceneDefinition` (automatically passing ISO 639-1 `languageCode` only on compatible models such as `eleven_v3`, `eleven_turbo_v2_5`, and `eleven_flash_v2_5`).

### Fixed
- **Audio Cache Invalidation (`@make-pictures/cli`):** Included `modelId` and `languageCode` in SHA-256 voiceover cache validation so switching TTS models regenerates audio without requiring `--force`.
- **Polish Voice Selection Linter (`@make-pictures/cli`):** Extended `lintManifestVoiceovers` to warn whenever a Polish production uses a known English-native premade voice (such as Liam, Sarah, Brian, George, or Daniel).

🔗 [GitHub Release `v2.3.2`](https://github.com/make-pictures/make-pictures-studio/releases/tag/v2.3.2)

---

## [2.3.1] — 2026-11-17

### Added
- **Cutout CLI (`@make-pictures/cli`):** Added `npx make-pictures cutout` for deterministic background removal, soft alpha ramp feathering, interior alpha-hole detection, and automatic QA sheet generation.
- **Polish Phonetics Linter (`@make-pictures/cli`):** Added automatic pronunciation and phonetic linting before ElevenLabs voiceover synthesis in `npx make-pictures audio`.
- **Expanded 2D Kits (`@make-pictures/kits`):** Added `<EditorialPanoramaTrack />` (`editorial-collage`), `<HorizontalFeatureGrid2x2 />`, and `<PinnedMediaStage />` (`vector-scene-2d`).
- **Auto-Grid Contact-Sheet QA (`@make-pictures/cli`):** Upgraded `npx make-pictures qa` with adaptive multi-frame contact-sheet grids and stricter JSX source audits.

### Improved
- **18px Typography Readability Floor (`@make-pictures/core`, `@make-pictures/kits`):** Enforced an `18 px` minimum typography scale across built-in 2D/3D kits and Director QA checks.
- **Image Generation Guardrails (`@make-pictures/cli`):** Added `NO_RASTER_TEXT_GUARD_CLAUSE` and style-token injection in `npx make-pictures image`.

🔗 [GitHub Release `v2.3.1`](https://github.com/make-pictures/make-pictures-studio/releases/tag/v2.3.1)

---

## [2.3.0] — 2026-11-16

### Added
- **2D / 2.5D / 3D Dimensional Spaces (`@make-pictures/core`, `@make-pictures/studio`, `@make-pictures/cli`):** Two-axis art direction combining `DimensionalSpace` (`--space=2d|2.5d|3d`) with **10 built-in style presets** (including `soft-clay`, `retro-pc`, and `glass-studio`) and custom `styles/*.style.json` presets in **🎨 Style Lab**.
- **Soft-Clay 3D & Offline Spatial IBL (`@make-pictures/kits/isometric-3d`):** Added zero-network `<StudioHdrRig3D />` (`<Lightformer>` rig + `<ContactShadowDisc3D />`), expressive sculpted `<ClayCharacter3D />`, and `<PodcastStudioSet3D />`.
- **Retro-PC 2D & Cosmic 2.5D Cutout Motifs (`@make-pictures/kits`):** Added `<RetroPcWindowStage2D />` (`system7` / `win95` / `terminal` chrome) and layered lunar/cosmic 2.5D diorama cutouts.
- **Continuous Scene Flow (`@make-pictures/core`):** Added `<ContinuousSceneFlow />`, `<OpticalCrossDissolve />`, `<ClippedSurfaceChrome />`, and `<ScenicBackdropLayers />` with Clean Frame `0` QA gates.

🔗 [GitHub Release `v2.3.0`](https://github.com/make-pictures/make-pictures-studio/releases/tag/v2.3.0)

---

## [2.2.0] — 2026-11-13

### Added
- **Studio Web Liquid Glass UI (`@make-pictures/studio`):** Adaptive `System / Light / Dark` theme engine (`useStudioTheme`), full-bleed stage with `⌘K` / `Ctrl+K` project & style picker, QuickTime-style floating transport bar, and responsive tablet/mobile drawers.
- **3-Tab Scene Inspector (`@make-pictures/studio`):** Live Zod parameter controls, inline voiceover script & ElevenLabs SSE synthesis tab, and bidirectional JSON sync (`GET/POST /api/studio/scenes` & `/api/studio/styles`).
- **Player Lifecycle Hardening (`@make-pictures/studio`):** Callback-ref synchronization in `useRemotionPlayer` across HMR reloads, aspect-ratio switches, and keyboard shortcuts.

🔗 [GitHub Release `v2.2.0`](https://github.com/make-pictures/make-pictures-studio/releases/tag/v2.2.0)

---

## [2.1.1] — 2026-11-12

### Fixed
- **Lightweight 2D Onboarding (`@make-pictures/cli`, `@make-pictures/kits`):** Decoupled optional Three.js / React Three Fiber peer dependencies (`2.1.0` → `2.1.1`) so `npx -y @make-pictures/cli@latest onboard` and 2D-only workspaces start cleanly without requiring 3D packages upfront.

---

## [2.0.3] — 2026-11-12

### Fixed
- **Browser Audio Tag Pool Safety (`@make-pictures/core`, `@make-pictures/studio`):** Bounded `<VoiceoverTrack />` and `<SoundCue />` `<Html5Audio />` lifetimes and raised Studio Web's audio tag pool to prevent browser media element exhaustion on multi-scene timelines.

---

## [2.0.2] — 2026-11-12

### Added
- **One-Paste Zero-Terminal Agent Onboarding (`@make-pictures/cli`):** Added `npx -y @make-pictures/cli@latest onboard` state machine with browser-based ElevenLabs connection, offline mock fallback, and automatic Studio Web launch on `127.0.0.1:3000`.

---

## [2.0.0] — 2026-11-11

### Added
- **Modular 5-Package MIT Architecture:** Initial release of `create-make-pictures`, `@make-pictures/core`, `@make-pictures/kits`, `@make-pictures/studio`, and `@make-pictures/cli` with 9 bundled `SKILL.md` modules for Google Antigravity, Claude Code, and Cursor.
- **Deterministic 60 FPS Runtime & Audio Mastering:** `DirectorCamera3D/2D` Shot DSL, `9:16` Golden Safe Box enforcement, 12-frame Contact-Sheet QA, and ElevenLabs TTS + sidechain-ducked music + SFX mastered to `-14 LUFS`.

🔗 [GitHub Release `v2.0.0`](https://github.com/make-pictures/make-pictures-studio/releases/tag/v2.0.0)
