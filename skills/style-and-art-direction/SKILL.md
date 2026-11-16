---
name: style-and-art-direction
description: >-
  Mandatory Step 1 Art Direction Gate, 3 Artistic Worlds (atelier, illustrative,
  editorial-gallery), and Style System guide for make.pictures Studio
  (@make-pictures/core/style, styles/*.style.json, and Studio Web Style Lab).
  Use this skill before scaffolding or designing any film to match topic, era,
  and brand to the 7 Visual Kits and 7 BUILT_IN_STYLES (or custom
  styles/<slug>.style.json), wire <StyleProvider>, resolveArtWorld(),
  interpolateStylePresets(), <ScenicBackdropLayers>, <ClippedSurfaceChrome>,
  resolveStyleOptics(), getTactileSurfaceStyle(), and pair voice archetypes.
---

# Style & Art Direction (`@make-pictures/core/style` & `styles/*.style.json`)

In `make.pictures`, **Visual Scene Technique (`Kit`)** and **Art Direction (`StylePreset`)** are strictly decoupled across **3 Artistic Worlds (`ArtWorld`: `'atelier' | 'illustrative' | 'editorial-gallery'`)**. Any of the **7 scene kits** (or a multi-kit sequence across acts of one film) automatically inherits multi-plane scenic backdrops (`<ScenicBackdropLayers />`), color palette, Google Fonts (`latin-ext`), card chrome geometry (`<ClippedSurfaceChrome />`), directional 2.5D optical lighting & kinetic typography grammar (`optics`), motion spring physics, and default voice/music profiles from the active `<StyleProvider>`.

---

## 1. Mandatory Step 1 Gate: Art Direction Match

> **HARD RULE:** **Never** default blindly to `paper-diorama-3d` or reuse a single look for every video. Before running `npx make-pictures new` or writing scene code, match the user's **topic, era, emotion, audience, and brand** to:
> 1. **One or more of the 7 Visual Kits** (you can combine multiple kits across acts inside a single `<StyleProvider>`!), and
> 2. **One of the 7 `BUILT_IN_STYLES`** — OR a **bespoke custom style** in `styles/<slug>.style.json` created via `npx make-pictures style new <slug> --from=<baseStyleId>`.

Unless the user has already named a specific kit/style, propose **2–3 distinct creative directions** (Kit + Style + Voice/Score mood) tailored to their brief, or select the strongest match from the matrix below when asked to proceed autonomously:

### Topic → Visual Kit + Style Decision Matrix

| Topic / Genre | Primary Kit(s) | Recommended Style (`--style=...`) | Why It Fits |
| :--- | :--- | :--- | :--- |
| **History, Culture, Culinary, Biography, Museum** | `editorial-collage` (+ `data-storytelling` timelines) | `archival-chronicle` *(or custom era `styles/<slug>.style.json`)* | Parchment, terracotta & old gold with `Playfair Display` serif titles, `window-gobo` light, photo-corner baryta mounts, and ink-brush quote sweeps |
| **Journalism, Science, Economics, Video Essays** | `editorial-collage` + `data-storytelling` | `editorial-press` | Warm magazine paper, `window-gobo` directional lighting, crisp `Fraunces` + `DM Sans` `swiss-spatial` hierarchy, ink borders, and calm spring pacing |
| **SaaS Launch, Product Walkthrough, Business KPI** | `vector-scene-2d` + `product-frames` (`BrowserFrame` / `PhoneFrame`) | `minimal-product` *(or brand `styles/<brand>.style.json`)* | Clean `studio-macro` specular surfaces, `Plus Jakarta Sans` + `Inter`, snappy UI springs, and crisp side-by-side comparisons |
| **System Architecture, AI, DevOps, Cybersecurity** | `motion-diagrams-2d` (+ `kinetic-typography`) | `cyber-telemetry` | Dark engineering blueprint grid (`isDark: true`), `darkroom-halation` + `optical-gate` reticle choreography, frosted `glass-glow` nodes, `Space Grotesk` + `JetBrains Mono` |
| **High-Retention 9:16 Reels, Manifestos, Campaigns** | `kinetic-typography` + `vector-scene-2d` | `brutalist-poster` | Neo-brutalist halftone backdrop, `risograph-poster` cut blocks, uppercase `Syne`, `0px` sharp corners, and hard offset ink shadows |
| **Education, Courses, Math, Concept Breakdowns** | `vector-scene-2d` (+ `motion-diagrams-2d`) | `sketch-notebook` | Graph-paper notebook grid, handwritten `Caveat` headings, readable `DM Sans` body, `window-gobo` light, and tactile pop springs |
| **Crafted Stories, Travel, Fables, Tactile 2.5D** | `paper-diorama-3d` (on neutral `DioramaStage3D`) | `tactile-craft` | Soft warm `mesh-aura`, `5px` white die-cut borders (`tactile-cutout`), `Outfit` display type, and lively pop-up hinges |
| **Multi-Speaker Podcast, Debate, Studio Q&A** | `isometric-3d` (on neutral `IsometricStage3D`) | `minimal-product` or `cyber-telemetry` | Calm 3D speaker choreography with theme-matched studio plinth, rim accent, and dual-voice dialogue |

---

## 2. The 3 Artistic Worlds (`ArtWorld`) & Catalog of the 7 `BUILT_IN_STYLES`

Every `StylePreset` belongs to one of three distinct **Artistic Worlds** (`resolveArtWorld(style): ArtWorld` from `@make-pictures/core`), which drives `<ScenicBackdropLayers />`, 2.5D diorama motifs, and 3D studio room architecture:
1. **`'atelier'`** *(Apple / Linear studio aesthetic — acrylic glass, anodized metal, architectural studio cyclorama, floor reflection pool & subtle optical caustics)*: `minimal-product`, `cyber-telemetry`.
2. **`'illustrative'`** *(Kurzgesagt / Buck painterly aesthetic — warm multi-plane parallax hills, organic clouds, celestial sun/moon disc & tactile die-cut craft)*: `tactile-craft`, `sketch-notebook`.
3. **`'editorial-gallery'`** *(Pentagram / NYT Magazine / Vox gallery aesthetic — monumental display typography, passe-partout framing, cotton paper & warm window shadow cast)*: `editorial-press`, `archival-chronicle`, `brutalist-poster`.

Inspect all built-in and workspace styles anytime via `npx make-pictures styles` (or `--json`):

| Style ID (`BuiltInStyleId`) | `ArtWorld` | Display + Body + Mono Fonts | Surface (`backdropType` / `cardTreatment`) | Motion Profile | Optics (lightingRig / typographyGrammar) | Default Audio (`musicMood` / `voiceArchetype`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `minimal-product` | `atelier` | `Plus Jakarta Sans` + `Inter` + `JetBrains Mono` | `solid` (`#F1F5F9` canvas / `#FFFFFF` surface) / `minimal-clean` (`radiusScale: 1`, light) | `snappy-product` | `studio-macro / swiss-spatial` (`-20°`, aperture `0.36`, halation `0.08`) | `upbeat-launch` / `crisp-tech` |
| `editorial-press` | `editorial-gallery` | `Fraunces` + `DM Sans` + `IBM Plex Mono` | `editorial-paper` / `editorial-ink` (`radiusScale: 0.45`, grain `0.05`) | `editorial-calm` | `window-gobo / swiss-spatial` (`-28°`, aperture `0.45`, halation `0.16`) | `news-pulse` / `calm-editorial` |
| `archival-chronicle` | `editorial-gallery` | `Playfair Display` + `DM Sans` + `IBM Plex Mono` | `editorial-paper` / `editorial-ink` (`radiusScale: 0.35`, grain `0.08`) | `cinematic-fluid` | `window-gobo / swiss-spatial` (`-34°`, aperture `0.54`, halation `0.26`) | `warm-story` / `documentary-warm` |
| `cyber-telemetry` | `atelier` | `Space Grotesk` + `Inter` + `JetBrains Mono` | `blueprint-grid` / `glass-glow` (`isDark: true`, `radiusScale: 0.85`) | `snappy-product` | `darkroom-halation / optical-gate` (`-24°`, aperture `0.50`, halation `0.58`) | `ambient-tech` / `crisp-tech` |
| `brutalist-poster` | `editorial-gallery` | `Syne` (`uppercase`) + `Space Grotesk` + `JetBrains Mono` | `halftone-dots` / `brutalist-hard` (`radiusScale: 0`) | `tactile-pop` | `darkroom-halation / risograph-poster` (`-38°`, aperture `0.32`, halation `0.28`) | `upbeat-launch` / `storyteller-expressive` |
| `sketch-notebook` | `illustrative` | `Caveat` + `DM Sans` + `IBM Plex Mono` | `blueprint-grid` / `editorial-ink` (`radiusScale: 0.7`) | `tactile-pop` | `window-gobo / risograph-poster` (`-26°`, aperture `0.38`, halation `0.12`) | `warm-story` / `storyteller-expressive` |
| `tactile-craft` | `illustrative` | `Outfit` + `Plus Jakarta Sans` + `JetBrains Mono` | `mesh-aura` / `tactile-cutout` (`radiusScale: 1.35`, grain `0.05`) | `tactile-pop` | `window-gobo / risograph-poster` (`-30°`, aperture `0.48`, halation `0.20`) | `paper-expedition` / `storyteller-expressive` |

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

- **Auto-discovery & Legacy Migration:** Every `styles/*.style.json` file is validated with `StylePresetSchema` and automatically normalized with `withNormalizedStyleOptics(...)` via `registerCustomStyles(...)` in **Studio Web**, `npx make-pictures qa`, and `npx make-pictures render` — legacy JSON files without an `optics` key remain 100% valid and receive surface-matched optical defaults via `deriveDefaultOpticsForSurface(style.surface)`.
- **Reserved IDs & Slug Rules:** Custom style slugs must match `/^[a-z0-9][a-z0-9-]{0,62}$/` and cannot overwrite any of the 7 built-in IDs (`isBuiltInStyleId`).
- **Studio Web `🎨 Style Lab` (`http://127.0.0.1:3000?view=styles`):** Creators can preview all 7 built-in styles and `styles/*.style.json` live at `60 FPS` across every kit (`16:9` and `9:16`), tweak colors, fonts, radii, motion, and **`Optyka & Światło`** (`lightingRig`, `typographyGrammar`, `lightAngleDeg`, `aperture`, `halation`) in `PropsInspector`, and save directly to `styles/<slug>.style.json` (`Cmd/Ctrl+S`). **Always read existing `styles/*.style.json` from disk before editing** so you preserve human tweaks made in Style Lab!

---

## 4. `StylePresetSchema` Reference

Every `StylePreset` conforms to `StylePresetSchema` (`@make-pictures/core/style` and `@make-pictures/core` — kept as a plain `z.object` so `introspectZodObject` renders live Studio Web controls):

- **`id` / `name` / `description` / `recommendedFor` / `artWorld`:** Slug identifier, display title, art direction summary, topic tags, and optional `artWorld?: 'atelier' | 'illustrative' | 'editorial-gallery'` (`'Informacje :: Świat artystyczny'`, resolved safely with `resolveArtWorld(style)`).
- **`interpolateStylePresets(fromStyle, toStyle, progress): StylePreset`:** Continuous `60 FPS` cubic smoothstep interpolation (`48–72` frames) across all 8 `palette` colors, `surface` (`radiusScale`, `grainOpacity`), `motion.cameraHandheld`, and `optics` (`lightAngleDeg`, `aperture`, `halation`), cleanly switching discrete enums (`typography`, `lightingRig`, `artWorld`, `isDark`) at `t >= 0.5` — allowing an entire scene to transform seamlessly from sunlit glass (`minimal-product`) into studio obsidian (`cyber-telemetry`) without a single hard cut.
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
