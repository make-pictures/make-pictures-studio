import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  auditSceneCollisions3D,
  computeDeformedSheetAabb3D,
  computeSurfaceClearanceY,
} from '../../core/src/kinematics';
import { evaluateTactileShowcaseFrame } from '../../../examples/tactile-3d-showcase/Tactile3DShowcase';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SHOWCASE_PATH = path.resolve(
  __dirname,
  '../../../examples/tactile-3d-showcase/Tactile3DShowcase.tsx'
);

test('Tactile3DShowcase has 0 OBB SAT collisions and >= 0.005 tabletop clearance across all 360 frames (f=1..359)', () => {
  const fps = 60;
  const width = 1920;
  const height = 1080;
  const durationInFrames = 360;

  let worstPairClearance = Infinity;
  let worstPairFrame = -1;
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

    // Also verify both deformed resting sheets stay strictly above tabletop y = 0 (>= 0.005)
    for (const resting of state.restingSheets) {
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
    }

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
    worstHeroSurfaceClearance >= 0.005,
    `Worst deformed hero tabletop clearance was ${worstHeroSurfaceClearance} at frame ${worstHeroSurfaceFrame}`
  );
  assert.ok(
    worstRestingSurfaceClearance >= 0.005,
    `Worst deformed resting sheet tabletop clearance was ${worstRestingSurfaceClearance}`
  );
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
  assert.doesNotMatch(src, /Math\.random\s*\(/);
  assert.doesNotMatch(src, /<SyncStudioIbl3D/);
});
