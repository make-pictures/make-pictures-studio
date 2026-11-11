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
  return `import React from 'react';
import { Composition, registerRoot } from 'remotion';
import {
  registerVoiceoverManifest,
  type DefinedProduction,
  type SceneVoiceoverData,
  type StudioCompositionEntry,
} from '@make-pictures/core';

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

Uniwersalne niezmienniki studia **make.pictures** (\`60 FPS\` Video-as-Code). Szczegółowe reguły geometrii, audio, kamer i zestawów wizualnych ładuj progresywnie ze skilli w \`.agents/plugins/make-pictures/skills/\` (lub \`plugins/make-pictures/skills/\`).

## 1. Konfiguracja (\`onboard\` i \`ELEVENLABS_API_KEY\`)
1. Uruchom \`npx make-pictures onboard\` (lub \`npm run onboard\`) i wykonuj kroki JSON (\`next\`, \`run\`, \`say\`).
2. Narzędzie weryfikuje \`node_modules\` i \`ffmpeg\`, po czym wywołuje \`@elevenlabs/cli@latest onboard connect --env-path .env.local\` (jeden klucz \`ELEVENLABS_API_KEY\` zasila TTS, Music i SFX). **Nigdy** nie proś o klucz na czacie ani nie wypisuj \`.env.local\`.
3. Po \`npx make-pictures onboard check\` zaproponuj \`npx make-pictures studio\` (\`http://127.0.0.1:3000\`) lub pierwszy film.

## 2. Architektura Kapsuł (\`productions/<slug>/\`) i Tryby Projektu
- **Silnik:** \`@make-pictures/core\`, \`@make-pictures/kits\`, \`@make-pictures/studio\`, \`@make-pictures/cli\`.
- **3 tryby pracy CLI (\`npx make-pictures ...\` lub skrypty \`npm run ...\`):**
  1. **Standalone Studio (\`npx create-make-pictures my-films\`):** \`productions/<slug>/\` to kod źródłowy użytkownika śledzony w Git; silnik działa z \`node_modules/@make-pictures/*\`.
  2. **Wewnątrz istniejącej aplikacji SaaS (\`npx make-pictures init --dir=videos\`):** przekazuj \`--dir=videos\` do komend (\`npx make-pictures new <slug> --dir=videos\`, \`npx make-pictures studio --dir=videos\`).
  3. **Monorepo silnika (\`make-pictures-studio\`):** pokazy żyją w \`examples/*\`, a filmy użytkownika w izolowanym \`productions/<slug>/\`. Zakaz zaszywania ID scen filmów w kodzie silnika.
- Tworzenie nowego filmu: \`npx make-pictures new <slug> --kit=paper-diorama-3d --lang=pl\` (\`production.json\`, \`compositions/\`, \`assets/\`, \`generated/audio-manifest.ts\`).

## 3. Determinizm \`60 FPS\` i Kontrakt \`zod\` ↔ \`*.props.json\`
- **Czysta klatka \`0\`:** Pierwsza klatka to puste tło; animacje wejścia startuj od \`frame - 2\`.
- **Sprężyny i determinizm:** Używaj \`SPRING_PRESETS\` (\`damping: 200\`) oraz \`createSeededRandom(seed)\` z \`@make-pictures/core\`. Całkowity **zakaz \`Math.random()\`** i akumulacji stanu w \`useRef\` między klatkami (\`--concurrency=100%\`).
- **Props Inspector:** Eksportuj \`z.object\` z opisami \`.describe('Sekcja :: Etykieta')\` i trzymaj wartości domyślne w \`<CompositionId>.props.json\`. **Zawsze odczytaj \`*.props.json\` z dysku przed edycją**, by zachować zmiany z \`Studio Web\`.
- **Typografia:** Domyślnie bez dolnych napisów; karty *Ikona + 2–3 słowa*; po polsku *Sentence case* (bez *Title Case*).

## 4. Obowiązkowe Bramki Jakości przed Renderem
1. **Odsłuch Audio:** Po \`npx make-pictures audio --production=<slug>\` (lub \`npm run audio -- --production=<slug>\`) odsłuchaj wygenerowane \`.mp3\` przez \`read_file\`.
2. **Contact-Sheet QA:** Uruchom \`npx make-pictures qa <CompositionId>\` (lub \`npm run qa -- <CompositionId>\`) i obejrzyj 12-klatkowy \`out/qa-<CompositionId>.png\` przez \`read_file\` (\`f=0\` puste tło, brak kolizji/Z-fightingu, w \`9:16\` karty w **Golden Safe Box \`x ∈ [40, 910], y ∈ [220, 1380]\`**).
3. **Typy i Render (\`-14 LUFS\`):** \`npm run typecheck\`, a następnie \`npx make-pictures render <CompositionId>\` (lub \`npm run render -- <CompositionId>\`).

## 5. Tablica Routingu Skilli (Załaduj przed Pisaniem Scen!)
| Zadanie / Warstwa | Skill (\`.agents/plugins/make-pictures/skills/<skill>/SKILL.md\`) | Zakres |
| :--- | :--- | :--- |
| Nowy film, \`production.json\`, QA, render | \`make-pictures-director\` | 6 kroków produkcji, tryby CLI, rytm ujęć 3–5 s |
| Teatrzyk 2.5D Pop-Up Book | \`kit-paper-diorama-3d\` | \`PaperCutout3D\`, \`ImageCutout3D\`, \`PopUpHinge3D\`, \`Δz\` |
| Diagramy 2D i nieskończone płótno | \`kit-motion-diagrams-2d\` | \`NodeBox\`, \`FlowCurve\`, \`DirectorCamera2D\` |
| Nagrania ekranu SaaS \`.mp4\` (screencasty) | \`kit-motion-diagrams-2d\` + \`make-pictures-director\` | \`@make-pictures/kits/product-frames\`: \`BrowserFrame\`, \`PhoneFrame\`, \`ScreenSpotlightOverlay\` (\`<OffthreadVideo />\`, \`assets/videos/\`) |
| Izometryczne studio 3D i dialogi | \`kit-isometric-3d\` | \`Stylized3DCharacter\`, \`speakingWeight\` vs \`speechEnergy\` |
| Kinetyczna typografia i wykresy | \`kit-kinetic-and-data\` | \`WordByWordStage\`, \`AnimatedBarRace\`, \`TimelineTrack\`, \`MetricComparisonCard\` |
| Lektor, fonetyka, muzyka AI i SFX | \`sound-and-music-design\` | \`SmartMusicBed\`, \`SoundCue\`, \`VoiceAcousticPreset\`, \`-14 LUFS\` |
| Kamera Shot DSL (2D/3D) i VFX | \`cinematography-and-vfx\` | \`DirectorCamera3D/2D\`, \`9:16\` Safe Box, \`CinematicLensOverlay\`, \`ParticleField\`, \`SceneTransition\` |
`;

const FALLBACK_PLUGIN_JSON = {
  name: 'make-pictures',
  version: '2.0.0',
  description:
    'make.pictures Studio — 60 FPS Video-as-Code skills, visual kits, camera Shot DSL, and ElevenLabs AI Audio Studio.',
  author: {
    name: 'make.pictures',
    url: 'https://make.pictures',
  },
  homepage: 'https://make.pictures',
  repository: 'https://github.com/make-pictures/make-pictures-studio',
};

export const FALLBACK_CLAUDE_MD = `# CLAUDE.md — Claude Code Instructions for \`make.pictures\` Studio

Read [\`AGENTS.md\`](./AGENTS.md) alongside this file for universal \`60 FPS\` Video-as-Code invariants, and load domain skills progressively from [\`.claude/skills/\`](./.claude/skills/) (mirrored from \`.agents/plugins/make-pictures/skills/\`).

## Capsule Architecture & Determinism
- **Isolated Capsules (\`productions/<slug>/\`):** Keep every film self-contained (\`production.json\`, \`compositions/\`, \`assets/\`, \`generated/audio-manifest.ts\`). In embedded SaaS repos (\`--dir=videos\`), capsules live in \`videos/productions/<slug>/\`.
- **60 FPS Determinism:** Frame \`0\` must render a clean empty background (start entrance springs at \`frame - 2\`). Never use \`Math.random()\` or cross-frame \`useRef\` state — use \`SPRING_PRESETS\` and \`createSeededRandom(seed)\` from \`@make-pictures/core\`.
- **Props Inspector (\`zod\` ↔ \`*.props.json\`):** Always read \`<CompositionId>.props.json\` from disk before editing so live tweaks from Studio Web are preserved. Never open or print \`.env.local\`.

## CLI Commands (\`npx make-pictures\`)
- \`npx make-pictures onboard\` / \`npx make-pictures doctor\` — Verify Node.js, FFmpeg, and ElevenLabs OAuth (\`.env.local\`).
- \`npx make-pictures init --dir=videos\` — Initialize capsules + AI skills inside an existing app repo.
- \`npx make-pictures new <slug> --kit=paper-diorama-3d --lang=en\` — Scaffold a new \`60 FPS\` production capsule.
- \`npx make-pictures audio --production=<slug> [--mock]\` — Synthesize ElevenLabs TTS + word timestamps + AI Music + AI SFX.
- \`npx make-pictures studio [--port=3000] [--dir=.]\` — Launch local \`60 FPS\` Studio Web workstation (\`http://127.0.0.1:3000\`).
- \`npx make-pictures qa <CompositionId>\` — Render 12-frame Contact-Sheet PNG (\`out/qa-<CompositionId>.png\`) and inspect via \`Read\` (\`9:16\` Golden Safe Box \`x ∈ [40, 910], y ∈ [220, 1380]\`).
- \`npm run typecheck\` && \`npx make-pictures render <CompositionId>\` — Typecheck and render \`60 FPS\` MP4 mastered to \`-14 LUFS\`.

## Auto-Discovered Skills (\`.claude/skills/<skill>/SKILL.md\`)
1. \`make-pictures-director\` — 6-step production workflow, \`production.json\`, CLI modes, and QA gates.
2. \`kit-paper-diorama-3d\` — 2.5D pop-up book (\`PaperCutout3D\`, \`ImageCutout3D\`, \`PopUpHinge3D\`, \`Δz\` layering).
3. \`kit-motion-diagrams-2d\` — 2D infinite-canvas diagrams (\`NodeBox\` ports, \`FlowCurve\`, \`92–120f\` packets), plus SaaS \`.mp4\` screencasts via \`@make-pictures/kits/product-frames\` (\`BrowserFrame\`, \`PhoneFrame\`, \`ScreenSpotlightOverlay\`).
4. \`kit-isometric-3d\` — 3D isometric dialogue (\`Stylized3DCharacter\`, \`speakingWeight\` vs \`speechEnergy\`).
5. \`kit-kinetic-and-data\` — Kinetic typography & data charts (\`WordByWordStage\`, \`AnimatedBarRace\`, \`TimelineTrack\`).
6. \`sound-and-music-design\` — ElevenLabs voices, PL/EN phonetics, \`SmartMusicBed\` auto-ducking, \`SoundCue\`, \`-14 LUFS\`.
7. \`cinematography-and-vfx\` — Shot DSL (\`DirectorCamera3D/2D\`), \`9:16\` Safe Box, deterministic particles & transitions.
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
 * `rules/AGENTS.md`, `skills/<skill>/SKILL.md`) into `<rootDir>/.agents/plugins/make-pictures/`,
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
          version: '2.0.0',
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
    fs.writeFileSync(claudeMdPath, FALLBACK_CLAUDE_MD, 'utf8');
  }

  const claudeSkillsPath = ensureClaudeSkillsLink(
    rootDir,
    pluginDestDir,
    Boolean(options?.force)
  );

  return { pluginDestDir, agentsMdPath, claudeMdPath, claudeSkillsPath };
}
