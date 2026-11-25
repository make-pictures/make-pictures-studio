---
name: art-direction-and-styles
description: >-
  Mandatory Step 1 Art Direction Gate, 2-axis DimensionalSpace (2D | 2.5D | 3D) ×
  10 BUILT_IN_STYLES + custom styles/*.style.json matrix, 3 Artistic Worlds
  (atelier, illustrative, editorial-gallery), 1080p typography floor (>= 18 px),
  native StyleLabComposition in npx remotion studio, and raster asset hygiene
  (image --style, cutout, assets clean-scan, assets sheet) for
  @make-pictures/remotion/style and @make-pictures/remotion/style-lab.
---

# Art Direction, Styles & Asset Hygiene (`@make-pictures/remotion/style`)

> **Tandem Skills Contract (`remotion-dev/skills`):** Base Remotion APIs (`<Composition>`, `<Img>`, `spring()`, `interpolate()`, Google Font loading basics, and Remotion Studio controls) are documented in **`remotion-dev/skills`** (`npx remotion skills add`). Use this skill for `make.pictures` visual direction, the 10-style token system, typography/card legibility rules, `StyleLab`, and raster asset cleanup.

---

## 1. Mandatory Step 1 Gate: 2-Axis `DimensionalSpace (2D | 2.5D | 3D) × Style`

> **HARD RULE:** **Never** default blindly to `paper-diorama-3d` or build static `3×2` blinking tile grids (`1 → 2 → 3 → 4`). Before running `npx make-pictures new` or authoring scenes, match the topic, era, emotion, and brand across both axes:
> 1. **Dimensional Space (`'2d' | '2.5d' | '3d'`) & Visual Kit(s)** (you may combine multiple kits across acts via `<ContinuousSceneFlow />` inside one `<StyleProvider>`), and
> 2. **Art Direction Style (`StylePreset`)** — one of the **10 `BUILT_IN_STYLES`** or a bespoke custom preset in `styles/<slug>.style.json`.

### Topic → `DimensionalSpace` + Kit + Style Decision Matrix

| Topic / Genre | Space | Primary Kit(s) (`@make-pictures/remotion/kits/*`) | Recommended Style | Why It Fits |
| :--- | :---: | :--- | :--- | :--- |
| **History, Culture, Culinary, Biography, Museum** | `2.5d` / `2d` | `editorial-collage` (+ `data-storytelling`) | `archival-chronicle` *(or custom era style)* | Parchment, terracotta & old gold, `Playfair Display`, `window-gobo` light, baryta mounts |
| **Journalism, Science, Economics, Video Essays** | `2.5d` / `2d` | `editorial-collage` + `data-storytelling` | `editorial-press` | Warm magazine paper, `Fraunces` + `DM Sans`, `swiss-spatial` hierarchy, calm springs |
| **SaaS Launch, Product Walkthrough, KPI** | `2d` | `vector-scene-2d` + `product-frames` | `minimal-product` or `glass-studio` | Clean `studio-macro` specular surfaces, `Plus Jakarta Sans` + `Inter`, crisp comparisons |
| **Networking, Classic Computing, Dev Explainers** | `2d` | `motion-diagrams-2d` (`RetroPcWindowStage2D`) | `retro-pc` | CRT OS window chrome, phosphor cyan/green accents, `Space Grotesk` + `IBM Plex Mono` |
| **System Architecture, AI, DevOps, Security** | `2d` / `3d` | `motion-diagrams-2d` (+ `kinetic-typography`) | `cyber-telemetry` | Dark engineering blueprint (`isDark: true`), `darkroom-halation` + `optical-gate`, `glass-glow` |
| **High-Retention 9:16 Reels, Manifestos** | `2d` | `kinetic-typography` + `vector-scene-2d` | `brutalist-poster` | Halftone backdrop, `risograph-poster`, uppercase `Syne`, `0px` sharp corners, hard offset shadows |
| **Education, Courses, Math, Concept Breakdowns** | `2d` / `2.5d` | `vector-scene-2d` (+ `motion-diagrams-2d`) | `sketch-notebook` | Graph-paper grid, `Caveat` display + `DM Sans` body, `window-gobo` light |
| **Crafted Stories, Space/History Dioramas** | `2.5d` | `paper-diorama-3d` (+ `tactile-3d`) | `tactile-craft` | Warm `mesh-aura`, die-cut borders (`tactile-cutout`), `Outfit` display, layered parallax |
| **Podcast Studio, Character Dialogue, Warm 3D** | `3d` | `isometric-3d` (`PodcastStudioSet3D` + `ClayCharacter3D`) | `soft-clay` | Sculpted soft-clay hosts with blinking eyes, beveled oak room, `warm-softbox` sync IBL |
| **Spatial 3D Product Showcases, Tech Keynotes** | `3d` / `2d` | `isometric-3d` + `vector-scene-2d` | `glass-studio` | Frosted acrylic glass & anodized metal (`frosted-glass` + `clean-atelier` IBL) |

---

## 2. The 3 Artistic Worlds & 10 `BUILT_IN_STYLES`

Every `StylePreset` belongs to one of 3 **Artistic Worlds** (`resolveArtWorld(style): 'atelier' | 'illustrative' | 'editorial-gallery'`) and declares `resolveStyleSpaces(style)` (`{ preferredSpace, spaces }`) and `resolveStyleMaterial3D(style)`:

| Style ID (`BuiltInStyleId`) | `preferredSpace` (`spaces`) | `ArtWorld` | Display + Body + Mono Fonts | Surface (`backdrop` / `card`) | `material3d` (`finish` / `bevel` / `hdr`) | Default Audio (`music` / `voice`) |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| `minimal-product` | `2d` (`2d, 2.5d`) | `atelier` | `Plus Jakarta Sans` + `Inter` + `JetBrains Mono` | `solid` / `minimal-clean` | `frosted-glass` / `0.10` / `clean-atelier` | `upbeat-launch` / `crisp-tech` |
| `editorial-press` | `2.5d` (`2.5d, 2d`) | `editorial-gallery` | `Fraunces` + `DM Sans` + `IBM Plex Mono` | `editorial-paper` / `editorial-ink` | `matte-ceramic` / `0.06` / `warm-softbox` | `news-pulse` / `calm-editorial` |
| `archival-chronicle` | `2.5d` (`2.5d, 2d`) | `editorial-gallery` | `Playfair Display` + `DM Sans` + `IBM Plex Mono` | `editorial-paper` / `editorial-ink` | `matte-ceramic` / `0.06` / `warm-softbox` | `warm-story` / `documentary-warm` |
| `cyber-telemetry` | `2d` (`2d, 3d`) | `atelier` | `Space Grotesk` + `Inter` + `JetBrains Mono` | `blueprint-grid` / `glass-glow` (`isDark`) | `frosted-glass` / `0.08` / `neon-grid` | `ambient-tech` / `crisp-tech` |
| `brutalist-poster` | `2d` (`2d`) | `editorial-gallery` | `Syne` (`uppercase`) + `Space Grotesk` + `JetBrains Mono` | `halftone-dots` / `brutalist-hard` | `matte-ceramic` / `0.02` / `clean-atelier` | `upbeat-launch` / `storyteller-expressive` |
| `sketch-notebook` | `2d` (`2d, 2.5d`) | `illustrative` | `Caveat` + `DM Sans` + `IBM Plex Mono` | `blueprint-grid` / `editorial-ink` | `soft-clay` / `0.10` / `warm-softbox` | `warm-story` / `storyteller-expressive` |
| `tactile-craft` | `2.5d` (`2.5d`) | `illustrative` | `Outfit` + `Plus Jakarta Sans` + `JetBrains Mono` | `mesh-aura` / `tactile-cutout` | `soft-clay` / `0.14` / `warm-softbox` | `paper-expedition` / `storyteller-expressive` |
| `retro-pc` | `2d` (`2d, 3d`) | `atelier` | `Space Grotesk` + `IBM Plex Mono` + `IBM Plex Mono` | `blueprint-grid` / `brutalist-hard` (`isDark`) | `retro-voxel` / `0.04` / `neon-grid` | `ambient-tech` / `crisp-tech` |
| `soft-clay` | `3d` (`3d`) | `illustrative` | `Outfit` + `Plus Jakarta Sans` + `JetBrains Mono` | `mesh-aura` / `minimal-clean` | `soft-clay` / `0.14` / `warm-softbox` | `warm-story` / `storyteller-expressive` |
| `glass-studio` | `3d` (`3d, 2d`) | `atelier` | `Plus Jakarta Sans` + `Inter` + `JetBrains Mono` | `mesh-aura` / `glass-glow` | `frosted-glass` / `0.10` / `clean-atelier` | `upbeat-launch` / `crisp-tech` |

### Language-Aware Voice Archetypes (`@make-pictures/remotion/audio/voices`)
`VOICE_ARCHETYPE_TO_ELEVENLABS_ID_BY_LANG` pairs styles with **language-native** voices (never English premade voices for Polish!):
- **`pl`:** `crisp-tech` → `Bz1e1clEKwgN71Vx7cxj` (Asia), `calm-editorial` → `F9eb9uZYeJuHuO7Uvs1R` (Arleta), `documentary-warm` → `CLuTGacrAhcIhaJslbXt` (Rafał), `storyteller-expressive` → `C8ZVSJxcymeT86xT429O` (Luiza).
- **`en`:** `crisp-tech` → `TX3LPaxmHKxFdv7VOQHJ` (Liam), `calm-editorial` → `EXAVITQu4vr4xnSDxMaL` (Sarah), `documentary-warm` → `nPczCjzI2devNBz1zQrb` (Brian), `storyteller-expressive` → `JBFqnCBsd6RMkjVDRZzb` (George).

---

## 3. Custom Styles (`styles/*.style.json`) & Native `<StyleLabComposition />`

```bash
npx make-pictures styles [--space=2d|2.5d|3d] [--json]
npx make-pictures style new neapolitan-chronicle --from=archival-chronicle
```

- Custom slugs must match `/^[a-z0-9][a-z0-9-]{0,62}$/` and cannot overwrite any built-in ID (`isBuiltInStyleId`). Always read existing `styles/*.style.json` from disk before editing.
- **Interactive Preview in Native Remotion Studio (`@make-pictures/remotion/style-lab`):** Register `<Composition id="StyleLab" component={StyleLabComposition} schema={StyleLabSchema} defaultProps={DEFAULT_STYLE_LAB_PROPS} ... />` in `src/Root.tsx` and open **`npx remotion studio`** to toggle `space` (`'2d' | '2.5d' | '3d'`), `styleId`, `headline`, `subtitle`, and `accentOverride` live at `60 FPS` (zero top-level `three` import so 2D projects work cleanly).

---

## 4. `StylePresetSchema` & Runtime APIs (`@make-pictures/remotion/style`)

- **Imports:** `StyleProvider`, `StyleBackdrop`, `BUILT_IN_STYLES`, `StylePresetSchema`, `TYPOGRAPHY_FLOOR_1080P`, `resolveStudioStyle`, `resolveArtWorld`, `resolveStyleSpaces`, `filterStylesBySpace`, `resolveStyleMaterial3D`, `resolveStyleOptics`, `deriveDefaultOpticsForSurface`, `withNormalizedStyleOptics`, `interpolateStylePresets`, `registerCustomStyles`, `getCardChromeStyle`, `getStyleSpringConfig`, `formatHeadingText`, `formatFontFamilyCss`, `useStudioStyle`, `useStudioFontsReady`.
  - Pure data/schemas without React: `@make-pictures/remotion/style/presets`.
- **13 `latin-ext` Google Fonts (Full Polish `ą ć ę ł ń ó ś ź ż` Support):** `Inter`, `Plus Jakarta Sans`, `DM Sans`, `Space Grotesk`, `Syne`, `Archivo Black`, `Outfit`, `Fraunces`, `Instrument Serif`, `Playfair Display`, `Caveat`, `JetBrains Mono`, `IBM Plex Mono`. `useStudioFontsReady` holds Remotion `delayRender` and releases cleanly after **`2500 ms`** onto fallback stacks when offline.
- **Motion & Optics:** Default to `cinematic-fluid` / `editorial-calm` (`damping: 200`) and keep **`cameraHandheld <= 0.015`** on presentation/editorial styles. `optics` drives `lightingRig` (`'window-gobo' | 'darkroom-halation' | 'studio-macro'`), `typographyGrammar` (`'swiss-spatial' | 'optical-gate' | 'risograph-poster'`), `lightAngleDeg` (`-60..60`), `aperture` (`0..1`), and `halation` (`0..1`).
- **Liquid Mid-Scene Morphing:** `interpolateStylePresets(fromStyle, toStyle, progress)` smoothly interpolates palette colors, `radiusScale`, `grainOpacity`, `material3d.bevelRadius`, `cameraHandheld`, and `optics` over `48–72` frames with zero hard cuts.
- **Clean Frame `0`:** `<StyleProvider style={props.styleId} renderBackdrop>` renders pure solid `palette.bgCanvas` on `frame <= 0` (`0.00` RGB variance); start entrance springs at `frame - 2`.

---

## 5. 1080p Typography Floor (`TYPOGRAPHY_FLOOR_1080P`) & Card Density

1. **Hard Minimum `fontSize >= 18–19 px` on `1920×1080`:**
   - **Ban `10–14 px` micro-typography:** no tiny eyebrows, `01 | 02 | 03` tab strips, corner stamps, or small disclaimers.
   - **Scale:** Chapter title `52–74 px` (Polish *Sentence case*), Card headline **`26–32 px`** (`2–5` words), Supporting sentence **`19–22 px`** (`6–11` words, readable in `<= 2 s`), Badge/axis/pin **`18–20 px`**, Primary KPI **`64–96 px`** (`fontVariantNumeric: 'tabular-nums'`).
2. **"Headline + 1 Concise Sentence" & Zero Vertical Voids:**
   - Size cards with `height: 'auto'`, `justifyContent: 'center'`, and `boxSizing: 'border-box'` (never stretch sparse text with `justifyContent: 'space-between'`). Use `<HorizontalFeatureGrid2x2 />` for `2×2` summaries, `<EditorialPanoramaTrack />` instead of `3×2` blinking tile grids, and keep primary visuals occupying **`>= 60%`** of their container.

---

## 6. Raster Asset Hygiene (`image`, `cutout`, `assets clean-scan|sheet`)

- **Style-Anchored AI Illustrations (`npx make-pictures image`):**
  ```bash
  npx make-pictures image "<subject>" --style=<styleId> --out=public/images/<slug>/hero.png
  ```
  Automatically prepends the style's `Base Style Anchor` and enforces **strictly zero text, letters, numbers, or signage** inside the raster image.
- **Safe RGBA Cutouts (`npx make-pictures cutout` — NEVER Global White Thresholding!):**
  - **NEVER** apply global brightness thresholding (`rgb > 245 => alpha = 0` or `colorkey=white`) — it punches holes inside silver/white enclosures and highlights.
  - Always run `npx make-pictures cutout <source.pdf|photo.png> --out=public/images/<slug>/subject.png` (extracts native PDF `/SMask` RGBA streams first, else **Exterior Border Flood-Fill** with `detectInteriorAlphaHoles`), and inspect the `#0F172A`/`#1E293B` Dark Checkerboard QA PNG via `read_file`.
- **Archival Scans & Contact Sheet QA:**
  ```bash
  npx make-pictures assets clean-scan raw/plate.png --out=public/images/<slug>/plate-clean.png
  npx make-pictures assets sheet public/images/<slug> --out=out/qa-assets-<slug>.png
  ```
  `clean-scan` removes dark scanner corners/borders via Exterior Perimeter Flood-Fill (protecting interior ink 100%). Inspect the contact sheet with `read_file` and log external sources/licenses in `SOURCES.md`.
