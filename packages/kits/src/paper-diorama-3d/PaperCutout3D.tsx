import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import {
  createSeededRandom,
  hashToHex,
  useStudioFontsReady,
} from '@make-pictures/core';

export type PaperCutoutDep = string | number | boolean | null | undefined;

export interface PaperCutout3DProps {
  /** Base identifier for this cutout texture */
  cacheKey: string;
  /**
   * Optional reactive values captured inside `draw` (e.g. colors, dynamic labels from PropsInspector)
   * so live prop changes invalidate the cached CanvasTexture immediately in 0ms.
   */
  cacheDeps?: ReadonlyArray<PaperCutoutDep>;
  /** Canvas width in pixels (default 512) */
  pixelWidth?: number;
  /** Canvas height in pixels (default 512) */
  pixelHeight?: number;
  /** World width in 3D units */
  width: number;
  /** World height in 3D units */
  height: number;
  /** Drawing callback in pixel coordinates (0..pixelWidth, 0..pixelHeight) */
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  /** Thickness of the white Paper Mario die-cut border in pixels (default 14) */
  whiteBorderPx?: number;
  /** 3D position [x, y, z] */
  position?: [number, number, number];
  /** 3D rotation [rx, ry, rz] in radians */
  rotation?: [number, number, number];
  /** 3D scale (number or [sx, sy, sz]) */
  scale?: number | [number, number, number];
  /** Anchor point: 'bottom' puts y=0 at bottom edge (default for standing cutouts), 'center' puts (0,0) at center */
  anchor?: 'bottom' | 'center' | 'top';
  /** Cardboard thickness in 3D units (default 0.038) */
  thickness?: number;
  /** Cast 3D silhouette shadow (default true) */
  castShadow?: boolean;
  /** Receive 3D shadow (default true) */
  receiveShadow?: boolean;
  /** Emissive color for glowing paper elements (e.g. lasers, neon, golden ribbon) */
  emissive?: string;
  emissiveIntensity?: number;
  /** Opacity (default 1) */
  opacity?: number;
}

interface CachedPaperTextures {
  frontTexture: THREE.CanvasTexture;
  backTexture: THREE.CanvasTexture;
  depthMaterial: THREE.MeshDepthMaterial;
  refCount: number;
  disposed: boolean;
}

/**
 * Bounded LRU texture cache to prevent VRAM exhaustion (`WebGL context lost`)
 * across multi-hour HMR sessions in Studio Web.
 */
const MAX_CACHED_CUTOUTS = 64;
const TEXTURE_CACHE = new Map<string, CachedPaperTextures>();
let scheduledPruneTimer: ReturnType<typeof setTimeout> | null = null;

function touchCacheEntry(
  compositeKey: string,
  entry: CachedPaperTextures
): void {
  TEXTURE_CACHE.delete(compositeKey);
  TEXTURE_CACHE.set(compositeKey, entry);
}

function disposeCacheEntry(entry: CachedPaperTextures): void {
  if (entry.disposed) return;
  entry.disposed = true;
  entry.frontTexture.dispose();
  entry.backTexture.dispose();
  entry.depthMaterial.dispose();
}

export function prunePaperTextureCache(
  maxEntries: number = MAX_CACHED_CUTOUTS
): number {
  if (TEXTURE_CACHE.size <= maxEntries) return 0;

  let evicted = 0;
  for (const [key, entry] of TEXTURE_CACHE.entries()) {
    if (TEXTURE_CACHE.size <= maxEntries) break;
    if (entry.refCount <= 0) {
      TEXTURE_CACHE.delete(key);
      disposeCacheEntry(entry);
      evicted += 1;
    }
  }
  return evicted;
}

function scheduleCachePrune(): void {
  if (scheduledPruneTimer !== null) return;
  scheduledPruneTimer = setTimeout(() => {
    scheduledPruneTimer = null;
    prunePaperTextureCache();
  }, 60);
}

export function getPaperTextureCacheStats(): {
  size: number;
  activeCount: number;
  maxEntries: number;
} {
  let activeCount = 0;
  for (const entry of TEXTURE_CACHE.values()) {
    if (entry.refCount > 0) activeCount += 1;
  }
  return {
    size: TEXTURE_CACHE.size,
    activeCount,
    maxEntries: MAX_CACHED_CUTOUTS,
  };
}

// Cache Function -> FNV-1a hash so stable `draw` callbacks never re-stringify
// eslint-disable-next-line @typescript-eslint/ban-types
const DRAW_FN_HASH_CACHE = new WeakMap<Function, string>();

function getDrawFunctionHash(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): string {
  const cached = DRAW_FN_HASH_CACHE.get(draw);
  if (cached !== undefined) return cached;
  const computed = hashToHex(draw.toString());
  DRAW_FN_HASH_CACHE.set(draw, computed);
  return computed;
}

export function serializePaperCutoutDeps(
  cacheDeps?: ReadonlyArray<PaperCutoutDep>
): string {
  return cacheDeps && cacheDeps.length > 0
    ? cacheDeps.map((d) => String(d ?? '')).join('\u001f')
    : '';
}

export function buildPaperCutoutCompositeKey(
  cacheKey: string,
  pixelWidth: number,
  pixelHeight: number,
  whiteBorderPx: number,
  fontRevision: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  cacheDeps?: ReadonlyArray<PaperCutoutDep>
): string {
  const depsSignature = serializePaperCutoutDeps(cacheDeps);
  const fnHash = getDrawFunctionHash(draw);
  const codeAndDepsHash = depsSignature
    ? hashToHex(`${fnHash}\u001e${depsSignature}`)
    : fnHash;
  return `${cacheKey}|${pixelWidth}x${pixelHeight}|b${whiteBorderPx}|f${fontRevision}|h${codeAndDepsHash}`;
}

/**
 * Generates and caches a high-DPI Paper Mario die-cut texture:
 * 1. Renders the custom 2D illustration onto an offscreen canvas
 * 2. Dilates the alpha silhouette in 20 directions to create a thick, tactile
 *    cream-white paper cutout margin (#FFFDF7) + outer cardboard edge (#573B26)
 * 3. Adds deterministic seeded handmade paper fiber grain across the surface
 * 4. Creates a matching MeshDepthMaterial (alphaTest: 0.38) for exact 3D silhouette shadows
 */
function getOrCreatePaperCutoutTextures(
  compositeKey: string,
  seedKey: string,
  pixelWidth: number,
  pixelHeight: number,
  whiteBorderPx: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): CachedPaperTextures {
  const existing = TEXTURE_CACHE.get(compositeKey);
  if (existing && !existing.disposed) {
    touchCacheEntry(compositeKey, existing);
    return existing;
  }

  // 1. Draw raw artwork onto an offscreen source canvas
  const artCanvas = document.createElement('canvas');
  artCanvas.width = pixelWidth;
  artCanvas.height = pixelHeight;
  const artCtx = artCanvas.getContext('2d')!;
  artCtx.lineCap = 'round';
  artCtx.lineJoin = 'round';
  draw(artCtx, pixelWidth, pixelHeight);

  // 2. Create solid silhouette stamps for the white paper border & outer cut edge
  const whiteStampCanvas = document.createElement('canvas');
  whiteStampCanvas.width = pixelWidth;
  whiteStampCanvas.height = pixelHeight;
  const whiteCtx = whiteStampCanvas.getContext('2d')!;
  whiteCtx.drawImage(artCanvas, 0, 0);
  whiteCtx.globalCompositeOperation = 'source-in';
  whiteCtx.fillStyle = '#FFFDF7';
  whiteCtx.fillRect(0, 0, pixelWidth, pixelHeight);

  const edgeStampCanvas = document.createElement('canvas');
  edgeStampCanvas.width = pixelWidth;
  edgeStampCanvas.height = pixelHeight;
  const edgeCtx = edgeStampCanvas.getContext('2d')!;
  edgeCtx.drawImage(artCanvas, 0, 0);
  edgeCtx.globalCompositeOperation = 'source-in';
  edgeCtx.fillStyle = '#573B26';
  edgeCtx.fillRect(0, 0, pixelWidth, pixelHeight);

  // 3. Assemble the Final Front Paper Cutout Canvas
  const frontCanvas = document.createElement('canvas');
  frontCanvas.width = pixelWidth;
  frontCanvas.height = pixelHeight;
  const frontCtx = frontCanvas.getContext('2d')!;

  if (whiteBorderPx > 0) {
    const outerRadius = whiteBorderPx + 3.5;
    const steps = 20;
    // Outer dark kraft-paper cut edge
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      frontCtx.drawImage(
        edgeStampCanvas,
        Math.cos(angle) * outerRadius,
        Math.sin(angle) * outerRadius
      );
    }
    // Thick cream-white Paper Mario die-cut border (two concentric rings for solid fill)
    for (const r of [whiteBorderPx, whiteBorderPx * 0.55]) {
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        frontCtx.drawImage(
          whiteStampCanvas,
          Math.cos(angle) * r,
          Math.sin(angle) * r
        );
      }
    }
  }

  // Draw the crisp illustration on top of the white paper border
  frontCtx.drawImage(artCanvas, 0, 0);

  // Deterministic seeded paper fiber grain overlay inside the opaque silhouette (zero Math.random)
  const rng = createSeededRandom(`${seedKey}:${pixelWidth}x${pixelHeight}`);
  frontCtx.save();
  frontCtx.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 220; i++) {
    const gx = rng() * pixelWidth;
    const gy = rng() * pixelHeight;
    const fiberLen = 12 + rng() * 14;
    const fiberH = 1.2 + rng() * 1.1;
    const tilt = (rng() - 0.5) * 0.36;

    frontCtx.save();
    frontCtx.translate(gx, gy);
    frontCtx.rotate(tilt);
    frontCtx.fillStyle =
      i % 2 === 0 ? 'rgba(255, 253, 245, 0.036)' : 'rgba(120, 53, 15, 0.028)';
    frontCtx.fillRect(-fiberLen * 0.5, -fiberH * 0.5, fiberLen, fiberH);
    frontCtx.restore();
  }
  frontCtx.restore();

  // 4. Create the Cardboard Backing Canvas (visible on the back & side rim in 3D)
  const backCanvas = document.createElement('canvas');
  backCanvas.width = pixelWidth;
  backCanvas.height = pixelHeight;
  const backCtx = backCanvas.getContext('2d')!;
  backCtx.drawImage(frontCanvas, 0, 0);
  backCtx.globalCompositeOperation = 'source-in';
  backCtx.fillStyle = '#E6D7C3';
  backCtx.fillRect(0, 0, pixelWidth, pixelHeight);
  backCtx.globalCompositeOperation = 'source-over';

  // Release temporary helper canvas backing stores immediately
  artCanvas.width = 0;
  artCanvas.height = 0;
  whiteStampCanvas.width = 0;
  whiteStampCanvas.height = 0;
  edgeStampCanvas.width = 0;
  edgeStampCanvas.height = 0;

  const frontTexture = new THREE.CanvasTexture(frontCanvas);
  frontTexture.colorSpace = THREE.SRGBColorSpace;
  frontTexture.anisotropy = 8;
  frontTexture.needsUpdate = true;

  const backTexture = new THREE.CanvasTexture(backCanvas);
  backTexture.colorSpace = THREE.SRGBColorSpace;
  backTexture.anisotropy = 4;
  backTexture.needsUpdate = true;

  const depthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: frontTexture,
    alphaTest: 0.38,
  });

  const result: CachedPaperTextures = {
    frontTexture,
    backTexture,
    depthMaterial,
    refCount: 0,
    disposed: false,
  };
  TEXTURE_CACHE.set(compositeKey, result);
  prunePaperTextureCache();
  return result;
}

export const PaperCutout3D: React.FC<PaperCutout3DProps> = ({
  cacheKey,
  cacheDeps,
  pixelWidth = 512,
  pixelHeight = 512,
  width,
  height,
  draw,
  whiteBorderPx = 14,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  anchor = 'bottom',
  thickness = 0.038,
  castShadow = true,
  receiveShadow = true,
  emissive = '#000000',
  emissiveIntensity = 0,
  opacity = 1,
}) => {
  const fontRevision = useStudioFontsReady();
  const depsSignature = serializePaperCutoutDeps(cacheDeps);
  const drawFnHash = getDrawFunctionHash(draw);

  const compositeKey = useMemo(() => {
    const codeAndDepsHash = depsSignature
      ? hashToHex(`${drawFnHash}\u001e${depsSignature}`)
      : drawFnHash;
    return `${cacheKey}|${pixelWidth}x${pixelHeight}|b${whiteBorderPx}|f${fontRevision}|h${codeAndDepsHash}`;
  }, [
    cacheKey,
    pixelWidth,
    pixelHeight,
    whiteBorderPx,
    fontRevision,
    drawFnHash,
    depsSignature,
  ]);

  // `compositeKey` encodes every visual input (including `draw` source hash + `cacheDeps`),
  // so `cachedEntry` stays referentially stable across frames even if parent passes inline `draw` or `cacheDeps`.
  const cachedEntry = useMemo(
    () =>
      getOrCreatePaperCutoutTextures(
        compositeKey,
        cacheKey,
        pixelWidth,
        pixelHeight,
        whiteBorderPx,
        draw
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [compositeKey]
  );

  useEffect(() => {
    cachedEntry.refCount += 1;
    touchCacheEntry(compositeKey, cachedEntry);
    return () => {
      cachedEntry.refCount = Math.max(0, cachedEntry.refCount - 1);
      scheduleCachePrune();
    };
  }, [compositeKey, cachedEntry]);

  const { frontTexture, backTexture, depthMaterial } = cachedEntry;

  const yOffset =
    anchor === 'bottom' ? height / 2 : anchor === 'top' ? -height / 2 : 0;

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Front Illustrated Paper Surface */}
      <mesh
        position={[0, yOffset, 0]}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
        customDepthMaterial={depthMaterial}
      >
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          map={frontTexture}
          transparent
          alphaTest={0.35}
          opacity={opacity}
          roughness={0.86}
          metalness={0.04}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Mid & Back Cardboard Thickness Layers (gives tangible 3D paper edge when viewed at angles) */}
      {thickness > 0.005 && opacity > 0.5 && (
        <>
          <mesh
            position={[0, yOffset, -thickness * 0.5]}
            receiveShadow={receiveShadow}
          >
            <planeGeometry args={[width, height]} />
            <meshStandardMaterial
              map={backTexture}
              transparent
              alphaTest={0.38}
              roughness={0.94}
              metalness={0.0}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh
            position={[0, yOffset, -thickness]}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
            customDepthMaterial={depthMaterial}
          >
            <planeGeometry args={[width, height]} />
            <meshStandardMaterial
              map={frontTexture}
              transparent
              alphaTest={0.38}
              roughness={0.9}
              metalness={0.02}
              side={THREE.DoubleSide}
            />
          </mesh>
        </>
      )}
    </group>
  );
};

/**
 * PopUpHinge3D — Folds any 3D paper diorama element up from flat on the book page
 * (foldProgress: 0 = folded flat at -88 deg, 1 = standing upright at 0 deg)
 */
export const PopUpHinge3D: React.FC<{
  foldProgress: number;
  position?: [number, number, number];
  rotationY?: number;
  foldDirection?: 1 | -1;
  children: React.ReactNode;
}> = ({
  foldProgress,
  position = [0, 0, 0],
  foldDirection = 1,
  children,
}) => {
  const clamped = Math.max(0, Math.min(1.05, foldProgress));

  const theta = (1 - Math.min(1, clamped)) * (Math.PI * 0.46) * foldDirection;
  const c = Math.cos(theta);
  const s = Math.sin(theta);

  const posX = position[0];
  const posY = position[1];
  const posZ = position[2];

  const foldMatrix = useMemo(() => {
    const m = new THREE.Matrix4();
    m.set(
      1, 0, 0, posX,
      0, c, 0, posY,
      0, -s, 1, posZ,
      0, 0, 0, 1
    );
    return m;
  }, [c, s, posX, posY, posZ]);

  if (clamped <= 0.01) return null;

  return (
    <group matrixAutoUpdate={false} matrix={foldMatrix}>
      {children}
    </group>
  );
};
