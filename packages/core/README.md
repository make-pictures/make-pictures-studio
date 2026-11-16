<p align="center">
  <a href="https://make.pictures"><img src="https://make.pictures/brand/make-pictures-logo.svg" alt="make.pictures — Open-source 60 FPS Video-as-Code Studio" width="420" /></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@make-pictures/core"><img src="https://img.shields.io/npm/v/@make-pictures/core?style=for-the-badge&labelColor=0F172A&color=FF2A85&label=%40make-pictures%2Fcore" alt="@make-pictures/core on npm" /></a>
  <img src="https://img.shields.io/badge/Deterministic_60_FPS_runtime-2563EB?style=for-the-badge&labelColor=0F172A" alt="Deterministic 60 FPS runtime" />
  <a href="https://make.pictures"><img src="https://img.shields.io/badge/make.pictures-Studio-2563EB?style=for-the-badge&labelColor=0F172A" alt="make.pictures Studio" /></a>
</p>

# `@make-pictures/core`

Deterministic **60 FPS Video-as-Code** core runtime for [`make.pictures`](https://make.pictures) — built on React, TypeScript, and Remotion.

## Features

- **2-Axis Art Direction (`@make-pictures/core/style`):** `DimensionalSpace ('2d' | '2.5d' | '3d') × StylePreset` spanning **10 built-in styles** (`minimal-product`, `sketch-notebook`, `retro-pc`, `brutalist-poster`, `cyber-telemetry`, `tactile-craft`, `editorial-press`, `archival-chronicle`, `soft-clay`, `glass-studio`) + custom `styles/*.style.json`, `<StyleProvider>`, `interpolateStylePresets`, and `resolveStyleMaterial3D`.
- **Director DNA & Continuous Scene Flow (`@make-pictures/core`):** `<ContinuousSceneFlow />` (`<= 1` WebGL context handoff), `<OpticalCrossDissolve />`, `<ScenicBackdropLayers />`, `<ClippedSurfaceChrome />`, `CINEMATIC_SPRINGS` (`damping: 200`), and `DIRECTOR_PACING_BUDGET` (`>= 4.5 s` / `>= 270` frames per scene).
- **Cinematography, Shot DSL & 2.5D Optics (`@make-pictures/core/camera`, `@make-pictures/core/optics`):** `<DirectorCamera3D />`, `<DirectorCamera2D />`, `<OpticalStage2D />`, `<DepthPlane />`, `<StageLightingRig />`, `getTactileSurfaceStyle`, optical `dollyZoomDeltaFov`, and automatic `9:16` Golden Safe Box compensation.
- **Smart Audio Engine (`@make-pictures/core/audio`):** `<VoiceoverTrack />`, `<SmartMusicBed />` sidechain auto-ducking under narration, `useMusicBeatPulse`, `<SoundCue />` word-timestamp synchronization, and `VOICE_ACOUSTIC_FILTERS`.
- **Production Manifest & Capsule Contracts (`@make-pictures/core`):** `defineProduction`, `productionAssetPath`, `SPRING_PRESETS`, and deterministic Mulberry32 `createSeededRandom`.

## Install

```bash
npm install @make-pictures/core remotion @remotion/media-utils @remotion/google-fonts zod
```

## Usage

```tsx
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { SPRING_PRESETS, createSeededRandom } from '@make-pictures/core';

export const Hero: React.FC<{ title: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // frame 0 stays a clean board; damping: 200 means zero rubbery bounce
  const enter = spring({ frame: frame - 2, fps, config: SPRING_PRESETS.snappy });
  const seed = createSeededRandom('hero-v1')(); // deterministic, never Math.random()
  return <h1 style={{ opacity: enter }} data-seed={seed}>{title}</h1>;
};
```

## Links

- Website: [make.pictures](https://make.pictures)
- Source & docs: [github.com/make-pictures/make-pictures-studio](https://github.com/make-pictures/make-pictures-studio)
- YouTube: [@makepicturestv](https://www.youtube.com/@makepicturestv) (EN) · [@makepicturespl](https://www.youtube.com/@makepicturespl) (PL)

## License

MIT © [make.pictures](https://make.pictures)
