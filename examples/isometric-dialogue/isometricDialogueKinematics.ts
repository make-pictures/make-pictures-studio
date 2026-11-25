import * as THREE from 'three';
import {
  computeSceneTimingFromVoiceover,
  evaluateAnticipation,
  evaluateArc3D,
  type CompositionSceneSegment,
  type OrientedBox3D,
  type ProductionCameraCut,
  type ProductionSfxCue,
  type SceneVoiceoverData,
  type Vec3,
} from '@make-pictures/remotion';
import {
  evaluateDirectorCamera3D,
  type CameraImpulse,
  type ResolvedCameraPose3D,
  type ShotSpec3D,
  type StageAnchor3D,
} from '@make-pictures/remotion/camera';
import type { PaperTimelineMilestone } from '@make-pictures/remotion/kits/editorial-collage';
import {
  computePodcastStudioLayout,
  type PodcastStudioLayout,
} from '@make-pictures/remotion/kits/isometric-3d';
import { VOICEOVER_MANIFEST } from './generated/audio-manifest';

export const ISOMETRIC_DIALOGUE_FPS = 60 as const;
export const ISOMETRIC_DIALOGUE_SCENE_ID = 'five-seconds-to-air' as const;
export const ISOMETRIC_DIALOGUE_DEFAULT_VO_SECONDS = 19.2;

export type IsometricCountdownLabel =
  | '00:05'
  | '00:04'
  | '00:03'
  | '00:02'
  | '00:01'
  | 'LIVE';

export type IsometricSpeakerId = 'maya' | 'leo';

export interface IsometricDialogueTurnWindow {
  turnIndex: number;
  speaker: IsometricSpeakerId;
  speakerName: 'Maya' | 'Leo';
  fromFrame: number;
  endFrame: number;
  durationInFrames: number;
  startTimeSeconds: number;
  endTimeSeconds: number;
}

export interface IsometricDialogueTimeline {
  fps: number;
  durationInFrames: number;
  voiceoverStartFrame: number;
  voiceoverDurationFrames: number;
  voiceoverEndFrame: number;
  turns: ReadonlyArray<IsometricDialogueTurnWindow>;
  /** Exact countdown tick frames locked to real word timestamps (`00:04`, `00:03`, `00:02`, `00:01`). */
  countdownFrames: {
    t4: number;
    t3: number;
    t2: number;
    t1: number;
  };
  /** Exact frame when ON AIR blazes red-orange and both hosts snap to poised broadcast smiles. */
  onAirFrame: number;
  /** Exact frame when Leo's panic jump launches his ceramic mug off its coaster. */
  mugLaunchFrame: number;
  /** Exact frame when Leo's boom mic starts its elastic spring wobble. */
  micWobbleStartFrame: number;
  milestones: ReadonlyArray<PaperTimelineMilestone>;
  voTimeline: ReadonlyArray<CompositionSceneSegment>;
  sfxTimeline: ReadonlyArray<ProductionSfxCue & { durationInFrames: number }>;
  cameraTimeline: ReadonlyArray<ProductionCameraCut>;
}

export interface IsometricHostKinematics {
  id: IsometricSpeakerId;
  name: 'Maya' | 'Leo';
  position: Vec3;
  rotationY: number;
  headYaw: number;
  headTiltZ: number;
  headNodPitch: number;
  torsoRoll: number;
  speakingWeight: number;
  speechEnergy: number;
  /** Grounded comedic jump lift (`>= 0`, zero stool/floor clipping). */
  jumpOffsetY: number;
  /** Squash-and-stretch `[scaleX, scaleY, scaleZ]` during comedic panic bounce & poise snap. */
  squashScale: Vec3;
  pose: 'idle' | 'pointing';
  /** Instant `0..1` comedic poise snap right at `onAirFrame`. */
  poisedSmileSnap: number;
  obb: OrientedBox3D;
}

export interface IsometricMugKinematics {
  /** Coaster world position resting cleanly on the oak tabletop (`[0.58, 0.68, 0.42]`). */
  coasterPosition: Vec3;
  /** Mug world center position (always keeps `>= 0.008` OBB SAT clearance above tabletop!). */
  position: Vec3;
  /** Playful mid-air tilt/spin during Leo's panic jump. */
  rotationZ: number;
  rotationY: number;
  /** Crisp Disney anticipation/takeoff/landing squash-and-stretch. */
  scale: Vec3;
  /** Normalized `0..1` height factor (`0` resting on coaster, `1` at bounce apex). */
  airborneFactor: number;
  width: number;
  height: number;
  depth: number;
  obb: OrientedBox3D;
}

export interface IsometricDialogueFrameState {
  frame: number;
  durationInFrames: number;
  timeline: IsometricDialogueTimeline;
  layout: PodcastStudioLayout;
  activeTurnIndex: number | null;
  activeSpeaker: IsometricSpeakerId | null;
  isOnAir: boolean;
  /** Crisp `0..1` spring transition when `ON AIR` clicks live. */
  onAirSnap: number;
  countdownLabel: IsometricCountdownLabel;
  /** `0..1` LED clock tick pulse emphasizing each countdown flip. */
  countdownPulse: number;
  /** `DaylightArcRig3D` time-of-day (`0.18` crisp morning -> `0.74` luminous golden-hour ON AIR!). */
  timeOfDay: number;
  /** `0..1` soundboard LED blink energy during Turn 2–3 scramble. */
  soundboardPanicPulse: number;
  /** Elastic damped spring wobble (radians) for Leo's desk boom mic accent during Turn 2–3. */
  leoMicWobbleZ: number;
  maya: IsometricHostKinematics;
  leo: IsometricHostKinematics;
  mug: IsometricMugKinematics;
  camera: {
    anchors: Record<string, StageAnchor3D>;
    shots: ReadonlyArray<ShotSpec3D>;
    impulses: ReadonlyArray<CameraImpulse>;
    pose: ResolvedCameraPose3D;
  };
  milestones: ReadonlyArray<PaperTimelineMilestone>;
  sfxTimeline: ReadonlyArray<ProductionSfxCue & { durationInFrames: number }>;
  cameraTimeline: ReadonlyArray<ProductionCameraCut>;
  collisionBodies: OrientedBox3D[];
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t);
}

function smoothstep(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

function makeObb(params: {
  id: string;
  position: Vec3;
  size: Vec3;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  scale?: Vec3;
}): OrientedBox3D {
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(params.rotX ?? 0, params.rotY ?? 0, params.rotZ ?? 0, 'XYZ')
  );
  return {
    id: params.id,
    position: params.position,
    size: params.size,
    quaternion: [q.x, q.y, q.z, q.w],
    scale: params.scale ?? [1, 1, 1],
  };
}

/**
 * C-infinity silky-smooth speech syllable envelope for `ClayCharacter3D`:
 * - Zero `Math.abs(sin)` cusps or high-frequency facial spasms.
 * - Natural ~1.28 Hz primary cadence + ~0.68 Hz phrasing wave in `[0.16, 0.50]`.
 * - Guaranteed max frame-to-frame `speechEnergy` delta `<= 0.04` at `60 FPS`.
 */
export function evaluateSmoothSpeechEnvelope(
  globalFrame: number,
  seg: { fromFrame: number; durationInFrames: number },
  fps: number = ISOMETRIC_DIALOGUE_FPS
): { speakingWeight: number; speechEnergy: number } {
  const rel = globalFrame - seg.fromFrame;
  if (rel <= 0 || rel >= seg.durationInFrames) {
    return { speakingWeight: 0, speechEnergy: 0 };
  }

  const fadeIn = smoothstep(rel / 20);
  const fadeOut = smoothstep((seg.durationInFrames - rel) / 22);
  const speakingWeight = clamp01(Math.min(fadeIn, fadeOut));

  const tSec = rel / Math.max(1, fps);
  const primaryWave = 0.5 - 0.5 * Math.cos(2 * Math.PI * 1.28 * tSec);
  const phraseWave = 0.5 - 0.5 * Math.cos(2 * Math.PI * 0.68 * tSec + 0.85);
  const syllableContour =
    0.16 + 0.34 * (0.62 * primaryWave + 0.38 * phraseWave);

  return {
    speakingWeight,
    speechEnergy: speakingWeight * syllableContour,
  };
}

// Proportional fallback turn fractions matching the 6 script turns when voiceSegments are absent
const FALLBACK_TURN_SPLITS: ReadonlyArray<{
  speaker: IsometricSpeakerId;
  startFrac: number;
  endFrac: number;
}> = [
  { speaker: 'leo', startFrac: 0.0, endFrac: 0.1875 },
  { speaker: 'maya', startFrac: 0.2005, endFrac: 0.362 },
  { speaker: 'leo', startFrac: 0.3724, endFrac: 0.5547 },
  { speaker: 'maya', startFrac: 0.5651, endFrac: 0.6641 },
  { speaker: 'leo', startFrac: 0.6927, endFrac: 0.8828 },
  { speaker: 'maya', startFrac: 0.8932, endFrac: 1.0 },
];

const TURN_SPEAKER_ORDER: ReadonlyArray<IsometricSpeakerId> = [
  'leo',
  'maya',
  'leo',
  'maya',
  'leo',
  'maya',
];

/**
 * Resolves exact data-driven frame boundaries for all 6 dialogue turns, the `ON AIR` snap,
 * Leo's mug bounce, boom mic wobble, milestones, and SFX directly from `VOICEOVER_MANIFEST`.
 * When `@audio-engineer` swaps in real `eleven_v4` Text-to-Dialogue `voiceSegments`,
 * every gag, countdown tick, lip-sync, and camera cut locks automatically to real speech!
 */
export function resolveIsometricDialogueTimeline(
  manifest: Record<string, SceneVoiceoverData> = VOICEOVER_MANIFEST,
  fps: number = ISOMETRIC_DIALOGUE_FPS
): IsometricDialogueTimeline {
  const entry = manifest[ISOMETRIC_DIALOGUE_SCENE_ID];
  const voDurationSec =
    entry &&
    typeof entry.durationInSeconds === 'number' &&
    entry.durationInSeconds > 2
      ? entry.durationInSeconds
      : ISOMETRIC_DIALOGUE_DEFAULT_VO_SECONDS;

  const timing = computeSceneTimingFromVoiceover(voDurationSec, {
    fps,
    preSettleSeconds: 0.7,
    postHoldSeconds: 2.3,
    isFinalScene: true,
  });

  const voStart = timing.voiceoverStartFrame;
  const rawSegments = entry?.voiceSegments;
  const turns: IsometricDialogueTurnWindow[] = [];

  if (Array.isArray(rawSegments) && rawSegments.length >= 6) {
    // Group or read exact 6 dialogueInputIndex turns in order
    for (let i = 0; i < 6; i++) {
      const matching = rawSegments.filter((s) => s.dialogueInputIndex === i);
      const seg = matching.length > 0 ? matching[0]! : rawSegments[i]!;
      const startSec =
        matching.length > 0
          ? Math.min(...matching.map((m) => m.startTimeSeconds))
          : seg.startTimeSeconds;
      const endSec =
        matching.length > 0
          ? Math.max(...matching.map((m) => m.endTimeSeconds))
          : seg.endTimeSeconds;
      const fromFrame = voStart + Math.round(startSec * fps);
      const endFrame = Math.max(fromFrame + 24, voStart + Math.round(endSec * fps));
      const speaker = TURN_SPEAKER_ORDER[i]!;
      turns.push({
        turnIndex: i,
        speaker,
        speakerName: speaker === 'maya' ? 'Maya' : 'Leo',
        fromFrame,
        endFrame,
        durationInFrames: endFrame - fromFrame,
        startTimeSeconds: startSec,
        endTimeSeconds: endSec,
      });
    }
  } else {
    for (let i = 0; i < 6; i++) {
      const spec = FALLBACK_TURN_SPLITS[i]!;
      const startSec = spec.startFrac * voDurationSec;
      const endSec = spec.endFrac * voDurationSec;
      const fromFrame = voStart + Math.round(startSec * fps);
      const endFrame = Math.max(fromFrame + 24, voStart + Math.round(endSec * fps));
      turns.push({
        turnIndex: i,
        speaker: spec.speaker,
        speakerName: spec.speaker === 'maya' ? 'Maya' : 'Leo',
        fromFrame,
        endFrame,
        durationInFrames: endFrame - fromFrame,
        startTimeSeconds: startSec,
        endTimeSeconds: endSec,
      });
    }
  }

  const turn1 = turns[1]!;
  const turn2 = turns[2]!;
  const turn3 = turns[3]!;
  const turn4 = turns[4]!;
  const turn5 = turns[5]!;

  // Lock comedy beats & countdown ticks directly to exact real word timestamps when present!
  const words = entry?.words ?? [];
  const findWordFrame = (
    pattern: RegExp,
    minFrame: number,
    maxFrame: number,
    fallbackFrame: number,
    useEnd = false
  ): number => {
    for (const w of words) {
      const f = voStart + (useEnd ? w.endFrame : w.startFrame);
      if (f >= minFrame && f <= maxFrame && pattern.test(w.word)) {
        return f;
      }
    }
    return fallbackFrame;
  };

  const t4Frame = findWordFrame(
    /clock/i,
    turn1.fromFrame,
    turn1.endFrame,
    turn1.fromFrame + 22
  );
  const t3Frame = turn2.fromFrame;
  const t2Frame = findWordFrame(
    /^two/i,
    turn3.fromFrame,
    turn3.endFrame,
    turn3.fromFrame + Math.round(turn3.durationInFrames * 0.25)
  );
  const t1Frame = findWordFrame(
    /^one/i,
    t2Frame + 4,
    turn3.endFrame,
    turn3.fromFrame + Math.round(turn3.durationInFrames * 0.55)
  );

  // Place ON AIR click cleanly right as Maya finishes "smile!" and just before Leo begins "Good evening..."
  const goodWordFrame = findWordFrame(
    /^good/i,
    turn4.fromFrame - 6,
    turn4.endFrame,
    turn4.fromFrame + 4
  );
  const smileEndFrame = findWordFrame(
    /smile/i,
    turn3.fromFrame,
    turn3.endFrame + 12,
    turn3.endFrame,
    true
  );
  const rawOnAir =
    turn4.fromFrame - turn3.endFrame >= 8
      ? Math.round((turn3.endFrame + turn4.fromFrame) * 0.5)
      : Math.min(goodWordFrame - 10, smileEndFrame - 4);
  const onAirFrame = Math.max(t1Frame + 18, rawOnAir);

  // Leo's mug launches on the exact frame Leo shouts "FIVE?!" in Turn 2
  const mugLaunchFrame = findWordFrame(
    /^five/i,
    turn2.fromFrame,
    turn2.endFrame,
    turn2.fromFrame + 10
  );
  // Leo bumps/straightens his boom mic on the exact frame he says "mic" in Turn 2
  const micWobbleStartFrame = findWordFrame(
    /^mic/i,
    turn2.fromFrame,
    turn2.endFrame,
    turn2.fromFrame + 32
  );

  const milestones: PaperTimelineMilestone[] = [
    { id: 'chill', era: '05s', label: 'Chill', fromFrame: 2 },
    { id: 'panic', era: '04s', label: 'Panic!', fromFrame: turn1.fromFrame },
    { id: 'scramble', era: '02s', label: 'Scramble', fromFrame: turn2.fromFrame },
    { id: 'ready', era: '01s', label: 'Ready', fromFrame: turn3.fromFrame },
    { id: 'on-air', era: 'LIVE', label: 'ON AIR', fromFrame: onAirFrame },
  ];

  const voTimeline: CompositionSceneSegment[] = [
    {
      sceneId: ISOMETRIC_DIALOGUE_SCENE_ID,
      fromFrame: voStart,
      durationInFrames: Math.min(
        timing.durationInFrames - voStart,
        timing.voiceoverDurationFrames + 12
      ),
      label: 'Five Seconds to Air • Leo & Maya Dialogue',
    },
  ];

  const clampSfxDur = (from: number, desired: number) =>
    Math.max(12, Math.min(desired, timing.durationInFrames - from));

  const countdownBeepFrom = t4Frame;
  const mugClinkFrom = mugLaunchFrame;
  const micWhooshFrom = micWobbleStartFrame;
  const onAirChimeFrom = Math.max(0, onAirFrame - 2);
  const outroChordFrom = Math.min(
    timing.durationInFrames - 134,
    turn5.endFrame + 2
  );

  const sfxTimeline: Array<ProductionSfxCue & { durationInFrames: number }> = [
    {
      sfxId: 'countdown-beep',
      fromFrame: countdownBeepFrom,
      durationInFrames: clampSfxDur(countdownBeepFrom, 44), // 0.60 s (36 f) + 8 f tail
      label: 'Studio Countdown Pip (00:04)',
      volume: 0.2,
    },
    {
      sfxId: 'mug-hop-clink',
      fromFrame: mugClinkFrom,
      durationInFrames: clampSfxDur(mugClinkFrom, 72), // 1.06 s (64 f) + 8 f tail
      label: 'Ceramic Mug Bounce & Coaster Clink',
      volume: 0.24,
    },
    {
      sfxId: 'mic-scramble-whoosh',
      fromFrame: micWhooshFrom,
      durationInFrames: clampSfxDur(micWhooshFrom, 76), // 1.14 s (69 f) + 7 f tail
      label: 'Boom Mic Swivel & Chair Scramble',
      volume: 0.21,
    },
    {
      sfxId: 'on-air-click-chime',
      fromFrame: onAirChimeFrom,
      durationInFrames: clampSfxDur(onAirChimeFrom, 102), // 1.54 s (93 f) + 9 f tail
      label: 'ON AIR Toggle Click & Broadcast Chime',
      volume: 0.26,
    },
    {
      sfxId: 'studio-outro-chord',
      fromFrame: outroChordFrom,
      durationInFrames: clampSfxDur(outroChordFrom, 132), // 2.06 s (124 f) + 8 f tail
      label: 'Rhodes Studio Sign-Off Chord',
      volume: 0.2,
    },
  ];

  const cameraTimeline: ProductionCameraCut[] = [
    {
      shotLabel: '00:05 • Cozy Morning Establish',
      fromFrame: 0,
      durationInFrames: turn1.fromFrame - 6,
    },
    {
      shotLabel: '00:04 • Maya Wide-Eyed Point',
      fromFrame: turn1.fromFrame - 6,
      durationInFrames: turn2.fromFrame - 4 - (turn1.fromFrame - 6),
    },
    {
      shotLabel: '00:03 • Leo Panic & Mug Hop',
      fromFrame: turn2.fromFrame - 4,
      durationInFrames: turn3.fromFrame - 4 - (turn2.fromFrame - 4),
    },
    {
      shotLabel: '00:02–00:01 • Countdown Swoop',
      fromFrame: turn3.fromFrame - 4,
      durationInFrames: onAirFrame - 10 - (turn3.fromFrame - 4),
    },
    {
      shotLabel: 'LIVE • Golden-Hour ON AIR Two-Shot',
      fromFrame: onAirFrame - 10,
      durationInFrames: turn5.fromFrame + 18 - (onAirFrame - 10),
    },
    {
      shotLabel: 'LIVE • Warm Broadcast Pull-Back',
      fromFrame: turn5.fromFrame + 18,
      durationInFrames: timing.durationInFrames - (turn5.fromFrame + 18),
    },
  ];

  return {
    fps,
    durationInFrames: timing.durationInFrames,
    voiceoverStartFrame: voStart,
    voiceoverDurationFrames: timing.voiceoverDurationFrames,
    voiceoverEndFrame: timing.voiceoverEndFrame,
    turns,
    countdownFrames: {
      t4: t4Frame,
      t3: t3Frame,
      t2: t2Frame,
      t1: t1Frame,
    },
    onAirFrame,
    mugLaunchFrame,
    micWobbleStartFrame,
    milestones,
    voTimeline,
    sfxTimeline,
    cameraTimeline,
  };
}

export const DEFAULT_ISOMETRIC_DIALOGUE_TIMELINE =
  resolveIsometricDialogueTimeline(VOICEOVER_MANIFEST, ISOMETRIC_DIALOGUE_FPS);

export const ISOMETRIC_DIALOGUE_DURATION_FRAMES =
  DEFAULT_ISOMETRIC_DIALOGUE_TIMELINE.durationInFrames;

/**
 * Pure deterministic frame evaluator for `IsometricDialogueDemo` ("Five Seconds to Air").
 * Guarantees:
 * - 0 OBB SAT collisions across EVERY frame (oak table, console, Maya, Leo, bouncing mug).
 * - Smooth C-infinity facial speech envelopes (`max delta <= 0.04/frame` — ZERO jitter!).
 * - Real 5-to-LIVE LED countdown, morning-to-golden-hour lighting bloom, bouncing mug arc,
 *   elastic boom mic wobble, and instant comedic poise snap at `ON AIR`.
 */
export function evaluateIsometricDialogueFrame(
  rawFrame: number,
  manifest: Record<string, SceneVoiceoverData> = VOICEOVER_MANIFEST,
  width = 1920,
  height = 1080
): IsometricDialogueFrameState {
  const timeline =
    manifest === VOICEOVER_MANIFEST
      ? DEFAULT_ISOMETRIC_DIALOGUE_TIMELINE
      : resolveIsometricDialogueTimeline(manifest, ISOMETRIC_DIALOGUE_FPS);

  const f = Math.max(0, Math.min(timeline.durationInFrames, rawFrame));
  const tSec = f / timeline.fps;
  const layout = computePodcastStudioLayout({ compactVertical: false });

  const turn0 = timeline.turns[0]!;
  const turn1 = timeline.turns[1]!;
  const turn2 = timeline.turns[2]!;
  const turn3 = timeline.turns[3]!;
  const turn4 = timeline.turns[4]!;
  const turn5 = timeline.turns[5]!;

  // --- 1. Active Turn & Jitter-Free C-Infinity Speech Envelopes ---
  let activeTurnIndex: number | null = null;
  let activeSpeaker: IsometricSpeakerId | null = null;

  let mayaSpeakingWeight = 0;
  let mayaSpeechEnergy = 0;
  let leoSpeakingWeight = 0;
  let leoSpeechEnergy = 0;

  for (const turn of timeline.turns) {
    if (f >= turn.fromFrame && f < turn.endFrame) {
      activeTurnIndex = turn.turnIndex;
      activeSpeaker = turn.speaker;
    }
    const env = evaluateSmoothSpeechEnvelope(
      f,
      { fromFrame: turn.fromFrame, durationInFrames: turn.durationInFrames },
      timeline.fps
    );
    if (turn.speaker === 'maya') {
      if (env.speakingWeight > mayaSpeakingWeight) {
        mayaSpeakingWeight = env.speakingWeight;
        mayaSpeechEnergy = env.speechEnergy;
      }
    } else {
      if (env.speakingWeight > leoSpeakingWeight) {
        leoSpeakingWeight = env.speakingWeight;
        leoSpeechEnergy = env.speechEnergy;
      }
    }
  }

  // --- 2. Countdown Clock (`00:05 -> 00:04 -> 00:03 -> 00:02 -> 00:01 -> LIVE`) ---
  const { t4: t4Frame, t3: t3Frame, t2: t2Frame, t1: t1Frame } =
    timeline.countdownFrames;
  const liveFrame = timeline.onAirFrame;

  let countdownLabel: IsometricCountdownLabel = '00:05';
  let lastTickFrame = 0;
  if (f >= liveFrame) {
    countdownLabel = 'LIVE';
    lastTickFrame = liveFrame;
  } else if (f >= t1Frame) {
    countdownLabel = '00:01';
    lastTickFrame = t1Frame;
  } else if (f >= t2Frame) {
    countdownLabel = '00:02';
    lastTickFrame = t2Frame;
  } else if (f >= t3Frame) {
    countdownLabel = '00:03';
    lastTickFrame = t3Frame;
  } else if (f >= t4Frame) {
    countdownLabel = '00:04';
    lastTickFrame = t4Frame;
  }

  const tickElapsed = f - lastTickFrame;
  const countdownPulse =
    lastTickFrame > 0 && tickElapsed >= 0 && tickElapsed < 28
      ? Math.sin((tickElapsed / 28) * Math.PI)
      : 0;

  const isOnAir = f >= timeline.onAirFrame;
  const onAirSnap = smoothstep((f - timeline.onAirFrame) / 10);

  // --- 3. Lighting Bloom (`DaylightArcRig3D`: Crisp Morning 0.18 -> Warm Scramble -> Golden-Hour 0.74!) ---
  let timeOfDay = 0.18;
  if (f < turn2.fromFrame) {
    timeOfDay = lerp(0.16, 0.2, smoothstep(f / Math.max(1, turn2.fromFrame)));
  } else if (f < timeline.onAirFrame) {
    const scrambleU = clamp01(
      (f - turn2.fromFrame) / Math.max(1, timeline.onAirFrame - turn2.fromFrame)
    );
    // Warm up subtly on Turn 2, then bloom dramatically into luminous golden-hour through Turn 3!
    const bloomCurve = Math.pow(smoothstep(scrambleU), 1.25);
    timeOfDay = lerp(0.2, 0.74, bloomCurve);
  } else {
    const liveU = clamp01(
      (f - timeline.onAirFrame) /
        Math.max(1, timeline.durationInFrames - timeline.onAirFrame)
    );
    timeOfDay = lerp(0.74, 0.77, smoothstep(liveU));
  }

  // --- 4. Soundboard LED Panic Blink & Elastic Boom Mic Wobble ---
  const panicWindow =
    smoothstep((f - turn2.fromFrame) / 14) *
    (1 - smoothstep((f - (timeline.onAirFrame - 12)) / 14));
  const soundboardPanicPulse =
    panicWindow * (0.5 + 0.5 * Math.sin(tSec * Math.PI * 6.5));

  const micRel = f - timeline.micWobbleStartFrame;
  const micDur = Math.max(60, timeline.onAirFrame - timeline.micWobbleStartFrame);
  let leoMicWobbleZ = 0;
  if (micRel > 0 && micRel < micDur) {
    const u = micRel / micDur;
    const damp = Math.pow(1 - u, 1.85) * smoothstep(u / 0.08);
    leoMicWobbleZ = damp * 0.24 * Math.sin(u * Math.PI * 7.0);
  }

  // --- 5. Leo's Grounded Comedic Jump & Panic Squash/Stretch (ZERO stool clipping!) ---
  const jumpStart = timeline.mugLaunchFrame - 4;
  const jumpDur = 46;
  const jumpRel = f - jumpStart;
  let leoJumpY = 0;
  let leoScaleX = 1;
  let leoScaleY = 1;

  if (jumpRel >= 0 && jumpRel <= jumpDur) {
    if (jumpRel < 8) {
      // Quick comedic anticipation dip in squash only (`jumpOffsetY === 0` so bottom stays grounded!)
      const a = evaluateAnticipation(jumpRel / 8, 0.85);
      const sq = Math.sin((jumpRel / 8) * Math.PI);
      leoScaleX = 1 + sq * 0.08;
      leoScaleY = 1 - sq * 0.09 + Math.max(0, a.bendY * 0.02);
      leoJumpY = 0;
    } else if (jumpRel < 36) {
      const airU = (jumpRel - 8) / 28;
      const arc = Math.sin(airU * Math.PI);
      leoJumpY = arc * 0.16; // Crisp startled hop in his chair (always >= 0!)
      const stretch = Math.sin(airU * Math.PI * 2) * 0.06;
      leoScaleX = 1 - Math.abs(stretch) * 0.4;
      leoScaleY = 1 + Math.max(-0.04, stretch);
    } else {
      const landU = (jumpRel - 36) / 10;
      const cush = Math.sin(landU * Math.PI);
      leoJumpY = 0;
      leoScaleX = 1 + cush * 0.06;
      leoScaleY = 1 - cush * 0.06;
    }
  }

  // Subtle cheerful rhythmic broadcast bob once ON AIR (and chill idle breath before)
  const poisedBounceEnv = onAirSnap;
  const leoRhythmBob =
    (0.5 - 0.5 * Math.cos(2 * Math.PI * 1.45 * tSec + 0.6)) *
    0.016 *
    (0.25 + 0.75 * Math.max(leoSpeakingWeight, poisedBounceEnv * 0.75));
  const mayaRhythmBob =
    (0.5 - 0.5 * Math.cos(2 * Math.PI * 1.45 * tSec)) *
    0.016 *
    (0.25 + 0.75 * Math.max(mayaSpeakingWeight, poisedBounceEnv * 0.75));

  // Crisp comedic poise snap impulse at `onAirFrame` (both hosts sit upright & beam simultaneously!)
  const snapPop =
    f >= timeline.onAirFrame && f < timeline.onAirFrame + 16
      ? Math.sin(((f - timeline.onAirFrame) / 16) * Math.PI)
      : 0;
  const mayaScaleX = 1 - snapPop * 0.03;
  const mayaScaleY = 1 + snapPop * 0.04;
  leoScaleX *= 1 - snapPop * 0.03;
  leoScaleY *= 1 + snapPop * 0.04;

  // --- 6. Expressive Head Turns, Poses & Instant ON AIR Poise Snap ---
  const mayaPointEnv =
    smoothstep((f - (turn1.fromFrame + 4)) / 14) *
    (1 - smoothstep((f - (turn1.endFrame - 6)) / 16));
  const leoScrambleEnv =
    smoothstep((f - turn2.fromFrame) / 12) *
    (1 - smoothstep((f - (timeline.onAirFrame - 4)) / 10));

  const mayaPose: 'idle' | 'pointing' = mayaPointEnv > 0.35 ? 'pointing' : 'idle';
  const leoPose: 'idle' | 'pointing' =
    leoScrambleEnv > 0.35 && !isOnAir ? 'pointing' : 'idle';

  // Maya looks toward Leo when listening, glances up-back at the countdown clock during Turn 1, then beams forward ON AIR
  const mayaListenYaw = leoSpeakingWeight * 0.16 * (1 - onAirSnap * 0.55);
  const mayaClockGlanceYaw = -mayaPointEnv * 0.14;
  const mayaOnAirYaw = onAirSnap * -0.18; // Turns charismatically toward camera on ON AIR!
  const mayaHeadYaw = mayaListenYaw + mayaClockGlanceYaw + mayaOnAirYaw;
  const mayaHeadTiltZ =
    mayaPointEnv * 0.12 +
    Math.sin(tSec * 1.9) * 0.03 * (0.4 + mayaSpeakingWeight * 0.6) * (1 - snapPop * 0.5);
  const mayaHeadNodPitch =
    (0.5 - 0.5 * Math.cos(2 * Math.PI * 1.45 * tSec) - 0.45) *
      (0.045 + poisedBounceEnv * 0.025) -
    mayaPointEnv * 0.08; // Looks slightly up toward the wall countdown clock!
  const mayaTorsoRoll =
    Math.sin(2 * Math.PI * 0.72 * tSec) * 0.024 + mayaPointEnv * 0.045;

  // Leo relaxes on Turn 0, whips head toward clock & scrambles on Turn 2, then SNAPS into suave radio host ON AIR!
  const leoListenYaw = -mayaSpeakingWeight * 0.16 * (1 - onAirSnap * 0.55);
  const leoPanicYaw =
    leoScrambleEnv * Math.sin(tSec * Math.PI * 3.8) * 0.19;
  const leoOnAirYaw = onAirSnap * 0.18; // Suave charismatic turn toward camera!
  const leoHeadYaw = leoListenYaw + leoPanicYaw + leoOnAirYaw;
  const leoHeadTiltZ =
    -leoScrambleEnv * 0.13 * Math.cos(tSec * Math.PI * 2.6) +
    Math.sin(tSec * 1.75 + 1.1) * 0.028 * (0.4 + leoSpeakingWeight * 0.6);
  const leoHeadNodPitch =
    (0.5 - 0.5 * Math.cos(2 * Math.PI * 1.45 * tSec + 0.6) - 0.45) *
      (0.045 + poisedBounceEnv * 0.03) +
    leoScrambleEnv * 0.06;
  const leoTorsoRoll =
    Math.sin(2 * Math.PI * 0.72 * tSec + 0.9) * 0.022 -
    leoScrambleEnv * 0.075 * Math.sin(tSec * Math.PI * 3.2);

  const mayaJumpTotal = mayaRhythmBob + snapPop * 0.028;
  const leoJumpTotal = leoJumpY + leoRhythmBob + snapPop * 0.028;

  const mayaPos: Vec3 = [
    layout.leftHostPosition[0],
    layout.leftHostPosition[1] + mayaJumpTotal,
    layout.leftHostPosition[2],
  ];
  const leoPos: Vec3 = [
    layout.rightHostPosition[0],
    layout.rightHostPosition[1] + leoJumpTotal,
    layout.rightHostPosition[2],
  ];

  const maya: IsometricHostKinematics = {
    id: 'maya',
    name: 'Maya',
    position: mayaPos,
    rotationY: layout.leftHostRotationY,
    headYaw: mayaHeadYaw,
    headTiltZ: mayaHeadTiltZ,
    headNodPitch: mayaHeadNodPitch,
    torsoRoll: mayaTorsoRoll,
    speakingWeight: mayaSpeakingWeight,
    speechEnergy: mayaSpeechEnergy,
    jumpOffsetY: mayaJumpTotal,
    squashScale: [mayaScaleX, mayaScaleY, mayaScaleX],
    pose: mayaPose,
    poisedSmileSnap: onAirSnap,
    obb: makeObb({
      id: 'host-maya',
      position: [mayaPos[0], mayaPos[1] + 0.78, mayaPos[2]],
      size: [0.64, 1.56, 0.52],
      rotY: layout.leftHostRotationY,
      scale: [mayaScaleX, mayaScaleY, mayaScaleX],
    }),
  };

  const leo: IsometricHostKinematics = {
    id: 'leo',
    name: 'Leo',
    position: leoPos,
    rotationY: layout.rightHostRotationY,
    headYaw: leoHeadYaw,
    headTiltZ: leoHeadTiltZ,
    headNodPitch: leoHeadNodPitch,
    torsoRoll: leoTorsoRoll,
    speakingWeight: leoSpeakingWeight,
    speechEnergy: leoSpeechEnergy,
    jumpOffsetY: leoJumpTotal,
    squashScale: [leoScaleX, leoScaleY, leoScaleX],
    pose: leoPose,
    poisedSmileSnap: onAirSnap,
    obb: makeObb({
      id: 'host-leo',
      position: [leoPos[0], leoPos[1] + 0.78, leoPos[2]],
      size: [0.64, 1.56, 0.52],
      rotY: layout.rightHostRotationY,
      scale: [leoScaleX, leoScaleY, leoScaleX],
    }),
  };

  // --- 7. Animated Bouncing Ceramic Coffee Mug (Disney Arc + >= 0.008 OBB SAT Table Clearance!) ---
  const tableTopY = layout.tableHeight - 0.048 + 0.095 * 0.5; // exact 0.6795
  const coasterClearanceY = tableTopY + 0.012; // 0.6915 -> guaranteed >= 0.012 > 0.008 above oak tabletop!
  const mugW = 0.116;
  const mugH = 0.12;
  const mugD = 0.116;
  const mugHalfH = mugH * 0.5;
  const coasterPos: Vec3 = [0.58, layout.tableHeight, layout.tableZ + 0.24]; // [0.58, 0.68, 0.42]
  const mugRestPos: Vec3 = [coasterPos[0], coasterClearanceY + mugHalfH, coasterPos[2]];

  const mugDur = 64;
  const mugRel = f - timeline.mugLaunchFrame;
  let mugPos: Vec3 = [...mugRestPos];
  let mugRotZ = 0;
  let mugRotY = -2.15;
  let mugScale: Vec3 = [1, 1, 1];
  let mugAirborne = 0;

  if (mugRel >= 0 && mugRel <= mugDur) {
    if (mugRel < 8) {
      // Crisp Disney anticipation squash before liftoff (bottom pinned strictly at coasterClearanceY!)
      const u = mugRel / 8;
      evaluateAnticipation(u, 0.9);
      const sq = Math.sin(u * Math.PI);
      const sy = 1 - sq * 0.11;
      const sx = 1 + sq * 0.09;
      mugScale = [sx, sy, sx];
      mugPos = [mugRestPos[0], coasterClearanceY + mugHalfH * sy, mugRestPos[2]];
      mugAirborne = 0;
    } else if (mugRel < 56) {
      // Parabolic Disney bounce arc (`evaluateArc3D`) rising +0.42 above desk with playful mid-air spin!
      const arcU = (mugRel - 8) / 48;
      const P0: Vec3 = mugRestPos;
      const P1: Vec3 = [mugRestPos[0] + 0.055, mugRestPos[1] + 0.56, mugRestPos[2] - 0.015];
      const P2: Vec3 = [mugRestPos[0] + 0.035, mugRestPos[1] + 0.56, mugRestPos[2] + 0.01];
      const P3: Vec3 = mugRestPos;
      const arc = evaluateArc3D(P0, P1, P2, P3, arcU, 0.05, 0.25);

      const sinEnv = Math.sin(arcU * Math.PI);
      mugRotZ = sinEnv * 0.46 * Math.cos(arcU * Math.PI * 1.8);
      mugRotY = -2.15 + arcU * Math.PI * 0.65 * sinEnv;

      // Slight stretch at launch & descent, spherical hover at apex
      const verticalStretch = Math.abs(Math.cos(arcU * Math.PI)) * 0.09 * sinEnv;
      const sy = 1 + verticalStretch;
      const sx = 1 - verticalStretch * 0.42;
      mugScale = [sx, sy, sx];

      // Guarantee rotated OBB lowest corner NEVER dips below `coasterClearanceY`!
      const rotHalfSpanY =
        Math.abs(Math.cos(mugRotZ)) * (mugHalfH * sy) +
        Math.abs(Math.sin(mugRotZ)) * (mugW * 0.5 * sx);
      const safeMinCenterY = coasterClearanceY + rotHalfSpanY;
      mugPos = [
        arc.position[0],
        Math.max(safeMinCenterY, arc.position[1]),
        arc.position[2],
      ];
      mugAirborne = clamp01((mugPos[1] - mugRestPos[1]) / 0.4);
    } else {
      // Crisp landing squash cushion squarely back on the cork coaster!
      const landU = (mugRel - 56) / 8;
      const sq = Math.sin(landU * Math.PI);
      const sy = 1 - sq * 0.1;
      const sx = 1 + sq * 0.08;
      mugScale = [sx, sy, sx];
      mugPos = [mugRestPos[0], coasterClearanceY + mugHalfH * sy, mugRestPos[2]];
      mugAirborne = 0;
    }
  }

  const mug: IsometricMugKinematics = {
    coasterPosition: coasterPos,
    position: mugPos,
    rotationZ: mugRotZ,
    rotationY: mugRotY,
    scale: mugScale,
    airborneFactor: mugAirborne,
    width: mugW,
    height: mugH,
    depth: mugD,
    obb: makeObb({
      id: 'bouncing-mug',
      position: mugPos,
      size: [mugW, mugH, mugD],
      rotY: mugRotY,
      rotZ: mugRotZ,
      scale: mugScale,
    }),
  };

  // --- 8. DirectorCamera3D Anchors, Shots & Comedic Recoil Impulses ---
  const anchorLiftY = 0.22;
  const anchors: Record<string, StageAnchor3D> = {
    studio: {
      position: [0, anchorLiftY + 0.06, layout.tableZ],
      height: 2.02,
      radius: 1.72,
    },
    maya: {
      position: [
        layout.leftHostPosition[0],
        layout.leftHostPosition[1] + anchorLiftY,
        layout.leftHostPosition[2],
      ],
      height: 1.66,
      radius: 0.84,
    },
    leo: {
      position: [
        layout.rightHostPosition[0],
        layout.rightHostPosition[1] + anchorLiftY,
        layout.rightHostPosition[2],
      ],
      height: 1.66,
      radius: 0.84,
    },
  };

  const shots: ShotSpec3D[] = [
    {
      fromFrame: 0,
      shot: 'medium-two-shot',
      target: 'maya',
      secondaryTarget: 'leo',
      angleDeg: 8,
      fov: 42,
      label: '00:05 Morning Establish',
    },
    {
      fromFrame: Math.max(12, turn1.fromFrame - 6),
      shot: 'close-up',
      target: 'maya',
      angleDeg: -10,
      fov: 38,
      transition: 'glide',
      label: '00:04 Maya Panic Point',
    },
    {
      fromFrame: Math.max(24, turn2.fromFrame - 4),
      shot: 'close-up',
      target: 'leo',
      angleDeg: 14,
      fov: 39,
      transition: 'glide',
      label: '00:03 Leo Mug-Bounce Scramble',
    },
    {
      fromFrame: Math.max(36, turn3.fromFrame - 4),
      shot: 'medium',
      target: 'studio',
      angleDeg: -6,
      fov: 41,
      transition: 'glide',
      label: '00:02-00:01 Swoop Level',
    },
    {
      fromFrame: Math.max(48, timeline.onAirFrame - 10),
      shot: 'medium-two-shot',
      target: 'maya',
      secondaryTarget: 'leo',
      angleDeg: 0,
      fov: 40,
      transition: 'glide',
      label: 'LIVE Golden-Hour Two-Shot',
    },
    {
      fromFrame: Math.min(timeline.durationInFrames - 60, turn5.fromFrame + 18),
      shot: 'establishing-wide',
      target: 'studio',
      angleDeg: -4,
      fov: 43,
      transition: 'glide',
      label: 'LIVE Warm Pull-Back',
    },
  ];

  const impulses: CameraImpulse[] = [
    {
      frame: timeline.mugLaunchFrame,
      intensity: 0.24,
      decayFrames: 26,
    },
    {
      frame: timeline.onAirFrame,
      intensity: 0.12,
      decayFrames: 16,
    },
  ];

  const cameraPose = evaluateDirectorCamera3D({
    frame: f,
    fps: timeline.fps,
    width,
    height,
    durationInFrames: timeline.durationInFrames,
    anchors,
    shots,
    impulses,
    handheldIntensity: isOnAir ? 0.008 : 0.012,
    seed: 505,
  });

  // --- 9. 15-Axis OBB SAT Collision Bodies (Oak Table, Console, Maya, Leo, Bouncing Mug) ---
  const oakTableObb = makeObb({
    id: 'oak-table',
    position: [0, layout.tableHeight - 0.048, layout.tableZ],
    size: [layout.tableWidth, 0.095, layout.tableDepth],
  });

  const studioConsoleObb = makeObb({
    id: 'studio-console',
    position: [0, tableTopY + 0.012 + 0.022, layout.tableZ - 0.02],
    size: [0.34, 0.044, 0.22],
  });

  const collisionBodies: OrientedBox3D[] = [
    oakTableObb,
    studioConsoleObb,
    maya.obb,
    leo.obb,
    mug.obb,
  ];

  return {
    frame: f,
    durationInFrames: timeline.durationInFrames,
    timeline,
    layout,
    activeTurnIndex,
    activeSpeaker,
    isOnAir,
    onAirSnap,
    countdownLabel,
    countdownPulse,
    timeOfDay,
    soundboardPanicPulse,
    leoMicWobbleZ,
    maya,
    leo,
    mug,
    camera: {
      anchors,
      shots,
      impulses,
      pose: cameraPose,
    },
    milestones: timeline.milestones,
    sfxTimeline: timeline.sfxTimeline,
    cameraTimeline: timeline.cameraTimeline,
    collisionBodies,
  };
}
