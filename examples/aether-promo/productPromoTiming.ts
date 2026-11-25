import {
  computeSceneTimingFromVoiceover,
  type CompositionSceneSegment,
  type ProductionCameraCut,
  type ProductionSfxCue,
  type SceneVoiceoverData,
} from '@make-pictures/remotion';
import type { PaperTimelineMilestone } from '@make-pictures/remotion/kits/editorial-collage';
import {
  portLeft,
  portRight,
  type NodeBox,
  type Point2D,
} from '@make-pictures/remotion/kits/motion-diagrams-2d';
import type { HorizontalFeatureItem } from '@make-pictures/remotion/kits/vector-scene-2d';
import { VOICEOVER_MANIFEST } from './generated/audio-manifest';

export const PROMO_FPS = 60 as const;
export const PROMO_CROSS_DISSOLVE_FRAMES = 48 as const;

export const PROMO_SCENE_ORDER = [
  'tap-en',
  'flow-en',
  'live-sync-en',
  'doorstep-en',
] as const;

export type PromoSceneId = (typeof PROMO_SCENE_ORDER)[number];

export interface PromoSceneMeta {
  id: PromoSceneId;
  actNumber: number;
  era: string;
  label: string;
  title: string;
  defaultVoSeconds: number;
}

export const PROMO_SCENE_META: ReadonlyArray<PromoSceneMeta> = [
  {
    id: 'tap-en',
    actNumber: 1,
    era: '01',
    label: 'One Tap',
    title: 'Act 1 — One Tap Order',
    defaultVoSeconds: 4.9,
  },
  {
    id: 'flow-en',
    actNumber: 2,
    era: '02',
    label: 'Choreography',
    title: 'Act 2 — Four-Step Choreography',
    defaultVoSeconds: 7.2,
  },
  {
    id: 'live-sync-en',
    actNumber: 3,
    era: '03',
    label: 'Live Sync',
    title: 'Act 3 — Live Sync Tracker',
    defaultVoSeconds: 7.2,
  },
  {
    id: 'doorstep-en',
    actNumber: 4,
    era: '04',
    label: 'Doorstep',
    title: 'Act 4 — Warm Morning Finale',
    defaultVoSeconds: 6.4,
  },
] as const;

export interface PromoSceneTimingEntry {
  id: PromoSceneId;
  actNumber: number;
  title: string;
  label: string;
  /** Global start frame inside `<ContinuousSceneFlow crossDissolveFrames={48} />`. */
  startFrame: number;
  /** Local duration in frames of this act (`>= 270`). */
  durationInFrames: number;
  /** Global end frame (`startFrame + durationInFrames`). */
  endFrame: number;
  /** Local pre-speech settle frames before voiceover starts (`>= 42`). */
  preSpeechFrames: number;
  /** Local voiceover duration in frames. */
  voiceoverDurationFrames: number;
  /** Local post-speech hold frames after voiceover finishes. */
  postSpeechFrames: number;
  /** Global frame when this act's voiceover starts. */
  globalVoiceoverStartFrame: number;
  /** Effective post-speech breathing frames before next act dissolves in (`>= 90` non-final, `>= 138` final). */
  effectivePostHoldFrames: number;
}

export interface ProductPromoTimingPlan {
  fps: number;
  crossDissolveFrames: number;
  scenes: ReadonlyArray<PromoSceneTimingEntry>;
  sceneById: Record<PromoSceneId, PromoSceneTimingEntry>;
  /** Exact `ContinuousSceneFlow` total duration (`sum(durations) - 3 * 48`). */
  totalDurationInFrames: number;
  milestones: ReadonlyArray<PaperTimelineMilestone>;
  voTimeline: ReadonlyArray<CompositionSceneSegment>;
  sfxTimeline: ReadonlyArray<ProductionSfxCue & { durationInFrames: number }>;
  cameraTimeline: ReadonlyArray<ProductionCameraCut>;
}

/**
 * Pure deterministic timing resolver for `ProductPromo` ("One Tap to Your Door").
 * Guarantees every act holds `>= 270f`, `pre >= 42f`, `effectivePost >= 90f` (`>= 138f` on closing act)
 * even after subtracting `3 * 48` cross-dissolve overlap frames!
 */
export function resolveProductPromoTiming(
  manifest: Record<string, SceneVoiceoverData> = VOICEOVER_MANIFEST,
  fps: number = PROMO_FPS
): ProductPromoTimingPlan {
  const overlap = PROMO_CROSS_DISSOLVE_FRAMES;
  const nonFinalPostHoldSeconds = 1.55 + overlap / fps; // 2.35 s -> 141 f -> 93 f effective post-hold
  const finalPostHoldSeconds = 2.35; // 141 f >= 138 f warm closing hold

  const scenes: PromoSceneTimingEntry[] = [];
  let cursor = 0;

  PROMO_SCENE_META.forEach((meta, idx) => {
    const isFinal = idx === PROMO_SCENE_META.length - 1;
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
  ) as Record<PromoSceneId, PromoSceneTimingEntry>;

  const milestones: PaperTimelineMilestone[] = PROMO_SCENE_META.map(
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

  const tapFrom = sceneById['tap-en'].startFrame + 36;
  const flowFrom = sceneById['flow-en'].startFrame + 48;
  const bikeFrom = sceneById['live-sync-en'].startFrame + 96;
  const doorFrom = sceneById['doorstep-en'].startFrame + 24;

  const sfxTimeline: Array<ProductionSfxCue & { durationInFrames: number }> = [
    {
      sfxId: 'phone-tap-confirm',
      fromFrame: tapFrom,
      durationInFrames: clampSfx(tapFrom, 50), // 0.7 s (42 f) + 8 f cushion
      label: 'Phone Tap Order Confirm',
      volume: 0.21,
    },
    {
      sfxId: 'flow-hop-whoosh',
      fromFrame: flowFrom,
      durationInFrames: clampSfx(flowFrom, 68), // 1.0 s (60 f) + 8 f cushion
      label: 'Parcel Flow Glide',
      volume: 0.18,
    },
    {
      sfxId: 'bike-bell-ring',
      fromFrame: bikeFrom,
      durationInFrames: clampSfx(bikeFrom, 62), // 0.9 s (54 f) + 8 f cushion
      label: 'Sunny Street Bicycle Bell',
      volume: 0.2,
    },
    {
      sfxId: 'doorbell-warm-chime',
      fromFrame: doorFrom,
      durationInFrames: clampSfx(doorFrom, 80), // 1.2 s (72 f) + 8 f cushion
      label: 'Warm Morning Doorstep Chime',
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

export const DEFAULT_PRODUCT_PROMO_TIMING = resolveProductPromoTiming(
  VOICEOVER_MANIFEST,
  PROMO_FPS
);

export const PRODUCT_PROMO_DURATION_FRAMES =
  DEFAULT_PRODUCT_PROMO_TIMING.totalDurationInFrames;

// ============================================================================
// Act 2 — Four-Step Choreography (`FLOW_WORLD_NODES` + `FLOW_EDGES`)
// Single source of truth on 1920x1080 with >= 28px pairwise AABB clearance!
// ============================================================================
export type FlowNodeId = 'phone' | 'bakery' | 'courier' | 'doorstep';

export const FLOW_WORLD_NODES: Record<FlowNodeId, NodeBox> = {
  phone: { cx: 260, cy: 590, w: 340, h: 176 },
  bakery: { cx: 720, cy: 470, w: 340, h: 176 },
  courier: { cx: 1200, cy: 590, w: 340, h: 176 },
  doorstep: { cx: 1660, cy: 470, w: 340, h: 176 },
};

export interface FlowNodeCopy {
  id: FlowNodeId;
  stepTag: string;
  title: string;
  sentence: string;
  accentColor: string;
}

export const FLOW_NODE_COPY: ReadonlyArray<FlowNodeCopy> = [
  {
    id: 'phone',
    stepTag: '01 • YOUR PHONE',
    title: 'One-Tap Basket',
    sentence: 'Warm pastries picked in a single thumb tap.',
    accentColor: '#EA580C',
  },
  {
    id: 'bakery',
    stepTag: '02 • CORNER BAKERY',
    title: 'Fresh From Oven',
    sentence: 'Bakers pack your box while the glaze shines.',
    accentColor: '#D97706',
  },
  {
    id: 'courier',
    stepTag: '03 • NEAREST RIDER',
    title: 'Sunlit Bike Route',
    sentence: 'Closest cyclist glides down the quiet avenue.',
    accentColor: '#0D9488',
  },
  {
    id: 'doorstep',
    stepTag: '04 • YOUR DOOR',
    title: 'Warm Arrival',
    sentence: 'Fresh morning breakfast lands right on cue.',
    accentColor: '#2563EB',
  },
];

export interface FlowEdgeSpec {
  id: string;
  fromNodeId: FlowNodeId;
  toNodeId: FlowNodeId;
  from: Point2D;
  to: Point2D;
  curveOffsetY: number;
  label: string;
  labelT: number;
  labelOffsetX: number;
  labelOffsetY: number;
  color: string;
  secondaryColor: string;
  drawStartFrame: number;
}

export const FLOW_EDGES: ReadonlyArray<FlowEdgeSpec> = [
  {
    id: 'edge-phone-bakery',
    fromNodeId: 'phone',
    toNodeId: 'bakery',
    from: portRight(FLOW_WORLD_NODES.phone),
    to: portLeft(FLOW_WORLD_NODES.bakery),
    curveOffsetY: -135,
    label: 'Order sent',
    labelT: 0.5,
    labelOffsetX: 0,
    labelOffsetY: -98,
    color: '#EA580C',
    secondaryColor: '#D97706',
    drawStartFrame: 32,
  },
  {
    id: 'edge-bakery-courier',
    fromNodeId: 'bakery',
    toNodeId: 'courier',
    from: portRight(FLOW_WORLD_NODES.bakery),
    to: portLeft(FLOW_WORLD_NODES.courier),
    curveOffsetY: 135,
    label: 'Packed warm',
    labelT: 0.5,
    labelOffsetX: 0,
    labelOffsetY: 100,
    color: '#D97706',
    secondaryColor: '#0D9488',
    drawStartFrame: 76,
  },
  {
    id: 'edge-courier-doorstep',
    fromNodeId: 'courier',
    toNodeId: 'doorstep',
    from: portRight(FLOW_WORLD_NODES.courier),
    to: portLeft(FLOW_WORLD_NODES.doorstep),
    curveOffsetY: -135,
    label: '2 blocks away',
    labelT: 0.5,
    labelOffsetX: 0,
    labelOffsetY: -98,
    color: '#0D9488',
    secondaryColor: '#2563EB',
    drawStartFrame: 120,
  },
];

// ============================================================================
// Act 3 — Live Sync Dispatch Route (Normalized 0..1 Single Source of Truth)
// Exact 27-point medial-axis road + cream park trail centerline on neighborhood-map.png (1376x768, #158)
// 0 grass hits, 0 building hits across 1,155 verified pixels!
// ============================================================================
export const DISPATCH_MAP_ASPECT = { width: 1376, height: 768 } as const;

export const DISPATCH_ROUTE_WAYPOINTS: ReadonlyArray<Point2D> = [
  { x: 0.2028, y: 0.8021 }, // Bakery east curb
  { x: 0.2028, y: 0.7474 },
  { x: 0.2028, y: 0.694 },
  { x: 0.2158, y: 0.6641 }, // SW park entrance
  { x: 0.237, y: 0.6313 },
  { x: 0.2584, y: 0.5982 },
  { x: 0.2841, y: 0.5782 },
  { x: 0.312, y: 0.5741 },
  { x: 0.3393, y: 0.5871 },
  { x: 0.367, y: 0.5964 },
  { x: 0.3937, y: 0.5846 },
  { x: 0.4103, y: 0.5447 },
  { x: 0.4218, y: 0.4999 },
  { x: 0.4325, y: 0.4542 },
  { x: 0.4596, y: 0.4427 },
  { x: 0.4877, y: 0.4393 },
  { x: 0.514, y: 0.4217 },
  { x: 0.5342, y: 0.3866 },
  { x: 0.5538, y: 0.3503 },
  { x: 0.5734, y: 0.3151 }, // NE park exit
  { x: 0.5843, y: 0.2956 }, // Sunlit north-park avenue
  { x: 0.6359, y: 0.2956 },
  { x: 0.6904, y: 0.2956 },
  { x: 0.7449, y: 0.2956 },
  { x: 0.7929, y: 0.2956 }, // Turn north onto doorstep avenue
  { x: 0.7929, y: 0.2396 },
  { x: 0.7929, y: 0.1849 }, // Doorstep west curb
] as const;

// Backwards-compatible summary endpoints & park midpoints
export const DISPATCH_ROUTE_POINTS: {
  p0: Point2D;
  p1: Point2D;
  p2: Point2D;
  p3: Point2D;
} = {
  p0: DISPATCH_ROUTE_WAYPOINTS[0]!,
  p1: DISPATCH_ROUTE_WAYPOINTS[8]!,
  p2: DISPATCH_ROUTE_WAYPOINTS[19]!,
  p3: DISPATCH_ROUTE_WAYPOINTS[DISPATCH_ROUTE_WAYPOINTS.length - 1]!,
};

// Precomputed cumulative pixel arc-lengths in 1376x768 space for constant physical bicycle speed
const DISPATCH_CUMULATIVE_LENGTHS: ReadonlyArray<number> = (() => {
  const cum: number[] = [0];
  let total = 0;
  for (let i = 1; i < DISPATCH_ROUTE_WAYPOINTS.length; i++) {
    const a = DISPATCH_ROUTE_WAYPOINTS[i - 1]!;
    const b = DISPATCH_ROUTE_WAYPOINTS[i]!;
    total += Math.hypot(
      (b.x - a.x) * DISPATCH_MAP_ASPECT.width,
      (b.y - a.y) * DISPATCH_MAP_ASPECT.height
    );
    cum.push(total);
  }
  return cum;
})();

const DISPATCH_TOTAL_ARC_LENGTH =
  DISPATCH_CUMULATIVE_LENGTHS[DISPATCH_CUMULATIVE_LENGTHS.length - 1] || 1;

/**
 * Evaluates the exact arc-length parameterized bicycle position (`0..1` normalized map coordinates)
 * staying 100% dead-center on the white avenues and winding cream park trail.
 */
export function evaluateDispatchRouteAtProgress(progress01: number): Point2D {
  const p = Math.max(0, Math.min(1, progress01));
  if (p <= 0) return { ...DISPATCH_ROUTE_WAYPOINTS[0]! };
  if (p >= 1) {
    return {
      ...DISPATCH_ROUTE_WAYPOINTS[DISPATCH_ROUTE_WAYPOINTS.length - 1]!,
    };
  }

  const targetDist = p * DISPATCH_TOTAL_ARC_LENGTH;
  for (let i = 1; i < DISPATCH_CUMULATIVE_LENGTHS.length; i++) {
    const d0 = DISPATCH_CUMULATIVE_LENGTHS[i - 1]!;
    const d1 = DISPATCH_CUMULATIVE_LENGTHS[i]!;
    if (targetDist <= d1 || i === DISPATCH_CUMULATIVE_LENGTHS.length - 1) {
      const segLen = Math.max(1e-6, d1 - d0);
      const t = Math.max(0, Math.min(1, (targetDist - d0) / segLen));
      const a = DISPATCH_ROUTE_WAYPOINTS[i - 1]!;
      const b = DISPATCH_ROUTE_WAYPOINTS[i]!;
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      };
    }
  }
  return { ...DISPATCH_ROUTE_WAYPOINTS[DISPATCH_ROUTE_WAYPOINTS.length - 1]! };
}

/**
 * Evaluates smooth screen-space heading angle (degrees, 0 = east, -90 = north) along the road/park centerline.
 */
export function evaluateDispatchRouteHeadingDeg(progress01: number): number {
  const p = Math.max(0, Math.min(1, progress01));
  const eps = 0.015;
  const a = evaluateDispatchRouteAtProgress(Math.max(0, p - eps));
  const b = evaluateDispatchRouteAtProgress(Math.min(1, p + eps));
  const dx = (b.x - a.x) * DISPATCH_MAP_ASPECT.width;
  const dy = (b.y - a.y) * DISPATCH_MAP_ASPECT.height;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

export const DISPATCH_BAKERY_BADGE_POS: Point2D = { x: 0.1432, y: 0.8021 };
export const DISPATCH_DOOR_BADGE_POS: Point2D = { x: 0.8728, y: 0.1849 };

/**
 * Builds the exact single-source-of-truth SVG `<path d="...">` string in `(width x height)` coordinates
 * from `0` up to `progress01` (default `1` for full track), matching `evaluateDispatchRouteAtProgress` with 0 px error!
 */
export function buildDispatchRouteSvgPath(
  width: number,
  height: number,
  progress01 = 1
): string {
  const p = Math.max(0, Math.min(1, progress01));
  const first = DISPATCH_ROUTE_WAYPOINTS[0]!;
  if (p <= 0) {
    return `M ${(first.x * width).toFixed(2)} ${(first.y * height).toFixed(2)}`;
  }

  const targetDist = p * DISPATCH_TOTAL_ARC_LENGTH;
  const parts: string[] = [
    `M ${(first.x * width).toFixed(2)} ${(first.y * height).toFixed(2)}`,
  ];

  for (let i = 1; i < DISPATCH_ROUTE_WAYPOINTS.length; i++) {
    const d0 = DISPATCH_CUMULATIVE_LENGTHS[i - 1]!;
    const d1 = DISPATCH_CUMULATIVE_LENGTHS[i]!;
    const a = DISPATCH_ROUTE_WAYPOINTS[i - 1]!;
    const b = DISPATCH_ROUTE_WAYPOINTS[i]!;

    if (d1 < targetDist - 1e-4) {
      parts.push(`L ${(b.x * width).toFixed(2)} ${(b.y * height).toFixed(2)}`);
    } else {
      const segLen = Math.max(1e-6, d1 - d0);
      const t = Math.max(0, Math.min(1, (targetDist - d0) / segLen));
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      parts.push(`L ${(x * width).toFixed(2)} ${(y * height).toFixed(2)}`);
      break;
    }
  }

  return parts.join(' ');
}

/**
 * Exact prefix SVG `<path d="...">` from `0` to `evaluateDispatchRouteAtProgress(t)` so the drawn coral
 * route stops dead-center under the animated bike pin at every single frame (`Δ = 0.00 px`).
 */
export function buildDispatchRoutePrefixSvgPath(
  width: number,
  height: number,
  t: number
): string {
  return buildDispatchRouteSvgPath(width, height, t);
}

export interface DispatchLiveStatus {
  etaLabel: string;
  stageLabel: string;
  stepIndex: 0 | 1 | 2;
}

export function resolveDispatchEtaStatus(progress01: number): DispatchLiveStatus {
  const p = Math.max(0, Math.min(1, progress01));
  if (p >= 0.94) {
    return {
      etaLabel: 'At your door!',
      stageLabel: 'Warm bag delivered',
      stepIndex: 2,
    };
  }
  if (p >= 0.52) {
    return {
      etaLabel: '4 min',
      stageLabel: '2 blocks away on Maple Ave',
      stepIndex: 1,
    };
  }
  return {
    etaLabel: '12 min',
    stageLabel: 'Fresh from the corner bakery',
    stepIndex: 0,
  };
}

// ============================================================================
// Act 4 — Warm Morning Finale (`HorizontalFeatureGrid2x2` + Illustrated Editorial Cards)
// ============================================================================
export interface DoorstepHighlightCard extends HorizontalFeatureItem {
  /** Full-bleed 4:3 gouache artwork (`1200x900`) relative to `public/`. */
  imageSrc: string;
}

export const DOORSTEP_HIGHLIGHT_CARDS: ReadonlyArray<DoorstepHighlightCard> = [
  {
    id: 'instant-handoff',
    title: 'Instant Handoff',
    sentence: 'The kitchen sees your basket the moment you tap.',
    accentColor: '#EA580C',
    imageSrc: 'examples/aether-promo/images/card-instant-handoff.png',
  },
  {
    id: 'live-street-view',
    title: 'Live Street View',
    sentence: 'Follow your rider block by block with zero guesswork.',
    accentColor: '#0D9488',
    imageSrc: 'examples/aether-promo/images/card-live-street-view.png',
  },
  {
    id: 'always-warm',
    title: 'Always Warm',
    sentence: 'Smart timing pairs fresh ovens with nearby bikes.',
    accentColor: '#D97706',
    imageSrc: 'examples/aether-promo/images/card-always-warm.png',
  },
  {
    id: 'happy-mornings',
    title: 'Happy Mornings',
    sentence: 'Less waiting by the window, more coffee at the table.',
    accentColor: '#2563EB',
    imageSrc: 'examples/aether-promo/images/card-happy-mornings.png',
  },
];

export const DOORSTEP_HIGHLIGHTS: ReadonlyArray<DoorstepHighlightCard> =
  DOORSTEP_HIGHLIGHT_CARDS;
