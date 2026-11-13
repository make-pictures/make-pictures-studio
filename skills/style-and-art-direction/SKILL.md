---
name: style-and-art-direction
description: >-
  Mandatory Step 1 Art Direction Gate and Style System guide for make.pictures
  Studio (@make-pictures/core/style, styles/*.style.json, and Studio Web Style
  Lab). Use this skill before scaffolding or designing any film to match topic,
  era, and brand to the 7 Visual Kits and 7 BUILT_IN_STYLES (or a custom
  styles/<slug>.style.json preset), wire <StyleProvider>, useStudioStyle(),
  getCardChromeStyle(), getStyleSpringConfig(), and pair voice archetypes.
---

# Style & Art Direction (`@make-pictures/core/style` & `styles/*.style.json`)

In `make.pictures`, **Visual Scene Technique (`Kit`)** and **Art Direction (`StylePreset`)** are strictly decoupled. Any of the **7 scene kits** (or a multi-kit sequence across acts of one film) automatically inherits color palette, Google Fonts (`latin-ext`), backdrop texture, card chrome geometry, motion spring physics, and default voice/music profiles from the active `<StyleProvider>`.

---

## 1. Mandatory Step 1 Gate: Art Direction Match

> **HARD RULE:** **Never** default blindly to `paper-diorama-3d` or reuse a single look for every video. Before running `npx make-pictures new` or writing scene code, match the user's **topic, era, emotion, audience, and brand** to:
> 1. **One or more of the 7 Visual Kits** (you can combine multiple kits across acts inside a single `<StyleProvider>`!), and
> 2. **One of the 7 `BUILT_IN_STYLES`** — OR a **bespoke custom style** in `styles/<slug>.style.json` created via `npx make-pictures style new <slug> --from=<baseStyleId>`.

Unless the user has already named a specific kit/style, propose **2–3 distinct creative directions** (Kit + Style + Voice/Score mood) tailored to their brief, or select the strongest match from the matrix below when asked to proceed autonomously:

### Topic → Visual Kit + Style Decision Matrix

| Topic / Genre | Primary Kit(s) | Recommended Style (`--style=...`) | Why It Fits |
| :--- | :--- | :--- | :--- |
| **History, Culture, Culinary, Biography, Museum** | `editorial-collage` (+ `data-storytelling` timelines) | `archival-chronicle` *(or custom era `styles/<slug>.style.json`)* | Parchment, terracotta & old gold with `Playfair Display` serif titles, Ken Burns archival frames, and highlighted quotes |
| **Journalism, Science, Economics, Video Essays** | `editorial-collage` + `data-storytelling` | `editorial-press` | Warm magazine paper, crisp `Fraunces` + `DM Sans` editorial hierarchy, ink borders, and calm spring pacing |
| **SaaS Launch, Product Walkthrough, Business KPI** | `vector-scene-2d` + `product-frames` (`BrowserFrame` / `PhoneFrame`) | `minimal-product` *(or brand `styles/<brand>.style.json`)* | Clean light surfaces, `Plus Jakarta Sans` + `Inter`, snappy UI springs, and crisp side-by-side comparisons |
| **System Architecture, AI, DevOps, Cybersecurity** | `motion-diagrams-2d` (+ `kinetic-typography`) | `cyber-telemetry` | Dark engineering blueprint grid (`isDark: true`), frosted `glass-glow` nodes, `Space Grotesk` + `JetBrains Mono` |
| **High-Retention 9:16 Reels, Manifestos, Campaigns** | `kinetic-typography` + `vector-scene-2d` | `brutalist-poster` | Neo-brutalist halftone backdrop, uppercase `Syne`, `0px` sharp corners, and `6px 6px 0` hard offset ink shadows |
| **Education, Courses, Math, Concept Breakdowns** | `vector-scene-2d` (+ `motion-diagrams-2d`) | `sketch-notebook` | Graph-paper notebook grid, handwritten `Caveat` headings, readable `DM Sans` body, and tactile pop springs |
| **Crafted Stories, Travel, Fables, Tactile 2.5D** | `paper-diorama-3d` (on neutral `DioramaStage3D`) | `tactile-craft` | Soft warm `mesh-aura`, `5px` white die-cut borders (`tactile-cutout`), `Outfit` display type, and lively pop-up hinges |
| **Multi-Speaker Podcast, Debate, Studio Q&A** | `isometric-3d` (on neutral `IsometricStage3D`) | `minimal-product` or `cyber-telemetry` | Calm 3D speaker choreography with theme-matched studio plinth, rim accent, and dual-voice dialogue |

---

## 2. Catalog of the 7 `BUILT_IN_STYLES`

Inspect all built-in and workspace styles anytime via `npx make-pictures styles` (or `--json`):

| Style ID (`BuiltInStyleId`) | Display + Body + Mono Fonts | Surface (`backdropType` / `cardTreatment`) | Motion Profile | Default Audio (`musicMood` / `voiceArchetype`) |
| :--- | :--- | :--- | :--- | :--- |
| `minimal-product` | `Plus Jakarta Sans` + `Inter` + `JetBrains Mono` | `solid` / `minimal-clean` (`radiusScale: 1`, light) | `snappy-product` | `upbeat-launch` / `crisp-tech` |
| `editorial-press` | `Fraunces` + `DM Sans` + `IBM Plex Mono` | `editorial-paper` / `editorial-ink` (`radiusScale: 0.45`, grain `0.05`) | `editorial-calm` | `news-pulse` / `calm-editorial` |
| `archival-chronicle` | `Playfair Display` + `DM Sans` + `IBM Plex Mono` | `editorial-paper` / `editorial-ink` (`radiusScale: 0.35`, grain `0.08`) | `cinematic-fluid` | `warm-story` / `documentary-warm` |
| `cyber-telemetry` | `Space Grotesk` + `Inter` + `JetBrains Mono` | `blueprint-grid` / `glass-glow` (`isDark: true`, `radiusScale: 0.85`) | `snappy-product` | `ambient-tech` / `crisp-tech` |
| `brutalist-poster` | `Syne` (`uppercase`) + `Space Grotesk` + `JetBrains Mono` | `halftone-dots` / `brutalist-hard` (`radiusScale: 0`) | `tactile-pop` | `upbeat-launch` / `storyteller-expressive` |
| `sketch-notebook` | `Caveat` + `DM Sans` + `IBM Plex Mono` | `blueprint-grid` / `editorial-ink` (`radiusScale: 0.7`) | `tactile-pop` | `warm-story` / `storyteller-expressive` |
| `tactile-craft` | `Outfit` + `Plus Jakarta Sans` + `JetBrains Mono` | `mesh-aura` / `tactile-cutout` (`radiusScale: 1.35`, grain `0.05`) | `tactile-pop` | `paper-expedition` / `storyteller-expressive` |

### Voice Archetype Mapping (`VOICE_ARCHETYPE_TO_ELEVENLABS_ID`)

When scaffolding `npx make-pictures new <slug> --style=<styleId>`, `production.json` automatically inherits `score.moodPreset = style.audioDefaults.musicMood` and maps `style.audioDefaults.voiceArchetype` to a dedicated multilingual ElevenLabs voice (unless overridden with `--voice=<voiceId>`):

```ts
export const VOICE_ARCHETYPE_TO_ELEVENLABS_ID: Record<VoiceArchetype, string> = {
  'crisp-tech': 'TX3LPaxmHKxFdv7VOQHJ',            // Liam — energetic product & tech narrator
  'calm-editorial': 'EXAVITQu4vr4xnSDxMaL',        // Sarah / River — measured magazine & science anchor
  'documentary-warm': 'nPczCjzI2devNBz1zQrb',      // Brian — warm historical & documentary authority
  'storyteller-expressive': 'JBFqnCBsd6RMkjVDRZzb', // George / Alice — expressive storyteller
};
```

---

## 3. Custom Brand & Era Styles (`styles/<slug>.style.json` & 🎨 Style Lab)

Whenever a film has a distinctive brand palette or historical setting (e.g., *Neapolitan Pizza*, *1969 Apollo Telemetry*, *Fintech Brand*), create a reusable workspace style in `styles/<slug>.style.json`:

```bash
# 1. List available built-in styles, custom styles, and 7 visual kits
npx make-pictures styles

# 2. Scaffold a custom style from the closest built-in preset
npx make-pictures style new neapolitan-chronicle --from=archival-chronicle

# 3. Scaffold a production capsule bound to your custom style
npx make-pictures new historia-pizzy --kit=editorial-collage --style=neapolitan-chronicle --lang=pl
```

- **Auto-discovery everywhere:** Every `styles/*.style.json` file is validated with `StylePresetSchema` and automatically registered via `registerCustomStyles(...)` in **Studio Web**, `npx make-pictures qa`, and `npx make-pictures render`.
- **Reserved IDs & Slug Rules:** Custom style slugs must match `/^[a-z0-9][a-z0-9-]{0,62}$/` and cannot overwrite any of the 7 built-in IDs (`isBuiltInStyleId`).
- **Studio Web `🎨 Style Lab` (`http://127.0.0.1:3000?view=styles`):** Creators can preview all 7 built-in styles and `styles/*.style.json` live at `60 FPS` across every kit (`16:9` and `9:16`), tweak colors/fonts/radii/motion in `PropsInspector`, and save directly to `styles/<slug>.style.json` (`Cmd/Ctrl+S`). **Always read existing `styles/*.style.json` from disk before editing** so you preserve human tweaks made in Style Lab!

---

## 4. `StylePresetSchema` Reference

Every `StylePreset` conforms to `StylePresetSchema` (`@make-pictures/core/style` and `@make-pictures/core`):

- **`id` / `name` / `description` / `recommendedFor`:** Slug identifier, display title, art direction summary, and topic tags.
- **`palette`:** `bgCanvas`, `bgSurface`, `bgElevated`, `textPrimary`, `textSecondary`, `accentPrimary`, `accentSecondary`, `inkBorder` (CSS HEX `#RRGGBB` or `rgba(...)` / `hsla(...)`).
- **`typography`:**
  - `displayFont`, `bodyFont`, `monoFont` — validated against `StyleFontFamilySchema` (all **13 Google Fonts** support full **`latin-ext` Polish diacritics** `ą ć ę ł ń ó ś ź ż`):
    `'Inter' | 'Plus Jakarta Sans' | 'DM Sans' | 'Space Grotesk' | 'Syne' | 'Archivo Black' | 'Outfit' | 'Fraunces' | 'Instrument Serif' | 'Playfair Display' | 'Caveat' | 'JetBrains Mono' | 'IBM Plex Mono'`.
  - `headingCase`: `'sentence' | 'uppercase'` (use `formatHeadingText(text, style)` — in Polish, always author source copy in *Sentence case*, letting `'uppercase'` styles transform via `toLocaleUpperCase('pl-PL')`).
  - `displayTrackingEm`: `-0.05 .. 0.12`.
- **`surface`:**
  - `backdropType`: `'solid' | 'editorial-paper' | 'blueprint-grid' | 'mesh-aura' | 'halftone-dots' | 'dark-vignette'`
  - `cardTreatment`: `'minimal-clean' | 'editorial-ink' | 'brutalist-hard' | 'glass-glow' | 'tactile-cutout'`
  - `radiusScale`: `0 .. 2` (`0` = sharp `0px` corners, `1` = `22px` standard radius, `1.35+` = soft rounded cards)
  - `grainOpacity`: `0 .. 0.18`
  - `isDark`: `boolean`
- **`motion`:**
  - `profile`: `'editorial-calm' | 'snappy-product' | 'tactile-pop' | 'cinematic-fluid'`
  - `cameraHandheld`: `0 .. 0.35`
- **`audioDefaults`:**
  - `musicMood`: `'ambient-tech' | 'warm-story' | 'upbeat-launch' | 'news-pulse' | 'paper-expedition' | 'cinematic-drone' | 'cinematic-epic'`
  - `voiceArchetype`: `'crisp-tech' | 'calm-editorial' | 'documentary-warm' | 'storyteller-expressive'`

---

## 5. Runtime Integration (`<StyleProvider>` & Style Hooks)

Wrap every composition in `<StyleProvider style={props.styleId} renderBackdrop>` and expose `styleId` in your composition's `zod` schema so `styleId` can be switched live in **Studio Web**:

```tsx
import React from 'react';
import { z } from 'zod';
import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  StyleProvider,
  formatFontFamilyCss,
  formatHeadingText,
  getCardChromeStyle,
  getStyleSpringConfig,
  useStudioStyle,
} from '@make-pictures/core';
import { ChapterTitleCard } from '@make-pictures/kits/editorial-collage';
import { AnimatedBarRace } from '@make-pictures/kits/data-storytelling';

export const FilmSchema = z.object({
  styleId: z.string().describe('Kolory & Styl :: Styl bazowy (Style ID)'),
  headline: z.string().describe('Teksty & Napisy :: Nagłówek'),
});

const CustomSummaryBadge: React.FC<{ label: string }> = ({ label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = useStudioStyle();

  // Frame 0 Clean Invariant: entrance starts at frame - 2
  const enter = spring({
    frame: frame - 2,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });

  return (
    <div
      style={getCardChromeStyle(style, {
        padding: '24px 32px',
        opacity: enter,
        fontFamily: formatFontFamilyCss(style.typography.displayFont, 'display'),
      })}
    >
      {formatHeadingText(label, style)}
    </div>
  );
};

export const MyFilm: React.FC<z.infer<typeof FilmSchema>> = ({ styleId, headline }) => (
  <AbsoluteFill>
    <StyleProvider style={styleId} renderBackdrop>
      {/* Multi-kit act composition sharing one cohesive StylePreset */}
      <Sequence from={0} durationInFrames={180}>
        <ChapterTitleCard chapterLabel="Akt I" title={headline} />
      </Sequence>
      <Sequence from={180} durationInFrames={240}>
        <AnimatedBarRace
          title="Wzrost udziału"
          items={[
            { id: 'a', label: 'Wariant A', value: 84 },
            { id: 'b', label: 'Wariant B', value: 52 },
          ]}
        />
      </Sequence>
      <Sequence from={420} durationInFrames={180}>
        <CustomSummaryBadge label={headline} />
      </Sequence>
    </StyleProvider>
  </AbsoluteFill>
);
```

### Key Runtime Guarantees
1. **Clean Frame `0` in `<StyleBackdrop />`:** When `renderBackdrop` is `true` (for 2D/editorial compositions; omit `renderBackdrop` or place `<ThreeCanvas>` above it for full-bleed 3D stages), `frame <= 0` renders a pure solid `palette.bgCanvas` background with zero pattern/text artifacts.
2. **Offline Render Safety (`2500 ms` timeout):** `useStyleFontsReady(style)` injects the exact Google Fonts CSS2 stylesheet for `displayFont`, `bodyFont`, and `monoFont` and holds Remotion `delayRender` until fonts settle — releasing cleanly after **`2500 ms`** onto CSS fallback stacks (`Georgia, serif`, system sans, `ui-monospace`) if rendering offline.
3. **Graceful Unknown Style Fallback:** `resolveStudioStyle(styleOrId)` resolves registered custom styles first, then `BUILT_IN_STYLES`, and falls back safely to `BUILT_IN_STYLES['minimal-product']` if a slug is missing.
