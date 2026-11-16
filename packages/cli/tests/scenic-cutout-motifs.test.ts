import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BUILT_IN_STYLE_IDS,
  BUILT_IN_STYLES,
  StyleProvider,
} from '../../core/src/index';
import * as kitsRoot from '../../kits/src/index';
import {
  EarthriseCutout3D,
  LunarCraterRidgeCutout3D,
  LunarLanderCutout3D,
  SCENIC_CUTOUT_INNER_MARGIN_PX,
  StarryCosmosBackdropCutout3D,
  drawEarthriseMotif,
  drawLunarCraterRidgeMotif,
  drawLunarLanderMotif,
  drawStarryCosmosBackdropMotif,
  getPaperTextureCacheStats,
  resolveScenicCutoutPalette,
} from '../../kits/src/paper-diorama-3d';
import { createGeometryRecordingContext } from './_helpers/mock-canvas-recorder';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('Cosmic & Apollo 11 lunar cutout motifs are exported from paper-diorama-3d and kits root without Math.random or useRef', () => {
  assert.equal(SCENIC_CUTOUT_INNER_MARGIN_PX, 38);
  assert.equal(typeof StarryCosmosBackdropCutout3D, 'function');
  assert.equal(typeof EarthriseCutout3D, 'function');
  assert.equal(typeof LunarCraterRidgeCutout3D, 'function');
  assert.equal(typeof LunarLanderCutout3D, 'function');

  assert.equal(kitsRoot.StarryCosmosBackdropCutout3D, StarryCosmosBackdropCutout3D);
  assert.equal(kitsRoot.EarthriseCutout3D, EarthriseCutout3D);
  assert.equal(kitsRoot.LunarCraterRidgeCutout3D, LunarCraterRidgeCutout3D);
  assert.equal(kitsRoot.LunarLanderCutout3D, LunarLanderCutout3D);

  const motifsSrc = [
    'ScenicCutoutMotifs.tsx',
    'motifs/palette.ts',
    'motifs/lunarMotifs.tsx',
  ]
    .map((rel) =>
      fs.readFileSync(
        path.resolve(__dirname, '../../kits/src/paper-diorama-3d', rel),
        'utf8'
      )
    )
    .join('\n');
  assert.doesNotMatch(motifsSrc, /Math\.random\s*\(/);
  assert.doesNotMatch(motifsSrc, /useRef\b/);
  assert.doesNotMatch(motifsSrc, /\bfetch\s*\(|XMLHttpRequest/);
});

test('All 4 cosmic/lunar cutout motifs strictly obey SCENIC_CUTOUT_INNER_MARGIN_PX = 38 on all 4 edges and render deterministically', () => {
  const cosmicSpecs = [
    {
      name: 'StarryCosmosBackdropCutout3D',
      w: 864,
      h: 488,
      draw: (ctx: CanvasRenderingContext2D, styleId: (typeof BUILT_IN_STYLE_IDS)[number]) =>
        drawStarryCosmosBackdropMotif(
          ctx,
          864,
          488,
          resolveScenicCutoutPalette(BUILT_IN_STYLES[styleId]),
          { seed: 'cosmos-test' }
        ),
    },
    {
      name: 'EarthriseCutout3D',
      w: 420,
      h: 420,
      draw: (ctx: CanvasRenderingContext2D, styleId: (typeof BUILT_IN_STYLE_IDS)[number]) =>
        drawEarthriseMotif(
          ctx,
          420,
          420,
          resolveScenicCutoutPalette(BUILT_IN_STYLES[styleId]),
          { seed: 'earth-test' }
        ),
    },
    {
      name: 'LunarCraterRidgeCutout3D(far)',
      w: 860,
      h: 320,
      draw: (ctx: CanvasRenderingContext2D, styleId: (typeof BUILT_IN_STYLE_IDS)[number]) =>
        drawLunarCraterRidgeMotif(
          ctx,
          860,
          320,
          resolveScenicCutoutPalette(BUILT_IN_STYLES[styleId]),
          { seed: 'ridge-far', ridgeVariant: 'far' }
        ),
    },
    {
      name: 'LunarCraterRidgeCutout3D(near)',
      w: 860,
      h: 320,
      draw: (ctx: CanvasRenderingContext2D, styleId: (typeof BUILT_IN_STYLE_IDS)[number]) =>
        drawLunarCraterRidgeMotif(
          ctx,
          860,
          320,
          resolveScenicCutoutPalette(BUILT_IN_STYLES[styleId]),
          { seed: 'ridge-near', ridgeVariant: 'near' }
        ),
    },
    {
      name: 'LunarLanderCutout3D',
      w: 560,
      h: 520,
      draw: (ctx: CanvasRenderingContext2D, styleId: (typeof BUILT_IN_STYLE_IDS)[number]) =>
        drawLunarLanderMotif(
          ctx,
          560,
          520,
          resolveScenicCutoutPalette(BUILT_IN_STYLES[styleId]),
          { seed: 'eagle-test', thrusterIntensity: 0.75 }
        ),
    },
  ] as const;

  for (const styleId of BUILT_IN_STYLE_IDS) {
    for (const spec of cosmicSpecs) {
      const recA = createGeometryRecordingContext();
      const recB = createGeometryRecordingContext();
      spec.draw(recA.ctx, styleId);
      spec.draw(recB.ctx, styleId);

      assert.deepEqual(
        recA.trace,
        recB.trace,
        `${spec.name} (${styleId}) must draw deterministically`
      );
      assert.ok(
        recA.paintOps >= 8,
        `Expected >= 8 painterly fill/stroke ops in ${spec.name}, got ${recA.paintOps}`
      );
      assert.ok(
        recA.gradientCount >= 1,
        `Expected gradient shading in ${spec.name}`
      );

      const minX = Math.min(...recA.xs);
      const maxX = Math.max(...recA.xs);
      const minY = Math.min(...recA.ys);
      const maxY = Math.max(...recA.ys);

      assert.ok(
        minX >= SCENIC_CUTOUT_INNER_MARGIN_PX,
        `${spec.name} (${styleId}) violated left margin >= 38px: minX=${minX}`
      );
      assert.ok(
        maxX <= spec.w - SCENIC_CUTOUT_INNER_MARGIN_PX,
        `${spec.name} (${styleId}) violated right margin >= 38px: maxX=${maxX} vs ${spec.w - 38}`
      );
      assert.ok(
        minY >= SCENIC_CUTOUT_INNER_MARGIN_PX,
        `${spec.name} (${styleId}) violated top margin >= 38px: minY=${minY}`
      );
      assert.ok(
        maxY <= spec.h - SCENIC_CUTOUT_INNER_MARGIN_PX,
        `${spec.name} (${styleId}) violated bottom margin >= 38px: maxY=${maxY} vs ${spec.h - 38}`
      );
    }
  }

  // Far vs near lunar crater ridges produce distinct parallax silhouettes
  const farRec = createGeometryRecordingContext();
  const nearRec = createGeometryRecordingContext();
  const pal = resolveScenicCutoutPalette(BUILT_IN_STYLES['tactile-craft']);
  drawLunarCraterRidgeMotif(farRec.ctx, 860, 320, pal, { seed: 's1', ridgeVariant: 'far' });
  drawLunarCraterRidgeMotif(nearRec.ctx, 860, 320, pal, { seed: 's1', ridgeVariant: 'near' });
  assert.notDeepEqual(farRec.trace, nearRec.trace);
});

test('LunarCraterRidgeCutout3D and LunarLanderCutout3D wire cacheDeps cleanly and animate thrusterIntensity at 60 FPS without texture cache churn', () => {
  const prevDoc = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = {
    createElement(tag: string) {
      if (tag === 'canvas') {
        return {
          width: 512,
          height: 512,
          getContext() {
            return createGeometryRecordingContext().ctx;
          },
        };
      }
      return {};
    },
  };

  try {
    const startStats = getPaperTextureCacheStats();

    // Render all 4 cosmic cutouts with thruster firing (0.85)
    const firingHtml = renderToStaticMarkup(
      React.createElement(
        StyleProvider,
        { style: 'tactile-craft', renderBackdrop: false },
        React.createElement(StarryCosmosBackdropCutout3D, null),
        React.createElement(EarthriseCutout3D, null),
        React.createElement(LunarCraterRidgeCutout3D, { ridgeVariant: 'far' }),
        React.createElement(LunarLanderCutout3D, { thrusterIntensity: 0.85 })
      )
    );
    assert.match(firingHtml, /lunar-thruster-plume/);
    const afterInitial = getPaperTextureCacheStats();
    assert.ok(afterInitial.size >= startStats.size + 4);

    // Sweeping thrusterIntensity across intermediate active values (0.65, 0.35) updates 3D plume scale WITHOUT regenerating PaperCutout3D canvases
    const midHtml = renderToStaticMarkup(
      React.createElement(
        StyleProvider,
        { style: 'tactile-craft', renderBackdrop: false },
        React.createElement(LunarLanderCutout3D, { thrusterIntensity: 0.35 })
      )
    );
    assert.match(midHtml, /lunar-thruster-plume/);
    assert.notEqual(midHtml, firingHtml);
    assert.equal(
      getPaperTextureCacheStats().size,
      afterInitial.size,
      'Active thruster animation must reuse cached PaperCutout3D texture without 60 FPS offscreen canvas churn'
    );

    // Switching ridgeVariant ('far' -> 'near') invalidates cacheDeps immediately
    renderToStaticMarkup(
      React.createElement(
        StyleProvider,
        { style: 'tactile-craft', renderBackdrop: false },
        React.createElement(LunarCraterRidgeCutout3D, { ridgeVariant: 'near' })
      )
    );
    const afterNearRidge = getPaperTextureCacheStats();
    assert.equal(afterNearRidge.size, afterInitial.size + 1);

    // Touchdown (thrusterIntensity <= 0.02) cleanly hides the braking plume and updates nozzle state
    for (const offValue of [0.02, 0]) {
      const landedHtml = renderToStaticMarkup(
        React.createElement(
          StyleProvider,
          { style: 'tactile-craft', renderBackdrop: false },
          React.createElement(LunarLanderCutout3D, { thrusterIntensity: offValue })
        )
      );
      assert.doesNotMatch(
        landedHtml,
        /lunar-thruster-plume/,
        `Braking plume must be hidden when thrusterIntensity=${offValue} <= 0.02`
      );
    }
  } finally {
    if (prevDoc === undefined) {
      delete (globalThis as { document?: unknown }).document;
    } else {
      (globalThis as { document?: unknown }).document = prevDoc;
    }
  }
});
