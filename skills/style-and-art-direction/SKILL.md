---
name: style-and-art-direction
description: >-
  Mandatory Step 1 Art Direction Gate, 2-axis DimensionalSpace (2D | 2.5D | 3D) ×
  10 Built-in Styles + Custom styles/*.style.json matrix, 3 Artistic Worlds
  (atelier, illustrative, editorial-gallery), and 3D Material/HDR system for
  make.pictures Studio (@make-pictures/core/style and Studio Web Style Lab).
  Use this skill before scaffolding or designing any film to match topic, era,
  and brand across DimensionalSpace ('2d' | '2.5d' | '3d'), the 7 Visual Kits,
  and 10 BUILT_IN_STYLES (including retro-pc, soft-clay, glass-studio) or custom
  styles/<slug>.style.json, wire <StyleProvider>, resolveStyleSpaces(),
  resolveStyleMaterial3D(), filterStylesBySpace(), resolveArtWorld(),
  interpolateStylePresets(), and pair voice archetypes.
---

# Style & Art Direction (`@make-pictures/core/style` & `styles/*.style.json`)

In `make.pictures`, Art Direction is organized on a **two-axis matrix: `DimensionalSpace ('2d' | '2.5d' | '3d') × StylePreset`** (spanning **10 built-in styles** plus unlimited custom **`styles/*.style.json`** presets across **3 Artistic Worlds** `'atelier' | 'illustrative' | 'editorial-gallery'`). Any of the **7 scene kits** (or a multi-kit sequence across acts of one film) automatically inherits multi-plane scenic backdrops (`<ScenicBackdropLayers />`), color palette, Google Fonts (`latin-ext`), card chrome geometry (`<ClippedSurfaceChrome />`), directional 2.5D optical lighting (`optics`), 3D physical material & offline studio HDR lighting (`material3d`), motion spring physics, and default voice/music profiles from the active `<StyleProvider>`.

---

## 1. Mandatory Step 1 Gate: 2-Axis `DimensionalSpace (2D | 2.5D | 3D) × Style` Match

> **HARD RULE:** **Never** default blindly to `paper-diorama-3d` or reuse a single look for every video. Before running `npx make-pictures new` or writing scene code, match the user's **topic, era, emotion, audience, and brand** across both axes:
> 1. **Dimensional Space (`DimensionalSpace`: `'2d' | '2.5d' | '3d'`) & Visual Kit(s):** Pick the primary dimensional space (`--space=2d|2.5d|3d`) or combine multiple kits across acts inside `<ContinuousSceneFlow />`, and
> 2. **Art Direction Style (`StylePreset`):** Choose one of the **10 `BUILT_IN_STYLES`** — OR create a **bespoke custom style** in `styles/<slug>.style.json` via `npx make-pictures style new <slug> --from=<baseStyleId>` (which can target a single space like `spaces: ['3d']` or span all three `spaces: ['2d', '2.5d', '3d']`).

Unless the user has already named a specific space/kit/style, propose **2–3 distinct creative directions** (`Space + Kit + Style + Voice/Score mood`) tailored to their brief, or select the strongest match from the matrix below when asked to proceed autonomously:

### Topic → `DimensionalSpace` + Visual Kit + Style Decision Matrix

| Topic / Genre | Space (`--space`) | Primary Kit(s) | Recommended Style (`--style=...`) | Why It Fits |
| :--- | :---: | :--- | :--- | :--- |
| **History, Culture, Culinary, Biography, Museum** | `2.5d` / `2d` | `editorial-collage` (+ `data-storytelling` timelines) | `archival-chronicle` *(or custom era `styles/<slug>.style.json`)* | Parchment, terracotta & old gold with `Playfair Display` serif titles, `window-gobo` light, photo-corner baryta mounts, and ink-brush quote sweeps |
| **Journalism, Science, Economics, Video Essays** | `2.5d` / `2d` | `editorial-collage` + `data-storytelling` | `editorial-press` | Warm magazine paper, `window-gobo` directional lighting, crisp `Fraunces` + `DM Sans` `swiss-spatial` hierarchy, ink borders, and calm spring pacing |
| **SaaS Launch, Product Walkthrough, Business KPI** | `2d` | `vector-scene-2d` + `product-frames` (`BrowserFrame` / `PhoneFrame`) | `minimal-product` or `glass-studio` *(or brand `styles/<brand>.style.json`)* | Clean `studio-macro` specular surfaces, `Plus Jakarta Sans` + `Inter`, snappy UI springs, and crisp side-by-side comparisons |
| **Networking, Classic Computing, Developer Explainers** | `2d` | `motion-diagrams-2d` (`RetroPcWindowStage2D`) | `retro-pc` | Late-80s/90s CRT OS window chrome, phosphor cyan/green accents (`#38BDF8` / `#4ADE80`), `Space Grotesk` + `IBM Plex Mono`, and crisp packet hop tracks |
| **System Architecture, AI, DevOps, Cybersecurity** | `2d` / `3d` | `motion-diagrams-2d` (+ `kinetic-typography`) | `cyber-telemetry` | Dark engineering blueprint grid (`isDark: true`), `darkroom-halation` + `optical-gate` reticle choreography, frosted `glass-glow` nodes, `Space Grotesk` + `JetBrains Mono` |
| **High-Retention 9:16 Reels, Manifestos, Campaigns** | `2d` | `kinetic-typography` + `vector-scene-2d` | `brutalist-poster` | Neo-brutalist halftone backdrop, `risograph-poster` cut blocks, uppercase `Syne`, `0px` sharp corners, and hard offset ink shadows |
| **Education, Courses, Math, Concept Breakdowns** | `2d` / `2.5d` | `vector-scene-2d` (+ `motion-diagrams-2d`) | `sketch-notebook` | Graph-paper notebook grid, handwritten `Caveat` headings, readable `DM Sans` body, `window-gobo` light, and tactile pop springs |
| **Crafted Stories, Space/History Dioramas, Tactile 2.5D** | `2.5d` | `paper-diorama-3d` (on `DioramaStage3D`) | `tactile-craft` | Soft warm `mesh-aura`, cream die-cut borders (`tactile-cutout`), `Outfit` display type, layered parallax cutouts, and lively pop-up hinges |
| **Podcast Studio, Expressive Character Dialogue, Warm 3D** | `3d` | `isometric-3d` (`PodcastStudioSet3D` + `ClayCharacter3D` + `StudioHdrRig3D`) | `soft-clay` | Sculpted soft-clay vinyl-toy characters with 3D blinking eyes & headphones, beveled oak studio room, `warm-softbox` offline IBL, and warm storytelling cadence |
| **Spatial 3D Product Showcases, Modern Tech Keynotes** | `3d` / `2d` | `isometric-3d` + `vector-scene-2d` | `glass-studio` | Frosted acrylic glass & anodized metal (`frosted-glass` + `clean-atelier` HDR), pearl-indigo palette, and fluid spatial motion |

---

## 2. The 3 Artistic Worlds (`ArtWorld`) & Catalog of the 10 `BUILT_IN_STYLES`

Every `StylePreset` belongs to one of three **Artistic Worlds** (`resolveArtWorld(style): ArtWorld`) and declares its supported **Dimensional Spaces** (`resolveStyleSpaces(style)` -> `{ preferredSpace, spaces }`) plus **3D Material Profile** (`resolveStyleMaterial3D(style)`):
1. **`'atelier'`** *(Apple / Linear studio aesthetic — acrylic glass, anodized metal, CRT/blueprint precision & architectural cyclorama)*: `minimal-product`, `cyber-telemetry`, `retro-pc`, `glass-studio`.
2. **`'illustrative'`** *(Kurzgesagt / Blender Soft-Clay aesthetic — warm multi-plane parallax hills, sculpted soft-clay characters & tactile die-cut craft)*: `tactile-craft`, `sketch-notebook`, `soft-clay`.
3. **`'editorial-gallery'`** *(Pentagram / NYT Magazine / Vox gallery aesthetic — monumental display typography, passe-partout framing, cotton paper & warm window shadow cast)*: `editorial-press`, `archival-chronicle`, `brutalist-poster`.

Inspect all 10 built-in and workspace styles (optionally filtered by dimensional space) via `npx make-pictures styles [--space=2d|2.5d|3d]` (or `--json`):

| Style ID (`BuiltInStyleId`) | `preferredSpace` / `spaces` | `ArtWorld` | Display + Body + Mono Fonts | Surface (`backdropType` / `cardTreatment`) | `material3d` (`finish` / `bevelRadius` / `studioHdr`) | Default Audio (`musicMood` / `voiceArchetype`) |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| `minimal-product` | `2d` (`['2d', '2.5d']`) | `atelier` | `Plus Jakarta Sans` + `Inter` + `JetBrains Mono` | `solid` / `minimal-clean` (`radiusScale: 1`) | `frosted-glass` / `0.10` / `clean-atelier` | `upbeat-launch` / `crisp-tech` |
| `editorial-press` | `2.5d` (`['2.5d', '2d']`) | `editorial-gallery` | `Fraunces` + `DM Sans` + `IBM Plex Mono` | `editorial-paper` / `editorial-ink` (`radiusScale: 0.45`) | `matte-ceramic` / `0.06` / `warm-softbox` | `news-pulse` / `calm-editorial` |
| `archival-chronicle` | `2.5d` (`['2.5d', '2d']`) | `editorial-gallery` | `Playfair Display` + `DM Sans` + `IBM Plex Mono` | `editorial-paper` / `editorial-ink` (`radiusScale: 0.35`) | `matte-ceramic` / `0.06` / `warm-softbox` | `warm-story` / `documentary-warm` |
| `cyber-telemetry` | `2d` (`['2d', '3d']`) | `atelier` | `Space Grotesk` + `Inter` + `JetBrains Mono` | `blueprint-grid` / `glass-glow` (`isDark: true`) | `frosted-glass` / `0.08` / `neon-grid` | `ambient-tech` / `crisp-tech` |
| `brutalist-poster` | `2d` (`['2d']`) | `editorial-gallery` | `Syne` (`uppercase`) + `Space Grotesk` + `JetBrains Mono` | `halftone-dots` / `brutalist-hard` (`radiusScale: 0`) | `matte-ceramic` / `0.02` / `clean-atelier` | `upbeat-launch` / `storyteller-expressive` |
| `sketch-notebook` | `2d` (`['2d', '2.5d']`) | `illustrative` | `Caveat` + `DM Sans` + `IBM Plex Mono` | `blueprint-grid` / `editorial-ink` (`radiusScale: 0.7`) | `soft-clay` / `0.10` / `warm-softbox` | `warm-story` / `storyteller-expressive` |
| `tactile-craft` | `2.5d` (`['2.5d']`) | `illustrative` | `Outfit` + `Plus Jakarta Sans` + `JetBrains Mono` | `mesh-aura` / `tactile-cutout` (`radiusScale: 1.35`) | `soft-clay` / `0.14` / `warm-softbox` | `paper-expedition` / `storyteller-expressive` |
| `retro-pc` | `2d` (`['2d', '3d']`) | `atelier` | `Space Grotesk` + `IBM Plex Mono` + `IBM Plex Mono` | `blueprint-grid` / `brutalist-hard` (`isDark: true`, `radiusScale: 0.25`) | `retro-voxel` / `0.04` / `neon-grid` | `ambient-tech` / `crisp-tech` |
| `soft-clay` | `3d` (`['3d']`) | `illustrative` | `Outfit` + `Plus Jakarta Sans` + `JetBrains Mono` | `mesh-aura` / `minimal-clean` (`radiusScale: 1.45`) | `soft-clay` / `0.14` / `warm-softbox` | `warm-story` / `storyteller-expressive` |
| `glass-studio` | `3d` (`['3d', '2d']`) | `atelier` | `Plus Jakarta Sans` + `Inter` + `JetBrains Mono` | `mesh-aura` / `glass-glow` (`radiusScale: 1.25`) | `frosted-glass` / `0.10` / `clean-atelier` | `upbeat-launch` / `crisp-tech` |

### Language-Aware Voice Archetype Mapping (`VOICE_ARCHETYPE_TO_ELEVENLABS_ID_BY_LANG`)

When scaffolding `npx make-pictures new <slug> --style=<styleId> --lang=pl|en`, `production.json` automatically inherits `score.moodPreset = style.audioDefaults.musicMood` and maps `style.audioDefaults.voiceArchetype` to a **language-native** ElevenLabs voice (unless overridden with `--voice=<voiceId>`). **Never use English premade voices (`Liam`, `Sarah`, `Brian`, `George`) for Polish scripts** — use `npx make-pictures voices --lang=pl` to browse more native voices from the user's account or ElevenLabs Voice Library:

```ts
export const VOICE_ARCHETYPE_TO_ELEVENLABS_ID_BY_LANG = {
  pl: {
    'crisp-tech': 'Bz1e1clEKwgN71Vx7cxj',             // Asia — native PL female (product & tech)
    'calm-editorial': 'F9eb9uZYeJuHuO7Uvs1R',         // Arleta — native PL female (calm editorial / instructor)
    'documentary-warm': 'CLuTGacrAhcIhaJslbXt',       // Rafał — native PL male (analytical / documentary)
    'storyteller-expressive': 'C8ZVSJxcymeT86xT429O', // Luiza — native PL female (warm teacher & storyteller)
  },
  en: {
    'crisp-tech': 'TX3LPaxmHKxFdv7VOQHJ',             // Liam — native EN male (product & tech)
    'calm-editorial': 'EXAVITQu4vr4xnSDxMaL',         // Sarah — native EN female (magazine & science)
    'documentary-warm': 'nPczCjzI2devNBz1zQrb',       // Brian — native EN male (documentary)
    'storyteller-expressive': 'JBFqnCBsd6RMkjVDRZzb', // George — native EN male (storyteller)
  },
};
```

---

## 3. Custom Brand & Era Styles (`styles/<slug>.style.json` & 🎨 Style Lab)

Whenever a film has a distinctive brand palette or historical setting (e.g., *Neapolitan Pizza*, *1969 Apollo Telemetry*, *Fintech Brand*), create a reusable workspace style in `styles/<slug>.style.json`:

```bash
# 1. List all 10 built-in styles, custom styles, and 7 visual kits (or filter by 2d | 2.5d | 3d)
npx make-pictures styles
npx make-pictures styles --space=3d

# 2. Scaffold a custom style from the closest built-in preset (supports single-space or cross-space presets!)
npx make-pictures style new neapolitan-chronicle --from=archival-chronicle
npx make-pictures style new brand-clay --from=soft-clay

# 3. Scaffold a production capsule bound to a space and/or custom style
npx make-pictures new historia-pizzy --kit=editorial-collage --style=neapolitan-chronicle --lang=pl
npx make-pictures new studio-rozmowa --space=3d --style=brand-clay --lang=pl
```

- **Auto-discovery & Legacy Migration:** Every `styles/*.style.json` file is validated with `StylePresetSchema` and automatically normalized with `withNormalizedStyleOptics(...)` via `registerCustomStyles(...)` in **Studio Web**, `npx make-pictures qa`, and `npx make-pictures render` — legacy JSON files without `optics`, `preferredSpace`, `spaces`, or `material3d` remain 100% valid and resolve coherent defaults via `resolveStyleOptics`, `resolveStyleSpaces`, and `resolveStyleMaterial3D`.
- **Reserved IDs & Slug Rules:** Custom style slugs must match `/^[a-z0-9][a-z0-9-]{0,62}$/` and cannot overwrite any of the 10 built-in IDs (`isBuiltInStyleId`).
- **Studio Web `🎨 Style Lab` (`http://127.0.0.1:3000?view=styles`):** Creators can filter styles by `[ Wszystkie ] [ 2D ] [ 2.5D ] [ 3D ]` in the `⌘K` Style Picker, switch preview spaces via `[ 2D ] [ 2.5D ] [ 3D ]` in the top bar across every kit (`16:9` and `9:16`), tweak colors, fonts, radii, `material3d` (`finish`, `bevelRadius`, `studioHdr`), motion, and **`Optyka & Światło`** in `PropsInspector` (preserving the exact 7 Polish inspector sections), and save directly to `styles/<slug>.style.json` (`Cmd/Ctrl+S`). **Always read existing `styles/*.style.json` from disk before editing** so you preserve human tweaks made in Style Lab!

---

## 4. `StylePresetSchema` Reference

Every `StylePreset` conforms to `StylePresetSchema` (`@make-pictures/core/style` and `@make-pictures/core` — kept as a plain `z.object` with 7 Polish inspector sections so `introspectZodObject` renders live Studio Web controls):

- **`id` / `name` / `description` / `recommendedFor` / `artWorld` / `preferredSpace` / `spaces` (`Informacje`):**
  - Slug identifier, display title, art direction summary, topic tags, optional `artWorld?: 'atelier' | 'illustrative' | 'editorial-gallery'` (`resolveArtWorld(style)`), and optional two-axis dimensional metadata:
    - `preferredSpace?: DimensionalSpace` (`'2d' | '2.5d' | '3d'`, `'Informacje :: Domyślna przestrzeń (2D / 2.5D / 3D)'`)
    - `spaces?: DimensionalSpace[]` (`'Informacje :: Obsługiwane przestrzenie'`)
  - Helpers: `resolveStyleSpaces(style)` returns `{ preferredSpace, spaces }`; `filterStylesBySpace(styles, space)` filters built-in and custom presets supporting `'2d' | '2.5d' | '3d'`.
- **`interpolateStylePresets(fromStyle, toStyle, progress): StylePreset`:** Continuous `60 FPS` cubic smoothstep interpolation (`48–72` frames) across all 8 `palette` colors, `surface` (`radiusScale`, `grainOpacity`), `material3d.bevelRadius` (`0..0.25`), `motion.cameraHandheld`, and `optics` (`lightAngleDeg`, `aperture`, `halation`), cleanly switching discrete enums (`typography`, `lightingRig`, `artWorld`, `preferredSpace`, `spaces`, `material3d.finish`, `material3d.studioHdr`, `isDark`) at `t >= 0.5`.
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
- **`material3d?: StyleMaterial3D`** (`StyleMaterial3DSchema.optional()` — merged into Inspector section **`Powierzchnia & Tło`**, resolved via `resolveStyleMaterial3D(style)`):
  - `finish`: `'soft-clay' | 'frosted-glass' | 'retro-voxel' | 'matte-ceramic'` (`'Powierzchnia & Tło :: Materiał brył 3D'`)
  - `bevelRadius`: `0 .. 0.25` (`'Powierzchnia & Tło :: Zaokrąglenie krawędzi 3D (0–0.25)'`)
  - `studioHdr`: `'warm-softbox' | 'clean-atelier' | 'neon-grid'` (`'Powierzchnia & Tło :: Oświetlenie studyjne HDR 3D'` — offline procedural `<Environment><Lightformer /></Environment>`, zero external `.hdr` network fetches)
- **`motion`:**
  - `profile`: `'editorial-calm' | 'snappy-product' | 'tactile-pop' | 'cinematic-fluid'` (default to **`cinematic-fluid`** or **`editorial-calm`** with `damping: 200` for product presentations, explainers, and essays)
  - `cameraHandheld`: `0 .. 0.35` — keep **`cameraHandheld <= 0.015`** across all presentation and editorial styles (`minimal-product`, `editorial-press`, `archival-chronicle`, `cyber-telemetry`, `retro-pc`, `glass-studio`) so cards and typography never wobble.
- **`optics?: StyleOptics`** (`StyleOpticsSchema.optional()` — Inspector section **`Optyka & Światło`**):
  - `lightingRig`: `'window-gobo' | 'darkroom-halation' | 'studio-macro'` (`StyleLightingRigSchema`) — drives `<StageLightingRig />` and default `EditorialMediaCard` mount selection.
  - `typographyGrammar`: `'swiss-spatial' | 'optical-gate' | 'risograph-poster'` (`StyleTypographyGrammarSchema`) — selects the kinetic choreography and counter meter grammar in `@make-pictures/kits/kinetic-typography`.
  - `lightAngleDeg`: `-60 .. 60` — key-light incidence angle in degrees (`0°` = top-down, negative = top-left casting shadows toward bottom-right, positive = top-right casting shadows toward bottom-left).
  - `aperture`: `0 .. 1` — shallow depth-of-field / Circle-of-Confusion blur intensity outside the active `focalZ` plane (`< 0.25px` deadzone emits `filter: 'none'`).
  - `halation`: `0 .. 1` — highlight bloom, darkroom lightbox glow, and `optical-gate` chromatic dispersion intensity.
  - **Normalization & Migration Helpers (`@make-pictures/core` / `@make-pictures/core/style`):**
    - `resolveStyleOptics(style: StylePreset): StyleOptics` — returns `style.optics ?? deriveDefaultOpticsForSurface(style.surface)`. Always call `resolveStyleOptics(style)` when reading optics in scene or kit components.
    - `deriveDefaultOpticsForSurface(surface: StylePreset['surface']): StyleOptics` — deterministically derives surface-coherent optical defaults when `optics` is omitted (`isDark` → `darkroom-halation / optical-gate`; `halftone-dots` or `brutalist-hard` / `tactile-cutout` → `window-gobo / risograph-poster`; `editorial-paper` / `editorial-ink` → `window-gobo / swiss-spatial`; otherwise → `studio-macro / swiss-spatial`).
- **`audioDefaults`:**
  - `musicMood`: `'ambient-tech' | 'warm-story' | 'upbeat-launch' | 'news-pulse' | 'paper-expedition' | 'cinematic-drone' | 'cinematic-epic'`
  - `voiceArchetype`: `'crisp-tech' | 'calm-editorial' | 'documentary-warm' | 'storyteller-expressive'`

---

## 4B. 1080p Typography Floor (`TYPOGRAPHY_FLOOR_1080P`), Card Density & Enumeration Rules

1. **Hard Minimum `fontSize >= 18–19 px` on `1920×1080` (`TYPOGRAPHY_FLOOR_1080P`):**
   - Video is not a zoomable web page: every visible text node on a `1080p` canvas must render at **`>= 18–19 px`**.
   - **Strictly ban `10–14 px` micro-typography:** no tiny `11–13 px` eyebrows, no decorative `01 | 02 | 03` tab strips, no `PLATE 03 • REV B` corner stamps, and no small footer disclaimers.
   - Recommended scale (`TYPOGRAPHY_FLOOR_1080P` in `@make-pictures/core`):
     - Chapter / Opening Title: `52–74 px` (`700` / `1.08–1.14`, Polish *Sentence case*)
     - Card Headline (`StoryCard2D` / `ComparisonSplit2D`): **`26–32 px`** (`650–700`, `2–5` words)
     - Supporting Card Sentence: **`19–22 px`** (`450–500`, `6–11` words, readable in `<= 2 s`)
     - Badge / Axis / Pin Label: **`18–20 px`** (`600`, never `< 18 px`!)
     - Primary KPI Metric: **`64–96 px`** (`700`, mandatory `fontVariantNumeric: 'tabular-nums'`)
2. **"Headline + 1 Concise Sentence" & Zero `space-between` Voids:**
   - Avoid both empty one-word buzzwords (*"Wydajność"*) and 3-line gray paragraphs. Pair a **`26–32 px` headline (`2–5` words)** with **one concrete `19–22 px` sentence (`6–11` words)**.
   - Size cards with `height: 'auto'`, `justifyContent: 'center'`, and `boxSizing: 'border-box'` (`getCardChromeStyle` sets `border-box` automatically) — never stretch sparse text across tall containers with `justifyContent: 'space-between'`. Use `<HorizontalFeatureGrid2x2 />` for `2×2` horizontal medallion summaries, and ensure primary visuals occupy **`>= 60%`** of their container.
3. **Ban `3×2` Blinking Tile Grids & Anchor AI Illustrations (`--style`):**
   - Never visualize 4–6 categories as a static `3×2` grid lighting up `1 → 2 → 3 → 4`. Use `<EditorialPanoramaTrack />` (`DirectorCamera2D` + Ken Burns), layered editorial collage, or a spatial cross-section.
   - When generating AI illustrations (`npx make-pictures image "<subject>" --style=<styleId> --out=...`), always anchor every asset to the active `StylePreset` (`buildStyledImagePrompt`) with **strictly zero text, letters, numbers, or signage** inside the raster image.

---

## 5. Runtime Integration (`<StyleProvider>`, `<ContinuousSceneFlow>`, `<ScenicBackdropLayers>` & `<ClippedSurfaceChrome>`)

Wrap every composition in `<StyleProvider style={props.styleId} renderBackdrop>`, compose calm `>= 270`-frame (`>= 4.5 s`) scenes via `<ContinuousSceneFlow />`, and wrap any internal bars/sheens on `overflow: 'visible'` cards inside `<ClippedSurfaceChrome />` (enforced by the hard `npx make-pictures qa` Director Gate):

```tsx
import React from 'react';
import { z } from 'zod';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  BUILT_IN_STYLES,
  CINEMATIC_SPRINGS,
  ClippedSurfaceChrome,
  ContinuousSceneFlow,
  ScenicBackdropLayers,
  StyleProvider,
  formatFontFamilyCss,
  formatHeadingText,
  getTactileSurfaceStyle,
  interpolateStylePresets,
  resolveStyleOptics,
  useStudioStyle,
} from '@make-pictures/core';
import { ChapterTitleCard, EditorialDeskStage } from '@make-pictures/kits/editorial-collage';
import { AnimatedBarRace } from '@make-pictures/kits/data-storytelling';

export const FilmSchema = z.object({
  styleId: z.string().describe('Kolory & Styl :: Styl bazowy (Style ID)'),
  headline: z.string().describe('Teksty & Napisy :: Nagłówek'),
});

const CustomSummaryBadge: React.FC<{ label: string }> = ({ label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = useStudioStyle();
  const optics = resolveStyleOptics(style);

  // Frame 0 Clean Invariant: entrance starts at frame - 2 on CINEMATIC_SPRINGS.entrance
  const enter = spring({
    frame: frame - 2,
    fps,
    config: CINEMATIC_SPRINGS.entrance,
  });

  return (
    <div
      data-lighting-rig={optics.lightingRig}
      style={getTactileSurfaceStyle(style, {
        elevation: 'lifted',
        overrides: {
          position: 'relative',
          overflow: 'visible',
          padding: '24px 32px',
          opacity: enter,
          fontFamily: formatFontFamilyCss(style.typography.displayFont, 'display'),
        },
      })}
    >
      <ClippedSurfaceChrome topBarHeight={3} topBarColor={style.palette.accentPrimary} specularRim />
      {formatHeadingText(label, style)}
    </div>
  );
};

export const MyFilm: React.FC<z.infer<typeof FilmSchema>> = ({ styleId, headline }) => {
  const frame = useCurrentFrame();
  const morphT = interpolate(frame, [300, 360], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const activeStyle = interpolateStylePresets(
    BUILT_IN_STYLES[styleId as keyof typeof BUILT_IN_STYLES] ?? BUILT_IN_STYLES['editorial-press'],
    BUILT_IN_STYLES['minimal-product'],
    morphT
  );

  return (
    <AbsoluteFill>
      <StyleProvider style={activeStyle} renderBackdrop>
        <ScenicBackdropLayers />
        {/* Calm >= 4.5s (>= 270f) scenes connected via 54-frame optical cross-dissolve */}
        <ContinuousSceneFlow
          crossDissolveFrames={54}
          scenes={[
            {
              id: 'scene-1-editorial',
              durationInFrames: 360,
              render: () => (
                <EditorialDeskStage renderBaseFill={false}>
                  <ChapterTitleCard chapterLabel="Akt I" title={headline} />
                </EditorialDeskStage>
              ),
            },
            {
              id: 'scene-2-data',
              durationInFrames: 360,
              render: () => (
                <AnimatedBarRace
                  title="Wzrost udziału"
                  items={[
                    { id: 'a', label: 'Wariant A', value: 84 },
                    { id: 'b', label: 'Wariant B', value: 52 },
                  ]}
                />
              ),
            },
            {
              id: 'scene-3-summary',
              durationInFrames: 300,
              render: () => <CustomSummaryBadge label={headline} />,
            },
          ]}
        />
      </StyleProvider>
    </AbsoluteFill>
  );
};
```

### Key Runtime Guarantees
1. **Clean Frame `0` in `<StyleBackdrop />`, `<StageLightingRig />` & `<ScenicBackdropLayers />`:** When `renderBackdrop` is `true` (for 2D/editorial compositions; omit `renderBackdrop` or place `<ThreeCanvas>` above it for full-bleed 3D stages), `frame <= 0` renders a pure solid `palette.bgCanvas` background (`verifyCleanFrameZeroImage` in `npx make-pictures qa` checks max RGB spread `<= 6`).
2. **Corner Clipping & Pacing QA Gate:** `npx make-pictures qa` enforces `>= 270f` (`4.5 s`) scene spans, `<= 2.8 words/s`, single focal point, zero choppy wipes, and `<ClippedSurfaceChrome />` on `overflow: 'visible'` rounded cards.
3. **Offline Render Safety (`2500 ms` timeout):** `useStyleFontsReady(style)` injects the exact Google Fonts CSS2 stylesheet for `displayFont`, `bodyFont`, and `monoFont` and holds Remotion `delayRender` until fonts settle — releasing cleanly after **`2500 ms`** onto CSS fallback stacks (`Georgia, serif`, system sans, `ui-monospace`) if rendering offline.
4. **Graceful Unknown & Legacy Style Fallback:** `resolveStudioStyle(styleOrId)` resolves registered custom styles first, then `BUILT_IN_STYLES`, normalizes `optics` via `withNormalizedStyleOptics`, and falls back safely to `BUILT_IN_STYLES['minimal-product']` if a slug is missing.
