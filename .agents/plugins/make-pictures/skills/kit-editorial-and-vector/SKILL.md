---
name: kit-editorial-and-vector
description: >-
  APIs, TypeScript props interfaces, 3-ArtWorld ScenicBackdropLayers staging,
  ClippedSurfaceChrome corner precision, painterly EditorialMediaCard fallback
  illustrations, deterministic Ken Burns math, word-synced SVG ink-brush quote
  highlighting, polymorphic StoryCard2D medallions, dignified light-mode optical
  rack focus, ContinuousSceneFlow pacing (>= 4.5s scenes), and 9:16 Golden Safe
  Box layout rules for @make-pictures/kits/editorial-collage and
  @make-pictures/kits/vector-scene-2d. Use whenever building documentaries,
  history/culture/science essays, case studies, or clean 2D visual explainers.
---

# Kit: Editorial Collage & Vector Scene 2D (`@make-pictures/kits`)

Build gallery-grade documentaries, historical/scientific essays, and multi-plane 2D visual explainers across the 3 Artistic Worlds (`atelier`, `illustrative`, `editorial-gallery`). Every component inherits palette, `latin-ext` Google Fonts, tactile shadows (`getTactileSurfaceStyle`), `<ClippedSurfaceChrome />` rounded-corner masks, and optical springs from `<StyleProvider>`.

---

## Core Primitives & Imports

```tsx
import {
  ContinuousSceneFlow,
  OpticalCrossDissolve,
  StyleProvider,
  type OpticalShot2D,
  type StageNode2D,
} from '@make-pictures/core';

import {
  EditorialDeskStage,
  EditorialPanoramaTrack,
  ChapterTitleCard,
  EditorialMediaCard,
  HighlightQuoteStage,
  SplitStoryLayout,
  SplitStorySlotContext,
  computeSplitStoryVerticalBounds,
  resolveHighlightStartFrame,
  type EditorialDeskStageProps,
  type EditorialPanoramaItem,
  type EditorialPanoramaTrackProps,
  type ChapterTitleCardProps,
  type EditorialMediaCardProps,
  type EditorialMountType,
  type HighlightQuoteStageProps,
  type SplitStoryLayoutProps,
} from '@make-pictures/kits/editorial-collage';

import {
  VectorSceneStage2D,
  StoryCard2D,
  HorizontalFeatureGrid2x2,
  computeHorizontalFeatureGridBounds,
  PinnedMediaStage,
  AnnotatedCallout2D,
  ComparisonSplit2D,
  computeSafeSplitBounds,
  type VectorSceneStage2DProps,
  type StoryCard2DProps,
  type HorizontalFeatureItem,
  type HorizontalFeatureGrid2x2Props,
  type MediaPinSpec,
  type PinnedMediaStageProps,
  type AnnotatedCallout2DProps,
  type ComparisonSideSpec,
  type ComparisonSplit2DProps,
} from '@make-pictures/kits/vector-scene-2d';
```

*(All components and types are also re-exported from `@make-pictures/kits`.)*

---

## 1. Editorial Collage (`@make-pictures/kits/editorial-collage`)

Multi-plane gallery & editorial desk kit — adapts seamlessly across `editorial-press`, `archival-chronicle`, `tactile-craft`, `minimal-product`, `cyber-telemetry`, or custom presets in `styles/<slug>.style.json`.

### `EditorialDeskStage`
Combines `<StageLightingRig />` + **3-ArtWorld `<ScenicBackdropLayers />`** + `<OpticalStage2D />` across three `<DepthPlane />` layers:
- **Scenic Backdrop (`showScenicBackdrop = true`):** Automatically renders gallery passe-partout & diagonal window light (`'editorial-gallery'`), warm parallax hills & clouds (`'illustrative'`), or studio cyclorama (`'atelier'`), returning `null` on `frame <= 0`.
- **`z = -0.65` (Passe-Partout Registration Sheet):** Subtle registration frame and optional `+ {sheetCode}` header (**`sheetCode` defaults to `undefined` — zero developer clutter unless explicitly passed**).
- **`z = 0.0` (Primary Editorial Surface):** Crisp hero plane rendering `children` (`filter: 'none'` when `focalZ = 0`).
- **`z = +0.75` (`foregroundAccents = true`):** Out-of-focus edge scale placed strictly outside the `9:16` Golden Safe Box.

```ts
export interface EditorialDeskStageProps {
  shots?: ReadonlyArray<OpticalShot2D>;
  nodes?: Record<string, StageNode2D>;
  sheetCode?: string;          // default undefined (omitted unless explicitly non-empty)
  showScenicBackdrop?: boolean;// default true (3-ArtWorld ScenicBackdropLayers)
  foregroundAccents?: boolean; // default true (z = +0.75 edge bokeh)
  renderBaseFill?: boolean;    // default true (pass false inside <StyleProvider renderBackdrop>)
  seed?: number;               // default 2026
  children?: React.ReactNode;
}
```

### `ChapterTitleCard`
Monumental magazine opener with crop-mark registration (`┼` + `chapterLabel`), spring-growing hairline rule, `displayFont` headline (`formatHeadingText`), optional `subtitle`, and an **optical lens focus-pull entrance** (`< 0.25px -> filter: 'none'` deadzone). Give chapter openers a calm hold (`>= 4.5s` scene or smooth internal optical dissolve) as the **single focal point** on screen.

### `EditorialMediaCard`
Physical baryta print, passe-partout frame, or darkroom slide mount with `<ClippedSurfaceChrome />` specular top rim, **3-ArtWorld painterly SVG artwork fallback**, and **100% deterministic Ken Burns pan & zoom**:
- **Zero Default Noise:** `sourceTag` is optional; `slide-mount` renders a clean dark frame without fake `35MM ARCHIVE POSITIVE` / `KADR 14A` stamps when `sourceTag` is omitted.
- **3-ArtWorld Painterly Artwork (`when src is omitted`):** Renders bespoke multi-layered vector paintings (`data-contact-sheet="true"`, `data-editorial-artworld="atelier" | "illustrative" | "editorial-gallery"`) — studio glass orb & arch (`atelier`), sunlit storybook mountains & clouds (`illustrative`), or museum travertine arch & horizon relief (`editorial-gallery`).

### `HighlightQuoteStage`, `SplitStoryLayout` & `EditorialPanoramaTrack`
- `HighlightQuoteStage`: Tactile quotation card (`„…”`) with word-synced organic SVG ink-brush / halation sweep (`words={VOICEOVER_MANIFEST[sceneId]?.words}`).
- `SplitStoryLayout`: Dual-elevation responsive composition (`1.08fr 0.92fr` in `16:9`; vertical stack strictly inside `9:16` Golden Safe Box `x ∈ [40, 910], y ∈ [220, 1380]`) with optional `focusShiftFrame` optical rack focus.
- **`EditorialPanoramaTrack` (`items: EditorialPanoramaItem[]`, `durationInFrames`):** **Mandatory replacement for robotic `3×2` blinking tile grids.** Lays out `3–6` large `EditorialMediaCard` plates (`660×480 px`, `cy ± 20 px` vertical rhythm) along a panoramic `<DirectorCamera2D />` ribbon (`transition: 'glide'`) with subtle Ken Burns (`1.02 → 1.08`) and `<ScenicBackdropLayers />` parallax (automatically adapting to vertical cascade inside the `9:16` Golden Safe Box).
- **AI Illustration Style Anchor & Safe Cutouts:** Generate raster artwork via `npx make-pictures image "<subject>" --style=<styleId> --out=...` (which enforces a shared `Base Style Anchor` and strictly **no text/letters/numbers** inside the raster), always render images with Remotion `<Img>` (never raw `<img>`), and extract bright objects on white backgrounds with `npx make-pictures cutout` (never global white thresholding `rgb > 245 => alpha = 0`).

---

## 2. Vector Scene 2D (`@make-pictures/kits/vector-scene-2d`)

### `VectorSceneStage2D`
Multi-plane 2.5D graphic plate stage combining `<StageLightingRig />` + **3-ArtWorld `<ScenicBackdropLayers />`** + `<OpticalStage2D startFrame={1}>`:
- **`plateCode?: string`** defaults to `undefined` (rendered on `z = -0.60` only when explicitly passed as a non-empty string).
- **`showScenicBackdrop?: boolean`** defaults to `true` (`null` on `frame <= 0`).
- **`foregroundCallouts?: React.ReactNode`** mounts on elevated parallax plane `z = +0.42`, and `foregroundAccents` renders a quiet, wordless corner registration bracket on `z = +0.72` outside the `9:16` Safe Box.

### `StoryCard2D` & `HorizontalFeatureGrid2x2` (`>= 18 px` Floor & Zero Vertical Voids)
- **`StoryCard2D`:** Tactile graphic card wrapped internally with **`<ClippedSurfaceChrome />`** and a `60×60` polymorphic SVG medallion. Enforces `TYPOGRAPHY_FLOOR_1080P`: **`28px` title (`2–5` words) + `20px` supporting sentence (`6–11` words) + `18px` badge**, with `height: 'auto'`, `justifyContent: 'center'`, and `boxSizing: 'border-box'` (zero `space-between` vertical voids; `badge` and `plateCode` default to `undefined`).
- **`HorizontalFeatureGrid2x2` (`items: ReadonlyArray<HorizontalFeatureItem>`):** Balanced `2×2` summary layout on `16:9` (and single-column stack inside the `9:16` Golden Safe Box) using horizontal medallion cards (`gridTemplateColumns: '64px 1fr'`, `alignItems: 'center'`, `gap: 24`, `28px` title + `20px` sentence) so `16:9` quadrants fill cleanly with zero vertical holes.

### `PinnedMediaStage` (Sub-Pixel `Δx = 0.00 px` Media Annotations)
Eliminates the two classic callout drift bugs (`objectFit: 'contain'` pillarbox offset and `translate(-50%, -50%) scale(...)` origin drift):
- Pass exact source pixel dimensions `sourceWidth` (`W`) & `sourceHeight` (`H`) plus `pins: MediaPinSpec[]` (`{ id, cx, cy, label, placement?: 'top' | 'bottom', ringRadiusPx?, startFrame?, accentColor? }`).
- Locks an `aspectRatio: '${W} / ${H}'` wrapper `1:1` to the `<Img>` bounds and mounts each reticle + `[-240px, +240px]` symmetric `>= 18px` label pill on a **`width: 0, height: 0` point anchor** at `(cx / W * 100%, cy / H * 100%)` for **`Δx = 0.00 px`** alignment at every spring frame.

### `AnnotatedCallout2D` & `ComparisonSplit2D`
- `AnnotatedCallout2D`: Optical target reticle + `45° -> horizontal` architectural elbow leader auto-clamped inside the `9:16` Golden Safe Box.
- `ComparisonSplit2D`: Baseline (`left`, `BAZA`) vs. thesis (`right`, `TEZA`) plates with `<ClippedSurfaceChrome />` top bars and **dignified light-mode optical rack focus**: when `focusShiftFrame` shifts focus on light backgrounds (`!surface.isDark`), the recessed plate preserves crisp legibility (`opacity >= 0.88`, `blur <= 2.0px`, `saturate(0.88)`, crisp `inkBorder`) while the active plate settles to `filter: 'none'`.

---

## 3. Calm Continuous Composition Pattern (`<ContinuousSceneFlow />`, `>= 4.5s` Scenes)

```tsx
import React from 'react';
import { AbsoluteFill } from 'remotion';
import {
  ContinuousSceneFlow,
  StyleProvider,
  VoiceoverTrack,
} from '@make-pictures/core';
import {
  ChapterTitleCard,
  EditorialDeskStage,
  EditorialMediaCard,
  HighlightQuoteStage,
  SplitStoryLayout,
} from '@make-pictures/kits/editorial-collage';
import { VOICEOVER_MANIFEST } from '../generated/audio-manifest';

export const GalleryEssay: React.FC<{ styleId: string }> = ({ styleId }) => (
  <StyleProvider style={styleId} renderBackdrop>
    <AbsoluteFill>
      <VoiceoverTrack voiceover={VOICEOVER_MANIFEST['scene-1']} fromFrame={42} />
      <VoiceoverTrack voiceover={VOICEOVER_MANIFEST['scene-2']} fromFrame={402} />

      <ContinuousSceneFlow
        crossDissolveFrames={54}
        scenes={[
          {
            id: 'opener',
            durationInFrames: 360, // 6.0s (>= 270f Director Pacing minimum)
            render: () => (
              <EditorialDeskStage renderBaseFill={false}>
                <ChapterTitleCard
                  chapterLabel="Rozdział pierwszy"
                  title="Światło kształtuje każdą opowieść"
                  subtitle="Spokojny rytm kadru i szlachetna faktura papieru"
                />
              </EditorialDeskStage>
            ),
          },
          {
            id: 'spread',
            durationInFrames: 360, // 6.0s
            render: () => (
              <EditorialDeskStage renderBaseFill={false}>
                <SplitStoryLayout
                  focusShiftFrame={150}
                  primary={
                    <EditorialMediaCard
                      caption="Autorska kompozycja w świetle bocznym"
                      durationInFrames={340}
                    />
                  }
                  secondary={
                    <HighlightQuoteStage
                      quote="Prawdziwe rzemiosło zaczyna się tam, gdzie obraz ma czas wybrzmieć."
                      highlightPhrase="czas wybrzmieć"
                      words={VOICEOVER_MANIFEST['scene-2']?.words}
                    />
                  }
                />
              </EditorialDeskStage>
            ),
          },
        ]}
      />
    </AbsoluteFill>
  </StyleProvider>
);
```

---

## 4. Editorial & Director QA Guardrails

1. **Clean Frame `0`:** `EditorialDeskStage`, `VectorSceneStage2D`, `<ScenicBackdropLayers />`, and all cards enforce `frame === 0` pure `palette.bgCanvas`.
2. **Director Pacing & Single Focal Point (`npx make-pictures qa`):** Keep every visual scene **`>= 270` frames (`4.5 s` @ `60 FPS`)**, connect scenes with `<ContinuousSceneFlow />` / `<OpticalCrossDissolve />` (never choppy `flash-cut` / `paper-curtain` / `iris-wipe`), and never mount `<WordByWordStage>` in the same scene as `<StoryCard2D>`.
3. **Polish Sentence Case & `9:16` Safe Box:** Write Polish titles in *Sentence case* (`Sztuka wypieku`, never `Sztuka Wypieku`) and keep all `9:16` layouts inside `x ∈ [40, 910], y ∈ [220, 1380]`.
