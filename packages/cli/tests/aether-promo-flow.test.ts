import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AudioManifestFile } from '@make-pictures/remotion';
import {
  buildCubicBezierPath,
  evaluateCubicBezier,
} from '@make-pictures/remotion/kits/motion-diagrams-2d';
import { lintManifestVoiceovers } from '../src/audio/phonetics-lint';
import {
  DEFAULT_PRODUCT_PROMO_TIMING,
  DISPATCH_MAP_ASPECT,
  DISPATCH_ROUTE_POINTS,
  DISPATCH_ROUTE_WAYPOINTS,
  DOORSTEP_HIGHLIGHTS,
  DOORSTEP_HIGHLIGHT_CARDS,
  FLOW_EDGES,
  FLOW_NODE_COPY,
  FLOW_WORLD_NODES,
  PRODUCT_PROMO_DURATION_FRAMES,
  PROMO_CROSS_DISSOLVE_FRAMES,
  PROMO_FPS,
  buildDispatchRouteSvgPath,
  evaluateDispatchRouteAtProgress,
  evaluateDispatchRouteHeadingDeg,
  resolveDispatchEtaStatus,
} from '../../../examples/aether-promo/productPromoTiming';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from '../../../examples/aether-promo/generated/audio-manifest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO_JSON_PATH = path.resolve(
  __dirname,
  '../../../examples/aether-promo/audio.json'
);

const FORBIDDEN_JARGON =
  /60\s*fps|-14\s*lufs|0\s*collisions|webgl|pbr|gpu|shader|bezier|remotion|three\.?js|zod|react|api|webhook|json|postgres/i;

interface Box2D {
  name: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function assertMinClearance(a: Box2D, b: Box2D, minGapPx: number): void {
  const gapX = Math.max(0, a.left - b.right, b.left - a.right);
  const gapY = Math.max(0, a.top - b.bottom, b.top - a.bottom);
  const clearance = Math.hypot(gapX, gapY);
  assert.ok(
    clearance >= minGapPx,
    `Tight crowding/collision between "${a.name}" [${Math.round(a.left)},${Math.round(a.top)}..${Math.round(a.right)},${Math.round(a.bottom)}] and "${b.name}" [${Math.round(b.left)},${Math.round(b.top)}..${Math.round(b.right)},${Math.round(b.bottom)}]: clearance=${clearance.toFixed(1)}px < ${minGapPx}px`
  );
}

test('ProductPromo audio.json uses eleven_v4 EN Liam manifest (4 acts), 3-section score (name key), 4 SFX, 0 linter warnings, and zero tech jargon', () => {
  const manifest = JSON.parse(
    fs.readFileSync(AUDIO_JSON_PATH, 'utf8')
  ) as AudioManifestFile;

  assert.equal(manifest.fps, PROMO_FPS);
  assert.equal(manifest.modelId, 'eleven_v4');
  assert.equal(manifest.scenes.length, 4, 'Expected 4 product promo acts');

  for (const scene of manifest.scenes) {
    assert.equal(scene.modelId, 'eleven_v4');
    assert.equal(scene.languageCode, 'en');
    assert.equal(scene.voiceId, 'TX3LPaxmHKxFdv7VOQHJ');
    assert.ok(
      !FORBIDDEN_JARGON.test(scene.text),
      `Forbidden jargon in ${scene.id}: ${scene.text}`
    );
    assert.ok(
      VOICEOVER_MANIFEST[scene.id],
      `Missing VOICEOVER_MANIFEST entry for ${scene.id}`
    );
  }

  assert.equal(manifest.score?.mode, 'composition-plan');
  assert.equal(manifest.score?.forceInstrumental, true);
  assert.equal(manifest.score?.durationSeconds, 36);
  assert.equal(manifest.score?.sections?.length, 3);
  for (const sec of manifest.score?.sections ?? []) {
    assert.ok(
      typeof sec.name === 'string' && sec.name.length > 0,
      'Score sections must use "name" (not "sectionName")'
    );
  }
  assert.equal(manifest.sfx?.length, 4);
  assert.ok(MUSIC_MANIFEST, 'Expected generated MUSIC_MANIFEST');
  for (const cue of manifest.sfx ?? []) {
    assert.ok(SFX_MANIFEST[cue.id], `Missing SFX_MANIFEST entry for ${cue.id}`);
  }

  const warnings = lintManifestVoiceovers(manifest, {
    defaultVoiceId: 'TX3LPaxmHKxFdv7VOQHJ',
    defaultModelId: 'eleven_v4',
  });
  assert.deepEqual(
    warnings,
    [],
    `Expected 0 phonetics/eleven_v4 lint warnings, got: ${JSON.stringify(warnings)}`
  );
});

test('ProductPromo timing meets all breathing-room invariants (>=270f, pre>=42f, post>=90f, outro>=138f) and exact ContinuousSceneFlow sum minus 3*48', () => {
  const plan = DEFAULT_PRODUCT_PROMO_TIMING;
  assert.equal(plan.crossDissolveFrames, 48);
  assert.equal(PROMO_CROSS_DISSOLVE_FRAMES, 48);
  assert.equal(plan.scenes.length, 4);

  let sumDurations = 0;
  for (let i = 0; i < plan.scenes.length; i++) {
    const scene = plan.scenes[i]!;
    const isFinal = i === plan.scenes.length - 1;
    sumDurations += scene.durationInFrames;

    assert.ok(
      scene.durationInFrames >= 270,
      `Act ${scene.id} duration ${scene.durationInFrames} < 270f`
    );
    assert.ok(
      scene.preSpeechFrames >= 42,
      `Act ${scene.id} preSpeechFrames ${scene.preSpeechFrames} < 42f`
    );
    assert.ok(
      scene.postSpeechFrames >= 90,
      `Act ${scene.id} postSpeechFrames ${scene.postSpeechFrames} < 90f`
    );
    assert.ok(
      scene.effectivePostHoldFrames >= (isFinal ? 138 : 90),
      `Act ${scene.id} effectivePostHoldFrames ${scene.effectivePostHoldFrames} below threshold`
    );
  }

  const expectedTotal = sumDurations - 3 * PROMO_CROSS_DISSOLVE_FRAMES;
  assert.equal(plan.totalDurationInFrames, expectedTotal);
  assert.equal(PRODUCT_PROMO_DURATION_FRAMES, expectedTotal);

  for (const cue of plan.sfxTimeline) {
    assert.ok(
      cue.fromFrame + cue.durationInFrames <= plan.totalDurationInFrames,
      `SFX ${cue.sfxId} exceeds totalDurationInFrames`
    );
  }
});

test('ProductPromo Act 2 flow nodes & edge pills maintain >= 28px pairwise AABB clearance from each other, header, and bottom ribbon', () => {
  const headerBox: Box2D = {
    name: 'Top Editorial Header',
    left: 72,
    top: 48,
    right: 1848,
    bottom: 215,
  };
  const ribbonBox: Box2D = {
    name: 'Bottom PaperRibbonTimeline',
    left: 160,
    top: 960,
    right: 1760,
    bottom: 1040,
  };

  const nodeBoxes: Box2D[] = Object.entries(FLOW_WORLD_NODES).map(([id, n]) => ({
    name: `Node:${id}`,
    left: n.cx - n.w / 2,
    right: n.cx + n.w / 2,
    top: n.cy - n.h / 2,
    bottom: n.cy + n.h / 2,
  }));

  assert.equal(nodeBoxes.length, 4);
  assert.equal(FLOW_EDGES.length, 3);

  const edgePillBoxes: Box2D[] = FLOW_EDGES.map((edge) => {
    const curve = buildCubicBezierPath(edge.from, edge.to, {
      orientation: 'horizontal',
      curveY: edge.curveOffsetY,
    });
    const anchor = evaluateCubicBezier(
      curve.p0,
      curve.p1,
      curve.p2,
      curve.p3,
      edge.labelT
    );
    const cx = anchor.x + edge.labelOffsetX;
    const cy = anchor.y + edge.labelOffsetY;
    const halfW = (edge.label.length * 9.5 + 36) / 2;
    const halfH = 18;
    return {
      name: `EdgePill:${edge.label}`,
      left: cx - halfW,
      right: cx + halfW,
      top: cy - halfH,
      bottom: cy + halfH,
    };
  });

  const allBoxes = [...nodeBoxes, ...edgePillBoxes];
  for (let i = 0; i < allBoxes.length; i++) {
    for (let j = i + 1; j < allBoxes.length; j++) {
      assertMinClearance(allBoxes[i]!, allBoxes[j]!, 28);
    }
    assertMinClearance(allBoxes[i]!, headerBox, 28);
    assertMinClearance(allBoxes[i]!, ribbonBox, 28);
  }
});

test('ProductPromo Act 3 27-point road + park trail centerline maintains uniform arc-length speed, exact SVG sync, and all Act 4 card art exists', () => {
  assert.equal(DISPATCH_ROUTE_WAYPOINTS.length, 27);
  assert.deepEqual(DISPATCH_ROUTE_POINTS.p0, { x: 0.2028, y: 0.8021 });
  assert.deepEqual(DISPATCH_ROUTE_POINTS.p3, { x: 0.7929, y: 0.1849 });

  let prevPt = evaluateDispatchRouteAtProgress(0);
  const stepLengths: number[] = [];
  for (let i = 1; i <= 100; i++) {
    const t = i / 100;
    const pt = evaluateDispatchRouteAtProgress(t);
    assert.ok(
      pt.x >= 0.08 && pt.x <= 0.92 && pt.y >= 0.12 && pt.y <= 0.88,
      `Dispatch route out of safe map bounds at t=${t.toFixed(2)}: (${pt.x.toFixed(3)}, ${pt.y.toFixed(3)})`
    );
    const stepPx = Math.hypot(
      (pt.x - prevPt.x) * DISPATCH_MAP_ASPECT.width,
      (pt.y - prevPt.y) * DISPATCH_MAP_ASPECT.height
    );
    stepLengths.push(stepPx);
    prevPt = pt;
  }

  // Verify uniform arc-length bicycle speed (chord ratio across a 90° street turn is sqrt(2) ≈ 1.414)
  const minStep = Math.min(...stepLengths);
  const maxStep = Math.max(...stepLengths);
  assert.ok(
    minStep > 0 && maxStep / minStep <= 1.45,
    `Expected smooth arc-length speed along road/park trail, got min=${minStep.toFixed(2)}px max=${maxStep.toFixed(2)}px`
  );

  // Verify buildDispatchRouteSvgPath ends dead-on evaluateDispatchRouteAtProgress(t)
  for (const t of [0.25, 0.5, 0.78, 1.0]) {
    const d = buildDispatchRouteSvgPath(DISPATCH_MAP_ASPECT.width, DISPATCH_MAP_ASPECT.height, t);
    const match = d.match(/([0-9.]+)\s+([0-9.]+)$/);
    assert.ok(match, `Invalid SVG path at t=${t}: ${d}`);
    const svgEndX = Number(match![1]);
    const svgEndY = Number(match![2]);
    const pt = evaluateDispatchRouteAtProgress(t);
    assert.ok(Math.abs(svgEndX - pt.x * DISPATCH_MAP_ASPECT.width) <= 0.05);
    assert.ok(Math.abs(svgEndY - pt.y * DISPATCH_MAP_ASPECT.height) <= 0.05);
    assert.ok(Number.isFinite(evaluateDispatchRouteHeadingDeg(t)));
  }

  assert.equal(resolveDispatchEtaStatus(0.1).etaLabel, '12 min');
  assert.equal(resolveDispatchEtaStatus(0.7).etaLabel, '4 min');
  assert.equal(resolveDispatchEtaStatus(0.98).etaLabel, 'At your door!');

  for (const node of FLOW_NODE_COPY) {
    assert.ok(!FORBIDDEN_JARGON.test(node.title));
    assert.ok(!FORBIDDEN_JARGON.test(node.sentence));
  }
  for (const edge of FLOW_EDGES) {
    assert.ok(!FORBIDDEN_JARGON.test(edge.label));
  }
  assert.equal(DOORSTEP_HIGHLIGHTS.length, 4);
  assert.equal(DOORSTEP_HIGHLIGHT_CARDS.length, 4);
  const publicDir = path.resolve(__dirname, '../../../public');
  for (const card of DOORSTEP_HIGHLIGHT_CARDS) {
    assert.ok(!FORBIDDEN_JARGON.test(card.title));
    assert.ok(!FORBIDDEN_JARGON.test(card.sentence));
    assert.ok(
      fs.existsSync(path.join(publicDir, card.imageSrc)),
      `Missing Act 4 card illustration on disk: ${card.imageSrc}`
    );
  }
});
