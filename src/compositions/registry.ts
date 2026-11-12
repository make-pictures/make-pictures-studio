import {
  type CompositionSceneSegment,
  type DefinedProduction,
  isVerticalComposition,
  registerCustomStyles,
  registerVoiceoverManifest,
  type SceneVoiceoverData,
  type StylePreset,
  type StudioCompositionEntry,
  type VisualKitId,
} from '@make-pictures/core';
import { BUILTIN_EXAMPLE_PRODUCTIONS } from '../../examples';
import { VOICEOVER_MANIFEST } from '../generated/voiceover-data';

export {
  type CompositionSceneSegment,
  isVerticalComposition,
  type StudioCompositionEntry,
  type VisualKitId,
};

export { ArchitectureDemoStandalone } from '../../examples/aether-promo';

declare global {
  interface ImportMeta {
    glob(
      pattern: string,
      options: { eager: true }
    ): Record<string, Record<string, unknown>>;
  }
}

interface WebpackContext {
  keys(): string[];
  (id: string): Record<string, unknown>;
}

interface WebpackRequire {
  context(
    directory: string,
    useSubdirectories: boolean,
    regExp: RegExp
  ): WebpackContext;
}

declare const require: WebpackRequire;

// Seed global voiceover lookup with root examples manifest
registerVoiceoverManifest(VOICEOVER_MANIFEST);

function unwrapJsonModule(raw: unknown): StylePreset | null {
  if (!raw || typeof raw !== 'object') return null;
  const unwrapped =
    'default' in (raw as Record<string, unknown>) &&
    typeof (raw as Record<string, unknown>).default === 'object' &&
    (raw as Record<string, unknown>).default !== null
      ? (raw as Record<string, unknown>).default
      : raw;
  return unwrapped as StylePreset;
}

function discoverWorkspaceCustomStyles(): void {
  const discoveredStyles: StylePreset[] = [];
  let viteStylesLoaded = false;

  try {
    const viteStyles = import.meta.glob('../../styles/*.style.json', {
      eager: true,
    });
    if (viteStyles) {
      viteStylesLoaded = true;
      for (const [, mod] of Object.entries(viteStyles).sort(([a], [b]) =>
        a.localeCompare(b)
      )) {
        const candidate = unwrapJsonModule(mod);
        if (candidate) discoveredStyles.push(candidate);
      }
    }
  } catch {
    // Non-Vite bundler (Webpack / Node tsx) — handled below
  }

  if (!viteStylesLoaded) {
    try {
      const stylesCtx = require.context(
        '../../styles',
        false,
        /^\.\/[^/]+\.style\.json$/
      );
      for (const key of stylesCtx.keys().sort()) {
        const candidate = unwrapJsonModule(stylesCtx(key));
        if (candidate) discoveredStyles.push(candidate);
      }
    } catch {
      // Non-Webpack runtime or styles/ directory does not exist yet
    }
  }

  if (discoveredStyles.length > 0) {
    registerCustomStyles(discoveredStyles);
  }
}

discoverWorkspaceCustomStyles();

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

function extractEntriesFromModule(
  mod: Record<string, unknown> | undefined,
  sourcePath: string
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

function discoverAllCompositions(): StudioCompositionEntry[] {
  const seenIds = new Set<string>();
  const result: StudioCompositionEntry[] = [];

  const pushUnique = (entries: StudioCompositionEntry[]) => {
    for (const entry of entries) {
      if (!seenIds.has(entry.id)) {
        seenIds.add(entry.id);
        result.push(entry);
      }
    }
  };

  // 1. Curated built-in showcases in deterministic Studio order
  for (const prod of BUILTIN_EXAMPLE_PRODUCTIONS) {
    if (prod.voiceoverManifest) {
      registerVoiceoverManifest(prod.voiceoverManifest);
    }
    pushUnique(prod.compositions);
  }

  // 2. Vite compile-time glob discovery (`Studio Web`)
  // Vite statically rewrites `import.meta.glob(...)` into a module map object;
  // in Webpack / Node `tsx`, calling `import.meta.glob` throws and falls through cleanly.
  let viteGlobSucceeded = false;
  try {
    const viteExamples = import.meta.glob('../../examples/*/index.{ts,tsx}', {
      eager: true,
    });
    const viteProductions = import.meta.glob(
      '../../productions/*/index.{ts,tsx}',
      { eager: true }
    );

    if (viteExamples && viteProductions) {
      viteGlobSucceeded = true;

      for (const [modPath, mod] of Object.entries(viteExamples).sort(([a], [b]) =>
        a.localeCompare(b)
      )) {
        pushUnique(extractEntriesFromModule(mod, modPath));
      }

      for (const [modPath, mod] of Object.entries(viteProductions).sort(
        ([a], [b]) => a.localeCompare(b)
      )) {
        pushUnique(extractEntriesFromModule(mod, modPath));
      }
    }
  } catch {
    // Non-Vite bundler (Webpack / Node tsx) — handled below
  }

  // 3. Webpack `require.context` discovery (`Remotion CLI` / `qa` / `render`)
  // IMPORTANT: Call `require.context(...)` directly inside `try / catch` without
  // `typeof require.context === 'function'` guards — Webpack's parser rewrites
  // `typeof require.context` to `"undefined"`, which would dead-strip the block.
  if (!viteGlobSucceeded) {
    try {
      const examplesCtx = require.context(
        '../../examples',
        true,
        /^\.\/[^/]+\/index\.tsx?$/
      );
      for (const key of examplesCtx.keys().sort()) {
        pushUnique(
          extractEntriesFromModule(examplesCtx(key), `examples/${key.slice(2)}`)
        );
      }
    } catch {
      // Non-Webpack runtime (e.g. Node `tsx`) — built-in examples already loaded
    }

    try {
      const productionsCtx = require.context(
        '../../productions',
        true,
        /^\.\/[^/]+\/index\.tsx?$/
      );
      for (const key of productionsCtx.keys().sort()) {
        pushUnique(
          extractEntriesFromModule(
            productionsCtx(key),
            `productions/${key.slice(2)}`
          )
        );
      }
    } catch {
      // Non-Webpack runtime or no productions context
    }
  }

  return result;
}

export const STUDIO_COMPOSITIONS: StudioCompositionEntry[] =
  discoverAllCompositions();

export function getCompositionById(
  id: string
): StudioCompositionEntry | undefined {
  return STUDIO_COMPOSITIONS.find((comp) => comp.id === id);
}
