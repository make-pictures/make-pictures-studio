import {
  type DefinedProduction,
  registerVoiceoverManifest,
  type SceneVoiceoverData,
  type StudioCompositionEntry,
} from '@make-pictures/core';

function isDefinedProduction(val: unknown): val is DefinedProduction {
  return (
    Boolean(val) &&
    typeof val === 'object' &&
    Array.isArray((val as DefinedProduction).compositions)
  );
}

function isCompositionEntry(val: unknown): val is StudioCompositionEntry {
  return (
    Boolean(val) &&
    typeof val === 'object' &&
    typeof (val as StudioCompositionEntry).id === 'string' &&
    typeof (val as StudioCompositionEntry).component === 'function'
  );
}

function inferOriginFromPath(
  sourcePath: string
): 'example' | 'production' | undefined {
  if (sourcePath.includes('productions/')) return 'production';
  if (sourcePath.includes('examples/')) return 'example';
  return undefined;
}

function inferProductionIdFromPath(sourcePath: string): string | undefined {
  const match = sourcePath.match(/(?:examples|productions)\/([^/]+)\//);
  return match ? match[1] : undefined;
}

export function extractStudioCompositionsFromModule(
  mod: Record<string, unknown> | undefined,
  sourcePath = ''
): StudioCompositionEntry[] {
  if (!mod || typeof mod !== 'object') return [];

  const maybeVo =
    (mod.VOICEOVER_MANIFEST as Record<string, SceneVoiceoverData> | undefined) ??
    (mod.voiceoverManifest as Record<string, SceneVoiceoverData> | undefined);
  if (maybeVo && typeof maybeVo === 'object') {
    registerVoiceoverManifest(maybeVo);
  }

  const fallbackOrigin = inferOriginFromPath(sourcePath);
  const fallbackProdId = inferProductionIdFromPath(sourcePath);

  const candidates = [
    mod.STUDIO_COMPOSITIONS,
    mod.default,
    mod.production,
    mod.COMPOSITIONS,
    mod.compositions,
  ];

  for (const candidate of candidates) {
    if (isDefinedProduction(candidate)) {
      if (candidate.voiceoverManifest) {
        registerVoiceoverManifest(candidate.voiceoverManifest);
      }
      return candidate.compositions.map((comp) => ({
        ...comp,
        origin: comp.origin ?? candidate.origin ?? fallbackOrigin,
        productionId: comp.productionId ?? candidate.id ?? fallbackProdId,
      }));
    }
    if (Array.isArray(candidate)) {
      const valid = candidate.filter(isCompositionEntry);
      if (valid.length > 0) {
        return valid.map((comp) => ({
          ...comp,
          origin: comp.origin ?? fallbackOrigin,
          productionId: comp.productionId ?? fallbackProdId,
        }));
      }
    }
    if (isCompositionEntry(candidate)) {
      return [
        {
          ...candidate,
          origin: candidate.origin ?? fallbackOrigin,
          productionId: candidate.productionId ?? fallbackProdId,
        },
      ];
    }
  }

  return [];
}

export function mergeStudioCompositionModules(
  modules: Array<{ path: string; mod: Record<string, unknown> | undefined }>
): StudioCompositionEntry[] {
  const seen = new Set<string>();
  const result: StudioCompositionEntry[] = [];

  for (const { path: modPath, mod } of modules) {
    for (const entry of extractStudioCompositionsFromModule(mod, modPath)) {
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        result.push(entry);
      }
    }
  }

  return result;
}
