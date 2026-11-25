import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  AbsoluteFill,
  Sequence,
  getRemotionEnvironment,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { z } from 'zod';
import {
  SmartMusicBed,
  SoundCue,
  StyleProvider,
  VoiceoverTrack,
  useStudioStyle,
  type DialogueDuckingSegment,
  type Vec3,
} from '@make-pictures/core';
import {
  ImageCutout3D,
  PaperCutout3D,
  PopUpHinge3D,
} from '@make-pictures/kits/paper-diorama-3d';
import {
  DEFAULT_STUDIO_IBL_PANELS,
  SyncStudioIbl3D,
  getProceduralPbrMaps,
  usePreloadedTextures3D,
} from '@make-pictures/kits/tactile-3d';
import {
  FloatingEditorialDisplay,
  PaperRibbonTimeline,
} from '@make-pictures/kits/editorial-collage';
import {
  PAPER_DIORAMA_DURATION_FRAMES,
  PAPER_DIORAMA_MILESTONES,
  PAPER_DIORAMA_SFX_TIMELINE,
  PAPER_DIORAMA_VO_TIMELINE,
  evaluatePaperDioramaFrame,
  type PaperDioramaCameraState,
  type PaperDioramaChapterId,
  type PaperDioramaMoonCoinState,
} from './paperDioramaKinematics';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from './generated/audio-manifest';
import paperDioramaDefaults from './PaperDioramaDemo.props.json';

export const paperDioramaDemoSchema = z.object({
  styleId: z
    .string()
    .describe('Colors & Style :: Base Style (Style ID)'),
  headline: z
    .string()
    .describe('Story & Titles :: Headline'),
  subline: z
    .string()
    .describe('Story & Titles :: Subtitle'),
  voiceoverVolume: z
    .number()
    .min(0)
    .max(1.5)
    .describe('Audio :: Voiceover Volume'),
  musicVolume: z
    .number()
    .min(0)
    .max(1)
    .describe('Audio :: Music Volume'),
  sfxVolume: z
    .number()
    .min(0)
    .max(1)
    .describe('Audio :: SFX Volume'),
});

export type PaperDioramaDemoProps = z.infer<typeof paperDioramaDemoSchema>;

// Module-scope static asset URLs (zero per-frame string churn)
const ROCKET_URL = staticFile('examples/paper-diorama/images/rocket-cutout.png');
const BIRD_SINGLE_URL = staticFile('examples/paper-diorama/images/bird-single-cutout.png');
const AIRLINER_URL = staticFile('examples/paper-diorama/images/airliner-cutout.png');
const SATELLITE_URL = staticFile('examples/paper-diorama/images/satellite-cutout.png');
const MOON_URL = staticFile('examples/paper-diorama/images/moon-cutout.png');
const MOON_FARSIDE_URL = staticFile(
  'examples/paper-diorama/images/moon-farside-cutout.png'
);
const MOON_COIN_TEXTURE_SPECS = [
  { src: MOON_URL },
  { src: MOON_FARSIDE_URL },
] as const;

// Module-scope static audio descriptors (zero 60 Hz re-allocation or ducking invalidation)
const SCORE_SRC = MUSIC_MANIFEST?.audioFile
  ? staticFile(MUSIC_MANIFEST.audioFile)
  : null;

const DUCKING_SEGMENTS: DialogueDuckingSegment[] = PAPER_DIORAMA_VO_TIMELINE.map(
  (seg) => ({
    sceneId: seg.sceneId,
    fromFrame: seg.fromFrame,
    durationInFrames: seg.durationInFrames,
  })
);

const RESOLVED_SFX_CUES = PAPER_DIORAMA_SFX_TIMELINE.map((cue) => {
  const entry = SFX_MANIFEST[cue.sfxId];
  if (!entry?.audioFile) return null;
  return {
    key: `${cue.sfxId}-${cue.fromFrame}`,
    fromFrame: cue.fromFrame,
    durationInFrames: cue.durationInFrames,
    src: staticFile(entry.audioFile),
    baseVolume: cue.volume ?? 0.2,
  };
}).filter((item): item is NonNullable<typeof item> => item !== null);

const THREE_GL_CONFIG = {
  alpha: true,
  antialias: true,
  toneMapping: THREE.ACESFilmicToneMapping,
  powerPreference: 'high-performance' as const,
};
const RENDER_DPR: [number, number] = [1, 2];

// Pre-allocated scratch math for zero-allocation instanced contrails
const UP_AXIS = new THREE.Vector3(0, 1, 0);
const IDENTITY_QUAT = new THREE.Quaternion();
const SCRATCH_DIR = new THREE.Vector3();
const SCRATCH_POS = new THREE.Vector3();
const SCRATCH_SCALE = new THREE.Vector3();
const SCRATCH_QUAT = new THREE.Quaternion();
const SCRATCH_MAT = new THREE.Matrix4();
const TRAIL_COLOR_CALM = new THREE.Color('#EFC35E');
const TRAIL_COLOR_BLAZE = new THREE.Color('#FFF2BA');
const MAX_CONTRAIL_SEGMENTS = 16;
const MAX_SLINGSHOT_SEGMENTS = 196;
const MAX_SLINGSHOT_BEADS = 52;
const WAKE_SPARKLE_ANGLES = [-2.55, -2.0, -1.45, -0.82, 0.2, 0.88] as const;
const WAKE_SPARKLE_ARGS: [number, number, number] = [0.068, 12, 10];

// Module-scope constant geometry tuples (zero R3F array-diff churn)
const DECK_BOX_ARGS: [number, number, number] = [9.5, 0.48, 5.2];
const PAD_RING_OUTER_ARGS: [number, number, number, number] = [1.24, 1.38, 0.06, 40];
const PAD_RING_INNER_ARGS: [number, number, number, number] = [0.92, 0.96, 0.08, 36];
const PAD_TORUS_ARGS: [number, number, number, number] = [0.76, 0.028, 10, 40];
const RCS_PUFF_ARGS: [number, number, number] = [0.09, 12, 10];
const TRAIL_PUFF_PHASES = [0, 0.25, 0.5, 0.75] as const;

const JOYFUL_SPRING = { damping: 14, stiffness: 210, mass: 0.72 } as const;

const CHAPTER_LABELS: Record<PaperDioramaChapterId, string> = {
  launch: 'SUNLIT MEADOW',
  birds: 'CLOUDS & SWALLOWS',
  stratosphere: 'STRATOSPHERE FLIGHT',
  satellites: 'ORBITAL EDGE',
  space: 'OUTER SPACE',
};

// ============================================================================
// Static Module-Scope PaperCutout3D Painters (compiled once, LRU cached)
// ============================================================================

function drawMeadowHillBack(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): void {
  ctx.save();
  ctx.scale(w / 768, h / 320);
  const grad = ctx.createLinearGradient(0, 60, 0, 310);
  grad.addColorStop(0, '#9EC38C');
  grad.addColorStop(1, '#6C9A67');
  ctx.fillStyle = grad;
  ctx.strokeStyle = '#3E5E3E';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(24, 304);
  ctx.quadraticCurveTo(185, 62, 396, 134);
  ctx.quadraticCurveTo(580, 198, 744, 96);
  ctx.lineTo(744, 304);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawMeadowHillFront(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): void {
  ctx.save();
  ctx.scale(w / 768, h / 280);
  const grad = ctx.createLinearGradient(0, 52, 0, 270);
  grad.addColorStop(0, '#BDD48A');
  grad.addColorStop(1, '#7CA85E');
  ctx.fillStyle = grad;
  ctx.strokeStyle = '#4B6939';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(24, 266);
  ctx.quadraticCurveTo(210, 88, 410, 152);
  ctx.quadraticCurveTo(590, 210, 744, 118);
  ctx.lineTo(744, 266);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Warm wildflower dots along the hillside
  const flowers = [
    [150, 186, '#F7D276'],
    [248, 168, '#FAF5EA'],
    [340, 198, '#E07A5F'],
    [515, 206, '#F7D276'],
    [624, 180, '#FAF5EA'],
  ] as const;
  for (const [fx, fy, fc] of flowers) {
    ctx.fillStyle = fc;
    ctx.beginPath();
    ctx.arc(fx, fy, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBrassGantry(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): void {
  ctx.save();
  ctx.scale(w / 256, h / 512);

  // Warm parchment & brass launch gantry tower
  ctx.fillStyle = '#C9933B';
  ctx.strokeStyle = '#4A3320';
  ctx.lineWidth = 6;

  // Base block
  ctx.fillRect(54, 444, 116, 48);
  ctx.strokeRect(54, 444, 116, 48);

  // Twin vertical truss masts
  ctx.fillStyle = '#D9AA52';
  ctx.fillRect(70, 56, 22, 392);
  ctx.strokeRect(70, 56, 22, 392);
  ctx.fillRect(132, 56, 22, 392);
  ctx.strokeRect(132, 56, 22, 392);

  // Diagonal X-bracing
  ctx.strokeStyle = '#6E4C28';
  ctx.lineWidth = 7;
  for (let y = 76; y < 420; y += 68) {
    ctx.beginPath();
    ctx.moveTo(86, y);
    ctx.lineTo(138, y + 60);
    ctx.moveTo(138, y);
    ctx.lineTo(86, y + 60);
    ctx.stroke();
  }

  // Terracotta upper swing-away service arm pointing toward rocket
  ctx.fillStyle = '#C85A3F';
  ctx.strokeStyle = '#4A3320';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(138, 128, 92, 24, 8);
  ctx.fill();
  ctx.stroke();

  // Warm glowing beacon dome on top
  ctx.fillStyle = '#FAF5EA';
  ctx.beginPath();
  ctx.arc(112, 42, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#E07A5F';
  ctx.beginPath();
  ctx.arc(112, 42, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPaperCloud(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): void {
  ctx.save();
  ctx.scale(w / 512, h / 256);

  const grad = ctx.createLinearGradient(0, 42, 0, 208);
  grad.addColorStop(0, '#FFFDF8');
  grad.addColorStop(0.68, '#F6EFE3');
  grad.addColorStop(1, '#DCE4EE');
  ctx.fillStyle = grad;
  ctx.strokeStyle = '#738294';
  ctx.lineWidth = 5;

  ctx.beginPath();
  ctx.moveTo(84, 196);
  ctx.lineTo(428, 196);
  ctx.bezierCurveTo(470, 196, 474, 132, 424, 124);
  ctx.bezierCurveTo(416, 68, 344, 48, 302, 84);
  ctx.bezierCurveTo(274, 24, 180, 28, 156, 90);
  ctx.bezierCurveTo(108, 76, 62, 114, 76, 156);
  ctx.bezierCurveTo(44, 162, 48, 196, 84, 196);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = 'rgba(115, 130, 148, 0.25)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(118, 174);
  ctx.quadraticCurveTo(256, 164, 396, 174);
  ctx.stroke();
  ctx.restore();
}

function drawSmokePuff(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): void {
  ctx.save();
  ctx.scale(w / 256, h / 256);

  const grad = ctx.createRadialGradient(118, 112, 14, 128, 128, 94);
  grad.addColorStop(0, '#FFFDF9');
  grad.addColorStop(0.65, '#F8EFE0');
  grad.addColorStop(1, '#E4D2B9');
  ctx.fillStyle = grad;
  ctx.strokeStyle = '#A88E72';
  ctx.lineWidth = 5;

  ctx.beginPath();
  ctx.arc(128, 130, 58, 0, Math.PI * 2);
  ctx.arc(84, 138, 42, 0, Math.PI * 2);
  ctx.arc(170, 136, 44, 0, Math.PI * 2);
  ctx.arc(128, 92, 44, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(168, 142, 114, 0.36)';
  ctx.beginPath();
  ctx.arc(128, 128, 74, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawRingedPlanet(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): void {
  ctx.save();
  ctx.scale(w / 320, h / 256);

  // Back ring arc
  ctx.strokeStyle = '#DFB05A';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.ellipse(160, 128, 128, 34, -0.22, Math.PI, Math.PI * 2);
  ctx.stroke();

  // Warm terracotta-cream sculpted planet body
  const grad = ctx.createRadialGradient(134, 102, 16, 160, 128, 74);
  grad.addColorStop(0, '#FBE6C2');
  grad.addColorStop(0.55, '#D4815A');
  grad.addColorStop(1, '#614154');
  ctx.fillStyle = grad;
  ctx.strokeStyle = '#3C2836';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(160, 128, 66, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Subtle horizontal cloud band
  ctx.strokeStyle = 'rgba(255, 245, 224, 0.35)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(160, 128, 56, -0.35, 0.35);
  ctx.stroke();

  // Front golden ring arc crossing over planet
  ctx.strokeStyle = '#F2C974';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.ellipse(160, 128, 128, 34, -0.22, 0, Math.PI);
  ctx.stroke();
  ctx.strokeStyle = '#8A5E22';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(160, 128, 135, 38, -0.22, 0, Math.PI);
  ctx.stroke();
  ctx.restore();
}

function drawStorybookFlame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): void {
  ctx.save();
  ctx.scale(w / 256, h / 320);

  // Scalloped crimson-terracotta outer storybook flame petal
  ctx.fillStyle = '#D64E33';
  ctx.strokeStyle = '#6E2B1E';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(82, 24);
  ctx.bezierCurveTo(46, 72, 42, 142, 74, 198);
  ctx.quadraticCurveTo(60, 218, 86, 232);
  ctx.quadraticCurveTo(108, 286, 128, 302);
  ctx.quadraticCurveTo(148, 286, 170, 232);
  ctx.quadraticCurveTo(196, 218, 182, 198);
  ctx.bezierCurveTo(214, 142, 210, 72, 174, 24);
  ctx.quadraticCurveTo(128, 12, 82, 24);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Rounded warm tangerine middle teardrop petal
  ctx.fillStyle = '#F2763A';
  ctx.beginPath();
  ctx.moveTo(92, 32);
  ctx.bezierCurveTo(66, 76, 68, 146, 94, 198);
  ctx.quadraticCurveTo(112, 242, 128, 258);
  ctx.quadraticCurveTo(144, 242, 162, 198);
  ctx.bezierCurveTo(188, 146, 190, 76, 164, 32);
  ctx.quadraticCurveTo(128, 22, 92, 32);
  ctx.closePath();
  ctx.fill();

  // Luminous golden-cream inner teardrop
  ctx.fillStyle = '#FFE48F';
  ctx.beginPath();
  ctx.moveTo(102, 40);
  ctx.bezierCurveTo(86, 78, 88, 134, 108, 176);
  ctx.quadraticCurveTo(118, 198, 128, 208);
  ctx.quadraticCurveTo(138, 198, 148, 176);
  ctx.bezierCurveTo(168, 134, 170, 78, 154, 40);
  ctx.quadraticCurveTo(128, 32, 102, 40);
  ctx.closePath();
  ctx.fill();

  // Soft ivory-white hot nozzle core
  ctx.fillStyle = '#FFFDF5';
  ctx.beginPath();
  ctx.ellipse(128, 86, 22, 46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGoldenStar(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): void {
  ctx.save();
  ctx.scale(w / 192, h / 192);

  ctx.fillStyle = '#F7D47A';
  ctx.strokeStyle = '#B88732';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(96, 16);
  ctx.quadraticCurveTo(103, 86, 176, 96);
  ctx.quadraticCurveTo(103, 106, 96, 176);
  ctx.quadraticCurveTo(89, 106, 16, 96);
  ctx.quadraticCurveTo(89, 86, 96, 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FFFDF5';
  ctx.beginPath();
  ctx.arc(96, 96, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ============================================================================
// Focused 3D Sub-Components (Zero per-frame GPU allocation)
// ============================================================================

const ChaseCameraRig3D: React.FC<{ camera: PaperDioramaCameraState }> = ({
  camera: camState,
}) => {
  const r3fCamera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);

  const [px, py, pz] = camState.position;
  const [lx, ly, lz] = camState.lookAt;
  const { fov, rollDeg } = camState;

  useLayoutEffect(() => {
    const rollRad = (rollDeg * Math.PI) / 180;
    r3fCamera.up.set(-Math.sin(rollRad), Math.cos(rollRad), 0);
    r3fCamera.position.set(px, py, pz);
    if ((r3fCamera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const persp = r3fCamera as THREE.PerspectiveCamera;
      if (Math.abs(persp.fov - fov) > 1e-4) {
        persp.fov = fov;
        persp.updateProjectionMatrix();
      }
    }
    r3fCamera.lookAt(lx, ly, lz);
    invalidate();
  }, [r3fCamera, invalidate, px, py, pz, lx, ly, lz, fov, rollDeg]);

  return null;
};

const AscentLightingRig3D: React.FC<{
  rocketY: number;
  ambientIntensity: number;
  shadowMapSize: number;
}> = ({ rocketY, ambientIntensity, shadowMapSize }) => {
  const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
  const targetObj = useMemo(() => new THREE.Object3D(), []);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  useLayoutEffect(() => {
    targetObj.position.set(0, rocketY, 0);
    targetObj.updateMatrixWorld();
    if (keyLightRef.current) {
      keyLightRef.current.target = targetObj;
    }
    gl.toneMappingExposure = 0.94 + ambientIntensity * 0.04;
    invalidate();
  }, [targetObj, rocketY, ambientIntensity, gl, invalidate]);

  return (
    <group name="skyward-lighting-rig">
      <SyncStudioIbl3D
        panels={DEFAULT_STUDIO_IBL_PANELS}
        backgroundColor="#C4C9D4"
        environmentIntensity={0.42 + ambientIntensity * 0.56}
      />
      <primitive object={targetObj} />
      <hemisphereLight
        color="#FFF9EE"
        groundColor="#6D7A96"
        intensity={0.34 + ambientIntensity * 0.42}
      />
      <directionalLight
        ref={keyLightRef}
        position={[-4.5, rocketY + 5.6, 5.4]}
        intensity={1.1 + ambientIntensity * 0.45}
        color="#FFF3DC"
        castShadow
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        shadow-camera-near={0.5}
        shadow-camera-far={24}
        shadow-camera-left={-7.5}
        shadow-camera-right={7.5}
        shadow-camera-top={7.5}
        shadow-camera-bottom={-7.5}
      />
      <directionalLight
        position={[5.0, rocketY + 2.8, 3.2]}
        intensity={0.36 + ambientIntensity * 0.22}
        color="#CFE6FF"
      />
    </group>
  );
};

const AirlinerContrail3D: React.FC<{
  points: ReadonlyArray<Vec3>;
  visible: boolean;
}> = ({ points, visible }) => {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const unitCyl = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 8), []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#FFFDF8',
        transparent: true,
        opacity: 0.72,
      }),
    []
  );

  useEffect(() => {
    return () => {
      unitCyl.dispose();
      mat.dispose();
    };
  }, [unitCyl, mat]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const count = Math.min(MAX_CONTRAIL_SEGMENTS, Math.max(0, points.length - 1));
    let active = 0;
    for (let i = 0; i < count; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      SCRATCH_DIR.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const len = SCRATCH_DIR.length();
      if (len < 1e-4) continue;
      SCRATCH_DIR.divideScalar(len);
      SCRATCH_QUAT.setFromUnitVectors(UP_AXIS, SCRATCH_DIR);

      const taper = 1 - (i / Math.max(1, count)) * 0.78;
      const radius = 0.048 * taper;
      SCRATCH_POS.set(
        (a[0] + b[0]) * 0.5,
        (a[1] + b[1]) * 0.5,
        (a[2] + b[2]) * 0.5
      );
      SCRATCH_SCALE.set(radius, len * 0.92, radius);
      SCRATCH_MAT.compose(SCRATCH_POS, SCRATCH_QUAT, SCRATCH_SCALE);
      mesh.setMatrixAt(active, SCRATCH_MAT);
      active++;
    }
    mesh.count = active;
    mesh.instanceMatrix.needsUpdate = true;
  }, [points]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[unitCyl, mat, MAX_CONTRAIL_SEGMENTS]}
      visible={visible}
      frustumCulled={false}
    />
  );
};

/**
 * Gleaming 3D golden stardust contrail tracing the rocket's exact lunar slingshot
 * orbit & deep-space departure (2 static InstancedMeshes, zero per-frame allocations).
 */
const LunarSlingshotContrail3D: React.FC<{
  points: ReadonlyArray<Vec3>;
  opacity: number;
  speedNormalized: number;
  slingshotProgress: number;
  frame: number;
}> = ({ points, opacity, speedNormalized, slingshotProgress, frame }) => {
  const segMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const beadMeshRef = useRef<THREE.InstancedMesh | null>(null);

  const unitCyl = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 8), []);
  const unitSphere = useMemo(() => new THREE.SphereGeometry(1, 10, 8), []);
  const trailMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#F7D374',
        transparent: true,
        opacity: 0.85,
        depthTest: true,
        depthWrite: false,
      }),
    []
  );
  const stardustMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#FFF8DF',
        transparent: true,
        opacity: 0.92,
        depthTest: true,
        depthWrite: false,
      }),
    []
  );

  useEffect(() => {
    return () => {
      unitCyl.dispose();
      unitSphere.dispose();
      trailMat.dispose();
      stardustMat.dispose();
    };
  }, [unitCyl, unitSphere, trailMat, stardustMat]);

  useLayoutEffect(() => {
    const clampedSpeed = Math.max(0, Math.min(1, speedNormalized));
    const clampedOp = Math.max(0, Math.min(1, opacity));
    // Flare trail luminance & warmth right through the blazing periapsis whip & slingshot ejection
    trailMat.color.lerpColors(
      TRAIL_COLOR_CALM,
      TRAIL_COLOR_BLAZE,
      Math.pow(clampedSpeed, 0.85) * 0.85
    );
    trailMat.opacity = clampedOp * (0.76 + clampedSpeed * 0.22);
    stardustMat.opacity = clampedOp * (0.86 + clampedSpeed * 0.14);

    const segMesh = segMeshRef.current;
    const beadMesh = beadMeshRef.current;
    if (!segMesh || !beadMesh) return;

    const segCount = Math.min(
      MAX_SLINGSHOT_SEGMENTS,
      Math.max(0, points.length - 1)
    );

    // Measure local speed range from uniform-time trajectory spacing (zero allocation)
    let minSegLen = Infinity;
    let maxSegLen = 0;
    for (let i = 0; i < segCount; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const dz = b[2] - a[2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len >= 1e-4) {
        if (len < minSegLen) minSegLen = len;
        if (len > maxSegLen) maxSegLen = len;
      }
    }
    const lenSpan = maxSegLen > minSegLen + 1e-4 ? maxSegLen - minSegLen : 0;
    // Preserve calligraphic thin-capture -> lush-periapsis-whip thickness during Cosmic Afterglow too
    const flareWeight = Math.max(clampedSpeed, slingshotProgress > 0.85 ? 1 : 0);

    let activeSegs = 0;
    for (let i = 0; i < segCount; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      SCRATCH_DIR.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const len = SCRATCH_DIR.length();
      if (len < 1e-4) continue;
      SCRATCH_DIR.divideScalar(len);
      SCRATCH_QUAT.setFromUnitVectors(UP_AXIS, SCRATCH_DIR);

      // Calligraphic taper: whisper-thin behind Moon during capture, blazing comet flare at periapsis & exit
      const frac = (i + 0.5) / Math.max(1, segCount);
      const localSpeed01 =
        lenSpan > 0 ? Math.max(0, Math.min(1, (len - minSegLen) / lenSpan)) : 0;
      const speedFlare = Math.pow(localSpeed01, 1.25) * flareWeight;
      const radius = 0.005 + Math.pow(frac, 1.35) * 0.036 + speedFlare * 0.028;
      SCRATCH_POS.set(
        (a[0] + b[0]) * 0.5,
        (a[1] + b[1]) * 0.5,
        (a[2] + b[2]) * 0.5
      );
      SCRATCH_SCALE.set(radius, len + radius * 1.15, radius);
      SCRATCH_MAT.compose(SCRATCH_POS, SCRATCH_QUAT, SCRATCH_SCALE);
      segMesh.setMatrixAt(activeSegs, SCRATCH_MAT);
      activeSegs++;
    }
    segMesh.count = activeSegs;
    segMesh.instanceMatrix.needsUpdate = true;

    let activeBeads = 0;
    const step = Math.max(3, Math.floor(points.length / MAX_SLINGSHOT_BEADS));
    for (
      let idx = 3;
      idx < points.length - 1 && activeBeads < MAX_SLINGSHOT_BEADS;
      idx += step
    ) {
      const pt = points[idx]!;
      const nextPt = points[idx + 1]!;
      const bdx = nextPt[0] - pt[0];
      const bdy = nextPt[1] - pt[1];
      const bdz = nextPt[2] - pt[2];
      const bLen = Math.sqrt(bdx * bdx + bdy * bdy + bdz * bdz);
      const beadSpeed01 =
        lenSpan > 0 ? Math.max(0, Math.min(1, (bLen - minSegLen) / lenSpan)) : 0;
      const frac = idx / Math.max(1, points.length - 1);
      const sparkle =
        (0.017 + frac * 0.021) *
        (1 + beadSpeed01 * flareWeight * 0.72) *
        (0.7 + 0.45 * (0.5 + 0.5 * Math.sin(frame * 0.18 + idx * 0.9)));
      const offsetX = Math.sin(idx * 2.3) * 0.075;
      const offsetY = Math.cos(idx * 1.7) * 0.075;
      SCRATCH_POS.set(pt[0] + offsetX, pt[1] + offsetY, pt[2]);
      SCRATCH_SCALE.set(sparkle, sparkle, sparkle);
      SCRATCH_MAT.compose(SCRATCH_POS, IDENTITY_QUAT, SCRATCH_SCALE);
      beadMesh.setMatrixAt(activeBeads, SCRATCH_MAT);
      activeBeads++;
    }
    beadMesh.count = activeBeads;
    beadMesh.instanceMatrix.needsUpdate = true;
  }, [points, opacity, speedNormalized, slingshotProgress, frame, trailMat, stardustMat]);

  const visible = points.length >= 2 && opacity > 0.02;

  return (
    <group name="lunar-slingshot-stardust-contrail" visible={visible}>
      <instancedMesh
        ref={segMeshRef}
        args={[unitCyl, trailMat, MAX_SLINGSHOT_SEGMENTS]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={beadMeshRef}
        args={[unitSphere, stardustMat, MAX_SLINGSHOT_BEADS]}
        frustumCulled={false}
      />
    </group>
  );
};

/**
 * Tactile thick double-sided die-cut cardboard Moon coin:
 * - Front face (+Z): sunlit sculpted near side (`moon-cutout.png`) on cream die-cut backing
 * - Cylindrical rim: thick warm kraft cardboard (`#D4BFA0`) + sepia archival cut-edge trim rings
 * - Back face (-Z, rotated PI on Y): rich twilight indigo & antique gold Far Side (`moon-farside-cutout.png`)
 * - 6 golden wake-sparkle motes flicking off the rim as the rocket skims past!
 */
const DoubleSidedPaperCoin3D: React.FC<{
  moon: PaperDioramaMoonCoinState;
  visible: boolean;
}> = ({ moon, visible }) => {
  const advance = useThree((s) => s.advance);
  const triggerAdvance = useCallback(() => {
    advance(performance.now());
  }, [advance]);

  const { textures } = usePreloadedTextures3D(MOON_COIN_TEXTURE_SPECS, {
    advance: triggerAdvance,
  });
  const frontTex = textures[MOON_URL] ?? null;
  const backTex = textures[MOON_FARSIDE_URL] ?? null;

  const kraftMaps = useMemo(
    () =>
      getProceduralPbrMaps('cotton-paper', {
        seed: 'skyward-moon-coin-kraft',
        repeat: [6, 1],
      }),
    []
  );

  const w = moon.width;
  const t = moon.thickness;
  const halfT = t * 0.5;
  // Exact 1:1 coin disc alignment measured from both 1024x1024 PNGs (diam = 840px -> r = 0.410 * w)
  const dieCutRadius = w * 0.436;

  const rimCylArgs = useMemo<[number, number, number, number, number, boolean]>(
    () => [dieCutRadius, dieCutRadius, t, 72, 1, true],
    [dieCutRadius, t]
  );
  const trimTorusArgs = useMemo<[number, number, number, number]>(
    () => [dieCutRadius, 0.015, 10, 72],
    [dieCutRadius]
  );
  const backingCircleArgs = useMemo<[number, number]>(
    () => [dieCutRadius, 72],
    [dieCutRadius]
  );
  const facePlaneArgs = useMemo<[number, number]>(() => [w, w], [w]);

  return (
    <group
      name="moon-double-sided-paper-coin"
      position={moon.position}
      visible={visible}
    >
      {/* Spinning double-sided thick cardboard Moon coin */}
      <group
        rotation={[moon.coinWobbleX, moon.coinSpinY, moon.rotZ]}
        scale={moon.scale}
      >
        {/* Thick warm kraft-cardboard cylindrical coin rim (flashes edge-on during coin spin!) */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={rimCylArgs} />
          <meshStandardMaterial
            color="#D4BFA0"
            map={kraftMaps.map}
            bumpMap={kraftMaps.bumpMap}
            roughnessMap={kraftMaps.roughnessMap}
            bumpScale={0.012}
            roughness={0.68}
            metalness={0.14}
          />
        </mesh>

        {/* Crisp sepia archival cut-edge trim rings framing front & back bevels */}
        <mesh position={[0, 0, halfT]}>
          <torusGeometry args={trimTorusArgs} />
          <meshStandardMaterial
            color="#6E5136"
            roughness={0.58}
            metalness={0.18}
          />
        </mesh>
        <mesh position={[0, 0, -halfT]}>
          <torusGeometry args={trimTorusArgs} />
          <meshStandardMaterial
            color="#6E5136"
            roughness={0.58}
            metalness={0.18}
          />
        </mesh>

        {/* Front cream die-cut paper disc (+Z) */}
        <mesh position={[0, 0, halfT - 0.002]} receiveShadow>
          <circleGeometry args={backingCircleArgs} />
          <meshStandardMaterial color="#FAF4E6" roughness={0.86} metalness={0.02} />
        </mesh>

        {/* Front Near-Side Moon artwork (+Z) */}
        <mesh position={[0, 0, halfT + 0.004]}>
          <planeGeometry args={facePlaneArgs} />
          <meshStandardMaterial
            key={frontTex ? 'moon-front-loaded' : 'moon-front-pending'}
            color={frontTex ? '#FFFFFF' : '#F3EAD7'}
            map={frontTex}
            transparent
            alphaTest={0.25}
            roughness={0.82}
            metalness={0.02}
            emissive="#F6E6C6"
            emissiveIntensity={0.09}
          />
        </mesh>

        {/* Back cream die-cut paper disc (-Z, rotated PI on Y) */}
        <mesh
          position={[0, 0, -halfT + 0.002]}
          rotation={[0, Math.PI, 0]}
          receiveShadow
        >
          <circleGeometry args={backingCircleArgs} />
          <meshStandardMaterial color="#FAF4E6" roughness={0.86} metalness={0.02} />
        </mesh>

        {/* Reverse Far-Side Moon artwork (-Z, rotated PI on Y -> faces camera at coinSpinY = 3*PI!) */}
        <mesh
          position={[0, 0, -halfT - 0.004]}
          rotation={[0, Math.PI, 0]}
        >
          <planeGeometry args={facePlaneArgs} />
          <meshStandardMaterial
            key={backTex ? 'moon-back-loaded' : 'moon-back-pending'}
            color={backTex ? '#FFFFFF' : '#263B5E'}
            map={backTex}
            transparent
            alphaTest={0.25}
            roughness={0.78}
            metalness={0.05}
            emissive="#D8B362"
            emissiveIntensity={0.09}
          />
        </mesh>
      </group>

      {/* 6 delicate golden wake-sparkle motes flicking off the Moon rim as rocket skims past */}
      <group
        name="moon-wake-sparkles"
        visible={moon.wakePulse > 0.02}
      >
        {WAKE_SPARKLE_ANGLES.map((angle, idx) => {
          const burstR =
            dieCutRadius + 0.14 + (1 - moon.wakePulse * 0.35) * (0.38 + (idx % 2) * 0.18);
          const sx = Math.cos(angle) * burstR;
          const sy = Math.sin(angle) * burstR;
          const sScale = Math.max(0.01, moon.wakePulse * (0.75 + (idx % 3) * 0.28));
          return (
            <mesh
              key={`wake-spark-${idx}`}
              position={[sx, sy, 0.16]}
              scale={sScale}
            >
              <sphereGeometry args={WAKE_SPARKLE_ARGS} />
              <meshBasicMaterial
                color={idx % 2 === 0 ? '#FFE8A3' : '#FFFDF5'}
                transparent
                opacity={moon.wakePulse * 0.92}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
};

// ============================================================================
// Main 3D Stage Content
// ============================================================================

const SkywardCanvasContent: React.FC<{
  durationInFrames: number;
  shadowMapSize: number;
}> = ({ durationInFrames, shadowMapSize }) => {
  const frame = useCurrentFrame();

  const brassMaps = useMemo(
    () =>
      getProceduralPbrMaps('brushed-metal', {
        seed: 'skyward-pad-brass',
        repeat: [2, 2],
      }),
    []
  );

  const state = evaluatePaperDioramaFrame(
    Math.max(1, frame),
    durationInFrames
  );
  const earthRadius = state.earthLimb.radius;

  const earthBodyArgs = useMemo<[number, number, number, number]>(
    () => [earthRadius - 0.06, 96, 0.28 * Math.PI, 0.44 * Math.PI],
    [earthRadius]
  );
  const earthCloudArgs = useMemo<[number, number, number, number, number]>(
    () => [earthRadius - 0.34, 0.22, 10, 96, Math.PI * 0.44],
    [earthRadius]
  );
  const earthAtmoArgs = useMemo<[number, number, number, number, number]>(
    () => [earthRadius + 0.04, 0.32, 12, 96, Math.PI * 0.44],
    [earthRadius]
  );
  const earthHazeArgs = useMemo<[number, number, number, number, number]>(
    () => [earthRadius + 0.28, 0.46, 10, 96, Math.PI * 0.44],
    [earthRadius]
  );

  if (frame <= 0) return null;

  const camY = state.camera.position[1];
  const flameScaleY = Math.max(
    0.01,
    state.thrusterIntensity * (0.88 + (state.thrusterPulse - 0.92) * 0.85)
  );
  const flameScaleXZ = Math.max(
    0.01,
    0.78 + state.thrusterIntensity * 0.26
  );
  const flameSwayZ =
    Math.sin(frame * 0.42) * (0.055 * (1 - state.slingshotSpeedNormalized * 0.45));
  const nozzleBack = 1.08 * state.rocket.scale[1];
  const nozzleLightX =
    state.rocket.position[0] + Math.sin(state.rocket.rotZ) * nozzleBack;
  const nozzleLightY =
    state.rocket.position[1] - Math.cos(state.rocket.rotZ) * nozzleBack;
  const nozzleLightZ = state.rocket.position[2] + 0.45;

  return (
    <>
      <ChaseCameraRig3D camera={state.camera} />
      <AscentLightingRig3D
        rocketY={state.rocket.position[1]}
        ambientIntensity={state.sky.ambientIntensity}
        shadowMapSize={shadowMapSize}
      />

      {/* Warm thruster glow tracking rotated rocket nozzle (illuminates launch smoke, clouds & spinning Moon rim!) */}
      <pointLight
        position={[nozzleLightX, nozzleLightY, nozzleLightZ]}
        color={state.thrusterIntensity > 1.12 ? '#FFD166' : '#FFA94D'}
        intensity={
          state.thrusterIntensity *
          state.thrusterPulse *
          (2.4 + state.slingshotSpeedNormalized * 1.4)
        }
        distance={7.4}
        decay={2}
      />

      {/* ================================================================ */}
      {/* 1. Sunlit Meadow Launchpad, Hills & Brass Gantry (y ~ 0..3.5)    */}
      {/* ================================================================ */}
      <group name="skyward-launchpad-meadow" visible={camY < 14}>
        {/* Grounded craft launchpad deck plinth */}
        <mesh position={[0, -0.26, 0]} receiveShadow>
          <boxGeometry args={DECK_BOX_ARGS} />
          <meshStandardMaterial
            color="#E8DFCE"
            roughness={0.86}
            metalness={0.02}
          />
        </mesh>

        {/* Stepped brushed-brass launch pad cradle meeting rocket fins cleanly */}
        <group position={[0, 0.01, 0]}>
          <mesh receiveShadow>
            <cylinderGeometry args={PAD_RING_OUTER_ARGS} />
            <meshStandardMaterial
              color="#C9933B"
              map={brassMaps.map}
              roughnessMap={brassMaps.roughnessMap}
              roughness={0.34}
              metalness={0.76}
            />
          </mesh>
          <mesh position={[0, 0.024, 0]} receiveShadow>
            <cylinderGeometry args={PAD_RING_INNER_ARGS} />
            <meshStandardMaterial color="#374151" roughness={0.78} metalness={0.14} />
          </mesh>
          <mesh position={[0, 0.068, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={PAD_TORUS_ARGS} />
            <meshStandardMaterial color="#E6B85C" roughness={0.28} metalness={0.82} />
          </mesh>
        </group>

        {/* Layered rolling paper meadow hills popping up via PopUpHinge3D */}
        <PopUpHinge3D foldProgress={state.meadowPopUp} position={[0, -0.02, -2.2]}>
          <PaperCutout3D
            cacheKey="skyward-hill-back"
            width={11.8}
            height={3.2}
            pixelWidth={768}
            pixelHeight={320}
            whiteBorderPx={14}
            anchor="bottom"
            thickness={0.05}
            draw={drawMeadowHillBack}
          />
        </PopUpHinge3D>

        <PopUpHinge3D foldProgress={state.meadowPopUp} position={[0.4, -0.02, -1.48]}>
          <PaperCutout3D
            cacheKey="skyward-hill-mid"
            width={10.4}
            height={2.35}
            pixelWidth={768}
            pixelHeight={280}
            whiteBorderPx={12}
            anchor="bottom"
            thickness={0.045}
            draw={drawMeadowHillFront}
          />
        </PopUpHinge3D>

        <PopUpHinge3D foldProgress={state.meadowPopUp} position={[-2.9, -0.02, 1.48]}>
          <PaperCutout3D
            cacheKey="skyward-hill-fg-left"
            width={4.6}
            height={1.35}
            pixelWidth={768}
            pixelHeight={280}
            whiteBorderPx={10}
            anchor="bottom"
            thickness={0.04}
            draw={drawMeadowHillFront}
          />
        </PopUpHinge3D>

        <PopUpHinge3D foldProgress={state.meadowPopUp} position={[3.1, -0.02, 1.42]}>
          <PaperCutout3D
            cacheKey="skyward-hill-fg-right"
            width={4.4}
            height={1.25}
            pixelWidth={768}
            pixelHeight={280}
            whiteBorderPx={10}
            anchor="bottom"
            thickness={0.04}
            draw={drawMeadowHillFront}
          />
        </PopUpHinge3D>

        {/* Handcrafted Brass Launch Gantry Tower (`z = -0.86`) */}
        <group
          position={state.gantry.position}
          scale={state.gantry.scale}
        >
          <PaperCutout3D
            cacheKey="skyward-brass-gantry"
            width={state.gantry.width * 1.45}
            height={state.gantry.height}
            pixelWidth={256}
            pixelHeight={512}
            whiteBorderPx={10}
            anchor="center"
            thickness={0.055}
            draw={drawBrassGantry}
          />
        </group>

        {/* 8 Billowing Cotton-Paper Launch Smoke Puffs (always mounted -> 0 mid-playback hitches) */}
        {state.launchSmokePuffs.map((puff) => (
          <group key={puff.id} visible={puff.opacity > 0.02 && puff.scale > 0.02}>
            <PaperCutout3D
              cacheKey="skyward-smoke-puff"
              width={1.15}
              height={1.15}
              pixelWidth={256}
              pixelHeight={256}
              whiteBorderPx={8}
              position={puff.position}
              scale={Math.max(0.01, puff.scale)}
              opacity={puff.opacity}
              anchor="center"
              thickness={0.03}
              castShadow={false}
              draw={drawSmokePuff}
            />
          </group>
        ))}
      </group>

      {/* ================================================================ */}
      {/* 2. Hero Upright Paper Rocket + Storybook Flame + Zero-G RCS      */}
      {/* ================================================================ */}
      <group
        name="skyward-hero-rocket"
        position={state.rocket.position}
        rotation={[0, state.rocket.rotY, state.rocket.rotZ]}
        scale={state.rocket.scale}
        visible={state.rocket.opacity > 0.01}
      >
        <ImageCutout3D
          src={ROCKET_URL}
          width={state.rocket.width}
          height={state.rocket.height}
          thickness={state.rocket.thickness}
          opacity={state.rocket.opacity}
          whiteBorderPx={14}
          anchor="center"
        />

        {/* Rounded, scalloped storybook paper-craft teardrop flame tucked cleanly under nozzle */}
        <group
          name="rocket-thruster-flame"
          position={[0, -state.rocket.height * 0.35, -0.025]}
          rotation={[0, 0, flameSwayZ]}
          visible={state.thrusterIntensity > 0.02 && state.rocket.opacity > 0.05}
          scale={[flameScaleXZ, flameScaleY, 1]}
        >
          <PaperCutout3D
            cacheKey="skyward-storybook-flame"
            width={0.66}
            height={0.88}
            pixelWidth={256}
            pixelHeight={320}
            whiteBorderPx={7}
            opacity={state.rocket.opacity}
            anchor="top"
            thickness={0.024}
            castShadow={false}
            emissive={state.thrusterIntensity > 1.12 ? '#FFD166' : '#F2763A'}
            emissiveIntensity={0.45 + Math.max(0, state.thrusterIntensity - 0.85) * 1.15}
            draw={drawStorybookFlame}
          />
        </group>

        {/* 4 tiny looping cotton-paper exhaust puffs drifting gently downward during powered climb */}
        {TRAIL_PUFF_PHASES.map((phase, idx) => {
          const u = ((frame * 0.042 + phase) % 1 + 1) % 1;
          const puffOpacity =
            state.thrusterIntensity > 0.14
              ? Math.sin(u * Math.PI) * state.thrusterIntensity * 0.82
              : 0;
          const puffScale = 0.24 + 0.22 * Math.sin(u * Math.PI);
          const driftX = Math.sin(idx * 2.1 + u * 3.4) * 0.15;
          const driftY = -state.rocket.height * 0.54 - u * 0.92;
          return (
            <group
              key={`trail-puff-${idx}`}
              visible={puffOpacity > 0.04 && state.altitudeY > 0.35}
            >
              <PaperCutout3D
                cacheKey="skyward-smoke-puff"
                width={1.0}
                height={1.0}
                pixelWidth={256}
                pixelHeight={256}
                whiteBorderPx={8}
                position={[driftX, driftY, -0.045 - idx * 0.008]}
                scale={Math.max(0.01, puffScale)}
                opacity={puffOpacity}
                anchor="center"
                thickness={0.02}
                castShadow={false}
                draw={drawSmokePuff}
              />
            </group>
          );
        })}

        {/* Tiny twinkling zero-G RCS attitude puffs during Moon arrival */}
        <group visible={state.rcsPulse > 0.04}>
          <mesh
            position={[-0.62, -0.42, 0.02]}
            scale={0.55 + state.rcsPulse * 0.85}
          >
            <sphereGeometry args={RCS_PUFF_ARGS} />
            <meshBasicMaterial
              color="#E0F2FE"
              transparent
              opacity={state.rcsPulse * 0.78}
            />
          </mesh>
          <mesh
            position={[0.58, 0.28, 0.02]}
            scale={0.45 + state.rcsPulse * 0.72}
          >
            <sphereGeometry args={RCS_PUFF_ARGS} />
            <meshBasicMaterial
              color="#FFF8E1"
              transparent
              opacity={state.rcsPulse * 0.72}
            />
          </mesh>
        </group>
      </group>

      {/* ================================================================ */}
      {/* 3. 10 Layered Parallax Paper Clouds (6 BG + 4 Fast FG)           */}
      {/* ================================================================ */}
      {state.clouds.map((cloud) => {
        const inView = Math.abs(cloud.position[1] - camY) < 12;
        return (
          <group key={cloud.id} visible={inView}>
            <PaperCutout3D
              cacheKey="skyward-paper-cloud"
              width={cloud.width}
              height={cloud.height}
              pixelWidth={512}
              pixelHeight={256}
              whiteBorderPx={12}
              position={cloud.position}
              opacity={cloud.opacity}
              anchor="center"
              thickness={0.036}
              castShadow={!cloud.isForeground}
              draw={drawPaperCloud}
            />
          </group>
        );
      })}

      {/* ================================================================ */}
      {/* 4. Natural Asymmetrical Flock of 5 Individual Soaring Swallows   */}
      {/* ================================================================ */}
      {state.birds.map((bird) => {
        const inView = Math.abs(bird.position[1] - camY) < 11;
        return (
          <group
            key={bird.id}
            position={bird.position}
            rotation={[bird.rotX ?? 0, bird.rotY, bird.rotZ]}
            scale={bird.scale}
            visible={inView}
          >
            <ImageCutout3D
              src={BIRD_SINGLE_URL}
              width={bird.width}
              height={bird.height}
              thickness={bird.thickness}
              whiteBorderPx={12}
              anchor="center"
            />
          </group>
        );
      })}

      {/* ================================================================ */}
      {/* 5. Vintage Paper Airliner + Trailing Paper Contrail (y ~ 25.4)   */}
      {/* ================================================================ */}
      <group visible={Math.abs(state.airliner.position[1] - camY) < 12}>
        <AirlinerContrail3D
          points={state.airliner.contrailPoints}
          visible={Math.abs(state.airliner.position[1] - camY) < 12}
        />
        <group
          position={state.airliner.position}
          rotation={[0, state.airliner.rotY, state.airliner.rotZ]}
          scale={state.airliner.scale}
        >
          <ImageCutout3D
            src={AIRLINER_URL}
            width={state.airliner.width}
            height={state.airliner.height}
            thickness={state.airliner.thickness}
            whiteBorderPx={12}
            anchor="center"
          />
        </group>
      </group>

      {/* ================================================================ */}
      {/* 6. Glowing Curved Earth Atmosphere Limb (visible in Stage 5!)    */}
      {/* ================================================================ */}
      <group
        name="earth-curvature-limb"
        position={[
          state.earthLimb.position[0],
          state.earthLimb.position[1] - state.earthLimb.radius,
          state.earthLimb.position[2],
        ]}
        visible={state.earthLimb.opacity > 0.02 && camY > 24}
      >
        {/* Deep curved ocean-indigo Earth horizon disc */}
        <mesh>
          <circleGeometry args={earthBodyArgs} />
          <meshBasicMaterial
            color="#13316B"
            transparent
            opacity={state.earthLimb.opacity * 0.92}
          />
        </mesh>
        {/* Soft pale-cream high-altitude orbital cloud band */}
        <mesh position={[0, 0, 0.03]} rotation={[0, 0, Math.PI * 0.28]}>
          <torusGeometry args={earthCloudArgs} />
          <meshBasicMaterial
            color="#E2EEFF"
            transparent
            opacity={state.earthLimb.opacity * 0.34}
          />
        </mesh>
        {/* Luminous cyan-azure atmosphere rim arc */}
        <mesh position={[0, 0, 0.06]} rotation={[0, 0, Math.PI * 0.28]}>
          <torusGeometry args={earthAtmoArgs} />
          <meshBasicMaterial
            color="#7DD3FC"
            transparent
            opacity={state.earthLimb.opacity * 0.88}
          />
        </mesh>
        {/* Soft pale-blue outer atmospheric glow halo */}
        <mesh position={[0, 0, 0.04]} rotation={[0, 0, Math.PI * 0.28]}>
          <torusGeometry args={earthHazeArgs} />
          <meshBasicMaterial
            color="#BAE6FD"
            transparent
            opacity={state.earthLimb.opacity * 0.42}
          />
        </mesh>
      </group>

      {/* ================================================================ */}
      {/* 7. 2 Golden Orbital Paper Satellites (y = 37.8 & 43.2)           */}
      {/* ================================================================ */}
      {state.satellites.map((sat) => {
        const inView = Math.abs(sat.position[1] - camY) < 12;
        return (
          <group
            key={sat.id}
            position={sat.position}
            rotation={[0, sat.rotY, sat.rotZ]}
            scale={sat.scale}
            visible={inView}
          >
            <ImageCutout3D
              src={SATELLITE_URL}
              width={sat.width}
              height={sat.height}
              thickness={sat.thickness}
              whiteBorderPx={12}
              anchor="center"
              emissive="#E8B959"
              emissiveIntensity={0.08}
            />
          </group>
        );
      })}

      {/* ================================================================ */}
      {/* 8. Lunar Slingshot Contrail, Moon, Ringed Planet & 38 Stars      */}
      {/* ================================================================ */}
      <LunarSlingshotContrail3D
        points={state.slingshotTrailPoints}
        opacity={state.slingshotTrailOpacity}
        speedNormalized={state.slingshotSpeedNormalized}
        slingshotProgress={state.slingshotProgress}
        frame={frame}
      />

      {/* Crisp twinkling star-glint where the boosted rocket vanishes into deep space */}
      <group
        name="departure-star-glint"
        visible={
          state.departureStarGlint.opacity > 0.02 &&
          state.departureStarGlint.scale > 0.02
        }
      >
        <PaperCutout3D
          cacheKey="skyward-golden-star"
          width={1.2}
          height={1.2}
          pixelWidth={192}
          pixelHeight={192}
          whiteBorderPx={5}
          position={state.departureStarGlint.position}
          scale={Math.max(0.01, state.departureStarGlint.scale)}
          opacity={state.departureStarGlint.opacity}
          anchor="center"
          thickness={0.016}
          castShadow={false}
          emissive="#FFF8E2"
          emissiveIntensity={1.25}
          draw={drawGoldenStar}
        />
      </group>

      <DoubleSidedPaperCoin3D moon={state.moon} visible={camY > 40} />

      <group
        position={state.ringedPlanet.position}
        rotation={[0, 0, state.ringedPlanet.rotZ]}
        scale={state.ringedPlanet.scale}
        visible={state.ringedPlanet.opacity > 0.02 && camY > 40}
      >
        <PaperCutout3D
          cacheKey="skyward-ringed-planet"
          width={2.0}
          height={1.6}
          pixelWidth={320}
          pixelHeight={256}
          whiteBorderPx={10}
          opacity={state.ringedPlanet.opacity}
          anchor="center"
          thickness={0.035}
          castShadow={false}
          draw={drawRingedPlanet}
        />
      </group>

      {/* 18 Twinkling Golden/Ivory Paper Stars (always mounted -> 0 mid-playback hitches) */}
      {state.stars.map((star) => (
        <group
          key={star.id}
          visible={star.twinkle > 0.02 && Math.abs(star.position[1] - camY) < 14}
        >
          <PaperCutout3D
            cacheKey="skyward-golden-star"
            width={1.0}
            height={1.0}
            pixelWidth={192}
            pixelHeight={192}
            whiteBorderPx={5}
            position={star.position}
            scale={Math.max(0.01, star.scale)}
            opacity={star.twinkle}
            anchor="center"
            thickness={0.016}
            castShadow={false}
            emissive={star.color}
            emissiveIntensity={star.twinkle * 0.72}
            draw={drawGoldenStar}
          />
        </group>
      ))}
    </>
  );
};

// ============================================================================
// Dynamic Sky Backdrop & Frameless Editorial Chrome Layers
// ============================================================================

const SkyBackdropLayer: React.FC<{ durationInFrames: number }> = React.memo(
  ({ durationInFrames }) => {
    const frame = useCurrentFrame();
    if (frame <= 0) return null;
    const { sky } = evaluatePaperDioramaFrame(frame, durationInFrames);

    return (
      <AbsoluteFill
        style={{
          boxSizing: 'border-box',
          background: `linear-gradient(180deg, ${sky.skyTopColor} 0%, ${sky.skyBottomColor} 100%)`,
        }}
      >
        {/* Subtle warm sunlight bloom in lower atmosphere fading smoothly into space */}
        {sky.ambientIntensity > 0.45 ? (
          <AbsoluteFill
            style={{
              pointerEvents: 'none',
              opacity: Math.max(0, (sky.ambientIntensity - 0.45) * 1.15),
              background:
                'radial-gradient(ellipse 80% 55% at 22% 18%, rgba(255, 248, 226, 0.45) 0%, rgba(255, 248, 226, 0) 70%)',
            }}
          />
        ) : null}
      </AbsoluteFill>
    );
  }
);

const SkywardEditorialChrome: React.FC<{
  durationInFrames: number;
  headline: string;
  subline: string;
}> = React.memo(({ durationInFrames, headline, subline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame <= 0) return null;

  const state = evaluatePaperDioramaFrame(frame, durationInFrames);
  const headSpring = spring({
    frame: Math.max(0, frame - 2),
    fps,
    config: JOYFUL_SPRING,
  });
  const ribbonSpring = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: JOYFUL_SPRING,
  });

  const altTag =
    state.activeChapterId === 'space'
      ? `MOON ORBIT  •  ${CHAPTER_LABELS[state.activeChapterId]}`
      : `${state.altitudeKm} KM  •  ${CHAPTER_LABELS[state.activeChapterId]}`;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', boxSizing: 'border-box' }}>
      <FloatingEditorialDisplay
        eyebrow={altTag}
        headline={headline}
        subline={subline}
        align="left"
        position="top"
        tone={state.sky.overlayTone}
        headlinePx={50}
        sublinePx={21}
        enterFrame={2}
        style={{
          transform: `translate3d(0, ${((1 - headSpring) * -16).toFixed(2)}px, 0)`,
          willChange: 'transform',
        }}
      />
      <PaperRibbonTimeline
        milestones={PAPER_DIORAMA_MILESTONES}
        activeId={state.activeChapterId}
        position="bottom"
        enterFrame={3}
        style={{
          transform: `translate3d(0, ${((1 - ribbonSpring) * 16).toFixed(2)}px, 0)`,
          willChange: 'transform',
        }}
      />
    </AbsoluteFill>
  );
});

const CleanFrameZeroCover: React.FC<{ color: string }> = React.memo(
  ({ color }) => {
    const frame = useCurrentFrame();
    if (frame > 0) return null;
    return (
      <AbsoluteFill
        style={{ backgroundColor: color, zIndex: 50, pointerEvents: 'none' }}
      />
    );
  }
);

const PaperDioramaDemoInner: React.FC<PaperDioramaDemoProps> = React.memo(
  ({ headline, subline, voiceoverVolume, musicVolume, sfxVolume }) => {
    const { width, height, durationInFrames } = useVideoConfig();
    const outerStyle = useStudioStyle();
    const { isRendering } = getRemotionEnvironment();

    return (
      <AbsoluteFill style={{ boxSizing: 'border-box' }}>
        <SkyBackdropLayer durationInFrames={durationInFrames} />
        <ThreeCanvas
          width={width}
          height={height}
          shadows={isRendering ? 'percentage' : true}
          dpr={isRendering ? RENDER_DPR : 1}
          gl={THREE_GL_CONFIG}
        >
          <StyleProvider style="tactile-craft">
            <SkywardCanvasContent
              durationInFrames={durationInFrames}
              shadowMapSize={isRendering ? 2048 : 1024}
            />
          </StyleProvider>
        </ThreeCanvas>
        <SkywardEditorialChrome
          durationInFrames={durationInFrames}
          headline={headline}
          subline={subline}
        />

        {/* Bounded eleven_v4 voiceover tracks (zero unbounded <Audio> pool leaks) */}
        {PAPER_DIORAMA_VO_TIMELINE.map((seg) => {
          const voiceover = VOICEOVER_MANIFEST[seg.sceneId];
          if (!voiceover?.audioFile) return null;
          const boundedDur = Math.max(
            1,
            Math.min(durationInFrames - seg.fromFrame, seg.durationInFrames)
          );
          return (
            <Sequence
              key={seg.sceneId}
              from={seg.fromFrame}
              durationInFrames={boundedDur}
              layout="none"
            >
              <VoiceoverTrack
                voiceover={voiceover}
                fromFrame={0}
                durationInFrames={boundedDur}
                volume={voiceoverVolume}
              />
            </Sequence>
          );
        })}

        {/* Ascending 3-section score with automatic speech-aware ducking & smooth outro fade */}
        {SCORE_SRC ? (
          <SmartMusicBed
            src={SCORE_SRC}
            dialogueSegments={DUCKING_SEGMENTS}
            voiceoverManifest={VOICEOVER_MANIFEST}
            baseVolume={musicVolume}
            duckedVolume={Math.min(musicVolume * 0.36, 0.1)}
            fadeOutFrames={72}
          />
        ) : null}

        {/* 5 bounded tactile paper-craft SFX cues (incl. spinning Moon coin-flip at f=882) */}
        {RESOLVED_SFX_CUES.map((cue) => (
          <Sequence
            key={cue.key}
            from={cue.fromFrame}
            durationInFrames={cue.durationInFrames}
            layout="none"
          >
            <SoundCue
              src={cue.src}
              atFrame={0}
              durationInFrames={cue.durationInFrames}
              volume={Math.min(1, cue.baseVolume * (sfxVolume / 0.22))}
            />
          </Sequence>
        ))}

        <CleanFrameZeroCover color={outerStyle.palette.bgCanvas} />
      </AbsoluteFill>
    );
  }
);

export const PaperDioramaDemo: React.FC<Partial<PaperDioramaDemoProps>> = (
  incomingProps
) => {
  const merged: PaperDioramaDemoProps = {
    ...(paperDioramaDefaults as PaperDioramaDemoProps),
    ...incomingProps,
  };

  return (
    <StyleProvider style={merged.styleId} renderBackdrop>
      <PaperDioramaDemoInner {...merged} />
    </StyleProvider>
  );
};

export { PAPER_DIORAMA_DURATION_FRAMES };
