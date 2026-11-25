---
name: kits-3d-and-kinematics
description: >-
  Complete APIs and geometry/physics rules for 2.5D/3D kits and kinematics under
  @make-pictures/remotion: kits/paper-diorama-3d (9 ScenicCutoutMotifs),
  kits/isometric-3d (Soft-Clay Podcast Studio + SyncStudioIbl3D), kits/tactile-3d
  (DeformableSheet3D, procedural PBR maps, DaylightArcRig3D, ScreenGlassLayer3D),
  kinematics (Disney 12-principles + 15-axis OBB SAT auditSceneCollisions3D), and
  camera (DirectorCamera3D Shot DSL + computeCameraBasis3D).
---

# 3D Kits, Tactile Physics, Disney Kinematics & Shot DSL Camera (`@make-pictures/remotion`)

> **Tandem Skills Contract (`remotion-dev/skills`):** Base Remotion + `@remotion/three` `<ThreeCanvas>` setup, WebGL rendering flags, and React Three Fiber basics live in **`remotion-dev/skills`** (`npx remotion skills add`).
> **Optional 3D Peers & Clean Import Boundaries:** `three`, `@react-three/fiber`, `@react-three/drei`, and `@remotion/three` are optional peer dependencies. Root `@make-pictures/remotion` and `@make-pictures/remotion/kinematics` have **zero `three` imports** (so kinematics and 3D collision audits run natively in Node unit tests). Import `<DirectorCamera3D />` from **`@make-pictures/remotion/camera`**.

---

## 1. 2.5D Paper Diorama (`@make-pictures/remotion/kits/paper-diorama-3d`)

Imports: `DioramaStage3D`, `PaperCutout3D`, `ImageCutout3D`, `PopUpHinge3D`, `PaperStageLighting3D`, `SCENIC_CUTOUT_INNER_MARGIN_PX`, `resolveScenicCutoutPalette`, plus all **9 painterly `ScenicCutoutMotifs`**:
- **Nature & Atelier (1–5):** `SunburstArchCutout3D`, `MountainRangeCutout3D`, `CloudCanopyCutout3D`, `PineGroveCutout3D`, `AtelierDeskCutout3D`.
- **Cosmic & Apollo 11 Lunar (6–9):** `StarryCosmosBackdropCutout3D`, `EarthriseCutout3D`, `LunarCraterRidgeCutout3D` (`ridgeVariant: 'far' | 'near'`), `LunarLanderCutout3D` (`thrusterIntensity: 0..1`).

### Mandatory 2.5D Cutout Rules
1. **Zero WebGL Z-Fighting (`Δz >= 0.45`):** Separate distinct scenic depth rows by **`>= 0.45`** world units (e.g., `z = -2.35, -1.80, -1.25, -0.70, -0.10`). Attached sub-parts require $\Delta z \ge \frac{\text{thickness}_A + \text{thickness}_B}{2} + 0.03$.
2. **`PopUpHinge3D` Floor Pivot (`y = 0`):** Keep `anchor="bottom"` for standing floor cutouts; use `anchor="center"` for floating sky elements (`CloudCanopyCutout3D`, `EarthriseCutout3D`).
3. **Canvas Margins & Polish `maxWidth`:** Inside custom `PaperCutout3D` `draw(ctx, w, h)`, keep **`34–38 px`** clear margin (`SCENIC_CUTOUT_INNER_MARGIN_PX = 38`) on all 4 edges so die-cut borders never clip flat, pass `maxWidth` to `ctx.fillText(...)`, and list every dynamic value in `cacheDeps={[...]}`.
4. **`PaperStageLighting3D` Presets:** Strictly `'daylight' | 'golden-hour' | 'indoor-study' | 'spotlight'` (`ACESFilmic` + `2048×2048` `PCFSoftShadowMap`).
5. **Safe RGBA Extraction for `<ImageCutout3D />`:** Always run `npx make-pictures cutout <file> --out=...` (PDF `/SMask` or Exterior Border Flood-Fill — **never** global white thresholding `rgb > 245 => alpha = 0`) and inspect the `#0F172A`/`#1E293B` checkerboard QA PNG.

---

## 2. 3D Soft-Clay, Spatial IBL & Isometric Studio (`@make-pictures/remotion/kits/isometric-3d`)

Imports: `StudioHdrRig3D`, `resolveStudioHdrRigSpec`, `PodcastStudioSet3D`, `computePodcastStudioLayout`, `ClayCharacter3D`, `computeClayBlinkProgress`, `resolvePhysicalFinishProps`, `IsometricStage3D`, `IsometricScenicSet3D`, `Stylized3DCharacter`, `computeScenicRoomTokens`, `resolveIsometricMaterialPreset`, `computeIsometricLightRig`.

- **Flagship `--space=3d` Stack (`<StudioHdrRig3D />` + `<PodcastStudioSet3D />` + `<ClayCharacter3D />`):**
  - `<StudioHdrRig3D preset={resolveStyleMaterial3D(style).studioHdr} />` (`'warm-softbox' | 'clean-atelier' | 'neon-grid'`) mounts `<SyncStudioIbl3D />` synchronously on Frame 1 under `frameloop="never"` (zero remote CDN `.hdr` fetches!).
  - `<PodcastStudioSet3D compactVertical={height > width} onAirActive />` narrows room & host spacing (`±0.92 m` vs `±1.30 m`) via `computePodcastStudioLayout` so both hosts fit inside the `9:16` **Golden Safe Box `x ∈ [40, 910], y ∈ [220, 1380]`**.
  - `<ClayCharacter3D />` (`seated`, `accessory: 'headphones' | 'glasses' | 'beanie' | 'none'`, `finish: 'soft-clay' | 'frosted-glass' | 'retro-voxel' | 'matte-ceramic'`, `pose`) features 3D eyes/catchlights, deterministic blinks (`computeClayBlinkProgress`), and strict **`talkBounce = 0`**.
- **Voiceover Separation & Smooth Gestures:**
  - Read `const speech = getSpeechStateAtFrame(sceneId, localFrame, voiceoverManifest?)` (or `voiceSegments` from `dialogueInputs`). Use `speech.speakingWeight` for posture/hand cadence/spotlights, and `speech.energy` **only** for `speechEnergy` mouth articulation.
  - Wrap pose windows in `getSmoothPoseWindow(frame, fps, startFrame, endFrame)` (zero binary ternaries); keep idle sway in `frame * 0.03..0.055` rad/frame.
- **WebGL Context Budget (`<= 1` `<ThreeCanvas>`):** Sequence multiple 3D scenes with `<ContinuousSceneFlow usesThree: true />` (luminous veil handoff ensures at most 1 WebGL context per frame). On `2D → 3D` cross-dissolve seams, offset local `ShotSpec3D.fromFrame` and speech cues by `frameOffsetInSequence = win.nominalStart - win.mountFrom` while keeping the opening shot at `fromFrame: 0`.
- **Frameless Overlays over 3D:** Mount `<FloatingEditorialDisplay />` and `<PaperRibbonTimeline />` (`@make-pictures/remotion/kits/editorial-collage`, `>= 19–22 px`, `background: 'transparent'`) — never opaque dark web boxes.

---

## 3. Tactile 3D Sheets, Sync IBL, Procedural PBR & Daylight Arc (`@make-pictures/remotion/kits/tactile-3d`)

Imports: `DeformableSheet3D`, `SHEET_MATERIAL_FINISHES`, `computeGridAtlasUvRect`, `usePreloadedTextures3D`, `SyncStudioIbl3D`, `DEFAULT_STUDIO_IBL_PANELS`, `getProceduralPbrMaps`, `disposeProceduralPbrMaps`, `DaylightArcRig3D`, `evaluateTimeOfDayLighting`, `ScreenGlassLayer3D`, `ScreenGlassSlot`. (Pair with `StagePostProcessing3D` & `ContactShadowDisc3D` from `@make-pictures/remotion/kits/vfx`.)

- **`<DeformableSheet3D />`:** Multi-segment rounded 3D physical sheet with GPU vertex bending (`deform={{ bendX, bendY, twist, cornerWhip, velocityStretch }}`) and synchronized curved **`customDepthMaterial`** (no flat-shadow detachment).
  - Finishes (`SHEET_MATERIAL_FINISHES`): `'parchment-matte'`, `'woodblock-cotton'`, `'linen-glaze'`, `'cyanotype-blueprint'`, `'xray-neon'`.
  - Use `bleedInsetUv={0.015}` to crop scan borders cleanly, `uvRect={computeGridAtlasUvRect({ slot, cols, rows, bleedInsetUv })}` for contact-sheet atlases, and **`usePreloadedTextures3D(specs)`** for concurrency-safe LRU `delayRender` texture loading.
- **`<SyncStudioIbl3D />`:** Builds an analytic virtual softbox scene and runs `THREE.PMREMGenerator.fromScene(...)` synchronously in `useLayoutEffect` so HDR reflections work on Frame 1 under Remotion's `frameloop="never"`.
- **`getProceduralPbrMaps(kind, { seed, repeat, size })`:** Zero-network seeded PBR triplets `{ map, bumpMap, roughnessMap }` (`SRGBColorSpace` / `NoColorSpace`) for 4 studio surfaces: `'linen-weave'`, `'wood-grain'`, `'cotton-paper'`, `'brushed-metal'` (works in browser & Node tests; never dispose shared maps on individual prop unmount).
- **`<DaylightArcRig3D timeOfDay={0..1} />` (`evaluateTimeOfDayLighting`):** Composes `<SyncStudioIbl3D />` across `0.0` (sunlit morning) → `0.5` (golden afternoon) → `1.0` (focused evening lamp), wired to `sceneLampMultiplier` from `computeGlassLightingBlend`.
- **`<ScreenGlassLayer3D />` & `<ScreenGlassSlot />`:** Camera-locked foreground glass plane via `projectScreenGlassPose(camera, ndcX, ndcY, glassDistance, aspect)` so foreground tactile 3D sheets track every camera orbit with zero jitter and soft lens fill lighting.

---

## 4. Disney Kinematics & 15-Axis OBB SAT Collision Proofs (`@make-pictures/remotion/kinematics`)

Pure zero-`three` math runnable directly inside Node unit tests (`npx tsx --test`):

```ts
import {
  // Disney 12-Principles Kinematics
  disneyEase,
  evaluateAnticipation,
  evaluateArc3D,
  evaluateSurfaceImpact,
  evaluateVelocityStretch,
  evaluateSecondaryCascade,
  // 15-Axis OBB SAT & Surface Clearance Proofs
  obbClearanceSat3D,
  obbIntersectsSat3D,
  computeDeformedSheetAabb3D,
  computeSurfaceClearanceY,
  auditSceneCollisions3D,
} from '@make-pictures/remotion/kinematics';
```

- **Physical Choreography:** Combine `evaluateAnticipation` (counter-motion dip), `disneyEase(t, 'launch' | 'hang' | 'slap' | 'settle')`, `evaluateArc3D(p0, p1, p2, p3, t, bankFactor, maxBankRad)` (aerodynamic banking), `evaluateVelocityStretch`, `evaluateSurfaceImpact(framesSinceImpact, strength)` (area-preserving squash & stretch + `cornerWhip` settling cleanly to `0`), and `evaluateSecondaryCascade` (stacked sheet rustle).
- **Mandatory Zero-Collision Unit Test Gate:** Before running `npx make-pictures qa` on any animated 3D tabletop/sheet choreography, sample key animation frames with `computeDeformedSheetAabb3D(...)`, `computeSurfaceClearanceY(aabb, surfaceY)`, and `auditSceneCollisions3D(bodies, { minClearance, ignoredPairs, surfaceY, minSurfaceClearance })` (using exact 15-axis OBB SAT `obbClearanceSat3D` / `obbIntersectsSat3D`) to prove zero interpenetration and zero tabletop clipping.

---

## 5. 3D Shot DSL Camera & Basis Math (`@make-pictures/remotion/camera`)

```tsx
import {
  DirectorCamera3D,
  computeCameraBasis3D,
  evaluateCameraKeyframes3D,
  projectScreenGlassPose,
  computeGlassLightingBlend,
  evaluateHandheldNoise,
  evaluateImpactShake,
} from '@make-pictures/remotion/camera';
```

- **`<DirectorCamera3D safeBox9x16Compensation />`:** Define named `StageAnchor3D` targets and cut/glide via `ShotType3D`: `'establishing-wide' | 'medium' | 'medium-two-shot' | 'close-up' | 'macro' | 'over-the-shoulder' | 'low-angle-hero' | 'high-crane' | 'custom'`, with transitions `'cut' | 'glide' | 'whip' | 'orbit'` and optional Vertigo `dollyZoomDeltaFov`.
- **Active Closer Camera Rule:** Never hold a distant static wide shot for `15–20 s` where hero props fill `< 35%` of height. Move in with `'close-up'` / `'macro'` (`fov: 28–36`) and evolve camera framing every `4.5–8 s`.
- **Overhead Gimbal Singularity Guard (`computeCameraBasis3D`):** Automatically switches `worldUp` to `[0, 0, -1]` when `|forward.y| > 0.995` so vertical top-down / flat-lay overhead shots never flip or produce `NaN`.
- **One-Shot Keyframes & Handheld:** `evaluateCameraKeyframes3D(frame, keyframes, impulses?, handheldIntensity?, seed?)` keeps breathing sway calm (`handheldIntensity <= 0.015`, `0.03..0.055` rad/frame) and decays trauma impulses cleanly to `0`.
- **Clean Frame `0`:** All 3D stages/rigs (`DioramaStage3D`, `StudioHdrRig3D`, `PodcastStudioSet3D`, `ClayCharacter3D`, `IsometricStage3D`, `DaylightArcRig3D`) return `null` on `frame <= 0` so `f=0` stays uniform `palette.bgCanvas`.
