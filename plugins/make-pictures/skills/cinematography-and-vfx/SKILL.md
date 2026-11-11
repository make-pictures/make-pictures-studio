---
name: cinematography-and-vfx
description: >-
  Declarative Shot DSL camera direction (DirectorCamera3D & DirectorCamera2D),
  9:16 Golden Safe Box auto-framing, deterministic handheld/impact camera noise,
  and 60 FPS VFX primitives (@make-pictures/kits/vfx: CinematicLensOverlay,
  ParticleField, StagePostProcessing3D, SceneTransition). Use whenever framing
  2D/3D shots, choreographing transitions, or adding lens/atmospheric effects.
---

# Cinematography & Deterministic VFX (`@make-pictures/core` & `@make-pictures/kits/vfx`)

Direct 3D and 2D cameras using film-grammar shot names instead of raw trigonometry, with automatic `9:16` Golden Safe Box framing and 100% deterministic `60 FPS` visual effects.

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
- **Timeline Export:** Pass `shotsToCameraTimeline(SHOTS, durationInFrames)` into `StudioCompositionEntry.cameraTimeline` so **Studio Web** renders every camera cut in the Multi-Track Director Timeline.

### Deterministic Handheld Sway & Trauma Shake
- `handheldIntensity` (`0..1`): Uses `evaluateHandheldNoise(frame, fps, seed, intensity)` locked to calm human breathing frequencies (`0.03..0.055` rad/frame) so the camera feels alive without jittering.
- `impulses?: CameraImpulse[]` (`{ frame, intensity?, decayFrames? }`): Uses `evaluateImpactShake` for damped harmonic thuds on impacts/landings, decaying cleanly to exact `0`.

---

## 2. 2D Infinite-Canvas Shot DSL (`<DirectorCamera2D />`)

```tsx
import { DirectorCamera2D, type ShotSpec2D } from '@make-pictures/core';
```

- Accepts either explicit `CameraKeyframe2D[]` or named `nodes: Record<string, StageNode2D>` + `shots: ShotSpec2D[]` (`{ fromFrame, target: string | string[], transition?: 'cut' | 'glide' | 'whip', padding?, zoom?, rotateZ?, label? }`).
- Automatically computes the bounding box of `target` (single node or array of nodes), fits it into `16:9` or the **`9:16` Golden Safe Box**, renders the viewport-pinned infinite technical grid without GPU edge clipping, and publishes live `velocity` telemetry.

---

## 3. `9:16` Vertical Framing & The Golden Safe Box (`1080×1920`)

Social video players cover huge portions of a `1080×1920` screen with native UI:
- **Top Dead Zone (`y = 0..220 px`):** Status bar, Dynamic Island, and Shorts/Reels header icons.
- **Bottom Dead Zone (`y = 1440..1920 px`, i.e. `bottom < 480 px`):** Channel avatar, video title, audio ticker, and *Related video* pill.
- **Right Dead Zone (`x = 910..1080 px` for `y > 900 px`):** Like / Comment / Share / Remix icon rail (`170 px` wide).
- **Golden Safe Box:** Keep all titles, cards, character faces, and key visual action inside **`x ∈ [40, 910]`, `y ∈ [220, 1380]`**.
- Both `<DirectorCamera3D safeBox9x16Compensation />` (enabled by default) and `<DirectorCamera2D />` automatically compensate FOV, distance, and vertical target framing when `height > width` (`isVerticalComposition`). Always confirm safe-box alignment with `npm run qa -- <CompositionId>`.

---

## 4. Deterministic `60 FPS` VFX (`@make-pictures/kits/vfx`)

**Absolute Determinism Law:** Remotion renders frames out-of-order across CPU cores (`--concurrency=100%`). Never accumulate particle positions or velocities in `useRef`! Every VFX component in `@make-pictures/kits/vfx` is a pure function `f(frame, fps, seed)`:

```tsx
import {
  CinematicLensOverlay,
  ParticleField,
  StagePostProcessing3D,
  ContactShadowDisc3D,
  SceneTransition,
} from '@make-pictures/kits/vfx';
```

- **`CinematicLensOverlay`:** Viewport HTML overlay (`pointerEvents: 'none'`) adding subtle `vignetteIntensity` (`0..1`), seeded film `grainOpacity` (`0..0.18`), `warmLightLeak` (`0..1`), and velocity-coupled `chromaticAberration` (automatically peaks during `'whip'` camera transitions via frame-keyed camera telemetry and drops to `0` when steady!).
- **`ParticleField`:** Pure analytical particle layer (`preset: 'dust-motes' | 'snow' | 'rain' | 'sparks' | 'confetti' | 'speed-lines'`, `count`, `color`, `seed`, `intensity`).
- **`StagePostProcessing3D` & `ContactShadowDisc3D`:** Drop-in children inside `<ThreeCanvas>` providing exponential atmospheric depth fog (`THREE.FogExp2`), volumetric spotlight dust cones, depth-haze planes, and soft radial contact shadows without extra postprocessing bundle bloat.
- **`SceneTransition`:** Declarative transition wipe centered at `atFrame` (`durationInFrames`, `type: 'iris-wipe' | 'whip-pan' | 'paper-curtain' | 'flash-cut' | 'ink-wash'`, `accentColor`). Pair with a `'whoosh'` or `'page-slide'` `<SoundCue />`!
