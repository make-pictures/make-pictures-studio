import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StyleProvider } from '../../core/src/index';
import {
  DioramaStage3D,
  PaperCloudCutout3D,
  PaperMountainBackdrop3D,
  PaperPineTree3D,
} from '../../kits/src/paper-diorama-3d';
import {
  IsometricStage3D,
  IsometricStudioEnvironment,
} from '../../kits/src/isometric-3d';
import { WorldBox } from '../../kits/src/motion-diagrams-2d/NodeBox';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('DioramaStage3D and IsometricStage3D are exported as neutral 3D stage components while legacy exports remain intact', () => {
  assert.equal(typeof DioramaStage3D, 'function');
  assert.equal(typeof IsometricStage3D, 'function');
  assert.equal(typeof PaperMountainBackdrop3D, 'function');
  assert.equal(typeof PaperPineTree3D, 'function');
  assert.equal(typeof PaperCloudCutout3D, 'function');
  assert.equal(typeof IsometricStudioEnvironment, 'function');
});

test('Everest and demo-specific 3D props are marked @deprecated in JSDoc', () => {
  const popUpSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/paper-diorama-3d/PaperPopUpBook3D.tsx'),
    'utf8'
  );
  const isoSrc = fs.readFileSync(
    path.resolve(
      __dirname,
      '../../kits/src/isometric-3d/IsometricStudioEnvironment.tsx'
    ),
    'utf8'
  );
  assert.match(popUpSrc, /@deprecated[\s\S]*?export const PaperMountainBackdrop3D/);
  assert.match(popUpSrc, /@deprecated[\s\S]*?export const PaperPineTree3D/);
  assert.match(popUpSrc, /@deprecated[\s\S]*?export const PaperCloudCutout3D/);
  assert.match(isoSrc, /@deprecated[\s\S]*?export const IsometricStudioEnvironment/);
});

test('all 13 2D kit components wire useStudioStyle() for theme-aware defaults and contain zero Math.random()', () => {
  const kitFiles = [
    'kinetic-typography/WordByWordStage.tsx',
    'kinetic-typography/ImpactKeywordCard.tsx',
    'kinetic-typography/AnimatedMetricCounter.tsx',
    'data-storytelling/AnimatedBarRace.tsx',
    'data-storytelling/TimelineTrack.tsx',
    'data-storytelling/MetricComparisonCard.tsx',
    'motion-diagrams-2d/NodeBox.tsx',
    'motion-diagrams-2d/SystemNode.tsx',
    'motion-diagrams-2d/DataFlowEdge.tsx',
    'motion-diagrams-2d/CodePayloadToast.tsx',
    'product-frames/BrowserFrame.tsx',
    'product-frames/PhoneFrame.tsx',
    'product-frames/ScreenSpotlightOverlay.tsx',
  ];

  for (const rel of kitFiles) {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../kits/src', rel),
      'utf8'
    );
    assert.match(
      src,
      /useStudioStyle/,
      `Expected ${rel} to consume useStudioStyle()`
    );
    assert.doesNotMatch(
      src,
      /Math\.random\s*\(/,
      `Expected ${rel} to contain zero Math.random()`
    );
  }

  for (const stageRel of [
    'paper-diorama-3d/DioramaStage3D.tsx',
    'isometric-3d/IsometricStage3D.tsx',
  ]) {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../kits/src', stageRel),
      'utf8'
    );
    assert.doesNotMatch(src, /Math\.random\s*\(/);
  }
});

test('WorldBox inherits active StyleProvider chrome and body font when no explicit variant override is passed', () => {
  const brutalMarkup = renderToStaticMarkup(
    React.createElement(StyleProvider, {
      style: 'brutalist-poster',
      children: React.createElement(WorldBox, {
        node: { cx: 200, cy: 150, w: 300, h: 120 },
        children: 'Brutalist Card',
      }),
    })
  );
  assert.match(brutalMarkup, /Space Grotesk/);
  assert.match(brutalMarkup, /6px 6px 0px/);
  assert.match(brutalMarkup, /border-radius:0/);

  const editorialMarkup = renderToStaticMarkup(
    React.createElement(StyleProvider, {
      style: 'editorial-press',
      children: React.createElement(WorldBox, {
        node: { cx: 200, cy: 150, w: 300, h: 120 },
        children: 'Editorial Card',
      }),
    })
  );
  assert.match(editorialMarkup, /DM Sans/);
  assert.match(editorialMarkup, /1\.5px solid/);
});
