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
    const recessedNodeTag = f64.match(/<div[^>]*data-focus-state="recessed"[^>]*>/)?.[0] ?? '';
    const sharpNodeTag = f64.match(/<div[^>]*data-focus-state="sharp"[^>]*>/)?.[0] ?? '';
    assert.ok(recessedNodeTag.length > 0, 'Expected a recessed node tag at frame 64');
    assert.ok(sharpNodeTag.length > 0, 'Expected a sharp node tag at frame 64');
    assert.match(recessedNodeTag, /(?:^|;|")filter:blur\(/);
    assert.doesNotMatch(sharpNodeTag, /(?:^|;|")filter:blur\(/);
    assert.match(sharpNodeTag, /(?:^|;|")filter:none/);
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
          { focusedNodeIds: ['only-sharp'], renderLighting: false },
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
    const recessedZeroTag = html.match(/<div[^>]*data-focus-state="recessed"[^>]*>/)?.[0] ?? '';
    assert.ok(recessedZeroTag.length > 0);
    assert.doesNotMatch(recessedZeroTag, /(?:^|;|")filter:blur\(/);
    assert.match(recessedZeroTag, /(?:^|;|")filter:none/);
    assert.doesNotMatch(html, /(?:^|;|")filter:blur\(/);
  }
});
