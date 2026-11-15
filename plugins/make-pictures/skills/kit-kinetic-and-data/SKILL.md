---
name: kit-kinetic-and-data
description: >-
  APIs, polymorphic 3-grammar film typography (swiss-spatial, optical-gate,
  risograph-poster), Vernier/Risograph counters, 60 FPS spring choreography,
  and 9:16 Golden Safe Box layout rules for @make-pictures/kits/kinetic-typography
  (WordByWordStage, ImpactKeywordCard, AnimatedMetricCounter) and
  @make-pictures/kits/data-storytelling (AnimatedBarRace, TimelineTrack,
  MetricComparisonCard). Use whenever building typographic reels, animated KPI
  counters, ranked bar races, timelines, or before/after metric cards.
---

# Kit: Kinetic Typography & Data Storytelling (`@make-pictures/kits`)

Build punchy, word-synchronized film typography Shorts/Reels and `60 FPS` animated data visualizations with high-damping spring physics (`damping: 200`), optical depth, and built-in `9:16` Golden Safe Box compliance.

---

## Core Primitives & Imports

```tsx
import {
  DepthPlane,
  OpticalStage2D,
  StageLightingRig,
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
  AnimatedBarRace,
  TimelineTrack,
  MetricComparisonCard,
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

### `AnimatedBarRace`
Crisp `60 FPS` ranked bar chart supporting live rank overtaking:
- **Props:** `items: BarRaceItem[]` (`{ id, label, value, keyframes?: { frame, value }[], color?, badge?, icon? }`), `orientation?: 'horizontal' | 'vertical'`, `title?: string`, `subtitle?: string`, `valuePrefix?: string`, `valueSuffix?: string`, `decimals?: number`, `maxItems?: number`, `startFrame?: number`.
- Keep visible series concise (**4–6 ranked items max**) so labels stay large and scannable on mobile.

### `TimelineTrack`
Interactive milestone progression rail highlighting the active era or step at `frame`:
- **Props:** `milestones: TimelineMilestone[]` (`{ id, label, era?, fromFrame?, detail?, color? }`), `orientation?: 'horizontal' | 'vertical'`, `accentColor?: string`, `startFrame?: number`, `variant?: 'dark' | 'light'`, `safeBox9x16?: boolean`.
- Sync milestone `fromFrame` values directly to spoken years/steps via `getWordTriggerFrame`.

### `MetricComparisonCard`
Before/After or A/B visual delta card with animated progress rings or bars:
- **Props:** `title?: string`, `beforeLabel: string`, `beforeValue: number`, `afterLabel: string`, `afterValue: number`, `prefix?: string`, `unit?: string`, `decimals?: number`, `deltaBadge?: string` (auto-computed when omitted), `mode?: 'rings' | 'bars'`, `startFrame?: number`, `variant?: 'dark' | 'light'`, `safeBox9x16?: boolean`.

---

## Design & Editorial Guardrails

1. **Frame `0` Clean Board:** Always keep `startFrame >= 2` (and `<OpticalStage2D startFrame={2}>`) so `frame === 0` renders a clean empty `palette.bgCanvas` background.
2. **One Focal Metric per Beat & Zero Icon Slop:** Pair one `AnimatedMetricCounter` or `MetricComparisonCard` with a concise 2–3 word label instead of dense multi-column tables, and leave `ImpactKeywordCard`'s `icon` at its `null` default unless a deliberate symbol is needed.
3. **Polish Sentence Case (`latin-ext`):** In Polish videos, write labels in *Sentence case* (`Czas odpowiedzi serwera`, never `Czas Odpowiedzi Serwera`); `'uppercase'` styles (`brutalist-poster`) transform headings automatically via `formatHeadingText`.
4. **Pair Reveals with `<SoundCue />`:** Trigger a subtle `'pop'`, `'click'`, or `'chime'` `<SoundCue />` on the exact word frame when a statement card or metric lands.
