import React, { useMemo } from 'react';
import * as THREE from 'three';
import { PaperCutout3D } from './PaperCutout3D';

export type FloorTheme =
  | 'mint-plains'
  | 'checkerboard-tile'
  | 'warm-parquet'
  | 'valley-terrace';

/**
 * Generates a high-resolution 3D floor page texture with paper grain,
 * stitched page borders, and scene-specific floor patterns.
 */
const MAX_FLOOR_TEXTURES = 8;
const FLOOR_TEX_CACHE = new Map<FloorTheme, THREE.CanvasTexture>();

export function getFloorTexture(theme: FloorTheme): THREE.CanvasTexture {
  const existing = FLOOR_TEX_CACHE.get(theme);
  if (existing) {
    FLOOR_TEX_CACHE.delete(theme);
    FLOOR_TEX_CACHE.set(theme, existing);
    return existing;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  if (theme === 'mint-plains') {
    const grad = ctx.createLinearGradient(0, 0, 0, 1024);
    grad.addColorStop(0, '#A7F3D0');
    grad.addColorStop(0.55, '#6EE7B7');
    grad.addColorStop(1, '#A7F3D0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);

    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.moveTo(410, 0);
    ctx.lineTo(614, 0);
    ctx.lineTo(760, 1024);
    ctx.lineTo(264, 1024);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 6;
    ctx.setLineDash([18, 14]);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (theme === 'checkerboard-tile') {
    ctx.fillStyle = '#FFFBEB';
    ctx.fillRect(0, 0, 1024, 1024);
    const cols = 12;
    const rows = 12;
    const cw = 1024 / cols;
    const rh = 1024 / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r + c) % 2 === 0) {
          ctx.fillStyle = '#334155';
          ctx.fillRect(c * cw, r * rh, cw, rh);
        } else {
          ctx.fillStyle = '#FEF3C7';
          ctx.fillRect(c * cw, r * rh, cw, rh);
        }
      }
    }
  } else if (theme === 'warm-parquet') {
    ctx.fillStyle = '#B45309';
    ctx.fillRect(0, 0, 1024, 1024);
    for (let r = 0; r < 16; r++) {
      ctx.fillStyle = r % 2 === 0 ? '#92400E' : '#B45309';
      ctx.fillRect(0, r * 64, 1024, 62);
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, r * 64);
      ctx.lineTo(1024, r * 64);
      ctx.stroke();
    }
    ctx.fillStyle = '#881337';
    ctx.fillRect(140, 180, 744, 660);
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 14;
    ctx.strokeRect(164, 204, 696, 612);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, 1024);
    grad.addColorStop(0, '#A7F3D0');
    grad.addColorStop(0.62, '#6EE7B7');
    grad.addColorStop(0.63, '#D97706');
    grad.addColorStop(1, '#92400E');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);
  }

  // Book Page Cream Margin
  ctx.strokeStyle = '#FFFDF7';
  ctx.lineWidth = 28;
  ctx.strokeRect(14, 14, 996, 996);

  ctx.strokeStyle = '#D6C4A8';
  ctx.lineWidth = 6;
  ctx.strokeRect(28, 28, 968, 968);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  if (FLOOR_TEX_CACHE.size >= MAX_FLOOR_TEXTURES) {
    const oldestKey = FLOOR_TEX_CACHE.keys().next().value;
    if (oldestKey !== undefined) {
      const oldestTex = FLOOR_TEX_CACHE.get(oldestKey);
      FLOOR_TEX_CACHE.delete(oldestKey);
      oldestTex?.dispose();
    }
  }
  FLOOR_TEX_CACHE.set(theme, tex);
  return tex;
}

export interface PaperBookPageTurn3DProps {
  /** Progress (0..1) of an active page sheet transition from right (0) to left (1) */
  pageTurnProgress: number;
  /** Floor theme of the newly revealed spread */
  nextFloorTheme: FloorTheme;
  /** Spread width in 3D units (default 23.4) */
  spreadWidth?: number;
  /** Spread depth in 3D units (default 15.4) */
  spreadDepth?: number;
}

/**
 * PaperBookPageTurn3D — Flat-sliding 3D paper sheet transition across the Pop-Up Book stage.
 */
export const PaperBookPageTurn3D: React.FC<PaperBookPageTurn3DProps> = ({
  pageTurnProgress,
  nextFloorTheme,
  spreadWidth = 23.4,
  spreadDepth = 15.4,
}) => {
  const nextFloorTex = useMemo(
    () => getFloorTexture(nextFloorTheme),
    [nextFloorTheme]
  );

  const isTurning = pageTurnProgress > 0.01 && pageTurnProgress < 0.99;
  if (!isTurning) {
    return null;
  }

  const halfW = spreadWidth / 2;
  const smoothP = 0.5 - 0.5 * Math.cos(pageTurnProgress * Math.PI);
  const rollX = halfW - smoothP * spreadWidth;
  const unrolledWidth = Math.max(0.05, halfW - rollX);
  const unrolledCenterX = rollX + unrolledWidth / 2;

  return (
    <group>
      <mesh
        position={[unrolledCenterX, 0.015, -0.5]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[unrolledWidth, spreadDepth, 1]}
        receiveShadow
      >
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          map={nextFloorTex}
          roughness={0.88}
          metalness={0.02}
        />
      </mesh>

      <mesh
        position={[rollX, 0.024, -0.5]}
        scale={[0.18, 0.018, spreadDepth + 0.02]}
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#FFFDF7"
          roughness={0.85}
          metalness={0.02}
        />
      </mesh>
      <mesh
        position={[rollX + 0.12, 0.026, -0.5]}
        scale={[0.06, 0.018, spreadDepth - 0.02]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#FBBF24"
          roughness={0.4}
          metalness={0.45}
        />
      </mesh>
    </group>
  );
};

/**
 * The 3D Hardcover Pop-Up Book Base & Active Spread Floor
 */
export const PopUpBookBase3D: React.FC<{
  floorTheme: FloorTheme;
  nextFloorTheme?: FloorTheme;
  /** Progress (0..1) of an active page roll/turn from right (0) to left (1) */
  pageTurnProgress?: number;
}> = ({ floorTheme, nextFloorTheme, pageTurnProgress = 0 }) => {
  const floorTex = useMemo(() => getFloorTexture(floorTheme), [floorTheme]);

  return (
    <group>
      {/* Warm Dark Wooden Tabletop under the Pop-Up Book */}
      <mesh
        position={[0, -0.42, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[64, 48]} />
        <meshStandardMaterial color="#3B1D0A" roughness={0.92} />
      </mesh>

      {/* Hardcover Leather Book Binding Board */}
      <mesh position={[0, -0.22, -0.5]} receiveShadow castShadow>
        <boxGeometry args={[24.6, 0.18, 16.6]} />
        <meshStandardMaterial color="#7C2D12" roughness={0.8} metalness={0.08} />
      </mesh>

      {/* Gold Foil Book Corner Accents */}
      {[
        [-11.9, -8.0],
        [11.9, -8.0],
        [-11.9, 7.0],
        [11.9, 7.0],
      ].map(([cx, cz], i) => (
        <mesh key={i} position={[cx, -0.12, cz]}>
          <boxGeometry args={[0.8, 0.06, 0.8]} />
          <meshStandardMaterial
            color="#FBBF24"
            roughness={0.35}
            metalness={0.65}
          />
        </mesh>
      ))}

      {/* Thick Cream Paper Block (Stack of Book Pages) */}
      <mesh position={[0, -0.08, -0.5]} receiveShadow castShadow>
        <boxGeometry args={[23.6, 0.16, 15.6]} />
        <meshStandardMaterial color="#F5EFE6" roughness={0.9} />
      </mesh>

      {/* Active Open Spread Surface */}
      <mesh
        position={[0, 0.005, -0.5]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[23.4, 15.4]} />
        <meshStandardMaterial
          map={floorTex}
          roughness={0.88}
          metalness={0.02}
        />
      </mesh>

      {/* Flat Sliding Page Sheet Transition */}
      <PaperBookPageTurn3D
        pageTurnProgress={pageTurnProgress}
        nextFloorTheme={nextFloorTheme ?? floorTheme}
      />
    </group>
  );
};

/**
 * 3D Paper Cloud Cutout with Thick White Paper Border & Shadow Casting
 * @deprecated Legacy Mount Everest showcase prop — build custom cutouts or use DioramaStage3D in new productions.
 */
export const PaperCloudCutout3D: React.FC<{
  position: [number, number, number];
  scale?: number;
  tint?: string;
  idSuffix?: string;
}> = ({ position, scale = 1, tint = '#FCE7F3', idSuffix = 'pink' }) => (
  <PaperCutout3D
    cacheKey={`paper-cloud-${idSuffix}`}
    cacheDeps={[tint]}
    width={2.6 * scale}
    height={1.3 * scale}
    pixelWidth={512}
    pixelHeight={256}
    whiteBorderPx={16}
    position={position}
    anchor="center"
    thickness={0.045}
    draw={(ctx) => {
      ctx.fillStyle = tint;
      ctx.strokeStyle = '#F472B6';
      ctx.lineWidth = 6;

      ctx.beginPath();
      ctx.moveTo(90, 195);
      ctx.lineTo(422, 195);
      ctx.bezierCurveTo(468, 195, 472, 130, 420, 122);
      ctx.bezierCurveTo(412, 65, 340, 48, 300, 82);
      ctx.bezierCurveTo(272, 22, 178, 26, 156, 88);
      ctx.bezierCurveTo(108, 74, 62, 112, 76, 152);
      ctx.bezierCurveTo(42, 158, 48, 195, 90, 195);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(244, 114, 182, 0.18)';
      ctx.beginPath();
      ctx.ellipse(256, 172, 145, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }}
  />
);

/**
 * 3D Paper Pine Tree Cutout (For multi-plane valley parallax & shadows)
 * @deprecated Legacy Mount Everest showcase prop — build custom cutouts or use DioramaStage3D in new productions.
 */
export const PaperPineTree3D: React.FC<{
  position: [number, number, number];
  scale?: number;
  foldProgress?: number;
}> = ({ position, scale = 1 }) => (
  <PaperCutout3D
    cacheKey="paper-pine-tree"
    width={1.35 * scale}
    height={2.1 * scale}
    pixelWidth={256}
    pixelHeight={384}
    whiteBorderPx={14}
    position={position}
    anchor="bottom"
    thickness={0.04}
    draw={(ctx) => {
      ctx.fillStyle = '#78350F';
      ctx.fillRect(108, 285, 40, 75);

      const tiers = [
        { yTop: 155, yBot: 295, halfW: 92, color: '#059669' },
        { yTop: 92, yBot: 215, halfW: 76, color: '#10B981' },
        { yTop: 36, yBot: 145, halfW: 56, color: '#34D399' },
      ];
      for (const t of tiers) {
        ctx.fillStyle = t.color;
        ctx.strokeStyle = '#065F46';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(128, t.yTop);
        ctx.lineTo(128 + t.halfW, t.yBot);
        ctx.lineTo(128 - t.halfW, t.yBot);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }}
  />
);

/**
 * Multi-Plane 3D Paper Cutout Mountain Backdrop
 * @deprecated Legacy Mount Everest showcase prop — build custom cutouts or use DioramaStage3D in new productions.
 */
export const PaperMountainBackdrop3D: React.FC<{
  position?: [number, number, number];
  scale?: number;
}> = ({ position = [0, 0, -5.2], scale = 1 }) => {
  return (
    <group position={position} scale={scale}>
      {/* West Peak */}
      <PaperCutout3D
        cacheKey="paper-mountain-west"
        width={4.6}
        height={3.8}
        pixelWidth={512}
        pixelHeight={420}
        whiteBorderPx={14}
        position={[-3.2, 0, -0.9]}
        thickness={0.05}
        draw={(ctx) => {
          ctx.fillStyle = '#C4B5FD';
          ctx.strokeStyle = '#7C3AED';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(256, 36);
          ctx.lineTo(480, 396);
          ctx.lineTo(32, 396);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#F5F3FF';
          ctx.beginPath();
          ctx.moveTo(256, 36);
          ctx.lineTo(340, 185);
          ctx.lineTo(276, 155);
          ctx.lineTo(234, 195);
          ctx.lineTo(172, 185);
          ctx.closePath();
          ctx.fill();
        }}
      />

      {/* East Peak */}
      <PaperCutout3D
        cacheKey="paper-mountain-east"
        width={4.8}
        height={4.0}
        pixelWidth={512}
        pixelHeight={420}
        whiteBorderPx={14}
        position={[3.4, 0, -0.8]}
        thickness={0.05}
        draw={(ctx) => {
          ctx.fillStyle = '#A5B4FC';
          ctx.strokeStyle = '#4F46E5';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(256, 30);
          ctx.lineTo(484, 396);
          ctx.lineTo(28, 396);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#EEF2FF';
          ctx.beginPath();
          ctx.moveTo(256, 30);
          ctx.lineTo(348, 180);
          ctx.lineTo(282, 152);
          ctx.lineTo(222, 188);
          ctx.lineTo(164, 178);
          ctx.closePath();
          ctx.fill();
        }}
      />

      {/* Central Peak */}
      <PaperCutout3D
        cacheKey="paper-mountain-center"
        width={5.4}
        height={4.8}
        pixelWidth={560}
        pixelHeight={500}
        whiteBorderPx={16}
        position={[0, 0, 0]}
        thickness={0.055}
        draw={(ctx) => {
          ctx.fillStyle = '#60A5FA';
          ctx.strokeStyle = '#1D4ED8';
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.moveTo(280, 28);
          ctx.lineTo(528, 476);
          ctx.lineTo(32, 476);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.moveTo(280, 28);
          ctx.lineTo(384, 216);
          ctx.lineTo(318, 178);
          ctx.lineTo(280, 224);
          ctx.lineTo(236, 182);
          ctx.lineTo(176, 216);
          ctx.closePath();
          ctx.fill();
        }}
      />
    </group>
  );
};
