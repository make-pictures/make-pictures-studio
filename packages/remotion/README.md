<p align="center">
  <a href="https://make.pictures"><img src="https://make.pictures/brand/make-pictures-logo.svg" alt="make.pictures — Production & Audio/QA Toolkit for Remotion" width="420" /></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@make-pictures/remotion"><img src="https://img.shields.io/npm/v/@make-pictures/remotion?style=for-the-badge&labelColor=0F172A&color=2563EB&label=%40make-pictures%2Fremotion" alt="@make-pictures/remotion on npm" /></a>
  <img src="https://img.shields.io/badge/Remotion-4.x_•_React_18%2F19-0096C7?style=for-the-badge&labelColor=0F172A" alt="Remotion 4 and React 18/19" />
  <img src="https://img.shields.io/badge/Zero_Node_Deps-sideEffects%3A_false-7209B7?style=for-the-badge&labelColor=0F172A" alt="Tree-shakeable ESM/CJS" />
</p>

# `@make-pictures/remotion`

The unified React/TypeScript visual runtime for **make.pictures v3.0** — built cleanly for **Remotion 4** (`remotion studio`, `remotion render`, and web `@remotion/player`).

Zero Node.js or ElevenLabs runtime dependencies, `sideEffects: false`, dual ESM/CJS builds, and strictly isolated subpath exports so 2D projects never pay for or install `three`.

## Install

```bash
npm install @make-pictures/remotion remotion @remotion/google-fonts @remotion/media-utils lucide-react zod
```

Optional 3D peer dependencies (only needed for `paper-diorama-3d`, `isometric-3d`, and `tactile-3d` kits):

```bash
npm install three @react-three/fiber @react-three/drei @remotion/three
```

## Subpath Exports

| Subpath | Contents |
| :--- | :--- |
| `@make-pictures/remotion` | Zero-`three` root barrel: `style`, `audio`, `director`, `optics`, `kinematics`, `DirectorCamera2D`, `utils`, `types` |
| `@make-pictures/remotion/style` | `StyleProvider`, `StyleBackdrop`, 10 `BUILT_IN_STYLES`, `DimensionalSpace`, `StylePresetSchema`, `TYPOGRAPHY_FLOOR_1080P`, `SPRING_PRESETS`, `getCardChromeStyle`, `getStyleSpringConfig` |
| `@make-pictures/remotion/style/presets` | Pure React-free style data and Zod schemas |
| `@make-pictures/remotion/audio` | `VoiceoverTrack`, `SmartMusicBed`, `SoundCue`, `VoiceoverCaptionBar`, `acousticPresets` |
| `@make-pictures/remotion/audio/voices` | Pure React-free curated PL/EN voice catalog and ElevenLabs model profiles (`eleven_v4`, `eleven_v3`) |
| `@make-pictures/remotion/camera` | `DirectorCamera2D`, `DirectorCamera3D`, `evaluateDirectorCamera3D`, Shot DSL & camera basis math |
| `@make-pictures/remotion/kinematics` | Zero-`three` Disney animation curves (`disneyEase`, `evaluateArc3D`) and 15-axis 3D OBB SAT collision auditing (`obbClearanceSat3D`, `auditSceneCollisions3D`) |
| `@make-pictures/remotion/director` | `ContinuousSceneFlow`, `SceneSubViewDissolve`, `ClippedSurfaceChrome`, `ScenicBackdropLayers`, `computeSceneTimingFromVoiceover` |
| `@make-pictures/remotion/optics` | `OpticalStage2D`, `StageLightingRig`, `getTactileSurfaceStyle` |
| `@make-pictures/remotion/style-lab` | Native `<StyleLabComposition />`, `StyleLabSchema`, `DEFAULT_STYLE_LAB_PROPS` for Remotion Studio |
| `@make-pictures/remotion/elements` | `REMOTION_ELEMENTS_CATALOG` — 7 flagship standalone Remotion Elements |
| `@make-pictures/remotion/kits/<kit>` | 10 visual kits: `editorial-collage`, `vector-scene-2d`, `motion-diagrams-2d`, `kinetic-typography`, `data-storytelling`, `product-frames`, `vfx`, `paper-diorama-3d`, `isometric-3d`, `tactile-3d` |

## Quick Usage in `src/Root.tsx`

```tsx
import React from 'react';
import { Composition } from 'remotion';
import {
  DEFAULT_STYLE_LAB_PROPS,
  StyleLabComposition,
  StyleLabSchema,
} from '@make-pictures/remotion/style-lab';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="StyleLab"
    component={StyleLabComposition}
    schema={StyleLabSchema}
    defaultProps={DEFAULT_STYLE_LAB_PROPS}
    durationInFrames={360}
    fps={60}
    width={1920}
    height={1080}
  />
);
```

## Links

- Website: [make.pictures](https://make.pictures)
- Source & docs: [github.com/make-pictures/make-pictures-studio](https://github.com/make-pictures/make-pictures-studio)
- Migration guide (v2 → v3): [MIGRATION-v3.md](https://github.com/make-pictures/make-pictures-studio/blob/main/docs/MIGRATION-v3.md)

## License

MIT © [make.pictures](https://make.pictures)
