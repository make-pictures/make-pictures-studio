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
  StyleProvider,
  resolveArtWorld,
} from '../../core/src/index';
import * as kitsRoot from '../../kits/src/index';
import {
  AtelierDeskCutout3D,
  CloudCanopyCutout3D,
  MountainRangeCutout3D,
  PineGroveCutout3D,
  SCENIC_CUTOUT_INNER_MARGIN_PX,
  SunburstArchCutout3D,
  drawAtelierDeskMotif,
  drawCloudCanopyMotif,
  drawMountainRangeMotif,
  drawPineGroveMotif,
  drawSunburstArchMotif,
  getPaperTextureCacheStats,
  resolveScenicCutoutPalette,
} from '../../kits/src/paper-diorama-3d';
import {
  IsometricScenicSet3D,
  IsometricStage3D,
  computeScenicRoomTokens,
} from '../../kits/src/isometric-3d';
import { createGeometryRecordingContext } from './_helpers/mock-canvas-recorder';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('ScenicCutoutMotifs exports all 5 painterly motifs from paper-diorama-3d and root kits without Math.random or useRef', () => {
  assert.equal(typeof SunburstArchCutout3D, 'function');
  assert.equal(typeof MountainRangeCutout3D, 'function');
  assert.equal(typeof CloudCanopyCutout3D, 'function');
  assert.equal(typeof PineGroveCutout3D, 'function');
  assert.equal(typeof AtelierDeskCutout3D, 'function');
  assert.ok(SCENIC_CUTOUT_INNER_MARGIN_PX >= 34);

  assert.equal(kitsRoot.SunburstArchCutout3D, SunburstArchCutout3D);
  assert.equal(kitsRoot.MountainRangeCutout3D, MountainRangeCutout3D);
  assert.equal(kitsRoot.CloudCanopyCutout3D, CloudCanopyCutout3D);
  assert.equal(kitsRoot.PineGroveCutout3D, PineGroveCutout3D);
  assert.equal(kitsRoot.AtelierDeskCutout3D, AtelierDeskCutout3D);

  const motifsSrc = [
    'ScenicCutoutMotifs.tsx',
    'motifs/palette.ts',
    'motifs/natureMotifs.tsx',
  ]
    .map((rel) =>
      fs.readFileSync(
        path.resolve(__dirname, '../../kits/src/paper-diorama-3d', rel),
        'utf8'
      )
    )
    .join('\n');
  assert.match(motifsSrc, /useStudioStyle/);
  assert.doesNotMatch(motifsSrc, /Math\.random\s*\(/);
  assert.doesNotMatch(motifsSrc, /useRef\b/);
});

test('all 5 ScenicCutoutMotifs obey >= 34px die-cut border margins, multi-tone painterly craft, determinism, and Polish maxWidth text bounds', () => {
  const motifSpecs = [
    {
      name: 'SunburstArchCutout3D',
      w: 768,
      h: 440,
      draw: (ctx: CanvasRenderingContext2D, styleId: (typeof BUILT_IN_STYLE_IDS)[number]) =>
        drawSunburstArchMotif(
          ctx,
          768,
          440,
          resolveScenicCutoutPalette(BUILT_IN_STYLES[styleId]),
          { seed: 'sun-test' }
        ),
    },
    {
      name: 'MountainRangeCutout3D',
      w: 820,
      h: 384,
      draw: (ctx: CanvasRenderingContext2D, styleId: (typeof BUILT_IN_STYLE_IDS)[number]) =>
        drawMountainRangeMotif(
          ctx,
          820,
          384,
          resolveScenicCutoutPalette(BUILT_IN_STYLES[styleId]),
          { seed: 'mtn-test' }
        ),
    },
    {
      name: 'CloudCanopyCutout3D',
      w: 576,
      h: 240,
      draw: (ctx: CanvasRenderingContext2D, styleId: (typeof BUILT_IN_STYLE_IDS)[number]) =>
        drawCloudCanopyMotif(
          ctx,
          576,
          240,
          resolveScenicCutoutPalette(BUILT_IN_STYLES[styleId]),
          { seed: 'cloud-test' }
        ),
    },
    {
      name: 'PineGroveCutout3D',
      w: 384,
      h: 420,
      draw: (ctx: CanvasRenderingContext2D, styleId: (typeof BUILT_IN_STYLE_IDS)[number]) =>
        drawPineGroveMotif(
          ctx,
          384,
          420,
          resolveScenicCutoutPalette(BUILT_IN_STYLES[styleId]),
          { seed: 'pine-test' }
        ),
    },
    {
      name: 'AtelierDeskCutout3D',
      w: 640,
      h: 340,
      draw: (ctx: CanvasRenderingContext2D, styleId: (typeof BUILT_IN_STYLE_IDS)[number]) =>
        drawAtelierDeskMotif(
          ctx,
          640,
          340,
          resolveScenicCutoutPalette(BUILT_IN_STYLES[styleId]),
          { seed: 'desk-test' }
        ),
    },
  ] as const;

  for (const styleId of BUILT_IN_STYLE_IDS) {
    for (const spec of motifSpecs) {
      const recA = createGeometryRecordingContext();
      const recB = createGeometryRecordingContext();
      spec.draw(recA.ctx, styleId);
      spec.draw(recB.ctx, styleId);

      // Deterministic trace
      assert.deepEqual(
        recA.trace,
        recB.trace,
        `${spec.name} (${styleId}) must render deterministically`
      );

      // Multi-tone painterly richness
      assert.ok(
        recA.paintOps >= 6,
        `Expected >= 6 painterly fill/stroke operations in ${spec.name}, got ${recA.paintOps}`
      );
      assert.ok(
        recA.gradientCount >= 1,
        `Expected multi-tone gradient shading in ${spec.name}`
      );

      // Strict >= 34px die-cut margin on all 4 sides
      assert.ok(recA.xs.length > 0 && recA.ys.length > 0);
      const minX = Math.min(...recA.xs);
      const maxX = Math.max(...recA.xs);
      const minY = Math.min(...recA.ys);
      const maxY = Math.max(...recA.ys);
      assert.ok(
        minX >= 34,
        `${spec.name} (${styleId}) violated left margin >= 34px: minX=${minX}`
      );
      assert.ok(
        maxX <= spec.w - 34,
        `${spec.name} (${styleId}) violated right margin >= 34px: maxX=${maxX} vs ${spec.w - 34}`
      );
      assert.ok(
        minY >= 34,
        `${spec.name} (${styleId}) violated top margin >= 34px: minY=${minY}`
      );
      assert.ok(
        maxY <= spec.h - 34,
        `${spec.name} (${styleId}) violated bottom margin >= 34px: maxY=${maxY} vs ${spec.h - 34}`
      );

      // Default AtelierDeskCutout3D without plaqueTitle emits zero text clutter
      if (spec.name === 'AtelierDeskCutout3D') {
        assert.equal(recA.fillTextCalls.length, 0);
      }
    }
  }

  // AtelierDeskCutout3D with Polish plaqueTitle enforces mandatory 4th maxWidth parameter
  const polishRec = createGeometryRecordingContext();
  drawAtelierDeskMotif(
    polishRec.ctx,
    640,
    340,
    resolveScenicCutoutPalette(BUILT_IN_STYLES['tactile-craft']),
    {
      seed: 'desk-pl',
      plaqueTitle: 'Pracownia światła i dźwięku — zażółć gęślą jaźń',
    }
  );
  assert.equal(polishRec.fillTextCalls.length, 1);
  const call = polishRec.fillTextCalls[0]!;
  assert.match(call.text, /zażółć|ZAŻÓŁĆ/);
  assert.equal(
    typeof call.maxWidth,
    'number',
    'ctx.fillText MUST pass 4th maxWidth argument for Polish text safety'
  );
  assert.ok(
    (call.maxWidth ?? 0) >= 80 && (call.maxWidth ?? 9999) <= 640 - 34 * 2 - 48,
    `Expected bounded Polish maxWidth, got ${call.maxWidth}`
  );
});

test('ScenicCutoutMotifs mount PaperCutout3D with default world dimensions and invalidate cacheDeps on style or color changes', () => {
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
    const beforeStats = getPaperTextureCacheStats();

    const renderMotifsForStyle = (styleId: string, customPrimary?: string, title?: string) =>
      renderToStaticMarkup(
        React.createElement(
          StyleProvider,
          { style: styleId, renderBackdrop: false },
          React.createElement(SunburstArchCutout3D, {
            primaryColor: customPrimary,
          }),
          React.createElement(MountainRangeCutout3D, {
            primaryColor: customPrimary,
          }),
          React.createElement(CloudCanopyCutout3D, {
            anchor: 'center',
            primaryColor: customPrimary,
          }),
          React.createElement(PineGroveCutout3D, {
            primaryColor: customPrimary,
          }),
          React.createElement(AtelierDeskCutout3D, {
            primaryColor: customPrimary,
            plaqueTitle: title,
          })
        )
      );

    const htmlTactile = renderMotifsForStyle('tactile-craft');
    // Check default world dimensions appear on <planeGeometry args={[w, h]}>
    assert.match(htmlTactile, /5\.4,3\.1/);
    assert.match(htmlTactile, /5\.8,2\.7/);
    assert.match(htmlTactile, /3\.2,1\.25/);
    assert.match(htmlTactile, /1\.9,2\.1/);
    assert.match(htmlTactile, /3\.6,1\.85/);

    const afterTactile = getPaperTextureCacheStats();
    assert.ok(afterTactile.size >= beforeStats.size + 5);

    // Re-rendering with identical style + props hits the exact same cache entries
    renderMotifsForStyle('tactile-craft');
    assert.equal(getPaperTextureCacheStats().size, afterTactile.size);

    // Switching styleId invalidates cacheDeps immediately
    renderMotifsForStyle('cyber-telemetry');
    const afterCyber = getPaperTextureCacheStats();
    assert.ok(afterCyber.size > afterTactile.size);

    // Passing custom color or plaqueTitle invalidates cacheDeps immediately
    renderMotifsForStyle('cyber-telemetry', '#FF3366', 'Stół autorski');
    const afterOverride = getPaperTextureCacheStats();
    assert.ok(afterOverride.size > afterCyber.size);
  } finally {
    if (prevDoc === undefined) {
      delete (globalThis as { document?: unknown }).document;
    } else {
      (globalThis as { document?: unknown }).document = prevDoc;
    }
  }
});

test('computeScenicRoomTokens and IsometricScenicSet3D build 3 distinct architectural worlds and mount inside IsometricStage3D by default while preserving Clean Frame 0', () => {
  assert.equal(typeof IsometricScenicSet3D, 'function');
  assert.equal(typeof computeScenicRoomTokens, 'function');
  assert.equal(kitsRoot.IsometricScenicSet3D, IsometricScenicSet3D);
  assert.equal(kitsRoot.computeScenicRoomTokens, computeScenicRoomTokens);

  const scenicSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/isometric-3d/IsometricScenicSet3D.tsx'),
    'utf8'
  );
  const stageSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/isometric-3d/IsometricStage3D.tsx'),
    'utf8'
  );

  for (const [name, src] of [
    ['IsometricScenicSet3D.tsx', scenicSrc],
    ['IsometricStage3D.tsx', stageSrc],
  ] as const) {
    assert.doesNotMatch(src, /Math\.random\s*\(/, `${name} must not use Math.random`);
    assert.doesNotMatch(src, /useRef\b/, `${name} must not use mutable useRef`);
  }

  assert.match(scenicSrc, /CINEMATIC_SPRINGS/);
  assert.match(scenicSrc, /resolveArtWorld/);
  assert.match(scenicSrc, /frame\s*<=\s*0/);
  assert.match(stageSrc, /IsometricScenicSet3D/);
  assert.match(stageSrc, /showScenicSet\s*=\s*true/);

  // Verify any frame * freq animations in IsometricScenicSet3D obey [0.03, 0.055]
  const freqMatches = [...scenicSrc.matchAll(/frame\s*\*\s*(\d*\.?\d+)/g)].map((m) =>
    Number(m[1])
  );
  for (const freq of freqMatches) {
    assert.ok(
      freq >= 0.03 && freq <= 0.055,
      `Expected IsometricScenicSet3D frequency ${freq} to stay in [0.03, 0.055]`
    );
  }

  // Verify computeScenicRoomTokens across all 10 built-in styles
  for (const styleId of BUILT_IN_STYLE_IDS) {
    const style = BUILT_IN_STYLES[styleId];
    const expectedWorld = resolveArtWorld(style);
    const tokens = computeScenicRoomTokens(style);
    assert.equal(tokens.artWorld, expectedWorld);
    // Back wall around z = -3.1, centerpiece behind speakers around z = -1.35
    assert.ok(tokens.backWallZ <= -2.9 && tokens.backWallZ >= -3.3);
    assert.ok(tokens.centerpieceZ <= -1.2 && tokens.centerpieceZ >= -1.55);
  }

  const atelierTokens = computeScenicRoomTokens(BUILT_IN_STYLES['minimal-product']);
  assert.equal(atelierTokens.artWorld, 'atelier');
  assert.equal(atelierTokens.hasLightCove, true);
  assert.equal(atelierTokens.centerpieceKind, 'atelier-torus-prism');

  const illustrativeTokens = computeScenicRoomTokens(BUILT_IN_STYLES['tactile-craft']);
  assert.equal(illustrativeTokens.artWorld, 'illustrative');
  assert.equal(illustrativeTokens.hasArchedWindow, true);
  assert.equal(illustrativeTokens.hasBookshelfNiche, true);
  assert.equal(illustrativeTokens.centerpieceKind, 'workshop-sketch-lamp');

  const galleryTokens = computeScenicRoomTokens(BUILT_IN_STYLES['editorial-press']);
  assert.equal(galleryTokens.artWorld, 'editorial-gallery');
  assert.equal(galleryTokens.hasWindowSlit, true);
  assert.equal(galleryTokens.hasGalleryFrame, true);
  assert.equal(galleryTokens.centerpieceKind, 'gallery-stone-folio');

  // Explicit variant override works
  const forcedGallery = computeScenicRoomTokens(
    BUILT_IN_STYLES['minimal-product'],
    'editorial-gallery'
  );
  assert.equal(forcedGallery.artWorld, 'editorial-gallery');
  assert.equal(forcedGallery.hasGalleryFrame, true);

  // Key-light shaft aligns with optics.lightAngleDeg
  const leftLight = computeScenicRoomTokens({
    ...BUILT_IN_STYLES['editorial-press'],
    optics: { ...BUILT_IN_STYLES['editorial-press'].optics!, lightAngleDeg: -30 },
  });
  const rightLight = computeScenicRoomTokens({
    ...BUILT_IN_STYLES['editorial-press'],
    optics: { ...BUILT_IN_STYLES['editorial-press'].optics!, lightAngleDeg: 30 },
  });
  assert.ok(Math.sign(leftLight.lightShaftTiltRad) !== Math.sign(rightLight.lightShaftTiltRad));

  // Runtime Clean Frame 0 + Frame 36 rendering across all 3 ArtWorlds (16:9 and 9:16)
  for (const [styleId, expectedWorld] of [
    ['minimal-product', 'atelier'],
    ['tactile-craft', 'illustrative'],
    ['editorial-press', 'editorial-gallery'],
  ] as const) {
    const ScenicProbe: React.FC = () =>
      React.createElement(
        StyleProvider,
        { style: styleId, renderBackdrop: false },
        React.createElement(IsometricScenicSet3D, { radius: 5.4 })
      );

    const f0 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: ScenicProbe,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 90,
        fps: 60,
        frameToDisplay: 0,
      })
    );
    assert.doesNotMatch(f0, /isometric-scenic-set-3d|<group|<mesh/);

    const f36 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: ScenicProbe,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 90,
        fps: 60,
        frameToDisplay: 36,
      })
    );
    assert.match(
      f36,
      new RegExp(`isometric-scenic-set-3d-${expectedWorld}`)
    );
    assert.match(f36, new RegExp(`scenic-world-${expectedWorld}`));
    assert.doesNotMatch(f36, /data-art-world/);
    assert.ok((f36.match(/<mesh/g) ?? []).length >= 12);
  }

  // IsometricStage3D Clean Frame 0 remains 100% clean with default showScenicSet = true
  const StageZeroProbe: React.FC = () =>
    React.createElement(
      StyleProvider,
      { style: 'tactile-craft', renderBackdrop: false },
      React.createElement(IsometricStage3D, { radius: 5.4 })
    );
  const stageF0 = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: StageZeroProbe,
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 60,
      fps: 60,
      frameToDisplay: 0,
    })
  );
  assert.doesNotMatch(stageF0, /isometric-stage-3d|isometric-scenic-set-3d|<group|<mesh/);
});
