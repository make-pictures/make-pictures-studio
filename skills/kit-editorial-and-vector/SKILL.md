---
name: kit-editorial-and-vector
description: >-
  APIs, TypeScript props interfaces, multi-plane analog desk and graphic plate
  staging, deterministic Ken Burns math, word-synced SVG ink-brush quote
  highlighting, polymorphic engraved medallions, architectural elbow callouts,
  optical rack focus, and 9:16 Golden Safe Box layout rules for
  @make-pictures/kits/editorial-collage (EditorialDeskStage, ChapterTitleCard,
  EditorialMediaCard, HighlightQuoteStage, SplitStoryLayout) and
  @make-pictures/kits/vector-scene-2d (VectorSceneStage2D, StoryCard2D,
  AnnotatedCallout2D, ComparisonSplit2D). Use whenever building documentaries,
  history/culture/science essays, case studies, or clean 2D visual explainers.
---

# Kit: Editorial Collage & Vector Scene 2D (`@make-pictures/kits`)

Build magazine-grade documentaries, historical/scientific video essays, and multi-plane 2D graphic plate explainers without 3D cardboard props, rounded SaaS pills, or network-diagram boilerplate. Every component automatically reads colors, Google Fonts (`latin-ext`), tactile directional shadows (`getTactileSurfaceStyle`), optical lighting/aperture/grammar (`resolveStyleOptics`), and motion springs (`getStyleSpringConfig`) from `<StyleProvider>` (`useStudioStyle()`).

---

## Core Primitives & Imports

```tsx
import {
  StyleProvider,
  type OpticalShot2D,
  type StageNode2D,
} from '@make-pictures/core';

import {
  EditorialDeskStage,
  ChapterTitleCard,
  EditorialMediaCard,
  HighlightQuoteStage,
  SplitStoryLayout,
  SplitStorySlotContext,
  computeSplitStoryVerticalBounds,
  resolveHighlightStartFrame,
  type EditorialDeskStageProps,
  type ChapterTitleCardProps,
  type EditorialMediaCardProps,
  type EditorialMountType,
  type HighlightQuoteStageProps,
  type SplitStoryLayoutProps,
} from '@make-pictures/kits/editorial-collage';

import {
  VectorSceneStage2D,
  StoryCard2D,
  AnnotatedCallout2D,
  ComparisonSplit2D,
  computeSafeSplitBounds,
  type VectorSceneStage2DProps,
  type StoryCard2DProps,
  type AnnotatedCallout2DProps,
  type ComparisonSideSpec,
  type ComparisonSplit2DProps,
} from '@make-pictures/kits/vector-scene-2d';
```

*(All components and types are also re-exported from `@make-pictures/kits`.)*

---

## 1. Editorial Collage (`@make-pictures/kits/editorial-collage`)

Multi-plane analog editorial desk and darkroom lightbox kit — best paired with `editorial-press`, `archival-chronicle`, `cyber-telemetry` (35mm slide lightbox), or a bespoke era/publication preset in `styles/<slug>.style.json`.

### `EditorialDeskStage`
Multi-plane 2.5D analog editorial desk / lightbox stage combining `<StageLightingRig />` and `<OpticalStage2D />` across three physical `<DepthPlane />` layers:
- **`z = -0.65` (Archival Registration Sheet):** Subtle crop-mark frame and top registration header (`+ {sheetCode} • {STYLE_ID}`) in `monoFont`, softly defocused whenever camera focus rests on `z = 0`.
- **`z = 0.0` (Primary Editorial Surface):** Crisp hero plane rendering `children` (`filter: 'none'` when `focalZ = 0`).
- **`z = +0.75` (Foreground Optical Accents):** Optional out-of-focus edge millimeter ruler (`foregroundAccents = true`) placed strictly outside the `9:16` Golden Safe Box for parallax depth without occluding copy.

```ts
export interface EditorialDeskStageProps {
  shots?: ReadonlyArray<OpticalShot2D>;
  nodes?: Record<string, StageNode2D>;
  sheetCode?: string;          // default 'ARKUSZ REDAKCYJNY • 60 FPS'
  foregroundAccents?: boolean; // default true (z = +0.75 edge millimeter bokeh)
  renderBaseFill?: boolean;    // default true (pass false inside <StyleProvider renderBackdrop>)
  seed?: number;               // default 2026
  children?: React.ReactNode;
}
```
- **Default Camera & Clean Frame `0`:** When `shots` is omitted, `EditorialDeskStage` executes a gentle micro-dolly with an entrance rack-focus pull (`focalZ: 0.35 -> 0` from `frame = 0` to `frame = 6`). On `frame <= 0`, renders pure `palette.bgCanvas` (or `null` when `renderBaseFill={false}`).

### `ChapterTitleCard`
Asymmetric magazine opener with crop-mark registration (`┼` + `monoFont` `chapterLabel`), spring-growing hairline cutter rule + accent lead, `displayFont` headline (`formatHeadingText`), optional `bodyFont` subtitle, and an **optical lens focus-pull entrance**.

```ts
export interface ChapterTitleCardProps {
  chapterLabel: string;
  title: string;
  subtitle?: string;
  startFrame?: number;   // default 2 (clamped to >= 2 for Clean Frame 0)
  accentColor?: string;  // defaults to style.palette.accentPrimary
}
```
- **Optical Focus Pull (`< 0.25px` Sharp Deadzone):** Interpolates entrance blur from `3.6 + optics.aperture * 3.2` px (`~5px`) down to `0px` over `18` frames alongside a subtle `1.038 -> 1` scale settle, emitting **`filter: 'none'`** once `rawFocusPullBlur < 0.25` px so settled `latin-ext` diacritics rasterize at full vector sharpness.

### `EditorialMediaCard`
Physical baryta photographic print or 35mm positive slide mount with directional table shadows (`getTactileSurfaceStyle`), archival catalog footer, **structured contact-sheet SVG fallback**, and **100% deterministic Ken Burns pan & zoom**.

```ts
export type EditorialMountType =
  | 'auto'
  | 'archival-tape'
  | 'photo-corners'
  | 'slide-mount'
  | 'none';

export interface EditorialMediaCardProps {
  src?: string;                     // pass staticFile(productionAssetPath(slug, 'images/...'))
  caption: string;
  sourceTag?: string;               // e.g. 'NEAPOL • 1889' or 'KADR 14A'
  mountType?: EditorialMountType;   // default 'auto'
  tiltDeg?: number;                 // clamped to [-1.2, +1.2]; deterministic from caption/sourceTag when omitted (0° for studio-macro)
  startFrame?: number;              // default 2 (clamped to >= 2)
  durationInFrames?: number;        // default 180 (Ken Burns interpolation span)
  zoomFrom?: number;                // default 1.02
  zoomTo?: number;                  // default 1.1
  panX?: number;                    // default -14 (px)
  panY?: number;                    // default -10 (px)
  styleOverrides?: React.CSSProperties;
}
```
- **Automatic Physical Mounts (`mountType = 'auto'`):** Resolves `'slide-mount'` (`▲ 35MM ARCHIVE POSITIVE` dark frame) when `lightingRig === 'darkroom-halation'`, `'none'` (clean studio print with `tiltDeg = 0°`) when `lightingRig === 'studio-macro'`, `'photo-corners'` (die-cut corner triangles) for `archival-chronicle`, and `'archival-tape'` (top masking tape) for `editorial-press`, `sketch-notebook`, and `tactile-craft`.
- **Contact-Sheet SVG Fallback & Deterministic Ken Burns:** When `src` is omitted, renders an archival engraving contact-sheet SVG (`data-contact-sheet="true"`, hatch lines, crop frame, registration crosshair, and tonal geometry) rather than an empty CSS gradient. Computes `kenBurnsProgress = interpolate(localFrame, [0, Math.max(30, durationInFrames)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })` with pure `scale(...) translate(tx, ty)` — zero `useRef` drift under `--concurrency=100%`.

### `HighlightQuoteStage`
Tactile press-clipping quotation card (`„…”`) with a left editorial margin hairline + accent lead and an **organic SVG ink-brush / halation sweep** synchronized directly to spoken ElevenLabs `WordTimestamp[]` alignment data.

```ts
export interface HighlightQuoteStageProps {
  quote: string;
  highlightPhrase?: string;               // exact substring of `quote` to sweep-highlight
  author?: string;                        // rendered as "— {author}" in monoFont
  startFrame?: number;                    // default 2 (clamped to >= 2)
  highlightFrame?: number;                // default 26 (used when `words` is omitted or unmatched)
  words?: ReadonlyArray<WordTimestamp>;   // e.g. VOICEOVER_MANIFEST['s3-quote']?.words
  embedded?: boolean;                     // auto-enabled via SplitStorySlotContext inside SplitStoryLayout
  styleOverrides?: React.CSSProperties;
}
```
- **Organic SVG Ink-Brush / Halation Sweep:** Draws a curved SVG brush stroke (`data-ink-brush="true"`, `scaleX(markSweep)`) behind `highlightPhrase`. On light paper (`isDark: false`), uses `mixBlendMode: 'multiply'` so ink soaks into the sheet without obscuring letterforms; on dark surfaces (`isDark: true`), uses `mixBlendMode: 'screen'` paired with `style.optics.halation` `textShadow` glow.
- **Word-Timestamp Sync (`resolveHighlightStartFrame`):** Matches the normalized first word of `highlightPhrase` (`toLocaleLowerCase('pl-PL')`) against `words` to trigger the `emphasis` spring sweep on the exact spoken frame, falling back smoothly to `highlightFrame`.

### `SplitStoryLayout`
Responsive dual-elevation narrative stage combining any two editorial/data/vector cards (`primary` + `secondary`) with optional **spring-driven optical rack focus**.

```ts
export interface SplitStoryLayoutProps {
  primary: React.ReactNode;
  secondary: React.ReactNode;
  startFrame?: number;               // default 2 (clamped to >= 2)
  gap?: number;                      // default 40 (16:9 grid column gap in px)
  focusShiftFrame?: number;          // optional frame at which optical focus glides from primary to secondary
  initialFocus?: 'both' | 'primary'; // defaults to 'primary' when focusShiftFrame is set, otherwise 'both'
}
```
- **Optical Rack Focus (`focusShiftFrame` & `initialFocus`):** When `focusShiftFrame` is set (or `initialFocus === 'primary'`), `primary` starts sharp (`filter: 'none'`) while `secondary` rests softly defocused (`maxBlur = Math.max(1.8, optics.aperture * 7.5)` px, `opacity: 0.82`, `scale: 0.985`). At `focusShiftFrame`, focus glides on `getStyleSpringConfig(style, 'camera')` to `secondary`, emitting `filter: 'none'` whenever `blurPx < 0.25`.
- **`16:9` & `9:16` Golden Safe Box (`computeSplitStoryVerticalBounds`):** Renders an asymmetric `1.08fr 0.92fr` grid in `16:9` (`maxWidth: 1640`, `padding: '96px 120px'`) and switches automatically in `9:16` (`1080×1920`) to a vertical stack (`left: 52, top: 240, width: 840, maxHeight: 1120`) **strictly inside `x ∈ [40, 910], y ∈ [220, 1380]`**.

---

## 2. Vector Scene 2D (`@make-pictures/kits/vector-scene-2d`)

Multi-plane graphic plate & architectural drafting kit (and default scaffold for `npx make-pictures new`). Automatically adapts across `swiss-spatial`, `optical-gate`, and `risograph-poster` via `resolveStyleOptics(style)`.

### `VectorSceneStage2D`
Multi-plane 2.5D graphic plate stage combining `<StageLightingRig />` and `<OpticalStage2D startFrame={1}>` across up to 4 depth planes:
- **`z = -0.60` (Construction Plate):** Modular golden-ratio (`38.2%` / `50%`) construction axes, registration crosses, and `┼ {plateCode} • {STYLE_ID}` header in `monoFont` (softly defocused when `focalZ = 0`).
- **`z = 0.00` (Primary Crisp Graphic Plate):** Hero `children` rendered at full vector sharpness (`filter: 'none'` when `focalZ = 0`).
- **`z = +0.42` (`foregroundCallouts`):** Optional elevated parallax layer for `<AnnotatedCallout2D />` (wrap in `<Sequence>` when scoped to a specific act).
- **`z = +0.72` (`foregroundAccents`):** Subtle `CAL • 1:1` calibration bracket placed strictly outside the `9:16` Golden Safe Box (`foregroundAccents = true`).

```ts
export interface VectorSceneStage2DProps {
  shots?: ReadonlyArray<OpticalShot2D>;
  nodes?: Record<string, StageNode2D>;
  plateCode?: string;                 // default 'TABLICA KONCEPCYJNA • 60 FPS'
  foregroundCallouts?: React.ReactNode;
  foregroundAccents?: boolean;        // default true
  renderBaseFill?: boolean;           // default true (pass false inside <StyleProvider renderBackdrop>)
  seed?: number;                      // default 2028
  children?: React.ReactNode;
}
```
- **Default Camera & Clean Frame `0`:** When `shots` is omitted, executes a 3-shot micro-dolly with an entrance rack-focus pull (`focalZ: 0.36 -> 0` from `frame = 0` to `frame = 6`). On `frame <= 0`, renders pure `style.palette.bgCanvas` (or `null` when `renderBaseFill={false}`).

### `StoryCard2D`
Tactile graphic plate (`getTactileSurfaceStyle`, `data-medallion-grammar={grammar}`) with a calibration `monoFont` index header (`badge` + `plateCode` — zero rounded `999px` pills), optical entrance focus pull (`< 0.25px -> filter: 'none'` sharp deadzone), and a **polymorphic SVG engraved medallion** (`60×60`, or `52×52` when `compact`):
- **`'swiss-spatial'`:** Dashed outer azimuth ring, 4 cardinal axis ticks, inner `accent` ring, and a `3px` top accent plate rule.
- **`'optical-gate'`:** Dark viewfinder corner brackets, inner reticle ring, and `optics.halation` glow.
- **`'risograph-poster'`:** Sharp `0px` corners, hard `1.5px` ink border + `3px 3px 0` stamp shadow, and deterministic seeded micro-tilt (`createSeededRandom`, clamped to `±0.9°` in `9:16` / `±1.4°` in `16:9`; `0°` when `lightingRig === 'studio-macro'`).

```ts
export interface StoryCard2DProps {
  title: string;
  subtitle?: string;
  badge?: string;
  icon?: React.ReactNode;             // optional; renders an engraved geometric glyph when omitted
  plateCode?: string;
  tiltDeg?: number;
  compact?: boolean;                  // default false
  startFrame?: number;                // default 2 (clamped to >= 2)
  accentColor?: string;               // defaults to style.palette.accentPrimary
  styleOverrides?: React.CSSProperties;
}
```

### `AnnotatedCallout2D`
Precision optical target reticle (`data-callout-reticle="true"`) at `target` `[x, y]` connected by a **2-segment `45° -> horizontal` architectural elbow leader** (`data-callout-elbow`, animated along exact segment length via `strokeDasharray` / `strokeDashoffset`) to an elevated tactile flag card (`elevation: 'floating'`) at `labelPosition` `[x, y]` (auto-clamped inside the `9:16` Safe Box on vertical canvases, and collapsing smoothly to `'straight'` when `|dx| < 18`, `|dy| < 18`, or `elbowMode === 'straight'`).

```ts
export interface AnnotatedCallout2DProps {
  target: [number, number];           // [tx, ty] focal target in composition coordinates
  labelPosition: [number, number];    // [lx, ly] center of the elevated tactile flag card
  label: string;
  sublabel?: string;
  code?: string;                      // e.g. 'DETAL A·1'
  elbowMode?: 'auto' | 'straight';    // default 'auto'
  startFrame?: number;                // default 8 (clamped to >= 2)
  accentColor?: string;
}
```

### `ComparisonSplit2D` (& `computeSafeSplitBounds`)
Dual-elevation baseline (`left`, `BAZA`, `elevation: 'resting'`) vs. thesis (`right`, `TEZA`, `elevation: 'floating'` + top `accentPrimary` bar) comparison with a central calibration axis (`data-comparison-axis="true"`, `┼`) and optional **spring-driven optical rack focus** (`data-comparison-rack`, `focusShiftFrame`).

```ts
export interface ComparisonSideSpec {
  tag: string;     // monoFont uppercase kicker (e.g. '01 • PRZED' / '02 • PO')
  title: string;   // concise 2–4 word displayFont heading
  detail: string;  // short 1-sentence bodyFont takeaway
}

export interface ComparisonSplit2DProps {
  left: ComparisonSideSpec;
  right: ComparisonSideSpec;
  startFrame?: number;                // default 2 (clamped to >= 2)
  rightDelayFrames?: number;          // default 14
  focusShiftFrame?: number;           // glides sharp optical focus from left -> right
  initialFocus?: 'both' | 'left';     // defaults to 'left' when focusShiftFrame is set, else 'both'
}
```
- **Optical Rack Focus (`< 0.25px` Sharp Deadzone):** When `focusShiftFrame` is provided, `left` begins sharp (`filter: 'none'`) while `right` rests softly defocused (`maxBlur = Math.max(1.6, optics.aperture * 7)` px, `scale(0.982)`, `opacity: 0.80`). At `focusShiftFrame`, `getStyleSpringConfig(style, 'camera')` pulls sharp focus onto `right` (`filter: 'none'` once `blurPx < 0.25`) while receding `left`.
- **`9:16` Golden Safe Box Guarantee:** `computeSafeSplitBounds(1080, 1920)` places split plates at `left: 76, top: 268, width: 788, height: 1040` — strictly inside `x ∈ [40, 910], y ∈ [220, 1380]` even under `VectorSceneStage2D` optical micro-dolly and brutalist shadows.

---

## 3. Reference Composition Pattern (`EditorialDeskStage` Multi-Act Essay)

```tsx
import React from 'react';
import { AbsoluteFill, Sequence, staticFile, useVideoConfig } from 'remotion';
import { Flame } from 'lucide-react';
import {
  StyleProvider,
  SoundCue,
  VoiceoverTrack,
  productionAssetPath,
  type OpticalShot2D,
} from '@make-pictures/core';
import {
  ChapterTitleCard,
  EditorialDeskStage,
  EditorialMediaCard,
  HighlightQuoteStage,
  SplitStoryLayout,
} from '@make-pictures/kits/editorial-collage';
import { StoryCard2D, ComparisonSplit2D } from '@make-pictures/kits/vector-scene-2d';
import { SFX_MANIFEST, VOICEOVER_MANIFEST } from '../generated/audio-manifest';

export const ArchivalEssay: React.FC<{ styleId: string }> = ({ styleId }) => {
  const { width, height } = useVideoConfig();

  const editorialShots: OpticalShot2D[] = [
    { fromFrame: 0, x: width / 2, y: height / 2 + 8, zoom: 1.0, focalZ: 0.35, transition: 'cut' },
    { fromFrame: 8, x: width / 2 - 6, y: height / 2, zoom: 1.025, focalZ: 0, transition: 'glide' },
    { fromFrame: 180, x: width / 2 + 8, y: height / 2 - 4, zoom: 1.036, focalZ: 0, transition: 'glide' },
    { fromFrame: 420, x: width / 2, y: height / 2, zoom: 1.048, focalZ: 0, transition: 'glide' },
  ];

  return (
    <StyleProvider style={styleId} renderBackdrop>
      <AbsoluteFill>
        <VoiceoverTrack voiceover={VOICEOVER_MANIFEST['s3-quote']} fromFrame={420} />
        <SoundCue
          src={staticFile(SFX_MANIFEST['soft-whoosh'].audioFile)}
          atFrame={646}
          durationSeconds={SFX_MANIFEST['soft-whoosh'].durationSeconds}
          volume={0.32}
        />

        <EditorialDeskStage
          shots={editorialShots}
          sheetCode="KRONIKA RZEMIOSŁA • 1889"
          renderBaseFill={false}
        >
          {/* Act 1: Optical Focus-Pull Chapter Opener */}
          <Sequence from={0} durationInFrames={180}>
            <ChapterTitleCard
              chapterLabel="Rozdział 01"
              title="Jak prosty podpłomyk podbił świat"
              subtitle="Od ulicznych pieców Neapolu do globalnej ikony kultury"
            />
          </Sequence>

          {/* Act 2: Rack-Focus Split Editorial Media + Focal Story Card */}
          <Sequence from={180} durationInFrames={240}>
            <SplitStoryLayout
              startFrame={2}
              focusShiftFrame={108}
              primary={
                <EditorialMediaCard
                  src={staticFile(productionAssetPath('historia-pizzy', 'images/oven-1889.png'))}
                  sourceTag="NEAPOL • 1889"
                  caption="Wypiek w temperaturze 485°C trwał zaledwie dziewięćdziesiąt sekund."
                  mountType="auto"
                  durationInFrames={240}
                />
              }
              secondary={
                <StoryCard2D
                  icon={<Flame size={28} />}
                  badge="485 °C"
                  title="Piec kopułowy z wulkanicznego tufu"
                  subtitle="Błyskawiczny żar zamyka wilgoć wewnątrz cienkiego ciasta."
                  startFrame={14}
                />
              }
            />
          </Sequence>

          {/* Act 3: Word-Synced SVG Ink-Brush Quote Sweep */}
          <Sequence from={420} durationInFrames={210}>
            <HighlightQuoteStage
              quote="Najlepsze wynalazki kulinarne rodzą się z prostoty i ognia."
              highlightPhrase="prostoty i ognia"
              author="Kronika rzemiosła, 1904"
              words={VOICEOVER_MANIFEST['s3-quote']?.words}
            />
          </Sequence>

          {/* Act 4: Era Comparison with Rack Focus */}
          <Sequence from={630} durationInFrames={240}>
            <ComparisonSplit2D
              focusShiftFrame={110}
              left={{
                tag: 'XVIII wiek',
                title: 'Jedzenie biedoty ulicznej',
                detail: 'Sprzedawane z miedzianych puszek stufa na rogach wąskich uliczek.',
              }}
              right={{
                tag: 'Lista UNESCO',
                title: 'Światowe dziedzictwo',
                detail: 'Sztuka neapolitańskich pizzaioli wpisana na listę niematerialnego dziedzictwa.',
              }}
            />
          </Sequence>
        </EditorialDeskStage>
      </AbsoluteFill>
    </StyleProvider>
  );
};
```

### `VectorSceneStage2D` Multi-Plane Plate Pattern (`foregroundCallouts` + Rack Focus)

```tsx
<VectorSceneStage2D
  plateCode="TABLICA 01 • ARCHITEKTURA"
  renderBaseFill={false}
  foregroundCallouts={
    <Sequence from={0} durationInFrames={320}>
      <AnnotatedCallout2D
        target={isVertical ? [360, 650] : [960, 560]}
        labelPosition={isVertical ? [590, 860] : [1180, 790]}
        code="DETAL A·1"
        label="60 FPS • StyleProvider"
        sublabel="Precyzyjny celownik na planie z = +0.42"
        startFrame={18}
      />
    </Sequence>
  }
>
  <Sequence from={0} durationInFrames={320}>
    <StoryCard2D
      badge="FIG. 01"
      plateCode="Z +0.00"
      title="Przejrzysta narracja pojęć"
      subtitle="Grawerowany medalion i kierunkowy cień bez pigułek SaaS."
      startFrame={2}
    />
  </Sequence>

  <Sequence from={320} durationInFrames={328}>
    <ComparisonSplit2D
      startFrame={2}
      focusShiftFrame={150}
      left={{
        tag: '01 • Baza',
        title: 'Płaski szablon',
        detail: 'Brak głębi i światła kierunkowego.',
      }}
      right={{
        tag: '02 • Kierunek plastyczny',
        title: 'Wieloplanowa optyka',
        detail: 'Przeostrzenie prowadzi wzrok widza.',
      }}
    />
  </Sequence>
</VectorSceneStage2D>
```

---

## 4. Editorial & Layout Guardrails

1. **Clean Frame `0`:** Never pass `startFrame={0}` expecting immediate visibility — `EditorialDeskStage`, `VectorSceneStage2D`, and all narrative kit components clamp `effectiveStart = Math.max(2, startFrame)` (with `frame <= 0` stage guards) so `frame === 0` renders pure `palette.bgCanvas`.
2. **Safe Tilt & Concise Polish Copy (`latin-ext`):** Keep `tiltDeg` within `[-1.2°, +1.2°]` (`±0.9°` for `StoryCard2D` and `±0.42°` for `ComparisonSplit2D`) on vertical `9:16` layouts, `StoryCard2D` / `ComparisonSplit2D` titles to **2–4 words**, and `detail` / `caption` to **1 crisp sentence** so rotated plates never overflow `SplitStoryLayout` or `computeSafeSplitBounds`. Always write Polish headlines in *Sentence case* (`Sztuka wypieku`, never `Sztuka Wypieku`).
3. **`AnnotatedCallout2D` Safe Coordinates in `9:16`:** On vertical `1080×1920` compositions, `AnnotatedCallout2D` automatically clamps `labelPosition` inside `lx ∈ [190, 740]` and `ly ∈ [264, 1332]` (`maxWidth: 360`) so the elevated tactile flag plate stays strictly inside `x ∈ [40, 910], y ∈ [220, 1380]`. Wrap `foregroundCallouts` in `<Sequence from={...} durationInFrames={...}>` when scoping callouts to a single act inside `VectorSceneStage2D`.
4. **Mix Kits Freely:** Combine `editorial-collage` (`EditorialDeskStage`) and `vector-scene-2d` (`VectorSceneStage2D`) with `DataStoryStage2D` / `AnimatedBarRace` / `TimelineTrack` / `MetricComparisonCard` (`kit-kinetic-and-data`) inside the same `<StyleProvider>` so charts, graphic plates, and archival mounts share identical fonts, directional shadows, and optical lighting.
