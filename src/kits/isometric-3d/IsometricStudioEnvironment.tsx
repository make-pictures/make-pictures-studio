import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export interface IsometricStudioEnvironmentProps {
  /** Frame when Turn 2 starts (hologram morphs from manual blocks to 3D code crystal) */
  codeMorphFrame: number;
  /** Frame when Turn 3 starts (60 FPS satellite nodes & full studio energy activate) */
  finaleActivateFrame: number;
}

export const IsometricStudioEnvironment: React.FC<
  IsometricStudioEnvironmentProps
> = ({ codeMorphFrame, finaleActivateFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const stageEnter = spring({
    frame: frame - 2,
    fps,
    config: { damping: 200, stiffness: 48, mass: 1.3 },
  });

  const codeMorph = spring({
    frame: frame - codeMorphFrame,
    fps,
    config: { damping: 200, stiffness: 32, mass: 1.4 },
  });

  const finaleBoost = spring({
    frame: frame - finaleActivateFrame,
    fps,
    config: { damping: 200, stiffness: 34, mass: 1.3 },
  });

  const stageScale = interpolate(stageEnter, [0, 1], [0.001, 1]);
  const holoColor =
    codeMorph > 0.5
      ? finaleBoost > 0.5
        ? '#10B981'
        : '#6366F1'
      : '#F59E0B';

  return (
    <group scale={[stageScale, stageScale, stageScale]}>
      {/* ==================== STUDIO LIGHTING ==================== */}
      <ambientLight intensity={1.15} color="#F8FAFC" />
      <directionalLight
        position={[7, 12, 8]}
        intensity={1.75}
        color="#FFFFFF"
      />
      <directionalLight
        position={[-8, 6, -4]}
        intensity={0.75}
        color="#C7D2FE"
      />
      <pointLight
        position={[0, 2.2, 0.2]}
        intensity={1.6 + codeMorph * 1.2 + finaleBoost * 1.2}
        distance={6}
        color={holoColor}
      />

      {/* ==================== ISOMETRIC DIORAMA BASE SLAB ==================== */}
      {/* Main Studio Floor Slab */}
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[8.4, 0.4, 6.4]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.25} metalness={0.05} />
      </mesh>
      {/* Glowing Neon Under-Rim */}
      <mesh position={[0, -0.43, 0]}>
        <boxGeometry args={[8.48, 0.07, 6.48]} />
        <meshBasicMaterial color="#5723E7" />
      </mesh>
      {/* Dark Pedestal Base */}
      <mesh position={[0, -0.62, 0]}>
        <boxGeometry args={[8.1, 0.32, 6.1]} />
        <meshStandardMaterial color="#1E1B4B" roughness={0.4} metalness={0.3} />
      </mesh>

      {/* Subtle Isometric Floor Grid Strips */}
      {[-3, -2, -1, 0, 1, 2, 3].map((x) => (
        <mesh key={`gx-${x}`} position={[x, 0.004, 0]}>
          <boxGeometry args={[0.018, 0.004, 5.8]} />
          <meshBasicMaterial color="#E2E8F0" />
        </mesh>
      ))}
      {[-2, -1, 0, 1, 2].map((z) => (
        <mesh key={`gz-${z}`} position={[0, 0.004, z]}>
          <boxGeometry args={[7.8, 0.004, 0.018]} />
          <meshBasicMaterial color="#E2E8F0" />
        </mesh>
      ))}

      {/* ==================== ARCHITECTURAL CUTAWAY WALLS ==================== */}
      {/* Back Wall (-Z) */}
      <mesh position={[0, 1.45, -3.05]}>
        <boxGeometry args={[8.4, 2.9, 0.28]} />
        <meshStandardMaterial color="#F1F5F9" roughness={0.3} metalness={0.05} />
      </mesh>
      {/* Back Wall Top Accent Strip */}
      <mesh position={[0, 2.92, -3.05]}>
        <boxGeometry args={[8.4, 0.08, 0.3]} />
        <meshBasicMaterial color="#6366F1" />
      </mesh>

      {/* Left Cutaway Wall (-X) */}
      <mesh position={[-4.06, 1.45, 0]}>
        <boxGeometry args={[0.28, 2.9, 6.4]} />
        <meshStandardMaterial color="#E2E8F0" roughness={0.3} metalness={0.05} />
      </mesh>
      {/* Left Wall Top Accent Strip */}
      <mesh position={[-4.06, 2.92, 0]}>
        <boxGeometry args={[0.3, 0.08, 6.4]} />
        <meshBasicMaterial color="#5723E7" />
      </mesh>

      {/* ==================== 3D STUDIO WALL PANELS & PROPS ==================== */}
      {/* Back Wall Wide Dark Screen Panel ("Video-as-Code Timeline Display") */}
      <group position={[0, 1.65, -2.86]}>
        <mesh>
          <boxGeometry args={[4.2, 1.55, 0.08]} />
          <meshStandardMaterial color="#0F172A" roughness={0.2} metalness={0.4} />
        </mesh>
        {/* Glowing Code/Timeline Bars inside the Wall Screen (Steady, no jitter) */}
        {[-0.42, -0.14, 0.14, 0.42].map((yOff, idx) => {
          const baseW = 1.25 + ((idx * 0.55) % 1.3);
          const barWidth = baseW + codeMorph * 0.45 + finaleBoost * 0.25;
          const barColor =
            codeMorph > 0.5
              ? idx % 2 === 0
                ? '#10B981'
                : '#818CF8'
              : idx % 2 === 0
              ? '#F59E0B'
              : '#F43F5E';
          return (
            <mesh
              key={idx}
              position={[-1.5 + barWidth / 2, yOff, 0.05]}
              scale={[barWidth, 1, 1]}
            >
              <boxGeometry args={[1, 0.13, 0.03]} />
              <meshBasicMaterial color={barColor} />
            </mesh>
          );
        })}
      </group>

      {/* Left Wall Architectural Vertical Light Pillars */}
      {[-1.6, 0, 1.6].map((zPos, i) => (
        <mesh key={i} position={[-3.88, 1.45, zPos]}>
          <boxGeometry args={[0.08, 2.1, 0.18]} />
          <meshBasicMaterial
            color={i === 1 ? '#10B981' : '#6366F1'}
          />
        </mesh>
      ))}

      {/* ==================== CENTRAL HOLOGRAPHIC PEDESTAL TABLE ==================== */}
      <group position={[0, 0, 0.35]}>
        {/* Base Ring */}
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.92, 1.02, 0.08, 48]} />
          <meshStandardMaterial color="#1E293B" roughness={0.3} metalness={0.5} />
        </mesh>
        {/* Pedestal Column */}
        <mesh position={[0, 0.46, 0]}>
          <cylinderGeometry args={[0.38, 0.52, 0.84, 48]} />
          <meshStandardMaterial color="#F8FAFC" roughness={0.22} metalness={0.15} />
        </mesh>
        {/* Table Top Surface */}
        <mesh position={[0, 0.9, 0]}>
          <cylinderGeometry args={[1.05, 0.95, 0.1, 48]} />
          <meshStandardMaterial color="#0F172A" roughness={0.15} metalness={0.45} />
        </mesh>
        {/* Glowing Projector Emitter Ring on Table Top */}
        <mesh position={[0, 0.96, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.68, 0.82, 48]} />
          <meshBasicMaterial color={holoColor} />
        </mesh>
        <mesh position={[0, 0.958, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.65, 48]} />
          <meshBasicMaterial color={holoColor} transparent opacity={0.22} />
        </mesh>

        {/* ==================== PHASE 1: MANUAL TIMELINE BLOCKS ==================== */}
        {codeMorph < 0.98 && (
          <group
            position={[0, 1.62, 0]}
            scale={[1 - codeMorph, 1 - codeMorph, 1 - codeMorph]}
          >
            {[-0.45, 0, 0.45].map((xOff, idx) => (
              <mesh
                key={idx}
                position={[
                  xOff,
                  Math.sin(frame * 0.032 + idx * 1.8) * 0.06,
                  (idx - 1) * 0.14,
                ]}
                rotation={[
                  0.12 * Math.sin(frame * 0.025 + idx),
                  frame * 0.006 + idx * 0.5,
                  0.14 * Math.cos(frame * 0.028 + idx),
                ]}
              >
                <boxGeometry args={[0.42, 0.22, 0.28]} />
                <meshStandardMaterial
                  color={idx === 1 ? '#F43F5E' : '#F59E0B'}
                  roughness={0.2}
                  metalness={0.2}
                />
              </mesh>
            ))}
          </group>
        )}

        {/* ==================== PHASE 2 & 3: PROCEDURAL 3D CODE CRYSTAL HOLOGRAM ==================== */}
        {codeMorph > 0.02 && (
          <group
            position={[0, 1.76 + Math.sin(frame * 0.03) * 0.03, 0]}
            scale={[codeMorph, codeMorph, codeMorph]}
          >
            {/* Central Octahedron 3D Engine Core */}
            <mesh
              rotation={[
                frame * 0.007,
                frame * 0.011,
                frame * 0.005,
              ]}
              scale={[
                1 + finaleBoost * 0.16,
                1 + finaleBoost * 0.16,
                1 + finaleBoost * 0.16,
              ]}
            >
              <octahedronGeometry args={[0.42, 0]} />
              <meshStandardMaterial
                color={finaleBoost > 0.5 ? '#10B981' : '#5723E7'}
                emissive={finaleBoost > 0.5 ? '#059669' : '#4338CA'}
                emissiveIntensity={0.65}
                roughness={0.15}
                metalness={0.4}
              />
            </mesh>

            {/* Outer Orbital Ring 1 */}
            <mesh
              rotation={[
                Math.PI / 3 + frame * 0.008,
                frame * 0.01,
                0,
              ]}
            >
              <torusGeometry args={[0.68, 0.022, 16, 64]} />
              <meshBasicMaterial color="#818CF8" />
            </mesh>

            {/* Outer Orbital Ring 2 */}
            <mesh
              rotation={[
                -Math.PI / 3 - frame * 0.007,
                -frame * 0.009,
                Math.PI / 4,
              ]}
            >
              <torusGeometry args={[0.82, 0.022, 16, 64]} />
              <meshBasicMaterial color="#10B981" />
            </mesh>

            {/* Phase 3: Calm Orbiting Satellite Nodes */}
            {finaleBoost > 0.02 &&
              [0, 1, 2, 3].map((satIdx) => {
                const angle = frame * 0.014 + (satIdx * Math.PI) / 2;
                const radius = 0.95 * finaleBoost;
                return (
                  <mesh
                    key={satIdx}
                    position={[
                      Math.cos(angle) * radius,
                      Math.sin(angle * 2) * 0.08,
                      Math.sin(angle) * radius,
                    ]}
                    scale={[finaleBoost, finaleBoost, finaleBoost]}
                  >
                    <sphereGeometry args={[0.085, 20, 20]} />
                    <meshBasicMaterial
                      color={satIdx % 2 === 0 ? '#10B981' : '#FFFFFF'}
                    />
                  </mesh>
                );
              })}
          </group>
        )}
      </group>
    </group>
  );
};
