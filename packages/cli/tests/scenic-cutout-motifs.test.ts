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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface MockCanvasRecorder {
  ctx: CanvasRenderingContext2D;
  xs: number[];
  ys: number[];
  paintOps: number;
  gradientCount: number;
  trace: string[];
}

function createGeometryRecordingContext(): MockCanvasRecorder {
  const xs: number[] = [];
  const ys: number[] = [];
  const trace: string[] = [];
  let paintOps = 0;
  let gradientCount = 0;

  let tx = 0;
  let ty = 0;
  let rot = 0;
  let sx = 1;
  let sy = 1;
  const stack: Array<{ tx: number; ty: number; rot: number; sx: number; sy: number }> = [];

  const recordPt = (lx: number, ly: number) => {
    const scaledX = lx * sx;
    const scaledY = ly * sy;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    const wx = tx + scaledX * cosR - scaledY * sinR;
    const wy = ty + scaledX * sinR + scaledY * cosR;
    xs.push(wx);
    ys.push(wy);
  };

  const makeGradient = () => {
    gradientCount += 1;
    return {
      addColorStop(offset: number, color: string) {
        trace.push(`stop:${offset.toFixed(2)}:${color}`);
      },
    };
  };

  const rawCtx: Record<string, unknown> = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineCap: 'round',
    lineJoin: 'round',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    font: '16px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    save() {
      stack.push({ tx, ty, rot, sx, sy });
    },
    restore() {
      const prev = stack.pop();
      if (prev) {
        tx = prev.tx;
        ty = prev.ty;
        rot = prev.rot;
        sx = prev.sx;
        sy = prev.sy;
      }
    },
    translate(dx: number, dy: number) {
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);
      tx += dx * sx * cosR - dy * sy * sinR;
      ty += dx * sx * sinR + dy * sy * cosR;
    },
    rotate(angle: number) {
      rot += angle;
    },
    scale(nsx: number, nsy: number) {
      sx *= nsx;
      sy *= nsy;
    },
    beginPath() {
      trace.push('beginPath');
    },
    closePath() {
      trace.push('closePath');
    },
    clip() {
      trace.push('clip');
    },
    setLineDash(segments: number[]) {
      trace.push(`dash:${segments.join(',')}`);
    },
    moveTo(x: number, y: number) {
      recordPt(x, y);
      trace.push(`M:${x.toFixed(2)},${y.toFixed(2)}`);
    },
    lineTo(x: number, y: number) {
      recordPt(x, y);
      trace.push(`L:${x.toFixed(2)},${y.toFixed(2)}`);
    },
    quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
      recordPt(cpx, cpy);
      recordPt(x, y);
      trace.push(`Q:${cpx.toFixed(2)},${cpy.toFixed(2)},${x.toFixed(2)},${y.toFixed(2)}`);
    },
    bezierCurveTo(
      cp1x: number,
      cp1y: number,
      cp2x: number,
      cp2y: number,
      x: number,
      y: number
    ) {
      recordPt(cp1x, cp1y);
      recordPt(cp2x, cp2y);
      recordPt(x, y);
      trace.push(`C:${x.toFixed(2)},${y.toFixed(2)}`);
    },
    arc(x: number, y: number, r: number, startAngle: number, endAngle: number) {
      recordPt(x + Math.cos(startAngle) * r, y + Math.sin(startAngle) * r);
      recordPt(x + Math.cos(endAngle) * r, y + Math.sin(endAngle) * r);
      const steps = 16;
      for (let i = 1; i < steps; i++) {
        const a = startAngle + ((endAngle - startAngle) * i) / steps;
        recordPt(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      trace.push(`arc:${x.toFixed(2)},${y.toFixed(2)},${r.toFixed(2)}`);
    },
    ellipse(
      x: number,
      y: number,
      rx: number,
      ry: number,
      rotation: number = 0,
      startAngle: number = 0,
      endAngle: number = Math.PI * 2
    ) {
      const steps = 16;
      const cosE = Math.cos(rotation);
      const sinE = Math.sin(rotation);
      for (let i = 0; i <= steps; i++) {
        const a = startAngle + ((endAngle - startAngle) * i) / steps;
        const ex = Math.cos(a) * rx;
        const ey = Math.sin(a) * ry;
        recordPt(x + ex * cosE - ey * sinE, y + ex * sinE + ey * cosE);
      }
      trace.push(`ellipse:${x.toFixed(2)},${y.toFixed(2)},${rx.toFixed(2)},${ry.toFixed(2)}`);
    },
    rect(x: number, y: number, w: number, h: number) {
      recordPt(x, y);
      recordPt(x + w, y);
      recordPt(x + w, y + h);
      recordPt(x, y + h);
      trace.push(`rect:${x.toFixed(2)},${y.toFixed(2)},${w.toFixed(2)},${h.toFixed(2)}`);
    },
    roundRect(x: number, y: number, w: number, h: number) {
      recordPt(x, y);
      recordPt(x + w, y);
      recordPt(x + w, y + h);
      recordPt(x, y + h);
      trace.push(`roundRect:${x.toFixed(2)},${y.toFixed(2)},${w.toFixed(2)},${h.toFixed(2)}`);
    },
    fill() {
      paintOps += 1;
      trace.push(`fill:${String(rawCtx.fillStyle)}`);
    },
    stroke() {
      paintOps += 1;
      trace.push(`stroke:${String(rawCtx.strokeStyle)}`);
    },
    fillRect(x: number, y: number, w: number, h: number) {
      paintOps += 1;
      recordPt(x, y);
      recordPt(x + w, y + h);
      trace.push(`fillRect:${x.toFixed(2)},${y.toFixed(2)},${w.toFixed(2)},${h.toFixed(2)}`);
    },
    strokeRect(x: number, y: number, w: number, h: number) {
      paintOps += 1;
      recordPt(x, y);
      recordPt(x + w, y + h);
      trace.push(`strokeRect:${x.toFixed(2)},${y.toFixed(2)},${w.toFixed(2)},${h.toFixed(2)}`);
    },
    clearRect() {},
    drawImage() {},
    fillText(text: string, x: number, y: number) {
      paintOps += 1;
      recordPt(x, y);
      trace.push(`fillText:${text}`);
    },
    createLinearGradient() {
      return makeGradient();
    },
    createRadialGradient() {
      return makeGradient();
    },
  };

  return {
    ctx: rawCtx as unknown as CanvasRenderingContext2D,
    xs,
    ys,
    get paintOps() {
      return paintOps;
    },
    get gradientCount() {
      return gradientCount;
    },
    trace,
  };
}

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

  const motifsSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/paper-diorama-3d/ScenicCutoutMotifs.tsx'),
    'utf8'
  );
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
