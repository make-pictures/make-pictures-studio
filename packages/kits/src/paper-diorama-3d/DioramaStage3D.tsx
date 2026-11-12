import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useStudioStyle } from '@make-pictures/core';

export interface DioramaStage3DProps {
  variant?: 'minimal-plinth' | 'flat-sheet' | 'open-book';
  surfacePattern?: 'solid' | 'grid' | 'spotlight';
  pageTurnProgress?: number;
  width?: number;
  depth?: number;
  accentColor?: string;
  surfaceColor?: string;
  children?: React.ReactNode;
}

export const DioramaStage3D: React.FC<DioramaStage3DProps> = ({
  variant = 'minimal-plinth',
  surfacePattern = 'spotlight',
  pageTurnProgress = 0,
  width = 12,
  depth = 7.4,
  accentColor,
  surfaceColor,
  children,
}) => {
  const style = useStudioStyle();
  const resolvedSurface = surfaceColor ?? style.palette.bgSurface;
  const resolvedBase = style.palette.bgElevated;
  const resolvedBorder = style.palette.inkBorder;
  const resolvedAccent = accentColor ?? style.palette.accentPrimary;

  const surfaceTexture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 640;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = resolvedSurface;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (surfacePattern === 'grid') {
      ctx.strokeStyle = `${resolvedBorder}`;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 2;
      for (let x = 0; x <= canvas.width; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y <= canvas.height; y += 64) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (surfacePattern === 'spotlight') {
      const grad = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        40,
        canvas.width / 2,
        canvas.height / 2,
        canvas.width * 0.55
      );
      grad.addColorStop(0, resolvedSurface);
      grad.addColorStop(1, resolvedBase);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.strokeStyle = resolvedAccent;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 6;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
    ctx.globalAlpha = 1;

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [resolvedSurface, resolvedBase, resolvedBorder, resolvedAccent, surfacePattern]);

  const turnAngle = Math.max(0, Math.min(1, pageTurnProgress)) * Math.PI;

  return (
    <group>
      {/* Ambient floor plane */}
      <mesh position={[0, -0.26, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[42, 32]} />
        <meshStandardMaterial color={style.palette.bgCanvas} roughness={0.95} />
      </mesh>

      {/* Plinth / Book / Sheet */}
      {variant !== 'flat-sheet' ? (
        <mesh position={[0, -0.14, 0]} receiveShadow castShadow>
          <boxGeometry args={[width + 0.45, 0.22, depth + 0.45]} />
          <meshStandardMaterial
            color={variant === 'open-book' ? resolvedAccent : resolvedBorder}
            roughness={0.8}
          />
        </mesh>
      ) : null}

      <mesh position={[0, -0.01, 0]} receiveShadow>
        <boxGeometry args={[width, 0.05, depth]} />
        <meshStandardMaterial
          color={resolvedSurface}
          map={surfaceTexture ?? undefined}
          roughness={0.88}
        />
      </mesh>

      {variant === 'open-book' && pageTurnProgress > 0.001 && pageTurnProgress < 0.999 ? (
        <group position={[0, 0.03, 0]} rotation={[0, 0, turnAngle]}>
          <mesh position={[width * 0.24, 0, 0]} castShadow>
            <boxGeometry args={[width * 0.48, 0.02, depth * 0.96]} />
            <meshStandardMaterial color={resolvedSurface} roughness={0.85} />
          </mesh>
        </group>
      ) : null}

      {children}
    </group>
  );
};
