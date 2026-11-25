/**
 * Deterministic 32-bit FNV-1a string hash & Mulberry32 PRNG.
 * Guarantees 100% frame-identical procedural textures across browser HMR
 * and multi-process Remotion CLI renders (zero `Math.random()`).
 */

export function fnv1aHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function hashToHex(input: string): string {
  return fnv1aHash(input).toString(16).padStart(8, '0');
}

/**
 * Mulberry32 deterministic PRNG returning floats in `[0, 1)`.
 */
export function createSeededRandom(seed: number | string): () => number {
  let state = typeof seed === 'string' ? fnv1aHash(seed) : seed >>> 0;
  if (state === 0) {
    state = 0x6d2b79f5;
  }

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
