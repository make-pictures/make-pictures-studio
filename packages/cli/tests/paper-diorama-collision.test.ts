import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditSceneCollisions3D, type AudioManifestFile } from '@make-pictures/remotion';
import { lintManifestVoiceovers } from '../src/audio/phonetics-lint';
import {
  PAPER_DIORAMA_DURATION_FRAMES,
  PAPER_DIORAMA_FPS,
  PAPER_DIORAMA_MAX_ALTITUDE_Y,
  PAPER_DIORAMA_MILESTONES,
  PAPER_DIORAMA_SFX_TIMELINE,
  PAPER_DIORAMA_VO_TIMELINE,
  evaluatePaperDioramaFrame,
  evaluateSkyAtmosphere,
} from '../../../examples/paper-diorama/paperDioramaKinematics';
import {
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from '../../../examples/paper-diorama/generated/audio-manifest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO_JSON_PATH = path.resolve(
  __dirname,
  '../../../examples/paper-diorama/audio.json'
);

test('PaperDioramaDemo audio.json uses eleven_v4 EN manifest with 0 linter warnings and zero tech jargon', () => {
  const manifest = JSON.parse(
    fs.readFileSync(AUDIO_JSON_PATH, 'utf8')
  ) as AudioManifestFile;

  assert.equal(manifest.fps, PAPER_DIORAMA_FPS);
  assert.equal(manifest.modelId, 'eleven_v4');
  assert.equal(manifest.scenes.length, 4, 'Expected 4 evocative EN ascent narration scenes');
  assert.equal(manifest.score?.mode, 'composition-plan');
  assert.equal(manifest.score?.sections?.length, 3);
  assert.equal(manifest.score?.durationSeconds, 20);
  assert.equal(manifest.sfx?.length, 5);

  const bannedJargon = /60\s*fps|-14\s*lufs|0\s*collisions|webgl|pbr|gpu|shader|bezier/i;
  for (const scene of manifest.scenes) {
    assert.equal(scene.modelId, 'eleven_v4');
    assert.equal(scene.languageCode, 'en');
    assert.ok(!bannedJargon.test(scene.text), `Banned tech jargon in ${scene.id}: ${scene.text}`);
  }

  const warnings = lintManifestVoiceovers(manifest);
  assert.deepEqual(
    warnings,
    [],
    `Expected 0 eleven_v4/phonetics warnings, got: ${JSON.stringify(warnings)}`
  );

  // Verify zero VO overlap and unclipped real .mp3 durations across VO & SFX timelines
  let prevVoEnd = 0;
  for (const seg of PAPER_DIORAMA_VO_TIMELINE) {
    const entry = VOICEOVER_MANIFEST[seg.sceneId];
    assert.ok(entry, `Missing VOICEOVER_MANIFEST entry for ${seg.sceneId}`);
    const minFrames = Math.ceil(entry.durationInSeconds * PAPER_DIORAMA_FPS);
    assert.ok(
      seg.durationInFrames >= minFrames,
      `VO ${seg.sceneId} durationInFrames (${seg.durationInFrames}) < real audio frames (${minFrames})`
    );
    assert.ok(
      seg.fromFrame >= prevVoEnd,
      `VO ${seg.sceneId} overlaps previous VO (${seg.fromFrame} < ${prevVoEnd})`
    );
    assert.ok(
      seg.fromFrame + seg.durationInFrames <= PAPER_DIORAMA_DURATION_FRAMES,
      `VO ${seg.sceneId} exceeds composition duration (${seg.fromFrame + seg.durationInFrames} > ${PAPER_DIORAMA_DURATION_FRAMES})`
    );
    prevVoEnd = seg.fromFrame + seg.durationInFrames;
  }

  for (const cue of PAPER_DIORAMA_SFX_TIMELINE) {
    const entry = SFX_MANIFEST[cue.sfxId];
    assert.ok(entry, `Missing SFX_MANIFEST entry for ${cue.sfxId}`);
    const minFrames = Math.ceil(entry.durationSeconds * PAPER_DIORAMA_FPS);
    assert.ok(
      cue.durationInFrames >= minFrames,
      `SFX ${cue.sfxId} durationInFrames (${cue.durationInFrames}) < real audio frames (${minFrames})`
    );
    assert.ok(
      cue.fromFrame + cue.durationInFrames <= PAPER_DIORAMA_DURATION_FRAMES,
      `SFX ${cue.sfxId} exceeds composition duration`
    );
  }
});

test('evaluateSkyAtmosphere darkens monotonically from sunlit morning meadow to deep cosmos and flips overlayTone', () => {
  const morning = evaluateSkyAtmosphere(0);
  const birds = evaluateSkyAtmosphere(0.24);
  const stratosphere = evaluateSkyAtmosphere(0.48);
  const twilight = evaluateSkyAtmosphere(0.72);
  const space = evaluateSkyAtmosphere(1.0);

  assert.equal(morning.overlayTone, 'dark-on-light');
  assert.equal(birds.overlayTone, 'dark-on-light');
  assert.equal(stratosphere.overlayTone, 'light-on-dark');
  assert.equal(stratosphere.earthGlowOpacity, 0);
  assert.equal(twilight.overlayTone, 'light-on-dark');
  assert.ok(twilight.earthGlowOpacity > 0.5);
  assert.equal(space.overlayTone, 'light-on-dark');

  assert.ok(morning.skyLuminance > birds.skyLuminance);
  assert.ok(birds.skyLuminance > stratosphere.skyLuminance);
  assert.ok(stratosphere.skyLuminance > twilight.skyLuminance);
  assert.ok(twilight.skyLuminance > space.skyLuminance);
  assert.ok(morning.skyLuminance >= 0.75);
  assert.ok(space.skyLuminance <= 0.02);
  assert.equal(morning.starOpacity, 0);
  assert.equal(space.starOpacity, 1);
});

test('Skyward PaperDioramaDemo has 0 OBB SAT collisions, >=4x Keplerian gravity-assist slingshot on 3D Saturn ring, 181-pt contrail, and 540-deg coin-flip Moon', () => {
  assert.equal(PAPER_DIORAMA_DURATION_FRAMES, 1110);
  assert.equal(PAPER_DIORAMA_MILESTONES.length, 5);

  let prevAltitudeY = -Infinity;
  let prevRocketPos: readonly [number, number, number] | null = null;
  let minCaptureSpeed = Infinity;
  let peakSlingshotSpeed = 0;
  let minClearance = Infinity;
  let maxDepartureX = -Infinity;
  let maxDepartureY = -Infinity;
  let minOrbitZ = Infinity;
  let maxOrbitZ = -Infinity;
  let sawWakePulse = false;

  for (let f = 1; f < PAPER_DIORAMA_DURATION_FRAMES; f++) {
    const state = evaluatePaperDioramaFrame(f, PAPER_DIORAMA_DURATION_FRAMES);
    const report = auditSceneCollisions3D(state.collisionBodies, {
      minClearance: 0.005,
    });
    assert.equal(
      report.violations.length,
      0,
      `PaperDiorama SAT collision at f=${f}: ${JSON.stringify(report.violations)}`
    );
    minClearance = Math.min(minClearance, report.minClearance);

    assert.ok(
      state.altitudeY >= prevAltitudeY - 1e-6,
      `Altitude decreased at f=${f}: ${state.altitudeY} < ${prevAltitudeY}`
    );
    prevAltitudeY = state.altitudeY;

    // Measure real per-frame 3D speed during Keplerian capture & slingshot ejection (`f=646..937`)
    if (prevRocketPos !== null && f >= 646 && f <= 937) {
      const speedPerFrame = Math.hypot(
        state.rocket.position[0] - prevRocketPos[0],
        state.rocket.position[1] - prevRocketPos[1],
        state.rocket.position[2] - prevRocketPos[2]
      );
      if (f >= 705 && f <= 790) {
        minCaptureSpeed = Math.min(minCaptureSpeed, speedPerFrame);
      }
      if (f >= 850 && f <= 937) {
        peakSlingshotSpeed = Math.max(peakSlingshotSpeed, speedPerFrame);
      }
    }
    prevRocketPos = state.rocket.position;

    // Track real 3D Saturn-ring depth excursion around Moon (`z = -1.80`)
    if (f >= 729 && f <= 889) {
      minOrbitZ = Math.min(minOrbitZ, state.rocket.position[2]);
      maxOrbitZ = Math.max(maxOrbitZ, state.rocket.position[2]);
    }

    if (f >= 878 && f <= 945 && state.moon.wakePulse > 0.7) {
      sawWakePulse = true;
    }
    if (f >= 920) {
      maxDepartureX = Math.max(maxDepartureX, state.rocket.position[0]);
      maxDepartureY = Math.max(maxDepartureY, state.rocket.position[1]);
    }

    // Verify ultra-dense 181-point silky Saturn-ring comet contrail during/after orbit
    if (f >= 655) {
      assert.ok(
        state.slingshotTrailPoints.length >= 180,
        `Expected >= 180 silky Saturn-ring contrail points at f=${f}, got ${state.slingshotTrailPoints.length}`
      );
    }

    // Verify no deep-space star touches top-left header zone
    for (const star of state.stars) {
      assert.ok(
        !(star.position[0] < -0.9 && star.position[1] > 54.65),
        `Star ${star.id} intrudes into top-left header zone: ${JSON.stringify(star.position)}`
      );
    }

    assert.equal(state.clouds.length, 10);
    assert.equal(state.birds.length, 5, 'Expected 5 individual soaring birds');
    assert.equal(state.satellites.length, 2);
    assert.equal(state.stars.length, 38);
    assert.equal(state.launchSmokePuffs.length, 10);
  }

  const startState = evaluatePaperDioramaFrame(1, PAPER_DIORAMA_DURATION_FRAMES);
  const preFlickState = evaluatePaperDioramaFrame(870, PAPER_DIORAMA_DURATION_FRAMES);
  const glintPeakState = evaluatePaperDioramaFrame(997, PAPER_DIORAMA_DURATION_FRAMES);
  const endState = evaluatePaperDioramaFrame(
    PAPER_DIORAMA_DURATION_FRAMES - 1,
    PAPER_DIORAMA_DURATION_FRAMES
  );

  assert.equal(startState.altitudeY, 0);
  assert.equal(endState.altitudeY, PAPER_DIORAMA_MAX_ALTITUDE_Y);
  assert.equal(preFlickState.moon.coinSpinY, 0, 'Moon front face should stay facing camera before front periapsis whip');
  assert.ok(
    minCaptureSpeed <= 0.055,
    `Expected slow hang-time gravity capture <= 0.055 u/f, got ${minCaptureSpeed.toFixed(4)}`
  );
  assert.ok(
    peakSlingshotSpeed >= 0.26,
    `Expected blazing slingshot ejection >= 0.26 u/f, got ${peakSlingshotSpeed.toFixed(4)}`
  );
  const speedRatio = peakSlingshotSpeed / Math.max(1e-5, minCaptureSpeed);
  assert.ok(
    speedRatio >= 4.0,
    `Expected >= 4.0x Keplerian slingshot acceleration ratio, got ${speedRatio.toFixed(2)}x`
  );
  assert.ok(
    minOrbitZ < endState.moon.position[2] - 0.5 &&
      maxOrbitZ > endState.moon.position[2] + 0.5,
    `Expected real 3D Saturn-ring orbit passing behind and in front of Moon (z=${endState.moon.position[2]}), got [${minOrbitZ.toFixed(2)}, ${maxOrbitZ.toFixed(2)}]`
  );
  assert.ok(
    glintPeakState.departureStarGlint.opacity > 0.9 &&
      glintPeakState.departureStarGlint.position[1] <= 57.5,
    `Expected unclipped upper-right departureStarGlint inside viewport, got ${JSON.stringify(glintPeakState.departureStarGlint)}`
  );
  assert.ok(
    Math.abs(endState.moon.coinSpinY - 3 * Math.PI) <= 0.05,
    `Expected Moon coinSpinY to settle at 3*PI (${(3 * Math.PI).toFixed(3)}), got ${endState.moon.coinSpinY.toFixed(3)}`
  );
  assert.ok(Math.abs(endState.moon.coinWobbleX) <= 0.005);
  assert.ok(Math.abs(endState.moon.coinWobbleZ) <= 0.005);
  assert.ok(sawWakePulse, 'Expected golden wake-sparkle pulse when rocket whips past Moon');
  assert.ok(
    maxDepartureX >= 10 && maxDepartureY >= 59,
    `Rocket must blast cleanly off upper-right into deep space, got (${maxDepartureX.toFixed(2)}, ${maxDepartureY.toFixed(2)})`
  );
  assert.ok(minClearance >= 0.005, `Min SAT clearance ${minClearance} < 0.005`);
});
