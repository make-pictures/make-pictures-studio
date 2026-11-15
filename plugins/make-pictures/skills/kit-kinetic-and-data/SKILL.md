---
name: kit-kinetic-and-data
description: >-
  APIs, polymorphic 3-grammar film typography (swiss-spatial, optical-gate,
  risograph-poster), Vernier/Risograph counters, multi-plane data cartography,
  tonal ranked bar races, chronicle vernier rack-focus timelines, calibrated
  240° instrument dials, 60 FPS spring choreography, and 9:16 Golden Safe Box
  layout rules for @make-pictures/kits/kinetic-typography (WordByWordStage,
  ImpactKeywordCard, AnimatedMetricCounter) and @make-pictures/kits/data-storytelling
  (DataStoryStage2D, AnimatedBarRace, TimelineTrack, MetricComparisonCard). Use
  whenever building typographic reels, animated KPI counters, ranked bar races,
  timelines, or before/after metric comparators.
---

# Kit: Kinetic Typography & Data Storytelling (`@make-pictures/kits`)

Build punchy, word-synchronized film typography Shorts/Reels, editorial data cartography, and calibrated `60 FPS` instrument visualizations with high-damping spring physics (`damping: 200`), multi-plane 2.5D optical depth, and built-in `9:16` Golden Safe Box compliance.

---

## Core Primitives & Imports

```tsx
import {
  DepthPlane,
  OpticalStage2D,
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

All three `kinetic-typography` components are **polymorphic across 3 film typography grammars** via `grammar?: 'swiss-spatial' | 'optical-gate' | 'risograph-poster'` (defaulting automatically to `resolveStyleOptics(studioStyle).typographyGrammar` from `<StyleProvider>` — zero karaoke pill backgrounds, zero generic `<Sparkles />` icon tiles, and zero `5px` SaaS progress bars):

1. **`'swiss-spatial'`** *(default for `minimal-product`, `editorial-press`, `archival-chronicle`)*: Swiss editorial column rule with live accent cursor and `01/04` beat index in `monoFont`; multi-beat spatial depth (`prevBeat` / `nextBeat` softly lens-blurred by `optics.aperture`, active beat sharp at `filter: 'none'`); spoken word emphasized with `accentPrimary` text and a left-origin spring ink underline.
2. **`'optical-gate'`** *(default for `cyber-telemetry` & dark surfaces)*: 35mm optical projector gate with corner reticles, `BEAT 01/04 • F:0048` frame counter, vertical drum step with blurred neighbor lines, and a 12-frame chromatic dispersion + `optics.halation` bloom impulse on beat cuts that settles to sharp `filter: 'none'`.
3. **`'risograph-poster'`** *(default for `brutalist-poster`, `sketch-notebook`, `tactile-craft`)*: Cut poster composition with alternating beat tilt (`±1.1°`), `0px` sharp corners, rectangular inverse ink-stamp active words, and secondary-ink misregistration offset shadows (`4px 3px 0 accentSecondary`).

### `WordByWordStage` (& `groupWordsIntoBeats`)
Multi-beat phrase choreography synchronized directly to ElevenLabs `WordTimestamp[]` alignment data:
- **Props:** `words?: ReadonlyArray<WordTimestamp>` or `sceneId?: string` (+ optional `voiceoverManifest`, `fallbackText?: string`), `sceneStartFrame?: number` (default `0`), `wordsPerBeat?: number` (`3..5`, default `4`), `grammar?: 'swiss-spatial' | 'optical-gate' | 'risograph-poster'`, `accentColor?: string`, `variant?: 'dark' | 'light' | 'transparent'`, `eyebrow?: string`, `fontSize?: number`, `safeBox9x16?: boolean` (default `true`), `startFrame?: number` / `enterFrame?: number` (clamped `>= 2` for Clean Frame `0`), `style?: React.CSSProperties`.
- `groupWordsIntoBeats(words, wordsPerBeat, fps)` groups spoken tokens into natural **3–5 word beats** breaking on punctuation and vocal pauses, rendering `prevBeat`, `activeBeat`, and `nextBeat` strictly inside the **`9:16` Golden Safe Box (`x ∈ [40, 910]`, `y ∈ [220, 1380]`)**.

### `ImpactKeywordCard`
Polymorphic typographic statement card (*2–4 word headline + optional `eyebrow` / `badge` / `sublabel`*) with tactile directional shadows (`getTactileSurfaceStyle`):
- **Props:** `keyword: string`, `eyebrow?: string`, `sublabel?: string`, `badge?: string`, `icon?: React.ReactNode` (**defaults to `null` — no `<Sparkles />` tile**; pass an explicit `icon` only when a clean inline typographic mark is desired), `grammar?: 'swiss-spatial' | 'optical-gate' | 'risograph-poster'`, `accentColor?: string`, `variant?: 'dark' | 'light'`, `startFrame?: number` / `enterFrame?: number` (`>= 2` for Clean Frame `0`), `exitFrame?: number`, `safeBox9x16?: boolean` (default `true`), `style?: React.CSSProperties`.
- Adapts automatically into a tactile sheet with top Swiss register rule (`swiss-spatial`), `+` reticle frame with halation headline (`optical-gate`), or `-0.7°` tilted poster cut-out with `6px 6px 0` ink offset (`risograph-poster`).

### `AnimatedMetricCounter` (& `formatTabularMetric`)
Smooth `60 FPS` interpolated numeric/currency/percentage ticker using `tabular-nums`, replacing generic `5px` progress bars with physical instrument scales:
- **Props:** `value: number`, `fromValue?: number` (default `0`), `prefix?: string` (e.g. `'$'`, `'+'`), `suffix?: string` (e.g. `'%'`, `' FPS'`, `'×'`), `decimals?: number` (default `0`), `startFrame?: number` (default `2`), `durationInFrames?: number` (default `54`), `label?: string`, `badge?: string`, `grammar?: 'swiss-spatial' | 'optical-gate' | 'risograph-poster'`, `accentColor?: string`, `variant?: 'dark' | 'light' | 'inline'`, `thousandSeparator?: string` (default `','`), `fontSize?: number`, `style?: React.CSSProperties`.
- **Precision SVG Vernier Scale vs. Risograph Block Meter:** In `'swiss-spatial'` and `'optical-gate'`, renders a **21-tick SVG Vernier scale** (`data-vernier-scale="true"`, major ticks every 5th mark) illuminated proportionally to `countProgress`. In `'risograph-poster'`, renders a **10-segment Risograph block meter** (`data-risograph-meter="true"`) inside a hard-bordered poster block (`5px 5px 0 inkBorder`). When `variant === 'inline'`, renders a pure `tabular-nums` `<span>`.

### Optical Stage Pairing Pattern
Pair `<StageLightingRig renderBaseFill={false} />` with `<OpticalStage2D startFrame={2}><DepthPlane z={0}>...</DepthPlane></OpticalStage2D>` inside `<StyleProvider style={props.styleId} renderBackdrop>` so kinetic typography inherits live directional gobo/halation lighting and subtle handheld camera motion.

---

## 2. Data Storytelling (`@make-pictures/kits/data-storytelling`)

Editorial data cartography & calibrated instrument gauges — zero hardcoded rainbow swatches (`FALLBACK_BAR_SWATCHES`), zero rounded glowing `9999px` pills, zero e-commerce `lucide-react` `<Check />` steppers, and zero smartwatch round-cap fitness rings. Automatically adapts across `swiss-spatial`, `optical-gate`, and `risograph-poster` via `resolveStyleOptics(studioStyle)`.

### `DataStoryStage2D`
Multi-plane 2.5D data cartography stage combining `<StageLightingRig />` and `<OpticalStage2D startFrame={1}>`:
- **`z = -0.58` (Scale Grid Sheet):** Hairline vertical scale subdivisions (`0 · 25 · 50 · 75 · 100`) and `∑ {datasetCode}` header in `monoFont` (softly defocused when `focalZ = 0`).
- **`z = 0.00` (Primary Crisp Data Plane):** Hero chart, timeline, or comparator (`children`) rendered sharp (`filter: 'none'`).
- **`z = +0.68` (`foregroundAccents`):** Subtle 13-tick edge vernier calibration scale strictly outside the `9:16` Golden Safe Box (`foregroundAccents = true`).

```ts
export interface DataStoryStage2DProps {
  shots?: ReadonlyArray<OpticalShot2D>;
  nodes?: Record<string, StageNode2D>;
  datasetCode?: string;         // default 'ARKUSZ POMIAROWY • 60 FPS'
  foregroundAccents?: boolean;  // default true
  renderBaseFill?: boolean;     // default true (pass false inside <StyleProvider renderBackdrop>)
  seed?: number;                // default 2029
  children?: React.ReactNode;
}
```
- **Default Camera & Clean Frame `0`:** Executes a 3-shot micro-dolly with an entrance rack-focus pull (`focalZ: 0.34 -> 0` from `frame = 0` to `frame = 6`) when `shots` is omitted. On `frame <= 0`, renders pure `style.palette.bgCanvas` (or `null` when `renderBaseFill={false}`).

### `AnimatedBarRace` (& `getSmoothedRanks`, `resolveTonalBarFill`)
Ranked `60 FPS` editorial bar chart (`data-bar-grammar={grammar}`, `data-bar-grid="true"`) with raised-cosine rank overtaking (`getSmoothedRanks`), vertical `25% / 50% / 75% / 100%` hairline gridlines, `tabular-nums` figures, and **style-derived tonal hierarchy**:
- **`getSmoothedRanks(items, frame)`:** Pure deterministic `f(frame)` raised-cosine kernel rank smoother (`radius = 12` frames, zero `useRef` state) so overtaking bars glide cleanly past each other over ~22 frames instead of snapping.
- **`resolveTonalBarFill(studioStyle, discreteRank, explicitColor?)`:** Returns `explicitColor` when `item.color` is provided, `palette.accentPrimary` for `#1` (`discreteRank <= 0`), `palette.accentSecondary` for `#2` (`discreteRank === 1`), and `palette.textSecondary` tonal step-down for `#3+`.
- **Polymorphic Bar Finishes:** Sharp rectangular bars with underlined `01..0N` tabular index stamps and a `2.5px` leader end-stop in `'swiss-spatial'`; dark telemetry track with leader-only `optics.halation` glow in `'optical-gate'`; `1.5px` ink borders, inverse `01` leader stamp, and `-45°` diagonal hatch fill on non-leader bars in `'risograph-poster'`.
- **Props:** `items: ReadonlyArray<BarRaceItem>` (`{ id, label, value, keyframes?: { frame, value }[], color?, badge?, icon? }`), `orientation?: 'horizontal' | 'vertical'` (default `'horizontal'`), `title?: string`, `subtitle?: string`, `valuePrefix?: string`, `valueSuffix?: string`, `decimals?: number`, `maxItems?: number` (default `6` — keep **4–6 items max** for mobile legibility), `staggerFrames?: number`, `startFrame?: number` / `enterFrame?: number` (clamped `>= 2`), `variant?: 'dark' | 'light'`, `safeBox9x16?: boolean`, `style?: React.CSSProperties`.

### `TimelineTrack`
Chronicle vernier rail (`data-timeline-grammar={grammar}`, `data-vernier-rail="true"`) with 25 minor/major scale subdivisions and **optical rack focus**:
- **Optical Rack Focus (`< 0.25px` Sharp Deadzone):** The active milestone (`fromFrame <= frame`) lifts onto an elevated tactile card (`elevation: 'floating'`) at sharp **`filter: 'none'`**, while past and future milestones recede (`scale(0.96)`, `opacity: 0.72` / `0.58`, and `rawBlur = Math.min(2, Math.abs(idx - activeIdx)) * optics.aperture * 3.4`, emitting `filter: 'none'` whenever `rawBlur < 0.25`).
- **Polymorphic Era Markers & `9:16` Layout:** Formats active/inactive `era` markers per grammar (`▲ 2026` / `│ 1998` in `'swiss-spatial'`, `◆ 2026 · LOCK` / `┼ 1998` in `'optical-gate'`, inverse stamp `2026` / `[1998]` in `'risograph-poster'`). Auto-switches on vertical `9:16` viewports from horizontal (`<= 3` milestones) to a vertical chronicle rail (`4+` milestones) inside `x ∈ [40, 910], y ∈ [220, 1380]`. Sync `fromFrame` directly to spoken years/steps via `getWordTriggerFrame`.
- **Props:** `milestones: ReadonlyArray<TimelineMilestone>` (`{ id, label, era?, fromFrame?, frame?, detail?, color? }`), `orientation?: 'horizontal' | 'vertical'`, `accentColor?: string`, `startFrame?: number` / `enterFrame?: number` (clamped `>= 2`), `variant?: 'dark' | 'light'`, `safeBox9x16?: boolean`, `style?: React.CSSProperties`.

### `MetricComparisonCard`
Calibrated `240°` SVG degree-tick instrument dials with rotating indicator needles (`mode="rings"`, default, `data-instrument-arc="240"`) or dual baseline comparator with a **`45°` hatched delta span** (`mode="bars"`, `data-delta-hatch="true"`), paired with a rectangular `monoFont` `tabular-nums` `Δ` stamp:
- **`mode = 'rings'` (Default):** Two `240°` dials (`25` ticks every `10°`, major ticks every `60°`), sharp `strokeLinecap="butt"` value arcs, indicator needles + pivot pins, `tabular-nums` readouts, and a central **`BAZA ──┼── WYNIK`** technical datum bridge.
- **`mode = 'bars'`:** Sharp baseline segment paired with a `-45°` hatched delta interval (`beforeFrac -> afterFrac`) capped by a `2.5px` accent cursor.
- **Props:** `title?: string`, `beforeLabel: string`, `beforeValue: number`, `afterLabel: string`, `afterValue: number`, `maxValue?: number`, `prefix?: string`, `unit?: string`, `decimals?: number`, `deltaBadge?: string` (auto-computed when omitted), `mode?: 'rings' | 'bars'`, `beforeColor?: string`, `afterColor?: string`, `startFrame?: number` / `enterFrame?: number` (clamped `>= 2`), `variant?: 'dark' | 'light'`, `safeBox9x16?: boolean`, `style?: React.CSSProperties`.

---

## Design & Editorial Guardrails

1. **Frame `0` Clean Board:** Always keep `startFrame >= 2` (and wrap data acts in `<DataStoryStage2D renderBaseFill={false}>` or kinetic acts in `<OpticalStage2D startFrame={2}>`) so `frame === 0` renders a clean empty `palette.bgCanvas` background, and settled focal planes emit `filter: 'none'` (`< 0.25px` deadzone).
2. **One Focal Metric per Beat & Tonal Discipline:** Pair one `AnimatedMetricCounter` or `MetricComparisonCard` with a concise 2–3 word label instead of dense multi-column tables, let `resolveTonalBarFill` derive bar hierarchy from the active `StylePreset` rather than rainbow color overrides, and leave `ImpactKeywordCard`'s `icon` at its `null` default unless a deliberate symbol is needed.
3. **Polish Sentence Case (`latin-ext`):** In Polish videos, write labels in *Sentence case* (`Czas odpowiedzi serwera`, never `Czas Odpowiedzi Serwera`); `'uppercase'` styles (`brutalist-poster`) transform headings automatically via `formatHeadingText`.
4. **Pair Reveals with `<SoundCue />`:** Trigger a subtle `'pop'`, `'click'`, or `'chime'` `<SoundCue />` on the exact word frame when a statement card, rank overtake, or milestone lands.
