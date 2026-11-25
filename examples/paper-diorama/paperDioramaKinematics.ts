import * as THREE from 'three';
import {
  createSeededRandom,
  evaluateAnticipation,
  evaluateArc3D,
  evaluateVelocityStretch,
  type CompositionSceneSegment,
  type OrientedBox3D,
  type ProductionCameraCut,
  type ProductionSfxCue,
  type Vec3,
} from '@make-pictures/remotion';
import type { PaperTimelineMilestone } from '@make-pictures/remotion/kits/editorial-collage';

export const PAPER_DIORAMA_FPS = 60 as const;
export const PAPER_DIORAMA_DURATION_FRAMES = 1110 as const; // 18.5 s @ 60 FPS (crisp Keplerian slingshot finale!)
export const PAPER_DIORAMA_MAX_ALTITUDE_Y = 54 as const;

export const PAPER_DIORAMA_MILESTONES: ReadonlyArray<PaperTimelineMilestone> = [
  { id: 'launch', era: '0 km', label: 'Launch', fromFrame: 2 },
  { id: 'birds', era: '3 km', label: 'Birds', fromFrame: 175 },
  { id: 'stratosphere', era: '12 km', label: 'Stratosphere', fromFrame: 340 },
  { id: 'satellites', era: '250 km', label: 'Satellites', fromFrame: 520 },
  { id: 'space', era: '384k km', label: 'Outer Space', fromFrame: 645 },
] as const;

export const PAPER_DIORAMA_VO_TIMELINE: ReadonlyArray<CompositionSceneSegment> = [
  {
    sceneId: 'launch-en',
    fromFrame: 18,
    durationInFrames: 242, // 3.95 s (237 f) + 5 f unclipped tail cushion -> ends f=260
    label: '0 km • Launchpad Liftoff',
  },
  {
    sceneId: 'birds-en',
    fromFrame: 264,
    durationInFrames: 230, // 3.75 s (225 f) + 5 f unclipped tail cushion -> ends f=494
    label: '3 km • Birds & Clouds',
  },
  {
    sceneId: 'stratosphere-en',
    fromFrame: 500,
    durationInFrames: 246, // 4.02 s (241 f) + 5 f unclipped tail cushion -> ends f=746
    label: '12 km • Stratosphere Airliner',
  },
  {
    sceneId: 'space-en',
    fromFrame: 765,
    durationInFrames: 304, // 4.96 s (298 f) + 6 f unclipped tail cushion -> ends f=1069 (41 f outro fade)
    label: 'Outer Space • Keplerian Slingshot & Coin Flip',
  },
] as const;

export const PAPER_DIORAMA_SFX_TIMELINE: ReadonlyArray<
  ProductionSfxCue & { durationInFrames: number }
> = [
  {
    sfxId: 'rocket-ignition-whoosh',
    fromFrame: 48,
    durationInFrames: 105, // 1.66 s (100 f) + 5 f cushion -> exact liftoff ignition
    label: 'Rocket Ignition & Liftoff',
    volume: 0.24,
  },
  {
    sfxId: 'birds-cloud-flutter',
    fromFrame: 205,
    durationInFrames: 74, // 1.14 s (69 f) + 5 f cushion -> exact soaring birds pass
    label: 'Paper Birds & Cloud Flutter',
    volume: 0.19,
  },
  {
    sfxId: 'jetliner-pass-whoosh',
    fromFrame: 385,
    durationInFrames: 86, // 1.34 s (81 f) + 5 f cushion -> exact stratosphere airliner pass
    label: 'Stratosphere Airliner Pass',
    volume: 0.22,
  },
  {
    sfxId: 'satellite-orbital-ping',
    fromFrame: 575,
    durationInFrames: 69, // 1.06 s (64 f) + 5 f cushion -> exact orbital satellite pass
    label: 'Orbital Satellite Ping',
    volume: 0.18,
  },
  {
    sfxId: 'space-starlight-chime',
    fromFrame: 882,
    durationInFrames: 122, // 1.94 s (117 f) + 5 f cushion -> exact COIN_FLICK_FRAME = 882 Moon whip & coin flip!
    label: 'Gravity Slingshot Whip & Moon Coin-Flip Chime',
    volume: 0.24,
  },
] as const;

export const PAPER_DIORAMA_CAMERA_TIMELINE: ReadonlyArray<ProductionCameraCut> = [
  { shotLabel: '0 km • Sunlit Meadow Launch', fromFrame: 0, durationInFrames: 175 },
  { shotLabel: '3 km • Clouds & 5 Soaring Birds', fromFrame: 175, durationInFrames: 165 },
  { shotLabel: '12 km • Stratosphere Airliner', fromFrame: 340, durationInFrames: 180 },
  { shotLabel: '250 km • Earth Horizon & Satellites', fromFrame: 520, durationInFrames: 125 },
  { shotLabel: 'Outer Space • Keplerian Slingshot & Moon Flip', fromFrame: 645, durationInFrames: 465 },
] as const;

export type PaperDioramaChapterId =
  | 'launch'
  | 'birds'
  | 'stratosphere'
  | 'satellites'
  | 'space';

export interface SkyAtmosphereState {
  altitude01: number;
  skyTopColor: string;
  skyBottomColor: string;
  skyLuminance: number;
  overlayTone: 'dark-on-light' | 'light-on-dark';
  timeOfDay: number;
  ambientIntensity: number;
  starOpacity: number;
  earthGlowOpacity: number;
}

export interface PaperDioramaActorState {
  id: string;
  position: Vec3;
  rotX?: number;
  rotZ: number;
  rotY: number;
  scale: Vec3;
  width: number;
  height: number;
  thickness: number;
  opacity: number;
  obb: OrientedBox3D;
}

export interface PaperDioramaMoonCoinState extends PaperDioramaActorState {
  /** Coin-flip Y spin angle: smoothly accelerates from `0` to `3 * Math.PI` (540 deg) revealing the Far Side. */
  coinSpinY: number;
  /** Realistic spinning-coin nutation wobble around X (decays `0.11 -> 0`). */
  coinWobbleX: number;
  /** Realistic spinning-coin nutation wobble around Z (decays `0.16 -> 0`). */
  coinWobbleZ: number;
  /** Crisp `0..1` wake-sparkle burst right as the rocket skims past the Moon's rim (`f ~ 775`). */
  wakePulse: number;
}

export interface PaperDioramaCloudState {
  id: string;
  position: Vec3;
  scale: number;
  width: number;
  height: number;
  opacity: number;
  isForeground: boolean;
  obb: OrientedBox3D;
}

export interface PaperDioramaSmokePuffState {
  id: string;
  position: Vec3;
  scale: number;
  opacity: number;
}

export interface PaperDioramaStarState {
  id: string;
  position: Vec3;
  scale: number;
  twinkle: number;
  color: string;
}

export interface PaperDioramaCameraState {
  position: Vec3;
  lookAt: Vec3;
  fov: number;
  rollDeg: number;
}

export interface LunarSlingshotSample {
  pos: Vec3;
  tangent: Vec3;
  velocity: Vec3;
  rotZ: number;
  speed: number;
}

export interface PaperDioramaFrameState {
  frame: number;
  durationInFrames: number;
  altitudeY: number;
  altitude01: number;
  altitudeKm: number;
  activeChapterId: PaperDioramaChapterId;
  sky: SkyAtmosphereState;
  camera: PaperDioramaCameraState;
  /** Pop-up entrance progress `0..1.05` for meadow hills and brass gantry (`f=2..24`). */
  meadowPopUp: number;
  /** Thruster flame intensity `0..1.45` (bright climb -> surging 1.45 slingshot boost!). */
  thrusterIntensity: number;
  /** Subtle thruster flicker scalar `0.85..1.18`. */
  thrusterPulse: number;
  /** Gentle cosmic shimmer scalar (`0..1`). */
  rcsPulse: number;
  /** Normalized `0..1` progress through the Keplerian gravity-assist slingshot (`f=645..937`). */
  slingshotProgress: number;
  /** Normalized `0..1` rocket speed during slingshot (0 at slow capture hang-time -> 1 at blazing ejection!). */
  slingshotSpeedNormalized: number;
  /** Ultra-dense 181-point silky 3D golden Saturn-ring slingshot comet contrail. */
  slingshotTrailPoints: ReadonlyArray<Vec3>;
  /** Fade opacity (`0..1`) for the shimmering golden contrail during Cosmic Afterglow. */
  slingshotTrailOpacity: number;
  /** Crisp twinkling star-glint inside the upper-right viewport where the slingshot rocket vanishes (`f=922..1026`). */
  departureStarGlint: {
    position: Vec3;
    scale: number;
    opacity: number;
  };
  rocket: PaperDioramaActorState;
  gantry: PaperDioramaActorState;
  launchSmokePuffs: ReadonlyArray<PaperDioramaSmokePuffState>;
  clouds: ReadonlyArray<PaperDioramaCloudState>;
  birds: ReadonlyArray<PaperDioramaActorState>;
  airliner: PaperDioramaActorState & { contrailPoints: ReadonlyArray<Vec3> };
  earthLimb: {
    position: Vec3;
    radius: number;
    opacity: number;
  };
  satellites: ReadonlyArray<PaperDioramaActorState>;
  moon: PaperDioramaMoonCoinState;
  ringedPlanet: {
    position: Vec3;
    scale: number;
    rotZ: number;
    opacity: number;
  };
  stars: ReadonlyArray<PaperDioramaStarState>;
  collisionBodies: OrientedBox3D[];
}

interface SkyStop {
  t: number;
  top: string;
  bottom: string;
  timeOfDay: number;
  ambientIntensity: number;
  starOpacity: number;
}

const SKY_STOPS: ReadonlyArray<SkyStop> = [
  { t: 0.0, top: '#DCEEF9', bottom: '#FCE9CD', timeOfDay: 0.14, ambientIntensity: 0.96, starOpacity: 0 },
  { t: 0.24, top: '#5EAEE6', bottom: '#CBE8FA', timeOfDay: 0.28, ambientIntensity: 0.9, starOpacity: 0 },
  { t: 0.48, top: '#1E55A0', bottom: '#68A3DC', timeOfDay: 0.44, ambientIntensity: 0.78, starOpacity: 0.1 },
  { t: 0.72, top: '#0D1B46', bottom: '#24458E', timeOfDay: 0.66, ambientIntensity: 0.56, starOpacity: 0.72 },
  { t: 0.9, top: '#050918', bottom: '#111E46', timeOfDay: 0.86, ambientIntensity: 0.42, starOpacity: 1.0 },
  { t: 1.0, top: '#050918', bottom: '#111E46', timeOfDay: 0.92, ambientIntensity: 0.38, starOpacity: 1.0 },
];

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

function easeOutBack(rawT: number, overshoot = 1.55): number {
  const t = clamp01(rawT);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c3 = overshoot + 1;
  return Math.min(1.05, 1 + c3 * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2));
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const ch = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${ch(r)}${ch(g)}${ch(b)}`;
}

function lerpHex(aHex: string, bHex: string, t: number): string {
  const a = hexToRgb(aHex);
  const b = hexToRgb(bHex);
  return rgbToHex(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Continuous multi-stop vertical sky & atmosphere evaluator (`0.0` sunlit morning meadow
 * -> `0.24` crisp azure -> `0.48` cobalt stratosphere -> `0.72` twilight indigo -> `1.0` velvet cosmos).
 */
export function evaluateSkyAtmosphere(rawAltitude01: number): SkyAtmosphereState {
  const altitude01 = clamp01(rawAltitude01);
  let idx = 0;
  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    if (altitude01 >= SKY_STOPS[i]!.t) idx = i;
  }
  const a = SKY_STOPS[idx]!;
  const b = SKY_STOPS[Math.min(SKY_STOPS.length - 1, idx + 1)]!;
  const span = Math.max(1e-5, b.t - a.t);
  const localT = smoothstep((altitude01 - a.t) / span);

  const skyTopColor = lerpHex(a.top, b.top, localT);
  const skyBottomColor = lerpHex(a.bottom, b.bottom, localT);
  const skyLuminance = Number(
    (
      relativeLuminance(skyTopColor) * 0.72 +
      relativeLuminance(skyBottomColor) * 0.28
    ).toFixed(4)
  );

  // Keep glowing Earth limb strictly hidden below orbital twilight (`altitude01 < 0.60`)
  const earthGlowOpacity =
    altitude01 < 0.6
      ? 0
      : altitude01 <= 0.76
        ? smoothstep((altitude01 - 0.6) / 0.16)
        : lerp(1.0, 0.45, smoothstep((altitude01 - 0.76) / 0.24));

  return {
    altitude01,
    skyTopColor,
    skyBottomColor,
    skyLuminance,
    overlayTone: altitude01 >= 0.35 ? 'light-on-dark' : 'dark-on-light',
    timeOfDay: lerp(a.timeOfDay, b.timeOfDay, localT),
    ambientIntensity: lerp(a.ambientIntensity, b.ambientIntensity, localT),
    starOpacity: lerp(a.starOpacity, b.starOpacity, localT),
    earthGlowOpacity,
  };
}

/**
 * Strictly monotonic C1-smooth ascent fraction (`0 -> 1`) from liftoff (`f=50`)
 * up to silky lunar flyby entry (`f=650`, `y = 47.4`), ending at steady upward velocity.
 */
function evaluateMonotonicAscent(rawU: number): { frac: number; normSpeed: number } {
  const u = clamp01(rawU);
  const a = 0.08;
  const totalArea = 0.5 * a + (1 - a); // 0.96

  if (u <= 0) return { frac: 0, normSpeed: 0 };
  if (u >= 1) return { frac: 1, normSpeed: 1 };

  if (u < a) {
    const w = u / a;
    const speed = w * w * (3 - 2 * w);
    const area = a * (w * w * w - 0.5 * w * w * w * w);
    return { frac: area / totalArea, normSpeed: speed };
  }
  const area = 0.5 * a + (u - a);
  return { frac: Math.min(1, area / totalArea), normSpeed: 1 };
}

const FLYBY_START_FRAME = 645;
const SATURN_ENTRY_FRAMES = 84; // f = 645..729 (smooth upward climb easing 0.083 -> 0.038 u/f into gravity capture!)
const SATURN_ORBIT_FRAMES = 160; // f = 729..889 (breathless behind-Moon hang-time -> exponential Keplerian whip!)
const SATURN_EXIT_FRAMES = 48; // f = 889..937 (0.80 s blazing tangent slingshot shot off upper-right screen!)
const FLYBY_DURATION_FRAMES =
  SATURN_ENTRY_FRAMES + SATURN_ORBIT_FRAMES + SATURN_EXIT_FRAMES; // 292 frames -> f = 645..937

const COIN_FLICK_FRAME = 882; // Exact blazing front-periapsis whip frame where rocket flicks Moon into 540° coin spin!
const COIN_SPIN_DURATION = 158; // f = 882..1040 (2.63 s crisp spinning-coin flip -> 1.17 s settled Far Side echo!)

// Tilted 3D Saturn-ring gravity well centered on Moon (`[1.85, 54.0, -1.80]`)
const SATURN_MOON_CX = 1.85;
const SATURN_MOON_CY = 54.0;
const SATURN_MOON_CZ = -1.8;
const SATURN_RING_TILT = 0.25; // +14.3° graceful Saturn-ring tilt
const SATURN_COS_TILT = Math.cos(SATURN_RING_TILT);
const SATURN_SIN_TILT = Math.sin(SATURN_RING_TILT);

// Sweeps from right-flank capture (1.92*PI) -> slow hang-time BEHIND Moon (2.50*PI) ->
// inward tightening left rim (3.00*PI) -> blazing front periapsis whip (3.52*PI) -> tangent ejection (3.62*PI)!
const SATURN_THETA_START = 1.92 * Math.PI;
const SATURN_THETA_END = 3.62 * Math.PI;
const SATURN_THETA_SPAN = SATURN_THETA_END - SATURN_THETA_START;

// Keplerian time-warp: slow hang-time at capture behind Moon -> exponential 7.3x angular slingshot surge!
function evaluateKeplerWarp(u: number): { p: number; dpdu: number } {
  const a = 0.4;
  const k = 3.2;
  const b = (1 - a) * (k + 1);
  return {
    p: a * u + (b / (k + 1)) * Math.pow(u, k + 1),
    dpdu: a + b * Math.pow(u, k),
  };
}

// Gravity-well radius tightens smoothly from wide capture (Rx=2.95) -> tight blazing periapsis (Rx=2.42)
function evaluateGravityWellRadii(p: number) {
  const s = p * p * (3 - 2 * p);
  const ds = 6 * p * (1 - p);
  return {
    Rx: 2.95 + (2.42 - 2.95) * s,
    dRx: (2.42 - 2.95) * ds,
    Ry: 1.08 + (0.94 - 1.08) * s,
    dRy: (0.94 - 1.08) * ds,
    Rz: 2.62 + (2.38 - 2.62) * s,
    dRz: (2.38 - 2.62) * ds,
  };
}

function evaluateKeplerOrbitAtU(u: number): { pos: Vec3; vel: Vec3 } {
  const { p, dpdu } = evaluateKeplerWarp(u);
  const theta = SATURN_THETA_START + p * SATURN_THETA_SPAN;
  const dthetaDf = (dpdu * SATURN_THETA_SPAN) / SATURN_ORBIT_FRAMES;
  const dpDf = dpdu / SATURN_ORBIT_FRAMES;

  const { Rx, dRx, Ry, dRy, Rz, dRz } = evaluateGravityWellRadii(p);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  const uLocal = Rx * cos;
  const vLocal = Ry * sin;
  const duLocal = dRx * dpDf * cos - Rx * sin * dthetaDf;
  const dvLocal = dRy * dpDf * sin + Ry * cos * dthetaDf;

  return {
    pos: [
      SATURN_MOON_CX + uLocal * SATURN_COS_TILT - vLocal * SATURN_SIN_TILT,
      SATURN_MOON_CY + uLocal * SATURN_SIN_TILT + vLocal * SATURN_COS_TILT,
      SATURN_MOON_CZ - Rz * sin,
    ],
    vel: [
      duLocal * SATURN_COS_TILT - dvLocal * SATURN_SIN_TILT,
      duLocal * SATURN_SIN_TILT + dvLocal * SATURN_COS_TILT,
      -dRz * dpDf * sin - Rz * cos * dthetaDf,
    ],
  };
}

const SATURN_ENTER_RV = evaluateKeplerOrbitAtU(0);
const SATURN_EXIT_RV = evaluateKeplerOrbitAtU(1);

// C1 Hermite cubic Bézier entry: matches exact climb velocity (`0.0830 u/f`), easing down into slow gravity capture
const SATURN_ENTRY_P0: Vec3 = [3.35, 48.3, -0.35];
const SATURN_ENTRY_P1: Vec3 = [
  SATURN_ENTRY_P0[0],
  SATURN_ENTRY_P0[1] + 0.083 * (SATURN_ENTRY_FRAMES / 3),
  SATURN_ENTRY_P0[2],
];
const SATURN_ENTRY_P2: Vec3 = [
  SATURN_ENTER_RV.pos[0] - SATURN_ENTER_RV.vel[0] * (SATURN_ENTRY_FRAMES / 3),
  SATURN_ENTER_RV.pos[1] - SATURN_ENTER_RV.vel[1] * (SATURN_ENTRY_FRAMES / 3),
  SATURN_ENTER_RV.pos[2] - SATURN_ENTER_RV.vel[2] * (SATURN_ENTRY_FRAMES / 3),
];
const SATURN_ENTRY_P3: Vec3 = SATURN_ENTER_RV.pos;

// C1 Hermite cubic Bézier exit: strictly ACCELERATING blazing tangent slingshot shot (`0.238 -> 0.295 u/f` in 0.80 s!)
const SATURN_EXIT_SPEED = Math.hypot(
  SATURN_EXIT_RV.vel[0],
  SATURN_EXIT_RV.vel[1],
  SATURN_EXIT_RV.vel[2]
);
const SATURN_EXIT_DIR: Vec3 = [
  SATURN_EXIT_RV.vel[0] / SATURN_EXIT_SPEED,
  SATURN_EXIT_RV.vel[1] / SATURN_EXIT_SPEED,
  SATURN_EXIT_RV.vel[2] / SATURN_EXIT_SPEED,
];
const SATURN_TARGET_DIR: Vec3 = [0.76, 0.65, -0.02];
const SATURN_MID_RAW: Vec3 = [
  (SATURN_EXIT_DIR[0] + SATURN_TARGET_DIR[0]) * 0.5,
  (SATURN_EXIT_DIR[1] + SATURN_TARGET_DIR[1]) * 0.5,
  -0.05,
];
const SATURN_MID_LEN = Math.hypot(
  SATURN_MID_RAW[0],
  SATURN_MID_RAW[1],
  SATURN_MID_RAW[2]
);
const SATURN_EXIT_DIST = SATURN_EXIT_SPEED * 1.12 * SATURN_EXIT_FRAMES;
const SATURN_EXIT_END_SPEED = SATURN_EXIT_SPEED * 1.24;

const SATURN_EXIT_P0: Vec3 = SATURN_EXIT_RV.pos;
const SATURN_EXIT_P1: Vec3 = [
  SATURN_EXIT_P0[0] + SATURN_EXIT_RV.vel[0] * (SATURN_EXIT_FRAMES / 3),
  SATURN_EXIT_P0[1] + SATURN_EXIT_RV.vel[1] * (SATURN_EXIT_FRAMES / 3),
  SATURN_EXIT_P0[2] + SATURN_EXIT_RV.vel[2] * (SATURN_EXIT_FRAMES / 3),
];
const SATURN_EXIT_P3: Vec3 = [
  SATURN_EXIT_P0[0] + (SATURN_MID_RAW[0] / SATURN_MID_LEN) * SATURN_EXIT_DIST,
  SATURN_EXIT_P0[1] + (SATURN_MID_RAW[1] / SATURN_MID_LEN) * SATURN_EXIT_DIST,
  -0.75,
];
const SATURN_EXIT_P2: Vec3 = [
  SATURN_EXIT_P3[0] -
    SATURN_TARGET_DIR[0] * SATURN_EXIT_END_SPEED * (SATURN_EXIT_FRAMES / 3),
  SATURN_EXIT_P3[1] -
    SATURN_TARGET_DIR[1] * SATURN_EXIT_END_SPEED * (SATURN_EXIT_FRAMES / 3),
  SATURN_EXIT_P3[2] -
    SATURN_TARGET_DIR[2] * SATURN_EXIT_END_SPEED * (SATURN_EXIT_FRAMES / 3),
];

/**
 * True Keplerian Gravity-Assist Slingshot on the tilted 3D Saturn-ring plane (`f = 645..937`):
 * 1. Breathless Capture (`f=645..729`): rises up the Moon's right flank easing `0.083 -> 0.038 u/f` into hang-time behind Moon.
 * 2. Gravitational Whip (`f=729..889`): sweeps BEHIND Moon (`z = -4.36`), tightens inward around left rim, and accelerates
 *    exponentially (`0.038 -> 0.238 u/f`) across the front periapsis (`z = +0.58`), flicking Moon into a 540° coin-flip at `f=882`.
 * 3. Blazing Tangent Ejection (`f=889..937`): shoots off tangentially like a stone from a slingshot (`0.238 -> 0.295 u/f`,
 *    `7.8x` speed ratio over capture!), streaking off the upper-right screen in 0.80 s without ever slowing down!
 */
export function sampleLunarSlingshot(rawFrameOffset: number): LunarSlingshotSample {
  const df = Math.max(0, Math.min(FLYBY_DURATION_FRAMES, rawFrameOffset));

  let pos: Vec3;
  let velPerFrame: Vec3;

  if (df <= SATURN_ENTRY_FRAMES) {
    const u = clamp01(df / SATURN_ENTRY_FRAMES);
    const arc = evaluateArc3D(
      SATURN_ENTRY_P0,
      SATURN_ENTRY_P1,
      SATURN_ENTRY_P2,
      SATURN_ENTRY_P3,
      u,
      0.03,
      0.2
    );
    pos = arc.position;
    velPerFrame = [
      arc.velocity[0] / SATURN_ENTRY_FRAMES,
      arc.velocity[1] / SATURN_ENTRY_FRAMES,
      arc.velocity[2] / SATURN_ENTRY_FRAMES,
    ];
  } else if (df <= SATURN_ENTRY_FRAMES + SATURN_ORBIT_FRAMES) {
    const u = clamp01((df - SATURN_ENTRY_FRAMES) / SATURN_ORBIT_FRAMES);
    const rv = evaluateKeplerOrbitAtU(u);
    pos = rv.pos;
    velPerFrame = rv.vel;
  } else {
    const u = clamp01(
      (df - SATURN_ENTRY_FRAMES - SATURN_ORBIT_FRAMES) / SATURN_EXIT_FRAMES
    );
    const arc = evaluateArc3D(
      SATURN_EXIT_P0,
      SATURN_EXIT_P1,
      SATURN_EXIT_P2,
      SATURN_EXIT_P3,
      u,
      0.03,
      0.2
    );
    pos = arc.position;
    velPerFrame = [
      arc.velocity[0] / SATURN_EXIT_FRAMES,
      arc.velocity[1] / SATURN_EXIT_FRAMES,
      arc.velocity[2] / SATURN_EXIT_FRAMES,
    ];
  }

  const speedPerFrame = Math.hypot(
    velPerFrame[0],
    velPerFrame[1],
    velPerFrame[2]
  );
  const tangent: Vec3 =
    speedPerFrame > 1e-5
      ? [
          velPerFrame[0] / speedPerFrame,
          velPerFrame[1] / speedPerFrame,
          velPerFrame[2] / speedPerFrame,
        ]
      : [0, 1, 0];

  // Express velocity in units/sec for velocity-stretch & camera feel
  const velocity: Vec3 = [
    velPerFrame[0] * PAPER_DIORAMA_FPS,
    velPerFrame[1] * PAPER_DIORAMA_FPS,
    velPerFrame[2] * PAPER_DIORAMA_FPS,
  ];
  const speed = speedPerFrame * PAPER_DIORAMA_FPS;

  // `rocket-cutout.png` points strictly straight UP (+PI/2), so tangential rotZ = atan2(ty, tx) - PI/2
  const rotZ = Math.atan2(tangent[1], tangent[0]) - Math.PI / 2;

  return {
    pos,
    tangent,
    velocity,
    rotZ,
    speed,
  };
}

function makeActorObb(params: {
  id: string;
  position: Vec3;
  width: number;
  height: number;
  thickness: number;
  rotX?: number;
  rotZ: number;
  rotY: number;
  scale: Vec3;
}): OrientedBox3D {
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(params.rotX ?? 0, params.rotY, params.rotZ, 'XYZ')
  );
  return {
    id: params.id,
    position: params.position,
    size: [params.width, params.height, params.thickness],
    quaternion: [q.x, q.y, q.z, q.w],
    scale: params.scale,
  };
}

// 10 layered parallax clouds (strictly partitioned Z lanes; upper-left clear of FloatingEditorialDisplay)
const CLOUD_LAYOUT: ReadonlyArray<{
  id: string;
  baseX: number;
  y: number;
  z: number;
  scale: number;
  driftSpeed: number;
  isForeground: boolean;
}> = [
  { id: 'cloud-bg-1', baseX: -2.4, y: 6.2, z: -1.65, scale: 1.25, driftSpeed: 0.42, isForeground: false },
  { id: 'cloud-bg-2', baseX: 2.9, y: 10.6, z: -2.15, scale: 1.4, driftSpeed: -0.36, isForeground: false },
  { id: 'cloud-bg-3', baseX: -1.9, y: 12.1, z: -2.55, scale: 1.38, driftSpeed: 0.34, isForeground: false },
  { id: 'cloud-bg-4', baseX: 3.1, y: 19.6, z: -1.85, scale: 1.32, driftSpeed: -0.4, isForeground: false },
  { id: 'cloud-bg-5', baseX: -1.4, y: 23.1, z: -2.75, scale: 1.42, driftSpeed: 0.28, isForeground: false },
  { id: 'cloud-bg-6', baseX: 2.6, y: 28.8, z: -2.35, scale: 1.28, driftSpeed: -0.32, isForeground: false },
  { id: 'cloud-fg-1', baseX: 2.6, y: 7.8, z: 1.48, scale: 1.05, driftSpeed: -0.55, isForeground: true },
  { id: 'cloud-fg-2', baseX: -2.1, y: 10.4, z: 1.78, scale: 1.04, driftSpeed: 0.58, isForeground: true },
  { id: 'cloud-fg-3', baseX: 2.9, y: 21.4, z: 1.62, scale: 1.0, driftSpeed: -0.5, isForeground: true },
  { id: 'cloud-fg-4', baseX: 2.2, y: 27.6, z: 1.98, scale: 0.94, driftSpeed: -0.46, isForeground: true },
];

// Natural, asymmetrical flock of 5 individual soaring birds (`bird-1`..`bird-5`)
const INDIVIDUAL_BIRD_LAYOUT: ReadonlyArray<{
  id: string;
  anchorX: number;
  dir: 1 | -1;
  y: number;
  z: number;
  scale: number;
  speedX: number;
  glidePitch: number;
  phase: number;
}> = [
  { id: 'bird-1', anchorX: -2.35, dir: 1, y: 8.8, z: -1.12, scale: 0.96, speedX: 1.42, glidePitch: 0.08, phase: 0.2 },
  { id: 'bird-2', anchorX: 2.65, dir: -1, y: 10.7, z: 1.06, scale: 0.78, speedX: 1.55, glidePitch: -0.05, phase: 1.5 },
  { id: 'bird-3', anchorX: -1.75, dir: 1, y: 12.4, z: -1.42, scale: 1.12, speedX: 1.28, glidePitch: 0.11, phase: 2.8 },
  { id: 'bird-4', anchorX: 1.95, dir: -1, y: 14.2, z: 1.24, scale: 0.68, speedX: 1.62, glidePitch: -0.09, phase: 4.1 },
  { id: 'bird-5', anchorX: -2.85, dir: 1, y: 16.0, z: -1.24, scale: 0.88, speedX: 1.36, glidePitch: 0.06, phase: 5.3 },
];

// 38 varied-size twinkling golden & ivory 4-point paper stars across twilight & lush deep space
// Top-left header exclusion zone (`x < -1.1 && y > 54.6`) kept spotless so no star touches "quiet starlight."
const STAR_LAYOUT: ReadonlyArray<{
  id: string;
  x: number;
  y: number;
  z: number;
  scale: number;
  phase: number;
  color: string;
}> = (() => {
  const rng = createSeededRandom('paper-diorama-skyward-stars-v3');
  const colors = ['#FFF8DF', '#F6D379', '#FDECC2', '#E5EFFF', '#F9DE96'];
  const list: Array<{
    id: string;
    x: number;
    y: number;
    z: number;
    scale: number;
    phase: number;
    color: string;
  }> = [];
  for (let i = 0; i < 16; i++) {
    const x = -6.2 + rng() * 12.4;
    const y = 32.5 + (i / 15) * 15.5 + (rng() - 0.5) * 0.9;
    const z = -3.35 + rng() * 1.15;
    const scale = 0.13 + rng() * 0.17;
    const phase = rng() * Math.PI * 2;
    list.push({ id: `star-${i + 1}`, x, y, z, scale, phase, color: colors[i % colors.length]! });
  }
  for (let j = 0; j < 22; j++) {
    let x = -6.6 + rng() * 13.4;
    let y = 48.2 + (j / 21) * 13.4 + (rng() - 0.5) * 0.8;
    // Keep top-left FloatingEditorialDisplay zone completely clean in Outer Space
    if (x < -0.9 && y > 54.6) {
      if (j % 2 === 0) {
        x = Math.abs(x) + 0.6;
      } else {
        y = 50.2 + rng() * 3.8;
      }
    }
    const z = -3.45 + rng() * 1.2;
    const scale = 0.12 + rng() * 0.22;
    const phase = rng() * Math.PI * 2;
    list.push({
      id: `star-${17 + j}`,
      x,
      y,
      z,
      scale,
      phase,
      color: colors[(16 + j) % colors.length]!,
    });
  }
  return list;
})();

// 10 lush cotton-paper launch smoke puffs synced to snappy f=50 liftoff
const SMOKE_PUFF_SEEDS: ReadonlyArray<{
  id: string;
  startFrame: number;
  durFrames: number;
  dirX: number;
  z: number;
  maxScale: number;
  rise: number;
}> = [
  { id: 'smoke-0', startFrame: 32, durFrames: 58, dirX: -1.45, z: -0.34, maxScale: 1.05, rise: 0.45 },
  { id: 'smoke-1', startFrame: 34, durFrames: 60, dirX: 1.42, z: 0.34, maxScale: 1.02, rise: 0.42 },
  { id: 'smoke-2', startFrame: 38, durFrames: 66, dirX: -2.25, z: 0.4, maxScale: 1.32, rise: 0.58 },
  { id: 'smoke-3', startFrame: 40, durFrames: 68, dirX: 2.18, z: -0.4, maxScale: 1.28, rise: 0.56 },
  { id: 'smoke-4', startFrame: 44, durFrames: 70, dirX: -0.95, z: -0.46, maxScale: 1.15, rise: 0.95 },
  { id: 'smoke-5', startFrame: 47, durFrames: 72, dirX: 0.98, z: 0.46, maxScale: 1.12, rise: 1.02 },
  { id: 'smoke-6', startFrame: 51, durFrames: 68, dirX: -1.85, z: 0.36, maxScale: 1.18, rise: 0.78 },
  { id: 'smoke-7', startFrame: 54, durFrames: 68, dirX: 1.82, z: -0.36, maxScale: 1.14, rise: 0.82 },
  { id: 'smoke-8', startFrame: 58, durFrames: 64, dirX: -0.48, z: -0.32, maxScale: 0.88, rise: 1.65 },
  { id: 'smoke-9', startFrame: 62, durFrames: 62, dirX: 0.52, z: 0.32, maxScale: 0.84, rise: 2.05 },
];

export function evaluatePaperDioramaFrame(
  rawFrame: number,
  durationInFrames: number = PAPER_DIORAMA_DURATION_FRAMES
): PaperDioramaFrameState {
  const f = Math.max(0, rawFrame);
  const dur = Math.max(300, durationInFrames);
  const tSec = f / PAPER_DIORAMA_FPS;

  const anticStart = 30;
  const liftoffFrame = 50;
  const flybyStart = FLYBY_START_FRAME;
  const flybyEnd = FLYBY_START_FRAME + FLYBY_DURATION_FRAMES; // f = 990

  const meadowPopUp = easeOutBack((f - 2) / 22, 1.55);

  const rocketWidth = 2.05;
  const rocketHeight = 2.05;
  const rocketThickness = 0.06;
  const rocketRestCenterY = 0.9;
  const climbPeakY = 47.4; // rocketCenterY = 0.9 + 47.4 = 48.30 at exact P0 of sampleLunarSlingshot!

  const anticProg = clamp01((f - anticStart) / (liftoffFrame - anticStart));
  const antic = evaluateAnticipation(anticProg, 0.72);
  const ascentRawU = clamp01(
    (f - liftoffFrame) / Math.max(1, flybyStart - liftoffFrame)
  );
  const { frac: ascentFrac, normSpeed } = evaluateMonotonicAscent(ascentRawU);

  const slingshotProgress = clamp01((f - flybyStart) / FLYBY_DURATION_FRAMES);

  // Monotonic atmospheric altitude tracker (`0 -> 54`)
  const altitudeY =
    f < flybyStart
      ? ascentFrac * climbPeakY
      : Math.min(
          PAPER_DIORAMA_MAX_ALTITUDE_Y,
          climbPeakY +
            smoothstep((f - flybyStart) / 130) *
              (PAPER_DIORAMA_MAX_ALTITUDE_Y - climbPeakY)
        );
  const altitude01 = clamp01(altitudeY / PAPER_DIORAMA_MAX_ALTITUDE_Y);

  let rocketPos: Vec3 = [0, rocketRestCenterY, 0];
  let rocketRotZ = 0;
  let rocketRotY = 0;
  let rocketScale: Vec3 = [1, 1, 1];
  let rocketOpacity = 1;
  let slingshotSpeedNormalized = 0;

  if (f < liftoffFrame) {
    const crouchEnv = Math.sin(anticProg * Math.PI);
    const rattle =
      anticProg > 0.15 && anticProg < 0.98
        ? Math.sin(f * 1.25) * 0.026 * crouchEnv
        : 0;
    rocketPos = [
      rattle,
      rocketRestCenterY + Math.max(-0.04, antic.offsetY * 0.55),
      0,
    ];
    rocketScale = [1 + crouchEnv * 0.1, 1 - crouchEnv * 0.11, 1];
    rocketRotZ = rattle * 0.65;
  } else if (f < flybyStart) {
    // Fast exhilarating buoyant climb (`f=50..645`, `y: 0 -> 47.4`) curving smoothly onto Moon's right flank (`[3.35, 48.3, -0.35]`)
    const weaveEnv = Math.sin(ascentRawU * Math.PI);
    const entryAlign = smoothstep((ascentRawU - 0.72) / 0.28);
    const weaveX = Math.sin(ascentRawU * Math.PI * 3.0) * 0.38 * weaveEnv;
    const weaveVelX =
      Math.cos(ascentRawU * Math.PI * 3.0) * 0.38 * Math.PI * 3.0 * weaveEnv;
    const x = weaveX * (1 - entryAlign) + 3.35 * entryAlign;
    const y = rocketRestCenterY + ascentFrac * climbPeakY;
    const z = -0.35 * entryAlign;
    rocketPos = [x, y, z];

    const stretch =
      evaluateVelocityStretch([0, normSpeed * 3.5, 0], 0.4, 0.088) * weaveEnv;
    rocketScale = [1 - stretch * 0.36, 1 + stretch, 1];
    // Natural rightward lean during the final curve toward Moon's right flank, returning to 0° at f=645
    const alignLean = -Math.sin(entryAlign * Math.PI) * 0.22;
    const weaveBank = Math.max(-0.068, Math.min(0.068, -weaveVelX * 0.014));
    rocketRotZ = weaveBank * (1 - entryAlign) + alignLean;
  } else {
    // TRUE KEPLERIAN GRAVITY-ASSIST SLINGSHOT ON TILTED SATURN RING (`f=645..937+`)
    const df = f - flybyStart;
    const sample = sampleLunarSlingshot(df);
    rocketPos = sample.pos;
    rocketRotZ = sample.rotZ;

    // Normalized slingshot speed (`0` at slow capture hang-time ~0.038 u/f -> `1` at blazing ejection ~0.295 u/f)
    const speedPerFrame = sample.speed / PAPER_DIORAMA_FPS;
    slingshotSpeedNormalized = clamp01((speedPerFrame - 0.038) / (0.295 - 0.038));

    // Gentle 3D yaw banking + inward G-force lean as rocket dives behind Moon & whips across front periapsis
    rocketRotY = Math.max(
      -0.46,
      Math.min(0.46, -sample.tangent[2] * 0.48 - slingshotSpeedNormalized * 0.14)
    );

    // Visceral Disney velocity stretch surging up to `scaleY = 1.26, scaleX = 0.82` at blazing periapsis whip & ejection!
    const baseStretch = evaluateVelocityStretch(sample.velocity, 3.0, 0.14);
    const whipStretch = Math.pow(slingshotSpeedNormalized, 1.35) * 0.24;
    const totalStretch = Math.min(0.26, Math.max(baseStretch, whipStretch));

    // Stay bold & full-size through periapsis whip, then streak cleanly into deep space (`f=902..937`)
    const recedeShrink = lerp(1.0, 0.42, smoothstep((f - 902) / 35));
    rocketScale = [
      (1 - totalStretch * 0.69) * recedeShrink, // ~0.82 at max stretch!
      (1 + totalStretch) * recedeShrink, // ~1.26 at max stretch!
      recedeShrink,
    ];
    rocketOpacity = 1 - smoothstep((f - 920) / 18);
  }

  const rocket: PaperDioramaActorState = {
    id: 'paper-rocket',
    position: rocketPos,
    rotZ: rocketRotZ,
    rotY: rocketRotY,
    scale: rocketScale,
    width: rocketWidth,
    height: rocketHeight,
    thickness: rocketThickness,
    opacity: rocketOpacity,
    obb: makeActorObb({
      id: 'paper-rocket',
      position: rocketPos,
      width: rocketWidth * 0.5,
      height: rocketHeight * 0.82,
      thickness: rocketThickness,
      rotZ: rocketRotZ,
      rotY: rocketRotY,
      scale: rocketScale,
    }),
  };

  // --- Ultra-Dense 181-Point Silky Golden Saturn-Ring Slingshot Comet Contrail (`f = 645..1110`) ---
  const slingshotTrailPoints: Vec3[] = [];
  if (f > flybyStart + 2) {
    const maxDf = Math.min(FLYBY_DURATION_FRAMES, f - flybyStart);
    const sampleCount = 180; // 181 dense points -> silky Saturn-ring halo around the Moon, zero polygonal kinks!
    for (let i = 0; i <= sampleCount; i++) {
      const sampleDf = (i / sampleCount) * maxDf;
      const s = sampleLunarSlingshot(sampleDf);
      const tailOffset = i === sampleCount ? 0.44 : 0.32;
      slingshotTrailPoints.push([
        s.pos[0] - s.tangent[0] * tailOffset,
        s.pos[1] - s.tangent[1] * tailOffset,
        s.pos[2] - s.tangent[2] * tailOffset,
      ]);
    }
  }
  const slingshotTrailOpacity =
    f <= flybyStart
      ? 0
      : f < flybyEnd
        ? smoothstep((f - flybyStart) / 22)
        : lerp(1.0, 0.48, smoothstep((f - flybyEnd) / 115));

  // Crisp twinkling star-glint cleanly INSIDE upper-right viewport (`[6.45, 56.45, -0.65]`, never clipped!)
  const glintU = clamp01((f - 918) / 158);
  const departureStarGlint = {
    position: [6.45, 56.45, -0.65] as Vec3,
    scale: glintU > 0 && glintU < 1 ? 0.46 + Math.sin(glintU * Math.PI) * 0.98 : 0,
    opacity: glintU > 0 && glintU < 1 ? Math.sin(glintU * Math.PI) : 0,
  };

  // --- Thruster Flame: Bright Climb -> Soft Hang-Time -> Blazing 1.45x Slingshot Ejection Flare! ---
  let thrusterIntensity = 0;
  if (f >= 36 && f < flybyStart) {
    const igniteRamp = smoothstep((f - 36) / 12);
    thrusterIntensity =
      igniteRamp * (0.35 + 0.65 * Math.max(normSpeed, f < liftoffFrame ? 0.68 : 0));
  } else if (f >= flybyStart) {
    const departFade = 1 - smoothstep((f - 916) / 20);
    // Flame cools gently during hang-time (`0.68`) then ROARS to `1.45x` during periapsis whip & slingshot shot!
    thrusterIntensity = lerp(0.68, 1.45, Math.pow(slingshotSpeedNormalized, 0.85)) * departFade;
  }

  const thrusterPulse = 0.92 + 0.18 * Math.sin(f * 0.62) + 0.08 * Math.cos(f * 0.97);
  const rcsPulse =
    f >= COIN_FLICK_FRAME - 10 && f < flybyEnd
      ? Math.pow(0.5 + 0.5 * Math.sin(f * 0.28), 2)
      : 0;

  // --- Dynamic Chase Camera: Snappy Liftoff -> Exhilarating Climb -> Heroic Slingshot Recoil Stage ---
  const liftoffKickEnv =
    f >= liftoffFrame && f < liftoffFrame + 40
      ? Math.sin(((f - liftoffFrame) / 40) * Math.PI)
      : 0;
  const lunarStageBlend = smoothstep((f - (flybyStart - 40)) / 95);
  // Crisp camera recoil kick right at the blazing periapsis slingshot snap (`f=880..932`)!
  const wakeKickEnv =
    f >= COIN_FLICK_FRAME - 2 && f < COIN_FLICK_FRAME + 50
      ? Math.sin(((f - (COIN_FLICK_FRAME - 2)) / 52) * Math.PI)
      : 0;

  const climbLeadY =
    lerp(0.32, 0.78, smoothstep(normSpeed)) * (1 - lunarStageBlend);
  const camLagY = -liftoffKickEnv * 0.36;

  const climbCamX = rocketPos[0] * 0.32;
  const climbCamY = Math.max(1.32, rocketPos[1] + climbLeadY + camLagY);
  const climbCamZ = lerp(8.2, 8.75, smoothstep(normSpeed)) + liftoffKickEnv * 0.46;

  // Heroic framing showcasing the spinning double-sided Moon coin (`[1.85, 54.0, -1.80]`), Saturn-ring slingshot, and ringed planet
  const lunarCamX = 1.15 + Math.sin(tSec * 0.42) * 0.1 + wakeKickEnv * 0.32;
  const lunarCamY = 54.25 + Math.cos(tSec * 0.36) * 0.07 + wakeKickEnv * 0.22;
  const lunarCamZ = 10.75 + wakeKickEnv * 0.58;

  const camX = lerp(climbCamX, lunarCamX, lunarStageBlend) + Math.sin(tSec * 0.42) * 0.05;
  const camY = lerp(climbCamY, lunarCamY, lunarStageBlend) + Math.cos(tSec * 0.37) * 0.04;
  const camZ = lerp(climbCamZ, lunarCamZ, lunarStageBlend);

  const climbLookX = rocketPos[0] * 0.42;
  const climbLookY = Math.max(1.15, rocketPos[1] + climbLeadY * 0.58);
  const lunarLookX = 1.28 + wakeKickEnv * 0.34;
  const lunarLookY = 54.15 + wakeKickEnv * 0.18;

  const camera: PaperDioramaCameraState = {
    position: [camX, camY, camZ],
    lookAt: [
      lerp(climbLookX, lunarLookX, lunarStageBlend),
      lerp(climbLookY, lunarLookY, lunarStageBlend),
      lerp(0, -1.25, lunarStageBlend),
    ],
    fov: lerp(37.5, 40.0, lunarStageBlend) + liftoffKickEnv * 1.4 + wakeKickEnv * 1.8,
    rollDeg:
      -rocketRotZ * 3.8 * (1 - lunarStageBlend) +
      wakeKickEnv * -2.1 +
      Math.sin(tSec * 0.55) * 0.28,
  };

  // --- Launchpad Plinth & Brass Gantry Tower (`z = -0.86`) ---
  const gantryScaleY = Math.max(0.05, meadowPopUp);
  const gantryHeight = 2.9;
  const gantryPos: Vec3 = [-1.42, 0.02 + gantryHeight * 0.5 * gantryScaleY, -0.86];
  const gantry: PaperDioramaActorState = {
    id: 'launch-gantry',
    position: gantryPos,
    rotZ: 0,
    rotY: 0,
    scale: [1, gantryScaleY, 1],
    width: 0.76,
    height: gantryHeight,
    thickness: 0.16,
    opacity: 1,
    obb: makeActorObb({
      id: 'launch-gantry',
      position: gantryPos,
      width: 0.76,
      height: gantryHeight,
      thickness: 0.16,
      rotZ: 0,
      rotY: 0,
      scale: [1, gantryScaleY, 1],
    }),
  };

  const launchpadDeckObb: OrientedBox3D = {
    id: 'launchpad-deck',
    position: [0, -0.26, 0],
    size: [9.5, 0.48, 5.2],
  };

  // --- 10 Lush Cotton-Paper Launch Smoke Puffs ---
  const launchSmokePuffs: PaperDioramaSmokePuffState[] = SMOKE_PUFF_SEEDS.map((p) => {
    const u = clamp01((f - p.startFrame) / p.durFrames);
    const opacity = u <= 0 || u >= 1 ? 0 : Math.sin(u * Math.PI) * 0.92;
    return {
      id: p.id,
      position: [
        p.dirX * (0.25 + smoothstep(u) * 1.45),
        0.16 + p.rise * smoothstep(u),
        p.z,
      ],
      scale: p.maxScale * (0.35 + 0.85 * smoothstep(u)),
      opacity,
    };
  });

  // --- 10 Layered Parallax Paper Clouds ---
  const clouds: PaperDioramaCloudState[] = CLOUD_LAYOUT.map((c) => {
    const x =
      c.baseX +
      Math.sin(tSec * 0.28 + c.y) * 0.42 +
      c.driftSpeed * (tSec * 0.14);
    const w = 2.15 * c.scale;
    const h = 1.05 * c.scale;
    const pos: Vec3 = [x, c.y, c.z];
    return {
      id: c.id,
      position: pos,
      scale: c.scale,
      width: w,
      height: h,
      opacity: 0.95,
      isForeground: c.isForeground,
      obb: {
        id: c.id,
        position: pos,
        size: [w, h, 0.04],
      },
    };
  });

  // --- Natural Asymmetrical Flock of 5 Individual Soaring Birds (`bird-1`..`bird-5`) ---
  const birdPassCenterSec = 205 / PAPER_DIORAMA_FPS;
  const birds: PaperDioramaActorState[] = INDIVIDUAL_BIRD_LAYOUT.map((b) => {
    const passDeltaY = rocketPos[1] - b.y;
    const passProximity = Math.exp(-(passDeltaY * passDeltaY) / 14);
    const scatterPush = (b.anchorX >= 0 ? 1 : -1) * passProximity * 0.78;
    const x =
      b.anchorX +
      b.dir * ((tSec - birdPassCenterSec) * b.speedX * 0.72) +
      scatterPush;
    const wingCycle = tSec * 4.2 + b.phase;
    const bobY = Math.sin(wingCycle) * 0.16;
    const pos: Vec3 = [x, b.y + bobY, b.z];
    const bankRotZ =
      b.glidePitch +
      (b.anchorX >= 0 ? -1 : 1) * passProximity * 0.22 +
      Math.cos(wingCycle) * 0.075;
    const wingRockX = Math.sin(wingCycle * 1.15) * 0.12;
    const birdSize = 1.28 * b.scale;
    const scale: Vec3 = [b.dir < 0 ? -1 : 1, 1, 1];
    return {
      id: b.id,
      position: pos,
      rotX: wingRockX,
      rotZ: bankRotZ,
      rotY: 0,
      scale,
      width: birdSize,
      height: birdSize,
      thickness: 0.04,
      opacity: 1,
      obb: makeActorObb({
        id: b.id,
        position: pos,
        width: birdSize * 0.88,
        height: birdSize * 0.72,
        thickness: 0.04,
        rotX: wingRockX,
        rotZ: bankRotZ,
        rotY: 0,
        scale: [1, 1, 1],
      }),
    };
  });

  // --- Vintage Paper Airliner (`y = 26.8, z = -1.58`, synced to snappy f=385 pass) ---
  const airlinerPassSec = (f - 385) / PAPER_DIORAMA_FPS;
  const airlinerX = 1.05 + airlinerPassSec * 1.85;
  const airlinerProximity = Math.exp(-Math.pow((rocketPos[1] - 26.8) / 3.4, 2));
  const airlinerY = 26.8 + Math.sin(tSec * 1.35) * 0.14 + airlinerProximity * 0.18;
  const airlinerRotZ =
    0.045 + airlinerProximity * 0.13 * Math.sin(airlinerPassSec * 2.6);
  const airlinerPos: Vec3 = [airlinerX, airlinerY, -1.58];
  const airlinerContrailPoints: Vec3[] = [];
  for (let i = 0; i <= 14; i++) {
    const back = (i / 14) * 5.2;
    airlinerContrailPoints.push([
      airlinerX - 0.85 - back,
      airlinerY - 0.06 - back * 0.025 + Math.sin(back * 0.8 + tSec) * 0.02,
      -1.64,
    ]);
  }
  const airliner: PaperDioramaActorState & { contrailPoints: ReadonlyArray<Vec3> } = {
    id: 'paper-airliner',
    position: airlinerPos,
    rotZ: airlinerRotZ,
    rotY: 0,
    scale: [1, 1, 1],
    width: 2.5,
    height: 2.5,
    thickness: 0.05,
    opacity: 1,
    contrailPoints: airlinerContrailPoints,
    obb: makeActorObb({
      id: 'paper-airliner',
      position: airlinerPos,
      width: 2.4,
      height: 1.45,
      thickness: 0.05,
      rotZ: airlinerRotZ,
      rotY: 0,
      scale: [1, 1, 1],
    }),
  };

  // --- 2 Orbital Paper Satellites (`y = 37.8` & `y = 43.2`) ---
  const sat1PassSec = (f - 535) / PAPER_DIORAMA_FPS;
  const sat2PassSec = (f - 595) / PAPER_DIORAMA_FPS;
  const satSpecs = [
    {
      id: 'satellite-1',
      pos: [-1.85 + sat1PassSec * 0.72, 37.8 + Math.sin(tSec * 0.95) * 0.18, -1.46] as Vec3,
      rotZ: 0.18 + Math.sin(tSec * 0.65) * 0.09,
      rotY: Math.sin(tSec * 0.56) * 0.24,
      w: 1.85,
      h: 1.85,
    },
    {
      id: 'satellite-2',
      pos: [2.35 - sat2PassSec * 0.66, 43.2 + Math.cos(tSec * 0.88) * 0.2, -2.22] as Vec3,
      rotZ: -0.15 + Math.cos(tSec * 0.6) * 0.1,
      rotY: Math.cos(tSec * 0.52) * 0.22,
      w: 1.65,
      h: 1.65,
    },
  ];
  const satellites: PaperDioramaActorState[] = satSpecs.map((s) => ({
    id: s.id,
    position: s.pos,
    rotZ: s.rotZ,
    rotY: s.rotY,
    scale: [1, 1, 1],
    width: s.w,
    height: s.h,
    thickness: 0.05,
    opacity: 1,
    obb: makeActorObb({
      id: s.id,
      position: s.pos,
      width: s.w,
      height: s.h,
      thickness: 0.05,
      rotZ: s.rotZ,
      rotY: s.rotY,
      scale: [1, 1, 1],
    }),
  }));

  // --- Double-Sided Cardboard Coin Moon (`[1.85, 54.0, -1.80]`) Flipped by Rocket Wake! ---
  const coinU = clamp01((f - COIN_FLICK_FRAME) / COIN_SPIN_DURATION);
  const baseCoinSpin = 3 * Math.PI * (1 - Math.pow(1 - coinU, 3.2));
  const settleEnv =
    smoothstep((coinU - 0.74) / 0.12) * (1 - smoothstep((coinU - 0.95) / 0.05));
  const settleOvershoot =
    settleEnv * Math.sin((coinU - 0.74) * Math.PI * 3.8) * 0.075;
  const coinSpinY = coinU <= 0 ? 0 : baseCoinSpin + settleOvershoot;

  // Realistic spinning-coin nutation wobble decaying smoothly from 0.16 rad -> 0
  const wobbleDecay =
    coinU <= 0 ? 0 : Math.pow(1 - coinU, 1.55) * smoothstep(coinU / 0.06);
  const coinWobbleZ = wobbleDecay * 0.16 * Math.sin(coinU * Math.PI * 7.5);
  const coinWobbleX = wobbleDecay * 0.11 * Math.cos(coinU * Math.PI * 7.5);

  // Crisp golden wake-sparkle burst right as the rocket skims past the Moon's rim
  const wakeU = clamp01((f - (COIN_FLICK_FRAME - 8)) / 72);
  const wakePulse = wakeU > 0 && wakeU < 1 ? Math.sin(wakeU * Math.PI) : 0;

  const moonIdleDriftX = Math.sin(tSec * 0.42) * 0.04;
  const moonIdleDriftY = Math.cos(tSec * 0.46) * 0.05 + wakePulse * 0.08;
  const moonPos: Vec3 = [1.85 + moonIdleDriftX, 54.0 + moonIdleDriftY, -1.8];
  const moonRotZ = Math.sin(tSec * 0.36) * 0.03 + coinWobbleZ;
  const moonThickness = 0.14; // Tactile cardboard coin thickness!

  const moon: PaperDioramaMoonCoinState = {
    id: 'paper-moon',
    position: moonPos,
    rotX: coinWobbleX,
    rotY: coinSpinY,
    rotZ: moonRotZ,
    coinSpinY,
    coinWobbleX,
    coinWobbleZ,
    wakePulse,
    scale: [1, 1, 1],
    width: 3.05,
    height: 3.05,
    thickness: moonThickness,
    opacity: 1,
    obb: makeActorObb({
      id: 'paper-moon',
      position: moonPos,
      width: 2.8,
      height: 2.8,
      thickness: moonThickness,
      rotX: coinWobbleX,
      rotY: coinSpinY,
      rotZ: moonRotZ,
      scale: [1, 1, 1],
    }),
  };

  const sky = evaluateSkyAtmosphere(altitude01);

  const stars: PaperDioramaStarState[] = STAR_LAYOUT.map((s) => ({
    id: s.id,
    position: [s.x, s.y + Math.sin(tSec * 0.65 + s.phase) * 0.05, s.z],
    scale: s.scale * (0.85 + 0.3 * (0.5 + 0.5 * Math.sin(tSec * 2.6 + s.phase))),
    twinkle: sky.starOpacity * (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(tSec * 3.0 + s.phase))),
    color: s.color,
  }));

  const spaceLimbParallax = smoothstep((altitude01 - 0.78) / 0.22) * 7.8;
  const earthLimb = {
    position: [0, 42.2 + spaceLimbParallax, -3.65] as Vec3,
    radius: 19.5,
    opacity: sky.earthGlowOpacity,
  };

  const ringedPlanet = {
    position: [-3.45, 53.4 + Math.sin(tSec * 0.5) * 0.08, -2.85] as Vec3,
    scale: 1.05,
    rotZ: 0.28 + Math.sin(tSec * 0.32) * 0.04,
    opacity: smoothstep((altitude01 - 0.72) / 0.18),
  };

  let activeChapterId: PaperDioramaChapterId = 'launch';
  if (f >= flybyStart) activeChapterId = 'space';
  else if (f >= 520) activeChapterId = 'satellites';
  else if (f >= 340) activeChapterId = 'stratosphere';
  else if (f >= 175) activeChapterId = 'birds';

  const altitudeKm =
    altitude01 <= 0.25
      ? Math.round((altitude01 / 0.25) * 3)
      : altitude01 <= 0.5
        ? Math.round(3 + ((altitude01 - 0.25) / 0.25) * 9)
        : altitude01 <= 0.75
          ? Math.round(12 + ((altitude01 - 0.5) / 0.25) * 238)
          : Math.round(250 + ((altitude01 - 0.75) / 0.25) * 150);

  const collisionBodies: OrientedBox3D[] = [
    launchpadDeckObb,
    gantry.obb,
    rocket.obb,
    ...clouds.map((c) => c.obb),
    ...birds.map((b) => b.obb),
    airliner.obb,
    ...satellites.map((s) => s.obb),
    moon.obb,
  ];

  return {
    frame: f,
    durationInFrames: dur,
    altitudeY,
    altitude01,
    altitudeKm,
    activeChapterId,
    sky,
    camera,
    meadowPopUp,
    thrusterIntensity,
    thrusterPulse,
    rcsPulse,
    slingshotProgress,
    slingshotSpeedNormalized,
    slingshotTrailPoints,
    slingshotTrailOpacity,
    departureStarGlint,
    rocket,
    gantry,
    launchSmokePuffs,
    clouds,
    birds,
    airliner,
    earthLimb,
    satellites,
    moon,
    ringedPlanet,
    stars,
    collisionBodies,
  };
}
