import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

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
  /** Primary suit/body color (e.g. '#5723E7' or '#059669') */
  primaryColor: string;
  /** Secondary glow/visor accent color */
  accentColor: string;
  /** Low-pass smoothed syllable energy (0..1) for visor mouth equalizer */
  speechEnergy: number;
  /** Smooth turn-level speaking weight (0..1) across the whole sentence */
  speakingWeight: number;
  /** Smooth spring-interpolated gesture weights (0..1) so poses never snap */
  gestureWeights: CharacterGestureWeights;
  /** Frame when the character enters the scene */
  enterFrame?: number;
  /** Smoothly interpolated head yaw offset (rad) */
  headYawOffset?: number;
}

export const Stylized3DCharacter: React.FC<Stylized3DCharacterProps> = ({
  position,
  rotationY,
  primaryColor,
  accentColor,
  speechEnergy,
  speakingWeight,
  gestureWeights,
  enterFrame = 2,
  headYawOffset = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterProgress = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 200, stiffness: 55, mass: 1.2 },
  });

  const isShrug = gestureWeights.shrug ?? 0;
  const isPresentR = gestureWeights.presentRight ?? 0;
  const isPresentL = gestureWeights.presentLeft ?? 0;
  const isCelebrate = gestureWeights.celebrate ?? 0;
  const isNod = gestureWeights.listenNod ?? 0;

  // Calm, natural human breathing cycle (~2.7s period at 60 FPS)
  const breath = Math.sin(frame * 0.038) * 0.012;

  // Slow, composed conversational hand cadence (~2.2s - 2.7s period), driven by smooth turn-level weight
  const talkCadenceA = Math.sin(frame * 0.048) * speakingWeight;
  const talkCadenceB = Math.cos(frame * 0.038) * speakingWeight;

  // Gentle, natural head inclinations (no word-level twitching)
  const headPitch =
    -0.04 * speakingWeight +
    Math.sin(frame * 0.052) * 0.035 * speakingWeight +
    isNod * Math.sin(frame * 0.055) * 0.045 +
    isShrug * -0.06;
  const headRoll =
    isShrug * 0.1 +
    Math.sin(frame * 0.042) * 0.03 * speakingWeight;
  const headYaw =
    headYawOffset + Math.cos(frame * 0.036) * 0.035 * speakingWeight;

  // Left Arm joint angles — smooth spring pose weights + gentle conversational sway
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

  // Right Arm joint angles — smooth spring pose weights + gentle conversational sway
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

  // Composed, grounded torso posture
  const torsoPitch = speakingWeight * 0.035 - isShrug * 0.03;
  const torsoYaw = isPresentL * 0.12 - isPresentR * 0.12;

  const scale = interpolate(enterProgress, [0, 1], [0.001, 1]);
  const auraScale = 1 + speakingWeight * 0.08;

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      scale={[scale, scale, scale]}
    >
      {/* Floor Aura Ring under the character (Smoothly glows during character's turn) */}
      <mesh
        position={[0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[auraScale, auraScale, 1]}
      >
        <ringGeometry args={[0.42, 0.56, 48]} />
        <meshBasicMaterial
          color={speakingWeight > 0.3 ? accentColor : primaryColor}
          transparent
          opacity={0.26 + speakingWeight * 0.46}
        />
      </mesh>
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.42, 48]} />
        <meshBasicMaterial
          color={primaryColor}
          transparent
          opacity={0.08 + speakingWeight * 0.14}
        />
      </mesh>

      {/* ==================== LEGS ==================== */}
      {/* Left Leg */}
      <group position={[-0.16, 0.9, 0]}>
        <mesh>
          <sphereGeometry args={[0.085, 24, 24]} />
          <meshStandardMaterial color="#1E293B" roughness={0.35} metalness={0.4} />
        </mesh>
        <mesh position={[0, -0.22, 0]}>
          <capsuleGeometry args={[0.075, 0.28, 16, 24]} />
          <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.2} />
        </mesh>
        <mesh position={[0, -0.44, 0]}>
          <sphereGeometry args={[0.08, 24, 24]} />
          <meshStandardMaterial color={accentColor} roughness={0.25} metalness={0.3} />
        </mesh>
        <mesh position={[0, -0.66, 0]}>
          <capsuleGeometry args={[0.068, 0.28, 16, 24]} />
          <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.2} />
        </mesh>
        <mesh position={[0, -0.84, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.075, 0.12, 16, 24]} />
          <meshStandardMaterial color="#F8FAFC" roughness={0.2} metalness={0.1} />
        </mesh>
      </group>

      {/* Right Leg */}
      <group position={[0.16, 0.9, 0]}>
        <mesh>
          <sphereGeometry args={[0.085, 24, 24]} />
          <meshStandardMaterial color="#1E293B" roughness={0.35} metalness={0.4} />
        </mesh>
        <mesh position={[0, -0.22, 0]}>
          <capsuleGeometry args={[0.075, 0.28, 16, 24]} />
          <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.2} />
        </mesh>
        <mesh position={[0, -0.44, 0]}>
          <sphereGeometry args={[0.08, 24, 24]} />
          <meshStandardMaterial color={accentColor} roughness={0.25} metalness={0.3} />
        </mesh>
        <mesh position={[0, -0.66, 0]}>
          <capsuleGeometry args={[0.068, 0.28, 16, 24]} />
          <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.2} />
        </mesh>
        <mesh position={[0, -0.84, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.075, 0.12, 16, 24]} />
          <meshStandardMaterial color="#F8FAFC" roughness={0.2} metalness={0.1} />
        </mesh>
      </group>

      {/* ==================== UPPER BODY & TORSO ==================== */}
      <group
        position={[0, 0.94 + breath, 0]}
        rotation={[torsoPitch, torsoYaw, 0]}
      >
        {/* Pelvis / Waist Ring */}
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.21, 0.19, 0.12, 32]} />
          <meshStandardMaterial color="#1E293B" roughness={0.35} metalness={0.45} />
        </mesh>

        {/* Main Stylized Capsule Torso */}
        <mesh position={[0, 0.44, 0]}>
          <capsuleGeometry args={[0.25, 0.42, 24, 32]} />
          <meshStandardMaterial
            color={primaryColor}
            roughness={0.24}
            metalness={0.18}
          />
        </mesh>

        {/* Glowing Chest Core Badge */}
        <mesh position={[0, 0.48, 0.245]}>
          <sphereGeometry args={[0.068, 24, 24]} />
          <meshBasicMaterial
            color={speakingWeight > 0.3 ? '#FFFFFF' : accentColor}
          />
        </mesh>
        <mesh position={[0, 0.48, 0.235]}>
          <ringGeometry args={[0.075, 0.105, 32]} />
          <meshBasicMaterial color={accentColor} />
        </mesh>

        {/* Metallic Collar Ring */}
        <mesh position={[0, 0.84, 0]}>
          <cylinderGeometry args={[0.16, 0.2, 0.08, 32]} />
          <meshStandardMaterial color="#E2E8F0" roughness={0.2} metalness={0.6} />
        </mesh>

        {/* ==================== ARTICULATED LEFT ARM ==================== */}
        <group
          position={[-0.34, 0.72, 0]}
          rotation={[leftShoulderX, 0, leftShoulderZ]}
        >
          <mesh>
            <sphereGeometry args={[0.095, 24, 24]} />
            <meshStandardMaterial color="#F8FAFC" roughness={0.2} metalness={0.3} />
          </mesh>
          <mesh position={[0, -0.19, 0]}>
            <capsuleGeometry args={[0.068, 0.24, 16, 24]} />
            <meshStandardMaterial color={primaryColor} roughness={0.25} metalness={0.15} />
          </mesh>
          <group position={[0, -0.38, 0]} rotation={[leftElbowX, 0, 0]}>
            <mesh>
              <sphereGeometry args={[0.078, 24, 24]} />
              <meshStandardMaterial color={accentColor} roughness={0.25} metalness={0.3} />
            </mesh>
            <mesh position={[0, -0.18, 0]}>
              <capsuleGeometry args={[0.062, 0.22, 16, 24]} />
              <meshStandardMaterial color="#F8FAFC" roughness={0.22} metalness={0.1} />
            </mesh>
            <mesh position={[0, -0.36, 0]}>
              <sphereGeometry args={[0.092, 24, 24]} />
              <meshStandardMaterial color="#FFFFFF" roughness={0.18} metalness={0.1} />
            </mesh>
          </group>
        </group>

        {/* ==================== ARTICULATED RIGHT ARM ==================== */}
        <group
          position={[0.34, 0.72, 0]}
          rotation={[rightShoulderX, 0, rightShoulderZ]}
        >
          <mesh>
            <sphereGeometry args={[0.095, 24, 24]} />
            <meshStandardMaterial color="#F8FAFC" roughness={0.2} metalness={0.3} />
          </mesh>
          <mesh position={[0, -0.19, 0]}>
            <capsuleGeometry args={[0.068, 0.24, 16, 24]} />
            <meshStandardMaterial color={primaryColor} roughness={0.25} metalness={0.15} />
          </mesh>
          <group position={[0, -0.38, 0]} rotation={[rightElbowX, 0, 0]}>
            <mesh>
              <sphereGeometry args={[0.078, 24, 24]} />
              <meshStandardMaterial color={accentColor} roughness={0.25} metalness={0.3} />
            </mesh>
            <mesh position={[0, -0.18, 0]}>
              <capsuleGeometry args={[0.062, 0.22, 16, 24]} />
              <meshStandardMaterial color="#F8FAFC" roughness={0.22} metalness={0.1} />
            </mesh>
            <mesh position={[0, -0.36, 0]}>
              <sphereGeometry args={[0.092, 24, 24]} />
              <meshStandardMaterial color="#FFFFFF" roughness={0.18} metalness={0.1} />
            </mesh>
          </group>
        </group>

        {/* ==================== FLOATING EXPRESSIVE 3D HEAD ==================== */}
        <group
          position={[0, 1.24 + Math.sin(frame * 0.038 - 0.4) * 0.008, 0]}
          rotation={[headPitch, headYaw, headRoll]}
        >
          {/* Main Matte Ceramic Head Sphere */}
          <mesh>
            <sphereGeometry args={[0.31, 36, 36]} />
            <meshStandardMaterial
              color="#FFFFFF"
              roughness={0.18}
              metalness={0.08}
            />
          </mesh>

          {/* Side Ear / Headphone Accent Discs */}
          <mesh position={[-0.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.09, 0.09, 0.05, 24]} />
            <meshStandardMaterial color={primaryColor} roughness={0.25} metalness={0.3} />
          </mesh>
          <mesh position={[0.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.09, 0.09, 0.05, 24]} />
            <meshStandardMaterial color={primaryColor} roughness={0.25} metalness={0.3} />
          </mesh>

          {/* Glossy Dark Visor Faceplate */}
          <mesh position={[0, 0.02, 0.165]} scale={[0.86, 0.62, 0.68]}>
            <sphereGeometry args={[0.295, 32, 32]} />
            <meshStandardMaterial
              color="#090D16"
              roughness={0.1}
              metalness={0.35}
            />
          </mesh>

          {/* Calm Expressive LED Eyes */}
          <mesh position={[-0.095, 0.055, 0.355]}>
            <capsuleGeometry args={[0.028, 0.032, 12, 16]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
          <mesh position={[0.095, 0.055, 0.355]}>
            <capsuleGeometry args={[0.028, 0.032, 12, 16]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>

          {/* Smooth Speech Equalizer inside Dark Visor */}
          {[-0.055, 0, 0.055].map((xOff, idx) => {
            const barHeight =
              0.012 +
              speechEnergy * (idx === 1 ? 0.046 : 0.028);
            return (
              <mesh
                key={idx}
                position={[xOff, -0.032, 0.358]}
                scale={[1, barHeight / 0.012, 1]}
              >
                <boxGeometry args={[0.026, 0.012, 0.016]} />
                <meshBasicMaterial
                  color={speakingWeight > 0.25 ? '#FFFFFF' : accentColor}
                />
              </mesh>
            );
          })}
        </group>
      </group>
    </group>
  );
};
