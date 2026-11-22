#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type StarterSpace = '2d' | '2.5d' | '3d';

export type StarterKitId =
  | 'editorial-collage'
  | 'vector-scene-2d'
  | 'kinetic-typography'
  | 'data-storytelling'
  | 'motion-diagrams-2d'
  | 'paper-diorama-3d'
  | 'isometric-3d';

export interface CreateMakePicturesOptions {
  targetDir: string;
  space?: StarterSpace;
  kit?: StarterKitId;
  style?: string;
  lang?: 'pl' | 'en';
  install?: boolean;
  force?: boolean;
}

interface ParsedCreateArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

const VALID_SPACES = new Set<StarterSpace>(['2d', '2.5d', '3d']);

const VALID_KITS = new Set<StarterKitId>([
  'editorial-collage',
  'vector-scene-2d',
  'kinetic-typography',
  'data-storytelling',
  'motion-diagrams-2d',
  'paper-diorama-3d',
  'isometric-3d',
]);

interface StarterStyleMeta {
  accentPrimary: string;
  accentSecondary: string;
  mood: string;
  voiceId: string;
  voiceIdPl: string;
}

const STARTER_STYLE_METADATA: Record<string, StarterStyleMeta> = {
  'minimal-product': {
    accentPrimary: '#2563EB',
    accentSecondary: '#0EA5E9',
    mood: 'upbeat-launch',
    voiceId: 'TX3LPaxmHKxFdv7VOQHJ',
    voiceIdPl: 'Bz1e1clEKwgN71Vx7cxj',
  },
  'editorial-press': {
    accentPrimary: '#C83E2B',
    accentSecondary: '#1D4ED8',
    mood: 'news-pulse',
    voiceId: 'EXAVITQu4vr4xnSDxMaL',
    voiceIdPl: 'F9eb9uZYeJuHuO7Uvs1R',
  },
  'archival-chronicle': {
    accentPrimary: '#9E3B24',
    accentSecondary: '#B07D2B',
    mood: 'warm-story',
    voiceId: 'nPczCjzI2devNBz1zQrb',
    voiceIdPl: 'CLuTGacrAhcIhaJslbXt',
  },
  'cyber-telemetry': {
    accentPrimary: '#00F5D4',
    accentSecondary: '#8B5CF6',
    mood: 'ambient-tech',
    voiceId: 'TX3LPaxmHKxFdv7VOQHJ',
    voiceIdPl: 'Bz1e1clEKwgN71Vx7cxj',
  },
  'brutalist-poster': {
    accentPrimary: '#FF2A85',
    accentSecondary: '#2563EB',
    mood: 'upbeat-launch',
    voiceId: 'JBFqnCBsd6RMkjVDRZzb',
    voiceIdPl: 'C8ZVSJxcymeT86xT429O',
  },
  'sketch-notebook': {
    accentPrimary: '#0D9488',
    accentSecondary: '#F59E0B',
    mood: 'warm-story',
    voiceId: 'JBFqnCBsd6RMkjVDRZzb',
    voiceIdPl: 'C8ZVSJxcymeT86xT429O',
  },
  'tactile-craft': {
    accentPrimary: '#EA580C',
    accentSecondary: '#059669',
    mood: 'paper-expedition',
    voiceId: 'JBFqnCBsd6RMkjVDRZzb',
    voiceIdPl: 'C8ZVSJxcymeT86xT429O',
  },
  'retro-pc': {
    accentPrimary: '#38BDF8',
    accentSecondary: '#4ADE80',
    mood: 'ambient-tech',
    voiceId: 'TX3LPaxmHKxFdv7VOQHJ',
    voiceIdPl: 'Bz1e1clEKwgN71Vx7cxj',
  },
  'soft-clay': {
    accentPrimary: '#EA580C',
    accentSecondary: '#0D9488',
    mood: 'warm-story',
    voiceId: 'JBFqnCBsd6RMkjVDRZzb',
    voiceIdPl: 'C8ZVSJxcymeT86xT429O',
  },
  'glass-studio': {
    accentPrimary: '#4F46E5',
    accentSecondary: '#06B6D4',
    mood: 'upbeat-launch',
    voiceId: 'TX3LPaxmHKxFdv7VOQHJ',
    voiceIdPl: 'Bz1e1clEKwgN71Vx7cxj',
  },
};

function defaultStarterKitAndStyleForSpace(space: StarterSpace): {
  kit: StarterKitId;
  styleId: string;
} {
  switch (space) {
    case '3d':
      return { kit: 'isometric-3d', styleId: 'soft-clay' };
    case '2.5d':
      return { kit: 'paper-diorama-3d', styleId: 'tactile-craft' };
    case '2d':
    default:
      return { kit: 'motion-diagrams-2d', styleId: 'minimal-product' };
  }
}

function defaultStarterStyleForKit(kit: StarterKitId): string {
  switch (kit) {
    case 'isometric-3d':
      return 'soft-clay';
    case 'paper-diorama-3d':
      return 'tactile-craft';
    case 'editorial-collage':
      return 'editorial-press';
    case 'vector-scene-2d':
    case 'kinetic-typography':
    case 'data-storytelling':
    case 'motion-diagrams-2d':
    default:
      return 'minimal-product';
  }
}

const BOOLEAN_FLAGS = new Set(['no-install', 'force', 'help']);

export const IGNORABLE_EMPTY_DIR_ENTRIES: ReadonlySet<string> = new Set([
  '.DS_Store',
  'Thumbs.db',
  '.git',
  '.gitignore',
  '.vscode',
  '.idea',
  '.claude',
  '.agents',
  '.antigravity',
  '.cursor',
]);

export function isEffectivelyEmptyDir(dirPath: string): boolean {
  if (!fs.existsSync(dirPath)) return true;
  const entries = fs.readdirSync(dirPath);
  return entries.every((entry) => IGNORABLE_EMPTY_DIR_ENTRIES.has(entry));
}

function writeMergedGitignore(
  gitignorePath: string,
  templateContent: string
): void {
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, templateContent, 'utf8');
    return;
  }
  const existing = fs.readFileSync(gitignorePath, 'utf8');
  const existingLines = new Set(
    existing
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
  );
  const missingLines = templateContent
    .split(/\r?\n/)
    .filter((l) => {
      const trimmed = l.trim();
      return trimmed && !trimmed.startsWith('#') && !existingLines.has(trimmed);
    });
  if (missingLines.length > 0) {
    const merged = `${existing.trimEnd()}\n${missingLines.join('\n')}\n`;
    fs.writeFileSync(gitignorePath, merged, 'utf8');
  }
}

function parseArgs(argv: string[]): ParsedCreateArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--') continue;
    if (token.startsWith('--')) {
      const eqIdx = token.indexOf('=');
      if (eqIdx !== -1) {
        const key = token.slice(2, eqIdx);
        const val = token.slice(eqIdx + 1);
        flags[key] =
          val === 'true' ? true : val === 'false' ? false : val;
      } else {
        const key = token.slice(2);
        const next = argv[i + 1];
        if (!BOOLEAN_FLAGS.has(key) && next && !next.startsWith('-')) {
          flags[key] = next;
          i += 1;
        } else {
          flags[key] = true;
        }
      }
    } else if (token === '-h') {
      flags.help = true;
    } else {
      positionals.push(token);
    }
  }

  return { positionals, flags };
}

function toPackageSlug(rawName: string): string {
  const cleaned = rawName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'my-make-pictures-studio';
}

function moodForKit(kit: StarterKitId): string {
  switch (kit) {
    case 'editorial-collage':
      return 'warm-story';
    case 'vector-scene-2d':
      return 'upbeat-launch';
    case 'paper-diorama-3d':
      return 'paper-expedition';
    case 'isometric-3d':
      return 'warm-story';
    case 'kinetic-typography':
      return 'upbeat-launch';
    case 'data-storytelling':
      return 'news-pulse';
    case 'motion-diagrams-2d':
    default:
      return 'ambient-tech';
  }
}

function buildSyntheticWords(
  text: string,
  durationInSeconds: number,
  fps: number
): {
  words: Array<{
    word: string;
    normalizedWord: string;
    start: number;
    end: number;
    startFrame: number;
    endFrame: number;
  }>;
  alignment: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  };
} {
  const tokens = text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (tokens.length === 0) {
    return {
      words: [],
      alignment: {
        characters: [],
        character_start_times_seconds: [],
        character_end_times_seconds: [],
      },
    };
  }

  const weights = tokens.map((w) => Math.max(2, w.length));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const usableDuration = Math.max(0.4, durationInSeconds - 0.16);
  let cursor = 0.06;

  const words: Array<{
    word: string;
    normalizedWord: string;
    start: number;
    end: number;
    startFrame: number;
    endFrame: number;
  }> = [];
  const characters: string[] = [];
  const character_start_times_seconds: number[] = [];
  const character_end_times_seconds: number[] = [];

  tokens.forEach((token, idx) => {
    const share = (weights[idx] / totalWeight) * usableDuration;
    const wordDur = Math.max(0.06, share - 0.02);
    const start = Number(cursor.toFixed(3));
    const end = Number((cursor + wordDur).toFixed(3));

    words.push({
      word: token,
      normalizedWord: token.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''),
      start,
      end,
      startFrame: Math.round(start * fps),
      endFrame: Math.round(end * fps),
    });

    const charStep = wordDur / Math.max(1, token.length);
    for (let c = 0; c < token.length; c++) {
      characters.push(token[c]);
      character_start_times_seconds.push(
        Number((start + c * charStep).toFixed(3))
      );
      character_end_times_seconds.push(
        Number((start + (c + 1) * charStep).toFixed(3))
      );
    }
    if (idx < tokens.length - 1) {
      characters.push(' ');
      character_start_times_seconds.push(end);
      character_end_times_seconds.push(Number((end + 0.02).toFixed(3)));
    }
    cursor += share;
  });

  return {
    words,
    alignment: {
      characters,
      character_start_times_seconds,
      character_end_times_seconds,
    },
  };
}

function buildPackageJson(projectName: string): Record<string, unknown> {
  return {
    name: projectName,
    private: true,
    version: '0.1.0',
    type: 'module',
    scripts: {
      onboard: 'make-pictures onboard',
      doctor: 'make-pictures doctor',
      setup: 'make-pictures doctor --setup',
      studio: 'make-pictures studio',
      styles: 'make-pictures styles',
      new: 'make-pictures new',
      audio: 'make-pictures audio',
      music: 'make-pictures music',
      sfx: 'make-pictures sfx',
      image: 'make-pictures image',
      cutout: 'make-pictures cutout',
      qa: 'make-pictures qa',
      render: 'make-pictures render',
      typecheck: 'tsc --noEmit',
    },
    dependencies: {
      '@make-pictures/core': '^2.4.0',
      '@make-pictures/kits': '^2.4.0',
      '@make-pictures/studio': '^2.4.0',
      '@make-pictures/cli': '^2.4.0',
      remotion: '^4.0.276',
      '@remotion/cli': '^4.0.276',
      '@remotion/bundler': '^4.0.276',
      '@remotion/renderer': '^4.0.276',
      '@remotion/player': '^4.0.276',
      '@remotion/media-utils': '^4.0.276',
      '@remotion/google-fonts': '^4.0.276',
      '@remotion/three': '^4.0.276',
      '@react-three/fiber': '^8.18.0',
      '@react-three/drei': '^9.122.0',
      three: '^0.187.0',
      react: '^18.3.1',
      'react-dom': '^18.3.1',
      'lucide-react': '^0.475.0',
      zod: '^3.24.2',
    },
    devDependencies: {
      typescript: '^5.7.3',
      '@types/node': '^22.13.4',
      '@types/react': '^18.3.18',
      '@types/react-dom': '^18.3.5',
      '@types/three': '^0.187.0',
      vite: '^6.1.0',
      '@vitejs/plugin-react': '^4.3.4',
    },
  };
}

function buildTsconfigJson(): Record<string, unknown> {
  return {
    compilerOptions: {
      target: 'ES2022',
      lib: ['DOM', 'DOM.Iterable', 'ES2022'],
      module: 'ESNext',
      moduleResolution: 'Bundler',
      jsx: 'react-jsx',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
    },
    include: ['src', 'productions', 'styles', 'remotion.config.ts'],
  };
}

const STYLES_README_MD = `# Custom Styles (\`styles/*.style.json\`)

Pliki \`*.style.json\` w tym katalogu definiują wielokrotnego użytku kierunki plastyczne (**Art Direction**) dla Twoich filmów — paletę kolorów, parę fontów Google Fonts (\`latin-ext\`), fakturę tła, geometrię kart, profil sprężyn oraz domyślny nastrój audio.

- Podgląd i edycja na żywo w **60 FPS**: otwórz Studio Web (\`npm run studio\`) i przełącz widok na **🎨 Style Lab**.
- Tworzenie nowego stylu z CLI: \`npx make-pictures style new moj-styl --from=editorial-press\`
- Użycie stylu w nowym filmie: \`npx make-pictures new moj-film --kit=editorial-collage --style=moj-styl\`
`;

const REMOTION_CONFIG_TS = `import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
`;

const SRC_INDEX_TS = `import React from 'react';
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
    const viteStyles = import.meta.glob('../styles/*.style.json', {
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
        '../styles',
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
    const viteProds = import.meta.glob('../productions/*/index.{ts,tsx}', {
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
        '../productions',
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

const GITIGNORE_CONTENT = `# Dependencies & build outputs
node_modules/
out/
dist/
*.tsbuildinfo

# Local secrets (NEVER commit API keys)
.env
.env.local

# Auto-generated symlink mirror for Remotion staticFile()
# Note: productions/ IS your tracked Video-as-Code source!
public/_productions/

# OS files
.DS_Store
`;

function buildEnvExampleContent(lang: 'pl' | 'en'): string {
  const defaultVoiceId =
    lang === 'pl' ? 'C8ZVSJxcymeT86xT429O' : 'TX3LPaxmHKxFdv7VOQHJ';
  return `# make.pictures Studio — Environment Variables
# Connect automatically via: npm run onboard
# Discover native voices via: npx make-pictures voices --lang=${lang}
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=${defaultVoiceId}
ELEVENLABS_MODEL_ID=eleven_multilingual_v2

# Optional: Gemini Image generation (npx make-pictures image "..." --out=...)
# GEMINI_API_KEY=your_gemini_api_key_here
`;
}

const EMBEDDED_AGENTS_MD = `# AGENTS.md — Core Studio Rulebook (make.pictures)

Uniwersalne niezmienniki studia **make.pictures** (\`60 FPS\` Video-as-Code). Szczegółowe reguły geometrii, audio, kamer i zestawów wizualnych ładuj progresywnie ze skilli w \`.agents/plugins/make-pictures/skills/\` (lub \`plugins/make-pictures/skills/\`).

## 1. Konfiguracja (\`onboard\` i \`ELEVENLABS_API_KEY\`)
1. Uruchom \`npx make-pictures onboard --json\` (lub \`npm run onboard -- --json\`) i wykonuj kroki JSON (\`next\`, \`run\`, \`say\`) — w interaktywnym terminalu użytkownika zwykłe \`npm run onboard\` uruchamia czytelny kreator dla człowieka.
2. Narzędzie weryfikuje \`node_modules\` i \`ffmpeg\`, po czym wywołuje \`@elevenlabs/cli@latest onboard connect --env-path .env.local\` (jeden klucz \`ELEVENLABS_API_KEY\` zasila TTS, Music i SFX). **Nigdy** nie proś o klucz na czacie ani nie wypisuj \`.env.local\`.
3. Po \`npx make-pictures onboard check\` zaproponuj \`npx make-pictures studio\` (\`http://127.0.0.1:3000\`) lub pierwszy film.

## 2. Architektura Kapsuł (\`productions/<slug>/\`) i Tryby Projektu
- **Silnik:** \`@make-pictures/core\`, \`@make-pictures/kits\`, \`@make-pictures/studio\`, \`@make-pictures/cli\`.
- **3 tryby pracy CLI (\`npx make-pictures ...\` lub skrypty \`npm run ...\`):**
  1. **Standalone Studio (\`npx create-make-pictures my-films\`):** \`productions/<slug>/\` to kod źródłowy użytkownika śledzony w Git; silnik działa z \`node_modules/@make-pictures/*\`.
  2. **Wewnątrz istniejącej aplikacji SaaS (\`npx make-pictures init --dir=videos\`):** przekazuj \`--dir=videos\` do komend (\`npx make-pictures new <slug> --dir=videos\`, \`npx make-pictures studio --dir=videos\`).
  3. **Monorepo silnika (\`make-pictures-studio\`):** pokazy żyją w \`examples/*\`, a filmy użytkownika w izolowanym \`productions/<slug>/\`. Zakaz zaszywania ID scen filmów w kodzie silnika.
- Tworzenie nowego filmu: \`npx make-pictures new <slug> --space=2d|2.5d|3d --lang=pl\` lub \`npx make-pictures new <slug> --kit=vector-scene-2d --style=minimal-product --lang=pl\` (\`production.json\`, \`compositions/\`, \`assets/\`, \`generated/audio-manifest.ts\`).
- Style i kierunek plastyczny: \`npx make-pictures styles [--space=2d|2.5d|3d]\` oraz \`npx make-pictures style new <slug> --from=editorial-press\` (\`10\` stylów wbudowanych + \`styles/*.style.json\`, zakładka **🎨 Style Lab** w Studio Web).

## 3. Determinizm \`60 FPS\` i Kontrakt \`zod\` ↔ \`*.props.json\`
- **Czysta klatka \`0\`:** Pierwsza klatka to puste tło; animacje wejścia startuj od \`frame - 2\`.
- **Sprężyny i determinizm:** Używaj \`SPRING_PRESETS\` (\`damping: 200\`) oraz \`createSeededRandom(seed)\` z \`@make-pictures/core\`. Całkowity **zakaz \`Math.random()\`** i akumulacji stanu w \`useRef\` między klatkami (\`--concurrency=100%\`).
- **Props Inspector:** Eksportuj \`z.object\` z opisami \`.describe('Sekcja :: Etykieta')\` i trzymaj wartości domyślne w \`<CompositionId>.props.json\`. **Zawsze odczytaj \`*.props.json\` z dysku przed edycją**, by zachować zmiany z \`Studio Web\`.
- **Higiena puli \`<Audio />\`:** Używaj \`<VoiceoverTrack />\` i oszczędnego \`<SoundCue />\` z \`@make-pictures/core\`; **zakaz** montowania \`<Audio />\` wewnątrz \`<Sequence>\` bez jawnego \`durationInFrames\`.
- **Typografia \`>= 18 px\` (\`TYPOGRAPHY_FLOOR_1080P\`):** Domyślnie bez dolnych napisów; karty **nagłówek (\`26–32 px\`) + 1 zdanie (\`19–22 px\`)**; po polsku *Sentence case* (bez *Title Case*).

## 4. Obowiązkowe Bramki Jakości przed Renderem
1. **Linter Fonetyki i Odsłuch Audio:** Po \`npx make-pictures audio --production=<slug>\` (lub \`npm run audio -- --production=<slug>\`) sprawdź ostrzeżenia fonetyczne i odsłuchaj wygenerowane \`.mp3\` przez \`read_file\`.
2. **Auto-Grid Contact-Sheet QA:** Uruchom \`npx make-pictures qa <CompositionId>\` (\`--grid=auto\` pokrywa 100% scen i pod-widoków) i obejrzyj \`out/qa-<CompositionId>.png\` przez \`read_file\` (\`f=0\` puste tło, brak kolizji, w \`9:16\` karty w **Golden Safe Box \`x ∈ [40, 910], y ∈ [220, 1380]\`**).
3. **Typy i Render (\`-14 LUFS\`):** \`npm run typecheck\`, a następnie \`npx make-pictures render <CompositionId>\` (lub \`npm run render -- <CompositionId>\`).

## 5. Tablica Routingu Skilli (Załaduj przed Pisaniem Scen!)
| Zadanie / Warstwa | Skill (\`.agents/plugins/make-pictures/skills/<skill>/SKILL.md\`) | Zakres |
| :--- | :--- | :--- |
| Nowy film, \`production.json\`, QA, render | \`make-pictures-director\` | 6 kroków produkcji, tryby CLI, \`ContinuousSceneFlow\` + sceny \`>= 4.5 s\` |
| Dobór stylu, fontów, palety i \`styles/*.style.json\` | \`style-and-art-direction\` | 10 stylów wbudowanych (\`2D / 2.5D / 3D\`), \`StyleProvider\`, \`Style Lab\`, \`make-pictures style new\` |
| Dokument, kolaż redakcyjny i narracja 2D | \`kit-editorial-and-vector\` | \`editorial-collage\` (\`ChapterTitleCard\`, \`EditorialMediaCard\`, \`HighlightQuoteStage\`), \`vector-scene-2d\` (\`StoryCard2D\`, \`ComparisonSplit2D\`) |
| Teatrzyk 2.5D Pop-Up Book | \`kit-paper-diorama-3d\` | \`DioramaStage3D\`, \`PaperCutout3D\`, \`ImageCutout3D\`, \`PopUpHinge3D\`, \`Δz\` |
| Diagramy 2D i nieskończone płótno | \`kit-motion-diagrams-2d\` | \`RetroPcWindowStage2D\`, \`NodeBox\`, \`FlowCurve\`, \`DirectorCamera2D\` |
| Nagrania ekranu SaaS \`.mp4\` (screencasty) | \`kit-motion-diagrams-2d\` + \`make-pictures-director\` | \`@make-pictures/kits/product-frames\`: \`BrowserFrame\`, \`PhoneFrame\`, \`ScreenSpotlightOverlay\` (\`<OffthreadVideo />\`, \`assets/videos/\`) |
| Studio 3D Soft-Clay i dialogi | \`kit-isometric-3d\` | \`StudioHdrRig3D\`, \`PodcastStudioSet3D\`, \`ClayCharacter3D\`, \`IsometricStage3D\` |
| Kinetyczna typografia i wykresy | \`kit-kinetic-and-data\` | \`WordByWordStage\`, \`AnimatedBarRace\`, \`TimelineTrack\`, \`MetricComparisonCard\` |
| Lektor, fonetyka, muzyka AI i SFX | \`sound-and-music-design\` | \`VoiceoverTrack\`, \`SmartMusicBed\`, \`SoundCue\`, \`VoiceAcousticPreset\`, \`-14 LUFS\` |
| Kamera Shot DSL (2D/3D) i VFX | \`cinematography-and-vfx\` | \`DirectorCamera3D/2D\`, \`9:16\` Safe Box, \`ContinuousSceneFlow\`, \`OpticalCrossDissolve\`, \`ClippedSurfaceChrome\` |
`;

const EMBEDDED_PLUGIN_JSON = {
  name: 'make-pictures',
  version: '2.4.0',
  description:
    'make.pictures Studio — 60 FPS Video-as-Code skills, visual kits, Art Direction Style Lab, camera Shot DSL, and ElevenLabs AI Audio Studio.',
  author: {
    name: 'make.pictures',
    url: 'https://make.pictures',
  },
  homepage: 'https://make.pictures',
  repository: 'https://github.com/make-pictures/make-pictures-studio',
};

function buildHelloStudioCompositionTsx(
  kit: StarterKitId,
  options?: { styleId?: string; lang?: 'pl' | 'en' }
): string {
  const styleId = options?.styleId;
  const isPl = (options?.lang ?? 'pl') === 'pl';
  const schemaBlock = `export const HelloStudioSchema = z.object({
  styleId: z.string().describe('Kolory & Styl :: Styl bazowy (Style ID)'),
  headline: z.string().describe('Teksty & Napisy :: Nagłówek'),
  subheadline: z.string().describe('Teksty & Napisy :: Podtytuł'),
  badgeLabel: z.string().describe('Teksty & Napisy :: Etykieta rozdziału'),
  accentColor: z.string().describe('Kolory & Styl :: Akcent główny'),
  secondaryColor: z.string().describe('Kolory & Styl :: Akcent drugi'),
  voiceoverVolume: z.number().min(0).max(1.5).describe('Audio :: Głośność lektora'),
  musicVolume: z.number().min(0).max(1).describe('Audio :: Głośność muzyki'),
  sfxVolume: z.number().min(0).max(1).describe('Audio :: Głośność SFX'),
});

export type HelloStudioProps = z.infer<typeof HelloStudioSchema>;`;

  const audioBlock = `{MUSIC_MANIFEST?.audioFile ? (
          <SmartMusicBed
            src={staticFile(MUSIC_MANIFEST.audioFile)}
            dialogueSegments={DIALOGUE_SEGMENTS}
            voiceoverManifest={VOICEOVER_MANIFEST}
            baseVolume={props.musicVolume}
            duckedVolume={Math.min(props.musicVolume * 0.34, 0.09)}
            fadeOutFrames={90}
          />
        ) : null}

        <VoiceoverTrack
          voiceover={introVo}
          fromFrame={42}
          volume={props.voiceoverVolume}
        />

        <VoiceoverTrack
          voiceover={payoffVo}
          fromFrame={402}
          volume={props.voiceoverVolume}
        />

        {whooshSfx?.audioFile ? (
          <SoundCue
            src={staticFile(whooshSfx.audioFile)}
            atFrame={38}
            durationSeconds={whooshSfx.durationSeconds}
            volume={props.sfxVolume}
          />
        ) : null}

        {popSfx?.audioFile ? (
          <SoundCue
            src={staticFile(popSfx.audioFile)}
            atFrame={398}
            durationSeconds={popSfx.durationSeconds}
            volume={props.sfxVolume}
          />
        ) : null}`;

  if (kit === 'editorial-collage') {
    return `import React from 'react';
import {
  AbsoluteFill,
  staticFile,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import {
  ContinuousSceneFlow,
  SmartMusicBed,
  SoundCue,
  StyleProvider,
  VoiceoverTrack,
  type OpticalShot2D,
} from '@make-pictures/core';
import {
  ChapterTitleCard,
  EditorialDeskStage,
  EditorialMediaCard,
  HighlightQuoteStage,
  SplitStoryLayout,
} from '@make-pictures/kits/editorial-collage';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from '../generated/audio-manifest';

${schemaBlock}

const DIALOGUE_SEGMENTS = [
  { sceneId: 'hello-studio-intro', fromFrame: 42, durationInFrames: 180 },
  { sceneId: 'hello-studio-payoff', fromFrame: 402, durationInFrames: 180 },
];

const IntroEditorialScene: React.FC<HelloStudioProps> = (props) => {
  const { width, height } = useVideoConfig();
  const shots: OpticalShot2D[] = [
    { fromFrame: 0, x: width / 2, y: height / 2 + 8, zoom: 1.0, focalZ: 0.32, transition: 'cut' },
    { fromFrame: 10, x: width / 2 - 5, y: height / 2, zoom: 1.024, focalZ: 0, transition: 'glide' },
  ];

  return (
    <EditorialDeskStage shots={shots} renderBaseFill={false}>
      <ChapterTitleCard
        chapterLabel={props.badgeLabel}
        title={props.headline}
        subtitle={props.subheadline}
        startFrame={2}
        accentColor={props.accentColor}
      />
    </EditorialDeskStage>
  );
};

const PayoffEditorialScene: React.FC<HelloStudioProps> = (props) => {
  const { width, height } = useVideoConfig();
  const payoffVo = VOICEOVER_MANIFEST['hello-studio-payoff'];
  const shots: OpticalShot2D[] = [
    { fromFrame: 0, x: width / 2 + 6, y: height / 2 - 4, zoom: 1.018, focalZ: 0, transition: 'cut' },
    { fromFrame: 160, x: width / 2, y: height / 2, zoom: 1.038, focalZ: 0, transition: 'glide' },
  ];

  return (
    <EditorialDeskStage shots={shots} renderBaseFill={false}>
      <SplitStoryLayout
        startFrame={2}
        focusShiftFrame={156}
        primary={
          <EditorialMediaCard
            caption={props.headline}
            startFrame={2}
            durationInFrames={340}
          />
        }
        secondary={
          <HighlightQuoteStage
            quote={payoffVo?.text || props.subheadline}
            author={props.headline}
            startFrame={16}
            words={payoffVo?.words}
          />
        }
      />
    </EditorialDeskStage>
  );
};

export const HelloStudio: React.FC<HelloStudioProps> = (props) => {
  const introVo = VOICEOVER_MANIFEST['hello-studio-intro'];
  const payoffVo = VOICEOVER_MANIFEST['hello-studio-payoff'];
  const whooshSfx = SFX_MANIFEST['whoosh-open'];
  const popSfx = SFX_MANIFEST['card-pop'];

  return (
    <StyleProvider style={props.styleId} renderBackdrop>
      <AbsoluteFill>
        ${audioBlock}

        <ContinuousSceneFlow
          crossDissolveFrames={48}
          style={{ backgroundColor: 'transparent' }}
          scenes={[
            {
              id: 'intro',
              durationInFrames: 360,
              render: () => <IntroEditorialScene {...props} />,
            },
            {
              id: 'payoff',
              durationInFrames: 360,
              render: () => <PayoffEditorialScene {...props} />,
            },
          ]}
        />
      </AbsoluteFill>
    </StyleProvider>
  );
};
`;
  }

  if (kit === 'kinetic-typography') {
    return `import React from 'react';
import {
  AbsoluteFill,
  staticFile,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import {
  ContinuousSceneFlow,
  DepthPlane,
  OpticalStage2D,
  ScenicBackdropLayers,
  SmartMusicBed,
  SoundCue,
  StageLightingRig,
  StyleProvider,
  VoiceoverTrack,
} from '@make-pictures/core';
import {
  ImpactKeywordCard,
  WordByWordStage,
} from '@make-pictures/kits/kinetic-typography';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from '../generated/audio-manifest';

${schemaBlock}

const DIALOGUE_SEGMENTS = [
  { sceneId: 'hello-studio-intro', fromFrame: 42, durationInFrames: 180 },
  { sceneId: 'hello-studio-payoff', fromFrame: 402, durationInFrames: 180 },
];

const IntroKineticScene: React.FC<HelloStudioProps> = (props) => (
  <AbsoluteFill>
    <ScenicBackdropLayers seed="hello-studio-kinetic-intro" />
    <StageLightingRig renderBaseFill={false} />
    <OpticalStage2D startFrame={2}>
      <DepthPlane z={0}>
        <WordByWordStage
          sceneId="hello-studio-intro"
          voiceoverManifest={VOICEOVER_MANIFEST}
          fallbackText={\`\${props.headline} — \${props.subheadline}\`}
          eyebrow={props.badgeLabel}
          accentColor={props.accentColor}
          variant="transparent"
          startFrame={2}
        />
      </DepthPlane>
    </OpticalStage2D>
  </AbsoluteFill>
);

const PayoffKeywordScene: React.FC<HelloStudioProps> = (props) => {
  const { width, height } = useVideoConfig();
  const isVertical = height > width;

  return (
    <AbsoluteFill>
      <ScenicBackdropLayers seed="hello-studio-kinetic-payoff" />
      <StageLightingRig renderBaseFill={false} />
      <OpticalStage2D startFrame={2}>
        <DepthPlane z={0}>
          <AbsoluteFill
            style={{
              justifyContent: isVertical ? 'flex-start' : 'center',
              alignItems: isVertical ? 'flex-start' : 'center',
              paddingLeft: isVertical ? 64 : 140,
              paddingRight: isVertical ? 204 : 140,
              paddingTop: isVertical ? 320 : 0,
            }}
          >
            <div style={{ width: '100%', maxWidth: isVertical ? 812 : 980 }}>
              <ImpactKeywordCard
                keyword={props.headline}
                eyebrow={props.badgeLabel}
                sublabel={props.subheadline}
                accentColor={props.accentColor}
                startFrame={2}
              />
            </div>
          </AbsoluteFill>
        </DepthPlane>
      </OpticalStage2D>
    </AbsoluteFill>
  );
};

export const HelloStudio: React.FC<HelloStudioProps> = (props) => {
  const introVo = VOICEOVER_MANIFEST['hello-studio-intro'];
  const payoffVo = VOICEOVER_MANIFEST['hello-studio-payoff'];
  const whooshSfx = SFX_MANIFEST['whoosh-open'];
  const popSfx = SFX_MANIFEST['card-pop'];

  return (
    <StyleProvider style={props.styleId} renderBackdrop>
      <AbsoluteFill>
        ${audioBlock}

        <ContinuousSceneFlow
          crossDissolveFrames={48}
          style={{ backgroundColor: 'transparent' }}
          scenes={[
            {
              id: 'intro',
              durationInFrames: 360,
              render: () => <IntroKineticScene {...props} />,
            },
            {
              id: 'payoff',
              durationInFrames: 360,
              render: () => <PayoffKeywordScene {...props} />,
            },
          ]}
        />
      </AbsoluteFill>
    </StyleProvider>
  );
};
`;
  }

  if (kit === 'data-storytelling') {
    return `import React from 'react';
import {
  AbsoluteFill,
  staticFile,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import {
  ContinuousSceneFlow,
  SmartMusicBed,
  SoundCue,
  StyleProvider,
  VoiceoverTrack,
} from '@make-pictures/core';
import {
  AnimatedBarRace,
  DataStoryStage2D,
  MetricComparisonCard,
  TimelineTrack,
} from '@make-pictures/kits/data-storytelling';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from '../generated/audio-manifest';

${schemaBlock}

const DIALOGUE_SEGMENTS = [
  { sceneId: 'hello-studio-intro', fromFrame: 42, durationInFrames: 180 },
  { sceneId: 'hello-studio-payoff', fromFrame: 402, durationInFrames: 180 },
];

const IntroDataScene: React.FC<HelloStudioProps> = (props) => {
  const { width, height } = useVideoConfig();
  const isVertical = height > width;

  return (
    <DataStoryStage2D renderBaseFill={false}>
      <AbsoluteFill
        style={{
          justifyContent: isVertical ? 'flex-start' : 'center',
          alignItems: isVertical ? 'flex-start' : 'center',
          paddingLeft: isVertical ? 76 : 140,
          paddingRight: isVertical ? 216 : 140,
          paddingTop: isVertical ? 280 : 0,
        }}
      >
        <AnimatedBarRace
          title={props.headline}
          subtitle={props.subheadline}
          valueSuffix=" pkt"
          startFrame={2}
          items={[
            { id: 'clarity', label: 'Czytelność narracji', value: 96, color: props.accentColor },
            { id: 'harmony', label: 'Spójność światła i barwy', value: 91, color: props.secondaryColor },
            { id: 'pacing', label: 'Spokojny rytm ujęć', value: 88 },
          ]}
        />
      </AbsoluteFill>
    </DataStoryStage2D>
  );
};

const PayoffDataScene: React.FC<HelloStudioProps> = (props) => {
  const { width, height } = useVideoConfig();
  const isVertical = height > width;

  return (
    <DataStoryStage2D renderBaseFill={false}>
      <AbsoluteFill
        style={{
          justifyContent: isVertical ? 'flex-start' : 'center',
          alignItems: isVertical ? 'flex-start' : 'center',
          paddingLeft: isVertical ? 76 : 140,
          paddingRight: isVertical ? 216 : 140,
          paddingTop: isVertical ? 280 : 0,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <MetricComparisonCard
            title={props.headline}
            beforeLabel="Statyczny slajd"
            beforeValue={31}
            afterLabel="Żywy obraz"
            afterValue={94}
            unit=" pkt"
            afterColor={props.accentColor}
            startFrame={2}
          />
          <TimelineTrack
            startFrame={24}
            milestones={[
              { id: 'e1', era: '01', label: 'Pomysł', fromFrame: 24 },
              { id: 'e2', era: '02', label: 'Świat sztuki', fromFrame: 120 },
              { id: 'e3', era: '03', label: 'Gotowy film', fromFrame: 216 },
            ]}
          />
        </div>
      </AbsoluteFill>
    </DataStoryStage2D>
  );
};

export const HelloStudio: React.FC<HelloStudioProps> = (props) => {
  const introVo = VOICEOVER_MANIFEST['hello-studio-intro'];
  const payoffVo = VOICEOVER_MANIFEST['hello-studio-payoff'];
  const whooshSfx = SFX_MANIFEST['whoosh-open'];
  const popSfx = SFX_MANIFEST['card-pop'];

  return (
    <StyleProvider style={props.styleId} renderBackdrop>
      <AbsoluteFill>
        ${audioBlock}

        <ContinuousSceneFlow
          crossDissolveFrames={48}
          style={{ backgroundColor: 'transparent' }}
          scenes={[
            {
              id: 'intro',
              durationInFrames: 360,
              render: () => <IntroDataScene {...props} />,
            },
            {
              id: 'payoff',
              durationInFrames: 360,
              render: () => <PayoffDataScene {...props} />,
            },
          ]}
        />
      </AbsoluteFill>
    </StyleProvider>
  );
};
`;
  }

  if (kit === 'motion-diagrams-2d') {
    if (styleId === 'retro-pc') {
      const symbolicUrl = isPl
        ? 'GET https://twoja-strona.pl'
        : 'GET https://example.app';
      const hop1Title = isPl ? 'Przeglądarka' : 'Browser Client';
      const hop1Sub = isPl ? 'Zapytanie użytkownika' : 'Client request';
      const hop2Title = isPl ? 'Katalog tras' : 'Edge Router';
      const hop2Sub = isPl ? 'Wyszukanie ścieżki' : 'Route lookup';
      const hop3Title = isPl ? 'Serwer aplikacji' : 'Origin Server';
      const hop3Sub = isPl ? 'Odpowiedź gotowa' : 'Payload ready';
      const payoffBanner = isPl
        ? '200 OK • Odpowiedź wyświetlona'
        : '200 OK • Response rendered';

      return `import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import {
  ContinuousSceneFlow,
  SmartMusicBed,
  SoundCue,
  StageLightingRig,
  StyleProvider,
  VoiceoverTrack,
} from '@make-pictures/core';
import {
  RetroPcWindowStage2D,
  type RetroPcHopSpec,
} from '@make-pictures/kits/motion-diagrams-2d';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from '../generated/audio-manifest';

${schemaBlock}

const DIALOGUE_SEGMENTS = [
  { sceneId: 'hello-studio-intro', fromFrame: 42, durationInFrames: 180 },
  { sceneId: 'hello-studio-payoff', fromFrame: 402, durationInFrames: 180 },
];

const RETRO_HOPS: ReadonlyArray<RetroPcHopSpec> = [
  {
    id: 'client',
    title: '${hop1Title}',
    subtitle: '${hop1Sub}',
    badge: 'HOP 01',
    latencyMs: 12,
    icon: 'browser',
  },
  {
    id: 'router',
    title: '${hop2Title}',
    subtitle: '${hop2Sub}',
    badge: 'HOP 02',
    latencyMs: 18,
    icon: 'directory',
  },
  {
    id: 'origin',
    title: '${hop3Title}',
    subtitle: '${hop3Sub}',
    badge: 'HOP 03',
    latencyMs: 24,
    icon: 'server',
  },
];

const IntroRetroPcScene: React.FC<HelloStudioProps> = (props) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isVertical = height > width;

  if (frame < 2) return null;

  const progress = interpolate(frame, [16, 300], [0.08, 0.54], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <StageLightingRig renderBaseFill={false} seed="hello-studio-retro-intro" />
      <RetroPcWindowStage2D
        windowTitle={props.headline}
        addressLabel="${symbolicUrl}"
        hops={RETRO_HOPS}
        statusBanner={props.subheadline}
        progress={progress}
        isVertical={isVertical}
        enterFrame={2}
      />
    </AbsoluteFill>
  );
};

const PayoffRetroPcScene: React.FC<HelloStudioProps> = (props) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isVertical = height > width;

  if (frame < 2) return null;

  const progress = interpolate(frame, [10, 290], [0.54, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <StageLightingRig renderBaseFill={false} seed="hello-studio-retro-payoff" />
      <RetroPcWindowStage2D
        windowTitle={props.headline}
        addressLabel="${symbolicUrl}"
        hops={RETRO_HOPS}
        statusBanner="${payoffBanner}"
        progress={progress}
        isVertical={isVertical}
        enterFrame={2}
      />
    </AbsoluteFill>
  );
};

export const HelloStudio: React.FC<HelloStudioProps> = (props) => {
  const introVo = VOICEOVER_MANIFEST['hello-studio-intro'];
  const payoffVo = VOICEOVER_MANIFEST['hello-studio-payoff'];
  const whooshSfx = SFX_MANIFEST['whoosh-open'];
  const popSfx = SFX_MANIFEST['card-pop'];

  return (
    <StyleProvider style={props.styleId} renderBackdrop>
      <AbsoluteFill>
        ${audioBlock}

        <ContinuousSceneFlow
          crossDissolveFrames={48}
          style={{ backgroundColor: 'transparent' }}
          scenes={[
            { id: 'intro', durationInFrames: 360, render: () => <IntroRetroPcScene {...props} /> },
            { id: 'payoff', durationInFrames: 360, render: () => <PayoffRetroPcScene {...props} /> },
          ]}
        />
      </AbsoluteFill>
    </StyleProvider>
  );
};
`;
    }

    return `import React from 'react';
import {
  AbsoluteFill,
  staticFile,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import {
  ContinuousSceneFlow,
  SmartMusicBed,
  SoundCue,
  StyleProvider,
  VoiceoverTrack,
  useStudioStyle,
} from '@make-pictures/core';
import {
  DataFlowEdge,
  MotionDiagramStage2D,
  SystemNode,
  portBottom,
  portLeft,
  portRight,
  portTop,
  type NodeBox,
} from '@make-pictures/kits/motion-diagrams-2d';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from '../generated/audio-manifest';

${schemaBlock}

const DIALOGUE_SEGMENTS = [
  { sceneId: 'hello-studio-intro', fromFrame: 42, durationInFrames: 180 },
  { sceneId: 'hello-studio-payoff', fromFrame: 402, durationInFrames: 180 },
];

const HORIZONTAL_NODES = {
  first: { cx: 560, cy: 540, w: 430, h: 192 },
  second: { cx: 1360, cy: 540, w: 430, h: 192 },
} satisfies Record<string, NodeBox>;

const VERTICAL_NODES = {
  first: { cx: 475, cy: 560, w: 600, h: 184 },
  second: { cx: 475, cy: 940, w: 600, h: 184 },
} satisfies Record<string, NodeBox>;

const IntroDiagramScene: React.FC<HelloStudioProps> = (props) => {
  const { width, height } = useVideoConfig();
  const style = useStudioStyle();
  const isVertical = height > width;
  const nodes = isVertical ? VERTICAL_NODES : HORIZONTAL_NODES;

  return (
    <MotionDiagramStage2D
      renderBaseFill={false}
      nodes={nodes}
      shots={[
        { fromFrame: 0, target: ['first', 'second'], transition: 'cut', padding: isVertical ? 120 : 150 },
        { fromFrame: 168, target: ['first', 'second'], transition: 'glide', padding: isVertical ? 108 : 136 },
      ]}
      handheldIntensity={style.motion.cameraHandheld}
    >
      <DataFlowEdge
        id="intro-flow"
        from={isVertical ? portBottom(nodes.first) : portRight(nodes.first)}
        to={isVertical ? portTop(nodes.second) : portLeft(nodes.second)}
        curveOffsetY={isVertical ? 0 : -64}
        curveOffsetX={isVertical ? 56 : undefined}
        color={props.accentColor}
        secondaryColor={props.secondaryColor}
        drawStartFrame={8}
        flowStartFrame={24}
        flowEndFrame={352}
        label="Światło i rytm"
      />
      <SystemNode
        id="first"
        badge={props.badgeLabel}
        title={props.headline}
        subtitle="Pomysł i narracja sceny"
        statusText="Spokojne otwarcie"
        activeStatusText="Przepływ aktywny"
        x={nodes.first.cx}
        y={nodes.first.cy}
        width={nodes.first.w}
        height={nodes.first.h}
        accentColor={props.accentColor}
        enterFrame={4}
        activeRanges={[[12, 340]]}
      />
      <SystemNode
        id="second"
        title="Kierunek sztuki"
        subtitle={props.subheadline}
        statusText="Oczekiwanie"
        activeStatusText="Kompozycja gotowa"
        x={nodes.second.cx}
        y={nodes.second.cy}
        width={nodes.second.w}
        height={nodes.second.h}
        accentColor={props.secondaryColor}
        enterFrame={22}
        activeRanges={[[96, 352]]}
      />
    </MotionDiagramStage2D>
  );
};

const PayoffDiagramScene: React.FC<HelloStudioProps> = (props) => {
  const { width, height } = useVideoConfig();
  const style = useStudioStyle();
  const isVertical = height > width;
  const nodes = isVertical ? VERTICAL_NODES : HORIZONTAL_NODES;

  return (
    <MotionDiagramStage2D
      renderBaseFill={false}
      nodes={nodes}
      shots={[
        { fromFrame: 0, target: ['first', 'second'], transition: 'cut', padding: isVertical ? 120 : 150 },
        { fromFrame: 174, target: 'second', transition: 'glide', padding: isVertical ? 132 : 172 },
      ]}
      handheldIntensity={style.motion.cameraHandheld}
    >
      <DataFlowEdge
        id="payoff-flow"
        from={isVertical ? portBottom(nodes.first) : portRight(nodes.first)}
        to={isVertical ? portTop(nodes.second) : portLeft(nodes.second)}
        curveOffsetY={isVertical ? 0 : -64}
        curveOffsetX={isVertical ? 56 : undefined}
        color={props.secondaryColor}
        secondaryColor={props.accentColor}
        drawStartFrame={6}
        flowStartFrame={22}
        flowEndFrame={352}
        label="Płynny obraz"
      />
      <SystemNode
        id="first"
        title="Kierunek sztuki"
        subtitle="Spójna paleta i typografia"
        statusText="Zharmonizowany"
        activeStatusText="Prowadzenie ostrości"
        x={nodes.first.cx}
        y={nodes.first.cy}
        width={nodes.first.w}
        height={nodes.first.h}
        accentColor={props.secondaryColor}
        enterFrame={4}
        activeRanges={[[8, 220]]}
      />
      <SystemNode
        id="second"
        title="Gotowy film"
        subtitle={props.subheadline}
        statusText="Przygotowanie"
        activeStatusText="Czysty dźwięk i obraz"
        x={nodes.second.cx}
        y={nodes.second.cy}
        width={nodes.second.w}
        height={nodes.second.h}
        accentColor={props.accentColor}
        enterFrame={22}
        activeRanges={[[64, 352]]}
      />
    </MotionDiagramStage2D>
  );
};

export const HelloStudio: React.FC<HelloStudioProps> = (props) => {
  const introVo = VOICEOVER_MANIFEST['hello-studio-intro'];
  const payoffVo = VOICEOVER_MANIFEST['hello-studio-payoff'];
  const whooshSfx = SFX_MANIFEST['whoosh-open'];
  const popSfx = SFX_MANIFEST['card-pop'];

  return (
    <StyleProvider style={props.styleId} renderBackdrop>
      <AbsoluteFill>
        ${audioBlock}

        <ContinuousSceneFlow
          crossDissolveFrames={48}
          style={{ backgroundColor: 'transparent' }}
          scenes={[
            { id: 'intro', durationInFrames: 360, render: () => <IntroDiagramScene {...props} /> },
            { id: 'payoff', durationInFrames: 360, render: () => <PayoffDiagramScene {...props} /> },
          ]}
        />
      </AbsoluteFill>
    </StyleProvider>
  );
};
`;
  }

  if (kit === 'isometric-3d') {
    return `import { ThreeCanvas } from '@remotion/three';
import React from 'react';
import {
  AbsoluteFill,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import {
  CINEMATIC_SPRINGS,
  ClippedSurfaceChrome,
  ContinuousSceneFlow,
  DirectorCamera3D,
  SmartMusicBed,
  SoundCue,
  StyleProvider,
  VoiceoverTrack,
  formatFontFamilyCss,
  formatHeadingText,
  getTactileSurfaceStyle,
  useStudioStyle,
} from '@make-pictures/core';
import {
  ClayCharacter3D,
  PodcastStudioSet3D,
  StudioHdrRig3D,
  computePodcastStudioLayout,
} from '@make-pictures/kits/isometric-3d';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from '../generated/audio-manifest';

${schemaBlock}

const DIALOGUE_SEGMENTS = [
  { sceneId: 'hello-studio-intro', fromFrame: 42, durationInFrames: 180 },
  { sceneId: 'hello-studio-payoff', fromFrame: 402, durationInFrames: 180 },
];

const HelloPodcastStudioTurn: React.FC<HelloStudioProps & { activeSpeaker: 'A' | 'B' }> = (props) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const isVertical = height > width;

  if (frame < 2) return null;

  const stageReveal = spring({ frame: frame - 2, fps, config: CINEMATIC_SPRINGS.entrance });
  const layout = computePodcastStudioLayout({ compactVertical: isVertical });
  const speakerAWeight = props.activeSpeaker === 'A' ? 1 : 0;
  const speakerBWeight = props.activeSpeaker === 'B' ? 1 : 0;
  const cadencePulse =
    0.42 + 0.28 * Math.sin(frame * 0.044) + 0.16 * Math.cos(frame * 0.034);
  const activeAccent =
    props.activeSpeaker === 'A' ? props.accentColor : props.secondaryColor;

  return (
    <AbsoluteFill style={{ opacity: stageReveal }}>
      <ThreeCanvas width={width} height={height} shadows camera={{ position: [0, 3.6, 7.6], fov: 35 }}>
        <DirectorCamera3D
          safeBox9x16Compensation
          handheldIntensity={style.motion.cameraHandheld}
          anchors={{
            leftHost: { position: layout.leftHostPosition, height: 2.15 },
            rightHost: { position: layout.rightHostPosition, height: 2.15 },
          }}
          shots={
            props.activeSpeaker === 'A'
              ? [
                  { fromFrame: 0, shot: 'medium-two-shot', target: 'leftHost', secondaryTarget: 'rightHost', transition: 'cut' },
                  { fromFrame: 180, shot: 'medium-two-shot', target: 'leftHost', secondaryTarget: 'rightHost', angleDeg: 7, transition: 'glide' },
                ]
              : [
                  { fromFrame: 0, shot: 'medium-two-shot', target: 'rightHost', secondaryTarget: 'leftHost', angleDeg: -6, transition: 'cut' },
                  { fromFrame: 168, shot: 'medium', target: 'rightHost', secondaryTarget: 'leftHost', transition: 'glide' },
                ]
          }
        />
        <StudioHdrRig3D />
        <PodcastStudioSet3D
          compactVertical={isVertical}
          onAirActive
          accentColor={props.accentColor}
          enterFrame={2}
        >
          <ClayCharacter3D
            position={layout.leftHostPosition}
            rotationY={layout.leftHostRotationY}
            seated
            accessory="headphones"
            sweaterColor={props.accentColor}
            accentColor={props.secondaryColor}
            eyeColor="#059669"
            pose={props.activeSpeaker === 'A' ? 'talking' : 'listening'}
            speakingWeight={speakerAWeight}
            speechEnergy={cadencePulse * speakerAWeight}
            seed="host-left"
            enterFrame={4}
          />
          <ClayCharacter3D
            position={layout.rightHostPosition}
            rotationY={layout.rightHostRotationY}
            seated
            accessory="glasses"
            sweaterColor={props.secondaryColor}
            accentColor={props.accentColor}
            eyeColor="#B45309"
            pose={props.activeSpeaker === 'B' ? 'talking' : 'listening'}
            speakingWeight={speakerBWeight}
            speechEnergy={cadencePulse * speakerBWeight}
            seed="host-right"
            enterFrame={8}
          />
        </PodcastStudioSet3D>
      </ThreeCanvas>

      <div
        style={getTactileSurfaceStyle(style, {
          elevation: 'resting',
          overrides: {
            position: 'absolute',
            left: isVertical ? 76 : 72,
            top: isVertical ? 248 : 56,
            width: isVertical ? 788 : 540,
            padding: '16px 22px',
            borderRadius: Math.max(0, Math.round(10 * style.surface.radiusScale)),
            boxSizing: 'border-box',
            pointerEvents: 'none',
          },
        })}
      >
        <ClippedSurfaceChrome
          topBarHeight={3}
          topBarColor={activeAccent}
          specularRim={!style.surface.isDark}
        />
        <div
          style={{
            position: 'relative',
            fontFamily: formatFontFamilyCss(style.typography.monoFont, 'mono'),
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: activeAccent,
            marginBottom: 4,
          }}
        >
          {props.badgeLabel}
        </div>
        <div
          style={{
            position: 'relative',
            fontFamily: formatFontFamilyCss(style.typography.displayFont, 'display'),
            fontSize: isVertical ? 26 : 28,
            fontWeight: 700,
            color: style.palette.textPrimary,
            lineHeight: 1.18,
          }}
        >
          {formatHeadingText(
            props.activeSpeaker === 'A' ? props.headline : props.subheadline,
            style
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const HelloStudio: React.FC<HelloStudioProps> = (props) => {
  const introVo = VOICEOVER_MANIFEST['hello-studio-intro'];
  const payoffVo = VOICEOVER_MANIFEST['hello-studio-payoff'];
  const whooshSfx = SFX_MANIFEST['whoosh-open'];
  const popSfx = SFX_MANIFEST['card-pop'];

  return (
    <StyleProvider style={props.styleId} renderBackdrop>
      <AbsoluteFill>
        ${audioBlock}

        <ContinuousSceneFlow
          crossDissolveFrames={48}
          style={{ backgroundColor: 'transparent' }}
          scenes={[
            { id: 'intro', durationInFrames: 360, usesThree: true, render: () => <HelloPodcastStudioTurn {...props} activeSpeaker="A" /> },
            { id: 'payoff', durationInFrames: 360, usesThree: true, render: () => <HelloPodcastStudioTurn {...props} activeSpeaker="B" /> },
          ]}
        />
      </AbsoluteFill>
    </StyleProvider>
  );
};
`;
  }

  if (kit === 'paper-diorama-3d') {
    return `import { ThreeCanvas } from '@remotion/three';
import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import {
  CINEMATIC_SPRINGS,
  ContinuousSceneFlow,
  SmartMusicBed,
  SoundCue,
  StyleProvider,
  VoiceoverTrack,
  useStudioStyle,
} from '@make-pictures/core';
import {
  AtelierDeskCutout3D,
  CloudCanopyCutout3D,
  DioramaStage3D,
  MountainRangeCutout3D,
  PaperCameraRig3D,
  PaperStageLighting3D,
  PineGroveCutout3D,
  PopUpHinge3D,
  SunburstArchCutout3D,
} from '@make-pictures/kits/paper-diorama-3d';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from '../generated/audio-manifest';

${schemaBlock}

const DIALOGUE_SEGMENTS = [
  { sceneId: 'hello-studio-intro', fromFrame: 42, durationInFrames: 180 },
  { sceneId: 'hello-studio-payoff', fromFrame: 402, durationInFrames: 180 },
];

const HelloDioramaLandscape: React.FC<HelloStudioProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const isVertical = height > width;

  if (frame < 2) return null;

  const stageReveal = spring({ frame: frame - 2, fps, config: CINEMATIC_SPRINGS.entrance });
  const archFold = spring({ frame: frame - 4, fps, config: CINEMATIC_SPRINGS.entrance });
  const mountainFold = spring({ frame: frame - 14, fps, config: CINEMATIC_SPRINGS.entrance });
  const groveFold = spring({ frame: frame - 24, fps, config: CINEMATIC_SPRINGS.emphasis });

  const cloudDrift = Math.sin(frame * 0.034) * 0.22;
  const camDriftX = Math.sin(frame * 0.032) * 0.24;
  const camZ = interpolate(frame, [0, 360], isVertical ? [13.2, 12.0] : [9.6, 8.6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ opacity: stageReveal }}>
      <ThreeCanvas width={width} height={height} shadows camera={{ position: [0, 3.1, camZ], fov: 36 }}>
        <PaperCameraRig3D cameraPos={[camDriftX, isVertical ? 3.15 : 2.95, camZ]} lookAt={[0, isVertical ? 1.55 : 1.35, -0.4]} fov={36} />
        <PaperStageLighting3D preset={style.surface.isDark ? 'spotlight' : 'golden-hour'} />
        <DioramaStage3D variant="minimal-plinth" surfacePattern="spotlight" accentColor={props.accentColor}>
          <PopUpHinge3D foldProgress={archFold} position={[0, 0, -2.2]}>
            <SunburstArchCutout3D accentColor={props.accentColor} secondaryColor={props.secondaryColor} />
          </PopUpHinge3D>
          <PopUpHinge3D foldProgress={mountainFold} position={[0, 0, -1.25]}>
            <MountainRangeCutout3D accentColor={props.accentColor} secondaryColor={props.secondaryColor} />
          </PopUpHinge3D>
          <CloudCanopyCutout3D position={[-1.55 + cloudDrift, 2.35, -0.65]} anchor="center" width={2.8} height={1.1} seed="cloud-left" />
          <CloudCanopyCutout3D position={[1.65 - cloudDrift * 0.7, 2.55, -0.15]} anchor="center" width={2.5} height={1.0} seed="cloud-right" />
          <PopUpHinge3D foldProgress={groveFold} position={[-2.05, 0, 0.45]}>
            <PineGroveCutout3D accentColor={props.accentColor} secondaryColor={props.secondaryColor} seed="grove-left" />
          </PopUpHinge3D>
          <PopUpHinge3D foldProgress={groveFold} position={[2.05, 0, 0.95]}>
            <PineGroveCutout3D accentColor={props.accentColor} secondaryColor={props.secondaryColor} seed="grove-right" />
          </PopUpHinge3D>
        </DioramaStage3D>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

const HelloDioramaAtelier: React.FC<HelloStudioProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const isVertical = height > width;

  if (frame < 2) return null;

  const stageReveal = spring({ frame: frame - 2, fps, config: CINEMATIC_SPRINGS.entrance });
  const deskFold = spring({ frame: frame - 8, fps, config: CINEMATIC_SPRINGS.entrance });
  const cloudDrift = Math.sin(frame * 0.036) * 0.18;
  const camDriftX = Math.cos(frame * 0.032) * 0.18;
  const camZ = interpolate(frame, [0, 360], isVertical ? [12.4, 11.4] : [8.8, 7.9], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ opacity: stageReveal }}>
      <ThreeCanvas width={width} height={height} shadows camera={{ position: [0, 2.85, camZ], fov: 35 }}>
        <PaperCameraRig3D cameraPos={[camDriftX, isVertical ? 2.95 : 2.75, camZ]} lookAt={[0, isVertical ? 1.35 : 1.15, 0.1]} fov={35} />
        <PaperStageLighting3D preset={style.surface.isDark ? 'spotlight' : 'golden-hour'} />
        <DioramaStage3D variant="minimal-plinth" surfacePattern="spotlight" accentColor={props.accentColor}>
          <SunburstArchCutout3D position={[0, 0, -2.15]} accentColor={props.accentColor} secondaryColor={props.secondaryColor} />
          <MountainRangeCutout3D position={[0, 0, -1.25]} accentColor={props.accentColor} secondaryColor={props.secondaryColor} />
          <CloudCanopyCutout3D position={[-1.4 + cloudDrift, 2.4, -0.65]} anchor="center" width={2.6} height={1.05} seed="atelier-cloud" />
          <PineGroveCutout3D position={[-2.15, 0, -0.05]} accentColor={props.accentColor} secondaryColor={props.secondaryColor} seed="atelier-grove-l" />
          <PineGroveCutout3D position={[2.15, 0, 0.45]} accentColor={props.accentColor} secondaryColor={props.secondaryColor} seed="atelier-grove-r" />
          <PopUpHinge3D foldProgress={deskFold} position={[0, 0, 1.0]}>
            <AtelierDeskCutout3D plaqueTitle={props.headline} accentColor={props.accentColor} secondaryColor={props.secondaryColor} />
          </PopUpHinge3D>
        </DioramaStage3D>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

export const HelloStudio: React.FC<HelloStudioProps> = (props) => {
  const introVo = VOICEOVER_MANIFEST['hello-studio-intro'];
  const payoffVo = VOICEOVER_MANIFEST['hello-studio-payoff'];
  const whooshSfx = SFX_MANIFEST['whoosh-open'];
  const popSfx = SFX_MANIFEST['card-pop'];

  return (
    <StyleProvider style={props.styleId} renderBackdrop>
      <AbsoluteFill>
        ${audioBlock}

        <ContinuousSceneFlow
          crossDissolveFrames={48}
          style={{ backgroundColor: 'transparent' }}
          scenes={[
            { id: 'intro', durationInFrames: 360, usesThree: true, render: () => <HelloDioramaLandscape {...props} /> },
            { id: 'payoff', durationInFrames: 360, usesThree: true, render: () => <HelloDioramaAtelier {...props} /> },
          ]}
        />
      </AbsoluteFill>
    </StyleProvider>
  );
};
`;
  }

  return `import React from 'react';
import {
  AbsoluteFill,
  staticFile,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import {
  ContinuousSceneFlow,
  SmartMusicBed,
  SoundCue,
  StyleProvider,
  VoiceoverTrack,
} from '@make-pictures/core';
import {
  AnnotatedCallout2D,
  ComparisonSplit2D,
  StoryCard2D,
  VectorSceneStage2D,
} from '@make-pictures/kits/vector-scene-2d';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from '../generated/audio-manifest';

${schemaBlock}

const DIALOGUE_SEGMENTS = [
  { sceneId: 'hello-studio-intro', fromFrame: 42, durationInFrames: 180 },
  { sceneId: 'hello-studio-payoff', fromFrame: 402, durationInFrames: 180 },
];

const IntroVectorScene: React.FC<HelloStudioProps> = (props) => {
  const { width, height } = useVideoConfig();
  const isVertical = height > width;

  return (
    <VectorSceneStage2D
      renderBaseFill={false}
      foregroundCallouts={
        <AnnotatedCallout2D
          target={isVertical ? [360, 650] : [960, 560]}
          labelPosition={isVertical ? [590, 860] : [1180, 790]}
          label="Punkt skupienia"
          startFrame={24}
          accentColor={props.secondaryColor}
        />
      }
    >
      <AbsoluteFill
        style={{
          justifyContent: isVertical ? 'flex-start' : 'center',
          alignItems: isVertical ? 'flex-start' : 'center',
          paddingLeft: isVertical ? 76 : 160,
          paddingRight: isVertical ? 216 : 160,
          paddingTop: isVertical ? 280 : 0,
        }}
      >
        <div style={{ width: '100%', maxWidth: isVertical ? 788 : 980 }}>
          <StoryCard2D
            title={props.headline}
            subtitle={props.subheadline}
            accentColor={props.accentColor}
            startFrame={2}
          />
        </div>
      </AbsoluteFill>
    </VectorSceneStage2D>
  );
};

const PayoffVectorScene: React.FC<HelloStudioProps> = (props) => (
  <VectorSceneStage2D renderBaseFill={false}>
    <ComparisonSplit2D
      startFrame={2}
      focusShiftFrame={150}
      left={{
        tag: 'Punkt wyjścia',
        title: props.headline,
        detail: props.subheadline,
      }}
      right={{
        tag: 'Kierunek sztuki',
        title: props.styleId,
        detail: 'Spójne światło, faktura i płynny ruch',
      }}
    />
  </VectorSceneStage2D>
);

export const HelloStudio: React.FC<HelloStudioProps> = (props) => {
  const introVo = VOICEOVER_MANIFEST['hello-studio-intro'];
  const payoffVo = VOICEOVER_MANIFEST['hello-studio-payoff'];
  const whooshSfx = SFX_MANIFEST['whoosh-open'];
  const popSfx = SFX_MANIFEST['card-pop'];

  return (
    <StyleProvider style={props.styleId} renderBackdrop>
      <AbsoluteFill>
        ${audioBlock}

        <ContinuousSceneFlow
          crossDissolveFrames={48}
          style={{ backgroundColor: 'transparent' }}
          scenes={[
            { id: 'intro', durationInFrames: 360, render: () => <IntroVectorScene {...props} /> },
            { id: 'payoff', durationInFrames: 360, render: () => <PayoffVectorScene {...props} /> },
          ]}
        />
      </AbsoluteFill>
    </StyleProvider>
  );
};
`;
}

function buildHelloStudioIndexTs(kit: StarterKitId): string {
  const usesThree = kit === 'paper-diorama-3d' || kit === 'isometric-3d';
  return `import { defineProduction, type ProductionManifest } from '@make-pictures/core';
import productionJson from './production.json';
import {
  HelloStudio,
  HelloStudioSchema,
} from './compositions/HelloStudio';
import defaultProps from './compositions/HelloStudio.props.json';
import { VOICEOVER_MANIFEST } from './generated/audio-manifest';

const manifest = productionJson as ProductionManifest;

export default defineProduction({
  id: 'hello-studio',
  title: 'Hello Studio',
  origin: 'production',
  manifest,
  voiceoverManifest: VOICEOVER_MANIFEST,
  compositions: [
    {
      id: 'HelloStudio',
      title: 'Hello Studio',
      subtitle: '60 FPS Capsule • ${kit}',
      group: 'Productions (Hello Studio)',
      kit: '${kit}',
      fps: 60,
      width: 1920,
      height: 1080,
      durationInFrames: 720,
      usesThree: ${usesThree},
      propsFile: 'productions/hello-studio/compositions/HelloStudio.props.json',
      sceneTimeline: [
        {
          sceneId: 'hello-studio-intro',
          fromFrame: 42,
          durationInFrames: 180,
          label: '1. Intro',
        },
        {
          sceneId: 'hello-studio-payoff',
          fromFrame: 402,
          durationInFrames: 180,
          label: '2. Payoff',
        },
      ],
      sfxTimeline: [
        { sfxId: 'whoosh-open', fromFrame: 38, label: 'Opening Whoosh' },
        { sfxId: 'card-pop', fromFrame: 398, label: 'Card Pop' },
      ],
      cameraTimeline: [
        { shotLabel: 'Establishing Wide', fromFrame: 0, durationInFrames: 360 },
        { shotLabel: 'Medium Focus', fromFrame: 360, durationInFrames: 360 },
      ],
      hasMusicScore: true,
      component: HelloStudio,
      schema: HelloStudioSchema,
      defaultProps,
    },
  ],
});
`;
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

const EMBEDDED_CLAUDE_MD = `# CLAUDE.md — Claude Code Instructions for \`make.pictures\` Studio

Read [\`AGENTS.md\`](./AGENTS.md) alongside this file for universal \`60 FPS\` Video-as-Code invariants, and load domain skills progressively from [\`.claude/skills/\`](./.claude/skills/) (mirrored from \`.agents/plugins/make-pictures/skills/\`).

## Capsule Architecture & Determinism
- **Isolated Capsules (\`productions/<slug>/\`):** Keep every film self-contained (\`production.json\`, \`compositions/\`, \`assets/\`, \`generated/audio-manifest.ts\`). In embedded SaaS repos (\`--dir=videos\`), capsules live in \`videos/productions/<slug>/\`.
- **Art Direction (\`styles/*.style.json\`):** Match every film's topic along the \`2D / 2.5D / 3D\` dimensional spaces to one of the 7 visual kits and either one of the **10 built-in styles** or a custom \`styles/<slug>.style.json\` preset wrapped in \`<StyleProvider style={props.styleId} renderBackdrop>\`. Compose calm scenes \`>= 4.5s\` (\`>= 270f\`) connected via \`<ContinuousSceneFlow>\`.
- **60 FPS Determinism:** Frame \`0\` must render a clean empty background (start entrance springs at \`frame - 2\`). Never use \`Math.random()\` or cross-frame \`useRef\` state — use \`SPRING_PRESETS\` and \`createSeededRandom(seed)\` from \`@make-pictures/core\`.
- **Audio Tag Pool Hygiene:** Use \`<VoiceoverTrack />\` and \`<SoundCue />\` from \`@make-pictures/core\`; never wrap raw \`<Audio />\` inside \`<Sequence>\` without an explicit finite \`durationInFrames\`.
- **Props Inspector (\`zod\` ↔ \`*.props.json\`):** Always read \`<CompositionId>.props.json\` from disk before editing so live tweaks from Studio Web are preserved. Never open or print \`.env.local\`.

## CLI Commands (\`npx make-pictures\`)
- \`npx make-pictures onboard\` / \`npx make-pictures doctor\` — Verify Node.js, FFmpeg, and ElevenLabs OAuth (\`.env.local\`).
- \`npx make-pictures init --dir=videos\` — Initialize capsules + AI skills inside an existing app repo.
- \`npx make-pictures styles [--space=2d|2.5d|3d]\` / \`npx make-pictures style new <slug> --from=editorial-press\` — List all 10 built-in styles or create reusable Art Direction presets.
- \`npx make-pictures new <slug> --space=2d|2.5d|3d --lang=en\` (or \`--kit=vector-scene-2d --style=minimal-product\`) — Scaffold a new \`60 FPS\` production capsule.
- \`npx make-pictures audio --production=<slug> [--mock]\` — Synthesize ElevenLabs TTS + word timestamps + AI Music + AI SFX.
- \`npx make-pictures image "<prompt>" --style=<styleId> --out=...\` / \`npx make-pictures cutout <file> --out=...\` — Generate style-anchored illustrations (zero raster text) or extract lossless PDF \`/SMask\` / Exterior Border Flood-Fill cutouts with dark checkerboard QA.
- \`npx make-pictures studio [--port=3000] [--dir=.]\` — Launch local \`60 FPS\` Studio Web workstation (\`http://127.0.0.1:3000\`, including 🎨 Style Lab).
- \`npx make-pictures qa <CompositionId>\` — Run Hard Director QA Gate (\`>= 4.5s\` scenes, breathing margins, \`>= 18px\` font floor) + render Auto-Grid Contact-Sheet PNG (\`out/qa-<CompositionId>.png\`, covering 100% of scenes & sub-views) and inspect via \`Read\` (\`9:16\` Golden Safe Box \`x ∈ [40, 910], y ∈ [220, 1380]\`).
- \`npm run typecheck\` && \`npx make-pictures render <CompositionId>\` — Typecheck and render \`60 FPS\` MP4 mastered to \`-14 LUFS\`.

## Auto-Discovered Skills (\`.claude/skills/<skill>/SKILL.md\`)
1. \`make-pictures-director\` — 6-step production workflow, \`production.json\`, \`computeSceneTimingFromVoiceover\`, \`ContinuousSceneFlow\` + \`SceneSubViewDissolve\`, and Auto-Grid QA gates.
2. \`style-and-art-direction\` — Art Direction gate, 10 built-in styles (\`2D / 2.5D / 3D\`), \`TYPOGRAPHY_FLOOR_1080P\` (\`>= 18px\`), \`StyleProvider\`, \`Style Lab\`, and \`styles/*.style.json\`.
3. \`kit-editorial-and-vector\` — Universal 2D narrative kits: \`editorial-collage\` (\`EditorialPanoramaTrack\`) & \`vector-scene-2d\` (\`HorizontalFeatureGrid2x2\`, \`PinnedMediaStage\`).
4. \`kit-paper-diorama-3d\` — 2.5D pop-up stage (\`DioramaStage3D\`, \`PaperCutout3D\`, \`ImageCutout3D\` + \`cutout\`, \`PopUpHinge3D\`, \`Δz\` layering).
5. \`kit-motion-diagrams-2d\` — 2D infinite-canvas diagrams (\`RetroPcWindowStage2D\`, \`NodeBox\` ports, \`DataFlowEdge\` \`packetCount={0}\`, \`buildCubicBezierPath\`), plus SaaS \`.mp4\` screencasts via \`@make-pictures/kits/product-frames\` (\`BrowserFrame\`, \`PhoneFrame\`, \`ScreenSpotlightOverlay\`, \`PinnedMediaStage\`).
6. \`kit-isometric-3d\` — 3D Soft-Clay & spatial studio dialogue (\`StudioHdrRig3D\`, \`PodcastStudioSet3D\`, \`ClayCharacter3D\`, \`IsometricStage3D\`).
7. \`kit-kinetic-and-data\` — Kinetic typography & data charts (\`WordByWordStage\`, \`AnimatedBarRace\`, \`TimelineTrack\`).
8. \`sound-and-music-design\` — ElevenLabs voices, PL/EN phonetics, \`SmartMusicBed\` auto-ducking, \`SoundCue\`, \`-14 LUFS\`.
9. \`cinematography-and-vfx\` — Shot DSL (\`DirectorCamera3D/2D\`), \`9:16\` Safe Box, \`ContinuousSceneFlow\`, \`OpticalCrossDissolve\`, deterministic particles.
`;

function writeAiPluginAndAgentsMd(targetRoot: string): void {
  const modDir = getModuleDir();
  const candidates = [
    path.resolve(modDir, '..', 'assets', 'plugin'),
    path.resolve(modDir, '..', '..', 'cli', 'assets', 'plugin'),
    path.resolve(modDir, '..', '..', '..', 'plugins', 'make-pictures'),
    path.resolve(
      modDir,
      '..',
      '..',
      '@make-pictures',
      'cli',
      'assets',
      'plugin'
    ),
  ];

  const pluginDestDir = path.join(
    targetRoot,
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
      `${JSON.stringify(EMBEDDED_PLUGIN_JSON, null, 2)}\n`,
      'utf8'
    );
    fs.writeFileSync(
      path.join(pluginDestDir, '.claude-plugin', 'plugin.json'),
      `${JSON.stringify(
        {
          name: 'make-pictures',
          description: EMBEDDED_PLUGIN_JSON.description,
          version: '2.4.0',
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    fs.writeFileSync(
      path.join(pluginDestDir, 'rules', 'AGENTS.md'),
      EMBEDDED_AGENTS_MD,
      'utf8'
    );
    fs.writeFileSync(
      path.join(pluginDestDir, 'rules', 'CLAUDE.md'),
      EMBEDDED_CLAUDE_MD,
      'utf8'
    );
  }

  const rulesAgentsPath = path.join(pluginDestDir, 'rules', 'AGENTS.md');
  const agentsContent = fs.existsSync(rulesAgentsPath)
    ? fs.readFileSync(rulesAgentsPath, 'utf8')
    : EMBEDDED_AGENTS_MD;
  fs.writeFileSync(path.join(targetRoot, 'AGENTS.md'), agentsContent, 'utf8');

  const rulesClaudePath = path.join(pluginDestDir, 'rules', 'CLAUDE.md');
  const claudeContent = fs.existsSync(rulesClaudePath)
    ? fs.readFileSync(rulesClaudePath, 'utf8')
    : EMBEDDED_CLAUDE_MD;
  fs.writeFileSync(path.join(targetRoot, 'CLAUDE.md'), claudeContent, 'utf8');

  const pluginSkillsDir = path.join(pluginDestDir, 'skills');
  if (fs.existsSync(pluginSkillsDir)) {
    const claudeDir = path.join(targetRoot, '.claude');
    const claudeSkillsPath = path.join(claudeDir, 'skills');
    fs.mkdirSync(claudeDir, { recursive: true });
    try {
      fs.rmSync(claudeSkillsPath, { recursive: true, force: true });
    } catch {
      // Ignore if absent
    }
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
}

function buildStarterReadme(projectName: string): string {
  return `<p align="center">
  <a href="https://make.pictures"><img src="https://make.pictures/brand/make-pictures-logo.svg" alt="make.pictures" width="360" /></a>
</p>

<p align="center">
  <a href="https://make.pictures"><img src="https://img.shields.io/badge/make.pictures-Studio-FF2A85?style=for-the-badge&labelColor=0F172A" alt="make.pictures Studio" /></a>
  <img src="https://img.shields.io/badge/Render-60_FPS-2563EB?style=for-the-badge&labelColor=0F172A" alt="Render: 60 FPS" />
</p>

# ${projectName}

60 FPS Video-as-Code Studio project powered by **[make.pictures](https://make.pictures)**.

## Quickstart

\`\`\`bash
# 1. Connect your ElevenLabs API key (.env.local) via browser OAuth
npm run onboard

# 2. Launch the 60 FPS Studio Web workstation (http://127.0.0.1:3000)
npm run studio

# 3. Synthesize voiceovers, word timestamps, AI music & SFX
npm run audio -- --production=hello-studio

# 4. Run Hard Director QA Gate + Auto-Grid Contact-Sheet QA image
npm run qa -- HelloStudio

# 5. Render 60 FPS MP4 mastered to -14 LUFS
npm run render -- HelloStudio
\`\`\`
`;
}

/**
 * Scaffolds a standalone `make.pictures` Studio repository in `options.targetDir`.
 */
export async function createMakePicturesApp(
  options: CreateMakePicturesOptions
): Promise<{ targetDir: string; projectName: string }> {
  const targetDir = path.resolve(options.targetDir);
  const projectName = toPackageSlug(path.basename(targetDir));

  if (options.space !== undefined) {
    const normalizedSpace = String(options.space).trim().toLowerCase();
    if (!VALID_SPACES.has(normalizedSpace as StarterSpace)) {
      throw new Error(
        `Invalid --space value "${String(options.space)}". Expected one of: 2d, 2.5d, 3d.`
      );
    }
  }

  if (options.kit !== undefined) {
    if (!VALID_KITS.has(options.kit)) {
      throw new Error(
        `Unknown visual kit "${String(options.kit)}". Supported kits: ${Array.from(VALID_KITS).join(', ')}`
      );
    }
  }

  const normalizedSpace = options.space
    ? (String(options.space).trim().toLowerCase() as StarterSpace)
    : undefined;
  const spaceDefaults = normalizedSpace
    ? defaultStarterKitAndStyleForSpace(normalizedSpace)
    : undefined;
  const kit: StarterKitId =
    options.kit ?? spaceDefaults?.kit ?? 'vector-scene-2d';
  const requestedStyle = options.style?.trim();
  const resolvedStyleId =
    requestedStyle ||
    spaceDefaults?.styleId ||
    defaultStarterStyleForKit(kit);
  const styleMeta =
    STARTER_STYLE_METADATA[resolvedStyleId] ??
    STARTER_STYLE_METADATA[defaultStarterStyleForKit(kit)] ??
    STARTER_STYLE_METADATA['minimal-product']!;
  const lang: 'pl' | 'en' = options.lang ?? 'en';
  const isPl = lang === 'pl';

  if (fs.existsSync(targetDir) && !options.force) {
    if (!isEffectivelyEmptyDir(targetDir)) {
      throw new Error(
        `Target directory "${targetDir}" is not empty. Choose a new directory or pass --force.`
      );
    }
  }

  fs.mkdirSync(path.join(targetDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'styles'), { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'public', '_productions'), {
    recursive: true,
  });

  // 1. Root project config files
  fs.writeFileSync(
    path.join(targetDir, 'styles', 'README.md'),
    STYLES_README_MD,
    'utf8'
  );
  fs.writeFileSync(
    path.join(targetDir, 'package.json'),
    `${JSON.stringify(buildPackageJson(projectName), null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(targetDir, 'tsconfig.json'),
    `${JSON.stringify(buildTsconfigJson(), null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(targetDir, 'remotion.config.ts'),
    REMOTION_CONFIG_TS,
    'utf8'
  );
  fs.writeFileSync(path.join(targetDir, 'src', 'index.ts'), SRC_INDEX_TS, 'utf8');
  writeMergedGitignore(path.join(targetDir, '.gitignore'), GITIGNORE_CONTENT);
  fs.writeFileSync(
    path.join(targetDir, '.env.example'),
    buildEnvExampleContent(lang),
    'utf8'
  );
  fs.writeFileSync(
    path.join(targetDir, 'README.md'),
    buildStarterReadme(projectName),
    'utf8'
  );

  // 2. Starter capsule: productions/hello-studio/
  const prodDir = path.join(targetDir, 'productions', 'hello-studio');
  fs.mkdirSync(path.join(prodDir, 'compositions'), { recursive: true });
  fs.mkdirSync(path.join(prodDir, 'assets', 'voiceovers'), { recursive: true });
  fs.mkdirSync(path.join(prodDir, 'assets', 'music'), { recursive: true });
  fs.mkdirSync(path.join(prodDir, 'assets', 'sfx'), { recursive: true });
  fs.mkdirSync(path.join(prodDir, 'assets', 'videos'), { recursive: true });
  fs.mkdirSync(path.join(prodDir, 'generated'), { recursive: true });

  const mood =
    requestedStyle && STARTER_STYLE_METADATA[requestedStyle]
      ? styleMeta.mood
      : normalizedSpace
        ? styleMeta.mood
        : moodForKit(kit);
  const voiceId = isPl ? styleMeta.voiceIdPl : styleMeta.voiceId;
  const introText = isPl
    ? 'Hello Studio otwiera spokojną opowieść pełną światła i ruchu.'
    : 'Hello Studio opens a calm visual story shaped by light.';
  const payoffText = isPl
    ? 'Muzyka miękko ustępuje narracji, zostawiając przestrzeń na każdy obraz.'
    : 'Warm music yields gently to narration, giving every image room to breathe.';

  const productionManifest = {
    id: 'hello-studio',
    title: 'Hello Studio',
    fps: 60,
    lang,
    scenes: [
      {
        id: 'hello-studio-intro',
        title: isPl ? 'Scena 1 — Wprowadzenie' : 'Scene 1 — Opening Scene',
        component: 'HelloStudio',
        durationInSeconds: 3.0,
        durationInFrames: 180,
        voiceId,
        speaker: 'Narrator',
        voiceEffect: 'clean',
        text: introText,
      },
      {
        id: 'hello-studio-payoff',
        title: isPl ? 'Scena 2 — Rozwinięcie' : 'Scene 2 — Core Insight',
        component: 'HelloStudio',
        durationInSeconds: 3.0,
        durationInFrames: 180,
        voiceId,
        speaker: kit === 'isometric-3d' ? 'Partner' : 'Narrator',
        voiceEffect: 'clean',
        text: payoffText,
      },
    ],
    score: {
      id: 'main-score',
      mode: 'prompt',
      prompt: `Clean modern instrumental ${mood} background score for Hello Studio, warm studio mix, no vocals`,
      moodPreset: mood,
      forceInstrumental: true,
      durationSeconds: 12,
      baseVolume: 0.25,
      duckedVolume: 0.085,
    },
    sfx: [
      {
        id: 'whoosh-open',
        prompt: 'Soft airy cinematic whoosh transition',
        durationSeconds: 0.45,
        fallbackPreset: 'whoosh',
      },
      {
        id: 'card-pop',
        prompt: 'Subtle crisp tactile card pop',
        durationSeconds: 0.2,
        fallbackPreset: 'pop',
      },
    ],
  };

  fs.writeFileSync(
    path.join(prodDir, 'production.json'),
    `${JSON.stringify(productionManifest, null, 2)}\n`,
    'utf8'
  );

  const defaultProps = {
    styleId: resolvedStyleId,
    headline: 'Hello Studio',
    subheadline: isPl
      ? 'Spokojna opowieść w świetle i ruchu'
      : 'Calm visual storytelling in light and motion',
    badgeLabel: isPl ? 'Rozdział 01' : 'Chapter 01',
    accentColor: styleMeta.accentPrimary,
    secondaryColor: styleMeta.accentSecondary,
    voiceoverVolume: 1.0,
    musicVolume: 0.25,
    sfxVolume: 0.22,
  };

  fs.writeFileSync(
    path.join(prodDir, 'compositions', 'HelloStudio.props.json'),
    `${JSON.stringify(defaultProps, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(prodDir, 'compositions', 'HelloStudio.tsx'),
    buildHelloStudioCompositionTsx(kit, { styleId: resolvedStyleId, lang }),
    'utf8'
  );
  fs.writeFileSync(
    path.join(prodDir, 'index.ts'),
    buildHelloStudioIndexTs(kit),
    'utf8'
  );

  // Pre-populate deterministic word timestamps with empty audioFile so `qa` and `LiveTranscriptBar` work before `audio` runs
  const nowIso = new Date().toISOString();
  const introSynth = buildSyntheticWords(introText, 3.0, 60);
  const payoffSynth = buildSyntheticWords(payoffText, 3.0, 60);
  const preVoiceovers = {
    'hello-studio-intro': {
      sceneId: 'hello-studio-intro',
      text: introText,
      textHash: crypto
        .createHash('sha256')
        .update(introText)
        .digest('hex')
        .slice(0, 16),
      voiceId,
      modelId: 'eleven_multilingual_v2',
      provider: 'synthetic-fallback' as const,
      fps: 60,
      durationInSeconds: 3.0,
      audioFile: '',
      generatedAt: nowIso,
      words: introSynth.words,
      alignment: introSynth.alignment,
    },
    'hello-studio-payoff': {
      sceneId: 'hello-studio-payoff',
      text: payoffText,
      textHash: crypto
        .createHash('sha256')
        .update(payoffText)
        .digest('hex')
        .slice(0, 16),
      voiceId,
      modelId: 'eleven_multilingual_v2',
      provider: 'synthetic-fallback' as const,
      fps: 60,
      durationInSeconds: 3.0,
      audioFile: '',
      generatedAt: nowIso,
      words: payoffSynth.words,
      alignment: payoffSynth.alignment,
    },
  };

  const audioManifestTs = `// AUTO-GENERATED BY @make-pictures/cli — DO NOT EDIT MANUALLY
import type { SceneVoiceoverData } from '@make-pictures/core';

export interface ProductionMusicEntry {
  id: string;
  mode: 'prompt' | 'composition-plan' | 'procedural-fallback';
  provider: 'elevenlabs-music' | 'procedural-fallback';
  specHash: string;
  audioFile: string;
  durationInSeconds: number;
  moodPreset: string;
  generatedAt: string;
  songTitle?: string;
  genres?: string[];
}

export interface ProductionSfxEntry {
  id: string;
  prompt: string;
  provider: 'elevenlabs-sfx' | 'procedural-fallback';
  specHash: string;
  audioFile: string;
  durationSeconds: number;
  loop: boolean;
  generatedAt: string;
}

export const VOICEOVER_MANIFEST: Record<string, SceneVoiceoverData> = ${JSON.stringify(
    preVoiceovers,
    null,
    2
  )};

export const AUDIO_MANIFEST = VOICEOVER_MANIFEST;

export const MUSIC_MANIFEST: ProductionMusicEntry | null = null;

export const SFX_MANIFEST: Record<string, ProductionSfxEntry> = {};
`;

  fs.writeFileSync(
    path.join(prodDir, 'generated', 'audio-manifest.ts'),
    audioManifestTs,
    'utf8'
  );

  // Symlink public/_productions/hello-studio -> ../../productions/hello-studio/assets
  const linkPath = path.join(targetDir, 'public', '_productions', 'hello-studio');
  const assetsDir = path.join(prodDir, 'assets');
  const relTarget = path.relative(path.dirname(linkPath), assetsDir);
  try {
    fs.symlinkSync(
      relTarget,
      linkPath,
      process.platform === 'win32' ? 'junction' : 'dir'
    );
  } catch {
    // Fallback copy if symlink permissions restricted
    copyDirRecursive(assetsDir, linkPath);
  }

  // 3. AI Plugin + AGENTS.md
  writeAiPluginAndAgentsMd(targetDir);

  console.log('==============================================================');
  console.log(` 🎬 Created make.pictures Studio Project: ${projectName}`);
  console.log('==============================================================');
  console.log(`  • Location:   ${targetDir}`);
  console.log(
    `  • Starter:    productions/hello-studio (${kit}, style: ${resolvedStyleId}, ${lang})`
  );
  console.log('  • AI Skills:  .agents/plugins/make-pictures/ + AGENTS.md');

  if (options.install !== false) {
    console.log('\n📦 Installing npm packages...');
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const res = spawnSync(npmCmd, ['install'], {
      cwd: targetDir,
      stdio: 'inherit',
    });
    if (res.status !== 0) {
      throw new Error(
        `npm install exited with status ${res.status ?? 1}. You can re-run \`npm install\` inside ${targetDir}.`
      );
    }
  }

  const relDisplay = path.relative(process.cwd(), targetDir) || '.';
  console.log('\n✨ Ready! Next steps:');
  if (relDisplay !== '.') {
    console.log(`  cd ${relDisplay}`);
  }
  if (options.install === false) {
    console.log('  npm install');
  }
  console.log('  npm run onboard');
  console.log('  npm run studio');

  return { targetDir, projectName };
}

function printCreateHelp(): void {
  console.log(`
create-make-pictures (v2.4.0)

Usage:
  npx create-make-pictures@latest <project-directory> [options]

Options:
  --space=<space>   Dimensional space: 2d | 2.5d | 3d
  --kit=<kit>       Starter kit: vector-scene-2d (default), editorial-collage,
                    kinetic-typography, data-storytelling, motion-diagrams-2d,
                    paper-diorama-3d, isometric-3d
  --style=<style>   Built-in or custom style ID (10 built-in styles: minimal-product,
                    editorial-press, archival-chronicle, cyber-telemetry,
                    brutalist-poster, sketch-notebook, tactile-craft, retro-pc,
                    soft-clay, glass-studio)
  --lang=<en|pl>    Starter narration language (default: en)
  --no-install      Skip running npm install
  --force           Allow scaffolding into a non-empty directory
`);
}

export async function runCreateCli(
  argv = process.argv.slice(2)
): Promise<void> {
  const { positionals, flags } = parseArgs(argv);
  if (flags.help || positionals.length === 0) {
    printCreateHelp();
    if (!flags.help && positionals.length === 0) {
      throw new Error(
        'Missing <project-directory>. Usage: npx create-make-pictures@latest my-films'
      );
    }
    return;
  }

  const targetDir = positionals[0];

  let space: StarterSpace | undefined;
  if (flags.space !== undefined && flags.space !== false) {
    const rawSpace =
      typeof flags.space === 'string' ? flags.space.trim().toLowerCase() : '';
    if (!VALID_SPACES.has(rawSpace as StarterSpace)) {
      throw new Error(
        `Invalid --space value "${String(flags.space)}". Expected one of: 2d, 2.5d, 3d (e.g. --space=3d).`
      );
    }
    space = rawSpace as StarterSpace;
  }

  let kit: StarterKitId | undefined;
  if (flags.kit !== undefined && flags.kit !== false) {
    const rawKit = typeof flags.kit === 'string' ? flags.kit.trim() : '';
    if (!VALID_KITS.has(rawKit as StarterKitId)) {
      throw new Error(
        `Unknown visual kit "${String(flags.kit)}". Supported kits: ${Array.from(VALID_KITS).join(', ')}`
      );
    }
    kit = rawKit as StarterKitId;
  }

  const style =
    typeof flags.style === 'string' && flags.style.trim().length > 0
      ? flags.style.trim()
      : undefined;
  const lang = flags.lang === 'pl' ? 'pl' : 'en';

  await createMakePicturesApp({
    targetDir,
    space,
    kit,
    style,
    lang,
    install: !Boolean(flags['no-install']),
    force: Boolean(flags.force),
  });
}

function resolveSelfFilename(): string | null {
  if (typeof __filename === 'string') {
    return __filename;
  }
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    return fileURLToPath(import.meta.url);
  }
  return null;
}

function safeRealpath(targetPath: string): string {
  try {
    return fs.realpathSync(targetPath);
  } catch {
    return path.resolve(targetPath);
  }
}

const selfFile = resolveSelfFilename();
const isDirectEntry =
  Boolean(process.argv[1]) &&
  Boolean(selfFile) &&
  safeRealpath(process.argv[1]) === safeRealpath(selfFile!);

if (isDirectEntry) {
  runCreateCli().catch((err) => {
    console.error(
      '❌ create-make-pictures error:',
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  });
}
