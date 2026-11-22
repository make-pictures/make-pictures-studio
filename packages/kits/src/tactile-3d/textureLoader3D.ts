import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { continueRender, delayRender } from 'remotion';

export interface TexturePreloadSpec {
  src: string;
  colorSpace?: THREE.ColorSpace;
  anisotropy?: number;
}

const MAX_DEFAULT_CACHE_ENTRIES = 128;
const TEXTURE_CACHE = new Map<string, THREE.Texture>();
const IN_FLIGHT_LOADS = new Map<string, Promise<THREE.Texture | null>>();

function makeCacheKey(src: string, colorSpace: THREE.ColorSpace): string {
  return `${colorSpace}::${src}`;
}

export function getCachedTexture3D(
  src: string,
  colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace
): THREE.Texture | null {
  const key = makeCacheKey(src, colorSpace);
  const hit = TEXTURE_CACHE.get(key) ?? null;
  if (hit) {
    // Refresh LRU order
    TEXTURE_CACHE.delete(key);
    TEXTURE_CACHE.set(key, hit);
  }
  return hit;
}

export function pruneTextureCache3D(
  maxEntries = MAX_DEFAULT_CACHE_ENTRIES
): number {
  const limit = Math.max(0, Math.floor(maxEntries));
  let evicted = 0;
  while (TEXTURE_CACHE.size > limit) {
    const oldestKey = TEXTURE_CACHE.keys().next().value;
    if (oldestKey === undefined) break;
    const tex = TEXTURE_CACHE.get(oldestKey);
    TEXTURE_CACHE.delete(oldestKey);
    tex?.dispose();
    evicted += 1;
  }
  return evicted;
}

/**
 * Loads a Three.js texture into the module-level LRU cache.
 * On load error, logs a warning and resolves to `null` (never hangs Remotion `delayRender`).
 */
export function loadCachedTexture3D(
  spec: TexturePreloadSpec
): Promise<THREE.Texture | null> {
  const colorSpace = spec.colorSpace ?? THREE.SRGBColorSpace;
  const key = makeCacheKey(spec.src, colorSpace);
  const cached = getCachedTexture3D(spec.src, colorSpace);
  if (cached) {
    return Promise.resolve(cached);
  }
  const existing = IN_FLIGHT_LOADS.get(key);
  if (existing) {
    return existing;
  }

  const promise = new Promise<THREE.Texture | null>((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      spec.src,
      (texture) => {
        texture.colorSpace = colorSpace;
        texture.anisotropy = spec.anisotropy ?? 16;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;
        texture.needsUpdate = true;

        TEXTURE_CACHE.set(key, texture);
        pruneTextureCache3D(MAX_DEFAULT_CACHE_ENTRIES);
        IN_FLIGHT_LOADS.delete(key);
        resolve(texture);
      },
      undefined,
      (err) => {
        console.warn(
          `[make-pictures/tactile-3d] Failed to load texture "${spec.src}":`,
          err
        );
        IN_FLIGHT_LOADS.delete(key);
        resolve(null);
      }
    );
  });

  IN_FLIGHT_LOADS.set(key, promise);
  return promise;
}

const PENDING_ADVANCE_FNS = new Set<() => void>();
let advanceScheduled = false;

/**
 * Coalesces multiple async texture-ready R3F `invalidate`/`advance` calls
 * into a single microtask/frame redraw under Remotion `frameloop="never"`.
 */
export function scheduleCoalescedThreeAdvance(fn: () => void): void {
  PENDING_ADVANCE_FNS.add(fn);
  if (advanceScheduled) return;
  advanceScheduled = true;

  const flush = () => {
    advanceScheduled = false;
    const fns = Array.from(PENDING_ADVANCE_FNS);
    PENDING_ADVANCE_FNS.clear();
    for (const cb of fns) {
      try {
        cb();
      } catch {
        // Ignore stale unmount callbacks
      }
    }
  };

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(flush);
  } else {
    queueMicrotask(flush);
  }
}

export interface PreloadedTextures3DResult {
  textures: Record<string, THREE.Texture | null>;
  ready: boolean;
}

/**
 * Deterministically preloads all 3D textures behind Remotion `delayRender` so
 * headless rendering never captures unloaded meshes, and triggers a coalesced
 * redraw when textures decode in Remotion Player / Studio Web.
 */
export function usePreloadedTextures3D(
  specs: ReadonlyArray<TexturePreloadSpec>,
  options?: { advance?: () => void }
): PreloadedTextures3DResult {
  const specSignature = useMemo(
    () =>
      specs
        .map((s) => `${s.src}|${s.colorSpace ?? THREE.SRGBColorSpace}|${s.anisotropy ?? 16}`)
        .join(';;'),
    [specs]
  );

  const [state, setState] = useState<PreloadedTextures3DResult>(() => {
    const initial: Record<string, THREE.Texture | null> = {};
    let allReady = true;
    for (const spec of specs) {
      const hit = getCachedTexture3D(
        spec.src,
        spec.colorSpace ?? THREE.SRGBColorSpace
      );
      initial[spec.src] = hit;
      if (!hit) allReady = false;
    }
    return { textures: initial, ready: allReady };
  });

  useEffect(() => {
    let cancelled = false;
    const missing = specs.filter(
      (s) => !getCachedTexture3D(s.src, s.colorSpace ?? THREE.SRGBColorSpace)
    );

    if (missing.length === 0) {
      const resolved: Record<string, THREE.Texture | null> = {};
      for (const spec of specs) {
        resolved[spec.src] = getCachedTexture3D(
          spec.src,
          spec.colorSpace ?? THREE.SRGBColorSpace
        );
      }
      setState({ textures: resolved, ready: true });
      return;
    }

    const handle = delayRender(
      `tactile-3d-preload-textures (${missing.length})`
    );

    Promise.all(specs.map((spec) => loadCachedTexture3D(spec)))
      .then((loaded) => {
        if (cancelled) return;
        const map: Record<string, THREE.Texture | null> = {};
        for (let i = 0; i < specs.length; i++) {
          map[specs[i].src] = loaded[i];
        }
        setState({ textures: map, ready: true });
        if (options?.advance) {
          scheduleCoalescedThreeAdvance(options.advance);
        }
      })
      .finally(() => {
        continueRender(handle);
      });

    return () => {
      cancelled = true;
    };
  }, [specSignature]);

  return state;
}
