import { useEffect, useMemo, useRef, useState } from 'react';
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

export function makeTextureCacheKey3D(
  src: string,
  colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace,
  anisotropy = 16
): string {
  return `${colorSpace}::${anisotropy}::${src}`;
}

function makeCacheKey(
  src: string,
  colorSpace: THREE.ColorSpace,
  anisotropy = 16
): string {
  return makeTextureCacheKey3D(src, colorSpace, anisotropy);
}

export function getCachedTexture3D(
  src: string,
  colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace,
  anisotropy = 16
): THREE.Texture | null {
  const key = makeCacheKey(src, colorSpace, anisotropy);
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
 * On load error or synchronous throw, logs a warning and resolves to `null` (never hangs Remotion `delayRender`).
 */
export function loadCachedTexture3D(
  spec: TexturePreloadSpec
): Promise<THREE.Texture | null> {
  const colorSpace = spec.colorSpace ?? THREE.SRGBColorSpace;
  const anisotropy = spec.anisotropy ?? 16;
  const key = makeCacheKey(spec.src, colorSpace, anisotropy);
  const cached = getCachedTexture3D(spec.src, colorSpace, anisotropy);
  if (cached) {
    return Promise.resolve(cached);
  }
  const existing = IN_FLIGHT_LOADS.get(key);
  if (existing) {
    return existing;
  }

  let settled = false;
  const promise = new Promise<THREE.Texture | null>((resolve) => {
    const finish = (value: THREE.Texture | null) => {
      if (settled) return;
      settled = true;
      IN_FLIGHT_LOADS.delete(key);
      resolve(value);
    };

    try {
      const loader = new THREE.TextureLoader();
      loader.load(
        spec.src,
        (texture) => {
          texture.colorSpace = colorSpace;
          texture.anisotropy = anisotropy;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.generateMipmaps = true;
          texture.needsUpdate = true;

          TEXTURE_CACHE.set(key, texture);
          pruneTextureCache3D(MAX_DEFAULT_CACHE_ENTRIES);
          finish(texture);
        },
        undefined,
        (err) => {
          console.warn(
            `[make-pictures/tactile-3d] Failed to load texture "${spec.src}":`,
            err
          );
          finish(null);
        }
      );
    } catch (err) {
      console.warn(
        `[make-pictures/tactile-3d] Synchronous error loading texture "${spec.src}":`,
        err
      );
      finish(null);
    }
  });

  if (!settled) {
    IN_FLIGHT_LOADS.set(key, promise);
  }
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
  texturesByKey: Record<string, THREE.Texture | null>;
  ready: boolean;
}

function buildCacheSnapshot(
  specs: ReadonlyArray<TexturePreloadSpec>
): PreloadedTextures3DResult {
  const textures: Record<string, THREE.Texture | null> = {};
  const texturesByKey: Record<string, THREE.Texture | null> = {};
  let allReady = true;
  for (const spec of specs) {
    const colorSpace = spec.colorSpace ?? THREE.SRGBColorSpace;
    const anisotropy = spec.anisotropy ?? 16;
    const key = makeCacheKey(spec.src, colorSpace, anisotropy);
    const hit = getCachedTexture3D(spec.src, colorSpace, anisotropy);
    textures[spec.src] = hit;
    texturesByKey[key] = hit;
    if (!hit) allReady = false;
  }
  return { textures, texturesByKey, ready: allReady };
}

/**
 * Deterministically preloads all 3D textures behind Remotion `delayRender` so
 * headless rendering never captures unloaded meshes, and triggers a coalesced
 * redraw when textures decode in Remotion Player / Remotion Studio.
 */
export function usePreloadedTextures3D(
  specs: ReadonlyArray<TexturePreloadSpec>,
  options?: { advance?: () => void }
): PreloadedTextures3DResult {
  const advanceRef = useRef<(() => void) | undefined>(options?.advance);
  advanceRef.current = options?.advance;

  const specSignature = useMemo(
    () =>
      specs
        .map(
          (s) =>
            `${s.src}|${s.colorSpace ?? THREE.SRGBColorSpace}|${s.anisotropy ?? 16}`
        )
        .join(';;'),
    [specs]
  );

  const [state, setState] = useState<
    PreloadedTextures3DResult & { signature: string }
  >(() => ({
    ...buildCacheSnapshot(specs),
    signature: specSignature,
  }));

  useEffect(() => {
    let cancelled = false;
    const snapshot = buildCacheSnapshot(specs);
    const missing = specs.filter(
      (s) =>
        !getCachedTexture3D(
          s.src,
          s.colorSpace ?? THREE.SRGBColorSpace,
          s.anisotropy ?? 16
        )
    );

    if (missing.length === 0) {
      setState({ ...snapshot, ready: true, signature: specSignature });
      return;
    }

    // Reset ready synchronously when specs introduces uncached entries
    setState({ ...snapshot, ready: false, signature: specSignature });

    let released = false;
    const handle = delayRender(
      `tactile-3d-preload-textures (${missing.length})`
    );
    const release = () => {
      if (released) return;
      released = true;
      continueRender(handle);
    };

    Promise.all(specs.map((spec) => loadCachedTexture3D(spec)))
      .then((loaded) => {
        if (cancelled) return;
        const textures: Record<string, THREE.Texture | null> = {};
        const texturesByKey: Record<string, THREE.Texture | null> = {};
        for (let i = 0; i < specs.length; i++) {
          const spec = specs[i]!;
          const colorSpace = spec.colorSpace ?? THREE.SRGBColorSpace;
          const anisotropy = spec.anisotropy ?? 16;
          const key = makeCacheKey(spec.src, colorSpace, anisotropy);
          const tex = loaded[i] ?? null;
          textures[spec.src] = tex;
          texturesByKey[key] = tex;
        }
        setState({
          textures,
          texturesByKey,
          ready: true,
          signature: specSignature,
        });
        if (advanceRef.current) {
          scheduleCoalescedThreeAdvance(advanceRef.current);
        }
      })
      .catch((err) => {
        console.warn(
          '[make-pictures/tactile-3d] Unexpected error preloading textures:',
          err
        );
        if (!cancelled) {
          setState({
            ...buildCacheSnapshot(specs),
            ready: true,
            signature: specSignature,
          });
        }
      })
      .finally(() => {
        release();
      });

    return () => {
      cancelled = true;
      release();
    };
  }, [specSignature]);

  if (state.signature !== specSignature) {
    return buildCacheSnapshot(specs);
  }

  return {
    textures: state.textures,
    texturesByKey: state.texturesByKey,
    ready: state.ready,
  };
}
