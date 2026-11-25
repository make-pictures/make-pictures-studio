import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateDirectorCamera2D } from '../../remotion/src/camera/DirectorCamera2D';
import {
  buildElasticCordPath,
  computeLiveNodePort,
} from '../../remotion/src/kits/motion-diagrams-2d/bezierGeometry';
import {
  buildElasticCordPath as kitsBuildElasticCordPath,
  computeLiveNodePort as kitsComputeLiveNodePort,
} from '../../remotion/src/kits/index';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

test('DirectorCamera2D defaults handheldIntensity to 0 (rock-steady 2D diagrams across frames)', () => {
  const nodes = {
    a: { cx: 480, cy: 540, w: 320, h: 180 },
    b: { cx: 1440, cy: 540, w: 320, h: 180 },
  };
  const shots = [
    { fromFrame: 0, target: ['a', 'b'], transition: 'cut' as const, zoom: 1 },
  ];

  const pose0 = evaluateDirectorCamera2D({
    frame: 10,
    fps: 60,
    stageWidth: 1920,
    stageHeight: 1080,
    nodes,
    shots,
  });
  const pose1 = evaluateDirectorCamera2D({
    frame: 120,
    fps: 60,
    stageWidth: 1920,
    stageHeight: 1080,
    nodes,
    shots,
  });
  const pose2 = evaluateDirectorCamera2D({
    frame: 300,
    fps: 60,
    stageWidth: 1920,
    stageHeight: 1080,
    nodes,
    shots,
  });

  // Zero default handheld float: exact deterministic coordinates across every settled frame
  assert.equal(pose0.x, 960);
  assert.equal(pose0.y, 540);
  assert.equal(pose0.zoom, 1);
  assert.equal(pose0.rotateZ, 0);
  assert.deepEqual(
    { x: pose1.x, y: pose1.y, zoom: pose1.zoom, rotateZ: pose1.rotateZ },
    { x: pose0.x, y: pose0.y, zoom: pose0.zoom, rotateZ: pose0.rotateZ }
  );
  assert.deepEqual(
    { x: pose2.x, y: pose2.y, zoom: pose2.zoom, rotateZ: pose2.rotateZ },
    { x: pose0.x, y: pose0.y, zoom: pose0.zoom, rotateZ: pose0.rotateZ }
  );
});

test('computeLiveNodePort matches exact center-origin affine scale -> rotate -> translate + outset math', () => {
  assert.equal(computeLiveNodePort, kitsComputeLiveNodePort);
  const box = { cx: 500, cy: 400, w: 300, h: 200 };

  // Identity matches border ports exactly
  assert.deepEqual(computeLiveNodePort(box, 'right'), { x: 650, y: 400 });
  assert.deepEqual(computeLiveNodePort(box, 'left'), { x: 350, y: 400 });
  assert.deepEqual(computeLiveNodePort(box, 'top'), { x: 500, y: 300 });
  assert.deepEqual(computeLiveNodePort(box, 'bottom'), { x: 500, y: 500 });

  // 90° CW rotation with non-uniform scale + translate + outsetPx
  const pt90 = computeLiveNodePort(
    box,
    'right',
    { translateX: 25, translateY: -40, rotateDeg: 90, scaleX: 1.2, scaleY: 0.8 },
    10
  );
  // Local scaled right port = +150 * 1.2 = +180, plus outset 10 => x1 = +190, y1 = 0
  // Rotated +90 deg CW => (0, +190); translated by (+25, -40) from (500, 400) => (525, 550)
  assert.ok(Math.abs(pt90.x - 525) < 1e-9, `Expected x=525, got ${pt90.x}`);
  assert.ok(Math.abs(pt90.y - 550) < 1e-9, `Expected y=550, got ${pt90.y}`);

  // Arbitrary angle 30 deg on bottom port
  const rad = (30 * Math.PI) / 180;
  const pt30 = computeLiveNodePort(
    box,
    'bottom',
    { translateX: -12, translateY: 18, rotateDeg: 30, scaleX: 1.05, scaleY: 0.95 },
    6
  );
  // x1 = 0, y1 = 100 * 0.95 + 6 = 101
  const expectedX = 500 - 12 - 101 * Math.sin(rad);
  const expectedY = 400 + 18 + 101 * Math.cos(rad);
  assert.ok(Math.abs(pt30.x - expectedX) < 1e-9);
  assert.ok(Math.abs(pt30.y - expectedY) < 1e-9);
});

test('buildElasticCordPath locks endpoints 1:1, tautens under stretch, and bows under slack or whip', () => {
  assert.equal(buildElasticCordPath, kitsBuildElasticCordPath);

  const from = { x: 200, y: 500 };
  const toRest = { x: 500, y: 500 }; // rest dist = 300
  const toStretched = { x: 650, y: 500 }; // dist = 450 (+50% stretch)
  const toSlack = { x: 380, y: 500 }; // dist = 180 (-40% slack)

  const restCord = buildElasticCordPath(from, toRest, {
    orientation: 'horizontal',
    restLength: 300,
    baseSagPx: 32,
  });
  const tautCord = buildElasticCordPath(from, toStretched, {
    orientation: 'horizontal',
    restLength: 300,
    baseSagPx: 32,
  });
  const slackCord = buildElasticCordPath(from, toSlack, {
    orientation: 'horizontal',
    restLength: 300,
    baseSagPx: 32,
  });
  const whipCord = buildElasticCordPath(from, toRest, {
    orientation: 'horizontal',
    restLength: 300,
    baseSagPx: 32,
    whipOffset: 20,
  });

  // Exact 1:1 endpoint lock
  assert.deepEqual(restCord.p0, from);
  assert.deepEqual(restCord.p3, toRest);
  assert.deepEqual(restCord.pointAt(0), from);
  assert.deepEqual(restCord.pointAt(1), toRest);
  assert.deepEqual(tautCord.p0, from);
  assert.deepEqual(tautCord.p3, toStretched);

  const restMidSag = restCord.pointAt(0.5).y - 500;
  const tautMidSag = tautCord.pointAt(0.5).y - 500;
  const slackMidSag = slackCord.pointAt(0.5).y - 500;
  const whipMidSag = whipCord.pointAt(0.5).y - 500;

  assert.ok(
    tautMidSag > 0 && tautMidSag < restMidSag,
    `Expected taut cord sag (${tautMidSag.toFixed(2)}) < rest sag (${restMidSag.toFixed(2)})`
  );
  assert.ok(
    slackMidSag > restMidSag,
    `Expected slack cord sag (${slackMidSag.toFixed(2)}) > rest sag (${restMidSag.toFixed(2)})`
  );
  assert.ok(
    Math.abs(whipMidSag - (restMidSag + 15)) < 1e-6,
    `Expected whipOffset=20 to deflect midpoint by +15px, got ${(whipMidSag - restMidSag).toFixed(3)}`
  );

  // Vertical orientation smoke test
  const vertCord = buildElasticCordPath(
    { x: 400, y: 200 },
    { x: 400, y: 520 },
    { orientation: 'vertical', restLength: 320, baseSagPx: 28, whipOffset: -12 }
  );
  assert.deepEqual(vertCord.p0, { x: 400, y: 200 });
  assert.deepEqual(vertCord.p3, { x: 400, y: 520 });
  assert.ok(vertCord.d.startsWith('M 400.00 200.00 C '));
});

test('DirectorCamera2D, SystemNode, DataFlowEdge, CodePayloadToast, and RetroPcWindowStage2D avoid persistent translate3d/willChange on settled transforms', () => {
  const checkedFiles = [
    'packages/remotion/src/camera/DirectorCamera2D.tsx',
    'packages/remotion/src/kits/motion-diagrams-2d/SystemNode.tsx',
    'packages/remotion/src/kits/motion-diagrams-2d/DataFlowEdge.tsx',
    'packages/remotion/src/kits/motion-diagrams-2d/CodePayloadToast.tsx',
    'packages/remotion/src/kits/motion-diagrams-2d/RetroPcWindowStage2D.tsx',
  ];

  for (const rel of checkedFiles) {
    const src = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
    assert.ok(
      !/translate3d\(/.test(src),
      `${rel} must not emit persistent translate3d(...) — use clean 2D transforms snapped to 'none' when settled`
    );
  }

  const camSrc = fs.readFileSync(
    path.join(repoRoot, 'packages/remotion/src/camera/DirectorCamera2D.tsx'),
    'utf8'
  );
  assert.match(camSrc, /isUnitZoomCamera && isCameraSettled/);
  assert.match(camSrc, /isIdentityCamera \|\| isCameraSettled/);

  const sysNodeSrc = fs.readFileSync(
    path.join(repoRoot, 'packages/remotion/src/kits/motion-diagrams-2d/SystemNode.tsx'),
    'utf8'
  );
  assert.match(sysNodeSrc, /isTransformSettled\s*\?\s*'none'/);
  assert.match(sysNodeSrc, /extrapolateRight:\s*'clamp'/);
  assert.match(sysNodeSrc, />=\s*0\.998\s*\?\s*1/);
  assert.ok(
    !/interpolate\(activeStrength,\s*\[0,\s*1\],\s*\[0,\s*0\.018\]\)/.test(sysNodeSrc),
    'SystemNode must not micro-scale settled sharp nodes during activeRanges'
  );

  const toastSrc = fs.readFileSync(
    path.join(repoRoot, 'packages/remotion/src/kits/motion-diagrams-2d/CodePayloadToast.tsx'),
    'utf8'
  );
  assert.match(toastSrc, />=\s*0\.998\s*\?\s*1/);

  const edgeSrc = fs.readFileSync(
    path.join(repoRoot, 'packages/remotion/src/kits/motion-diagrams-2d/DataFlowEdge.tsx'),
    'utf8'
  );
  assert.match(edgeSrc, /left:\s*Math\.round\(labelAnchor\.x \+ resolvedLabelOffsetX\)/);
  assert.match(edgeSrc, /top:\s*Math\.round\(labelAnchor\.y \+ resolvedLabelOffsetY\)/);
  assert.match(edgeSrc, /drawProgress\s*>=\s*0\.995/);
});
