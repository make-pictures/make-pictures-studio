---
name: kit-kinetic-and-data
description: >-
  APIs, 60 FPS spring choreography, and layout rules for @make-pictures/kits/kinetic-typography
  (WordByWordStage, ImpactKeywordCard, AnimatedMetricCounter) and
  @make-pictures/kits/data-storytelling (AnimatedBarRace, TimelineTrack,
  MetricComparisonCard). Use this skill whenever building typographic reels,
  animated KPI counters, ranked bar races, timelines, or before/after metric cards.
---

# Kit: Kinetic Typography & Data Storytelling (`@make-pictures/kits`)

Build punchy, word-synchronized typographic Shorts/Reels and `60 FPS` animated data visualizations with high-damping spring physics (`damping: 200`) and built-in `9:16` Golden Safe Box compliance.

---

## Core Primitives & Imports

```tsx
import {
  WordByWordStage,
  ImpactKeywordCard,
  AnimatedMetricCounter,
} from '@make-pictures/kits/kinetic-typography';

import {
  AnimatedBarRace,
  TimelineTrack,
  MetricComparisonCard,
} from '@make-pictures/kits/data-storytelling';
```

*(All components are also re-exported from `@make-pictures/kits`.)*

---

## 1. Kinetic Typography (`@make-pictures/kits/kinetic-typography`)

### `WordByWordStage`
Rhythmic word and short-phrase spotlight synchronized directly to ElevenLabs alignment data:
- **Props:** `words?: WordTimestamp[]` or `sceneId?: string` (+ optional `voiceoverManifest`), `sceneStartFrame?: number`, `wordsPerBeat?: number` (`3..5`, default `4`), `accentColor?: string`, `variant?: 'dark' | 'light' | 'transparent'`.
- Groups spoken words into natural **3–5 word beats**, highlights the active word with a damped scale pop (`SPRING_PRESETS.snappy`), and respects the **`9:16` Golden Safe Box (`x ∈ [40, 910]`, `y ∈ [220, 1380]`)**.

### `ImpactKeywordCard`
Bold typographic hero badge (*Icon + 2–3 words*) with glowing accent bar and damped spring entrance:
- **Props:** `keyword: string`, `eyebrow?: string`, `sublabel?: string`, `badge?: string`, `icon?: React.ReactNode`, `accentColor?: string`, `variant?: 'dark' | 'light'`, `startFrame?: number` (`>= 2` for clean Frame `0`), `exitFrame?: number`, `safeBox9x16?: boolean`.

### `AnimatedMetricCounter`
Smooth `60 FPS` interpolated numeric/currency/percentage ticker using `tabular-nums`:
- **Props:** `value: number`, `fromValue?: number`, `prefix?: string` (e.g. `'$'`, `'+'`), `suffix?: string` (e.g. `'%'`, `' ms'`, `'×'`), `decimals?: number`, `startFrame?: number` (default `2`), `durationInFrames?: number` (default `54`), `label?: string`, `badge?: string`, `variant?: 'dark' | 'light' | 'inline'`.

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

1. **Frame `0` Clean Board:** Always keep `startFrame >= 2` so `frame === 0` renders a clean empty background.
2. **One Focal Metric per Beat:** Pair one `AnimatedMetricCounter` or `MetricComparisonCard` with a concise 2–3 word label instead of dense multi-column tables.
3. **Polish Sentence Case:** In Polish videos, write labels in *Sentence case* (`Czas odpowiedzi serwera`, never `Czas Odpowiedzi Serwera`).
4. **Pair Reveals with `<SoundCue />`:** Trigger a subtle `'pop'`, `'click'`, or `'chime'` `<SoundCue />` on the exact word frame when a card or metric lands.
