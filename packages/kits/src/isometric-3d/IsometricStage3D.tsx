import React from 'react';
import { useStudioStyle } from '@make-pictures/core';

export interface IsometricStage3DProps {
  radius?: number;
  showGrid?: boolean;
  accentColor?: string;
  surfaceColor?: string;
  children?: React.ReactNode;
}

export const IsometricStage3D: React.FC<IsometricStage3DProps> = ({
  radius = 5.4,
  showGrid = true,
  accentColor,
  surfaceColor,
  children,
}) => {
  const style = useStudioStyle();
  const resolvedSurface = surfaceColor ?? style.palette.bgSurface;
  const resolvedAccent = accentColor ?? style.palette.accentPrimary;

  return (
    <group>
      <ambientLight intensity={style.surface.isDark ? 0.65 : 0.9} />
      <directionalLight
        position={[7, 12, 8]}
        intensity={style.surface.isDark ? 1.25 : 1.05}
        castShadow
      />
      <pointLight
        position={[-5, 4, -4]}
        intensity={0.55}
        color={style.palette.accentSecondary}
      />

      {/* Base platform */}
      <mesh position={[0, -0.18, 0]} receiveShadow>
        <cylinderGeometry args={[radius, radius * 1.04, 0.32, 48]} />
        <meshStandardMaterial color={resolvedSurface} roughness={0.82} />
      </mesh>

      {/* Accent rim */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.94, radius * 0.985, 64]} />
        <meshBasicMaterial color={resolvedAccent} transparent opacity={0.65} />
      </mesh>

      {showGrid ? (
        <gridHelper
          args={[
            radius * 1.65,
            12,
            resolvedAccent,
            style.palette.inkBorder,
          ]}
          position={[0, 0.005, 0]}
        />
      ) : null}

      {children}
    </group>
  );
};
