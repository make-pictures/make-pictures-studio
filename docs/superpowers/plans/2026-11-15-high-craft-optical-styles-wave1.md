# High-Craft Optical Styles (Wave 1: OpticalStage2D, Editorial Collage & Kinetic Typography) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared 2.5D Multi-Plane Optical Engine (`OpticalStage2D`, `DepthPlane`, `StageLightingRig`, `getTactileSurfaceStyle`) and `StylePreset.optics` contract in `@make-pictures/core`, rebuild `@make-pictures/kits/editorial-collage` and `@make-pictures/kits/kinetic-typography` into high-craft artistic media with camera parallax, directional lighting, and optical rack focus, and wire them into `Style Lab`, `make-pictures new`, and studio skills.

**Architecture:** `StylePresetSchema` gains an optional `optics` object (`lightingRig`, `typographyGrammar`, `lightAngleDeg`, `aperture`, `halation`) normalized via `resolveStyleOptics(style)` and `deriveDefaultOpticsForSurface(surface)` so existing `styles/*.style.json` files remain 100% valid while `Studio Web` (`introspectZodObject`) automatically renders live sliders and selectors. A pure 2D/CSS/SVG optical engine in `packages/core/src/optics/` (zero `three` or `@react-three/fiber` runtime imports) solves multi-plane Z-parallax, Circle-of-Confusion depth-of-field with a crisp `< 0.25px` focal deadzone, directional contact/cast shadows, and three lighting regimes (`window-gobo`, `darkroom-halation`, `studio-macro`), powering both rebuilt flagship kits and `Style Lab`.

**Tech Stack:** TypeScript 5.7, React 18, Remotion 4 (`60 FPS` deterministic springs & `interpolate`), Zod 3.24, `@remotion/player` (`Thumbnail` SSR verification), Node `node:test` via `tsx --test`, Esbuild workspace bundler.

## Global Constraints

- **Clean Frame `0` (`frame === 0`):** Every stage, lighting rig, backdrop, and scene component MUST render pure empty `palette.bgCanvas` on `frame <= 0`; all entrance animations start at `frame >= 2` (`Math.max(2, startFrame)`).
- **`60 FPS` Multi-Core Determinism (`--concurrency=100%`):** Strict ban on `Math.random()` and cross-frame mutable state in `useRef`; all grain phases, card angles (`tiltDeg`), and ink variations MUST be pure functions of `frame` and `createSeededRandom(seed)`.
- **`9:16 Golden Safe Box` (`1080×1920`):** All vertical cards, headlines, quotes, and counters MUST stay strictly within `x ∈ [40, 910], y ∈ [220, 1380]`; vertical `tiltDeg` is clamped to `[-1.2°, +1.2°]` with `>= 16px` inner margin safety.
- **Crisp Vector Typography on Focal Plane:** In `<DepthPlane z={...}>` and focus-pull animations, whenever `blurPx < 0.25`, `style.filter` MUST be `'none'` (never `'blur(0px)'`) so Chromium rasterizes Google Fonts (`latin-ext`) at native subpixel sharpness.
- **Zero Three.js Dependency in `@make-pictures/core` and `@make-pictures/studio`:** `packages/core/src/optics/*` MUST NOT import `three` or `@react-three/fiber`, and `packages/studio/*` MUST NOT add mandatory top-level runtime imports of `@make-pictures/kits`.
- **Zod Introspection Compatibility:** `StylePresetSchema` MUST remain a plain `z.object(...)` (`AnyZodObject`, never wrapped in `z.preprocess`/`ZodEffects` at the outer level) so `introspectZodObject(StylePresetSchema, ...)` works statically and at runtime.
- **Backwards Compatibility & Source Guards:** Keep 100% of existing exported component/helper names and prop interfaces in `editorial-collage` and `kinetic-typography`. Preserve `Math.max(2, startFrame)` and `return null` in all 4 `editorial-collage` card files (`narrative-kits.test.ts`), `useStudioStyle` in all `kinetic-typography` files (`kits-style-integration.test.ts`), and `<StyleProvider style={props.styleId} renderBackdrop>` in CLI scaffolds (`styles-cli.test.ts`).
- **Polish Copy Rules (`latin-ext`):** Author Polish UI labels and scaffold strings in *Sentence case* (never *Title Case*), supporting full Polish diacritics (`ą ć ę ł ń ó ś ź ż`).
- **Git Staging for Ignored `docs/superpowers/`:** `.gitignore` ignores `docs/superpowers/`; only use `git add -f` when staging spec/plan docs under `docs/superpowers/`. Application source files are tracked normally.

---

## File Structure & Responsibility Map

| Path | Action | Responsibility |
| :--- | :--- | :--- |
| `packages/core/src/style/schema.ts` | Modify | Define `StyleLightingRigSchema`, `StyleTypographyGrammarSchema`, `StyleOpticsSchema`, `deriveDefaultOpticsForSurface`, `resolveStyleOptics`, and add `optics: StyleOpticsSchema.optional()` to `StylePresetSchema`. |
| `packages/core/src/style/presets.ts` | Modify | Populate curated `optics` profiles on all 7 `BUILT_IN_STYLES`. |
| `packages/core/src/style/registry.ts` | Modify | Normalize `optics` via `resolveStyleOptics` in `registerCustomStyles` and `resolveStudioStyle`. |
| `packages/cli/src/commands/styles.ts` | Modify | Normalize `optics` when loading legacy `styles/*.style.json` or scaffolding `make-pictures style new`. |
| `packages/studio/src/server/index.ts` | Modify | Normalize `optics` in `readCustomStylesFromDisk` and `saveCustomStyleToDisk`. |
| `packages/core/src/camera/shotTypes.ts` | Modify | Add `focalZ?: number` and `aperture?: number` to `DirectorCameraTelemetry` and `publishFrameCameraTelemetry` diff check. |
| `packages/core/src/optics/math.ts` | Create | Pure 2.5D optical math: `OpticalShot2D`, `computeParallaxFactor`, `computeCircleOfConfusionPx`, `computePlaneAtmosphericOpacity`, `evaluateOpticalCamera2D`. |
| `packages/core/src/optics/tactileSurface.ts` | Create | Directional light-vector cast + contact shadow generator `getTactileSurfaceStyle` and `computeDirectionalShadowVector`. |
| `packages/core/src/optics/StageLightingRig.tsx` | Create | 60 FPS directional lighting backdrop (`window-gobo`, `darkroom-halation`, `studio-macro`) with Clean Frame `0` and seeded film grain. |
| `packages/core/src/optics/OpticalStage2D.tsx` | Create | Multi-plane 2.5D camera container `<OpticalStage2D />`, `<DepthPlane z={...} />`, and `useOpticalStage()`. |
| `packages/core/src/optics/index.ts` | Create | Public barrel for `@make-pictures/core/optics`. |
| `packages/core/src/index.ts` | Modify | Re-export `./optics` from `@make-pictures/core`. |
| `packages/core/package.json` | Modify | Add `"./optics"` subpath export. |
| `scripts/build-packages.ts` | Modify | Add `optics/index` browser entrypoint for `@make-pictures/core`. |
| `packages/kits/src/vfx/index.ts` | Modify | Re-export 2.5D optical primitives from `@make-pictures/core` for convenience in `@make-pictures/kits/vfx`. |
| `packages/kits/src/editorial-collage/EditorialDeskStage.tsx` | Create | Multi-plane analog editorial desk / lightbox stage (`z = -0.65` registration sheet, `z = 0` hero plane, `z = +0.75` edge accents). |
| `packages/kits/src/editorial-collage/EditorialMediaCard.tsx` | Modify | Baryta print / 35mm slide mount (`mountType`, `tiltDeg`), directional shadow, archival contact-sheet SVG fallback, deterministic Ken Burns. |
| `packages/kits/src/editorial-collage/HighlightQuoteStage.tsx` | Modify | Tactile press clipping with column rule and word-synced organic SVG ink-brush / halation sweep. |
| `packages/kits/src/editorial-collage/ChapterTitleCard.tsx` | Modify | Magazine crop-mark opener with spring hairline rule and optical focus-pull entrance (`5px -> 0px`). |
| `packages/kits/src/editorial-collage/SplitStoryLayout.tsx` | Modify | Dual-elevation editorial layout with optional `focusShiftFrame` rack-focus shift inside `computeSplitStoryVerticalBounds`. |
| `packages/kits/src/editorial-collage/index.ts` | Modify | Export `EditorialDeskStage` and its types. |
| `packages/kits/src/kinetic-typography/WordByWordStage.tsx` | Modify | Polymorphic 3-grammar word choreography (`swiss-spatial`, `optical-gate`, `risograph-poster`) with multi-beat depth and zero karaoke pills. |
| `packages/kits/src/kinetic-typography/ImpactKeywordCard.tsx` | Modify | Typographic statement card across all 3 grammars (`icon` defaults to `null`, removing `<Sparkles />` tile). |
| `packages/kits/src/kinetic-typography/AnimatedMetricCounter.tsx` | Modify | Tabular counter with precision SVG vernier scale ticks / embossed poster block (replacing `5px` progress bar). |
| `packages/studio/src/client/components/StyleLabShowcase.tsx` | Modify | Live `60 FPS` optical previews for `EditorialCollagePreview` and `KineticTypographyPreview` reacting to `style.optics`. |
| `packages/cli/src/commands/new-production.ts` | Modify | Upgrade `editorial-collage` and `kinetic-typography` capsule scaffolds to use `EditorialDeskStage`, `StageLightingRig`, and `OpticalStage2D`. |
| `plugins/make-pictures/skills/*/SKILL.md` (`+ skills/`) | Modify | Document `StylePreset.optics`, `OpticalStage2D`, `DepthPlane`, `EditorialDeskStage`, and the 3 kinetic grammars; sync via `npm run sync:skills`. |
| `packages/cli/tests/optical-stage.test.ts` | Create | Unit & SSR tests for optical math, directional shadows, lighting regimes, `9:16` Safe Box, and Frame `0` invariant. |
| `packages/cli/tests/{style-core,studio-styles-api,narrative-kits,kits-style-integration,styles-cli}.test.ts` | Modify | Extend unit, static, and SSR test suites for `StyleOptics`, rebuilt kits, Style Lab inspector, and CLI scaffolds. |

---

### Task 1: `StylePreset.optics` Schema, Surface-Aware Migration & 7 Built-In Presets

**Files:**
- Modify: `packages/core/src/style/schema.ts`
- Modify: `packages/core/src/style/presets.ts`
- Modify: `packages/core/src/style/registry.ts`
- Modify: `packages/cli/src/commands/styles.ts`
- Modify: `packages/studio/src/server/index.ts`
- Test: `packages/cli/tests/style-core.test.ts`
- Test: `packages/cli/tests/studio-styles-api.test.ts`

**Interfaces:**
- Consumes: `z` from `zod`
- Produces (exported from `@make-pictures/core`, `@make-pictures/core/style`, and `@make-pictures/core/style/presets`):
  - `StyleLightingRigSchema`, `type StyleLightingRig = 'window-gobo' | 'darkroom-halation' | 'studio-macro'`
  - `StyleTypographyGrammarSchema`, `type StyleTypographyGrammar = 'swiss-spatial' | 'optical-gate' | 'risograph-poster'`
  - `StyleOpticsSchema`, `type StyleOptics = { lightingRig: StyleLightingRig; typographyGrammar: StyleTypographyGrammar; lightAngleDeg: number; aperture: number; halation: number }`
  - `deriveDefaultOpticsForSurface(surface: StylePreset['surface']): StyleOptics`
  - `resolveStyleOptics(style: StylePreset): StyleOptics`
  - `withNormalizedStyleOptics(style: StylePreset): StylePreset`

- [ ] **Step 1: Write failing tests in `packages/cli/tests/style-core.test.ts` and `packages/cli/tests/studio-styles-api.test.ts`**

Append the following test to `packages/cli/tests/style-core.test.ts` (and add `StyleOpticsSchema`, `deriveDefaultOpticsForSurface`, `resolveStyleOptics` to the top import from `../../core/src/index`):

```ts
test('StyleOpticsSchema, BUILT_IN_STYLES optics, and surface-aware legacy migration work deterministically', () => {
  const expectedOptics: Record<
    string,
    {
      lightingRig: string;
      typographyGrammar: string;
      lightAngleDeg: number;
      aperture: number;
      halation: number;
    }
  > = {
    'minimal-product': {
      lightingRig: 'studio-macro',
      typographyGrammar: 'swiss-spatial',
      lightAngleDeg: -20,
      aperture: 0.36,
      halation: 0.08,
    },
    'editorial-press': {
      lightingRig: 'window-gobo',
      typographyGrammar: 'swiss-spatial',
      lightAngleDeg: -28,
      aperture: 0.45,
      halation: 0.16,
    },
    'archival-chronicle': {
      lightingRig: 'window-gobo',
      typographyGrammar: 'swiss-spatial',
      lightAngleDeg: -34,
      aperture: 0.54,
      halation: 0.26,
    },
    'cyber-telemetry': {
      lightingRig: 'darkroom-halation',
      typographyGrammar: 'optical-gate',
      lightAngleDeg: -24,
      aperture: 0.5,
      halation: 0.58,
    },
    'brutalist-poster': {
      lightingRig: 'darkroom-halation',
      typographyGrammar: 'risograph-poster',
      lightAngleDeg: -38,
      aperture: 0.32,
      halation: 0.28,
    },
    'sketch-notebook': {
      lightingRig: 'window-gobo',
      typographyGrammar: 'risograph-poster',
      lightAngleDeg: -26,
      aperture: 0.38,
      halation: 0.12,
    },
    'tactile-craft': {
      lightingRig: 'window-gobo',
      typographyGrammar: 'risograph-poster',
      lightAngleDeg: -30,
      aperture: 0.48,
      halation: 0.2,
    },
  };

  for (const id of BUILT_IN_STYLE_IDS) {
    const preset = BUILT_IN_STYLES[id];
    assert.ok(preset.optics, `Expected ${id} to define optics`);
    assert.deepEqual(preset.optics, StyleOpticsSchema.parse(expectedOptics[id]));
  }

  // Legacy JSON without `optics` still parses and receives surface-matched defaults via registry
  const { optics: _omitted, ...legacyArchivalWithoutOptics } =
    BUILT_IN_STYLES['archival-chronicle'];
  const parsedLegacy = StylePresetSchema.parse({
    ...legacyArchivalWithoutOptics,
    id: 'legacy-editorial',
  });
  assert.equal(parsedLegacy.optics, undefined);

  const derivedEditorial = deriveDefaultOpticsForSurface(parsedLegacy.surface);
  assert.equal(derivedEditorial.lightingRig, 'window-gobo');
  assert.equal(derivedEditorial.typographyGrammar, 'swiss-spatial');

  const derivedDark = deriveDefaultOpticsForSurface(
    BUILT_IN_STYLES['cyber-telemetry'].surface
  );
  assert.equal(derivedDark.lightingRig, 'darkroom-halation');
  assert.equal(derivedDark.typographyGrammar, 'optical-gate');

  const derivedBrutalist = deriveDefaultOpticsForSurface(
    BUILT_IN_STYLES['brutalist-poster'].surface
  );
  assert.equal(derivedBrutalist.typographyGrammar, 'risograph-poster');

  const derivedMinimal = deriveDefaultOpticsForSurface(
    BUILT_IN_STYLES['minimal-product'].surface
  );
  assert.equal(derivedMinimal.lightingRig, 'studio-macro');
  assert.equal(derivedMinimal.typographyGrammar, 'swiss-spatial');

  clearCustomStyles();
  registerCustomStyles([parsedLegacy]);
  try {
    const resolvedLegacy = resolveStudioStyle('legacy-editorial');
    assert.deepEqual(resolvedLegacy.optics, derivedEditorial);
    assert.deepEqual(resolveStyleOptics(parsedLegacy), derivedEditorial);
  } finally {
    clearCustomStyles();
  }
});
```

In `packages/cli/tests/studio-styles-api.test.ts`, update lines 277–294 so `sectionTitles` expects `'Optyka & Światło'` and verifies its 5 inspector controls:

```ts
  const sections = introspectZodObject(
    StylePresetSchema,
    BUILT_IN_STYLES['editorial-press'] as unknown as Record<string, unknown>
  );
  const sectionTitles = sections.map((s) => s.title);
  assert.deepEqual(sectionTitles, [
    'Informacje',
    'Paleta kolorów',
    'Typografia',
    'Powierzchnia & Tło',
    'Fizyka ruchu',
    'Optyka & Światło',
    'Domyślne Audio',
  ]);
  const colorFields = sections
    .find((s) => s.title === 'Paleta kolorów')
    ?.fields.filter((f) => f.kind === 'color');
  assert.equal(colorFields?.length, 8);

  const opticsFields = sections.find((s) => s.title === 'Optyka & Światło')?.fields;
  assert.equal(opticsFields?.length, 5);
  assert.deepEqual(
    opticsFields?.map((f) => `${f.key}:${f.kind}`),
    [
      'optics.lightingRig:enum',
      'optics.typographyGrammar:enum',
      'optics.lightAngleDeg:range',
      'optics.aperture:range',
      'optics.halation:range',
    ]
  );
```

- [ ] **Step 2: Run the two test files to verify they fail**

Run: `npx tsx --test packages/cli/tests/style-core.test.ts packages/cli/tests/studio-styles-api.test.ts`
Expected: FAIL (`StyleOpticsSchema` / `deriveDefaultOpticsForSurface` undefined and `Optyka & Światło` missing from `sectionTitles`).

- [ ] **Step 3: Implement `StyleOpticsSchema`, helpers, 7 built-in presets, and loader normalization**

Update `packages/core/src/style/schema.ts` to add `StyleLightingRigSchema`, `StyleTypographyGrammarSchema`, `StyleOpticsSchema`, `optics: StyleOpticsSchema.optional()` inside `StylePresetSchema` (right between `motion` and `audioDefaults`), and the pure migration helpers at the bottom of `packages/core/src/style/schema.ts`:

```ts
export const StyleLightingRigSchema = z.enum([
  'window-gobo',
  'darkroom-halation',
  'studio-macro',
]);
export type StyleLightingRig = z.infer<typeof StyleLightingRigSchema>;

export const StyleTypographyGrammarSchema = z.enum([
  'swiss-spatial',
  'optical-gate',
  'risograph-poster',
]);
export type StyleTypographyGrammar = z.infer<
  typeof StyleTypographyGrammarSchema
>;

export const StyleOpticsSchema = z.object({
  lightingRig: StyleLightingRigSchema.describe(
    'Optyka & Światło :: Reżim oświetlenia sceny'
  ),
  typographyGrammar: StyleTypographyGrammarSchema.describe(
    'Optyka & Światło :: Gramatyka typografii kinetycznej'
  ),
  lightAngleDeg: z
    .number()
    .min(-60)
    .max(60)
    .describe('Optyka & Światło :: Kąt głównego światła (°)'),
  aperture: z
    .number()
    .min(0)
    .max(1)
    .describe('Optyka & Światło :: Przysłona / płytkość ostrości (0–1)'),
  halation: z
    .number()
    .min(0)
    .max(1)
    .describe('Optyka & Światło :: Halacja i rozproszenie świateł (0–1)'),
});
export type StyleOptics = z.infer<typeof StyleOpticsSchema>;
```

Inside `StylePresetSchema = z.object({ ... })` in `packages/core/src/style/schema.ts`, place `optics` directly after `motion`:

```ts
  optics: StyleOpticsSchema.optional(),

  audioDefaults: z.object({
    musicMood: StyleMusicMoodSchema.describe(
      'Domyślne Audio :: Nastrój muzyki'
    ),
    voiceArchetype: VoiceArchetypeSchema.describe(
      'Domyślne Audio :: Archetyp głosu lektora'
    ),
  }),
```

And append at the bottom of `packages/core/src/style/schema.ts`:

```ts
export function deriveDefaultOpticsForSurface(
  surface: StylePreset['surface']
): StyleOptics {
  if (surface.isDark) {
    return {
      lightingRig: 'darkroom-halation',
      typographyGrammar: 'optical-gate',
      lightAngleDeg: -24,
      aperture: 0.48,
      halation: 0.52,
    };
  }
  if (
    surface.backdropType === 'halftone-dots' ||
    surface.cardTreatment === 'brutalist-hard' ||
    surface.cardTreatment === 'tactile-cutout'
  ) {
    return {
      lightingRig: 'window-gobo',
      typographyGrammar: 'risograph-poster',
      lightAngleDeg: -32,
      aperture: 0.38,
      halation: 0.16,
    };
  }
  if (
    surface.backdropType === 'editorial-paper' ||
    surface.cardTreatment === 'editorial-ink'
  ) {
    return {
      lightingRig: 'window-gobo',
      typographyGrammar: 'swiss-spatial',
      lightAngleDeg: -28,
      aperture: 0.46,
      halation: 0.18,
    };
  }
  return {
    lightingRig: 'studio-macro',
    typographyGrammar: 'swiss-spatial',
    lightAngleDeg: -22,
    aperture: 0.36,
    halation: 0.08,
  };
}

export function resolveStyleOptics(style: StylePreset): StyleOptics {
  return style.optics ?? deriveDefaultOpticsForSurface(style.surface);
}

export function withNormalizedStyleOptics(style: StylePreset): StylePreset {
  if (style.optics) return style;
  return {
    ...style,
    optics: deriveDefaultOpticsForSurface(style.surface),
  };
}
```

Update `packages/core/src/style/presets.ts` so each of the 7 entries in `BUILT_IN_STYLES` includes its `optics` object right after `motion`:
- `'minimal-product'`: `optics: { lightingRig: 'studio-macro', typographyGrammar: 'swiss-spatial', lightAngleDeg: -20, aperture: 0.36, halation: 0.08 },`
- `'editorial-press'`: `optics: { lightingRig: 'window-gobo', typographyGrammar: 'swiss-spatial', lightAngleDeg: -28, aperture: 0.45, halation: 0.16 },`
- `'archival-chronicle'`: `optics: { lightingRig: 'window-gobo', typographyGrammar: 'swiss-spatial', lightAngleDeg: -34, aperture: 0.54, halation: 0.26 },`
- `'cyber-telemetry'`: `optics: { lightingRig: 'darkroom-halation', typographyGrammar: 'optical-gate', lightAngleDeg: -24, aperture: 0.5, halation: 0.58 },`
- `'brutalist-poster'`: `optics: { lightingRig: 'darkroom-halation', typographyGrammar: 'risograph-poster', lightAngleDeg: -38, aperture: 0.32, halation: 0.28 },`
- `'sketch-notebook'`: `optics: { lightingRig: 'window-gobo', typographyGrammar: 'risograph-poster', lightAngleDeg: -26, aperture: 0.38, halation: 0.12 },`
- `'tactile-craft'`: `optics: { lightingRig: 'window-gobo', typographyGrammar: 'risograph-poster', lightAngleDeg: -30, aperture: 0.48, halation: 0.2 },`

Update `packages/core/src/style/registry.ts` to normalize `optics` on registration and resolution:

```ts
import {
  BUILT_IN_STYLE_IDS,
  BUILT_IN_STYLES,
  isBuiltInStyleId,
} from './presets';
import {
  StylePresetSchema,
  withNormalizedStyleOptics,
  type StylePreset,
} from './schema';

const customStyleMap = new Map<string, StylePreset>();

export function registerCustomStyles(styles: StylePreset[]): void {
  for (const candidate of styles) {
    const parsed = StylePresetSchema.safeParse(candidate);
    if (!parsed.success) continue;
    if (isBuiltInStyleId(parsed.data.id)) continue;
    customStyleMap.set(
      parsed.data.id,
      withNormalizedStyleOptics(parsed.data)
    );
  }
}

export function clearCustomStyles(): void {
  customStyleMap.clear();
}

export function listAllStudioStyles(): Array<{
  preset: StylePreset;
  origin: 'built-in' | 'custom';
}> {
  const builtIns = BUILT_IN_STYLE_IDS.map((id) => ({
    preset: BUILT_IN_STYLES[id],
    origin: 'built-in' as const,
  }));
  const customs = Array.from(customStyleMap.values())
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((preset) => ({
      preset,
      origin: 'custom' as const,
    }));
  return [...builtIns, ...customs];
}

export function resolveStudioStyle(
  styleOrId?: string | StylePreset
): StylePreset {
  if (!styleOrId) {
    return BUILT_IN_STYLES['minimal-product'];
  }
  if (typeof styleOrId === 'object') {
    const parsed = StylePresetSchema.safeParse(styleOrId);
    return parsed.success
      ? withNormalizedStyleOptics(parsed.data)
      : BUILT_IN_STYLES['minimal-product'];
  }
  const trimmed = styleOrId.trim();
  const fromCustom = customStyleMap.get(trimmed);
  if (fromCustom) return fromCustom;
  if (isBuiltInStyleId(trimmed)) {
    return BUILT_IN_STYLES[trimmed];
  }
  return BUILT_IN_STYLES['minimal-product'];
}
```

In `packages/cli/src/commands/styles.ts`:
1. Import `withNormalizedStyleOptics` from `../../../core/src/style/presets`.
2. In `loadWorkspaceCustomStyles`, push `styles.push(withNormalizedStyleOptics(parsed.data));` instead of `styles.push(parsed.data);`.
3. In `runStyleNewCommand`, wrap `const preset = withNormalizedStyleOptics(StylePresetSchema.parse({ ... }));`.

In `packages/studio/src/server/index.ts`:
1. Import `withNormalizedStyleOptics` from `../../../core/src/style/schema`.
2. In `readCustomStylesFromDisk` (around line 544), push `styles.push(withNormalizedStyleOptics(parsed.data));`.
3. In `saveCustomStyleToDisk` (around line 630), normalize `const normalized = withNormalizedStyleOptics(parsed.data);` and write/return `normalized`.

- [ ] **Step 4: Run tests and typecheck to verify Task 1 passes**

Run: `npx tsx --test packages/cli/tests/style-core.test.ts packages/cli/tests/studio-styles-api.test.ts packages/cli/tests/styles-cli.test.ts && npm run typecheck`
Expected: PASS (all tests green, `tsc --noEmit` exits 0).

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/core/src/style/schema.ts packages/core/src/style/presets.ts packages/core/src/style/registry.ts packages/cli/src/commands/styles.ts packages/studio/src/server/index.ts packages/cli/tests/style-core.test.ts packages/cli/tests/studio-styles-api.test.ts
git commit -m "feat(core): add StylePreset.optics schema, 7 built-in optical profiles, and legacy surface migration"
```

---

### Task 2: 2.5D Multi-Plane Optical Engine (`OpticalStage2D`, `DepthPlane`, `StageLightingRig`, `getTactileSurfaceStyle`)

**Files:**
- Modify: `packages/core/src/camera/shotTypes.ts`
- Create: `packages/core/src/optics/math.ts`
- Create: `packages/core/src/optics/tactileSurface.ts`
- Create: `packages/core/src/optics/StageLightingRig.tsx`
- Create: `packages/core/src/optics/OpticalStage2D.tsx`
- Create: `packages/core/src/optics/index.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/package.json`
- Modify: `scripts/build-packages.ts`
- Modify: `packages/kits/src/vfx/index.ts`
- Test: `packages/cli/tests/optical-stage.test.ts`

**Interfaces:**
- Consumes: `resolveStyleOptics`, `getStyleSpringConfig`, `getCardChromeStyle`, `useStudioStyle`, `StylePreset` from `../style`; `evaluateDirectorCamera2D`, `DirectorCameraTelemetryProvider`, `publishFrameCameraTelemetry`, `StageNode2D`, `CameraImpulse`, `CameraTransitionMode2D` from `../camera`; `createSeededRandom` from `../utils`
- Produces (exported from `@make-pictures/core`, `@make-pictures/core/optics`, and re-exported from `@make-pictures/kits/vfx`):
  - `OpticalShot2D`, `EvaluateOpticalCamera2DParams`, `ResolvedOpticalCameraState2D`
  - `computeParallaxFactor(z: number): number`
  - `computeCircleOfConfusionPx(z: number, focalZ: number, aperture: number): number`
  - `computePlaneAtmosphericOpacity(z: number, focalZ: number): number`
  - `evaluateOpticalCamera2D(params: EvaluateOpticalCamera2DParams): ResolvedOpticalCameraState2D`
  - `TactileElevation = 'flat' | 'resting' | 'lifted' | 'floating'`
  - `computeDirectionalShadowVector(lightAngleDeg: number, distancePx: number): { dx: number; dy: number }`
  - `getTactileSurfaceStyle(style: StylePreset, options?: TactileSurfaceOptions): React.CSSProperties`
  - `<StageLightingRig />` (`StageLightingRigProps`)
  - `<OpticalStage2D />` (`OpticalStage2DProps`), `<DepthPlane />` (`DepthPlaneProps`), `useOpticalStage()`

- [ ] **Step 1: Write the failing test suite `packages/cli/tests/optical-stage.test.ts`**

Create `packages/cli/tests/optical-stage.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Thumbnail } from '@remotion/player';
import {
  BUILT_IN_STYLES,
  DepthPlane,
  OpticalStage2D,
  StageLightingRig,
  StyleProvider,
  computeCircleOfConfusionPx,
  computeDirectionalShadowVector,
  computeParallaxFactor,
  computePlaneAtmosphericOpacity,
  evaluateOpticalCamera2D,
  getTactileSurfaceStyle,
} from '../../core/src/index';
import * as vfxExports from '../../kits/src/vfx/index';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('computeParallaxFactor and computeCircleOfConfusionPx enforce physical Z parallax and <0.25px sharp focal deadzone', () => {
  const pBack = computeParallaxFactor(-1.0);
  const pMid = computeParallaxFactor(0);
  const pFront = computeParallaxFactor(0.8);

  assert.equal(pMid, 1);
  assert.ok(pBack < 1 && pBack >= 0.52);
  assert.ok(pFront > 1 && pFront <= 1.72);
  assert.equal(computeParallaxFactor(-10), 0.52);
  assert.equal(computeParallaxFactor(10), 1.72);

  // Exact focal plane and micro-deviations stay inside crisp 0px deadzone
  assert.equal(computeCircleOfConfusionPx(0, 0, 0.6), 0);
  assert.equal(computeCircleOfConfusionPx(0.02, 0, 0.5), 0);
  assert.equal(computeCircleOfConfusionPx(1.2, 0, 0), 0);

  // Off-focus planes scale monotonically with |z - focalZ| and aperture, clamped <= 18
  const blurNear = computeCircleOfConfusionPx(0.5, 0, 0.5);
  const blurFar = computeCircleOfConfusionPx(-1.0, 0, 0.5);
  const blurWideOpen = computeCircleOfConfusionPx(-1.0, 0, 0.9);
  assert.ok(blurNear >= 0.25);
  assert.ok(blurFar > blurNear);
  assert.ok(blurWideOpen > blurFar);
  assert.ok(computeCircleOfConfusionPx(-5, 0, 1) <= 18);

  assert.equal(computePlaneAtmosphericOpacity(0, 0), 1);
  assert.ok(computePlaneAtmosphericOpacity(-1.2, 0) >= 0.72);
  assert.ok(computePlaneAtmosphericOpacity(-1.2, 0) < 1);
});

test('getTactileSurfaceStyle casts directional shadow opposite to lightAngleDeg across elevations', () => {
  // Light coming from top-left (-28 deg) casts shadow toward bottom-right (dx > 0, dy > 0)
  const vecTopLeft = computeDirectionalShadowVector(-28, 20);
  assert.ok(vecTopLeft.dx > 0, `Expected dx > 0 for -28 deg, got ${vecTopLeft.dx}`);
  assert.ok(vecTopLeft.dy > 0, `Expected dy > 0 for -28 deg, got ${vecTopLeft.dy}`);

  // Light coming from top-right (+32 deg) casts shadow toward bottom-left (dx < 0, dy > 0)
  const vecTopRight = computeDirectionalShadowVector(32, 20);
  assert.ok(vecTopRight.dx < 0, `Expected dx < 0 for +32 deg, got ${vecTopRight.dx}`);
  assert.ok(vecTopRight.dy > 0, `Expected dy > 0 for +32 deg, got ${vecTopRight.dy}`);

  const resting = getTactileSurfaceStyle(BUILT_IN_STYLES['editorial-press'], {
    elevation: 'resting',
  });
  const lifted = getTactileSurfaceStyle(BUILT_IN_STYLES['editorial-press'], {
    elevation: 'lifted',
    tiltDeg: -0.8,
  });
  assert.ok(String(resting.boxShadow).includes(','));
  assert.notEqual(resting.boxShadow, lifted.boxShadow);
  assert.match(String(lifted.transform), /rotate\(-0\.8deg\)/);

  const brutal = getTactileSurfaceStyle(BUILT_IN_STYLES['brutalist-poster'], {
    elevation: 'lifted',
  });
  assert.equal(brutal.borderRadius, 0);
});

test('evaluateOpticalCamera2D interpolates rack focus (focalZ & aperture) and respects 9:16 Golden Safe Box', () => {
  const style = BUILT_IN_STYLES['archival-chronicle'];
  const nodes = {
    hero: { cx: 540, cy: 800, w: 720, h: 640 },
    detail: { cx: 540, cy: 1120, w: 680, h: 420 },
  };
  const shots = [
    { fromFrame: 0, target: 'hero', focalZ: 0, aperture: 0.45, label: 'Hero' },
    {
      fromFrame: 30,
      target: 'detail',
      focalZ: -0.65,
      aperture: 0.72,
      transition: 'glide' as const,
      label: 'Rack to sheet',
    },
  ];

  const atStart = evaluateOpticalCamera2D({
    frame: 10,
    fps: 60,
    stageWidth: 1080,
    stageHeight: 1920,
    style,
    nodes,
    shots,
  });
  assert.equal(atStart.focalZ, 0);
  assert.ok(Math.abs(atStart.aperture - 0.45) < 1e-4);
  assert.equal(atStart.telemetry.focalZ, 0);

  const midRack = evaluateOpticalCamera2D({
    frame: 42,
    fps: 60,
    stageWidth: 1080,
    stageHeight: 1920,
    style,
    nodes,
    shots,
  });
  assert.ok(midRack.focalZ < 0 && midRack.focalZ > -0.65);
  assert.ok(midRack.aperture > 0.45 && midRack.aperture < 0.72);

  const settled = evaluateOpticalCamera2D({
    frame: 140,
    fps: 60,
    stageWidth: 1080,
    stageHeight: 1920,
    style,
    nodes,
    shots,
  });
  assert.ok(Math.abs(settled.focalZ - -0.65) < 0.01);
  assert.ok(Math.abs(settled.aperture - 0.72) < 0.01);
});

test('StageLightingRig, OpticalStage2D, and DepthPlane obey Clean Frame 0 and filter:none on focal plane', () => {
  assert.equal(vfxExports.OpticalStage2D, OpticalStage2D);
  assert.equal(vfxExports.DepthPlane, DepthPlane);
  assert.equal(vfxExports.StageLightingRig, StageLightingRig);

  for (const styleId of [
    'editorial-press',
    'cyber-telemetry',
    'minimal-product',
  ] as const) {
    const TestScene: React.FC = () =>
      React.createElement(
        StyleProvider,
        { style: styleId },
        React.createElement(StageLightingRig),
        React.createElement(
          OpticalStage2D,
          {
            shots: [{ fromFrame: 0, focalZ: 0, zoom: 1.04 }],
          },
          React.createElement(
            DepthPlane,
            { z: -0.8 },
            React.createElement('div', { 'data-plane': 'bg' }, 'Tło robocze')
          ),
          React.createElement(
            DepthPlane,
            { z: 0 },
            React.createElement('div', { 'data-plane': 'hero' }, 'Ostra treść główna')
          )
        )
      );

    const frame0Html = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: TestScene,
        compositionWidth: 1920,
        compositionHeight: 1080,
        durationInFrames: 120,
        fps: 60,
        frameToDisplay: 0,
      })
    );
    assert.doesNotMatch(frame0Html, /Ostra treść główna/);
    assert.doesNotMatch(frame0Html, /data-lighting-rig/);

    const frame36Html = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: TestScene,
        compositionWidth: 1920,
        compositionHeight: 1080,
        durationInFrames: 120,
        fps: 60,
        frameToDisplay: 36,
      })
    );
    assert.match(frame36Html, /Ostra treść główna/);
    assert.match(frame36Html, /data-lighting-rig="/);
    // Background plane at z=-0.8 is blurred, while hero plane at z=0 has filter:none
    assert.match(frame36Html, /filter:blur\(/);
    assert.match(frame36Html, /filter:none/);
  }

  // Source audit: zero Math.random() and zero Three.js imports in packages/core/src/optics/
  const opticsDir = path.resolve(__dirname, '../../core/src/optics');
  for (const entry of fs.readdirSync(opticsDir)) {
    if (!entry.endsWith('.ts') && !entry.endsWith('.tsx')) continue;
    const src = fs.readFileSync(path.join(opticsDir, entry), 'utf8');
    assert.doesNotMatch(src, /Math\.random\s*\(/, `Forbidden Math.random in ${entry}`);
    assert.doesNotMatch(
      src,
      /@react-three\/fiber|from\s+['"]three['"]/,
      `Forbidden 3D import in ${entry}`
    );
  }
});
```

- [ ] **Step 2: Run `optical-stage.test.ts` to verify it fails**

Run: `npx tsx --test packages/cli/tests/optical-stage.test.ts`
Expected: FAIL (`OpticalStage2D`, `DepthPlane`, `StageLightingRig`, etc. are not exported from `../../core/src/index`).

- [ ] **Step 3: Extend `DirectorCameraTelemetry` and create `packages/core/src/optics/*` + package exports**

1. Update `packages/core/src/camera/shotTypes.ts` lines 86–130 so `DirectorCameraTelemetry` includes `focalZ?: number` and `aperture?: number`, and `publishFrameCameraTelemetry` checks both with `1e-3` tolerance:

```ts
export interface DirectorCameraTelemetry {
  /** Normalized instantaneous camera motion velocity in [0, 1] (peaks during whip-pans) */
  velocity: number;
  /** Distance from camera to current focal target in world units */
  focusDistance: number;
  /** Zero-based index of currently active shot in the sorted shot list */
  activeShotIndex: number;
  /** Optional human-readable shot label */
  activeShotLabel?: string;
  /** Active 2.5D focal plane Z coordinate (default 0) */
  focalZ?: number;
  /** Active optical aperture in [0, 1] controlling Circle of Confusion outside focalZ */
  aperture?: number;
}
```

And inside `publishFrameCameraTelemetry` in `packages/core/src/camera/shotTypes.ts`:

```ts
  const prev = FRAME_TELEMETRY_SLOTS.get(frame);
  if (
    prev &&
    Math.abs(prev.velocity - telemetry.velocity) < 1e-4 &&
    Math.abs(prev.focusDistance - telemetry.focusDistance) < 1e-3 &&
    Math.abs((prev.focalZ ?? 0) - (telemetry.focalZ ?? 0)) < 1e-3 &&
    Math.abs((prev.aperture ?? 0) - (telemetry.aperture ?? 0)) < 1e-3 &&
    prev.activeShotIndex === telemetry.activeShotIndex
  ) {
    return;
  }
```

2. Create `packages/core/src/optics/math.ts`:

```ts
import { spring } from 'remotion';
import {
  evaluateDirectorCamera2D,
  resolveShotsToKeyframes2D,
  type CameraImpulse,
  type CameraKeyframe2D,
  type CameraTransitionMode2D,
  type DirectorCameraTelemetry,
  type StageNode2D,
} from '../camera';
import {
  getStyleSpringConfig,
  resolveStyleOptics,
  type StylePreset,
} from '../style';

export interface OpticalShot2D {
  fromFrame: number;
  /** Named target(s) in `nodes`, or omit to center on `(x, y)` / viewport center */
  target?: string | string[];
  x?: number;
  y?: number;
  zoom?: number;
  rotateZ?: number;
  /** Active focal plane Z for this shot (default `0`) */
  focalZ?: number;
  /** Optional per-shot aperture override in `[0, 1]` */
  aperture?: number;
  transition?: CameraTransitionMode2D;
  padding?: number;
  label?: string;
}

export interface EvaluateOpticalCamera2DParams {
  frame: number;
  fps: number;
  stageWidth: number;
  stageHeight: number;
  style: StylePreset;
  nodes?: Record<string, StageNode2D>;
  shots?: ReadonlyArray<OpticalShot2D>;
  safeBox9x16Compensation?: boolean;
  handheldIntensity?: number;
  impulses?: ReadonlyArray<CameraImpulse>;
  seed?: number;
}

export interface ResolvedOpticalCameraState2D {
  x: number;
  y: number;
  zoom: number;
  rotateZ: number;
  focalZ: number;
  aperture: number;
  telemetry: DirectorCameraTelemetry;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Computes physical 2.5D parallax multiplier for plane `z` (`z ∈ [-2.0, +1.5]`).
 * Foreground (`z > 0`) translates faster than `z = 0`; background (`z < 0`) translates slower.
 */
export function computeParallaxFactor(z: number): number {
  const safeDenom = Math.max(0.25, 1 - z * 0.28);
  return clamp(1 / safeDenom, 0.52, 1.72);
}

/**
 * Computes Circle of Confusion blur radius in pixels for plane `z`.
 * Enforces a strict `< 0.25px` sharp deadzone returning `0` so vector fonts
 * on the active focal plane render with `filter: 'none'`.
 */
export function computeCircleOfConfusionPx(
  z: number,
  focalZ: number,
  aperture: number
): number {
  const clampedAperture = clamp(aperture, 0, 1);
  const rawBlur = Math.abs(z - focalZ) * clampedAperture * 14;
  if (rawBlur < 0.25) {
    return 0;
  }
  return clamp(rawBlur, 0.25, 18);
}

/**
 * Gentle atmospheric contrast/opacity falloff for background planes behind `focalZ - 0.5`.
 */
export function computePlaneAtmosphericOpacity(
  z: number,
  focalZ: number
): number {
  const behind = focalZ - z;
  if (behind <= 0.5) {
    return 1;
  }
  return clamp(1 - (behind - 0.5) * 0.18, 0.72, 1);
}

function buildKeyframesFromOpticalShots(
  shots: ReadonlyArray<OpticalShot2D>,
  nodes: Record<string, StageNode2D> | undefined,
  stageWidth: number,
  stageHeight: number,
  safeBox9x16Compensation: boolean
): CameraKeyframe2D[] {
  const sorted = [...shots].sort((a, b) => a.fromFrame - b.fromFrame);
  const centerX = stageWidth / 2;
  const centerY = stageHeight / 2;

  return sorted.map((shot) => {
    if (shot.target && nodes && Object.keys(nodes).length > 0) {
      const [resolved] = resolveShotsToKeyframes2D(
        nodes,
        [
          {
            fromFrame: shot.fromFrame,
            target: shot.target,
            transition: shot.transition,
            padding: shot.padding,
            zoom: shot.zoom,
            rotateZ: shot.rotateZ,
            label: shot.label,
          },
        ],
        stageWidth,
        stageHeight,
        safeBox9x16Compensation
      );
      if (resolved) {
        return {
          ...resolved,
          x: shot.x ?? resolved.x,
          y: shot.y ?? resolved.y,
        };
      }
    }

    return {
      startFrame: shot.fromFrame,
      x: shot.x ?? centerX,
      y: shot.y ?? centerY,
      zoom: shot.zoom ?? 1,
      rotateZ: shot.rotateZ ?? 0,
      transition: shot.transition ?? 'glide',
      label: shot.label,
    };
  });
}

/**
 * Pure deterministic 2.5D multi-plane optical camera & rack-focus solver.
 */
export function evaluateOpticalCamera2D(
  params: EvaluateOpticalCamera2DParams
): ResolvedOpticalCameraState2D {
  const {
    frame,
    fps,
    stageWidth,
    stageHeight,
    style,
    nodes,
    shots,
    safeBox9x16Compensation = true,
    handheldIntensity,
    impulses,
    seed = 2026,
  } = params;

  const optics = resolveStyleOptics(style);
  const effectiveHandheld = handheldIntensity ?? style.motion.cameraHandheld;

  const sortedShots =
    shots && shots.length > 0
      ? [...shots].sort((a, b) => a.fromFrame - b.fromFrame)
      : [
          {
            fromFrame: 0,
            x: stageWidth / 2,
            y: stageHeight / 2,
            zoom: 1,
            rotateZ: 0,
            focalZ: 0,
            aperture: optics.aperture,
          } satisfies OpticalShot2D,
        ];

  const keyframes = buildKeyframesFromOpticalShots(
    sortedShots,
    nodes,
    stageWidth,
    stageHeight,
    safeBox9x16Compensation
  );

  const baseCam = evaluateDirectorCamera2D({
    frame,
    fps,
    stageWidth,
    stageHeight,
    keyframes,
    safeBox9x16Compensation,
    handheldIntensity: effectiveHandheld,
    impulses,
    seed,
  });

  const cameraSpring = getStyleSpringConfig(style, 'camera');
  let focalZ = sortedShots[0]?.focalZ ?? 0;
  let aperture = clamp(sortedShots[0]?.aperture ?? optics.aperture, 0, 1);

  for (let i = 1; i < sortedShots.length; i++) {
    const prevShot = sortedShots[i - 1]!;
    const currShot = sortedShots[i]!;
    if (frame < currShot.fromFrame) {
      break;
    }

    const prevFocal = prevShot.focalZ ?? 0;
    const currFocal = currShot.focalZ ?? 0;
    const prevAperture = clamp(prevShot.aperture ?? optics.aperture, 0, 1);
    const currAperture = clamp(currShot.aperture ?? optics.aperture, 0, 1);
    const mode = currShot.transition ?? 'glide';

    if (mode === 'cut') {
      focalZ = currFocal;
      aperture = currAperture;
      continue;
    }

    const p = spring({
      frame: frame - currShot.fromFrame,
      fps,
      config:
        mode === 'whip'
          ? { damping: 200, stiffness: 150, mass: 0.78 }
          : cameraSpring,
    });
    focalZ += (currFocal - prevFocal) * p;
    aperture = clamp(aperture + (currAperture - prevAperture) * p, 0, 1);
  }

  const telemetry: DirectorCameraTelemetry = {
    ...baseCam.telemetry,
    focalZ,
    aperture,
  };

  return {
    x: baseCam.x,
    y: baseCam.y,
    zoom: baseCam.zoom,
    rotateZ: baseCam.rotateZ,
    focalZ,
    aperture,
    telemetry,
  };
}
```

3. Create `packages/core/src/optics/tactileSurface.ts`:

```ts
import type React from 'react';
import {
  getCardChromeStyle,
  resolveStyleOptics,
  type StylePreset,
} from '../style';

export type TactileElevation = 'flat' | 'resting' | 'lifted' | 'floating';

export interface TactileSurfaceOptions {
  elevation?: TactileElevation;
  tiltDeg?: number;
  lightAngleDeg?: number;
  overrides?: React.CSSProperties;
}

const ELEVATION_SPECS: Record<
  TactileElevation,
  { dist: number; blur: number; contactBlur: number; alphaScale: number }
> = {
  flat: { dist: 2, blur: 4, contactBlur: 1.5, alphaScale: 0.55 },
  resting: { dist: 9, blur: 20, contactBlur: 2.5, alphaScale: 0.9 },
  lifted: { dist: 18, blur: 34, contactBlur: 3.5, alphaScale: 1.15 },
  floating: { dist: 28, blur: 52, contactBlur: 5, alphaScale: 1.35 },
};

/**
 * Converts `lightAngleDeg` (`[-60, +60]`, where `0°` is straight from top,
 * negative angles come from top-left, positive angles from top-right) into
 * the opposite `(dx, dy)` cast-shadow vector on the table plane.
 */
export function computeDirectionalShadowVector(
  lightAngleDeg: number,
  distancePx: number
): { dx: number; dy: number } {
  const rad = (lightAngleDeg * Math.PI) / 180;
  const dx = Number((-Math.sin(rad) * distancePx).toFixed(2));
  const dy = Number((Math.cos(rad) * distancePx).toFixed(2));
  return { dx, dy };
}

/**
 * Builds physical two-stage (tight contact + directional cast) surface styling
 * coupled to `style.optics.lightAngleDeg`, `style.optics.lightingRig`, and `style.surface.cardTreatment`.
 */
export function getTactileSurfaceStyle(
  style: StylePreset,
  options?: TactileSurfaceOptions
): React.CSSProperties {
  const optics = resolveStyleOptics(style);
  const elevation = options?.elevation ?? 'resting';
  const angle = options?.lightAngleDeg ?? optics.lightAngleDeg;
  const spec = ELEVATION_SPECS[elevation];
  const { dx, dy } = computeDirectionalShadowVector(angle, spec.dist);

  const baseChrome = getCardChromeStyle(style);
  const { palette, surface } = style;

  let boxShadow: string;
  if (surface.cardTreatment === 'brutalist-hard') {
    const hardOffset = Math.max(3, Math.round(spec.dist * 0.55));
    const hardDx = angle <= 0 ? hardOffset : -hardOffset;
    boxShadow = `${hardDx}px ${hardOffset}px 0px ${palette.inkBorder}`;
  } else if (surface.isDark || optics.lightingRig === 'darkroom-halation') {
    const glowRadius = Math.round(18 + optics.halation * 34);
    const glowAlpha = Math.min(0.45, Number((0.1 + optics.halation * 0.28).toFixed(2)));
    boxShadow = `0 1.5px ${spec.contactBlur}px rgba(0, 0, 0, 0.62), ${dx}px ${dy}px ${spec.blur}px rgba(0, 0, 0, 0.52), 0 0 ${glowRadius}px rgba(255, 255, 255, ${glowAlpha * 0.16})`;
  } else {
    const contactAlpha = Number((0.12 * spec.alphaScale).toFixed(3));
    const castAlpha = Number((0.095 * spec.alphaScale).toFixed(3));
    boxShadow = `0 1.5px ${spec.contactBlur}px rgba(24, 22, 21, ${contactAlpha}), ${dx}px ${dy}px ${spec.blur}px rgba(24, 22, 21, ${castAlpha})`;
  }

  const paperTextureOverlay =
    !surface.isDark &&
    (surface.cardTreatment === 'editorial-ink' ||
      surface.cardTreatment === 'tactile-cutout')
      ? `linear-gradient(${135 + angle}deg, rgba(255,255,255,0.52) 0%, rgba(255,255,255,0) 56%)`
      : undefined;

  const tiltTransform =
    typeof options?.tiltDeg === 'number' && Math.abs(options.tiltDeg) > 0.001
      ? `rotate(${Number(options.tiltDeg.toFixed(3))}deg)`
      : undefined;

  const result: React.CSSProperties = {
    ...baseChrome,
    boxShadow,
    ...(paperTextureOverlay ? { backgroundImage: paperTextureOverlay } : {}),
    ...(tiltTransform ? { transform: tiltTransform } : {}),
  };

  if (!options?.overrides) {
    return result;
  }

  const mergedTransform =
    tiltTransform && options.overrides.transform
      ? `${options.overrides.transform} ${tiltTransform}`
      : options.overrides.transform ?? tiltTransform;

  return {
    ...result,
    ...options.overrides,
    ...(mergedTransform ? { transform: mergedTransform } : {}),
  };
}
```

4. Create `packages/core/src/optics/StageLightingRig.tsx`:

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { useDirectorCameraTelemetry } from '../camera';
import {
  resolveStyleOptics,
  useStudioStyle,
  type StyleLightingRig,
  type StylePreset,
} from '../style';
import { createSeededRandom } from '../utils';
import { useOpticalStage } from './OpticalStage2D';

export interface StageLightingRigProps {
  style?: StylePreset;
  /** Optional override of `style.optics.lightingRig` */
  rig?: StyleLightingRig;
  /** Deterministic PRNG seed for analog grain & light drift */
  seed?: string | number;
  /** Render solid `palette.bgCanvas` base fill behind light layers (default `true`) */
  renderBaseFill?: boolean;
  className?: string;
}

/**
 * Directional 60 FPS Stage Lighting Rig (`window-gobo`, `darkroom-halation`, `studio-macro`).
 * Enforces Clean Frame 0 (`frame <= 0` renders pure `palette.bgCanvas` with zero patterns or grain).
 */
export const StageLightingRig: React.FC<StageLightingRigProps> = ({
  style: styleProp,
  rig: rigOverride,
  seed = 'stage-lighting-v1',
  renderBaseFill = true,
  className,
}) => {
  const frame = useCurrentFrame();
  const contextStyle = useStudioStyle();
  const style = styleProp ?? contextStyle;
  const telemetry = useDirectorCameraTelemetry();
  const opticalStage = useOpticalStage();

  const { palette, surface } = style;

  // Clean Frame 0 invariant: pure canvas color only.
  if (frame <= 0) {
    return renderBaseFill ? (
      <AbsoluteFill
        className={className}
        style={{ backgroundColor: palette.bgCanvas, pointerEvents: 'none' }}
      />
    ) : null;
  }

  const optics = resolveStyleOptics(style);
  const activeRig = rigOverride ?? optics.lightingRig;
  const angle = optics.lightAngleDeg;
  const halation = optics.halation;

  // Deterministic subtle breathing & grain jitter per frame (zero Math.random())
  const grainRng = createSeededRandom(`${seed}:f:${frame}`);
  const grainOffsetX = Math.round(grainRng() * 11);
  const grainOffsetY = Math.round(grainRng() * 11);
  const goboDriftPx = Math.sin(frame * 0.014) * 18;
  const camShiftPct = opticalStage
    ? ((opticalStage.camera.x - opticalStage.stageWidth / 2) /
        Math.max(1, opticalStage.stageWidth)) *
        42 +
      ((opticalStage.camera.y - opticalStage.stageHeight / 2) /
        Math.max(1, opticalStage.stageHeight)) *
        24
    : 0;
  const sweepProgress =
    50 + camShiftPct + Math.sin(frame * 0.02 + angle * 0.03) * 18;

  const lightGradientAngle = 135 + angle;

  return (
    <AbsoluteFill
      className={className}
      data-lighting-rig={activeRig}
      style={{
        backgroundColor: renderBaseFill ? palette.bgCanvas : 'transparent',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {/* 1. Regime-Specific Directional Key Light & Gobo / Lightbox / Specular Layer */}
      {activeRig === 'window-gobo' && (
        <>
          <AbsoluteFill
            style={{
              backgroundImage: surface.isDark
                ? `linear-gradient(${lightGradientAngle}deg, ${palette.bgElevated}AA 0%, transparent 62%), radial-gradient(circle at 22% 18%, ${palette.accentPrimary}1F 0%, transparent 56%)`
                : `linear-gradient(${lightGradientAngle}deg, rgba(255, 252, 244, 0.78) 0%, transparent 58%), radial-gradient(circle at 84% 88%, ${palette.bgElevated}CC 0%, transparent 62%)`,
            }}
          />
          {/* Soft penumbra window mullion / blind gobo bars */}
          <AbsoluteFill
            style={{
              opacity: surface.isDark ? 0.22 : 0.14,
              mixBlendMode: surface.isDark ? 'screen' : 'multiply',
              filter: 'blur(14px)',
              transform: `translate3d(${goboDriftPx.toFixed(2)}px, 0, 0) rotate(${angle * 0.55}deg) scale(1.22)`,
              backgroundImage: surface.isDark
                ? `repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0px, rgba(255,255,255,0.12) 54px, transparent 54px, transparent 138px)`
                : `repeating-linear-gradient(90deg, ${palette.inkBorder}88 0px, ${palette.inkBorder}88 46px, transparent 46px, transparent 136px)`,
            }}
          />
          <AbsoluteFill
            style={{
              backgroundImage: surface.isDark
                ? 'radial-gradient(circle at 50% 48%, transparent 52%, rgba(0, 0, 0, 0.48) 100%)'
                : `radial-gradient(circle at 50% 48%, transparent 56%, ${palette.inkBorder}42 100%)`,
            }}
          />
        </>
      )}

      {activeRig === 'darkroom-halation' && (
        <>
          {/* Central lightbox / darkroom enlarger glow + edge falloff */}
          <AbsoluteFill
            style={{
              backgroundImage: surface.isDark
                ? `radial-gradient(ellipse at 50% 46%, ${palette.bgElevated}E6 0%, ${palette.bgCanvas} 76%), radial-gradient(circle at ${38 - angle * 0.25}% 34%, ${withColorAlpha(
                    palette.accentPrimary,
                    0.12 + halation * 0.22
                  )} 0%, transparent 56%)`
                : `radial-gradient(ellipse at 50% 46%, #FFFFFF 0%, ${palette.bgCanvas} 72%), radial-gradient(circle at 50% 48%, ${withColorAlpha(
                    palette.accentPrimary,
                    0.12
                  )} 0%, transparent 58%)`,
            }}
          />
          {/* Anamorphic streak coupled to halation + camera velocity */}
          <AbsoluteFill
            style={{
              opacity: Math.min(0.85, 0.18 + halation * 0.42 + telemetry.velocity * 0.28),
              backgroundImage: `linear-gradient(${90 + angle * 0.2}deg, transparent 8%, ${withColorAlpha(
                palette.accentPrimary,
                0.15
              )} 48%, ${withColorAlpha(palette.accentSecondary, 0.13)} 54%, transparent 92%)`,
              filter: 'blur(22px)',
            }}
          />
          <AbsoluteFill
            style={{
              backgroundImage: surface.isDark
                ? 'radial-gradient(circle at 50% 50%, transparent 44%, rgba(2, 4, 10, 0.68) 100%)'
                : `radial-gradient(circle at 50% 50%, transparent 52%, ${withColorAlpha(
                    palette.inkBorder,
                    0.33
                  )} 100%)`,
            }}
          />
        </>
      )}

      {activeRig === 'studio-macro' && (
        <>
          <AbsoluteFill
            style={{
              backgroundImage: surface.isDark
                ? `linear-gradient(${lightGradientAngle}deg, ${withColorAlpha(
                    palette.bgElevated,
                    0.73
                  )} 0%, ${palette.bgCanvas} 74%)`
                : `linear-gradient(${lightGradientAngle}deg, #FFFFFF 0%, ${palette.bgCanvas} 68%, ${withColorAlpha(
                    palette.bgElevated,
                    0.53
                  )} 100%)`,
            }}
          />
          {/* Moving softbox specular sweep */}
          <AbsoluteFill
            style={{
              opacity: surface.isDark ? 0.16 : 0.46,
              backgroundImage: `linear-gradient(${108 + angle * 0.4}deg, transparent ${sweepProgress - 18}%, rgba(255, 255, 255, 0.72) ${sweepProgress}%, transparent ${sweepProgress + 18}%)`,
              filter: 'blur(18px)',
            }}
          />
        </>
      )}

      {/* 2. Deterministic Per-Frame Analog Film Grain */}
      {surface.grainOpacity > 0 && (
        <AbsoluteFill
          style={{
            opacity: surface.grainOpacity,
            backgroundImage:
              'radial-gradient(rgba(128, 128, 128, 0.48) 0.8px, transparent 0.8px)',
            backgroundSize: '6px 6px',
            backgroundPosition: `${grainOffsetX}px ${grainOffsetY}px`,
            mixBlendMode: surface.isDark ? 'screen' : 'multiply',
          }}
        />
      )}
    </AbsoluteFill>
  );
};

function withColorAlpha(color: string, alpha01: number): string {
  const clamped = Math.max(0, Math.min(1, alpha01));
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    const byte = Math.round(clamped * 255)
      .toString(16)
      .padStart(2, '0');
    return `${color}${byte}`;
  }
  return color;
}
```

5. Create `packages/core/src/optics/OpticalStage2D.tsx`:

```tsx
import React, { createContext, useContext, useLayoutEffect, useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  DirectorCameraTelemetryProvider,
  publishFrameCameraTelemetry,
  type CameraImpulse,
  type StageNode2D,
} from '../camera';
import { useStudioStyle } from '../style';
import {
  computeCircleOfConfusionPx,
  computeParallaxFactor,
  computePlaneAtmosphericOpacity,
  evaluateOpticalCamera2D,
  type OpticalShot2D,
  type ResolvedOpticalCameraState2D,
} from './math';

export interface OpticalStageContextValue {
  camera: ResolvedOpticalCameraState2D;
  stageWidth: number;
  stageHeight: number;
}

const OpticalStageContext = createContext<OpticalStageContextValue | null>(null);

export function useOpticalStage(): OpticalStageContextValue | null {
  return useContext(OpticalStageContext);
}

export interface OpticalStage2DProps {
  nodes?: Record<string, StageNode2D>;
  shots?: ReadonlyArray<OpticalShot2D>;
  stageWidth?: number;
  stageHeight?: number;
  safeBox9x16Compensation?: boolean;
  handheldIntensity?: number;
  impulses?: ReadonlyArray<CameraImpulse>;
  seed?: number;
  /** Minimum frame before stage contents mount (default `1` so Frame `0` stays pure `bgCanvas`) */
  startFrame?: number;
  overlay?: React.ReactNode;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * Multi-plane 2.5D Optical Camera Stage (`60 FPS` deterministic).
 * Drives child `<DepthPlane z={...} />` layers with true Z-parallax,
 * `9:16 Golden Safe Box` compensation, and Circle-of-Confusion rack focus.
 */
export const OpticalStage2D: React.FC<OpticalStage2DProps> = ({
  nodes,
  shots,
  stageWidth,
  stageHeight,
  safeBox9x16Compensation = true,
  handheldIntensity,
  impulses,
  seed = 2026,
  startFrame = 1,
  overlay,
  style: styleOverrides,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const studioStyle = useStudioStyle();

  const effectiveWidth = stageWidth ?? width;
  const effectiveHeight = stageHeight ?? height;

  const camera = useMemo(
    () =>
      evaluateOpticalCamera2D({
        frame,
        fps,
        stageWidth: effectiveWidth,
        stageHeight: effectiveHeight,
        style: studioStyle,
        nodes,
        shots,
        safeBox9x16Compensation,
        handheldIntensity,
        impulses,
        seed,
      }),
    [
      frame,
      fps,
      effectiveWidth,
      effectiveHeight,
      studioStyle,
      nodes,
      shots,
      safeBox9x16Compensation,
      handheldIntensity,
      impulses,
      seed,
    ]
  );

  useLayoutEffect(() => {
    publishFrameCameraTelemetry(frame, camera.telemetry);
  }, [frame, camera.telemetry]);

  const contextVal = useMemo<OpticalStageContextValue>(
    () => ({
      camera,
      stageWidth: effectiveWidth,
      stageHeight: effectiveHeight,
    }),
    [camera, effectiveWidth, effectiveHeight]
  );

  // Clean Frame 0 guard
  if (frame <= 0 || frame < startFrame) {
    return null;
  }

  return (
    <DirectorCameraTelemetryProvider telemetry={camera.telemetry}>
      <OpticalStageContext.Provider value={contextVal}>
        <AbsoluteFill
          style={{
            overflow: 'hidden',
            pointerEvents: 'none',
            ...styleOverrides,
          }}
        >
          {children}
          {overlay}
        </AbsoluteFill>
      </OpticalStageContext.Provider>
    </DirectorCameraTelemetryProvider>
  );
};

export interface DepthPlaneProps {
  /** Depth coordinate in `[-2.0, +1.5]` (`0` = primary hero plane, `< 0` = background, `> 0` = foreground) */
  z?: number;
  /** Disable optical Circle-of-Confusion blur on this plane if needed */
  disableFocusBlur?: boolean;
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Physical Z-plane inside `<OpticalStage2D />`.
 * Applies parallax-scaled camera translation/zoom and Circle-of-Confusion blur (`filter: 'none'` inside `< 0.25px` deadzone).
 */
export const DepthPlane: React.FC<DepthPlaneProps> = ({
  z = 0,
  disableFocusBlur = false,
  style,
  className,
  children,
}) => {
  const stage = useOpticalStage();

  if (!stage) {
    return (
      <AbsoluteFill className={className} style={style}>
        {children}
      </AbsoluteFill>
    );
  }

  const { camera, stageWidth, stageHeight } = stage;
  const centerX = stageWidth / 2;
  const centerY = stageHeight / 2;

  const parallax = computeParallaxFactor(z);
  const dx = (camera.x - centerX) * parallax;
  const dy = (camera.y - centerY) * parallax;
  const planeScale = Math.max(0.15, 1 + (camera.zoom - 1) * parallax);
  const planeRotate = camera.rotateZ * (0.65 + 0.35 * Math.min(1.2, parallax));

  const blurPx = disableFocusBlur
    ? 0
    : computeCircleOfConfusionPx(z, camera.focalZ, camera.aperture);
  const filterCss = blurPx === 0 ? 'none' : `blur(${blurPx.toFixed(2)}px)`;
  const planeOpacity = computePlaneAtmosphericOpacity(z, camera.focalZ);

  return (
    <AbsoluteFill
      className={className}
      data-depth-z={z}
      style={{
        transformOrigin: '50% 50%',
        transform: `translate3d(${(-dx).toFixed(2)}px, ${(-dy).toFixed(2)}px, 0) scale(${planeScale.toFixed(4)}) rotate(${planeRotate.toFixed(3)}deg)`,
        filter: filterCss,
        opacity: planeOpacity,
        pointerEvents: 'none',
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
```

6. Create `packages/core/src/optics/index.ts`:

```ts
export * from './math';
export * from './tactileSurface';
export * from './StageLightingRig';
export * from './OpticalStage2D';
```

7. Update `packages/core/src/index.ts` to export `./optics`:

```ts
export * from './types';
export * from './production';
export * from './theme';
export * from './utils';
export * from './audio';
export * from './camera';
export * from './style';
export * from './optics';
export type { VoiceAcousticPreset } from './types';
```

8. In `packages/core/package.json`, add `"./optics"` inside `"exports"` right after `"./camera"`:

```json
    "./optics": {
      "types": "./dist/optics/index.d.ts",
      "import": "./dist/optics/index.mjs",
      "require": "./dist/optics/index.cjs"
    },
```

9. In `scripts/build-packages.ts`, add `{ outSubpath: 'optics/index', srcRelPath: 'src/optics/index.ts', platform: 'browser' }` inside `core` `entries` right after `camera/index`.

10. Update `packages/kits/src/vfx/index.ts` to re-export the 2.5D optical primitives from `@make-pictures/core`:

```ts
export * from './CinematicLensOverlay';
export * from './ParticleField';
export * from './StagePostProcessing3D';
export * from './SceneTransition';
export {
  OpticalStage2D,
  DepthPlane,
  StageLightingRig,
  useOpticalStage,
  computeParallaxFactor,
  computeCircleOfConfusionPx,
  computePlaneAtmosphericOpacity,
  evaluateOpticalCamera2D,
  computeDirectionalShadowVector,
  getTactileSurfaceStyle,
  type OpticalShot2D,
  type OpticalStage2DProps,
  type DepthPlaneProps,
  type StageLightingRigProps,
  type TactileElevation,
  type TactileSurfaceOptions,
} from '@make-pictures/core';
```

- [ ] **Step 4: Build packages, run optical + hermetic tests, and typecheck**

Run: `npm run build:packages && npx tsx --test packages/cli/tests/optical-stage.test.ts packages/cli/tests/npx-hermetic-optional-peers.test.ts && npm run typecheck`
Expected: PASS (`@make-pictures/core` builds cleanly with `./optics`, zero Three.js runtime imports in `core/dist`, all tests pass).

- [ ] **Step 5: Commit Task 2**

```bash
git add packages/core/src/camera/shotTypes.ts packages/core/src/optics packages/core/src/index.ts packages/core/package.json scripts/build-packages.ts packages/kits/src/vfx/index.ts packages/cli/tests/optical-stage.test.ts
git commit -m "feat(core): add 2.5D multi-plane optical engine, directional lighting rig, and tactile shadows"
```

---

### Task 3: Rebuild `@make-pictures/kits/editorial-collage` (Analog Editorial Desk & Lightbox)

**Files:**
- Create: `packages/kits/src/editorial-collage/EditorialDeskStage.tsx`
- Modify: `packages/kits/src/editorial-collage/EditorialMediaCard.tsx`
- Modify: `packages/kits/src/editorial-collage/HighlightQuoteStage.tsx`
- Modify: `packages/kits/src/editorial-collage/ChapterTitleCard.tsx`
- Modify: `packages/kits/src/editorial-collage/SplitStoryLayout.tsx`
- Modify: `packages/kits/src/editorial-collage/index.ts`
- Test: `packages/cli/tests/narrative-kits.test.ts`

**Interfaces:**
- Consumes: `OpticalStage2D`, `DepthPlane`, `StageLightingRig`, `getTactileSurfaceStyle`, `resolveStyleOptics`, `createSeededRandom`, `formatFontFamilyCss`, `formatHeadingText`, `getStyleSpringConfig`, `useStudioStyle`, `type OpticalShot2D`, `type StageNode2D`, `type WordTimestamp` from `@make-pictures/core`
- Produces (exported from `@make-pictures/kits/editorial-collage` and `@make-pictures/kits`):
  - `EditorialDeskStage` (`EditorialDeskStageProps`)
  - `EditorialMediaCard` (`EditorialMediaCardProps` extended with `mountType?: 'auto' | 'archival-tape' | 'photo-corners' | 'slide-mount' | 'none'` and `tiltDeg?: number`)
  - `HighlightQuoteStage` (`HighlightQuoteStageProps`), `resolveHighlightStartFrame`
  - `ChapterTitleCard` (`ChapterTitleCardProps`)
  - `SplitStoryLayout` (`SplitStoryLayoutProps` extended with `focusShiftFrame?: number` and `initialFocus?: 'both' | 'primary'`), `SplitStorySlotContext`, `computeSplitStoryVerticalBounds`

- [ ] **Step 1: Add failing tests for `EditorialDeskStage`, mounts, ink brush, and rack-focus split in `packages/cli/tests/narrative-kits.test.ts`**

Update `packages/cli/tests/narrative-kits.test.ts` to import `React`, `renderToStaticMarkup` from `'react-dom/server'`, `Thumbnail` from `'@remotion/player'`, `StyleProvider` from `'../../core/src/index'`, and `EditorialDeskStage` from `'../../kits/src/editorial-collage'`, then add `assert.equal(typeof EditorialDeskStage, 'function')` + `assert.equal(kitsRoot.EditorialDeskStage, EditorialDeskStage)` in the first test, and append this new test at the bottom of `packages/cli/tests/narrative-kits.test.ts`:

```ts
test('EditorialDeskStage, baryta/slide EditorialMediaCard, ink-brush HighlightQuoteStage, and SplitStoryLayout rack focus render cleanly across styles and 9:16', () => {
  for (const styleId of [
    'editorial-press',
    'archival-chronicle',
    'cyber-telemetry',
    'minimal-product',
  ] as const) {
    const SceneComp: React.FC = () =>
      React.createElement(
        StyleProvider,
        { style: styleId },
        React.createElement(
          EditorialDeskStage,
          { sheetCode: 'ARKUSZ 04 • KRONIKA' },
          React.createElement(SplitStoryLayout, {
            startFrame: 2,
            focusShiftFrame: 40,
            initialFocus: 'primary',
            primary: React.createElement(EditorialMediaCard, {
              caption: 'Rękopis z żółtą pieczęcią cechową',
              sourceTag: 'ARCHIWUM • 1889',
              startFrame: 2,
            }),
            secondary: React.createElement(HighlightQuoteStage, {
              quote: 'Każda warstwa papieru niesie ślad światła i dłoni.',
              highlightPhrase: 'ślad światła',
              author: 'Kronika rzemiosła',
              startFrame: 2,
              highlightFrame: 18,
            }),
          })
        )
      );

    // Frame 0 invariant: pure bgCanvas, zero card text
    const htmlF0 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: SceneComp,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 120,
        fps: 60,
        frameToDisplay: 0,
      })
    );
    assert.doesNotMatch(htmlF0, /Rękopis z żółtą/);
    assert.doesNotMatch(htmlF0, /ARKUSZ 04/);

    // Frame 24 (before focusShiftFrame=40): primary sharp, contact-sheet SVG fallback rendered, ink-brush SVG present
    const htmlF24 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: SceneComp,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 120,
        fps: 60,
        frameToDisplay: 24,
      })
    );
    assert.match(htmlF24, /Rękopis z żółtą pieczęcią cechową/);
    assert.match(htmlF24, /data-mount-type="/);
    assert.match(htmlF24, /data-contact-sheet="true"/);
    assert.match(htmlF24, /data-ink-brush="true"/);

    // Frame 90 (after focusShiftFrame=40): rack focus shifted cleanly
    const htmlF90 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: SceneComp,
        compositionWidth: 1920,
        compositionHeight: 1080,
        durationInFrames: 120,
        fps: 60,
        frameToDisplay: 90,
      })
    );
    assert.match(htmlF90, /Każda warstwa papieru/);
    if (styleId === 'cyber-telemetry') {
      assert.match(htmlF90, /data-mount-type="slide-mount"/);
    }
    if (styleId === 'archival-chronicle') {
      assert.match(htmlF90, /data-mount-type="photo-corners"/);
    }
  }

  // ChapterTitleCard optical focus pull settles to crisp filter:none
  const ChapterComp: React.FC = () =>
    React.createElement(
      StyleProvider,
      { style: 'editorial-press' },
      React.createElement(ChapterTitleCard, {
        chapterLabel: 'Rozdział 01',
        title: 'Zażółć gęślą jaźń',
        subtitle: 'Szlachetna typografia i światło boczne',
        startFrame: 2,
      })
    );
  const chapterEarly = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: ChapterComp,
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 120,
      fps: 60,
      frameToDisplay: 4,
    })
  );
  const chapterSettled = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: ChapterComp,
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 120,
      fps: 60,
      frameToDisplay: 48,
    })
  );
  assert.match(chapterEarly, /filter:blur\(/);
  assert.match(chapterSettled, /filter:none/);
});
```

- [ ] **Step 2: Run `narrative-kits.test.ts` to verify it fails**

Run: `npx tsx --test packages/cli/tests/narrative-kits.test.ts`
Expected: FAIL (`EditorialDeskStage` is undefined and `data-mount-type` / `data-ink-brush` / focus-pull assertions fail).

- [ ] **Step 3: Create `EditorialDeskStage.tsx` and rebuild `EditorialMediaCard.tsx`, `HighlightQuoteStage.tsx`, `ChapterTitleCard.tsx`, `SplitStoryLayout.tsx`, and `index.ts`**

1. Create `packages/kits/src/editorial-collage/EditorialDeskStage.tsx`:

```tsx
import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  DepthPlane,
  OpticalStage2D,
  StageLightingRig,
  formatFontFamilyCss,
  useStudioStyle,
  type OpticalShot2D,
  type StageNode2D,
} from '@make-pictures/core';

export interface EditorialDeskStageProps {
  shots?: ReadonlyArray<OpticalShot2D>;
  nodes?: Record<string, StageNode2D>;
  /** Archival registration code printed on the background proof sheet (`z = -0.65`) */
  sheetCode?: string;
  /** Render subtle out-of-focus foreground accents on plane `z = +0.75` outside Safe Box (default `true`) */
  foregroundAccents?: boolean;
  /** Render base fill inside StageLightingRig (default `true`) */
  renderBaseFill?: boolean;
  seed?: number;
  children?: React.ReactNode;
}

/**
 * Multi-plane 2.5D Analog Editorial Desk / Lightbox Stage.
 * Combines `<StageLightingRig />` with `<OpticalStage2D />` across 3 Z-planes:
 * - `z = -0.65`: Archival proof sheet with crop marks & column registration rules
 * - `z =  0.00`: Primary editorial content (`children`)
 * - `z = +0.75`: Edge-safe optical foreground millimeter ruler & stamp bokeh
 */
export const EditorialDeskStage: React.FC<EditorialDeskStageProps> = ({
  shots,
  nodes,
  sheetCode = 'ARKUSZ REDAKCYJNY • 60 FPS',
  foregroundAccents = true,
  renderBaseFill = true,
  seed = 2026,
  children,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const style = useStudioStyle();
  const isVertical = height > width;

  const defaultShots = useMemo<ReadonlyArray<OpticalShot2D>>(() => {
    const cx = width / 2;
    const cy = height / 2;
    return [
      {
        fromFrame: 0,
        x: cx,
        y: cy + 8,
        zoom: 1.0,
        focalZ: 0.35,
        transition: 'cut',
        label: 'Desk Rack In',
      },
      {
        fromFrame: 6,
        x: cx - 6,
        y: cy,
        zoom: 1.028,
        focalZ: 0,
        transition: 'glide',
        label: 'Desk Hero Focus',
      },
      {
        fromFrame: Math.max(24, Math.round(durationInFrames * 0.55)),
        x: cx + 8,
        y: cy - 4,
        zoom: 1.045,
        focalZ: 0,
        transition: 'glide',
        label: 'Desk Micro Dolly',
      },
    ];
  }, [width, height, durationInFrames]);

  // Clean Frame 0 invariant
  if (frame <= 0) {
    return renderBaseFill ? (
      <AbsoluteFill
        style={{ backgroundColor: style.palette.bgCanvas, pointerEvents: 'none' }}
      />
    ) : null;
  }

  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');
  const markColor = style.surface.isDark
    ? 'rgba(248, 250, 252, 0.22)'
    : `${style.palette.inkBorder}AA`;

  const insetX = isVertical ? 36 : 64;
  const insetTop = isVertical ? 196 : 48;
  const insetBottom = isVertical ? 496 : 48;

  return (
    <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
      <StageLightingRig
        style={style}
        seed={`editorial-desk:${seed}`}
        renderBaseFill={renderBaseFill}
      />

      <OpticalStage2D
        nodes={nodes}
        shots={shots && shots.length > 0 ? shots : defaultShots}
        seed={seed}
        startFrame={1}
      >
        {/* Plane z = -0.65: Background Archival Registration Sheet */}
        <DepthPlane z={-0.65}>
          <AbsoluteFill style={{ pointerEvents: 'none' }}>
            <div
              style={{
                position: 'absolute',
                left: insetX,
                right: isVertical ? 148 : insetX,
                top: insetTop,
                bottom: insetBottom,
                border: `1px solid ${markColor}`,
                opacity: 0.55,
              }}
            />
            {/* Top registration header */}
            <div
              style={{
                position: 'absolute',
                left: insetX + 12,
                top: Math.max(18, insetTop - 26),
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                fontFamily: monoFont,
                fontSize: 13,
                letterSpacing: '0.16em',
                color: style.palette.textSecondary,
                opacity: 0.62,
              }}
            >
              <span>+</span>
              <span>{sheetCode}</span>
              <span>•</span>
              <span>{style.id.toUpperCase()}</span>
            </div>
          </AbsoluteFill>
        </DepthPlane>

        {/* Plane z = 0.0: Primary Crisp Editorial Surface */}
        <DepthPlane z={0}>{children}</DepthPlane>

        {/* Plane z = +0.75: Out-of-Focus Edge Millimeter Scale (Strictly Outside Safe Box) */}
        {foregroundAccents && (
          <DepthPlane z={0.75}>
            <div
              style={{
                position: 'absolute',
                left: isVertical ? 44 : 72,
                bottom: isVertical ? 120 : 22,
                display: 'flex',
                alignItems: 'flex-end',
                gap: 8,
                opacity: 0.42,
              }}
            >
              {Array.from({ length: 16 }).map((_, idx) => (
                <div
                  key={idx}
                  style={{
                    width: 1.5,
                    height: idx % 5 === 0 ? 16 : 9,
                    backgroundColor: style.palette.textSecondary,
                  }}
                />
              ))}
            </div>
          </DepthPlane>
        )}
      </OpticalStage2D>
    </AbsoluteFill>
  );
};
```

2. Replace `packages/kits/src/editorial-collage/EditorialMediaCard.tsx`:

```tsx
import React from 'react';
import {
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  createSeededRandom,
  formatFontFamilyCss,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioStyle,
} from '@make-pictures/core';

export type EditorialMountType =
  | 'auto'
  | 'archival-tape'
  | 'photo-corners'
  | 'slide-mount'
  | 'none';

export interface EditorialMediaCardProps {
  src?: string;
  caption: string;
  sourceTag?: string;
  mountType?: EditorialMountType;
  tiltDeg?: number;
  startFrame?: number;
  durationInFrames?: number;
  zoomFrom?: number;
  zoomTo?: number;
  panX?: number;
  panY?: number;
  styleOverrides?: React.CSSProperties;
}

function resolveEffectiveMount(
  mountType: EditorialMountType,
  styleId: string,
  lightingRig: string
): Exclude<EditorialMountType, 'auto'> {
  if (mountType !== 'auto') return mountType;
  if (lightingRig === 'darkroom-halation') return 'slide-mount';
  if (lightingRig === 'studio-macro') return 'none';
  if (styleId === 'archival-chronicle') return 'photo-corners';
  return 'archival-tape';
}

export const EditorialMediaCard: React.FC<EditorialMediaCardProps> = ({
  src,
  caption,
  sourceTag,
  mountType = 'auto',
  tiltDeg,
  startFrame = 2,
  durationInFrames = 180,
  zoomFrom = 1.02,
  zoomTo = 1.1,
  panX = -14,
  panY = -10,
  styleOverrides,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = useStudioStyle();
  const optics = resolveStyleOptics(style);

  const effectiveStart = Math.max(2, startFrame);
  if (frame < effectiveStart) return null;

  const localFrame = frame - effectiveStart;
  const enter = spring({
    frame: localFrame,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });

  const kenBurnsProgress = interpolate(
    localFrame,
    [0, Math.max(30, durationInFrames)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const scale = interpolate(kenBurnsProgress, [0, 1], [zoomFrom, zoomTo]);
  const tx = interpolate(kenBurnsProgress, [0, 1], [0, panX]);
  const ty = interpolate(kenBurnsProgress, [0, 1], [0, panY]);

  const effectiveMount = resolveEffectiveMount(
    mountType,
    style.id,
    optics.lightingRig
  );

  const seededUnit = createSeededRandom(`editorial-media:${caption}:${sourceTag ?? ''}`)();
  const resolvedTilt =
    typeof tiltDeg === 'number'
      ? Math.max(-1.2, Math.min(1.2, tiltDeg))
      : optics.lightingRig === 'studio-macro'
        ? 0
        : Number(((seededUnit - 0.5) * 1.9).toFixed(2));

  const isSlide = effectiveMount === 'slide-mount';
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');

  const translateY = interpolate(enter, [0, 1], [22, 0]);
  const cardSurface = getTactileSurfaceStyle(style, {
    elevation: 'lifted',
    tiltDeg: resolvedTilt,
    overrides: {
      position: 'relative',
      boxSizing: 'border-box',
      padding: isSlide ? '18px 20px 22px 20px' : '14px 14px 24px 14px',
      backgroundColor: isSlide
        ? style.surface.isDark
          ? '#0B101C'
          : '#18181B'
        : style.palette.bgSurface,
      color: isSlide ? '#F8FAFC' : style.palette.textPrimary,
      borderRadius: Math.max(0, Math.round(6 * style.surface.radiusScale)),
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      opacity: enter,
      transform: `translateY(${translateY.toFixed(2)}px)`,
      ...styleOverrides,
    },
  });

  return (
    <div data-mount-type={effectiveMount} style={cardSurface}>
      {/* Translucent Archival Masking Tape */}
      {effectiveMount === 'archival-tape' && (
        <div
          style={{
            position: 'absolute',
            top: -11,
            left: '50%',
            width: 112,
            height: 24,
            transform: 'translateX(-50%) rotate(-1.8deg)',
            backgroundColor: 'rgba(244, 234, 206, 0.78)',
            border: `1px solid ${style.palette.inkBorder}`,
            boxShadow: '0 2px 5px rgba(24, 22, 21, 0.1)',
            pointerEvents: 'none',
            zIndex: 3,
          }}
        />
      )}

      {/* 35mm Slide Sprocket Header */}
      {isSlide && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontFamily: monoFont,
            fontSize: 12,
            letterSpacing: '0.14em',
            color: 'rgba(248, 250, 252, 0.64)',
          }}
        >
          <span>▲ 35MM ARCHIVE POSITIVE</span>
          <span>{sourceTag ?? 'KADR 14A'}</span>
        </div>
      )}

      {/* Photographic Aperture Window */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: Math.max(0, Math.round(4 * style.surface.radiusScale)),
          aspectRatio: '16 / 10',
          backgroundColor: style.palette.bgElevated,
          border: `1px solid ${isSlide ? 'rgba(255,255,255,0.16)' : style.palette.inkBorder}`,
        }}
      >
        {src ? (
          <Img
            src={src}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${scale}) translate(${tx}px, ${ty}px)`,
            }}
          />
        ) : (
          <svg
            data-contact-sheet="true"
            viewBox="0 0 640 400"
            preserveAspectRatio="xMidYMid slice"
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              transform: `scale(${scale}) translate(${tx}px, ${ty}px)`,
              transformOrigin: 'center center',
            }}
          >
            <rect width="640" height="400" fill={style.palette.bgElevated} />
            {/* Fine engraving hatch lines */}
            {Array.from({ length: 14 }).map((_, i) => (
              <line
                key={i}
                x1={0}
                y1={24 + i * 28}
                x2={640}
                y2={24 + i * 28}
                stroke={style.palette.inkBorder}
                strokeWidth="0.8"
                opacity="0.45"
              />
            ))}
            <rect
              x="36"
              y="32"
              width="568"
              height="336"
              fill="none"
              stroke={style.palette.inkBorder}
              strokeWidth="1.5"
            />
            <line
              x1="36"
              y1="368"
              x2="604"
              y2="32"
              stroke={style.palette.accentSecondary}
              strokeWidth="1"
              strokeDasharray="6 6"
              opacity="0.55"
            />
            <circle
              cx="452"
              cy="146"
              r="76"
              fill={style.palette.accentPrimary}
              opacity="0.82"
            />
            <path
              d="M54 352 L212 204 L334 298 L446 218 L586 352 Z"
              fill={style.palette.accentSecondary}
              opacity="0.68"
            />
            <g stroke={style.palette.textPrimary} strokeWidth="1.5" opacity="0.55">
              <line x1="310" y1="200" x2="330" y2="200" />
              <line x1="320" y1="190" x2="320" y2="210" />
            </g>
          </svg>
        )}

        {/* Archival Die-Cut Photo Corners */}
        {effectiveMount === 'photo-corners' && (
          <>
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 24,
                height: 24,
                background: `linear-gradient(135deg, ${style.palette.textPrimary}CC 50%, transparent 50%)`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 24,
                height: 24,
                background: `linear-gradient(225deg, ${style.palette.textPrimary}CC 50%, transparent 50%)`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: 24,
                height: 24,
                background: `linear-gradient(45deg, ${style.palette.textPrimary}CC 50%, transparent 50%)`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 24,
                height: 24,
                background: `linear-gradient(315deg, ${style.palette.textPrimary}CC 50%, transparent 50%)`,
              }}
            />
          </>
        )}
      </div>

      {/* Baryta Print Footer: Caption + Archival Catalog Stamp */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 16,
          paddingTop: 2,
        }}
      >
        <div
          style={{
            fontFamily: bodyFont,
            fontSize: 22,
            fontWeight: 500,
            lineHeight: 1.35,
            color: isSlide ? '#F8FAFC' : style.palette.textPrimary,
          }}
        >
          {caption}
        </div>
        {sourceTag && !isSlide ? (
          <span
            style={{
              flexShrink: 0,
              fontFamily: monoFont,
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: style.palette.accentPrimary,
            }}
          >
            {sourceTag}
          </span>
        ) : null}
      </div>
    </div>
  );
};
```

3. Replace `packages/kits/src/editorial-collage/HighlightQuoteStage.tsx`:

```tsx
import React, { useContext } from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  createSeededRandom,
  formatFontFamilyCss,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioStyle,
  type WordTimestamp,
} from '@make-pictures/core';
import { SplitStorySlotContext } from './SplitStoryLayout';

export interface HighlightQuoteStageProps {
  quote: string;
  highlightPhrase?: string;
  author?: string;
  startFrame?: number;
  highlightFrame?: number;
  words?: ReadonlyArray<WordTimestamp>;
  embedded?: boolean;
  styleOverrides?: React.CSSProperties;
}

export function resolveHighlightStartFrame(params: {
  effectiveStart: number;
  highlightFrame: number;
  highlightPhrase?: string;
  words?: ReadonlyArray<WordTimestamp>;
}): number {
  const { effectiveStart, highlightFrame, highlightPhrase, words } = params;
  if (highlightPhrase && words && words.length > 0) {
    const firstToken = highlightPhrase
      .trim()
      .split(/\s+/)[0]
      ?.toLocaleLowerCase('pl-PL')
      .replace(/[^\p{L}\p{N}]+/gu, '');
    if (firstToken) {
      const matched = words.find(
        (w) => w.normalizedWord.toLocaleLowerCase('pl-PL') === firstToken
      );
      if (matched) return Math.max(effectiveStart + 4, matched.startFrame);
    }
  }
  return Math.max(effectiveStart + 8, highlightFrame);
}

export const HighlightQuoteStage: React.FC<HighlightQuoteStageProps> = ({
  quote,
  highlightPhrase,
  author,
  startFrame = 2,
  highlightFrame = 26,
  words,
  embedded,
  styleOverrides,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const optics = resolveStyleOptics(style);
  const inSplitSlot = useContext(SplitStorySlotContext);
  const isEmbedded = embedded ?? inSplitSlot;
  const isVertical = height > width;

  const effectiveStart = Math.max(2, startFrame);
  if (frame < effectiveStart) return null;

  const enter = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });

  const resolvedHighlightFrame = resolveHighlightStartFrame({
    effectiveStart,
    highlightFrame,
    highlightPhrase,
    words,
  });

  const markSweep =
    frame < resolvedHighlightFrame
      ? 0
      : spring({
          frame: frame - resolvedHighlightFrame,
          fps,
          config: getStyleSpringConfig(style, 'emphasis'),
        });

  const seededTilt =
    optics.lightingRig === 'studio-macro'
      ? 0
      : Number(
          ((createSeededRandom(`quote:${quote}`)() - 0.5) * 1.1).toFixed(2)
        );

  const renderQuoteWithHighlight = () => {
    if (!highlightPhrase || !quote.includes(highlightPhrase)) {
      return quote;
    }
    const idx = quote.indexOf(highlightPhrase);
    const before = quote.slice(0, idx);
    const after = quote.slice(idx + highlightPhrase.length);
    const isDark = style.surface.isDark;

    return (
      <>
        {before}
        <span
          style={{
            position: 'relative',
            display: 'inline-block',
            padding: '0 6px',
            textShadow:
              isDark && markSweep > 0.05
                ? `0 0 ${Math.round(14 + optics.halation * 24)}px ${style.palette.accentPrimary}88`
                : 'none',
          }}
        >
          <svg
            data-ink-brush="true"
            viewBox="0 0 220 38"
            preserveAspectRatio="none"
            style={{
              position: 'absolute',
              left: -2,
              right: -2,
              bottom: 1,
              width: 'calc(100% + 4px)',
              height: isDark ? '34%' : '56%',
              transformOrigin: 'left center',
              transform: `scaleX(${markSweep.toFixed(4)})`,
              mixBlendMode: isDark ? 'screen' : 'multiply',
              pointerEvents: 'none',
            }}
          >
            <path
              d="M3,20 C44,10 112,14 217,12 C219,21 215,31 211,32 C138,34 58,31 2,33 Z"
              fill={style.palette.accentPrimary}
              opacity={isDark ? 0.52 : 0.28}
            />
          </svg>
          <span style={{ position: 'relative' }}>{highlightPhrase}</span>
        </span>
        {after}
      </>
    );
  };

  const translateY = interpolate(enter, [0, 1], [22, 0]);
  const quoteCard = (
    <div
      style={getTactileSurfaceStyle(style, {
        elevation: isEmbedded ? 'resting' : 'lifted',
        tiltDeg: isEmbedded ? 0 : seededTilt,
        overrides: {
          position: 'relative',
          boxSizing: 'border-box',
          width: isEmbedded ? '100%' : undefined,
          maxWidth: isEmbedded ? undefined : isVertical ? 824 : 1220,
          padding: isEmbedded
            ? isVertical
              ? '30px 34px 30px 42px'
              : '38px 46px 38px 54px'
            : isVertical
              ? '40px 42px 40px 52px'
              : '52px 62px 52px 72px',
          borderRadius: Math.max(0, Math.round(6 * style.surface.radiusScale)),
          opacity: enter,
          transform: `translateY(${translateY.toFixed(2)}px)`,
          ...styleOverrides,
        },
      })}
    >
      {/* Editorial Margin Column Hairline + Accent Lead */}
      <div
        style={{
          position: 'absolute',
          left: isEmbedded ? 18 : 26,
          top: 24,
          bottom: 24,
          width: 2,
          backgroundColor: style.palette.inkBorder,
        }}
      >
        <div
          style={{
            width: 3,
            height: `${Math.round(enter * 44)}%`,
            backgroundColor: style.palette.accentPrimary,
          }}
        />
      </div>

      <div
        style={{
          fontFamily: formatFontFamilyCss(
            style.typography.displayFont,
            'display'
          ),
          fontSize: isEmbedded
            ? isVertical
              ? 35
              : 42
            : isVertical
              ? 46
              : 56,
          fontWeight: 600,
          lineHeight: 1.24,
          color: style.palette.textPrimary,
        }}
      >
        „{renderQuoteWithHighlight()}”
      </div>
      {author ? (
        <div
          style={{
            marginTop: isEmbedded ? 18 : 24,
            fontFamily: formatFontFamilyCss(style.typography.monoFont, 'mono'),
            fontSize: isEmbedded ? 17 : 19,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: style.palette.textSecondary,
          }}
        >
          — {author}
        </div>
      ) : null}
    </div>
  );

  if (isEmbedded) {
    return quoteCard;
  }

  return (
    <AbsoluteFill
      style={{
        boxSizing: 'border-box',
        justifyContent: isVertical ? 'flex-start' : 'center',
        alignItems: isVertical ? 'flex-start' : 'center',
        paddingLeft: isVertical ? 56 : 160,
        paddingRight: isVertical ? 190 : 160,
        paddingTop: isVertical ? 300 : 0,
        pointerEvents: 'none',
      }}
    >
      {quoteCard}
    </AbsoluteFill>
  );
};
```

4. Replace `packages/kits/src/editorial-collage/ChapterTitleCard.tsx`:

```tsx
import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  formatFontFamilyCss,
  formatHeadingText,
  getStyleSpringConfig,
  resolveStyleOptics,
  useStudioStyle,
} from '@make-pictures/core';

export interface ChapterTitleCardProps {
  chapterLabel: string;
  title: string;
  subtitle?: string;
  startFrame?: number;
  accentColor?: string;
}

export const ChapterTitleCard: React.FC<ChapterTitleCardProps> = ({
  chapterLabel,
  title,
  subtitle,
  startFrame = 2,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const optics = resolveStyleOptics(style);
  const isVertical = height > width;

  const effectiveStart = Math.max(2, startFrame);
  if (frame < effectiveStart) return null;

  const localFrame = frame - effectiveStart;
  const enter = spring({
    frame: localFrame,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });

  // Optical lens focus pull: settles from soft 5px defocus into crisp filter:none within ~18 frames
  const rawFocusPullBlur = interpolate(
    localFrame,
    [0, 18],
    [3.6 + optics.aperture * 3.2, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const focusFilter =
    rawFocusPullBlur < 0.25 ? 'none' : `blur(${rawFocusPullBlur.toFixed(2)}px)`;

  const accent = accentColor ?? style.palette.accentPrimary;
  const translateY = interpolate(enter, [0, 1], [18, 0]);
  const focusScale = interpolate(enter, [0, 1], [1.038, 1]);

  return (
    <AbsoluteFill
      style={{
        boxSizing: 'border-box',
        justifyContent: isVertical ? 'flex-start' : 'center',
        alignItems: 'flex-start',
        paddingLeft: isVertical ? 60 : 168,
        paddingRight: isVertical ? 196 : 168,
        paddingTop: isVertical ? 312 : 0,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          maxWidth: isVertical ? 804 : 1260,
          width: '100%',
          opacity: enter,
          filter: focusFilter,
          transformOrigin: 'left center',
          transform: `translateY(${translateY.toFixed(2)}px) scale(${focusScale.toFixed(4)})`,
        }}
      >
        {/* Editorial Crop-Mark Registration Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 18,
          }}
        >
          <span
            style={{
              fontFamily: formatFontFamilyCss(style.typography.monoFont, 'mono'),
              fontSize: 18,
              fontWeight: 700,
              color: style.palette.inkBorder,
            }}
          >
            ┼
          </span>
          <span
            style={{
              fontFamily: formatFontFamilyCss(style.typography.monoFont, 'mono'),
              fontSize: isVertical ? 21 : 20,
              fontWeight: 600,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: accent,
            }}
          >
            {chapterLabel}
          </span>
        </div>

        {/* Hairline Cutter Rule + Accent Lead */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: isVertical ? 760 : 920,
            height: 1.5,
            backgroundColor: style.palette.inkBorder,
            transformOrigin: 'left center',
            transform: `scaleX(${enter.toFixed(4)})`,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: Math.round(132 * enter),
              height: 3.5,
              marginTop: -1,
              backgroundColor: accent,
            }}
          />
        </div>

        <div
          style={{
            fontFamily: formatFontFamilyCss(
              style.typography.displayFont,
              'display'
            ),
            fontSize: isVertical ? 74 : 92,
            fontWeight: 700,
            lineHeight: 1.06,
            letterSpacing: `${style.typography.displayTrackingEm}em`,
            color: style.palette.textPrimary,
            textShadow:
              style.surface.isDark && optics.halation > 0.2
                ? `0 0 ${Math.round(20 * optics.halation)}px ${accent}44`
                : 'none',
          }}
        >
          {formatHeadingText(title, style)}
        </div>

        {subtitle ? (
          <div
            style={{
              marginTop: 22,
              maxWidth: isVertical ? 780 : 980,
              fontFamily: formatFontFamilyCss(style.typography.bodyFont, 'body'),
              fontSize: isVertical ? 30 : 33,
              lineHeight: 1.4,
              color: style.palette.textSecondary,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
```

5. Replace `packages/kits/src/editorial-collage/SplitStoryLayout.tsx`:

```tsx
import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  getStyleSpringConfig,
  resolveStyleOptics,
  useStudioStyle,
} from '@make-pictures/core';

export const SplitStorySlotContext = React.createContext<boolean>(false);

export interface SplitStoryLayoutProps {
  primary: React.ReactNode;
  secondary: React.ReactNode;
  startFrame?: number;
  gap?: number;
  /** Optional composition frame at which optical rack focus glides from `primary` to `secondary` */
  focusShiftFrame?: number;
  /** Initial focal behavior before `focusShiftFrame` (`'both'` when omitted unless `focusShiftFrame` is set) */
  initialFocus?: 'both' | 'primary';
}

export function computeSplitStoryVerticalBounds(
  width = 1080,
  height = 1920
): {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
} {
  const scaleX = width / 1080;
  const scaleY = height / 1920;
  return {
    left: Math.round(52 * scaleX),
    top: Math.round(240 * scaleY),
    width: Math.round(840 * scaleX),
    maxHeight: Math.round(1120 * scaleY),
  };
}

export const SplitStoryLayout: React.FC<SplitStoryLayoutProps> = ({
  primary,
  secondary,
  startFrame = 2,
  gap = 40,
  focusShiftFrame,
  initialFocus,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const optics = resolveStyleOptics(style);
  const isVertical = height > width;

  if (frame < Math.max(2, startFrame)) return null;

  const mode =
    initialFocus ?? (typeof focusShiftFrame === 'number' ? 'primary' : 'both');

  const shiftProgress =
    typeof focusShiftFrame === 'number' && frame >= focusShiftFrame
      ? spring({
          frame: frame - focusShiftFrame,
          fps,
          config: getStyleSpringConfig(style, 'camera'),
        })
      : 0;

  const maxBlur = Math.max(1.8, optics.aperture * 7.5);
  const primaryBlur =
    mode === 'both' ? 0 : interpolate(shiftProgress, [0, 1], [0, maxBlur]);
  const secondaryBlur =
    mode === 'both' ? 0 : interpolate(shiftProgress, [0, 1], [maxBlur, 0]);

  const primaryStyle: React.CSSProperties = {
    minWidth: 0,
    filter: primaryBlur < 0.25 ? 'none' : `blur(${primaryBlur.toFixed(2)}px)`,
    opacity:
      mode === 'both' ? 1 : interpolate(shiftProgress, [0, 1], [1, 0.82]),
    transform:
      mode === 'both'
        ? undefined
        : `scale(${interpolate(shiftProgress, [0, 1], [1, 0.985]).toFixed(4)})`,
    transformOrigin: 'center center',
  };

  const secondaryStyle: React.CSSProperties = {
    minWidth: 0,
    filter:
      secondaryBlur < 0.25 ? 'none' : `blur(${secondaryBlur.toFixed(2)}px)`,
    opacity:
      mode === 'both' ? 1 : interpolate(shiftProgress, [0, 1], [0.82, 1]),
    transform:
      mode === 'both'
        ? undefined
        : `scale(${interpolate(shiftProgress, [0, 1], [0.985, 1]).toFixed(4)})`,
    transformOrigin: 'center center',
  };

  if (isVertical) {
    // Strictly inside 9:16 Golden Safe Box: x in [40, 910], y in [220, 1380]
    const bounds = computeSplitStoryVerticalBounds(width, height);
    return (
      <SplitStorySlotContext.Provider value={true}>
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
          <div
            style={{
              position: 'absolute',
              left: bounds.left,
              top: bounds.top,
              width: bounds.width,
              maxHeight: bounds.maxHeight,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: 28,
            }}
          >
            <div style={primaryStyle}>{primary}</div>
            <div style={secondaryStyle}>{secondary}</div>
          </div>
        </AbsoluteFill>
      </SplitStorySlotContext.Provider>
    );
  }

  return (
    <SplitStorySlotContext.Provider value={true}>
      <AbsoluteFill
        style={{
          boxSizing: 'border-box',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '96px 120px',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 1640,
            display: 'grid',
            gridTemplateColumns: '1.08fr 0.92fr',
            gap,
            alignItems: 'center',
          }}
        >
          <div style={primaryStyle}>{primary}</div>
          <div style={secondaryStyle}>{secondary}</div>
        </div>
      </AbsoluteFill>
    </SplitStorySlotContext.Provider>
  );
};
```

6. Update `packages/kits/src/editorial-collage/index.ts`:

```ts
export * from './EditorialDeskStage';
export * from './ChapterTitleCard';
export * from './EditorialMediaCard';
export * from './HighlightQuoteStage';
export * from './SplitStoryLayout';
```

- [ ] **Step 4: Run `narrative-kits.test.ts` and `typecheck` to verify Task 3 passes**

Run: `npx tsx --test packages/cli/tests/narrative-kits.test.ts && npm run typecheck`
Expected: PASS (all existing static/bounds checks + new analog editorial desk, mount types, ink-brush, and rack-focus SSR assertions pass).

- [ ] **Step 5: Commit Task 3**

```bash
git add packages/kits/src/editorial-collage packages/cli/tests/narrative-kits.test.ts
git commit -m "feat(kits): rebuild editorial-collage into multi-plane analog desk with baryta mounts and rack focus"
```

---

### Task 4: Rebuild `@make-pictures/kits/kinetic-typography` (Polymorphic Film Typography)

**Files:**
- Modify: `packages/kits/src/kinetic-typography/WordByWordStage.tsx`
- Modify: `packages/kits/src/kinetic-typography/ImpactKeywordCard.tsx`
- Modify: `packages/kits/src/kinetic-typography/AnimatedMetricCounter.tsx`
- Test: `packages/cli/tests/kits-style-integration.test.ts`

**Interfaces:**
- Consumes: `resolveStyleOptics`, `getTactileSurfaceStyle`, `formatFontFamilyCss`, `formatHeadingText`, `getSceneVoiceover`, `getStyleSpringConfig`, `useStudioFontsReady`, `useStudioStyle`, `SPRING_PRESETS`, `STUDIO_THEME`, `THEME`, `type StyleTypographyGrammar`, `type SceneVoiceoverData`, `type WordTimestamp` from `@make-pictures/core`
- Produces (exported from `@make-pictures/kits/kinetic-typography` and `@make-pictures/kits`):
  - `WordByWordStage` (`WordByWordStageProps` extended with `grammar?: StyleTypographyGrammar`), `groupWordsIntoBeats`, `type WordPhraseBeat`
  - `ImpactKeywordCard` (`ImpactKeywordCardProps` extended with `grammar?: StyleTypographyGrammar`; `icon` defaults to `null`)
  - `AnimatedMetricCounter` (`AnimatedMetricCounterProps` extended with `grammar?: StyleTypographyGrammar`), `formatTabularMetric`

- [ ] **Step 1: Add failing tests for polymorphic kinetic grammars, vernier scale, and zero karaoke pills in `packages/cli/tests/kits-style-integration.test.ts`**

Import `Thumbnail` from `'@remotion/player'` and `{ AnimatedMetricCounter, ImpactKeywordCard, WordByWordStage }` from `'../../kits/src/kinetic-typography'` at the top of `packages/cli/tests/kits-style-integration.test.ts`, and append this test:

```ts
test('kinetic-typography renders swiss-spatial, optical-gate, and risograph-poster grammars without karaoke pills or default Sparkles icon', () => {
  const sampleWords = [
    { word: 'Sztuka', normalizedWord: 'sztuka', start: 0.1, end: 0.4, startFrame: 6, endFrame: 24 },
    { word: 'żywego', normalizedWord: 'żywego', start: 0.42, end: 0.72, startFrame: 25, endFrame: 43 },
    { word: 'światła', normalizedWord: 'światła', start: 0.75, end: 1.1, startFrame: 45, endFrame: 66 },
    { word: 'buduje', normalizedWord: 'buduje', start: 1.5, end: 1.8, startFrame: 90, endFrame: 108 },
    { word: 'głębię', normalizedWord: 'głębię', start: 1.82, end: 2.2, startFrame: 109, endFrame: 132 },
  ];

  const styleGrammarPairs = [
    { styleId: 'editorial-press', expectedGrammar: 'swiss-spatial' },
    { styleId: 'cyber-telemetry', expectedGrammar: 'optical-gate' },
    { styleId: 'brutalist-poster', expectedGrammar: 'risograph-poster' },
  ] as const;

  for (const { styleId, expectedGrammar } of styleGrammarPairs) {
    const KineticScene: React.FC = () =>
      React.createElement(
        StyleProvider,
        { style: styleId },
        React.createElement(WordByWordStage, {
          words: sampleWords,
          eyebrow: 'AKT I • RYTM',
          startFrame: 2,
        }),
        React.createElement(ImpactKeywordCard, {
          keyword: 'Głębia ostrości',
          eyebrow: 'OPTYKA',
          badge: '60 FPS',
          startFrame: 2,
        }),
        React.createElement(AnimatedMetricCounter, {
          value: 98.4,
          decimals: 1,
          suffix: '%',
          label: 'Ostrość kadru',
          badge: '-14 LUFS',
          startFrame: 2,
        })
      );

    // Frame 0 invariant
    const f0 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: KineticScene,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 160,
        fps: 60,
        frameToDisplay: 0,
      })
    );
    assert.doesNotMatch(f0, /Głębia ostrości/);
    assert.doesNotMatch(f0, /Sztuka/);

    // Frame 52: active word "światła" in beat 1, ImpactKeywordCard without Sparkles SVG, vernier/poster counter without 5px bar
    const f52 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: KineticScene,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 160,
        fps: 60,
        frameToDisplay: 52,
      })
    );
    assert.match(f52, new RegExp(`data-typography-grammar="${expectedGrammar}"`));
    assert.doesNotMatch(f52, /lucide-sparkles/i);
    assert.doesNotMatch(f52, /height:5px;border-radius:9999px/);
    if (expectedGrammar !== 'risograph-poster') {
      assert.match(f52, /data-vernier-scale="true"/);
    } else {
      assert.match(f52, /data-risograph-meter="true"/);
    }
  }
});
```

- [ ] **Step 2: Run `kits-style-integration.test.ts` to verify it fails**

Run: `npx tsx --test packages/cli/tests/kits-style-integration.test.ts`
Expected: FAIL (`data-typography-grammar`, `lucide-sparkles` still present, `height:5px` progress bar still present).

- [ ] **Step 3: Rebuild `WordByWordStage.tsx`, `ImpactKeywordCard.tsx`, and `AnimatedMetricCounter.tsx`**

1. Replace `packages/kits/src/kinetic-typography/WordByWordStage.tsx`:

```tsx
import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  SPRING_PRESETS,
  STUDIO_THEME,
  THEME,
  formatFontFamilyCss,
  formatHeadingText,
  getSceneVoiceover,
  getStyleSpringConfig,
  resolveStyleOptics,
  useStudioFontsReady,
  useStudioStyle,
  type SceneVoiceoverData,
  type StyleTypographyGrammar,
  type WordTimestamp,
} from '@make-pictures/core';

export interface WordPhraseBeat {
  words: WordTimestamp[];
  startFrame: number;
  endFrame: number;
}

export interface WordByWordStageProps {
  /** Word-level timestamps (`WordTimestamp[]`) to drive rhythmic phrase beats */
  words?: ReadonlyArray<WordTimestamp>;
  /** Optional sceneId lookup into `voiceoverManifest` (used when `words` is omitted) */
  sceneId?: string;
  /** Optional isolated capsule voiceover manifest */
  voiceoverManifest?: Record<string, SceneVoiceoverData>;
  /** Optional fallback text if neither `words` nor `sceneId` has timestamps yet */
  fallbackText?: string;
  /** Composition frame offset when this scene starts (default `0`) */
  sceneStartFrame?: number;
  /** Target words per visual beat (`3..5` recommended, default `4`) */
  wordsPerBeat?: number;
  /** Typographic choreography grammar (defaults to `studioStyle.optics.typographyGrammar`) */
  grammar?: StyleTypographyGrammar;
  /** Primary accent color (defaults to `studioStyle.palette.accentPrimary`) */
  accentColor?: string;
  /** Surface styling mode (`'transparent'` overlays 2D/3D stage cleanly) */
  variant?: 'dark' | 'light' | 'transparent';
  /** Optional editorial index / category label */
  eyebrow?: string;
  /** Optional explicit headline font size in px */
  fontSize?: number;
  /** Constrain layout strictly inside `9:16 Golden Safe Box` when `height > width` (default `true`) */
  safeBox9x16?: boolean;
  /** Entrance start frame (clamped `>= 2` by default so Frame 0 stays clean) */
  enterFrame?: number;
  /** Alias for `enterFrame` */
  startFrame?: number;
  style?: React.CSSProperties;
}

function buildFallbackWords(
  text: string,
  fps: number,
  durationInFrames: number
): WordTimestamp[] {
  const tokens = text
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return [];

  const usableStart = Math.min(12, Math.floor(durationInFrames * 0.08));
  const usableSpan = Math.max(
    tokens.length * 6,
    durationInFrames - usableStart - 16
  );
  const perWord = usableSpan / tokens.length;

  return tokens.map((token, idx) => {
    const sf = Math.round(usableStart + idx * perWord);
    const ef = Math.max(
      sf + 4,
      Math.round(usableStart + (idx + 0.86) * perWord)
    );
    return {
      word: token,
      normalizedWord: token
        .replace(/^[.,!?;:"'()[\]{}—–-]+|[.,!?;:"'()[\]{}—–-]+$/g, '')
        .toLowerCase(),
      start: sf / fps,
      end: ef / fps,
      startFrame: sf,
      endFrame: ef,
    };
  });
}

/**
 * Groups `WordTimestamp[]` into crisp rhythmic phrases of `3–5` words,
 * breaking naturally on sentence-ending punctuation or vocal pauses.
 */
export function groupWordsIntoBeats(
  words: ReadonlyArray<WordTimestamp>,
  wordsPerBeat = 4,
  fps = 60
): WordPhraseBeat[] {
  if (!words.length) return [];
  const maxWords = Math.max(2, Math.min(7, Math.round(wordsPerBeat)));
  const pauseThresholdFrames = Math.round(fps * 0.36);

  const beats: WordPhraseBeat[] = [];
  let bucket: WordTimestamp[] = [];

  const flush = () => {
    if (!bucket.length) return;
    beats.push({
      words: bucket,
      startFrame: bucket[0]!.startFrame,
      endFrame: bucket[bucket.length - 1]!.endFrame,
    });
    bucket = [];
  };

  for (let i = 0; i < words.length; i++) {
    const curr = words[i]!;
    const prev = bucket[bucket.length - 1];

    if (
      prev &&
      curr.startFrame - prev.endFrame >= pauseThresholdFrames &&
      bucket.length >= 2
    ) {
      flush();
    }

    bucket.push(curr);

    const endsSentence = /[.!?;:—]$/.test(curr.word);
    const endsClause = /[,–]$/.test(curr.word) && bucket.length >= 3;

    if (
      bucket.length >= maxWords ||
      (endsSentence && bucket.length >= 2) ||
      endsClause
    ) {
      flush();
    }
  }

  flush();
  return beats;
}

/**
 * Polymorphic 60 FPS Film Typography stage (`swiss-spatial`, `optical-gate`, `risograph-poster`).
 * Syncs multi-beat phrase depth, rack focus, and ink/gate/cutout emphasis directly to `WordTimestamp[]`.
 */
export const WordByWordStage: React.FC<WordByWordStageProps> = ({
  words,
  sceneId,
  voiceoverManifest,
  fallbackText,
  sceneStartFrame = 0,
  wordsPerBeat = 4,
  grammar,
  accentColor,
  variant,
  eyebrow,
  fontSize,
  safeBox9x16 = true,
  enterFrame,
  startFrame,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  useStudioFontsReady();
  const studioStyle = useStudioStyle();
  const optics = resolveStyleOptics(studioStyle);
  const resolvedGrammar = grammar ?? optics.typographyGrammar;

  const resolvedAccent = accentColor ?? studioStyle.palette.accentPrimary;
  const secondaryAccent = studioStyle.palette.accentSecondary;
  const displayFontCss = formatFontFamilyCss(
    studioStyle.typography.displayFont,
    'display'
  );
  const monoFontCss = formatFontFamilyCss(
    studioStyle.typography.monoFont,
    'mono'
  );
  const enterSpring = getStyleSpringConfig(studioStyle, 'enter');

  const resolvedWords = useMemo<ReadonlyArray<WordTimestamp>>(() => {
    if (words && words.length > 0) return words;
    if (sceneId) {
      const vo = getSceneVoiceover(sceneId, voiceoverManifest);
      if (vo && vo.words.length > 0) return vo.words;
      if (vo?.text) return buildFallbackWords(vo.text, fps, durationInFrames);
    }
    if (fallbackText) {
      return buildFallbackWords(fallbackText, fps, durationInFrames);
    }
    return [];
  }, [words, sceneId, voiceoverManifest, fallbackText, fps, durationInFrames]);

  const beats = useMemo(
    () => groupWordsIntoBeats(resolvedWords, wordsPerBeat, fps),
    [resolvedWords, wordsPerBeat, fps]
  );

  const effectiveStart = Math.max(2, startFrame ?? enterFrame ?? 2);
  if (frame < effectiveStart || beats.length === 0) {
    return null;
  }

  const stageEnter = spring({
    frame: frame - effectiveStart,
    fps,
    config: enterSpring,
  });
  if (stageEnter <= 0.005) {
    return null;
  }

  const localFrame = frame - sceneStartFrame;

  let activeBeatIndex = 0;
  for (let i = 0; i < beats.length; i++) {
    const b = beats[i]!;
    const nextB = beats[i + 1];
    if (localFrame >= b.startFrame - 4) {
      activeBeatIndex = i;
    }
    if (nextB && localFrame < nextB.startFrame - 4) {
      break;
    }
  }

  const prevBeat = activeBeatIndex > 0 ? beats[activeBeatIndex - 1] : undefined;
  const activeBeat = beats[activeBeatIndex]!;
  const nextBeat =
    activeBeatIndex + 1 < beats.length ? beats[activeBeatIndex + 1] : undefined;

  const framesIntoBeat = Math.max(0, localFrame - (activeBeat.startFrame - 4));
  const beatEnter = spring({
    frame: framesIntoBeat,
    fps,
    config: enterSpring,
  });

  let activeWordIdx = -1;
  for (let i = 0; i < activeBeat.words.length; i++) {
    const w = activeBeat.words[i]!;
    if (localFrame >= w.startFrame - 1 && localFrame <= w.endFrame + 8) {
      activeWordIdx = i;
    }
  }

  const isVertical = height > width;
  const textPrimary =
    variant === 'dark'
      ? THEME.colors.textPrimary
      : variant === 'light'
        ? studioStyle.surface.isDark
          ? STUDIO_THEME.colors.text.slate900
          : studioStyle.palette.textPrimary
        : studioStyle.palette.textPrimary;

  const textSecondary =
    variant === 'dark'
      ? THEME.colors.textSecondary
      : studioStyle.palette.textSecondary;

  const resolvedBg =
    variant === 'dark'
      ? THEME.colors.bgPrimary
      : variant === 'light'
        ? studioStyle.palette.bgCanvas
        : 'transparent';

  const resolvedFontSize = fontSize ?? (isVertical ? 64 : 78);

  // Golden Safe Box bounds in 9:16: x ∈ [40, 910], y ∈ [220, 1380]
  const containerPaddingStyle: React.CSSProperties =
    isVertical && safeBox9x16
      ? {
          paddingLeft: Math.round(52 * (width / 1080)),
          paddingRight: Math.round((1080 - 900) * (width / 1080)),
          paddingTop: Math.round(236 * (height / 1920)),
          paddingBottom: Math.round((1920 - 1364) * (height / 1920)),
        }
      : {
          padding: '84px 140px',
        };

  const beatCounterStr = String(activeBeatIndex + 1).padStart(2, '0');
  const totalBeatsStr = String(beats.length).padStart(2, '0');

  const renderNeighborLine = (
    beat: WordPhraseBeat | undefined,
    position: 'prev' | 'next'
  ) => {
    if (!beat) return null;
    const text = beat.words
      .map((w) => formatHeadingText(w.word, studioStyle))
      .join(' ');
    const blurPx = Math.max(2.6, optics.aperture * 8.5);
    return (
      <div
        aria-hidden="true"
        style={{
          fontFamily: displayFontCss,
          fontSize: Math.round(resolvedFontSize * 0.54),
          fontWeight: 600,
          lineHeight: 1.15,
          letterSpacing: `${studioStyle.typography.displayTrackingEm}em`,
          color: textSecondary,
          opacity: position === 'prev' ? 0.28 : 0.18,
          filter: `blur(${blurPx.toFixed(2)}px)`,
          transform: `translateY(${position === 'prev' ? -4 : 4}px)`,
          userSelect: 'none',
        }}
      >
        {text}
      </div>
    );
  };

  // 1. SWISS-SPATIAL GRAMMAR (Editorial Column + Rack-Focus Context + Ink Rule)
  if (resolvedGrammar === 'swiss-spatial') {
    return (
      <AbsoluteFill
        data-typography-grammar="swiss-spatial"
        style={{
          backgroundColor: resolvedBg,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          boxSizing: 'border-box',
          opacity: stageEnter,
          pointerEvents: 'none',
          ...containerPaddingStyle,
          ...style,
        }}
      >
        <div
          style={{
            position: 'relative',
            maxWidth: isVertical ? 816 : 1380,
            width: '100%',
            paddingLeft: isVertical ? 28 : 42,
            borderLeft: `2px solid ${studioStyle.palette.inkBorder}`,
            display: 'flex',
            flexDirection: 'column',
            gap: isVertical ? 18 : 22,
          }}
        >
          {/* Active accent cursor along the Swiss column rule */}
          <div
            style={{
              position: 'absolute',
              left: -2.5,
              top: 0,
              width: 3,
              height: Math.round(68 * beatEnter),
              backgroundColor: resolvedAccent,
            }}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              fontFamily: monoFontCss,
              fontSize: isVertical ? 16 : 17,
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: textSecondary,
            }}
          >
            <span style={{ color: resolvedAccent, fontWeight: 700 }}>
              {beatCounterStr}/{totalBeatsStr}
            </span>
            {eyebrow ? (
              <>
                <span>—</span>
                <span>{eyebrow}</span>
              </>
            ) : null}
          </div>

          {renderNeighborLine(prevBeat, 'prev')}

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              gap: isVertical ? '10px 18px' : '12px 24px',
              filter: 'none',
              transform: `translateY(${interpolate(beatEnter, [0, 1], [18, 0]).toFixed(2)}px)`,
            }}
          >
            {activeBeat.words.map((w, idx) => {
              const isCurrent = idx === activeWordIdx;
              const isPast = localFrame > w.endFrame + 8;
              const wordPop = spring({
                frame: Math.max(0, localFrame - w.startFrame),
                fps,
                config: SPRING_PRESETS.micro,
              });
              const ruleScale = isCurrent ? wordPop : 0;

              return (
                <span
                  key={`${activeBeatIndex}-${idx}-${w.startFrame}`}
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    fontFamily: displayFontCss,
                    fontSize: resolvedFontSize,
                    fontWeight: 700,
                    lineHeight: 1.08,
                    letterSpacing: `${studioStyle.typography.displayTrackingEm}em`,
                    color: isCurrent ? resolvedAccent : textPrimary,
                    opacity: isCurrent ? 1 : isPast ? 0.92 : 0.42,
                    transform: `translateY(${interpolate(wordPop, [0, 1], [8, 0]).toFixed(2)}px)`,
                  }}
                >
                  {formatHeadingText(w.word, studioStyle)}
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: -4,
                      height: 4,
                      backgroundColor: resolvedAccent,
                      transformOrigin: 'left center',
                      transform: `scaleX(${ruleScale.toFixed(4)})`,
                    }}
                  />
                </span>
              );
            })}
          </div>

          {renderNeighborLine(nextBeat, 'next')}
        </div>
      </AbsoluteFill>
    );
  }

  // 2. OPTICAL-GATE GRAMMAR (35mm Reticle Gate + Drum Step + Chromatic Impulse)
  if (resolvedGrammar === 'optical-gate') {
    const gateFlash = Math.max(0, 1 - framesIntoBeat / 12);
    const chromaPx = Number((gateFlash * (1.8 + optics.halation * 3.4)).toFixed(2));
    const gateBlur = gateFlash * 1.6;

    return (
      <AbsoluteFill
        data-typography-grammar="optical-gate"
        style={{
          backgroundColor: resolvedBg,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          boxSizing: 'border-box',
          opacity: stageEnter,
          pointerEvents: 'none',
          ...containerPaddingStyle,
          ...style,
        }}
      >
        <div
          style={{
            position: 'relative',
            maxWidth: isVertical ? 820 : 1380,
            width: '100%',
            padding: isVertical ? '36px 28px' : '48px 56px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
          }}
        >
          {/* Optical Gate Corner Reticles */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              opacity: 0.65,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 20,
                height: 20,
                borderTop: `2px solid ${resolvedAccent}`,
                borderLeft: `2px solid ${resolvedAccent}`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 20,
                height: 20,
                borderTop: `2px solid ${resolvedAccent}`,
                borderRight: `2px solid ${resolvedAccent}`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: 20,
                height: 20,
                borderBottom: `2px solid ${resolvedAccent}`,
                borderLeft: `2px solid ${resolvedAccent}`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 20,
                height: 20,
                borderBottom: `2px solid ${resolvedAccent}`,
                borderRight: `2px solid ${resolvedAccent}`,
              }}
            />
          </div>

          <div
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontFamily: monoFontCss,
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: textSecondary,
            }}
          >
            <span>{eyebrow ?? 'GATE 35MM'}</span>
            <span style={{ color: resolvedAccent }}>
              BEAT {beatCounterStr}/{totalBeatsStr} • F:{String(frame).padStart(4, '0')}
            </span>
          </div>

          {renderNeighborLine(prevBeat, 'prev')}

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              alignItems: 'center',
              gap: isVertical ? '12px 18px' : '14px 24px',
              textAlign: 'center',
              filter: gateBlur < 0.25 ? 'none' : `blur(${gateBlur.toFixed(2)}px)`,
              transform: `translateY(${interpolate(beatEnter, [0, 1], [22, 0]).toFixed(2)}px)`,
            }}
          >
            {activeBeat.words.map((w, idx) => {
              const isCurrent = idx === activeWordIdx;
              const isPast = localFrame > w.endFrame + 8;
              const wordPop = spring({
                frame: Math.max(0, localFrame - w.startFrame),
                fps,
                config: SPRING_PRESETS.micro,
              });

              const halationGlow =
                isCurrent && optics.halation > 0.05
                  ? `0 0 ${Math.round(16 + optics.halation * 28)}px ${resolvedAccent}88`
                  : '';
              const dispersionShadow =
                chromaPx > 0.15
                  ? `${-chromaPx}px 0 0 ${resolvedAccent}AA, ${chromaPx}px 0 0 ${secondaryAccent}AA`
                  : '';
              const combinedShadow = [halationGlow, dispersionShadow]
                .filter(Boolean)
                .join(', ');

              return (
                <span
                  key={`${activeBeatIndex}-${idx}-${w.startFrame}`}
                  style={{
                    display: 'inline-block',
                    fontFamily: displayFontCss,
                    fontSize: resolvedFontSize,
                    fontWeight: 800,
                    lineHeight: 1.1,
                    letterSpacing: `${studioStyle.typography.displayTrackingEm}em`,
                    color: isCurrent ? resolvedAccent : textPrimary,
                    opacity: isCurrent ? 1 : isPast ? 0.88 : 0.36,
                    textShadow: combinedShadow || 'none',
                    transform: `scale(${(isCurrent ? interpolate(wordPop, [0, 1], [0.97, 1.045]) : 1).toFixed(4)})`,
                  }}
                >
                  {formatHeadingText(w.word, studioStyle)}
                </span>
              );
            })}
          </div>

          {renderNeighborLine(nextBeat, 'next')}
        </div>
      </AbsoluteFill>
    );
  }

  // 3. RISOGRAPH-POSTER GRAMMAR (Cut Poster + Alternating Tilt + Ink Misregistration)
  const posterTiltDeg = (activeBeatIndex % 2 === 0 ? -1.1 : 1.1) * beatEnter;

  return (
    <AbsoluteFill
      data-typography-grammar="risograph-poster"
      style={{
        backgroundColor: resolvedBg,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        boxSizing: 'border-box',
        opacity: stageEnter,
        pointerEvents: 'none',
        ...containerPaddingStyle,
        ...style,
      }}
    >
      <div
        style={{
          maxWidth: isVertical ? 808 : 1380,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 18,
          transformOrigin: 'center center',
          transform: `rotate(${posterTiltDeg.toFixed(2)}deg) translateY(${interpolate(beatEnter, [0, 1], [20, 0]).toFixed(2)}px)`,
        }}
      >
        {eyebrow ? (
          <div
            style={{
              fontFamily: monoFontCss,
              fontSize: isVertical ? 16 : 17,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              padding: '5px 12px',
              backgroundColor: studioStyle.palette.bgElevated,
              color: textPrimary,
              border: `2px solid ${studioStyle.palette.inkBorder}`,
              boxShadow: `3px 3px 0px ${studioStyle.palette.inkBorder}`,
            }}
          >
            {eyebrow} • {beatCounterStr}
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: isVertical ? '12px 14px' : '14px 20px',
          }}
        >
          {activeBeat.words.map((w, idx) => {
            const isCurrent = idx === activeWordIdx;
            const isPast = localFrame > w.endFrame + 8;
            const wordPop = spring({
              frame: Math.max(0, localFrame - w.startFrame),
              fps,
              config: SPRING_PRESETS.micro,
            });

            return (
              <span
                key={`${activeBeatIndex}-${idx}-${w.startFrame}`}
                style={{
                  display: 'inline-block',
                  fontFamily: displayFontCss,
                  fontSize: resolvedFontSize,
                  fontWeight: 800,
                  lineHeight: 1.06,
                  letterSpacing: `${studioStyle.typography.displayTrackingEm}em`,
                  padding: isCurrent ? '4px 14px' : '4px 4px',
                  borderRadius: 0,
                  color: isCurrent ? '#FFFFFF' : textPrimary,
                  backgroundColor: isCurrent ? resolvedAccent : 'transparent',
                  border: isCurrent
                    ? `2px solid ${studioStyle.palette.inkBorder}`
                    : '2px solid transparent',
                  boxShadow: isCurrent ? `4px 3px 0px ${secondaryAccent}` : 'none',
                  textShadow: !isCurrent
                    ? `1.5px 1px 0px ${secondaryAccent}33`
                    : 'none',
                  opacity: isCurrent ? 1 : isPast ? 0.94 : 0.44,
                  transform: `scale(${(isCurrent ? interpolate(wordPop, [0, 1], [0.96, 1.04]) : 1).toFixed(4)})`,
                }}
              >
                {formatHeadingText(w.word, studioStyle)}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

2. Replace `packages/kits/src/kinetic-typography/ImpactKeywordCard.tsx`:

```tsx
import React from 'react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  SPRING_PRESETS,
  STUDIO_THEME,
  THEME,
  formatFontFamilyCss,
  formatHeadingText,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioFontsReady,
  useStudioStyle,
  type StyleTypographyGrammar,
} from '@make-pictures/core';

export interface ImpactKeywordCardProps {
  /** Primary bold statement (keep concise: 2–4 words per AGENTS.md) */
  keyword: string;
  /** Optional small category eyebrow above the keyword */
  eyebrow?: string;
  /** Optional concise 2–4 word takeaway sublabel */
  sublabel?: string;
  /** Optional technical index / stamp badge (e.g. `"60 FPS"`, `"-14 LUFS"`) */
  badge?: string;
  /** Optional custom typographic mark; defaults to `null` (no generic icon square) */
  icon?: React.ReactNode;
  /** Typographic grammar override (defaults to `studioStyle.optics.typographyGrammar`) */
  grammar?: StyleTypographyGrammar;
  /** Accent color (defaults to `studioStyle.palette.accentPrimary`) */
  accentColor?: string;
  /** Optional explicit surface mode override (`'dark'` | `'light'`); inherits active `StylePreset` when omitted */
  variant?: 'dark' | 'light';
  /** Entrance frame (default `2`, obeying Frame 0 clean board rule) */
  enterFrame?: number;
  /** Alias for `enterFrame` */
  startFrame?: number;
  /** Optional exit frame for smooth spring dismissal */
  exitFrame?: number;
  /** Constrain max width cleanly inside `9:16 Golden Safe Box` when vertical (default `true`) */
  safeBox9x16?: boolean;
  style?: React.CSSProperties;
}

/**
 * Polymorphic 60 FPS Typographic Statement Card (`swiss-spatial`, `optical-gate`, `risograph-poster`).
 */
export const ImpactKeywordCard: React.FC<ImpactKeywordCardProps> = ({
  keyword,
  eyebrow,
  sublabel,
  badge,
  icon = null,
  grammar,
  accentColor,
  variant,
  enterFrame,
  startFrame,
  exitFrame,
  safeBox9x16 = true,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  useStudioFontsReady();
  const studioStyle = useStudioStyle();
  const optics = resolveStyleOptics(studioStyle);
  const resolvedGrammar = grammar ?? optics.typographyGrammar;

  const resolvedAccent = accentColor ?? studioStyle.palette.accentPrimary;
  const displayFontCss = formatFontFamilyCss(
    studioStyle.typography.displayFont,
    'display'
  );
  const bodyFontCss = formatFontFamilyCss(
    studioStyle.typography.bodyFont,
    'body'
  );
  const monoFontCss = formatFontFamilyCss(
    studioStyle.typography.monoFont,
    'mono'
  );

  const effectiveStart = Math.max(2, startFrame ?? enterFrame ?? 2);
  if (frame < effectiveStart) {
    return null;
  }

  const enter = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(studioStyle, 'enter'),
  });

  const exit =
    typeof exitFrame === 'number' && frame >= exitFrame
      ? spring({
          frame: frame - exitFrame,
          fps,
          config: SPRING_PRESETS.smooth,
        })
      : 0;

  const visibility = Math.max(0, enter * (1 - exit));
  if (visibility <= 0.005) {
    return null;
  }

  const isVertical = height > width;
  const hasExplicitVariant = variant !== undefined;
  const isLight = variant === 'light';

  const translateY = interpolate(enter, [0, 1], [22, 0]) - exit * 16;
  const scale = interpolate(visibility, [0, 1], [0.96, 1]);
  const accentRuleScale = spring({
    frame: frame - effectiveStart - 3,
    fps,
    config: SPRING_PRESETS.smooth,
  });

  const textPrimary = hasExplicitVariant
    ? isLight
      ? STUDIO_THEME.colors.text.slate900
      : THEME.colors.textPrimary
    : studioStyle.palette.textPrimary;

  const textSecondary = hasExplicitVariant
    ? isLight
      ? STUDIO_THEME.colors.text.secondary
      : THEME.colors.textSecondary
    : studioStyle.palette.textSecondary;

  const displayedKeyword = hasExplicitVariant
    ? keyword
    : formatHeadingText(keyword, studioStyle);

  const baseSurface = hasExplicitVariant
    ? {
        backgroundColor: isLight
          ? STUDIO_THEME.colors.bgSurfaceGlass
          : 'rgba(13, 15, 26, 0.9)',
        border: isLight
          ? `1.5px solid ${STUDIO_THEME.colors.border.subtle}`
          : `1.5px solid ${resolvedAccent}55`,
        boxShadow: isLight
          ? STUDIO_THEME.shadows.cardElevated
          : THEME.shadows.glow(resolvedAccent, 0.7),
      }
    : getTactileSurfaceStyle(studioStyle, {
        elevation: 'lifted',
        tiltDeg: resolvedGrammar === 'risograph-poster' ? -0.7 : 0,
      });

  const cornerRadius =
    resolvedGrammar === 'risograph-poster'
      ? 0
      : resolvedGrammar === 'optical-gate'
        ? Math.max(0, Math.round(4 * studioStyle.surface.radiusScale))
        : Math.max(0, Math.round(8 * studioStyle.surface.radiusScale));

  return (
    <div
      data-card-grammar={resolvedGrammar}
      style={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        gap: 12,
        maxWidth: isVertical && safeBox9x16 ? 820 : 1080,
        padding: isVertical ? '28px 34px' : '34px 44px',
        boxSizing: 'border-box',
        ...baseSurface,
        borderRadius: cornerRadius,
        ...(resolvedGrammar === 'risograph-poster'
          ? {
              border: `2.5px solid ${studioStyle.palette.inkBorder}`,
              boxShadow: `6px 6px 0px ${studioStyle.palette.accentSecondary}`,
            }
          : {}),
        opacity: visibility,
        transform: `translate3d(0, ${translateY.toFixed(2)}px, 0) scale(${scale.toFixed(4)})${
          resolvedGrammar === 'risograph-poster' ? ' rotate(-0.7deg)' : ''
        }`,
        ...style,
      }}
    >
      {/* Top Swiss Register Rule or Risograph Diagonal Bar */}
      {resolvedGrammar === 'swiss-spatial' && (
        <div
          style={{
            width: '100%',
            height: 2,
            backgroundColor: studioStyle.palette.inkBorder,
            marginBottom: 4,
          }}
        >
          <div
            style={{
              width: `${Math.round(accentRuleScale * 38)}%`,
              height: 3,
              marginTop: -0.5,
              backgroundColor: resolvedAccent,
            }}
          />
        </div>
      )}

      {resolvedGrammar === 'optical-gate' && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: monoFontCss,
            fontSize: 13,
            color: resolvedAccent,
            opacity: 0.78,
          }}
        >
          <span>+</span>
          <span>+</span>
        </div>
      )}

      {(eyebrow || badge || icon) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {icon ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: resolvedAccent,
                }}
              >
                {icon}
              </span>
            ) : null}
            {eyebrow ? (
              <span
                style={{
                  fontFamily: monoFontCss,
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: textSecondary,
                }}
              >
                {eyebrow}
              </span>
            ) : null}
          </div>

          {badge ? (
            <span
              style={{
                fontFamily: monoFontCss,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '0.08em',
                padding: '3px 10px',
                borderRadius: 0,
                color:
                  resolvedGrammar === 'risograph-poster'
                    ? '#FFFFFF'
                    : resolvedAccent,
                backgroundColor:
                  resolvedGrammar === 'risograph-poster'
                    ? resolvedAccent
                    : 'transparent',
                border: `1.5px solid ${resolvedAccent}`,
              }}
            >
              {badge}
            </span>
          ) : null}
        </div>
      )}

      <div
        style={{
          fontFamily: displayFontCss,
          fontSize: isVertical ? 46 : 54,
          fontWeight: 800,
          lineHeight: 1.08,
          letterSpacing: `${studioStyle.typography.displayTrackingEm}em`,
          color: textPrimary,
          textShadow:
            resolvedGrammar === 'optical-gate' && optics.halation > 0.1
              ? `0 0 ${Math.round(16 + optics.halation * 24)}px ${resolvedAccent}55`
              : 'none',
        }}
      >
        {displayedKeyword}
      </div>

      {sublabel ? (
        <div
          style={{
            fontFamily: bodyFontCss,
            fontSize: isVertical ? 20 : 22,
            fontWeight: 500,
            lineHeight: 1.38,
            color: textSecondary,
          }}
        >
          {sublabel}
        </div>
      ) : null}
    </div>
  );
};
```

3. Replace `packages/kits/src/kinetic-typography/AnimatedMetricCounter.tsx`:

```tsx
import React from 'react';
import {
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  STUDIO_THEME,
  THEME,
  formatFontFamilyCss,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioFontsReady,
  useStudioStyle,
  type StyleTypographyGrammar,
} from '@make-pictures/core';

export interface AnimatedMetricCounterProps {
  /** Target numeric value */
  value: number;
  /** Starting numeric value (default `0`) */
  fromValue?: number;
  /** Leading symbol/unit (e.g. `'$'`, `'+'`) */
  prefix?: string;
  /** Trailing symbol/unit (e.g. `'%'`, `' FPS'`, `'×'`) */
  suffix?: string;
  /** Fixed decimal places (default `0`) */
  decimals?: number;
  /** Frame when the ticker starts counting (default `2`, obeying Frame 0 clean board rule) */
  startFrame?: number;
  /** Count-up duration in frames at 60 FPS (default `54`) */
  durationInFrames?: number;
  /** Optional concise 2–3 word label below the counter */
  label?: string;
  /** Optional delta stamp badge (e.g. `"+240%"`) */
  badge?: string;
  /** Typographic grammar override (defaults to `studioStyle.optics.typographyGrammar`) */
  grammar?: StyleTypographyGrammar;
  /** Highlight accent color (defaults to `studioStyle.palette.accentPrimary`) */
  accentColor?: string;
  /** Presentation mode (`'inline'` renders pure tabular text without card chrome) */
  variant?: 'dark' | 'light' | 'inline';
  /** Thousands separator character (default `','`) */
  thousandSeparator?: string;
  /** Font size in px for the main number */
  fontSize?: number;
  style?: React.CSSProperties;
}

export function formatTabularMetric(
  val: number,
  decimals = 0,
  thousandSeparator = ','
): string {
  const safeDecimals = Math.max(0, Math.min(6, Math.round(decimals)));
  const fixed = val.toFixed(safeDecimals);
  const [intPart, decPart] = fixed.split('.');
  const sign = intPart!.startsWith('-') ? '-' : '';
  const digits = sign ? intPart!.slice(1) : intPart!;
  const grouped = thousandSeparator
    ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSeparator)
    : digits;
  return decPart !== undefined
    ? `${sign}${grouped}.${decPart}`
    : `${sign}${grouped}`;
}

const VERNIER_TICKS = 21;

/**
 * Smooth 60 FPS Interpolated Number / Currency / Percentage Ticker
 * with precision SVG Vernier scale (`swiss-spatial`, `optical-gate`) or Risograph block meter (`risograph-poster`).
 */
export const AnimatedMetricCounter: React.FC<AnimatedMetricCounterProps> = ({
  value,
  fromValue = 0,
  prefix = '',
  suffix = '',
  decimals = 0,
  startFrame = 2,
  durationInFrames = 54,
  label,
  badge,
  grammar,
  accentColor,
  variant,
  thousandSeparator = ',',
  fontSize,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  useStudioFontsReady();
  const studioStyle = useStudioStyle();
  const optics = resolveStyleOptics(studioStyle);
  const resolvedGrammar = grammar ?? optics.typographyGrammar;

  const resolvedAccent = accentColor ?? studioStyle.palette.accentPrimary;
  const displayFontCss = formatFontFamilyCss(
    studioStyle.typography.displayFont,
    'display'
  );
  const bodyFontCss = formatFontFamilyCss(
    studioStyle.typography.bodyFont,
    'body'
  );
  const monoFontCss = formatFontFamilyCss(
    studioStyle.typography.monoFont,
    'mono'
  );

  const effectiveStart = Math.max(2, startFrame);
  const dur = Math.max(6, durationInFrames);

  const enter =
    frame < effectiveStart
      ? 0
      : spring({
          frame: frame - effectiveStart,
          fps,
          config: getStyleSpringConfig(studioStyle, 'enter'),
        });

  const countProgress = interpolate(
    frame,
    [effectiveStart, effectiveStart + dur],
    [0, 1],
    {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  const currentVal = fromValue + (value - fromValue) * countProgress;
  const formatted = `${prefix}${formatTabularMetric(
    currentVal,
    decimals,
    thousandSeparator
  )}${suffix}`;

  if (variant === 'inline') {
    if (frame < effectiveStart) {
      return null;
    }
    return (
      <span
        style={{
          fontFamily: displayFontCss,
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          fontSize: fontSize ?? 56,
          color: studioStyle.palette.textPrimary,
          opacity: enter,
          ...style,
        }}
      >
        {formatted}
      </span>
    );
  }

  if (enter <= 0.005) {
    return null;
  }

  const isVertical = height > width;
  const hasExplicitVariant = variant !== undefined;
  const isLight = hasExplicitVariant
    ? variant === 'light'
    : !studioStyle.surface.isDark;
  const resolvedFontSize = fontSize ?? (isVertical ? 68 : 76);

  const chromeStyle: React.CSSProperties = hasExplicitVariant
    ? {
        borderRadius: resolvedGrammar === 'risograph-poster' ? 0 : 8,
        backgroundColor: isLight
          ? STUDIO_THEME.colors.bgSurfaceGlass
          : 'rgba(13, 15, 26, 0.88)',
        border: isLight
          ? `1.5px solid ${STUDIO_THEME.colors.border.subtle}`
          : '1.5px solid rgba(255, 255, 255, 0.14)',
        boxShadow: isLight
          ? STUDIO_THEME.shadows.cardElevated
          : THEME.shadows.glow(resolvedAccent, 0.65),
      }
    : getTactileSurfaceStyle(studioStyle, {
        elevation: 'resting',
        overrides: {
          borderRadius:
            resolvedGrammar === 'risograph-poster'
              ? 0
              : Math.max(0, Math.round(6 * studioStyle.surface.radiusScale)),
        },
      });

  const textPrimary = hasExplicitVariant
    ? isLight
      ? STUDIO_THEME.colors.text.slate900
      : THEME.colors.textPrimary
    : studioStyle.palette.textPrimary;

  const textSecondary = hasExplicitVariant
    ? isLight
      ? STUDIO_THEME.colors.text.secondary
      : THEME.colors.textSecondary
    : studioStyle.palette.textSecondary;

  const litTicks = Math.round(countProgress * (VERNIER_TICKS - 1));

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 10,
        padding: isVertical ? '26px 32px' : '30px 38px',
        boxSizing: 'border-box',
        ...chromeStyle,
        ...(resolvedGrammar === 'risograph-poster' && !hasExplicitVariant
          ? {
              border: `2.5px solid ${studioStyle.palette.inkBorder}`,
              boxShadow: `5px 5px 0px ${studioStyle.palette.inkBorder}`,
            }
          : {}),
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [18, 0]).toFixed(2)}px)`,
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 14,
        }}
      >
        <span
          style={{
            fontFamily: displayFontCss,
            fontVariantNumeric: 'tabular-nums',
            fontSize: resolvedFontSize,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: '-0.035em',
            color: textPrimary,
            textShadow:
              resolvedGrammar === 'optical-gate' && optics.halation > 0.12
                ? `0 0 ${Math.round(14 + optics.halation * 22)}px ${resolvedAccent}55`
                : 'none',
          }}
        >
          {formatted}
        </span>

        {badge ? (
          <span
            style={{
              fontFamily: monoFontCss,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.06em',
              padding: '3px 10px',
              borderRadius: 0,
              color:
                resolvedGrammar === 'risograph-poster'
                  ? '#FFFFFF'
                  : resolvedAccent,
              backgroundColor:
                resolvedGrammar === 'risograph-poster'
                  ? resolvedAccent
                  : 'transparent',
              border: `1.5px solid ${resolvedAccent}`,
            }}
          >
            {badge}
          </span>
        ) : null}
      </div>

      {label ? (
        <div
          style={{
            fontFamily: bodyFontCss,
            fontSize: isVertical ? 20 : 21,
            fontWeight: 600,
            color: textSecondary,
          }}
        >
          {label}
        </div>
      ) : null}

      {/* Vernier Scale Ticks (swiss-spatial / optical-gate) vs Segmented Stamp Meter (risograph-poster) */}
      {resolvedGrammar === 'risograph-poster' ? (
        <div
          data-risograph-meter="true"
          style={{
            display: 'flex',
            gap: 4,
            marginTop: 4,
            width: '100%',
          }}
        >
          {Array.from({ length: 10 }).map((_, idx) => {
            const active = idx < Math.round(countProgress * 10);
            return (
              <div
                key={idx}
                style={{
                  flex: 1,
                  height: 8,
                  backgroundColor: active
                    ? resolvedAccent
                    : studioStyle.palette.bgElevated,
                  border: `1.5px solid ${studioStyle.palette.inkBorder}`,
                }}
              />
            );
          })}
        </div>
      ) : (
        <svg
          data-vernier-scale="true"
          viewBox="0 0 240 16"
          style={{
            width: '100%',
            minWidth: 200,
            height: 16,
            marginTop: 4,
            overflow: 'visible',
          }}
        >
          {Array.from({ length: VERNIER_TICKS }).map((_, idx) => {
            const x = (idx / (VERNIER_TICKS - 1)) * 236 + 2;
            const isMajor = idx % 5 === 0;
            const isActive = idx <= litTicks;
            return (
              <line
                key={idx}
                x1={x}
                y1={isMajor ? 1 : 5}
                x2={x}
                y2={15}
                stroke={isActive ? resolvedAccent : studioStyle.palette.inkBorder}
                strokeWidth={isMajor ? 2 : 1.2}
                opacity={isActive ? 1 : 0.45}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run `kits-style-integration.test.ts` and `typecheck` to verify Task 4 passes**

Run: `npx tsx --test packages/cli/tests/kits-style-integration.test.ts && npm run typecheck`
Expected: PASS (all 13 2D kit source audits + 3-grammar SSR tests + `WorldBox` tests pass).

- [ ] **Step 5: Commit Task 4**

```bash
git add packages/kits/src/kinetic-typography packages/cli/tests/kits-style-integration.test.ts
git commit -m "feat(kits): rebuild kinetic-typography into polymorphic swiss, optical-gate, and risograph grammars"
```


---

### Task 5: `Style Lab` 60 FPS Live Optical Previews, CLI Scaffolds (`make-pictures new`), Skills Sync & Visual Contact-Sheet QA

**Files:**
- Modify: `packages/studio/src/client/components/StyleLabShowcase.tsx`
- Modify: `packages/cli/src/commands/new-production.ts`
- Modify: `plugins/make-pictures/skills/style-and-art-direction/SKILL.md`
- Modify: `plugins/make-pictures/skills/kit-editorial-and-vector/SKILL.md`
- Modify: `plugins/make-pictures/skills/kit-kinetic-and-data/SKILL.md`
- Modify: `plugins/make-pictures/skills/cinematography-and-vfx/SKILL.md`
- Sync: `skills/*/SKILL.md` (via `npm run sync:skills`)
- Test: `packages/cli/tests/studio-styles-api.test.ts`
- Test: `packages/cli/tests/styles-cli.test.ts`
- Test: `packages/cli/tests/root-skills-sync.test.ts`

**Interfaces:**
- Consumes in `@make-pictures/studio`: `DepthPlane`, `OpticalStage2D`, `StageLightingRig`, `StyleProvider`, `createSeededRandom`, `formatFontFamilyCss`, `formatHeadingText`, `getCardChromeStyle`, `getStyleSpringConfig`, `getTactileSurfaceStyle`, `resolveStyleOptics`, `useStudioStyle`, `type BuiltinVisualKitId`, `type OpticalShot2D`, `type StylePreset` from `@make-pictures/core` (**NEVER** import `@make-pictures/kits` in `@make-pictures/studio` — it is an optional peer!)
- Consumes in scaffolded `new-production.ts` templates:
  - `editorial-collage`: `EditorialDeskStage`, `ChapterTitleCard`, `EditorialMediaCard`, `HighlightQuoteStage`, `SplitStoryLayout` from `@make-pictures/kits/editorial-collage`
  - `kinetic-typography`: `DepthPlane`, `OpticalStage2D`, `StageLightingRig` from `@make-pictures/core` + `AnimatedMetricCounter`, `ImpactKeywordCard`, `WordByWordStage` from `@make-pictures/kits/kinetic-typography`

- [ ] **Step 1: Add failing tests for `StyleLabPreviewComposition` optical previews (`studio-styles-api.test.ts`) and CLI scaffolds (`styles-cli.test.ts`)**

1. In `packages/cli/tests/studio-styles-api.test.ts`, import `Thumbnail` from `'@remotion/player'` and add `StyleLabPreviewComposition` to the import from `'../../studio/src/client/index'`. Append this test at the bottom of `packages/cli/tests/studio-styles-api.test.ts`:

```ts
test('StyleLabPreviewComposition renders live 60 FPS optical lighting, editorial mounts, and polymorphic kinetic grammars with clean Frame 0', () => {
  const cases = [
    {
      styleId: 'archival-chronicle',
      expectedRig: 'window-gobo',
      expectedMount: 'photo-corners',
      expectedGrammar: 'swiss-spatial',
    },
    {
      styleId: 'cyber-telemetry',
      expectedRig: 'darkroom-halation',
      expectedMount: 'slide-mount',
      expectedGrammar: 'optical-gate',
    },
    {
      styleId: 'brutalist-poster',
      expectedRig: 'darkroom-halation',
      expectedMount: 'slide-mount',
      expectedGrammar: 'risograph-poster',
    },
    {
      styleId: 'minimal-product',
      expectedRig: 'studio-macro',
      expectedMount: 'none',
      expectedGrammar: 'swiss-spatial',
    },
  ] as const;

  for (const { styleId, expectedRig, expectedMount, expectedGrammar } of cases) {
    const preset = BUILT_IN_STYLES[styleId];

    // 1. Editorial Collage in Style Lab: Frame 0 must be pure bgCanvas
    const editorialFrame0 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: StyleLabPreviewComposition,
        inputProps: { style: preset, kit: 'editorial-collage' },
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: STYLE_LAB_DURATION_IN_FRAMES,
        fps: STYLE_LAB_FPS,
        frameToDisplay: 0,
      })
    );
    assert.doesNotMatch(editorialFrame0, /ROZDZIAŁ 01/);
    assert.doesNotMatch(editorialFrame0, /data-lighting-rig=/);

    // Frame 48: directional lighting rig, multi-plane Z, mount, and ink-brush active
    const editorialFrame48 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: StyleLabPreviewComposition,
        inputProps: { style: preset, kit: 'editorial-collage' },
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: STYLE_LAB_DURATION_IN_FRAMES,
        fps: STYLE_LAB_FPS,
        frameToDisplay: 48,
      })
    );
    assert.match(editorialFrame48, new RegExp(`data-lighting-rig="${expectedRig}"`));
    assert.match(editorialFrame48, new RegExp(`data-mount-type="${expectedMount}"`));
    assert.match(editorialFrame48, /data-ink-brush="true"/);
    assert.match(editorialFrame48, /data-depth-z="-0\.65"/);

    // 2. Kinetic Typography in Style Lab: Frame 48 switches live across 3 grammars
    const kineticFrame48 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: StyleLabPreviewComposition,
        inputProps: { style: preset, kit: 'kinetic-typography' },
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: STYLE_LAB_DURATION_IN_FRAMES,
        fps: STYLE_LAB_FPS,
        frameToDisplay: 48,
      })
    );
    assert.match(kineticFrame48, new RegExp(`data-lighting-rig="${expectedRig}"`));
    assert.match(
      kineticFrame48,
      new RegExp(`data-typography-grammar="${expectedGrammar}"`)
    );
    if (expectedGrammar === 'risograph-poster') {
      assert.match(kineticFrame48, /data-risograph-meter="true"/);
    } else {
      assert.match(kineticFrame48, /data-vernier-scale="true"/);
    }
  }
});
```

2. In `packages/cli/tests/styles-cli.test.ts` lines 131–137, add assertions verifying that `editorial-collage` scaffolds `EditorialDeskStage` + `focusShiftFrame` and `kinetic-typography` scaffolds `StageLightingRig` + `OpticalStage2D`:

```ts
      if (kitId === 'paper-diorama-3d') {
        assert.match(tsx, /DioramaStage3D/);
      }
      if (kitId === 'isometric-3d') {
        assert.match(tsx, /IsometricStage3D/);
      }
      if (kitId === 'editorial-collage') {
        assert.match(tsx, /EditorialDeskStage/);
        assert.match(tsx, /focusShiftFrame/);
      }
      if (kitId === 'kinetic-typography') {
        assert.match(tsx, /StageLightingRig/);
        assert.match(tsx, /OpticalStage2D/);
      }
```

- [ ] **Step 2: Run both test files to verify they fail**

Run: `npx tsx --test packages/cli/tests/studio-styles-api.test.ts packages/cli/tests/styles-cli.test.ts`
Expected: FAIL (`StyleLabPreviewComposition` lacks `data-lighting-rig`, `data-mount-type`, and `data-typography-grammar`; `new-production.ts` lacks `EditorialDeskStage`, `StageLightingRig`, and `OpticalStage2D`).

- [ ] **Step 3: Upgrade `StyleLabShowcase.tsx`, `new-production.ts`, and the 4 canonical studio skills**

1. Update imports at lines 25–35 of `packages/studio/src/client/components/StyleLabShowcase.tsx`:

```tsx
import {
  DepthPlane,
  OpticalStage2D,
  StageLightingRig,
  StyleProvider,
  createSeededRandom,
  formatFontFamilyCss,
  formatHeadingText,
  getCardChromeStyle,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioStyle,
  type BuiltinVisualKitId,
  type OpticalShot2D,
  type StylePreset,
} from '@make-pictures/core';
```

2. Replace `EditorialCollagePreview` (lines 100–349) in `packages/studio/src/client/components/StyleLabShowcase.tsx` with the live multi-plane optical desk preview:

```tsx
const EditorialCollagePreview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const optics = resolveStyleOptics(style);
  const bounds = getSafeStageBounds(width, height);

  const shots = useMemo<ReadonlyArray<OpticalShot2D>>(() => {
    const cx = width / 2;
    const cy = height / 2;
    return [
      {
        fromFrame: 2,
        x: cx,
        y: cy + 8,
        zoom: 1.0,
        focalZ: 0.35,
        transition: 'cut',
      },
      {
        fromFrame: 8,
        x: cx - 5,
        y: cy,
        zoom: 1.024,
        focalZ: 0,
        transition: 'glide',
      },
      {
        fromFrame: 150,
        x: cx + 7,
        y: cy - 4,
        zoom: 1.044,
        focalZ: 0,
        transition: 'glide',
      },
    ];
  }, [width, height]);

  const chapterEnter = spring({
    frame: frame - 2,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const mediaEnter = spring({
    frame: frame - 12,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const quoteSweep = spring({
    frame: frame - 26,
    fps,
    config: getStyleSpringConfig(style, 'emphasis'),
  });

  const rawFocusPull = interpolate(
    frame - 2,
    [0, 18],
    [3.4 + optics.aperture * 3.0, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const chapterFocusFilter =
    rawFocusPull < 0.25 ? 'none' : `blur(${rawFocusPull.toFixed(2)}px)`;

  const kenBurnsScale = interpolate(frame, [2, 300], [1.02, 1.11], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const kenBurnsX = interpolate(frame, [2, 300], [0, -16], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const effectiveMount =
    optics.lightingRig === 'darkroom-halation'
      ? 'slide-mount'
      : optics.lightingRig === 'studio-macro'
        ? 'none'
        : style.id === 'archival-chronicle'
          ? 'photo-corners'
          : 'archival-tape';
  const isSlide = effectiveMount === 'slide-mount';
  const seededTilt =
    optics.lightingRig === 'studio-macro'
      ? 0
      : Number(
          ((createSeededRandom(`style-lab-media:${style.id}`)() - 0.5) * 1.6).toFixed(2)
        );

  const displayFont = formatFontFamilyCss(style.typography.displayFont, 'display');
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');

  const markColor = style.surface.isDark
    ? 'rgba(248, 250, 252, 0.22)'
    : `${style.palette.inkBorder}AA`;
  const insetX = bounds.isVertical ? 36 : 64;
  const insetTop = bounds.isVertical ? 196 : 48;
  const insetBottom = bounds.isVertical ? 496 : 48;

  return (
    <OpticalStage2D shots={shots} seed={2026} startFrame={2}>
      {/* Plane z = -0.65: Archival Registration Sheet */}
      <DepthPlane z={-0.65}>
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
          <div
            style={{
              position: 'absolute',
              left: insetX,
              right: bounds.isVertical ? 148 : insetX,
              top: insetTop,
              bottom: insetBottom,
              border: `1px solid ${markColor}`,
              opacity: 0.52,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: insetX + 12,
              top: Math.max(18, insetTop - 26),
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              fontFamily: monoFont,
              fontSize: 13,
              letterSpacing: '0.16em',
              color: style.palette.textSecondary,
              opacity: 0.62,
            }}
          >
            <span>+</span>
            <span>ARKUSZ REDAKCYJNY • STYLE LAB</span>
            <span>•</span>
            <span>{optics.lightingRig.toUpperCase()}</span>
          </div>
        </AbsoluteFill>
      </DepthPlane>

      {/* Plane z = 0: Crisp Editorial Hero Surface */}
      <DepthPlane z={0}>
        <div
          style={{
            position: 'absolute',
            left: bounds.left,
            top: bounds.top,
            width: bounds.width,
            height: bounds.height,
            display: 'flex',
            flexDirection: bounds.isVertical ? 'column' : 'row',
            gap: bounds.isVertical ? 28 : 44,
            alignItems: 'stretch',
            justifyContent: 'center',
          }}
        >
          {/* Left / Top: Optical Focus-Pull Chapter + Ink-Brush Press Clipping */}
          <div
            style={{
              flex: bounds.isVertical ? '0 0 auto' : '1.08 1 0%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 20,
              opacity: chapterEnter,
              filter: chapterFocusFilter,
              transform: `translateY(${interpolate(chapterEnter, [0, 1], [22, 0]).toFixed(2)}px)`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                style={{
                  fontFamily: monoFont,
                  fontSize: 17,
                  fontWeight: 700,
                  color: style.palette.inkBorder,
                }}
              >
                ┼
              </span>
              <span
                style={{
                  fontFamily: monoFont,
                  fontSize: 17,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: style.palette.accentPrimary,
                }}
              >
                ROZDZIAŁ 01 • ARCHIWUM
              </span>
              <div
                style={{
                  height: 1.5,
                  flex: 1,
                  maxWidth: 160,
                  backgroundColor: style.palette.inkBorder,
                  transformOrigin: 'left center',
                  transform: `scaleX(${chapterEnter.toFixed(4)})`,
                }}
              />
            </div>

            <div
              style={{
                fontFamily: displayFont,
                fontSize: bounds.isVertical ? 52 : 66,
                fontWeight: 700,
                lineHeight: 1.07,
                letterSpacing: `${style.typography.displayTrackingEm}em`,
                color: style.palette.textPrimary,
              }}
            >
              {formatHeadingText('Sztuka rzemiosła i żywego światła', style)}
            </div>

            <div
              style={getTactileSurfaceStyle(style, {
                elevation: 'resting',
                overrides: {
                  position: 'relative',
                  padding: bounds.isVertical
                    ? '24px 28px 24px 38px'
                    : '28px 34px 28px 44px',
                  borderRadius: Math.max(0, Math.round(6 * style.surface.radiusScale)),
                  marginTop: 4,
                },
              })}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 16,
                  top: 20,
                  bottom: 20,
                  width: 2,
                  backgroundColor: style.palette.inkBorder,
                }}
              >
                <div
                  style={{
                    width: 3,
                    height: `${Math.round(chapterEnter * 48)}%`,
                    backgroundColor: style.palette.accentPrimary,
                  }}
                />
              </div>

              <div
                style={{
                  fontFamily: bodyFont,
                  fontSize: bounds.isVertical ? 24 : 27,
                  lineHeight: 1.42,
                  color: style.palette.textPrimary,
                }}
              >
                „Każda epoka zapisuje pamięć własną{' '}
                <span
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    padding: '0 6px',
                    fontWeight: 600,
                  }}
                >
                  <svg
                    data-ink-brush="true"
                    viewBox="0 0 220 38"
                    preserveAspectRatio="none"
                    style={{
                      position: 'absolute',
                      left: -2,
                      right: -2,
                      bottom: 1,
                      width: 'calc(100% + 4px)',
                      height: style.surface.isDark ? '34%' : '56%',
                      transformOrigin: 'left center',
                      transform: `scaleX(${quoteSweep.toFixed(4)})`,
                      mixBlendMode: style.surface.isDark ? 'screen' : 'multiply',
                      pointerEvents: 'none',
                    }}
                  >
                    <path
                      d="M3,20 C44,10 112,14 217,12 C219,21 215,31 211,32 C138,34 58,31 2,33 Z"
                      fill={style.palette.accentPrimary}
                      opacity={style.surface.isDark ? 0.52 : 0.28}
                    />
                  </svg>
                  <span style={{ position: 'relative' }}>
                    kreską, fakturą i barwą
                  </span>
                </span>{' '}
                opowieści.”
              </div>
              <div
                style={{
                  marginTop: 12,
                  fontFamily: monoFont,
                  fontSize: 15,
                  color: style.palette.textSecondary,
                }}
              >
                — Kronika wzornictwa • Neapol, 1889
              </div>
            </div>
          </div>

          {/* Right / Bottom: Mounted Baryta Print or 35mm Positive Slide */}
          <div
            data-mount-type={effectiveMount}
            style={getTactileSurfaceStyle(style, {
              elevation: 'lifted',
              tiltDeg: seededTilt,
              overrides: {
                position: 'relative',
                flex: bounds.isVertical ? '1 1 0%' : '0.92 1 0%',
                padding: isSlide ? '18px 20px 22px 20px' : '14px 14px 22px 14px',
                backgroundColor: isSlide
                  ? style.surface.isDark
                    ? '#0B101C'
                    : '#18181B'
                  : style.palette.bgSurface,
                color: isSlide ? '#F8FAFC' : style.palette.textPrimary,
                borderRadius: Math.max(0, Math.round(6 * style.surface.radiusScale)),
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                opacity: mediaEnter,
                transform: `translateY(${interpolate(mediaEnter, [0, 1], [26, 0]).toFixed(2)}px)`,
              },
            })}
          >
            {effectiveMount === 'archival-tape' && (
              <div
                style={{
                  position: 'absolute',
                  top: -11,
                  left: '50%',
                  width: 108,
                  height: 22,
                  transform: 'translateX(-50%) rotate(-1.8deg)',
                  backgroundColor: 'rgba(244, 234, 206, 0.78)',
                  border: `1px solid ${style.palette.inkBorder}`,
                  zIndex: 3,
                }}
              />
            )}

            {isSlide && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: monoFont,
                  fontSize: 12,
                  letterSpacing: '0.14em',
                  color: 'rgba(248, 250, 252, 0.64)',
                }}
              >
                <span>▲ 35MM ARCHIVE POSITIVE</span>
                <span>KADR 04A</span>
              </div>
            )}

            <div
              style={{
                flex: 1,
                minHeight: bounds.isVertical ? 240 : 340,
                borderRadius: Math.max(0, Math.round(4 * style.surface.radiusScale)),
                overflow: 'hidden',
                position: 'relative',
                backgroundColor: style.palette.bgElevated,
                border: `1px solid ${isSlide ? 'rgba(255,255,255,0.16)' : style.palette.inkBorder}`,
              }}
            >
              <svg
                viewBox="0 0 640 400"
                preserveAspectRatio="xMidYMid slice"
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  transform: `scale(${kenBurnsScale}) translateX(${kenBurnsX}px)`,
                  transformOrigin: 'center center',
                }}
              >
                <rect width="640" height="400" fill={style.palette.bgElevated} />
                {Array.from({ length: 14 }).map((_, i) => (
                  <line
                    key={i}
                    x1={0}
                    y1={24 + i * 28}
                    x2={640}
                    y2={24 + i * 28}
                    stroke={style.palette.inkBorder}
                    strokeWidth="0.8"
                    opacity="0.45"
                  />
                ))}
                <rect
                  x="36"
                  y="32"
                  width="568"
                  height="336"
                  fill="none"
                  stroke={style.palette.inkBorder}
                  strokeWidth="1.5"
                />
                <circle
                  cx="452"
                  cy="142"
                  r="82"
                  fill={style.palette.accentPrimary}
                  opacity={0.84}
                />
                <path
                  d="M54 352 L212 200 L334 298 L446 214 L586 352 Z"
                  fill={style.palette.accentSecondary}
                  opacity={0.72}
                />
              </svg>

              {effectiveMount === 'photo-corners' && (
                <>
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: 24,
                      height: 24,
                      background: `linear-gradient(135deg, ${style.palette.textPrimary}CC 50%, transparent 50%)`,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: 24,
                      height: 24,
                      background: `linear-gradient(225deg, ${style.palette.textPrimary}CC 50%, transparent 50%)`,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      width: 24,
                      height: 24,
                      background: `linear-gradient(45deg, ${style.palette.textPrimary}CC 50%, transparent 50%)`,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 24,
                      height: 24,
                      background: `linear-gradient(315deg, ${style.palette.textPrimary}CC 50%, transparent 50%)`,
                    }}
                  />
                </>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                fontFamily: monoFont,
                fontSize: 15,
                color: isSlide ? '#E2E8F0' : style.palette.textSecondary,
              }}
            >
              <span>Ryc. 04 — Odbitka barytowa (Ken Burns)</span>
              <span style={{ color: style.palette.accentPrimary, fontWeight: 700 }}>
                latin-ext • PL
              </span>
            </div>
          </div>
        </div>
      </DepthPlane>

      {/* Plane z = +0.75: Out-of-Focus Millimeter Ruler (Outside Safe Box) */}
      <DepthPlane z={0.75}>
        <div
          style={{
            position: 'absolute',
            left: bounds.isVertical ? 44 : 72,
            bottom: bounds.isVertical ? 120 : 22,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 8,
            opacity: 0.42,
          }}
        >
          {Array.from({ length: 16 }).map((_, idx) => (
            <div
              key={idx}
              style={{
                width: 1.5,
                height: idx % 5 === 0 ? 16 : 9,
                backgroundColor: style.palette.textSecondary,
              }}
            />
          ))}
        </div>
      </DepthPlane>
    </OpticalStage2D>
  );
};
```

3. Replace `KineticTypographyPreview` in `packages/studio/src/client/components/StyleLabShowcase.tsx` so it previews all 3 `typographyGrammar` modes (`swiss-spatial`, `optical-gate`, `risograph-poster`) + Vernier/Risograph `AnimatedMetricCounter` + statement `ImpactKeywordCard` live on `<OpticalStage2D>`:

```tsx
const KineticTypographyPreview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const optics = resolveStyleOptics(style);
  const grammar = optics.typographyGrammar;
  const bounds = getSafeStageBounds(width, height);

  const shots = useMemo<ReadonlyArray<OpticalShot2D>>(() => {
    const cx = width / 2;
    const cy = height / 2;
    return [
      { fromFrame: 2, x: cx, y: cy, zoom: 1.0, focalZ: 0, transition: 'cut' },
      {
        fromFrame: 12,
        x: cx,
        y: cy - 4,
        zoom: 1.032,
        focalZ: 0,
        transition: 'glide',
      },
    ];
  }, [width, height]);

  const words = ['Rytm', 'słowa', 'buduje', 'głębię', 'kadru'];
  const activeWordIdx = Math.min(
    words.length - 1,
    Math.max(0, Math.floor((frame - 4) / 36) % words.length)
  );

  const cardEnter = spring({
    frame: frame - 22,
    fps,
    config: getStyleSpringConfig(style, 'emphasis'),
  });
  const counterProgress = spring({
    frame: frame - 12,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const counterVal = (counterProgress * 98.4).toFixed(1).replace('.', ',');
  const litTicks = Math.round(counterProgress * 20);

  const displayFont = formatFontFamilyCss(style.typography.displayFont, 'display');
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');

  return (
    <OpticalStage2D shots={shots} seed={2027} startFrame={2}>
      {/* Plane z = -0.55: Out-of-Focus Typographic Baseline Index */}
      <DepthPlane z={-0.55}>
        <div
          style={{
            position: 'absolute',
            left: bounds.left,
            top: Math.max(24, bounds.top - 34),
            fontFamily: monoFont,
            fontSize: 13,
            letterSpacing: '0.16em',
            color: style.palette.textSecondary,
            opacity: 0.55,
          }}
        >
          GRAMMAR: {grammar.toUpperCase()} • RIG: {optics.lightingRig.toUpperCase()}
        </div>
      </DepthPlane>

      {/* Plane z = 0: Polymorphic Kinetic Stage */}
      <DepthPlane z={0}>
        <div
          data-typography-grammar={grammar}
          style={{
            position: 'absolute',
            left: bounds.left,
            top: bounds.top,
            width: bounds.width,
            height: bounds.height,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: grammar === 'optical-gate' ? 'center' : 'flex-start',
            gap: 32,
          }}
        >
          {grammar === 'swiss-spatial' && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <span
                style={{
                  fontFamily: monoFont,
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  color: style.palette.accentPrimary,
                }}
              >
                01 / 04 • SWISS SPATIAL
              </span>
              <div
                style={{
                  flex: 1,
                  height: 1.5,
                  backgroundColor: style.palette.inkBorder,
                }}
              />
            </div>
          )}

          {grammar === 'optical-gate' && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: monoFont,
                fontSize: 14,
                letterSpacing: '0.16em',
                color: style.palette.accentPrimary,
              }}
            >
              <span>┌ GATE 35MM</span>
              <span>F:{String(frame).padStart(4, '0')} ┐</span>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent:
                grammar === 'optical-gate' ? 'center' : 'flex-start',
              gap: bounds.isVertical ? '12px 18px' : '14px 22px',
              transform:
                grammar === 'risograph-poster' ? 'rotate(-1deg)' : undefined,
            }}
          >
            {words.map((word, idx) => {
              const wSpring = spring({
                frame: frame - (2 + idx * 5),
                fps,
                config: getStyleSpringConfig(style, 'emphasis'),
              });
              const isCurrent = idx === activeWordIdx;

              if (grammar === 'risograph-poster') {
                return (
                  <span
                    key={word}
                    style={{
                      display: 'inline-block',
                      fontFamily: displayFont,
                      fontSize: bounds.isVertical ? 64 : 82,
                      fontWeight: 800,
                      lineHeight: 1.06,
                      letterSpacing: `${style.typography.displayTrackingEm}em`,
                      padding: isCurrent ? '4px 14px' : '4px 4px',
                      color: isCurrent ? '#FFFFFF' : style.palette.textPrimary,
                      backgroundColor: isCurrent
                        ? style.palette.accentPrimary
                        : 'transparent',
                      border: isCurrent
                        ? `2px solid ${style.palette.inkBorder}`
                        : '2px solid transparent',
                      boxShadow: isCurrent
                        ? `4px 3px 0px ${style.palette.accentSecondary}`
                        : 'none',
                      opacity: wSpring,
                    }}
                  >
                    {formatHeadingText(word, style)}
                  </span>
                );
              }

              if (grammar === 'optical-gate') {
                return (
                  <span
                    key={word}
                    style={{
                      display: 'inline-block',
                      fontFamily: displayFont,
                      fontSize: bounds.isVertical ? 64 : 84,
                      fontWeight: 800,
                      lineHeight: 1.08,
                      letterSpacing: `${style.typography.displayTrackingEm}em`,
                      color: isCurrent
                        ? style.palette.accentPrimary
                        : style.palette.textPrimary,
                      opacity: isCurrent ? wSpring : wSpring * 0.72,
                      textShadow:
                        isCurrent && optics.halation > 0.05
                          ? `0 0 ${Math.round(16 + optics.halation * 28)}px ${style.palette.accentPrimary}88`
                          : 'none',
                    }}
                  >
                    {formatHeadingText(word, style)}
                  </span>
                );
              }

              return (
                <span
                  key={word}
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    fontFamily: displayFont,
                    fontSize: bounds.isVertical ? 64 : 84,
                    fontWeight: 700,
                    lineHeight: 1.08,
                    letterSpacing: `${style.typography.displayTrackingEm}em`,
                    color: isCurrent
                      ? style.palette.accentPrimary
                      : style.palette.textPrimary,
                    opacity: wSpring,
                    transform: `translateY(${interpolate(wSpring, [0, 1], [24, 0]).toFixed(2)}px)`,
                  }}
                >
                  {formatHeadingText(word, style)}
                  {isCurrent && (
                    <span
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: -4,
                        height: 4,
                        backgroundColor: style.palette.accentPrimary,
                      }}
                    />
                  )}
                </span>
              );
            })}
          </div>

          {/* Bottom Row: Vernier / Risograph Metric Counter + Statement Keyword Card */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: bounds.isVertical ? 'column' : 'row',
              gap: 24,
              alignItems: bounds.isVertical ? 'stretch' : 'center',
            }}
          >
            <div
              style={getTactileSurfaceStyle(style, {
                elevation: 'resting',
                overrides: {
                  padding: '22px 30px',
                  borderRadius:
                    grammar === 'risograph-poster'
                      ? 0
                      : Math.max(0, Math.round(8 * style.surface.radiusScale)),
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  opacity: counterProgress,
                },
              })}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                <span
                  style={{
                    fontFamily: displayFont,
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: bounds.isVertical ? 52 : 60,
                    fontWeight: 800,
                    color: style.palette.accentPrimary,
                  }}
                >
                  {counterVal}%
                </span>
                <span
                  style={{
                    fontFamily: bodyFont,
                    fontSize: 20,
                    fontWeight: 500,
                    color: style.palette.textSecondary,
                  }}
                >
                  utrzymania uwagi widza
                </span>
              </div>

              {grammar === 'risograph-poster' ? (
                <div
                  data-risograph-meter="true"
                  style={{ display: 'flex', gap: 4 }}
                >
                  {Array.from({ length: 12 }).map((_, idx) => (
                    <div
                      key={idx}
                      style={{
                        flex: 1,
                        height: 8,
                        backgroundColor:
                          idx < Math.round(counterProgress * 12)
                            ? style.palette.accentPrimary
                            : style.palette.bgElevated,
                        border: `1.5px solid ${style.palette.inkBorder}`,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <svg
                  data-vernier-scale="true"
                  viewBox="0 0 240 16"
                  style={{ width: '100%', height: 16 }}
                >
                  {Array.from({ length: 21 }).map((_, idx) => {
                    const x = (idx / 20) * 236 + 2;
                    const isMajor = idx % 5 === 0;
                    const active = idx <= litTicks;
                    return (
                      <line
                        key={idx}
                        x1={x}
                        y1={isMajor ? 1 : 5}
                        x2={x}
                        y2={15}
                        stroke={
                          active
                            ? style.palette.accentPrimary
                            : style.palette.inkBorder
                        }
                        strokeWidth={isMajor ? 2 : 1.2}
                        opacity={active ? 1 : 0.45}
                      />
                    );
                  })}
                </svg>
              )}
            </div>

            <div
              style={getTactileSurfaceStyle(style, {
                elevation: 'lifted',
                tiltDeg: grammar === 'risograph-poster' ? -0.7 : 0,
                overrides: {
                  padding: '22px 30px',
                  borderRadius:
                    grammar === 'risograph-poster'
                      ? 0
                      : Math.max(0, Math.round(8 * style.surface.radiusScale)),
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  opacity: cardEnter,
                },
              })}
            >
              <span
                style={{
                  fontFamily: monoFont,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  color: style.palette.accentPrimary,
                }}
              >
                OPTYKA • 60 FPS
              </span>
              <span
                style={{
                  fontFamily: displayFont,
                  fontSize: bounds.isVertical ? 30 : 34,
                  fontWeight: 800,
                  color: style.palette.textPrimary,
                }}
              >
                {formatHeadingText('Głębia ostrości i światło', style)}
              </span>
            </div>
          </div>
        </div>
      </DepthPlane>
    </OpticalStage2D>
  );
};
```

4. Update `StyleLabPreviewComposition` in `packages/studio/src/client/components/StyleLabShowcase.tsx` so `editorial-collage` and `kinetic-typography` mount `<StageLightingRig style={style} renderBaseFill={false} />` and delegate handheld camera motion directly to `<OpticalStage2D>`:

```tsx
export const StyleLabPreviewComposition: React.FC<StyleLabCompositionProps> = ({
  style,
  kit,
}) => {
  const frame = useCurrentFrame();
  const usesOpticalStage =
    kit === 'editorial-collage' || kit === 'kinetic-typography';

  // Deterministic handheld camera drift preview for kits not yet on OpticalStage2D
  const driftX =
    !usesOpticalStage && frame >= 2
      ? Math.sin(frame * 0.045) * style.motion.cameraHandheld * 22
      : 0;
  const driftY =
    !usesOpticalStage && frame >= 2
      ? Math.cos(frame * 0.035) * style.motion.cameraHandheld * 14
      : 0;

  return (
    <StyleProvider style={style} renderBackdrop>
      {frame >= 2 ? (
        <AbsoluteFill
          style={{
            transform:
              driftX !== 0 || driftY !== 0
                ? `translate(${driftX.toFixed(2)}px, ${driftY.toFixed(2)}px)`
                : undefined,
          }}
        >
          {usesOpticalStage && (
            <StageLightingRig
              style={style}
              seed={`style-lab:${kit}`}
              renderBaseFill={false}
            />
          )}
          {kit === 'editorial-collage' && <EditorialCollagePreview />}
          {kit === 'vector-scene-2d' && <VectorScene2DPreview />}
          {kit === 'kinetic-typography' && <KineticTypographyPreview />}
          {kit === 'data-storytelling' && <DataStorytellingPreview />}
          {kit === 'motion-diagrams-2d' && <MotionDiagrams2DPreview />}
          {kit === 'paper-diorama-3d' && <PaperDiorama3DPreview />}
          {kit === 'isometric-3d' && <Isometric3DPreview />}
        </AbsoluteFill>
      ) : null}
    </StyleProvider>
  );
};
```

5. Update `case 'editorial-collage':` and `case 'kinetic-typography':` in `packages/cli/src/commands/new-production.ts` (lines 301–488):

```ts
    case 'editorial-collage':
      return `import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  staticFile,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import {
  SmartMusicBed,
  SoundCue,
  StyleProvider,
  VoiceoverTrack,
  type OpticalShot2D,
} from '@make-pictures/core';
import {
  ChapterTitleCard,
  EditorialDeskStage,
  EditorialMediaCard,
  HighlightQuoteStage,
  SplitStoryLayout,
} from '@make-pictures/kits/editorial-collage';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from '../generated/audio-manifest';

${schemaBlock}

const DIALOGUE_SEGMENTS = [
  { sceneId: '${slug}-intro', fromFrame: 12, durationInFrames: 300 },
  { sceneId: '${slug}-payoff', fromFrame: 324, durationInFrames: 306 },
];

export const ${pascalName}: React.FC<${pascalName}Props> = (props) => {
  const { width, height } = useVideoConfig();
  const introVo = VOICEOVER_MANIFEST['${slug}-intro'];
  const payoffVo = VOICEOVER_MANIFEST['${slug}-payoff'];
  const whooshSfx = SFX_MANIFEST['whoosh-open'];
  const popSfx = SFX_MANIFEST['card-pop'];

  const editorialShots: OpticalShot2D[] = [
    { fromFrame: 0, x: width / 2, y: height / 2 + 8, zoom: 1.0, focalZ: 0.35, transition: 'cut' },
    { fromFrame: 8, x: width / 2 - 6, y: height / 2, zoom: 1.025, focalZ: 0, transition: 'glide' },
    { fromFrame: 220, x: width / 2 + 8, y: height / 2 - 4, zoom: 1.036, focalZ: 0, transition: 'glide' },
    { fromFrame: 430, x: width / 2, y: height / 2, zoom: 1.048, focalZ: 0, transition: 'glide' },
  ];

  return (
    <StyleProvider style={props.styleId} renderBackdrop>
      <AbsoluteFill>
        ${audioBlock}

        <EditorialDeskStage
          shots={editorialShots}
          sheetCode={props.badgeLabel}
          renderBaseFill={false}
        >
          <Sequence from={0} durationInFrames={220}>
            <ChapterTitleCard
              chapterLabel={props.badgeLabel}
              title={props.headline}
              subtitle={props.subheadline}
              startFrame={2}
              accentColor={props.accentColor}
            />
          </Sequence>

          <Sequence from={220} durationInFrames={210}>
            <SplitStoryLayout
              startFrame={2}
              focusShiftFrame={96}
              primary={
                <EditorialMediaCard
                  caption={props.headline}
                  sourceTag={props.badgeLabel}
                  startFrame={2}
                  durationInFrames={195}
                />
              }
              secondary={
                <EditorialMediaCard
                  caption={props.subheadline}
                  sourceTag={props.styleId}
                  startFrame={10}
                  durationInFrames={195}
                  zoomFrom={1.04}
                  zoomTo={1.12}
                />
              }
            />
          </Sequence>

          <Sequence from={430} durationInFrames={218}>
            <HighlightQuoteStage
              quote={payoffVo?.text || props.subheadline}
              highlightPhrase="sześćdziesięciu"
              author={props.headline}
              startFrame={2}
              words={payoffVo?.words}
            />
          </Sequence>
        </EditorialDeskStage>
      </AbsoluteFill>
    </StyleProvider>
  );
};
`;

    case 'kinetic-typography':
      return `import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  staticFile,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import {
  DepthPlane,
  OpticalStage2D,
  SmartMusicBed,
  SoundCue,
  StageLightingRig,
  StyleProvider,
  VoiceoverTrack,
} from '@make-pictures/core';
import {
  AnimatedMetricCounter,
  ImpactKeywordCard,
  WordByWordStage,
} from '@make-pictures/kits/kinetic-typography';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from '../generated/audio-manifest';

${schemaBlock}

const DIALOGUE_SEGMENTS = [
  { sceneId: '${slug}-intro', fromFrame: 12, durationInFrames: 300 },
  { sceneId: '${slug}-payoff', fromFrame: 324, durationInFrames: 306 },
];

export const ${pascalName}: React.FC<${pascalName}Props> = (props) => {
  const { width, height } = useVideoConfig();
  const isVertical = height > width;

  const introVo = VOICEOVER_MANIFEST['${slug}-intro'];
  const payoffVo = VOICEOVER_MANIFEST['${slug}-payoff'];
  const whooshSfx = SFX_MANIFEST['whoosh-open'];
  const popSfx = SFX_MANIFEST['card-pop'];

  return (
    <StyleProvider style={props.styleId} renderBackdrop>
      <AbsoluteFill>
        ${audioBlock}

        <StageLightingRig renderBaseFill={false} />

        <OpticalStage2D startFrame={2}>
          <DepthPlane z={0}>
            <Sequence from={0} durationInFrames={320}>
              <WordByWordStage
                sceneId="${slug}-intro"
                voiceoverManifest={VOICEOVER_MANIFEST}
                fallbackText={\`\${props.headline} — \${props.subheadline}\`}
                eyebrow={props.badgeLabel}
                accentColor={props.accentColor}
                variant="transparent"
                startFrame={2}
              />
            </Sequence>

            <Sequence from={320} durationInFrames={328}>
              <AbsoluteFill
                style={{
                  justifyContent: isVertical ? 'flex-start' : 'center',
                  alignItems: isVertical ? 'flex-start' : 'center',
                  paddingLeft: isVertical ? 54 : 120,
                  paddingRight: isVertical ? 186 : 120,
                  paddingTop: isVertical ? 260 : 0,
                  gap: 28,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: isVertical ? 830 : 1040 }}>
                  <ImpactKeywordCard
                    keyword={props.headline}
                    eyebrow={props.badgeLabel}
                    sublabel={props.subheadline}
                    badge="60 FPS"
                    accentColor={props.accentColor}
                    startFrame={2}
                  />
                  <AnimatedMetricCounter
                    value={60}
                    suffix=" FPS"
                    label="Deterministyczny silnik wideo"
                    badge="-14 LUFS"
                    accentColor={props.secondaryColor}
                    startFrame={14}
                  />
                </div>
              </AbsoluteFill>
            </Sequence>
          </DepthPlane>
        </OpticalStage2D>
      </AbsoluteFill>
    </StyleProvider>
  );
};
`;
```

6. Update the 4 canonical skill files in `plugins/make-pictures/skills/` and sync `skills/`:
   - `plugins/make-pictures/skills/style-and-art-direction/SKILL.md`:
     - In Section 2 (`Catalog of the 7 BUILT_IN_STYLES`), add the `Optics (lightingRig / typographyGrammar)` column (`studio-macro / swiss-spatial` for `minimal-product`, `window-gobo / swiss-spatial` for `editorial-press` & `archival-chronicle`, `darkroom-halation / optical-gate` for `cyber-telemetry`, `darkroom-halation / risograph-poster` for `brutalist-poster`, `window-gobo / risograph-poster` for `sketch-notebook` & `tactile-craft`).
     - In Section 4 (`StylePresetSchema Reference`), document `optics?: StyleOptics` (`lightingRig: 'window-gobo' | 'darkroom-halation' | 'studio-macro'`, `typographyGrammar: 'swiss-spatial' | 'optical-gate' | 'risograph-poster'`, `lightAngleDeg: -60..60`, `aperture: 0..1`, `halation: 0..1`) plus `resolveStyleOptics(style)` and `deriveDefaultOpticsForSurface(surface)`.
   - `plugins/make-pictures/skills/kit-editorial-and-vector/SKILL.md`:
     - Document `EditorialDeskStage` (`shots`, `sheetCode`, `foregroundAccents`, `renderBaseFill`), `EditorialMediaCard` (`mountType?: 'auto' | 'archival-tape' | 'photo-corners' | 'slide-mount' | 'none'`, `tiltDeg?: number`, archival contact-sheet SVG fallback), `HighlightQuoteStage` organic SVG ink-brush / halation sweep, `ChapterTitleCard` optical focus-pull entrance (`filter: 'none'` once settled), and `SplitStoryLayout` (`focusShiftFrame`, `initialFocus`).
   - `plugins/make-pictures/skills/kit-kinetic-and-data/SKILL.md`:
     - Document the 3 polymorphic kinetic grammars (`grammar?: 'swiss-spatial' | 'optical-gate' | 'risograph-poster'` inherited from `style.optics.typographyGrammar`), `ImpactKeywordCard` (`icon` defaults to `null` — no generic icon tile), and `AnimatedMetricCounter` precision SVG Vernier scale / Risograph segmented meter.
   - `plugins/make-pictures/skills/cinematography-and-vfx/SKILL.md`:
     - Add Section `2B. 2.5D Multi-Plane Optical Stage (<OpticalStage2D />, <DepthPlane />, <StageLightingRig />)` documenting `OpticalShot2D` (`focalZ`, `aperture`), `DepthPlane` (`z ∈ [-2.0, +1.5]`, `< 0.25px` sharp focal deadzone emitting `filter: 'none'`), `StageLightingRig` (`window-gobo`, `darkroom-halation`, `studio-macro`), and `getTactileSurfaceStyle(style, { elevation, tiltDeg })`.

- [ ] **Step 4: Sync skills, rebuild all packages, and run full test + typecheck suite**

Run:
```bash
npm run sync:skills && npm run build:packages && npm run typecheck && npm test
```
Expected: PASS (`sync:skills` updates `skills/*`, `build:packages` bundles all 5 packages cleanly, `typecheck` exits `0`, and every test file including `studio-styles-api.test.ts`, `styles-cli.test.ts`, `root-skills-sync.test.ts`, `npx-hermetic-optional-peers.test.ts`, `optical-stage.test.ts`, `narrative-kits.test.ts`, and `kits-style-integration.test.ts` passes).

- [ ] **Step 5: Run Mandatory Visual Contact-Sheet QA (`12-frame PNG`) & Tarball Pack Verification**

1. Scaffold two temporary verification capsules in `productions/` (editorial + kinetic), generate 12-frame Contact-Sheet PNGs, inspect them visually with `read_file`, then clean up the temporary capsules before committing:

```bash
npx tsx packages/cli/src/bin.ts new qa-wave1-editorial --kit=editorial-collage --style=archival-chronicle --lang=pl
npx tsx packages/cli/src/bin.ts new qa-wave1-kinetic --kit=kinetic-typography --style=cyber-telemetry --lang=pl
npm run qa -- QaWave1Editorial
npm run qa -- QaWave1Kinetic
```

2. Inspect `out/qa-QaWave1Editorial.png` and `out/qa-QaWave1Kinetic.png` using `read_file` and verify all 5 visual QA criteria:
   - `f=0` tile is pure empty `bgCanvas` (`#F5EFE2` on `archival-chronicle`, `#070B14` on `cyber-telemetry`) with zero text, rules, or lighting artifacts.
   - Visible directional lighting (`window-gobo` warm mullions on `QaWave1Editorial`; `darkroom-halation` lightbox + gate reticle on `QaWave1Kinetic`).
   - Physical baryta photo-corner mounts, engraving contact-sheet lines, rack-focus transition, and ink-brush highlight on `QaWave1Editorial`; optical-gate reticle + precision SVG Vernier scale (zero karaoke pills, zero `<Sparkles />` square, zero `5px` progress bar) on `QaWave1Kinetic`.
   - Polish `latin-ext` diacritics render crisply (`filter: 'none'` on settled focal plane) and all cards stay strictly inside Safe Box margins.

3. Remove temporary QA capsules and QA PNGs, then run `npm run pack:verify`:

```bash
rm -rf productions/qa-wave1-editorial productions/qa-wave1-kinetic out/qa-QaWave1Editorial.png out/qa-QaWave1Kinetic.png
npm run pack:verify
```
Expected: `pack:verify` exits `0` with clean `git status` on untracked `productions/`.

- [ ] **Step 6: Commit Task 5**

```bash
git add packages/studio/src/client/components/StyleLabShowcase.tsx packages/cli/src/commands/new-production.ts plugins/make-pictures/skills skills packages/cli/tests/studio-styles-api.test.ts packages/cli/tests/styles-cli.test.ts
git commit -m "feat(studio,cli): wire live 60fps optical previews in Style Lab, CLI scaffolds, and studio skills"
```
