import React from 'react';
import {
  interpolate,
  interpolateColors,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { useStudioStyle } from "../..";
import { ContactShadowDisc3D } from '../vfx/StagePostProcessing3D';
import {
  computeIsometricLightRig,
  resolveIsometricMaterialTokens,
  type IsometricMaterialPreset,
} from './isometricMaterials';

export interface CharacterGestureWeights {
  shrug?: number;
  presentRight?: number;
  presentLeft?: number;
  celebrate?: number;
  listenNod?: number;
}

export interface Stylized3DCharacterProps {
  /** World position [x, y, z] where y=0 is the studio floor */
  position: [number, number, number];
  /** Base Y rotation in radians (0 = facing +Z) */
  rotationY: number;
  /** Primary suit/body color */
  primaryColor: string;
  /** Secondary accent color */
  accentColor: string;
  /** Low-pass smoothed syllable energy (0..1) for mouth aperture */
  speechEnergy: number;
  /** Smooth turn-level speaking weight (0..1) across the whole sentence */
  speakingWeight: number;
  /** Smooth spring-interpolated gesture weights (0..1) so poses never snap */
  gestureWeights?: CharacterGestureWeights;
  /** Frame when the character enters the scene (default 2) */
  enterFrame?: number;
  /** Smoothly interpolated head yaw offset (rad) */
  headYawOffset?: number;
  /** Optional explicit maquette finish override */
  materialPreset?: IsometricMaterialPreset;
}

export const Stylized3DCharacter: React.FC<Stylized3DCharacterProps> = ({
  position,
  rotationY,
  primaryColor,
  accentColor,
  speechEnergy,
  speakingWeight,
  gestureWeights = {},
  enterFrame = 2,
  headYawOffset = 0,
  materialPreset,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const studioStyle = useStudioStyle();

  const effectiveEnter = Math.max(2, enterFrame);
  if (frame <= 0 || frame < effectiveEnter) {
    return null;
  }

  const mat = resolveIsometricMaterialTokens(studioStyle, materialPreset);
  const lightRig = computeIsometricLightRig(studioStyle);

  const enterProgress = spring({
    frame: frame - effectiveEnter,
    fps,
    config: { damping: 200, stiffness: 55, mass: 1.2 },
  });

  const isShrug = gestureWeights.shrug ?? 0;
  const isPresentR = gestureWeights.presentRight ?? 0;
  const isPresentL = gestureWeights.presentLeft ?? 0;
  const isCelebrate = gestureWeights.celebrate ?? 0;
  const isNod = gestureWeights.listenNod ?? 0;

  const talkBounce = 0;
  const breath = Math.sin(frame * 0.038) * 0.012;
  const talkCadenceA = Math.sin(frame * 0.048) * speakingWeight;
  const talkCadenceB = Math.cos(frame * 0.038) * speakingWeight;

  const headPitch =
    -0.04 * speakingWeight +
    Math.sin(frame * 0.052) * 0.035 * speakingWeight +
    isNod * Math.sin(frame * 0.055) * 0.045 +
    isShrug * -0.06;
  const headRoll =
    isShrug * 0.1 + Math.sin(frame * 0.042) * 0.03 * speakingWeight;
  const headYaw =
    headYawOffset + Math.cos(frame * 0.036) * 0.035 * speakingWeight;

  const leftShoulderX =
    -0.12 +
    isShrug * -0.58 +
    isPresentL * -0.82 +
    isPresentR * -0.25 +
    isCelebrate * -0.92 +
    speakingWeight * -0.18 +
    talkCadenceA * 0.08;
  const leftShoulderZ =
    -0.12 +
    isShrug * -0.42 +
    isPresentL * -0.3 +
    isCelebrate * -0.35 +
    speakingWeight * -0.08;
  const leftElbowX =
    -0.24 +
    isShrug * -0.72 +
    isPresentL * -0.45 +
    isCelebrate * -0.55 +
    speakingWeight * -0.26 +
    talkCadenceB * 0.07;

  const rightShoulderX =
    -0.12 +
    isShrug * -0.58 +
    isPresentR * -0.82 +
    isPresentL * -0.25 +
    isCelebrate * -0.92 +
    speakingWeight * -0.18 -
    talkCadenceA * 0.08;
  const rightShoulderZ =
    0.12 +
    isShrug * 0.42 +
    isPresentR * 0.3 +
    isCelebrate * 0.35 +
    speakingWeight * 0.08;
  const rightElbowX =
    -0.24 +
    isShrug * -0.72 +
    isPresentR * -0.45 +
    isCelebrate * -0.55 +
    speakingWeight * -0.26 -
    talkCadenceB * 0.07;

  const torsoPitch = speakingWeight * 0.035 - isShrug * 0.03;
  const torsoYaw = isPresentL * 0.12 - isPresentR * 0.12;

  const scale = interpolate(enterProgress, [0, 1], [0.001, 1]);
  const ringScale = 1 + speakingWeight * 0.05;
  const clampedSpeak = Math.max(0, Math.min(1, speakingWeight));
  const clampedEnergy = Math.max(0, Math.min(1, speechEnergy));

  const floorRingColor = interpolateColors(
    clampedSpeak,
    [0, 1],
    [mat.jointColor, accentColor]
  );
  const activeSignalMix = interpolateColors(
    clampedSpeak,
    [0, 1],
    [accentColor, mat.eyeHighlightColor]
  );

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      scale={[scale, scale, scale]}
    >
      {/* Grounded Contact Shadow Disc (y = 0.012, polygonOffset) */}
      <ContactShadowDisc3D
        position={[0, 0.012, 0]}
        radius={0.62}
        opacity={lightRig.contactShadowOpacity}
        color={lightRig.contactShadowColor}
      />

      {/* Calibrated Inlaid Speaker Plinth Ring (y = 0.018 — physically shaded, zero neon glow) */}
      <mesh
        position={[0, 0.018, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[ringScale, ringScale, 1]}
      >
        <ringGeometry args={[0.46, 0.515, 48]} />
        <meshStandardMaterial
          color={floorRingColor}
          roughness={mat.roughness}
          metalness={mat.metalness}
          transparent
          opacity={0.26 + clampedSpeak * mat.outlineRingOpacity}
        />
      </mesh>

      {/* Left Leg */}
      <group position={[-0.16, 0.9, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.076, 0.076, 0.09, 20]} />
          <meshStandardMaterial
            color={mat.jointColor}
            roughness={mat.limbRoughness}
            metalness={mat.limbMetalness}
          />
        </mesh>
        <mesh position={[0, -0.22, 0]} castShadow>
          <capsuleGeometry args={[0.074, 0.28, 16, 24]} />
          <meshStandardMaterial
            color={mat.limbColor}
            roughness={mat.limbRoughness}
            metalness={mat.limbMetalness}
          />
        </mesh>
        <mesh position={[0, -0.44, 0]} castShadow>
          <cylinderGeometry args={[0.072, 0.072, 0.08, 20]} />
          <meshStandardMaterial
            color={mat.jointColor}
            roughness={mat.limbRoughness}
            metalness={mat.limbMetalness}
          />
        </mesh>
        <mesh position={[0, -0.66, 0]} castShadow>
          <capsuleGeometry args={[0.066, 0.28, 16, 24]} />
          <meshStandardMaterial
            color={mat.limbColor}
            roughness={mat.limbRoughness}
            metalness={mat.limbMetalness}
          />
        </mesh>
        <mesh
          position={[0, -0.84, 0.05]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <capsuleGeometry args={[0.072, 0.12, 16, 24]} />
          <meshStandardMaterial
            color={mat.shoeColor}
            roughness={mat.roughness}
            metalness={mat.metalness}
          />
        </mesh>
      </group>

      {/* Right Leg */}
      <group position={[0.16, 0.9, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.076, 0.076, 0.09, 20]} />
          <meshStandardMaterial
            color={mat.jointColor}
            roughness={mat.limbRoughness}
            metalness={mat.limbMetalness}
          />
        </mesh>
        <mesh position={[0, -0.22, 0]} castShadow>
          <capsuleGeometry args={[0.074, 0.28, 16, 24]} />
          <meshStandardMaterial
            color={mat.limbColor}
            roughness={mat.limbRoughness}
            metalness={mat.limbMetalness}
          />
        </mesh>
        <mesh position={[0, -0.44, 0]} castShadow>
          <cylinderGeometry args={[0.072, 0.072, 0.08, 20]} />
          <meshStandardMaterial
            color={mat.jointColor}
            roughness={mat.limbRoughness}
            metalness={mat.limbMetalness}
          />
        </mesh>
        <mesh position={[0, -0.66, 0]} castShadow>
          <capsuleGeometry args={[0.066, 0.28, 16, 24]} />
          <meshStandardMaterial
            color={mat.limbColor}
            roughness={mat.limbRoughness}
            metalness={mat.limbMetalness}
          />
        </mesh>
        <mesh
          position={[0, -0.84, 0.05]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <capsuleGeometry args={[0.072, 0.12, 16, 24]} />
          <meshStandardMaterial
            color={mat.shoeColor}
            roughness={mat.roughness}
            metalness={mat.metalness}
          />
        </mesh>
      </group>

      {/* Chamfered Sculptural Torso + Arms + Maquette Bust Head */}
      <group
        position={[0, 0.94 + breath + talkBounce, 0]}
        rotation={[torsoPitch, torsoYaw, 0]}
      >
        <mesh position={[0, 0.06, 0]} castShadow>
          <cylinderGeometry args={[0.21, 0.19, 0.12, 24]} />
          <meshStandardMaterial
            color={mat.jointColor}
            roughness={mat.limbRoughness}
            metalness={mat.limbMetalness}
          />
        </mesh>

        {/* Tapered Chamfered Architectural Mantle */}
        <mesh position={[0, 0.42, 0]} castShadow>
          <cylinderGeometry args={[0.255, 0.205, 0.52, 12]} />
          <meshStandardMaterial
            color={primaryColor}
            roughness={mat.roughness}
            metalness={mat.metalness}
          />
        </mesh>

        {/* Sculpted Upper Shoulder Yoke */}
        <mesh position={[0, 0.45, 0]} castShadow>
          <capsuleGeometry args={[0.235, 0.34, 16, 24]} />
          <meshStandardMaterial
            color={primaryColor}
            roughness={mat.roughness}
            metalness={mat.metalness}
          />
        </mesh>

        {/* Subtle Chest Lapel / Telemetry Badge */}
        <mesh position={[0, 0.54, 0.256]}>
          <boxGeometry args={[0.14, 0.034, 0.018]} />
          <meshStandardMaterial
            color={activeSignalMix}
            roughness={mat.roughness}
            metalness={mat.metalness}
            transparent
            opacity={0.48 + clampedSpeak * 0.52}
          />
        </mesh>

        {/* Architectural Collar Ring */}
        <mesh position={[0, 0.84, 0]} castShadow>
          <cylinderGeometry args={[0.165, 0.21, 0.085, 24]} />
          <meshStandardMaterial
            color={mat.collarColor}
            roughness={mat.roughness}
            metalness={mat.metalness}
          />
        </mesh>

        {/* Left Arm */}
        <group
          position={[-0.33, 0.72, 0]}
          rotation={[leftShoulderX, 0, leftShoulderZ]}
        >
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.082, 0.082, 0.08, 20]} />
            <meshStandardMaterial
              color={mat.collarColor}
              roughness={mat.roughness}
              metalness={mat.metalness}
            />
          </mesh>
          <mesh position={[0, -0.19, 0]} castShadow>
            <capsuleGeometry args={[0.066, 0.24, 16, 24]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={mat.roughness}
              metalness={mat.metalness}
            />
          </mesh>
          <group position={[0, -0.38, 0]} rotation={[leftElbowX, 0, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.068, 0.068, 0.075, 20]} />
              <meshStandardMaterial
                color={mat.jointColor}
                roughness={mat.limbRoughness}
                metalness={mat.limbMetalness}
              />
            </mesh>
            <mesh position={[0, -0.18, 0]} castShadow>
              <capsuleGeometry args={[0.06, 0.22, 16, 24]} />
              <meshStandardMaterial
                color={mat.limbColor}
                roughness={mat.limbRoughness}
                metalness={mat.limbMetalness}
              />
            </mesh>
            <mesh
              position={[0, -0.355, 0]}
              scale={[0.82, 1, 1.08]}
              castShadow
            >
              <capsuleGeometry args={[0.054, 0.055, 12, 18]} />
              <meshStandardMaterial
                color={mat.headColor}
                roughness={mat.roughness}
                metalness={mat.metalness}
              />
            </mesh>
          </group>
        </group>

        {/* Right Arm */}
        <group
          position={[0.33, 0.72, 0]}
          rotation={[rightShoulderX, 0, rightShoulderZ]}
        >
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.082, 0.082, 0.08, 20]} />
            <meshStandardMaterial
              color={mat.collarColor}
              roughness={mat.roughness}
              metalness={mat.metalness}
            />
          </mesh>
          <mesh position={[0, -0.19, 0]} castShadow>
            <capsuleGeometry args={[0.066, 0.24, 16, 24]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={mat.roughness}
              metalness={mat.metalness}
            />
          </mesh>
          <group position={[0, -0.38, 0]} rotation={[rightElbowX, 0, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.068, 0.068, 0.075, 20]} />
              <meshStandardMaterial
                color={mat.jointColor}
                roughness={mat.limbRoughness}
                metalness={mat.limbMetalness}
              />
            </mesh>
            <mesh position={[0, -0.18, 0]} castShadow>
              <capsuleGeometry args={[0.06, 0.22, 16, 24]} />
              <meshStandardMaterial
                color={mat.limbColor}
                roughness={mat.limbRoughness}
                metalness={mat.limbMetalness}
              />
            </mesh>
            <mesh
              position={[0, -0.355, 0]}
              scale={[0.82, 1, 1.08]}
              castShadow
            >
              <capsuleGeometry args={[0.054, 0.055, 12, 18]} />
              <meshStandardMaterial
                color={mat.headColor}
                roughness={mat.roughness}
                metalness={mat.metalness}
              />
            </mesh>
          </group>
        </group>

        {/* Polymorphic Sculpted Maquette Bust Head (zero spherical globes, zero ear muffs) */}
        <group
          position={[0, 1.21 + Math.sin(frame * 0.038 - 0.4) * 0.008, 0]}
          rotation={[headPitch, headYaw, headRoll]}
        >
          <mesh scale={[0.96, 1, 0.94]} castShadow>
            <capsuleGeometry args={[0.265, 0.11, 20, 32]} />
            <meshStandardMaterial
              color={mat.headColor}
              roughness={mat.roughness}
              metalness={mat.metalness}
            />
          </mesh>

          {/* Chamfered Cranial Crown Bevel */}
          <mesh position={[0, 0.24, 0]} castShadow>
            <cylinderGeometry args={[0.185, 0.225, 0.055, 12]} />
            <meshStandardMaterial
              color={mat.headColor}
              roughness={mat.roughness}
              metalness={mat.metalness}
            />
          </mesh>

          {mat.visorStyle === 'sculpted-band' ? (
            <>
              {/* Architectural brow horizon bar + calm acoustic slit */}
              <mesh position={[0, 0.042, 0.252]}>
                <boxGeometry args={[0.28, 0.03, 0.028]} />
                <meshStandardMaterial
                  color={accentColor}
                  roughness={mat.roughness}
                  metalness={mat.metalness}
                />
              </mesh>
              <mesh
                position={[0, -0.042, 0.254]}
                scale={[1, 1 + clampedEnergy * 2.4, 1]}
              >
                <boxGeometry args={[0.125, 0.014, 0.022]} />
                <meshBasicMaterial
                  color={mat.visorColor}
                  transparent
                  opacity={0.45 + clampedSpeak * 0.55}
                />
              </mesh>
            </>
          ) : mat.visorStyle === 'slit-visor' ? (
            <>
              {/* Anodized recessed telemetry slit visor + 3 precision bars */}
              <mesh position={[0, 0.022, 0.244]}>
                <boxGeometry args={[0.34, 0.094, 0.036]} />
                <meshStandardMaterial
                  color={mat.visorColor}
                  roughness={0.18}
                  metalness={0.45}
                />
              </mesh>
              <mesh position={[0, 0.054, 0.264]}>
                <boxGeometry args={[0.24, 0.018, 0.014]} />
                <meshBasicMaterial
                  color={accentColor}
                  transparent
                  opacity={0.55 + clampedSpeak * 0.45}
                />
              </mesh>
              {[-0.05, 0, 0.05].map((xOff, idx) => {
                const barH =
                  0.01 + clampedEnergy * (idx === 1 ? 0.042 : 0.026);
                return (
                  <mesh
                    key={idx}
                    position={[xOff, -0.008, 0.266]}
                    scale={[1, barH / 0.01, 1]}
                  >
                    <boxGeometry args={[0.024, 0.01, 0.012]} />
                    <meshBasicMaterial color={activeSignalMix} />
                  </mesh>
                );
              })}
            </>
          ) : (
            <>
              {/* Graphic ink-mask plate for brutalist / craft / sketch */}
              <mesh position={[0, 0.032, 0.248]}>
                <boxGeometry args={[0.325, 0.086, 0.032]} />
                <meshStandardMaterial
                  color={mat.visorColor}
                  roughness={0.94}
                  metalness={0.02}
                />
              </mesh>
              <mesh position={[-0.072, 0.032, 0.266]}>
                <boxGeometry args={[0.044, 0.024, 0.012]} />
                <meshBasicMaterial color={mat.eyeHighlightColor} />
              </mesh>
              <mesh position={[0.072, 0.032, 0.266]}>
                <boxGeometry args={[0.044, 0.024, 0.012]} />
                <meshBasicMaterial color={mat.eyeHighlightColor} />
              </mesh>
              <mesh
                position={[0, -0.052, 0.25]}
                scale={[
                  0.75 + clampedEnergy * 0.55,
                  1 + clampedEnergy * 2.1,
                  1,
                ]}
              >
                <boxGeometry args={[0.118, 0.018, 0.02]} />
                <meshBasicMaterial color={accentColor} />
              </mesh>
            </>
          )}
        </group>
      </group>
    </group>
  );
};
