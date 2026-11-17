---
name: kit-kinetic-and-data
description: >-
  APIs, polymorphic 3-grammar film typography (swiss-spatial, optical-gate,
  risograph-poster), ClippedSurfaceChrome corner precision, 3-ArtWorld
  ScenicBackdropLayers in DataStoryStage2D, Vernier/Risograph counters, tonal
  ranked bar races, chronicle vernier rack-focus timelines, calibrated 240°
  instrument dials, Single Focal Point law, and 9:16 Golden Safe Box layout
  rules for @make-pictures/kits/kinetic-typography and
  @make-pictures/kits/data-storytelling. Use whenever building typographic
  statements, animated KPI counters, ranked bar races, timelines, or metric
  comparators.
---

# Kit: Kinetic Typography & Data Storytelling (`@make-pictures/kits`)

Build calm, authoritative film typography, editorial data cartography, and calibrated `60 FPS` instrument visualizations across the 3 Artistic Worlds (`atelier`, `illustrative`, `editorial-gallery`) with `<ClippedSurfaceChrome />` rounded-corner precision, high-damping spring physics (`damping: 200`), and strict `9:16` Golden Safe Box compliance.

---

## Core Primitives & Imports

```tsx
import {
  ClippedSurfaceChrome,
  ContinuousSceneFlow,
  DepthPlane,
  OpticalStage2D,
  ScenicBackdropLayers,
  StageLightingRig,
  type OpticalShot2D,
  type StageNode2D,
  type StyleTypographyGrammar,
} from '@make-pictures/core';

import {
  WordByWordStage,
  groupWordsIntoBeats,
  ImpactKeywordCard,
  AnimatedMetricCounter,
  formatTabularMetric,
  type WordByWordStageProps,
  type WordPhraseBeat,
  type ImpactKeywordCardProps,
  type AnimatedMetricCounterProps,
} from '@make-pictures/kits/kinetic-typography';

import {
  DataStoryStage2D,
  AnimatedBarRace,
  TimelineTrack,
  MetricComparisonCard,
  getSmoothedRanks,
  resolveTonalBarFill,
  type DataStoryStage2DProps,
  type AnimatedBarRaceProps,
  type BarRaceItem,
  type BarRaceKeyframe,
  type TimelineTrackProps,
  type TimelineMilestone,
  type MetricComparisonCardProps,
} from '@make-pictures/kits/data-storytelling';
```

*(All kit components are also re-exported from `@make-pictures/kits`.)*

---

## 1. Kinetic Typography (`@make-pictures/kits/kinetic-typography`)

All three `kinetic-typography` components adapt across 3 film typography grammars (`'swiss-spatial' | 'optical-gate' | 'risograph-poster'`, defaulting to `resolveStyleOptics(studioStyle).typographyGrammar`).

> **CRITICAL — Single Focal Point Law (`COMPETING_FOCAL_POINT` QA Gate):**
> **Never** mount `<WordByWordStage>` in the same scene alongside `<ImpactKeywordCard>`, `<StoryCard2D>`, `<MetricComparisonCard>`, or `<SystemNode>`. Give `<WordByWordStage>` its own dedicated calm scene (`>= 270` frames / `4.5s` @ `60 FPS`) and transition via `<ContinuousSceneFlow />`.

### `WordByWordStage` (& `groupWordsIntoBeats`)
Multi-beat phrase choreography synchronized directly to ElevenLabs `WordTimestamp[]` alignment data (`3–5` words per beat, strictly inside `9:16` Golden Safe Box `x ∈ [40, 910], y ∈ [220, 1380]`). Pair with `<StageLightingRig renderBaseFill={false} />` + `<ScenicBackdropLayers />` + `<OpticalStage2D startFrame={2}>` inside `<StyleProvider renderBackdrop>`.

### `ImpactKeywordCard`
Polymorphic typographic statement card (*2–4 word headline + optional `eyebrow` / `badge` / `sublabel`*) with tactile directional shadows (`getTactileSurfaceStyle`) and **`<ClippedSurfaceChrome />`** interior top bar + specular rim (`specularRim={!isDark}`) so zero accent pixels ever protrude past rounded card corners. `icon` defaults to `null`.

### `AnimatedMetricCounter` (& `formatTabularMetric`)
Smooth `60 FPS` `tabular-nums` ticker with a **21-tick SVG Vernier scale** (`data-vernier-scale="true"` in `'swiss-spatial'` / `'optical-gate'`) or **10-segment Risograph block meter** (`data-risograph-meter="true"` in `'risograph-poster'`), or pure inline `<span>` (`variant="inline"`).

---

## 2. Data Storytelling (`@make-pictures/kits/data-storytelling`)

### `DataStoryStage2D`
Multi-plane 2.5D data cartography stage combining `<StageLightingRig />` + **3-ArtWorld `<ScenicBackdropLayers />`** + `<OpticalStage2D startFrame={1}>`:
- **`showScenicBackdrop?: boolean`** (default `true`): automatically renders `'atelier'`, `'illustrative'`, or `'editorial-gallery'` scenery behind the scale grid while returning `null` on `frame <= 0`.
- **`datasetCode?: string`** (default `undefined`): **zero default developer noise** — the `∑ {datasetCode}` header on `z = -0.58` is omitted unless `datasetCode` is explicitly passed as a non-empty string.
- **`z = 0.00`:** Primary crisp data plane (`children`, `filter: 'none'`).
- **`z = +0.68` (`foregroundAccents = true`):** Edge vernier calibration ticks strictly outside the `9:16` Golden Safe Box.

```ts
export interface DataStoryStage2DProps {
  shots?: ReadonlyArray<OpticalShot2D>;
  nodes?: Record<string, StageNode2D>;
  datasetCode?: string;         // default undefined (omitted unless explicitly non-empty)
  showScenicBackdrop?: boolean; // default true (3-ArtWorld ScenicBackdropLayers)
  foregroundAccents?: boolean;  // default true
  renderBaseFill?: boolean;     // default true (pass false inside <StyleProvider renderBackdrop>)
  seed?: number;                // default 2029
  children?: React.ReactNode;
}
```

### `AnimatedBarRace` (& `getSmoothedRanks`, `resolveTonalBarFill`)
Ranked `60 FPS` editorial bar chart (`data-bar-grammar={grammar}`, `data-bar-grid="true"`) wrapped with **`<ClippedSurfaceChrome />`** top accent bar & specular rim, raised-cosine rank overtaking (`getSmoothedRanks`, zero `useRef`), `25% / 50% / 75% / 100%` hairline gridlines, and `resolveTonalBarFill` tonal hierarchy (`accentPrimary` for `#1`, `accentSecondary` for `#2`, `textSecondary` for `#3+`).

### `TimelineTrack`
Chronicle vernier rail (`data-timeline-grammar={grammar}`, `data-vernier-rail="true"`) with 25 scale subdivisions and optical rack focus (`filter: 'none'` on active milestone; auto-switches to vertical chronicle rail on `9:16` viewports when `4+` milestones are present).

### `MetricComparisonCard`
Calibrated `240°` SVG degree-tick instrument dials (`mode="rings"`, default, `data-instrument-arc="240"`, `BAZA ──┼── WYNIK` bridge) or dual baseline comparator with a `45°` hatched delta span (`mode="bars"`, `data-delta-hatch="true"`), wrapped with **`<ClippedSurfaceChrome />`** top accent bar & specular rim. When `title` is omitted, no technical fallback label is printed alongside the `Δ` stamp.

---

## Design, 1080p Legibility (`>= 18 px`) & Director QA Guardrails

1. **Clean Frame `0`:** Keep `startFrame >= 2` and wrap scenes in `<DataStoryStage2D renderBaseFill={false}>` or `<OpticalStage2D startFrame={2}>` so `frame === 0` stays `100%` uniform `palette.bgCanvas` (`0.00` RGB variance).
2. **Hard `>= 18–19 px` 1080p Typography Floor & `tabular-nums` (`TYPOGRAPHY_FLOOR_1080P`):** Every axis label, milestone badge, and caption on `1920×1080` / `1080×1920` must render at **`>= 18–19 px`** (strictly zero `10–14 px` micro-eyebrows or corner stamps). Primary KPI metrics render at **`64–96 px`** with mandatory `fontVariantNumeric: 'tabular-nums'`, and charts/counters should occupy **`>= 60%`** of their container with `boxSizing: 'border-box'` and zero `space-between` vertical voids.
3. **Calm Pacing & Breathing Room (`computeSceneTimingFromVoiceover`):** Compose data and kinetic acts inside `<ContinuousSceneFlow crossDissolveFrames={54} />` (`>= 270` frames / `4.5s` per scene, `<= 2.8` words/s) with **`~42` frames (`0.7s`)** pre-speech settle, **`90–102` frames (`1.5–1.7s`)** post-speech hold, and **`132–150` frames (`2.2–2.5s`)** outro hold on the closing scene.
4. **Polish Sentence Case (`latin-ext`):** Write labels in *Sentence case* (`Czas odpowiedzi serwera`, never `Czas Odpowiedzi Serwera`).
