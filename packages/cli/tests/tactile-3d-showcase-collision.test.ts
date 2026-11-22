import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import {
  aabbClearance3D,
  auditSceneCollisions3D,
  computeDeformedSheetAabb3D,
  computeSurfaceClearanceY,
} from '../../core/src/kinematics';
import { SCREEN_GLASS_SHADOW_OFFSET_Z } from '../../kits/src/tactile-3d/ScreenGlassLayer3D';
import { evaluateTactileShowcaseFrame } from '../../../examples/tactile-3d-showcase/Tactile3DShowcase';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SHOWCASE_PATH = path.resolve(
  __dirname,
  '../../../examples/tactile-3d-showcase/Tactile3DShowcase.tsx'
);

test('Tactile3DShowcase has 0 OBB SAT collisions, >= 0.005 deformed inter-sheet & tabletop clearance across f=1..359', () => {
  const fps = 60;
  const width = 1920;
  const height = 1080;
  const durationInFrames = 360;

  let worstPairClearance = Infinity;
  let worstPairFrame = -1;
  let worstDeformedHeroRestClearance = Infinity;
  let worstDeformedHeroRestFrame = -1;
  let worstDeformedRestPairClearance = Infinity;
  let worstDeformedRestPairFrame = -1;
  let worstHeroSurfaceClearance = Infinity;
  let worstHeroSurfaceFrame = -1;
  let worstRestingSurfaceClearance = Infinity;

  let sawAnticipationDip = false;
  let sawFlightArc = false;
  let sawGlassImpact = false;
  let sawReturnSettle = false;

  for (let frame = 1; frame < durationInFrames; frame++) {
    const state = evaluateTactileShowcaseFrame(
      frame,
      fps,
      width,
      height,
      durationInFrames
    );

    const report = auditSceneCollisions3D(state.collisionBodies, {
      minClearance: 0.004,
      surfaceY: 0,
      minSurfaceClearance: 0.005,
    });

    if (report.minClearance < worstPairClearance) {
      worstPairClearance = report.minClearance;
      worstPairFrame = frame;
    }

    assert.equal(
      report.ok,
      true,
      `Collision/surface audit failed at frame=${frame}: violations=${JSON.stringify(
        report.violations
      )}, surfaceViolations=${JSON.stringify(report.surfaceViolations)}`
    );
    assert.equal(report.checkedPairs, 3, `Expected 3 checked sheet pairs at frame=${frame}`);

    // Verify GPU-deformed hero sheet stays strictly above tabletop y = 0 (>= 0.005)
    const heroDeformedAabb = computeDeformedSheetAabb3D(state.hero.deformedBounds);
    const heroSurfaceClearance = computeSurfaceClearanceY(heroDeformedAabb, 0);
    if (heroSurfaceClearance < worstHeroSurfaceClearance) {
      worstHeroSurfaceClearance = heroSurfaceClearance;
      worstHeroSurfaceFrame = frame;
    }
    assert.ok(
      heroSurfaceClearance >= 0.005,
      `Deformed hero sheet penetrated tabletop at frame=${frame}: clearance=${heroSurfaceClearance.toFixed(
        5
      )}, minY=${heroDeformedAabb.min[1].toFixed(5)}`
    );

    // Verify both deformed resting sheets stay strictly above tabletop y = 0 (>= 0.005)
    // AND never collide with the GPU-deformed hero sheet (>= 0.005 on every frame)
    const restingAabbs = state.restingSheets.map((resting) => {
      const restDeformedAabb = computeDeformedSheetAabb3D(resting.deformedBounds);
      const restSurfaceClearance = computeSurfaceClearanceY(restDeformedAabb, 0);
      if (restSurfaceClearance < worstRestingSurfaceClearance) {
        worstRestingSurfaceClearance = restSurfaceClearance;
      }
      assert.ok(
        restSurfaceClearance >= 0.005,
        `Deformed ${resting.id} penetrated tabletop at frame=${frame}: clearance=${restSurfaceClearance.toFixed(
          5
        )}`
      );

      const heroRestClearance = aabbClearance3D(heroDeformedAabb, restDeformedAabb);
      if (heroRestClearance < worstDeformedHeroRestClearance) {
        worstDeformedHeroRestClearance = heroRestClearance;
        worstDeformedHeroRestFrame = frame;
      }
      assert.ok(
        heroRestClearance >= 0.005,
        `Deformed hero penetrated ${resting.id} at frame=${frame}: clearance=${heroRestClearance.toFixed(
          5
        )}, heroMinY=${heroDeformedAabb.min[1].toFixed(5)}, restMaxY=${restDeformedAabb.max[1].toFixed(5)}`
      );
      return restDeformedAabb;
    });

    const restPairClearance = aabbClearance3D(restingAabbs[0]!, restingAabbs[1]!);
    if (restPairClearance < worstDeformedRestPairClearance) {
      worstDeformedRestPairClearance = restPairClearance;
      worstDeformedRestPairFrame = frame;
    }
    assert.ok(
      restPairClearance >= 0.005,
      `Deformed resting sheets penetrated each other at frame=${frame}: clearance=${restPairClearance.toFixed(
        5
      )}`
    );

    if (frame >= 60 && frame <= 85 && state.hero.position[1] < 0.13) {
      sawAnticipationDip = true;
    }
    if (frame >= 110 && frame <= 145 && state.hero.position[1] > 0.7) {
      sawFlightArc = true;
    }
    if (frame >= 160 && frame <= 260 && state.glassProgress === 1) {
      sawGlassImpact = true;
    }
    if (frame >= 345 && Math.abs(state.hero.position[1] - 0.135) < 1e-4) {
      sawReturnSettle = true;
    }
  }

  assert.equal(sawAnticipationDip, true, 'Expected anticipation dip phase');
  assert.equal(sawFlightArc, true, 'Expected 3D Disney flight arc phase');
  assert.equal(sawGlassImpact, true, 'Expected screen-glass impact hold phase');
  assert.equal(sawReturnSettle, true, 'Expected smooth settle return phase');

  assert.ok(
    worstPairClearance >= 0.004,
    `Worst OBB SAT pair clearance was ${worstPairClearance} at frame ${worstPairFrame}`
  );
  assert.ok(
    worstDeformedHeroRestClearance >= 0.005,
    `Worst deformed hero-vs-resting clearance was ${worstDeformedHeroRestClearance} at frame ${worstDeformedHeroRestFrame}`
  );
  assert.ok(
    worstDeformedRestPairClearance >= 0.005,
    `Worst deformed resting-pair clearance was ${worstDeformedRestPairClearance} at frame ${worstDeformedRestPairFrame}`
  );
  assert.ok(
    worstHeroSurfaceClearance >= 0.005,
    `Worst deformed hero tabletop clearance was ${worstHeroSurfaceClearance} at frame ${worstHeroSurfaceFrame}`
  );
  assert.ok(
    worstRestingSurfaceClearance >= 0.005,
    `Worst deformed resting sheet tabletop clearance was ${worstRestingSurfaceClearance}`
  );
});

test('Tactile3DShowcase hero orientation is quaternion-continuous (<= 12 deg/frame) with proportional glass Z scale and smooth bendX fade', () => {
  const fps = 60;
  const width = 1920;
  const height = 1080;
  const durationInFrames = 360;

  let prevQuat: THREE.Quaternion | null = null;
  let maxAngleDeg = 0;
  let maxAngleFrame = -1;
  let maxImpactBoundaryDeg = 0;
  let maxReturnBoundaryDeg = 0;

  for (let frame = 0; frame < durationInFrames; frame++) {
    const state = evaluateTactileShowcaseFrame(
      frame,
      fps,
      width,
      height,
      durationInFrames
    );

    assert.ok(
      state.hero.quaternion && state.hero.quaternion.length === 4,
      `Expected hero.quaternion to be defined on frame=${frame}`
    );
    assert.equal(
      state.hero.rotation,
      undefined,
      `Expected hero.rotation to remain undefined (no mixed rotation/quaternion toggling) at frame=${frame}`
    );

    const currQuat = new THREE.Quaternion(
      state.hero.quaternion[0],
      state.hero.quaternion[1],
      state.hero.quaternion[2],
      state.hero.quaternion[3]
    ).normalize();

    if (prevQuat) {
      const deltaDeg = (prevQuat.angleTo(currQuat) * 180) / Math.PI;
      if (deltaDeg > maxAngleDeg) {
        maxAngleDeg = deltaDeg;
        maxAngleFrame = frame;
      }
      if (frame >= 154 && frame <= 158) {
        maxImpactBoundaryDeg = Math.max(maxImpactBoundaryDeg, deltaDeg);
      }
      if (frame >= 269 && frame <= 273) {
        maxReturnBoundaryDeg = Math.max(maxReturnBoundaryDeg, deltaDeg);
      }
      assert.ok(
        deltaDeg <= 12,
        `Hero quaternion snapped by ${deltaDeg.toFixed(2)} deg at frame=${frame - 1}->${frame} (limit <= 12 deg/frame)`
      );
    }
    prevQuat = currQuat;

    // During screen-glass hold, Z scale must scale proportionally (0.3) so thickness + cornerWhip
    // stay strictly in front of SCREEN_GLASS_SHADOW_OFFSET_Z (-0.075).
    if (frame >= 156 && frame < 271) {
      assert.ok(
        Math.abs(state.hero.scale[2] - 0.3) < 1e-6,
        `Expected hero.scale[2] === 0.3 during glass hold at frame=${frame}, got ${state.hero.scale[2]}`
      );
      const halfThick = state.hero.thickness * 0.5;
      const maxCornerWhipZ =
        Math.abs(state.hero.deform.cornerWhip) * (state.hero.height * 0.5) * 0.85;
      const minLocalGlassZ = -(halfThick + maxCornerWhipZ) * state.hero.scale[2];
      assert.ok(
        minLocalGlassZ > SCREEN_GLASS_SHADOW_OFFSET_Z + 0.02,
        `Hero sheet poked near/behind contact shadow plane at frame=${frame}: minLocalGlassZ=${minLocalGlassZ.toFixed(
          4
        )} vs shadow=${SCREEN_GLASS_SHADOW_OFFSET_Z}`
      );
    }
  }

  assert.ok(
    maxAngleDeg <= 12,
    `Worst hero per-frame rotation delta was ${maxAngleDeg.toFixed(2)} deg at frame ${maxAngleFrame}`
  );
  assert.ok(
    maxImpactBoundaryDeg <= 8,
    `Impact boundary (f=154..158) rotation delta too large: ${maxImpactBoundaryDeg.toFixed(2)} deg`
  );
  assert.ok(
    maxReturnBoundaryDeg <= 8,
    `Return boundary (f=269..273) rotation delta too large: ${maxReturnBoundaryDeg.toFixed(2)} deg`
  );

  // Verify bendX smoothly fades to 0 before frame 271 and impactRotZ is active on impact.
  const f157 = evaluateTactileShowcaseFrame(157, fps, width, height, durationInFrames);
  const f270 = evaluateTactileShowcaseFrame(270, fps, width, height, durationInFrames);
  const f271 = evaluateTactileShowcaseFrame(271, fps, width, height, durationInFrames);
  assert.ok(Math.abs(f157.impactRotZ) > 0.005, 'Expected active impactRotZ right after impact (f=157)');
  assert.ok(Math.abs(f270.hero.deform.bendX) < 1e-6, `Expected bendX === 0 by f=270, got ${f270.hero.deform.bendX}`);
  assert.equal(f271.hero.deform.bendX, 0, 'Expected bendX === 0 at f=271');
});

test('Tactile3DShowcase advances daylight arc from 0.05 to 0.55 and wires PBR + editorial components cleanly', () => {
  const start = evaluateTactileShowcaseFrame(0, 60, 1920, 1080, 360);
  const mid = evaluateTactileShowcaseFrame(180, 60, 1920, 1080, 360);
  const end = evaluateTactileShowcaseFrame(359, 60, 1920, 1080, 360);

  assert.ok(Math.abs(start.timeOfDay - 0.05) < 1e-6);
  assert.ok(mid.timeOfDay > start.timeOfDay && mid.timeOfDay < end.timeOfDay);
  assert.ok(Math.abs(end.timeOfDay - 0.55) < 1e-6);

  const src = fs.readFileSync(SHOWCASE_PATH, 'utf8');
  assert.match(src, /getProceduralPbrMaps\('linen-weave'/);
  assert.match(src, /getProceduralPbrMaps\('wood-grain'/);
  assert.match(src, /<DaylightArcRig3D/);
  assert.match(src, /finish="linen-glaze"/);
  assert.match(src, /finish="parchment-matte"/);
  assert.match(src, /<FloatingEditorialDisplay/);
  assert.match(src, /<PaperRibbonTimeline/);
  assert.match(src, /rotZ:\s*state\.impactRotZ/);
  assert.doesNotMatch(src, /rotation=\{state\.hero\.rotation\}/);
  assert.doesNotMatch(src, /Math\.random\s*\(/);
  assert.doesNotMatch(src, /<SyncStudioIbl3D/);
});
