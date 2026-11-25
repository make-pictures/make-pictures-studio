import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ZERO_SHEET_DEFORM,
  aabbClearance3D,
  aabbIntersects3D,
  auditSceneCollisions3D,
  computeDeformedSheetAabb3D,
  computeOrientedBoxAabb3D,
  computeSurfaceClearanceY,
  disneyEase,
  evaluateAnticipation,
  evaluateArc3D,
  evaluateSurfaceImpact,
  evaluateVelocityStretch,
  evaluateSecondaryCascade,
  obbClearanceSat3D,
  obbIntersectsSat3D,
} from '../../remotion/src/kinematics';
import {
  computeCameraBasis3D,
  evaluateCameraKeyframes3D,
  projectScreenGlassPose,
  computeGlassLightingBlend,
  evaluateDirectorCamera3D,
} from '../../remotion/src/camera';

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
  assert.deepEqual(evaluateSecondaryCascade(10, 4, 4), { offsetY: 0, rotZ: 0, bendY: 0 });
  assert.ok(Math.abs(evaluateSecondaryCascade(10, 3, 4).bendY) > 0);
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

  // Unsorted keyframes must be sorted on a shallow copy without mutating the caller's array
  const unsorted = [keyframes[2], keyframes[0], keyframes[1]];
  const originalOrder = unsorted.map((k) => k.fromFrame);
  const midUnsorted = evaluateCameraKeyframes3D(80, unsorted, [], 0);
  assert.deepEqual(
    unsorted.map((k) => k.fromFrame),
    originalOrder,
    'evaluateCameraKeyframes3D must not mutate caller keyframes array'
  );
  assert.ok(Math.abs(midUnsorted.position[0] - mid.position[0]) < 1e-6);
  assert.ok(Math.abs(midUnsorted.fov - mid.fov) < 1e-6);

  // Impulse recoil must apply along camera up and -forward (not world +Z)
  const sideCam = [{ fromFrame: 0, position: [-6, 0, 0] as [number, number, number], target: [0, 0, 0] as [number, number, number], fov: 40 }];
  const sideRecoil = evaluateCameraKeyframes3D(10, sideCam, [{ frame: 10, intensity: 0.5, decayFrames: 12 }], 0);
  assert.ok(sideRecoil.position[0] < -6.3, `Expected recoil pullback along -forward (-X), got x=${sideRecoil.position[0]}`);
  assert.ok(sideRecoil.position[1] < -0.2, `Expected recoil kick along camera up (-Y at dt=0), got y=${sideRecoil.position[1]}`);
  assert.ok(Math.abs(sideRecoil.position[2]) < 1e-6, `Expected zero world +Z drift for +X-facing camera, got z=${sideRecoil.position[2]}`);

  const overheadCam = [{ fromFrame: 0, position: [0, 6, 0] as [number, number, number], target: [0, 0, 0] as [number, number, number], fov: 40 }];
  const overheadRecoil = evaluateCameraKeyframes3D(10, overheadCam, [{ frame: 10, intensity: 0.5, decayFrames: 12 }], 0);
  assert.ok(overheadRecoil.position[1] > 6.3, `Expected overhead recoil pullback along -forward (+Y), got y=${overheadRecoil.position[1]}`);
  assert.ok(overheadRecoil.position[2] > 0.2, `Expected overhead recoil kick along camera up ([0,0,-1] * negative), got z=${overheadRecoil.position[2]}`);
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
    path.resolve(__dirname, '../../remotion/src/kinematics/disney.ts'),
    path.resolve(__dirname, '../../remotion/src/kinematics/collision3d.ts'),
    path.resolve(__dirname, '../../remotion/src/kinematics/index.ts'),
    path.resolve(__dirname, '../../remotion/src/camera/cameraBasis3D.ts'),
    path.resolve(__dirname, '../../remotion/src/camera/shotTypes.ts'),
    path.resolve(__dirname, '../../remotion/src/camera/DirectorCamera3D.tsx'),
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
  const directorCameraSrc = fs.readFileSync(
    path.resolve(__dirname, '../../remotion/src/camera/DirectorCamera3D.tsx'),
    'utf8'
  );
  assert.doesNotMatch(
    directorCameraSrc,
    /rotateZ\s*\(/,
    'Dead rotateZ method must be removed from R3FCameraLike in DirectorCamera3D.tsx'
  );
});

test('aabbClearance3D, aabbIntersects3D, and computeSurfaceClearanceY compute exact separation', () => {
  const a = { min: [0, 0.1, 0] as [number, number, number], max: [1, 1.1, 1] as [number, number, number] };
  const b = { min: [1.25, 0.1, 0] as [number, number, number], max: [2.25, 1.1, 1] as [number, number, number] };
  const c = { min: [0.5, 0.1, 0] as [number, number, number], max: [1.5, 1.1, 1] as [number, number, number] };
  const touching = { min: [1.0, 0.1, 0] as [number, number, number], max: [2.0, 1.1, 1] as [number, number, number] };

  assert.ok(Math.abs(aabbClearance3D(a, b) - 0.25) < 1e-6);
  assert.equal(aabbIntersects3D(a, b), false);
  assert.ok(aabbClearance3D(a, c) < 0);
  assert.equal(aabbIntersects3D(a, c), true);
  assert.equal(aabbClearance3D(a, touching), 0);
  assert.equal(aabbIntersects3D(a, touching), true);
  assert.equal(aabbIntersects3D(a, touching, -1e-5), false);
  assert.ok(Math.abs(computeSurfaceClearanceY(a, 0) - 0.1) < 1e-6);
  assert.ok(Math.abs(computeSurfaceClearanceY(a, 0.25) - -0.15) < 1e-6);
});

test('computeDeformedSheetAabb3D detects tabletop penetration caused by GPU bendY and handles all deform terms', () => {
  const flatBounds = computeDeformedSheetAabb3D({
    position: [0, 0.05, 0],
    width: 1.0,
    height: 1.4,
    thickness: 0.014,
    rotation: [-Math.PI / 2, 0, 0],
    deform: { bendY: 0 },
  });
  assert.ok(Math.abs(computeSurfaceClearanceY(flatBounds, 0) - (0.05 - 0.007)) < 1e-6);

  // Lying flat with rotation -PI/2 around X maps local +Z to world +Y, so negative bendY pushes ends down into y < 0
  const bentDownBounds = computeDeformedSheetAabb3D({
    position: [0, 0.05, 0],
    width: 1.0,
    height: 1.4,
    thickness: 0.014,
    rotation: [-Math.PI / 2, 0, 0],
    deform: { bendY: -0.45 },
  });
  assert.ok(
    computeSurfaceClearanceY(bentDownBounds, 0) < 0,
    `Expected bent sheet edge to penetrate y=0 tabletop, got minY=${bentDownBounds.min[1]}`
  );

  // Verify velocityStretch elongates local Y and narrows local X (area-preserving)
  const stretchedBounds = computeDeformedSheetAabb3D({
    position: [0, 0, 0],
    width: 2.0,
    height: 4.0,
    thickness: 0.02,
    deform: { velocityStretch: 0.21, bendX: 0.2, twist: 0.15, cornerWhip: 0.1 },
  });
  assert.ok(Math.abs(stretchedBounds.max[1] - 2.0 * 1.21) < 1e-6);
  assert.ok(Math.abs(stretchedBounds.max[0] - 1.0 / Math.sqrt(1.21)) < 1e-6);
  assert.ok(stretchedBounds.max[2] > 0.01);

  // Verify 9x9 sampling catches interior parabolic peak at ny=0.75 missed by 5x5 grid
  // At nx=1, bendY=-1.0, twist=1.27, hw=hh=1: zBend(0.5)=0.45675, zBend(0.75)=0.49125, zBend(1)=0.457
  const finePeakBounds = computeDeformedSheetAabb3D({
    position: [0, 0, 0],
    width: 2.0,
    height: 2.0,
    thickness: 0,
    deform: { bendY: -1.0, twist: 1.27 },
  });
  assert.ok(
    finePeakBounds.max[2] > 0.49,
    `Expected 9x9 sample grid to capture ny=0.75 extremum (~0.49125), got ${finePeakBounds.max[2]}`
  );
});

test('15-axis obbClearanceSat3D distinguishes diagonal non-intersection where AABBs overlap', () => {
  // Two thin bars rotated 45 deg in XY plane, parallel with positive normal gap but overlapping AABBs
  const barA = {
    id: 'bar-a',
    position: [0, 0, 0] as [number, number, number],
    size: [2.0, 0.2, 0.2] as [number, number, number],
    rotation: [0, 0, Math.PI / 4] as [number, number, number],
  };
  const barB = {
    id: 'bar-b',
    position: [-0.35, 0.35, 0] as [number, number, number],
    size: [2.0, 0.2, 0.2] as [number, number, number],
    rotation: [0, 0, Math.PI / 4] as [number, number, number],
  };
  assert.equal(
    aabbIntersects3D(computeOrientedBoxAabb3D(barA), computeOrientedBoxAabb3D(barB)),
    true,
    'AABBs of parallel 45-deg bars must overlap'
  );
  const gap = obbClearanceSat3D(barA, barB);
  const expectedGap = Math.hypot(0.35, 0.35) - 0.2;
  assert.ok(Math.abs(gap - expectedGap) < 1e-5, `Expected SAT gap ${expectedGap}, got ${gap}`);
  assert.equal(obbIntersectsSat3D(barA, barB), false);
});

test('15-axis obbClearanceSat3D separates boxes along cross-edge A_i x B_j axis when all 6 face axes overlap', () => {
  // Box A is axis-aligned at origin; Box B is rotated [PI/4, PI/4, 0] and offset by (0, -2.05, 2.05).
  // All 6 face axes overlap (clearance <= -0.657), while cross-edge axis normalize(A_x x B_y) = (0, -sqrt(2)/2, sqrt(2)/2)
  // yields exact positive separation (2.05 - 2) * sqrt(2) = 0.05 * sqrt(2).
  const boxA = {
    id: 'cube-a',
    position: [0, 0, 0] as [number, number, number],
    size: [2, 2, 2] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
  };
  const boxB = {
    id: 'cube-b',
    position: [0, -2.05, 2.05] as [number, number, number],
    size: [2, 2, 2] as [number, number, number],
    rotation: [Math.PI / 4, Math.PI / 4, 0] as [number, number, number],
  };
  const gap = obbClearanceSat3D(boxA, boxB);
  const expectedGap = 0.05 * Math.SQRT2;
  assert.ok(
    Math.abs(gap - expectedGap) < 1e-6,
    `Expected cross-edge SAT gap ${expectedGap}, got ${gap}`
  );
  assert.equal(obbIntersectsSat3D(boxA, boxB), false);

  // Moving B slightly closer causes genuine edge-edge penetration
  const boxBCloser = { ...boxB, position: [0, -1.95, 1.95] as [number, number, number] };
  assert.ok(obbClearanceSat3D(boxA, boxBCloser) < 0);
  assert.equal(obbIntersectsSat3D(boxA, boxBCloser), true);
});

test('computeOrientedBoxAabb3D and obbClearanceSat3D honor quaternion and eulerOrder (XYZ, YXZ, ZYX)', () => {
  const halfAngle = Math.PI / 8; // 45 deg around Z => q = [0, 0, sin(PI/8), cos(PI/8)]
  const boxEuler = {
    position: [1, 2, 3] as [number, number, number],
    size: [2, 0.4, 0.6] as [number, number, number],
    rotation: [0, 0, Math.PI / 4] as [number, number, number],
  };
  const boxQuat = {
    position: [1, 2, 3] as [number, number, number],
    size: [2, 0.4, 0.6] as [number, number, number],
    quaternion: [0, 0, Math.sin(halfAngle), Math.cos(halfAngle)] as [number, number, number, number],
  };
  const aabbEuler = computeOrientedBoxAabb3D(boxEuler);
  const aabbQuat = computeOrientedBoxAabb3D(boxQuat);
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(aabbEuler.min[i]! - aabbQuat.min[i]!) < 1e-6);
    assert.ok(Math.abs(aabbEuler.max[i]! - aabbQuat.max[i]!) < 1e-6);
  }

  // Verify non-normalized quaternion produces identical result
  const boxUnnormQuat = {
    ...boxQuat,
    quaternion: [0, 0, 3 * Math.sin(halfAngle), 3 * Math.cos(halfAngle)] as [number, number, number, number],
  };
  const aabbUnnorm = computeOrientedBoxAabb3D(boxUnnormQuat);
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(aabbEuler.min[i]! - aabbUnnorm.min[i]!) < 1e-6);
    assert.ok(Math.abs(aabbEuler.max[i]! - aabbUnnorm.max[i]!) < 1e-6);
  }

  // Verify eulerOrder XYZ, YXZ, ZYX yield distinct world orientations for asymmetric multi-axis rotation
  const base = {
    position: [0, 0, 0] as [number, number, number],
    size: [4, 0.4, 0.2] as [number, number, number],
    rotation: [Math.PI / 3, Math.PI / 4, Math.PI / 6] as [number, number, number],
  };
  const aabbXYZ = computeOrientedBoxAabb3D({ ...base, eulerOrder: 'XYZ' });
  const aabbYXZ = computeOrientedBoxAabb3D({ ...base, eulerOrder: 'YXZ' });
  const aabbZYX = computeOrientedBoxAabb3D({ ...base, eulerOrder: 'ZYX' });
  assert.ok(Math.abs(aabbXYZ.max[1] - aabbYXZ.max[1]) > 1e-3, 'XYZ and YXZ should produce different Y extents');
  assert.ok(Math.abs(aabbXYZ.max[0] - aabbZYX.max[0]) > 1e-3, 'XYZ and ZYX should produce different X extents');
  assert.ok(Math.abs(aabbYXZ.max[2] - aabbZYX.max[2]) > 1e-3, 'YXZ and ZYX should produce different Z extents');
});

test('auditSceneCollisions3D reports pair violations, ignoredPairs, and surfaceY violations', () => {
  const barA = {
    id: 'bar-a',
    position: [0, 0.3, 0] as [number, number, number],
    size: [2.0, 0.2, 0.2] as [number, number, number],
    rotation: [0, 0, Math.PI / 4] as [number, number, number],
  };
  const barB = {
    id: 'bar-b',
    position: [-0.35, 0.65, 0] as [number, number, number],
    size: [2.0, 0.2, 0.2] as [number, number, number],
    rotation: [0, 0, Math.PI / 4] as [number, number, number],
  };

  const reportOk = auditSceneCollisions3D([barA, barB], { minClearance: 0.05 });
  assert.equal(reportOk.ok, true);
  assert.equal(reportOk.checkedPairs, 1);
  assert.equal(reportOk.violations.length, 0);
  assert.equal(reportOk.surfaceViolations.length, 0);

  const reportTight = auditSceneCollisions3D([barA, barB], { minClearance: 0.4 });
  assert.equal(reportTight.ok, false);
  assert.equal(reportTight.violations.length, 1);
  assert.equal(reportTight.violations[0]!.idA, 'bar-a');
  assert.equal(reportTight.violations[0]!.idB, 'bar-b');

  // Ignored pair (reversed order) suppresses pairwise violation
  const reportIgnored = auditSceneCollisions3D([barA, barB], {
    minClearance: 0.4,
    ignoredPairs: [['bar-b', 'bar-a']],
  });
  assert.equal(reportIgnored.ok, true);
  assert.equal(reportIgnored.checkedPairs, 0);
  assert.equal(reportIgnored.minClearance, Infinity);

  // SurfaceY violation when rotated bar dips below y = 0
  const reportSurface = auditSceneCollisions3D([barA, barB], {
    minClearance: 0.05,
    surfaceY: 0,
    minSurfaceClearance: 0.01,
  });
  assert.equal(reportSurface.ok, false);
  assert.equal(reportSurface.violations.length, 0);
  assert.ok(reportSurface.surfaceViolations.length >= 1);
  assert.equal(reportSurface.surfaceViolations[0]!.id, 'bar-a');
  assert.ok(reportSurface.surfaceViolations[0]!.clearance < 0);
});
