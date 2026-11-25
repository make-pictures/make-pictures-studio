import {
  computeSceneTimingFromVoiceover,
  type CompositionSceneSegment,
  type ProductionCameraCut,
  type ProductionSfxCue,
  type SceneVoiceoverData,
} from '@make-pictures/core';
import type {
  EditorialPanoramaItem,
  PaperTimelineMilestone,
} from '@make-pictures/kits/editorial-collage';
import type {
  BarRaceItem,
  BarRaceKeyframe,
} from '@make-pictures/kits/data-storytelling';
import type {
  HorizontalFeatureItem,
  MediaPinSpec,
} from '@make-pictures/kits/vector-scene-2d';
import { VOICEOVER_MANIFEST } from './generated/audio-manifest';

export const STARTER_STORY_FPS = 60 as const;
export const STARTER_CROSS_DISSOLVE_FRAMES = 48 as const;

export const STARTER_SCENE_ORDER = [
  'opener-en',
  'panorama-en',
  'anatomy-en',
  'speed-en',
  'secrets-en',
] as const;

export type StarterSceneId = (typeof STARTER_SCENE_ORDER)[number];

export interface StarterSceneMeta {
  id: StarterSceneId;
  actNumber: number;
  era: string;
  label: string;
  title: string;
  defaultVoSeconds: number;
}

export const STARTER_SCENE_META: ReadonlyArray<StarterSceneMeta> = [
  {
    id: 'opener-en',
    actNumber: 1,
    era: '01',
    label: 'The Teacup',
    title: 'Act 1 — Editorial Opener',
    defaultVoSeconds: 6.0,
  },
  {
    id: 'panorama-en',
    actNumber: 2,
    era: '02',
    label: 'Panorama',
    title: 'Act 2 — Rail Evolution Panorama',
    defaultVoSeconds: 7.5,
  },
  {
    id: 'anatomy-en',
    actNumber: 3,
    era: '03',
    label: 'Anatomy',
    title: 'Act 3 — Sculpted Anatomy',
    defaultVoSeconds: 6.4,
  },
  {
    id: 'speed-en',
    actNumber: 4,
    era: '04',
    label: 'Speed Race',
    title: 'Act 4 — Six Decades of Speed',
    defaultVoSeconds: 9.0,
  },
  {
    id: 'secrets-en',
    actNumber: 5,
    era: '05',
    label: 'Four Secrets',
    title: 'Act 5 — Four Quiet Secrets',
    defaultVoSeconds: 5.3,
  },
] as const;

export interface StarterSceneTimingEntry {
  id: StarterSceneId;
  actNumber: number;
  title: string;
  label: string;
  /** Global start frame inside `<ContinuousSceneFlow crossDissolveFrames={48} />`. */
  startFrame: number;
  /** Local duration in frames of this scene (>= 270). */
  durationInFrames: number;
  /** Global end frame (`startFrame + durationInFrames`). */
  endFrame: number;
  /** Local pre-speech settle frames before voiceover begins (>= 42). */
  preSpeechFrames: number;
  /** Local voiceover audio duration in frames. */
  voiceoverDurationFrames: number;
  /** Local post-speech hold frames after voiceover finishes (non-final includes cross-dissolve margin so effective post-hold >= 90; final >= 138). */
  postSpeechFrames: number;
  /** Global frame when this scene's voiceover starts. */
  globalVoiceoverStartFrame: number;
  /** Effective post-speech breathing frames before the next scene begins dissolving in (`>= 90` non-final, `>= 138` final). */
  effectivePostHoldFrames: number;
}

export interface StarterStoryTimingPlan {
  fps: number;
  crossDissolveFrames: number;
  scenes: ReadonlyArray<StarterSceneTimingEntry>;
  sceneById: Record<StarterSceneId, StarterSceneTimingEntry>;
  /** Total composition duration matching `ContinuousSceneFlow` (`sum(durations) - 4 * 48`). */
  totalDurationInFrames: number;
  milestones: ReadonlyArray<PaperTimelineMilestone>;
  voTimeline: ReadonlyArray<CompositionSceneSegment>;
  sfxTimeline: ReadonlyArray<ProductionSfxCue & { durationInFrames: number }>;
  cameraTimeline: ReadonlyArray<ProductionCameraCut>;
}

/**
 * Pure deterministic timing resolver for both `16:9` (`StarterStory`) and `9:16` (`StarterStoryVertical`).
 * Uses `computeSceneTimingFromVoiceover` with full cross-dissolve breathing compensation
 * so every act holds `>= 270f`, `pre >= 42f`, `effectivePost >= 90f` (`>= 138f` on closing act).
 */
export function resolveStarterStoryTiming(
  manifest: Record<string, SceneVoiceoverData> = VOICEOVER_MANIFEST,
  fps: number = STARTER_STORY_FPS
): StarterStoryTimingPlan {
  const overlap = STARTER_CROSS_DISSOLVE_FRAMES;
  const nonFinalPostHoldSeconds = 1.55 + overlap / fps; // 2.35 s -> 141 f -> 93 f effective post-hold before 48 f dissolve!
  const finalPostHoldSeconds = 2.35; // 141 f >= 138 f lush outro hold!

  const scenes: StarterSceneTimingEntry[] = [];
  let cursor = 0;

  STARTER_SCENE_META.forEach((meta, idx) => {
    const isFinal = idx === STARTER_SCENE_META.length - 1;
    const entry = manifest[meta.id];
    const voSec =
      entry &&
      typeof entry.durationInSeconds === 'number' &&
      entry.durationInSeconds > 0.5
        ? entry.durationInSeconds
        : meta.defaultVoSeconds;

    const computed = computeSceneTimingFromVoiceover(voSec, {
      fps,
      preSettleSeconds: 0.72, // 43 f >= 42 f
      postHoldSeconds: isFinal ? finalPostHoldSeconds : nonFinalPostHoldSeconds,
      minDurationSeconds: 4.5, // >= 270 f
      isFinalScene: isFinal,
    });

    const startFrame = cursor;
    const endFrame = startFrame + computed.durationInFrames;
    const effectivePostHoldFrames = isFinal
      ? computed.postHoldFrames
      : computed.postHoldFrames - overlap;

    scenes.push({
      id: meta.id,
      actNumber: meta.actNumber,
      title: meta.title,
      label: meta.label,
      startFrame,
      durationInFrames: computed.durationInFrames,
      endFrame,
      preSpeechFrames: computed.voiceoverStartFrame,
      voiceoverDurationFrames: computed.voiceoverDurationFrames,
      postSpeechFrames: computed.postHoldFrames,
      globalVoiceoverStartFrame: startFrame + computed.voiceoverStartFrame,
      effectivePostHoldFrames,
    });

    cursor = isFinal ? endFrame : endFrame - overlap;
  });

  const totalDurationInFrames = cursor;
  const sceneById = Object.fromEntries(
    scenes.map((s) => [s.id, s])
  ) as Record<StarterSceneId, StarterSceneTimingEntry>;

  const milestones: PaperTimelineMilestone[] = STARTER_SCENE_META.map(
    (meta, idx) => ({
      id: meta.id,
      era: meta.era,
      label: meta.label,
      fromFrame: idx === 0 ? 2 : sceneById[meta.id].startFrame,
    })
  );

  const voTimeline: CompositionSceneSegment[] = scenes.map((scene) => ({
    sceneId: scene.id,
    fromFrame: scene.globalVoiceoverStartFrame,
    durationInFrames: Math.min(
      totalDurationInFrames - scene.globalVoiceoverStartFrame,
      scene.voiceoverDurationFrames + 12
    ),
    label: scene.title,
  }));

  const clampSfx = (fromFrame: number, desiredFrames: number) =>
    Math.max(12, Math.min(desiredFrames, totalDurationInFrames - fromFrame));

  const sfxTimeline: Array<ProductionSfxCue & { durationInFrames: number }> = [
    {
      sfxId: 'page-turn-chime',
      fromFrame: sceneById['opener-en'].startFrame + 14,
      durationInFrames: clampSfx(sceneById['opener-en'].startFrame + 14, 68),
      label: 'Editorial Opener Page Turn',
      volume: 0.2,
    },
    {
      sfxId: 'panorama-glide-whoosh',
      fromFrame: sceneById['panorama-en'].startFrame + 24,
      durationInFrames: clampSfx(sceneById['panorama-en'].startFrame + 24, 80),
      label: 'Rail Evolution Panorama Glide',
      volume: 0.18,
    },
    {
      sfxId: 'pin-click-soft',
      fromFrame: sceneById['anatomy-en'].startFrame + 56,
      durationInFrames: clampSfx(sceneById['anatomy-en'].startFrame + 56, 50),
      label: 'Anatomy Callout Pin Click',
      volume: 0.2,
    },
    {
      sfxId: 'bar-race-lift',
      fromFrame: sceneById['speed-en'].startFrame + 120,
      durationInFrames: clampSfx(sceneById['speed-en'].startFrame + 120, 86),
      label: 'Speed Chart Overtake Lift',
      volume: 0.22,
    },
  ];

  const cameraTimeline: ProductionCameraCut[] = scenes.map((scene, idx) => {
    const nextStart =
      idx < scenes.length - 1
        ? scenes[idx + 1]!.startFrame
        : totalDurationInFrames;
    return {
      shotLabel: scene.title,
      fromFrame: scene.startFrame,
      durationInFrames: Math.max(60, nextStart - scene.startFrame),
    };
  });

  return {
    fps,
    crossDissolveFrames: overlap,
    scenes,
    sceneById,
    totalDurationInFrames,
    milestones,
    voTimeline,
    sfxTimeline,
    cameraTimeline,
  };
}

export const DEFAULT_STARTER_STORY_TIMING = resolveStarterStoryTiming(
  VOICEOVER_MANIFEST,
  STARTER_STORY_FPS
);

export const STARTER_STORY_DURATION_FRAMES =
  DEFAULT_STARTER_STORY_TIMING.totalDurationInFrames;

// ============================================================================
// Act 2 — Editorial Panorama Plates (`EditorialPanoramaTrack`)
// ============================================================================
export const PANORAMA_PLATES: ReadonlyArray<EditorialPanoramaItem> = [
  {
    id: 'plate-steam-era',
    src: 'examples/starter-story/images/plate-steam-era.png',
    title: 'Steam & Thunder',
    sentence: 'Iron pistons shook every carriage along jointed track.',
    sourceTag: '1938 • STEAM ERA',
    mountType: 'photo-corners',
  },
  {
    id: 'plate-1964-shinkansen',
    src: 'examples/starter-story/images/plate-1964-shinkansen.png',
    title: 'The 1964 Breakthrough',
    sentence: 'Japan launched sleek electric trains past Mount Fuji.',
    sourceTag: '1964 • TOKAIDO LINE',
    mountType: 'archival-tape',
  },
  {
    id: 'plate-kingfisher-nose',
    src: 'examples/starter-story/images/plate-kingfisher-nose.png',
    title: 'A Bird’s Quiet Beak',
    sentence: 'Kingfishers dive cleanly into rivers without a splash.',
    sourceTag: 'NATURE • AERODYNAMICS',
    mountType: 'photo-corners',
  },
  {
    id: 'plate-teacup-window',
    src: 'examples/starter-story/images/plate-teacup-window.png',
    title: 'Calm at Full Speed',
    sentence: 'Countryside blurs past while warm green tea stays still.',
    sourceTag: 'TODAY • QUIET CABIN',
    mountType: 'archival-tape',
  },
];

// ============================================================================
// Act 3 — Sculpted Bullet Train Anatomy (`PinnedMediaStage`, Δx = 0.00 px)
// Exact pixel dimensions & reticle-verified landmark centers from plate-bullet-profile.png (#124)
// ============================================================================
export const ANATOMY_IMAGE_META = {
  src: 'examples/starter-story/images/plate-bullet-profile.png',
  sourceWidth: 1264,
  sourceHeight: 848,
} as const;

export const ANATOMY_PINS: ReadonlyArray<MediaPinSpec> = [
  {
    id: 'suspension',
    cx: 292,
    cy: 486,
    label: 'Active dampers • gentle curve tilt',
    placement: 'bottom',
    ringRadiusPx: 22,
    startFrame: 46,
    accentColor: '#1E4E79',
  },
  {
    id: 'cabin',
    cx: 595,
    cy: 405,
    label: 'Welded rails • calm tea tray',
    placement: 'top',
    ringRadiusPx: 22,
    startFrame: 88,
    accentColor: '#2E6F5E',
  },
  {
    id: 'nose',
    cx: 1060,
    cy: 416,
    label: 'Kingfisher nose • quiet air',
    placement: 'bottom',
    ringRadiusPx: 24,
    startFrame: 130,
    accentColor: '#C25934',
  },
];

// ============================================================================
// Act 4 — Six Decades of Commercial Rail Speed (`AnimatedBarRace`)
// ============================================================================
export type RailSpeedTrainId = 'fuxing' | 'shinkansen' | 'frecciarossa' | 'steam';

export interface RailSpeedEraSnapshot {
  eraLabel: '1964' | '1995' | 'Today';
  /** Normalized progress (`0..1`) within the `speed-en` active animation window. */
  progress: number;
  values: Record<RailSpeedTrainId, number>;
}

export const RAIL_SPEED_KEYFRAMES: ReadonlyArray<RailSpeedEraSnapshot> = [
  {
    eraLabel: '1964',
    progress: 0.0,
    values: {
      shinkansen: 210,
      steam: 160,
      frecciarossa: 140,
      fuxing: 100,
    },
  },
  {
    eraLabel: '1995',
    progress: 0.48,
    values: {
      shinkansen: 270,
      frecciarossa: 250,
      fuxing: 170,
      steam: 160,
    },
  },
  {
    eraLabel: 'Today',
    progress: 1.0,
    values: {
      fuxing: 350,
      shinkansen: 320,
      frecciarossa: 300,
      steam: 160,
    },
  },
] as const;

const RAIL_SPEED_META: ReadonlyArray<{
  id: RailSpeedTrainId;
  label: string;
  badge: string;
  color: string;
}> = [
  { id: 'fuxing', label: 'Fuxing Express', badge: 'CN', color: '#C25934' },
  { id: 'shinkansen', label: 'Shinkansen E5', badge: 'JP', color: '#1E4E79' },
  { id: 'frecciarossa', label: 'Frecciarossa', badge: 'IT', color: '#9E3328' },
  { id: 'steam', label: 'Classic Steam', badge: '1938', color: '#6E6459' },
];

/**
 * Builds `BarRaceItem[]` with exact frame-aligned keyframes spanning the active window
 * of `speed-en`, enabling smooth rank overtaking (`1964` Shinkansen 210 -> `Today` Fuxing 350).
 */
export function buildRailSpeedBarRaceItems(
  sceneDurationFrames: number = DEFAULT_STARTER_STORY_TIMING.sceneById['speed-en'].durationInFrames,
  raceStartFrame = 36
): BarRaceItem[] {
  const raceEndFrame = Math.max(raceStartFrame + 180, sceneDurationFrames - 210);
  const span = raceEndFrame - raceStartFrame;

  return RAIL_SPEED_META.map((train) => {
    const keyframes: BarRaceKeyframe[] = RAIL_SPEED_KEYFRAMES.map((snap) => ({
      frame: Math.round(raceStartFrame + snap.progress * span),
      value: snap.values[train.id],
    }));

    return {
      id: train.id,
      label: train.label,
      badge: train.badge,
      color: train.color,
      value: keyframes[keyframes.length - 1]!.value,
      keyframes,
    };
  });
}

export const RAIL_SPEED_ITEMS: ReadonlyArray<BarRaceItem> =
  buildRailSpeedBarRaceItems();

/**
 * Returns the active historical era badge (`'1964' | '1995' | 'Today'`) for a local frame in `speed-en`.
 * Flips to `'Today'` only at `progress >= 0.86`, AFTER Fuxing Express has mathematically overtaken
 * Shinkansen E5 into `#1` (`progress ≈ 0.83` under cubic inOut easing).
 */
export function resolveRailSpeedEraAtLocalFrame(
  localFrame: number,
  sceneDurationFrames: number = DEFAULT_STARTER_STORY_TIMING.sceneById['speed-en'].durationInFrames,
  raceStartFrame = 36
): '1964' | '1995' | 'Today' {
  const raceEndFrame = Math.max(raceStartFrame + 180, sceneDurationFrames - 210);
  const span = Math.max(1, raceEndFrame - raceStartFrame);
  const progress = (localFrame - raceStartFrame) / span;
  if (progress >= 0.86) return 'Today';
  if (progress >= 0.3) return '1995';
  return '1964';
}

// ============================================================================
// Act 5 — Four Quiet Secrets (`HorizontalFeatureGrid2x2`)
// ============================================================================
export const QUIET_SECRETS_ITEMS: ReadonlyArray<HorizontalFeatureItem> = [
  {
    id: 'sculpted-nose',
    title: 'Sculpted Nose',
    sentence: 'Parts tunnel air smoothly without a loud pressure boom.',
    accentColor: '#C25934',
  },
  {
    id: 'welded-steel',
    title: 'Welded Steel',
    sentence: 'Seamless continuous rails erase the rhythmic track clatter.',
    accentColor: '#1E4E79',
  },
  {
    id: 'active-tilt',
    title: 'Active Tilt',
    sentence: 'Hydraulic cushions lean gently into every valley bend.',
    accentColor: '#2E6F5E',
  },
  {
    id: 'still-teacup',
    title: 'Still Teacup',
    sentence: 'Blistering speed feels like sitting in a sunlit library.',
    accentColor: '#B37A2A',
  },
];
