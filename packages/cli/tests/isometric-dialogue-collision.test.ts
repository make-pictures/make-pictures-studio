import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditSceneCollisions3D, type ProductionManifest } from '@make-pictures/core';
import { lintManifestVoiceovers } from '../src/audio/phonetics-lint';
import {
  DEFAULT_ISOMETRIC_DIALOGUE_TIMELINE,
  ISOMETRIC_DIALOGUE_DURATION_FRAMES,
  ISOMETRIC_DIALOGUE_FPS,
  ISOMETRIC_DIALOGUE_SCENE_ID,
  evaluateIsometricDialogueFrame,
  type IsometricCountdownLabel,
} from '../../../examples/isometric-dialogue/isometricDialogueKinematics';
import {
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from '../../../examples/isometric-dialogue/generated/audio-manifest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRODUCTION_JSON_PATH = path.resolve(
  __dirname,
  '../../../examples/isometric-dialogue/production.json'
);

test('IsometricDialogueDemo production.json uses eleven_v4 Text-to-Dialogue (6 turns), 3-section score, 5 SFX, 0 jargon & 0 linter warnings', () => {
  const manifest = JSON.parse(
    fs.readFileSync(PRODUCTION_JSON_PATH, 'utf8')
  ) as ProductionManifest;

  assert.equal(manifest.fps, ISOMETRIC_DIALOGUE_FPS);
  assert.equal(manifest.modelId, 'eleven_v4');
  assert.equal(manifest.scenes.length, 1);

  const scene = manifest.scenes[0]!;
  assert.equal(scene.id, ISOMETRIC_DIALOGUE_SCENE_ID);
  assert.equal(scene.modelId, 'eleven_v4');
  assert.equal(scene.languageCode, 'en');
  assert.equal(scene.dialogueInputs?.length, 6, 'Expected 6 comedic dialogue turns');

  const bannedJargon = /60\s*fps|-14\s*lufs|0\s*collisions|webgl|pbr|gpu|shader|bezier|remotion|three\.?js/i;
  assert.ok(!bannedJargon.test(scene.text), `Banned tech jargon in dialogue text: ${scene.text}`);
  for (const turn of scene.dialogueInputs ?? []) {
    assert.ok(!bannedJargon.test(turn.text), `Banned tech jargon in turn: ${turn.text}`);
  }

  assert.equal(manifest.score?.mode, 'composition-plan');
  assert.equal(manifest.score?.sections?.length, 3);
  assert.equal(manifest.score?.durationSeconds, 22);
  assert.equal(manifest.score?.forceInstrumental, true);
  assert.equal(manifest.sfx?.length, 5);

  const warnings = lintManifestVoiceovers(manifest);
  assert.deepEqual(
    warnings,
    [],
    `Expected 0 eleven_v4/Text-to-Dialogue linter warnings, got: ${JSON.stringify(warnings)}`
  );

  // Verify real .mp3 VO & SFX durations are unclipped inside composition bounds
  const timeline = DEFAULT_ISOMETRIC_DIALOGUE_TIMELINE;
  const voEntry = VOICEOVER_MANIFEST[ISOMETRIC_DIALOGUE_SCENE_ID];
  assert.ok(voEntry, 'Missing VOICEOVER_MANIFEST entry for five-seconds-to-air');
  const minVoFrames = Math.ceil(voEntry.durationInSeconds * ISOMETRIC_DIALOGUE_FPS);
  assert.ok(
    timeline.voTimeline[0]!.durationInFrames >= minVoFrames,
    `VO sequence (${timeline.voTimeline[0]!.durationInFrames}f) < real audio (${minVoFrames}f)`
  );
  assert.ok(
    timeline.voTimeline[0]!.fromFrame + timeline.voTimeline[0]!.durationInFrames <=
      ISOMETRIC_DIALOGUE_DURATION_FRAMES,
    'VO sequence exceeds composition duration'
  );

  for (const cue of timeline.sfxTimeline) {
    const sfxEntry = SFX_MANIFEST[cue.sfxId];
    if (sfxEntry) {
      const minSfxFrames = Math.ceil(sfxEntry.durationSeconds * ISOMETRIC_DIALOGUE_FPS);
      assert.ok(
        cue.durationInFrames >= minSfxFrames,
        `SFX ${cue.sfxId} durationInFrames (${cue.durationInFrames}) < real audio (${minSfxFrames}f)`
      );
    }
    assert.ok(
      cue.fromFrame + cue.durationInFrames <= ISOMETRIC_DIALOGUE_DURATION_FRAMES,
      `SFX ${cue.sfxId} exceeds composition duration`
    );
  }
});

test('IsometricDialogueDemo maintains 0 OBB SAT collisions across EVERY frame, jitter-free speech (<=0.04/f), mug bounce, mic wobble, countdown 00:05->LIVE, and golden-hour ON AIR snap', () => {
  const timeline = DEFAULT_ISOMETRIC_DIALOGUE_TIMELINE;
  assert.ok(
    ISOMETRIC_DIALOGUE_DURATION_FRAMES >= 1200 &&
      ISOMETRIC_DIALOGUE_DURATION_FRAMES <= 1800,
    `Expected 20-30 s duration (1200..1800f), got ${ISOMETRIC_DIALOGUE_DURATION_FRAMES}`
  );
  assert.equal(timeline.turns.length, 6);
  assert.equal(timeline.milestones.length, 5);
  assert.equal(timeline.sfxTimeline.length, 5);

  let minClearance = Infinity;
  let maxMayaSpeechDelta = 0;
  let maxLeoSpeechDelta = 0;
  let prevMayaEnergy = 0;
  let prevLeoEnergy = 0;

  let maxMugLift = 0;
  let maxLeoJumpY = 0;
  let maxMicWobbleAbs = 0;
  const seenLabels: IsometricCountdownLabel[] = [];

  const restMugY = evaluateIsometricDialogueFrame(1).mug.position[1];

  for (let f = 1; f < ISOMETRIC_DIALOGUE_DURATION_FRAMES; f++) {
    const state = evaluateIsometricDialogueFrame(f);
    const report = auditSceneCollisions3D(state.collisionBodies, {
      minClearance: 0.008,
    });
    assert.equal(
      report.violations.length,
      0,
      `IsometricDialogue SAT collision at f=${f}: ${JSON.stringify(report.violations)}`
    );
    minClearance = Math.min(minClearance, report.minClearance);

    // Verify silky jitter-free speech energy (max delta <= 0.04/frame)
    if (f > 1) {
      const dMaya = Math.abs(state.maya.speechEnergy - prevMayaEnergy);
      const dLeo = Math.abs(state.leo.speechEnergy - prevLeoEnergy);
      maxMayaSpeechDelta = Math.max(maxMayaSpeechDelta, dMaya);
      maxLeoSpeechDelta = Math.max(maxLeoSpeechDelta, dLeo);
      assert.ok(
        dMaya <= 0.04,
        `Maya speechEnergy jitter delta ${dMaya.toFixed(4)} > 0.04 at f=${f}`
      );
      assert.ok(
        dLeo <= 0.04,
        `Leo speechEnergy jitter delta ${dLeo.toFixed(4)} > 0.04 at f=${f}`
      );
    }
    prevMayaEnergy = state.maya.speechEnergy;
    prevLeoEnergy = state.leo.speechEnergy;

    // Grounded hosts — zero stool/floor clipping
    assert.ok(state.maya.jumpOffsetY >= 0, `Maya dipped below floor at f=${f}`);
    assert.ok(state.leo.jumpOffsetY >= 0, `Leo dipped below floor at f=${f}`);

    maxMugLift = Math.max(maxMugLift, state.mug.position[1] - restMugY);
    maxLeoJumpY = Math.max(maxLeoJumpY, state.leo.jumpOffsetY);
    maxMicWobbleAbs = Math.max(maxMicWobbleAbs, Math.abs(state.leoMicWobbleZ));

    if (
      seenLabels.length === 0 ||
      seenLabels[seenLabels.length - 1] !== state.countdownLabel
    ) {
      seenLabels.push(state.countdownLabel);
    }

    // Verify exact ON AIR flip boundary
    assert.equal(state.isOnAir, f >= timeline.onAirFrame);
  }

  assert.deepEqual(
    seenLabels,
    ['00:05', '00:04', '00:03', '00:02', '00:01', 'LIVE'],
    `Expected exact countdown sequence 00:05 -> ... -> LIVE, got ${JSON.stringify(seenLabels)}`
  );

  assert.ok(
    maxMugLift >= 0.3,
    `Expected Leo's mug to bounce >= 0.30 units off its coaster during Turn 2, got ${maxMugLift.toFixed(3)}`
  );
  assert.ok(
    maxLeoJumpY >= 0.12,
    `Expected Leo panic jump >= 0.12 units, got ${maxLeoJumpY.toFixed(3)}`
  );
  assert.ok(
    maxMicWobbleAbs >= 0.15,
    `Expected Leo boom mic wobble >= 0.15 rad during scramble, got ${maxMicWobbleAbs.toFixed(3)}`
  );

  // Verify morning -> golden-hour bloom & settled post-ON-AIR props
  const morningState = evaluateIsometricDialogueFrame(30);
  const onAirSettledState = evaluateIsometricDialogueFrame(timeline.onAirFrame + 24);
  const endState = evaluateIsometricDialogueFrame(
    ISOMETRIC_DIALOGUE_DURATION_FRAMES - 1
  );

  assert.ok(
    morningState.timeOfDay <= 0.2,
    `Expected crisp morning daylight <= 0.20, got ${morningState.timeOfDay}`
  );
  assert.ok(
    onAirSettledState.timeOfDay >= 0.72,
    `Expected luminous golden-hour ON AIR daylight >= 0.72, got ${onAirSettledState.timeOfDay}`
  );
  assert.equal(onAirSettledState.isOnAir, true);
  assert.equal(onAirSettledState.maya.poisedSmileSnap, 1);
  assert.equal(onAirSettledState.leo.poisedSmileSnap, 1);
  assert.equal(onAirSettledState.leoMicWobbleZ, 0);
  assert.ok(
    Math.abs(endState.mug.position[1] - restMugY) <= 0.001,
    `Expected mug to land squarely back on coaster, got delta ${Math.abs(endState.mug.position[1] - restMugY)}`
  );
  assert.ok(minClearance >= 0.008, `Min SAT clearance ${minClearance} < 0.008`);
  assert.ok(maxMayaSpeechDelta <= 0.04);
  assert.ok(maxLeoSpeechDelta <= 0.04);
});
