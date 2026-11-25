---
name: kits-2d
description: >-
  Complete APIs, optical multi-plane staging, 2D Shot DSL camera, deterministic
  VFX, and layout guardrails for all 2D kits under @make-pictures/remotion:
  kits/editorial-collage, kits/vector-scene-2d, kits/motion-diagrams-2d,
  kits/kinetic-typography, kits/data-storytelling, kits/product-frames, kits/vfx,
  plus optics, director, and 2D camera. Use whenever building 2D documentaries,
  explainers, architecture diagrams, Retro-PC hops, SaaS screencasts, kinetic
  typography, or data storytelling videos.
---

# 2D Visual Kits, Optical Staging & 2D Camera (`@make-pictures/remotion`)

> **Tandem Skills Contract (`remotion-dev/skills`):** Base Remotion primitives (`<AbsoluteFill>`, `<Sequence>`, `<Img>`, `<OffthreadVideo>`, `spring()`, `interpolate()`, `staticFile()`) live in **`remotion-dev/skills`** (`npx remotion skills add`). Every component below lives in `@make-pictures/remotion` (zero `three` dependency — safe in 2D-only Remotion projects and `@remotion/player` embeds).

---

## 1. Universal 2D Stage, Pacing & Optical Primitives

```tsx
import {
  CINEMATIC_SPRINGS,
  ClippedSurfaceChrome,
  ContinuousSceneFlow,
  DIRECTOR_PACING_BUDGET,
  DepthPlane,
  DirectorCamera2D,
  OpticalCrossDissolve,
  OpticalStage2D,
  SceneSubViewDissolve,
  ScenicBackdropLayers,
  StageLightingRig,
  StyleProvider,
  computeSceneTimingFromVoiceover,
  createSeededRandom,
  getTactileSurfaceStyle,
  interpolateStylePresets,
  useFocalStagger,
  useOpticalStage,
} from '@make-pictures/remotion';
import { CinematicLensOverlay, ParticleField } from '@make-pictures/remotion/kits/vfx';
```

- **Clean Frame `0` & Determinism:** All stages/cards render pure uniform `palette.bgCanvas` on `frame <= 0` (`startFrame >= 1`, entrance springs at `frame - 2`). Never use `Math.random()` (use `createSeededRandom(seed)`) or cross-frame `useRef` accumulation.
- **Calm Scene Flow (`>= 4.5 s` / `270f`) & `<= 2` Sub-Views:** Connect scenes with `<ContinuousSceneFlow crossDissolveFrames={54} />` + `<OpticalCrossDissolve />` (avoid legacy `SceneTransition` wipes — blocked by `npx make-pictures qa` unless `--allow-fast-cuts` on `9:16` poster reels). Transition between at most `2` sub-views inside a scene via `<SceneSubViewDissolve switchAtFrame={...} dissolveFrames={54} />`.
- **2.5D Multi-Plane Optics (`<OpticalStage2D />`, `<DepthPlane z={-2..+1.5} />`, `<StageLightingRig />`):**
  - `OpticalStage2D` solves `(x, y, zoom, rotateZ, focalZ, aperture)` with automatic `9:16` Golden Safe Box compensation and publishes camera velocity to `DirectorCameraTelemetryContext` (driving `<CinematicLensOverlay />` subtle chromatic aberration during `'whip'` pans).
  - `DepthPlane` computes Z-parallax and Circle-of-Confusion blur, emitting **`filter: 'none'`** whenever CoC `< 0.25px` for razor-sharp `latin-ext` Google Fonts.
  - `StageLightingRig` renders `'window-gobo' | 'darkroom-halation' | 'studio-macro'` (pass `renderBaseFill={false}` inside `<StyleProvider renderBackdrop>`).
  - `getTactileSurfaceStyle(style, { elevation, tiltDeg })` projects directional two-stage contact + cast shadows from `style.optics.lightAngleDeg` (clamp `tiltDeg` to `[-1.2°, +1.2°]` in `9:16`).
- **Rounded-Card Hygiene (`<ClippedSurfaceChrome />`):** Always wrap internal top accent bars / specular rims on `overflow: 'visible'` cards inside `<ClippedSurfaceChrome />` (`UNCLIPPED_CARD_BAR` QA rule).
- **`9:16` Golden Safe Box (`1080×1920`):** Keep all titles, cards, pins, and focal action inside **`x ∈ [40, 910]`, `y ∈ [220, 1380]`** (`<DirectorCamera2D />` defaults `handheldIntensity = 0` and snaps cleanly to `transform: 'none'` at identity).

---

## 2. Editorial Collage (`@make-pictures/remotion/kits/editorial-collage`)

Imports: `EditorialDeskStage`, `EditorialPanoramaTrack`, `ChapterTitleCard`, `EditorialMediaCard`, `HighlightQuoteStage`, `SplitStoryLayout`, `PaperRibbonTimeline`, `FloatingEditorialDisplay`, `resolveActivePaperMilestoneId`, `computeSplitStoryVerticalBounds`, `resolveHighlightStartFrame`.

- **`EditorialDeskStage`:** Layers `<StageLightingRig />` + 3-ArtWorld `<ScenicBackdropLayers />` + `<OpticalStage2D />` (`sheetCode` defaults to `undefined` — zero dev clutter; pass `renderBaseFill={false}` inside `<StyleProvider renderBackdrop>`).
- **`ChapterTitleCard`:** Monumental opener with crop-mark registration, hairline rule, and lens focus-pull entrance (single focal point).
- **`EditorialMediaCard`:** Physical baryta print, passe-partout, or slide mount (`<ClippedSurfaceChrome />` rim, deterministic Ken Burns pan/zoom, and 3-ArtWorld painterly SVG fallback when `src` is omitted; `sourceTag` defaults to `undefined`).
- **`EditorialPanoramaTrack` (`items`, `durationInFrames`):** **Mandatory replacement for robotic `3×2` blinking tile grids.** Arranges `3–6` large `EditorialMediaCard` plates (`660×480 px`, `cy ± 20 px`) along a gliding `<DirectorCamera2D />` panorama with Ken Burns (`1.02 → 1.08`), auto-adapting to a vertical cascade inside the `9:16` Safe Box.
- **`HighlightQuoteStage` & `SplitStoryLayout`:** Word-synced SVG ink-brush highlight (`words={VOICEOVER_MANIFEST[sceneId]?.words}`) and dual-elevation `1.08fr 0.92fr` split with optional `focusShiftFrame` rack focus.
- **Frameless Overlays over 3D/2.5D (`>= 19–22 px`, zero dark web boxes):**
  - `<FloatingEditorialDisplay />` (`background: 'transparent'`, `headlinePx = 64`, `sublinePx = 23`, soft optical contrast text-shadow).
  - `<PaperRibbonTimeline />` (`milestones`, `resolveActivePaperMilestoneId`, `>= 20 px` archival ribbon strip).

---

## 3. Vector Scene 2D (`@make-pictures/remotion/kits/vector-scene-2d`)

Imports: `VectorSceneStage2D`, `StoryCard2D`, `HorizontalFeatureGrid2x2`, `PinnedMediaStage`, `AnnotatedCallout2D`, `ComparisonSplit2D`, `computeSafeSplitBounds`, `computeHorizontalFeatureGridBounds`.

- **`StoryCard2D` & `HorizontalFeatureGrid2x2`:** Enforces `TYPOGRAPHY_FLOOR_1080P` (**`28px` title `2–5` words + `20px` sentence `6–11` words + `18px` badge**), `height: 'auto'`, `justifyContent: 'center'`, `boxSizing: 'border-box'` (zero `space-between` voids), `<ClippedSurfaceChrome />`, and polymorphic 3-ArtWorld SVG medallions. Use `HorizontalFeatureGrid2x2` (`64px 1fr` medallion cards) for balanced `2×2` summaries.
- **`PinnedMediaStage` (Sub-Pixel `Δx = 0.00 px` Annotations):** Pass exact `sourceWidth` (`W`) & `sourceHeight` (`H`) + `pins: MediaPinSpec[]` (`{ id, cx, cy, label, placement }`). Locks an `aspectRatio: '${W} / ${H}'` wrapper `1:1` to `<Img>` and mounts each reticle + `>= 18px` label pill on a `width: 0, height: 0` anchor at `(cx / W * 100%, cy / H * 100%)` for zero drift on every spring frame.
- **`AnnotatedCallout2D` & `ComparisonSplit2D`:** Auto-clamped elbow callouts and baseline-vs-thesis comparison with **dignified light-mode rack focus** (recessed light cards stay legible at `opacity >= 0.88`, `blur <= 2.0px`, crisp `inkBorder`).

---

## 4. Motion Diagrams 2D & Retro-PC (`@make-pictures/remotion/kits/motion-diagrams-2d`)

Imports: `MotionDiagramStage2D`, `useMotionDiagramFocus`, `RetroPcWindowStage2D`, `computeRetroPcWindowLayout`, `CameraRig`, `WorldBox`, `portTop`, `portBottom`, `portLeft`, `portRight`, `computeLiveNodePort`, `buildElasticCordPath`, `FlowCurve`, `DataFlowEdge`, `buildCubicBezierPath`, `evaluateCubicBezier`, `evaluateCubicBezierAngleDeg`, `SystemNode`, `CodePayloadToast`.

- **Single-Source `NodeBox` & Border Ports:** Define every node once as `NodeBox` (`{ cx, cy, w, h }`; separate `VERTICAL_WORLD_NODES` for `9:16` with `w <= 640px` inside the Safe Box). `WorldBox` sets `boxSizing: 'border-box'` so `portTop/Bottom/Left/Right` sit exact on borders. For animated/tilting cards, use `computeLiveNodePort(...)` + `buildElasticCordPath(...)`.
- **Visual Noise Ban & Single-Source Cubic Bézier:** Never clutter diagrams with packet clouds, radar rings, or spaghetti color legends (if decoding takes `> 2 s`, simplify to `<= 3` calm nodes or `<ComparisonSplit2D />`). `FlowCurve` and `DataFlowEdge` default to **`packetCount = 0`**; when a single pulse (`packetCount={1}`) is warranted, both `<path d={curve.d} />` and `evaluateCubicBezier(...)` share the exact same `buildCubicBezierPath` control points (`traverseFrames`: `92–120f`, never `< 60`; label clearance `>= 26–30px` with `>= 18px` font).
- **`<RetroPcWindowStage2D />` (`--style=retro-pc`):** CRT desktop window with animated `RetroPcHopSpec[]` packet hops and `computeRetroPcWindowLayout` (`16:9` horizontal / `9:16` Safe Box cascade). **Security Rule:** Use **symbolic offline example URLs only** (e.g., `GET https://example.app` or `GET https://twoja-strona.pl`) — never private LAN/gateway/router IPs!

---

## 5. Kinetic Typography & Data Storytelling

- **`@make-pictures/remotion/kits/kinetic-typography`:** `WordByWordStage` (`groupWordsIntoBeats`), `ImpactKeywordCard`, `AnimatedMetricCounter` (`formatTabularMetric` — 21-tick Vernier scale or 10-segment Risograph meter). Adapts across `'swiss-spatial' | 'optical-gate' | 'risograph-poster'`.
  - **Single Focal Point Law (`COMPETING_FOCAL_POINT`):** Never mount `<WordByWordStage>` in the same scene as `<ImpactKeywordCard>`, `<StoryCard2D>`, `<MetricComparisonCard>`, or `<SystemNode>`.
- **`@make-pictures/remotion/kits/data-storytelling`:** `DataStoryStage2D`, `AnimatedBarRace` (`getSmoothedRanks` zero-`useRef` overtaking, `resolveTonalBarFill`), `TimelineTrack` (25-subdivision vernier rail, auto-vertical on `9:16`), `MetricComparisonCard` (`240°` SVG dials or `45°` hatched delta bars).
  - Enforce `>= 18–19 px` labels, `64–96 px` `tabular-nums` KPIs, and `>= 60%` visual area fill.

---

## 6. Product Frames / SaaS Screencasts (`@make-pictures/remotion/kits/product-frames`)

Imports: `BrowserFrame`, `PhoneFrame`, `ScreenSpotlightOverlay`, `PinnedMediaStage`.

```tsx
import { staticFile } from 'remotion';
import { StyleProvider } from '@make-pictures/remotion';
import { BrowserFrame, PhoneFrame, ScreenSpotlightOverlay } from '@make-pictures/remotion/kits/product-frames';

<StyleProvider style={props.styleId} renderBackdrop>
  <BrowserFrame url="app.example.com/dashboard" videoSrc={staticFile('videos/demo.mp4')} width={1360} enterFrame={2}>
    <ScreenSpotlightOverlay x={62} y={18} width={30} height={14} startFrame={90} endFrame={210} label="Nowy raport" />
  </BrowserFrame>
</StyleProvider>
```

- Uses Remotion `<OffthreadVideo />` (`muted` default `true`), supports `BrowserFrame` (`variant: 'macos' | 'arc' | 'minimal'`, `1360px`) and `PhoneFrame` (`variant: 'dynamic-island' | 'minimal'`, `520px`, fits `9:16` Safe Box). Pair inside `<DirectorCamera2D />` or `<MotionDiagramStage2D />` for Screen Studio-style spotlight glides.
- **Remotion Elements:** 5 standalone 2D components (`editorial-media-card`, `floating-editorial-display`, `animated-bar-race`, `product-browser-frame`, `motion-diagram-stage`) are cataloged in `@make-pictures/remotion/elements` (`npx make-pictures elements build`).
