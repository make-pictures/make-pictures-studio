import React, { useCallback, useEffect, useMemo } from 'react';
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
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { z } from 'zod';
import {
  DirectorCamera3D,
  SmartMusicBed,
  SoundCue,
  StyleProvider,
  VoiceoverTrack,
  useStudioStyle,
  type DialogueDuckingSegment,
} from '@make-pictures/core';
import {
  ClayCharacter3D,
  PodcastStudioSet3D,
} from '@make-pictures/kits/isometric-3d';
import {
  DaylightArcRig3D,
  getProceduralPbrMaps,
  usePreloadedTextures3D,
} from '@make-pictures/kits/tactile-3d';
import {
  FloatingEditorialDisplay,
  PaperRibbonTimeline,
} from '@make-pictures/kits/editorial-collage';
import {
  DEFAULT_ISOMETRIC_DIALOGUE_TIMELINE,
  ISOMETRIC_DIALOGUE_DURATION_FRAMES,
  evaluateIsometricDialogueFrame,
  type IsometricCountdownLabel,
  type IsometricMugKinematics,
} from './isometricDialogueKinematics';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from './generated/audio-manifest';
import isometricDefaults from './IsometricDialogueDemo.props.json';

export const isometricDialogueSchema = z.object({
  styleId: z
    .string()
    .describe('Colors & Style :: Base Style (Style ID)'),
  headline: z
    .string()
    .describe('Story & Titles :: Headline'),
  subline: z
    .string()
    .describe('Story & Titles :: Subtitle'),
  mayaName: z
    .string()
    .describe('Host A (Left) :: Name'),
  mayaColor: z
    .string()
    .describe('Host A (Left) :: Sweater Color'),
  leoName: z
    .string()
    .describe('Host B (Right) :: Name'),
  leoColor: z
    .string()
    .describe('Host B (Right) :: Sweater Color'),
  cameraZoom: z
    .number()
    .min(90)
    .max(145)
    .describe('Stage & Camera :: Framing Bias'),
  voiceoverVolume: z
    .number()
    .min(0)
    .max(1.5)
    .describe('Audio :: Dialogue Volume'),
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

export type IsometricDialogueDemoProps = z.infer<
  typeof isometricDialogueSchema
>;

// ============================================================================
// Module-Scope Static Constants & Audio Descriptors (Zero 60 Hz Allocations)
// ============================================================================

const EASTER_EGG_ROCKET_URL = staticFile(
  'examples/paper-diorama/images/rocket-cutout.png'
);
const STUDIO_TEXTURE_SPECS = [{ src: EASTER_EGG_ROCKET_URL }] as const;

const THREE_GL_CONFIG = {
  antialias: true,
  toneMapping: THREE.ACESFilmicToneMapping,
  powerPreference: 'high-performance' as const,
};
const RENDER_DPR: [number, number] = [1, 2];

const ORIGIN_POS: [number, number, number] = [0, 0, 0];
const RIM_LIGHT_POS: [number, number, number] = [2.4, 2.9, -1.6];

// Framed Skyward easter-egg gallery print geometry tuples
const EGG_FRAME_OUTER_ARGS: [number, number, number] = [0.76, 0.76, 0.044];
const EGG_FRAME_MAT_ARGS: [number, number, number] = [0.66, 0.66, 0.016];
const EGG_FRAME_SKY_ARGS: [number, number] = [0.52, 0.52];
const EGG_FRAME_PRINT_ARGS: [number, number] = [0.46, 0.46];
const EGG_FRAME_RAIL_ARGS: [number, number, number] = [0.82, 0.026, 0.056];

// LED countdown clock geometry tuples
const CLOCK_CASING_ARGS: [number, number, number] = [0.96, 0.34, 0.09];
const CLOCK_SCREEN_ARGS: [number, number] = [0.84, 0.24];
const CLOCK_TRIM_ARGS: [number, number, number] = [0.99, 0.024, 0.1];

// Bouncing ceramic mug & coaster geometry tuples
const COASTER_CYL_ARGS: [number, number, number, number] = [0.078, 0.082, 0.014, 28];
const SHADOW_DISC_ARGS: [number, number] = [0.068, 24];
const MUG_BODY_ARGS: [number, number, number, number] = [0.056, 0.05, 0.118, 28];
const MUG_BAND_ARGS: [number, number, number, number] = [0.0575, 0.0555, 0.026, 28];
const MUG_HANDLE_ARGS: [number, number, number, number, number] = [
  0.03,
  0.011,
  12,
  20,
  Math.PI,
];
const MUG_COFFEE_ARGS: [number, number, number, number] = [0.047, 0.047, 0.008, 24];
const MUG_SPARKLE_ARGS: [number, number, number] = [0.014, 10, 8];

// Wobbling desk tally boom accent geometry tuples
const MIC_BASE_ARGS: [number, number, number, number] = [0.062, 0.07, 0.026, 24];
const MIC_STEM_ARGS: [number, number, number, number] = [0.012, 0.014, 0.28, 16];
const MIC_RING_ARGS: [number, number, number, number] = [0.054, 0.011, 14, 28];
const MIC_CAPSULE_ARGS: [number, number, number, number] = [0.028, 0.048, 12, 20];

// Soundboard panic LED tuples
const LED_DOT_ARGS: [number, number, number] = [0.013, 12, 10];
const LED_X_OFFSETS = [-0.1, -0.035, 0.035, 0.1] as const;

const COUNTDOWN_LABELS: ReadonlyArray<IsometricCountdownLabel> = [
  '00:05',
  '00:04',
  '00:03',
  '00:02',
  '00:01',
  'LIVE',
] as const;

const JOYFUL_SPRING = { damping: 16, stiffness: 200, mass: 0.78 } as const;

const SCORE_SRC = MUSIC_MANIFEST?.audioFile
  ? staticFile(MUSIC_MANIFEST.audioFile)
  : null;

const DUCKING_SEGMENTS: DialogueDuckingSegment[] =
  DEFAULT_ISOMETRIC_DIALOGUE_TIMELINE.voTimeline.map((seg) => ({
    sceneId: seg.sceneId,
    fromFrame: seg.fromFrame,
    durationInFrames: seg.durationInFrames,
  }));

const RESOLVED_SFX_CUES = DEFAULT_ISOMETRIC_DIALOGUE_TIMELINE.sfxTimeline
  .map((cue) => {
    const entry = SFX_MANIFEST[cue.sfxId];
    if (!entry?.audioFile) return null;
    return {
      key: `${cue.sfxId}-${cue.fromFrame}`,
      fromFrame: cue.fromFrame,
      durationInFrames: cue.durationInFrames,
      src: staticFile(entry.audioFile),
      baseVolume: cue.volume ?? 0.22,
    };
  })
  .filter((item): item is NonNullable<typeof item> => item !== null);

// ============================================================================
// Pure Deterministic Canvas Texture Factory for 3D Studio LED Countdown Clock
// ============================================================================

function createCountdownLedTexture(
  label: IsometricCountdownLabel
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const isLive = label === 'LIVE';
    const isUrgent = label === '00:02' || label === '00:01';
    const isWarn = label === '00:04' || label === '00:03';

    const digitColor = isLive
      ? '#FFF7E8'
      : isUrgent
        ? '#FF6B47'
        : isWarn
          ? '#FFA142'
          : '#F7C96A';
    const glowColor = isLive
      ? 'rgba(255, 77, 46, 0.92)'
      : isUrgent
        ? 'rgba(255, 84, 51, 0.85)'
        : isWarn
          ? 'rgba(255, 148, 56, 0.72)'
          : 'rgba(247, 198, 92, 0.55)';

    // Deep studio OLED glass backing
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 192);
    bgGrad.addColorStop(0, isLive ? '#29100C' : '#181411');
    bgGrad.addColorStop(1, isLive ? '#1A0A07' : '#0E0C0A');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 512, 192);

    // Subtle warm scanline grid for tactile studio hardware charm
    ctx.fillStyle = 'rgba(255, 245, 226, 0.035)';
    for (let y = 6; y < 192; y += 8) {
      ctx.fillRect(10, y, 492, 2);
    }

    // Fine recessed border
    ctx.strokeStyle = isLive
      ? 'rgba(255, 118, 82, 0.65)'
      : 'rgba(245, 198, 118, 0.28)';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 492, 172);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = isLive ? 28 : 20;

    if (isLive) {
      // Glowing live broadcast tally dot + bold crisp LIVE text
      ctx.fillStyle = '#FF4D2E';
      ctx.beginPath();
      ctx.arc(128, 97, 22, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFE8DE';
      ctx.beginPath();
      ctx.arc(122, 91, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = digitColor;
      ctx.font = '800 94px "Plus Jakarta Sans", "Inter", system-ui, sans-serif';
      ctx.fillText('LIVE', 298, 100);
    } else {
      ctx.fillStyle = digitColor;
      ctx.font =
        '800 108px "JetBrains Mono", "SF Mono", "Menlo", monospace';
      ctx.fillText(label, 256, 102);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

// ============================================================================
// Focused 3D Studio Props (Zero Per-Frame GPU Allocation)
// ============================================================================

const StudioCountdownClock3D: React.FC<{
  position: [number, number, number];
  label: IsometricCountdownLabel;
  pulse: number;
  isOnAir: boolean;
  metalMaps: ReturnType<typeof getProceduralPbrMaps>;
}> = ({ position, label, pulse, isOnAir, metalMaps }) => {
  const textures = useMemo(() => {
    const map = {} as Record<IsometricCountdownLabel, THREE.CanvasTexture>;
    for (const key of COUNTDOWN_LABELS) {
      map[key] = createCountdownLedTexture(key);
    }
    return map;
  }, []);

  useEffect(() => {
    return () => {
      for (const key of COUNTDOWN_LABELS) {
        textures[key].dispose();
      }
    };
  }, [textures]);

  const activeTexture = textures[label];
  const emissiveBoost = isOnAir ? 0.92 + pulse * 0.25 : 0.62 + pulse * 0.48;
  const glowTint = isOnAir
    ? '#FF5733'
    : label === '00:02' || label === '00:01'
      ? '#FF7647'
      : '#FFB44C';

  return (
    <group name="studio-led-countdown-clock" position={position}>
      {/* Matte Charcoal Rounded Broadcast Clock Casing */}
      <RoundedBox
        args={CLOCK_CASING_ARGS}
        radius={0.032}
        smoothness={4}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color="#1E1B18"
          roughness={0.44}
          metalness={0.28}
        />
      </RoundedBox>

      {/* Top & Bottom Brushed-Brass Bezel Accent Bars */}
      <mesh position={[0, 0.168, 0.004]} castShadow>
        <boxGeometry args={CLOCK_TRIM_ARGS} />
        <meshStandardMaterial
          color="#C9933B"
          map={metalMaps.map}
          roughnessMap={metalMaps.roughnessMap}
          roughness={0.32}
          metalness={0.78}
        />
      </mesh>
      <mesh position={[0, -0.168, 0.004]} castShadow>
        <boxGeometry args={CLOCK_TRIM_ARGS} />
        <meshStandardMaterial
          color="#C9933B"
          map={metalMaps.map}
          roughnessMap={metalMaps.roughnessMap}
          roughness={0.32}
          metalness={0.78}
        />
      </mesh>

      {/* Crisp Self-Illuminated Studio LED Screen Face */}
      <mesh position={[0, 0, 0.048]}>
        <planeGeometry args={CLOCK_SCREEN_ARGS} />
        <meshStandardMaterial
          map={activeTexture}
          emissive="#FFFFFF"
          emissiveMap={activeTexture}
          emissiveIntensity={emissiveBoost}
          roughness={0.24}
          metalness={0.04}
        />
      </mesh>

      {/* Subtle Warm Local Glow Reflecting onto Oak Slats & Hosts */}
      <pointLight
        position={[0, 0, 0.36]}
        color={glowTint}
        intensity={isOnAir ? 0.65 : 0.25 + pulse * 0.45}
        distance={2.6}
        decay={2}
      />
    </group>
  );
};

const StudioEasterEggFrame3D: React.FC<{
  position: [number, number, number];
  rocketTexture: THREE.Texture | null;
  metalMaps: ReturnType<typeof getProceduralPbrMaps>;
  linenMaps: ReturnType<typeof getProceduralPbrMaps>;
}> = ({ position, rocketTexture, metalMaps, linenMaps }) => (
  <group name="studio-skyward-easter-egg-frame" position={position}>
    {/* Brushed-Brass Gallery Frame */}
    <mesh castShadow receiveShadow>
      <boxGeometry args={EGG_FRAME_OUTER_ARGS} />
      <meshStandardMaterial
        color="#C9933B"
        map={metalMaps.map}
        roughnessMap={metalMaps.roughnessMap}
        bumpMap={metalMaps.bumpMap}
        bumpScale={0.008}
        roughness={0.32}
        metalness={0.78}
      />
    </mesh>

    {/* Warm Linen-Weave Archival Cream Mat */}
    <mesh position={[0, 0, 0.018]} receiveShadow>
      <boxGeometry args={EGG_FRAME_MAT_ARGS} />
      <meshStandardMaterial
        color="#FAF5EA"
        map={linenMaps.map}
        bumpMap={linenMaps.bumpMap}
        roughnessMap={linenMaps.roughnessMap}
        bumpScale={0.01}
        roughness={0.86}
        metalness={0.02}
      />
    </mesh>

    {/* Deep Storybook Indigo Poster Backing */}
    <mesh position={[0, 0, 0.027]}>
      <planeGeometry args={EGG_FRAME_SKY_ARGS} />
      <meshStandardMaterial color="#162952" roughness={0.82} metalness={0.02} />
    </mesh>

    {/* Universe Continuity Easter-Egg Print: Paper Rocket from Skyward! */}
    <mesh position={[0, 0, 0.031]}>
      <planeGeometry args={EGG_FRAME_PRINT_ARGS} />
      <meshStandardMaterial
        key={rocketTexture ? 'egg-rocket-loaded' : 'egg-rocket-pending'}
        color={rocketTexture ? '#FFFFFF' : '#F3EAD7'}
        map={rocketTexture}
        transparent
        alphaTest={0.22}
        roughness={0.76}
        metalness={0.02}
      />
    </mesh>

    {/* Miniature Brushed-Brass Picture Rail */}
    <mesh position={[0, -0.4, 0.014]} castShadow>
      <boxGeometry args={EGG_FRAME_RAIL_ARGS} />
      <meshStandardMaterial
        color="#C9933B"
        map={metalMaps.map}
        roughnessMap={metalMaps.roughnessMap}
        roughness={0.3}
        metalness={0.8}
      />
    </mesh>
  </group>
);

const BouncingCoffeeMug3D: React.FC<{ mug: IsometricMugKinematics }> = ({
  mug,
}) => {
  const shadowScale = Math.max(0.32, 1 - mug.airborneFactor * 0.62);
  const shadowOpacity = Math.max(0.08, 0.34 - mug.airborneFactor * 0.24);

  return (
    <group name="leo-bouncing-mug-prop">
      {/* Grounded Cork Coaster + Dynamic Contact Shadow Disc */}
      <group position={mug.coasterPosition}>
        <mesh position={[0, 0.007, 0]} receiveShadow>
          <cylinderGeometry args={COASTER_CYL_ARGS} />
          <meshPhysicalMaterial
            color="#B9804E"
            roughness={0.72}
            clearcoat={0.06}
            sheen={0.22}
            sheenColor="#FFF4E6"
          />
        </mesh>
        <mesh
          position={[0, 0.0145, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[shadowScale, shadowScale, 1]}
        >
          <circleGeometry args={SHADOW_DISC_ARGS} />
          <meshBasicMaterial
            color="#26170E"
            transparent
            opacity={shadowOpacity}
          />
        </mesh>
      </group>

      {/* Disney-Arc Bouncing Glossy Cream & Terracotta Studio Mug (Exact OBB Center Match) */}
      <group
        position={mug.position}
        rotation={[0, mug.rotationY, mug.rotationZ]}
        scale={mug.scale}
      >
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={MUG_BODY_ARGS} />
          <meshPhysicalMaterial
            color="#FFF7EA"
            roughness={0.28}
            clearcoat={0.58}
            clearcoatRoughness={0.2}
          />
        </mesh>
        {/* Warm Terracotta Hand-Painted Studio Stripe */}
        <mesh position={[0, -0.006, 0]}>
          <cylinderGeometry args={MUG_BAND_ARGS} />
          <meshPhysicalMaterial
            color="#D96B4F"
            roughness={0.34}
            clearcoat={0.48}
          />
        </mesh>
        {/* Sculpted Ceramic C-Handle */}
        <mesh position={[0.056, 0, 0]} castShadow>
          <torusGeometry args={MUG_HANDLE_ARGS} />
          <meshPhysicalMaterial
            color="#FFF7EA"
            roughness={0.28}
            clearcoat={0.58}
          />
        </mesh>
        {/* Glossy Rich Espresso Surface */}
        <mesh position={[0, 0.055, 0]}>
          <cylinderGeometry args={MUG_COFFEE_ARGS} />
          <meshPhysicalMaterial
            color="#3A1D12"
            roughness={0.14}
            clearcoat={0.88}
          />
        </mesh>
        {/* Playful Airborne Motion Sparkle Motes During Peak Bounce */}
        <group visible={mug.airborneFactor > 0.14}>
          <mesh
            position={[-0.06, 0.09, 0.02]}
            scale={0.5 + mug.airborneFactor * 0.75}
          >
            <sphereGeometry args={MUG_SPARKLE_ARGS} />
            <meshBasicMaterial
              color="#FFE4A3"
              transparent
              opacity={mug.airborneFactor * 0.85}
            />
          </mesh>
          <mesh
            position={[0.055, 0.11, -0.02]}
            scale={0.4 + mug.airborneFactor * 0.65}
          >
            <sphereGeometry args={MUG_SPARKLE_ARGS} />
            <meshBasicMaterial
              color="#FFFDF5"
              transparent
              opacity={mug.airborneFactor * 0.78}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
};

const WobblingStudioMicAccent3D: React.FC<{
  position: [number, number, number];
  wobbleZ: number;
  isOnAir: boolean;
  metalMaps: ReturnType<typeof getProceduralPbrMaps>;
}> = ({ position, wobbleZ, isOnAir, metalMaps }) => (
  <group name="leo-wobbling-tally-mic" position={position}>
    {/* Weighted Brushed-Brass Desktop Mic Puck */}
    <mesh position={[0, 0.013, 0]} castShadow receiveShadow>
      <cylinderGeometry args={MIC_BASE_ARGS} />
      <meshStandardMaterial
        color="#232730"
        roughness={0.38}
        metalness={0.46}
      />
    </mesh>

    {/* Elastic Spring-Arm Gooseneck Oscillating During Leo's Turn 2-3 Scramble */}
    <group
      position={[0, 0.024, 0]}
      rotation={[wobbleZ * 0.42, wobbleZ * 0.75, wobbleZ]}
    >
      <mesh position={[0, 0.14, 0]} castShadow>
        <cylinderGeometry args={MIC_STEM_ARGS} />
        <meshStandardMaterial
          color="#C9933B"
          map={metalMaps.map}
          roughnessMap={metalMaps.roughnessMap}
          roughness={0.32}
          metalness={0.78}
        />
      </mesh>
      {/* Broadcast Tally Halo Ring + Compact Capsule */}
      <group position={[0, 0.295, 0]} rotation={[0.18, -0.45, 0.12]}>
        <mesh castShadow>
          <torusGeometry args={MIC_RING_ARGS} />
          <meshStandardMaterial
            color={isOnAir ? '#FF4D2E' : '#F59E0B'}
            emissive={isOnAir ? '#FF4D2E' : '#F59E0B'}
            emissiveIntensity={isOnAir ? 1.1 : 0.25 + Math.abs(wobbleZ) * 1.4}
            roughness={0.32}
          />
        </mesh>
        <mesh castShadow>
          <capsuleGeometry args={MIC_CAPSULE_ARGS} />
          <meshStandardMaterial
            color="#262B35"
            roughness={0.35}
            metalness={0.58}
          />
        </mesh>
      </group>
    </group>
  </group>
);

const SoundboardPanicLeds3D: React.FC<{
  position: [number, number, number];
  panicPulse: number;
  isOnAir: boolean;
  frame: number;
}> = ({ position, panicPulse, isOnAir, frame }) => (
  <group name="soundboard-panic-leds" position={position}>
    {LED_X_OFFSETS.map((lx, idx) => {
      const blinkWave =
        0.5 + 0.5 * Math.sin(frame * 0.28 + idx * 1.45);
      const color = isOnAir
        ? idx === 0
          ? '#FF4D2E'
          : '#4ADE80'
        : panicPulse > 0.05
          ? idx % 2 === 0
            ? '#FF5733'
            : '#FBBF24'
          : '#64748B';
      const intensity = isOnAir
        ? 0.92
        : 0.15 + panicPulse * (0.45 + blinkWave * 0.95);

      return (
        <mesh key={`sb-led-${idx}`} position={[lx, 0, -0.052]}>
          <sphereGeometry args={LED_DOT_ARGS} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={intensity}
            roughness={0.22}
          />
        </mesh>
      );
    })}
  </group>
);

// ============================================================================
// Main 3D Stage Content
// ============================================================================

const IsometricDialogueCanvasContent: React.FC<{
  mayaColor: string;
  leoColor: string;
  shadowMapSize: number;
}> = ({ mayaColor, leoColor, shadowMapSize }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const advance = useThree((s) => s.advance);
  const triggerAdvance = useCallback(() => {
    advance(performance.now());
  }, [advance]);

  // Pre-warm deterministic procedural PBR maps once (zero per-frame allocations)
  const linenMaps = useMemo(
    () =>
      getProceduralPbrMaps('linen-weave', {
        seed: 'iso-dialogue-gallery-linen',
        repeat: [3, 3],
      }),
    []
  );
  const metalMaps = useMemo(
    () =>
      getProceduralPbrMaps('brushed-metal', {
        seed: 'iso-dialogue-studio-brass',
        repeat: [2, 1],
      }),
    []
  );

  const { textures } = usePreloadedTextures3D(STUDIO_TEXTURE_SPECS, {
    advance: triggerAdvance,
  });
  const rocketTexture = textures[EASTER_EGG_ROCKET_URL] ?? null;

  if (frame <= 0) return null;

  const state = evaluateIsometricDialogueFrame(
    frame,
    VOICEOVER_MANIFEST,
    width,
    height
  );

  // Warm rim light shifts smoothly from crisp morning sky to luminous golden-hour glow at ON AIR
  const goldenBlend = Math.max(0, Math.min(1, (state.timeOfDay - 0.16) / 0.58));
  const rimIntensity = 0.36 + goldenBlend * 0.36;
  const rimColor = goldenBlend > 0.45 ? '#FFD098' : '#E6F0FF';

  // Studio back-wall mounting Z proud of vertical oak slats (`backWallZ + 0.232`)
  const wallMountZ = state.layout.backWallZ + 0.232;

  // Poised radiant broadcast charm on ON AIR (gentle arm gesture presence with calm mouth)
  const mayaSpeakWeight = Math.max(
    state.maya.speakingWeight,
    state.maya.poisedSmileSnap * 0.22
  );
  const leoSpeakWeight = Math.max(
    state.leo.speakingWeight,
    state.leo.poisedSmileSnap * 0.22
  );

  return (
    <>
      <DaylightArcRig3D
        timeOfDay={state.timeOfDay}
        shadowBounds={5.6}
        shadowMapSize={shadowMapSize}
      />
      <directionalLight
        position={RIM_LIGHT_POS}
        intensity={rimIntensity}
        color={rimColor}
      />
      <DirectorCamera3D
        anchors={state.camera.anchors}
        shots={[...state.camera.shots]}
        impulses={[...state.camera.impulses]}
        handheldIntensity={state.isOnAir ? 0.008 : 0.012}
        seed={505}
      />

      <PodcastStudioSet3D
        onAirActive={state.isOnAir}
        accentColor="#D96B4F"
        seed="five-seconds-to-air-studio"
      >
        {/* Live 3D LED Studio Countdown Clock cleanly below ON AIR lightbox */}
        <StudioCountdownClock3D
          position={[-0.32, 1.66, wallMountZ + 0.01]}
          label={state.countdownLabel}
          pulse={state.countdownPulse}
          isOnAir={state.isOnAir}
          metalMaps={metalMaps}
        />

        {/* Framed Skyward Universe Easter-Egg Mini-Print on Left Acoustic Wall */}
        <StudioEasterEggFrame3D
          position={[-1.78, 1.82, wallMountZ]}
          rocketTexture={rocketTexture}
          metalMaps={metalMaps}
          linenMaps={linenMaps}
        />

        {/* Soundboard Panic LED Strip atop Center Console */}
        <SoundboardPanicLeds3D
          position={[0, state.layout.tableHeight + 0.048, state.layout.tableZ - 0.02]}
          panicPulse={state.soundboardPanicPulse}
          isOnAir={state.isOnAir}
          frame={frame}
        />

        {/* Leo's Animated Disney-Arc Bouncing Ceramic Coffee Mug & Cork Coaster */}
        <BouncingCoffeeMug3D mug={state.mug} />

        {/* Springy Wobbling Desktop Tally Mic Accent reacting to Leo's Scramble */}
        <WobblingStudioMicAccent3D
          position={[0.72, state.layout.tableHeight, state.layout.tableZ - 0.04]}
          wobbleZ={state.leoMicWobbleZ}
          isOnAir={state.isOnAir}
          metalMaps={metalMaps}
        />

        {/* Host A — Maya (Left): Warm Terracotta Sweater, Chestnut Hair, Headphones */}
        <group
          name="host-maya-rig"
          position={state.maya.position}
          rotation={[
            state.maya.headNodPitch * 0.55,
            state.maya.rotationY,
            state.maya.torsoRoll * 0.55 + state.maya.headTiltZ * 0.35,
          ]}
          scale={state.maya.squashScale}
        >
          <ClayCharacter3D
            position={ORIGIN_POS}
            rotationY={0}
            seated
            sweaterColor={mayaColor}
            pantsColor="#363331"
            skinColor="#F5C6A5"
            hairColor="#6B3E26"
            eyeColor="#7C4A22"
            accentColor="#D4A359"
            accessory="headphones"
            pose={state.maya.pose}
            speakingWeight={mayaSpeakWeight}
            speechEnergy={state.maya.speechEnergy}
            headYawOffset={state.maya.headYaw}
            seed="maya-five-seconds-to-air"
          />
        </group>

        {/* Host B — Leo (Right): Deep Indigo Sweater, Espresso Hair, Round Glasses */}
        <group
          name="host-leo-rig"
          position={state.leo.position}
          rotation={[
            state.leo.headNodPitch * 0.55,
            state.leo.rotationY,
            state.leo.torsoRoll * 0.55 + state.leo.headTiltZ * 0.35,
          ]}
          scale={state.leo.squashScale}
        >
          <ClayCharacter3D
            position={ORIGIN_POS}
            rotationY={0}
            seated
            sweaterColor={leoColor}
            pantsColor="#3D3A37"
            skinColor="#EDC09E"
            hairColor="#221D1A"
            eyeColor="#1F5E6B"
            accentColor="#C9933B"
            accessory="glasses"
            pose={state.leo.pose}
            speakingWeight={leoSpeakWeight}
            speechEnergy={state.leo.speechEnergy}
            headYawOffset={state.leo.headYaw}
            seed="leo-five-seconds-to-air"
          />
        </group>
      </PodcastStudioSet3D>
    </>
  );
};

// ============================================================================
// Frameless Editorial Chrome & Clean Frame 0 Cover
// ============================================================================

const StudioEditorialChrome: React.FC<{
  headline: string;
  subline: string;
}> = React.memo(({ headline, subline }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  if (frame <= 0) return null;

  const state = evaluateIsometricDialogueFrame(
    frame,
    VOICEOVER_MANIFEST,
    width,
    height
  );

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

  let activeMilestoneId = state.milestones[0]?.id ?? 'chill';
  for (const m of state.milestones) {
    if (typeof m.fromFrame === 'number' && frame >= m.fromFrame) {
      activeMilestoneId = m.id;
    }
  }

  const eyebrowText = state.isOnAir
    ? 'ON AIR  •  LIVE STUDIO'
    : `${state.countdownLabel}  •  STUDIO COUNTDOWN`;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', boxSizing: 'border-box' }}>
      {/* Subtle luminous cream top fade ensuring effortless typography legibility */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          boxSizing: 'border-box',
          background:
            'linear-gradient(180deg, rgba(251,247,238,0.88) 0%, rgba(251,247,238,0.48) 14%, rgba(251,247,238,0) 26%)',
        }}
      />
      <FloatingEditorialDisplay
        eyebrow={eyebrowText}
        headline={headline}
        subline={subline}
        align="left"
        position="top"
        tone="dark-on-light"
        headlinePx={48}
        sublinePx={21}
        enterFrame={2}
        style={{
          transform: `translate3d(0, ${((1 - headSpring) * -14).toFixed(2)}px, 0)`,
          willChange: 'transform',
        }}
      />
      <PaperRibbonTimeline
        milestones={state.milestones}
        activeId={activeMilestoneId}
        position="bottom"
        enterFrame={3}
        style={{
          transform: `translate3d(0, ${((1 - ribbonSpring) * 14).toFixed(2)}px, 0)`,
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

const IsometricDialogueDemoInner: React.FC<IsometricDialogueDemoProps> =
  React.memo(
    ({
      headline,
      subline,
      mayaColor,
      leoColor,
      voiceoverVolume,
      musicVolume,
      sfxVolume,
    }) => {
      const { width, height, durationInFrames } = useVideoConfig();
      const outerStyle = useStudioStyle();
      const { isRendering } = getRemotionEnvironment();

      return (
        <AbsoluteFill style={{ boxSizing: 'border-box' }}>
          <ThreeCanvas
            width={width}
            height={height}
            shadows={isRendering ? 'percentage' : true}
            dpr={isRendering ? RENDER_DPR : 1}
            gl={THREE_GL_CONFIG}
          >
            <StyleProvider style="soft-clay">
              <IsometricDialogueCanvasContent
                mayaColor={mayaColor}
                leoColor={leoColor}
                shadowMapSize={isRendering ? 2048 : 1024}
              />
            </StyleProvider>
          </ThreeCanvas>

          <StudioEditorialChrome headline={headline} subline={subline} />

          {/* Data-driven eleven_v4 Text-to-Dialogue track (auto-activates when real MP3 lands) */}
          {DEFAULT_ISOMETRIC_DIALOGUE_TIMELINE.voTimeline.map((seg) => {
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

          {/* 3-section comedic Rhodes/funk/jazz-funk score with speech-aware ducking */}
          {SCORE_SRC ? (
            <SmartMusicBed
              src={SCORE_SRC}
              dialogueSegments={DUCKING_SEGMENTS}
              voiceoverManifest={VOICEOVER_MANIFEST}
              baseVolume={musicVolume}
              duckedVolume={Math.min(musicVolume * 0.36, 0.1)}
              fadeOutFrames={78}
            />
          ) : null}

          {/* 5 bounded studio foley SFX cues */}
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

export const IsometricDialogueDemo: React.FC<
  Partial<IsometricDialogueDemoProps>
> = (incomingProps) => {
  const merged: IsometricDialogueDemoProps = {
    ...(isometricDefaults as IsometricDialogueDemoProps),
    ...incomingProps,
  };

  return (
    <StyleProvider style={merged.styleId || 'soft-clay'} renderBackdrop>
      <IsometricDialogueDemoInner {...merged} />
    </StyleProvider>
  );
};

export { ISOMETRIC_DIALOGUE_DURATION_FRAMES };
