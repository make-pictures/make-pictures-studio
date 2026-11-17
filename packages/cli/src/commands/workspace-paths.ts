import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface WorkspaceOptions {
  cwd?: string;
  dir?: string;
}

export interface WorkspaceContext {
  rootDir: string;
  studioDir: string;
  dirRel: string;
  isEngineMonorepo: boolean;
}

/**
 * Resolves `rootDir` (`--cwd` or `process.cwd()`) and `studioDir` (`--dir`, e.g. `videos` in a SaaS repo),
 * plus detects whether we are executing inside the `make-pictures-studio` engine monorepo.
 */
export function resolveWorkspaceContext(
  options: WorkspaceOptions = {}
): WorkspaceContext {
  const rootDir = path.resolve(options.cwd || process.cwd());
  const rawDir = options.dir?.trim() || '.';
  const studioDir = path.resolve(rootDir, rawDir);
  const dirRel = path.relative(rootDir, studioDir) || '.';
  const isEngineMonorepo =
    fs.existsSync(path.join(rootDir, 'packages', 'core', 'src', 'index.ts')) &&
    fs.existsSync(path.join(rootDir, 'packages', 'kits', 'src', 'index.ts'));

  return {
    rootDir,
    studioDir,
    dirRel,
    isEngineMonorepo,
  };
}

/**
 * Generates a pure TypeScript Remotion root entrypoint (`registerRoot`) that discovers
 * all isolated capsules in `productions/<slug>/index.{ts,tsx}` via Webpack `require.context`.
 * Uses `React.createElement` (no JSX in `.ts`) so `tsc --noEmit`, `esbuild`, and Remotion Webpack all pass cleanly.
 */
export function buildConsumerRemotionEntrySource(
  productionsRelPath: './productions' | '../productions'
): string {
  const stylesRelPath =
    productionsRelPath === './productions' ? './styles' : '../styles';

  return `import React from 'react';
import { Composition, registerRoot } from 'remotion';
import {
  registerCustomStyles,
  registerVoiceoverManifest,
  type DefinedProduction,
  type SceneVoiceoverData,
  type StudioCompositionEntry,
  type StylePreset,
} from '@make-pictures/core';

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

declare const require: {
  context(
    directory: string,
    useSubdirectories: boolean,
    regExp: RegExp
  ): WebpackContext;
};

function unwrapJsonPreset(mod: unknown): StylePreset | null {
  if (!mod || typeof mod !== 'object') return null;
  const raw =
    'default' in (mod as Record<string, unknown>) &&
    (mod as Record<string, unknown>).default
      ? (mod as Record<string, unknown>).default
      : mod;
  return raw && typeof raw === 'object' ? (raw as StylePreset) : null;
}

function discoverWorkspaceStyles(): void {
  const discovered: StylePreset[] = [];
  let viteStylesLoaded = false;

  try {
    const viteStyles = import.meta.glob('${stylesRelPath}/*.style.json', {
      eager: true,
    });
    if (viteStyles) {
      viteStylesLoaded = true;
      for (const [, mod] of Object.entries(viteStyles).sort(([a], [b]) =>
        a.localeCompare(b)
      )) {
        const preset = unwrapJsonPreset(mod);
        if (preset) discovered.push(preset);
      }
    }
  } catch {
    // Non-Vite runtime
  }

  if (!viteStylesLoaded) {
    try {
      const stylesCtx = require.context(
        '${stylesRelPath}',
        false,
        /^\\.\\/[^/]+\\.style\\.json$/
      );
      for (const key of stylesCtx.keys().sort()) {
        const preset = unwrapJsonPreset(stylesCtx(key));
        if (preset) discovered.push(preset);
      }
    } catch {
      // Non-Webpack runtime or styles/ absent
    }
  }

  if (discovered.length > 0) {
    registerCustomStyles(discovered);
  }
}

discoverWorkspaceStyles();

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

function extractEntries(
  mod: Record<string, unknown> | undefined
): StudioCompositionEntry[] {
  if (!mod || typeof mod !== 'object') return [];

  const maybeVo =
    (mod.VOICEOVER_MANIFEST as Record<string, SceneVoiceoverData> | undefined) ??
    (mod.voiceoverManifest as Record<string, SceneVoiceoverData> | undefined);
  if (maybeVo && typeof maybeVo === 'object') {
    registerVoiceoverManifest(maybeVo);
  }

  for (const candidate of [
    mod.default,
    mod.production,
    mod.COMPOSITIONS,
    mod.compositions,
  ]) {
    if (isDefinedProduction(candidate)) {
      if (candidate.voiceoverManifest) {
        registerVoiceoverManifest(candidate.voiceoverManifest);
      }
      return candidate.compositions;
    }
    if (Array.isArray(candidate)) {
      const valid = candidate.filter(isCompositionEntry);
      if (valid.length > 0) return valid;
    }
    if (isCompositionEntry(candidate)) {
      return [candidate];
    }
  }

  return [];
}

function discoverProductions(): StudioCompositionEntry[] {
  const entries: StudioCompositionEntry[] = [];
  const seen = new Set<string>();
  let viteLoaded = false;

  try {
    const viteProds = import.meta.glob('${productionsRelPath}/*/index.{ts,tsx}', {
      eager: true,
    });
    if (viteProds) {
      viteLoaded = true;
      for (const [, mod] of Object.entries(viteProds).sort(([a], [b]) =>
        a.localeCompare(b)
      )) {
        for (const comp of extractEntries(mod)) {
          if (!seen.has(comp.id)) {
            seen.add(comp.id);
            entries.push(comp);
          }
        }
      }
    }
  } catch {
    // Non-Vite runtime
  }

  if (!viteLoaded) {
    try {
      const ctx = require.context(
        '${productionsRelPath}',
        true,
        /^\\.\\/[^/]+\\/index\\.tsx?$/
      );
      for (const key of ctx.keys().sort()) {
        for (const comp of extractEntries(ctx(key))) {
          if (!seen.has(comp.id)) {
            seen.add(comp.id);
            entries.push(comp);
          }
        }
      }
    } catch {
      // Non-Webpack runtime
    }
  }

  return entries;
}

export const STUDIO_COMPOSITIONS: StudioCompositionEntry[] =
  discoverProductions();

export const RemotionRoot: React.FC = () =>
  React.createElement(
    React.Fragment,
    null,
    STUDIO_COMPOSITIONS.map((entry) =>
      React.createElement(Composition, {
        key: entry.id,
        id: entry.id,
        component: entry.component,
        durationInFrames: entry.durationInFrames,
        fps: entry.fps,
        width: entry.width,
        height: entry.height,
        defaultProps: entry.defaultProps,
        ...(entry.schema ? { schema: entry.schema } : {}),
      })
    )
  );

registerRoot(RemotionRoot);
`;
}

/**
 * Ensures a Remotion `registerRoot` entry exists for a consumer studio directory:
 * - Standalone root (`studioDir === rootDir`): `<studioDir>/src/index.ts` (loads `../productions`)
 * - Subdirectory mode (e.g. `--dir=videos`): `<studioDir>/index.ts` (loads `./productions`)
 */
export function ensureConsumerRemotionEntry(
  studioDir: string,
  rootDir = studioDir,
  overwrite = false
): string {
  const isSubdir = path.resolve(studioDir) !== path.resolve(rootDir);
  const entryPath = isSubdir
    ? path.join(studioDir, 'index.ts')
    : path.join(studioDir, 'src', 'index.ts');

  if (!fs.existsSync(entryPath) || overwrite) {
    fs.mkdirSync(path.dirname(entryPath), { recursive: true });
    const relProd = isSubdir ? './productions' : '../productions';
    fs.writeFileSync(
      entryPath,
      buildConsumerRemotionEntrySource(relProd),
      'utf8'
    );
  }

  return entryPath;
}

/**
 * Universal Remotion entry point resolution for `qa` and `render`:
 * Checks in order:
 * 1. Explicit `--entry`
 * 2. `<studioDir>/src/index.ts`
 * 3. `<studioDir>/index.ts`
 * 4. `<rootDir>/src/index.ts`
 * 5. `<rootDir>/videos/index.ts`
 * 6. Auto-scaffolds consumer entry via `ensureConsumerRemotionEntry(studioDir, rootDir)`
 */
export function resolveRemotionEntryPoint(params: {
  rootDir: string;
  studioDir: string;
  explicitEntry?: string;
}): string {
  const { rootDir, studioDir, explicitEntry } = params;

  if (explicitEntry) {
    const resolvedExplicit = path.resolve(rootDir, explicitEntry);
    if (!fs.existsSync(resolvedExplicit)) {
      throw new Error(`Remotion entry file not found: ${resolvedExplicit}`);
    }
    return resolvedExplicit;
  }

  const candidates = [
    path.join(studioDir, 'src', 'index.ts'),
    path.join(studioDir, 'index.ts'),
    path.join(rootDir, 'src', 'index.ts'),
    path.join(rootDir, 'videos', 'index.ts'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return ensureConsumerRemotionEntry(studioDir, rootDir);
}

function getModuleDir(): string {
  if (typeof __dirname === 'string') {
    return __dirname;
  }
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    return path.dirname(fileURLToPath(import.meta.url));
  }
  return process.cwd();
}

function copyDirRecursive(srcDir: string, destDir: string): void {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export const FALLBACK_AGENTS_MD = `# AGENTS.md — Core Studio Rulebook (make.pictures)

Uniwersalne niezmienniki studia **make.pictures** (\`60 FPS\` Video-as-Code). Szczegółowe reguły kierunku plastycznego, geometrii, audio, kamer i zestawów wizualnych ładuj progresywnie z **9 skilli** w \`.agents/plugins/make-pictures/skills/\` (lub \`plugins/make-pictures/skills/\`).

## 1. Konfiguracja (\`onboard\` i \`ELEVENLABS_API_KEY\`)
1. Uruchom \`npx make-pictures onboard --json\` (lub \`npm run onboard -- --json\`) i wykonuj kroki JSON (\`next\`, \`run\`, \`say\`) — w interaktywnym terminalu użytkownika zwykłe \`npm run onboard\` uruchamia czytelny kreator dla człowieka.
2. Narzędzie weryfikuje \`node_modules\` i \`ffmpeg\`, po czym wywołuje \`@elevenlabs/cli@latest onboard connect --env-path .env.local\` (jeden klucz \`ELEVENLABS_API_KEY\` zasila TTS, Music i SFX). **Nigdy** nie proś o klucz na czacie ani nie wypisuj \`.env.local\`.
3. Po \`npx make-pictures onboard check\` zaproponuj \`npx make-pictures studio\` (\`http://127.0.0.1:3000\`, z podglądem **🎨 Style Lab** \`[ 2D ] [ 2.5D ] [ 3D ]\` pod \`?view=styles\`) lub pierwszy film.

## 2. Bramka Art Direction (\`DimensionalSpace × StylePreset\`), Kapsuły (\`productions/<slug>/\`) i Style (\`styles/*.style.json\`)
- **Silnik:** \`@make-pictures/core\` (w tym \`@make-pictures/core/style\`), \`@make-pictures/kits\`, \`@make-pictures/studio\`, \`@make-pictures/cli\`.
- **Obowiązkowa Bramka Art Direction (Krok 1 — \`style-and-art-direction\`):** **Zakaz ślepego wybierania \`paper-diorama-3d\`.** Dopasuj temat, epokę i markę na dwuosiowej matrycy **\`DimensionalSpace ('2d' | '2.5d' | '3d') × StylePreset\`**:
  - **Przestrzeń wymiarowa (\`--space=2d|2.5d|3d\`) i 7 kitów scenicznych:** \`vector-scene-2d\`, \`editorial-collage\`, \`kinetic-typography\`, \`data-storytelling\`, \`motion-diagrams-2d\`, \`paper-diorama-3d\`, \`isometric-3d\`, oraz
  - **10 stylów wbudowanych (\`BUILT_IN_STYLES\`):** \`minimal-product\`, \`sketch-notebook\`, \`retro-pc\`, \`brutalist-poster\`, \`cyber-telemetry\`, \`tactile-craft\`, \`editorial-press\`, \`archival-chronicle\`, \`soft-clay\`, \`glass-studio\` — albo dowolną liczbę własnych presetów w \`styles/*.style.json\` (\`npx make-pictures styles --space=3d\`, \`npx make-pictures style new <slug> --from=soft-clay\`, zakładka **🎨 Style Lab** w Studio Web).
- **3 tryby pracy CLI (\`npx make-pictures ...\` lub skrypty \`npm run ...\`):**
  1. **Standalone Studio (\`npx create-make-pictures my-films\`):** \`productions/<slug>/\` i \`styles/*.style.json\` to kod źródłowy użytkownika śledzony w Git; silnik działa z \`node_modules/@make-pictures/*\`.
  2. **Wewnątrz istniejącej aplikacji SaaS (\`npx make-pictures init --dir=videos\`):** przekazuj \`--dir=videos\` do komend (\`npx make-pictures new <slug> --space=3d --dir=videos\`, \`npx make-pictures studio --dir=videos\`).
  3. **Monorepo silnika (\`make-pictures-studio\`):** pokazy żyją w \`examples/*\`, a filmy użytkownika w izolowanym \`productions/<slug>/\`. Zakaz zaszywania ID scen filmów w kodzie silnika.
- Tworzenie nowego filmu: \`npx make-pictures new <slug> --space=3d --lang=pl\`, \`npx make-pictures new <slug> --space=2.5d --lang=pl\`, \`npx make-pictures new <slug> --space=2d --style=retro-pc --lang=pl\` lub \`npx make-pictures new <slug> --kit=vector-scene-2d --style=minimal-product --lang=pl\`.

## 3. Determinizm \`60 FPS\`, Płynny Montaż (\`>= 4.5 s\`) i Kontrakt \`zod\` ↔ \`*.props.json\`
- **Czysta klatka \`0\`:** Pierwsza klatka to puste tło (\`bgCanvas\`); animacje wejścia startuj od \`frame - 2\`.
- **Płynny przepływ scen (\`>= 4.5 s\` / \`>= 270\` klatek):** Łącz sceny przez \`<ContinuousSceneFlow />\` i \`<OpticalCrossDissolve />\` (z \`<ClippedSurfaceChrome />\` dla zaokrąglonych kart \`overflow: 'visible'\`); każda scena wizualna trwa **\`>= 4.5 s\` (\`>= 270\` klatek)** — weryfikowane przez twardą bramkę reżyserską \`npx make-pictures qa\`.
- **Sprężyny i determinizm:** Używaj \`<StyleProvider style={styleId} renderBackdrop>\`, \`CINEMATIC_SPRINGS\` / \`SPRING_PRESETS\` (\`damping: 200\`) oraz \`createSeededRandom(seed)\` z \`@make-pictures/core\`. Całkowity **zakaz \`Math.random()\`** i akumulacji stanu w \`useRef\` między klatkami (\`--concurrency=100%\`).
- **Props Inspector i Style Lab:** Eksportuj \`z.object\` z opisami \`.describe('Sekcja :: Etykieta')\` i trzymaj wartości domyślne w \`<CompositionId>.props.json\`. **Zawsze odczytaj \`*.props.json\` oraz \`styles/*.style.json\` z dysku przed edycją**, by zachować zmiany z \`Studio Web\`.
- **Higiena puli \`<Audio />\`:** Używaj \`<VoiceoverTrack />\` i oszczędnego \`<SoundCue />\` z \`@make-pictures/core\`; **zakaz** montowania \`<Audio />\` wewnątrz \`<Sequence>\` bez jawnego \`durationInFrames\`.
- **Typografia \`>= 18 px\` (\`latin-ext\`, \`TYPOGRAPHY_FLOOR_1080P\`):** Domyślnie bez dolnych napisów; karty **nagłówek (\`26–32 px\`) + 1 zdanie (\`19–22 px\`)**; po polsku *Sentence case* (bez *Title Case*).

## 4. Obowiązkowe Bramki Jakości przed Renderem
1. **Linter Fonetyki i Odsłuch Audio:** Po \`npx make-pictures audio --production=<slug>\` (lub \`npm run audio -- --production=<slug>\`) sprawdź ostrzeżenia fonetyczne i odsłuchaj wygenerowane \`.mp3\` przez \`read_file\`.
2. **Twarda Bramka Reżyserska i Auto-Grid Contact-Sheet QA:** Uruchom \`npx make-pictures qa <CompositionId>\` (\`--grid=auto\` pokrywa 100% scen i pod-widoków) i obejrzyj \`out/qa-<CompositionId>.png\` przez \`read_file\` (\`f=0\` puste tło, brak kolizji, w \`9:16\` karty w **Golden Safe Box \`x ∈ [40, 910], y ∈ [220, 1380]\`**).
3. **Typy i Render (\`-14 LUFS\`):** \`npm run typecheck\`, a następnie \`npx make-pictures render <CompositionId>\` (lub \`npm run render -- <CompositionId>\`).

## 5. Tablica Routingu 9 Skilli (Załaduj przed Pisaniem Scen!)
| Zadanie / Warstwa | Skill (\`.agents/plugins/make-pictures/skills/<skill>/SKILL.md\`) | Zakres |
| :--- | :--- | :--- |
| Nowy film, \`production.json\`, QA, render | \`make-pictures-director\` | 6 kroków produkcji, tryby CLI (\`new --space=2d\\|2.5d\\|3d\`), \`ContinuousSceneFlow\` + \`OpticalCrossDissolve\`, sceny \`>= 4.5 s\` (\`>= 270\` klatek) weryfikowane przez twardą bramkę reżyserską \`npx make-pictures qa\` |
| Dobór przestrzeni i stylu, 10 \`BUILT_IN_STYLES\`, \`styles/*.style.json\` | \`style-and-art-direction\` | Dwuosiowa matryca \`DimensionalSpace ('2d' \\| '2.5d' \\| '3d') × StylePreset\` (10 stylów wbudowanych + \`styles/*.style.json\`), \`StyleProvider\`, \`material3d\`, \`Style Lab\` |
| Dokument, kolaż redakcyjny i narracja 2D | \`kit-editorial-and-vector\` | \`editorial-collage\` (\`ChapterTitleCard\`, \`EditorialMediaCard\`, \`HighlightQuoteStage\`, \`SplitStoryLayout\`), \`vector-scene-2d\` (\`StoryCard2D\`, \`AnnotatedCallout2D\`, \`ComparisonSplit2D\`) |
| Wycinanki 2.5D na neutralnej scenie 3D | \`kit-paper-diorama-3d\` | \`DioramaStage3D\`, \`PaperCutout3D\`, \`ImageCutout3D\`, \`PopUpHinge3D\`, 9 \`ScenicCutoutMotifs\` (w tym Apollo 11: \`StarryCosmosBackdropCutout3D\`, \`EarthriseCutout3D\`, \`LunarCraterRidgeCutout3D\`, \`LunarLanderCutout3D\`), \`Δz >= 0.45\` |
| Diagramy 2D, Retro-PC i nieskończone płótno | \`kit-motion-diagrams-2d\` | \`RetroPcWindowStage2D\`, \`MotionDiagramStage2D\`, \`SystemNode\`, \`DataFlowEdge\`, \`NodeBox\`, \`FlowCurve\`, pakiety \`92–120\` kl. |
| Nagrania ekranu SaaS \`.mp4\` (screencasty) | \`kit-motion-diagrams-2d\` + \`make-pictures-director\` | \`@make-pictures/kits/product-frames\`: \`BrowserFrame\`, \`PhoneFrame\`, \`ScreenSpotlightOverlay\` (\`<OffthreadVideo />\`, \`assets/videos/\`) |
| Studio 3D Soft-Clay, IBL i architektura dialogu | \`kit-isometric-3d\` | \`StudioHdrRig3D\`, \`ClayCharacter3D\`, \`PodcastStudioSet3D\`, \`IsometricStage3D\`, \`Stylized3DCharacter\`, \`speakingWeight\` vs \`speechEnergy\` |
| Kinetyczna typografia i wykresy | \`kit-kinetic-and-data\` | \`WordByWordStage\`, \`ImpactKeywordCard\`, \`AnimatedMetricCounter\`, \`AnimatedBarRace\`, \`TimelineTrack\`, \`MetricComparisonCard\` |
| Lektor, fonetyka, muzyka AI i SFX | \`sound-and-music-design\` | \`VoiceoverTrack\`, \`SmartMusicBed\` (7 \`moodPreset\`), \`SoundCue\`, \`VoiceAcousticPreset\`, \`-14 LUFS\` |
| Kamera Shot DSL (2D/3D), przepływ scen i VFX | \`cinematography-and-vfx\` | \`ContinuousSceneFlow\`, \`OpticalCrossDissolve\`, \`ClippedSurfaceChrome\`, \`ScenicBackdropLayers\`, \`DirectorCamera3D/2D\`, \`9:16\` Safe Box, \`CinematicLensOverlay\`, \`ParticleField\`, \`StagePostProcessing3D\` |
`;

const FALLBACK_PLUGIN_JSON = {
  name: 'make-pictures',
  version: '2.3.1',
  description:
    'make.pictures Studio — 60 FPS Video-as-Code skills, visual kits, Art Direction Style Lab, camera Shot DSL, and ElevenLabs AI Audio Studio.',
  author: {
    name: 'make.pictures',
    url: 'https://make.pictures',
  },
  homepage: 'https://make.pictures',
  repository: 'https://github.com/make-pictures/make-pictures-studio',
};

export const FALLBACK_CLAUDE_MD = `# CLAUDE.md — Claude Code Instructions for \`make.pictures\` Studio

Read [\`AGENTS.md\`](./AGENTS.md) alongside this file for universal \`60 FPS\` Video-as-Code invariants, and load domain skills progressively from [\`.claude/skills/\`](./.claude/skills/) (mirrored from \`.agents/plugins/make-pictures/skills/\`).

## Capsule Architecture, 2D/2.5D/3D Art Direction & Determinism
- **Isolated Capsules (\`productions/<slug>/\`):** Keep every film self-contained (\`production.json\`, \`compositions/\`, \`assets/\`, \`generated/audio-manifest.ts\`). In embedded SaaS repos (\`--dir=videos\`), capsules live in \`videos/productions/<slug>/\`.
- **2-Axis Art Direction (\`DimensionalSpace ('2d' | '2.5d' | '3d') × StylePreset\`):** Never default blindly to \`paper-diorama-3d\`. Match every film's topic across \`--space=2d|2.5d|3d\`, the **7 visual kits**, and the **10 built-in styles** (\`minimal-product\`, \`sketch-notebook\`, \`retro-pc\`, \`brutalist-poster\`, \`cyber-telemetry\`, \`tactile-craft\`, \`editorial-press\`, \`archival-chronicle\`, \`soft-clay\`, \`glass-studio\`) or unlimited custom \`styles/*.style.json\` presets wrapped in \`<StyleProvider style={props.styleId} renderBackdrop>\`.
- **Calm Continuous Scene Flow (\`>= 4.5 s\` / \`>= 270\` Frames):** Compose multi-scene films via \`<ContinuousSceneFlow />\` + \`<OpticalCrossDissolve />\` (with \`<ClippedSurfaceChrome />\` on \`overflow: 'visible'\` rounded cards); every visual scene must span \`>= 4.5 s\` (\`>= 270\` frames), enforced by the hard \`npx make-pictures qa\` Director Gate.
- **60 FPS Determinism:** Frame \`0\` must render a clean empty background (start entrance springs at \`frame - 2\`). Never use \`Math.random()\`, cross-frame \`useRef\` state, or remote \`<Environment preset="..." />\` HDR fetches — use \`CINEMATIC_SPRINGS\` / \`SPRING_PRESETS\`, \`createSeededRandom(seed)\`, and offline \`<StudioHdrRig3D />\`.
- **Audio Tag Pool Hygiene:** Use \`<VoiceoverTrack />\` and \`<SoundCue />\` from \`@make-pictures/core\`; never wrap raw \`<Audio />\` inside \`<Sequence>\` without an explicit finite \`durationInFrames\`.
- **Props Inspector (\`zod\` ↔ \`*.props.json\` & \`styles/*.style.json\`):** Always read \`<CompositionId>.props.json\` and \`styles/*.style.json\` from disk before editing so live tweaks from Studio Web are preserved. Never open or print \`.env.local\`.

## CLI Commands (\`npx make-pictures\`)
- \`npx make-pictures onboard\` / \`npx make-pictures doctor\` — Verify Node.js, FFmpeg, and ElevenLabs OAuth (\`.env.local\`).
- \`npx make-pictures init --dir=videos [--space=2d|2.5d|3d]\` — Initialize capsules + AI skills inside an existing app repo.
- \`npx make-pictures styles [--space=2d|2.5d|3d]\` / \`npx make-pictures style new <slug> --from=soft-clay\` — List all 10 built-in & custom presets (e.g. \`npx make-pictures styles --space=3d\`) or fork a custom preset.
- \`npx make-pictures new <slug> --space=3d --lang=en\` (or \`--space=2d --style=retro-pc\`, \`--kit=vector-scene-2d --style=minimal-product\`) — Scaffold a new \`60 FPS\` production capsule.
- \`npx make-pictures audio --production=<slug> [--mock]\` — Synthesize ElevenLabs TTS + word timestamps + AI Music + AI SFX.
- \`npx make-pictures image "<prompt>" --style=<styleId> --out=...\` / \`npx make-pictures cutout <file> --out=...\` — Generate style-anchored illustrations (zero raster text) or extract lossless PDF \`/SMask\` / Exterior Border Flood-Fill cutouts with dark checkerboard QA.
- \`npx make-pictures studio [--port=3000] [--dir=.]\` — Launch local \`60 FPS\` Studio Web workstation (\`http://127.0.0.1:3000\`, including 🎨 Style Lab \`[ 2D ] [ 2.5D ] [ 3D ]\`).
- \`npx make-pictures qa <CompositionId>\` — Run the hard Director QA Gate and render an Auto-Grid Contact-Sheet PNG (\`out/qa-<CompositionId>.png\`, covering 100% of scenes & sub-views) for visual inspection (\`9:16\` Golden Safe Box \`x ∈ [40, 910], y ∈ [220, 1380]\`).
- \`npm run typecheck\` && \`npx make-pictures render <CompositionId>\` — Typecheck and render \`60 FPS\` MP4 mastered to \`-14 LUFS\`.

## Auto-Discovered Skills (\`.claude/skills/<skill>/SKILL.md\`)
1. \`make-pictures-director\` — 6-step production workflow, \`--space=2d|2.5d|3d\`, \`ContinuousSceneFlow\` (\`>= 4.5 s\` / \`>= 270f\`), and hard \`qa\` gates.
2. \`style-and-art-direction\` — 2-axis \`DimensionalSpace ('2d' | '2.5d' | '3d') × 10 BUILT_IN_STYLES\` + \`styles/*.style.json\`, \`StyleProvider\`, \`material3d\`, and \`Style Lab\`.
3. \`kit-editorial-and-vector\` — Universal 2D narrative kits: \`editorial-collage\` & \`vector-scene-2d\`.
4. \`kit-paper-diorama-3d\` — 2.5D layered cutout stage (\`DioramaStage3D\`, \`PaperCutout3D\`, \`PopUpHinge3D\`, and the 9 \`ScenicCutoutMotifs\` including Apollo 11 \`StarryCosmosBackdropCutout3D\`, \`EarthriseCutout3D\`, \`LunarCraterRidgeCutout3D\`, \`LunarLanderCutout3D\`).
5. \`kit-motion-diagrams-2d\` — 2D infinite-canvas & Retro-PC diagrams (\`RetroPcWindowStage2D\`, \`MotionDiagramStage2D\`, \`SystemNode\`, \`DataFlowEdge\`, \`NodeBox\` ports, \`FlowCurve\`), plus SaaS \`.mp4\` screencasts via \`@make-pictures/kits/product-frames\` (\`BrowserFrame\`, \`PhoneFrame\`, \`ScreenSpotlightOverlay\`).
6. \`kit-isometric-3d\` — 3D Soft-Clay, offline spatial IBL & isometric studio (\`StudioHdrRig3D\`, \`ClayCharacter3D\`, \`PodcastStudioSet3D\`, \`IsometricStage3D\`, \`Stylized3DCharacter\`).
7. \`kit-kinetic-and-data\` — Kinetic typography & data charts (\`WordByWordStage\`, \`ImpactKeywordCard\`, \`AnimatedMetricCounter\`, \`AnimatedBarRace\`, \`TimelineTrack\`, \`MetricComparisonCard\`).
8. \`sound-and-music-design\` — ElevenLabs voices, PL/EN phonetics, \`SmartMusicBed\` auto-ducking (7 \`moodPreset\`s), \`SoundCue\`, \`-14 LUFS\`.
9. \`cinematography-and-vfx\` — \`ContinuousSceneFlow\`, \`OpticalCrossDissolve\`, \`ClippedSurfaceChrome\`, \`ScenicBackdropLayers\`, \`DirectorCamera3D/2D\`, \`9:16\` Safe Box & deterministic VFX.
`;

function ensureClaudeSkillsLink(
  rootDir: string,
  pluginDestDir: string,
  force = false
): string {
  const pluginSkillsDir = path.join(pluginDestDir, 'skills');
  const claudeDir = path.join(rootDir, '.claude');
  const claudeSkillsPath = path.join(claudeDir, 'skills');

  if (!fs.existsSync(pluginSkillsDir)) {
    return claudeSkillsPath;
  }

  fs.mkdirSync(claudeDir, { recursive: true });

  let existingLstat: fs.Stats | null = null;
  try {
    existingLstat = fs.lstatSync(claudeSkillsPath);
  } catch {
    existingLstat = null;
  }

  if (existingLstat) {
    const isBroken = !fs.existsSync(claudeSkillsPath);
    if (isBroken || force) {
      fs.rmSync(claudeSkillsPath, { recursive: true, force: true });
      existingLstat = null;
    }
  }

  if (!existingLstat) {
    const relTarget = path.relative(claudeDir, pluginSkillsDir);
    try {
      fs.symlinkSync(
        process.platform === 'win32' ? pluginSkillsDir : relTarget,
        claudeSkillsPath,
        process.platform === 'win32' ? 'junction' : 'dir'
      );
    } catch {
      copyDirRecursive(pluginSkillsDir, claudeSkillsPath);
    }
  }

  return claudeSkillsPath;
}

/**
 * Copies the bundled `make-pictures` AI Plugin (`plugin.json`, `.claude-plugin/plugin.json`,
 * `rules/AGENTS.md`, `rules/CLAUDE.md`, `skills/<skill>/SKILL.md`) into `<rootDir>/.agents/plugins/make-pictures/`,
 * links `<rootDir>/.claude/skills` -> `../.agents/plugins/make-pictures/skills`,
 * and creates `<rootDir>/AGENTS.md` + `<rootDir>/CLAUDE.md` if absent.
 */
export function syncBundledAiPluginToProject(
  rootDir: string,
  options?: { force?: boolean }
): {
  pluginDestDir: string;
  agentsMdPath: string;
  claudeMdPath: string;
  claudeSkillsPath: string;
} {
  const modDir = getModuleDir();

  // Candidate plugin template directories:
  // 1. Packed `@make-pictures/cli`: `dist/index.mjs` -> `../assets/plugin` (or `../../assets/plugin` if in `src/commands`)
  // 2. Monorepo dev: `packages/cli/src/commands` -> `../../../../plugins/make-pictures`
  const candidates = [
    path.resolve(modDir, '..', 'assets', 'plugin'),
    path.resolve(modDir, '..', '..', 'assets', 'plugin'),
    path.resolve(modDir, '..', '..', '..', '..', 'plugins', 'make-pictures'),
    path.resolve(
      rootDir,
      'node_modules',
      '@make-pictures',
      'cli',
      'assets',
      'plugin'
    ),
  ];

  const pluginDestDir = path.join(
    rootDir,
    '.agents',
    'plugins',
    'make-pictures'
  );
  const foundSource = candidates.find((c) =>
    fs.existsSync(path.join(c, 'plugin.json'))
  );

  if (foundSource) {
    copyDirRecursive(foundSource, pluginDestDir);
  } else {
    fs.mkdirSync(path.join(pluginDestDir, '.claude-plugin'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(pluginDestDir, 'rules'), { recursive: true });
    fs.writeFileSync(
      path.join(pluginDestDir, 'plugin.json'),
      `${JSON.stringify(FALLBACK_PLUGIN_JSON, null, 2)}\n`,
      'utf8'
    );
    fs.writeFileSync(
      path.join(pluginDestDir, '.claude-plugin', 'plugin.json'),
      `${JSON.stringify(
        {
          name: 'make-pictures',
          description: FALLBACK_PLUGIN_JSON.description,
          version: '2.3.1',
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    fs.writeFileSync(
      path.join(pluginDestDir, 'rules', 'AGENTS.md'),
      FALLBACK_AGENTS_MD,
      'utf8'
    );
    fs.writeFileSync(
      path.join(pluginDestDir, 'rules', 'CLAUDE.md'),
      FALLBACK_CLAUDE_MD,
      'utf8'
    );
  }

  const agentsMdPath = path.join(rootDir, 'AGENTS.md');
  if (!fs.existsSync(agentsMdPath) || options?.force) {
    const rulesAgentsPath = path.join(pluginDestDir, 'rules', 'AGENTS.md');
    const agentsContent = fs.existsSync(rulesAgentsPath)
      ? fs.readFileSync(rulesAgentsPath, 'utf8')
      : FALLBACK_AGENTS_MD;
    fs.writeFileSync(agentsMdPath, agentsContent, 'utf8');
  }

  const claudeMdPath = path.join(rootDir, 'CLAUDE.md');
  if (!fs.existsSync(claudeMdPath) || options?.force) {
    const rulesClaudePath = path.join(pluginDestDir, 'rules', 'CLAUDE.md');
    const claudeContent = fs.existsSync(rulesClaudePath)
      ? fs.readFileSync(rulesClaudePath, 'utf8')
      : FALLBACK_CLAUDE_MD;
    fs.writeFileSync(claudeMdPath, claudeContent, 'utf8');
  }

  const claudeSkillsPath = ensureClaudeSkillsLink(
    rootDir,
    pluginDestDir,
    Boolean(options?.force)
  );

  return { pluginDestDir, agentsMdPath, claudeMdPath, claudeSkillsPath };
}
