---
name: kit-paper-diorama-3d
description: >-
  Rules, geometry math, and APIs for the 2.5D layered cutout stage kit
  (@make-pictures/kits/paper-diorama-3d). Use this skill whenever building or
  editing tactile 2.5D scenes with DioramaStage3D, PaperCutout3D, ImageCutout3D,
  PopUpHinge3D, or PaperStageLighting3D wrapped in <StyleProvider>.
---

# Kit: Paper Diorama 3D (`@make-pictures/kits/paper-diorama-3d`)

Build crafted 2.5D layered cutout worlds inside `ThreeCanvas` (`@remotion/three`) on the neutral, style-aware `<DioramaStage3D />` stage — with physical cardboard thickness, dilated die-cut borders, soft PCF shadows, and floor-hinged pop-up choreography.

> **Art Direction Note:** Use `paper-diorama-3d` purposefully when tactile 2.5D craft fits the story (e.g., paired with `tactile-craft` or a custom brand preset in `<StyleProvider>`). For documentaries, journalism, SaaS, or clean 2D explainers, prefer `editorial-collage`, `vector-scene-2d`, or `motion-diagrams-2d` (see `style-and-art-direction`).

---

## Core Primitives & Imports

```tsx
import { ThreeCanvas } from '@remotion/three';
import {
  StyleProvider,
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
  type DioramaStage3DProps,
} from '@make-pictures/kits/paper-diorama-3d';
```

- **`DioramaStage3D`:** Neutral, theme-aware 3D stage (`variant?: 'minimal-plinth' | 'flat-sheet' | 'open-book'`, `surfacePattern?: 'solid' | 'grid' | 'spotlight'`, `pageTurnProgress?: number`, `width?: number` default `12`, `depth?: number` default `7.4`, `accentColor?: string`, `surfaceColor?: string`, `children?: React.ReactNode`). Automatically inherits `bgCanvas`, `bgSurface`, `bgElevated`, `inkBorder`, and `accentPrimary` from `useStudioStyle()`.
- **`PaperCutout3D`:** Procedural Canvas2D cutout extruded in 3D (`cacheKey`, `cacheDeps`, `width`, `height`, `pixelWidth`, `pixelHeight`, `whiteBorderPx` default `14`, `thickness` default `0.038`, `anchor: 'bottom' | 'center' | 'top'`, `draw(ctx, w, h)`).
- **`ImageCutout3D`:** Loads any PNG/SVG/WebP asset (`src={staticFile(...)}`) cleanly with Remotion `delayRender`/`continueRender` safety and feeds it into `PaperCutout3D` so external or AI-generated illustrations automatically gain dilated die-cut borders, cardboard edge thickness, and 3D shadow casting.
- **`PopUpHinge3D`:** Parallel-hinge fold matrix (`foldProgress: 0..1`, `foldDirection: 1 | -1`) unfolding standing cutouts around their `y = 0` floor crease.
- **`PaperStageLighting3D`:** Configures ACES Filmic tone mapping + `2048×2048` `PCFSoftShadowMap` (`preset: 'daylight' | 'golden-hour' | 'indoor-study' | 'spotlight'`).

---

## Mandatory Geometry, Canvas & Choreography Rules

### 1. True 3D Multi-Plane Space (Never Fake 2.5D in Flat SVG)
Every character, prop, banner, and in-scene display board must be a real `PaperCutout3D` or `ImageCutout3D` placed across distinct `Z` depth rows inside `ThreeCanvas` with `castShadow` and `receiveShadow` enabled. Never paste flat 2D DOM diagrams over a 3D cutout stage.

### 2. Zero WebGL Z-Fighting (`Δz >= 0.45` Depth Row Separation)
Never place two overlapping cutouts or meshes at the same (or nearly identical) `z` coordinate — camera motion or subtle sway will trigger `z-buffer` flickering and shadow bleed-through:
- **Stage Depth Rows (`Δz >= 0.45`):** Separate distinct scenic depth rows (e.g., background arch at `z = -2.2`, midground workbench at `z = -0.9`, foreground speaker at `z = 0.4`) by at least **`Δz >= 0.45`** world units for clear parallax and clean PCF shadow projection.
- **Attached Sub-Parts Minimum Gap:** When attaching a close badge or arm layer directly onto a parent cutout, enforce at minimum:
  $$\Delta z \ge \frac{\text{thickness}_A}{2} + \frac{\text{thickness}_B}{2} + 0.03\text{ m}$$
- **Same-Row Ensembles:** When multiple figures or items stand side-by-side on the exact same `Z` plane, draw them onto **one shared `PaperCutout3D` canvas** for that `Z` row.

### 3. `PopUpHinge3D` Local Anchor (`[0, h/2, 0]`)
`PopUpHinge3D` applies a shear-fold matrix pivoting strictly around local **`y = 0`**:
- Always use `anchor="bottom"` (the default on `PaperCutout3D` and `ImageCutout3D`), which offsets the internal plane mesh center to **`[0, h/2, 0]`** so the bottom edge sits flush at `y = 0` on the stage floor.
- If placing custom Three.js geometry inside `<PopUpHinge3D position={[x, 0, z]}>`, shift its local mesh position to **`[0, h/2, 0]`** — centering a mesh at `[0, 0, 0]` will push its lower half through the `DioramaStage3D` plinth during `foldProgress: 0 → 1`.

### 4. Canvas Border Margins (`whiteBorderPx`) & Mandatory Polish `maxWidth`
`PaperCutout3D` generates its die-cut edge by dilating the alpha channel outward by `whiteBorderPx` pixels:
- Every shape drawn inside `draw(ctx, w, h)` **must leave a clear margin** on all 4 edges (top, bottom, left, right) of at least:
  $$\text{margin} \ge \text{whiteBorderPx} + \text{lineWidth} + 12\text{ px}$$
  Pay special attention to the bottom edge of speech bubbles and title plaques so the dilated border is never sliced flat.
- **Polish text is 25–40% longer than English:** Every `ctx.fillText(text, x, y, maxWidth)` inside a box of width `boxWidth` **must pass the 4th parameter `maxWidth = boxWidth - 48`**. Always inspect QA frames in Polish first when producing bilingual or Polish videos.

### 5. HMR Cache Invalidation (`cacheDeps`), Style Sync & Determinism
- `PaperCutout3D` maintains a bounded 64-entry LRU VRAM cache (`TEXTURE_CACHE`) to prevent `WebGL context lost` during long `Studio Web` sessions.
- Whenever `draw(ctx)` reads dynamic variables from props or `useStudioStyle()` (such as editable labels from `*.props.json` or `style.palette.accentPrimary`), **always include every dynamic value in `cacheDeps={[cardTitle, style.palette.accentPrimary, style.palette.bgSurface]}`** so `Studio Web` and **🎨 Style Lab** updates rebuild the texture in `0 ms`.
- **Never call `Math.random()`** inside `draw(ctx)` or scene trees — always use `createSeededRandom(seed)` from `@make-pictures/core`.

### 6. Clean Stage & 3-Phase Page/Act Transitions
- **Clean Frame `0`:** Keep initial `foldProgress` starting at `frame - 2` (`frame === 0` renders clean empty stage background).
- **Forbidden central spine & shrinking:** Never place a vertical divider cylinder at `x = 0` or hide the stage behind close-up cards by scaling it to `0.05`.
- **3-Phase Transition Choreography (`PopUpHinge3D` + `DioramaStage3D`):** When using `variant="open-book"`, never sweep a turning page through standing cutouts:
  1. **Fold Down:** Outgoing cutouts fold flat (`foldProgress: 1 → 0` with `Easing.inOut(Easing.cubic)`).
  2. **Turn Sheet:** Only once `foldProgress <= 0.02`, animate `pageTurnProgress: 0 → 1` on `<DioramaStage3D variant="open-book" />`.
  3. **Pop Up:** Incoming act hinges unfold upright (`foldProgress: 0 → 1`).
- **Camera Fly-In Clearance:** During opening camera glides, keep foreground hinges folded (`foldProgress = 0`) until the camera settles so the lens never clips standing foreground cutouts.
- **Character Orientation & Smooth Lighting:** Keep walking cutouts facing `3/4` toward the camera (never flip single-layer cutouts `180°` around Y), counter-rotate held labels against arm rotation (`rotation={[0, 0, -armRad]}`), and animate lighting/color shifts exclusively with continuous functions (`interpolateColors`, `getSmoothPoseWindow`).

---

## Reference Pattern (`<StyleProvider>` + `<DioramaStage3D>`)

```tsx
const StageContent: React.FC<{ label: string; fold: number }> = ({ label, fold }) => {
  const style = useStudioStyle();

  return (
    <>
      <PaperStageLighting3D preset="daylight" />
      <DioramaStage3D variant="minimal-plinth" surfacePattern="spotlight">
        {/* Background row: z = -1.6 (Δz = 1.2 >= 0.45 from foreground row) */}
        <PopUpHinge3D foldProgress={fold} position={[0, 0, -1.6]}>
          <PaperCutout3D
            cacheKey="workshop-arch"
            cacheDeps={[style.palette.bgElevated, style.palette.inkBorder]}
            width={4.6}
            height={2.4}
            pixelWidth={512}
            pixelHeight={280}
            whiteBorderPx={14}
            thickness={0.04}
            anchor="bottom"
            draw={(ctx, w, h) => {
              const pad = 32;
              ctx.fillStyle = style.palette.bgElevated;
              ctx.strokeStyle = style.palette.inkBorder;
              ctx.lineWidth = 6;
              ctx.beginPath();
              ctx.roundRect(pad, pad, w - pad * 2, h - pad * 2, 24);
              ctx.fill();
              ctx.stroke();
            }}
          />
        </PopUpHinge3D>

        {/* Foreground row: z = -0.4 (anchor="bottom" keeps local mesh center at [0, h/2, 0]) */}
        <PopUpHinge3D foldProgress={fold} position={[0, 0, -0.4]}>
          <PaperCutout3D
            cacheKey="featured-plaque"
            cacheDeps={[label, style.palette.bgSurface, style.palette.accentPrimary, style.palette.textPrimary]}
            width={3.2}
            height={1.4}
            pixelWidth={512}
            pixelHeight={224}
            whiteBorderPx={14}
            thickness={0.04}
            anchor="bottom"
            draw={(ctx, w, h) => {
              const pad = 32; // >= 14 (whiteBorderPx) + 6 (lineWidth) + 12
              ctx.fillStyle = style.palette.bgSurface;
              ctx.strokeStyle = style.palette.accentPrimary;
              ctx.lineWidth = 6;
              ctx.beginPath();
              ctx.roundRect(pad, pad, w - pad * 2, h - pad * 2, 20);
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = style.palette.textPrimary;
              ctx.font = `700 36px "${style.typography.displayFont}", sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(label, w / 2, h / 2, w - pad * 2 - 48);
            }}
          />
        </PopUpHinge3D>
      </DioramaStage3D>
    </>
  );
};

// Inside your composition:
<StyleProvider style={props.styleId} renderBackdrop>
  <ThreeCanvas width={width} height={height}>
    <DirectorCamera3D anchors={ANCHORS} shots={SHOTS} />
    <StageContent label={props.headline} fold={scene1Fold} />
  </ThreeCanvas>
</StyleProvider>
```
