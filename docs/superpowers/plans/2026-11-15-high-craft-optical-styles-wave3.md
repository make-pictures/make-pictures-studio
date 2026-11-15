# High-Craft Optical Styles — Wave 3 (`motion-diagrams-2d` & `isometric-3d`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `@make-pictures/kits/motion-diagrams-2d` (together with `DirectorCamera2D` / `CameraRig` / `ScreenSpotlightOverlay`) and `@make-pictures/kits/isometric-3d` with directional optical lighting, shot-driven rack focus, polymorphic schematic couplers, and style-derived 3D maquette materials (`ceramic-maquette`, `anodized-telemetry`, `ink-figurine`), plus live `60 FPS` `Style Lab` previews, updated CLI scaffolds, synced canonical skills, and `16:9` + `9:16` Contact-Sheet QA.

**Architecture:** Zero changes to `StylePresetSchema` or `styles/*.style.json` — both 2D and 3D layers consume `resolveStyleOptics(style)` (`lightAngleDeg`, `aperture`, `halation`, `lightingRig`, `typographyGrammar`) and `style.palette`. `DirectorCamera2D` and `CameraRig` replace hardcoded cyan/indigo radial blobs with `StageLightingRig` and Clean Frame `0`, while `<MotionDiagramStage2D />` drives Circle-of-Confusion rack focus (`computeCircleOfConfusionPx`) across `SystemNode` and `WorldBox`. In `isometric-3d`, pure WebGL-free resolvers (`isometricMaterials.ts`) compute 3D lighting vectors and polymorphic character materials for `IsometricStage3D` and `Stylized3DCharacter`, keeping `100%` Node testability and zero `three` imports in `@make-pictures/studio`. Tasks 1, 2, and 3 touch completely disjoint file sets and can run in parallel; Task 4 integrates `Style Lab`, `new-production.ts`, `16:9` + `9:16` QA, and `npm run pack:verify`.

**Tech Stack:** TypeScript (`strict`), React 18, Remotion 4 (`60 FPS`), `@remotion/three` + Three.js + `@react-three/fiber` (strictly inside `@make-pictures/kits`), `@remotion/player` (`Thumbnail` SSR tests), Zod, `node:test` + `tsx`.

## Global Constraints

- **Clean Frame `0` Invariant:** On `frame <= 0`, every camera/stage (`DirectorCamera2D`, `CameraRig`, `MotionDiagramStage2D`, `StyleLabPreviewComposition`) renders pure `style.palette.bgCanvas` (or `null` when `renderBaseFill={false}`), and every scenic 2D/3D component (`FlowCurve`, `SystemNode`, `DataFlowEdge`, `CodePayloadToast`, `IsometricStage3D`, `Stylized3DCharacter`) returns `null`.
- **100% Multi-Core Determinism (`--concurrency=100%`):** Zero `Math.random()`, zero cross-frame mutable `useRef`; use `createSeededRandom(seed)` from `@make-pictures/core`.
- **Sharp Vector Typography Deadzone:** Whenever optical blur `< 0.25` px, emit `filter: 'none'` (never `blur(0px)`).
- **`9:16` Golden Safe Box:** All vertical (`1080×1920`) content must stay strictly inside `x ∈ [40, 910], y ∈ [220, 1380]` (use horizontal bounds `left: 76, width: 788` for overlays/cards under camera drift).
- **`isometric-3d` Motion & Bundle Boundaries:** All character/stage oscillations strictly within `0.03..0.055 rad/frame`, zero vertical torso bouncing, strict separation of `speakingWeight` vs `speechEnergy`, and ZERO `three` or `@react-three/fiber` runtime imports in `packages/core` or `packages/studio`.
- **Backwards-Compatibility Guards:** Preserve `WorldBox` standalone SSR contract in `kits-style-integration.test.ts` (`brutalist-poster` -> `Space Grotesk`, `6px 6px 0px`, `border-radius:0`; `editorial-press` -> `DM Sans`, `1.5px solid` without requiring `<Thumbnail>`), `DataFlowEdge` layout contract in `demo-precision-layout.test.ts` (`evaluateCubicBezier`, `labelT?`, `labelOffsetX?`, `zIndex?`), and `@deprecated IsometricStudioEnvironment`.

---

## File Ownership Map

- **Task 1 (`DirectorCamera2D` + `motion-diagrams-2d` + `ScreenSpotlightOverlay` — parallel-safe):**
  - Modify: `packages/core/src/camera/DirectorCamera2D.tsx`
  - Create: `packages/kits/src/motion-diagrams-2d/MotionDiagramStage2D.tsx`
  - Modify: `packages/kits/src/motion-diagrams-2d/CameraRig.tsx`
  - Modify: `packages/kits/src/motion-diagrams-2d/NodeBox.tsx`
  - Modify: `packages/kits/src/motion-diagrams-2d/SystemNode.tsx`
  - Modify: `packages/kits/src/motion-diagrams-2d/DataFlowEdge.tsx`
  - Modify: `packages/kits/src/motion-diagrams-2d/CodePayloadToast.tsx`
  - Modify: `packages/kits/src/motion-diagrams-2d/index.ts`
  - Modify: `packages/kits/src/product-frames/ScreenSpotlightOverlay.tsx`
  - Create (Test): `packages/cli/tests/wave3-motion-diagrams.test.ts`
- **Task 2 (`isometric-3d` — parallel-safe):**
  - Create: `packages/kits/src/isometric-3d/isometricMaterials.ts`
  - Modify: `packages/kits/src/isometric-3d/IsometricStage3D.tsx`
  - Modify: `packages/kits/src/isometric-3d/Stylized3DCharacter.tsx`
  - Modify: `packages/kits/src/isometric-3d/index.ts`
  - Create (Test): `packages/cli/tests/wave3-isometric-3d.test.ts`
- **Task 3 (Canonical Skills & Mirror Sync — parallel-safe):**
  - Modify: `plugins/make-pictures/skills/kit-motion-diagrams-2d/SKILL.md`
  - Modify: `plugins/make-pictures/skills/kit-isometric-3d/SKILL.md`
  - Modify: `plugins/make-pictures/skills/cinematography-and-vfx/SKILL.md`
  - Synced output (`npm run sync:skills`): `skills/kit-motion-diagrams-2d/SKILL.md`, `skills/kit-isometric-3d/SKILL.md`, `skills/cinematography-and-vfx/SKILL.md`
- **Task 4 (`Style Lab`, `new-production.ts`, QA & `pack:verify` — runs after Tasks 1–3):**
  - Modify: `packages/studio/src/client/components/StyleLabShowcase.tsx`
  - Modify: `packages/cli/src/commands/new-production.ts`
  - Modify: `packages/cli/tests/studio-styles-api.test.ts`
  - Modify: `packages/cli/tests/styles-cli.test.ts`

---

### Task 1: Optical `DirectorCamera2D` & Rebuild `@make-pictures/kits/motion-diagrams-2d` (+ `ScreenSpotlightOverlay`)

**Files:**
- Modify: `packages/core/src/camera/DirectorCamera2D.tsx`
- Create: `packages/kits/src/motion-diagrams-2d/MotionDiagramStage2D.tsx`
- Modify: `packages/kits/src/motion-diagrams-2d/CameraRig.tsx`
- Modify: `packages/kits/src/motion-diagrams-2d/NodeBox.tsx`
- Modify: `packages/kits/src/motion-diagrams-2d/SystemNode.tsx`
- Modify: `packages/kits/src/motion-diagrams-2d/DataFlowEdge.tsx`
- Modify: `packages/kits/src/motion-diagrams-2d/CodePayloadToast.tsx`
- Modify: `packages/kits/src/motion-diagrams-2d/index.ts`
- Modify: `packages/kits/src/product-frames/ScreenSpotlightOverlay.tsx`
- Create (Test): `packages/cli/tests/wave3-motion-diagrams.test.ts`

**Interfaces:**
- Consumes from `@make-pictures/core`: `StageLightingRig`, `computeCircleOfConfusionPx`, `formatFontFamilyCss`, `formatHeadingText`, `getCardChromeStyle`, `getStyleSpringConfig`, `getTactileSurfaceStyle`, `resolveStyleOptics`, `useStudioFontsReady`, `useStudioStyle`, `type CameraImpulse`, `type CameraKeyframe2D`, `type ShotSpec2D`, `type StageNode2D`, `type TactileElevation`.
- Produces:
  - Updated `DirectorCamera2DProps` (`renderBaseFill?: boolean`, `renderLighting?: boolean`, optional `variant?: 'light' | 'dark'`)
  - `MotionDiagramStage2D: React.FC<MotionDiagramStage2DProps>`, `useMotionDiagramFocus`, `type MotionDiagramFocusState`
  - Updated `WorldBox` (`nodeId?: string`, `focusState?: MotionDiagramFocusState`, `elevation?: TactileElevation`), `FlowCurve` (`data-flow-grammar`)
  - Updated `SystemNode` (`icon?: LucideIcon`, `nodeId?: string`, `focusState?: MotionDiagramFocusState`, `moduleCode?: string`, `data-node-grammar`, `data-focus-state`)
  - Updated `DataFlowEdge` (`data-edge-grammar`, world-coordinate SVG, rectangular protocol plate)
  - Updated `CodePayloadToast` + exported `resolvePayloadTokenColors(style)` (`data-payload-plate="true"`)

- [ ] **Step 1: Write the failing test file `packages/cli/tests/wave3-motion-diagrams.test.ts`**

Create `packages/cli/tests/wave3-motion-diagrams.test.ts`:

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
  BUILT_IN_STYLE_IDS,
  BUILT_IN_STYLES,
  DirectorCamera2D,
  StyleProvider,
} from '../../core/src/index';
import * as kitsRoot from '../../kits/src/index';
import {
  CameraRig,
  CodePayloadToast,
  DataFlowEdge,
  FlowCurve,
  MotionDiagramStage2D,
  SystemNode,
  WorldBox,
  evaluateCubicBezier,
  portLeft,
  portRight,
  resolvePayloadTokenColors,
  type NodeBox,
} from '../../kits/src/motion-diagrams-2d';
import { ScreenSpotlightOverlay } from '../../kits/src/product-frames';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('DirectorCamera2D and CameraRig enforce Clean Frame 0, inherit StyleProvider palette, and eliminate hardcoded cyan/indigo blobs', () => {
  const dirCamSrc = fs.readFileSync(
    path.resolve(__dirname, '../../core/src/camera/DirectorCamera2D.tsx'),
    'utf8'
  );
  const rigSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/motion-diagrams-2d/CameraRig.tsx'),
    'utf8'
  );

  for (const [name, src] of [
    ['DirectorCamera2D.tsx', dirCamSrc],
    ['CameraRig.tsx', rigSrc],
  ] as const) {
    assert.doesNotMatch(src, /rgba\(0,\s*240,\s*255/, `${name} must not contain neon cyan blob`);
    assert.doesNotMatch(src, /rgba\(165,\s*180,\s*252/, `${name} must not contain indigo blob`);
    assert.doesNotMatch(src, /Math\.random\s*\(/);
    assert.match(src, /frame\s*<=\s*0/);
    assert.match(src, /StageLightingRig/);
  }

  const CamScene: React.FC = () =>
    React.createElement(
      StyleProvider,
      { style: 'cyber-telemetry' },
      React.createElement(
        DirectorCamera2D,
        {
          keyframes: [{ startFrame: 0, x: 960, y: 540, zoom: 1 }],
        },
        React.createElement('div', { 'data-cam-child': 'true' }, 'Węzeł kamery')
      )
    );

  const f0 = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: CamScene,
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 90,
      fps: 60,
      frameToDisplay: 0,
    })
  );
  assert.doesNotMatch(f0, /Węzeł kamery/);
  assert.doesNotMatch(f0, /data-lighting-rig=/);

  const f24 = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: CamScene,
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 90,
      fps: 60,
      frameToDisplay: 24,
    })
  );
  assert.match(f24, /Węzeł kamery/);
  assert.match(f24, /data-lighting-rig="darkroom-halation"/);

  const RigScene: React.FC = () =>
    React.createElement(
      StyleProvider,
      { style: 'editorial-press' },
      React.createElement(
        CameraRig,
        { keyframes: [{ startFrame: 0, x: 960, y: 540, zoom: 1 }] },
        React.createElement('div', null, 'Scena CameraRig')
      )
    );
  const rigF0 = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: RigScene,
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 60,
      fps: 60,
      frameToDisplay: 0,
    })
  );
  assert.doesNotMatch(rigF0, /Scena CameraRig/);
});

test('MotionDiagramStage2D, SystemNode, WorldBox, FlowCurve, DataFlowEdge, CodePayloadToast, and ScreenSpotlightOverlay eliminate pills/blobs and drive optical rack focus', () => {
  assert.equal(typeof MotionDiagramStage2D, 'function');
  assert.equal(typeof resolvePayloadTokenColors, 'function');
  assert.equal(typeof evaluateCubicBezier, 'function');
  assert.equal(kitsRoot.MotionDiagramStage2D, MotionDiagramStage2D);
  assert.equal(kitsRoot.resolvePayloadTokenColors, resolvePayloadTokenColors);

  const filesToAudit = [
    'motion-diagrams-2d/MotionDiagramStage2D.tsx',
    'motion-diagrams-2d/NodeBox.tsx',
    'motion-diagrams-2d/SystemNode.tsx',
    'motion-diagrams-2d/DataFlowEdge.tsx',
    'motion-diagrams-2d/CodePayloadToast.tsx',
  ] as const;

  for (const rel of filesToAudit) {
    const src = fs.readFileSync(path.resolve(__dirname, '../../kits/src', rel), 'utf8');
    assert.doesNotMatch(src, /Math\.random\s*\(/, `${rel} must not use Math.random`);
    assert.doesNotMatch(src, /useRef\b/, `${rel} must not use mutable useRef`);
    assert.doesNotMatch(src, /radii\.pill|9999/, `${rel} must not use pill radii`);
  }

  const toastSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/motion-diagrams-2d/CodePayloadToast.tsx'),
    'utf8'
  );
  assert.doesNotMatch(toastSrc, /#93C5FD|#6EE7B7|#FCD34D|#1D4ED8|#059669|#B45309/);

  const edgeSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/motion-diagrams-2d/DataFlowEdge.tsx'),
    'utf8'
  );
  assert.doesNotMatch(edgeSrc, /viewBox="0 0 1920 1080"/);

  const spotlightSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/product-frames/ScreenSpotlightOverlay.tsx'),
    'utf8'
  );
  assert.doesNotMatch(spotlightSrc, /borderRadius:\s*9999/);

  const edTokens = resolvePayloadTokenColors(BUILT_IN_STYLES['editorial-press']);
  assert.equal(edTokens.keyColor, BUILT_IN_STYLES['editorial-press'].palette.accentPrimary);
  assert.equal(edTokens.stringColor, BUILT_IN_STYLES['editorial-press'].palette.accentSecondary);

  const nodeA: NodeBox = { cx: 480, cy: 520, w: 360, h: 188 };
  const nodeB: NodeBox = { cx: 1280, cy: 520, w: 360, h: 188 };

  for (const [styleId, expectedGrammar] of [
    ['editorial-press', 'swiss-spatial'],
    ['cyber-telemetry', 'optical-gate'],
    ['brutalist-poster', 'risograph-poster'],
  ] as const) {
    const DiagramScene: React.FC = () =>
      React.createElement(
        StyleProvider,
        { style: styleId },
        React.createElement(
          MotionDiagramStage2D,
          {
            diagramCode: 'SCHEMAT 03 • RACK FOCUS',
            nodes: { ingress: nodeA, worker: nodeB },
            shots: [
              { fromFrame: 0, target: ['ingress', 'worker'], padding: 120 },
              { fromFrame: 40, target: 'worker', transition: 'cut', padding: 140 },
            ],
          },
          React.createElement(FlowCurve, {
            from: portRight(nodeA),
            to: portLeft(nodeB),
            activeFromFrame: 0,
            packetSpeedFrames: 60,
          }),
          React.createElement(DataFlowEdge, {
            id: 'bus-1',
            from: portRight(nodeA, 24),
            to: portLeft(nodeB, 24),
            drawStartFrame: 0,
            flowStartFrame: 12,
            flowEndFrame: 120,
            label: 'POST /ingest',
            subLabel: 'TLS 1.3',
          }),
          React.createElement(SystemNode, {
            id: 'ingress',
            title: 'Brama wejściowa',
            subtitle: 'Walidacja strumienia źródeł',
            badge: 'MOD 01',
            statusText: 'Gotowy',
            activeStatusText: 'Przetwarzanie',
            x: nodeA.cx,
            y: nodeA.cy,
            width: nodeA.w,
            height: nodeA.h,
            enterFrame: 0,
            activeRanges: [[4, 38]],
          }),
          React.createElement(SystemNode, {
            id: 'worker',
            title: 'Pula indeksowania',
            subtitle: 'Zapis wektorowy 60 kl./s',
            badge: 'MOD 02',
            statusText: 'Oczekuje',
            activeStatusText: 'Zapis aktywny',
            x: nodeB.cx,
            y: nodeB.cy,
            width: nodeB.w,
            height: nodeB.h,
            enterFrame: 2,
            activeRanges: [[40, 110]],
          }),
          React.createElement(
            WorldBox,
            { node: { cx: 480, cy: 820, w: 320, h: 90 }, nodeId: 'ingress' },
            'Notatka pomocnicza'
          ),
          React.createElement(CodePayloadToast, {
            x: 1280,
            y: 660,
            methodBadge: 'POST',
            endpoint: '/v1/ingest',
            code: '{\n  "ok": true,\n  "rows": 42,\n  "mode": "fast"\n}',
            startFrame: 0,
            endFrame: 120,
          })
        ),
        React.createElement(ScreenSpotlightOverlay, {
          x: 20,
          y: 20,
          width: 40,
          height: 30,
          startFrame: 2,
          label: 'Fokus ekranu',
        })
      );

    // Frame 0: clean canvas invariant even when enterFrame=0 / startFrame=0 / drawStartFrame=0 were passed
    const f0 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: DiagramScene,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 130,
        fps: 60,
        frameToDisplay: 0,
      })
    );
    assert.doesNotMatch(f0, /SCHEMAT 03/);
    assert.doesNotMatch(f0, /Brama wejściowa/);
    assert.doesNotMatch(f0, /POST \/ingest/);
    assert.doesNotMatch(f0, /Fokus ekranu/);

    // Frame 28: Shot 0 targets BOTH ['ingress', 'worker'] -> both sharp (`filter:none`)
    const f28 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: DiagramScene,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 130,
        fps: 60,
        frameToDisplay: 28,
      })
    );
    assert.match(f28, /SCHEMAT 03 • RACK FOCUS/);
    assert.match(f28, new RegExp(`data-flow-grammar="${expectedGrammar}"`));
    assert.match(f28, new RegExp(`data-edge-grammar="${expectedGrammar}"`));
    assert.match(f28, new RegExp(`data-node-grammar="${expectedGrammar}"`));
    assert.match(f28, /data-payload-plate="true"/);
    assert.doesNotMatch(f28, /data-focus-state="recessed"/);
    assert.doesNotMatch(f28, /blur\(0(?:\.0+)?px\)/);

    // Frame 64: Shot 1 targets ONLY 'worker' -> 'ingress' is recessed (blurred) while 'worker' stays sharp (`filter:none`)
    const f64 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: DiagramScene,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 130,
        fps: 60,
        frameToDisplay: 64,
      })
    );
    assert.match(f64, /data-focus-state="recessed"/);
    assert.match(f64, /data-focus-state="sharp"/);
    assert.match(f64, /filter:blur\(/);
    assert.match(f64, /filter:none/);
    assert.doesNotMatch(f64, /blur\(0(?:\.0+)?px\)/);
  }

  // Zero-aperture deadzone (< 0.25px -> filter: 'none' even when recessed) across all 7 styles
  for (const styleId of BUILT_IN_STYLE_IDS) {
    const zeroApStyle = {
      ...BUILT_IN_STYLES[styleId],
      optics: { ...BUILT_IN_STYLES[styleId].optics!, aperture: 0 },
    };
    const ZeroApScene: React.FC = () =>
      React.createElement(
        StyleProvider,
        { style: zeroApStyle },
        React.createElement(
          MotionDiagramStage2D,
          { focusedNodeIds: ['only-sharp'] },
          React.createElement(SystemNode, {
            id: 'recessed-node',
            title: 'Węzeł zażółć',
            subtitle: 'Ostra martwa strefa przysłony',
            badge: 'M0',
            statusText: 'Czuwanie',
            x: 540,
            y: 600,
            enterFrame: 2,
          })
        )
      );
    const html = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: ZeroApScene,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 60,
        fps: 60,
        frameToDisplay: 24,
      })
    );
    assert.match(html, /data-focus-state="recessed"/);
    assert.doesNotMatch(html, /filter:blur\(/);
    assert.match(html, /filter:none/);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test packages/cli/tests/wave3-motion-diagrams.test.ts`
Expected: FAIL (`MotionDiagramStage2D` and `resolvePayloadTokenColors` are not exported yet, and `DirectorCamera2D` still contains hardcoded radial blobs).

- [ ] **Step 3: Upgrade `packages/core/src/camera/DirectorCamera2D.tsx` and `packages/kits/src/motion-diagrams-2d/CameraRig.tsx`**

Update `packages/core/src/camera/DirectorCamera2D.tsx` (lines 1–19 and lines 285–462) so `DirectorCamera2D` enforces Clean Frame `0`, inherits `useStudioStyle()` when `variant` is omitted, and renders `<StageLightingRig renderBaseFill={false} />` + calibrated drafting grid instead of cyan/indigo blobs:

```tsx
// Top imports in packages/core/src/camera/DirectorCamera2D.tsx:
import React, { useLayoutEffect, useMemo } from 'react';
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { StageLightingRig } from '../optics/StageLightingRig';
import { useStudioStyle } from '../style';
import { STUDIO_THEME, THEME, useStudioFontsReady } from '../theme';
import { evaluateHandheldNoise, evaluateImpactShake } from './cameraNoise';
import { DirectorCameraTelemetryProvider } from './DirectorCamera3D';
import {
  type CameraImpulse,
  type CameraKeyframe2D,
  type DirectorCameraTelemetry,
  publishFrameCameraTelemetry,
  type ShotSpec2D,
  type StageNode2D,
} from './shotTypes';
```

Replace `DirectorCamera2DProps` and `DirectorCamera2D` in `packages/core/src/camera/DirectorCamera2D.tsx` (lines 285–462):

```tsx
export interface DirectorCamera2DProps {
  /** Raw camera keyframes (compatible with `CameraRig`) */
  keyframes?: CameraKeyframe2D[];
  /** Named 2D `NodeBox` dictionary for declarative Shot-DSL auto-framing */
  nodes?: Record<string, StageNode2D>;
  /** Declarative Shot-DSL target sequence resolved against `nodes` */
  shots?: ShotSpec2D[];
  stageWidth?: number;
  stageHeight?: number;
  /** Optional explicit polarity override; inherits `useStudioStyle().surface.isDark` when omitted */
  variant?: 'light' | 'dark';
  /** Automatically centers bounded targets inside the `9:16 Golden Safe Box` when `stageHeight > stageWidth` */
  safeBox9x16Compensation?: boolean;
  /** Subtle low-frequency handheld float intensity (default `0.15`) */
  handheldIntensity?: number;
  /** Damped harmonic camera shake impulses */
  impulses?: CameraImpulse[];
  seed?: number;
  /** Toggle technical drafting grid (default `true`) */
  showGrid?: boolean;
  /** Render solid `bgCanvas` base fill (default `true`; pass `false` over `<StyleProvider renderBackdrop>`) */
  renderBaseFill?: boolean;
  /** Render directional `<StageLightingRig />` layer (default `true`) */
  renderLighting?: boolean;
  /** Optional viewport-pinned HUD / VFX layer (`<CinematicLensOverlay />`, etc.) */
  overlay?: React.ReactNode;
  children: React.ReactNode;
}

export const DirectorCamera2D: React.FC<DirectorCamera2DProps> = ({
  keyframes,
  nodes,
  shots,
  stageWidth,
  stageHeight,
  variant,
  safeBox9x16Compensation = true,
  handheldIntensity = 0.15,
  impulses,
  seed = 2026,
  showGrid = true,
  renderBaseFill = true,
  renderLighting = true,
  overlay,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  useStudioFontsReady();
  const studioStyle = useStudioStyle();

  const effectiveWidth = stageWidth ?? width;
  const effectiveHeight = stageHeight ?? height;

  const cam = useMemo(
    () =>
      evaluateDirectorCamera2D({
        frame,
        fps,
        stageWidth: effectiveWidth,
        stageHeight: effectiveHeight,
        keyframes,
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
      keyframes,
      nodes,
      shots,
      safeBox9x16Compensation,
      handheldIntensity,
      impulses,
      seed,
    ]
  );

  useLayoutEffect(() => {
    publishFrameCameraTelemetry(frame, cam.telemetry);
  }, [frame, cam.telemetry]);

  const isDark =
    variant === 'dark'
      ? true
      : variant === 'light'
        ? false
        : studioStyle.surface.isDark;

  const resolvedBgCanvas =
    variant === 'dark' && !studioStyle.surface.isDark
      ? THEME.colors.bgPrimary
      : variant === 'light' && studioStyle.surface.isDark
        ? STUDIO_THEME.colors.bgCanvas
        : studioStyle.palette.bgCanvas;

  // Clean Frame 0 invariant
  if (frame <= 0) {
    return (
      <DirectorCameraTelemetryProvider telemetry={cam.telemetry}>
        {renderBaseFill ? (
          <AbsoluteFill style={{ backgroundColor: resolvedBgCanvas }} />
        ) : null}
      </DirectorCameraTelemetryProvider>
    );
  }

  const centerX = effectiveWidth / 2;
  const centerY = effectiveHeight / 2;

  // Viewport-filling infinite grid math — zero GPU texture clipping at any zoom or pan
  const gridSpacing = Math.max(24, 80 * cam.zoom);
  const dotSpacing = Math.max(16, 40 * cam.zoom);
  const gridOffsetX = centerX - cam.x * cam.zoom;
  const gridOffsetY = centerY - cam.y * cam.zoom;

  const gridLineColor =
    variant !== undefined
      ? isDark
        ? 'rgba(255, 255, 255, 0.05)'
        : 'rgba(15, 23, 42, 0.05)'
      : isDark
        ? 'rgba(255, 255, 255, 0.05)'
        : `${studioStyle.palette.inkBorder}22`;

  const gridDotColor =
    variant !== undefined
      ? isDark
        ? 'rgba(226, 232, 240, 0.16)'
        : 'rgba(51, 65, 85, 0.14)'
      : `${studioStyle.palette.accentPrimary}2E`;

  return (
    <DirectorCameraTelemetryProvider telemetry={cam.telemetry}>
      <AbsoluteFill
        style={{
          backgroundColor: renderBaseFill ? resolvedBgCanvas : 'transparent',
          overflow: 'hidden',
        }}
      >
        {/* 1. Directional Optical Lighting Rig */}
        {renderLighting ? (
          <StageLightingRig renderBaseFill={false} seed={`cam2d-${seed}`} />
        ) : null}

        {/* 2. Viewport-Pinned Infinite Technical Drafting Grid (Zero GPU Clipping) */}
        {showGrid && (
          <>
            <AbsoluteFill
              style={{
                backgroundImage: `
                  linear-gradient(to right, ${gridLineColor} 1px, transparent 1px),
                  linear-gradient(to bottom, ${gridLineColor} 1px, transparent 1px)
                `,
                backgroundSize: `${gridSpacing}px ${gridSpacing}px`,
                backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`,
                pointerEvents: 'none',
              }}
            />
            <AbsoluteFill
              style={{
                backgroundImage: `radial-gradient(${gridDotColor} 1.35px, transparent 1.35px)`,
                backgroundSize: `${dotSpacing}px ${dotSpacing}px`,
                backgroundPosition: `${gridOffsetX + dotSpacing / 2}px ${gridOffsetY + dotSpacing / 2}px`,
                pointerEvents: 'none',
              }}
            />
          </>
        )}

        {/* 3. Zero-Clipping Origin-Anchored Camera Plane */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 0,
            height: 0,
            transformOrigin: '0 0',
            willChange: 'transform',
            transform: `translate3d(${centerX}px, ${centerY}px, 0) scale(${cam.zoom}) rotate(${cam.rotateZ}deg) translate3d(${-cam.x}px, ${-cam.y}px, 0)`,
          }}
        >
          {children}
        </div>

        {/* 4. Optional Viewport-Pinned Overlay Slot */}
        {overlay}
      </AbsoluteFill>
    </DirectorCameraTelemetryProvider>
  );
};
```

Update `packages/kits/src/motion-diagrams-2d/CameraRig.tsx` similarly:

```tsx
import React from 'react';
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  STUDIO_THEME,
  StageLightingRig,
  THEME,
  useStudioFontsReady,
  useStudioStyle,
} from '@make-pictures/core';

export interface CameraKeyframe {
  startFrame: number;
  x: number;
  y: number;
  zoom: number;
  rotateZ?: number;
  stiffness?: number;
  flightZoomDip?: number;
  flightBankDeg?: number;
}

export interface CameraRigProps {
  keyframes: CameraKeyframe[];
  stageWidth?: number;
  stageHeight?: number;
  variant?: 'light' | 'dark';
  children: React.ReactNode;
}

export function evaluateCameraState(
  frame: number,
  fps: number,
  keyframes: CameraKeyframe[]
) {
  if (keyframes.length === 0) {
    return {
      x: 960,
      y: 540,
      zoom: 1,
      rotateZ: 0,
      velocity: 0,
    };
  }

  let x = keyframes[0].x;
  let y = keyframes[0].y;
  let zoom = keyframes[0].zoom;
  let rotateZ = keyframes[0].rotateZ ?? 0;
  let velocity = 0;

  for (let i = 1; i < keyframes.length; i++) {
    const prev = keyframes[i - 1];
    const curr = keyframes[i];

    if (frame < curr.startFrame) {
      break;
    }

    const p = spring({
      frame: frame - curr.startFrame,
      fps,
      config: {
        damping: 200,
        stiffness: curr.stiffness ?? 42,
        mass: 1.25,
      },
    });

    const midFlightArc = 0.5 * (1 - Math.cos(2 * Math.PI * p));
    const zoomDip = (curr.flightZoomDip ?? 0) * midFlightArc;
    const bankAdd = (curr.flightBankDeg ?? 0) * midFlightArc;

    x += (curr.x - prev.x) * p;
    y += (curr.y - prev.y) * p;
    zoom += (curr.zoom - prev.zoom) * p + zoomDip;
    rotateZ += ((curr.rotateZ ?? 0) - (prev.rotateZ ?? 0)) * p + bankAdd;
    velocity = Math.max(velocity, midFlightArc);
  }

  const floatX = Math.sin(frame / 45) * 4;
  const floatY = Math.cos(frame / 55) * 3.5;

  return {
    x: x + floatX,
    y: y + floatY,
    zoom,
    rotateZ,
    velocity,
  };
}

export const CameraRig: React.FC<CameraRigProps> = ({
  keyframes,
  stageWidth = 1920,
  stageHeight = 1080,
  variant,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  useStudioFontsReady();
  const studioStyle = useStudioStyle();

  const isDark =
    variant === 'dark'
      ? true
      : variant === 'light'
        ? false
        : studioStyle.surface.isDark;

  const resolvedBgCanvas =
    variant === 'dark' && !studioStyle.surface.isDark
      ? THEME.colors.bgPrimary
      : variant === 'light' && studioStyle.surface.isDark
        ? STUDIO_THEME.colors.bgCanvas
        : studioStyle.palette.bgCanvas;

  if (frame <= 0) {
    return <AbsoluteFill style={{ backgroundColor: resolvedBgCanvas }} />;
  }

  const cam = evaluateCameraState(frame, fps, keyframes);
  const centerX = stageWidth / 2;
  const centerY = stageHeight / 2;

  const gridSpacing = Math.max(24, 80 * cam.zoom);
  const dotSpacing = Math.max(16, 40 * cam.zoom);
  const gridOffsetX = centerX - cam.x * cam.zoom;
  const gridOffsetY = centerY - cam.y * cam.zoom;

  const gridLineColor =
    variant !== undefined
      ? isDark
        ? 'rgba(255, 255, 255, 0.05)'
        : 'rgba(15, 23, 42, 0.05)'
      : isDark
        ? 'rgba(255, 255, 255, 0.05)'
        : `${studioStyle.palette.inkBorder}22`;

  const gridDotColor =
    variant !== undefined
      ? isDark
        ? 'rgba(226, 232, 240, 0.16)'
        : 'rgba(51, 65, 85, 0.14)'
      : `${studioStyle.palette.accentPrimary}2E`;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: resolvedBgCanvas,
        overflow: 'hidden',
      }}
    >
      <StageLightingRig renderBaseFill={false} seed="camera-rig-2d" />

      <AbsoluteFill
        style={{
          backgroundImage: `
            linear-gradient(to right, ${gridLineColor} 1px, transparent 1px),
            linear-gradient(to bottom, ${gridLineColor} 1px, transparent 1px)
          `,
          backgroundSize: `${gridSpacing}px ${gridSpacing}px`,
          backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`,
          pointerEvents: 'none',
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${gridDotColor} 1.35px, transparent 1.35px)`,
          backgroundSize: `${dotSpacing}px ${dotSpacing}px`,
          backgroundPosition: `${gridOffsetX + dotSpacing / 2}px ${gridOffsetY + dotSpacing / 2}px`,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          transformOrigin: '0 0',
          willChange: 'transform',
          transform: `translate3d(${centerX}px, ${centerY}px, 0) scale(${cam.zoom}) rotate(${cam.rotateZ}deg) translate3d(${-cam.x}px, ${-cam.y}px, 0)`,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 4: Create `packages/kits/src/motion-diagrams-2d/MotionDiagramStage2D.tsx`**

Create `packages/kits/src/motion-diagrams-2d/MotionDiagramStage2D.tsx`:

```tsx
import React, { createContext, useContext, useMemo } from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  DirectorCamera2D,
  computeCircleOfConfusionPx,
  formatFontFamilyCss,
  getStyleSpringConfig,
  resolveStyleOptics,
  useStudioStyle,
  type DirectorCamera2DProps,
  type ShotSpec2D,
} from '@make-pictures/core';

export type MotionDiagramFocusState = 'auto' | 'sharp' | 'recessed';

export interface ResolvedNodeFocusOptics {
  isRecessed: boolean;
  blurPx: number;
  filterCss: string;
  opacityScale: number;
  scaleFactor: number;
}

interface MotionDiagramFocusContextValue {
  resolveNodeFocus: (
    nodeId: string | undefined,
    explicitState?: MotionDiagramFocusState
  ) => ResolvedNodeFocusOptics;
}

const MotionDiagramFocusContext =
  createContext<MotionDiagramFocusContextValue | null>(null);

export function useMotionDiagramFocus(): MotionDiagramFocusContextValue | null {
  return useContext(MotionDiagramFocusContext);
}

function getShotTargetSet(shot: ShotSpec2D): Set<string> {
  const arr = Array.isArray(shot.target) ? shot.target : [shot.target];
  return new Set(arr.filter(Boolean));
}

export interface MotionDiagramStage2DProps
  extends Omit<DirectorCamera2DProps, 'children'> {
  /** Explicit focused node IDs; when omitted, derives focus automatically from `shots` */
  focusedNodeIds?: ReadonlyArray<string>;
  /** Viewport-pinned technical sheet index stamp (strictly inside 9:16 Safe Box) */
  diagramCode?: string;
  children: React.ReactNode;
}

export const MotionDiagramStage2D: React.FC<MotionDiagramStage2DProps> = ({
  focusedNodeIds,
  diagramCode,
  shots,
  overlay,
  stageWidth,
  stageHeight,
  ...cameraProps
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const studioStyle = useStudioStyle();
  const optics = resolveStyleOptics(studioStyle);
  const cameraSpring = getStyleSpringConfig(studioStyle, 'camera');

  const effectiveWidth = stageWidth ?? width;
  const effectiveHeight = stageHeight ?? height;
  const isVertical = effectiveHeight > effectiveWidth;

  const sortedShots = useMemo(
    () =>
      shots && shots.length > 0
        ? [...shots].sort((a, b) => a.fromFrame - b.fromFrame)
        : [],
    [shots]
  );

  const explicitFocusSet = useMemo(
    () => (focusedNodeIds ? new Set(focusedNodeIds) : null),
    [focusedNodeIds]
  );

  const focusCtx = useMemo<MotionDiagramFocusContextValue>(() => {
    const buildOptics = (recessAmount: number): ResolvedNodeFocusOptics => {
      const clamped = Math.max(0, Math.min(1, recessAmount));
      const isRecessed = clamped > 0.35;
      const blurPx = computeCircleOfConfusionPx(
        -0.28 * clamped,
        0,
        optics.aperture
      );
      return {
        isRecessed,
        blurPx,
        filterCss: blurPx === 0 ? 'none' : `blur(${blurPx.toFixed(2)}px)`,
        opacityScale: 1 - 0.32 * clamped,
        scaleFactor: 1 - 0.022 * clamped,
      };
    };

    return {
      resolveNodeFocus(nodeId, explicitState = 'auto') {
        if (explicitState === 'sharp') {
          return buildOptics(0);
        }
        if (explicitState === 'recessed') {
          return buildOptics(1);
        }
        if (!nodeId) {
          return buildOptics(0);
        }
        if (explicitFocusSet) {
          return buildOptics(explicitFocusSet.has(nodeId) ? 0 : 1);
        }
        if (sortedShots.length === 0) {
          return buildOptics(0);
        }

        let focusWeight = getShotTargetSet(sortedShots[0]!).has(nodeId) ? 1 : 0;
        for (let i = 1; i < sortedShots.length; i++) {
          const prevShot = sortedShots[i - 1]!;
          const currShot = sortedShots[i]!;
          if (frame < currShot.fromFrame) {
            break;
          }
          const prevW = getShotTargetSet(prevShot).has(nodeId) ? 1 : 0;
          const currW = getShotTargetSet(currShot).has(nodeId) ? 1 : 0;
          if (currShot.transition === 'cut') {
            focusWeight = currW;
            continue;
          }
          const p = spring({
            frame: frame - currShot.fromFrame,
            fps,
            config:
              currShot.transition === 'whip'
                ? { damping: 200, stiffness: 150, mass: 0.78 }
                : cameraSpring,
          });
          focusWeight += (currW - prevW) * p;
        }

        return buildOptics(1 - focusWeight);
      },
    };
  }, [cameraSpring, explicitFocusSet, fps, frame, optics.aperture, sortedShots]);

  const headerEnter =
    frame < 2
      ? 0
      : spring({
          frame: frame - 2,
          fps,
          config: getStyleSpringConfig(studioStyle, 'enter'),
        });

  const monoFontCss = formatFontFamilyCss(
    studioStyle.typography.monoFont,
    'mono'
  );

  const composedOverlay = (
    <>
      {diagramCode && frame >= 2 ? (
        <div
          data-diagram-stamp="true"
          style={{
            position: 'absolute',
            left: isVertical ? 76 : 64,
            top: isVertical ? 236 : 44,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 12px',
            backgroundColor: `${studioStyle.palette.bgSurface}E6`,
            border: `1px solid ${studioStyle.palette.inkBorder}`,
            borderLeft: `3px solid ${studioStyle.palette.accentPrimary}`,
            fontFamily: monoFontCss,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: studioStyle.palette.textSecondary,
            opacity: headerEnter,
            pointerEvents: 'none',
          }}
        >
          <span style={{ color: studioStyle.palette.accentPrimary }}>┼</span>
          <span>{diagramCode}</span>
        </div>
      ) : null}
      {overlay}
    </>
  );

  return (
    <MotionDiagramFocusContext.Provider value={focusCtx}>
      <DirectorCamera2D
        shots={shots}
        stageWidth={effectiveWidth}
        stageHeight={effectiveHeight}
        overlay={composedOverlay}
        {...cameraProps}
      >
        {children}
      </DirectorCamera2D>
    </MotionDiagramFocusContext.Provider>
  );
};
```

- [ ] **Step 5: Upgrade `NodeBox.tsx`, `SystemNode.tsx`, `DataFlowEdge.tsx`, `CodePayloadToast.tsx`, `ScreenSpotlightOverlay.tsx`, and `motion-diagrams-2d/index.ts`**

Update `packages/kits/src/motion-diagrams-2d/NodeBox.tsx` (preserving standalone `WorldBox` SSR without `useCurrentFrame`, preserving `brutalist-poster` `6px 6px 0px` and `editorial-press` `1.5px solid`, and upgrading `FlowCurve` to tangent-oriented vector couriers with Clean Frame `0`):

```tsx
import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  SPRING_PRESETS,
  STUDIO_THEME,
  THEME,
  computeCircleOfConfusionPx,
  formatFontFamilyCss,
  getCardChromeStyle,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioStyle,
  type TactileElevation,
} from '@make-pictures/core';
import {
  useMotionDiagramFocus,
  type MotionDiagramFocusState,
} from './MotionDiagramStage2D';

export interface NodeBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export const portRight = (n: NodeBox, dy = 0) => ({
  x: n.cx + n.w / 2,
  y: n.cy + dy,
});

export const portLeft = (n: NodeBox, dy = 0) => ({
  x: n.cx - n.w / 2,
  y: n.cy + dy,
});

export const portTop = (n: NodeBox, dx = 0) => ({
  x: n.cx + dx,
  y: n.cy - n.h / 2,
});

export const portBottom = (n: NodeBox, dx = 0) => ({
  x: n.cx + dx,
  y: n.cy + n.h / 2,
});

export interface WorldBoxProps {
  node: NodeBox;
  nodeId?: string;
  focusState?: MotionDiagramFocusState;
  elevation?: TactileElevation;
  scale?: number;
  opacity?: number;
  zIndex?: number;
  variant?: 'card' | 'transparent' | 'dark' | 'light';
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const WorldBox: React.FC<WorldBoxProps> = ({
  node,
  nodeId,
  focusState = 'auto',
  elevation = 'resting',
  scale = 1,
  opacity = 1,
  zIndex = 2,
  variant,
  style,
  children,
}) => {
  const studioStyle = useStudioStyle();
  const focusCtx = useMotionDiagramFocus();
  const optics = resolveStyleOptics(studioStyle);
  const bodyFontCss = formatFontFamilyCss(
    studioStyle.typography.bodyFont,
    'body'
  );

  const resolvedFocus = focusCtx
    ? focusCtx.resolveNodeFocus(nodeId, focusState)
    : focusState === 'recessed'
      ? (() => {
          const b = computeCircleOfConfusionPx(-0.28, 0, optics.aperture);
          return {
            isRecessed: true,
            blurPx: b,
            filterCss: b === 0 ? 'none' : `blur(${b.toFixed(2)}px)`,
            opacityScale: 0.68,
            scaleFactor: 0.98,
          };
        })()
      : {
          isRecessed: false,
          blurPx: 0,
          filterCss: 'none',
          opacityScale: 1,
          scaleFactor: 1,
        };

  let chromeStyle: React.CSSProperties;
  if (variant === 'transparent') {
    chromeStyle = {
      backgroundColor: 'transparent',
      color: studioStyle.palette.textPrimary,
    };
  } else if (variant === 'dark') {
    chromeStyle = {
      backgroundColor: 'rgba(13, 15, 26, 0.90)',
      color: THEME.colors.textPrimary,
      border: '1.5px solid rgba(255, 255, 255, 0.12)',
      borderRadius: 24,
      boxShadow: THEME.shadows.card,
    };
  } else if (variant === 'light') {
    chromeStyle = {
      backgroundColor: STUDIO_THEME.colors.bgSurface,
      color: STUDIO_THEME.colors.text.primary,
      border: `1.5px solid ${STUDIO_THEME.colors.border.subtle}`,
      borderRadius: 24,
      boxShadow: STUDIO_THEME.shadows.cardElevated,
    };
  } else {
    const baseChrome = getCardChromeStyle(studioStyle);
    const tactile = getTactileSurfaceStyle(studioStyle, { elevation });
    chromeStyle =
      studioStyle.surface.cardTreatment === 'brutalist-hard' &&
      elevation === 'resting'
        ? { ...tactile, boxShadow: baseChrome.boxShadow }
        : tactile;
  }

  return (
    <div
      data-focus-state={resolvedFocus.isRecessed ? 'recessed' : 'sharp'}
      style={{
        position: 'absolute',
        left: node.cx - node.w / 2,
        top: node.cy - node.h / 2,
        width: node.w,
        height: node.h,
        boxSizing: 'border-box',
        transformOrigin: 'center center',
        transform: `scale(${Number((scale * resolvedFocus.scaleFactor).toFixed(4))})`,
        opacity: opacity * resolvedFocus.opacityScale,
        filter: resolvedFocus.filterCss,
        zIndex,
        fontFamily: bodyFontCss,
        ...chromeStyle,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export interface FlowCurveProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  curveY?: number;
  curveX?: number;
  orientation?: 'horizontal' | 'vertical';
  color?: string;
  activeFromFrame: number;
  packetSpeedFrames?: number;
  packetCount?: number;
  strokeWidth?: number;
  dashed?: boolean;
  blocked?: boolean;
}

export const FlowCurve: React.FC<FlowCurveProps> = ({
  from,
  to,
  curveY = 0,
  curveX = 0,
  orientation = 'horizontal',
  color,
  activeFromFrame,
  packetSpeedFrames = 100,
  packetCount = 2,
  strokeWidth = 2.6,
  dashed = false,
  blocked = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const studioStyle = useStudioStyle();

  const effectiveStart = Math.max(2, activeFromFrame);
  if (frame <= 0 || frame < effectiveStart) {
    return null;
  }

  const optics = resolveStyleOptics(studioStyle);
  const grammar = optics.typographyGrammar;
  const resolvedColor = color ?? studioStyle.palette.accentPrimary;
  const terminalFill = studioStyle.palette.bgSurface;
  const inkBorder = studioStyle.palette.inkBorder;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const p0 = from;
  const p1 =
    orientation === 'vertical'
      ? { x: from.x + curveX, y: from.y + dy * 0.45 }
      : { x: from.x + dx * 0.4, y: from.y + curveY };
  const p2 =
    orientation === 'vertical'
      ? { x: to.x + curveX, y: to.y - dy * 0.45 }
      : { x: from.x + dx * 0.6, y: to.y + curveY };
  const p3 = to;

  const d = `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;

  const drawProgress = spring({
    frame: frame - effectiveStart,
    fps,
    config: SPRING_PRESETS.smooth,
  });

  if (drawProgress <= 0.01) return null;

  const evalBezier = (t: number) => {
    const u = 1 - t;
    const x =
      u * u * u * p0.x +
      3 * u * u * t * p1.x +
      3 * u * t * t * p2.x +
      t * t * t * p3.x;
    const y =
      u * u * u * p0.y +
      3 * u * u * t * p1.y +
      3 * u * t * t * p2.y +
      t * t * t * p3.y;
    const tx =
      3 * u * u * (p1.x - p0.x) +
      6 * u * t * (p2.x - p1.x) +
      3 * t * t * (p3.x - p2.x);
    const ty =
      3 * u * u * (p1.y - p0.y) +
      6 * u * t * (p2.y - p1.y) +
      3 * t * t * (p3.y - p2.y);
    const deg = (Math.atan2(ty, tx) * 180) / Math.PI;
    return { x, y, deg };
  };

  const packets: Array<{ x: number; y: number; deg: number; alpha: number }> = [];
  if (!blocked && frame >= effectiveStart + 8) {
    for (let i = 0; i < packetCount; i++) {
      const offset = (i / packetCount) * packetSpeedFrames;
      const elapsed = frame - (effectiveStart + 8) - offset;
      if (elapsed < 0) continue;
      const t = (elapsed % packetSpeedFrames) / packetSpeedFrames;
      const alpha = t < 0.1 ? t / 0.1 : t > 0.9 ? (1 - t) / 0.1 : 1;
      const pt = evalBezier(t);
      packets.push({ ...pt, alpha });
    }
  }

  return (
    <svg
      data-flow-grammar={grammar}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 1,
        height: 1,
        overflow: 'visible',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      {/* Guide rail */}
      <path
        d={d}
        fill="none"
        stroke={inkBorder}
        strokeWidth={1.2}
        strokeOpacity={0.38 * drawProgress}
      />
      {/* Active schematic bus */}
      <path
        d={d}
        fill="none"
        stroke={resolvedColor}
        strokeWidth={grammar === 'risograph-poster' ? strokeWidth + 0.8 : strokeWidth}
        strokeOpacity={0.9 * drawProgress}
        strokeDasharray={dashed ? '8 6' : undefined}
        strokeLinecap="butt"
      />
      {/* Polymorphic Port Terminals */}
      {grammar === 'risograph-poster' ? (
        <>
          <rect
            x={from.x - 5}
            y={from.y - 5}
            width={10}
            height={10}
            fill={inkBorder}
            opacity={drawProgress}
          />
          <rect
            x={to.x - 5}
            y={to.y - 5}
            width={10}
            height={10}
            fill={resolvedColor}
            stroke={inkBorder}
            strokeWidth={1.6}
            opacity={drawProgress}
          />
        </>
      ) : grammar === 'optical-gate' ? (
        <>
          <circle
            cx={from.x}
            cy={from.y}
            r={5}
            fill={terminalFill}
            stroke={resolvedColor}
            strokeWidth={1.8}
            opacity={drawProgress}
          />
          <circle
            cx={to.x}
            cy={to.y}
            r={5}
            fill={terminalFill}
            stroke={resolvedColor}
            strokeWidth={1.8}
            opacity={drawProgress}
          />
        </>
      ) : (
        <>
          <rect
            x={from.x - 4.5}
            y={from.y - 4.5}
            width={9}
            height={9}
            fill={terminalFill}
            stroke={resolvedColor}
            strokeWidth={2}
            opacity={drawProgress}
          />
          <circle
            cx={to.x}
            cy={to.y}
            r={4.5}
            fill={terminalFill}
            stroke={resolvedColor}
            strokeWidth={2}
            opacity={drawProgress}
          />
        </>
      )}

      {/* Tangent-Aligned Signal Couriers */}
      {packets.map((pkt, idx) => (
        <g
          key={idx}
          opacity={pkt.alpha * drawProgress}
          transform={`translate(${pkt.x.toFixed(2)}, ${pkt.y.toFixed(2)}) rotate(${pkt.deg.toFixed(2)})`}
        >
          {grammar === 'risograph-poster' ? (
            <polygon
              points="9,0 -7,-6.5 -7,6.5"
              fill={resolvedColor}
              stroke={inkBorder}
              strokeWidth={1.6}
            />
          ) : grammar === 'optical-gate' ? (
            <>
              <rect
                x={-9}
                y={-3.5}
                width={18}
                height={7}
                fill={resolvedColor}
              />
              <rect
                x={-4}
                y={-1.5}
                width={10}
                height={3}
                fill="#FFFFFF"
              />
            </>
          ) : (
            <polygon
              points="8,0 -6,-5.2 -3.2,0 -6,5.2"
              fill={resolvedColor}
            />
          )}
        </g>
      ))}
    </svg>
  );
};
```

Replace `packages/kits/src/motion-diagrams-2d/SystemNode.tsx`:

```tsx
import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  SPRING_PRESETS,
  THEME,
  computeCircleOfConfusionPx,
  formatFontFamilyCss,
  formatHeadingText,
  getCardChromeStyle,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioStyle,
} from '@make-pictures/core';
import {
  useMotionDiagramFocus,
  type MotionDiagramFocusState,
} from './MotionDiagramStage2D';

export interface SystemNodeProps {
  id: string;
  nodeId?: string;
  focusState?: MotionDiagramFocusState;
  moduleCode?: string;
  title: string;
  subtitle: string;
  badge: string;
  statusText: string;
  activeStatusText?: string;
  icon?: LucideIcon;
  x: number;
  y: number;
  width?: number;
  height?: number;
  accentColor?: string;
  variant?: 'dark' | 'light';
  enterFrame?: number;
  activeRanges?: Array<[number, number]>;
  metricsLabel?: string;
  metricsValue?: string;
}

export const SystemNode: React.FC<SystemNodeProps> = ({
  id,
  nodeId,
  focusState = 'auto',
  moduleCode,
  title,
  subtitle,
  badge,
  statusText,
  activeStatusText,
  icon: Icon,
  x,
  y,
  width = 340,
  height = 188,
  accentColor,
  variant,
  enterFrame = 2,
  activeRanges = [],
  metricsLabel,
  metricsValue,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const studioStyle = useStudioStyle();
  const focusCtx = useMotionDiagramFocus();

  const effectiveEnter = Math.max(2, enterFrame);
  if (frame <= 0 || frame < effectiveEnter) {
    return null;
  }

  const optics = resolveStyleOptics(studioStyle);
  const grammar = optics.typographyGrammar;
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

  const enterProgress = spring({
    frame: frame - effectiveEnter,
    fps,
    config: getStyleSpringConfig(studioStyle, 'enter'),
  });

  if (enterProgress <= 0.002) {
    return null;
  }

  let activeStrength = 0;
  for (const [start, end] of activeRanges) {
    if (frame >= start - 8 && frame <= end + 24) {
      const rampIn = spring({
        frame: frame - start,
        fps,
        config: SPRING_PRESETS.smooth,
      });
      const rampOut = interpolate(frame, [end, end + 22], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      activeStrength = Math.max(activeStrength, rampIn * rampOut);
    }
  }

  const isCurrentlyActive = activeStrength > 0.35;
  const focusTargetKey = nodeId ?? id;
  const resolvedFocus = focusCtx
    ? focusCtx.resolveNodeFocus(focusTargetKey, focusState)
    : focusState === 'recessed'
      ? (() => {
          const b = computeCircleOfConfusionPx(-0.28, 0, optics.aperture);
          return {
            isRecessed: true,
            blurPx: b,
            filterCss: b === 0 ? 'none' : `blur(${b.toFixed(2)}px)`,
            opacityScale: 0.68,
            scaleFactor: 0.98,
          };
        })()
      : {
          isRecessed: false,
          blurPx: 0,
          filterCss: 'none',
          opacityScale: 1,
          scaleFactor: 1,
        };

  const scale =
    (interpolate(enterProgress, [0, 1], [0.92, 1]) +
      interpolate(activeStrength, [0, 1], [0, 0.018])) *
    resolvedFocus.scaleFactor;
  const translateY = interpolate(enterProgress, [0, 1], [20, 0]);
  const opacity =
    interpolate(enterProgress, [0, 0.65, 1], [0, 0.92, 1]) *
    resolvedFocus.opacityScale;

  const displayedStatus =
    isCurrentlyActive && activeStatusText ? activeStatusText : statusText;

  const isDark =
    variant === 'dark'
      ? true
      : variant === 'light'
        ? false
        : studioStyle.surface.isDark;

  const elevation = isCurrentlyActive ? 'lifted' : 'resting';
  const tactileChrome =
    variant === 'dark' && !studioStyle.surface.isDark
      ? {
          borderRadius: Math.max(
            0,
            Math.round(8 * studioStyle.surface.radiusScale)
          ),
          backgroundColor: 'rgba(15, 18, 29, 0.96)',
          border: `1.5px solid ${
            isCurrentlyActive ? resolvedAccent : 'rgba(255, 255, 255, 0.16)'
          }`,
          boxShadow: THEME.shadows.card,
        }
      : (() => {
          const base = getCardChromeStyle(studioStyle);
          const tac = getTactileSurfaceStyle(studioStyle, { elevation });
          return {
            ...tac,
            borderColor: isCurrentlyActive
              ? resolvedAccent
              : studioStyle.palette.inkBorder,
            ...(studioStyle.surface.cardTreatment === 'brutalist-hard' &&
            elevation === 'resting'
              ? { boxShadow: base.boxShadow }
              : {}),
          };
        })();

  const textPrimary =
    variant === 'dark' && !studioStyle.surface.isDark
      ? THEME.colors.textPrimary
      : studioStyle.palette.textPrimary;
  const textSecondary =
    variant === 'dark' && !studioStyle.surface.isDark
      ? THEME.colors.textSecondary
      : studioStyle.palette.textSecondary;
  const dividerColor = isDark
    ? 'rgba(255, 255, 255, 0.12)'
    : `${studioStyle.palette.inkBorder}66`;

  const tagRadius = Math.max(
    0,
    Math.round(4 * studioStyle.surface.radiusScale)
  );

  return (
    <div
      data-node-grammar={grammar}
      data-focus-state={resolvedFocus.isRecessed ? 'recessed' : 'sharp'}
      style={{
        position: 'absolute',
        left: x - width / 2,
        top: y - height / 2,
        width,
        height,
        opacity,
        filter: resolvedFocus.filterCss,
        willChange: 'transform, opacity',
        transform: `translate3d(0, ${translateY.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`,
        ...tactileChrome,
        padding: '18px 22px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
        overflow: 'visible',
      }}
    >
      {/* Top Calibrated Header Bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: grammar === 'risograph-poster' ? 6 : 3,
          backgroundColor: isCurrentlyActive
            ? resolvedAccent
            : studioStyle.palette.inkBorder,
        }}
      />

      {/* Physical Left & Right Port Pins */}
      <div
        style={{
          position: 'absolute',
          left: -5,
          top: '50%',
          width: 8,
          height: 8,
          transform: 'translateY(-50%)',
          backgroundColor: studioStyle.palette.bgSurface,
          border: `2px solid ${
            isCurrentlyActive ? resolvedAccent : studioStyle.palette.inkBorder
          }`,
          boxSizing: 'border-box',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: -5,
          top: '50%',
          width: 8,
          height: 8,
          transform: 'translateY(-50%)',
          backgroundColor: isCurrentlyActive
            ? resolvedAccent
            : studioStyle.palette.bgSurface,
          border: `2px solid ${
            isCurrentlyActive ? resolvedAccent : studioStyle.palette.inkBorder
          }`,
          boxSizing: 'border-box',
        }}
      />

      {/* Row 1: Engraved Glyph Medallion + Rectangular Module Stamp */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 2,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: tagRadius,
            border: `1.5px solid ${
              isCurrentlyActive ? resolvedAccent : studioStyle.palette.inkBorder
            }`,
            backgroundColor: studioStyle.palette.bgElevated,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {Icon ? (
            <Icon
              size={18}
              color={isCurrentlyActive ? resolvedAccent : textPrimary}
              strokeWidth={1.8}
            />
          ) : (
            <svg width={20} height={20} viewBox="0 0 20 20">
              <rect
                x={3}
                y={3}
                width={14}
                height={14}
                fill="none"
                stroke={isCurrentlyActive ? resolvedAccent : textPrimary}
                strokeWidth={1.5}
              />
              <line
                x1={3}
                y1={10}
                x2={17}
                y2={10}
                stroke={resolvedAccent}
                strokeWidth={1.5}
              />
              <circle cx={10} cy={10} r={2.2} fill={resolvedAccent} />
            </svg>
          )}
        </div>

        <div
          style={{
            padding: '3px 9px',
            borderRadius: tagRadius,
            backgroundColor:
              grammar === 'risograph-poster' && isCurrentlyActive
                ? resolvedAccent
                : studioStyle.palette.bgElevated,
            border: `1px solid ${
              isCurrentlyActive ? resolvedAccent : studioStyle.palette.inkBorder
            }`,
            fontFamily: monoFontCss,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color:
              grammar === 'risograph-poster' && isCurrentlyActive
                ? '#FFFFFF'
                : isCurrentlyActive
                  ? resolvedAccent
                  : textSecondary,
          }}
        >
          {moduleCode ? `${moduleCode} • ${badge}` : badge}
        </div>
      </div>

      {/* Row 2: Title & Subtitle */}
      <div style={{ marginTop: 4 }}>
        <div
          style={{
            fontFamily: displayFontCss,
            fontSize: 21,
            fontWeight: 700,
            letterSpacing: `${studioStyle.typography.displayTrackingEm}em`,
            color: textPrimary,
            lineHeight: 1.18,
          }}
        >
          {variant === 'dark' ? title : formatHeadingText(title, studioStyle)}
        </div>
        <div
          style={{
            fontFamily: bodyFontCss,
            fontSize: 13.5,
            fontWeight: 400,
            color: textSecondary,
            marginTop: 4,
            lineHeight: 1.35,
          }}
        >
          {subtitle}
        </div>
      </div>

      {/* Row 3: Crisp Calibration Status Bar (zero glowing neon dot) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 9,
          borderTop: `1px solid ${dividerColor}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              backgroundColor: isCurrentlyActive ? resolvedAccent : dividerColor,
              border: `1px solid ${
                isCurrentlyActive ? resolvedAccent : studioStyle.palette.inkBorder
              }`,
              boxSizing: 'border-box',
            }}
          />
          <span
            style={{
              fontFamily: monoFontCss,
              fontSize: 11.5,
              fontWeight: 600,
              color: isCurrentlyActive ? textPrimary : textSecondary,
              letterSpacing: '0.03em',
            }}
          >
            {displayedStatus}
          </span>
        </div>

        {metricsLabel && metricsValue && (
          <div
            style={{
              fontFamily: monoFontCss,
              fontSize: 11,
              fontVariantNumeric: 'tabular-nums',
              color: textSecondary,
            }}
          >
            <span>{metricsLabel}: </span>
            <span
              style={{
                fontWeight: 700,
                color: isCurrentlyActive ? resolvedAccent : textPrimary,
              }}
            >
              {metricsValue}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
```

Replace `packages/kits/src/motion-diagrams-2d/DataFlowEdge.tsx`:

```tsx
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  SPRING_PRESETS,
  formatFontFamilyCss,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioStyle,
} from '@make-pictures/core';

export interface Point2D {
  x: number;
  y: number;
}

export interface DataFlowEdgeProps {
  id: string;
  from: Point2D;
  to: Point2D;
  curveOffsetY?: number;
  color?: string;
  secondaryColor?: string;
  drawStartFrame?: number;
  flowStartFrame?: number;
  flowEndFrame?: number;
  packetCount?: number;
  traverseFrames?: number;
  direction?: 'forward' | 'reverse';
  label?: string;
  subLabel?: string;
  labelT?: number;
  labelOffsetX?: number;
  labelOffsetY?: number;
  zIndex?: number;
}

export function evaluateCubicBezier(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  t: number
): Point2D {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

function evaluateCubicBezierAngleDeg(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  t: number,
  reverse: boolean
): number {
  const u = 1 - t;
  const tx =
    3 * u * u * (p1.x - p0.x) +
    6 * u * t * (p2.x - p1.x) +
    3 * t * t * (p3.x - p2.x);
  const ty =
    3 * u * u * (p1.y - p0.y) +
    6 * u * t * (p2.y - p1.y) +
    3 * t * t * (p3.y - p2.y);
  const sign = reverse ? -1 : 1;
  return (Math.atan2(ty * sign, tx * sign) * 180) / Math.PI;
}

export const DataFlowEdge: React.FC<DataFlowEdgeProps> = ({
  id,
  from,
  to,
  curveOffsetY = -70,
  color,
  secondaryColor,
  drawStartFrame = 2,
  flowStartFrame = 30,
  flowEndFrame = 600,
  packetCount = 2,
  traverseFrames = 96,
  direction = 'forward',
  label,
  subLabel,
  labelT = 0.5,
  labelOffsetX = 0,
  labelOffsetY = -28,
  zIndex,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const studioStyle = useStudioStyle();

  const effectiveDrawStart = Math.max(2, drawStartFrame);
  if (frame <= 0 || frame < effectiveDrawStart) {
    return null;
  }

  const optics = resolveStyleOptics(studioStyle);
  const grammar = optics.typographyGrammar;
  const resolvedColor = color ?? studioStyle.palette.accentPrimary;
  const endColor =
    secondaryColor ??
    (color === undefined ? studioStyle.palette.accentSecondary : resolvedColor);
  const monoFontCss = formatFontFamilyCss(
    studioStyle.typography.monoFont,
    'mono'
  );
  const isDark = studioStyle.surface.isDark;

  const dx = to.x - from.x;
  const p0 = from;
  const p1: Point2D = {
    x: from.x + dx * 0.36,
    y: from.y + curveOffsetY,
  };
  const p2: Point2D = {
    x: from.x + dx * 0.64,
    y: to.y + curveOffsetY,
  };
  const p3 = to;

  const pathData = `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;

  const drawProgress = spring({
    frame: frame - effectiveDrawStart,
    fps,
    config: SPRING_PRESETS.smooth,
  });

  if (drawProgress <= 0.005) {
    return null;
  }

  const isFlowActive = frame >= flowStartFrame && frame <= flowEndFrame;
  const flowFadeIn = interpolate(
    frame,
    [flowStartFrame, flowStartFrame + 16],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const flowFadeOut = interpolate(
    frame,
    [flowEndFrame - 18, flowEndFrame],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const flowAlpha = isFlowActive ? flowFadeIn * flowFadeOut : 0;

  const clampedLabelT = Math.max(0, Math.min(1, labelT));
  const labelAnchor = evaluateCubicBezier(p0, p1, p2, p3, clampedLabelT);

  const pathLengthEstimate = 1600;
  const dashOffset = interpolate(
    drawProgress,
    [0, 1],
    [pathLengthEstimate, 0]
  );

  const gradId = `edge-grad-${id}`;

  const packets: Array<{ head: Point2D; deg: number; opacity: number }> = [];
  if (flowAlpha > 0.01) {
    for (let i = 0; i < packetCount; i++) {
      const staggerFrames = Math.round((i / packetCount) * traverseFrames);
      const localElapsed = frame - flowStartFrame - staggerFrames;
      if (localElapsed < 0) continue;

      const rawProgress = (localElapsed % traverseFrames) / traverseFrames;
      const t = direction === 'forward' ? rawProgress : 1 - rawProgress;

      const edgeFade =
        interpolate(t, [0, 0.08, 0.92, 1], [0, 1, 1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }) * flowAlpha;

      const head = evaluateCubicBezier(p0, p1, p2, p3, t);
      const deg = evaluateCubicBezierAngleDeg(
        p0,
        p1,
        p2,
        p3,
        t,
        direction === 'reverse'
      );
      packets.push({ head, deg, opacity: edgeFade });
    }
  }

  const plateStyle = getTactileSurfaceStyle(studioStyle, {
    elevation: 'resting',
    overrides: {
      borderRadius: Math.max(0, Math.round(4 * studioStyle.surface.radiusScale)),
      borderColor:
        flowAlpha > 0.2 ? resolvedColor : studioStyle.palette.inkBorder,
      padding: '4px 10px',
    },
  });

  return (
    <div
      data-edge-grammar={grammar}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        ...(zIndex !== undefined ? { zIndex } : {}),
      }}
    >
      <svg
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 1,
          height: 1,
          overflow: 'visible',
        }}
      >
        <defs>
          <linearGradient
            id={gradId}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={resolvedColor} />
            <stop offset="100%" stopColor={endColor} />
          </linearGradient>
        </defs>

        <path
          d={pathData}
          fill="none"
          stroke={isDark ? 'rgba(255, 255, 255, 0.16)' : studioStyle.palette.inkBorder}
          strokeOpacity={isDark ? 1 : 0.45}
          strokeWidth={1.6}
          strokeDasharray={pathLengthEstimate}
          strokeDashoffset={dashOffset}
        />

        <path
          d={pathData}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={1.8}
          strokeDasharray="6 8"
          strokeOpacity={0.32 * drawProgress + 0.38 * flowAlpha}
        />

        {flowAlpha > 0.01 && (
          <path
            d={pathData}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={grammar === 'risograph-poster' ? 3.2 : 2.4}
            strokeOpacity={0.78 * flowAlpha}
          />
        )}

        <rect
          x={from.x - 4}
          y={from.y - 4}
          width={8}
          height={8}
          fill={studioStyle.palette.bgSurface}
          stroke={resolvedColor}
          strokeWidth={1.8}
          opacity={drawProgress}
        />
        <circle
          cx={to.x}
          cy={to.y}
          r={4.2}
          fill={studioStyle.palette.bgSurface}
          stroke={endColor}
          strokeWidth={1.8}
          opacity={drawProgress}
        />

        {packets.map((pkt, idx) => (
          <g
            key={`pkt-${idx}`}
            opacity={pkt.opacity}
            transform={`translate(${pkt.head.x.toFixed(2)}, ${pkt.head.y.toFixed(2)}) rotate(${pkt.deg.toFixed(2)})`}
          >
            {grammar === 'risograph-poster' ? (
              <polygon
                points="9,0 -7,-6.5 -7,6.5"
                fill={resolvedColor}
                stroke={studioStyle.palette.inkBorder}
                strokeWidth={1.5}
              />
            ) : grammar === 'optical-gate' ? (
              <>
                <rect x={-9} y={-3.2} width={18} height={6.4} fill={resolvedColor} />
                <rect x={-4} y={-1.2} width={10} height={2.4} fill="#FFFFFF" />
              </>
            ) : (
              <polygon points="8,0 -6,-5 -3.2,0 -6,5" fill={resolvedColor} />
            )}
          </g>
        ))}
      </svg>

      {label && drawProgress > 0.4 && (
        <div
          style={{
            position: 'absolute',
            left: labelAnchor.x + labelOffsetX,
            top: labelAnchor.y + labelOffsetY,
            transform: `translate3d(-50%, -50%, 0) scale(${interpolate(
              drawProgress,
              [0.4, 1],
              [0.9, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            ).toFixed(3)})`,
            opacity: interpolate(drawProgress, [0.4, 0.9], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            ...plateStyle,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            whiteSpace: 'nowrap',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              backgroundColor: resolvedColor,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: monoFontCss,
              fontSize: 11,
              fontWeight: 700,
              color: studioStyle.palette.textPrimary,
              letterSpacing: '0.04em',
            }}
          >
            {label}
          </span>
          {subLabel && (
            <span
              style={{
                fontFamily: monoFontCss,
                fontSize: 10.5,
                color: studioStyle.palette.textSecondary,
              }}
            >
              • {subLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
```

Replace `packages/kits/src/motion-diagrams-2d/CodePayloadToast.tsx`:

```tsx
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  formatFontFamilyCss,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  useStudioStyle,
  type StylePreset,
} from '@make-pictures/core';

export interface CodePayloadToastProps {
  x: number;
  y: number;
  width?: number;
  methodBadge: string;
  endpoint: string;
  latencyText?: string;
  code: string;
  accentColor?: string;
  startFrame: number;
  endFrame: number;
}

export interface PayloadTokenColors {
  keyColor: string;
  stringColor: string;
  numberColor: string;
  keywordColor: string;
  punctColor: string;
}

export function resolvePayloadTokenColors(
  style: StylePreset,
  explicitAccent?: string
): PayloadTokenColors {
  return {
    keyColor: explicitAccent ?? style.palette.accentPrimary,
    stringColor: style.palette.accentSecondary,
    numberColor: style.palette.textPrimary,
    keywordColor: explicitAccent ?? style.palette.accentPrimary,
    punctColor: style.palette.textSecondary,
  };
}

function renderHighlightedLine(
  line: string,
  tokens: PayloadTokenColors,
  textPrimary: string
): React.ReactNode {
  const jsonKeyMatch = line.match(/^(\s*)("[^"]+")(\s*:\s*)(.*)$/);
  if (jsonKeyMatch) {
    const [, indent, keyPart, colonPart, valuePart] = jsonKeyMatch;
    return (
      <>
        <span>{indent}</span>
        <span style={{ color: tokens.keyColor, fontWeight: 600 }}>{keyPart}</span>
        <span style={{ color: tokens.punctColor }}>{colonPart}</span>
        {renderJsonValue(valuePart, tokens, textPrimary)}
      </>
    );
  }

  const sqlKeywords =
    /\b(INSERT|INTO|VALUES|SELECT|FROM|WHERE|RETURNING|await|const|return)\b/g;
  if (sqlKeywords.test(line)) {
    const parts = line.split(
      /(\b(?:INSERT|INTO|VALUES|SELECT|FROM|WHERE|RETURNING|await|const|return)\b)/g
    );
    return parts.map((tok, idx) =>
      /^(INSERT|INTO|VALUES|SELECT|FROM|WHERE|RETURNING|await|const|return)$/.test(
        tok
      ) ? (
        <span key={idx} style={{ color: tokens.keywordColor, fontWeight: 700 }}>
          {tok}
        </span>
      ) : (
        <span key={idx} style={{ color: textPrimary }}>
          {tok}
        </span>
      )
    );
  }

  return <span style={{ color: tokens.punctColor }}>{line}</span>;
}

function renderJsonValue(
  raw: string,
  tokens: PayloadTokenColors,
  textPrimary: string
): React.ReactNode {
  const trailingComma = raw.endsWith(',') ? ',' : '';
  const clean = raw.endsWith(',') ? raw.slice(0, -1) : raw;

  if (/^".*"$/.test(clean)) {
    return (
      <>
        <span style={{ color: tokens.stringColor }}>{clean}</span>
        <span style={{ color: tokens.punctColor }}>{trailingComma}</span>
      </>
    );
  }
  if (/^(true|false|null)$/.test(clean)) {
    return (
      <>
        <span style={{ color: tokens.keywordColor, fontWeight: 700 }}>
          {clean}
        </span>
        <span style={{ color: tokens.punctColor }}>{trailingComma}</span>
      </>
    );
  }
  if (/^-?\d+(\.\d+)?$/.test(clean)) {
    return (
      <>
        <span
          style={{
            color: tokens.numberColor,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {clean}
        </span>
        <span style={{ color: tokens.punctColor }}>{trailingComma}</span>
      </>
    );
  }

  return <span style={{ color: textPrimary }}>{raw}</span>;
}

export const CodePayloadToast: React.FC<CodePayloadToastProps> = ({
  x,
  y,
  width = 410,
  methodBadge,
  endpoint,
  latencyText = '18ms',
  code,
  accentColor,
  startFrame,
  endFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const studioStyle = useStudioStyle();

  const effectiveStart = Math.max(2, startFrame);
  if (frame <= 0 || frame < effectiveStart || frame > endFrame + 24) {
    return null;
  }

  const resolvedAccent = accentColor ?? studioStyle.palette.accentPrimary;
  const tokens = resolvePayloadTokenColors(studioStyle, resolvedAccent);
  const monoFontCss = formatFontFamilyCss(
    studioStyle.typography.monoFont,
    'mono'
  );

  const enterProgress = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(studioStyle, 'enter'),
  });

  const exitProgress = interpolate(frame, [endFrame, endFrame + 18], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const combined = enterProgress * exitProgress;
  if (combined <= 0.002) {
    return null;
  }

  const translateY = interpolate(enterProgress, [0, 1], [16, 0]);
  const scale = interpolate(combined, [0, 1], [0.94, 1]);
  const lines = code.trim().split('\n');

  const plateChrome = getTactileSurfaceStyle(studioStyle, {
    elevation: 'floating',
    overrides: {
      borderRadius: Math.max(0, Math.round(8 * studioStyle.surface.radiusScale)),
    },
  });

  return (
    <div
      data-payload-plate="true"
      style={{
        position: 'absolute',
        left: x - width / 2,
        top: y,
        width,
        opacity: combined,
        willChange: 'transform, opacity',
        transform: `translate3d(0, ${translateY.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`,
        ...plateChrome,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          backgroundColor: studioStyle.palette.bgElevated,
          borderBottom: `1px solid ${studioStyle.palette.inkBorder}`,
          borderLeft: `3px solid ${resolvedAccent}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              padding: '2px 7px',
              borderRadius: Math.max(
                0,
                Math.round(3 * studioStyle.surface.radiusScale)
              ),
              backgroundColor: studioStyle.palette.bgSurface,
              border: `1px solid ${resolvedAccent}`,
              fontFamily: monoFontCss,
              fontSize: 10,
              fontWeight: 700,
              color: resolvedAccent,
              letterSpacing: '0.05em',
            }}
          >
            {methodBadge}
          </span>
          <span
            style={{
              fontFamily: monoFontCss,
              fontSize: 11.5,
              fontWeight: 600,
              color: studioStyle.palette.textPrimary,
            }}
          >
            {endpoint}
          </span>
        </div>

        <span
          style={{
            fontFamily: monoFontCss,
            fontSize: 10.5,
            fontVariantNumeric: 'tabular-nums',
            color: studioStyle.palette.textSecondary,
          }}
        >
          {latencyText}
        </span>
      </div>

      <div
        style={{
          padding: '11px 16px',
          fontFamily: monoFontCss,
          fontSize: 12,
          lineHeight: 1.55,
          whiteSpace: 'pre',
        }}
      >
        {lines.map((line, idx) => {
          const lineOpacity = interpolate(
            frame - effectiveStart,
            [idx * 2, idx * 2 + 10],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );

          return (
            <div
              key={idx}
              style={{
                opacity: lineOpacity,
                display: 'flex',
              }}
            >
              <span
                style={{
                  width: 24,
                  color: studioStyle.palette.textSecondary,
                  opacity: 0.55,
                  userSelect: 'none',
                  fontSize: 10.5,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {String(idx + 1).padStart(2, '0')}
              </span>
              <span>
                {renderHighlightedLine(
                  line,
                  tokens,
                  studioStyle.palette.textPrimary
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

Update `packages/kits/src/product-frames/ScreenSpotlightOverlay.tsx` (lines 71–85 and 144–166) so `frame <= 0` returns `null` and the callout tag uses `Math.max(0, Math.round(6 * studioStyle.surface.radiusScale))` + `1px solid ${studioStyle.palette.inkBorder}` instead of `borderRadius: 9999`:

```tsx
  if (frame <= 0) {
    return null;
  }
  const effectiveStart = Math.max(2, startFrame);
```

and replace the `label` `<div>` style in `packages/kits/src/product-frames/ScreenSpotlightOverlay.tsx`:

```tsx
        {label && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              ...(placeTop
                ? { bottom: '100%', marginBottom: 12 }
                : { top: '100%', marginTop: 12 }),
              transform: `translateX(-50%) translateY(${interpolate(labelPop, [0, 1], [placeTop ? 8 : -8, 0]).toFixed(2)}px) scale(${interpolate(labelPop, [0, 1], [0.85, 1]).toFixed(3)})`,
              opacity: labelPop * visibility,
              padding: '6px 14px',
              borderRadius: Math.max(
                0,
                Math.round(6 * studioStyle.surface.radiusScale)
              ),
              backgroundColor: resolvedAccent,
              border: `1px solid ${studioStyle.palette.inkBorder}`,
              color: '#FFFFFF',
              fontFamily: bodyFontCss,
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              boxShadow: '0 8px 22px rgba(15, 23, 42, 0.24)',
            }}
          >
            {label}
          </div>
        )}
```

Update `packages/kits/src/motion-diagrams-2d/index.ts`:

```ts
export * from './CameraRig';
export * from './MotionDiagramStage2D';
export * from './NodeBox';
export * from './SystemNode';
export * from './DataFlowEdge';
export * from './CodePayloadToast';
```

- [ ] **Step 6: Run tests and typecheck to verify Task 1 passes**

Run: `npx tsx --test packages/cli/tests/wave3-motion-diagrams.test.ts packages/cli/tests/kits-style-integration.test.ts packages/cli/tests/demo-precision-layout.test.ts packages/cli/tests/optical-stage.test.ts && npm run typecheck`
Expected: PASS (`0` errors, all tests green).

- [ ] **Step 7: Commit Task 1**

```bash
git add packages/core/src/camera/DirectorCamera2D.tsx packages/kits/src/motion-diagrams-2d/ packages/kits/src/product-frames/ScreenSpotlightOverlay.tsx packages/cli/tests/wave3-motion-diagrams.test.ts
git commit -m "feat(core,kits): rebuild motion-diagrams-2d and DirectorCamera2D with optical rack focus and schematic couplers"
```

---

### Task 2: Rebuild `@make-pictures/kits/isometric-3d` (`isometricMaterials.ts`, `IsometricStage3D`, `Stylized3DCharacter`)

**Files:**
- Create: `packages/kits/src/isometric-3d/isometricMaterials.ts`
- Modify: `packages/kits/src/isometric-3d/IsometricStage3D.tsx`
- Modify: `packages/kits/src/isometric-3d/Stylized3DCharacter.tsx`
- Modify: `packages/kits/src/isometric-3d/index.ts`
- Create (Test): `packages/cli/tests/wave3-isometric-3d.test.ts`

**Interfaces:**
- Consumes from `@make-pictures/core`: `resolveStyleOptics`, `useStudioStyle`, `type StylePreset`.
- Consumes from `../vfx/StagePostProcessing3D`: `ContactShadowDisc3D`, `StagePostProcessing3D`.
- Produces in `@make-pictures/kits/isometric-3d` (and `@make-pictures/kits`):
  - `resolveIsometricMaterialPreset(style, override?): IsometricMaterialPreset`
  - `resolveIsometricMaterialTokens(style, override?): IsometricMaterialTokens`
  - `computeIsometricLightRig(style): IsometricLightRigSpec`
  - `IsometricStage3D: React.FC<IsometricStage3DProps>` (adds `atmosphericBeams?: boolean`, `seed?: number`, Clean Frame `0`, two-tier calibrated plinth + directional light rig)
  - `Stylized3DCharacter: React.FC<Stylized3DCharacterProps>` (adds `materialPreset?: IsometricMaterialPreset`, Clean Frame `0`, `ContactShadowDisc3D`, polymorphic head/visor & materials)

- [ ] **Step 1: Write the failing test file `packages/cli/tests/wave3-isometric-3d.test.ts`**

Create `packages/cli/tests/wave3-isometric-3d.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILT_IN_STYLE_IDS, BUILT_IN_STYLES } from '../../core/src/index';
import * as kitsRoot from '../../kits/src/index';
import {
  IsometricStage3D,
  IsometricStudioEnvironment,
  Stylized3DCharacter,
  computeIsometricLightRig,
  resolveIsometricMaterialPreset,
  resolveIsometricMaterialTokens,
} from '../../kits/src/isometric-3d';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('resolveIsometricMaterialPreset, resolveIsometricMaterialTokens, and computeIsometricLightRig map all 7 styles deterministically without WebGL', () => {
  assert.equal(typeof IsometricStage3D, 'function');
  assert.equal(typeof Stylized3DCharacter, 'function');
  assert.equal(typeof IsometricStudioEnvironment, 'function');
  assert.equal(kitsRoot.resolveIsometricMaterialPreset, resolveIsometricMaterialPreset);
  assert.equal(kitsRoot.resolveIsometricMaterialTokens, resolveIsometricMaterialTokens);
  assert.equal(kitsRoot.computeIsometricLightRig, computeIsometricLightRig);

  assert.equal(
    resolveIsometricMaterialPreset(BUILT_IN_STYLES['editorial-press']),
    'ceramic-maquette'
  );
  assert.equal(
    resolveIsometricMaterialPreset(BUILT_IN_STYLES['minimal-product']),
    'ceramic-maquette'
  );
  assert.equal(
    resolveIsometricMaterialPreset(BUILT_IN_STYLES['archival-chronicle']),
    'ceramic-maquette'
  );
  assert.equal(
    resolveIsometricMaterialPreset(BUILT_IN_STYLES['cyber-telemetry']),
    'anodized-telemetry'
  );
  assert.equal(
    resolveIsometricMaterialPreset(BUILT_IN_STYLES['brutalist-poster']),
    'ink-figurine'
  );
  assert.equal(
    resolveIsometricMaterialPreset(BUILT_IN_STYLES['sketch-notebook']),
    'ink-figurine'
  );
  assert.equal(
    resolveIsometricMaterialPreset(BUILT_IN_STYLES['tactile-craft']),
    'ink-figurine'
  );

  // Explicit override takes precedence
  assert.equal(
    resolveIsometricMaterialPreset(
      BUILT_IN_STYLES['editorial-press'],
      'anodized-telemetry'
    ),
    'anodized-telemetry'
  );

  const ceramic = resolveIsometricMaterialTokens(BUILT_IN_STYLES['editorial-press']);
  assert.equal(ceramic.visorStyle, 'sculpted-band');
  assert.ok(ceramic.roughness >= 0.7 && ceramic.metalness <= 0.08);

  const telemetry = resolveIsometricMaterialTokens(BUILT_IN_STYLES['cyber-telemetry']);
  assert.equal(telemetry.visorStyle, 'slit-visor');
  assert.ok(telemetry.metalness >= 0.25);

  const ink = resolveIsometricMaterialTokens(BUILT_IN_STYLES['brutalist-poster']);
  assert.equal(ink.visorStyle, 'ink-mask');
  assert.ok(ink.roughness >= 0.88);

  for (const styleId of BUILT_IN_STYLE_IDS) {
    const style = BUILT_IN_STYLES[styleId];
    const rig = computeIsometricLightRig(style);
    assert.equal(rig.keyPosition.length, 3);
    assert.equal(rig.rimPosition.length, 3);
    // Key and rim light azimuths oppose each other across X
    if (Math.abs(style.optics!.lightAngleDeg) > 1) {
      assert.ok(
        Math.sign(rig.keyPosition[0]) === -Math.sign(rig.rimPosition[0]),
        `Expected opposing key/rim X signs for ${styleId}`
      );
    }
  }

  // Flipping lightAngleDeg from -32 to +32 flips keyPosition X sign
  const leftRig = computeIsometricLightRig({
    ...BUILT_IN_STYLES['editorial-press'],
    optics: { ...BUILT_IN_STYLES['editorial-press'].optics!, lightAngleDeg: -32 },
  });
  const rightRig = computeIsometricLightRig({
    ...BUILT_IN_STYLES['editorial-press'],
    optics: { ...BUILT_IN_STYLES['editorial-press'].optics!, lightAngleDeg: 32 },
  });
  assert.ok(leftRig.keyPosition[0] < 0);
  assert.ok(rightRig.keyPosition[0] > 0);
  assert.equal(leftRig.enableBeamsByDefault, true);

  const studioMacroRig = computeIsometricLightRig(BUILT_IN_STYLES['minimal-product']);
  assert.equal(studioMacroRig.enableBeamsByDefault, false);
});

test('IsometricStage3D, Stylized3DCharacter, and isometricMaterials obey Clean Frame 0, ContactShadowDisc3D, and zero plastic hexes or three leaks', () => {
  const matSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/isometric-3d/isometricMaterials.ts'),
    'utf8'
  );
  const stageSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/isometric-3d/IsometricStage3D.tsx'),
    'utf8'
  );
  const charSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/isometric-3d/Stylized3DCharacter.tsx'),
    'utf8'
  );

  // Pure resolver module must not import three or R3F
  assert.doesNotMatch(matSrc, /from\s+['"]three['"]|@react-three\/fiber/);

  for (const [name, src] of [
    ['isometricMaterials.ts', matSrc],
    ['IsometricStage3D.tsx', stageSrc],
    ['Stylized3DCharacter.tsx', charSrc],
  ] as const) {
    assert.doesNotMatch(src, /Math\.random\s*\(/, `${name} must not use Math.random`);
    assert.doesNotMatch(src, /useRef\b/, `${name} must not use mutable useRef`);
  }

  // Clean Frame 0 guards
  assert.match(stageSrc, /frame\s*<=\s*0/);
  assert.match(charSrc, /frame\s*<=\s*0/);
  assert.match(charSrc, /Math\.max\(2,\s*enterFrame\)/);

  // Stage uses computeIsometricLightRig and StagePostProcessing3D
  assert.match(stageSrc, /computeIsometricLightRig/);
  assert.match(stageSrc, /StagePostProcessing3D/);

  // Character uses useStudioStyle, resolveIsometricMaterialTokens, and ContactShadowDisc3D; zero hardcoded toy-robot plastic hexes
  assert.match(charSrc, /useStudioStyle/);
  assert.match(charSrc, /resolveIsometricMaterialTokens/);
  assert.match(charSrc, /ContactShadowDisc3D/);
  assert.doesNotMatch(charSrc, /#1E293B|#334155|#090D16|#F8FAFC|#E2E8F0/i);
  assert.doesNotMatch(charSrc, /color="#FFFFFF"/i);

  // Verify all sin/cos frame frequencies in Stylized3DCharacter stay strictly within [0.03, 0.055]
  const freqMatches = [...charSrc.matchAll(/frame\s*\*\s*(0\.\d+)/g)].map((m) =>
    Number(m[1])
  );
  assert.ok(freqMatches.length >= 4);
  for (const freq of freqMatches) {
    assert.ok(
      freq >= 0.03 && freq <= 0.055,
      `Expected character frequency ${freq} to stay in [0.03, 0.055]`
    );
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test packages/cli/tests/wave3-isometric-3d.test.ts`
Expected: FAIL (`resolveIsometricMaterialPreset`, `resolveIsometricMaterialTokens`, and `computeIsometricLightRig` do not exist yet).

- [ ] **Step 3: Create `packages/kits/src/isometric-3d/isometricMaterials.ts`**

Create `packages/kits/src/isometric-3d/isometricMaterials.ts`:

```ts
import { resolveStyleOptics, type StylePreset } from '@make-pictures/core';

export type IsometricMaterialPreset =
  | 'ceramic-maquette'
  | 'anodized-telemetry'
  | 'ink-figurine';

export interface IsometricMaterialTokens {
  preset: IsometricMaterialPreset;
  headColor: string;
  torsoColorFallback: string;
  limbColor: string;
  jointColor: string;
  shoeColor: string;
  visorColor: string;
  collarColor: string;
  eyeHighlightColor: string;
  roughness: number;
  metalness: number;
  limbRoughness: number;
  limbMetalness: number;
  visorStyle: 'sculpted-band' | 'slit-visor' | 'ink-mask';
  outlineRingOpacity: number;
}

export interface IsometricLightRigSpec {
  ambientIntensity: number;
  keyPosition: [number, number, number];
  keyIntensity: number;
  keyColor: string;
  rimPosition: [number, number, number];
  rimIntensity: number;
  rimColor: string;
  fillPosition: [number, number, number];
  fillIntensity: number;
  contactShadowOpacity: number;
  contactShadowColor: string;
  enableBeamsByDefault: boolean;
  beamOrigin: [number, number, number];
  beamColor: string;
  beamOpacity: number;
}

export function resolveIsometricMaterialPreset(
  style: StylePreset,
  override?: IsometricMaterialPreset
): IsometricMaterialPreset {
  if (override) {
    return override;
  }
  if (
    style.surface.cardTreatment === 'brutalist-hard' ||
    style.id === 'sketch-notebook' ||
    style.id === 'tactile-craft'
  ) {
    return 'ink-figurine';
  }
  const optics = resolveStyleOptics(style);
  if (style.surface.isDark || optics.lightingRig === 'darkroom-halation') {
    return 'anodized-telemetry';
  }
  return 'ceramic-maquette';
}

export function resolveIsometricMaterialTokens(
  style: StylePreset,
  override?: IsometricMaterialPreset
): IsometricMaterialTokens {
  const preset = resolveIsometricMaterialPreset(style, override);
  const { palette } = style;

  if (preset === 'anodized-telemetry') {
    return {
      preset,
      headColor: palette.bgElevated,
      torsoColorFallback: palette.accentPrimary,
      limbColor: palette.bgSurface,
      jointColor: palette.inkBorder,
      shoeColor: palette.bgElevated,
      visorColor: palette.bgCanvas,
      collarColor: palette.accentSecondary,
      eyeHighlightColor: palette.textPrimary,
      roughness: 0.34,
      metalness: 0.32,
      limbRoughness: 0.38,
      limbMetalness: 0.28,
      visorStyle: 'slit-visor',
      outlineRingOpacity: 0.58,
    };
  }

  if (preset === 'ink-figurine') {
    return {
      preset,
      headColor: palette.bgSurface,
      torsoColorFallback: palette.accentPrimary,
      limbColor: palette.textPrimary,
      jointColor: palette.inkBorder,
      shoeColor: palette.textPrimary,
      visorColor: palette.textPrimary,
      collarColor: palette.inkBorder,
      eyeHighlightColor: palette.bgSurface,
      roughness: 0.92,
      metalness: 0.02,
      limbRoughness: 0.94,
      limbMetalness: 0.02,
      visorStyle: 'ink-mask',
      outlineRingOpacity: 0.85,
    };
  }

  // 'ceramic-maquette'
  return {
    preset,
    headColor: palette.bgElevated,
    torsoColorFallback: palette.accentPrimary,
    limbColor: palette.textSecondary,
    jointColor: palette.inkBorder,
    shoeColor: palette.textPrimary,
    visorColor: palette.inkBorder,
    collarColor: palette.bgSurface,
    eyeHighlightColor: palette.bgSurface,
    roughness: 0.78,
    metalness: 0.04,
    limbRoughness: 0.82,
    limbMetalness: 0.04,
    visorStyle: 'sculpted-band',
    outlineRingOpacity: 0.48,
  };
}

export function computeIsometricLightRig(
  style: StylePreset
): IsometricLightRigSpec {
  const optics = resolveStyleOptics(style);
  const { palette, surface } = style;
  const rad = (optics.lightAngleDeg * Math.PI) / 180;

  const keyX = Number((Math.sin(rad) * 9.2).toFixed(3));
  const keyZ = Number((Math.cos(rad) * 8.4).toFixed(3));
  const rimX = Number((-Math.sin(rad) * 6.8).toFixed(3));
  const rimZ = Number((-Math.cos(rad) * 6.2).toFixed(3));

  const isWindow = optics.lightingRig === 'window-gobo';
  const isDarkroom = optics.lightingRig === 'darkroom-halation';

  const keyColor = isWindow
    ? '#FFF7ED'
    : isDarkroom
      ? '#E0F2FE'
      : '#FFFFFF';

  const beamColor = isWindow
    ? '#FFF7ED'
    : isDarkroom
      ? palette.accentPrimary
      : palette.bgElevated;

  return {
    ambientIntensity: surface.isDark ? 0.52 : 0.78,
    keyPosition: [keyX, 11.4, keyZ],
    keyIntensity: surface.isDark ? 1.38 : 1.16,
    keyColor,
    rimPosition: [rimX, 5.2, rimZ],
    rimIntensity: surface.isDark ? 0.86 : 0.48,
    rimColor: palette.accentSecondary,
    fillPosition: [-keyX * 0.45, 6.4, keyZ * 0.55],
    fillIntensity: surface.isDark ? 0.28 : 0.36,
    contactShadowOpacity: surface.isDark ? 0.44 : 0.28,
    contactShadowColor: surface.isDark ? '#020617' : palette.textPrimary,
    enableBeamsByDefault: isWindow || isDarkroom,
    beamOrigin: [
      Number((Math.sin(rad) * 4.6).toFixed(3)),
      8.4,
      Number((Math.cos(rad) * 3.2).toFixed(3)),
    ],
    beamColor,
    beamOpacity: isDarkroom
      ? Math.min(0.11, 0.045 + optics.halation * 0.065)
      : 0.055,
  };
}
```

- [ ] **Step 4: Upgrade `IsometricStage3D.tsx`, `Stylized3DCharacter.tsx`, and `isometric-3d/index.ts`**

Replace `packages/kits/src/isometric-3d/IsometricStage3D.tsx`:

```tsx
import React, { useMemo } from 'react';
import { useCurrentFrame } from 'remotion';
import { useStudioStyle } from '@make-pictures/core';
import { StagePostProcessing3D } from '../vfx/StagePostProcessing3D';
import { computeIsometricLightRig } from './isometricMaterials';

export interface IsometricStage3DProps {
  radius?: number;
  showGrid?: boolean;
  accentColor?: string;
  surfaceColor?: string;
  /** Render atmospheric volumetric light cones on window-gobo / darkroom-halation rigs */
  atmosphericBeams?: boolean;
  seed?: number;
  children?: React.ReactNode;
}

export const IsometricStage3D: React.FC<IsometricStage3DProps> = ({
  radius = 5.4,
  showGrid = true,
  accentColor,
  surfaceColor,
  atmosphericBeams,
  seed = 303,
  children,
}) => {
  const frame = useCurrentFrame();
  const style = useStudioStyle();

  const degreeTicks = useMemo(
    () =>
      Array.from({ length: 24 }, (_, idx) => {
        const angle = (idx / 24) * Math.PI * 2;
        const isCardinal = idx % 6 === 0;
        const tickLen = isCardinal ? radius * 0.075 : radius * 0.04;
        const rMid = radius * 0.91 - tickLen * 0.5;
        return {
          idx,
          x: Math.cos(angle) * rMid,
          z: Math.sin(angle) * rMid,
          rotY: -angle,
          len: tickLen,
          width: isCardinal ? 0.045 : 0.022,
          isCardinal,
        };
      }),
    [radius]
  );

  // Clean Frame 0 invariant
  if (frame <= 0) {
    return null;
  }

  const resolvedSurface = surfaceColor ?? style.palette.bgSurface;
  const resolvedAccent = accentColor ?? style.palette.accentPrimary;
  const lightRig = computeIsometricLightRig(style);
  const showBeams = atmosphericBeams ?? lightRig.enableBeamsByDefault;

  return (
    <group name="isometric-stage-3d">
      <ambientLight intensity={lightRig.ambientIntensity} />
      <directionalLight
        position={lightRig.keyPosition}
        intensity={lightRig.keyIntensity}
        color={lightRig.keyColor}
        castShadow
      />
      <pointLight
        position={lightRig.rimPosition}
        intensity={lightRig.rimIntensity}
        color={lightRig.rimColor}
      />
      <pointLight
        position={lightRig.fillPosition}
        intensity={lightRig.fillIntensity}
        color={style.palette.bgElevated}
      />

      {showBeams ? (
        <StagePostProcessing3D
          fogDensity={0}
          spotlightBeams={2}
          beamOrigin={lightRig.beamOrigin}
          beamColor={lightRig.beamColor}
          beamOpacity={lightRig.beamOpacity}
          depthHaze={false}
          seed={seed}
        />
      ) : null}

      {/* Lower Architectural Plinth Tier */}
      <mesh position={[0, -0.24, 0]} receiveShadow>
        <cylinderGeometry args={[radius * 1.05, radius * 1.09, 0.28, 64]} />
        <meshStandardMaterial
          color={style.palette.bgElevated}
          roughness={0.86}
          metalness={0.04}
        />
      </mesh>

      {/* Upper Calibrated Turntable Deck */}
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <cylinderGeometry args={[radius, radius * 1.02, 0.12, 64]} />
        <meshStandardMaterial
          color={resolvedSurface}
          roughness={0.8}
          metalness={0.04}
        />
      </mesh>

      {/* Outer Accent Rim (y = 0.004) */}
      <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.955, radius * 0.99, 64]} />
        <meshBasicMaterial color={resolvedAccent} transparent opacity={0.72} />
      </mesh>

      {/* Inner Calibration Track (y = 0.006) */}
      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.915, radius * 0.928, 64]} />
        <meshBasicMaterial
          color={style.palette.inkBorder}
          transparent
          opacity={0.48}
        />
      </mesh>

      {/* 24 Angular Degree Ticks (y = 0.009 — distinct Y plane, zero Z-fighting) */}
      {degreeTicks.map((t) => (
        <mesh
          key={t.idx}
          position={[t.x, 0.009, t.z]}
          rotation={[-Math.PI / 2, 0, t.rotY]}
        >
          <planeGeometry args={[t.len, t.width]} />
          <meshBasicMaterial
            color={t.isCardinal ? resolvedAccent : style.palette.inkBorder}
            transparent
            opacity={t.isCardinal ? 0.82 : 0.42}
          />
        </mesh>
      ))}

      {showGrid ? (
        <gridHelper
          args={[
            radius * 1.32,
            10,
            resolvedAccent,
            style.palette.inkBorder,
          ]}
          position={[0, 0.002, 0]}
        />
      ) : null}

      {children}
    </group>
  );
};
```

Replace `packages/kits/src/isometric-3d/Stylized3DCharacter.tsx`:

```tsx
import React from 'react';
import {
  interpolate,
  interpolateColors,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { useStudioStyle } from '@make-pictures/core';
import { ContactShadowDisc3D } from '../vfx/StagePostProcessing3D';
import {
  computeIsometricLightRig,
  resolveIsometricMaterialTokens,
  type IsometricMaterialPreset,
} from './isometricMaterials';

export interface CharacterGestureWeights {
  shrug?: number;
  presentRight?: number;
  presentLeft?: number;
  celebrate?: number;
  listenNod?: number;
}

export interface Stylized3DCharacterProps {
  /** World position [x, y, z] where y=0 is the studio floor */
  position: [number, number, number];
  /** Base Y rotation in radians (0 = facing +Z) */
  rotationY: number;
  /** Primary suit/body color */
  primaryColor: string;
  /** Secondary accent color */
  accentColor: string;
  /** Low-pass smoothed syllable energy (0..1) for mouth aperture */
  speechEnergy: number;
  /** Smooth turn-level speaking weight (0..1) across the whole sentence */
  speakingWeight: number;
  /** Smooth spring-interpolated gesture weights (0..1) so poses never snap */
  gestureWeights: CharacterGestureWeights;
  /** Frame when the character enters the scene (default 2) */
  enterFrame?: number;
  /** Smoothly interpolated head yaw offset (rad) */
  headYawOffset?: number;
  /** Optional explicit maquette finish override */
  materialPreset?: IsometricMaterialPreset;
}

export const Stylized3DCharacter: React.FC<Stylized3DCharacterProps> = ({
  position,
  rotationY,
  primaryColor,
  accentColor,
  speechEnergy,
  speakingWeight,
  gestureWeights,
  enterFrame = 2,
  headYawOffset = 0,
  materialPreset,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const studioStyle = useStudioStyle();

  const effectiveEnter = Math.max(2, enterFrame);
  if (frame <= 0 || frame < effectiveEnter) {
    return null;
  }

  const mat = resolveIsometricMaterialTokens(studioStyle, materialPreset);
  const lightRig = computeIsometricLightRig(studioStyle);

  const enterProgress = spring({
    frame: frame - effectiveEnter,
    fps,
    config: { damping: 200, stiffness: 55, mass: 1.2 },
  });

  const isShrug = gestureWeights.shrug ?? 0;
  const isPresentR = gestureWeights.presentRight ?? 0;
  const isPresentL = gestureWeights.presentLeft ?? 0;
  const isCelebrate = gestureWeights.celebrate ?? 0;
  const isNod = gestureWeights.listenNod ?? 0;

  const breath = Math.sin(frame * 0.038) * 0.012;
  const talkCadenceA = Math.sin(frame * 0.048) * speakingWeight;
  const talkCadenceB = Math.cos(frame * 0.038) * speakingWeight;

  const headPitch =
    -0.04 * speakingWeight +
    Math.sin(frame * 0.052) * 0.035 * speakingWeight +
    isNod * Math.sin(frame * 0.055) * 0.045 +
    isShrug * -0.06;
  const headRoll =
    isShrug * 0.1 + Math.sin(frame * 0.042) * 0.03 * speakingWeight;
  const headYaw =
    headYawOffset + Math.cos(frame * 0.036) * 0.035 * speakingWeight;

  const leftShoulderX =
    -0.12 +
    isShrug * -0.58 +
    isPresentL * -0.82 +
    isPresentR * -0.25 +
    isCelebrate * -0.92 +
    speakingWeight * -0.18 +
    talkCadenceA * 0.08;
  const leftShoulderZ =
    -0.12 +
    isShrug * -0.42 +
    isPresentL * -0.3 +
    isCelebrate * -0.35 +
    speakingWeight * -0.08;
  const leftElbowX =
    -0.24 +
    isShrug * -0.72 +
    isPresentL * -0.45 +
    isCelebrate * -0.55 +
    speakingWeight * -0.26 +
    talkCadenceB * 0.07;

  const rightShoulderX =
    -0.12 +
    isShrug * -0.58 +
    isPresentR * -0.82 +
    isPresentL * -0.25 +
    isCelebrate * -0.92 +
    speakingWeight * -0.18 -
    talkCadenceA * 0.08;
  const rightShoulderZ =
    0.12 +
    isShrug * 0.42 +
    isPresentR * 0.3 +
    isCelebrate * 0.35 +
    speakingWeight * 0.08;
  const rightElbowX =
    -0.24 +
    isShrug * -0.72 +
    isPresentR * -0.45 +
    isCelebrate * -0.55 +
    speakingWeight * -0.26 -
    talkCadenceB * 0.07;

  const torsoPitch = speakingWeight * 0.035 - isShrug * 0.03;
  const torsoYaw = isPresentL * 0.12 - isPresentR * 0.12;

  const scale = interpolate(enterProgress, [0, 1], [0.001, 1]);
  const auraScale = 1 + speakingWeight * 0.07;
  const clampedSpeak = Math.max(0, Math.min(1, speakingWeight));
  const clampedEnergy = Math.max(0, Math.min(1, speechEnergy));

  const floorRingColor = interpolateColors(
    clampedSpeak,
    [0, 1],
    [mat.jointColor, accentColor]
  );
  const activeSignalMix = interpolateColors(
    clampedSpeak,
    [0, 1],
    [accentColor, mat.eyeHighlightColor]
  );

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      scale={[scale, scale, scale]}
    >
      {/* Grounded Contact Shadow Disc (y = 0.012, polygonOffset) */}
      <ContactShadowDisc3D
        position={[0, 0.012, 0]}
        radius={0.62}
        opacity={lightRig.contactShadowOpacity}
        color={lightRig.contactShadowColor}
      />

      {/* Calibrated Speaker Index Ring (y = 0.018 — zero Z-fighting with stage & shadow) */}
      <mesh
        position={[0, 0.018, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[auraScale, auraScale, 1]}
      >
        <ringGeometry args={[0.45, 0.53, 48]} />
        <meshBasicMaterial
          color={floorRingColor}
          transparent
          opacity={0.22 + clampedSpeak * mat.outlineRingOpacity}
        />
      </mesh>

      {/* Left Leg */}
      <group position={[-0.16, 0.9, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.085, 24, 24]} />
          <meshStandardMaterial
            color={mat.jointColor}
            roughness={mat.limbRoughness}
            metalness={mat.limbMetalness}
          />
        </mesh>
        <mesh position={[0, -0.22, 0]} castShadow>
          <capsuleGeometry args={[0.075, 0.28, 16, 24]} />
          <meshStandardMaterial
            color={mat.limbColor}
            roughness={mat.limbRoughness}
            metalness={mat.limbMetalness}
          />
        </mesh>
        <mesh position={[0, -0.44, 0]} castShadow>
          <sphereGeometry args={[0.08, 24, 24]} />
          <meshStandardMaterial
            color={mat.jointColor}
            roughness={mat.limbRoughness}
            metalness={mat.limbMetalness}
          />
        </mesh>
        <mesh position={[0, -0.66, 0]} castShadow>
          <capsuleGeometry args={[0.068, 0.28, 16, 24]} />
          <meshStandardMaterial
            color={mat.limbColor}
            roughness={mat.limbRoughness}
            metalness={mat.limbMetalness}
          />
        </mesh>
        <mesh
          position={[0, -0.84, 0.05]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <capsuleGeometry args={[0.074, 0.12, 16, 24]} />
          <meshStandardMaterial
            color={mat.shoeColor}
            roughness={mat.roughness}
            metalness={mat.metalness}
          />
        </mesh>
      </group>

      {/* Right Leg */}
      <group position={[0.16, 0.9, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.085, 24, 24]} />
          <meshStandardMaterial
            color={mat.jointColor}
            roughness={mat.limbRoughness}
            metalness={mat.limbMetalness}
          />
        </mesh>
        <mesh position={[0, -0.22, 0]} castShadow>
          <capsuleGeometry args={[0.075, 0.28, 16, 24]} />
          <meshStandardMaterial
            color={mat.limbColor}
            roughness={mat.limbRoughness}
            metalness={mat.limbMetalness}
          />
        </mesh>
        <mesh position={[0, -0.44, 0]} castShadow>
          <sphereGeometry args={[0.08, 24, 24]} />
          <meshStandardMaterial
            color={mat.jointColor}
            roughness={mat.limbRoughness}
            metalness={mat.limbMetalness}
          />
        </mesh>
        <mesh position={[0, -0.66, 0]} castShadow>
          <capsuleGeometry args={[0.068, 0.28, 16, 24]} />
          <meshStandardMaterial
            color={mat.limbColor}
            roughness={mat.limbRoughness}
            metalness={mat.limbMetalness}
          />
        </mesh>
        <mesh
          position={[0, -0.84, 0.05]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <capsuleGeometry args={[0.074, 0.12, 16, 24]} />
          <meshStandardMaterial
            color={mat.shoeColor}
            roughness={mat.roughness}
            metalness={mat.metalness}
          />
        </mesh>
      </group>

      {/* Sculptural Torso + Arms + Head */}
      <group
        position={[0, 0.94 + breath, 0]}
        rotation={[torsoPitch, torsoYaw, 0]}
      >
        <mesh position={[0, 0.06, 0]} castShadow>
          <cylinderGeometry args={[0.21, 0.19, 0.12, 32]} />
          <meshStandardMaterial
            color={mat.jointColor}
            roughness={mat.limbRoughness}
            metalness={mat.limbMetalness}
          />
        </mesh>

        <mesh position={[0, 0.44, 0]} castShadow>
          <capsuleGeometry args={[0.25, 0.42, 24, 32]} />
          <meshStandardMaterial
            color={primaryColor}
            roughness={mat.roughness}
            metalness={mat.metalness}
          />
        </mesh>

        {/* Subtle Chest Lapel / Telemetry Badge */}
        <mesh position={[0, 0.54, 0.248]}>
          <boxGeometry args={[0.14, 0.036, 0.018]} />
          <meshBasicMaterial
            color={activeSignalMix}
            transparent
            opacity={0.45 + clampedSpeak * 0.55}
          />
        </mesh>

        {/* Architectural Collar Ring */}
        <mesh position={[0, 0.84, 0]} castShadow>
          <cylinderGeometry args={[0.165, 0.21, 0.085, 32]} />
          <meshStandardMaterial
            color={mat.collarColor}
            roughness={mat.roughness}
            metalness={mat.metalness}
          />
        </mesh>

        {/* Left Arm */}
        <group
          position={[-0.34, 0.72, 0]}
          rotation={[leftShoulderX, 0, leftShoulderZ]}
        >
          <mesh castShadow>
            <sphereGeometry args={[0.092, 24, 24]} />
            <meshStandardMaterial
              color={mat.collarColor}
              roughness={mat.roughness}
              metalness={mat.metalness}
            />
          </mesh>
          <mesh position={[0, -0.19, 0]} castShadow>
            <capsuleGeometry args={[0.068, 0.24, 16, 24]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={mat.roughness}
              metalness={mat.metalness}
            />
          </mesh>
          <group position={[0, -0.38, 0]} rotation={[leftElbowX, 0, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.076, 24, 24]} />
              <meshStandardMaterial
                color={mat.jointColor}
                roughness={mat.limbRoughness}
                metalness={mat.limbMetalness}
              />
            </mesh>
            <mesh position={[0, -0.18, 0]} castShadow>
              <capsuleGeometry args={[0.062, 0.22, 16, 24]} />
              <meshStandardMaterial
                color={mat.limbColor}
                roughness={mat.limbRoughness}
                metalness={mat.limbMetalness}
              />
            </mesh>
            <mesh position={[0, -0.36, 0]} castShadow>
              <sphereGeometry args={[0.088, 24, 24]} />
              <meshStandardMaterial
                color={mat.headColor}
                roughness={mat.roughness}
                metalness={mat.metalness}
              />
            </mesh>
          </group>
        </group>

        {/* Right Arm */}
        <group
          position={[0.34, 0.72, 0]}
          rotation={[rightShoulderX, 0, rightShoulderZ]}
        >
          <mesh castShadow>
            <sphereGeometry args={[0.092, 24, 24]} />
            <meshStandardMaterial
              color={mat.collarColor}
              roughness={mat.roughness}
              metalness={mat.metalness}
            />
          </mesh>
          <mesh position={[0, -0.19, 0]} castShadow>
            <capsuleGeometry args={[0.068, 0.24, 16, 24]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={mat.roughness}
              metalness={mat.metalness}
            />
          </mesh>
          <group position={[0, -0.38, 0]} rotation={[rightElbowX, 0, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.076, 24, 24]} />
              <meshStandardMaterial
                color={mat.jointColor}
                roughness={mat.limbRoughness}
                metalness={mat.limbMetalness}
              />
            </mesh>
            <mesh position={[0, -0.18, 0]} castShadow>
              <capsuleGeometry args={[0.062, 0.22, 16, 24]} />
              <meshStandardMaterial
                color={mat.limbColor}
                roughness={mat.limbRoughness}
                metalness={mat.limbMetalness}
              />
            </mesh>
            <mesh position={[0, -0.36, 0]} castShadow>
              <sphereGeometry args={[0.088, 24, 24]} />
              <meshStandardMaterial
                color={mat.headColor}
                roughness={mat.roughness}
                metalness={mat.metalness}
              />
            </mesh>
          </group>
        </group>

        {/* Polymorphic Sculpted Maquette Head */}
        <group
          position={[0, 1.24 + Math.sin(frame * 0.038 - 0.4) * 0.008, 0]}
          rotation={[headPitch, headYaw, headRoll]}
        >
          <mesh castShadow>
            <sphereGeometry args={[0.305, 36, 36]} />
            <meshStandardMaterial
              color={mat.headColor}
              roughness={mat.roughness}
              metalness={mat.metalness}
            />
          </mesh>

          {/* Acoustic Ear Discs */}
          <mesh position={[-0.295, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.078, 0.078, 0.044, 24]} />
            <meshStandardMaterial
              color={mat.jointColor}
              roughness={mat.limbRoughness}
              metalness={mat.limbMetalness}
            />
          </mesh>
          <mesh position={[0.295, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.078, 0.078, 0.044, 24]} />
            <meshStandardMaterial
              color={mat.jointColor}
              roughness={mat.limbRoughness}
              metalness={mat.limbMetalness}
            />
          </mesh>

          {mat.visorStyle === 'sculpted-band' ? (
            <>
              {/* Architectural brow horizon bar + calm acoustic slit */}
              <mesh position={[0, 0.045, 0.288]}>
                <boxGeometry args={[0.3, 0.032, 0.03]} />
                <meshStandardMaterial
                  color={accentColor}
                  roughness={mat.roughness}
                  metalness={mat.metalness}
                />
              </mesh>
              <mesh
                position={[0, -0.045, 0.29]}
                scale={[1, 1 + clampedEnergy * 2.4, 1]}
              >
                <boxGeometry args={[0.13, 0.014, 0.024]} />
                <meshBasicMaterial
                  color={mat.visorColor}
                  transparent
                  opacity={0.45 + clampedSpeak * 0.55}
                />
              </mesh>
            </>
          ) : mat.visorStyle === 'slit-visor' ? (
            <>
              {/* Anodized telemetry slit visor + 3 precision bars */}
              <mesh position={[0, 0.03, 0.255]} scale={[0.88, 0.36, 0.42]}>
                <sphereGeometry args={[0.295, 32, 24]} />
                <meshStandardMaterial
                  color={mat.visorColor}
                  roughness={0.18}
                  metalness={0.45}
                />
              </mesh>
              <mesh position={[0, 0.055, 0.352]}>
                <boxGeometry args={[0.24, 0.02, 0.016]} />
                <meshBasicMaterial
                  color={accentColor}
                  transparent
                  opacity={0.55 + clampedSpeak * 0.45}
                />
              </mesh>
              {[-0.052, 0, 0.052].map((xOff, idx) => {
                const barH =
                  0.01 + clampedEnergy * (idx === 1 ? 0.042 : 0.026);
                return (
                  <mesh
                    key={idx}
                    position={[xOff, -0.012, 0.354]}
                    scale={[1, barH / 0.01, 1]}
                  >
                    <boxGeometry args={[0.024, 0.01, 0.014]} />
                    <meshBasicMaterial color={activeSignalMix} />
                  </mesh>
                );
              })}
            </>
          ) : (
            <>
              {/* Graphic ink-mask plate for brutalist / craft / sketch */}
              <mesh position={[0, 0.035, 0.285]}>
                <boxGeometry args={[0.32, 0.085, 0.034]} />
                <meshStandardMaterial
                  color={mat.visorColor}
                  roughness={0.94}
                  metalness={0.02}
                />
              </mesh>
              <mesh position={[-0.075, 0.035, 0.305]}>
                <boxGeometry args={[0.044, 0.026, 0.012]} />
                <meshBasicMaterial color={mat.eyeHighlightColor} />
              </mesh>
              <mesh position={[0.075, 0.035, 0.305]}>
                <boxGeometry args={[0.044, 0.026, 0.012]} />
                <meshBasicMaterial color={mat.eyeHighlightColor} />
              </mesh>
              <mesh
                position={[0, -0.058, 0.286]}
                scale={[0.75 + clampedEnergy * 0.55, 1 + clampedEnergy * 2.1, 1]}
              >
                <boxGeometry args={[0.12, 0.018, 0.022]} />
                <meshBasicMaterial color={accentColor} />
              </mesh>
            </>
          )}
        </group>
      </group>
    </group>
  );
};
```

Update `packages/kits/src/isometric-3d/index.ts`:

```ts
export * from './isometricMaterials';
export * from './Stylized3DCharacter';
export * from './IsometricStudioEnvironment';
export { IsometricStage3D, type IsometricStage3DProps } from './IsometricStage3D';
```

- [ ] **Step 5: Run tests and typecheck to verify Task 2 passes**

Run: `npx tsx --test packages/cli/tests/wave3-isometric-3d.test.ts packages/cli/tests/kits-style-integration.test.ts && npm run typecheck`
Expected: PASS (`0` errors, all tests green).

- [ ] **Step 6: Commit Task 2**

```bash
git add packages/kits/src/isometric-3d/ packages/cli/tests/wave3-isometric-3d.test.ts
git commit -m "feat(kits): rebuild isometric-3d with polymorphic maquette materials and optical light rig"
```


---

### Task 3: Update Canonical Skills (`kit-motion-diagrams-2d`, `kit-isometric-3d`, `cinematography-and-vfx`) & Mirror Sync

**Files:**
- Modify: `plugins/make-pictures/skills/kit-motion-diagrams-2d/SKILL.md`
- Modify: `plugins/make-pictures/skills/kit-isometric-3d/SKILL.md`
- Modify: `plugins/make-pictures/skills/cinematography-and-vfx/SKILL.md`
- Synced output (`npm run sync:skills`): `skills/kit-motion-diagrams-2d/SKILL.md`, `skills/kit-isometric-3d/SKILL.md`, `skills/cinematography-and-vfx/SKILL.md`

**Interfaces:**
- Documents all Wave 3 public primitives accurately: `<MotionDiagramStage2D />`, `useMotionDiagramFocus`, `resolvePayloadTokenColors`, `DirectorCamera2D` Clean Frame `0` + `StageLightingRig`, `resolveIsometricCharacterMaterial`, `resolveIsometricLightRig`, polymorphic `ceramic-maquette` / `anodized-telemetry` / `ink-figurine` 3D materials, and `ContactShadowDisc3D`.

- [ ] **Step 1: Replace `plugins/make-pictures/skills/kit-motion-diagrams-2d/SKILL.md`**

Write `plugins/make-pictures/skills/kit-motion-diagrams-2d/SKILL.md`:

```markdown
---
name: kit-motion-diagrams-2d
description: >-
  Mathematical coordinate ports, infinite-canvas 2D camera & optical rack focus
  rules, polymorphic schematic couplers, packet speed cadence, and 9:16 cascade
  layout rules for @make-pictures/kits/motion-diagrams-2d. Use this skill
  whenever creating system architecture diagrams, SaaS product flows, or
  one-shot 2D canvas explainers.
---

# Kit: Motion Diagrams 2D (`@make-pictures/kits/motion-diagrams-2d`)

Build crisp `60 FPS` infinite-canvas architectural schematics, system topology flows, and product explainers with directional optical lighting, shot-driven Circle-of-Confusion rack focus, zero coordinate guessing, and zero GPU background clipping.

---

## Core Primitives & Imports

```tsx
import { DirectorCamera2D, SPRING_PRESETS } from '@make-pictures/core';
import {
  MotionDiagramStage2D,
  CameraRig,
  WorldBox,
  portTop,
  portBottom,
  portLeft,
  portRight,
  FlowCurve,
  DataFlowEdge,
  SystemNode,
  CodePayloadToast,
  resolvePayloadTokenColors,
  type NodeBox,
  type MotionDiagramFocusState,
} from '@make-pictures/kits/motion-diagrams-2d';
```

---

## Mandatory Layout, Optical Focus, Port & Camera Rules

### 1. Single Source of Truth for Node Coordinates (`NodeBox`)
- **Zero manual coordinate guessing:** Never write separate approximate `(x, y)` numbers for HTML cards and SVG connection curves.
- Define every block on the 2D canvas inside one dictionary (`WORLD_NODES` for `16:9` and a dedicated `VERTICAL_WORLD_NODES` for `9:16`) as `NodeBox` (`{ cx, cy, w, h }`).
- Mount HTML cards with `<WorldBox node={NODES.apiGateway} nodeId="apiGateway">` or `<SystemNode id="apiGateway" x={NODES.apiGateway.cx} y={NODES.apiGateway.cy} width={NODES.apiGateway.w} height={NODES.apiGateway.h} ... />` and attach all edges (`FlowCurve` / `DataFlowEdge`) **exclusively** via mathematical border port helpers:
  - `portTop(node, dx = 0)` — top border (`y = cy - h / 2`)
  - `portBottom(node, dx = 0)` — bottom border (`y = cy + h / 2`)
  - `portLeft(node, dy = 0)` — left border (`x = cx - w / 2`)
  - `portRight(node, dy = 0)` — right border (`x = cx + w / 2`)

### 2. Optical Rack Focus & Polymorphic Schematic Grammar (`<MotionDiagramStage2D />`)
- Prefer `<MotionDiagramStage2D />` (which wraps `<DirectorCamera2D />` + `<StageLightingRig />` + `MotionDiagramFocusContext`):
  - **Automatic Shot-Driven Rack Focus:** When `shots: ShotSpec2D[]` glides from a wide establishing shot (`target: ['ingest', 'engine']`) onto a focused cluster (`target: ['engine', 'payload']`), `MotionDiagramStage2D` spring-interpolates focus weights so non-targeted `SystemNode` and `WorldBox` modules smoothly recess into optical background CoC blur (`computeCircleOfConfusionPx`, emitting `filter: 'none'` whenever `< 0.25px` so active typography stays razor-sharp). Pass `focusedNodeIds` or per-node `focusState="sharp" | "recessed"` when overriding manually.
  - **Viewport Sheet Index (`diagramCode`):** Optional monospace sheet index stamp pinned safely inside the `9:16` Golden Safe Box (`left: 76, top: 236` in vertical; `left: 64, top: 44` in `16:9`).
  - **Polymorphic Couplers & Terminals (`resolveStyleOptics(style).typographyGrammar`):**
    - `'swiss-spatial'` — crisp single-axis schematic trace, square/circle pin terminals, tangent-aligned drafted chevron courier.
    - `'optical-gate'` — precision telemetry bus with circular terminals and high-contrast luminous frame bar courier.
    - `'risograph-poster'` — bold ink bus with heavy rectangular terminals and graphic triangle courier.
  - **Zero SaaS AI-Slop:** Never add `borderRadius: 9999` pills, glowing neon dots, hardcoded `#00F0FF` / `#6366F1` radial blobs, or hardcoded GitHub-dark syntax hexes (`CodePayloadToast` derives token colors from `resolvePayloadTokenColors(style)`).

### 3. Header & Card Border Avoidance (`curveX` Detour)
- **Never slice section headers with lines:** Never route a vertical connection straight through the middle of a section title or flush along the vertical side edge of a card.
- When connecting a card in an upper section to a card in a lower section across a section header, exit from `portBottom(sourceNode)` and bypass the header with a wide, smooth lateral Bézier arch using `curveX` (e.g., `curveX={-240}` or `curveX={240}` on `<FlowCurve orientation="vertical" ... />`).

### 4. Infinite Viewport-Pinned Grid & Clean Frame `0`
- **Never place a finite background `div` inside a 3D perspective container:** Putting a large grid element inside `perspective` + `rotateX` causes Chromium's GPU tile buffer to clip edges when zooming out (`zoom ~ 0.5x`), leaving empty strips around the screen.
- Always use `<MotionDiagramStage2D />`, `<DirectorCamera2D />`, or `<CameraRig />`, which pin the calibrated technical grid and `<StageLightingRig />` directly to the viewport `AbsoluteFill`:
  - `gridSpacing = Math.max(24, 80 * cam.zoom)`
  - `gridOffsetX = (stageWidth / 2) - cam.x * cam.zoom`
  - `gridOffsetY = (stageHeight / 2) - cam.y * cam.zoom`
- **Clean Frame `0`:** On `frame <= 0`, `DirectorCamera2D` / `CameraRig` render pure `style.palette.bgCanvas` (or `null` when `renderBaseFill={false}` inside `<StyleProvider renderBackdrop>`), and `SystemNode`, `FlowCurve`, `DataFlowEdge`, and `CodePayloadToast` return `null` (`enterFrame >= 2`).

### 5. Natural `60 FPS` Data Packet Cadence
- At `60 FPS`, **never** set `packetSpeedFrames` below `60` (fast-blinking couriers look frantic and unreadable).
- Set `packetSpeedFrames` between **`92` and `120` frames (`1.5–2.0 s`)** with `packetCount={2}` (at most `3` on the longest cross-section curves).

### 6. Dedicated `9:16` Vertical Layout (`1080×1920`)
- **Never shrink a wide `16:9` diagram down to fit `9:16`:** Create a dedicated `VERTICAL_WORLD_NODES` layout stacking cards top-to-bottom (`w <= 640 px`) so cards stay crisp and legible at `zoom ~ 1.0` on a phone.
- Keep all active content inside the **Golden Safe Box (`x ∈ [40, 910]`, `y ∈ [220, 1380]`)**.
- Pass `nodes={VERTICAL_WORLD_NODES}` and `shots={[...]}` to `<MotionDiagramStage2D />`—it automatically fits target bounding boxes into the `9:16` Golden Safe Box while recessing background nodes via optical CoC blur.

### 7. Visual Minimalism & Typography
- Replace dense paragraphs, tables, and long code blocks with **architectural module stamp + 2–3 words + crisp calibration status bar**.
- Use Polish *Sentence case* (`Bramka płatności`, never `Bramka Płatności`) and viewer-benefit headlines.

---

## Reference Pattern (`<StyleProvider>` + `<MotionDiagramStage2D>`)

```tsx
const WORLD_NODES = {
  ingest: { cx: 560, cy: 460, w: 430, h: 196 },
  engine: { cx: 1360, cy: 460, w: 430, h: 196 },
  payload: { cx: 1360, cy: 730, w: 430, h: 168 },
} satisfies Record<string, NodeBox>;

<StyleProvider style={props.styleId} renderBackdrop>
  <MotionDiagramStage2D
    diagramCode="SCHEMAT 01 • ARCHITEKTURA"
    renderBaseFill={false}
    nodes={WORLD_NODES}
    shots={[
      { fromFrame: 0, target: ['ingest', 'engine'], transition: 'cut', padding: 140 },
      { fromFrame: 240, target: ['engine', 'payload'], transition: 'glide', padding: 150 },
    ]}
  >
    <FlowCurve
      from={portRight(WORLD_NODES.ingest)}
      to={portLeft(WORLD_NODES.engine)}
      activeFromFrame={18}
      packetSpeedFrames={96}
      packetCount={2}
    />
    <SystemNode
      id="ingest"
      moduleCode="MOD 01"
      badge="WEJŚCIE"
      title="Bramka zdarzeń"
      subtitle="Walidacja schematu wejściowego"
      statusText="Gotowość 60 FPS"
      activeStatusText="Przesył aktywny"
      x={WORLD_NODES.ingest.cx}
      y={WORLD_NODES.ingest.cy}
      width={WORLD_NODES.ingest.w}
      height={WORLD_NODES.ingest.h}
      enterFrame={4}
      activeRanges={[[18, 220]]}
    />
    <SystemNode
      id="engine"
      moduleCode="MOD 02"
      badge="RDZEŃ"
      title="Silnik rozliczeń"
      subtitle="Deterministyczny zapis transakcji"
      statusText="Oczekiwanie"
      activeStatusText="Przetwarzanie potoku"
      x={WORLD_NODES.engine.cx}
      y={WORLD_NODES.engine.cy}
      width={WORLD_NODES.engine.w}
      height={WORLD_NODES.engine.h}
      enterFrame={12}
      activeRanges={[[90, 420]]}
    />
    <CodePayloadToast
      x={WORLD_NODES.payload.cx}
      y={WORLD_NODES.engine.cy + WORLD_NODES.engine.h / 2 + 28}
      width={WORLD_NODES.payload.w}
      methodBadge="POST"
      endpoint="/v1/ledger/commit"
      latencyText="14ms"
      code={'{\n  "status": "committed",\n  "frames": 60\n}'}
      startFrame={248}
      endFrame={460}
    />
  </MotionDiagramStage2D>
</StyleProvider>
```

---

## SaaS Walkthroughs: `MotionDiagramStage2D` + Product Frames (`@make-pictures/kits/product-frames`)

Put real `.mp4` screencasts on the infinite canvas and direct the camera onto UI details with calibrated reticle callouts:

```tsx
import { staticFile } from 'remotion';
import { MotionDiagramStage2D } from '@make-pictures/kits/motion-diagrams-2d';
import { BrowserFrame, PhoneFrame, ScreenSpotlightOverlay } from '@make-pictures/kits/product-frames';

const NODES = {
  desktop: { cx: 960, cy: 540, w: 1360, h: 902 },
  mobile: { cx: 2050, cy: 560, w: 420, h: 910 },
  exportBtn: { cx: 1380, cy: 260, w: 320, h: 140 },
};

<MotionDiagramStage2D
  renderBaseFill={false}
  nodes={NODES}
  shots={[
    { fromFrame: 0, target: 'desktop' },
    { fromFrame: 150, target: 'exportBtn', transition: 'glide', padding: 120 },
    { fromFrame: 300, target: ['desktop', 'mobile'], transition: 'glide' },
  ]}
>
  <div style={{ position: 'absolute', left: NODES.desktop.cx - 680, top: NODES.desktop.cy - 451 }}>
    <BrowserFrame url="app.example.com" videoSrc={staticFile('_productions/my-film/videos/desktop.mp4')}>
      <ScreenSpotlightOverlay x={70} y={12} width={22} height={12} startFrame={150} endFrame={290} label="Eksport PDF" />
    </BrowserFrame>
  </div>
  <div style={{ position: 'absolute', left: NODES.mobile.cx - 210, top: NODES.mobile.cy - 455 }}>
    <PhoneFrame width={420} videoSrc={staticFile('_productions/my-film/videos/mobile.mp4')} enterFrame={300} />
  </div>
</MotionDiagramStage2D>
```

- Describe each frame (and each zoom target inside it) as a `NodeBox`, so `MotionDiagramStage2D` auto-fits it into `16:9` or the `9:16` Golden Safe Box.
- `ScreenSpotlightOverlay` renders crisp architectural corner reticles (`data-spotlight-reticle="true"`) in percentage coordinates of the video viewport, inheriting `useStudioStyle()` palette & typography.
- Keep the camera on the spotlighted region for at least `90–120` frames at `60 FPS` so viewers can read it, then glide back out.
```

- [ ] **Step 2: Replace `plugins/make-pictures/skills/kit-isometric-3d/SKILL.md`**

Write `plugins/make-pictures/skills/kit-isometric-3d/SKILL.md`:

```markdown
---
name: kit-isometric-3d
description: >-
  Polymorphic architectural maquette materials, optical directional 3D lighting,
  character animation physics, speech-envelope separation, gesture spring rules,
  and 9:16 framing for @make-pictures/kits/isometric-3d. Use this skill whenever
  building 3D studio dialogues, podcasts, or multi-character explainers with
  IsometricStage3D and Stylized3DCharacter wrapped in <StyleProvider>.
---

# Kit: Isometric 3D Studio (`@make-pictures/kits/isometric-3d`)

Create calm, broadcast-quality 3D multi-character conversations inside `ThreeCanvas` (`@remotion/three`) on the architectural `<IsometricStage3D />` turntable plinth — with directional key/rim studio lighting driven by `optics.lightAngleDeg`, polymorphic sculptural character materials (`ceramic-maquette`, `anodized-telemetry`, `ink-figurine`), and ElevenLabs dialogue synchronization without robotic word-level twitching.

---

## Core Primitives & Imports

```tsx
import { ThreeCanvas } from '@remotion/three';
import {
  StyleProvider,
  DirectorCamera3D,
  getSpeechStateAtFrame,
  getSmoothPoseWindow,
  useStudioStyle,
  SPRING_PRESETS,
} from '@make-pictures/core';
import {
  IsometricStage3D,
  Stylized3DCharacter,
  resolveIsometricCharacterMaterial,
  resolveIsometricLightRig,
  type IsometricStage3DProps,
  type IsometricMaterialMode,
  type CharacterGestureWeights,
} from '@make-pictures/kits/isometric-3d';
```

- **`IsometricStage3D`:** Two-tier chamfered architectural turntable plinth (`radius?: number` default `5.4`, `showGrid?: boolean` default `true`, `accentColor?: string`, `surfaceColor?: string`, `children?: React.ReactNode`). Automatically derives:
  - **Directional Studio Light Rig (`resolveIsometricLightRig(style)`):** Projects the primary shadow-casting key light along `resolveStyleOptics(style).lightAngleDeg`, paired with an opposite rim/back light (`accentSecondary` / `halation`) and soft hemisphere fill,
  - **Calibrated Plinth Geometry:** Engraved 24-tick degree ring (`15°` increments), inner acoustic channel, radial `<ContactShadowDisc3D />` grounding, and subtle `<StagePostProcessing3D />` exponential depth fog.
- **`Stylized3DCharacter`:** Sculptural architectural maquette speaker figure (`resolveIsometricCharacterMaterial(style)`) that morphs across 3 material aesthetics — **never** a `#FFFFFF` plastic toy robot with spherical ear muffs or neon floor rings:
  1. **`'ceramic-maquette'`** (`editorial-press`, `archival-chronicle`, `minimal-product`): Matte bisque/uncoated paper bust (`roughness: 0.86`, `metalness: 0.04`), chamfered torso, sculpted brow horizon bar, and calm acoustic slit.
  2. **`'anodized-telemetry'`** (`cyber-telemetry` & dark technical presets): Machined satin dark chassis (`roughness: 0.34`, `metalness: 0.42`) with recessed slit visor and 3 precision telemetry bars.
  3. **`'ink-figurine'`** (`brutalist-poster`, `tactile-craft`, `sketch-notebook`): High-contrast graphic silhouette (`roughness: 0.92`) with flat ink-mask plate and crisp rectangular eye highlights.

---

## Mandatory 3D Character & Dialogue Rules

### 1. Strict Separation: Sentence Envelope (`speakingWeight`) vs. Syllable Energy (`speechEnergy`)
Raw word energy drops to `0` between words inside a single sentence. Wiring syllable energy to limbs or HUD cards makes characters convulse on every word!
- Always compute speech state via `const speech = getSpeechStateAtFrame(sceneId, localFrame, voiceoverManifest?)`:
  - **`speech.speakingWeight` (`0..1` continuous turn envelope):** Smoothly ramps in `14` frames before the first word, stays steady at `1.0` across inter-word micro-pauses, and eases out `20` frames after the final word. Use **`speakingWeight`** exclusively for:
    - body posture & conversational hand cadence,
    - brass/accent speaker plinth ring activation,
    - speaker nameplate / HUD card activation scale.
  - **`speech.energy` (`0..1` 7-tap low-pass filtered syllable envelope):** Pass as `speechEnergy={speech.energy}` **solely** to animate the acoustic slit / visor equalizer bars.

### 2. Zero Snap Gestures (`getSmoothPoseWindow` Only)
- Binary `0 / 1` ternary checks (`frame > 120 ? 1 : 0`) on character joints or head yaw are **strictly forbidden**.
- Every entry in `gestureWeights` (`shrug`, `presentRight`, `presentLeft`, `celebrate`, `listenNod`) and every `headYawOffset` change **must** pass through `getSmoothPoseWindow(frame, fps, startFrame, endFrame)` powered by `SPRING_PRESETS.calmPose` (`damping: 200, stiffness: 26, mass: 1.4`), giving organic ~`0.75 s` pose transitions.

### 3. `60 FPS` Frequency Limits (`0.03..0.055 rad/frame`)
- Breathing cycles, gentle conversational hand sway, head yaw turns, and any custom 3D props placed inside `<IsometricStage3D>` must stay strictly within angular frequencies **`frame * 0.03` to `frame * 0.055`** radians/frame (one full cycle every `2.0–3.5 s`).
- Multipliers `frame * 0.1+` (such as `frame * 0.16` or `frame * 0.22`) on limbs/props and vertical torso bouncing (`talkBounce = 0`) are **strictly forbidden**.
- Drive camera transitions with `DirectorCamera3D` (`transition: 'glide'` uses `SPRING_PRESETS.calmCamera`: `damping: 200, stiffness: 22, mass: 1.6`, or instant editorial `'cut'` between single close-ups and two-shots).

### 4. `9:16` Vertical Framing & Zone Separation
- Enable `safeBox9x16Compensation` (default `true`) on `<DirectorCamera3D />` so vertical `1080×1920` renders automatically widen FOV and shift framing into the **Golden Safe Box (`x ∈ [40, 910]`, `y ∈ [220, 1380]`)** clear of the bottom `480 px` Shorts/Reels UI.
- Keep any HTML speaker nameplate overlays strictly inside `left: 76, width: 788, top >= 236` in `9:16`.
- Never place a large gesturing foreground character directly in front of a busy multi-element 3D prop — split upper/lower or left/right depth zones cleanly.

### 5. Clean Frame `0` & Hardware GPU Acceleration (`--gl=angle`)
- Keep `frame === 0` clean (`StyleBackdrop` renders pure `palette.bgCanvas` at `frame <= 0`, and `IsometricStage3D` / `Stylized3DCharacter` return `null` on `frame <= 0`, entering cleanly from `frame >= 2`).
- Always render `ThreeCanvas` compositions with `--gl=angle` (handled automatically by `npx make-pictures qa` and `npx make-pictures render` when `usesThree: true` is set on the composition entry).

---

## Reference Pattern (`<StyleProvider>` + `<DirectorCamera3D>` + `<IsometricStage3D>`)

```tsx
const DialogueStage: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const style = useStudioStyle();
  const s1Start = 12;
  const s2Start = 240;
  const s2End = 450;

  const hostSpeech = getSpeechStateAtFrame('s1-host', frame - s1Start);
  const guestSpeech = getSpeechStateAtFrame('s2-guest', frame - s2Start);

  const hostGestures: CharacterGestureWeights = {
    presentRight: getSmoothPoseWindow(frame, fps, s1Start + 24, s1Start + 190),
    listenNod: getSmoothPoseWindow(frame, fps, s2Start + 20, s2End - 30),
  };

  const guestGestures: CharacterGestureWeights = {
    presentLeft: getSmoothPoseWindow(frame, fps, s2Start + 24, s2End - 24),
  };

  return (
    <IsometricStage3D radius={5.4} showGrid>
      <Stylized3DCharacter
        position={[-1.45, 0, 0]}
        rotationY={0.38}
        primaryColor={style.palette.accentPrimary}
        accentColor={style.palette.accentSecondary}
        speakingWeight={hostSpeech.speakingWeight}
        speechEnergy={hostSpeech.energy}
        gestureWeights={hostGestures}
        headYawOffset={0.18 * getSmoothPoseWindow(frame, fps, s2Start, s2End)}
        enterFrame={4}
      />
      <Stylized3DCharacter
        position={[1.45, 0, 0]}
        rotationY={-0.38}
        primaryColor={style.palette.accentSecondary}
        accentColor={style.palette.accentPrimary}
        speakingWeight={guestSpeech.speakingWeight}
        speechEnergy={guestSpeech.energy}
        gestureWeights={guestGestures}
        headYawOffset={-0.18 * getSmoothPoseWindow(frame, fps, s1Start, s2Start - 12)}
        enterFrame={10}
      />
    </IsometricStage3D>
  );
};

// Inside your composition:
<StyleProvider style={props.styleId} renderBackdrop>
  <ThreeCanvas width={width} height={height} shadows>
    <DirectorCamera3D
      safeBox9x16Compensation
      anchors={{
        host: { position: [-1.45, 0, 0], height: 1.55 },
        guest: { position: [1.45, 0, 0], height: 1.55 },
      }}
      shots={[
        { fromFrame: 0, shot: 'medium-two-shot', target: 'host', secondaryTarget: 'guest', transition: 'cut' },
        { fromFrame: 60, shot: 'over-the-shoulder', target: 'host', secondaryTarget: 'guest', transition: 'glide' },
        { fromFrame: 240, shot: 'close-up', target: 'guest', transition: 'cut' },
      ]}
    />
    <DialogueStage frame={frame} fps={fps} />
  </ThreeCanvas>
</StyleProvider>
```
```

- [ ] **Step 3: Update Section 2 & Section 4 of `plugins/make-pictures/skills/cinematography-and-vfx/SKILL.md`**

Edit `plugins/make-pictures/skills/cinematography-and-vfx/SKILL.md` so Section 2 documents `DirectorCamera2D` Clean Frame `0`, `StageLightingRig` (`renderBaseFill`, `renderLighting`), and `<MotionDiagramStage2D />` shot-driven rack focus, and Section 4 mentions `IsometricStage3D`'s optical directional light rig:

Replace lines 47–56 of `plugins/make-pictures/skills/cinematography-and-vfx/SKILL.md` (`## 2. 2D Infinite-Canvas Shot DSL (<DirectorCamera2D />)`) with:

```markdown
## 2. 2D Infinite-Canvas Shot DSL (`<DirectorCamera2D />` & `<MotionDiagramStage2D />`)

```tsx
import { DirectorCamera2D, type ShotSpec2D } from '@make-pictures/core';
import { MotionDiagramStage2D } from '@make-pictures/kits/motion-diagrams-2d';
```

- **`<DirectorCamera2D />`:** Accepts either explicit `CameraKeyframe2D[]` or named `nodes: Record<string, StageNode2D>` + `shots: ShotSpec2D[]` (`{ fromFrame, target: string | string[], transition?: 'cut' | 'glide' | 'whip', padding?, zoom?, rotateZ?, label? }`), plus `renderBaseFill?: boolean` (pass `false` inside `<StyleProvider renderBackdrop>`) and `renderLighting?: boolean` (default `true`, mounting `<StageLightingRig />`).
- **Clean Frame `0` & Style Inheritance:** On `frame <= 0`, renders pure `style.palette.bgCanvas` (or `null` when `renderBaseFill={false}`). From `frame >= 1`, renders the viewport-pinned calibrated grid (`style.palette.inkBorder`) and directional `<StageLightingRig />` with zero hardcoded cyan/indigo radial blobs and zero GPU edge clipping, while fitting targets into `16:9` or the **`9:16` Golden Safe Box** and publishing live `velocity` telemetry.
- **`<MotionDiagramStage2D />` (`@make-pictures/kits/motion-diagrams-2d`):** Extends `DirectorCamera2D` with `MotionDiagramFocusContext` (`focusedNodeIds` or automatic shot-target focus interpolation) so off-target `SystemNode` and `WorldBox` modules smoothly recess into Circle-of-Confusion blur (`computeCircleOfConfusionPx`, emitting `filter: 'none'` below `0.25px`).
```

And in Section 4 of `plugins/make-pictures/skills/cinematography-and-vfx/SKILL.md`, replace the `StagePostProcessing3D & ContactShadowDisc3D` bullet with:

```markdown
- **`StagePostProcessing3D` & `ContactShadowDisc3D`:** Drop-in children inside `<ThreeCanvas>` providing exponential atmospheric depth fog (`THREE.FogExp2`), volumetric spotlight dust cones, depth-haze planes, and soft radial contact shadows without extra postprocessing bundle bloat (used automatically inside `<IsometricStage3D />` alongside its `optics.lightAngleDeg` key/rim studio lighting rig).
```

- [ ] **Step 4: Sync skills mirror and run `root-skills-sync.test.ts`**

Run: `npm run sync:skills && npx tsx --test packages/cli/tests/root-skills-sync.test.ts`
Expected: PASS (`root skills/ mirrors plugins/make-pictures/skills/ as real files for skills.sh`).

- [ ] **Step 5: Commit Task 3**

```bash
git add plugins/make-pictures/skills/ skills/
git commit -m "docs(skills): document Wave 3 motion-diagrams-2d and isometric-3d optical craft"
```

---

### Task 4: Live `60 FPS` `Style Lab` Previews, CLI Scaffolds (`new-production.ts`), Contact-Sheet QA & `pack:verify`

**Files:**
- Modify: `packages/studio/src/client/components/StyleLabShowcase.tsx`
- Modify: `packages/cli/src/commands/new-production.ts`
- Modify: `packages/cli/tests/studio-styles-api.test.ts`
- Modify: `packages/cli/tests/styles-cli.test.ts`

**Interfaces:**
- `StyleLabShowcase.tsx` imports ONLY from `react`, `@remotion/player`, `remotion`, `lucide-react`, `@make-pictures/core` (adding `computeCircleOfConfusionPx`), and local Studio modules — **zero** `@make-pictures/kits`, `three`, or `@react-three/fiber` imports.
- `new-production.ts` emits valid `60 FPS` TypeScript capsules for `motion-diagrams-2d` (`MotionDiagramStage2D`, `SystemNode`, `FlowCurve`, `CodePayloadToast`) and `isometric-3d` (`DirectorCamera3D`, `IsometricStage3D`, `Stylized3DCharacter` with calm `<= 0.055 rad/frame` cadence and `9:16`-safe speaker nameplate).

- [ ] **Step 1: Add failing Wave 3 assertions to `packages/cli/tests/studio-styles-api.test.ts` and `packages/cli/tests/styles-cli.test.ts`**

In `packages/cli/tests/studio-styles-api.test.ts`, inside the `for (const { styleId, expectedRig, expectedMount, expectedGrammar } of cases)` block (right after `// 4. Data Storytelling in Style Lab`) and in the `showcaseSrc` guard at the bottom, add:

```ts
    // 5. Motion Diagrams 2D in Style Lab: Frame 0 clean + Frame 64 schematic bus, rack focus & payload plate
    const diagramsFrame0 = renderStyleLabFrame(preset, 'motion-diagrams-2d', 0);
    assert.doesNotMatch(diagramsFrame0, /Scenariusz JSON|SCHEMAT/);
    assert.doesNotMatch(diagramsFrame0, /data-lighting-rig=/);

    for (const [w, h] of [
      [1080, 1920],
      [1920, 1080],
    ] as const) {
      const diagramsFrame64 = renderStyleLabFrame(
        preset,
        'motion-diagrams-2d',
        64,
        w,
        h
      );
      assert.match(
        diagramsFrame64,
        new RegExp(`data-lighting-rig="${expectedRig}"`)
      );
      assert.match(
        diagramsFrame64,
        new RegExp(`data-flow-grammar="${expectedGrammar}"`)
      );
      assert.match(diagramsFrame64, /data-payload-plate="true"/);
      assert.match(diagramsFrame64, /data-depth-z="-0\.56"/);
      assert.match(diagramsFrame64, /data-depth-z="0\.28"/);
      assert.doesNotMatch(diagramsFrame64, /blur\(0(?:\.0+)?px\)/);
    }

    // 6. Isometric 3D in Style Lab: Frame 0 clean + Frame 64 calibrated 24-tick plinth & sculptural maquette
    const isoFrame0 = renderStyleLabFrame(preset, 'isometric-3d', 0);
    assert.doesNotMatch(isoFrame0, /Prowadząca|MAKIETA/);
    assert.doesNotMatch(isoFrame0, /data-lighting-rig=/);

    const expectedIsoMaterial =
      styleId === 'brutalist-poster'
        ? 'ink-figurine'
        : styleId === 'cyber-telemetry'
          ? 'anodized-telemetry'
          : 'ceramic-maquette';

    for (const [w, h] of [
      [1080, 1920],
      [1920, 1080],
    ] as const) {
      const isoFrame64 = renderStyleLabFrame(preset, 'isometric-3d', 64, w, h);
      assert.match(
        isoFrame64,
        new RegExp(`data-lighting-rig="${expectedRig}"`)
      );
      assert.match(
        isoFrame64,
        new RegExp(`data-iso-material="${expectedIsoMaterial}"`)
      );
      assert.match(isoFrame64, /data-iso-plinth="calibrated-24"/);
      assert.match(isoFrame64, /data-depth-z="-0\.54"/);
      assert.doesNotMatch(isoFrame64, /blur\(0(?:\.0+)?px\)/);
    }
```

And at the end of `packages/cli/tests/studio-styles-api.test.ts` right after `assert.doesNotMatch(showcaseSrc, /Math\.random\s*\(/);`, add:

```ts
  assert.doesNotMatch(showcaseSrc, /frame\s*\*\s*0\.22/);
```

In `packages/cli/tests/styles-cli.test.ts`, inside the `for (const kitId of SCENES_KIT_IDS)` loop, update the `isometric-3d` check and add `motion-diagrams-2d` checks:

```ts
      if (kitId === 'isometric-3d') {
        assert.match(tsx, /IsometricStage3D/);
        assert.match(tsx, /DirectorCamera3D/);
        assert.match(tsx, /Stylized3DCharacter/);
        assert.doesNotMatch(tsx, /frame\s*\*\s*0\.16/);
      }
      if (kitId === 'motion-diagrams-2d') {
        assert.match(tsx, /MotionDiagramStage2D/);
        assert.match(tsx, /SystemNode/);
        assert.match(tsx, /FlowCurve/);
        assert.match(tsx, /CodePayloadToast/);
      }
```

- [ ] **Step 2: Run the two test files to verify they fail**

Run: `npx tsx --test packages/cli/tests/studio-styles-api.test.ts packages/cli/tests/styles-cli.test.ts`
Expected: FAIL (`data-lighting-rig` missing on `motion-diagrams-2d` / `isometric-3d` in `StyleLabPreviewComposition`, and `MotionDiagramStage2D` / `DirectorCamera3D` missing in `new-production.ts`).

- [ ] **Step 3: Upgrade `MotionDiagrams2DPreview`, `Isometric3DPreview`, and `usesOpticalStage` in `packages/studio/src/client/components/StyleLabShowcase.tsx`**

1. Add `computeCircleOfConfusionPx` to the `@make-pictures/core` import block in `packages/studio/src/client/components/StyleLabShowcase.tsx`:

```tsx
import {
  DepthPlane,
  OpticalStage2D,
  StageLightingRig,
  StyleProvider,
  computeCircleOfConfusionPx,
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

2. Replace `MotionDiagrams2DPreview` in `packages/studio/src/client/components/StyleLabShowcase.tsx` with:

```tsx
const MotionDiagrams2DPreview: React.FC = () => {
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
      {
        fromFrame: 2,
        x: cx,
        y: cy,
        zoom: 1,
        focalZ: 0,
        aperture: optics.aperture,
        transition: 'cut',
      },
      {
        fromFrame: 120,
        x: cx + (bounds.isVertical ? 0 : 28),
        y: cy + (bounds.isVertical ? 26 : 12),
        zoom: 1.03,
        focalZ: 0.22,
        aperture: optics.aperture,
        transition: 'glide',
      },
    ];
  }, [bounds.isVertical, height, optics.aperture, width]);

  const nodeEnter = spring({
    frame: frame - 2,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const payloadEnter = spring({
    frame: frame - 18,
    fps,
    config: getStyleSpringConfig(style, 'emphasis'),
  });

  const activeModuleIdx = frame < 100 ? 0 : frame < 200 ? 1 : 2;
  const packetT = Math.max(0, ((frame - 6) % 96) / 96);

  const displayFont = formatFontFamilyCss(
    style.typography.displayFont,
    'display'
  );
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');
  const tagRadius = Math.max(0, Math.round(4 * style.surface.radiusScale));

  const modules = [
    {
      code: 'MOD 01',
      badge: 'WEJŚCIE',
      title: 'Scenariusz JSON',
      sub: 'Walidacja kontraktu scen',
      metric: '60 FPS',
    },
    {
      code: 'MOD 02',
      badge: 'OPTYKA',
      title: 'StyleProvider',
      sub: `Profil: ${style.id}`,
      metric: `f/${(1.4 + (1 - optics.aperture) * 4.2).toFixed(1)}`,
    },
    {
      code: 'MOD 03',
      badge: 'MASTER',
      title: 'Render 60 FPS',
      sub: 'Mastering EBU R128 -14 LUFS',
      metric: '-14 LUFS',
    },
  ];

  const renderCoupler = (idx: number) => {
    const isVert = bounds.isVertical;
    const svgW = isVert ? 36 : 58;
    const svgH = isVert ? 34 : 28;
    const x1 = isVert ? svgW / 2 : 2;
    const y1 = isVert ? 2 : svgH / 2;
    const x2 = isVert ? svgW / 2 : svgW - 2;
    const y2 = isVert ? svgH - 2 : svgH / 2;
    const px = x1 + (x2 - x1) * packetT;
    const py = y1 + (y2 - y1) * packetT;
    const deg = isVert ? 90 : 0;

    return (
      <svg
        key={`coupler-${idx}`}
        data-flow-grammar={grammar}
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ flexShrink: 0, overflow: 'visible' }}
      >
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={style.palette.inkBorder}
          strokeWidth={1.2}
          strokeOpacity={0.42}
        />
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={style.palette.accentPrimary}
          strokeWidth={grammar === 'risograph-poster' ? 3 : 2.2}
        />
        <rect
          x={x1 - 3.5}
          y={y1 - 3.5}
          width={7}
          height={7}
          fill={style.palette.bgSurface}
          stroke={style.palette.accentPrimary}
          strokeWidth={1.6}
        />
        <circle
          cx={x2}
          cy={y2}
          r={3.5}
          fill={style.palette.bgSurface}
          stroke={style.palette.accentPrimary}
          strokeWidth={1.6}
        />
        <g transform={`translate(${px.toFixed(1)}, ${py.toFixed(1)}) rotate(${deg})`}>
          {grammar === 'risograph-poster' ? (
            <polygon
              points="7,0 -6,-5.5 -6,5.5"
              fill={style.palette.accentPrimary}
              stroke={style.palette.inkBorder}
              strokeWidth={1.4}
            />
          ) : grammar === 'optical-gate' ? (
            <>
              <rect
                x={-7}
                y={-3}
                width={14}
                height={6}
                fill={style.palette.accentPrimary}
              />
              <rect x={-3} y={-1.2} width={8} height={2.4} fill="#FFFFFF" />
            </>
          ) : (
            <polygon
              points="7,0 -5,-4.5 -2.5,0 -5,4.5"
              fill={style.palette.accentPrimary}
            />
          )}
        </g>
      </svg>
    );
  };

  return (
    <OpticalStage2D
      shots={shots}
      handheldIntensity={style.motion.cameraHandheld}
      seed={410}
    >
      {/* Background Drafting Sheet Plane */}
      <DepthPlane z={-0.56}>
        <div
          style={{
            position: 'absolute',
            left: bounds.left,
            top: bounds.top,
            width: bounds.width,
            height: bounds.height,
            border: `1px solid ${style.palette.inkBorder}40`,
            backgroundImage: `linear-gradient(to right, ${style.palette.inkBorder}22 1px, transparent 1px), linear-gradient(to bottom, ${style.palette.inkBorder}22 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
            boxSizing: 'border-box',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 18,
              top: 14,
              padding: '4px 10px',
              backgroundColor: style.palette.bgSurface,
              border: `1px solid ${style.palette.inkBorder}`,
              borderLeft: `3px solid ${style.palette.accentPrimary}`,
              fontFamily: monoFont,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.07em',
              color: style.palette.textSecondary,
            }}
          >
            SCHEMAT 01 • ARCHITEKTURA PRZEPŁYWU
          </div>
        </div>
      </DepthPlane>

      {/* Primary Schematic Topology Plane */}
      <DepthPlane z={0} disableFocusBlur>
        <div
          style={{
            position: 'absolute',
            left: bounds.left,
            top: bounds.top + (bounds.isVertical ? 54 : 52),
            width: bounds.width,
            height: bounds.height - (bounds.isVertical ? 230 : 210),
            display: 'flex',
            flexDirection: bounds.isVertical ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: nodeEnter,
          }}
        >
          {modules.map((mod, idx) => {
            const isFocused = idx === activeModuleIdx;
            const blurPx = isFocused
              ? 0
              : computeCircleOfConfusionPx(-0.24, 0, optics.aperture);
            const filterCss =
              blurPx === 0 ? 'none' : `blur(${blurPx.toFixed(2)}px)`;

            return (
              <React.Fragment key={mod.code}>
                <div
                  data-focus-state={isFocused ? 'sharp' : 'recessed'}
                  style={getTactileSurfaceStyle(style, {
                    elevation: isFocused ? 'lifted' : 'resting',
                    overrides: {
                      flex: bounds.isVertical ? undefined : 1,
                      width: bounds.isVertical ? '100%' : undefined,
                      padding: bounds.isVertical ? '18px 22px' : '22px 24px',
                      borderColor: isFocused
                        ? style.palette.accentPrimary
                        : style.palette.inkBorder,
                      position: 'relative',
                      boxSizing: 'border-box',
                      filter: filterCss,
                      opacity: isFocused ? 1 : 0.76,
                      transform: `scale(${isFocused ? 1.015 : 0.985})`,
                    },
                  })}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: grammar === 'risograph-poster' ? 5 : 3,
                      backgroundColor: isFocused
                        ? style.palette.accentPrimary
                        : style.palette.inkBorder,
                    }}
                  />
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: tagRadius,
                        border: `1px solid ${
                          isFocused
                            ? style.palette.accentPrimary
                            : style.palette.inkBorder
                        }`,
                        backgroundColor: style.palette.bgElevated,
                        fontFamily: monoFont,
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        color: isFocused
                          ? style.palette.accentPrimary
                          : style.palette.textSecondary,
                      }}
                    >
                      {mod.code} • {mod.badge}
                    </span>
                    <span
                      style={{
                        fontFamily: monoFont,
                        fontSize: 12,
                        fontWeight: 700,
                        color: style.palette.textSecondary,
                      }}
                    >
                      {mod.metric}
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: displayFont,
                      fontSize: bounds.isVertical ? 26 : 28,
                      fontWeight: 700,
                      color: style.palette.textPrimary,
                      lineHeight: 1.16,
                      marginBottom: 4,
                    }}
                  >
                    {formatHeadingText(mod.title, style)}
                  </div>
                  <div
                    style={{
                      fontFamily: bodyFont,
                      fontSize: 16,
                      color: style.palette.textSecondary,
                    }}
                  >
                    {mod.sub}
                  </div>
                </div>
                {idx < modules.length - 1 && renderCoupler(idx)}
              </React.Fragment>
            );
          })}
        </div>
      </DepthPlane>

      {/* Foreground Tactile Payload Plate */}
      <DepthPlane z={0.28}>
        <div
          data-payload-plate="true"
          style={getTactileSurfaceStyle(style, {
            elevation: 'floating',
            overrides: {
              position: 'absolute',
              left: bounds.left,
              top: bounds.top + bounds.height - (bounds.isVertical ? 148 : 136),
              width: bounds.width,
              boxSizing: 'border-box',
              overflow: 'hidden',
              opacity: payloadEnter,
              transform: `translateY(${interpolate(
                payloadEnter,
                [0, 1],
                [14, 0]
              ).toFixed(1)}px)`,
            },
          })}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 16px',
              backgroundColor: style.palette.bgElevated,
              borderBottom: `1px solid ${style.palette.inkBorder}`,
              borderLeft: `3px solid ${style.palette.accentPrimary}`,
              fontFamily: monoFont,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <span style={{ color: style.palette.textPrimary }}>
              POST /v1/render/commit
            </span>
            <span style={{ color: style.palette.accentSecondary }}>
              14ms • DETERMINISTIC
            </span>
          </div>
          <div
            style={{
              padding: '12px 16px',
              fontFamily: monoFont,
              fontSize: 15,
              color: style.palette.textPrimary,
              display: 'flex',
              gap: 14,
            }}
          >
            <span style={{ color: style.palette.textSecondary, opacity: 0.6 }}>
              01
            </span>
            <span>
              <span style={{ color: style.palette.accentPrimary, fontWeight: 700 }}>
                {'"grammar"'}
              </span>
              {': '}
              <span style={{ color: style.palette.accentSecondary }}>
                {`"${grammar}"`}
              </span>
              {', '}
              <span style={{ color: style.palette.accentPrimary, fontWeight: 700 }}>
                {'"rig"'}
              </span>
              {': '}
              <span style={{ color: style.palette.accentSecondary }}>
                {`"${optics.lightingRig}"`}
              </span>
            </span>
          </div>
        </div>
      </DepthPlane>
    </OpticalStage2D>
  );
};
```

3. Replace `Isometric3DPreview` in `packages/studio/src/client/components/StyleLabShowcase.tsx` (zero `three` imports, zero `frame * 0.22` bounce!) with:

```tsx
const Isometric3DPreview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const optics = resolveStyleOptics(style);
  const bounds = getSafeStageBounds(width, height);

  const isoMaterial: 'ceramic-maquette' | 'anodized-telemetry' | 'ink-figurine' =
    style.surface.cardTreatment === 'brutalist-hard' ||
    style.id === 'tactile-craft' ||
    style.id === 'sketch-notebook'
      ? 'ink-figurine'
      : style.surface.isDark
        ? 'anodized-telemetry'
        : 'ceramic-maquette';

  const shots = useMemo<ReadonlyArray<OpticalShot2D>>(() => {
    const cx = width / 2;
    const cy = height / 2;
    return [
      {
        fromFrame: 2,
        x: cx,
        y: cy,
        zoom: 1,
        focalZ: 0,
        aperture: optics.aperture,
        transition: 'cut',
      },
      {
        fromFrame: 150,
        x: cx + (bounds.isVertical ? 0 : 20),
        y: cy - 8,
        zoom: 1.035,
        focalZ: 0,
        aperture: optics.aperture,
        transition: 'glide',
      },
    ];
  }, [bounds.isVertical, height, optics.aperture, width]);

  const stageEnter = spring({
    frame: frame - 2,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });

  const speakerASpeaking = frame < 150;
  // Strictly inside 0.03..0.055 rad/frame calm studio cadence (zero vertical bounce)
  const breathA = Math.sin(frame * 0.042);
  const breathB = Math.sin(frame * 0.039 + 1.4);
  const syllableMod =
    0.42 + 0.32 * Math.sin(frame * 0.052) + 0.18 * Math.cos(frame * 0.036);

  const displayFont = formatFontFamilyCss(
    style.typography.displayFont,
    'display'
  );
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');

  const bodyFill =
    isoMaterial === 'anodized-telemetry' ? style.palette.bgElevated : style.palette.bgSurface;
  const strokeInk = style.palette.inkBorder;
  const strokeWidth = isoMaterial === 'ink-figurine' ? 3 : 1.8;

  const renderMaquetteFigure = (
    cx: number,
    cy: number,
    primary: string,
    secondary: string,
    isSpeaking: boolean,
    breath: number
  ) => {
    const blurPx = isSpeaking
      ? 0
      : computeCircleOfConfusionPx(-0.18, 0, optics.aperture);
    const filterCss = blurPx === 0 ? 'none' : `blur(${blurPx.toFixed(2)}px)`;
    const headTiltDeg = (isSpeaking ? 2.2 : -1.2) + breath * 1.4;

    return (
      <g
        transform={`translate(${cx}, ${cy})`}
        style={{ filter: filterCss, opacity: isSpeaking ? 1 : 0.84 }}
      >
        {/* Ground Contact Shadow Ellipse */}
        <ellipse
          cx={0}
          cy={76}
          rx={52}
          ry={15}
          fill="#0F172A"
          opacity={style.surface.isDark ? 0.52 : 0.2}
        />
        {/* Calibrated Speaker Plinth Ring */}
        <ellipse
          cx={0}
          cy={76}
          rx={56}
          ry={17}
          fill="none"
          stroke={isSpeaking ? primary : strokeInk}
          strokeWidth={isSpeaking ? 2.6 : 1.4}
          opacity={isSpeaking ? 0.92 : 0.45}
        />

        {/* Chamfered Architectural Torso Column */}
        <path
          d="M -32,68 L -26,-6 Q -24,-18 -12,-18 L 12,-18 Q 24,-18 26,-6 L 32,68 Z"
          fill={primary}
          stroke={strokeInk}
          strokeWidth={strokeWidth}
        />
        {/* Lapel / Chest Plate */}
        <rect
          x={-16}
          y={-6}
          width={32}
          height={22}
          rx={isoMaterial === 'ink-figurine' ? 0 : 4}
          fill={bodyFill}
          stroke={strokeInk}
          strokeWidth={1.4}
        />
        <rect x={-11} y={1} width={22} height={4} fill={secondary} />

        {/* Sculpted Head Maquette (zero spherical ear muffs) */}
        <g transform={`translate(0, -54) rotate(${headTiltDeg.toFixed(2)})`}>
          <rect
            x={-28}
            y={-28}
            width={56}
            height={52}
            rx={isoMaterial === 'ink-figurine' ? 4 : 18}
            fill={bodyFill}
            stroke={strokeInk}
            strokeWidth={strokeWidth}
          />
          {isoMaterial === 'ceramic-maquette' ? (
            <>
              <rect x={-18} y={-8} width={36} height={4.5} fill={secondary} />
              <rect
                x={-9}
                y={6}
                width={18}
                height={isSpeaking ? 3 + syllableMod * 4 : 2.2}
                fill={style.palette.textPrimary}
                opacity={isSpeaking ? 0.9 : 0.45}
              />
            </>
          ) : isoMaterial === 'anodized-telemetry' ? (
            <>
              <rect
                x={-21}
                y={-11}
                width={42}
                height={18}
                rx={5}
                fill="#070B12"
                stroke={secondary}
                strokeWidth={1.2}
              />
              {[-8, 0, 8].map((bx, bIdx) => {
                const bh = isSpeaking
                  ? 4 + syllableMod * (bIdx === 1 ? 8 : 5)
                  : 2.5;
                return (
                  <rect
                    key={bIdx}
                    x={bx - 2}
                    y={-2 - bh / 2}
                    width={4}
                    height={bh}
                    fill={isSpeaking ? secondary : primary}
                  />
                );
              })}
            </>
          ) : (
            <>
              <rect x={-20} y={-11} width={40} height={14} fill="#111111" />
              <rect x={-12} y={-6} width={6} height={4} fill={style.palette.bgSurface} />
              <rect x={6} y={-6} width={6} height={4} fill={style.palette.bgSurface} />
              <rect
                x={-8}
                y={8}
                width={16}
                height={isSpeaking ? 3 + syllableMod * 4 : 2.5}
                fill={secondary}
              />
            </>
          )}
        </g>
      </g>
    );
  };

  const ticks = Array.from({ length: 24 }, (_, idx) => {
    const rad = (idx / 24) * Math.PI * 2;
    const isMajor = idx % 6 === 0;
    const rOuterX = 290;
    const rOuterY = 78;
    const rInnerX = isMajor ? 268 : 278;
    const rInnerY = isMajor ? 71 : 74;
    return {
      idx,
      isMajor,
      x1: 360 + Math.cos(rad) * rInnerX,
      y1: 210 + Math.sin(rad) * rInnerY,
      x2: 360 + Math.cos(rad) * rOuterX,
      y2: 210 + Math.sin(rad) * rOuterY,
    };
  });

  return (
    <OpticalStage2D
      shots={shots}
      handheldIntensity={style.motion.cameraHandheld}
      seed={520}
    >
      {/* Background Studio Key-Beam & Metadata Header */}
      <DepthPlane z={-0.54}>
        <div
          style={{
            position: 'absolute',
            left: bounds.left,
            top: bounds.top,
            width: bounds.width,
            height: bounds.height,
            opacity: stageEnter,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(${
                optics.lightAngleDeg + 90
              }deg, ${style.palette.accentPrimary}18 0%, transparent 62%)`,
              border: `1px solid ${style.palette.inkBorder}38`,
            }}
          />
          <div style={{ padding: '20px 24px' }}>
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: style.palette.accentPrimary,
                marginBottom: 6,
              }}
            >
              SCENA 3D • MAKIETA ARCHITEKTONICZNA ({isoMaterial.toUpperCase()})
            </div>
            <div
              style={{
                fontFamily: bodyFont,
                fontSize: 20,
                color: style.palette.textSecondary,
              }}
            >
              Głos: <strong>{style.audioDefaults.voiceArchetype}</strong> •
              Światło kierunkowe: <strong>{optics.lightAngleDeg}°</strong>
            </div>
          </div>
        </div>
      </DepthPlane>

      {/* Primary Calibrated 3D Turntable Plinth & Maquette Figures */}
      <DepthPlane z={0} disableFocusBlur>
        <div
          data-iso-material={isoMaterial}
          data-iso-plinth="calibrated-24"
          style={{
            position: 'absolute',
            left: bounds.left,
            top: bounds.top + (bounds.isVertical ? 96 : 74),
            width: bounds.width,
            height: bounds.height - (bounds.isVertical ? 110 : 84),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: stageEnter,
          }}
        >
          <svg
            viewBox="0 0 720 320"
            style={{
              width: '100%',
              maxWidth: bounds.isVertical ? 760 : 880,
              height: bounds.isVertical ? 420 : 390,
              overflow: 'visible',
            }}
          >
            {/* Outer Base Bevel */}
            <ellipse
              cx={360}
              cy={224}
              rx={308}
              ry={84}
              fill={style.palette.bgElevated}
              stroke={strokeInk}
              strokeWidth={2}
            />
            {/* Upper Calibrated Turntable Deck */}
            <ellipse
              cx={360}
              cy={210}
              rx={294}
              ry={80}
              fill={style.palette.bgSurface}
              stroke={strokeInk}
              strokeWidth={2}
            />
            {/* Inner Acoustic Ring */}
            <ellipse
              cx={360}
              cy={210}
              rx={208}
              ry={55}
              fill="none"
              stroke={style.palette.accentPrimary}
              strokeWidth={1.4}
              strokeOpacity={0.55}
            />
            {/* 24 Engraved Degree Ticks */}
            {ticks.map((t) => (
              <line
                key={t.idx}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={
                  t.isMajor ? style.palette.accentPrimary : strokeInk
                }
                strokeWidth={t.isMajor ? 2.2 : 1.2}
                strokeOpacity={t.isMajor ? 0.85 : 0.45}
              />
            ))}

            {renderMaquetteFigure(
              235,
              126,
              style.palette.accentPrimary,
              style.palette.accentSecondary,
              speakerASpeaking,
              breathA
            )}
            {renderMaquetteFigure(
              485,
              126,
              style.palette.accentSecondary,
              style.palette.accentPrimary,
              !speakerASpeaking,
              breathB
            )}
          </svg>

          {/* Speaker Nameplates */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: bounds.isVertical ? 'column' : 'row',
              gap: 18,
            }}
          >
            {[
              {
                name: 'Prowadząca',
                role: 'GŁOS GŁÓWNY',
                color: style.palette.accentPrimary,
                active: speakerASpeaking,
              },
              {
                name: 'Gość studia',
                role: 'KOMENTARZ',
                color: style.palette.accentSecondary,
                active: !speakerASpeaking,
              },
            ].map((sp) => (
              <div
                key={sp.name}
                style={getTactileSurfaceStyle(style, {
                  elevation: sp.active ? 'lifted' : 'resting',
                  overrides: {
                    flex: 1,
                    padding: '16px 22px',
                    borderColor: sp.active ? sp.color : style.palette.inkBorder,
                    borderLeft: `4px solid ${
                      sp.active ? sp.color : style.palette.inkBorder
                    }`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxSizing: 'border-box',
                  },
                })}
              >
                <div>
                  <div
                    style={{
                      fontFamily: displayFont,
                      fontSize: 24,
                      fontWeight: 700,
                      color: style.palette.textPrimary,
                    }}
                  >
                    {formatHeadingText(sp.name, style)}
                  </div>
                  <div
                    style={{
                      fontFamily: monoFont,
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      color: sp.active ? sp.color : style.palette.textSecondary,
                    }}
                  >
                    {sp.active ? '▪ AKTYWNA WYPOWIEDŹ' : sp.role}
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: monoFont,
                    fontSize: 12,
                    color: style.palette.textSecondary,
                  }}
                >
                  0.042 rad/kl
                </span>
              </div>
            ))}
          </div>
        </div>
      </DepthPlane>
    </OpticalStage2D>
  );
};
```

4. In `StyleLabPreviewComposition` inside `packages/studio/src/client/components/StyleLabShowcase.tsx`, update `usesOpticalStage` so `motion-diagrams-2d` and `isometric-3d` receive `<StageLightingRig />` and zero redundant outer drift:

```tsx
  const usesOpticalStage =
    kit === 'editorial-collage' ||
    kit === 'kinetic-typography' ||
    kit === 'vector-scene-2d' ||
    kit === 'data-storytelling' ||
    kit === 'motion-diagrams-2d' ||
    kit === 'isometric-3d';
```

- [ ] **Step 4: Upgrade `motion-diagrams-2d` and `isometric-3d` templates in `packages/cli/src/commands/new-production.ts`**

In `packages/cli/src/commands/new-production.ts`, replace `case 'motion-diagrams-2d':` (lines 648–819) with:

```ts
    case 'motion-diagrams-2d':
      return `import React from 'react';
import {
  AbsoluteFill,
  staticFile,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import {
  SmartMusicBed,
  SoundCue,
  StyleProvider,
  VoiceoverTrack,
  useStudioStyle,
} from '@make-pictures/core';
import {
  CodePayloadToast,
  FlowCurve,
  MotionDiagramStage2D,
  SystemNode,
  portBottom,
  portLeft,
  portRight,
  portTop,
  type NodeBox,
} from '@make-pictures/kits/motion-diagrams-2d';
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

const HORIZONTAL_NODES = {
  source: { cx: 560, cy: 460, w: 430, h: 196 },
  target: { cx: 1360, cy: 460, w: 430, h: 196 },
  payload: { cx: 1360, cy: 730, w: 430, h: 168 },
} satisfies Record<string, NodeBox>;

const VERTICAL_NODES = {
  source: { cx: 475, cy: 580, w: 620, h: 188 },
  target: { cx: 475, cy: 860, w: 620, h: 188 },
  payload: { cx: 475, cy: 1120, w: 620, h: 164 },
} satisfies Record<string, NodeBox>;

const DiagramCanvas: React.FC<${pascalName}Props> = (props) => {
  const { width, height } = useVideoConfig();
  const style = useStudioStyle();
  const isVertical = height > width;
  const nodes = isVertical ? VERTICAL_NODES : HORIZONTAL_NODES;

  return (
    <MotionDiagramStage2D
      diagramCode={\`\${props.badgeLabel} • 60 FPS\`}
      renderBaseFill={false}
      nodes={nodes}
      shots={[
        {
          fromFrame: 0,
          target: ['source', 'target'],
          transition: 'cut',
          padding: isVertical ? 120 : 140,
        },
        {
          fromFrame: 320,
          target: ['target', 'payload'],
          transition: 'glide',
          padding: isVertical ? 120 : 150,
        },
      ]}
      handheldIntensity={style.motion.cameraHandheld}
    >
      <FlowCurve
        from={isVertical ? portBottom(nodes.source) : portRight(nodes.source)}
        to={isVertical ? portTop(nodes.target) : portLeft(nodes.target)}
        orientation={isVertical ? 'vertical' : 'horizontal'}
        curveY={isVertical ? 0 : -44}
        color={props.accentColor}
        activeFromFrame={18}
        packetSpeedFrames={96}
      />

      <SystemNode
        id="source"
        moduleCode="MOD 01"
        badge={props.badgeLabel}
        title={props.headline}
        subtitle="Wejście deterministycznego potoku"
        statusText="Gotowość 60 FPS"
        activeStatusText="Transmisja aktywna"
        x={nodes.source.cx}
        y={nodes.source.cy}
        width={nodes.source.w}
        height={nodes.source.h}
        accentColor={props.accentColor}
        enterFrame={4}
        activeRanges={[[12, 310]]}
      />

      <SystemNode
        id="target"
        moduleCode="MOD 02"
        badge="MASTER"
        title="Silnik wyjściowy"
        subtitle={props.subheadline}
        statusText="Oczekiwanie"
        activeStatusText="Zapis -14 LUFS"
        x={nodes.target.cx}
        y={nodes.target.cy}
        width={nodes.target.w}
        height={nodes.target.h}
        accentColor={props.secondaryColor}
        enterFrame={14}
        activeRanges={[[120, 620]]}
        metricsLabel="LUFS"
        metricsValue="-14.0"
      />

      <CodePayloadToast
        x={nodes.payload.cx}
        y={nodes.target.cy + nodes.target.h / 2 + 24}
        width={nodes.payload.w}
        methodBadge="POST"
        endpoint="/v1/studio/commit"
        latencyText="14ms"
        code={\`{\\n  "style": "\${props.styleId}",\\n  "fps": 60\\n}\`}
        accentColor={props.accentColor}
        startFrame={332}
        endFrame={624}
      />
    </MotionDiagramStage2D>
  );
};

export const ${pascalName}: React.FC<${pascalName}Props> = (props) => {
  const introVo = VOICEOVER_MANIFEST['${slug}-intro'];
  const payoffVo = VOICEOVER_MANIFEST['${slug}-payoff'];
  const whooshSfx = SFX_MANIFEST['whoosh-open'];
  const popSfx = SFX_MANIFEST['card-pop'];

  return (
    <StyleProvider style={props.styleId} renderBackdrop>
      <AbsoluteFill>
        ${audioBlock}
        <DiagramCanvas {...props} />
      </AbsoluteFill>
    </StyleProvider>
  );
};
`;
```

And in `packages/cli/src/commands/new-production.ts`, replace `case 'isometric-3d':` (lines 968–1089) with:

```ts
    case 'isometric-3d':
      return `import { ThreeCanvas } from '@remotion/three';
import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import {
  DirectorCamera3D,
  SPRING_PRESETS,
  SmartMusicBed,
  SoundCue,
  StyleProvider,
  VoiceoverTrack,
  formatFontFamilyCss,
  formatHeadingText,
  getTactileSurfaceStyle,
  useStudioStyle,
} from '@make-pictures/core';
import {
  IsometricStage3D,
  Stylized3DCharacter,
} from '@make-pictures/kits/isometric-3d';
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

const IsometricDialogueScene: React.FC<${pascalName}Props> = (props) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const isVertical = height > width;

  if (frame < 2) {
    return null;
  }

  const stageReveal = spring({
    frame: frame - 2,
    fps,
    config: SPRING_PRESETS.snappy,
  });

  const turnSwitch = spring({
    frame: frame - 320,
    fps,
    config: SPRING_PRESETS.smooth,
  });

  const speakerAWeight = interpolate(turnSwitch, [0, 1], [1, 0]);
  const speakerBWeight = interpolate(turnSwitch, [0, 1], [0, 1]);
  // Calm <= 0.055 rad/frame syllable envelope fallback before real TTS words
  const cadencePulse =
    0.42 + 0.28 * Math.sin(frame * 0.048) + 0.16 * Math.cos(frame * 0.036);

  return (
    <AbsoluteFill style={{ opacity: stageReveal }}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows
        camera={{ position: [0, 4.4, 8.8], fov: 35 }}
      >
        <DirectorCamera3D
          safeBox9x16Compensation
          handheldIntensity={style.motion.cameraHandheld}
          anchors={{
            speakerA: { position: [-1.5, 0, 0.2], height: 1.55 },
            speakerB: { position: [1.5, 0, 0.2], height: 1.55 },
          }}
          shots={[
            {
              fromFrame: 0,
              shot: 'medium-two-shot',
              target: 'speakerA',
              secondaryTarget: 'speakerB',
              transition: 'cut',
            },
            {
              fromFrame: 320,
              shot: 'medium',
              target: 'speakerB',
              secondaryTarget: 'speakerA',
              transition: 'glide',
            },
          ]}
        />
        <IsometricStage3D
          radius={5.2}
          showGrid
          accentColor={props.accentColor}
        >
          <Stylized3DCharacter
            position={[-1.5, 0, 0.2]}
            rotationY={0.42}
            primaryColor={props.accentColor}
            accentColor={props.secondaryColor}
            speechEnergy={cadencePulse * speakerAWeight}
            speakingWeight={speakerAWeight}
            gestureWeights={{
              presentRight: speakerAWeight * 0.65,
              listenNod: speakerBWeight * 0.5,
            }}
            enterFrame={4}
          />
          <Stylized3DCharacter
            position={[1.5, 0, 0.2]}
            rotationY={-0.42}
            primaryColor={props.secondaryColor}
            accentColor={props.accentColor}
            speechEnergy={cadencePulse * speakerBWeight}
            speakingWeight={speakerBWeight}
            gestureWeights={{
              presentLeft: speakerBWeight * 0.65,
              listenNod: speakerAWeight * 0.5,
            }}
            enterFrame={10}
          />
        </IsometricStage3D>
      </ThreeCanvas>

      {/* Architectural Conversation Nameplate (strictly inside 9:16 Safe Box) */}
      <div
        style={getTactileSurfaceStyle(style, {
          elevation: 'resting',
          overrides: {
            position: 'absolute',
            left: isVertical ? 76 : 72,
            top: isVertical ? 256 : 56,
            width: isVertical ? 788 : 560,
            padding: '14px 20px',
            borderLeft: \`4px solid \${
              frame < 320 ? props.accentColor : props.secondaryColor
            }\`,
            boxSizing: 'border-box',
            pointerEvents: 'none',
          },
        })}
      >
        <div
          style={{
            fontFamily: formatFontFamilyCss(style.typography.monoFont, 'mono'),
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.07em',
            color: frame < 320 ? props.accentColor : props.secondaryColor,
            marginBottom: 4,
          }}
        >
          {props.badgeLabel} • {frame < 320 ? 'GŁOS 01' : 'GŁOS 02'}
        </div>
        <div
          style={{
            fontFamily: formatFontFamilyCss(
              style.typography.displayFont,
              'display'
            ),
            fontSize: isVertical ? 26 : 28,
            fontWeight: 700,
            color: style.palette.textPrimary,
            lineHeight: 1.18,
          }}
        >
          {formatHeadingText(
            frame < 320 ? props.headline : props.subheadline,
            style
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const ${pascalName}: React.FC<${pascalName}Props> = (props) => {
  const introVo = VOICEOVER_MANIFEST['${slug}-intro'];
  const payoffVo = VOICEOVER_MANIFEST['${slug}-payoff'];
  const whooshSfx = SFX_MANIFEST['whoosh-open'];
  const popSfx = SFX_MANIFEST['card-pop'];

  return (
    <StyleProvider style={props.styleId} renderBackdrop>
      <AbsoluteFill>
        ${audioBlock}
        <IsometricDialogueScene {...props} />
      </AbsoluteFill>
    </StyleProvider>
  );
};
`;
```

- [ ] **Step 5: Build packages, run `typecheck`, and run the full unit/SSR test suite**

Run: `npm run sync:skills && npm run build:packages && npm run typecheck && npm test`
Expected: PASS (`0` TypeScript errors, all tests green including `wave3-motion-diagrams.test.ts`, `wave3-isometric-3d.test.ts`, `studio-styles-api.test.ts`, `styles-cli.test.ts`, `kits-style-integration.test.ts`, `demo-precision-layout.test.ts`).

- [ ] **Step 6: Run `16:9` + `9:16` Contact-Sheet QA for both `motion-diagrams-2d` and `isometric-3d`, inspect all 4 PNGs, and clean up temporary capsules**

Execute:

```bash
npm run new -- qa-wave3-diagrams --kit=motion-diagrams-2d --style=cyber-telemetry --lang=pl
npm run new -- qa-wave3-isometric --kit=isometric-3d --style=editorial-press --lang=pl
npm run qa -- QaWave3Diagrams --out=out/qa-wave3-diagrams-16x9.png
npm run qa -- QaWave3Isometric --out=out/qa-wave3-isometric-16x9.png
```

Then switch both temporary capsules' `productions/qa-wave3-*/index.ts` from `width: 1920, height: 1080` to `width: 1080, height: 1920` and run:

```bash
npm run qa -- QaWave3Diagrams --out=out/qa-wave3-diagrams-9x16.png
npm run qa -- QaWave3Isometric --out=out/qa-wave3-isometric-9x16.png
```

Inspect all 4 generated contact sheets (`out/qa-wave3-diagrams-16x9.png`, `out/qa-wave3-diagrams-9x16.png`, `out/qa-wave3-isometric-16x9.png`, `out/qa-wave3-isometric-9x16.png`) via `read_file` to verify:
1. `f=0` is pure `palette.bgCanvas` with zero visible cards, lines, or 3D geometry.
2. Polish `latin-ext` typography renders cleanly in Sentence case with zero clipping.
3. `motion-diagrams-2d` exhibits calibrated schematic terminals, tangent-aligned couriers, and optical rack focus in Act 2 (`f>=324`) with `CodePayloadToast` cleanly framed.
4. `isometric-3d` exhibits sculptural ceramic-maquette silhouettes, directional key-light shadows across the 24-tick plinth, smooth two-shot -> single-shot camera glide, and zero plastic toy spheres or neon rings.
5. Both `9:16` sheets keep all cards, stamps, nameplates, and characters strictly inside the green **Golden Safe Box (`x ∈ [40, 910], y ∈ [220, 1380]`)**.

Archive the 4 inspected PNGs to `/Users/pawelbart/.gemini/antigravity/brain/b3066e38-f666-4732-bcd7-75e6e6813a14/scratch/` and remove the temporary capsules and `out/qa-wave3-*.png`:

```bash
mkdir -p /Users/pawelbart/.gemini/antigravity/brain/b3066e38-f666-4732-bcd7-75e6e6813a14/scratch
cp out/qa-wave3-*.png /Users/pawelbart/.gemini/antigravity/brain/b3066e38-f666-4732-bcd7-75e6e6813a14/scratch/
rm -rf productions/qa-wave3-diagrams productions/qa-wave3-isometric public/_productions/qa-wave3-diagrams public/_productions/qa-wave3-isometric out/qa-wave3-*.png
```

- [ ] **Step 7: Run `npm run pack:verify` and commit Task 4**

Run: `npm run pack:verify && npm test`
Expected: PASS (`pack:verify` validates clean tarball packaging of `@make-pictures/core`, `@make-pictures/kits`, `@make-pictures/studio`, `@make-pictures/cli`, and `create-make-pictures`; all tests pass).

Commit Task 4:

```bash
git add packages/studio/src/client/components/StyleLabShowcase.tsx packages/cli/src/commands/new-production.ts packages/cli/tests/studio-styles-api.test.ts packages/cli/tests/styles-cli.test.ts
git commit -m "feat(studio,cli): add Wave 3 optical Style Lab previews and new-production scaffolds"
```
