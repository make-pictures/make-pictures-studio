import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProductionManifest } from '@make-pictures/core';
import { lintManifestVoiceovers } from '../src/audio/phonetics-lint';
import {
  ANATOMY_IMAGE_META,
  ANATOMY_PINS,
  DEFAULT_STARTER_STORY_TIMING,
  PANORAMA_PLATES,
  QUIET_SECRETS_ITEMS,
  RAIL_SPEED_ITEMS,
  RAIL_SPEED_KEYFRAMES,
  STARTER_CROSS_DISSOLVE_FRAMES,
  STARTER_STORY_DURATION_FRAMES,
  STARTER_STORY_FPS,
  buildRailSpeedBarRaceItems,
  resolveRailSpeedEraAtLocalFrame,
} from '../../../examples/starter-story/starterStoryTiming';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from '../../../examples/starter-story/generated/audio-manifest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRODUCTION_JSON_PATH = path.resolve(
  __dirname,
  '../../../examples/starter-story/production.json'
);

const FORBIDDEN_JARGON =
  /60\s*fps|-14\s*lufs|0\s*collisions|webgl|pbr|gpu|shader|bezier|remotion|three\.?js|zod|react/i;

test('StarterStory production.json uses eleven_v4 EN manifest with 5 scenes, 3-section score (name key), 4 SFX, 0 linter warnings, and zero tech jargon', () => {
  const manifest = JSON.parse(
    fs.readFileSync(PRODUCTION_JSON_PATH, 'utf8')
  ) as ProductionManifest;

  assert.equal(manifest.fps, STARTER_STORY_FPS);
  assert.equal(manifest.modelId, 'eleven_v4');
  assert.equal(manifest.scenes.length, 5, 'Expected 5 editorial bullet-train acts');

  for (const scene of manifest.scenes) {
    assert.equal(scene.modelId, 'eleven_v4');
    assert.equal(scene.languageCode, 'en');
    assert.equal(scene.voiceId, 'EXAVITQu4vr4xnSDxMaL');
    assert.ok(
      !FORBIDDEN_JARGON.test(scene.text),
      `Forbidden jargon in narration ${scene.id}: ${scene.text}`
    );
    assert.ok(
      VOICEOVER_MANIFEST[scene.id],
      `Missing VOICEOVER_MANIFEST entry for ${scene.id}`
    );
  }

  assert.equal(manifest.score?.mode, 'composition-plan');
  assert.equal(manifest.score?.forceInstrumental, true);
  assert.equal(manifest.score?.durationSeconds, 34);
  assert.equal(manifest.score?.sections?.length, 3);
  for (const section of manifest.score?.sections ?? []) {
    assert.ok(
      typeof section.name === 'string' && section.name.length > 0,
      'Score sections must use "name" (not "sectionName")'
    );
  }
  assert.equal(manifest.sfx?.length, 4);
  assert.ok(MUSIC_MANIFEST, 'Expected generated MUSIC_MANIFEST');
  for (const cue of manifest.sfx ?? []) {
    assert.ok(SFX_MANIFEST[cue.id], `Missing SFX_MANIFEST entry for ${cue.id}`);
  }

  const warnings = lintManifestVoiceovers(manifest, {
    defaultVoiceId: 'EXAVITQu4vr4xnSDxMaL',
    defaultModelId: 'eleven_v4',
  });
  assert.deepEqual(
    warnings,
    [],
    `Expected 0 phonetics/eleven_v4 lint warnings, got: ${JSON.stringify(warnings)}`
  );
});

test('StarterStory timing meets all breathing-room invariants (>=270f, pre>=42f, post>=90f, outro>=132f) and exact ContinuousSceneFlow sum minus 4*48', () => {
  const plan = DEFAULT_STARTER_STORY_TIMING;
  assert.equal(plan.crossDissolveFrames, 48);
  assert.equal(STARTER_CROSS_DISSOLVE_FRAMES, 48);
  assert.equal(plan.scenes.length, 5);

  let sumDurations = 0;
  for (let i = 0; i < plan.scenes.length; i++) {
    const scene = plan.scenes[i]!;
    const isFinal = i === plan.scenes.length - 1;
    sumDurations += scene.durationInFrames;

    assert.ok(
      scene.durationInFrames >= 270,
      `Scene ${scene.id} duration ${scene.durationInFrames} < 270f`
    );
    assert.ok(
      scene.preSpeechFrames >= 42,
      `Scene ${scene.id} preSpeechFrames ${scene.preSpeechFrames} < 42f`
    );
    assert.ok(
      scene.postSpeechFrames >= 90,
      `Scene ${scene.id} postSpeechFrames ${scene.postSpeechFrames} < 90f`
    );
    assert.ok(
      scene.effectivePostHoldFrames >= (isFinal ? 132 : 90),
      `Scene ${scene.id} effectivePostHoldFrames ${scene.effectivePostHoldFrames} below threshold`
    );
  }

  const expectedTotal = sumDurations - 4 * STARTER_CROSS_DISSOLVE_FRAMES;
  assert.equal(plan.totalDurationInFrames, expectedTotal);
  assert.equal(STARTER_STORY_DURATION_FRAMES, expectedTotal);

  for (const cue of plan.sfxTimeline) {
    assert.ok(
      cue.fromFrame + cue.durationInFrames <= plan.totalDurationInFrames,
      `SFX cue ${cue.sfxId} exceeds totalDurationInFrames`
    );
  }
});

test('StarterStory editorial plates, anatomy pins, factual rail speed race, and quiet secrets are clean and in bounds', () => {
  // 1. Panorama plates (4 items, zero jargon)
  assert.equal(PANORAMA_PLATES.length, 4);
  for (const plate of PANORAMA_PLATES) {
    assert.ok(plate.src?.startsWith('examples/starter-story/images/'));
    assert.ok(!FORBIDDEN_JARGON.test(plate.title));
    assert.ok(!FORBIDDEN_JARGON.test(plate.sentence ?? ''));
  }

  // 2. Anatomy pins strictly within [0, sourceWidth] x [0, sourceHeight], and `nose` placed 'bottom' to avoid 9:16 overlap with `cabin`
  assert.equal(ANATOMY_PINS.length, 3);
  const nosePin = ANATOMY_PINS.find((p) => p.id === 'nose');
  const cabinPin = ANATOMY_PINS.find((p) => p.id === 'cabin');
  assert.equal(cabinPin?.placement, 'top');
  assert.equal(nosePin?.placement, 'bottom');
  for (const pin of ANATOMY_PINS) {
    assert.ok(
      pin.cx >= 0 && pin.cx <= ANATOMY_IMAGE_META.sourceWidth,
      `Pin ${pin.id} cx=${pin.cx} out of [0, ${ANATOMY_IMAGE_META.sourceWidth}]`
    );
    assert.ok(
      pin.cy >= 0 && pin.cy <= ANATOMY_IMAGE_META.sourceHeight,
      `Pin ${pin.id} cy=${pin.cy} out of [0, ${ANATOMY_IMAGE_META.sourceHeight}]`
    );
    assert.ok(!FORBIDDEN_JARGON.test(pin.label));
  }

  // 3. Factual rail speed race keyframes (`1964` Shinkansen 210 -> `Today` Fuxing 350 > Shinkansen 320 > Frecciarossa 300 > Steam 160)
  assert.equal(RAIL_SPEED_KEYFRAMES.length, 3);
  assert.equal(RAIL_SPEED_ITEMS.length, 4);
  for (const snap of RAIL_SPEED_KEYFRAMES) {
    for (const [id, speed] of Object.entries(snap.values)) {
      assert.ok(speed > 0, `Speed for ${id} in ${snap.eraLabel} must be > 0`);
    }
  }
  const snap1964 = RAIL_SPEED_KEYFRAMES[0]!;
  const snapToday = RAIL_SPEED_KEYFRAMES[2]!;
  assert.equal(snap1964.eraLabel, '1964');
  assert.equal(snap1964.values.shinkansen, 210);
  assert.ok(
    snap1964.values.shinkansen > snap1964.values.steam &&
      snap1964.values.shinkansen > snap1964.values.frecciarossa &&
      snap1964.values.shinkansen > snap1964.values.fuxing,
    '1964 leader must be Shinkansen at 210 km/h'
  );
  assert.equal(snapToday.eraLabel, 'Today');
  assert.equal(snapToday.values.fuxing, 350);
  assert.equal(snapToday.values.shinkansen, 320);
  assert.equal(snapToday.values.frecciarossa, 300);
  assert.equal(snapToday.values.steam, 160);
  assert.ok(
    snapToday.values.fuxing > snapToday.values.shinkansen &&
      snapToday.values.shinkansen > snapToday.values.frecciarossa &&
      snapToday.values.frecciarossa > snapToday.values.steam
  );

  // Verify frame-keyed BarRaceItem[] spans strictly increasing positive frames and finishes >= 200f before scene end
  const speedSceneDur = DEFAULT_STARTER_STORY_TIMING.sceneById['speed-en'].durationInFrames;
  const raceItems = buildRailSpeedBarRaceItems(speedSceneDur);
  assert.equal(raceItems.length, 4);
  for (const item of raceItems) {
    assert.equal(item.keyframes?.length, 3);
    assert.ok(item.keyframes![0]!.frame < item.keyframes![1]!.frame);
    assert.ok(item.keyframes![1]!.frame < item.keyframes![2]!.frame);
    assert.ok(
      item.keyframes![2]!.frame <= speedSceneDur - 200,
      `Expected bar race to finish >= 200f before scene end for proud #1 hold`
    );
    assert.ok(!FORBIDDEN_JARGON.test(item.label));
  }

  // Verify ERA badge flips to 'Today' ONLY after Fuxing Express overtakes Shinkansen E5 into #1
  const fuxing = raceItems.find((i) => i.id === 'fuxing')!;
  const shinkansen = raceItems.find((i) => i.id === 'shinkansen')!;
  const evalCubicInOut = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const evalAt = (item: typeof fuxing, f: number) => {
    const kfs = item.keyframes!;
    if (f <= kfs[0]!.frame) return kfs[0]!.value;
    if (f >= kfs[2]!.frame) return kfs[2]!.value;
    const seg = f <= kfs[1]!.frame ? [kfs[0]!, kfs[1]!] : [kfs[1]!, kfs[2]!];
    const u = (f - seg[0]!.frame) / Math.max(1, seg[1]!.frame - seg[0]!.frame);
    return seg[0]!.value + (seg[1]!.value - seg[0]!.value) * evalCubicInOut(u);
  };
  let firstTodayFrame = -1;
  for (let f = 0; f < speedSceneDur; f++) {
    if (resolveRailSpeedEraAtLocalFrame(f, speedSceneDur) === 'Today') {
      firstTodayFrame = f;
      break;
    }
  }
  assert.ok(firstTodayFrame > 0, 'Expected ERA badge to reach Today');
  assert.ok(
    evalAt(fuxing, firstTodayFrame) > evalAt(shinkansen, firstTodayFrame),
    `ERA flipped to Today at f=${firstTodayFrame} before Fuxing (${evalAt(fuxing, firstTodayFrame).toFixed(1)}) overtook Shinkansen (${evalAt(shinkansen, firstTodayFrame).toFixed(1)})`
  );

  // 4. Four Quiet Secrets (HorizontalFeatureGrid2x2)
  assert.equal(QUIET_SECRETS_ITEMS.length, 4);
  for (const card of QUIET_SECRETS_ITEMS) {
    assert.ok(!FORBIDDEN_JARGON.test(card.title));
    assert.ok(!FORBIDDEN_JARGON.test(card.sentence));
  }
});
