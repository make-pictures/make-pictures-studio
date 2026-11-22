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
1. Uruchom \`npx -y @make-pictures/cli@latest onboard --lang=pl\` (lub \`npm run onboard\`) i wykonuj kroki JSON (\`next\`, \`run\`, \`say\`) — komenda sama rozpoznaje pusty katalog, istniejącą aplikację SaaS lub gotowy projekt; w zwykłym terminalu użytkownika uruchamia czytelny kreator dla człowieka.
2. Narzędzie weryfikuje \`node_modules\` i \`ffmpeg\`, po czym wywołuje \`@elevenlabs/cli@latest onboard connect --env-path .env.local\` (jeden klucz \`ELEVENLABS_API_KEY\` zasila TTS, Music i SFX — podczas onboardingu nie generuj audio dla demo, żeby nie zużywać kredytów). **Nigdy** nie proś o klucz na czacie ani nie wypisuj \`.env.local\`.
3. Po \`npx make-pictures onboard check\` uruchom w tle \`npm run studio\` (\`http://127.0.0.1:3000\`, z podglądem **🎨 Style Lab** \`[ 2D ] [ 2.5D ] [ 3D ]\` pod \`?view=styles\`, \`IsDaemon: true\` / proces w tle) i zapytaj użytkownika o temat oraz przestrzeń/styl pierwszego filmu.

## 2. Bramka Art Direction (\`DimensionalSpace × StylePreset\`), Kapsuły (\`productions/<slug>/\`) i Style (\`styles/*.style.json\`)
- **Silnik:** \`@make-pictures/core\` (w tym \`@make-pictures/core/style\` i \`@make-pictures/core/kinematics\`), \`@make-pictures/kits\` (w tym \`@make-pictures/kits/tactile-3d\`), \`@make-pictures/studio\`, \`@make-pictures/cli\`.
- **Obowiązkowa Bramka Art Direction (Krok 1 — \`style-and-art-direction\`):** **Zakaz ślepego wybierania \`paper-diorama-3d\`.** Przed utworzeniem filmu dopasuj temat, epokę i markę na dwuosiowej matrycy **\`DimensionalSpace ('2d' | '2.5d' | '3d') × StylePreset\`**:
  - **Przestrzeń wymiarowa (\`--space=2d|2.5d|3d\`) i 7 kitów scenicznych:** \`vector-scene-2d\`, \`editorial-collage\`, \`kinetic-typography\`, \`data-storytelling\`, \`motion-diagrams-2d\`, \`paper-diorama-3d\`, \`isometric-3d\` (możesz łączyć kilka kitów między aktami przez \`<ContinuousSceneFlow />\` w jednym \`<StyleProvider>\`), oraz
  - **10 stylów wbudowanych (\`BUILT_IN_STYLES\`):** \`minimal-product\`, \`sketch-notebook\`, \`retro-pc\`, \`brutalist-poster\`, \`cyber-telemetry\`, \`tactile-craft\`, \`editorial-press\`, \`archival-chronicle\`, \`soft-clay\`, \`glass-studio\` — albo dowolną liczbę własnych presetów w \`styles/*.style.json\` (\`npx make-pictures styles\`, \`npx make-pictures styles --space=3d\`, \`npx make-pictures style new <slug> --from=soft-clay\`, edycja \`60 FPS\` w **🎨 Style Lab** w Studio Web).
- **3 tryby pracy CLI (\`npx make-pictures ...\` lub skrypty \`npm run ...\`):**
  1. **Standalone Studio (\`npx create-make-pictures my-films\`):** \`productions/<slug>/\` i \`styles/*.style.json\` to kod źródłowy użytkownika śledzony w Git; silnik działa z \`node_modules/@make-pictures/*\`.
  2. **Wewnątrz istniejącej aplikacji SaaS (\`npx make-pictures init --dir=videos\`):** przekazuj \`--dir=videos\` do komend (\`npx make-pictures new <slug> --space=3d --dir=videos\`, \`npx make-pictures studio --dir=videos\`).
  3. **Monorepo silnika (\`make-pictures-studio\`):** pokazy żyją w \`examples/*\`, a filmy użytkownika w izolowanym \`productions/<slug>/\`. Zakaz zaszywania ID scen filmów w kodzie silnika.
- Tworzenie nowego filmu (\`production.json\`, \`compositions/\`, \`assets/\`, \`generated/audio-manifest.ts\`):
  - \`npx make-pictures new <slug> --space=3d --lang=pl\` *(domyślnie \`isometric-3d\` + \`soft-clay\`)*
  - \`npx make-pictures new <slug> --space=2.5d --lang=pl\` *(domyślnie \`paper-diorama-3d\` + \`tactile-craft\`)*
  - \`npx make-pictures new <slug> --space=2d --style=retro-pc --lang=pl\`
  - \`npx make-pictures new <slug> --kit=vector-scene-2d --style=minimal-product --lang=pl\`
  - \`npx make-pictures new <slug> --kit=editorial-collage --style=editorial-press --lang=pl\`
- **Zakaz siatek kafelków \`3×2\` i higiena zasobów rastrowych:** Wyliczanki kategorii wizualizuj przez płynną panoramę redakcyjną (\`<EditorialPanoramaTrack />\` + \`DirectorCamera2D\` + Ken Burns), asymetryczny kolaż warstwowy lub przekrój przestrzenny — nigdy jako migającą macierz kafelków \`3×2\` (\`1 → 2 → 3 → 4\`). Generując ilustracje AI (\`npx make-pictures image "..." --style=<styleId>\`), stosuj wspólny kotwiczący styl plastyczny i bezwzględny zakaz tekstu w rastrze. Jasne obiekty na białym tle (PDF / zdjęcia) wycinaj wyłącznie przez \`npx make-pictures cutout <plik> --out=...\` (natywna maska \`/SMask\` lub *Exterior Border Flood-Fill* + test na ciemnej szachownicy \`#0F172A\`/\`#1E293B\`; całkowity zakaz globalnego progowania bieli \`rgb > 245 => alpha = 0\`). Ciemne narożniki skanów archiwalnych i rycin oczyszczaj przez \`npx make-pictures assets clean-scan <plik> --out=...\`, a katalogi zasobów weryfikuj kontakt-arkuszem \`npx make-pictures assets sheet <katalog>\` (utrzymuj \`SOURCES.md\` dla źródeł zewnętrznych).

## 3. Determinizm \`60 FPS\`, Płynny Montaż (\`>= 4.5 s\`), Oddech Lektora, Typografia \`>= 18 px\` i Kontrakt \`zod\` ↔ \`*.props.json\`
- **Czysta klatka \`0\` i obrazy \`<Img>\`:** Pierwsza klatka to jednolite tło (\`bgCanvas\`, wariancja RGB \`0.00\`); animacje wejścia startuj od \`frame - 2\`. Zawsze używaj \`<Img>\` z \`'remotion'\` (zakaz surowego \`<img>\` — wymusza \`delayRender\` przy \`--concurrency=100%\`).
- **Płynny przepływ scen (\`>= 4.5 s\` / \`>= 270\` klatek) i budżet oddechu lektora:** Łącz sceny przez \`<ContinuousSceneFlow crossDissolveFrames={54} />\` na wspólnym, najwyżej położonym \`<StyleProvider style={styleId} renderBackdrop>\` (z \`<ClippedSurfaceChrome />\` dla zaokrąglonych kart \`overflow: 'visible'\`); unikaj szarpanych wycięć \`<SceneTransition />\` i \`whip\` (dozwolonych wyłącznie w krótkich rolkach \`9:16\` \`brutalist-poster\`). Wyliczaj czas trwania scen funkcją \`computeSceneTimingFromVoiceover\`: **\`~0.7 s\` (\`42\` kl.)** osadzenia przed głosem (*Pre-Speech Settle*), **\`~1.5–1.7 s\` (\`90–102\` kl.)** oddechu po kwestii (*Post-Speech Hold*) oraz **\`+2.2–2.5 s\` (\`132–150\` kl.)** w scenie finałowej (\`<SmartMusicBed fadeOutFrames={90} />\`). Wewnątrz jednej sceny stosuj **maksymalnie \`1\` ewoluujący układ lub \`2\` pod-widoki** łączone przez \`<SceneSubViewDissolve />\` (\`48–60\` kl.; zakaz \`3+\` pod-widoków).
- **Sprężyny, czystość wizualna i geometria Béziera:** Dla prezentacji i explainerów stosuj \`cinematic-fluid\` / \`editorial-calm\` (\`damping: 200\`, \`cameraHandheld <= 0.015\`) oraz \`createSeededRandom(seed)\`. Całkowity **zakaz \`Math.random()\`**, akumulacji stanu w \`useRef\` między klatkami oraz sztucznego szumu wizualnego (chmur latających kropek, radarowych pierścieni, plątaniny linii). Ścieżki SVG i ew. pojedynczy impuls wyliczaj z jednego źródła prawdy \`buildCubicBezierPath\` + \`evaluateCubicBezier\` (domyślnie \`packetCount={0}\`). Adnotacje na zrzutach i ilustracjach kotwicz subpikselowo przez \`<PinnedMediaStage />\` (\`Δx = 0.00 px\`, \`aspectRatio\` \`1:1\` i kotwica \`0×0\`).
- **Props Inspector i Style Lab:** Eksportuj \`z.object\` z opisami \`.describe('Sekcja :: Etykieta')\` (w tym \`styleId\`) i trzymaj wartości domyślne w \`<CompositionId>.props.json\`. **Zawsze odczytaj \`*.props.json\` oraz \`styles/*.style.json\` z dysku przed edycją**, by zachować zmiany z \`Studio Web\`.
- **Kinematyka Disneya, Tactile 3D, Kolizje OBB SAT i Bezramkowe Nakładki:** W scenach 3D/2.5D korzystaj z \`@make-pictures/core/kinematics\` (\`disneyEase\`, \`evaluateArc3D\`, \`evaluateSurfaceImpact\`, 15-osiowy SAT \`obbClearanceSat3D\` / \`auditSceneCollisions3D\`) oraz \`@make-pictures/kits/tactile-3d\` (\`<DeformableSheet3D />\`, \`<ScreenGlassLayer3D />\`, synchroniczne \`<SyncStudioIbl3D />\`, \`getProceduralPbrMaps\`, \`<DaylightArcRig3D />\`). Nad scenami 3D/2.5D stosuj bezramkowe \`<FloatingEditorialDisplay />\` i \`<PaperRibbonTimeline />\` (\`>= 19–22 px\`, zero czarnych pudełek webowych).
- **Higiena puli \`<Audio />\`, natywne głosy (\`voices --lang\`), reżyseria \`eleven_v3\` i polska fonetyka TTS:** Dla filmów \`lang: 'pl'\` używaj wyłącznie **natywnych polskich głosów** (np. \`Luiza\` \`C8ZVSJxcymeT86xT429O\`, \`Asia\` \`Bz1e1clEKwgN71Vx7cxj\`, \`Arleta\` \`F9eb9uZYeJuHuO7Uvs1R\`, \`Rafał\` \`CLuTGacrAhcIhaJslbXt\` lub wyszukanych przez \`npx make-pictures voices --lang=pl --json\` — **zakaz anglojęzycznych głosów premade** jak Liam/Sarah/Brian/George dla narracji PL). W narracji ekspresyjnej \`eleven_v3\` stosuj tagi aktorskie (\`[thoughtful]\`, \`[warmly]\`, \`[playful]\`, \`[amazed]\`), wyłącznie dyskretne \`stability ∈ {0.0, 0.5, 1.0}\` oraz dziel dłuższe sceny na mikro-segmenty (\`a/b/c\`) z fizycznymi pauzami. Używaj \`<VoiceoverTrack />\` i oszczędnego \`<SoundCue />\` (\`3–5\` subtelnych akcentów \`volume: 0.14–0.26\` na film; zakaz \`<Audio />\` w \`<Sequence>\` bez \`durationInFrames\`). Ustawiaj naturalne \`voiceSettings.speed: 0.98–1.00\`, pisz językiem korzyści bez kodów SKU w \`scene.text\` i rozróżniaj polskie **głoskowce** (\`API\` → \`"api"\`, \`RAM\` → \`"ram"\`, \`LAN\` → \`"lan"\`, \`LED\` → \`"led"\`) od **literowców z dywizami** (\`USB\` → \`"u-es-be"\`, \`SQL\` → \`"es-ku-el"\`, \`CRM\` → \`"ce-er-em"\`, \`ERP\` → \`"e-er-pe"\`) oraz potocznego grupowania cyfr norm (\`ISO 8601\` → \`"izo osiemdziesiąt sześć zero jeden"\`, \`USB 3.2\` → \`"u-es-be trzy dwa"\`).
- **Typografia \`>= 18–19 px\` (\`TYPOGRAPHY_FLOOR_1080P\`), proporcje kart i \`boxSizing: 'border-box'\`:** Zakaz mikro-typografii \`10–14 px\`. Złoty standard karty (\`latin-ext\`, po polsku *Sentence case*, domyślnie bez dolnych napisów): **wyrazisty nagłówek (\`26–32 px\`, \`2–5\` słów) + 1 czytelne zdanie uzupełniające (\`19–22 px\`, \`6–11\` słów)**. Karty centruj w pionie (\`height: 'auto'\`, \`justifyContent: 'center'\`; zakaz pustych dziur z \`space-between\` — dla podsumowań \`2×2\` używaj \`<HorizontalFeatureGrid2x2 />\`), główny obiekt wizualny wypełnia \`>= 60%\` pola, a każdy kontener i \`WorldBox\` posiada \`boxSizing: 'border-box'\`.

\`\`\`tsx
import { z } from 'zod';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  StyleProvider,
  createSeededRandom,
  getCardChromeStyle,
  getStyleSpringConfig,
  useStudioStyle,
} from '@make-pictures/core';

export const FilmSchema = z.object({
  styleId: z.string().describe('Kolory & Styl :: Styl bazowy (Style ID)'),
  headline: z.string().describe('Teksty & Napisy :: Nagłówek'),
});

const HeroCardInner: React.FC<{ headline: string }> = ({ headline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = useStudioStyle();
  const enter = spring({ frame: frame - 2, fps, config: getStyleSpringConfig(style, 'enter') }); // frame 0 => 0
  const jitter = createSeededRandom('hero-v1')();
  return <div style={getCardChromeStyle(style, { opacity: enter })} data-seed={jitter}>{headline}</div>;
};

export const HeroCard: React.FC<z.infer<typeof FilmSchema>> = ({ styleId, headline }) => (
  <StyleProvider style={styleId} renderBackdrop>
    <HeroCardInner headline={headline} />
  </StyleProvider>
);
\`\`\`

## 4. Obowiązkowe Bramki Jakości przed Renderem
1. **Pilotażowe Demo (2–3 ujęcia) i Fact-Check przed Audio:** Przy większych filmach (szczególnie 3D/dokumentalnych) najpierw wyrenderuj krótkie **Pilotażowe Demo** (\`2–3\` kluczowe ujęcia) dla zatwierdzenia stylu/kamery oraz wykonaj obowiązkowy **fact-check** dat, cytatów i nazw własnych w scenariuszu **przed** płatną generacją audio i finalnym renderem.
2. **Linter Fonetyki / \`eleven_v3\` i Odsłuch Audio:** Po \`npx make-pictures audio --production=<slug>\` sprawdź ostrzeżenia lintera (\`głoskowce\` vs \`literowce\`, SKU, \`[v3-audio-tags]\`, \`[v3-stability]\`) i odsłuchaj wygenerowane \`.mp3\` przez \`read_file\`. Dla wycinanych i oczyszczanych zasobów PNG zweryfikuj ciemną szachownicę z \`npx make-pictures cutout\` oraz kontakt-arkusz \`npx make-pictures assets sheet\`.
3. **Test 0 Kolizji 3D, Twarda Bramka Reżyserska i Auto-Grid Contact-Sheet QA:** W scenach 3D uruchom test jednostkowy \`auditSceneCollisions3D\`, a przed renderem \`npx make-pictures qa <CompositionId>\` (\`--grid=auto\` domyślnie pokrywa **100% scen i pod-widoków** etykietami \`sceneId/subViewId\`) — komenda weryfikuje niezmienniki reżyserskie (\`sceny >= 4.5 s\`, marginesy oddechowe \`pre >= 36f\` / \`post >= 90f\` / \`outro >= 132f\`, \`<= 2\` pod-widoki, \`<Img>\`, brak \`fontSize < 18px\` i pustych dziur w kartach, czyste \`f=0\` o wariancji \`0.00\`) i generuje \`out/qa-<CompositionId>.png\`. Obejrzyj arkusz przez \`read_file\` (\`f=0\` puste tło, polskie znaki \`latin-ext\`, \`Δx = 0.00 px\` na adnotacjach, w \`9:16\` karty w **Golden Safe Box \`x ∈ [40, 910], y ∈ [220, 1380]\`**).
4. **Typy, Render (\`-14 LUFS\`) i Odsłuch Finalnego \`.mp4\`:** Uruchom \`npm run typecheck\`, a następnie \`npx make-pictures render <CompositionId>\`. Po renderze obowiązkowo skontroluj zmasterowany miks \`.mp4\` (\`-14 LUFS\`: balans \`<SmartMusicBed />\`, \`<SoundCue />\`, dykcja \`"api"\` vs \`"u-es-be"\` oraz pełne wybrzmienie wygłosów).

## 5. Tablica Routingu 9 Skilli (Załaduj przed Pisaniem Scen!)
| Zadanie / Warstwa | Skill (\`.agents/plugins/make-pictures/skills/<skill>/SKILL.md\`) | Zakres |
| :--- | :--- | :--- |
| Nowy film, \`production.json\`, QA, render | \`make-pictures-director\` | 6 kroków produkcji, Pilotażowe Demo, fact-check, \`computeSceneTimingFromVoiceover\`, \`ContinuousSceneFlow\`, \`cutout\`, \`assets clean-scan\`/\`sheet\`, \`auditSceneCollisions3D\`, \`npx make-pictures qa\` |
| Dobór przestrzeni i stylu, 10 \`BUILT_IN_STYLES\`, \`styles/*.style.json\` | \`style-and-art-direction\` | Matryca \`DimensionalSpace ('2d' \\| '2.5d' \\| '3d') × StylePreset\`, \`TYPOGRAPHY_FLOOR_1080P\` (\`>= 18 px\`, Tytuł + 1 zdanie), \`<StyleProvider>\`, \`material3d\`, **🎨 Style Lab**, \`image --style\` |
| Dokument redakcyjny i uniwersalna scena 2D | \`kit-editorial-and-vector\` | \`editorial-collage\` (\`EditorialPanoramaTrack\`, \`ChapterTitleCard\`, \`EditorialMediaCard\`, \`SplitStoryLayout\`, \`PaperRibbonTimeline\`, \`FloatingEditorialDisplay\`) + \`vector-scene-2d\` (\`StoryCard2D\`, \`HorizontalFeatureGrid2x2\`, \`PinnedMediaStage\`) |
| Wycinanki 2.5D i fizyczne arkusze \`tactile-3d\` | \`kit-paper-diorama-3d\` | \`DioramaStage3D\`, \`PaperCutout3D\`, \`ImageCutout3D\` + \`cutout\`, \`PopUpHinge3D\`, 9 \`ScenicCutoutMotifs\`, \`@make-pictures/kits/tactile-3d\` (\`DeformableSheet3D\`, \`usePreloadedTextures3D\`) + SAT \`obbClearanceSat3D\` |
| Diagramy 2D, Retro-PC i nieskończone płótno | \`kit-motion-diagrams-2d\` | \`RetroPcWindowStage2D\`, \`MotionDiagramStage2D\`, \`SystemNode\`, \`DataFlowEdge\` (\`packetCount={0}\` domyślnie), \`buildCubicBezierPath\` / \`evaluateCubicBezier\`, \`NodeBox\` (\`border-box\`) |
| Nagrania ekranu SaaS \`.mp4\` (screencasty) | \`kit-motion-diagrams-2d\` + \`make-pictures-director\` | \`@make-pictures/kits/product-frames\`: \`BrowserFrame\`, \`PhoneFrame\`, \`ScreenSpotlightOverlay\`, \`PinnedMediaStage\` (\`<OffthreadVideo />\`, \`productions/<slug>/assets/videos/\`) |
| Studio 3D Soft-Clay, Sync IBL, PBR i światło dnia | \`kit-isometric-3d\` | \`StudioHdrRig3D\`, \`SyncStudioIbl3D\` (Frame-1 PMREM), \`getProceduralPbrMaps\`, \`DaylightArcRig3D\`, \`ClayCharacter3D\`, \`PodcastStudioSet3D\`, \`IsometricStage3D\`, \`Stylized3DCharacter\` |
| Kinetyczna typografia i wykresy | \`kit-kinetic-and-data\` | \`WordByWordStage\`, \`ImpactKeywordCard\`, \`AnimatedMetricCounter\`, \`AnimatedBarRace\`, \`TimelineTrack\`, \`MetricComparisonCard\` (\`>= 18 px\`, \`tabular-nums\`, \`>= 60%\` pola) |
| Lektor, \`eleven_v3\`, fonetyka, muzyka AI i SFX | \`sound-and-music-design\` | Głosy ElevenLabs (\`speed: 0.98–1.00\`), reżyseria \`eleven_v3\` (tagi + dyskretne \`stability\` + mikro-segmenty \`a/b/c\`), \`"api"\` vs \`"u-es-be"\`, \`VoiceoverTrack\`, \`SmartMusicBed\`, \`SoundCue\`, \`-14 LUFS\` |
| Kinematyka Disneya, kamera Shot DSL, szyba 3D i VFX | \`cinematography-and-vfx\` | \`@make-pictures/core/kinematics\`, \`ShotType3D\` (\`'macro'\`), \`computeCameraBasis3D\`, \`evaluateCameraKeyframes3D\`, \`ScreenGlassLayer3D\`, \`ContinuousSceneFlow\`, \`SceneSubViewDissolve\`, \`DirectorCamera3D/2D\`, \`9:16\` Safe Box |
`;

const FALLBACK_PLUGIN_JSON = {
  name: 'make-pictures',
  version: '2.4.1',
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

Welcome to **make.pictures** ([https://make.pictures](https://make.pictures)) — an open-source \`60 FPS\` Video-as-Code studio and npm ecosystem (\`create-make-pictures\`, \`@make-pictures/core\`, \`@make-pictures/kits\`, \`@make-pictures/studio\`, \`@make-pictures/cli\`) built with **Remotion**, **Three.js (\`@remotion/three\`)**, **TypeScript**, **Zod**, and **ElevenLabs** (TTS + AI Music + AI SFX).

> **IMPORTANT:** Read [\`AGENTS.md\`](./AGENTS.md) alongside this file for universal studio invariants, and use **Progressive Skill Loading** from \`.claude/skills/\` / \`.agents/plugins/make-pictures/skills/\` (or [\`plugins/make-pictures/skills/\`](./plugins/make-pictures/skills/) in the engine monorepo) so you load only the exact domain rules needed for your active task.

---

## 3 Official Workspace Modes

\`make.pictures\` supports three first-class workflows via the \`@make-pictures/cli\` binary (\`npx make-pictures <command>\`):

1. **Standalone Video Studio (\`npx create-make-pictures@latest my-films\`):**
   - \`productions/*\` and custom \`styles/*.style.json\` presets are the user's Git-tracked source code; the engine runs cleanly from \`node_modules/@make-pictures/*\`.
2. **Embedded Inside an Existing SaaS / App Repo (\`npx make-pictures init --dir=videos\`):**
   - Adds \`videos/productions/\` + \`videos/styles/\` and syncs \`.agents/plugins/make-pictures\` AI skills (plus \`.claude/skills/\`) into a Next.js/Vite/monorepo codebase so agents can turn real UI components into \`60 FPS\` launch videos. Pass \`--dir=videos\` to CLI commands (\`npx make-pictures studio --dir=videos\`, \`npx make-pictures qa <Id> --dir=videos\`).
3. **Live Interactive Web Embeds (\`npm i @make-pictures/core @make-pictures/kits\`):**
   - Import subpath kits (e.g., \`@make-pictures/kits/vector-scene-2d\`, \`@make-pictures/kits/editorial-collage\`, \`@make-pictures/kits/motion-diagrams-2d\`, \`@make-pictures/kits/isometric-3d\`) wrapped in \`<StyleProvider style="minimal-product" renderBackdrop>\` directly inside \`<Player numberOfSharedAudioTags={32} />\` from \`@remotion/player\` on React/Next.js pages without rendering MP4 files.

*(When developing inside the \`make-pictures-studio\` engine monorepo itself: \`packages/*\` holds publishable packages, \`examples/*\` holds showcases, \`styles/*.style.json\` holds local custom art direction presets, and \`productions/<slug>/\` holds isolated user films.)*

---

## Quick Reference Commands (\`npx make-pictures\` / \`npm run\`)

- \`npx make-pictures onboard\` (\`npm run onboard\`; pass \`--json\` for explicit agent JSON mode) — Interactive terminal setup (or agent JSON workflow when run by an AI agent / \`--json\`): verifies \`node_modules\` & \`ffmpeg\`, authorizes \`ELEVENLABS_API_KEY\` into \`.env.local\` (powering TTS, Music & SFX; never print \`.env.local\` in chat!), and checks \`60 FPS\` readiness.
- \`npx make-pictures doctor\` (\`npm run doctor\`) — Validate Node.js, FFmpeg, \`.env.local\`, ElevenLabs API connectivity, and Remotion readiness.
- \`npx make-pictures init [--dir=videos] [--space=2d|2.5d|3d] [--kit=vector-scene-2d] [--style=minimal-product] [--lang=pl|en]\` — Initialize \`make.pictures\`, \`styles/\`, and \`.agents/plugins/make-pictures\` inside an existing SaaS/app repository.
- \`npx make-pictures styles [--space=2d|2.5d|3d] [--json] [--dir=.]\` — List all **10 built-in styles** (\`minimal-product\`, \`sketch-notebook\`, \`retro-pc\`, \`brutalist-poster\`, \`cyber-telemetry\`, \`tactile-craft\`, \`editorial-press\`, \`archival-chronicle\`, \`soft-clay\`, \`glass-studio\`) across \`DimensionalSpace ('2d' | '2.5d' | '3d')\` (e.g., \`npx make-pictures styles --space=3d\`), custom workspace presets in \`styles/*.style.json\`, and all **7 visual kits**.
- \`npx make-pictures style new <slug> [--from=soft-clay] [--force] [--dir=.]\` — Scaffold a reusable custom art direction preset at \`styles/<slug>.style.json\`.
- \`npx make-pictures new <slug> [--space=2d|2.5d|3d] [--kit=vector-scene-2d|editorial-collage|kinetic-typography|data-storytelling|motion-diagrams-2d|paper-diorama-3d|isometric-3d] [--style=<styleId>] [--voice=<voiceId>] [--lang=pl|en] [--dir=.]\` — Scaffold a clean production capsule in \`productions/<slug>/\` (e.g., \`npx make-pictures new <slug> --space=3d\`, \`--space=2d --style=retro-pc\`, or \`--kit=editorial-collage --style=editorial-press\`).
- \`npx make-pictures voices [--lang=pl|en|all] [--gender=female|male] [--query="..."] [--mine] [--json] [--audition="..." --voice=<id>]\` — Discover language-native ElevenLabs voices (curated studio presets, your own account voices, and Voice Library with 0-credit preview URLs) or audition a single test sentence before full synthesis. Never use English premade voices (Liam, Sarah, Brian, George) for Polish scripts.
- \`npx make-pictures audio [--production=<slug>] [--mock] [--force] [--dir=.]\` — Lint native PL voice selection, Polish/English TTS phonetics (\`głoskowce\` \`"api"\` vs hyphenated \`literowce\` \`"u-es-be"\`, SKU codes), and \`eleven_v3\` tags/discrete \`stability\`, then synthesize word-aligned \`.mp3\`/\`.json\` voiceovers (\`speed: 0.99\`, optional \`modelId\` & \`languageCode\`), AI Music score, and AI SFX (\`productions/<slug>/generated/audio-manifest.ts\`). Shortcuts: \`music\`, \`sfx\`.
- \`npx make-pictures image "<prompt>" --out=<file.png> [--style=<styleId>]\` — Generate style-anchored illustration assets with an automatic \`Base Style Anchor\` and unconditional no-raster-text guard clause.
- \`npx make-pictures cutout <source.pdf|photo.png> --out=<file.png> [--page=1]\` — Extract lossless PDF \`/SMask\` RGBA streams or run Exterior Border Flood-Fill (never global white thresholding!) with interior alpha-hole detection and a \`#0F172A\`/\`#1E293B\` Dark Checkerboard QA sheet.
- \`npx make-pictures assets clean-scan <input> --out=<out.png>\` / \`npx make-pictures assets sheet <dir> [--out=<qa.png>]\` — Clean dark scanner corners/borders on archival scans via Exterior Perimeter Flood-Fill (protecting interior ink 100%) and generate a dark-checkerboard asset contact-sheet PNG with bitmap labels.
- \`npx make-pictures studio [--port=3000] [--dir=.]\` (\`npm run studio\`) — Launch **Studio Web** (\`http://127.0.0.1:3000\`): \`60 FPS\` HMR \`<Player />\`, **\`🎬 Filmy\` | \`🎨 Style Lab\` (\`?view=styles\`)** live \`[ 2D ] [ 2.5D ] [ 3D ]\` × 10 built-in & custom style previewer, Origin Filter (\`All | Examples | Productions\`), Multi-Track Director Timeline, *Golden Safe Box \`9:16\`*, and Props Inspector (\`zod\` ↔ \`*.props.json\` & \`styles/*.style.json\`).
- \`npx make-pictures qa <CompositionId> [--grid=auto|4x3] [--dir=.]\` (\`npm run qa -- <CompositionId>\`) — Run the hard **Director QA Gate** (\`>= 4.5 s\` scenes, \`pre >= 36f\` / \`post >= 90f\` / \`outro >= 132f\` breathing room, \`<= 2\` sub-views, \`<Img>\`, \`>= 18px\` 1080p typography floor, card void check, Clean \`f=0\` \`0.00\` variance) and render an auto-sized **Contact-Sheet QA** PNG (\`out/qa-<CompositionId>.png\`, \`--grid=auto\` covering 100% of scenes & sub-views) with \`sceneId/subViewId\` badges and \`9:16\` Golden Safe Box overlays.
- \`npm run typecheck\` — Run \`tsc --noEmit\` across the workspace.
- \`npx make-pictures render <CompositionId> [outPath] [--dir=.]\` (\`npm run render -- <CompositionId>\`) — Render \`60 FPS\` MP4 (\`--concurrency=100%\`, automatic \`--gl=angle\` for 3D) with broadcast \`-14 LUFS\` EBU R128 loudness mastering, then audition the final mastered \`.mp4\` mix.

---

## Core Architectural Invariants

1. **Mandatory Step 1 Art Direction Gate (\`DimensionalSpace ('2d' | '2.5d' | '3d') × StylePreset\`):**
   - **Never default blindly to \`paper-diorama-3d\` or rigid \`3×2\` blinking tile grids.** Match topic, era, and brand across **\`DimensionalSpace ('2d' | '2.5d' | '3d') × StylePreset\`** (\`7\` scene kits × \`10 BUILT_IN_STYLES\` or custom \`styles/*.style.json\`) wrapped in a single top-level \`<StyleProvider style={props.styleId} renderBackdrop>\`. Visualize multi-category enumerations via \`<EditorialPanoramaTrack />\`, layered editorial collage, or spatial cross-sections.
2. **Clean Capsule Architecture (\`productions/<slug>/\`), Voiceover Breathing Budget & Sub-View Limit:**
   - Every user video lives inside \`productions/<slug>/\`. Compute scene durations with \`computeSceneTimingFromVoiceover\`: **\`~0.7 s\` (\`42f\`)** pre-speech settle, **\`~1.5–1.7 s\` (\`90–102f\`)** post-speech hold, and **\`+2.2–2.5 s\` (\`132–150f\`)** outro hold (\`<SmartMusicBed fadeOutFrames={90} />\`).
   - Sequence multi-scene films via \`<ContinuousSceneFlow crossDissolveFrames={54} />\` + \`<OpticalCrossDissolve />\` (with \`<ClippedSurfaceChrome />\` on \`overflow: 'visible'\` rounded cards). Limit each scene to at most \`1\` evolving layout or \`2\` sub-views via \`<SceneSubViewDissolve />\` (\`48–60f\`; \`3+\` sub-views per scene are banned).
3. **100% Determinism, \`<Img>\` Hygiene, Single-Source Bezier & Typography Floor (\`>= 18px\`):**
   - **Frame \`0\` is 100% uniform \`bgCanvas\` (\`0.00\` RGB variance):** Start entrance springs at \`frame - 2\`, always use \`<Img>\` from \`'remotion'\` (never raw \`<img>\`), avoid visual noise (packet clouds, radar rings), compute SVG curves & pulses from one \`buildCubicBezierPath\` / \`evaluateCubicBezier\` (\`packetCount={0}\` default), and pin media callouts with \`<PinnedMediaStage />\` (\`Δx = 0.00 px\`).
   - **1080p Legibility & Card Density (\`TYPOGRAPHY_FLOOR_1080P\`):** Never render screen text \`< 18px\`. Follow **"Headline (\`26–32 px\`, \`2–5\` words) + 1 concise sentence (\`19–22 px\`, \`6–11\` words)"**, use \`boxSizing: 'border-box'\` on all containers/\`WorldBox\`, center card content (\`height: 'auto'\`, \`justifyContent: 'center'\` — never stretch sparse cards with \`space-between\`; use \`<HorizontalFeatureGrid2x2 />\` for \`2×2\` summaries), and keep sparse Foley (\`3–5\` cues at \`0.14–0.26\`).
   - **Zero \`Math.random()\`, zero cross-frame \`useRef\`, finite \`<Audio />\` lifetimes:** Use \`createSeededRandom(seed)\`, offline \`<StudioHdrRig3D />\` / \`<SyncStudioIbl3D />\`, \`<VoiceoverTrack />\`, and \`<SoundCue />\`.
   - **Tactile 3D, Disney Kinematics, Collision SAT & Frameless Overlays:** For 3D/2.5D physical stages, use \`@make-pictures/core/kinematics\` (\`disneyEase\`, \`evaluateArc3D\`, \`evaluateSurfaceImpact\`, 15-axis OBB SAT \`obbClearanceSat3D\` / \`auditSceneCollisions3D\`) and \`@make-pictures/kits/tactile-3d\` (\`<DeformableSheet3D />\`, \`<ScreenGlassLayer3D />\`, \`<SyncStudioIbl3D />\`, \`getProceduralPbrMaps\`, \`<DaylightArcRig3D />\`). Layer frameless \`<FloatingEditorialDisplay />\` and \`<PaperRibbonTimeline />\` (\`>= 19–22 px\`, zero dark web boxes) over 3D/2.5D scenes.
   - **Expressive \`eleven_v3\` Acting Direction:** When directing \`eleven_v3\`, combine acting tags (\`[thoughtful]\`, \`[warmly]\`, \`[playful]\`, \`[amazed]\`), discrete \`stability ∈ {0.0, 0.5, 1.0}\`, and micro-segments (\`a/b/c\`) separated by visual/SFX pauses.
4. **Props & Style Contract (\`zod\` ↔ \`*.props.json\` & \`styles/*.style.json\`):**
   - Export a \`z.object\` schema with \`.describe('Section :: Label')\` (including \`styleId\`) and store defaults in \`<CompositionId>.props.json\`. **Always read \`*.props.json\` and \`styles/*.style.json\` from disk before editing** to preserve live tweaks saved in **Studio Web** and **🎨 Style Lab**.
5. **Mandatory Quality Gates Before & After Render:**
   - **Pilot Demo (2–3 Shots) & Mandatory Fact-Check:** For larger 3D or documentary films, render a short **Pilot Demo** (\`2–3\` key shots) first to lock art direction/camera and complete a mandatory **fact-check** of dates, quotes, and proper nouns before generating paid audio or final renders.
   - **Phonetics, \`eleven_v3\` & Asset QA:** Verify Polish **głoskowce** (\`"api"\`, \`"ram"\`, \`"lan"\`, \`"led"\`) vs hyphenated **literowce** (\`"u-es-be"\`, \`"es-ku-el"\`, \`"ce-er-em"\`), \`eleven_v3\` tags/discrete \`stability\`, listen to \`.mp3\` voiceovers, and inspect dark-checkerboard PNGs from \`npx make-pictures cutout\` and \`npx make-pictures assets sheet\`.
   - **3D Zero-Collision Test, Hard Director Gate & Auto-Grid Contact-Sheet QA:** Run \`auditSceneCollisions3D\` unit tests for 3D choreography, then \`npx make-pictures qa <CompositionId>\` (\`--grid=auto\`) and inspect \`out/qa-<CompositionId>.png\` (\`100%\` scene/sub-view coverage, \`f=0\` clean board, \`>= 18px\` legibility, \`9:16\` **Golden Safe Box \`x ∈ [40, 910], y ∈ [220, 1380]\`**).
   - **Typecheck & Final \`.mp4\` Audition:** Run \`npm run typecheck\`, render via \`npx make-pictures render <CompositionId>\`, and audition the mastered \`-14 LUFS\` \`.mp4\` mix.

---

## Progressive Skill Library (9 Skills in \`.claude/skills/\` / \`.agents/plugins/make-pictures/skills/\`)

Load the relevant \`SKILL.md\` **before** choosing styles, authoring scripts, audio specs, cameras, or visual scenes:

| Task / Layer | Skill Name |
| :--- | :--- |
| **6-Step Director Workflow, Pilot Demo, Fact-Check, \`production.json\`, \`assets clean-scan\`/\`sheet\`, \`auditSceneCollisions3D\` & Hard \`qa\` Gate** | \`make-pictures-director\` |
| **Step 1 Art Direction Gate: \`DimensionalSpace ('2d' \\| '2.5d' \\| '3d') × 10 BUILT_IN_STYLES\` + \`styles/*.style.json\`, \`<StyleProvider>\`, \`material3d\` & 🎨 Style Lab** | \`style-and-art-direction\` |
| **Editorial Collage (\`ChapterTitleCard\`, \`EditorialMediaCard\`, \`EditorialPanoramaTrack\`, \`PaperRibbonTimeline\`, \`FloatingEditorialDisplay\`) & Vector Scene 2D (\`StoryCard2D\`, \`PinnedMediaStage\`)** | \`kit-editorial-and-vector\` |
| **2.5D Layered Cutouts & Tactile 3D (\`DioramaStage3D\`, \`PaperCutout3D\`, \`PopUpHinge3D\`, 9 \`ScenicCutoutMotifs\`, \`@make-pictures/kits/tactile-3d\` \`DeformableSheet3D\`, 15-Axis OBB SAT \`obbClearanceSat3D\`)** | \`kit-paper-diorama-3d\` |
| **2D Infinite-Canvas & Retro-PC Diagrams (\`RetroPcWindowStage2D\`, \`MotionDiagramStage2D\`, \`SystemNode\`, \`DataFlowEdge\`, \`NodeBox\` Ports, \`FlowCurve\`)** | \`kit-motion-diagrams-2d\` |
| **SaaS \`.mp4\` Screen Recordings (\`@make-pictures/kits/product-frames\`: \`BrowserFrame\`, \`PhoneFrame\`, \`ScreenSpotlightOverlay\`)** | \`kit-motion-diagrams-2d\` + \`make-pictures-director\` |
| **3D Soft-Clay, Sync PMREM IBL, Offline PBR & Daylight Arc (\`StudioHdrRig3D\`, \`SyncStudioIbl3D\`, \`getProceduralPbrMaps\`, \`DaylightArcRig3D\`, \`ClayCharacter3D\`, \`PodcastStudioSet3D\`, \`IsometricStage3D\`)** | \`kit-isometric-3d\` |
| **Kinetic Typography & Data Storytelling (\`WordByWordStage\`, \`ImpactKeywordCard\`, \`AnimatedMetricCounter\`, \`AnimatedBarRace\`, \`TimelineTrack\`, \`MetricComparisonCard\`)** | \`kit-kinetic-and-data\` |
| **ElevenLabs Voices, \`eleven_v3\` Acting Direction, PL/EN Phonetics, AI Music (\`SmartMusicBed\`, 7 \`moodPreset\`s) & AI SFX (\`SoundCue\`, \`-14 LUFS\`)** | \`sound-and-music-design\` |
| **Disney Kinematics (\`@make-pictures/core/kinematics\`), Shot DSL (\`'macro'\`, \`computeCameraBasis3D\`, \`evaluateCameraKeyframes3D\`), \`ScreenGlassLayer3D\`, \`ContinuousSceneFlow\` & VFX** | \`cinematography-and-vfx\` |
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
          version: '2.4.1',
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
