# Dimensional Spaces (`2D / 2.5D / 3D × Style`), Soft-Clay IBL 3D & Product Showreel v5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce the two-axis `DimensionalSpace ('2d' | '2.5d' | '3d') × StylePreset` system across `@make-pictures/core`, `@make-pictures/studio`, and `@make-pictures/cli` (10 built-in styles + unlimited custom `styles/*.style.json`), replace raw 3D primitives with procedural offline IBL (`StudioHdrRig3D`), beveled `RoundedBox` rooms (`PodcastStudioSet3D`), and expressive 3D-eyed `<ClayCharacter3D>`, add `RetroPcWindowStage2D` and `Apollo 11` 2.5D cutout motifs, and ship the `39.0s` (`2340f @ 60 FPS`) `Prompt → Rzeczywisty Efekt` Showreel v5 in Polish and English (`16:9` + `9:16`, `-14 LUFS`).

**Architecture:** `StylePresetSchema` gains optional `preferredSpace`, `spaces`, and `material3d` fields inside existing Polish inspector sections (`Informacje` and `Powierzchnia & Tło`) so backwards compatibility with user `styles/*.style.json` and the 7-section Studio Inspector contract remains 100% intact, while adding 3 flagship built-in styles (`retro-pc`, `soft-clay`, `glass-studio`). `@make-pictures/kits` adds offline GPU IBL (`<Environment resolution={256} frames={1}><Lightformer /></Environment>` + `<ContactShadows />`), `<ClayCharacter3D>`, `<PodcastStudioSet3D>`, `<RetroPcWindowStage2D>`, and 4 cosmic/lunar cutout motifs. `productions/make-pictures-showreel/` composes 5 continuous scenes (`300 + 570 + 570 + 570 + 330 = 2340f`) via `<ContinuousSceneFlow crossDissolveFrames={42} />`, demonstrating three real `Prompt → Effect` workflows (`2D Retro-PC`, `2.5D Wycinanka Apollo 11`, `3D Soft-Clay Podcast`).

**Tech Stack:** TypeScript, React 18, Remotion 4 (`60 FPS`), Three.js + `@react-three/fiber` + `@react-three/drei` (`RoundedBox`, `Environment`, `Lightformer`, `ContactShadows`), Zod, ElevenLabs TTS/Music/SFX CLI, FFmpeg (`ebur128` / `loudnorm` `-14 LUFS`), Node `tsx --test`.

## Global Constraints

- **Clean Frame `0`:** Frame `0` of every composition and preview MUST render a pure uniform `bgCanvas` backdrop (`maxChannelStdDev < 2.0`), starting entrances at `frame - 2`.
- **Determinism (`--concurrency=100%`):** Zero `Math.random()` and zero cross-frame mutable `useRef` accumulation in Remotion compositions or kits; use `createSeededRandom(seed)`.
- **Offline Network & Infrastructure Safety:** Zero external network fetches at render time (never use `<Environment preset="..." />`; use `<Environment resolution={256} frames={1}><Lightformer ... /></Environment>`). In `Scene2RetroPc2D` and `RetroPcWindowStage2D`, use 100% symbolic/fictional labels (`twoja-strona.pl`, `example.app`) — NEVER private/router/DNS IP addresses or live network calls. Never read or print `.env` or `.env.local`.
- **Inspector Section Invariant:** `introspectZodObject(StylePresetSchema)` MUST return the exact 7 Polish section titles: `['Informacje', 'Paleta kolorów', 'Typografia', 'Powierzchnia & Tło', 'Fizyka ruchu', 'Optyka & Światło', 'Domyślne Audio']`.
- **WebGL Context Budget & Hard Director QA Gate:** At most `1` `<ThreeCanvas>` mounted on any frame (`usesThree: true` on 3D scenes in `<ContinuousSceneFlow>`). Every top-level scene in Showreel v5 MUST be `>= 300` frames (`> 270f` minimum) and pass `npx make-pictures qa` WITHOUT `--allow-fast-cuts`.
- **`9:16` Golden Safe Box & Typography:** All primary cards, prompts, and subjects in `1080×1920` compositions MUST stay inside `x ∈ [40, 910], y ∈ [220, 1380]`. Polish copy uses *Sentence case* (`latin-ext`), never Title Case.
- **Natural Brand & Style Phonetics in TTS:** Polish TTS MUST say **`mejk pikczers`** (NOT `mejk kropka pikczers`) and **`retro pi si`** (NOT `retro pe ce`); English TTS MUST say **`make pictures`** and **`retro pee see`**. Zero raw digits or uppercase acronyms in `production.json` `scenes[].text`.

---

### Task 1: Two-Axis `DimensionalSpace × StylePreset` Schema & 10 Built-In Styles (`@make-pictures/core`)

**Files:**
- Modify: `packages/core/src/style/schema.ts`
- Modify: `packages/core/src/style/presets.ts`
- Modify: `packages/core/src/style/interpolate.ts`
- Modify: `packages/cli/tests/style-core.test.ts`
- Modify: `packages/cli/tests/studio-player-and-schema.test.ts`

**Interfaces:**
- Produces in `@make-pictures/core`:
  - `DimensionalSpaceSchema = z.enum(['2d', '2.5d', '3d'])`, `export type DimensionalSpace = '2d' | '2.5d' | '3d'`
  - `StyleMaterial3DFinishSchema = z.enum(['soft-clay', 'frosted-glass', 'retro-voxel', 'matte-ceramic'])`, `export type StyleMaterial3DFinish`
  - `StyleStudioHdrPresetSchema = z.enum(['warm-softbox', 'clean-atelier', 'neon-grid'])`, `export type StyleStudioHdrPreset`
  - `StyleMaterial3DSchema`, `export type StyleMaterial3D = { finish: StyleMaterial3DFinish; bevelRadius: number; studioHdr: StyleStudioHdrPreset }`
  - `BUILT_IN_STYLE_IDS` (10 IDs including `'retro-pc'`, `'soft-clay'`, `'glass-studio'`)
  - `resolveStyleSpaces(style: StylePreset): { preferredSpace: DimensionalSpace; spaces: DimensionalSpace[] }`
  - `resolveStyleMaterial3D(style: StylePreset): StyleMaterial3D`
  - `filterStylesBySpace(styles: ReadonlyArray<StylePreset>, space: DimensionalSpace): StylePreset[]`

- [ ] **Step 1: Write failing tests in `packages/cli/tests/style-core.test.ts` and `packages/cli/tests/studio-player-and-schema.test.ts`**

Update `packages/cli/tests/style-core.test.ts` to assert `BUILT_IN_STYLE_IDS.length === 10` (including `'retro-pc'`, `'soft-clay'`, `'glass-studio'`), test `resolveStyleSpaces`, `resolveStyleMaterial3D`, and `filterStylesBySpace` across built-in and custom presets (including cross-space custom presets `spaces: ['2d', '2.5d', '3d']`), and verify `studio-player-and-schema.test.ts` still asserts exact 7 Polish section titles on `StylePresetSchema`:

```ts
import {
  BUILT_IN_STYLE_IDS,
  BUILT_IN_STYLES,
  StylePresetSchema,
  filterStylesBySpace,
  resolveStyleMaterial3D,
  resolveStyleSpaces,
} from '@make-pictures/core';

test('exposes 10 built-in styles across 2d, 2.5d, and 3d spaces', () => {
  assert.equal(BUILT_IN_STYLE_IDS.length, 10);
  for (const id of ['retro-pc', 'soft-clay', 'glass-studio'] as const) {
    assert.ok(BUILT_IN_STYLES[id], `Missing built-in style ${id}`);
    assert.equal(StylePresetSchema.safeParse(BUILT_IN_STYLES[id]).success, true);
  }
  const stylesAll = BUILT_IN_STYLE_IDS.map((id) => BUILT_IN_STYLES[id]);
  assert.ok(filterStylesBySpace(stylesAll, '2d').some((s) => s.id === 'retro-pc'));
  assert.ok(filterStylesBySpace(stylesAll, '2.5d').some((s) => s.id === 'tactile-craft'));
  assert.ok(filterStylesBySpace(stylesAll, '3d').some((s) => s.id === 'soft-clay'));
  assert.ok(filterStylesBySpace(stylesAll, '3d').some((s) => s.id === 'glass-studio'));
  assert.equal(resolveStyleMaterial3D(BUILT_IN_STYLES['soft-clay']).finish, 'soft-clay');
  assert.equal(resolveStyleSpaces(BUILT_IN_STYLES['soft-clay']).preferredSpace, '3d');
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx tsx --test packages/cli/tests/style-core.test.ts packages/cli/tests/studio-player-and-schema.test.ts`
Expected: FAIL (`filterStylesBySpace is not a function` / `7 !== 10`).

- [ ] **Step 3: Implement schema, helpers, interpolation & 10 built-in presets**

In `packages/core/src/style/schema.ts`:
- Add `DIMENSIONAL_SPACES = ['2d', '2.5d', '3d'] as const`, `DimensionalSpaceSchema = z.enum(DIMENSIONAL_SPACES)`, `export type DimensionalSpace`.
- Add `StyleMaterial3DFinishSchema`, `StyleStudioHdrPresetSchema`, and `StyleMaterial3DSchema` where every field uses `.describe('Powierzchnia & Tło :: ...')`:
  - `finish`: `'Powierzchnia & Tło :: Materiał brył 3D'`
  - `bevelRadius`: `z.number().min(0).max(0.25).describe('Powierzchnia & Tło :: Zaokrąglenie krawędzi 3D (0–0.25)')`
  - `studioHdr`: `'Powierzchnia & Tło :: Oświetlenie studyjne HDR 3D'`
- On `StylePresetSchema`:
  - Under `Informacje`: `preferredSpace: DimensionalSpaceSchema.optional().describe('Informacje :: Domyślna przestrzeń (2D / 2.5D / 3D)')` and `spaces: z.array(DimensionalSpaceSchema).optional().describe('Informacje :: Obsługiwane przestrzenie')`.
  - Optional top-level `material3d: StyleMaterial3DSchema.optional()` right after `surface` (mirroring `optics: StyleOpticsSchema.optional()`, so `introspectZodObject(StylePresetSchema)` merges its fields into `'Powierzchnia & Tło'` and preserves the exact 7 section titles!).
- Implement `resolveStyleSpaces(style)`, `resolveStyleMaterial3D(style)`, `filterStylesBySpace(styles, space)`, and update `resolveArtWorld` so `'soft-clay'` & `'tactile-craft'` & `'sketch-notebook'` map to `'illustrative'`, `'glass-studio'` & `'minimal-product'` & `'cyber-telemetry'` & `'retro-pc'` map to `'atelier'`, and `'editorial-press'` & `'archival-chronicle'` & `'brutalist-poster'` map to `'editorial-gallery'`.
- In `packages/core/src/style/presets.ts`: populate explicit `preferredSpace`, `spaces`, and `material3d` on all 7 existing presets per Spec Table 1.2, and add the 3 new rich presets:
  1. `'retro-pc'` (`preferredSpace: '2d'`, `spaces: ['2d', '3d']`, warm phosphor/CRT dark slate `#0C141C`, surface `#13202C`, elevated `#1D3142`, primary `#38BDF8` / phosphor `#4ADE80`, `Space Grotesk` + `IBM Plex Mono`, `material3d: { finish: 'retro-voxel', bevelRadius: 0.04, studioHdr: 'neon-grid' }`),
  2. `'soft-clay'` (`preferredSpace: '3d'`, `spaces: ['3d']`, warm studio cream `#F6EFE6`, surface `#FFFDF9`, elevated `#FDE6D2`, primary `#EA580C`, secondary `#0D9488`, `Outfit` + `Plus Jakarta Sans`, `radiusScale: 1.45`, `material3d: { finish: 'soft-clay', bevelRadius: 0.14, studioHdr: 'warm-softbox' }`),
  3. `'glass-studio'` (`preferredSpace: '3d'`, `spaces: ['3d', '2d']`, cool spatial pearl `#EEF2FF`, surface `#FFFFFF`, elevated `#E0E7FF`, primary `#4F46E5`, secondary `#06B6D4`, `Plus Jakarta Sans` + `Inter`, `cardTreatment: 'glass-glow'`, `radiusScale: 1.25`, `material3d: { finish: 'frosted-glass', bevelRadius: 0.1, studioHdr: 'clean-atelier' }`).
- In `packages/core/src/style/interpolate.ts`: preserve `preferredSpace`, `spaces`, and interpolate `material3d.bevelRadius` smoothly across `[0, 0.25]` while switching `finish` and `studioHdr` at `useTo`.

- [ ] **Step 4: Build `@make-pictures/core` and run tests**

Run: `npm run build --workspace=@make-pictures/core && npx tsx --test packages/cli/tests/style-core.test.ts packages/cli/tests/studio-player-and-schema.test.ts packages/cli/tests/director-dna-core.test.ts`
Expected: PASS (`0` failures).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/style/schema.ts packages/core/src/style/presets.ts packages/core/src/style/interpolate.ts packages/cli/tests/style-core.test.ts packages/cli/tests/studio-player-and-schema.test.ts
git commit -m "feat(core): add 2D/2.5D/3D DimensionalSpace matrix, material3d schema, and 10 built-in styles"
```

---

### Task 2: `2D | 2.5D | 3D` Selector in Studio Web, `--space` CLI Flags & Canonical Skills

**Files:**
- Modify: `packages/studio/src/client/components/ProjectPickerPopover.tsx`
- Modify: `packages/studio/src/client/components/StyleLabShowcase.tsx`
- Modify: `packages/cli/src/commands/styles.ts`
- Modify: `packages/cli/src/commands/new-production.ts`
- Modify: `packages/cli/src/index.ts`
- Modify: `plugins/make-pictures/skills/style-and-art-direction/SKILL.md`
- Modify: `plugins/make-pictures/skills/make-pictures-director/SKILL.md`
- Modify: `plugins/make-pictures/skills/sound-and-music-design/SKILL.md`
- Modify: `packages/cli/tests/styles-cli-and-studio-api.test.ts`

**Interfaces:**
- Consumes from Task 1: `DimensionalSpace`, `DimensionalSpaceSchema`, `BUILT_IN_STYLE_IDS` (10), `resolveStyleSpaces`, `resolveStyleMaterial3D`, `filterStylesBySpace`.
- Produces:
  - `runStylesListCommand({ cwd?, dir?, json?, space?: DimensionalSpace })`
  - `defaultKitAndStyleForSpace(space: DimensionalSpace): { kit: ScaffoldKitId; styleId: BuiltInStyleId }` (`'2d'` -> `'motion-diagrams-2d'` + `'minimal-product'`, `'2.5d'` -> `'paper-diorama-3d'` + `'tactile-craft'`, `'3d'` -> `'isometric-3d'` + `'soft-clay'`)
  - `NewProductionOptions.space?: DimensionalSpace` (`npx make-pictures new <slug> --space=2d|2.5d|3d`)
  - `[ Wszystkie ] [ 2D ] [ 2.5D ] [ 3D ]` filter tabs in `ProjectPickerPopover` (`viewMode === 'styles'`) + `[ 2D ] [ 2.5D ] [ 3D ]` space selector pills in `StyleLabShowcase.tsx` top bar.

- [ ] **Step 1: Add failing CLI & Studio tests in `packages/cli/tests/styles-cli-and-studio-api.test.ts`**

Add tests verifying:
1. `runStylesListCommand({ space: '3d', json: true })` filters `builtInStyles` to 3D-compatible styles (`soft-clay`, `glass-studio`, `retro-pc`, `cyber-telemetry`) while preserving custom styles matching that space.
2. `runNewProductionCommand({ slug: 'clay-demo', space: '3d', ... })` defaults to `kit: 'isometric-3d'` and `styleId: 'soft-clay'`, and `--space=2.5d` defaults to `kit: 'paper-diorama-3d'` + `styleId: 'tactile-craft'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test packages/cli/tests/styles-cli-and-studio-api.test.ts`
Expected: FAIL (`space` option not yet implemented).

- [ ] **Step 3: Implement CLI `--space`, Studio Web `2D | 2.5D | 3D` UI, and Skills**

1. **CLI (`packages/cli/src/commands/styles.ts`, `new-production.ts`, `index.ts`):**
   - Update `runStylesListCommand` to accept `space?: DimensionalSpace`, filter `builtInStyles` and `customStyles` via `filterStylesBySpace` when `space` is provided, and group console output clearly by `2D`, `2.5D`, and `3D` (`10` built-in styles total).
   - Export `defaultKitAndStyleForSpace(space: DimensionalSpace)` in `new-production.ts` and support `space?: DimensionalSpace` in `NewProductionOptions` (`options.kit ?? (options.space ? defaultKitAndStyleForSpace(options.space).kit : 'vector-scene-2d')`, `options.style ?? (options.space ? defaultKitAndStyleForSpace(options.space).styleId : 'minimal-product')`).
   - Wire `--space` in `packages/cli/src/index.ts` for `styles`, `new`, and `init`, validating `'2d' | '2.5d' | '3d'`.
2. **Studio Web (`ProjectPickerPopover.tsx` & `StyleLabShowcase.tsx`):**
   - In `ProjectPickerPopover.tsx` (`viewMode === 'styles'`), add a segmented tab bar `[ Wszystkie ] [ 2D ] [ 2.5D ] [ 3D ]` above the style list; display space badges (`2D`, `2.5D`, `3D`) on each style row while always keeping the `"Twoje style (styles/*.style.json)"` section and `"+ Duplikuj jako własny styl"` workflow prominent.
   - In `StyleLabShowcase.tsx`, add a compact `[ 2D ] [ 2.5D ] [ 3D ]` dimensional space switcher right before the kit strip in `.mp-stage-top-bar` that switches to the space's flagship preview kit (`'2d' -> 'motion-diagrams-2d'`, `'2.5d' -> 'paper-diorama-3d'`, `'3d' -> 'isometric-3d'`), and upgrade the `Isometric 3D` preview inside `StyleLabShowcase.tsx` so `soft-clay`, `glass-studio`, and `retro-pc` display warm rounded clay characters/studio cues rather than cold wireframes.
3. **Skills (`plugins/make-pictures/skills/*` + `npm run sync:skills`):**
   - Update `style-and-art-direction/SKILL.md` with the 2-axis `DimensionalSpace (2D / 2.5D / 3D) × 10 Built-in Styles + Custom styles/*.style.json` gate and `material3d`.
   - Update `make-pictures-director/SKILL.md` with `--space=2d|2.5d|3d`.
   - Update `sound-and-music-design/SKILL.md` line 23 so brand & style phonetics specify **`mejk pikczers`** / **`make pictures`** (never `mejk kropka pikczers`) and **`retro pi si`** / **`retro pee see`**, then run `npm run sync:skills`.

- [ ] **Step 4: Build & run Studio + CLI tests**

Run: `npm run sync:skills && npm run build --workspace=@make-pictures/studio && npm run build --workspace=@make-pictures/cli && npx tsx --test packages/cli/tests/styles-cli-and-studio-api.test.ts packages/cli/tests/skills-sync.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/studio packages/cli plugins/make-pictures/skills .agents/plugins/make-pictures/skills packages/cli/skills packages/create-make-pictures/template/.agents/plugins/make-pictures/skills
git commit -m "feat(studio,cli,skills): add 2D/2.5D/3D space selector, --space CLI flag, and natural phonetics guide"
```

---

### Task 3: High-Impact 3D Engine — `StudioHdrRig3D`, `ClayCharacter3D` & `PodcastStudioSet3D` (`@make-pictures/kits/isometric-3d`)

**Files:**
- Create: `packages/kits/src/isometric-3d/StudioHdrRig3D.tsx`
- Create: `packages/kits/src/isometric-3d/ClayCharacter3D.tsx`
- Create: `packages/kits/src/isometric-3d/PodcastStudioSet3D.tsx`
- Modify: `packages/kits/src/isometric-3d/index.ts`
- Create: `packages/cli/tests/v5-clay3d-and-kits.test.ts`

**Interfaces:**
- Consumes from Task 1: `resolveStyleMaterial3D`, `StyleMaterial3DFinish`, `StyleStudioHdrPreset`, `useStudioStyle`, `createSeededRandom`.
- Produces in `@make-pictures/kits/isometric-3d` (and re-exported from `@make-pictures/kits`):
  - `StudioHdrRig3D`: `React.FC<{ preset?: StyleStudioHdrPreset; contactShadowY?: number; contactShadowScale?: number; contactShadowOpacity?: number; intensity?: number }>`
  - `ClayCharacter3D`: `React.FC<{ position?: [number, number, number]; rotationY?: number; scale?: number; sweaterColor?: string; pantsColor?: string; skinColor?: string; hairColor?: string; eyeColor?: string; finish?: StyleMaterial3DFinish; accessory?: 'headphones' | 'glasses' | 'beanie' | 'none'; speakingWeight?: number; speechEnergy?: number; pose?: 'idle' | 'talking' | 'listening' | 'pointing'; seated?: boolean; seed?: string | number }>`
  - `PodcastStudioSet3D`: `React.FC<{ width?: number; depth?: number; wallHeight?: number; accentColor?: string; onAirActive?: boolean; compactVertical?: boolean; seed?: string | number; children?: React.ReactNode }>`
  - Pure deterministic helpers exported for unit testing:
    - `computeClayBlinkProgress(frame: number, fps: number, seed: string | number): number` (returns `0` open .. `1` closed every ~`3.2s` with seeded phase offset; `0` at `frame <= 0`)
    - `resolvePhysicalFinishProps(finish: StyleMaterial3DFinish): { roughness: number; metalness: number; clearcoat: number; clearcoatRoughness: number; sheen: number; transmission: number; ior: number }`

- [ ] **Step 1: Write failing unit tests in `packages/cli/tests/v5-clay3d-and-kits.test.ts`**

Test `computeClayBlinkProgress` determinism & blink cadence, `resolvePhysicalFinishProps` across all 4 finishes (`soft-clay`, `frosted-glass`, `retro-voxel`, `matte-ceramic`), and clean exports from `@make-pictures/kits`.

- [ ] **Step 2: Run test to verify failure**

Run: `npx tsx --test packages/cli/tests/v5-clay3d-and-kits.test.ts`
Expected: FAIL (`Cannot find module` / missing exports).

- [ ] **Step 3: Implement `StudioHdrRig3D.tsx`, `ClayCharacter3D.tsx`, and `PodcastStudioSet3D.tsx`**

1. **`StudioHdrRig3D.tsx`:**
   - Clean Frame `0` guard (`if (frame <= 0) return null;`).
   - Uses `<Environment resolution={256} frames={1}>` with 3 procedural `<Lightformer />` rigs (`'warm-softbox'`, `'clean-atelier'`, `'neon-grid'`) — **zero external `.hdr` network URLs** — paired with a warm shadow-casting key `<directionalLight shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />`, fill `<hemisphereLight />`, and `<ContactShadows frames={1} resolution={512} blur={2.4} />`.
2. **`ClayCharacter3D.tsx`:**
   - Clean Frame `0` guard (`if (frame <= 0) return null;`), `talkBounce = 0` (grounded torso/feet, zero pogo-stick bouncing!).
   - Expressive *Blender Soft-Clay / Vinyl Toy* sculpt:
     - Softly rounded head (`sphereGeometry` scaled `[1.06, 0.98, 0.98]`) + sculpted rounded nose button + subtle warm rosy cheek discs + sculpted hair cap/bangs (`RoundedBox` + spheres) + ears.
     - **True 3D Eyes:** left & right sclera spheres (`#FFFFFF`), colored iris discs (`eyeColor`), dark pupils (`#111827`), bright specular **catchlight** spheres (`#FFFFFF` at upper-left offset), upper eyelid shells driven by `computeClayBlinkProgress(frame, fps, seed)`, and expressive beveled **eyebrows** that lift/tilt smoothly with `speechEnergy` and `speakingWeight`.
     - **Speech-reactive 3D mouth:** rounded capsule/torus mouth opening smoothly on `speechEnergy` (`0.04` closed smile -> `0.14` open vowel).
     - Beveled sweater torso (`RoundedBox` `radius={0.14}` `smoothness={5}`), collar rim, articulated upper/forearm capsules with soft mittens/hands gesturing smoothly (`<= 0.045 rad/frame`), seated or standing legs + rounded sneakers, and optional **`accessory`**:
       - `'headphones'`: padded headband arch + cushioned over-ear studio cups in accent/metallic finish,
       - `'glasses'`: rounded tortoiseshell/dark frames around the 3D eyes,
       - `'beanie'`: ribbed cozy knit cap,
       - `'none'`.
3. **`PodcastStudioSet3D.tsx`:**
   - Clean Frame `0` guard (`if (frame <= 0) return null;`).
   - Cozy cutaway isometric studio room built 100% from beveled `<RoundedBox smoothness={4}>` (zero harsh `90°` razor edges!):
     - Thick rounded base platform (`width × 0.22 × depth`) + left & back cutaway walls with warm vertical oak **acoustic wood slats**,
     - Glowing **`ON AIR`** studio plaque on the back wall (beveled frame + warm coral-red emissive face + soft local `<pointLight />` halo),
     - Floating wall shelf with colorful vinyl sleeves/books + a sculpted terracotta pot with lush rounded clay leaves,
     - Warm woven studio rug disc under a beveled **oak podcast table** (`RoundedBox`) holding two ceramic coffee mugs and **two articulated studio boom-arm condenser microphones** (weighted base, hinged boom rods, shock-mount ring, metallic grille capsule) aimed toward the two speakers (`compactVertical` tightens speaker spacing so both characters + mics sit comfortably inside the `9:16 Golden Safe Box`!).
4. Export all three components + types + helpers from `packages/kits/src/isometric-3d/index.ts`.

- [ ] **Step 4: Build `@make-pictures/kits` and run unit tests**

Run: `npm run build --workspace=@make-pictures/kits && npx tsx --test packages/cli/tests/v5-clay3d-and-kits.test.ts packages/cli/tests/wave3-isometric-3d.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/kits/src/isometric-3d packages/cli/tests/v5-clay3d-and-kits.test.ts
git commit -m "feat(kits): add offline StudioHdrRig3D, expressive ClayCharacter3D, and PodcastStudioSet3D"
```

---

### Task 4: `RetroPcWindowStage2D` (`2D`) & Cosmic/Lunar `Apollo 11` Cutouts (`2.5D`) (`@make-pictures/kits`)

**Files:**
- Create: `packages/kits/src/motion-diagrams-2d/RetroPcWindowStage2D.tsx`
- Modify: `packages/kits/src/motion-diagrams-2d/index.ts`
- Modify: `packages/kits/src/paper-diorama-3d/ScenicCutoutMotifs.tsx`
- Modify: `packages/cli/tests/wave3-motion-diagrams.test.ts`
- Modify: `packages/cli/tests/scenic-cutout-motifs.test.ts`

**Interfaces:**
- Produces in `@make-pictures/kits`:
  - `RetroPcHopSpec = { id: string; title: string; subtitle: string; badge: string; latencyMs: number }`
  - `RetroPcWindowStage2D: React.FC<{ windowTitle: string; addressLabel: string; hops: ReadonlyArray<RetroPcHopSpec>; statusBanner: string; progress: number; isVertical?: boolean; enterFrame?: number }>`
  - In `ScenicCutoutMotifs.tsx` (re-exported via `@make-pictures/kits/paper-diorama-3d` and `@make-pictures/kits`):
    - `StarryCosmosBackdropCutout3D: React.FC<ScenicCutoutCommonProps>`
    - `EarthriseCutout3D: React.FC<ScenicCutoutCommonProps>`
    - `LunarCraterRidgeCutout3D: React.FC<ScenicCutoutCommonProps & { ridgeVariant?: 'far' | 'near' }>`
    - `LunarLanderCutout3D: React.FC<ScenicCutoutCommonProps & { thrusterIntensity?: number }>`

- [ ] **Step 1: Add failing tests in `packages/cli/tests/wave3-motion-diagrams.test.ts` and `packages/cli/tests/scenic-cutout-motifs.test.ts`**

Verify `RetroPcWindowStage2D` renders Clean Frame `0` (`frame = 0` -> empty/hidden) and renders deterministic CRT window chrome, hop cards, and packet progress on active frames without `Math.random()`; verify `StarryCosmosBackdropCutout3D`, `EarthriseCutout3D`, `LunarCraterRidgeCutout3D`, and `LunarLanderCutout3D` are exported and paint inside `SCENIC_CUTOUT_INNER_MARGIN_PX = 38` so `whiteBorderPx` never clips flat.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx tsx --test packages/cli/tests/wave3-motion-diagrams.test.ts packages/cli/tests/scenic-cutout-motifs.test.ts`
Expected: FAIL (new components not yet defined).

- [ ] **Step 3: Implement `RetroPcWindowStage2D.tsx` and the 4 Cosmic/Lunar Cutout Motifs**

1. **`RetroPcWindowStage2D.tsx`:**
   - Clean Frame `0` guard (`if (frame <= 0) return null;`).
   - Authentic, crisp late-80s/early-90s desktop OS + CRT monitor window aesthetic (`ClippedSurfaceChrome` outer frame, classic dithered/striped titlebar with pixel close/zoom boxes and `windowTitle`, symbolic URL/request bar `GET https://twoja-strona.pl` — strictly symbolic offline string, zero network calls or IP addresses!, subtle phosphor scanline overlay at `0.05` opacity, 3 hop cards connected by animated phosphor packet tracks synced to `progress` `0..1`, and a bottom status bar highlighting `statusBanner` once `progress >= 0.82`). Supports both `16:9` horizontal 3-column flow and `9:16` vertical stacked layout inside `Golden Safe Box` (`x ∈ [40, 910], y ∈ [220, 1380]`).
2. **`ScenicCutoutMotifs.tsx` (4 new cosmic/lunar motifs):**
   - Respect `SCENIC_CUTOUT_INNER_MARGIN_PX = 38` on all 4 canvas edges so Paper Mario cream die-cut borders (`whiteBorderPx`) never clip flat!
   - `StarryCosmosBackdropCutout3D`: deep indigo/midnight arch cutout peppered with deterministic golden/ivory 4-point paper stars and nebula arcs.
   - `EarthriseCutout3D`: layered sapphire ocean sphere, emerald/sage paper continents, swirling cream cloud bands, and delicate atmospheric crescent rim.
   - `LunarCraterRidgeCutout3D`: warm silver-chalk undulating lunar horizon with shadowed elliptical crater rims (`ridgeVariant: 'far' | 'near'`).
   - `LunarLanderCutout3D`: iconic *Apollo 11 Eagle* paper craft — octagonal gold-foil (`#F59E0B` / `#FDE68A`) descent stage, charcoal/ivory faceted ascent cabin with triangular windows, 4 splayed landing struts with round footpads, communications dish, and soft translucent amber-cream braking plume scaled by `thrusterIntensity` (`0..1`, fading smoothly to `0` upon touchdown!).

- [ ] **Step 4: Build `@make-pictures/kits` and run tests**

Run: `npm run build --workspace=@make-pictures/kits && npx tsx --test packages/cli/tests/wave3-motion-diagrams.test.ts packages/cli/tests/scenic-cutout-motifs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/kits/src/motion-diagrams-2d packages/kits/src/paper-diorama-3d/ScenicCutoutMotifs.tsx packages/cli/tests/wave3-motion-diagrams.test.ts packages/cli/tests/scenic-cutout-motifs.test.ts
git commit -m "feat(kits): add RetroPcWindowStage2D and Apollo 11 lunar cutout motifs"
```

---

### Task 5: Stage 1+2 Integration & `1080p` Visual Verification Gate (` ClayCharacter3D + PodcastStudioSet3D `)

**Files:**
- Verify & build all workspace packages (`core`, `kits`, `studio`, `cli`, `create-make-pictures`)
- Render & inspect a standalone `1080p` verification still of `ClayCharacter3D` + `PodcastStudioSet3D` + `StudioHdrRig3D` before Showreel production

- [ ] **Step 1: Rebuild all packages, typecheck, and run full test suite**

Run: `npm run build:packages && npm run typecheck && npm test`
Expected: `0` TypeScript errors, `100%` tests passing.

- [ ] **Step 2: Render & inspect `1080p` visual proof of new 3D Soft-Clay Studio**

Render a `1920×1080` still of `PodcastStudioSet3D` + `StudioHdrRig3D` (`warm-softbox`) + 2 `<ClayCharacter3D accessory="headphones">` to `/Users/pawelbart/.gemini/antigravity/brain/b3066e38-f666-4732-bcd7-75e6e6813a14/scratch/v5-clay3d-preview.png` and inspect via `read_file`. Verify:
- Soft beveled walls & oak slats (zero raw un-beveled boxes),
- Warm `ON AIR` glow, boom-arm studio microphones, mugs, plant,
- Expressive soft-clay characters with 3D eyes, pupils, catchlights, eyebrows, and headphones (dramatically superior to `v4-spot-scene3-room.png`).

---

### Task 6: Showreel v5 Audio Capsule & Contracts (`39.0s` / `2340f`, Natural Phonetics)

**Files:**
- Modify: `productions/make-pictures-showreel/production.json`
- Modify: `productions/make-pictures-showreel/compositions/contracts.ts`
- Regenerate: `productions/make-pictures-showreel/generated/audio-manifest.ts` & `.mp3` assets

**Interfaces:**
- Produces in `productions/make-pictures-showreel/compositions/contracts.ts`:
  - `SHOWREEL_FPS = 60`, `SHOWREEL_DURATION_FRAMES = 2340`, `SHOWREEL_DURATION_SECONDS = 39`, `SHOWREEL_CROSS_DISSOLVE_FRAMES = 42`
  - 5 nominal scene windows (`>= 300f` each):
    1. `scene1-product-hook`: `0..300` (`300f`, `5.0s`)
    2. `scene2-retro-pc-2d`: `300..870` (`570f`, `9.5s`)
    3. `scene3-apollo-25d`: `870..1440` (`570f`, `9.5s`, `usesThree: true`)
    4. `scene4-clay-podcast-3d`: `1440..2010` (`570f`, `9.5s`, `usesThree: true`)
    5. `scene5-custom-finale`: `2010..2340` (`330f`, `5.5s`)

- [ ] **Step 1: Update `productions/make-pictures-showreel/production.json` with exact approved copy & phonetics**

Configure 10 scenes (`scene1-pl`..`scene5-pl`, `scene1-en`..`scene5-en`) with `Daniel` (`onwK4e9ZLuTAKqWW03F9`, `speed: 1.08`, `stability: 0.64`, `similarityBoost: 0.84`, `style: 0.20`, `useSpeakerBoost: true`, `. ` / `... ` prefix on `nextText` to prevent trailing phoneme bleed):
- `scene1-pl`: `"Zobacz, jak w mejk pikczers z jednego zdania powstają gotowe animacje."`
- `scene2-pl`: `"Wybierz przestrzeń dwa de oraz styl retro pi si, by prosto wyjaśnić działanie sieci."`
- `scene3-pl`: `"Przełącz na wycinankę dwa i pół de i opowiedz historię lądowania Apollo jedenaście."`
- `scene4-pl`: `"Albo wejdź w pełne trzy de z miękkiej modeliny i ożyw rozmowę w studiu podcastowym."`
- `scene5-pl`: `"Twórz też własne style. Zacznij w mejk pikczers."`
- `scene1-en`: `"See how make pictures turns a single sentence into a finished animation."`
- `scene2-en`: `"Pick two dee space in retro pee see style to explain a live network request."`
- `scene3-en`: `"Switch to two point five dee paper cutouts to bring the Apollo eleven landing to life."`
- `scene4-en`: `"Or step into sculpted three dee soft clay for an expressive podcast studio scene."`
- `scene5-en`: `"Or craft your own custom style. Start with make pictures."`
- Plus `39s` `composition-plan` score (`showreel-v5-score`) and 5 Foley SFX (`prompt-key`, `retro-beep`, `lunar-thruster`, `mic-warm`, `finale-chime`).

- [ ] **Step 2: Update `contracts.ts` for the 5-scene `2340f` timeline**

Update `SHOWREEL_SCENE_WINDOWS`, dialogue start offsets (`scene1: 18`, `scene2: 330`, `scene3: 900`, `scene4: 1470`, `scene5: 2034`), camera timeline, and SFX cue frames so every voiceover has `>= 1.2s` breathing room before its scene boundary.

- [ ] **Step 3: Synthesize ElevenLabs audio and audition EVERY `.mp3` via `read_file`**

Run: `npx tsx packages/cli/src/index.ts audio --production=make-pictures-showreel --force`
Audition all 10 voiceover `.mp3`s, the `39s` music score `.mp3`, and all 5 SFX `.mp3`s via `read_file`! Confirm crisp `"mejk pikczers"` and `"retro pi si"`, zero clipped endings, and that every clip fits inside its scene window with `>= 48f` (`0.8s`) margin.

---

### Task 7: Showreel v5 Reusable `PromptCard` + Scenes 1 & 2 (`Product Hook` + `2D Retro-PC`)

**Files:**
- Create: `productions/make-pictures-showreel/compositions/PromptCard.tsx`
- Create: `productions/make-pictures-showreel/compositions/Scene1ProductHook.tsx`
- Create: `productions/make-pictures-showreel/compositions/Scene2RetroPc2D.tsx`

**Interfaces:**
- `PromptCard: React.FC<{ spaceBadge: '2D' | '2.5D' | '3D'; styleBadge: string; promptText: string; localFrame: number; holdFrames?: number; transitionFrames?: number; isVertical?: boolean }>` — renders the tactile prompt input card during `localFrame 0..holdFrames` (`138f` = `2.3s`) with realistic smooth typing/reveal, space + style pill badges, and seamless spring morph/docking into a compact header badge or gracefully dissolving (`opacity` + `translateY`) as the Real Effect fills the frame (using continuous frame math, NEVER a short `<Sequence>` or `<SceneTransition>`!).
- `Scene1ProductHook`: `0..300` (`5.0s`) — Clean `f=0`, clear product headline (*„Zobacz, jak z jednego zdania tworzysz super animacje”* / *„See how one sentence becomes a finished animation”*), and 3 dimensional space cards (`2D`, `2.5D`, `3D`) lighting up sequentially inside `16:9` and `9:16 Safe Box`.
- `Scene2RetroPc2D`: `300..870` (`9.5s`) — `PromptCard` (`2D • Styl: Retro-PC`, *„Wyjaśnij jak działa zapytanie w sieci w stylu retro-pc”* / *„Explain how a web request works in retro-pc style”*) smoothly opening full `<StyleProvider style="retro-pc">` + `<RetroPcWindowStage2D>` animating a symbolic packet across `Twoja przeglądarka → Serwer nazw → Serwer strony` -> `200 OK • Strona gotowa w 18 ms`.

- [ ] **Step 1: Implement `PromptCard.tsx`, `Scene1ProductHook.tsx`, and `Scene2RetroPc2D.tsx`**

Ensure Clean `f=0` on `Scene1ProductHook`, zero `Math.random()`, zero `useRef`, Polish *Sentence case* (`latin-ext`), `< 0.25px -> filter: 'none'` sharp text, and strict `9:16 Safe Box` (`x ∈ [40, 910], y ∈ [220, 1380]`) layouts when `height > width`.

---

### Task 8: Showreel v5 Scenes 3, 4 & 5 (`2.5D Apollo 11`, `3D Soft-Clay Podcast`, `Custom Styles Finale`)

**Files:**
- Create: `productions/make-pictures-showreel/compositions/Scene3ApolloCutout25D.tsx`
- Create: `productions/make-pictures-showreel/compositions/Scene4ClayPodcast3D.tsx`
- Create: `productions/make-pictures-showreel/compositions/Scene5CustomStylesFinale.tsx`

**Interfaces:**
- `Scene3ApolloCutout25D` (`870..1440`, `570f`, `usesThree: true`): `PromptCard` (`2.5D • Styl: Wycinankowy`, *„Opowiedz lądowanie Apollo 11 jako papierową wycinankę 2.5D”*) transitioning smoothly into `<StyleProvider style="tactile-craft">` + `<ThreeCanvas>` + `<DioramaStage3D>` with `StarryCosmosBackdropCutout3D` (`z = -3.4`), `EarthriseCutout3D` (`z = -2.5`), `LunarCraterRidgeCutout3D` (`far` `z = -1.5`, `near` `z = -0.6`, all `Δz >= 0.55`), and `LunarLanderCutout3D` (`z = 0.25`) decelerating smoothly onto the lunar surface with `thrusterIntensity` tapering to `0` on touchdown.
- `Scene4ClayPodcast3D` (`1440..2010`, `570f`, `usesThree: true`): `PromptCard` (`3D • Styl: Modelina`, *„Pokaż rozmowę w studiu podcastowym jako animację z modeliny 3D”*) transitioning smoothly into `<StyleProvider style="soft-clay">` + `<ThreeCanvas shadows>` + `<DirectorCamera3D>` + `<StudioHdrRig3D preset="warm-softbox" />` + `<PodcastStudioSet3D compactVertical={isVertical}>` + two conversing `<ClayCharacter3D accessory="headphones">` figures whose `speechEnergy` / `speakingWeight` react deterministically to the voiceover envelope while blinking naturally in 3D!
- `Scene5CustomStylesFinale` (`2010..2340`, `330f`): Showcases the `[ 2D ] [ 2.5D ] [ 3D ] + Własne style (styles/*.style.json)` selector morphing smoothly into the crisp `make.pictures` brand finale card with `npx create-make-pictures@latest`.

- [ ] **Step 1: Implement `Scene3ApolloCutout25D.tsx`, `Scene4ClayPodcast3D.tsx`, and `Scene5CustomStylesFinale.tsx`**

Verify `usesThree: true` compatibility (`<= 1` `<ThreeCanvas>` per scene), `9:16 Safe Box` framing on both 3D cameras (`fov`, `lookAt`, `compactVertical`), and zero banned primitives.

---

### Task 9: Showreel v5 Wiring, Hard Director QA, `1080p` Spot Inspection, `-14 LUFS` Render & `pack:verify`

**Files:**
- Modify: `productions/make-pictures-showreel/compositions/MakePicturesShowreel.tsx`
- Modify: `productions/make-pictures-showreel/compositions/MakePicturesShowreelPL.props.json`
- Modify: `productions/make-pictures-showreel/compositions/MakePicturesShowreelEN.props.json`
- Modify: `productions/make-pictures-showreel/compositions/MakePicturesShowreelVerticalPL.props.json`
- Modify: `productions/make-pictures-showreel/compositions/MakePicturesShowreelVerticalEN.props.json`
- Create: `productions/make-pictures-showreel/compositions/__tests__/showreel-v5.test.ts`
- Remove obsolete v4 scene files (`Scene1EditorialGallery.tsx`, `Scene2AtelierMorph.tsx`, `Scene3IllustrativeWorlds3D.tsx`, `Scene4StudioFinale.tsx`, `showreel-v4.test.ts`)

- [ ] **Step 1: Wire `MakePicturesShowreel.tsx`, `*.props.json`, and `showreel-v5.test.ts`**

Read all 4 `*.props.json` files before editing (`AGENTS.md` §3), wire the 5 scenes in `<ContinuousSceneFlow crossDissolveFrames={42} />` (marking `Scene3` and `Scene4` `usesThree: true`), and write `showreel-v5.test.ts` testing:
1. `2340` frames (`39.0s @ 60 FPS`) across all 4 compositions (`PL`, `VerticalPL`, `EN`, `VerticalEN`),
2. `auditCompositionDirection` passes with `0` errors WITHOUT `allowFastCuts`,
3. `computeContinuousSceneWindows` guarantees `<= 1` active `usesThree` scene on every frame `0..2339`,
4. Every voiceover clip in `VOICEOVER_MANIFEST` fits inside its scene window with `>= 45` frames breathing room,
5. Zero `Math.random`, mutable `useRef`, raw `<Audio`, or `<SceneTransition` in `productions/make-pictures-showreel/compositions/`.

- [ ] **Step 2: Run typecheck & tests**

Run: `npm run typecheck && npm test && npx tsx --test productions/make-pictures-showreel/compositions/__tests__/showreel-v5.test.ts`
Expected: `0` errors, all tests green.

- [ ] **Step 3: Run Hard Contact-Sheet QA + Full-`1080p` Spot Stills and inspect via `read_file`**

Run `npx tsx packages/cli/src/index.ts qa <CompId>` (NO `--allow-fast-cuts`!) for all 4 compositions (`MakePicturesShowreelPL`, `MakePicturesShowreelVerticalPL`, `MakePicturesShowreelEN`, `MakePicturesShowreelVerticalEN`) AND render full-resolution `1080p` spot stills of:
- Scene 2 (`PromptCard` + `RetroPcWindowStage2D`),
- Scene 3 (`Apollo 11` 2.5D cutout landing),
- Scene 4 (`PodcastStudioSet3D` + `ClayCharacter3D` 3D soft-clay studio),
- Scene 5 (`Custom Styles + Finale`).
Inspect EVERY PNG via `read_file` (`f=0` pure uniform `bgCanvas`, crisp Polish `latin-ext`, `9:16 Safe Box`, genuine tactile 3D soft-clay look, zero visual defects).

- [ ] **Step 4: Render all 4 mastered `-14 LUFS` MP4s & run `npm run pack:verify`**

Run:
- `npx tsx packages/cli/src/index.ts render MakePicturesShowreelPL out/make-pictures-showreel-pl.mp4`
- `npx tsx packages/cli/src/index.ts render MakePicturesShowreelVerticalPL out/make-pictures-showreel-vertical-pl.mp4`
- `npx tsx packages/cli/src/index.ts render MakePicturesShowreelEN out/make-pictures-showreel-en.mp4`
- `npx tsx packages/cli/src/index.ts render MakePicturesShowreelVerticalEN out/make-pictures-showreel-vertical-en.mp4`
- Verify streams (`60/1 FPS`, `39.00s`, `aac 48000 Hz stereo`) and loudness (`~ -14 LUFS` via `ffmpeg -af ebur128`).
- Run `npm run pack:verify` to confirm all 5 npm tarballs build, pack, scaffold, typecheck, and boot Studio Web cleanly with `git status --short` clean.
