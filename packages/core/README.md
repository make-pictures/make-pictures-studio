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

- **Cinematography & Shot DSL (`@make-pictures/core/camera`):** `<DirectorCamera3D />` (`establishing-wide`, `medium`, `close-up`, `low-angle-hero`, `whip`, `glide`, `orbit`, optical `dollyZoomDeltaFov`, automatic `9:16` Golden Safe Box compensation) and `<DirectorCamera2D />`.
- **Smart Audio Engine (`@make-pictures/core/audio`):** `<SmartMusicBed />` sidechain auto-ducking under narration, `useMusicBeatPulse`, `<SoundCue />` word-timestamp synchronization, and `VOICE_ACOUSTIC_FILTERS`.
- **Production Manifest & Capsule Contracts (`@make-pictures/core`):** `defineProduction`, `productionAssetPath`, `SPRING_PRESETS` (`damping: 200`), `STUDIO_THEME`, `THEME`, and deterministic Mulberry32 `createSeededRandom`.

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
