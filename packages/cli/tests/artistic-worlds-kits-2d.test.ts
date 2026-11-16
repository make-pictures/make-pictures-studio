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
  StyleProvider,
  resolveArtWorld,
} from '../../core/src/index';
import { scanTsxForUnclippedCardBars } from '../src/director/audit-direction';
import {
  CodePayloadToast,
  DataFlowEdge,
  MotionDiagramStage2D,
  SystemNode,
  WorldBox,
  evaluateCubicBezier,
  portBottom,
  portLeft,
  portRight,
  portTop,
  type NodeBox,
} from '../../kits/src/motion-diagrams-2d';
import {
  EditorialDeskStage,
  EditorialMediaCard,
} from '../../kits/src/editorial-collage';
import {
  ComparisonSplit2D,
  StoryCard2D,
  VectorSceneStage2D,
} from '../../kits/src/vector-scene-2d';
import {
  AnimatedBarRace,
  DataStoryStage2D,
  MetricComparisonCard,
} from '../../kits/src/data-storytelling';
import { ImpactKeywordCard } from '../../kits/src/kinetic-typography';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KITS_SRC_DIR = path.resolve(__dirname, '../../kits/src');

test('1. ClippedSurfaceChrome wraps internal top bars & specular rims across all 2D rounded cards with zero unclipped bars and bespoke SystemNode medallions', () => {
  const cardRelFiles = [
    'motion-diagrams-2d/SystemNode.tsx',
    'motion-diagrams-2d/NodeBox.tsx',
    'motion-diagrams-2d/CodePayloadToast.tsx',
    'vector-scene-2d/StoryCard2D.tsx',
    'vector-scene-2d/ComparisonSplit2D.tsx',
    'data-storytelling/MetricComparisonCard.tsx',
    'data-storytelling/AnimatedBarRace.tsx',
    'kinetic-typography/ImpactKeywordCard.tsx',
    'editorial-collage/EditorialMediaCard.tsx',
  ] as const;

  for (const rel of cardRelFiles) {
    const absPath = path.join(KITS_SRC_DIR, rel);
    const src = fs.readFileSync(absPath, 'utf8');
    assert.match(
      src,
      /ClippedSurfaceChrome/,
      `Expected ${rel} to wrap internal chrome in <ClippedSurfaceChrome>`
    );
    assert.doesNotMatch(src, /Math\.random\s*\(/, `${rel} must not use Math.random`);
    assert.doesNotMatch(src, /\buseRef\b/, `${rel} must not use mutable useRef`);
    const violations = scanTsxForUnclippedCardBars(src, absPath);
    assert.equal(
      violations.length,
      0,
      `Expected zero UNCLIPPED_CARD_BAR violations in ${rel}, got: ${JSON.stringify(violations)}`
    );
  }

  // Verify SystemNode bespoke sculpted SVG medallion per ArtWorld when icon is omitted + ClippedSurfaceChrome
  for (const styleId of [
    'minimal-product',
    'tactile-craft',
    'editorial-press',
  ] as const) {
    const expectedWorld = resolveArtWorld(BUILT_IN_STYLES[styleId]);
    const CardsScene: React.FC = () =>
      React.createElement(
        StyleProvider,
        { style: styleId },
        React.createElement(SystemNode, {
          id: 'atelier-node',
          title: 'Kierunek sztuki',
          subtitle: 'Precyzyjna maska narożników i medalion',
          badge: 'SCENA',
          statusText: 'Aktywny',
          x: 540,
          y: 340,
          enterFrame: 2,
          activeRanges: [[2, 80]],
        }),
        React.createElement(
          WorldBox,
          {
            node: { cx: 540, cy: 560, w: 320, h: 100 },
          },
          'Karta WorldBox'
        ),
        React.createElement(CodePayloadToast, {
          x: 540,
          y: 640,
          methodBadge: 'POST',
          endpoint: '/v1/render',
          code: '{\n  "fps": 60\n}',
          startFrame: 2,
          endFrame: 90,
        }),
        React.createElement(StoryCard2D, {
          title: 'Opowieść w kadrze',
          subtitle: 'Szlachetny detal typograficzny',
          startFrame: 2,
        }),
        React.createElement(MetricComparisonCard, {
          title: 'Płynność obrazu',
          beforeLabel: 'Szkic',
          beforeValue: 30,
          afterLabel: 'Master',
          afterValue: 60,
          unit: ' FPS',
          startFrame: 2,
        }),
        React.createElement(AnimatedBarRace, {
          title: 'Światy plastyczne',
          startFrame: 2,
          items: [
            { id: 'a', label: 'Atelier', value: 96 },
            { id: 'b', label: 'Galeria', value: 88 },
          ],
        }),
        React.createElement(ImpactKeywordCard, {
          keyword: 'Czysty narożnik',
          startFrame: 2,
        })
      );

    const html = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: CardsScene,
        compositionWidth: 1920,
        compositionHeight: 1080,
        durationInFrames: 90,
        fps: 60,
        frameToDisplay: 40,
      })
    );

    const clippedCount = (html.match(/data-clipped-surface-chrome="true"/g) ?? []).length;
    assert.ok(
      clippedCount >= 7,
      `Expected at least 7 ClippedSurfaceChrome instances in ${styleId}, got ${clippedCount}`
    );
    assert.match(html, /data-clipped-top-bar="true"/);
    assert.match(html, /data-clipped-specular-rim="true"/);
    assert.match(
      html,
      new RegExp(`data-node-medallion="${expectedWorld}"`),
      `Expected SystemNode bespoke medallion for ArtWorld "${expectedWorld}"`
    );
    assert.match(
      html,
      /data-port-terminal="left"[\s\S]*data-port-terminal="right"/,
      'Expected refined left and right port terminals on SystemNode'
    );
  }
});

test('2. Default developer noise (MOD 01, FIG. 01, OPTICAL PLATE, ARKUSZ REDAKCYJNY, TABLICA KONCEPCYJNA, ARKUSZ POMIAROWY, CAL • 1:1) is omitted unless explicitly passed', () => {
  for (const styleId of [
    'minimal-product',
    'editorial-press',
    'cyber-telemetry',
    'brutalist-poster',
  ] as const) {
    const CleanDefaultsScene: React.FC = () =>
      React.createElement(
        StyleProvider,
        { style: styleId },
        React.createElement(
          EditorialDeskStage,
          null,
          React.createElement(EditorialMediaCard, {
            caption: 'Autorska ilustracja w świetle dziennym',
            startFrame: 2,
          })
        ),
        React.createElement(
          VectorSceneStage2D,
          null,
          React.createElement(StoryCard2D, {
            title: 'Czysta karta narracyjna',
            subtitle: 'Bez domyślnych stempli deweloperskich',
            startFrame: 2,
          })
        ),
        React.createElement(
          DataStoryStage2D,
          null,
          React.createElement(MetricComparisonCard, {
            beforeLabel: 'Przed',
            beforeValue: 20,
            afterLabel: 'Po',
            afterValue: 80,
            startFrame: 2,
          })
        ),
        React.createElement(
          MotionDiagramStage2D,
          null,
          React.createElement(SystemNode, {
            id: 'clean-node',
            title: 'Węzeł studyjny',
            subtitle: 'Czysta typografia ekspozycyjna',
            badge: '',
            statusText: 'Gotowy',
            x: 960,
            y: 540,
            enterFrame: 2,
          })
        )
      );

    const cleanHtml = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: CleanDefaultsScene,
        compositionWidth: 1920,
        compositionHeight: 1080,
        durationInFrames: 90,
        fps: 60,
        frameToDisplay: 36,
      })
    );

    assert.doesNotMatch(cleanHtml, /MOD 01/);
    assert.doesNotMatch(cleanHtml, /FIG\. 01/);
    assert.doesNotMatch(cleanHtml, /OPTICAL PLATE/);
    assert.doesNotMatch(cleanHtml, /ARKUSZ REDAKCYJNY/);
    assert.doesNotMatch(cleanHtml, /TABLICA KONCEPCYJNA/);
    assert.doesNotMatch(cleanHtml, /ARKUSZ POMIAROWY/);
    assert.doesNotMatch(cleanHtml, /CAL • 1:1/);
    assert.doesNotMatch(cleanHtml, /35MM ARCHIVE POSITIVE/);
    assert.doesNotMatch(cleanHtml, /KADR 14A/);
    assert.doesNotMatch(cleanHtml, /data-diagram-stamp="true"/);
  }

  // When explicit non-empty codes ARE passed, they still render faithfully
  const ExplicitStampsScene: React.FC = () =>
    React.createElement(
      StyleProvider,
      { style: 'editorial-press' },
      React.createElement(EditorialDeskStage, { sheetCode: 'STAMP-DESK-01' }),
      React.createElement(
        VectorSceneStage2D,
        { plateCode: 'STAMP-VEC-02' },
        React.createElement(StoryCard2D, {
          title: 'Z jawnym kodem',
          badge: 'ROZDZIAŁ I',
          plateCode: 'STAMP-CARD-03',
          startFrame: 2,
        })
      ),
      React.createElement(DataStoryStage2D, { datasetCode: 'STAMP-DATA-04' }),
      React.createElement(
        MotionDiagramStage2D,
        { diagramCode: 'STAMP-DIAG-05' },
        React.createElement(SystemNode, {
          id: 'explicit-node',
          moduleCode: 'STAMP-MOD-06',
          badge: 'RDZEŃ',
          title: 'Węzeł z indeksem',
          subtitle: 'Jawny kod modułu',
          statusText: 'OK',
          x: 960,
          y: 540,
          enterFrame: 2,
        })
      )
    );

  const explicitHtml = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: ExplicitStampsScene,
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 90,
      fps: 60,
      frameToDisplay: 36,
    })
  );

  assert.match(explicitHtml, /STAMP-DESK-01/);
  assert.match(explicitHtml, /STAMP-VEC-02/);
  assert.match(explicitHtml, /ROZDZIAŁ I/);
  assert.match(explicitHtml, /STAMP-CARD-03/);
  assert.match(explicitHtml, /STAMP-DATA-04/);
  assert.match(explicitHtml, /STAMP-DIAG-05/);
  assert.match(explicitHtml, /STAMP-MOD-06 • RDZEŃ/);
});

test('3. Light-mode rack focus in MotionDiagramStage2D and ComparisonSplit2D keeps recessed cards dignified (opacity >= 0.84, blur <= 2.0px, saturate(0.88))', () => {
  for (const lightStyleId of [
    'minimal-product',
    'editorial-press',
    'tactile-craft',
  ] as const) {
    const LightRackScene: React.FC = () =>
      React.createElement(
        StyleProvider,
        { style: lightStyleId },
        React.createElement(
          MotionDiagramStage2D,
          { focusedNodeIds: ['hero-node'] },
          React.createElement(SystemNode, {
            id: 'hero-node',
            title: 'Główny plan ostrości',
            subtitle: 'Aktywny obiekt',
            badge: 'OSTROŚĆ',
            statusText: 'W centrum',
            x: 560,
            y: 500,
            enterFrame: 2,
          }),
          React.createElement(SystemNode, {
            id: 'bg-node',
            title: 'Drugi plan studyjny',
            subtitle: 'Czytelny akryl w głębi',
            badge: 'TŁO',
            statusText: 'Czuwanie',
            x: 1320,
            y: 500,
            enterFrame: 2,
          })
        )
      );

    const html = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: LightRackScene,
        compositionWidth: 1920,
        compositionHeight: 1080,
        durationInFrames: 120,
        fps: 60,
        frameToDisplay: 72,
      })
    );

    const recessedTag =
      html.match(/<div[^>]*data-focus-state="recessed"[^>]*>/)?.[0] ?? '';
    assert.ok(recessedTag.length > 0, `Expected recessed node in ${lightStyleId}`);

    const opacityMatch = recessedTag.match(/(?:^|;|")opacity:([0-9.]+)/);
    assert.ok(opacityMatch, `Expected opacity on recessed node in ${lightStyleId}`);
    const opacityVal = Number(opacityMatch[1]);
    assert.ok(
      opacityVal >= 0.84,
      `Expected light-mode recessed SystemNode opacity >= 0.84 in ${lightStyleId}, got ${opacityVal}`
    );

    const blurMatch = recessedTag.match(/filter:blur\(([0-9.]+)px\)\s*saturate\(0\.88\)/);
    assert.ok(
      blurMatch,
      `Expected filter:blur(...) saturate(0.88) on light-mode recessed node in ${lightStyleId}, got: ${recessedTag}`
    );
    const blurPx = Number(blurMatch[1]);
    assert.ok(
      blurPx > 0 && blurPx <= 2.0,
      `Expected light-mode recessed blurPx <= 2.0px in ${lightStyleId}, got ${blurPx}`
    );

    // ComparisonSplit2D light-mode rack focus check
    const LightSplitScene: React.FC = () =>
      React.createElement(
        StyleProvider,
        { style: lightStyleId },
        React.createElement(ComparisonSplit2D, {
          startFrame: 2,
          focusShiftFrame: 24,
          left: {
            tag: 'PRZED',
            title: 'Pierwsza plansza',
            detail: 'Drugi plan po przeostrzeniu zachowuje kontrast.',
          },
          right: {
            tag: 'PO',
            title: 'Druga plansza',
            detail: 'Pełna ostrość głównego punktu skupienia.',
          },
        })
      );

    const splitHtml = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: LightSplitScene,
        compositionWidth: 1920,
        compositionHeight: 1080,
        durationInFrames: 120,
        fps: 60,
        frameToDisplay: 96,
      })
    );

    const splitBlurMatches = [...splitHtml.matchAll(/opacity:([0-9.]+);filter:blur\(([0-9.]+)px\)\s*saturate\(0\.88\)/g)];
    assert.equal(
      splitBlurMatches.length,
      1,
      `Expected exactly 1 recessed light-mode plate in ComparisonSplit2D for ${lightStyleId}`
    );
    const splitRecessedOpacity = Number(splitBlurMatches[0]![1]);
    const splitRecessedBlur = Number(splitBlurMatches[0]![2]);
    assert.ok(
      splitRecessedOpacity >= 0.84,
      `Expected ComparisonSplit2D recessed opacity >= 0.84 in ${lightStyleId}, got ${splitRecessedOpacity}`
    );
    assert.ok(
      splitRecessedBlur <= 2.0,
      `Expected ComparisonSplit2D recessed blur <= 2.0px in ${lightStyleId}, got ${splitRecessedBlur}`
    );
  }
});

test('4. DataFlowEdge renders luminous flow trails and maintains >= 26px clearance between curve apex and floating label across horizontal & vertical orientations', () => {
  const nodeLeft: NodeBox = { cx: 420, cy: 540, w: 320, h: 180 };
  const nodeRight: NodeBox = { cx: 1420, cy: 540, w: 320, h: 180 };
  const nodeTop: NodeBox = { cx: 540, cy: 420, w: 420, h: 160 };
  const nodeBottom: NodeBox = { cx: 540, cy: 860, w: 420, h: 160 };

  const EdgeScene: React.FC = () =>
    React.createElement(
      StyleProvider,
      { style: 'minimal-product' },
      React.createElement(DataFlowEdge, {
        id: 'up-arch',
        from: portRight(nodeLeft),
        to: portLeft(nodeRight),
        curveOffsetY: -80,
        drawStartFrame: 2,
        flowStartFrame: 10,
        flowEndFrame: 120,
        label: 'Górny łuk',
      }),
      React.createElement(DataFlowEdge, {
        id: 'down-arch',
        from: portRight(nodeLeft, 30),
        to: portLeft(nodeRight, 30),
        curveOffsetY: 80,
        drawStartFrame: 2,
        flowStartFrame: 10,
        flowEndFrame: 120,
        label: 'Dolny łuk',
      }),
      React.createElement(DataFlowEdge, {
        id: 'vertical-span',
        from: portBottom(nodeTop),
        to: portTop(nodeBottom),
        drawStartFrame: 2,
        flowStartFrame: 10,
        flowEndFrame: 120,
        label: 'Pionowy przepływ',
      })
    );

  const html = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: EdgeScene,
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 120,
      fps: 60,
      frameToDisplay: 54,
    })
  );

  // Luminous flow trail behind active couplers
  assert.match(html, /data-flow-trail="true"/);

  // Extract rendered label positions and compare against exact Bézier midpoint
  const labelTags = [...html.matchAll(/<div[^>]*data-edge-label="([^"]+)"[^>]*style="([^"]+)"[^>]*>/g)];
  assert.equal(labelTags.length, 3, 'Expected 3 rendered DataFlowEdge labels');

  const byId = new Map(labelTags.map((m) => [m[1], m[2]]));

  // 1) Upward arch (curveOffsetY = -80)
  const upFrom = portRight(nodeLeft);
  const upTo = portLeft(nodeRight);
  const upDx = upTo.x - upFrom.x;
  const upApex = evaluateCubicBezier(
    upFrom,
    { x: upFrom.x + upDx * 0.36, y: upFrom.y - 80 },
    { x: upFrom.x + upDx * 0.64, y: upTo.y - 80 },
    upTo,
    0.5
  );
  const upStyle = byId.get('up-arch') ?? '';
  const upTop = Number(upStyle.match(/top:(-?[0-9.]+)px/)?.[1] ?? NaN);
  assert.ok(
    upApex.y - upTop >= 26,
    `Expected upward arch label >= 26px above apex (${upApex.y}), got top=${upTop}`
  );

  // 2) Downward arch (curveOffsetY = +80)
  const downFrom = portRight(nodeLeft, 30);
  const downTo = portLeft(nodeRight, 30);
  const downDx = downTo.x - downFrom.x;
  const downApex = evaluateCubicBezier(
    downFrom,
    { x: downFrom.x + downDx * 0.36, y: downFrom.y + 80 },
    { x: downFrom.x + downDx * 0.64, y: downTo.y + 80 },
    downTo,
    0.5
  );
  const downStyle = byId.get('down-arch') ?? '';
  const downTop = Number(downStyle.match(/top:(-?[0-9.]+)px/)?.[1] ?? NaN);
  assert.ok(
    downTop - downApex.y >= 26,
    `Expected downward arch label >= 26px below apex (${downApex.y}), got top=${downTop}`
  );

  // 3) Vertical span (from x=540,y=500 to x=540,y=780)
  const vertStyle = byId.get('vertical-span') ?? '';
  const vertLeft = Number(vertStyle.match(/left:(-?[0-9.]+)px/)?.[1] ?? NaN);
  assert.ok(
    Math.abs(vertLeft - 540) >= 26,
    `Expected vertical span label >= 26px horizontal clearance from x=540, got left=${vertLeft}`
  );
});

test('5. All 4 2D Stage kits embed ScenicBackdropLayers across all 3 ArtWorlds while keeping Frame 0 100% pure bgCanvas', () => {
  const worldCases = [
    { styleId: 'minimal-product', expectedWorld: 'atelier' },
    { styleId: 'cyber-telemetry', expectedWorld: 'atelier' },
    { styleId: 'tactile-craft', expectedWorld: 'illustrative' },
    { styleId: 'sketch-notebook', expectedWorld: 'illustrative' },
    { styleId: 'editorial-press', expectedWorld: 'editorial-gallery' },
    { styleId: 'archival-chronicle', expectedWorld: 'editorial-gallery' },
  ] as const;

  for (const { styleId, expectedWorld } of worldCases) {
    const stages = [
      {
        name: 'EditorialDeskStage',
        Comp: () =>
          React.createElement(
            StyleProvider,
            { style: styleId },
            React.createElement(
              EditorialDeskStage,
              null,
              React.createElement(EditorialMediaCard, {
                caption: 'Malarska ekspozycja',
                startFrame: 2,
              })
            )
          ),
      },
      {
        name: 'VectorSceneStage2D',
        Comp: () =>
          React.createElement(
            StyleProvider,
            { style: styleId },
            React.createElement(
              VectorSceneStage2D,
              null,
              React.createElement('div', null, 'Plansza')
            )
          ),
      },
      {
        name: 'DataStoryStage2D',
        Comp: () =>
          React.createElement(
            StyleProvider,
            { style: styleId },
            React.createElement(
              DataStoryStage2D,
              null,
              React.createElement('div', null, 'Wykres')
            )
          ),
      },
      {
        name: 'MotionDiagramStage2D',
        Comp: () =>
          React.createElement(
            StyleProvider,
            { style: styleId },
            React.createElement(
              MotionDiagramStage2D,
              null,
              React.createElement('div', null, 'Diagram')
            )
          ),
      },
    ] as const;

    for (const { name, Comp } of stages) {
      const f0 = renderToStaticMarkup(
        React.createElement(Thumbnail, {
          component: Comp,
          compositionWidth: 1920,
          compositionHeight: 1080,
          durationInFrames: 90,
          fps: 60,
          frameToDisplay: 0,
        })
      );
      assert.doesNotMatch(
        f0,
        /data-scenic-backdrop/,
        `${name} (${styleId}) must NOT render ScenicBackdropLayers on Clean Frame 0`
      );
      assert.doesNotMatch(
        f0,
        /data-lighting-rig/,
        `${name} (${styleId}) must NOT render StageLightingRig on Clean Frame 0`
      );

      const f36 = renderToStaticMarkup(
        React.createElement(Thumbnail, {
          component: Comp,
          compositionWidth: 1920,
          compositionHeight: 1080,
          durationInFrames: 90,
          fps: 60,
          frameToDisplay: 36,
        })
      );
      assert.match(
        f36,
        new RegExp(`data-scenic-backdrop="${expectedWorld}"`),
        `Expected ${name} (${styleId}) to mount ScenicBackdropLayers for "${expectedWorld}"`
      );

      if (name === 'EditorialDeskStage') {
        assert.match(
          f36,
          new RegExp(`data-editorial-artworld="${expectedWorld}"`),
          `Expected EditorialMediaCard fallback artwork to adapt to "${expectedWorld}"`
        );
      }
    }
  }
});
