import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ZERO_SHEET_DEFORM,
  disneyEase,
  evaluateAnticipation,
  evaluateArc3D,
  evaluateSurfaceImpact,
  evaluateVelocityStretch,
  evaluateSecondaryCascade,
} from '../../core/src/kinematics';
import {
  computeCameraBasis3D,
  evaluateCameraKeyframes3D,
  projectScreenGlassPose,
  computeGlassLightingBlend,
  evaluateDirectorCamera3D,
} from '../../core/src/camera';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('disneyEase clamps endpoints and shapes launch/hang/slap/settle asymmetrically', () => {
  for (const mode of ['launch', 'hang', 'slap', 'settle'] as const) {
    assert.equal(disneyEase(-0.5, mode), 0);
    assert.equal(disneyEase(0, mode), 0);
    assert.equal(disneyEase(1, mode), 1);
    assert.equal(disneyEase(1.5, mode), 1);
  }
  assert.ok(disneyEase(0.3, 'launch') > 0.6, 'launch should accelerate quickly off the start');
  assert.ok(disneyEase(0.3, 'slap') < 0.1, 'slap should wind up slowly then snap into impact');
  assert.ok(disneyEase(0.5, 'settle') > 0.9, 'settle should rapidly ease into rest');
  assert.ok(
    disneyEase(0.5, 'hang') > 0.45 && disneyEase(0.5, 'hang') < 0.55,
    'hang should linger smoothly through midpoint'
  );
});

test('evaluateAnticipation returns exact zeros at boundaries and negative counter-motion at peak', () => {
  assert.deepEqual(evaluateAnticipation(0), { offsetY: 0, offsetZ: 0, bendY: 0, tiltX: 0 });
  assert.deepEqual(evaluateAnticipation(1), { offsetY: 0, offsetZ: 0, bendY: 0, tiltX: 0 });
  const peak = evaluateAnticipation(0.5, 1.0);
  assert.ok(peak.offsetY < 0);
  assert.ok(peak.offsetZ < 0);
  assert.ok(peak.bendY < 0);
  assert.ok(peak.tiltX > 0);
});

test('evaluateArc3D computes cubic Bezier position, analytic velocity, and clamped bankRoll', () => {
  const start = evaluateArc3D([0, 0, 0], [1, 2, 0], [3, 2, 0], [4, 0, 0], 0);
  assert.deepEqual(start.position, [0, 0, 0]);
  assert.deepEqual(start.velocity, [3, 6, 0]);
  assert.ok(start.bankRoll < 0 && start.bankRoll >= -0.42);

  const end = evaluateArc3D([0, 0, 0], [1, 2, 0], [3, 2, 0], [4, 0, 0], 1);
  assert.deepEqual(end.position, [4, 0, 0]);
  assert.deepEqual(end.velocity, [3, -6, 0]);

  const extreme = evaluateArc3D([0, 0, 0], [50, 0, 0], [100, 0, 0], [150, 0, 0], 0.5);
  assert.equal(extreme.bankRoll, -0.42);
});

test('evaluateSurfaceImpact preserves area (scaleX * scaleY === 1) and settles to exact zero after 36 frames', () => {
  const before = evaluateSurfaceImpact(-1);
  assert.deepEqual(before, {
    scaleX: 1,
    scaleY: 1,
    cornerWhip: 0,
    rotZ: 0,
    contactShadowOpacity: 0,
  });

  const hit = evaluateSurfaceImpact(1.5, 1.0);
  assert.ok(Math.abs(hit.scaleX * hit.scaleY - 1) < 1e-12);
  assert.ok(Math.abs(hit.cornerWhip) > 0.01);
  assert.ok(hit.contactShadowOpacity > 0.2);

  const settled = evaluateSurfaceImpact(40, 1.0);
  assert.equal(settled.cornerWhip, 0);
  assert.equal(settled.rotZ, 0);
});

test('evaluateVelocityStretch and evaluateSecondaryCascade obey thresholds and decay cleanly', () => {
  assert.equal(ZERO_SHEET_DEFORM.bendY, 0);
  assert.equal(evaluateVelocityStretch([0.5, 0, 0], 1.4, 0.085), 0);
  assert.equal(evaluateVelocityStretch([100, 0, 0], 1.4, 0.085), 0.085);

  const topPeak = evaluateSecondaryCascade(2, 0);
  const deepBeforeTrigger = evaluateSecondaryCascade(2, 2);
  const deepPeak = evaluateSecondaryCascade(5, 2);
  assert.deepEqual(deepBeforeTrigger, { offsetY: 0, rotZ: 0, bendY: 0 });
  assert.ok(Math.abs(topPeak.bendY) > Math.abs(deepPeak.bendY));
  assert.ok(Math.abs(deepPeak.bendY / topPeak.bendY - Math.pow(0.58, 2)) < 1e-12);
  assert.deepEqual(evaluateSecondaryCascade(4, 5, 4), { offsetY: 0, rotZ: 0, bendY: 0 });
  assert.deepEqual(evaluateSecondaryCascade(40, 0, 4), { offsetY: 0, rotZ: 0, bendY: 0 });
});

test('computeCameraBasis3D returns orthonormal basis and avoids gimbal lock when looking straight down', () => {
  const overhead = computeCameraBasis3D([0, 5, 0], [0, 0, 0], 0);
  for (const vec of [overhead.forward, overhead.right, overhead.up]) {
    const len = Math.hypot(vec[0], vec[1], vec[2]);
    assert.ok(Number.isFinite(len) && Math.abs(len - 1) < 1e-6);
  }
  const dotFR =
    overhead.forward[0] * overhead.right[0] +
    overhead.forward[1] * overhead.right[1] +
    overhead.forward[2] * overhead.right[2];
  const dotRU =
    overhead.right[0] * overhead.up[0] +
    overhead.right[1] * overhead.up[1] +
    overhead.right[2] * overhead.up[2];
  const dotFU =
    overhead.forward[0] * overhead.up[0] +
    overhead.forward[1] * overhead.up[1] +
    overhead.forward[2] * overhead.up[2];
  assert.ok(Math.abs(dotFR) < 1e-6);
  assert.ok(Math.abs(dotRU) < 1e-6);
  assert.ok(Math.abs(dotFU) < 1e-6);

  // Straight-up overhead gimbal guard as well
  const straightUp = computeCameraBasis3D([0, 0, 0], [0, 5, 0], 0.35);
  for (const vec of [straightUp.forward, straightUp.right, straightUp.up]) {
    const len = Math.hypot(vec[0], vec[1], vec[2]);
    assert.ok(Number.isFinite(len) && Math.abs(len - 1) < 1e-6);
  }

  const degenerate = computeCameraBasis3D([1, 2, 3], [1, 2, 3], 0);
  assert.deepEqual(degenerate.forward, [0, 0, -1]);
});

test('projectScreenGlassPose and computeGlassLightingBlend match FOV/aspect math', () => {
  const cam = evaluateCameraKeyframes3D(
    0,
    [{ fromFrame: 0, position: [0, 0, 5], target: [0, 0, 0], fov: 60 }],
    [],
    0
  );
  const center = projectScreenGlassPose(cam, 0, 0, 2.0, 16 / 9);
  const expectedH = 2 * 2.0 * Math.tan((60 * Math.PI) / 360);
  assert.ok(Math.abs(center.visibleHeight - expectedH) < 1e-6);
  assert.ok(Math.abs(center.visibleWidth - expectedH * (16 / 9)) < 1e-6);
  assert.ok(Math.abs(center.position[2] - 3.0) < 1e-6);

  const topRight = projectScreenGlassPose(cam, 1, 1, 2.0, 16 / 9);
  assert.ok(Math.abs(topRight.position[0] - center.visibleWidth * 0.5) < 1e-6);
  assert.ok(Math.abs(topRight.position[1] - center.visibleHeight * 0.5) < 1e-6);

  assert.deepEqual(computeGlassLightingBlend(0), {
    sceneLampMultiplier: 1,
    lensFillIntensity: 0,
    castSceneShadow: true,
  });
  const full = computeGlassLightingBlend(1, 0.18);
  assert.ok(Math.abs(full.sceneLampMultiplier - 0.82) < 1e-6);
  assert.equal(full.lensFillIntensity, 0.85);
  assert.equal(full.castSceneShadow, false);
});

test('evaluateCameraKeyframes3D interpolates glides, honors cuts, and decays recoil impulses to zero', () => {
  const keyframes = [
    { fromFrame: 0, position: [0, 2, 6] as [number, number, number], target: [0, 0, 0] as [number, number, number], fov: 40 },
    { fromFrame: 60, position: [4, 2, 6] as [number, number, number], target: [0, 0, 0] as [number, number, number], fov: 30, transition: 'glide' as const, transitionFrames: 40 },
    { fromFrame: 120, position: [-2, 4, 5] as [number, number, number], target: [0, 1, 0] as [number, number, number], fov: 24, transition: 'cut' as const },
  ];
  const mid = evaluateCameraKeyframes3D(80, keyframes, [], 0);
  assert.ok(Math.abs(mid.position[0] - 2) < 1e-6);
  assert.ok(Math.abs(mid.fov - 35) < 1e-6);

  const cut = evaluateCameraKeyframes3D(120, keyframes, [], 0);
  assert.deepEqual(cut.position, [-2, 4, 5]);
  assert.equal(cut.fov, 24);

  const imp = [{ frame: 10, intensity: 0.4, decayFrames: 12 }];
  const duringRecoil = evaluateCameraKeyframes3D(11, keyframes, imp, 0);
  const afterRecoil = evaluateCameraKeyframes3D(25, keyframes, imp, 0);
  const baseAt25 = evaluateCameraKeyframes3D(25, keyframes, [], 0);
  assert.notDeepEqual(duringRecoil.position, [0, 2, 6]);
  assert.deepEqual(afterRecoil.position, baseAt25.position);
});

test('evaluateDirectorCamera3D supports macro shot and returns orthonormal forward/right/up basis', () => {
  const pose = evaluateDirectorCamera3D({
    frame: 30,
    fps: 60,
    width: 1920,
    height: 1080,
    anchors: { subject: { position: [0, 0.5, 0], height: 0.6, radius: 0.4 } },
    shots: [{ fromFrame: 0, shot: 'macro', target: 'subject' }],
    handheldIntensity: 0,
  });
  assert.equal(pose.fov, 24);
  assert.ok(pose.telemetry.focusDistance < 2.6, 'macro shot should frame closer than standard close-up');
  assert.ok(Math.abs(Math.hypot(...pose.forward) - 1) < 1e-6);
  assert.ok(Math.abs(Math.hypot(...pose.right) - 1) < 1e-6);
  assert.ok(Math.abs(Math.hypot(...pose.up) - 1) < 1e-6);

  // Fallback empty-shots pose also exposes orthonormal forward/right/up
  const fallback = evaluateDirectorCamera3D({
    frame: 0,
    fps: 60,
    width: 1920,
    height: 1080,
    anchors: {},
    shots: [],
  });
  assert.ok(Math.abs(Math.hypot(...fallback.forward) - 1) < 1e-6);
  assert.ok(Math.abs(Math.hypot(...fallback.right) - 1) < 1e-6);
  assert.ok(Math.abs(Math.hypot(...fallback.up) - 1) < 1e-6);
});

test('core kinematics and camera modules remain deterministic with zero three runtime imports', () => {
  const filesToAudit = [
    path.resolve(__dirname, '../../core/src/kinematics/disney.ts'),
    path.resolve(__dirname, '../../core/src/kinematics/index.ts'),
    path.resolve(__dirname, '../../core/src/camera/cameraBasis3D.ts'),
    path.resolve(__dirname, '../../core/src/camera/shotTypes.ts'),
    path.resolve(__dirname, '../../core/src/camera/DirectorCamera3D.tsx'),
  ];
  for (const filePath of filesToAudit) {
    const src = fs.readFileSync(filePath, 'utf8');
    assert.doesNotMatch(src, /Math\.random\s*\(/, `Forbidden Math.random in ${filePath}`);
    assert.doesNotMatch(
      src,
      /from\s+['"](?:three|@react-three\/fiber)['"]|require\(\s*['"](?:three|@react-three\/fiber)['"]\s*\)|import\(\s*['"](?:three|@react-three\/fiber)['"]\s*\)/,
      `Forbidden runtime three/r3f import in ${filePath}`
    );
  }
});
