# Changelog

All notable changes to **`make.pictures`** (`create-make-pictures` and `@make-pictures/{core,kits,studio,cli}`) are documented in this file.

The project adheres to [Semantic Versioning](https://semver.org/) and is released under the [MIT License](./LICENSE).

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
