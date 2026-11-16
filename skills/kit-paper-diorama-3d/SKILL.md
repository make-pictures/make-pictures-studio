---
name: kit-paper-diorama-3d
description: >-
  Rules, geometry math, painterly ScenicCutoutMotifs, and APIs for the 2.5D layered
  cutout stage kit (@make-pictures/kits/paper-diorama-3d). Use this skill whenever
  building or editing tactile 2.5D scenes with DioramaStage3D, ScenicCutoutMotifs
  (SunburstArchCutout3D, MountainRangeCutout3D, CloudCanopyCutout3D, PineGroveCutout3D,
  AtelierDeskCutout3D), PaperCutout3D, ImageCutout3D, PopUpHinge3D, or
  PaperStageLighting3D wrapped in <StyleProvider>.
---

# Kit: Paper Diorama 3D (`@make-pictures/kits/paper-diorama-3d`)

Build crafted 2.5D layered cutout worlds inside `ThreeCanvas` (`@remotion/three`) on the neutral, style-aware `<DioramaStage3D />` stage — with painterly multi-tone `ScenicCutoutMotifs`, physical cardboard thickness, dilated die-cut borders, soft PCF shadows, and floor-hinged pop-up choreography.

> **Art Direction Note:** Use `paper-diorama-3d` purposefully when tactile 2.5D craft fits the story (especially in the **`illustrative`** `ArtWorld`, e.g., `tactile-craft`, `sketch-notebook`, or a custom brand preset in `<StyleProvider>`). Replace plain rectangular text plaques with gallery-grade `ScenicCutoutMotifs` or multi-tone illustrations. When chaining multiple 3D scenes, orchestrate them via `<ContinuousSceneFlow>` with `usesThree: true` so at most **1 WebGL `<ThreeCanvas>`** is mounted on any frame.

---

## Core Primitives & Imports

```tsx
import { ThreeCanvas } from '@remotion/three';
import {
  StyleProvider,
  CINEMATIC_SPRINGS,
  DirectorCamera3D,
  createSeededRandom,
  useStudioStyle,
} from '@make-pictures/core';
import {
  DioramaStage3D,
  PaperCutout3D,
  ImageCutout3D,
  PopUpHinge3D,
  PaperStageLighting3D,
  SunburstArchCutout3D,
  MountainRangeCutout3D,
  CloudCanopyCutout3D,
  PineGroveCutout3D,
  AtelierDeskCutout3D,
  SCENIC_CUTOUT_INNER_MARGIN_PX,
  resolveScenicCutoutPalette,
  type DioramaStage3DProps,
} from '@make-pictures/kits/paper-diorama-3d';
```

- **`DioramaStage3D`:** Neutral, theme-aware 3D stage (`variant?: 'minimal-plinth' | 'flat-sheet' | 'open-book'`, `surfacePattern?: 'solid' | 'grid' | 'spotlight'`, `pageTurnProgress?: number`, `width?: number` default `12`, `depth?: number` default `7.4`, `accentColor?: string`, `surfaceColor?: string`, `children?: React.ReactNode`). Automatically inherits `bgCanvas`, `bgSurface`, `bgElevated`, `inkBorder`, and `accentPrimary` from `useStudioStyle()`.
- **Painterly `ScenicCutoutMotifs` (Built atop `PaperCutout3D`, reactive `cacheDeps`, `whiteBorderPx = 14`, `>= 38px` inner margin, zero `Math.random()`):**
  1. **`SunburstArchCutout3D`** (`width = 5.4, height = 3.1` default, `rayCount?: number`): Celestial Romanesque halo arch with multi-stop vault gradient, radiating sunburst wedges, concentric brass/ink astrolabe rings, and stepped plinth.
  2. **`MountainRangeCutout3D`** (`width = 5.8, height = 2.7` default, `snowCapRatio?: number`): Kurzgesagt/storybook alpine ridges with split sunlit ochre/terracotta & shadow slate facets, sculpted two-tone snow caps, and valley mist gradient.
  3. **`CloudCanopyCutout3D`** (`width = 3.2, height = 1.25` default, `anchor?: 'bottom' | 'center'`, `tint?: string`): Fluffy multi-layered storybook cumulus clouds with warm sunlit crowns and horizon shadow underbelly.
  4. **`PineGroveCutout3D`** (`width = 1.9, height = 2.1` default, `treeCount?: 2 | 3`): Clustered botanical cypress/pine trees with two-tone sunlit/shadow foliage tiers on a shared mossy mound.
  5. **`AtelierDeskCutout3D`** (`width = 3.6, height = 1.85` default, `plaqueTitle?: string`, `lampOn?: boolean`): Studio workbench with wood-grain tabletop, poised articulated brass desk lamp casting a warm golden light cone, open double-page sketchbook, ceramic brush cup, and optional concise inlaid apron nameplate (with mandatory Polish-safe 4th `maxWidth` argument; omitted by default so there is zero rectangular text clutter).
  - All 5 motifs accept `primaryColor` (or `accentColor`), `secondaryColor`, `surfaceColor`, `inkColor`, `seed`, `position`, `rotation`, `scale`, `thickness`, and `opacity`.
- **`PaperCutout3D`:** Custom procedural Canvas2D cutout extruded in 3D (`cacheKey`, `cacheDeps`, `width`, `height`, `pixelWidth`, `pixelHeight`, `whiteBorderPx` default `14`, `thickness` default `0.038`, `anchor: 'bottom' | 'center' | 'top'`, `draw(ctx, w, h)`).
- **`ImageCutout3D`:** Loads any PNG/SVG/WebP asset (`src={staticFile(...)}`) cleanly with Remotion `delayRender`/`continueRender` safety and feeds it into `PaperCutout3D`.
- **`PopUpHinge3D`:** Parallel-hinge fold matrix (`foldProgress: 0..1`, `foldDirection: 1 | -1`) unfolding standing cutouts around their `y = 0` floor crease.
- **`PaperStageLighting3D`:** Configures ACES Filmic tone mapping + `2048×2048` `PCFSoftShadowMap` (`preset: 'daylight' | 'golden-hour' | 'indoor-study' | 'spotlight'`).

---

## Mandatory Geometry, Canvas & Choreography Rules

### 1. True 3D Multi-Plane Space & Painterly Motifs Over Flat Text Plaques
Every character, prop, landscape layer, and studio workbench must be a real `ScenicCutoutMotifs` prop, `PaperCutout3D`, or `ImageCutout3D` placed across distinct `Z` depth rows inside `ThreeCanvas` with `castShadow` and `receiveShadow` enabled. Never paste flat 2D DOM diagrams over a 3D cutout stage, and prefer sculptural `ScenicCutoutMotifs` over plain rectangular text boards.

### 2. Zero WebGL Z-Fighting (`Δz >= 0.45` Depth Row Separation)
Never place two overlapping cutouts or meshes at the same (or nearly identical) `z` coordinate — camera motion or subtle sway will trigger `z-buffer` flickering and shadow bleed-through:
- **Stage Depth Rows (`Δz >= 0.45`):** Separate distinct scenic depth rows (e.g., `SunburstArchCutout3D` at `z = -2.3`, `MountainRangeCutout3D` at `z = -1.6`, `PineGroveCutout3D` at `z = -0.95`, foreground `AtelierDeskCutout3D` at `z = -0.25`) by at least **`Δz >= 0.45`** world units for clear parallax and clean PCF shadow projection.
- **Attached Sub-Parts Minimum Gap:** When attaching a close badge or arm layer directly onto a parent cutout, enforce at minimum:
  $$\Delta z \ge \frac{\text{thickness}_A}{2} + \frac{\text{thickness}_B}{2} + 0.03\text{ m}$$
- **Same-Row Ensembles:** When multiple figures or items stand side-by-side on the exact same `Z` plane, draw them onto **one shared `PaperCutout3D` canvas** for that `Z` row.

### 3. `PopUpHinge3D` Local Anchor (`[0, h/2, 0]`)
`PopUpHinge3D` applies a shear-fold matrix pivoting strictly around local **`y = 0`**:
- Always use `anchor="bottom"` (the default on `PaperCutout3D`, `ImageCutout3D`, and all `ScenicCutoutMotifs`) when mounting inside `<PopUpHinge3D>`, which offsets the internal plane mesh center to **`[0, h/2, 0]`** so the bottom edge sits flush at `y = 0` on the stage floor.
- If placing custom Three.js geometry inside `<PopUpHinge3D position={[x, 0, z]}>`, shift its local mesh position to **`[0, h/2, 0]`** — centering a mesh at `[0, 0, 0]` will push its lower half through the `DioramaStage3D` plinth during `foldProgress: 0 → 1`.

### 4. Canvas Border Margins (`>= 34px`) & Mandatory Polish `maxWidth`
`PaperCutout3D` generates its die-cut edge by dilating the alpha channel outward by `whiteBorderPx` pixels:
- Every custom shape drawn inside `draw(ctx, w, h)` **must leave a clear margin** on all 4 edges (top, bottom, left, right) of at least **`34 px`** (`SCENIC_CUTOUT_INNER_MARGIN_PX = 38`, satisfying `whiteBorderPx + lineWidth + 14 px`) so the dilated cream-white border is never sliced flat.
- **Polish text is 25–40% longer than English:** Every `ctx.fillText(text, x, y, maxWidth)` inside a box of width `boxWidth` **must pass the 4th parameter `maxWidth = boxWidth - 48`**. Always inspect QA frames in Polish first when producing bilingual or Polish videos.

### 5. HMR Cache Invalidation (`cacheDeps`), Style Sync & Determinism
- `PaperCutout3D` maintains a bounded 64-entry LRU VRAM cache (`TEXTURE_CACHE`) to prevent `WebGL context lost` during long `Studio Web` sessions.
- Whenever a custom `draw(ctx)` reads dynamic variables from props or `useStudioStyle()`, **always include every dynamic value in `cacheDeps={[cardTitle, style.palette.accentPrimary, style.palette.bgSurface]}`** so `Studio Web` and **🎨 Style Lab** updates rebuild the texture in `0 ms` (`ScenicCutoutMotifs` wire full `cacheDeps` automatically).
- **Never call `Math.random()`** inside `draw(ctx)` or scene trees — always use `createSeededRandom(seed)` from `@make-pictures/core`.

### 6. Clean Stage, Pacing (`>= 4.5s`) & 3-Phase Page/Act Transitions
- **Clean Frame `0`:** Keep initial entrances starting at `frame >= 2` (`CINEMATIC_SPRINGS.entrance` from `@make-pictures/core`) so `frame === 0` renders 100% pure `palette.bgCanvas`.
- **Forbidden central spine & shrinking:** Never place a vertical divider cylinder at `x = 0` or hide the stage behind close-up cards by scaling it to `0.05`.
- **3-Phase Transition Choreography (`PopUpHinge3D` + `DioramaStage3D`):** When using `variant="open-book"`, never sweep a turning page through standing cutouts:
  1. **Fold Down:** Outgoing cutouts fold flat (`foldProgress: 1 → 0` with `Easing.inOut(Easing.cubic)`).
  2. **Turn Sheet:** Only once `foldProgress <= 0.02`, animate `pageTurnProgress: 0 → 1` on `<DioramaStage3D variant="open-book" />`.
  3. **Pop Up:** Incoming act hinges unfold upright (`foldProgress: 0 → 1`).

---

## Reference Pattern (`<StyleProvider>` + `<DioramaStage3D>` + `ScenicCutoutMotifs`)

```tsx
const DioramaLandscape: React.FC<{ title: string; foldBg: number; foldMid: number; foldFg: number }> = ({
  title,
  foldBg,
  foldMid,
  foldFg,
}) => {
  const style = useStudioStyle();

  return (
    <>
      <PaperStageLighting3D preset={style.surface.isDark ? 'spotlight' : 'golden-hour'} />
      <DioramaStage3D variant="minimal-plinth" surfacePattern="spotlight">
        {/* Far Horizon Row: z = -2.25 */}
        <PopUpHinge3D foldProgress={foldBg} position={[0, 0, -2.25]}>
          <SunburstArchCutout3D width={5.6} height={3.15} />
        </PopUpHinge3D>

        {/* Alpine Ridge Row: z = -1.55 (Δz = 0.70 >= 0.45) */}
        <PopUpHinge3D foldProgress={foldMid} position={[0, 0, -1.55]}>
          <MountainRangeCutout3D width={5.9} height={2.7} />
        </PopUpHinge3D>

        {/* Floating Sky Canopy & Pine Flanks: z = -0.95 (Δz = 0.60 >= 0.45) */}
        <CloudCanopyCutout3D position={[-2.1, 2.35, -0.95]} anchor="center" scale={foldMid} />
        <PopUpHinge3D foldProgress={foldMid} position={[-2.55, 0, -0.95]}>
          <PineGroveCutout3D width={1.85} height={2.05} />
        </PopUpHinge3D>
        <PopUpHinge3D foldProgress={foldMid} position={[2.55, 0, -0.95]}>
          <PineGroveCutout3D width={1.75} height={1.95} treeCount={2} seed="east-grove" />
        </PopUpHinge3D>

        {/* Foreground Studio Workbench Row: z = -0.25 (Δz = 0.70 >= 0.45) */}
        <PopUpHinge3D foldProgress={foldFg} position={[0, 0, -0.25]}>
          <AtelierDeskCutout3D plaqueTitle={title} />
        </PopUpHinge3D>
      </DioramaStage3D>
    </>
  );
};
```
