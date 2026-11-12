#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type StarterKitId =
  | 'paper-diorama-3d'
  | 'motion-diagrams-2d'
  | 'isometric-3d'
  | 'kinetic-typography'
  | 'data-storytelling';

export interface CreateMakePicturesOptions {
  targetDir: string;
  kit?: StarterKitId;
  lang?: 'pl' | 'en';
  install?: boolean;
  force?: boolean;
}

interface ParsedCreateArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

const VALID_KITS = new Set<StarterKitId>([
  'paper-diorama-3d',
  'motion-diagrams-2d',
  'isometric-3d',
  'kinetic-typography',
  'data-storytelling',
]);

const BOOLEAN_FLAGS = new Set(['no-install', 'force', 'help']);

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
      new: 'make-pictures new',
      audio: 'make-pictures audio',
      music: 'make-pictures music',
      sfx: 'make-pictures sfx',
      qa: 'make-pictures qa',
      render: 'make-pictures render',
      typecheck: 'tsc --noEmit',
    },
    dependencies: {
      '@make-pictures/core': '^2.0.1',
      '@make-pictures/kits': '^2.0.1',
      '@make-pictures/studio': '^2.0.1',
      '@make-pictures/cli': '^2.0.1',
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
    include: ['src', 'productions', 'remotion.config.ts'],
  };
}

const REMOTION_CONFIG_TS = `import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
`;

const SRC_INDEX_TS = `import React from 'react';
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

const ENV_EXAMPLE_CONTENT = `# make.pictures Studio — Environment Variables
# Connect automatically via: npm run onboard
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=TX3LPaxmHKxFdv7VOQHJ
ELEVENLABS_MODEL_ID=eleven_multilingual_v2

# Optional: Gemini Image generation (npx make-pictures image "..." --out=...)
# GEMINI_API_KEY=your_gemini_api_key_here
`;

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

const EMBEDDED_PLUGIN_JSON = {
  name: 'make-pictures',
  version: '2.0.1',
  description:
    'make.pictures Studio — 60 FPS Video-as-Code skills, visual kits, camera Shot DSL, and ElevenLabs AI Audio Studio.',
  author: {
    name: 'make.pictures',
    url: 'https://make.pictures',
  },
  homepage: 'https://make.pictures',
  repository: 'https://github.com/make-pictures/make-pictures-studio',
};

function buildHelloStudioCompositionTsx(kit: StarterKitId): string {
  if (kit === 'paper-diorama-3d') {
    return `import { ThreeCanvas } from '@remotion/three';
import React from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import {
  SPRING_PRESETS,
  SmartMusicBed,
  SoundCue,
} from '@make-pictures/core';
import {
  PaperCameraRig3D,
  PaperCutout3D,
  PaperStageLighting3D,
  PopUpBookBase3D,
  PopUpHinge3D,
} from '@make-pictures/kits/paper-diorama-3d';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from '../generated/audio-manifest';

export const HelloStudioSchema = z.object({
  headline: z.string().describe('Texts & Labels :: Headline'),
  subheadline: z.string().describe('Texts & Labels :: Subheadline'),
  badgeLabel: z.string().describe('Texts & Labels :: Kit Badge'),
  accentColor: z.string().describe('Colors & Style :: Primary Accent'),
  secondaryColor: z.string().describe('Colors & Style :: Secondary Accent'),
  voiceoverVolume: z.number().min(0).max(1.5).describe('Audio :: Voiceover Volume'),
  musicVolume: z.number().min(0).max(1).describe('Audio :: Music Base Volume'),
  sfxVolume: z.number().min(0).max(1).describe('Audio :: SFX Volume'),
});

export type HelloStudioProps = z.infer<typeof HelloStudioSchema>;

const DIALOGUE_SEGMENTS = [
  { sceneId: 'hello-studio-intro', fromFrame: 12, durationInFrames: 300 },
  { sceneId: 'hello-studio-payoff', fromFrame: 324, durationInFrames: 306 },
];

export const HelloStudio: React.FC<HelloStudioProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Frame 0 Clean Board Rule: opacity starts at 0 on frame === 0
  const stageReveal = spring({
    frame: frame - 2,
    fps,
    config: SPRING_PRESETS.snappy,
  });

  const hingeFold = spring({
    frame: frame - 10,
    fps,
    config: SPRING_PRESETS.gentle,
  });

  const camDriftX = Math.sin(frame * 0.035) * 0.32;
  const camZ = interpolate(frame, [0, 630], [9.8, 8.6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const introVo = VOICEOVER_MANIFEST['hello-studio-intro'];
  const payoffVo = VOICEOVER_MANIFEST['hello-studio-payoff'];
  const whooshSfx = SFX_MANIFEST['whoosh-open'];
  const popSfx = SFX_MANIFEST['card-pop'];

  return (
    <AbsoluteFill style={{ backgroundColor: '#F6F1E7' }}>
      {MUSIC_MANIFEST?.audioFile ? (
        <SmartMusicBed
          src={staticFile(MUSIC_MANIFEST.audioFile)}
          dialogueSegments={DIALOGUE_SEGMENTS}
          voiceoverManifest={VOICEOVER_MANIFEST}
          baseVolume={props.musicVolume}
          duckedVolume={Math.min(props.musicVolume * 0.34, 0.09)}
        />
      ) : null}

      {introVo?.audioFile ? (
        <Sequence from={12} durationInFrames={300} layout="none">
          <Audio src={staticFile(introVo.audioFile)} volume={props.voiceoverVolume} />
        </Sequence>
      ) : null}

      {payoffVo?.audioFile ? (
        <Sequence from={324} durationInFrames={306} layout="none">
          <Audio src={staticFile(payoffVo.audioFile)} volume={props.voiceoverVolume} />
        </Sequence>
      ) : null}

      {whooshSfx?.audioFile ? (
        <SoundCue
          src={staticFile(whooshSfx.audioFile)}
          atFrame={8}
          volume={props.sfxVolume}
        />
      ) : null}

      {popSfx?.audioFile ? (
        <SoundCue
          src={staticFile(popSfx.audioFile)}
          sceneId="hello-studio-payoff"
          onWord="music"
          sceneStartFrame={324}
          fallbackFrame={24}
          voiceoverManifest={VOICEOVER_MANIFEST}
          volume={props.sfxVolume}
        />
      ) : null}

      <AbsoluteFill style={{ opacity: stageReveal }}>
        <ThreeCanvas
          width={width}
          height={height}
          shadows
          camera={{ position: [0, 3.1, 9.8], fov: 36 }}
        >
          <PaperCameraRig3D
            cameraPos={[camDriftX, 3.0, camZ]}
            lookAt={[0, 1.45, -0.5]}
            fov={36}
          />
          <PaperStageLighting3D preset="golden-hour" />
          <PopUpBookBase3D
            floorTheme="warm-parquet"
            nextFloorTheme="warm-parquet"
            pageTurnProgress={0}
          />

          <PopUpHinge3D foldProgress={hingeFold} position={[0, 0, -0.4]}>
            <PaperCutout3D
              cacheKey="hello-studio-hero-card"
              cacheDeps={[props.headline, props.subheadline, props.accentColor]}
              width={5.8}
              height={2.45}
              pixelWidth={720}
              pixelHeight={304}
              whiteBorderPx={14}
              position={[0, 0, 0]}
              thickness={0.055}
              draw={(ctx) => {
                ctx.fillStyle = '#FFFDF9';
                ctx.strokeStyle = props.accentColor;
                ctx.lineWidth = 8;
                ctx.beginPath();
                ctx.roundRect(28, 28, 664, 248, 26);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#0F172A';
                ctx.font = '800 44px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(props.headline, 360, 136, 616);

                ctx.fillStyle = '#475569';
                ctx.font = '600 24px Inter, sans-serif';
                ctx.fillText(props.subheadline, 360, 192, 616);
              }}
            />
          </PopUpHinge3D>
        </ThreeCanvas>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
`;
  }

  return `import React from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import {
  SPRING_PRESETS,
  STUDIO_FONTS,
  STUDIO_THEME,
  SmartMusicBed,
  SoundCue,
} from '@make-pictures/core';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from '../generated/audio-manifest';

export const HelloStudioSchema = z.object({
  headline: z.string().describe('Texts & Labels :: Headline'),
  subheadline: z.string().describe('Texts & Labels :: Subheadline'),
  badgeLabel: z.string().describe('Texts & Labels :: Kit Badge'),
  accentColor: z.string().describe('Colors & Style :: Primary Accent'),
  secondaryColor: z.string().describe('Colors & Style :: Secondary Accent'),
  voiceoverVolume: z.number().min(0).max(1.5).describe('Audio :: Voiceover Volume'),
  musicVolume: z.number().min(0).max(1).describe('Audio :: Music Base Volume'),
  sfxVolume: z.number().min(0).max(1).describe('Audio :: SFX Volume'),
});

export type HelloStudioProps = z.infer<typeof HelloStudioSchema>;

const DIALOGUE_SEGMENTS = [
  { sceneId: 'hello-studio-intro', fromFrame: 12, durationInFrames: 300 },
  { sceneId: 'hello-studio-payoff', fromFrame: 324, durationInFrames: 306 },
];

export const HelloStudio: React.FC<HelloStudioProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardEntrance = spring({
    frame: frame - 2,
    fps,
    config: SPRING_PRESETS.snappy,
  });

  const beatTwoEntrance = spring({
    frame: frame - 320,
    fps,
    config: SPRING_PRESETS.gentle,
  });

  const cardY = interpolate(cardEntrance, [0, 1], [36, 0]);
  const introVo = VOICEOVER_MANIFEST['hello-studio-intro'];
  const payoffVo = VOICEOVER_MANIFEST['hello-studio-payoff'];
  const whooshSfx = SFX_MANIFEST['whoosh-open'];
  const popSfx = SFX_MANIFEST['card-pop'];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: STUDIO_THEME.bgCanvas,
        fontFamily: STUDIO_FONTS.sans,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {MUSIC_MANIFEST?.audioFile ? (
        <SmartMusicBed
          src={staticFile(MUSIC_MANIFEST.audioFile)}
          dialogueSegments={DIALOGUE_SEGMENTS}
          voiceoverManifest={VOICEOVER_MANIFEST}
          baseVolume={props.musicVolume}
          duckedVolume={Math.min(props.musicVolume * 0.34, 0.09)}
        />
      ) : null}

      {introVo?.audioFile ? (
        <Sequence from={12} durationInFrames={300} layout="none">
          <Audio src={staticFile(introVo.audioFile)} volume={props.voiceoverVolume} />
        </Sequence>
      ) : null}

      {payoffVo?.audioFile ? (
        <Sequence from={324} durationInFrames={306} layout="none">
          <Audio src={staticFile(payoffVo.audioFile)} volume={props.voiceoverVolume} />
        </Sequence>
      ) : null}

      {whooshSfx?.audioFile ? (
        <SoundCue
          src={staticFile(whooshSfx.audioFile)}
          atFrame={8}
          volume={props.sfxVolume}
        />
      ) : null}

      {popSfx?.audioFile ? (
        <SoundCue
          src={staticFile(popSfx.audioFile)}
          atFrame={322}
          volume={props.sfxVolume}
        />
      ) : null}

      <div
        style={{
          opacity: cardEntrance,
          transform: \`translate3d(0, \${cardY}px, 0)\`,
          padding: '56px 72px',
          borderRadius: 28,
          background: 'rgba(15, 23, 42, 0.92)',
          border: \`2px solid \${props.accentColor}\`,
          boxShadow: '0 28px 80px rgba(0, 0, 0, 0.45)',
          maxWidth: 920,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '8px 18px',
            borderRadius: 999,
            background: \`\${props.accentColor}26\`,
            color: props.accentColor,
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: '0.08em',
            marginBottom: 24,
          }}
        >
          {props.badgeLabel}
        </div>
        <h1
          style={{
            margin: 0,
            color: '#F8FAFC',
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1.12,
          }}
        >
          {props.headline}
        </h1>
        <p
          style={{
            marginTop: 20,
            marginBottom: 0,
            color: '#94A3B8',
            fontSize: 28,
            fontWeight: 500,
          }}
        >
          {props.subheadline}
        </p>

        <div
          style={{
            marginTop: 32,
            opacity: beatTwoEntrance,
            color: props.secondaryColor,
            fontSize: 22,
            fontWeight: 600,
          }}
        >
          SmartMusicBed Auto-Ducking • Word-Synced SoundCue • 60 FPS
        </div>
      </div>
    </AbsoluteFill>
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
      durationInFrames: 648,
      usesThree: ${usesThree},
      propsFile: 'productions/hello-studio/compositions/HelloStudio.props.json',
      sceneTimeline: [
        {
          sceneId: 'hello-studio-intro',
          fromFrame: 12,
          durationInFrames: 300,
          label: '1. Intro',
        },
        {
          sceneId: 'hello-studio-payoff',
          fromFrame: 324,
          durationInFrames: 306,
          label: '2. Payoff',
        },
      ],
      sfxTimeline: [
        { sfxId: 'whoosh-open', fromFrame: 8, label: 'Opening Whoosh' },
        { sfxId: 'card-pop', fromFrame: 348, label: 'Card Pop' },
      ],
      cameraTimeline: [
        { shotLabel: 'Establishing Wide', fromFrame: 0, durationInFrames: 320 },
        { shotLabel: 'Medium Focus', fromFrame: 320, durationInFrames: 328 },
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
          version: '2.0.1',
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
  }

  const rulesAgentsPath = path.join(pluginDestDir, 'rules', 'AGENTS.md');
  const agentsContent = fs.existsSync(rulesAgentsPath)
    ? fs.readFileSync(rulesAgentsPath, 'utf8')
    : EMBEDDED_AGENTS_MD;
  fs.writeFileSync(path.join(targetRoot, 'AGENTS.md'), agentsContent, 'utf8');
  fs.writeFileSync(
    path.join(targetRoot, 'CLAUDE.md'),
    EMBEDDED_CLAUDE_MD,
    'utf8'
  );

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

# 4. Inspect a 12-frame Contact-Sheet QA image
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
  const kit: StarterKitId = options.kit ?? 'paper-diorama-3d';
  const lang: 'pl' | 'en' = options.lang ?? 'en';
  const isPl = lang === 'pl';

  if (fs.existsSync(targetDir) && !options.force) {
    const entries = fs.readdirSync(targetDir);
    if (entries.length > 0) {
      throw new Error(
        `Target directory "${targetDir}" is not empty. Choose a new directory or pass --force.`
      );
    }
  }

  fs.mkdirSync(path.join(targetDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'public', '_productions'), {
    recursive: true,
  });

  // 1. Root project config files
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
  fs.writeFileSync(path.join(targetDir, '.gitignore'), GITIGNORE_CONTENT, 'utf8');
  fs.writeFileSync(
    path.join(targetDir, '.env.example'),
    ENV_EXAMPLE_CONTENT,
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

  const mood = moodForKit(kit);
  const introText = isPl
    ? 'Witaj w Hello Studio! Każda scena, lektor i muzyka działają w sześćdziesięciu klatkach na sekundę!'
    : 'Welcome to Hello Studio! Every frame, voiceover, and musical cue lives inside an isolated sixty frames per second capsule!';
  const payoffText = isPl
    ? 'Muzyka automatycznie ścisza się pod głosem lektora, a efekty dźwiękowe trafiają idealnie w słowa!'
    : 'Background music ducks smoothly under narration while word-synced sound effects punctuate every visual beat!';

  const productionManifest = {
    id: 'hello-studio',
    title: 'Hello Studio',
    fps: 60,
    scenes: [
      {
        id: 'hello-studio-intro',
        title: isPl ? 'Scena 1 — Wprowadzenie' : 'Scene 1 — Opening Hook',
        component: 'HelloStudio',
        durationInSeconds: 5.0,
        durationInFrames: 300,
        voiceId: 'TX3LPaxmHKxFdv7VOQHJ',
        speaker: 'Narrator',
        voiceEffect: 'clean',
        text: introText,
      },
      {
        id: 'hello-studio-payoff',
        title: isPl ? 'Scena 2 — Rozwinięcie' : 'Scene 2 — Core Insight',
        component: 'HelloStudio',
        durationInSeconds: 5.5,
        durationInFrames: 330,
        voiceId: 'TX3LPaxmHKxFdv7VOQHJ',
        speaker: 'Narrator',
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
    headline: 'Hello Studio',
    subheadline: isPl
      ? 'Odizolowana produkcja 60 FPS • make.pictures'
      : 'Isolated 60 FPS Production • make.pictures',
    badgeLabel: kit.toUpperCase(),
    accentColor: kit === 'paper-diorama-3d' ? '#D97706' : '#2563EB',
    secondaryColor: '#FF2A85',
    voiceoverVolume: 1.0,
    musicVolume: 0.25,
    sfxVolume: 0.35,
  };

  fs.writeFileSync(
    path.join(prodDir, 'compositions', 'HelloStudio.props.json'),
    `${JSON.stringify(defaultProps, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(prodDir, 'compositions', 'HelloStudio.tsx'),
    buildHelloStudioCompositionTsx(kit),
    'utf8'
  );
  fs.writeFileSync(
    path.join(prodDir, 'index.ts'),
    buildHelloStudioIndexTs(kit),
    'utf8'
  );

  // Pre-populate deterministic word timestamps with empty audioFile so `qa` and `LiveTranscriptBar` work before `audio` runs
  const nowIso = new Date().toISOString();
  const introSynth = buildSyntheticWords(introText, 5.0, 60);
  const payoffSynth = buildSyntheticWords(payoffText, 5.5, 60);
  const preVoiceovers = {
    'hello-studio-intro': {
      sceneId: 'hello-studio-intro',
      text: introText,
      textHash: crypto
        .createHash('sha256')
        .update(introText)
        .digest('hex')
        .slice(0, 16),
      voiceId: 'TX3LPaxmHKxFdv7VOQHJ',
      modelId: 'eleven_multilingual_v2',
      provider: 'synthetic-fallback' as const,
      fps: 60,
      durationInSeconds: 5.0,
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
      voiceId: 'TX3LPaxmHKxFdv7VOQHJ',
      modelId: 'eleven_multilingual_v2',
      provider: 'synthetic-fallback' as const,
      fps: 60,
      durationInSeconds: 5.5,
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
  console.log(`  • Starter:    productions/hello-studio (${kit}, ${lang})`);
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
create-make-pictures (v2.0.1)

Usage:
  npx create-make-pictures@latest <project-directory> [options]

Options:
  --kit=<kit>       Starter kit: paper-diorama-3d (default), motion-diagrams-2d,
                    isometric-3d, kinetic-typography, data-storytelling
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
  const rawKit = typeof flags.kit === 'string' ? flags.kit.trim() : undefined;
  const kit: StarterKitId =
    rawKit && VALID_KITS.has(rawKit as StarterKitId)
      ? (rawKit as StarterKitId)
      : 'paper-diorama-3d';
  const lang = flags.lang === 'pl' ? 'pl' : 'en';

  await createMakePicturesApp({
    targetDir,
    kit,
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
