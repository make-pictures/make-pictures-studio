---
name: kit-paper-diorama-3d
description: >-
  Rules, geometry math, and APIs for the 2.5D Paper Mario / Pop-Up Book visual
  kit (@make-pictures/kits/paper-diorama-3d). Use this skill whenever building
  or editing scenes with PaperCutout3D, ImageCutout3D, PopUpHinge3D,
  PopUpBookBase3D, PaperBookPageTurn3D, or PaperStageLighting3D.
---

# Kit: Paper Diorama 3D (`@make-pictures/kits/paper-diorama-3d`)

Build theatrical 2.5D cardboard Pop-Up Book worlds inside `ThreeCanvas` (`@remotion/three`) with physical cardboard thickness, dilated cream-white die-cut borders, soft PCF shadows, and floor-hinged page choreography.

---

## Core Primitives & Imports

```tsx
import { ThreeCanvas } from '@remotion/three';
import { DirectorCamera3D, createSeededRandom } from '@make-pictures/core';
import {
  PaperCutout3D,
  ImageCutout3D,
  PopUpHinge3D,
  PopUpBookBase3D,
  PaperBookPageTurn3D,
  PaperStageLighting3D,
  PaperCloudCutout3D,
  PaperPineTree3D,
  PaperMountainBackdrop3D,
} from '@make-pictures/kits/paper-diorama-3d';
```

- **`PaperCutout3D`:** Procedural Canvas2D cutout extruded in 3D (`cacheKey`, `cacheDeps`, `width`, `height`, `pixelWidth`, `pixelHeight`, `whiteBorderPx` default `14`, `thickness` default `0.038`, `anchor: 'bottom' | 'center' | 'top'`, `draw(ctx, w, h)`).
- **`ImageCutout3D`:** Loads any PNG/SVG/WebP asset (`src={staticFile(...)}`) cleanly with Remotion `delayRender`/`continueRender` safety and feeds it into `PaperCutout3D` so external or AI-generated illustrations automatically gain cream-white dilated die-cut borders, cardboard edge thickness, and 3D shadow casting.
- **`PopUpBookBase3D`:** Hardcover leather book binding with gold foil corners, stepped cream page block, active spread texture (`floorTheme: 'mint-plains' | 'checkerboard-tile' | 'warm-parquet' | 'valley-terrace'`), and integrated `PaperBookPageTurn3D`.
- **`PopUpHinge3D`:** True parallel-hinge fold matrix (`foldProgress: 0..1`, `foldDirection: 1 | -1`) rotating cutouts around their own `y = 0` floor line.
- **`PaperStageLighting3D`:** Configures ACES Filmic tone mapping + `2048×2048` `PCFSoftShadowMap` (`preset: 'daylight' | 'golden-hour' | 'indoor-study' | 'spotlight'`).

---

## Mandatory Geometry, Canvas & Choreography Rules

### 1. True 3D Multi-Plane Space (Never Fake 2.5D in Flat SVG)
Every character, prop, banner, and in-scene presentation board must be a real `PaperCutout3D` or `ImageCutout3D` placed across distinct `Z` depth planes inside `ThreeCanvas` with `castShadow` and `receiveShadow` enabled. Even simplified diagrams inside the story world must be physical cardboard cutouts with shadows—never flat 2D DOM overlays pasted over 3D.

### 2. Zero WebGL Z-Fighting (`Δz` Separation Formula)
Never place two overlapping cutouts or meshes at the same (or nearly identical) `z` coordinate—camera motion or character sway will cause `z-buffer` flickering and mesh bleed-through.
- Enforce a strict minimum depth gap between every layered plane (e.g., crate backdrop → torso → arm → label plaque):
  $$\Delta z \ge \frac{\text{thickness}_A}{2} + \frac{\text{thickness}_B}{2} + 0.03\text{ m}$$
- When drawing a group of characters standing side-by-side on the exact same `Z` row (e.g., porters carrying a pole), render them onto **one shared `PaperCutout3D` canvas** for that `Z` plane.

### 3. Canvas Border Margins & Mandatory Polish `maxWidth`
`PaperCutout3D` generates its cream-white die-cut edge by dilating the alpha channel outward by `whiteBorderPx` pixels:
- Every shape drawn inside `draw(ctx, w, h)` **must leave a clear margin** on all 4 edges (top, bottom, left, right) of at least:
  $$\text{margin} \ge \text{whiteBorderPx} + \text{lineWidth} + 12\text{ px}$$
  Pay special attention to the bottom edge of speech bubbles and title plaques so the white border is never sliced flat.
- **Polish text is 25–40% longer than English:** Every `ctx.fillText(text, x, y, maxWidth)` inside a box of width `boxWidth` **must pass the 4th parameter `maxWidth = boxWidth - 48`**. Always inspect QA frames in Polish first when producing bilingual or Polish videos.

### 4. HMR Cache Invalidation (`cacheDeps`) & Determinism
- `PaperCutout3D` maintains a bounded 64-entry LRU VRAM cache (`TEXTURE_CACHE`) to prevent `WebGL context lost` during long `Studio Web` sessions.
- Whenever `draw(ctx)` reads dynamic variables from closure/props (such as editable titles or colors from `*.props.json`), **always pass them in `cacheDeps={[bannerTitle, accentColor]}`** so `Studio Web` slider/text edits rebuild the texture in `0 ms`.
- **Never call `Math.random()`** inside `draw(ctx)` or scene trees—always use `createSeededRandom(seed)` from `@make-pictures/core`.

### 5. Clean Stage (No Spine at `x = 0`) & 3-Phase Page Turns
- **Forbidden central spine:** Never place a vertical cylindrical book spine down `x = 0`—it slices right through desks and characters.
- **Forbidden background shrinking:** Never hide the main stage behind close-up cards by scaling it down (`scale ~ 0.05`), which leaks miniature figures between card gaps.
- **Mandatory 3-Phase Page Turn Choreography (`PopUpHinge3D` + `PaperBookPageTurn3D`):** Never sweep a turning page through standing cutouts. Sequence transitions strictly in 3 phases:
  1. **Fold Down:** Outgoing cutouts fold flat onto the page (`foldProgress: 1 → 0` with `Easing.inOut(Easing.cubic)`).
  2. **Slide Sheet:** Only once `foldProgress <= 0.02`, animate `pageTurnProgress: 0 → 1` on `PopUpBookBase3D` / `PaperBookPageTurn3D`.
  3. **Pop Up:** Incoming scene hinges unfold upright (`foldProgress: 0 → 1`).
- **Opening Cloud Descent (`frame 0..80`):** When diving the camera down from above clouds at the start of a film, keep foreground camp/stage hinges folded (`foldProgress = 0`) and pop them up as the camera lands so the lens never clips through character heads at the bottom of the frame.

### 6. 3D Ray Precision, Character Orientation & Weather Continuity
- **Exact shared target coordinates:** Sightlines, triangulation rays, laser beams, and summit flags must reference the exact same `[x, y, z]` 3D apex tuple—and must never slice across character faces or obscure signboards.
- **Never rotate single-layer cutouts `180°` around Y:** Keep walking characters facing `3/4` toward the camera with a gentle `stepBob`, and counter-rotate held plaques/blocks against the arm angle (`rotation={[0, 0, -armRad]}`) so numbers and labels remain upright.
- **Smooth atmosphere:** Animate time-of-day, seasons, and window weather strictly with continuous functions (`interpolateColors`, `getSmoothPoseWindow`)—never abrupt frame conditionals.

---

## Reference Pattern

```tsx
<PopUpBookBase3D
  floorTheme="mint-plains"
  nextFloorTheme="warm-parquet"
  pageTurnProgress={pageTurn}
/>
<PopUpHinge3D foldProgress={scene1Fold} position={[0, 0, -1.2]}>
  <PaperCutout3D
    cacheKey="observatory-sign"
    cacheDeps={[signTitle, accentHex]}
    width={3.2}
    height={1.4}
    pixelWidth={512}
    pixelHeight={224}
    whiteBorderPx={14}
    thickness={0.04}
    position={[0, 0, 0]}
    draw={(ctx, w, h) => {
      const pad = 32; // >= 14 (whiteBorderPx) + 6 (lineWidth) + 12
      ctx.fillStyle = '#FFFBEB';
      ctx.strokeStyle = accentHex;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.roundRect(pad, pad, w - pad * 2, h - pad * 2, 20);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.font = '700 38px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(signTitle, w / 2, h / 2, w - pad * 2 - 48);
    }}
  />
</PopUpHinge3D>
```
