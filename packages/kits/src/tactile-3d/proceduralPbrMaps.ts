import * as THREE from 'three';
import { createSeededRandom } from '../../../core/src/utils';

export type ProceduralPbrMaterialKind =
  | 'linen-weave'
  | 'wood-grain'
  | 'cotton-paper'
  | 'brushed-metal';

export interface ProceduralPbrMaps {
  map: THREE.Texture;
  bumpMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

export interface ProceduralPbrOptions {
  seed?: string;
  repeat?: [number, number];
  size?: number;
}

const PBR_MAP_CACHE = new Map<string, ProceduralPbrMaps>();

function clampByte(v: number, min = 0, max = 255): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function createTextureFromRgba(
  rgba: Uint8Array,
  width: number,
  height: number,
  colorSpace: THREE.ColorSpace,
  repeat: [number, number]
): THREE.Texture {
  let texture: THREE.Texture;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imgData = ctx.createImageData(width, height);
      imgData.data.set(rgba);
      ctx.putImageData(imgData, 0, 0);
      texture = new THREE.CanvasTexture(canvas);
    } else {
      texture = new THREE.DataTexture(rgba, width, height, THREE.RGBAFormat);
    }
  } else {
    texture = new THREE.DataTexture(rgba, width, height, THREE.RGBAFormat);
  }

  texture.colorSpace = colorSpace;
  texture.anisotropy = 16;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.needsUpdate = true;
  return texture;
}

function generateBuffers(
  kind: ProceduralPbrMaterialKind,
  width: number,
  height: number,
  seed: string
): { mapData: Uint8Array; bumpData: Uint8Array; roughData: Uint8Array } {
  const len = width * height * 4;
  const mapData = new Uint8Array(len);
  const bumpData = new Uint8Array(len);
  const roughData = new Uint8Array(len);
  const rng = createSeededRandom(`${kind}::${seed}`);

  if (kind === 'linen-weave') {
    const warpHarmonic = Math.max(1, Math.round(width / 3.2));
    const weftHarmonic = Math.max(1, Math.round(height / 3.2));
    for (let y = 0; y < height; y++) {
      const ny = (y / height) * Math.PI * 2;
      for (let x = 0; x < width; x++) {
        const nx = (x / width) * Math.PI * 2;
        const warp = Math.sin(nx * warpHarmonic);
        const weft = Math.cos(ny * weftHarmonic);
        const basket = ((x >> 2) + (y >> 2)) & 1 ? 1 : -1;
        const slub = (rng() - 0.5) * 18;
        const cross = warp * 0.5 + weft * 0.5 + basket * 0.38;
        const base = clampByte(224 + cross * 22 + slub, 174, 254);
        const bump = clampByte(130 + cross * 36 + slub, 0, 255);
        const rough = clampByte(226 - (warp + weft) * 14 + slub * 0.6, 192, 252);

        const idx = (y * width + x) * 4;
        mapData[idx] = clampByte(base + weft * 4 - warp * 3, 174, 255);
        mapData[idx + 1] = clampByte(base + 3, 178, 255);
        mapData[idx + 2] = clampByte(base + warp * 4, 174, 255);
        mapData[idx + 3] = 255;

        bumpData[idx] = bumpData[idx + 1] = bumpData[idx + 2] = bump;
        bumpData[idx + 3] = 255;

        roughData[idx] = roughData[idx + 1] = roughData[idx + 2] = rough;
        roughData[idx + 3] = 255;
      }
    }
    return { mapData, bumpData, roughData };
  }

  if (kind === 'wood-grain') {
    for (let y = 0; y < height; y++) {
      const ny = (y / height) * Math.PI * 2;
      for (let x = 0; x < width; x++) {
        const nx = (x / width) * Math.PI * 2;
        const wave =
          Math.sin(ny * 7 + Math.sin(nx * 2) * 1.25) * 0.52 +
          Math.sin(ny * 17 + Math.cos(nx * 3) * 0.72) * 0.3 +
          Math.sin(ny * 35 + nx * 1) * 0.18;
        const pore = rng() > 0.96 ? -36 : (rng() - 0.5) * 9;
        const lum = clampByte(220 + wave * 30 + pore, 145, 255);
        const bump = clampByte(128 + wave * 42 + pore * 1.1, 0, 255);
        const rough = clampByte(184 - wave * 24 - pore * 0.5, 118, 244);

        const idx = (y * width + x) * 4;
        mapData[idx] = clampByte(lum + 8, 140, 255);
        mapData[idx + 1] = clampByte(lum * 0.94, 130, 255);
        mapData[idx + 2] = clampByte(lum * 0.84, 120, 255);
        mapData[idx + 3] = 255;

        bumpData[idx] = bumpData[idx + 1] = bumpData[idx + 2] = bump;
        bumpData[idx + 3] = 255;

        roughData[idx] = roughData[idx + 1] = roughData[idx + 2] = rough;
        roughData[idx + 3] = 255;
      }
    }
    return { mapData, bumpData, roughData };
  }

  if (kind === 'brushed-metal') {
    const rowWaveHarmonic = Math.max(1, Math.round((height * 0.7) / (Math.PI * 2)));
    const fineYHarmonic = Math.max(1, Math.round((height * 0.15) / (Math.PI * 2)));
    const rowBias = new Float32Array(height);
    for (let y = 0; y < height; y++) {
      const ny = (y / height) * Math.PI * 2;
      rowBias[y] = (rng() - 0.5) * 34 + Math.sin(ny * rowWaveHarmonic) * 10;
    }
    for (let y = 0; y < height; y++) {
      const ny = (y / height) * Math.PI * 2;
      const streak = rowBias[y]!;
      for (let x = 0; x < width; x++) {
        const nx = (x / width) * Math.PI * 2;
        const fine =
          Math.sin(nx * 2 + ny * fineYHarmonic) * 6 + (rng() - 0.5) * 8;
        const lum = clampByte(226 + streak * 0.6 + fine, 180, 255);
        const bump = clampByte(128 + streak * 1.4 + fine, 0, 255);
        const rough = clampByte(88 - streak * 0.7 + fine * 0.6, 44, 162);

        const idx = (y * width + x) * 4;
        mapData[idx] = mapData[idx + 1] = mapData[idx + 2] = lum;
        mapData[idx + 3] = 255;

        bumpData[idx] = bumpData[idx + 1] = bumpData[idx + 2] = bump;
        bumpData[idx + 3] = 255;

        roughData[idx] = roughData[idx + 1] = roughData[idx + 2] = rough;
        roughData[idx + 3] = 255;
      }
    }
    return { mapData, bumpData, roughData };
  }

  // 'cotton-paper'
  for (let y = 0; y < height; y++) {
    const ny = (y / height) * Math.PI * 2;
    for (let x = 0; x < width; x++) {
      const nx = (x / width) * Math.PI * 2;
      const grain = (rng() - 0.5) * 26;
      const pulp =
        Math.sin(nx * 8 + ny * 5) * 7 + Math.cos(nx * 3 - ny * 9) * 7;
      const lum = clampByte(242 + grain * 0.45 + pulp * 0.45, 212, 255);
      const bump = clampByte(128 + grain * 1.3 + pulp * 1.4, 0, 255);
      const rough = clampByte(224 - pulp * 0.8 + grain * 0.5, 194, 252);

      const idx = (y * width + x) * 4;
      mapData[idx] = lum;
      mapData[idx + 1] = clampByte(lum - 2, 206, 255);
      mapData[idx + 2] = clampByte(lum - 6, 198, 255);
      mapData[idx + 3] = 255;

      bumpData[idx] = bumpData[idx + 1] = bumpData[idx + 2] = bump;
      bumpData[idx + 3] = 255;

      roughData[idx] = roughData[idx + 1] = roughData[idx + 2] = rough;
      roughData[idx + 3] = 255;
    }
  }
  return { mapData, bumpData, roughData };
}

/**
 * Deterministically generates (and caches) procedural PBR textures (`map`, `bumpMap`, `roughnessMap`)
 * using `createSeededRandom`. Zero external files, fully deterministic seeded PRNG.
 */
export function getProceduralPbrMaps(
  kind: ProceduralPbrMaterialKind,
  options: ProceduralPbrOptions = {}
): ProceduralPbrMaps {
  const defaultRepeat: Record<ProceduralPbrMaterialKind, [number, number]> = {
    'linen-weave': [8, 6],
    'wood-grain': [2.4, 1],
    'cotton-paper': [3, 4],
    'brushed-metal': [2, 2],
  };

  const seed = options.seed ?? `${kind}-v1`;
  const repeat = options.repeat ?? defaultRepeat[kind];
  const width = options.size ?? (kind === 'wood-grain' ? 512 : 256);
  const height =
    kind === 'wood-grain' ? Math.max(64, Math.floor(width / 2)) : width;
  const cacheKey = `${kind}|${seed}|${width}x${height}|${repeat[0]},${repeat[1]}`;

  const existing = PBR_MAP_CACHE.get(cacheKey);
  if (existing) {
    return existing;
  }

  const { mapData, bumpData, roughData } = generateBuffers(
    kind,
    width,
    height,
    seed
  );

  const maps: ProceduralPbrMaps = {
    map: createTextureFromRgba(
      mapData,
      width,
      height,
      THREE.SRGBColorSpace,
      repeat
    ),
    bumpMap: createTextureFromRgba(
      bumpData,
      width,
      height,
      THREE.NoColorSpace,
      repeat
    ),
    roughnessMap: createTextureFromRgba(
      roughData,
      width,
      height,
      THREE.NoColorSpace,
      repeat
    ),
  };

  PBR_MAP_CACHE.set(cacheKey, maps);
  return maps;
}

/**
 * Disposes all cached procedural PBR textures and clears the module cache.
 */
export function disposeProceduralPbrMaps(): number {
  let count = 0;
  for (const entry of PBR_MAP_CACHE.values()) {
    entry.map.dispose();
    entry.bumpMap.dispose();
    entry.roughnessMap.dispose();
    count += 1;
  }
  PBR_MAP_CACHE.clear();
  return count;
}
