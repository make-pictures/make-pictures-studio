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
