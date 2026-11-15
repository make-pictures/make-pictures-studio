# High-Craft Optical Styles — Wave 2 (`vector-scene-2d` & `data-storytelling`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `@make-pictures/kits/vector-scene-2d` and `@make-pictures/kits/data-storytelling` on top of the Wave 1 2.5D Multi-Plane Optical Engine (`OpticalStage2D`, `DepthPlane`, `StageLightingRig`, `getTactileSurfaceStyle`, `resolveStyleOptics`), replacing SaaS dashboard/pill UI tropes with polymorphic graphic plates, architectural elbow callouts, calibrated `240°` instrument gauges, vernier rack-focus timelines, live `60 FPS` `Style Lab` previews, updated CLI scaffolds, synced canonical skills, and `16:9` + `9:16` Contact-Sheet QA.

**Architecture:** Zero changes to `StylePresetSchema` or `@make-pictures/core` — both rebuilt kits read the existing `lightingRig × typographyGrammar` optical matrix (`swiss-spatial`, `optical-gate`, `risograph-poster`) via `resolveStyleOptics(style)`. Each kit gains a dedicated multi-plane stage (`<VectorSceneStage2D />` and `<DataStoryStage2D />`) while keeping 100% backwards compatibility across all existing component exports and props when mounted standalone. Tasks 1, 2, and 3 own completely disjoint file trees and may run concurrently; Task 4 integrates `Style Lab`, `npx make-pictures new` scaffolds, `16:9` + `9:16` Contact-Sheet QA, and `npm run pack:verify`.

**Tech Stack:** TypeScript (`strict`), React 18, Remotion 4 (`60 FPS`), `@remotion/player` (`Thumbnail` SSR tests), Zod, `node:test` + `tsx`.

## Global Constraints

- **Clean Frame `0` Invariant:** On `frame <= 0`, every stage renders pure `style.palette.bgCanvas` (or `null` when `renderBaseFill={false}`), and every scenic component returns `null` for `frame < Math.max(2, startFrame)`.
- **100% Multi-Core Determinism (`--concurrency=100%`):** Zero `Math.random()`, zero cross-frame mutable `useRef`; use `createSeededRandom(seed)` from `@make-pictures/core`.
- **Sharp Vector Typography Deadzone:** Whenever optical blur `< 0.25` px, emit `filter: 'none'` (never `blur(0px)`).
- **`9:16` Golden Safe Box:** All vertical (`1080×1920`) content must stay strictly inside `x ∈ [40, 910], y ∈ [220, 1380]`.
- **Studio Package Boundary:** `packages/studio` must NEVER import from `@make-pictures/kits`, `three`, or `@react-three/fiber` (`StyleLabShowcase.tsx` imports solely from `@make-pictures/core`, `remotion`, and `react`).
- **Polish Copy & Typography (`latin-ext`):** Use Polish *Sentence case* (never *Title Case*); preserve `narrative-kits.test.ts` static regex guards (`Math.max(2, startFrame)` and `return null` in `vector-scene-2d/*.tsx`) and `kits-style-integration.test.ts` guards (`useStudioStyle` in `data-storytelling/*.tsx`).

---

## File Ownership Map

- **Task 1 (`vector-scene-2d` — parallel-safe):**
  - Create: `packages/kits/src/vector-scene-2d/VectorSceneStage2D.tsx`
  - Modify: `packages/kits/src/vector-scene-2d/StoryCard2D.tsx`
  - Modify: `packages/kits/src/vector-scene-2d/AnnotatedCallout2D.tsx`
  - Modify: `packages/kits/src/vector-scene-2d/ComparisonSplit2D.tsx`
  - Modify: `packages/kits/src/vector-scene-2d/index.ts`
  - Modify: `packages/cli/tests/narrative-kits.test.ts`
- **Task 2 (`data-storytelling` — parallel-safe):**
  - Create: `packages/kits/src/data-storytelling/DataStoryStage2D.tsx`
  - Modify: `packages/kits/src/data-storytelling/AnimatedBarRace.tsx`
  - Modify: `packages/kits/src/data-storytelling/TimelineTrack.tsx`
  - Modify: `packages/kits/src/data-storytelling/MetricComparisonCard.tsx`
  - Modify: `packages/kits/src/data-storytelling/index.ts`
  - Modify: `packages/cli/tests/kits-style-integration.test.ts`
- **Task 3 (Canonical Skills & Mirror Sync — parallel-safe):**
  - Modify: `plugins/make-pictures/skills/kit-editorial-and-vector/SKILL.md`
  - Modify: `plugins/make-pictures/skills/kit-kinetic-and-data/SKILL.md`
  - Synced output (`npm run sync:skills`): `skills/kit-editorial-and-vector/SKILL.md`, `skills/kit-kinetic-and-data/SKILL.md`
- **Task 4 (`Style Lab`, `new-production.ts`, QA & `pack:verify` — runs after Tasks 1–3):**
  - Modify: `packages/studio/src/client/components/StyleLabShowcase.tsx`
  - Modify: `packages/cli/src/commands/new-production.ts`
  - Modify: `packages/cli/tests/studio-styles-api.test.ts`
  - Modify: `packages/cli/tests/styles-cli.test.ts`

---

### Task 1: Rebuild `@make-pictures/kits/vector-scene-2d` (`VectorSceneStage2D`, `StoryCard2D`, `AnnotatedCallout2D`, `ComparisonSplit2D`)

**Files:**
- Create: `packages/kits/src/vector-scene-2d/VectorSceneStage2D.tsx`
- Modify: `packages/kits/src/vector-scene-2d/StoryCard2D.tsx`
- Modify: `packages/kits/src/vector-scene-2d/AnnotatedCallout2D.tsx`
- Modify: `packages/kits/src/vector-scene-2d/ComparisonSplit2D.tsx`
- Modify: `packages/kits/src/vector-scene-2d/index.ts`
- Test: `packages/cli/tests/narrative-kits.test.ts`

**Interfaces:**
- Consumes from `@make-pictures/core`: `DepthPlane`, `OpticalStage2D`, `StageLightingRig`, `createSeededRandom`, `formatFontFamilyCss`, `formatHeadingText`, `getStyleSpringConfig`, `getTactileSurfaceStyle`, `resolveStyleOptics`, `useStudioStyle`, `type OpticalShot2D`, `type StageNode2D`.
- Produces in `@make-pictures/kits/vector-scene-2d` (and `@make-pictures/kits`):
  - `VectorSceneStage2D: React.FC<VectorSceneStage2DProps>`
  - `StoryCard2D: React.FC<StoryCard2DProps>` (adds optional `plateCode?: string`, `tiltDeg?: number`, `compact?: boolean`; emits `data-medallion-grammar={grammar}`)
  - `AnnotatedCallout2D: React.FC<AnnotatedCallout2DProps>` (adds optional `sublabel?: string`, `code?: string`, `elbowMode?: 'auto' | 'straight'`; emits `data-callout-reticle="true"` and `data-callout-elbow={mode}`)
  - `ComparisonSplit2D: React.FC<ComparisonSplit2DProps>` (adds optional `focusShiftFrame?: number`, `initialFocus?: 'both' | 'left'`; emits `data-comparison-axis="true"` and `data-comparison-rack={mode}`)
  - `computeSafeSplitBounds(width, height)`

- [ ] **Step 1: Add failing Wave 2 `vector-scene-2d` optical tests in `packages/cli/tests/narrative-kits.test.ts`**

Update the `vector-scene-2d` import at the top of `packages/cli/tests/narrative-kits.test.ts` to include `VectorSceneStage2D`, assert its export in the first test, and append a comprehensive test at the bottom of `packages/cli/tests/narrative-kits.test.ts`:

```ts
// In top imports of packages/cli/tests/narrative-kits.test.ts:
import {
  AnnotatedCallout2D,
  ComparisonSplit2D,
  StoryCard2D,
  VectorSceneStage2D,
  computeSafeSplitBounds,
} from '../../kits/src/vector-scene-2d';

// Append at the end of packages/cli/tests/narrative-kits.test.ts:
test('VectorSceneStage2D, engraved StoryCard2D medallion, elbow AnnotatedCallout2D, and ComparisonSplit2D rack focus render cleanly across styles and 9:16', () => {
  assert.equal(typeof VectorSceneStage2D, 'function');
  assert.equal(kitsRoot.VectorSceneStage2D, VectorSceneStage2D);

  const stageSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/vector-scene-2d/VectorSceneStage2D.tsx'),
    'utf8'
  );
  assert.doesNotMatch(stageSrc, /Math\.random\s*\(/);
  assert.match(stageSrc, /frame\s*<=\s*0/);

  const storyCardSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/vector-scene-2d/StoryCard2D.tsx'),
    'utf8'
  );
  assert.doesNotMatch(storyCardSrc, /999\s*\*/);

  for (const [styleId, expectedGrammar] of [
    ['minimal-product', 'swiss-spatial'],
    ['editorial-press', 'swiss-spatial'],
    ['cyber-telemetry', 'optical-gate'],
    ['brutalist-poster', 'risograph-poster'],
  ] as const) {
    const VectorComp: React.FC = () =>
      React.createElement(
        StyleProvider,
        { style: styleId },
        React.createElement(
          VectorSceneStage2D,
          {
            plateCode: 'TABLICA 01 • ARCHITEKTURA',
            foregroundCallouts: React.createElement(AnnotatedCallout2D, {
              target: [420, 620],
              labelPosition: [680, 820],
              label: 'Punkt zwrotny zażółć',
              sublabel: 'Precyzyjny celownik osiowy',
              code: 'DETAL A·1',
              startFrame: 6,
            }),
          },
          React.createElement(StoryCard2D, {
            title: 'Żółta pieczęć i geometria',
            subtitle: 'Karta tablicowa bez pigułek SaaS',
            badge: 'FIG. 01',
            plateCode: 'Z +0.00',
            startFrame: 2,
          })
        )
      );

    // Frame 0 invariant: pure bgCanvas, zero text or stage headers
    const f0 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: VectorComp,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 140,
        fps: 60,
        frameToDisplay: 0,
      })
    );
    assert.doesNotMatch(f0, /TABLICA 01/);
    assert.doesNotMatch(f0, /Żółta pieczęć/);
    assert.doesNotMatch(f0, /Punkt zwrotny/);

    // Frame 42: engraved medallion, elbow polyline + reticle, elevated callout plane z = +0.42
    const f42 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: VectorComp,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 140,
        fps: 60,
        frameToDisplay: 42,
      })
    );
    assert.match(f42, /TABLICA 01 • ARCHITEKTURA/);
    assert.match(f42, new RegExp(`data-medallion-grammar="${expectedGrammar}"`));
    assert.match(f42, /data-callout-reticle="true"/);
    assert.match(f42, /data-callout-elbow="auto"/);
    assert.match(f42, /data-depth-z="0\.42"/);
    assert.match(f42, /DETAL A·1/);
    assert.doesNotMatch(f42, /blur\(0(?:\.0+)?px\)/);

    // ComparisonSplit2D rack focus from left -> right after focusShiftFrame=36
    const SplitComp: React.FC = () =>
      React.createElement(
        StyleProvider,
        { style: styleId },
        React.createElement(ComparisonSplit2D, {
          startFrame: 2,
          focusShiftFrame: 36,
          left: {
            tag: '01 • PRZED',
            title: 'Płaski szablon',
            detail: 'Brak głębi i światła kierunkowego.',
          },
          right: {
            tag: '02 • PO',
            title: 'Wieloplanowa optyka',
            detail: 'Przeostrzenie prowadzi wzrok widza.',
          },
        })
      );

    const splitBefore = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: SplitComp,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 120,
        fps: 60,
        frameToDisplay: 24,
      })
    );
    const splitAfter = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: SplitComp,
        compositionWidth: 1920,
        compositionHeight: 1080,
        durationInFrames: 120,
        fps: 60,
        frameToDisplay: 90,
      })
    );
    assert.match(splitBefore, /data-comparison-axis="true"/);
    assert.match(splitBefore, /data-comparison-rack="left"/);
    assert.match(splitBefore, /filter:blur\(/);
    assert.match(splitAfter, /Wieloplanowa optyka/);
    assert.doesNotMatch(splitAfter, /blur\(0(?:\.0+)?px\)/);
  }
});
```

- [ ] **Step 2: Run `narrative-kits.test.ts` to verify the new test fails**

Run: `npx tsx --test packages/cli/tests/narrative-kits.test.ts`
Expected: FAIL (`VectorSceneStage2D` is `undefined` / missing exports).

- [ ] **Step 3: Implement `VectorSceneStage2D.tsx`, `StoryCard2D.tsx`, `AnnotatedCallout2D.tsx`, `ComparisonSplit2D.tsx`, and `index.ts`**

Create `packages/kits/src/vector-scene-2d/VectorSceneStage2D.tsx`:

```tsx
import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  DepthPlane,
  OpticalStage2D,
  StageLightingRig,
  formatFontFamilyCss,
  useStudioStyle,
  type OpticalShot2D,
  type StageNode2D,
} from '@make-pictures/core';

export interface VectorSceneStage2DProps {
  shots?: ReadonlyArray<OpticalShot2D>;
  nodes?: Record<string, StageNode2D>;
  /** Construction plate code printed on background plane `z = -0.60` */
  plateCode?: string;
  /** Optional elevated callout layer rendered on plane `z = +0.42` */
  foregroundCallouts?: React.ReactNode;
  /** Render subtle calibration corner bracket on `z = +0.72` outside 9:16 Safe Box (default `true`) */
  foregroundAccents?: boolean;
  /** Render base fill inside StageLightingRig (default `true`) */
  renderBaseFill?: boolean;
  seed?: number;
  children?: React.ReactNode;
}

/**
 * Multi-plane 2.5D Graphic Plate & Architectural Drafting Stage for `vector-scene-2d`.
 * Layers:
 * - `z = -0.60`: Modular construction axes, registration crosses, and `plateCode`
 * - `z =  0.00`: Primary crisp graphic plate (`children`)
 * - `z = +0.42`: Optional `foregroundCallouts` parallax plane
 * - `z = +0.72`: Edge calibration bracket strictly outside `9:16` Golden Safe Box
 */
export const VectorSceneStage2D: React.FC<VectorSceneStage2DProps> = ({
  shots,
  nodes,
  plateCode = 'TABLICA KONCEPCYJNA • 60 FPS',
  foregroundCallouts,
  foregroundAccents = true,
  renderBaseFill = true,
  seed = 2028,
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
        y: cy + 6,
        zoom: 1.0,
        focalZ: 0.36,
        transition: 'cut',
        label: 'Plate Rack In',
      },
      {
        fromFrame: 6,
        x: cx - 5,
        y: cy,
        zoom: 1.024,
        focalZ: 0,
        transition: 'glide',
        label: 'Plate Hero Focus',
      },
      {
        fromFrame: Math.max(24, Math.round(durationInFrames * 0.56)),
        x: cx + 7,
        y: cy - 4,
        zoom: 1.042,
        focalZ: 0,
        transition: 'glide',
        label: 'Plate Micro Dolly',
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
  const guideColor = style.surface.isDark
    ? 'rgba(248, 250, 252, 0.18)'
    : `${style.palette.inkBorder}99`;

  const insetLeft = isVertical ? 40 : 72;
  const insetRight = isVertical ? 164 : 72;
  const insetTop = isVertical ? 204 : 56;
  const insetBottom = isVertical ? 510 : 56;

  return (
    <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
      <StageLightingRig
        style={style}
        seed={`vector-plate:${seed}`}
        renderBaseFill={renderBaseFill}
      />

      <OpticalStage2D
        nodes={nodes}
        shots={shots && shots.length > 0 ? shots : defaultShots}
        seed={seed}
        startFrame={1}
      >
        {/* Plane z = -0.60: Modular Construction Axes & Registration Crosses */}
        <DepthPlane z={-0.6}>
          <AbsoluteFill style={{ pointerEvents: 'none' }}>
            <div
              style={{
                position: 'absolute',
                left: insetLeft,
                right: insetRight,
                top: insetTop,
                bottom: insetBottom,
                border: `1px solid ${guideColor}`,
                opacity: 0.5,
              }}
            >
              {/* Golden-ratio vertical & horizontal construction hairlines */}
              <div
                style={{
                  position: 'absolute',
                  left: '38.2%',
                  top: 0,
                  bottom: 0,
                  width: 1,
                  backgroundColor: guideColor,
                  opacity: 0.65,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: '50%',
                  height: 1,
                  backgroundColor: guideColor,
                  opacity: 0.55,
                }}
              />
            </div>

            <div
              style={{
                position: 'absolute',
                left: insetLeft + 10,
                top: Math.max(18, insetTop - 26),
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                fontFamily: monoFont,
                fontSize: 13,
                letterSpacing: '0.15em',
                color: style.palette.textSecondary,
                opacity: 0.64,
              }}
            >
              <span>┼</span>
              <span>{plateCode}</span>
              <span>•</span>
              <span>{style.id.toUpperCase()}</span>
            </div>
          </AbsoluteFill>
        </DepthPlane>

        {/* Plane z = 0.0: Primary Crisp Graphic Plate */}
        <DepthPlane z={0}>{children}</DepthPlane>

        {/* Plane z = +0.42: Optional Elevated Callouts Plane */}
        {foregroundCallouts ? (
          <DepthPlane z={0.42}>{foregroundCallouts}</DepthPlane>
        ) : null}

        {/* Plane z = +0.72: Edge Calibration Bracket (Strictly Outside 9:16 Safe Box) */}
        {foregroundAccents ? (
          <DepthPlane z={0.72}>
            <div
              style={{
                position: 'absolute',
                left: isVertical ? 44 : 76,
                bottom: isVertical ? 126 : 24,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontFamily: monoFont,
                fontSize: 12,
                letterSpacing: '0.16em',
                color: style.palette.textSecondary,
                opacity: 0.4,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 18,
                  height: 12,
                  borderLeft: `2px solid ${style.palette.accentPrimary}`,
                  borderBottom: `2px solid ${style.palette.accentPrimary}`,
                }}
              />
              <span>CAL • 1:1</span>
            </div>
          </DepthPlane>
        ) : null}
      </OpticalStage2D>
    </AbsoluteFill>
  );
};
```

Replace `packages/kits/src/vector-scene-2d/StoryCard2D.tsx` with:

```tsx
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  createSeededRandom,
  formatFontFamilyCss,
  formatHeadingText,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioStyle,
} from '@make-pictures/core';

export interface StoryCard2DProps {
  title: string;
  subtitle?: string;
  badge?: string;
  icon?: React.ReactNode;
  plateCode?: string;
  tiltDeg?: number;
  compact?: boolean;
  startFrame?: number;
  accentColor?: string;
  styleOverrides?: React.CSSProperties;
}

export const StoryCard2D: React.FC<StoryCard2DProps> = ({
  title,
  subtitle,
  badge,
  icon,
  plateCode,
  tiltDeg,
  compact = false,
  startFrame = 2,
  accentColor,
  styleOverrides,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const optics = resolveStyleOptics(style);
  const grammar = optics.typographyGrammar;
  const isVertical = height > width;

  const effectiveStart = Math.max(2, startFrame);
  if (frame < effectiveStart) return null;

  const enter = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const accent = accentColor ?? style.palette.accentPrimary;

  // Optical pull-in blur with strict < 0.25px vector sharpness deadzone
  const pullProgress = interpolate(
    frame - effectiveStart,
    [0, 16],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const rawBlur = (1 - pullProgress) * (2.2 + optics.aperture * 2.8);
  const filterCss = rawBlur < 0.25 ? 'none' : `blur(${rawBlur.toFixed(2)}px)`;

  const defaultTilt =
    optics.lightingRig === 'studio-macro'
      ? 0
      : grammar === 'risograph-poster'
        ? (createSeededRandom(`story-plate:${title}`)() - 0.5) *
          (isVertical ? 1.1 : 1.6)
        : 0;
  const effectiveTilt = Math.max(
    isVertical ? -0.9 : -1.4,
    Math.min(isVertical ? 0.9 : 1.4, tiltDeg ?? defaultTilt)
  );

  const displayFont = formatFontFamilyCss(style.typography.displayFont, 'display');
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');

  const medallionSize = compact ? 52 : 60;

  return (
    <div
      data-medallion-grammar={grammar}
      style={getTactileSurfaceStyle(style, {
        elevation: 'lifted',
        tiltDeg: effectiveTilt,
        overrides: {
          boxSizing: 'border-box',
          position: 'relative',
          padding: compact
            ? '24px 28px'
            : isVertical
              ? '30px 34px'
              : '36px 42px',
          borderRadius:
            grammar === 'risograph-poster'
              ? 0
              : Math.max(0, Math.round(6 * style.surface.radiusScale)),
          borderTop:
            grammar === 'swiss-spatial'
              ? `3px solid ${accent}`
              : undefined,
          display: 'flex',
          flexDirection: 'column',
          gap: compact ? 14 : 18,
          opacity: enter,
          filter: filterCss,
          transform: `translateY(${interpolate(enter, [0, 1], [20, 0]).toFixed(2)}px) scale(${interpolate(enter, [0, 1], [0.975, 1]).toFixed(4)})`,
          ...styleOverrides,
        },
      })}
    >
      {/* Top Calibration Index Header (Replaces rounded pill badge) */}
      {(badge || plateCode || grammar === 'optical-gate') && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            paddingBottom: 10,
            borderBottom: `1px solid ${style.palette.inkBorder}`,
            fontFamily: monoFont,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '0.12em',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                display: 'inline-block',
                width: grammar === 'risograph-poster' ? 10 : 3,
                height: 14,
                backgroundColor: accent,
              }}
            />
            <span
              style={{
                color:
                  grammar === 'risograph-poster'
                    ? style.palette.textPrimary
                    : accent,
              }}
            >
              {badge ?? 'FIG. 01'}
            </span>
          </div>

          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: style.palette.textSecondary,
            }}
          >
            {plateCode ?? (grammar === 'optical-gate' ? 'OPTICAL PLATE' : '60 FPS')}
          </span>
        </div>
      )}

      {/* Main Plate Body: Engraved Geometric Medallion + Headline/Copy */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: compact ? 18 : 22,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: medallionSize,
            height: medallionSize,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accent,
            boxShadow:
              grammar === 'optical-gate' && optics.halation > 0.05
                ? `0 0 ${Math.round(12 + optics.halation * 20)}px ${accent}44`
                : grammar === 'risograph-poster'
                  ? `3px 3px 0px ${style.palette.inkBorder}`
                  : 'none',
            backgroundColor:
              grammar === 'risograph-poster'
                ? style.palette.bgElevated
                : 'transparent',
            border:
              grammar === 'risograph-poster'
                ? `1.5px solid ${style.palette.inkBorder}`
                : 'none',
          }}
        >
          <svg
            width={medallionSize}
            height={medallionSize}
            viewBox="0 0 60 60"
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            {grammar === 'swiss-spatial' && (
              <>
                <circle
                  cx="30"
                  cy="30"
                  r="27"
                  fill="none"
                  stroke={style.palette.inkBorder}
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <circle
                  cx="30"
                  cy="30"
                  r="20"
                  fill="none"
                  stroke={accent}
                  strokeWidth="1.5"
                />
                <line x1="30" y1="0" x2="30" y2="8" stroke={style.palette.textSecondary} strokeWidth="1.2" />
                <line x1="30" y1="52" x2="30" y2="60" stroke={style.palette.textSecondary} strokeWidth="1.2" />
                <line x1="0" y1="30" x2="8" y2="30" stroke={style.palette.textSecondary} strokeWidth="1.2" />
                <line x1="52" y1="30" x2="60" y2="30" stroke={style.palette.textSecondary} strokeWidth="1.2" />
              </>
            )}

            {grammar === 'optical-gate' && (
              <>
                <path
                  d="M4 16 V4 H16 M44 4 H56 V16 M56 44 V56 H44 M16 56 H4 V44"
                  fill="none"
                  stroke={accent}
                  strokeWidth="1.6"
                />
                <circle
                  cx="30"
                  cy="30"
                  r="18"
                  fill="none"
                  stroke={accent}
                  strokeWidth="1.2"
                  opacity={0.75}
                />
              </>
            )}

            {grammar === 'risograph-poster' && (
              <rect
                x="6"
                y="6"
                width="48"
                height="48"
                fill="none"
                stroke={accent}
                strokeWidth="2"
              />
            )}

            {!icon && (
              <polygon
                points="30,18 41,38 19,38"
                fill="none"
                stroke={accent}
                strokeWidth="1.8"
              />
            )}
          </svg>

          {icon ? (
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: compact ? 24 : 26,
              }}
            >
              {icon}
            </div>
          ) : null}
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div
            style={{
              fontFamily: displayFont,
              fontSize: compact ? 34 : isVertical ? 38 : 42,
              fontWeight: 700,
              lineHeight: 1.14,
              letterSpacing: `${style.typography.displayTrackingEm}em`,
              color: style.palette.textPrimary,
            }}
          >
            {formatHeadingText(title, style)}
          </div>

          {subtitle ? (
            <div
              style={{
                fontFamily: bodyFont,
                fontSize: compact ? 21 : 24,
                lineHeight: 1.4,
                color: style.palette.textSecondary,
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
```

Replace `packages/kits/src/vector-scene-2d/AnnotatedCallout2D.tsx` with:

```tsx
import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  formatFontFamilyCss,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioStyle,
} from '@make-pictures/core';

export interface AnnotatedCallout2DProps {
  target: [number, number];
  labelPosition: [number, number];
  label: string;
  sublabel?: string;
  code?: string;
  elbowMode?: 'auto' | 'straight';
  startFrame?: number;
  accentColor?: string;
}

export const AnnotatedCallout2D: React.FC<AnnotatedCallout2DProps> = ({
  target,
  labelPosition,
  label,
  sublabel,
  code,
  elbowMode = 'auto',
  startFrame = 8,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const optics = resolveStyleOptics(style);
  const grammar = optics.typographyGrammar;
  const isVertical = height > width;

  const effectiveStart = Math.max(2, startFrame);
  if (frame < effectiveStart) return null;

  const progress = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(style, 'emphasis'),
  });
  const accent = accentColor ?? style.palette.accentPrimary;

  const [tx, ty] = target;
  const [rawLx, rawLy] = labelPosition;

  // Clamp label center inside 9:16 Golden Safe Box [40, 910] × [220, 1380]
  const lx = isVertical
    ? Math.max(190, Math.min(width * (740 / 1080), rawLx))
    : rawLx;
  const ly = isVertical
    ? Math.max(264, Math.min(height * (1332 / 1920), rawLy))
    : rawLy;

  const dx = lx - tx;
  const dy = ly - ty;
  const useStraight =
    elbowMode === 'straight' || Math.abs(dx) < 18 || Math.abs(dy) < 18;

  const dirX = dx >= 0 ? 1 : -1;
  const diagSpan = Math.min(Math.abs(dy), Math.abs(dx) * 0.68);
  const elbowX = useStraight ? lx : tx + dirX * diagSpan;
  const elbowY = ly;

  const seg1 = Math.hypot(elbowX - tx, elbowY - ty);
  const seg2 = useStraight ? 0 : Math.abs(lx - elbowX);
  const totalLen = Math.max(1, seg1 + seg2);

  const polylinePoints = useStraight
    ? `${tx},${ty} ${lx},${ly}`
    : `${tx},${ty} ${elbowX.toFixed(1)},${elbowY.toFixed(1)} ${lx.toFixed(1)},${ly.toFixed(1)}`;

  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');
  const reticleR = 11 * progress;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
      >
        {/* Optical Target Crosshair Reticle at `target` */}
        <g data-callout-reticle="true" opacity={progress}>
          <circle
            cx={tx}
            cy={ty}
            r={Math.max(0.5, reticleR)}
            fill="none"
            stroke={accent}
            strokeWidth={1.6}
          />
          <circle cx={tx} cy={ty} r={2.6} fill={accent} />
          <line
            x1={tx - 16}
            y1={ty}
            x2={tx - 6}
            y2={ty}
            stroke={accent}
            strokeWidth={1.3}
          />
          <line
            x1={tx + 6}
            y1={ty}
            x2={tx + 16}
            y2={ty}
            stroke={accent}
            strokeWidth={1.3}
          />
          <line
            x1={tx}
            y1={ty - 16}
            x2={tx}
            y2={ty - 6}
            stroke={accent}
            strokeWidth={1.3}
          />
          <line
            x1={tx}
            y1={ty + 6}
            x2={tx}
            y2={ty + 16}
            stroke={accent}
            strokeWidth={1.3}
          />
        </g>

        {/* 2-Segment Architectural Elbow Leader */}
        <polyline
          data-callout-elbow={useStraight ? 'straight' : 'auto'}
          points={polylinePoints}
          fill="none"
          stroke={
            grammar === 'risograph-poster'
              ? style.palette.textPrimary
              : accent
          }
          strokeWidth={1.8}
          strokeLinejoin="miter"
          strokeDasharray={totalLen}
          strokeDashoffset={totalLen * (1 - progress)}
        />
      </svg>

      {/* Tactile Flag Plate at `labelPosition` */}
      <div
        style={getTactileSurfaceStyle(style, {
          elevation: 'floating',
          overrides: {
            boxSizing: 'border-box',
            position: 'absolute',
            left: lx,
            top: ly,
            maxWidth: isVertical ? 360 : 440,
            transform: `translate(-50%, -50%) scale(${(0.94 + 0.06 * progress).toFixed(4)})`,
            padding: sublabel || code ? '12px 18px' : '10px 18px',
            borderRadius:
              grammar === 'risograph-poster'
                ? 0
                : Math.max(0, Math.round(5 * style.surface.radiusScale)),
            borderLeft: dirX >= 0 ? `3.5px solid ${accent}` : undefined,
            borderRight: dirX < 0 ? `3.5px solid ${accent}` : undefined,
            opacity: progress,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          },
        })}
      >
        {code ? (
          <span
            style={{
              fontFamily: monoFont,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: accent,
            }}
          >
            {code}
          </span>
        ) : null}

        <span
          style={{
            fontFamily: bodyFont,
            fontSize: 21,
            fontWeight: 700,
            lineHeight: 1.25,
            color: style.palette.textPrimary,
          }}
        >
          {label}
        </span>

        {sublabel ? (
          <span
            style={{
              fontFamily: bodyFont,
              fontSize: 16,
              lineHeight: 1.3,
              color: style.palette.textSecondary,
            }}
          >
            {sublabel}
          </span>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
```

Replace `packages/kits/src/vector-scene-2d/ComparisonSplit2D.tsx` with:

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
  createSeededRandom,
  formatFontFamilyCss,
  formatHeadingText,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioStyle,
} from '@make-pictures/core';

export interface ComparisonSideSpec {
  tag: string;
  title: string;
  detail: string;
}

export interface ComparisonSplit2DProps {
  left: ComparisonSideSpec;
  right: ComparisonSideSpec;
  startFrame?: number;
  rightDelayFrames?: number;
  /** Optional composition frame at which optical focus shifts from `left` (baseline) to `right` (payoff) */
  focusShiftFrame?: number;
  /** Initial focal behavior before `focusShiftFrame` (`'left'` when `focusShiftFrame` is set, otherwise `'both'`) */
  initialFocus?: 'both' | 'left';
}

export function computeSafeSplitBounds(
  width: number,
  height: number
): {
  isVertical: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
} {
  const isVertical = height > width;
  if (isVertical) {
    const scaleX = width / 1080;
    const scaleY = height / 1920;
    return {
      isVertical: true,
      left: Math.round(54 * scaleX),
      top: Math.round(250 * scaleY),
      width: Math.round(836 * scaleX),
      height: Math.round(1080 * scaleY),
    };
  }
  return {
    isVertical: false,
    left: 130,
    top: 210,
    width: width - 260,
    height: height - 420,
  };
}

export const ComparisonSplit2D: React.FC<ComparisonSplit2DProps> = ({
  left,
  right,
  startFrame = 2,
  rightDelayFrames = 14,
  focusShiftFrame,
  initialFocus,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const optics = resolveStyleOptics(style);
  const grammar = optics.typographyGrammar;

  const effectiveStart = Math.max(2, startFrame);
  if (frame < effectiveStart) return null;

  const bounds = computeSafeSplitBounds(width, height);
  const leftEnter = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const rightStartFrame = effectiveStart + rightDelayFrames;
  const rightEnter =
    frame < rightStartFrame
      ? 0
      : spring({
          frame: frame - rightStartFrame,
          fps,
          config: getStyleSpringConfig(style, 'enter'),
        });

  const rackMode =
    initialFocus ?? (typeof focusShiftFrame === 'number' ? 'left' : 'both');

  const shiftProgress =
    typeof focusShiftFrame === 'number' && frame >= focusShiftFrame
      ? spring({
          frame: frame - focusShiftFrame,
          fps,
          config: getStyleSpringConfig(style, 'camera'),
        })
      : 0;

  const maxBlur = Math.max(1.6, optics.aperture * 7);
  const leftBlur =
    rackMode === 'both' ? 0 : interpolate(shiftProgress, [0, 1], [0, maxBlur]);
  const rightBlur =
    rackMode === 'both' ? 0 : interpolate(shiftProgress, [0, 1], [maxBlur, 0]);

  const leftScale =
    rackMode === 'both' ? 1 : interpolate(shiftProgress, [0, 1], [1, 0.982]);
  const rightScale =
    rackMode === 'both' ? 1 : interpolate(shiftProgress, [0, 1], [0.982, 1]);

  const leftDim =
    rackMode === 'both' ? 1 : interpolate(shiftProgress, [0, 1], [1, 0.8]);
  const rightDim =
    rackMode === 'both' ? 1 : interpolate(shiftProgress, [0, 1], [0.8, 1]);

  const tiltSeed = createSeededRandom(
    `split:${left.title}:${right.title}`
  )();
  const maxTilt = bounds.isVertical ? 0.42 : 0.8;
  const rightTilt =
    grammar === 'risograph-poster' && optics.lightingRig !== 'studio-macro'
      ? (tiltSeed - 0.5) * 2 * maxTilt
      : 0;

  const displayFont = formatFontFamilyCss(style.typography.displayFont, 'display');
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');

  const renderPlate = (params: {
    item: ComparisonSideSpec;
    side: 'left' | 'right';
    enter: number;
    blurPx: number;
    focusScale: number;
    focusOpacity: number;
    tiltDeg: number;
  }) => {
    const { item, side, enter, blurPx, focusScale, focusOpacity, tiltDeg } =
      params;
    const isPayoff = side === 'right';
    const accent = isPayoff
      ? style.palette.accentPrimary
      : style.palette.textSecondary;

    return (
      <div
        style={getTactileSurfaceStyle(style, {
          elevation: isPayoff ? 'floating' : 'resting',
          tiltDeg,
          overrides: {
            boxSizing: 'border-box',
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            padding: bounds.isVertical ? '26px 32px' : '40px 44px',
            borderRadius:
              grammar === 'risograph-poster'
                ? 0
                : Math.max(0, Math.round(6 * style.surface.radiusScale)),
            borderTop: isPayoff
              ? `3px solid ${style.palette.accentPrimary}`
              : undefined,
            opacity: enter * focusOpacity,
            filter: blurPx < 0.25 ? 'none' : `blur(${blurPx.toFixed(2)}px)`,
            transform: `translateY(${interpolate(enter, [0, 1], [20, 0]).toFixed(2)}px) scale(${focusScale.toFixed(4)})`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: bounds.isVertical ? 12 : 16,
          },
        })}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: 8,
            borderBottom: `1px ${isPayoff ? 'solid' : 'dashed'} ${style.palette.inkBorder}`,
            fontFamily: monoFont,
            fontSize: 16,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: accent,
          }}
        >
          <span>{item.tag}</span>
          <span style={{ fontSize: 12, opacity: 0.72 }}>
            {isPayoff ? 'TEZA' : 'BAZA'}
          </span>
        </div>

        <div
          style={{
            fontFamily: displayFont,
            fontSize: bounds.isVertical ? 38 : 48,
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: `${style.typography.displayTrackingEm}em`,
            color: style.palette.textPrimary,
          }}
        >
          {formatHeadingText(item.title, style)}
        </div>

        <div
          style={{
            fontFamily: bodyFont,
            fontSize: bounds.isVertical ? 22 : 25,
            lineHeight: 1.38,
            color: style.palette.textSecondary,
          }}
        >
          {item.detail}
        </div>
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        data-comparison-rack={rackMode}
        style={{
          position: 'absolute',
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: bounds.isVertical ? 'column' : 'row',
          alignItems: 'stretch',
          gap: bounds.isVertical ? 18 : 24,
        }}
      >
        {renderPlate({
          item: left,
          side: 'left',
          enter: leftEnter,
          blurPx: leftBlur,
          focusScale: leftScale,
          focusOpacity: leftDim,
          tiltDeg: 0,
        })}

        {/* Central Calibration Axis Divider */}
        <div
          data-comparison-axis="true"
          style={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: bounds.isVertical ? 'row' : 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            opacity: Math.max(leftEnter, rightEnter) * 0.78,
          }}
        >
          <div
            style={{
              flex: 1,
              width: bounds.isVertical ? undefined : 1,
              height: bounds.isVertical ? 1 : undefined,
              backgroundColor: style.palette.inkBorder,
            }}
          />
          <span
            style={{
              fontFamily: monoFont,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: style.palette.accentPrimary,
            }}
          >
            ┼
          </span>
          <div
            style={{
              flex: 1,
              width: bounds.isVertical ? undefined : 1,
              height: bounds.isVertical ? 1 : undefined,
              backgroundColor: style.palette.inkBorder,
            }}
          />
        </div>

        {renderPlate({
          item: right,
          side: 'right',
          enter: rightEnter,
          blurPx: rightBlur,
          focusScale: rightScale,
          focusOpacity: rightDim,
          tiltDeg: rightTilt,
        })}
      </div>
    </AbsoluteFill>
  );
};
```

Update `packages/kits/src/vector-scene-2d/index.ts`:

```ts
export * from './VectorSceneStage2D';
export * from './StoryCard2D';
export * from './AnnotatedCallout2D';
export * from './ComparisonSplit2D';
```

- [ ] **Step 4: Run `narrative-kits.test.ts` and typecheck to verify everything passes**

Run: `npx tsx --test packages/cli/tests/narrative-kits.test.ts && npm run typecheck`
Expected: PASS (`0` errors).

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/kits/src/vector-scene-2d packages/cli/tests/narrative-kits.test.ts
git commit -m "feat(kits): rebuild vector-scene-2d with VectorSceneStage2D, medallions, elbow callouts, and rack focus"
```

---

### Task 2: Rebuild `@make-pictures/kits/data-storytelling` (`DataStoryStage2D`, `AnimatedBarRace`, `TimelineTrack`, `MetricComparisonCard`)

**Files:**
- Create: `packages/kits/src/data-storytelling/DataStoryStage2D.tsx`
- Modify: `packages/kits/src/data-storytelling/AnimatedBarRace.tsx`
- Modify: `packages/kits/src/data-storytelling/TimelineTrack.tsx`
- Modify: `packages/kits/src/data-storytelling/MetricComparisonCard.tsx`
- Modify: `packages/kits/src/data-storytelling/index.ts`
- Test: `packages/cli/tests/kits-style-integration.test.ts`

**Interfaces:**
- Consumes from `@make-pictures/core`: `DepthPlane`, `OpticalStage2D`, `SPRING_PRESETS`, `StageLightingRig`, `formatFontFamilyCss`, `formatHeadingText`, `getStyleSpringConfig`, `getTactileSurfaceStyle`, `resolveStyleOptics`, `useStudioFontsReady`, `useStudioStyle`, `type OpticalShot2D`, `type StageNode2D`, `type StylePreset`.
- Produces in `@make-pictures/kits/data-storytelling` (and `@make-pictures/kits`):
  - `DataStoryStage2D: React.FC<DataStoryStage2DProps>`
  - `AnimatedBarRace: React.FC<AnimatedBarRaceProps>`, `getSmoothedRanks`, `resolveTonalBarFill` (emits `data-bar-grammar={grammar}` and `data-bar-grid="true"`, removes `FALLBACK_BAR_SWATCHES`)
  - `TimelineTrack: React.FC<TimelineTrackProps>` (emits `data-timeline-grammar={grammar}` and `data-vernier-rail="true"`, removes `<Check />`)
  - `MetricComparisonCard: React.FC<MetricComparisonCardProps>` (emits `data-instrument-arc="240"` in `mode === 'rings'` and `data-delta-hatch="true"` in `mode === 'bars'`)

- [ ] **Step 1: Add failing Wave 2 `data-storytelling` optical & tonal tests in `packages/cli/tests/kits-style-integration.test.ts`**

Import `AnimatedBarRace`, `DataStoryStage2D`, `MetricComparisonCard`, `TimelineTrack`, `getSmoothedRanks`, `resolveTonalBarFill` from `../../kits/src/data-storytelling` and `* as kitsRoot` from `../../kits/src/index` at the top of `packages/cli/tests/kits-style-integration.test.ts`, and append the following test at the end of `packages/cli/tests/kits-style-integration.test.ts`:

```ts
// Update line 9 of packages/cli/tests/kits-style-integration.test.ts and add data-storytelling + kitsRoot imports:
import { BUILT_IN_STYLE_IDS, BUILT_IN_STYLES, StyleProvider } from '../../core/src/index';
import {
  AnimatedBarRace,
  DataStoryStage2D,
  MetricComparisonCard,
  TimelineTrack,
  getSmoothedRanks,
  resolveTonalBarFill,
} from '../../kits/src/data-storytelling';
import * as kitsRoot from '../../kits/src/index';

// Append at the end of packages/cli/tests/kits-style-integration.test.ts:
test('DataStoryStage2D, tonal AnimatedBarRace, vernier rack-focus TimelineTrack, and 240-deg / hatched MetricComparisonCard eliminate SaaS slop across styles', () => {
  assert.equal(typeof DataStoryStage2D, 'function');
  assert.equal(typeof getSmoothedRanks, 'function');
  assert.equal(typeof resolveTonalBarFill, 'function');
  assert.equal(kitsRoot.DataStoryStage2D, DataStoryStage2D);

  const barSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/data-storytelling/AnimatedBarRace.tsx'),
    'utf8'
  );
  const timelineSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/data-storytelling/TimelineTrack.tsx'),
    'utf8'
  );
  const metricSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/data-storytelling/MetricComparisonCard.tsx'),
    'utf8'
  );
  assert.doesNotMatch(barSrc, /FALLBACK_BAR_SWATCHES/);
  assert.doesNotMatch(barSrc, /#10B981|#F43F5E|#A855F7/);
  assert.doesNotMatch(timelineSrc, /lucide-react/);
  assert.doesNotMatch(metricSrc, /lucide-react/);

  // Tonal hierarchy: rank 0 -> accentPrimary, rank 1 -> accentSecondary, explicit color preserved
  const edStyle = BUILT_IN_STYLES['editorial-press'];
  assert.equal(resolveTonalBarFill(edStyle, 0), edStyle.palette.accentPrimary);
  assert.equal(resolveTonalBarFill(edStyle, 1), edStyle.palette.accentSecondary);
  assert.equal(resolveTonalBarFill(edStyle, 2, '#123456'), '#123456');

  // Deterministic overtaking rank smoother
  const rankMid = getSmoothedRanks(
    [
      { id: 'a', label: 'A', value: 50, keyframes: [{ frame: 0, value: 80 }, { frame: 60, value: 40 }] },
      { id: 'b', label: 'B', value: 50, keyframes: [{ frame: 0, value: 30 }, { frame: 60, value: 90 }] },
    ],
    30
  );
  assert.ok((rankMid.get('a') ?? 0) > 0 && (rankMid.get('a') ?? 1) < 1);

  for (const [styleId, expectedGrammar] of [
    ['editorial-press', 'swiss-spatial'],
    ['cyber-telemetry', 'optical-gate'],
    ['brutalist-poster', 'risograph-poster'],
  ] as const) {
    const DataScene: React.FC = () =>
      React.createElement(
        StyleProvider,
        { style: styleId },
        React.createElement(
          DataStoryStage2D,
          { datasetCode: 'KARTOGRAFIA DANYCH • 2026' },
          React.createElement(AnimatedBarRace, {
            title: 'Udział źródeł energii',
            subtitle: 'Porównanie kwartalne',
            valueSuffix: '%',
            startFrame: 2,
            items: [
              { id: 'solar', label: 'Fotowoltaika', value: 94 },
              { id: 'wind', label: 'Wiatr morski', value: 72 },
              { id: 'hydro', label: 'Hydroenergia', value: 48 },
            ],
          }),
          React.createElement(TimelineTrack, {
            startFrame: 2,
            milestones: [
              { id: 'm1', era: '1998', label: 'Archiwum analogowe', fromFrame: 2 },
              { id: 'm2', era: '2026', label: 'Przełom optyczny', fromFrame: 30 },
              { id: 'm3', era: '2030', label: 'Pełna skala', fromFrame: 90 },
            ],
          }),
          React.createElement(MetricComparisonCard, {
            title: 'Wydajność potoku',
            beforeLabel: 'Przed',
            beforeValue: 24,
            afterLabel: 'Po zmianie',
            afterValue: 68,
            unit: ' FPS',
            mode: 'rings',
            startFrame: 2,
          }),
          React.createElement(MetricComparisonCard, {
            beforeLabel: 'Baza',
            beforeValue: 30,
            afterLabel: 'Wynik',
            afterValue: 84,
            unit: '%',
            mode: 'bars',
            startFrame: 2,
          })
        )
      );

    // Frame 0 clean canvas invariant
    const f0 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: DataScene,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 140,
        fps: 60,
        frameToDisplay: 0,
      })
    );
    assert.doesNotMatch(f0, /KARTOGRAFIA DANYCH/);
    assert.doesNotMatch(f0, /Fotowoltaika/);
    assert.doesNotMatch(f0, /Przełom optyczny/);

    // Frame 54: active milestone m2 ('2026') sharp at filter:none while m1 & m3 blurred; 240-deg arc & hatched delta rendered
    const f54 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: DataScene,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 140,
        fps: 60,
        frameToDisplay: 54,
      })
    );
    assert.match(f54, /KARTOGRAFIA DANYCH • 2026/);
    assert.match(f54, new RegExp(`data-bar-grammar="${expectedGrammar}"`));
    assert.match(f54, /data-bar-grid="true"/);
    assert.match(f54, new RegExp(`data-timeline-grammar="${expectedGrammar}"`));
    assert.match(f54, /data-vernier-rail="true"/);
    assert.match(f54, /data-instrument-arc="240"/);
    assert.match(f54, /data-delta-hatch="true"/);
    assert.doesNotMatch(f54, /lucide-check/i);
    assert.doesNotMatch(f54, /border-radius:9999px/);
    assert.doesNotMatch(f54, /blur\(0(?:\.0+)?px\)/);
    assert.match(f54, /filter:blur\(/);
  }
});
```

- [ ] **Step 2: Run `kits-style-integration.test.ts` to verify the new test fails**

Run: `npx tsx --test packages/cli/tests/kits-style-integration.test.ts`
Expected: FAIL (`DataStoryStage2D` / `resolveTonalBarFill` undefined; `FALLBACK_BAR_SWATCHES` still present).

- [ ] **Step 3: Implement `DataStoryStage2D.tsx`, `AnimatedBarRace.tsx`, `TimelineTrack.tsx`, `MetricComparisonCard.tsx`, and `index.ts`**

Create `packages/kits/src/data-storytelling/DataStoryStage2D.tsx`:

```tsx
import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  DepthPlane,
  OpticalStage2D,
  StageLightingRig,
  formatFontFamilyCss,
  useStudioStyle,
  type OpticalShot2D,
  type StageNode2D,
} from '@make-pictures/core';

export interface DataStoryStage2DProps {
  shots?: ReadonlyArray<OpticalShot2D>;
  nodes?: Record<string, StageNode2D>;
  /** Dataset / scale code printed on the `z = -0.58` cartography sheet */
  datasetCode?: string;
  /** Render subtle vernier edge ticks on `z = +0.68` outside 9:16 Safe Box (default `true`) */
  foregroundAccents?: boolean;
  /** Render base fill inside StageLightingRig (default `true`) */
  renderBaseFill?: boolean;
  seed?: number;
  children?: React.ReactNode;
}

/**
 * Multi-plane 2.5D Editorial Data Cartography & Instrument Stage for `data-storytelling`.
 * Layers:
 * - `z = -0.58`: Scale grid sheet (`0% · 25% · 50% · 75% · 100%`) and `datasetCode`
 * - `z =  0.00`: Primary crisp data card / timeline (`children`)
 * - `z = +0.68`: Edge vernier scale strictly outside `9:16` Golden Safe Box
 */
export const DataStoryStage2D: React.FC<DataStoryStage2DProps> = ({
  shots,
  nodes,
  datasetCode = 'ARKUSZ POMIAROWY • 60 FPS',
  foregroundAccents = true,
  renderBaseFill = true,
  seed = 2029,
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
        y: cy + 6,
        zoom: 1.0,
        focalZ: 0.34,
        transition: 'cut',
        label: 'Data Sheet Rack In',
      },
      {
        fromFrame: 6,
        x: cx - 4,
        y: cy,
        zoom: 1.022,
        focalZ: 0,
        transition: 'glide',
        label: 'Data Sheet Hero Focus',
      },
      {
        fromFrame: Math.max(24, Math.round(durationInFrames * 0.58)),
        x: cx + 6,
        y: cy - 3,
        zoom: 1.038,
        focalZ: 0,
        transition: 'glide',
        label: 'Data Sheet Micro Dolly',
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
  const ruleColor = style.surface.isDark
    ? 'rgba(248, 250, 252, 0.16)'
    : `${style.palette.inkBorder}99`;

  const insetLeft = isVertical ? 40 : 80;
  const insetRight = isVertical ? 168 : 80;
  const insetTop = isVertical ? 206 : 54;
  const insetBottom = isVertical ? 512 : 54;

  return (
    <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
      <StageLightingRig
        style={style}
        seed={`data-stage:${seed}`}
        renderBaseFill={renderBaseFill}
      />

      <OpticalStage2D
        nodes={nodes}
        shots={shots && shots.length > 0 ? shots : defaultShots}
        seed={seed}
        startFrame={1}
      >
        {/* Plane z = -0.58: Data Cartography Scale Sheet */}
        <DepthPlane z={-0.58}>
          <AbsoluteFill style={{ pointerEvents: 'none' }}>
            <div
              style={{
                position: 'absolute',
                left: insetLeft,
                right: insetRight,
                top: insetTop,
                bottom: insetBottom,
                borderTop: `1px solid ${ruleColor}`,
                borderBottom: `1px solid ${ruleColor}`,
                opacity: 0.52,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              {[0, 25, 50, 75, 100].map((pct) => (
                <div
                  key={pct}
                  style={{
                    width: 1,
                    height: '100%',
                    backgroundColor: ruleColor,
                    opacity: pct === 0 || pct === 100 ? 0.85 : 0.45,
                  }}
                />
              ))}
            </div>

            <div
              style={{
                position: 'absolute',
                left: insetLeft + 8,
                top: Math.max(18, insetTop - 26),
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                fontFamily: monoFont,
                fontSize: 13,
                letterSpacing: '0.15em',
                color: style.palette.textSecondary,
                opacity: 0.62,
              }}
            >
              <span>∑</span>
              <span>{datasetCode}</span>
              <span>•</span>
              <span>0 · 25 · 50 · 75 · 100</span>
            </div>
          </AbsoluteFill>
        </DepthPlane>

        {/* Plane z = 0.0: Primary Crisp Data Plane */}
        <DepthPlane z={0}>{children}</DepthPlane>

        {/* Plane z = +0.68: Edge Vernier Calibration Ticks (Outside 9:16 Safe Box) */}
        {foregroundAccents ? (
          <DepthPlane z={0.68}>
            <div
              style={{
                position: 'absolute',
                left: isVertical ? 44 : 84,
                bottom: isVertical ? 124 : 22,
                display: 'flex',
                alignItems: 'flex-end',
                gap: 7,
                opacity: 0.38,
              }}
            >
              {Array.from({ length: 13 }).map((_, idx) => (
                <div
                  key={idx}
                  style={{
                    width: 1.5,
                    height: idx % 4 === 0 ? 15 : 8,
                    backgroundColor:
                      idx === 0
                        ? style.palette.accentPrimary
                        : style.palette.textSecondary,
                  }}
                />
              ))}
            </div>
          </DepthPlane>
        ) : null}
      </OpticalStage2D>
    </AbsoluteFill>
  );
};
```

Replace `packages/kits/src/data-storytelling/AnimatedBarRace.tsx` with:

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
  SPRING_PRESETS,
  formatFontFamilyCss,
  formatHeadingText,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioFontsReady,
  useStudioStyle,
  type StylePreset,
} from '@make-pictures/core';

export interface BarRaceKeyframe {
  frame: number;
  value: number;
}

export interface BarRaceItem {
  id: string;
  label: string;
  /** Target value (or initial value when `keyframes` are provided) */
  value: number;
  /** Optional time-series keyframes enabling live rank overtaking at 60 FPS */
  keyframes?: ReadonlyArray<BarRaceKeyframe>;
  color?: string;
  badge?: string;
  icon?: React.ReactNode;
}

export interface AnimatedBarRaceProps {
  items: ReadonlyArray<BarRaceItem>;
  orientation?: 'horizontal' | 'vertical';
  title?: string;
  subtitle?: string;
  valuePrefix?: string;
  valueSuffix?: string;
  decimals?: number;
  maxItems?: number;
  enterFrame?: number;
  startFrame?: number;
  staggerFrames?: number;
  variant?: 'dark' | 'light';
  safeBox9x16?: boolean;
  style?: React.CSSProperties;
}

function evaluateItemValueAtFrame(item: BarRaceItem, f: number): number {
  const kf = item.keyframes;
  if (!kf || kf.length === 0) {
    return item.value;
  }
  const sorted = [...kf].sort((a, b) => a.frame - b.frame);
  if (f <= sorted[0]!.frame) return sorted[0]!.value;
  if (f >= sorted[sorted.length - 1]!.frame) {
    return sorted[sorted.length - 1]!.value;
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (f >= a.frame && f <= b.frame) {
      return interpolate(
        f,
        [a.frame, Math.max(a.frame + 1, b.frame)],
        [a.value, b.value],
        {
          easing: Easing.inOut(Easing.cubic),
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }
      );
    }
  }
  return item.value;
}

function getExactRanksAtFrame(
  items: ReadonlyArray<BarRaceItem>,
  f: number
): Map<string, number> {
  const scored = items.map((item, origIdx) => ({
    id: item.id,
    val: evaluateItemValueAtFrame(item, f),
    origIdx,
  }));
  scored.sort((a, b) => (b.val !== a.val ? b.val - a.val : a.origIdx - b.origIdx));
  const map = new Map<string, number>();
  scored.forEach((entry, rank) => {
    map.set(entry.id, rank);
  });
  return map;
}

/**
 * Pure deterministic raised-cosine kernel rank smoother (`f(frame)` with zero mutable state)
 * so overtaking bars glide cleanly past each other over ~22 frames instead of snapping.
 */
export function getSmoothedRanks(
  items: ReadonlyArray<BarRaceItem>,
  frame: number
): Map<string, number> {
  const hasKeyframes = items.some((it) => it.keyframes && it.keyframes.length > 1);
  if (!hasKeyframes) {
    return getExactRanksAtFrame(items, frame);
  }

  const radius = 12;
  const accum = new Map<string, number>();
  let weightSum = 0;

  for (let df = -radius; df <= radius; df++) {
    const w = 0.5 * (1 + Math.cos((Math.PI * df) / (radius + 1)));
    weightSum += w;
    const ranks = getExactRanksAtFrame(items, Math.max(0, frame + df));
    for (const [id, r] of ranks.entries()) {
      accum.set(id, (accum.get(id) ?? 0) + r * w);
    }
  }

  const result = new Map<string, number>();
  for (const [id, sum] of accum.entries()) {
    result.set(id, sum / Math.max(1e-6, weightSum));
  }
  return result;
}

/**
 * Resolves disciplined editorial/tonal bar fill from the active `StylePreset`
 * instead of hardcoded rainbow swatches. Explicit `explicitColor` always wins.
 */
export function resolveTonalBarFill(
  studioStyle: StylePreset,
  discreteRank: number,
  explicitColor?: string
): string {
  if (explicitColor) {
    return explicitColor;
  }
  if (discreteRank <= 0) {
    return studioStyle.palette.accentPrimary;
  }
  if (discreteRank === 1) {
    return studioStyle.palette.accentSecondary;
  }
  return studioStyle.palette.textSecondary;
}

/**
 * Editorial Data Cartography 60 FPS Ranked Bar Chart with tonal hierarchy,
 * vertical hairline scale gridlines, tabular figures, and polymorphic finishes.
 */
export const AnimatedBarRace: React.FC<AnimatedBarRaceProps> = ({
  items,
  orientation = 'horizontal',
  title,
  subtitle,
  valuePrefix = '',
  valueSuffix = '',
  decimals = 0,
  maxItems = 6,
  enterFrame,
  startFrame,
  staggerFrames = 5,
  variant,
  safeBox9x16 = true,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  useStudioFontsReady();
  const studioStyle = useStudioStyle();
  const optics = resolveStyleOptics(studioStyle);
  const grammar = optics.typographyGrammar;

  const effectiveStart = Math.max(2, startFrame ?? enterFrame ?? 2);
  if (frame < effectiveStart || items.length === 0) {
    return null;
  }

  const cardEnter = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(studioStyle, 'enter'),
  });
  if (cardEnter <= 0.005) {
    return null;
  }

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

  const visibleCount = Math.min(items.length, Math.max(1, maxItems));
  const smoothedRanks = getSmoothedRanks(items, frame);

  const evaluated = items.map((item, idx) => {
    const rawVal = evaluateItemValueAtFrame(item, frame);
    const rank = smoothedRanks.get(item.id) ?? idx;
    const discreteRank = Math.max(0, Math.round(rank));
    const color = resolveTonalBarFill(studioStyle, discreteRank, item.color);
    return {
      item,
      idx,
      rawVal,
      rank,
      discreteRank,
      color,
    };
  });

  const maxVal = Math.max(1e-6, ...evaluated.map((e) => e.rawVal));
  const isVerticalViewport = height > width;
  const isDark =
    variant !== undefined ? variant === 'dark' : studioStyle.surface.isDark;

  const textPrimary =
    variant !== undefined
      ? isDark
        ? '#F8FAFC'
        : '#0F172A'
      : studioStyle.palette.textPrimary;
  const textSecondary =
    variant !== undefined
      ? isDark
        ? '#94A3B8'
        : '#475569'
      : studioStyle.palette.textSecondary;
  const borderColor =
    variant !== undefined
      ? isDark
        ? 'rgba(148, 163, 184, 0.24)'
        : 'rgba(15, 23, 42, 0.16)'
      : studioStyle.palette.inkBorder;

  const cardWidth =
    isVerticalViewport && safeBox9x16 ? Math.min(830, width - 90) : 980;
  const rowHeight = isVerticalViewport ? 68 : 72;
  const rowGap = 12;

  const surfaceBase = getTactileSurfaceStyle(studioStyle, {
    elevation: 'lifted',
    overrides: {
      width: cardWidth,
      padding: isVerticalViewport ? '26px 28px' : '32px 38px',
      boxSizing: 'border-box',
      borderRadius:
        grammar === 'risograph-poster'
          ? 0
          : Math.max(0, Math.round(6 * studioStyle.surface.radiusScale)),
      ...(variant !== undefined
        ? {
            backgroundColor: isDark ? '#0D1321' : '#FAF8F4',
            borderColor,
          }
        : {}),
      opacity: cardEnter,
      transform: `translateY(${interpolate(cardEnter, [0, 1], [20, 0]).toFixed(2)}px) scale(${interpolate(cardEnter, [0, 1], [0.97, 1]).toFixed(4)})`,
      ...style,
    },
  });

  return (
    <div data-bar-grammar={grammar} style={surfaceBase}>
      {(title || subtitle) && (
        <div
          style={{
            marginBottom: 20,
            paddingBottom: 12,
            borderBottom: `1px solid ${borderColor}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 16,
          }}
        >
          <div>
            {title && (
              <div
                style={{
                  fontFamily: displayFontCss,
                  fontSize: isVerticalViewport ? 28 : 32,
                  fontWeight: 700,
                  letterSpacing: `${studioStyle.typography.displayTrackingEm}em`,
                  color: textPrimary,
                }}
              >
                {variant !== undefined
                  ? title
                  : formatHeadingText(title, studioStyle)}
              </div>
            )}
            {subtitle && (
              <div
                style={{
                  marginTop: 4,
                  fontFamily: bodyFontCss,
                  fontSize: 17,
                  color: textSecondary,
                }}
              >
                {subtitle}
              </div>
            )}
          </div>
          <span
            style={{
              fontFamily: monoFontCss,
              fontVariantNumeric: 'tabular-nums',
              fontSize: 13,
              letterSpacing: '0.12em',
              color: textSecondary,
              flexShrink: 0,
            }}
          >
            MAX {valuePrefix}
            {maxVal.toFixed(decimals)}
            {valueSuffix}
          </span>
        </div>
      )}

      {orientation === 'horizontal' ? (
        <div
          style={{
            position: 'relative',
            height: visibleCount * (rowHeight + rowGap) - rowGap,
          }}
        >
          {/* Hairline Vertical Reference Gridlines (25% / 50% / 75% / 100%) */}
          <div
            data-bar-grid="true"
            style={{
              position: 'absolute',
              left: 46,
              right: 0,
              top: 0,
              bottom: 0,
              pointerEvents: 'none',
            }}
          >
            {[0.25, 0.5, 0.75, 1].map((tick) => (
              <div
                key={tick}
                style={{
                  position: 'absolute',
                  left: `${tick * 100}%`,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  backgroundColor: borderColor,
                  opacity: isDark ? 0.32 : 0.45,
                }}
              />
            ))}
          </div>

          {evaluated.map(({ item, idx, rawVal, rank, discreteRank, color }) => {
            if (rank > visibleCount - 0.15) return null;

            const barGrow = spring({
              frame: frame - (effectiveStart + 4 + idx * staggerFrames),
              fps,
              config: SPRING_PRESETS.smooth,
            });

            const fillRatio = Math.max(0.03, (rawVal / maxVal) * barGrow);
            const displayVal = rawVal * barGrow;
            const yTop = rank * (rowHeight + rowGap);
            const rankBadge = Math.min(visibleCount, discreteRank + 1);
            const isLeader = rankBadge === 1;
            const barOpacity = isLeader
              ? 1
              : discreteRank === 1
                ? 0.86
                : Math.max(0.45, 0.72 - (discreteRank - 2) * 0.1);

            return (
              <div
                key={item.id}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  height: rowHeight,
                  transform: `translate3d(0, ${yTop.toFixed(2)}px, 0)`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  opacity: barGrow,
                }}
              >
                {/* Tabular Index Stamp (Zero rounded pills) */}
                <div
                  style={{
                    width: 34,
                    height: 30,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: monoFontCss,
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 15,
                    fontWeight: 700,
                    color:
                      isLeader && grammar === 'risograph-poster'
                        ? '#FFFFFF'
                        : isLeader
                          ? studioStyle.palette.accentPrimary
                          : textSecondary,
                    backgroundColor:
                      isLeader && grammar === 'risograph-poster'
                        ? color
                        : 'transparent',
                    borderBottom:
                      grammar !== 'risograph-poster'
                        ? `2px solid ${isLeader ? color : borderColor}`
                        : undefined,
                    border:
                      grammar === 'risograph-poster'
                        ? `1.5px solid ${borderColor}`
                        : undefined,
                  }}
                >
                  {String(rankBadge).padStart(2, '0')}
                </div>

                {/* Label + Sharp Editorial / Telemetry / Risograph Bar */}
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontFamily: bodyFontCss,
                        fontSize: 19,
                        fontWeight: isLeader ? 700 : 600,
                        color: textPrimary,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                      {item.badge ? (
                        <span
                          style={{
                            fontFamily: monoFontCss,
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '1px 6px',
                            border: `1px solid ${color}`,
                            color,
                          }}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                    </div>

                    <span
                      style={{
                        fontFamily: monoFontCss,
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: 18,
                        fontWeight: isLeader ? 800 : 600,
                        color: isLeader ? color : textPrimary,
                      }}
                    >
                      {valuePrefix}
                      {displayVal.toFixed(decimals)}
                      {valueSuffix}
                    </span>
                  </div>

                  {/* Sharp Rectangular Track */}
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: isLeader ? 15 : 12,
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(15, 23, 42, 0.05)',
                    }}
                  >
                    <div
                      style={{
                        width: `${(fillRatio * 100).toFixed(2)}%`,
                        height: '100%',
                        opacity: barOpacity,
                        background:
                          grammar === 'risograph-poster' && !isLeader
                            ? `repeating-linear-gradient(-45deg, ${color}, ${color} 3px, transparent 3px, transparent 6px)`
                            : color,
                        border:
                          grammar === 'risograph-poster'
                            ? `1.5px solid ${borderColor}`
                            : undefined,
                        borderRight:
                          grammar === 'swiss-spatial' && isLeader
                            ? `2.5px solid ${textPrimary}`
                            : grammar === 'optical-gate' && isLeader
                              ? `2px solid #FFFFFF`
                              : undefined,
                        boxShadow:
                          grammar === 'optical-gate' &&
                          isLeader &&
                          optics.halation > 0.05
                            ? `0 0 ${Math.round(10 + optics.halation * 18)}px ${color}66`
                            : 'none',
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Vertical Column Chart Mode */
        <div
          data-bar-grid="true"
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 18,
            height: isVerticalViewport ? 320 : 300,
            paddingTop: 24,
            borderBottom: `1.5px solid ${borderColor}`,
          }}
        >
          {[...evaluated]
            .sort((a, b) => a.rank - b.rank)
            .slice(0, visibleCount)
            .map(({ item, idx, rawVal, discreteRank, color }) => {
              const barGrow = spring({
                frame: frame - (effectiveStart + 4 + idx * staggerFrames),
                fps,
                config: SPRING_PRESETS.smooth,
              });
              const fillRatio = Math.max(0.05, (rawVal / maxVal) * barGrow);
              const displayVal = rawVal * barGrow;
              const isLeader = discreteRank === 0;

              return (
                <div
                  key={item.id}
                  style={{
                    flex: 1,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 8,
                    opacity: barGrow,
                  }}
                >
                  <div
                    style={{
                      fontFamily: monoFontCss,
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: 15,
                      fontWeight: isLeader ? 800 : 600,
                      color: isLeader ? color : textSecondary,
                    }}
                  >
                    {valuePrefix}
                    {displayVal.toFixed(decimals)}
                    {valueSuffix}
                  </div>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 68,
                      height: `${(fillRatio * 74).toFixed(2)}%`,
                      backgroundColor: color,
                      opacity: isLeader ? 1 : 0.72,
                      borderTop: `2.5px solid ${textPrimary}`,
                    }}
                  />
                  <div
                    style={{
                      paddingTop: 6,
                      fontFamily: bodyFontCss,
                      fontSize: 15,
                      fontWeight: isLeader ? 700 : 600,
                      textAlign: 'center',
                      color: textPrimary,
                    }}
                  >
                    {item.label}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};
```

Replace `packages/kits/src/data-storytelling/TimelineTrack.tsx` with:

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
  formatFontFamilyCss,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioFontsReady,
  useStudioStyle,
} from '@make-pictures/core';

export interface TimelineMilestone {
  id: string;
  label: string;
  /** Concise era, year, or step tag (e.g. `"1998"`, `"2026"`) */
  era?: string;
  /** Frame when this milestone becomes active */
  fromFrame?: number;
  /** Alias for `fromFrame` */
  frame?: number;
  /** Optional concise 2–3 word subtitle */
  detail?: string;
  color?: string;
}

export interface TimelineTrackProps {
  milestones: ReadonlyArray<TimelineMilestone>;
  orientation?: 'horizontal' | 'vertical';
  accentColor?: string;
  enterFrame?: number;
  startFrame?: number;
  variant?: 'dark' | 'light';
  safeBox9x16?: boolean;
  style?: React.CSSProperties;
}

/**
 * Chronicle Vernier Rail & Optical Rack-Focus Timeline (`60 FPS`).
 * Active milestone lifts onto the crisp focal plane (`filter: 'none'`),
 * while past and future milestones recede into gentle lens defocus.
 */
export const TimelineTrack: React.FC<TimelineTrackProps> = ({
  milestones,
  orientation,
  accentColor,
  enterFrame,
  startFrame,
  variant,
  safeBox9x16 = true,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  useStudioFontsReady();
  const studioStyle = useStudioStyle();
  const optics = resolveStyleOptics(studioStyle);
  const grammar = optics.typographyGrammar;

  const effectiveStart = Math.max(2, startFrame ?? enterFrame ?? 2);
  if (frame < effectiveStart || milestones.length === 0) {
    return null;
  }

  const trackEnter = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(studioStyle, 'enter'),
  });
  if (trackEnter <= 0.005) {
    return null;
  }

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

  const normalized = milestones.map((m) => ({
    ...m,
    resolvedFrame: m.fromFrame ?? m.frame ?? 0,
  }));
  const sorted = [...normalized].sort(
    (a, b) => a.resolvedFrame - b.resolvedFrame
  );
  const isVerticalViewport = height > width;
  const resolvedOrientation =
    orientation ??
    (isVerticalViewport && sorted.length >= 4 ? 'vertical' : 'horizontal');

  const isDark =
    variant !== undefined ? variant === 'dark' : studioStyle.surface.isDark;
  const textPrimary =
    variant !== undefined
      ? isDark
        ? '#F8FAFC'
        : '#0F172A'
      : studioStyle.palette.textPrimary;
  const textSecondary =
    variant !== undefined
      ? isDark
        ? '#94A3B8'
        : '#475569'
      : studioStyle.palette.textSecondary;
  const borderColor =
    variant !== undefined
      ? isDark
        ? 'rgba(148, 163, 184, 0.28)'
        : 'rgba(15, 23, 42, 0.2)'
      : studioStyle.palette.inkBorder;

  let activeIdx = 0;
  let continuousIndex = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (frame >= sorted[i]!.resolvedFrame) {
      activeIdx = i;
    }
    if (i > 0 && frame >= sorted[i]!.resolvedFrame) {
      const segProgress = spring({
        frame: frame - sorted[i]!.resolvedFrame,
        fps,
        config: SPRING_PRESETS.smooth,
      });
      continuousIndex = i - 1 + segProgress;
    }
  }

  const totalSteps = Math.max(1, sorted.length - 1);
  const fillFraction =
    sorted.length <= 1
      ? 1
      : Math.min(1, Math.max(0, continuousIndex / totalSteps));
  const activeColor = sorted[activeIdx]?.color ?? resolvedAccent;

  const containerWidth =
    isVerticalViewport && safeBox9x16 ? Math.min(830, width - 90) : 1120;

  const computeMilestoneOptics = (idx: number) => {
    const dist = Math.min(2, Math.abs(idx - activeIdx));
    if (dist === 0) {
      return { filter: 'none', opacity: 1, scale: 1 };
    }
    const rawBlur = dist * optics.aperture * 3.4;
    return {
      filter: rawBlur < 0.25 ? 'none' : `blur(${rawBlur.toFixed(2)}px)`,
      opacity: dist === 1 ? 0.72 : 0.58,
      scale: 0.96,
    };
  };

  const formatEraMarker = (eraText: string, isActive: boolean) => {
    if (grammar === 'optical-gate') {
      return isActive ? `◆ ${eraText} · LOCK` : `┼ ${eraText}`;
    }
    if (grammar === 'risograph-poster') {
      return isActive ? `${eraText}` : `[${eraText}]`;
    }
    return isActive ? `▲ ${eraText}` : `│ ${eraText}`;
  };

  const outerSurface = getTactileSurfaceStyle(studioStyle, {
    elevation: 'resting',
    overrides: {
      width:
        resolvedOrientation === 'vertical'
          ? Math.min(containerWidth, 680)
          : containerWidth,
      padding: isVerticalViewport ? '24px 26px' : '30px 38px',
      boxSizing: 'border-box',
      borderRadius:
        grammar === 'risograph-poster'
          ? 0
          : Math.max(0, Math.round(6 * studioStyle.surface.radiusScale)),
      ...(variant !== undefined
        ? {
            backgroundColor: isDark ? '#0D1321' : '#FAF8F4',
            borderColor,
          }
        : {}),
      opacity: trackEnter,
      transform: `translateY(${interpolate(trackEnter, [0, 1], [18, 0]).toFixed(2)}px)`,
      ...style,
    },
  });

  if (resolvedOrientation === 'vertical') {
    return (
      <div data-timeline-grammar={grammar} style={outerSurface}>
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* Vertical Vernier Chronicle Rail */}
          <div
            data-vernier-rail="true"
            style={{
              position: 'absolute',
              left: 14,
              top: 12,
              bottom: 12,
              width: 2,
              backgroundColor: borderColor,
            }}
          >
            <div
              style={{
                width: '100%',
                height: `${(fillFraction * 100).toFixed(2)}%`,
                backgroundColor: activeColor,
              }}
            />
          </div>

          {sorted.map((m, idx) => {
            const isActive = idx === activeIdx;
            const nodeColor = m.color ?? resolvedAccent;
            const opt = computeMilestoneOptics(idx);
            const eraStr = m.era ?? String(idx + 1).padStart(2, '0');

            return (
              <div
                key={m.id}
                style={{
                  position: 'relative',
                  paddingLeft: 36,
                  filter: opt.filter,
                  opacity: opt.opacity,
                  transform: `scale(${opt.scale})`,
                  transformOrigin: 'left center',
                }}
              >
                {/* Horizontal Pin Tick on Rail */}
                <div
                  style={{
                    position: 'absolute',
                    left: 8,
                    top: 16,
                    width: isActive ? 16 : 12,
                    height: isActive ? 2.5 : 1.5,
                    backgroundColor: isActive ? nodeColor : borderColor,
                  }}
                />

                <div
                  style={
                    isActive
                      ? getTactileSurfaceStyle(studioStyle, {
                          elevation: 'floating',
                          overrides: {
                            padding: '12px 16px',
                            borderLeft: `3px solid ${nodeColor}`,
                            borderRadius: 0,
                          },
                        })
                      : { padding: '4px 0' }
                  }
                >
                  <div
                    style={{
                      fontFamily: monoFontCss,
                      fontSize: 13,
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      color: isActive ? nodeColor : textSecondary,
                    }}
                  >
                    {formatEraMarker(eraStr, isActive)}
                  </div>
                  <div
                    style={{
                      fontFamily: displayFontCss,
                      fontSize: 21,
                      fontWeight: 700,
                      color: textPrimary,
                      marginTop: 2,
                    }}
                  >
                    {m.label}
                  </div>
                  {m.detail ? (
                    <div
                      style={{
                        fontFamily: bodyFontCss,
                        fontSize: 15,
                        color: textSecondary,
                        marginTop: 2,
                      }}
                    >
                      {m.detail}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Horizontal Vernier Chronicle Rail
  return (
    <div data-timeline-grammar={grammar} style={outerSurface}>
      {/* Precision Top Vernier Scale Rail */}
      <div
        data-vernier-rail="true"
        style={{
          position: 'relative',
          height: 20,
          marginBottom: 14,
          borderTop: `2px solid ${borderColor}`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: -2,
            height: 2.5,
            width: `${(fillFraction * 100).toFixed(2)}%`,
            backgroundColor: activeColor,
            boxShadow:
              grammar === 'optical-gate' && optics.halation > 0.05
                ? `0 0 ${Math.round(8 + optics.halation * 16)}px ${activeColor}`
                : 'none',
          }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          {Array.from({ length: 25 }).map((_, tickIdx) => {
            const isMajor = tickIdx % 6 === 0;
            const lit = tickIdx / 24 <= fillFraction + 0.01;
            return (
              <div
                key={tickIdx}
                style={{
                  width: isMajor ? 1.5 : 1,
                  height: isMajor ? 11 : 6,
                  backgroundColor: lit ? activeColor : borderColor,
                  opacity: lit ? 0.95 : 0.45,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Milestones Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'space-between',
          gap: isVerticalViewport ? 12 : 18,
        }}
      >
        {sorted.map((m, idx) => {
          const isActive = idx === activeIdx;
          const nodeColor = m.color ?? resolvedAccent;
          const opt = computeMilestoneOptics(idx);
          const eraStr = m.era ?? String(idx + 1).padStart(2, '0');

          return (
            <div
              key={m.id}
              style={{
                flex: 1,
                minWidth: 0,
                filter: opt.filter,
                opacity: opt.opacity,
                transform: `scale(${opt.scale})`,
                transformOrigin: 'top center',
                ...(isActive
                  ? getTactileSurfaceStyle(studioStyle, {
                      elevation: 'floating',
                      overrides: {
                        padding: isVerticalViewport ? '12px 12px' : '14px 18px',
                        borderTop: `2.5px solid ${nodeColor}`,
                        borderRadius:
                          grammar === 'risograph-poster'
                            ? 0
                            : Math.max(
                                0,
                                Math.round(4 * studioStyle.surface.radiusScale)
                              ),
                      },
                    })
                  : {
                      padding: isVerticalViewport ? '8px 6px' : '10px 12px',
                    }),
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  fontFamily: monoFontCss,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.09em',
                  color:
                    isActive && grammar === 'risograph-poster'
                      ? '#FFFFFF'
                      : isActive
                        ? nodeColor
                        : textSecondary,
                  backgroundColor:
                    isActive && grammar === 'risograph-poster'
                      ? nodeColor
                      : 'transparent',
                  padding:
                    isActive && grammar === 'risograph-poster'
                      ? '2px 6px'
                      : 0,
                  marginBottom: 6,
                }}
              >
                {formatEraMarker(eraStr, isActive)}
              </div>

              <div
                style={{
                  fontFamily: displayFontCss,
                  fontSize: isVerticalViewport ? 18 : 21,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  color: textPrimary,
                }}
              >
                {m.label}
              </div>

              {m.detail ? (
                <div
                  style={{
                    marginTop: 4,
                    fontFamily: bodyFontCss,
                    fontSize: 14,
                    lineHeight: 1.3,
                    color: textSecondary,
                  }}
                >
                  {m.detail}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

Replace `packages/kits/src/data-storytelling/MetricComparisonCard.tsx` with:

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
  SPRING_PRESETS,
  formatFontFamilyCss,
  formatHeadingText,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioFontsReady,
  useStudioStyle,
} from '@make-pictures/core';

export interface MetricComparisonCardProps {
  title?: string;
  beforeLabel: string;
  beforeValue: number;
  afterLabel: string;
  afterValue: number;
  /** Optional reference ceiling for gauges/bars */
  maxValue?: number;
  prefix?: string;
  unit?: string;
  decimals?: number;
  /** Custom delta badge (auto-computed when omitted, e.g. `"+180%"` or `"-65%"`) */
  deltaBadge?: string;
  /** Visual gauge representation (default `'rings'`) */
  mode?: 'rings' | 'bars';
  beforeColor?: string;
  afterColor?: string;
  enterFrame?: number;
  startFrame?: number;
  variant?: 'dark' | 'light';
  safeBox9x16?: boolean;
  style?: React.CSSProperties;
}

function computeAutoDelta(before: number, after: number): string {
  if (Math.abs(before) < 1e-6) {
    return after >= 0 ? `+${after.toFixed(0)}` : `${after.toFixed(0)}`;
  }
  const pct = ((after - before) / Math.abs(before)) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${Math.round(pct)}%`;
}

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleFromTopDeg: number
): { x: number; y: number } {
  const rad = ((angleFromTopDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc240(
  cx: number,
  cy: number,
  r: number,
  fraction: number
): string {
  const clamped = Math.max(0, Math.min(1, fraction));
  if (clamped <= 0.002) {
    return '';
  }
  const startDeg = -120;
  const sweepDeg = clamped * 240;
  const endDeg = startDeg + sweepDeg;
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

interface CalibratedDialProps {
  fraction: number;
  color: string;
  needleColor: string;
  tickColor: string;
  textLabel: string;
  size: number;
  displayFontCss: string;
  textColor: string;
}

const CalibratedDial240: React.FC<CalibratedDialProps> = ({
  fraction,
  color,
  needleColor,
  tickColor,
  textLabel,
  size,
  displayFontCss,
  textColor,
}) => {
  const cx = size / 2;
  const cy = size * 0.54;
  const outerR = size * 0.44;
  const arcR = size * 0.36;
  const clamped = Math.max(0, Math.min(1, fraction));
  const needleAngle = -120 + clamped * 240;
  const needleTip = polarToCartesian(cx, cy, arcR - 6, needleAngle);
  const trackPath = describeArc240(cx, cy, arcR, 1);
  const valuePath = describeArc240(cx, cy, arcR, clamped);

  return (
    <div
      data-instrument-arc="240"
      style={{
        position: 'relative',
        width: size,
        height: Math.round(size * 0.88),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
    >
      <svg
        width={size}
        height={Math.round(size * 0.88)}
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
      >
        {/* 25 Calibrated Degree Ticks (-120° .. +120° every 10°) */}
        {Array.from({ length: 25 }).map((_, idx) => {
          const deg = -120 + idx * 10;
          const isMajor = idx % 6 === 0;
          const pOut = polarToCartesian(cx, cy, outerR, deg);
          const pIn = polarToCartesian(
            cx,
            cy,
            outerR - (isMajor ? 7 : 4),
            deg
          );
          return (
            <line
              key={idx}
              x1={pIn.x.toFixed(2)}
              y1={pIn.y.toFixed(2)}
              x2={pOut.x.toFixed(2)}
              y2={pOut.y.toFixed(2)}
              stroke={idx / 24 <= clamped + 0.01 ? color : tickColor}
              strokeWidth={isMajor ? 1.6 : 1}
              opacity={idx / 24 <= clamped + 0.01 ? 0.95 : 0.45}
            />
          );
        })}

        {/* Reference Track Arc */}
        {trackPath ? (
          <path
            d={trackPath}
            fill="none"
            stroke={tickColor}
            strokeWidth={4}
            opacity={0.3}
          />
        ) : null}

        {/* Active Value Arc (butt cap, zero smartwatch round caps) */}
        {valuePath ? (
          <path
            d={valuePath}
            fill="none"
            stroke={color}
            strokeWidth={5.5}
            strokeLinecap="butt"
          />
        ) : null}

        {/* Indicator Needle + Pivot */}
        <line
          x1={cx}
          y1={cy}
          x2={needleTip.x.toFixed(2)}
          y2={needleTip.y.toFixed(2)}
          stroke={needleColor}
          strokeWidth={1.8}
        />
        <circle cx={cx} cy={cy} r={3.5} fill={needleColor} />
      </svg>

      <span
        style={{
          position: 'relative',
          fontFamily: displayFontCss,
          fontVariantNumeric: 'tabular-nums',
          fontSize: size >= 156 ? 28 : 24,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: textColor,
        }}
      >
        {textLabel}
      </span>
    </div>
  );
};

/**
 * Calibrated 240° Instrument Dial (`mode="rings"`) & Hatched Delta Span Comparator (`mode="bars"`).
 */
export const MetricComparisonCard: React.FC<MetricComparisonCardProps> = ({
  title,
  beforeLabel,
  beforeValue,
  afterLabel,
  afterValue,
  maxValue,
  prefix = '',
  unit = '',
  decimals = 0,
  deltaBadge,
  mode = 'rings',
  beforeColor,
  afterColor,
  enterFrame,
  startFrame,
  variant,
  safeBox9x16 = true,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  useStudioFontsReady();
  const studioStyle = useStudioStyle();
  const optics = resolveStyleOptics(studioStyle);
  const grammar = optics.typographyGrammar;

  const effectiveStart = Math.max(2, startFrame ?? enterFrame ?? 2);
  if (frame < effectiveStart) {
    return null;
  }

  const enter = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(studioStyle, 'enter'),
  });
  if (enter <= 0.005) {
    return null;
  }

  const resolvedBeforeColor = beforeColor ?? studioStyle.palette.textSecondary;
  const resolvedAfterColor = afterColor ?? studioStyle.palette.accentPrimary;
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

  const beforeProgress = interpolate(
    frame,
    [effectiveStart + 4, effectiveStart + 44],
    [0, 1],
    {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );
  const afterProgress = interpolate(
    frame,
    [effectiveStart + 14, effectiveStart + 60],
    [0, 1],
    {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );
  const badgePop = spring({
    frame: frame - (effectiveStart + 22),
    fps,
    config: SPRING_PRESETS.snappy,
  });

  const ceiling = Math.max(
    1e-6,
    maxValue ?? Math.max(Math.abs(beforeValue), Math.abs(afterValue)) * 1.12
  );

  const curBefore = beforeValue * beforeProgress;
  const curAfter = afterValue * afterProgress;
  const beforeFrac = Math.min(1, Math.abs(curBefore) / ceiling);
  const afterFrac = Math.min(1, Math.abs(curAfter) / ceiling);

  const formattedBefore = `${prefix}${curBefore.toFixed(decimals)}${unit}`;
  const formattedAfter = `${prefix}${curAfter.toFixed(decimals)}${unit}`;
  const resolvedDelta = deltaBadge ?? computeAutoDelta(beforeValue, afterValue);

  const isVerticalViewport = height > width;
  const isDark =
    variant !== undefined ? variant === 'dark' : studioStyle.surface.isDark;
  const textPrimary =
    variant !== undefined
      ? isDark
        ? '#F8FAFC'
        : '#0F172A'
      : studioStyle.palette.textPrimary;
  const textSecondary =
    variant !== undefined
      ? isDark
        ? '#94A3B8'
        : '#475569'
      : studioStyle.palette.textSecondary;
  const borderColor =
    variant !== undefined
      ? isDark
        ? 'rgba(148, 163, 184, 0.28)'
        : 'rgba(15, 23, 42, 0.2)'
      : studioStyle.palette.inkBorder;

  const cardWidth =
    isVerticalViewport && safeBox9x16 ? Math.min(830, width - 90) : 880;
  const gaugeSize = isVerticalViewport ? 148 : 166;

  const minSpanFrac = Math.min(beforeFrac, afterFrac);
  const maxSpanFrac = Math.max(beforeFrac, afterFrac);

  return (
    <div
      style={getTactileSurfaceStyle(studioStyle, {
        elevation: 'lifted',
        overrides: {
          width: cardWidth,
          padding: isVerticalViewport ? '26px 28px' : '32px 40px',
          boxSizing: 'border-box',
          borderRadius:
            grammar === 'risograph-poster'
              ? 0
              : Math.max(0, Math.round(6 * studioStyle.surface.radiusScale)),
          ...(variant !== undefined
            ? {
                backgroundColor: isDark ? '#0D1321' : '#FAF8F4',
                borderColor,
              }
            : {}),
          opacity: enter,
          transform: `translateY(${interpolate(enter, [0, 1], [20, 0]).toFixed(2)}px) scale(${interpolate(enter, [0, 1], [0.97, 1]).toFixed(4)})`,
          ...style,
        },
      })}
    >
      {/* Header + Tabular Rectangular Delta Stamp (Zero rounded pills) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          paddingBottom: 14,
          marginBottom: 22,
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        {title ? (
          <div
            style={{
              fontFamily: displayFontCss,
              fontSize: isVerticalViewport ? 26 : 30,
              fontWeight: 700,
              letterSpacing: `${studioStyle.typography.displayTrackingEm}em`,
              color: textPrimary,
            }}
          >
            {variant !== undefined
              ? title
              : formatHeadingText(title, studioStyle)}
          </div>
        ) : (
          <span
            style={{
              fontFamily: monoFontCss,
              fontSize: 13,
              letterSpacing: '0.14em',
              color: textSecondary,
            }}
          >
            KOMPARATOR Δ
          </span>
        )}

        <div
          style={{
            fontFamily: monoFontCss,
            fontVariantNumeric: 'tabular-nums',
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: '0.06em',
            padding: '5px 12px',
            border: `1.5px solid ${resolvedAfterColor}`,
            color:
              grammar === 'risograph-poster' ? '#FFFFFF' : resolvedAfterColor,
            backgroundColor:
              grammar === 'risograph-poster'
                ? resolvedAfterColor
                : `${resolvedAfterColor}14`,
            boxShadow:
              grammar === 'optical-gate' && optics.halation > 0.05
                ? `0 0 ${Math.round(10 + optics.halation * 18)}px ${resolvedAfterColor}44`
                : 'none',
            opacity: badgePop,
          }}
        >
          Δ {resolvedDelta}
        </div>
      </div>

      {mode === 'rings' ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            gap: 16,
          }}
        >
          {/* Baseline Calibrated 240° Dial */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CalibratedDial240
              fraction={beforeFrac}
              color={resolvedBeforeColor}
              needleColor={textSecondary}
              tickColor={borderColor}
              textLabel={formattedBefore}
              size={gaugeSize}
              displayFontCss={displayFontCss}
              textColor={textSecondary}
            />
            <span
              style={{
                fontFamily: bodyFontCss,
                fontSize: 18,
                fontWeight: 600,
                color: textSecondary,
              }}
            >
              {beforeLabel}
            </span>
          </div>

          {/* Technical Datum Bridge */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              opacity: badgePop,
              fontFamily: monoFontCss,
              fontSize: 12,
              letterSpacing: '0.14em',
              color: textSecondary,
            }}
          >
            <span>BAZA ──┼── WYNIK</span>
            <div
              style={{
                width: isVerticalViewport ? 48 : 72,
                height: 1.5,
                backgroundColor: resolvedAfterColor,
              }}
            />
          </div>

          {/* Target Calibrated 240° Dial */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CalibratedDial240
              fraction={afterFrac}
              color={resolvedAfterColor}
              needleColor={textPrimary}
              tickColor={borderColor}
              textLabel={formattedAfter}
              size={gaugeSize}
              displayFontCss={displayFontCss}
              textColor={textPrimary}
            />
            <span
              style={{
                fontFamily: bodyFontCss,
                fontSize: 18,
                fontWeight: 700,
                color: textPrimary,
              }}
            >
              {afterLabel}
            </span>
          </div>
        </div>
      ) : (
        /* Dual Baseline + 45° Hatched Delta Span Mode */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              fontFamily: monoFontCss,
              fontVariantNumeric: 'tabular-nums',
              fontSize: 16,
            }}
          >
            <span style={{ color: textSecondary }}>
              {beforeLabel}: <strong>{formattedBefore}</strong>
            </span>
            <span style={{ color: resolvedAfterColor, fontWeight: 700 }}>
              {afterLabel}: {formattedAfter}
            </span>
          </div>

          {/* Unified Baseline + Hatched Delta Span */}
          <div
            data-delta-hatch="true"
            style={{
              position: 'relative',
              width: '100%',
              height: 26,
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.06)'
                : 'rgba(15, 23, 42, 0.05)',
              borderLeft: `2px solid ${textPrimary}`,
            }}
          >
            {/* Base segment */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${(minSpanFrac * 100).toFixed(2)}%`,
                backgroundColor: resolvedBeforeColor,
                opacity: 0.72,
              }}
            />
            {/* 45° Hatched Delta Interval */}
            <div
              style={{
                position: 'absolute',
                left: `${(minSpanFrac * 100).toFixed(2)}%`,
                top: 0,
                bottom: 0,
                width: `${Math.max(0, (maxSpanFrac - minSpanFrac) * 100).toFixed(2)}%`,
                backgroundImage: `repeating-linear-gradient(-45deg, ${resolvedAfterColor}, ${resolvedAfterColor} 3px, ${resolvedAfterColor}28 3px, ${resolvedAfterColor}28 7px)`,
                borderRight: `2.5px solid ${resolvedAfterColor}`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
```

Update `packages/kits/src/data-storytelling/index.ts`:

```ts
export * from './DataStoryStage2D';
export * from './AnimatedBarRace';
export * from './TimelineTrack';
export * from './MetricComparisonCard';
```

- [ ] **Step 4: Run `kits-style-integration.test.ts` and typecheck to verify everything passes**

Run: `npx tsx --test packages/cli/tests/kits-style-integration.test.ts && npm run typecheck`
Expected: PASS (`0` errors).

- [ ] **Step 5: Commit Task 2**

```bash
git add packages/kits/src/data-storytelling packages/cli/tests/kits-style-integration.test.ts
git commit -m "feat(kits): rebuild data-storytelling with DataStoryStage2D, tonal bars, vernier rack focus, and 240-deg dials"
```

---

### Task 3: Update Canonical Skills (`kit-editorial-and-vector`, `kit-kinetic-and-data`) & Mirror Sync

**Files:**
- Modify: `plugins/make-pictures/skills/kit-editorial-and-vector/SKILL.md`
- Modify: `plugins/make-pictures/skills/kit-kinetic-and-data/SKILL.md`
- Synced output (`npm run sync:skills`): `skills/kit-editorial-and-vector/SKILL.md`, `skills/kit-kinetic-and-data/SKILL.md`
- Test: `packages/cli/tests/root-skills-sync.test.ts`

**Interfaces:**
- Documents exact TypeScript contracts produced in Tasks 1 & 2 (`VectorSceneStage2D`, `StoryCard2D`, `AnnotatedCallout2D`, `ComparisonSplit2D`, `DataStoryStage2D`, `AnimatedBarRace`, `TimelineTrack`, `MetricComparisonCard`).

- [ ] **Step 1: Update `plugins/make-pictures/skills/kit-editorial-and-vector/SKILL.md` Section 2 (`Vector Scene 2D`) and imports**

Update the frontmatter description, `vector-scene-2d` import block, and Section 2 of `plugins/make-pictures/skills/kit-editorial-and-vector/SKILL.md` so `VectorSceneStage2D`, engraved medallions, architectural elbow callouts (`target`, `labelPosition`, `code`, `sublabel`, `elbowMode`), and `ComparisonSplit2D` rack focus (`focusShiftFrame`, `initialFocus`) are documented accurately:

```markdown
<!-- Update lines 41-51 of plugins/make-pictures/skills/kit-editorial-and-vector/SKILL.md: -->
import {
  VectorSceneStage2D,
  StoryCard2D,
  AnnotatedCallout2D,
  ComparisonSplit2D,
  computeSafeSplitBounds,
  type VectorSceneStage2DProps,
  type StoryCard2DProps,
  type AnnotatedCallout2DProps,
  type ComparisonSideSpec,
  type ComparisonSplit2DProps,
} from '@make-pictures/kits/vector-scene-2d';
```

Replace Section `## 2. Vector Scene 2D (@make-pictures/kits/vector-scene-2d)` in `plugins/make-pictures/skills/kit-editorial-and-vector/SKILL.md` with:

```markdown
## 2. Vector Scene 2D (`@make-pictures/kits/vector-scene-2d`)

Multi-plane graphic plate & architectural drafting kit (and default scaffold for `npx make-pictures new`). Automatically adapts across `swiss-spatial`, `optical-gate`, and `risograph-poster` via `resolveStyleOptics(style)`.

### `VectorSceneStage2D`
Multi-plane 2.5D graphic plate stage combining `<StageLightingRig />` and `<OpticalStage2D />` across up to 4 depth planes:
- **`z = -0.60`:** Modular construction axes, registration crosses, and `plateCode` header (softly defocused when `focalZ = 0`).
- **`z = 0.00`:** Primary crisp graphic plate (`children`).
- **`z = +0.42`:** Optional `foregroundCallouts` parallax layer for `<AnnotatedCallout2D />`.
- **`z = +0.72`:** Subtle calibration bracket outside the `9:16` Golden Safe Box (`foregroundAccents = true`).

```ts
export interface VectorSceneStage2DProps {
  shots?: ReadonlyArray<OpticalShot2D>;
  nodes?: Record<string, StageNode2D>;
  plateCode?: string;                 // default 'TABLICA KONCEPCYJNA • 60 FPS'
  foregroundCallouts?: React.ReactNode;
  foregroundAccents?: boolean;        // default true
  renderBaseFill?: boolean;           // pass false inside <StyleProvider renderBackdrop>
  seed?: number;
  children?: React.ReactNode;
}
```

### `StoryCard2D`
Tactile graphic plate (`getTactileSurfaceStyle`) with a calibration `monoFont` index header (`badge` + `plateCode` — zero rounded pills) and a **polymorphic SVG engraved medallion** (`swiss-spatial` azimuth ring, `optical-gate` reticle + halation, `risograph-poster` stencil seal).

```ts
export interface StoryCard2DProps {
  title: string;
  subtitle?: string;
  badge?: string;
  icon?: React.ReactNode;
  plateCode?: string;
  tiltDeg?: number;
  compact?: boolean;
  startFrame?: number;                // default 2 (clamped to >= 2)
  accentColor?: string;
  styleOverrides?: React.CSSProperties;
}
```

### `AnnotatedCallout2D`
Precision optical target reticle at `target` `[x, y]` connected by a **2-segment `45° -> horizontal` architectural elbow leader** (`strokeDashoffset`) to an elevated tactile flag card at `labelPosition` `[x, y]` (auto-clamped inside the `9:16` Safe Box on vertical canvases).

```ts
export interface AnnotatedCallout2DProps {
  target: [number, number];
  labelPosition: [number, number];
  label: string;
  sublabel?: string;
  code?: string;                      // e.g. 'DETAL A·1'
  elbowMode?: 'auto' | 'straight';    // default 'auto'
  startFrame?: number;                // default 8 (clamped to >= 2)
  accentColor?: string;
}
```

### `ComparisonSplit2D` (& `computeSafeSplitBounds`)
Dual-elevation baseline vs. thesis comparison with a central calibration axis (`┼`) and optional **spring-driven optical rack focus** (`focusShiftFrame`).

```ts
export interface ComparisonSideSpec {
  tag: string;
  title: string;
  detail: string;
}

export interface ComparisonSplit2DProps {
  left: ComparisonSideSpec;
  right: ComparisonSideSpec;
  startFrame?: number;                // default 2 (clamped to >= 2)
  rightDelayFrames?: number;          // default 14
  focusShiftFrame?: number;           // glides sharp focus from left -> right
  initialFocus?: 'both' | 'left';     // defaults to 'left' when focusShiftFrame is set, else 'both'
}
```
- **`9:16` Golden Safe Box Guarantee:** `computeSafeSplitBounds(1080, 1920)` places split plates at `left: 54, top: 250, width: 836, height: 1080` — strictly inside `x ∈ [40, 910], y ∈ [220, 1380]`.
```

- [ ] **Step 2: Update `plugins/make-pictures/skills/kit-kinetic-and-data/SKILL.md` Section 2 (`Data Storytelling`) and imports**

Update the `data-storytelling` import block and Section `## 2. Data Storytelling (@make-pictures/kits/data-storytelling)` in `plugins/make-pictures/skills/kit-kinetic-and-data/SKILL.md`:

```markdown
<!-- Update lines 41-46 of plugins/make-pictures/skills/kit-kinetic-and-data/SKILL.md: -->
import {
  DataStoryStage2D,
  AnimatedBarRace,
  TimelineTrack,
  MetricComparisonCard,
  getSmoothedRanks,
  resolveTonalBarFill,
  type DataStoryStage2DProps,
} from '@make-pictures/kits/data-storytelling';
```

Replace Section `## 2. Data Storytelling (@make-pictures/kits/data-storytelling)` in `plugins/make-pictures/skills/kit-kinetic-and-data/SKILL.md` with:

```markdown
## 2. Data Storytelling (`@make-pictures/kits/data-storytelling`)

Editorial data cartography & calibrated instrument gauges — zero rainbow swatches, zero rounded glowing pills, zero e-commerce `<Check />` steppers, and zero smartwatch fitness rings.

### `DataStoryStage2D`
Multi-plane 2.5D data cartography stage combining `<StageLightingRig />` and `<OpticalStage2D />`:
- **`z = -0.58`:** Scale grid sheet (`0 · 25 · 50 · 75 · 100`) and `datasetCode` in `monoFont` (softly defocused when `focalZ = 0`).
- **`z = 0.00`:** Primary crisp chart / timeline surface (`children`).
- **`z = +0.68`:** Subtle edge vernier calibration ticks strictly outside the `9:16` Golden Safe Box (`foregroundAccents = true`).
- Pass `renderBaseFill={false}` when mounted inside `<StyleProvider renderBackdrop>`.

### `AnimatedBarRace` (& `getSmoothedRanks`, `resolveTonalBarFill`)
Ranked `60 FPS` bar chart with raised-cosine overtaking (`getSmoothedRanks`), vertical `25%..100%` hairline gridlines, `tabular-nums` figures, and **style-derived tonal hierarchy** (`#1` uses `accentPrimary`, `#2` uses `accentSecondary`, `#3+` step down tonally unless `item.color` is passed; `risograph-poster` hatches non-leader bars):
- **Props:** `items: BarRaceItem[]` (`{ id, label, value, keyframes?: { frame, value }[], color?, badge?, icon? }`), `orientation?: 'horizontal' | 'vertical'`, `title?: string`, `subtitle?: string`, `valuePrefix?: string`, `valueSuffix?: string`, `decimals?: number`, `maxItems?: number`, `startFrame?: number` (clamped `>= 2`).

### `TimelineTrack`
Chronicle vernier rail with minor subdivisions and **optical rack focus** — the active milestone (`fromFrame <= frame`) lifts onto an elevated tactile card at `filter: 'none'`, while past and future milestones recede (`scale(0.96)` + aperture-scaled blur):
- **Props:** `milestones: TimelineMilestone[]` (`{ id, label, era?, fromFrame?, detail?, color? }`), `orientation?: 'horizontal' | 'vertical'`, `accentColor?: string`, `startFrame?: number` (clamped `>= 2`), `variant?: 'dark' | 'light'`, `safeBox9x16?: boolean`.

### `MetricComparisonCard`
Calibrated `240°` SVG degree-tick instrument dials with rotating indicator needles (`mode="rings"`, default) or dual baseline comparator with a **`45°` hatched delta span** (`mode="bars"`), paired with a rectangular `monoFont` `Δ` readout:
- **Props:** `title?: string`, `beforeLabel: string`, `beforeValue: number`, `afterLabel: string`, `afterValue: number`, `maxValue?: number`, `prefix?: string`, `unit?: string`, `decimals?: number`, `deltaBadge?: string`, `mode?: 'rings' | 'bars'`, `startFrame?: number` (clamped `>= 2`), `variant?: 'dark' | 'light'`, `safeBox9x16?: boolean`.
```

- [ ] **Step 3: Sync skills mirror and run `root-skills-sync.test.ts`**

Run: `npm run sync:skills && npx tsx --test packages/cli/tests/root-skills-sync.test.ts`
Expected: PASS (`0` drift between `plugins/make-pictures/skills/*` and `skills/*`).

- [ ] **Step 4: Commit Task 3**

```bash
git add plugins/make-pictures/skills skills
git commit -m "docs(skills): document Wave 2 optical stages and polymorphic vector/data kits"
```

---

### Task 4: Live `60 FPS` Optical Previews in `Style Lab`, CLI Scaffolds (`new-production.ts`), `16:9` + `9:16` Contact-Sheet QA & `pack:verify`

**Files:**
- Modify: `packages/studio/src/client/components/StyleLabShowcase.tsx`
- Modify: `packages/cli/src/commands/new-production.ts`
- Modify: `packages/cli/tests/studio-styles-api.test.ts`
- Modify: `packages/cli/tests/styles-cli.test.ts`

**Interfaces:**
- `StyleLabShowcase.tsx` consumes ONLY `@make-pictures/core` (`DepthPlane`, `OpticalStage2D`, `StageLightingRig`, `createSeededRandom`, `formatFontFamilyCss`, `formatHeadingText`, `getStyleSpringConfig`, `getTactileSurfaceStyle`, `resolveStyleOptics`, `useStudioStyle`, `type OpticalShot2D`).
- `new-production.ts` scaffolds `VectorSceneStage2D` (for `vector-scene-2d` and `default`) and `DataStoryStage2D` (for `data-storytelling`).

- [ ] **Step 1: Add failing `Style Lab` & CLI scaffold assertions in `studio-styles-api.test.ts` and `styles-cli.test.ts`**

In `packages/cli/tests/studio-styles-api.test.ts`, inside `test('StyleLabPreviewComposition renders live 60 FPS optical lighting...'` (around line 412, right before the closing `}` of the `for (const { styleId, ... } of cases)` loop), append assertions for `'vector-scene-2d'` and `'data-storytelling'`:

```ts
    // 3. Vector Scene 2D in Style Lab: Frame 0 clean + Frame 64 multi-plane plate, medallion, elbow callout & rack focus
    const vectorFrame0 = renderStyleLabFrame(preset, 'vector-scene-2d', 0);
    assert.doesNotMatch(vectorFrame0, /Przejrzysta narracja/);
    assert.doesNotMatch(vectorFrame0, /data-lighting-rig=/);

    const vectorFrame64 = renderStyleLabFrame(preset, 'vector-scene-2d', 64);
    assert.match(vectorFrame64, new RegExp(`data-lighting-rig="${expectedRig}"`));
    assert.match(
      vectorFrame64,
      new RegExp(`data-medallion-grammar="${expectedGrammar}"`)
    );
    assert.match(vectorFrame64, /data-callout-reticle="true"/);
    assert.match(vectorFrame64, /data-depth-z="-0\.6"/);
    assert.match(vectorFrame64, /data-depth-z="0\.42"/);

    // 4. Data Storytelling in Style Lab: Frame 0 clean + Frame 64 tonal grid, 240° dial & vernier rail
    const dataFrame0 = renderStyleLabFrame(preset, 'data-storytelling', 0);
    assert.doesNotMatch(dataFrame0, /Indeks czytelności/);
    assert.doesNotMatch(dataFrame0, /data-lighting-rig=/);

    const dataFrame64 = renderStyleLabFrame(preset, 'data-storytelling', 64);
    assert.match(dataFrame64, new RegExp(`data-lighting-rig="${expectedRig}"`));
    assert.match(dataFrame64, new RegExp(`data-bar-grammar="${expectedGrammar}"`));
    assert.match(dataFrame64, /data-instrument-arc="240"/);
    assert.match(dataFrame64, /data-vernier-rail="true"/);
    assert.match(dataFrame64, /data-depth-z="-0\.58"/);
```

In `packages/cli/tests/styles-cli.test.ts`, inside `for (const kitId of SCENES_KIT_IDS)` (around line 145), add checks for `vector-scene-2d` and `data-storytelling`, plus check `defProd` (`default-film`):

```ts
      if (kitId === 'vector-scene-2d') {
        assert.match(tsx, /VectorSceneStage2D/);
        assert.match(tsx, /foregroundCallouts/);
        assert.match(tsx, /focusShiftFrame/);
      }
      if (kitId === 'data-storytelling') {
        assert.match(tsx, /DataStoryStage2D/);
        assert.match(tsx, /TimelineTrack/);
      }
```

- [ ] **Step 2: Run both test files to verify they fail**

Run: `npx tsx --test packages/cli/tests/studio-styles-api.test.ts packages/cli/tests/styles-cli.test.ts`
Expected: FAIL (`vectorFrame64` / `dataFrame64` lack `data-lighting-rig`, `data-medallion-grammar`, `data-instrument-arc`, and `new-production.ts` lacks `VectorSceneStage2D` / `DataStoryStage2D`).

- [ ] **Step 3: Update `VectorScene2DPreview`, `DataStorytellingPreview`, and `usesOpticalStage` in `packages/studio/src/client/components/StyleLabShowcase.tsx`**

1. In `StyleLabPreviewComposition` (`StyleLabShowcase.tsx:1779`), update `usesOpticalStage`:
```tsx
  const usesOpticalStage =
    kit === 'editorial-collage' ||
    kit === 'kinetic-typography' ||
    kit === 'vector-scene-2d' ||
    kit === 'data-storytelling';
```

2. Replace `VectorScene2DPreview` (`StyleLabShowcase.tsx:623-820`) with a multi-plane `OpticalStage2D` preview built strictly from `@make-pictures/core` primitives (`z = -0.6` construction plate, `z = 0` medallion plate + rack-focus split comparison, `z = 0.42` elbow callout + reticle):

```tsx
const VectorScene2DPreview: React.FC = () => {
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
      { fromFrame: 2, x: cx, y: cy + 6, zoom: 1.0, focalZ: 0.32, transition: 'cut' },
      { fromFrame: 10, x: cx - 5, y: cy, zoom: 1.026, focalZ: 0, transition: 'glide' },
      { fromFrame: 140, x: cx + 6, y: cy - 4, zoom: 1.04, focalZ: 0, transition: 'glide' },
    ];
  }, [width, height]);

  const heroEnter = spring({
    frame: frame - 2,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const calloutEnter = spring({
    frame: frame - 18,
    fps,
    config: getStyleSpringConfig(style, 'emphasis'),
  });
  const splitEnter = spring({
    frame: frame - 14,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const rackShift =
    frame >= 96
      ? spring({
          frame: frame - 96,
          fps,
          config: getStyleSpringConfig(style, 'camera'),
        })
      : 0;

  const maxBlur = Math.max(1.6, optics.aperture * 6.5);
  const leftBlur = interpolate(rackShift, [0, 1], [0, maxBlur]);
  const rightBlur = interpolate(rackShift, [0, 1], [maxBlur, 0]);

  const displayFont = formatFontFamilyCss(style.typography.displayFont, 'display');
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');

  const tx = bounds.left + Math.round(bounds.width * 0.62);
  const ty = bounds.top + (bounds.isVertical ? 148 : 132);
  const lx = bounds.left + Math.round(bounds.width * 0.82);
  const ly = bounds.top + (bounds.isVertical ? 76 : 64);

  return (
    <OpticalStage2D shots={shots} seed={2028} startFrame={2}>
      {/* Plane z = -0.6: Construction Plate Axes */}
      <DepthPlane z={-0.6}>
        <div
          style={{
            position: 'absolute',
            left: bounds.left,
            top: Math.max(22, bounds.top - 32),
            fontFamily: monoFont,
            fontSize: 13,
            letterSpacing: '0.15em',
            color: style.palette.textSecondary,
            opacity: 0.58,
          }}
        >
          ┼ TABLICA KONCEPCYJNA • {style.id.toUpperCase()}
        </div>
      </DepthPlane>

      {/* Plane z = 0: Engraved Medallion Plate + Rack-Focus Split */}
      <DepthPlane z={0}>
        <div
          style={{
            position: 'absolute',
            left: bounds.left,
            top: bounds.top,
            width: bounds.width,
            height: bounds.height,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: bounds.isVertical ? 22 : 26,
          }}
        >
          <div
            data-medallion-grammar={grammar}
            style={getTactileSurfaceStyle(style, {
              elevation: 'lifted',
              tiltDeg: grammar === 'risograph-poster' ? -0.5 : 0,
              overrides: {
                padding: bounds.isVertical ? '24px 28px' : '30px 36px',
                borderRadius:
                  grammar === 'risograph-poster'
                    ? 0
                    : Math.max(0, Math.round(6 * style.surface.radiusScale)),
                borderTop:
                  grammar === 'swiss-spatial'
                    ? `3px solid ${style.palette.accentPrimary}`
                    : undefined,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                opacity: heroEnter,
              },
            })}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingBottom: 8,
                borderBottom: `1px solid ${style.palette.inkBorder}`,
                fontFamily: monoFont,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: style.palette.accentPrimary,
              }}
            >
              <span>FIG. 01 // VECTOR SCENE 2D</span>
              <span style={{ color: style.palette.textSecondary }}>Z +0.00</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <svg width="56" height="56" viewBox="0 0 60 60" style={{ flexShrink: 0 }}>
                <circle
                  cx="30"
                  cy="30"
                  r="26"
                  fill="none"
                  stroke={style.palette.inkBorder}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
                <circle
                  cx="30"
                  cy="30"
                  r="19"
                  fill="none"
                  stroke={style.palette.accentPrimary}
                  strokeWidth="1.6"
                />
                <polygon
                  points="30,18 41,38 19,38"
                  fill="none"
                  stroke={style.palette.accentPrimary}
                  strokeWidth="1.8"
                />
              </svg>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div
                  style={{
                    fontFamily: displayFont,
                    fontSize: bounds.isVertical ? 38 : 46,
                    fontWeight: 700,
                    lineHeight: 1.12,
                    letterSpacing: `${style.typography.displayTrackingEm}em`,
                    color: style.palette.textPrimary,
                  }}
                >
                  {formatHeadingText('Przejrzysta narracja pojęć', style)}
                </div>
                <div
                  style={{
                    fontFamily: bodyFont,
                    fontSize: 21,
                    color: style.palette.textSecondary,
                  }}
                >
                  Grawerowany medalion, cień kierunkowy i polskie znaki: zażółć gęślą jaźń.
                </div>
              </div>
            </div>
          </div>

          {/* Dual Comparison Plates with Live Rack Focus */}
          <div
            style={{
              display: 'flex',
              flexDirection: bounds.isVertical ? 'column' : 'row',
              alignItems: 'stretch',
              gap: 18,
              opacity: splitEnter,
            }}
          >
            <div
              style={getTactileSurfaceStyle(style, {
                elevation: 'resting',
                overrides: {
                  flex: 1,
                  padding: '22px 26px',
                  borderRadius:
                    grammar === 'risograph-poster'
                      ? 0
                      : Math.max(0, Math.round(6 * style.surface.radiusScale)),
                  filter: leftBlur < 0.25 ? 'none' : `blur(${leftBlur.toFixed(2)}px)`,
                  opacity: interpolate(rackShift, [0, 1], [1, 0.8]),
                },
              })}
            >
              <div
                style={{
                  fontFamily: monoFont,
                  fontSize: 14,
                  fontWeight: 700,
                  color: style.palette.textSecondary,
                  marginBottom: 6,
                }}
              >
                01 • PRZED (BAZA)
              </div>
              <div
                style={{
                  fontFamily: displayFont,
                  fontSize: 30,
                  fontWeight: 700,
                  color: style.palette.textPrimary,
                }}
              >
                {formatHeadingText('Sztywny kadr płaski', style)}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: monoFont,
                fontSize: 14,
                color: style.palette.accentPrimary,
              }}
            >
              ┼
            </div>

            <div
              style={getTactileSurfaceStyle(style, {
                elevation: 'floating',
                overrides: {
                  flex: 1,
                  padding: '22px 26px',
                  borderTop: `3px solid ${style.palette.accentPrimary}`,
                  borderRadius:
                    grammar === 'risograph-poster'
                      ? 0
                      : Math.max(0, Math.round(6 * style.surface.radiusScale)),
                  filter: rightBlur < 0.25 ? 'none' : `blur(${rightBlur.toFixed(2)}px)`,
                  opacity: interpolate(rackShift, [0, 1], [0.82, 1]),
                },
              })}
            >
              <div
                style={{
                  fontFamily: monoFont,
                  fontSize: 14,
                  fontWeight: 700,
                  color: style.palette.accentPrimary,
                  marginBottom: 6,
                }}
              >
                02 • RACK FOCUS (TEZA)
              </div>
              <div
                style={{
                  fontFamily: displayFont,
                  fontSize: 30,
                  fontWeight: 700,
                  color: style.palette.textPrimary,
                }}
              >
                {formatHeadingText('Ostrość prowadzi wzrok', style)}
              </div>
            </div>
          </div>
        </div>
      </DepthPlane>

      {/* Plane z = +0.42: Architectural Elbow Callout + Reticle */}
      <DepthPlane z={0.42}>
        <svg
          width={width}
          height={height}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          <g data-callout-reticle="true" opacity={calloutEnter}>
            <circle
              cx={tx}
              cy={ty}
              r={10}
              fill="none"
              stroke={style.palette.accentSecondary}
              strokeWidth={1.5}
            />
            <circle cx={tx} cy={ty} r={2.5} fill={style.palette.accentSecondary} />
            <polyline
              points={`${tx},${ty} ${tx + 44},${ly} ${lx},${ly}`}
              fill="none"
              stroke={style.palette.accentSecondary}
              strokeWidth={1.6}
            />
          </g>
        </svg>
        <div
          style={getTactileSurfaceStyle(style, {
            elevation: 'floating',
            overrides: {
              position: 'absolute',
              left: lx,
              top: ly,
              transform: 'translate(-50%, -50%)',
              padding: '8px 14px',
              borderLeft: `3px solid ${style.palette.accentSecondary}`,
              borderRadius: 0,
              fontFamily: monoFont,
              fontSize: 13,
              fontWeight: 700,
              color: style.palette.textPrimary,
              opacity: calloutEnter,
            },
          })}
        >
          DETAL A·1 • Z +0.42
        </div>
      </DepthPlane>
    </OpticalStage2D>
  );
};
```

3. Replace `DataStorytellingPreview` (`StyleLabShowcase.tsx:1211-1338`) with a multi-plane `OpticalStage2D` preview (`z = -0.58` scale sheet, `z = 0` tonal bar race + calibrated `240°` arc dial + vernier rack-focus timeline):

```tsx
const DataStorytellingPreview: React.FC = () => {
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
      { fromFrame: 2, x: cx, y: cy + 5, zoom: 1.0, focalZ: 0.3, transition: 'cut' },
      { fromFrame: 10, x: cx - 4, y: cy, zoom: 1.024, focalZ: 0, transition: 'glide' },
    ];
  }, [width, height]);

  const cardEnter = spring({
    frame: frame - 2,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });

  const bars = [
    { label: 'Wideo z kodem (60 FPS)', target: 94, color: style.palette.accentPrimary, leader: true },
    { label: 'Dokument redakcyjny', target: 74, color: style.palette.accentSecondary, leader: false },
    { label: 'Statyczne slajdy', target: 31, color: style.palette.textSecondary, leader: false },
  ];

  const eras = [
    { year: '1998', label: 'Archiwum', active: false },
    { year: '2026', label: 'Optyka 2.5D', active: true },
    { year: '2030', label: 'Skala', active: false },
  ];
  const offBlur = optics.aperture * 3.4;

  const displayFont = formatFontFamilyCss(style.typography.displayFont, 'display');
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');

  return (
    <OpticalStage2D shots={shots} seed={2029} startFrame={2}>
      {/* Plane z = -0.58: Scale Sheet */}
      <DepthPlane z={-0.58}>
        <div
          style={{
            position: 'absolute',
            left: bounds.left,
            top: Math.max(22, bounds.top - 32),
            fontFamily: monoFont,
            fontSize: 13,
            letterSpacing: '0.15em',
            color: style.palette.textSecondary,
            opacity: 0.58,
          }}
        >
          ∑ KARTOGRAFIA DANYCH • 0 · 25 · 50 · 75 · 100
        </div>
      </DepthPlane>

      {/* Plane z = 0: Tonal Bar Race + 240° Instrument + Vernier Timeline */}
      <DepthPlane z={0}>
        <div
          style={{
            position: 'absolute',
            left: bounds.left,
            top: bounds.top,
            width: bounds.width,
            height: bounds.height,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 22,
          }}
        >
          <div
            data-bar-grammar={grammar}
            style={getTactileSurfaceStyle(style, {
              elevation: 'lifted',
              overrides: {
                padding: bounds.isVertical ? '24px 28px' : '30px 36px',
                borderRadius:
                  grammar === 'risograph-poster'
                    ? 0
                    : Math.max(0, Math.round(6 * style.surface.radiusScale)),
                opacity: cardEnter,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              },
            })}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: 10,
                borderBottom: `1px solid ${style.palette.inkBorder}`,
              }}
            >
              <div
                style={{
                  fontFamily: displayFont,
                  fontSize: bounds.isVertical ? 34 : 40,
                  fontWeight: 700,
                  color: style.palette.textPrimary,
                  letterSpacing: `${style.typography.displayTrackingEm}em`,
                }}
              >
                {formatHeadingText('Indeks czytelności przekazu', style)}
              </div>

              <div
                data-instrument-arc="240"
                style={{ display: 'flex', alignItems: 'center', gap: 10 }}
              >
                <svg width="46" height="36" viewBox="0 0 46 36">
                  <path
                    d="M 8 30 A 16 16 0 1 1 38 30"
                    fill="none"
                    stroke={style.palette.inkBorder}
                    strokeWidth="2.5"
                    strokeDasharray="2 3"
                  />
                  <path
                    d="M 8 30 A 16 16 0 1 1 35 12"
                    fill="none"
                    stroke={style.palette.accentPrimary}
                    strokeWidth="3.2"
                  />
                  <line
                    x1="23"
                    y1="20"
                    x2="34"
                    y2="12"
                    stroke={style.palette.textPrimary}
                    strokeWidth="1.6"
                  />
                  <circle cx="23" cy="20" r="2.5" fill={style.palette.textPrimary} />
                </svg>
                <span
                  style={{
                    fontFamily: monoFont,
                    fontSize: 15,
                    fontWeight: 800,
                    padding: '4px 10px',
                    border: `1.5px solid ${style.palette.accentPrimary}`,
                    color: style.palette.accentPrimary,
                  }}
                >
                  Δ +3,0×
                </span>
              </div>
            </div>

            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {bars.map((bar, idx) => {
                const grow = spring({
                  frame: frame - (6 + idx * 6),
                  fps,
                  config: getStyleSpringConfig(style, 'enter'),
                });
                const pct = Math.round(bar.target * grow);
                return (
                  <div key={bar.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span
                      style={{
                        width: 28,
                        fontFamily: monoFont,
                        fontSize: 14,
                        fontWeight: 700,
                        color: bar.leader ? style.palette.accentPrimary : style.palette.textSecondary,
                      }}
                    >
                      0{idx + 1}
                    </span>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: bodyFont, fontSize: 18, fontWeight: bar.leader ? 700 : 600, color: style.palette.textPrimary }}>
                        <span>{bar.label}</span>
                        <span style={{ fontFamily: monoFont }}>{pct} pkt</span>
                      </div>
                      <div style={{ height: bar.leader ? 14 : 11, backgroundColor: style.palette.bgElevated }}>
                        <div
                          style={{
                            width: `${Math.max(3, bar.target * grow)}%`,
                            height: '100%',
                            background:
                              grammar === 'risograph-poster' && !bar.leader
                                ? `repeating-linear-gradient(-45deg, ${bar.color}, ${bar.color} 3px, transparent 3px, transparent 6px)`
                                : bar.color,
                            borderRight: bar.leader ? `2.5px solid ${style.palette.textPrimary}` : undefined,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Vernier Chronicle Rail with Rack Focus */}
          <div
            data-vernier-rail="true"
            style={getTactileSurfaceStyle(style, {
              elevation: 'resting',
              overrides: {
                padding: '16px 24px',
                borderRadius:
                  grammar === 'risograph-poster'
                    ? 0
                    : Math.max(0, Math.round(6 * style.surface.radiusScale)),
                borderTop: `2px solid ${style.palette.inkBorder}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 14,
                opacity: cardEnter,
              },
            })}
          >
            {eras.map((e) => (
              <div
                key={e.year}
                style={{
                  flex: 1,
                  padding: e.active ? '8px 12px' : '4px 8px',
                  borderLeft: e.active ? `3px solid ${style.palette.accentPrimary}` : undefined,
                  filter:
                    e.active || offBlur < 0.25
                      ? 'none'
                      : `blur(${offBlur.toFixed(2)}px)`,
                  opacity: e.active ? 1 : 0.65,
                }}
              >
                <div
                  style={{
                    fontFamily: monoFont,
                    fontSize: 13,
                    fontWeight: 700,
                    color: e.active ? style.palette.accentPrimary : style.palette.textSecondary,
                  }}
                >
                  {e.active ? `▲ ${e.year}` : `│ ${e.year}`}
                </div>
                <div
                  style={{
                    fontFamily: displayFont,
                    fontSize: 19,
                    fontWeight: 700,
                    color: style.palette.textPrimary,
                  }}
                >
                  {e.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DepthPlane>
    </OpticalStage2D>
  );
};
```

- [ ] **Step 4: Update `data-storytelling` and `vector-scene-2d` (`default`) scaffolds in `packages/cli/src/commands/new-production.ts`**

1. Replace `case 'data-storytelling':` (`packages/cli/src/commands/new-production.ts:517-627`) with:

```ts
    case 'data-storytelling':
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
} from '@make-pictures/core';
import {
  AnimatedBarRace,
  DataStoryStage2D,
  MetricComparisonCard,
  TimelineTrack,
} from '@make-pictures/kits/data-storytelling';
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

        <DataStoryStage2D
          datasetCode={\`\${props.badgeLabel} • 60 FPS\`}
          renderBaseFill={false}
        >
          <Sequence from={0} durationInFrames={320}>
            <AbsoluteFill
              style={{
                justifyContent: isVertical ? 'flex-start' : 'center',
                alignItems: isVertical ? 'flex-start' : 'center',
                paddingLeft: isVertical ? 52 : 140,
                paddingRight: isVertical ? 184 : 140,
                paddingTop: isVertical ? 250 : 0,
              }}
            >
              <AnimatedBarRace
                title={props.headline}
                subtitle={props.subheadline}
                valueSuffix=" pkt"
                startFrame={2}
                items={[
                  {
                    id: 'clarity',
                    label: 'Czytelność narracji',
                    value: 96,
                    color: props.accentColor,
                  },
                  {
                    id: 'sync',
                    label: 'Synchronizacja audio',
                    value: 91,
                    color: props.secondaryColor,
                  },
                  {
                    id: 'pacing',
                    label: 'Rytm ujęć 60 FPS',
                    value: 87,
                  },
                ]}
              />
            </AbsoluteFill>
          </Sequence>

          <Sequence from={320} durationInFrames={328}>
            <AbsoluteFill
              style={{
                justifyContent: isVertical ? 'flex-start' : 'center',
                alignItems: isVertical ? 'flex-start' : 'center',
                paddingLeft: isVertical ? 52 : 140,
                paddingRight: isVertical ? 184 : 140,
                paddingTop: isVertical ? 248 : 0,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                <MetricComparisonCard
                  title={props.headline}
                  beforeLabel="Ręczny montaż"
                  beforeValue={24}
                  afterLabel="Video-as-Code"
                  afterValue={60}
                  unit=" FPS"
                  afterColor={props.accentColor}
                  startFrame={2}
                />
                <TimelineTrack
                  startFrame={14}
                  milestones={[
                    { id: 'e1', era: 'ETAP 01', label: 'Scenariusz', fromFrame: 14 },
                    { id: 'e2', era: 'ETAP 02', label: 'Optyka 60 FPS', fromFrame: 96 },
                    { id: 'e3', era: 'ETAP 03', label: 'Master -14 LUFS', fromFrame: 188 },
                  ]}
                />
              </div>
            </AbsoluteFill>
          </Sequence>
        </DataStoryStage2D>
      </AbsoluteFill>
    </StyleProvider>
  );
};
`;
```

2. Replace `case 'vector-scene-2d':` / `default:` (`packages/cli/src/commands/new-production.ts:1073-1170`) with:

```ts
    case 'vector-scene-2d':
    default:
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
} from '@make-pictures/core';
import {
  AnnotatedCallout2D,
  ComparisonSplit2D,
  StoryCard2D,
  VectorSceneStage2D,
} from '@make-pictures/kits/vector-scene-2d';
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

        <VectorSceneStage2D
          plateCode={\`\${props.badgeLabel} • 60 FPS\`}
          renderBaseFill={false}
          foregroundCallouts={
            <Sequence from={0} durationInFrames={320}>
              <AnnotatedCallout2D
                target={isVertical ? [360, 650] : [960, 560]}
                labelPosition={isVertical ? [590, 860] : [1180, 790]}
                code="DETAL A·1"
                label="60 FPS • StyleProvider"
                startFrame={18}
                accentColor={props.secondaryColor}
              />
            </Sequence>
          }
        >
          <Sequence from={0} durationInFrames={320}>
            <AbsoluteFill
              style={{
                justifyContent: isVertical ? 'flex-start' : 'center',
                alignItems: isVertical ? 'flex-start' : 'center',
                paddingLeft: isVertical ? 54 : 160,
                paddingRight: isVertical ? 186 : 160,
                paddingTop: isVertical ? 280 : 0,
              }}
            >
              <div style={{ width: '100%', maxWidth: isVertical ? 836 : 980 }}>
                <StoryCard2D
                  title={props.headline}
                  subtitle={props.subheadline}
                  badge={props.badgeLabel}
                  accentColor={props.accentColor}
                  startFrame={2}
                />
              </div>
            </AbsoluteFill>
          </Sequence>

          <Sequence from={320} durationInFrames={328}>
            <ComparisonSplit2D
              startFrame={2}
              focusShiftFrame={150}
              left={{
                tag: '01 • Baza',
                title: props.headline,
                detail: props.subheadline,
              }}
              right={{
                tag: '02 • Kierunek plastyczny',
                title: props.styleId,
                detail: 'Spójna typografia, optyka 2.5D i mastering -14 LUFS',
              }}
            />
          </Sequence>
        </VectorSceneStage2D>
      </AbsoluteFill>
    </StyleProvider>
  );
};
`;
```

- [ ] **Step 5: Build packages, run full test suite, and verify `16:9` + `9:16` Contact-Sheet QA + `pack:verify`**

1. Run build, typecheck, and full tests:
   ```bash
   npm run sync:skills && npm run build:packages && npm run typecheck && npm test
   ```
   Expected: PASS (`0` errors across all tests).

2. Generate temporary `16:9` and `9:16` QA capsules for `vector-scene-2d` (`editorial-press` & `brutalist-poster`) and `data-storytelling` (`cyber-telemetry` & `editorial-press`), render 12-frame Contact-Sheets via `npx make-pictures qa`, inspect every `out/qa-*.png` visually via `read_file` (confirming `f=0` pure empty canvas, `latin-ext` diacritics, visible directional shadows/halation/rack focus, and zero `9:16 Safe Box` `y <= 1380` overflow), then delete the temporary `productions/qa-*` capsules and `out/qa-*.png` files so `git status` is clean.

3. Run full tarball verification:
   ```bash
   npm run pack:verify
   ```
   Expected: PASS (`0` errors across Mode A & Mode B).

- [ ] **Step 6: Commit Task 4**

```bash
git add packages/studio/src/client/components/StyleLabShowcase.tsx packages/cli/src/commands/new-production.ts packages/cli/tests/studio-styles-api.test.ts packages/cli/tests/styles-cli.test.ts
git commit -m "feat(studio,cli): wire Wave 2 optical previews in Style Lab and new-production scaffolds"
```
