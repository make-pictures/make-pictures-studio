---
name: cinematography-and-vfx
description: >-
  Continuous scene composition (<ContinuousSceneFlow>, <OpticalCrossDissolve>,
  CINEMATIC_SPRINGS, useFocalStagger, DIRECTOR_PACING_BUDGET,
  <ScenicBackdropLayers>, <ClippedSurfaceChrome>), declarative Shot DSL camera
  direction (DirectorCamera3D, DirectorCamera2D, OpticalStage2D + DepthPlane +
  StageLightingRig + getTactileSurfaceStyle), 9:16 Golden Safe Box auto-framing,
  and 60 FPS VFX primitives (@make-pictures/kits/vfx). Use whenever sequencing
  scenes >= 4.5s, choreographing optical dissolves/rack focus, or framing 2D/3D shots.
---

# Cinematography, Continuous Scene Flow & Deterministic VFX (`@make-pictures/core` & `@make-pictures/kits/vfx`)

Direct continuous multi-scene optical dissolves, 3D, 2.5D multi-plane optical, and 2D infinite-canvas cameras using film-grammar shot names instead of raw trigonometry, with automatic `9:16` Golden Safe Box framing, Circle-of-Confusion rack focus, `<= 1` WebGL context safety, and 100% deterministic `60 FPS` visual effects.

---

## 0. Continuous Scene Composition & Director Pacing (`<ContinuousSceneFlow />` & `CINEMATIC_SPRINGS`)

```tsx
import {
  CINEMATIC_SPRINGS,
  ClippedSurfaceChrome,
  ContinuousSceneFlow,
  DIRECTOR_PACING_BUDGET,
  OpticalCrossDissolve,
  ScenicBackdropLayers,
  computeContinuousSceneWindows,
  interpolateStylePresets,
  useFocalStagger,
  type ContinuousSceneSpec,
} from '@make-pictures/core';
```

### `DIRECTOR_PACING_BUDGET`, `CINEMATIC_SPRINGS` & `useFocalStagger`
- **`DIRECTOR_PACING_BUDGET`** *(enforced by the hard `npx make-pictures qa` Director Gate on `origin: 'production'`)*:
  - `minSceneDurationFrames: 270` (`4.5 s` @ `60 FPS` minimum per visual scene),
  - `minSettleHoldFrames: 45` (`0.75 s` calm breathing hold; `qa` requires `>= 36` frames after speech),
  - `maxWordsPerSecond: 2.8`,
  - `defaultCrossDissolveFrames: 54` (`0.9 s`).
- **`CINEMATIC_SPRINGS`:** High-mass, critically damped (`damping: 200`) motion curves that settle gracefully in `~0.85 s` without bounce:
  - `entrance: { mass: 1.45, damping: 200, stiffness: 58 }`
  - `drift: { mass: 1.8, damping: 200, stiffness: 34 }`
  - `emphasis: { mass: 1.25, damping: 200, stiffness: 72 }`
- **`useFocalStagger(frame, fps, options?)`:** Enforces the **Single Focal Point Law** (`startFrame >= 2`, `supportDelayFrames = 22`, `ambientDelayFrames = 40`), returning `{ lead, support, ambient }` so the primary hero settles before supporting elements enter. Never mount `<WordByWordStage>` in the same scene as card/node components (`ImpactKeywordCard`, `StoryCard2D`, `MetricComparisonCard`, `SystemNode`).

### `<ContinuousSceneFlow scenes={...} crossDissolveFrames={54} />` & `<OpticalCrossDissolve />`
Replaces manual `<Sequence>` stitching and abrupt `<SceneTransition>` wipes:
- **2D ↔ 2D and 2D ↔ 3D Transitions:** Overlaps adjacent scenes across `crossDissolveFrames` with cubic smoothstep opacity, subtle `0 px → 4 px → 0 px` optical defocus (`< 0.25px` emits `filter: 'none'` outside the dissolve window!), and continuous `0.988 → 1.0 → 1.016` scale match-drift.
- **3D ↔ 3D WebGL Context Budget (`<= 1` `<ThreeCanvas>`):** When both outgoing and incoming `ContinuousSceneSpec` entries set `usesThree: true`, `computeContinuousSceneWindows` **never overlaps** their `<Sequence>` mounts — the outgoing `<ThreeCanvas>` unmounts at exact boundary `B` and the incoming `<ThreeCanvas>` mounts at `B` beneath a smooth luminous `palette.bgCanvas` veil (`0 → 1 → 0` centered at `B`).
- **Mid-Scene Style Morphing:** Pair with `interpolateStylePresets(fromStyle, toStyle, progress)` to glide across the 3 Artistic Worlds (`atelier`, `illustrative`, `editorial-gallery`) over `48–72` frames with zero cuts.
- **Scenic Backdrops & Clipped Card Chrome:** `<ScenicBackdropLayers />` renders Clean Frame `0` (`null` on `frame <= 0`) and rich multi-plane scenery per `ArtWorld`; `<ClippedSurfaceChrome />` clips internal top accent bars and specular rims cleanly inside rounded cards that use `overflow: 'visible'`.

---

## 1. 3D Shot DSL (`<DirectorCamera3D />`)

```tsx
import {
  DirectorCamera3D,
  shotsToCameraTimeline,
  type StageAnchor3D,
  type ShotSpec3D,
} from '@make-pictures/core';
```

### Stage Anchors & Shot Vocabulary
Define named subjects once (`Record<string, StageAnchor3D>`: `{ position: [x, y, z], height?, radius?, lookOffset? }`), then cut or glide between film shots (`ShotSpec3D[]`):
- **`ShotType3D`:** `'establishing-wide' | 'medium' | 'medium-two-shot' | 'close-up' | 'over-the-shoulder' | 'low-angle-hero' | 'high-crane' | 'custom'`
- **`CameraTransitionMode`:**
  - `'cut'` — instant editorial cut (zero spring travel between distant angles),
  - `'glide'` — smooth damped spring (`SPRING_PRESETS.calmCamera`, `damping: 200`),
  - `'whip'` — fast energetic whip-pan with subtle banking roll (automatically drives `CinematicLensOverlay` chromatic aberration via `DirectorCameraTelemetryContext`!),
  - `'orbit'` — continuous turntable arc (`orbitSpeedDegPerSec`).
- **Vertigo / Dolly-Zoom (`dollyZoomDeltaFov`):** Counter-scales camera distance inversely to $\tan(\text{fov}/2)$ so the target subject stays locked in size while background depth dramatically expands or compresses.
- **Pre-Roll Alignment Inside `<ContinuousSceneFlow />` (`frameOffsetInSequence`):** When a 3D scene (`usesThree: true`) follows a 2D scene (`!usesThree`) inside `<ContinuousSceneFlow crossDissolveFrames={54}>`, `computeContinuousSceneWindows` mounts the incoming `<Sequence>` early by `const frameOffsetInSequence = win.nominalStart - win.mountFrom` (`Math.floor(crossDissolveFrames / 2)`, e.g., `27` frames; `0` on `3D → 3D` luminous-veil seams). Because `useCurrentFrame()` inside that `<Sequence>` starts at `0` at `win.mountFrom`, keep the opening shot at `fromFrame: 0` (so `<ThreeCanvas>` is already framed during the dissolve-in) and offset subsequent scene-local `ShotSpec3D.fromFrame` cuts and speech/pose cues by `+ frameOffsetInSequence` so every move aligns with `win.nominalStart`!
- **Timeline Export:** Pass `shotsToCameraTimeline(SHOTS, durationInFrames)` into `StudioCompositionEntry.cameraTimeline` so **Studio Web** renders every camera cut in the Multi-Track Director Timeline.

### Deterministic Handheld Sway & Trauma Shake
- `handheldIntensity` (`0..1`): Uses `evaluateHandheldNoise(frame, fps, seed, intensity)` locked to calm human breathing frequencies (`0.03..0.055` rad/frame) so the camera feels alive without jittering.
- `impulses?: CameraImpulse[]` (`{ frame, intensity?, decayFrames? }`): Uses `evaluateImpactShake` for damped harmonic thuds on impacts/landings, decaying cleanly to exact `0`.

---

## 2. 2D Infinite-Canvas Shot DSL (`<DirectorCamera2D />` & `<MotionDiagramStage2D />`)

```tsx
import { DirectorCamera2D, type ShotSpec2D } from '@make-pictures/core';
import { MotionDiagramStage2D } from '@make-pictures/kits/motion-diagrams-2d';
```

- **`<DirectorCamera2D />`:** Accepts either explicit `CameraKeyframe2D[]` or named `nodes: Record<string, StageNode2D>` + `shots: ShotSpec2D[]` (`{ fromFrame, target: string | string[], transition?: 'cut' | 'glide' | 'whip', padding?, zoom?, rotateZ?, label? }`), plus `renderBaseFill?: boolean` (pass `false` inside `<StyleProvider renderBackdrop>`) and `renderLighting?: boolean` (default `true`, mounting `<StageLightingRig />`).
- **Clean Frame `0` & Style Inheritance:** On `frame <= 0`, renders pure `style.palette.bgCanvas` (or `null` when `renderBaseFill={false}`). From `frame >= 1`, renders the viewport-pinned calibrated grid (`style.palette.inkBorder`) and directional `<StageLightingRig />` with zero hardcoded cyan/indigo radial blobs and zero GPU edge clipping, while fitting targets into `16:9` or the **`9:16` Golden Safe Box** and publishing live `velocity` telemetry.
- **`<MotionDiagramStage2D />` (`@make-pictures/kits/motion-diagrams-2d`):** Extends `DirectorCamera2D` with `MotionDiagramFocusContext` (`focusedNodeIds` or automatic shot-target focus interpolation) so off-target `SystemNode` and `WorldBox` modules smoothly recess into Circle-of-Confusion blur (`computeCircleOfConfusionPx`, emitting `filter: 'none'` below `0.25px`).

---

## 2B. 2.5D Multi-Plane Optical Stage (`<OpticalStage2D />`, `<DepthPlane />`, `<StageLightingRig />`)

Pure 2D/CSS/SVG multi-plane optical camera, directional lighting rig, and tactile shadow engine — exported from `@make-pictures/core` (`@make-pictures/core/optics`) and re-exported from `@make-pictures/kits/vfx` (zero `three` or `@react-three/fiber` runtime imports).

```tsx
import {
  OpticalStage2D,
  DepthPlane,
  StageLightingRig,
  getTactileSurfaceStyle,
  useOpticalStage,
  type OpticalShot2D,
  type TactileElevation,
} from '@make-pictures/core'; // also available from '@make-pictures/kits/vfx'
```

### `OpticalShot2D` & `<OpticalStage2D />`
Solves `(x, y, zoom, rotateZ)` via `evaluateDirectorCamera2D` (inheriting full `9:16` Golden Safe Box compensation, `style.motion.cameraHandheld`, and `impulses`) while smoothly interpolating **`focalZ`** and **`aperture`** on `getStyleSpringConfig(style, 'camera')` (or instant step on `'cut'`) for physical rack focus:

```ts
export interface OpticalShot2D {
  fromFrame: number;
  target?: string | string[];          // named node(s) in `nodes`, or omit to center on (x, y)
  x?: number;
  y?: number;
  zoom?: number;
  rotateZ?: number;
  focalZ?: number;                     // active focal plane Z for this shot (default 0)
  aperture?: number;                   // per-shot aperture override in [0, 1] (defaults to style.optics.aperture)
  transition?: 'cut' | 'glide' | 'whip';
  padding?: number;
  label?: string;
}
```
- **Props (`OpticalStage2DProps`):** `nodes?: Record<string, StageNode2D>`, `shots?: ReadonlyArray<OpticalShot2D>`, `stageWidth?`, `stageHeight?`, `safeBox9x16Compensation?: boolean` (default `true`), `handheldIntensity?: number`, `impulses?: ReadonlyArray<CameraImpulse>`, `seed?: number` (default `2026`), `startFrame?: number` (default `1` — returns `null` on `frame <= 0` for Clean Frame `0`), `overlay?: React.ReactNode`, `style?: React.CSSProperties`.
- Publishes `{ velocity, focusDistance, activeShotIndex, activeShotLabel, focalZ, aperture }` into `DirectorCameraTelemetryContext` and exposes camera state to children via `useOpticalStage()`.

### `<DepthPlane z={...} />` (`z ∈ [-2.0, +1.5]`)
Physical Z-plane inside `<OpticalStage2D />` (`z = 0` primary hero plane, `z < 0` background sheets, `z > 0` foreground accents; optional `disableFocusBlur?: boolean`):
- **Physical Z-Parallax (`computeParallaxFactor(z)`):** Scales camera translation and zoom by `clamp(1 / Math.max(0.25, 1 - z * 0.28), 0.52, 1.72)` so foreground planes (`z > 0`) sweep faster than `z = 0` and background planes (`z < 0`) drift slower.
- **Circle of Confusion & `< 0.25px` Sharp Focal Deadzone (`computeCircleOfConfusionPx(z, focalZ, aperture)`):** Computes `rawBlur = Math.abs(z - focalZ) * clamp(aperture, 0, 1) * 14`. Whenever **`rawBlur < 0.25`**, returns `0` and `<DepthPlane />` emits **`filter: 'none'`** (never `'blur(0px)'`), guaranteeing crisp native subpixel rasterization of Google Fonts (`latin-ext`) on the active focal plane; off-focus planes clamp blur to `[0.25, 18]` px with gentle atmospheric opacity falloff (`computePlaneAtmosphericOpacity(z, focalZ) ∈ [0.72, 1]` behind `focalZ - 0.5`).

### `<StageLightingRig />` (`window-gobo`, `darkroom-halation`, `studio-macro`)
Directional `60 FPS` stage lighting backdrop driven by `resolveStyleOptics(style)` (`rig?: StyleLightingRig`, `seed?: string | number`, `renderBaseFill?: boolean` default `true` — pass `false` when layered over `<StyleProvider renderBackdrop>`):
- **Clean Frame `0` Invariant:** On `frame <= 0`, renders pure solid `palette.bgCanvas` (or `null` when `renderBaseFill={false}`) with zero patterns, light streaks, or grain.
- **`'window-gobo'`:** Warm key-light gradient angled by `optics.lightAngleDeg`, softly blurred drifting window-mullion/blind penumbra bars (`mixBlendMode: 'multiply'` on light paper, `'screen'` on dark), and subtle optical vignette.
- **`'darkroom-halation'`:** Central lightbox / darkroom enlarger glow, edge vignette falloff, and an anamorphic streak coupled to `optics.halation` + `telemetry.velocity`.
- **`'studio-macro'`:** Clean softbox gradient with a narrow specular highlight sweep coupled to optical camera pan `(camera.x, camera.y)`.
- **Deterministic Film Grain:** Per-frame seeded grain offset via `createSeededRandom(\`${seed}:f:${frame}\`)` (zero `Math.random()`) scaled by `style.surface.grainOpacity`.

### `getTactileSurfaceStyle(style, { elevation, tiltDeg, lightAngleDeg, overrides })`
Available from both `@make-pictures/core` and `@make-pictures/kits/vfx`. Replaces flat UI box shadows with physical two-stage table shadows coupled to `style.optics.lightAngleDeg`:
- **`elevation?: TactileElevation`:** `'flat' | 'resting' | 'lifted' | 'floating'` (default `'resting'`).
- **Directional Shadow Vector (`computeDirectionalShadowVector`):** Projects cast shadows opposite `lightAngleDeg` (`-28°` top-left light casts `dx > 0, dy > 0` bottom-right shadow), pairing a tight `0 1.5px` **contact shadow** with an elevation-scaled **cast shadow** (or sharp ink offset for `'brutalist-hard'`, or halation rim glow for `isDark` / `'darkroom-halation'`).
- **`tiltDeg?: number`:** Applies deterministic rotation (keep within `[-1.2°, +1.2°]` in `9:16` so rotated corners stay inside the Golden Safe Box) and cleanly composes with `overrides?.transform`.

---

## 3. `9:16` Vertical Framing & The Golden Safe Box (`1080×1920`)

Social video players cover huge portions of a `1080×1920` screen with native UI:
- **Top Dead Zone (`y = 0..220 px`):** Status bar, Dynamic Island, and Shorts/Reels header icons.
- **Bottom Dead Zone (`y = 1440..1920 px`, i.e. `bottom < 480 px`):** Channel avatar, video title, audio ticker, and *Related video* pill.
- **Right Dead Zone (`x = 910..1080 px` for `y > 900 px`):** Like / Comment / Share / Remix icon rail (`170 px` wide).
- **Golden Safe Box:** Keep all titles, cards, character faces, and key visual action inside **`x ∈ [40, 910]`, `y ∈ [220, 1380]`** (with vertical card `tiltDeg` clamped to `[-1.2°, +1.2°]`).
- `<DirectorCamera3D safeBox9x16Compensation />` (enabled by default), `<DirectorCamera2D />`, and `<OpticalStage2D />` all automatically compensate FOV, distance, and vertical target framing when `height > width` (`isVerticalComposition`). Always confirm safe-box alignment with `npm run qa -- <CompositionId>`.

---

## 4. Deterministic `60 FPS` VFX (`@make-pictures/kits/vfx`)

**Absolute Determinism Law:** Remotion renders frames out-of-order across CPU cores (`--concurrency=100%`). Never accumulate particle positions or velocities in `useRef`! Every VFX component in `@make-pictures/kits/vfx` is a pure function `f(frame, fps, seed)`:

```tsx
import { ContinuousSceneFlow, OpticalCrossDissolve } from '@make-pictures/core';
import {
  CinematicLensOverlay,
  ParticleField,
  StagePostProcessing3D,
  ContactShadowDisc3D,
} from '@make-pictures/kits/vfx';
```

- **Scene Transitions (`<ContinuousSceneFlow />` & `<OpticalCrossDissolve />` — Standard):** Always sequence scenes (`>= 4.5 s` / `>= 270` frames) via `<ContinuousSceneFlow />` or `<OpticalCrossDissolve />` from `@make-pictures/core` instead of legacy geometric wipes.
- **`CinematicLensOverlay`:** Viewport HTML overlay (`pointerEvents: 'none'`) adding subtle `vignetteIntensity` (`0..1`), seeded film `grainOpacity` (`0..0.18`), `warmLightLeak` (`0..1`), and velocity-coupled `chromaticAberration` (automatically peaks during `'whip'` camera transitions via frame-keyed camera telemetry and drops to `0` when steady!).
- **`ParticleField`:** Pure analytical particle layer (`preset: 'dust-motes' | 'snow' | 'rain' | 'sparks' | 'confetti' | 'speed-lines'`, `count`, `color`, `seed`, `intensity`).
- **`StagePostProcessing3D` & `ContactShadowDisc3D`:** Drop-in children inside `<ThreeCanvas>` providing exponential atmospheric depth fog (`THREE.FogExp2`), volumetric spotlight dust cones, depth-haze planes, and soft radial contact shadows without extra postprocessing bundle bloat (used automatically inside `<StudioHdrRig3D />`, `<IsometricStage3D />`, and `<Stylized3DCharacter />`).
- **`SceneTransition` *(Legacy — Avoid in `productions/*`)*:** Legacy wipe component (`@make-pictures/kits/vfx`). **Important:** The hard `npx make-pictures qa` Director Gate **blocks** choppy `type="flash-cut" | "paper-curtain" | "iris-wipe"` and `durationInFrames < 30` in `origin: 'production'` films (unless `--allow-fast-cuts` is explicitly passed) — always prefer `<ContinuousSceneFlow />` + `<OpticalCrossDissolve />`!
