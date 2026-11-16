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
  RetroPcWindowStage2D,
  SystemNode,
  WorldBox,
  computeRetroPcWindowLayout,
  evaluateCubicBezier,
  portLeft,
  portRight,
  resolvePayloadTokenColors,
  type NodeBox,
  type RetroPcHopSpec,
} from '../../kits/src/motion-diagrams-2d';
import { ScreenSpotlightOverlay } from '../../kits/src/product-frames';
import { scanTsxForUnclippedCardBars } from '../src/director/audit-direction';

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

  // Zero-aperture deadzone (< 0.25px -> filter: 'none' even when recessed) across all 10 styles
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

test('RetroPcWindowStage2D enforces Clean Frame 0, offline symbolic safety, 16:9 & 9:16 Golden Safe Box geometry, and deterministic packet progress', () => {
  assert.equal(typeof RetroPcWindowStage2D, 'function');
  assert.equal(typeof computeRetroPcWindowLayout, 'function');
  assert.equal(kitsRoot.RetroPcWindowStage2D, RetroPcWindowStage2D);

  const retroSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/motion-diagrams-2d/RetroPcWindowStage2D.tsx'),
    'utf8'
  );
  assert.doesNotMatch(retroSrc, /Math\.random\s*\(/, 'RetroPcWindowStage2D must not use Math.random');
  assert.doesNotMatch(retroSrc, /useRef\b/, 'RetroPcWindowStage2D must not use mutable useRef');
  assert.doesNotMatch(retroSrc, /radii\.pill|9999/, 'RetroPcWindowStage2D must not use pill radii');
  assert.doesNotMatch(retroSrc, /\bfetch\s*\(|XMLHttpRequest/, 'RetroPcWindowStage2D must never make network calls');
  assert.doesNotMatch(
    retroSrc,
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
    'RetroPcWindowStage2D must never embed IPv4 literals'
  );
  assert.match(retroSrc, /ClippedSurfaceChrome/);
  assert.match(retroSrc, /frame\s*<=\s*0/);
  assert.equal(
    scanTsxForUnclippedCardBars(retroSrc, 'RetroPcWindowStage2D.tsx').length,
    0,
    'RetroPcWindowStage2D must have zero unclipped card top bars'
  );

  const sampleHops: ReadonlyArray<RetroPcHopSpec> = [
    {
      id: 'browser',
      title: 'Twoja przeglądarka',
      subtitle: 'Wysyła zapytanie o adres',
      badge: 'KROK 01',
      latencyMs: 4,
      icon: 'browser',
    },
    {
      id: 'directory',
      title: 'Serwer nazw',
      subtitle: 'Tłumaczy nazwę domeny',
      badge: 'KROK 02',
      latencyMs: 6,
      icon: 'directory',
    },
    {
      id: 'server',
      title: 'Serwer strony',
      subtitle: 'Zwraca gotowy dokument',
      badge: 'KROK 03',
      latencyMs: 8,
      icon: 'server',
    },
  ];

  // Verify 9:16 Golden Safe Box bounds: x in [40, 910], y in [220, 1380]
  const vertLayout = computeRetroPcWindowLayout({
    viewportWidth: 1080,
    viewportHeight: 1920,
    isVertical: true,
    hopCount: sampleHops.length,
  });
  assert.equal(vertLayout.isVertical, true);
  assert.ok(vertLayout.windowLeft >= 40, `Expected left >= 40, got ${vertLayout.windowLeft}`);
  assert.ok(
    vertLayout.windowLeft + vertLayout.windowWidth <= 910,
    `Expected right <= 910, got ${vertLayout.windowLeft + vertLayout.windowWidth}`
  );
  assert.ok(vertLayout.windowTop >= 220, `Expected top >= 220, got ${vertLayout.windowTop}`);
  assert.ok(
    vertLayout.windowTop + vertLayout.windowHeight <= 1380,
    `Expected bottom <= 1380, got ${vertLayout.windowTop + vertLayout.windowHeight}`
  );
  assert.equal(vertLayout.hopBoxes.length, 3);
  // Vertically stacked hops strictly increase in cy without overlap
  assert.ok(
    vertLayout.hopBoxes[0]!.cy + vertLayout.hopBoxes[0]!.h / 2 <
      vertLayout.hopBoxes[1]!.cy - vertLayout.hopBoxes[1]!.h / 2
  );
  assert.ok(
    vertLayout.hopBoxes[1]!.cy + vertLayout.hopBoxes[1]!.h / 2 <
      vertLayout.hopBoxes[2]!.cy - vertLayout.hopBoxes[2]!.h / 2
  );

  // Verify 16:9 horizontal 3-hop row layout
  const horizLayout = computeRetroPcWindowLayout({
    viewportWidth: 1920,
    viewportHeight: 1080,
    isVertical: false,
    hopCount: sampleHops.length,
  });
  assert.equal(horizLayout.isVertical, false);
  assert.equal(horizLayout.hopBoxes.length, 3);
  assert.ok(
    horizLayout.hopBoxes[0]!.cx + horizLayout.hopBoxes[0]!.w / 2 <
      horizLayout.hopBoxes[1]!.cx - horizLayout.hopBoxes[1]!.w / 2
  );
  assert.ok(
    horizLayout.hopBoxes[1]!.cx + horizLayout.hopBoxes[1]!.w / 2 <
      horizLayout.hopBoxes[2]!.cx - horizLayout.hopBoxes[2]!.w / 2
  );

  const makeScene = (progress: number, isVertical = false) => {
    const SceneComp: React.FC = () =>
      React.createElement(
        StyleProvider,
        { style: 'cyber-telemetry', renderBackdrop: false },
        React.createElement(RetroPcWindowStage2D, {
          windowTitle: 'Monitor zapytania sieciowego',
          addressLabel: 'https://twoja-strona.pl',
          hops: sampleHops,
          statusBanner: '200 OK • Strona gotowa w 18 ms',
          progress,
          isVertical,
          enterFrame: 2,
        })
      );
    return SceneComp;
  };

  // Frame 0: Clean Frame 0 invariant
  const f0Html = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: makeScene(0.5, false),
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 120,
      fps: 60,
      frameToDisplay: 0,
    })
  );
  assert.doesNotMatch(f0Html, /data-retro-pc-window/);
  assert.doesNotMatch(f0Html, /Monitor zapytania sieciowego/);
  assert.doesNotMatch(f0Html, /twoja-strona\.pl/);

  // Mid-flight frame (progress = 0.45) in 16:9
  const midHtmlA = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: makeScene(0.45, false),
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 120,
      fps: 60,
      frameToDisplay: 36,
    })
  );
  const midHtmlB = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: makeScene(0.45, false),
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 120,
      fps: 60,
      frameToDisplay: 36,
    })
  );
  assert.equal(midHtmlA, midHtmlB, 'RetroPcWindowStage2D must render deterministically');
  assert.match(midHtmlA, /data-retro-pc-window="true"/);
  assert.match(midHtmlA, /data-retro-titlebar="true"/);
  assert.match(midHtmlA, /data-retro-address-bar="true"/);
  assert.match(midHtmlA, /data-retro-packet="true"/);
  assert.match(midHtmlA, /GET/);
  assert.match(midHtmlA, /https:\/\/twoja-strona\.pl/);
  assert.match(midHtmlA, /Twoja przeglądarka/);
  assert.match(midHtmlA, /Serwer nazw/);
  assert.match(midHtmlA, /Serwer strony/);
  assert.match(midHtmlA, /data-retro-status-complete="false"/);

  // Completed response (progress = 0.95) in 9:16 vertical mode
  const doneVertHtml = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: makeScene(0.95, true),
      compositionWidth: 1080,
      compositionHeight: 1920,
      durationInFrames: 120,
      fps: 60,
      frameToDisplay: 48,
    })
  );
  assert.match(doneVertHtml, /data-retro-layout="vertical"/);
  assert.match(doneVertHtml, /data-retro-status-complete="true"/);
  assert.match(doneVertHtml, /200 OK • Strona gotowa w 18 ms/);
});

test('RetroPcWindowStage2D renders bilingual chrome labels for lang="en" vs lang="pl"', () => {
  const hopsEn: ReadonlyArray<RetroPcHopSpec> = [
    {
      id: 'browser',
      title: 'Your browser',
      subtitle: 'Sends page request',
      badge: 'STEP 01',
      latencyMs: 3,
      icon: 'browser',
    },
    {
      id: 'directory',
      title: 'Name directory',
      subtitle: 'Resolves target route',
      badge: 'STEP 02',
      latencyMs: 5,
      icon: 'directory',
    },
    {
      id: 'server',
      title: 'App server',
      subtitle: 'Returns live page',
      badge: 'STEP 03',
      latencyMs: 9,
      icon: 'server',
    },
  ];

  const renderWithLang = (lang: 'pl' | 'en', progress: number) => {
    const Probe: React.FC = () =>
      React.createElement(
        StyleProvider,
        { style: 'retro-pc', renderBackdrop: false },
        React.createElement(RetroPcWindowStage2D, {
          windowTitle: 'Packet Inspector',
          addressLabel: 'GET https://example.app',
          hops: hopsEn,
          statusBanner: '200 OK • Ready in 17 ms',
          progress,
          lang,
          enterFrame: 2,
        })
      );
    return renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: Probe,
        compositionWidth: 1920,
        compositionHeight: 1080,
        durationInFrames: 120,
        fps: 60,
        frameToDisplay: 36,
      })
    );
  };

  const midEn = renderWithLang('en', 0.45);
  assert.match(midEn, /\bREADY\b/);
  assert.match(midEn, /\bACTIVE\b/);
  assert.match(midEn, /\bWAITING\b/);
  assert.doesNotMatch(midEn, /\bGOTOWY\b|\bAKTYWNY\b|\bOCZEKUJE\b/);

  const doneEn = renderWithLang('en', 0.95);
  assert.match(doneEn, /\bDONE\b/);
  assert.doesNotMatch(doneEn, /\bGOTOWE\b/);

  const midPl = renderWithLang('pl', 0.45);
  assert.match(midPl, /\bGOTOWY\b/);
  assert.match(midPl, /\bAKTYWNY\b/);
  assert.match(midPl, /\bOCZEKUJE\b/);
  assert.doesNotMatch(midPl, /\bREADY\b|\bACTIVE\b|\bWAITING\b/);

  const donePl = renderWithLang('pl', 0.95);
  assert.match(donePl, /\bGOTOWE\b/);
  assert.doesNotMatch(donePl, /\bDONE\b/);
});
