import React from 'react';
import { RoundedBox } from '@react-three/drei';
import {
  interpolate,
  interpolateColors,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  createSeededRandom,
  resolveStyleMaterial3D,
  useStudioStyle,
  type StyleMaterial3DFinish,
} from '@make-pictures/core';

export type ClayCharacterAccessory =
  | 'headphones'
  | 'glasses'
  | 'beanie'
  | 'none';

export type ClayCharacterPose = 'idle' | 'talking' | 'listening' | 'pointing';

export interface PhysicalFinishProps {
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  sheen: number;
  transmission: number;
  ior: number;
}

export interface ClayCharacter3DProps {
  position?: [number, number, number];
  rotationY?: number;
  scale?: number;
  sweaterColor?: string;
  pantsColor?: string;
  skinColor?: string;
  hairColor?: string;
  eyeColor?: string;
  finish?: StyleMaterial3DFinish;
  accessory?: ClayCharacterAccessory;
  speakingWeight?: number;
  speechEnergy?: number;
  pose?: ClayCharacterPose;
  seated?: boolean;
  seed?: string | number;
  /** Optional entrance frame (default 2; frame <= 0 always returns null) */
  enterFrame?: number;
  /** Optional smooth head yaw offset in radians */
  headYawOffset?: number;
  /** Optional accent trim override for headphones / sneakers */
  accentColor?: string;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function safeBevel(w: number, h: number, d: number, desired: number): number {
  return Math.max(0.004, Math.min(desired, Math.min(w, h, d) * 0.44));
}

function safeBlendColor(t: number, colorA: string, colorB: string): string {
  try {
    return interpolateColors(clamp(t, 0, 1), [0, 1], [colorA, colorB]);
  } catch {
    return t < 0.5 ? colorA : colorB;
  }
}

/**
 * Pure deterministic 3D eyelid blink envelope (`0` open .. `1` closed) firing once
 * every ~`3.2s` with a seeded phase offset. Always returns `0` when `frame <= 0`.
 */
export function computeClayBlinkProgress(
  frame: number,
  fps: number,
  seed: string | number
): number {
  if (frame <= 0 || fps <= 0) {
    return 0;
  }
  const periodFrames = Math.max(24, Math.round(3.2 * fps));
  const blinkHalfWindow = Math.max(3, Math.round(0.085 * fps));
  const rng = createSeededRandom(`clay-blink:${String(seed)}`);
  const minPeak = blinkHalfWindow + 8;
  const maxPeak = Math.max(minPeak + 1, periodFrames - blinkHalfWindow - 8);
  const peakOffset = minPeak + Math.floor(rng() * (maxPeak - minPeak));

  const cyclePos = (Math.floor(frame) - 1) % periodFrames;
  const dist = Math.abs(cyclePos - peakOffset);
  if (dist >= blinkHalfWindow) {
    return 0;
  }

  const normalized = 1 - dist / blinkHalfWindow;
  return Number((0.5 - 0.5 * Math.cos(normalized * Math.PI)).toFixed(4));
}

/**
 * Maps any `StyleMaterial3DFinish` token to physical PBR surface parameters
 * suitable for `<meshPhysicalMaterial>`.
 */
export function resolvePhysicalFinishProps(
  finish: StyleMaterial3DFinish
): PhysicalFinishProps {
  switch (finish) {
    case 'frosted-glass':
      return {
        roughness: 0.16,
        metalness: 0.06,
        clearcoat: 0.88,
        clearcoatRoughness: 0.12,
        sheen: 0.12,
        transmission: 0.42,
        ior: 1.52,
      };
    case 'retro-voxel':
      return {
        roughness: 0.34,
        metalness: 0.16,
        clearcoat: 0.28,
        clearcoatRoughness: 0.32,
        sheen: 0.06,
        transmission: 0,
        ior: 1.48,
      };
    case 'matte-ceramic':
      return {
        roughness: 0.68,
        metalness: 0.03,
        clearcoat: 0.08,
        clearcoatRoughness: 0.64,
        sheen: 0.18,
        transmission: 0,
        ior: 1.45,
      };
    case 'soft-clay':
    default:
      return {
        roughness: 0.52,
        metalness: 0.02,
        clearcoat: 0.16,
        clearcoatRoughness: 0.55,
        sheen: 0.35,
        transmission: 0,
        ior: 1.46,
      };
  }
}

const ClaySurfaceMaterial: React.FC<{
  color: string;
  finishProps: PhysicalFinishProps;
  roughnessOffset?: number;
}> = ({ color, finishProps, roughnessOffset = 0 }) => {
  const isTranslucent = finishProps.transmission > 0;
  return (
    <meshPhysicalMaterial
      color={color}
      roughness={clamp(finishProps.roughness + roughnessOffset, 0.05, 0.96)}
      metalness={finishProps.metalness}
      clearcoat={finishProps.clearcoat}
      clearcoatRoughness={finishProps.clearcoatRoughness}
      sheen={finishProps.sheen}
      sheenColor="#FFF4E6"
      sheenRoughness={0.62}
      transmission={finishProps.transmission}
      ior={finishProps.ior}
      transparent={isTranslucent || undefined}
      opacity={isTranslucent ? 0.92 : 1}
    />
  );
};

/**
 * Expressive Blender Soft-Clay / Vinyl Toy 3D character with true 3D eyeballs,
 * iris, pupils, upper-left catchlights, deterministic blinking eyelids,
 * beveled eyebrows, speech-reactive mouth (`talkBounce = 0`), cozy knit sweater,
 * and studio accessories (`headphones`, `glasses`, `beanie`, `none`).
 */
export const ClayCharacter3D: React.FC<ClayCharacter3DProps> = ({
  position = [0, 0, 0],
  rotationY = 0,
  scale: userScale = 1,
  sweaterColor,
  pantsColor,
  skinColor = '#F5C6A5',
  hairColor = '#4A2C1D',
  eyeColor,
  finish,
  accessory = 'none',
  speakingWeight = 0,
  speechEnergy = 0,
  pose = 'idle',
  seated = false,
  seed = 'clay-hero',
  enterFrame = 2,
  headYawOffset = 0,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = useStudioStyle();

  const effectiveEnter = Math.max(2, enterFrame);
  if (frame <= 0 || frame < effectiveEnter) {
    return null;
  }

  const styleMat3D = resolveStyleMaterial3D(style);
  const resolvedFinish = finish ?? styleMat3D.finish;
  const finishProps = resolvePhysicalFinishProps(resolvedFinish);
  const skinFinishProps: PhysicalFinishProps =
    resolvedFinish === 'soft-clay'
      ? { ...finishProps, roughness: 0.48, sheen: 0.42 }
      : finishProps;

  const resolvedSweater = sweaterColor ?? style.palette.accentPrimary;
  const resolvedAccent = accentColor ?? style.palette.accentSecondary;
  const resolvedPants = pantsColor ?? '#2E3A4E';
  const resolvedEyeColor = eyeColor ?? '#0F766E';
  const creamTrim = '#FFF7ED';
  const noseColor = safeBlendColor(0.32, skinColor, '#E58B73');
  const earInnerColor = safeBlendColor(0.38, skinColor, '#DF8A72');
  const sweaterRibColor = safeBlendColor(0.22, resolvedSweater, '#1E1B18');

  const hairRng = createSeededRandom(`clay-hair:${String(seed)}`);
  const fringeDir = hairRng() >= 0.5 ? 1 : -1;
  const hairCrownLift = 0.38 + (hairRng() - 0.5) * 0.025;

  const enterProgress = spring({
    frame: frame - effectiveEnter,
    fps,
    config: { damping: 200, stiffness: 58, mass: 1.15 },
  });
  const finalScale =
    interpolate(enterProgress, [0, 1], [0.001, 1]) * userScale;

  const clampedSpeak = clamp(speakingWeight, 0, 1);
  const clampedEnergy = clamp(speechEnergy, 0, 1);
  const blink = computeClayBlinkProgress(frame, fps, seed);

  // Grounded speech invariant: characters NEVER bounce vertically while speaking
  const talkBounce = 0;
  const breath = Math.sin(frame * 0.034) * 0.01;
  const cadenceA = Math.sin(frame * 0.042 + fringeDir * 0.6) * clampedSpeak;
  const cadenceB = Math.cos(frame * 0.036) * clampedSpeak;

  const isTalkingPose = pose === 'talking' ? 1 : 0;
  const isListeningPose = pose === 'listening' ? 1 : 0;
  const isPointingPose = pose === 'pointing' ? 1 : 0;
  const activeGesture = clamp(
    Math.max(clampedSpeak, isTalkingPose * 0.65),
    0,
    1
  );

  // Head expressive attitude (strictly <= 0.045 rad/frame)
  const headPitch =
    -0.03 * activeGesture +
    Math.sin(frame * 0.044) * 0.032 * activeGesture +
    isListeningPose * Math.sin(frame * 0.038) * 0.038;
  const headYaw =
    headYawOffset +
    Math.cos(frame * 0.032) * 0.034 * activeGesture +
    isPointingPose * 0.1;
  const headRoll =
    isListeningPose * 0.055 * fringeDir +
    Math.sin(frame * 0.036) * 0.024 * activeGesture;

  // Eyelid & eyebrow expressions
  const lidRotX = interpolate(blink, [0, 1], [-0.62, 1.04]);
  const browLift = 0.014 * activeGesture + 0.024 * clampedEnergy;
  const browTiltMag = 0.07 + 0.09 * activeGesture + 0.07 * clampedEnergy;

  // Speech-reactive 3D mouth squash & stretch
  const mouthOpen = 0.024 + clampedEnergy * 0.092 + activeGesture * 0.01;
  const mouthWidth = 0.132 + activeGesture * 0.016 - clampedEnergy * 0.014;

  // Articulated arm kinematics (hovering naturally above table when seated)
  const baseShoulderX = seated ? -0.54 : -0.16;
  const baseElbowX = seated ? -0.88 : -0.34;

  const leftShoulderX =
    baseShoulderX -
    activeGesture * 0.22 +
    cadenceA * 0.09 -
    isPointingPose * 0.15;
  const leftShoulderZ = -0.14 - activeGesture * 0.1 + cadenceB * 0.04;
  const leftElbowX = baseElbowX - activeGesture * 0.24 + cadenceB * 0.08;

  const rightShoulderX =
    baseShoulderX -
    activeGesture * 0.24 -
    cadenceA * 0.09 -
    isPointingPose * 0.62;
  const rightShoulderZ =
    0.14 + activeGesture * 0.1 + isPointingPose * 0.22 - cadenceB * 0.04;
  const rightElbowX =
    baseElbowX - activeGesture * 0.24 - cadenceB * 0.08 + isPointingPose * 0.35;

  const torsoBaseY = seated ? 0.52 : 0.7;
  const torsoPitch = (seated ? 0.04 : 0.02) + activeGesture * 0.025;
  const torsoYaw = cadenceB * 0.035 - isPointingPose * 0.08;

  const bodyRadius = safeBevel(
    0.62,
    0.58,
    0.42,
    resolvedFinish === 'retro-voxel' ? 0.05 : 0.14
  );

  return (
    <group
      name="clay-character-3d"
      position={position}
      rotation={[0, rotationY, 0]}
      scale={[finalScale, finalScale, finalScale]}
    >
      {/* Cozy Rounded Studio Stool when seated */}
      {seated ? (
        <group name="clay-studio-stool" position={[0, 0, -0.02]}>
          <RoundedBox
            args={[0.54, 0.09, 0.5]}
            radius={safeBevel(0.54, 0.09, 0.5, 0.038)}
            smoothness={4}
            position={[0, 0.43, 0]}
            castShadow
            receiveShadow
          >
            <ClaySurfaceMaterial
              color={ safeBlendColor(0.35, '#D97706', creamTrim) }
              finishProps={finishProps}
            />
          </RoundedBox>
          <RoundedBox
            args={[0.46, 0.05, 0.42]}
            radius={safeBevel(0.46, 0.05, 0.42, 0.02)}
            smoothness={4}
            position={[0, 0.37, 0]}
            castShadow
          >
            <ClaySurfaceMaterial color="#8B5A2B" finishProps={finishProps} />
          </RoundedBox>
          {(
            [
              [-0.17, -0.15, -0.08, 0.08],
              [0.17, -0.15, -0.08, -0.08],
              [-0.17, 0.15, 0.08, 0.08],
              [0.17, 0.15, 0.08, -0.08],
            ] as const
          ).map(([lx, lz, rx, rz], idx) => (
            <RoundedBox
              key={`stool-leg-${idx}`}
              args={[0.065, 0.38, 0.065]}
              radius={0.024}
              smoothness={4}
              position={[lx, 0.185, lz]}
              rotation={[rx, 0, rz]}
              castShadow
            >
              <ClaySurfaceMaterial color="#9C6634" finishProps={finishProps} />
            </RoundedBox>
          ))}
        </group>
      ) : null}

      {/* Left & Right Legs + Two-Tone Rounded Clay Sneakers */}
      {([-1, 1] as const).map((sgn) => {
        const legX = sgn * 0.155;
        if (seated) {
          return (
            <group
              key={`seated-leg-${sgn}`}
              position={[legX, 0.5, 0.04]}
            >
              {/* Forward thigh */}
              <group rotation={[-1.4, sgn * 0.06, 0]}>
                <mesh position={[0, -0.16, 0]} castShadow>
                  <capsuleGeometry args={[0.092, 0.22, 16, 24]} />
                  <ClaySurfaceMaterial
                    color={resolvedPants}
                    finishProps={finishProps}
                  />
                </mesh>
                {/* Downward calf + two-tone sneaker */}
                <group position={[0, -0.32, 0]} rotation={[1.34, 0, 0]}>
                  <mesh position={[0, -0.14, 0]} castShadow>
                    <capsuleGeometry args={[0.082, 0.18, 16, 24]} />
                    <ClaySurfaceMaterial
                      color={resolvedPants}
                      finishProps={finishProps}
                    />
                  </mesh>
                  <group position={[0, -0.29, 0.055]}>
                    <RoundedBox
                      args={[0.175, 0.095, 0.27]}
                      radius={safeBevel(0.175, 0.095, 0.27, 0.04)}
                      smoothness={4}
                      position={[0, 0.025, 0]}
                      castShadow
                    >
                      <ClaySurfaceMaterial
                        color={resolvedSweater}
                        finishProps={finishProps}
                      />
                    </RoundedBox>
                    <RoundedBox
                      args={[0.185, 0.045, 0.285]}
                      radius={safeBevel(0.185, 0.045, 0.285, 0.018)}
                      smoothness={4}
                      position={[0, -0.032, 0.004]}
                      castShadow
                    >
                      <ClaySurfaceMaterial
                        color={creamTrim}
                        finishProps={finishProps}
                      />
                    </RoundedBox>
                  </group>
                </group>
              </group>
            </group>
          );
        }

        return (
          <group key={`standing-leg-${sgn}`} position={[legX, 0, 0]}>
            {/* Chunky cozy trousers */}
            <mesh position={[0, 0.43, 0]} castShadow receiveShadow>
              <capsuleGeometry args={[0.096, 0.42, 16, 24]} />
              <ClaySurfaceMaterial
                color={resolvedPants}
                finishProps={finishProps}
              />
            </mesh>
            {/* Rolled trouser cuff */}
            <mesh
              position={[0, 0.16, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
            >
              <torusGeometry args={[0.088, 0.024, 12, 24]} />
              <ClaySurfaceMaterial
                color={safeBlendColor(0.25, resolvedPants, creamTrim)}
                finishProps={finishProps}
              />
            </mesh>
            {/* Two-Tone Rounded Clay Sneaker */}
            <group position={[0, 0, 0.048]}>
              <RoundedBox
                args={[0.19, 0.048, 0.3]}
                radius={safeBevel(0.19, 0.048, 0.3, 0.02)}
                smoothness={4}
                position={[0, 0.024, 0.005]}
                castShadow
                receiveShadow
              >
                <ClaySurfaceMaterial
                  color={creamTrim}
                  finishProps={finishProps}
                />
              </RoundedBox>
              <RoundedBox
                args={[0.178, 0.1, 0.275]}
                radius={safeBevel(0.178, 0.1, 0.275, 0.042)}
                smoothness={4}
                position={[0, 0.088, -0.006]}
                castShadow
              >
                <ClaySurfaceMaterial
                  color={resolvedSweater}
                  finishProps={finishProps}
                />
              </RoundedBox>
              {/* Cute cream toe cap */}
              <RoundedBox
                args={[0.168, 0.068, 0.095]}
                radius={safeBevel(0.168, 0.068, 0.095, 0.028)}
                smoothness={4}
                position={[0, 0.072, 0.105]}
                castShadow
              >
                <ClaySurfaceMaterial
                  color={creamTrim}
                  finishProps={finishProps}
                />
              </RoundedBox>
            </group>
          </group>
        );
      })}

      {/* Upper Body: Cozy Beveled Knit Sweater + Articulated Arms + Expressive Clay Head */}
      <group
        position={[0, torsoBaseY + breath + talkBounce, 0]}
        rotation={[torsoPitch, torsoYaw, 0]}
      >
        {/* Plump Beveled Sweater Torso */}
        <RoundedBox
          args={[0.62, 0.58, 0.42]}
          radius={bodyRadius}
          smoothness={5}
          position={[0, 0.3, 0]}
          castShadow
          receiveShadow
        >
          <ClaySurfaceMaterial
            color={resolvedSweater}
            finishProps={finishProps}
          />
        </RoundedBox>

        {/* Ribbed Sweater Hem Waistband */}
        <RoundedBox
          args={[0.58, 0.085, 0.39]}
          radius={safeBevel(0.58, 0.085, 0.39, 0.036)}
          smoothness={4}
          position={[0, 0.055, 0]}
          castShadow
        >
          <ClaySurfaceMaterial
            color={sweaterRibColor}
            finishProps={finishProps}
          />
        </RoundedBox>

        {/* Cozy Cream Crew-Neck Collar Ring + Soft Clay Neck */}
        <mesh
          position={[0, 0.59, 0.01]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <torusGeometry args={[0.158, 0.038, 16, 32]} />
          <ClaySurfaceMaterial color={creamTrim} finishProps={finishProps} />
        </mesh>
        <mesh position={[0, 0.65, 0]} castShadow>
          <cylinderGeometry args={[0.125, 0.14, 0.12, 24]} />
          <ClaySurfaceMaterial color={skinColor} finishProps={skinFinishProps} />
        </mesh>

        {/* Articulated Left Arm + Plump Clay Hand */}
        <group
          position={[-0.35, 0.5, 0.01]}
          rotation={[leftShoulderX, 0, leftShoulderZ]}
        >
          <mesh position={[0, -0.13, 0]} castShadow>
            <capsuleGeometry args={[0.088, 0.2, 16, 24]} />
            <ClaySurfaceMaterial
              color={resolvedSweater}
              finishProps={finishProps}
            />
          </mesh>
          <group position={[0, -0.27, 0]} rotation={[leftElbowX, 0, 0]}>
            <mesh position={[0, -0.11, 0]} castShadow>
              <capsuleGeometry args={[0.078, 0.17, 16, 24]} />
              <ClaySurfaceMaterial
                color={resolvedSweater}
                finishProps={finishProps}
              />
            </mesh>
            <mesh
              position={[0, -0.21, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
            >
              <torusGeometry args={[0.076, 0.022, 12, 24]} />
              <ClaySurfaceMaterial color={creamTrim} finishProps={finishProps} />
            </mesh>
            {/* Soft Rounded Clay Hand + Thumb */}
            <group position={[0, -0.285, 0.01]}>
              <mesh scale={[0.92, 1.06, 0.78]} castShadow>
                <sphereGeometry args={[0.082, 22, 20]} />
                <ClaySurfaceMaterial
                  color={skinColor}
                  finishProps={skinFinishProps}
                />
              </mesh>
              <mesh
                position={[0.058, 0.015, 0.025]}
                rotation={[0.2, 0, -0.55]}
                castShadow
              >
                <capsuleGeometry args={[0.026, 0.04, 10, 14]} />
                <ClaySurfaceMaterial
                  color={skinColor}
                  finishProps={skinFinishProps}
                />
              </mesh>
            </group>
          </group>
        </group>

        {/* Articulated Right Arm + Plump Clay Hand */}
        <group
          position={[0.35, 0.5, 0.01]}
          rotation={[rightShoulderX, 0, rightShoulderZ]}
        >
          <mesh position={[0, -0.13, 0]} castShadow>
            <capsuleGeometry args={[0.088, 0.2, 16, 24]} />
            <ClaySurfaceMaterial
              color={resolvedSweater}
              finishProps={finishProps}
            />
          </mesh>
          <group position={[0, -0.27, 0]} rotation={[rightElbowX, 0, 0]}>
            <mesh position={[0, -0.11, 0]} castShadow>
              <capsuleGeometry args={[0.078, 0.17, 16, 24]} />
              <ClaySurfaceMaterial
                color={resolvedSweater}
                finishProps={finishProps}
              />
            </mesh>
            <mesh
              position={[0, -0.21, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
            >
              <torusGeometry args={[0.076, 0.022, 12, 24]} />
              <ClaySurfaceMaterial color={creamTrim} finishProps={finishProps} />
            </mesh>
            {/* Soft Rounded Clay Hand + Thumb */}
            <group position={[0, -0.285, 0.01]}>
              <mesh scale={[0.92, 1.06, 0.78]} castShadow>
                <sphereGeometry args={[0.082, 22, 20]} />
                <ClaySurfaceMaterial
                  color={skinColor}
                  finishProps={skinFinishProps}
                />
              </mesh>
              <mesh
                position={[-0.058, 0.015, 0.025]}
                rotation={[0.2, 0, 0.55]}
                castShadow
              >
                <capsuleGeometry args={[0.026, 0.04, 10, 14]} />
                <ClaySurfaceMaterial
                  color={skinColor}
                  finishProps={skinFinishProps}
                />
              </mesh>
            </group>
          </group>
        </group>

        {/* =============================================================== */}
        {/* Plump Soft-Clay Head + True 3D Eyes + Mouth + Hair + Accessory  */}
        {/* =============================================================== */}
        <group
          name="clay-head"
          position={[0, 1.04, 0.02]}
          rotation={[headPitch, headYaw, headRoll]}
        >
          {/* Main Softly Rounded Clay Head ([0.42, 36, 36] scaled [1.06, 0.98, 0.98]) */}
          <mesh scale={[1.06, 0.98, 0.98]} castShadow receiveShadow>
            <sphereGeometry args={[0.42, 36, 36]} />
            <ClaySurfaceMaterial
              color={skinColor}
              finishProps={skinFinishProps}
            />
          </mesh>

          {/* Rounded Clay Ears */}
          {([-1, 1] as const).map((sgn) => (
            <group
              key={`clay-ear-${sgn}`}
              position={[sgn * 0.436, 0.005, -0.015]}
              rotation={[0, -sgn * 0.18, sgn * 0.1]}
            >
              <mesh scale={[0.56, 1.08, 0.82]} castShadow>
                <sphereGeometry args={[0.088, 20, 20]} />
                <ClaySurfaceMaterial
                  color={skinColor}
                  finishProps={skinFinishProps}
                />
              </mesh>
              <mesh position={[sgn * 0.018, 0, 0.022]} scale={[0.42, 0.7, 0.5]}>
                <sphereGeometry args={[0.055, 16, 16]} />
                <ClaySurfaceMaterial
                  color={earInnerColor}
                  finishProps={skinFinishProps}
                />
              </mesh>
            </group>
          ))}

          {/* Cute Rounded Button Nose */}
          <mesh
            position={[0, -0.026, 0.418]}
            scale={[1.14, 0.88, 0.94]}
            castShadow
          >
            <sphereGeometry args={[0.052, 24, 24]} />
            <ClaySurfaceMaterial
              color={noseColor}
              finishProps={skinFinishProps}
            />
          </mesh>

          {/* Warm Rosy Cheek Blush Ovals */}
          {([-1, 1] as const).map((sgn) => (
            <mesh
              key={`cheek-blush-${sgn}`}
              position={[sgn * 0.246, -0.058, 0.34]}
              rotation={[0.08, sgn * 0.52, -sgn * 0.08]}
              scale={[1.2, 0.72, 0.22]}
            >
              <sphereGeometry args={[0.068, 20, 20]} />
              <meshPhysicalMaterial
                color="#F4846B"
                roughness={0.65}
                clearcoat={0.08}
                sheen={0.3}
                sheenColor="#FFE4DE"
              />
            </mesh>
          ))}

          {/* True 3D Expressive Eyes (Sclera + Iris + Pupil + Dual Catchlights + Blinking Eyelid) */}
          {([-1, 1] as const).map((sgn) => (
            <group
              key={`clay-eye-${sgn}`}
              position={[sgn * 0.148, 0.038, 0.354]}
              rotation={[0, sgn * 0.2, 0]}
            >
              {/* White Sclera Sphere */}
              <mesh scale={[1, 1.06, 0.62]} castShadow>
                <sphereGeometry args={[0.082, 28, 24]} />
                <meshPhysicalMaterial
                  color="#FFFDF9"
                  roughness={0.2}
                  clearcoat={0.72}
                  clearcoatRoughness={0.14}
                />
              </mesh>

              {/* Rich Colored Iris Disc */}
              <mesh position={[0, 0, 0.036]} scale={[1, 1.04, 0.36]}>
                <sphereGeometry args={[0.052, 24, 20]} />
                <meshPhysicalMaterial
                  color={resolvedEyeColor}
                  roughness={0.18}
                  clearcoat={0.85}
                  clearcoatRoughness={0.1}
                />
              </mesh>

              {/* Deep Dark Pupil */}
              <mesh position={[0, 0, 0.047]} scale={[1, 1.04, 0.3]}>
                <sphereGeometry args={[0.03, 20, 16]} />
                <meshBasicMaterial color="#111827" />
              </mesh>

              {/* Bright White Upper-Left Primary Catchlight + Lower-Right Glint */}
              <mesh position={[-0.017, 0.02, 0.058]}>
                <sphereGeometry args={[0.013, 14, 14]} />
                <meshBasicMaterial color="#FFFFFF" />
              </mesh>
              <mesh position={[0.015, -0.014, 0.057]}>
                <sphereGeometry args={[0.006, 12, 12]} />
                <meshBasicMaterial color="#FFFFFF" />
              </mesh>

              {/* Smooth Upper Eyelid Shell animated by computeClayBlinkProgress */}
              <group scale={[1.07, 1.11, 0.72]}>
                <mesh rotation={[lidRotX, 0, 0]} castShadow>
                  <sphereGeometry
                    args={[0.086, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.54]}
                  />
                  <ClaySurfaceMaterial
                    color={safeBlendColor(0.14, skinColor, '#D98E73')}
                    finishProps={skinFinishProps}
                  />
                </mesh>
              </group>
            </group>
          ))}

          {/* Sculpted Beveled Eyebrows */}
          {([-1, 1] as const).map((sgn) => (
            <RoundedBox
              key={`clay-brow-${sgn}`}
              args={[0.132, 0.032, 0.044]}
              radius={safeBevel(0.132, 0.032, 0.044, 0.014)}
              smoothness={4}
              position={[sgn * 0.15, 0.15 + browLift, 0.376]}
              rotation={[-0.08, sgn * 0.22, sgn * browTiltMag * 0.48]}
              castShadow
            >
              <ClaySurfaceMaterial
                color={hairColor}
                finishProps={finishProps}
                roughnessOffset={0.05}
              />
            </RoundedBox>
          ))}

          {/* Speech-Reactive 3D Oval Pill Mouth (Sculpted Lip Rim + Terracotta Cavity + Tongue) */}
          <group
            name="clay-mouth"
            position={[0, -0.144, 0.378]}
            rotation={[0.16, 0, 0]}
          >
            {/* Smooth Oval Pill Lip Cushion */}
            <mesh
              rotation={[0, 0, Math.PI / 2]}
              scale={[1, 1, 0.4]}
              castShadow
            >
              <capsuleGeometry
                args={[
                  mouthOpen * 0.5 + 0.018,
                  Math.max(0.026, mouthWidth - mouthOpen * 0.6),
                  14,
                  24,
                ]}
              />
              <ClaySurfaceMaterial
                color="#DE7058"
                finishProps={skinFinishProps}
              />
            </mesh>

            {/* Inner Warm Terracotta Cavity (cleanly proud of lip center) */}
            <mesh
              position={[0, 0, 0.018]}
              rotation={[0, 0, Math.PI / 2]}
              scale={[1, 1, 0.36]}
            >
              <capsuleGeometry
                args={[
                  mouthOpen * 0.46,
                  Math.max(0.022, mouthWidth - mouthOpen * 0.64),
                  14,
                  24,
                ]}
              />
              <meshPhysicalMaterial color="#4A1511" roughness={0.84} />
            </mesh>

            {/* Cute Soft Pink Tongue Cushion inside open mouth */}
            {clampedEnergy > 0.14 ? (
              <mesh
                position={[0, -mouthOpen * 0.24, 0.026]}
                scale={[mouthWidth * 2.4, mouthOpen * 1.6, 0.24]}
              >
                <sphereGeometry args={[0.09, 16, 14]} />
                <meshPhysicalMaterial color="#F28482" roughness={0.52} />
              </mesh>
            ) : null}
          </group>

          {/* Sculpted Clay Hair Volume (High Forehead Hairline + Crown + Side Locks + Fringe) */}
          <group name="clay-hair">
            {/* Full Cranial Hair Cap tilted back so forehead & eyebrows read clearly */}
            <mesh
              position={[0, 0.078, -0.052]}
              rotation={[-0.58, 0, 0]}
              scale={[1.08, 1.03, 1.04]}
              castShadow
            >
              <sphereGeometry
                args={[0.436, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.56]}
              />
              <ClaySurfaceMaterial
                color={hairColor}
                finishProps={finishProps}
                roughnessOffset={0.06}
              />
            </mesh>

            {/* Sculpted Top Crown Wave */}
            {accessory !== 'beanie' ? (
              <RoundedBox
                args={[0.46, 0.16, 0.44]}
                radius={safeBevel(0.46, 0.16, 0.44, 0.07)}
                smoothness={4}
                position={[fringeDir * 0.035, hairCrownLift + 0.015, 0.02]}
                rotation={[0.06, 0, fringeDir * 0.08]}
                castShadow
              >
                <ClaySurfaceMaterial
                  color={hairColor}
                  finishProps={finishProps}
                  roughnessOffset={0.06}
                />
              </RoundedBox>
            ) : null}

            {/* Swooping Front Fringe Bangs (high above eyebrows) */}
            <RoundedBox
              args={[0.35, 0.105, 0.145]}
              radius={safeBevel(0.35, 0.105, 0.145, 0.048)}
              smoothness={4}
              position={[fringeDir * 0.065, 0.318, 0.292]}
              rotation={[0.22, -fringeDir * 0.14, -fringeDir * 0.12]}
              castShadow
            >
              <ClaySurfaceMaterial
                color={hairColor}
                finishProps={finishProps}
                roughnessOffset={0.06}
              />
            </RoundedBox>
            <RoundedBox
              args={[0.23, 0.092, 0.125]}
              radius={safeBevel(0.23, 0.092, 0.125, 0.04)}
              smoothness={4}
              position={[-fringeDir * 0.145, 0.326, 0.276]}
              rotation={[0.2, fringeDir * 0.16, fringeDir * 0.15]}
              castShadow
            >
              <ClaySurfaceMaterial
                color={hairColor}
                finishProps={finishProps}
                roughnessOffset={0.06}
              />
            </RoundedBox>

            {/* Temple Side Locks */}
            {([-1, 1] as const).map((sgn) => (
              <mesh
                key={`side-lock-${sgn}`}
                position={[sgn * 0.402, 0.13, 0.085]}
                rotation={[0.12, sgn * 0.18, -sgn * 0.16]}
                castShadow
              >
                <capsuleGeometry args={[0.058, 0.14, 12, 18]} />
                <ClaySurfaceMaterial
                  color={hairColor}
                  finishProps={finishProps}
                  roughnessOffset={0.06}
                />
              </mesh>
            ))}
          </group>

          {/* ============================================================= */}
          {/* Accessory 1: Studio Over-Ear Monitor Headphones               */}
          {/* ============================================================= */}
          {accessory === 'headphones' ? (
            <group name="clay-accessory-headphones">
              {/* Spring-Steel Headband Arch */}
              <mesh
                position={[0, 0.02, -0.01]}
                rotation={[0, 0, Math.PI * 0.03]}
                castShadow
              >
                <torusGeometry args={[0.478, 0.028, 18, 48, Math.PI * 0.94]} />
                <ClaySurfaceMaterial
                  color="#262932"
                  finishProps={finishProps}
                />
              </mesh>
              {/* Plush Padded Top Cushion */}
              <mesh
                position={[0, 0.024, -0.01]}
                rotation={[0, 0, Math.PI * 0.29]}
                castShadow
              >
                <torusGeometry args={[0.478, 0.044, 16, 32, Math.PI * 0.42]} />
                <ClaySurfaceMaterial
                  color={creamTrim}
                  finishProps={finishProps}
                />
              </mesh>

              {/* Left & Right Cushioned Over-Ear Studio Monitor Cups */}
              {([-1, 1] as const).map((sgn) => (
                <group
                  key={`headphone-cup-${sgn}`}
                  position={[sgn * 0.468, 0.01, -0.01]}
                  rotation={[0, 0, -sgn * 0.05]}
                >
                  {/* Plush Cream Ear Cushion Donut */}
                  <mesh rotation={[0, Math.PI / 2, 0]} castShadow>
                    <torusGeometry args={[0.108, 0.044, 18, 32]} />
                    <ClaySurfaceMaterial
                      color={creamTrim}
                      finishProps={finishProps}
                    />
                  </mesh>
                  {/* Beveled Studio Monitor Outer Shell */}
                  <RoundedBox
                    args={[0.095, 0.245, 0.205]}
                    radius={safeBevel(0.095, 0.245, 0.205, 0.04)}
                    smoothness={4}
                    position={[sgn * 0.036, 0, 0]}
                    castShadow
                  >
                    <ClaySurfaceMaterial
                      color="#232730"
                      finishProps={finishProps}
                    />
                  </RoundedBox>
                  {/* Accent Trim Studio Badge */}
                  <RoundedBox
                    args={[0.032, 0.15, 0.12]}
                    radius={safeBevel(0.032, 0.15, 0.12, 0.014)}
                    smoothness={4}
                    position={[sgn * 0.078, 0, 0]}
                    castShadow
                  >
                    <ClaySurfaceMaterial
                      color={resolvedAccent}
                      finishProps={finishProps}
                    />
                  </RoundedBox>
                </group>
              ))}
            </group>
          ) : null}

          {/* ============================================================= */}
          {/* Accessory 2: Rounded Studio Eyeglasses                        */}
          {/* ============================================================= */}
          {accessory === 'glasses' ? (
            <group name="clay-accessory-glasses">
              {([-1, 1] as const).map((sgn) => (
                <group key={`glasses-rim-${sgn}`}>
                  <mesh
                    position={[sgn * 0.152, 0.038, 0.415]}
                    rotation={[0, sgn * 0.18, 0]}
                    castShadow
                  >
                    <torusGeometry args={[0.098, 0.015, 14, 32]} />
                    <ClaySurfaceMaterial
                      color="#2B211B"
                      finishProps={finishProps}
                    />
                  </mesh>
                  <RoundedBox
                    args={[0.022, 0.022, 0.34]}
                    radius={0.008}
                    smoothness={4}
                    position={[sgn * 0.31, 0.046, 0.22]}
                    rotation={[0, sgn * 0.36, 0]}
                    castShadow
                  >
                    <ClaySurfaceMaterial
                      color="#2B211B"
                      finishProps={finishProps}
                    />
                  </RoundedBox>
                </group>
              ))}
              {/* Nose Bridge */}
              <RoundedBox
                args={[0.11, 0.024, 0.026]}
                radius={0.009}
                smoothness={4}
                position={[0, 0.052, 0.426]}
                castShadow
              >
                <ClaySurfaceMaterial
                  color="#2B211B"
                  finishProps={finishProps}
                />
              </RoundedBox>
            </group>
          ) : null}

          {/* ============================================================= */}
          {/* Accessory 3: Cozy Ribbed Knit Beanie                          */}
          {/* ============================================================= */}
          {accessory === 'beanie' ? (
            <group
              name="clay-accessory-beanie"
              position={[0, 0.14, -0.02]}
              rotation={[-0.18, 0, 0]}
            >
              <mesh scale={[1.07, 0.88, 1.03]} castShadow>
                <sphereGeometry
                  args={[0.445, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.55]}
                />
                <ClaySurfaceMaterial
                  color={resolvedAccent}
                  finishProps={finishProps}
                />
              </mesh>
              <mesh
                position={[0, 0.06, 0]}
                rotation={[Math.PI / 2, 0, 0]}
                scale={[1.06, 1.02, 1]}
                castShadow
              >
                <torusGeometry args={[0.428, 0.062, 18, 36]} />
                <ClaySurfaceMaterial
                  color={safeBlendColor(0.22, resolvedAccent, creamTrim)}
                  finishProps={finishProps}
                />
              </mesh>
              <mesh position={[0, 0.42, 0]} castShadow>
                <sphereGeometry args={[0.075, 18, 18]} />
                <ClaySurfaceMaterial
                  color={creamTrim}
                  finishProps={finishProps}
                />
              </mesh>
            </group>
          ) : null}
        </group>
      </group>
    </group>
  );
};
