---
name: kit-paper-diorama-3d
description: >-
  Rules, geometry math, all 9 painterly ScenicCutoutMotifs (5 nature/atelier motifs
  + 4 Apollo 11 cosmic/lunar motifs), and APIs for the 2.5D layered cutout stage
  kit (@make-pictures/kits/paper-diorama-3d). Use this skill whenever building or
  editing tactile 2.5D scenes (--space=2.5d) with DioramaStage3D, SunburstArchCutout3D,
  MountainRangeCutout3D, CloudCanopyCutout3D, PineGroveCutout3D, AtelierDeskCutout3D,
  StarryCosmosBackdropCutout3D, EarthriseCutout3D, LunarCraterRidgeCutout3D,
  LunarLanderCutout3D, PaperCutout3D, ImageCutout3D, PopUpHinge3D, or
  PaperStageLighting3D wrapped in <StyleProvider>.
---

# Kit: Paper Diorama 3D (`@make-pictures/kits/paper-diorama-3d`)

Build crafted 2.5D layered cutout worlds (`--space=2.5d`) inside `ThreeCanvas` (`@remotion/three`) on the neutral, style-aware `<DioramaStage3D />` stage — with **9 painterly multi-tone `ScenicCutoutMotifs`** (5 nature/atelier motifs + 4 cosmic/Apollo 11 lunar motifs), physical cardboard thickness, dilated die-cut borders (`SCENIC_CUTOUT_INNER_MARGIN_PX = 38`), `2048×2048` soft PCF shadows, and floor-hinged pop-up choreography.

> **Art Direction Note:** Use `paper-diorama-3d` purposefully when tactile 2.5D craft fits the story (especially `--space=2.5d` in the **`illustrative`** `ArtWorld`, e.g., `tactile-craft`, `sketch-notebook`, `editorial-press`, `archival-chronicle`, or a custom brand preset in `<StyleProvider>`). Prefer sculptural `ScenicCutoutMotifs` over plain rectangular text plaques. When chaining multiple 3D scenes, orchestrate them via `<ContinuousSceneFlow>` with `usesThree: true` so at most **1 WebGL `<ThreeCanvas>`** is mounted on any frame.

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
  // 5 Nature & Atelier Motifs
  SunburstArchCutout3D,
  MountainRangeCutout3D,
  CloudCanopyCutout3D,
  PineGroveCutout3D,
  AtelierDeskCutout3D,
  // 4 Cosmic & Apollo 11 Lunar Motifs
  StarryCosmosBackdropCutout3D,
  EarthriseCutout3D,
  LunarCraterRidgeCutout3D,
  LunarLanderCutout3D,
  SCENIC_CUTOUT_INNER_MARGIN_PX,
  resolveScenicCutoutPalette,
  type DioramaStage3DProps,
} from '@make-pictures/kits/paper-diorama-3d';
```

- **`DioramaStage3D`:** Neutral, theme-aware 3D stage (`variant?: 'minimal-plinth' | 'flat-sheet' | 'open-book'`, `surfacePattern?: 'solid' | 'grid' | 'spotlight'`, `pageTurnProgress?: number`, `width?: number` default `12`, `depth?: number` default `7.4`, `cleanFrameZero?: boolean` default `true`, `accentColor?: string`, `surfaceColor?: string`, `children?: React.ReactNode`). Automatically inherits `bgCanvas`, `bgSurface`, `bgElevated`, `inkBorder`, and `accentPrimary` from `useStudioStyle()`.
- **All 9 Painterly `ScenicCutoutMotifs` (Built atop `PaperCutout3D`, reactive `cacheDeps`, `whiteBorderPx = 14`, `SCENIC_CUTOUT_INNER_MARGIN_PX = 38`, zero `Math.random()`):**
  - **Nature & Atelier Set (1–5):**
    1. **`SunburstArchCutout3D`** (`width = 5.4, height = 3.1` default, `rayCount?: number`): Celestial Romanesque halo arch with multi-stop vault gradient, radiating sunburst wedges, concentric brass/ink astrolabe rings, and stepped plinth.
    2. **`MountainRangeCutout3D`** (`width = 5.8, height = 2.7` default, `snowCapRatio?: number`): Kurzgesagt/storybook alpine ridges with split sunlit ochre/terracotta & shadow slate facets, sculpted two-tone snow caps, and valley mist gradient.
    3. **`CloudCanopyCutout3D`** (`width = 3.2, height = 1.25` default, `anchor?: 'bottom' | 'center'`, `tint?: string`): Fluffy multi-layered storybook cumulus clouds with warm sunlit crowns and horizon shadow underbelly.
    4. **`PineGroveCutout3D`** (`width = 1.9, height = 2.1` default, `treeCount?: 2 | 3`): Clustered botanical cypress/pine trees with two-tone sunlit/shadow foliage tiers on a shared mossy mound.
    5. **`AtelierDeskCutout3D`** (`width = 3.6, height = 1.85` default, `plaqueTitle?: string`, `lampOn?: boolean`): Studio workbench with wood-grain tabletop, articulated brass desk lamp casting a warm light cone, open sketchbook, ceramic brush cup, and optional Polish-safe inlaid nameplate (`maxWidth`).
  - **Cosmic & Apollo 11 Lunar Set (6–9):**
    6. **`StarryCosmosBackdropCutout3D`** (`width = 6.2, height = 3.5` default): Deep-space indigo/midnight vault arch with brass orbital astrolabe arcs, deterministic starfield constellations, and die-cut border.
    7. **`EarthriseCutout3D`** (`width = 1.85, height = 1.85` default): Luminous atmospheric halo disc, sapphire ocean sphere, clipped emerald/sage paper continents, swirling cream cloud ribbons, and sunlit crescent rim.
    8. **`LunarCraterRidgeCutout3D`** (`ridgeVariant?: 'far' | 'near'`, `width = 6.2 | 6.4`, `height = 1.85 | 1.38` default): Undulating silver-chalk lunar horizon with raised sunlit crater rims and shadowed elliptical bowls (`'far'` taller pewter ridge vs `'near'` sunlit Tranquility plain for parallax layering).
    9. **`LunarLanderCutout3D`** (`width = 2.45, height = 2.28` default, `thrusterIntensity?: number` `0..1`): Apollo 11 *Eagle* paper craft (octagonal Kapton gold-foil descent stage, faceted ivory/charcoal ascent cabin with triangular windows & S-band dish, splayed landing legs & 4 round footpads). Quantizes offscreen canvas `cacheDeps` to `0 | 1` while smoothly scaling its 3D multi-cone braking thruster plume at `60 FPS` whenever `thrusterIntensity > 0.02`!
  - All 9 motifs accept `primaryColor` (or `accentColor`), `secondaryColor`, `surfaceColor`, `inkColor`, `seed`, `position`, `rotation`, `scale`, `thickness`, and `opacity`.
- **`PaperCutout3D` & `ImageCutout3D`:** Custom procedural Canvas2D (`draw(ctx, w, h)`) or `staticFile(...)` image cutout extruded in 3D (`cacheKey`, `cacheDeps`, `whiteBorderPx = 14`, `thickness = 0.038`, `anchor: 'bottom' | 'center' | 'top'`, `cleanFrameZero = true`).
- **`PopUpHinge3D`:** Parallel-hinge fold matrix (`foldProgress: 0..1`, `foldDirection: 1 | -1`, `rotationY?: number`) unfolding standing cutouts around their `y = 0` floor crease.
- **`PaperStageLighting3D`:** Configures ACES Filmic tone mapping + `2048×2048` `PCFSoftShadowMap`. Valid `preset` values are **strictly** `'daylight' | 'golden-hour' | 'indoor-study' | 'spotlight'` (e.g., `preset={style.surface.isDark ? 'spotlight' : 'golden-hour'}` — never pass non-existent `'dramatic-night'` or `'studio-bright'`).

---

## Mandatory Geometry, Canvas & Choreography Rules

### 1. Zero WebGL Z-Fighting (`Δz >= 0.45` Depth Row Separation)
Never place overlapping cutouts at identical or near-identical `z` coordinates:
- **Stage Depth Rows (`Δz >= 0.45`):** Separate distinct scenic depth rows by at least **`Δz >= 0.45`** world units (e.g., `StarryCosmosBackdropCutout3D` at `z = -2.35`, `EarthriseCutout3D` at `z = -1.80`, `LunarCraterRidgeCutout3D (far)` at `z = -1.25`, `LunarCraterRidgeCutout3D (near)` at `z = -0.70`, foreground `LunarLanderCutout3D` at `z = -0.10`) for crisp parallax and clean PCF shadow projection.
- **Attached Sub-Parts Minimum Gap:** When attaching a badge/sub-layer onto a parent cutout, enforce $\Delta z \ge \frac{\text{thickness}_A}{2} + \frac{\text{thickness}_B}{2} + 0.03\text{ m}$.

### 2. `PopUpHinge3D` Local Anchor (`[0, h/2, 0]`)
`PopUpHinge3D` pivots around local **`y = 0`**. Always keep `anchor="bottom"` (default on `PaperCutout3D`, `ImageCutout3D`, and floor-hinged `ScenicCutoutMotifs`; use `anchor="center"` for floating sky props like `CloudCanopyCutout3D` or `EarthriseCutout3D` placed above the horizon).

### 3. Canvas Border Margins (`SCENIC_CUTOUT_INNER_MARGIN_PX = 38`) & Polish `maxWidth`
- Every custom shape drawn inside `draw(ctx, w, h)` must keep a clear margin of at least **`34–38 px`** (`SCENIC_CUTOUT_INNER_MARGIN_PX = 38`, satisfying `whiteBorderPx + lineWidth + 14 px`) on all 4 edges so the dilated die-cut border is never clipped flat.
- Pass the 4th `maxWidth = boxWidth - 48` argument to every `ctx.fillText(text, x, y, maxWidth)` so longer Polish words never overflow.

### 4. HMR Cache Invalidation (`cacheDeps`), Clean `f=0` & Determinism
- Always list every dynamic prop/palette value read inside custom `draw(ctx)` in `cacheDeps={[...]}` (`ScenicCutoutMotifs` wire `cacheDeps` automatically).
- Start entrances at `frame >= 2` (`CINEMATIC_SPRINGS.entrance`) so `frame === 0` renders pure `palette.bgCanvas`, and use `createSeededRandom(seed)` (zero `Math.random()`).

---

## Reference Pattern: Apollo 11 Multi-Plane 2.5D Diorama (`Δz >= 0.45`)

```tsx
const Apollo11Diorama: React.FC<{ foldBg: number; foldRidges: number; descentT: number; thruster: number }> = ({
  foldBg,
  foldRidges,
  descentT,
  thruster,
}) => {
  const style = useStudioStyle();
  const landerY = (1 - descentT) * 1.65;

  return (
    <>
      <PaperStageLighting3D preset={style.surface.isDark ? 'spotlight' : 'golden-hour'} />
      <DioramaStage3D variant="minimal-plinth" surfacePattern="spotlight">
        {/* Row 1 (z = -2.35): Deep-space starry vault */}
        <PopUpHinge3D foldProgress={foldBg} position={[0, 0, -2.35]}>
          <StarryCosmosBackdropCutout3D width={6.2} height={3.5} />
        </PopUpHinge3D>

        {/* Row 2 (z = -1.80, Δz = 0.55): Earthrise above lunar horizon */}
        <EarthriseCutout3D position={[1.75, 2.15, -1.8]} anchor="center" scale={foldBg} />

        {/* Row 3 (z = -1.25, Δz = 0.55): Far pewter crater ridge */}
        <PopUpHinge3D foldProgress={foldRidges} position={[0, 0, -1.25]}>
          <LunarCraterRidgeCutout3D ridgeVariant="far" />
        </PopUpHinge3D>

        {/* Row 4 (z = -0.70, Δz = 0.55): Near Tranquility Base ridge */}
        <PopUpHinge3D foldProgress={foldRidges} position={[0, 0, -0.7]}>
          <LunarCraterRidgeCutout3D ridgeVariant="near" />
        </PopUpHinge3D>

        {/* Row 5 (z = -0.10, Δz = 0.60): Descending Eagle lunar module + 60 FPS plume */}
        <LunarLanderCutout3D
          position={[0, landerY, -0.1]}
          scale={foldRidges}
          thrusterIntensity={thruster}
        />
      </DioramaStage3D>
    </>
  );
};
```
