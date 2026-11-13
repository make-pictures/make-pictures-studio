---
name: kit-editorial-and-vector
description: >-
  APIs, TypeScript props interfaces, deterministic Ken Burns math, word-synced
  quote highlighting, and 9:16 Golden Safe Box layout rules for the two universal
  narrative kits: @make-pictures/kits/editorial-collage (ChapterTitleCard,
  EditorialMediaCard, HighlightQuoteStage, SplitStoryLayout) and
  @make-pictures/kits/vector-scene-2d (StoryCard2D, AnnotatedCallout2D,
  ComparisonSplit2D). Use whenever building documentaries, history/culture/science
  essays, case studies, or clean 2D concept and product explainers.
---

# Kit: Editorial Collage & Vector Scene 2D (`@make-pictures/kits`)

Build magazine-grade documentaries, historical/scientific video essays, and clean 2D visual explainers without 3D cardboard props or network-diagram boilerplate. Every component automatically reads colors, Google Fonts (`latin-ext`), card chrome (`getCardChromeStyle`), and motion springs (`getStyleSpringConfig`) from `<StyleProvider>` (`useStudioStyle()`).

---

## Core Primitives & Imports

```tsx
import { StyleProvider } from '@make-pictures/core';

import {
  ChapterTitleCard,
  EditorialMediaCard,
  HighlightQuoteStage,
  SplitStoryLayout,
  type ChapterTitleCardProps,
  type EditorialMediaCardProps,
  type HighlightQuoteStageProps,
  type SplitStoryLayoutProps,
} from '@make-pictures/kits/editorial-collage';

import {
  StoryCard2D,
  AnnotatedCallout2D,
  ComparisonSplit2D,
  computeSafeSplitBounds,
  type StoryCard2DProps,
  type AnnotatedCallout2DProps,
  type ComparisonSideSpec,
  type ComparisonSplit2DProps,
} from '@make-pictures/kits/vector-scene-2d';
```

*(All components and types are also re-exported from `@make-pictures/kits`.)*

---

## 1. Editorial Collage (`@make-pictures/kits/editorial-collage`)

Best paired with `editorial-press`, `archival-chronicle`, or a bespoke era/publication preset in `styles/<slug>.style.json`.

### `ChapterTitleCard`
Cinematic chapter/act opener with `monoFont` eyebrow label, animated accent rule, `displayFont` headline (`formatHeadingText`), and optional `bodyFont` subtitle.

```ts
export interface ChapterTitleCardProps {
  chapterLabel: string;
  title: string;
  subtitle?: string;
  startFrame?: number;   // default 2 (clamped to >= 2 for Clean Frame 0)
  accentColor?: string;  // defaults to style.palette.accentPrimary
}
```

### `EditorialMediaCard`
Framed archival photo, illustration, or generated visual asset with optional `monoFont` date/source badge, editorial caption, and **100% deterministic Ken Burns pan & zoom**.

```ts
export interface EditorialMediaCardProps {
  src?: string;                     // pass staticFile(productionAssetPath(slug, 'images/...'))
  caption: string;
  sourceTag?: string;               // e.g. 'NEAPOL, 1889' or 'ARCHIWUM PAN'
  startFrame?: number;              // default 2 (clamped to >= 2)
  durationInFrames?: number;        // default 180 (Ken Burns interpolation span)
  zoomFrom?: number;                // default 1.02
  zoomTo?: number;                  // default 1.1
  panX?: number;                    // default -14 (px)
  panY?: number;                    // default -10 (px)
  styleOverrides?: React.CSSProperties;
}
```
- **Deterministic Ken Burns Math:** Computes `kenBurnsProgress = interpolate(localFrame, [0, Math.max(30, durationInFrames)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })` and applies pure `scale(...) translate(tx, ty)` — zero `useRef` drift under `--concurrency=100%`. When `src` is omitted during early storyboarding, renders a clean themed gradient placeholder.

### `HighlightQuoteStage`
Editorial thesis or historical quotation card (`„…”`) with an animated marker-sweep highlight (`accentPrimary`) synchronized directly to spoken ElevenLabs `WordTimestamp[]` alignment data.

```ts
export interface HighlightQuoteStageProps {
  quote: string;
  highlightPhrase?: string;  // exact substring of `quote` to sweep-highlight
  author?: string;           // rendered as "— {author}" in monoFont
  startFrame?: number;       // default 2 (clamped to >= 2)
  highlightFrame?: number;   // default 26 (used when `words` is omitted or unmatched)
  words?: WordTimestamp[];   // e.g. VOICEOVER_MANIFEST['s2-quote']?.words
}
```
- **Word-Timestamp Sync:** Matches the normalized first word of `highlightPhrase` against `words` (`w.normalizedWord === firstToken`) to trigger the `emphasis` spring sweep on the exact frame the narrator speaks that phrase, falling back smoothly to `highlightFrame`.

### `SplitStoryLayout`
Responsive two-zone narrative stage combining any two editorial/data/vector cards (for example, `primary={<EditorialMediaCard ... />}` + `secondary={<StoryCard2D ... />}`).

```ts
export interface SplitStoryLayoutProps {
  primary: React.ReactNode;
  secondary: React.ReactNode;
  startFrame?: number;  // default 2 (clamped to >= 2)
  gap?: number;         // default 40 (16:9 grid column gap in px)
}
```
- **`16:9` Landscape (`1920×1080`):** Asymmetric `1.08fr 0.92fr` two-column grid (`maxWidth: 1640`, `padding: '96px 120px'`).
- **`9:16` Vertical (`1080×1920`):** Automatically switches to a vertical stack (`left: 52, top: 240, width: 840, maxHeight: 1120`) positioned **strictly inside the Golden Safe Box `x ∈ [40, 910], y ∈ [220, 1380]`**, avoiding Shorts/Reels/TikTok top headers, bottom captions, and the right-hand action icon rail.

---

## 2. Vector Scene 2D (`@make-pictures/kits/vector-scene-2d`)

Universal 2D visual storytelling primitives for product explainers, lessons, metaphors, and clear A/B or before/after comparisons. Adapts dramatically across `minimal-product`, `brutalist-poster`, `sketch-notebook`, and `cyber-telemetry`.

### `StoryCard2D`
Focal scenic card (*Icon + badge + 2–4 word title + concise subtitle*) styled via `getCardChromeStyle(style)`.

```ts
export interface StoryCard2DProps {
  title: string;
  subtitle?: string;
  badge?: string;
  icon?: React.ReactNode;           // e.g. <Sparkles size={28} /> from lucide-react
  startFrame?: number;              // default 2 (clamped to >= 2)
  accentColor?: string;             // defaults to style.palette.accentPrimary
  styleOverrides?: React.CSSProperties;
}
```

### `AnnotatedCallout2D`
Animated SVG target dot + `strokeDashoffset` leader line pointing from `target` `[x, y]` to a themed callout pill centered at `labelPosition` `[x, y]`.

```ts
export interface AnnotatedCallout2DProps {
  target: [number, number];         // [tx, ty] focal point in composition coordinates
  labelPosition: [number, number];  // [lx, ly] center of the callout label card
  label: string;
  startFrame?: number;              // default 8 (clamped to >= 2)
  accentColor?: string;
}
```

### `ComparisonSplit2D` (& `computeSafeSplitBounds`)
Side-by-side (`16:9`) or top-and-bottom (`9:16`) contrast stage comparing two states, eras, architectures, or options with staggered spring entrances (`rightDelayFrames`).

```ts
export interface ComparisonSideSpec {
  tag: string;     // monoFont uppercase kicker (e.g. 'PRZED' / 'PO', '1889' / 'DZIŚ')
  title: string;   // concise 2–4 word displayFont heading
  detail: string;  // short 1-sentence bodyFont takeaway
}

export interface ComparisonSplit2DProps {
  left: ComparisonSideSpec;
  right: ComparisonSideSpec;
  startFrame?: number;        // default 2 (clamped to >= 2)
  rightDelayFrames?: number;  // default 14
}
```
- **`9:16` Golden Safe Box Guarantee:** `computeSafeSplitBounds(width, height)` places vertical `1080×1920` split cards at `left: 54, top: 250, width: 836, height: 1080` — strictly inside `x ∈ [40, 910], y ∈ [220, 1380]`.

---

## 3. Reference Composition Pattern

```tsx
import React from 'react';
import { AbsoluteFill, Sequence, staticFile } from 'remotion';
import { Flame } from 'lucide-react';
import { StyleProvider, SoundCue, VoiceoverTrack, productionAssetPath } from '@make-pictures/core';
import {
  ChapterTitleCard,
  EditorialMediaCard,
  HighlightQuoteStage,
  SplitStoryLayout,
} from '@make-pictures/kits/editorial-collage';
import { StoryCard2D, ComparisonSplit2D } from '@make-pictures/kits/vector-scene-2d';
import { SFX_MANIFEST, VOICEOVER_MANIFEST } from '../generated/audio-manifest';

export const ArchivalEssay: React.FC<{ styleId: string }> = ({ styleId }) => (
  <AbsoluteFill>
    <StyleProvider style={styleId} renderBackdrop>
      {/* Act 1: Chapter Opener */}
      <Sequence from={0} durationInFrames={180}>
        <ChapterTitleCard
          chapterLabel="Rozdział 01"
          title="Jak prosty podpłomyk podbił świat"
          subtitle="Od ulicznych pieców Neapolu do globalnej ikony kultury"
        />
      </Sequence>

      {/* Act 2: Split Editorial Media + Focal Story Card */}
      <Sequence from={180} durationInFrames={240}>
        <SplitStoryLayout
          primary={
            <EditorialMediaCard
              src={staticFile(productionAssetPath('historia-pizzy', 'images/oven-1889.png'))}
              sourceTag="NEAPOL • 1889"
              caption="Wypiek w temperaturze 485°C trwał zaledwie dziewięćdziesiąt sekund."
              durationInFrames={240}
            />
          }
          secondary={
            <StoryCard2D
              icon={<Flame size={28} />}
              badge="485 °C"
              title="Piec kopułowy z wulkanicznego tufu"
              subtitle="Błyskawiczny żar zamyka wilgoć wewnątrz cienkiego ciasta."
              startFrame={18}
            />
          }
        />
      </Sequence>

      {/* Act 3: Word-Synced Quote Sweep */}
      <Sequence from={420} durationInFrames={210}>
        <HighlightQuoteStage
          quote="Najlepsze wynalazki kulinarne rodzą się z prostoty i ognia."
          highlightPhrase="prostoty i ognia"
          author="Kronika rzemiosła, 1904"
          words={VOICEOVER_MANIFEST['s3-quote']?.words}
        />
        <VoiceoverTrack voiceover={VOICEOVER_MANIFEST['s3-quote']} fromFrame={0} />
      </Sequence>

      {/* Act 4: Era Comparison */}
      <Sequence from={630} durationInFrames={240}>
        <ComparisonSplit2D
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
        <SoundCue
          src={staticFile(SFX_MANIFEST['soft-whoosh'].audioFile)}
          atFrame={16}
          durationSeconds={SFX_MANIFEST['soft-whoosh'].durationSeconds}
          volume={0.32}
        />
      </Sequence>
    </StyleProvider>
  </AbsoluteFill>
);
```

---

## 4. Editorial & Layout Guardrails

1. **Clean Frame `0`:** Never pass `startFrame={0}` expecting immediate visibility — all narrative kit components clamp `effectiveStart = Math.max(2, startFrame)` so `frame === 0` renders pure `palette.bgCanvas`.
2. **Concise Copy & Polish Sentence Case:** Keep `StoryCard2D` and `ComparisonSplit2D` titles to **2–4 words** and `detail` / `caption` to **1 crisp sentence** so cards never overflow `SplitStoryLayout` in `9:16`. Always write Polish headlines in *Sentence case* (`Sztuka wypieku`, never `Sztuka Wypieku`).
3. **`AnnotatedCallout2D` Safe Coordinates in `9:16`:** When placing `AnnotatedCallout2D` on vertical `1080×1920` compositions, keep `labelPosition[0] ∈ [180, 770]` and `labelPosition[1] ∈ [260, 1340]` so the centered pill stays strictly inside `x ∈ [40, 910], y ∈ [220, 1380]`.
4. **Mix Kits Freely:** Combine `editorial-collage` and `vector-scene-2d` with `AnimatedBarRace` / `TimelineTrack` (`kit-kinetic-and-data`) inside the same `<StyleProvider>` so charts and archival cards share identical fonts, borders, and colors.
