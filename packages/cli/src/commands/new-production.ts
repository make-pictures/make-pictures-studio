import fs from 'node:fs';
import path from 'node:path';
import type {
  MusicMoodPreset,
  ProductionManifest,
  SceneVoiceoverData,
} from '@make-pictures/core';
import {
  buildSyntheticWordTimestamps,
  computeSceneCacheHash,
  ensureProductionPublicSymlink,
  writeProductionAudioManifest,
} from './audio';
import { resolveWorkspaceContext } from './workspace-paths';

export type ScaffoldKitId =
  | 'motion-diagrams-2d'
  | 'paper-diorama-3d'
  | 'isometric-3d'
  | 'kinetic-typography'
  | 'data-storytelling';

export interface NewProductionOptions {
  rootDir?: string;
  cwd?: string;
  dir?: string;
  slug: string;
  kit?: ScaffoldKitId;
  lang?: 'pl' | 'en';
  force?: boolean;
  /**
   * When true, pre-populates `generated/audio-manifest.ts` with deterministic
   * word timestamps (`audioFile: ""`) so `LiveTranscriptBar` and `qa` work
   * immediately before `make-pictures audio` is run.
   */
  prepopulateTimestamps?: boolean;
}

export function normalizeProductionSlug(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(cleaned)) {
    throw new Error(
      `Invalid production slug "${raw}". Use lowercase letters, digits, and hyphens (e.g. "quantum-story").`
    );
  }
  return cleaned;
}

export function slugToPascalCase(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function slugToHumanTitle(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function moodForKit(kit: ScaffoldKitId): MusicMoodPreset {
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

export function buildScaffoldProductionManifest(
  slug: string,
  title: string,
  kit: ScaffoldKitId,
  lang: 'pl' | 'en'
): ProductionManifest {
  const isPl = lang === 'pl';
  const mood = moodForKit(kit);

  return {
    id: slug,
    title,
    fps: 60,
    scenes: [
      {
        id: `${slug}-intro`,
        title: isPl ? 'Scena 1 — Wprowadzenie' : 'Scene 1 — Opening Hook',
        component: slugToPascalCase(slug),
        durationInSeconds: 5.0,
        durationInFrames: 300,
        voiceId: 'TX3LPaxmHKxFdv7VOQHJ',
        speaker: 'Narrator',
        voiceEffect: 'clean',
        text: isPl
          ? `Poznaj ${title}! Cały ten materiał powstaje w odizolowanej kapsule produkcyjnej w sześćdziesięciu klatkach na sekundę!`
          : `Welcome to ${title}! Every frame, voiceover, and musical cue lives inside an isolated sixty frames per second capsule!`,
      },
      {
        id: `${slug}-payoff`,
        title: isPl ? 'Scena 2 — Rozwinięcie' : 'Scene 2 — Core Insight',
        component: slugToPascalCase(slug),
        durationInSeconds: 5.5,
        durationInFrames: 330,
        voiceId: 'TX3LPaxmHKxFdv7VOQHJ',
        speaker: 'Narrator',
        voiceEffect: 'clean',
        text: isPl
          ? 'Muzyka automatycznie ścisza się pod głosem lektora, a efekty dźwiękowe trafiają idealnie w wypowiadane słowa!'
          : 'Background music ducks smoothly under narration while word-synced sound effects punctuate every visual beat!',
      },
    ],
    score: {
      id: 'main-score',
      mode: 'prompt',
      prompt: `Clean modern instrumental ${mood} background score for ${title}, warm studio mix, no vocals`,
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
}

export function buildScaffoldPropsJson(
  title: string,
  kit: ScaffoldKitId,
  lang: 'pl' | 'en'
): Record<string, unknown> {
  const isPl = lang === 'pl';
  return {
    headline: title,
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
}

export function buildScaffoldCompositionTsx(params: {
  slug: string;
  pascalName: string;
  kit: ScaffoldKitId;
}): string {
  const { slug, pascalName, kit } = params;
  const usesPaper3D = kit === 'paper-diorama-3d';

  if (usesPaper3D) {
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
  SPRING_PRESETS,
  SmartMusicBed,
  SoundCue,
  VoiceoverTrack,
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

export const ${pascalName}Schema = z.object({
  headline: z.string().describe('Texts & Labels :: Headline'),
  subheadline: z.string().describe('Texts & Labels :: Subheadline'),
  badgeLabel: z.string().describe('Texts & Labels :: Kit Badge'),
  accentColor: z.string().describe('Colors & Style :: Primary Accent'),
  secondaryColor: z.string().describe('Colors & Style :: Secondary Accent'),
  voiceoverVolume: z.number().min(0).max(1.5).describe('Audio :: Voiceover Volume'),
  musicVolume: z.number().min(0).max(1).describe('Audio :: Music Base Volume'),
  sfxVolume: z.number().min(0).max(1).describe('Audio :: SFX Volume'),
});

export type ${pascalName}Props = z.infer<typeof ${pascalName}Schema>;

const DIALOGUE_SEGMENTS = [
  { sceneId: '${slug}-intro', fromFrame: 12, durationInFrames: 300 },
  { sceneId: '${slug}-payoff', fromFrame: 324, durationInFrames: 306 },
];

export const ${pascalName}: React.FC<${pascalName}Props> = (props) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Frame 0 Clean Board Rule: opacity is 0 at frame === 0
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

  const introVo = VOICEOVER_MANIFEST['${slug}-intro'];
  const payoffVo = VOICEOVER_MANIFEST['${slug}-payoff'];
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

      <VoiceoverTrack
        voiceover={introVo}
        fromFrame={12}
        volume={props.voiceoverVolume}
      />

      <VoiceoverTrack
        voiceover={payoffVo}
        fromFrame={324}
        volume={props.voiceoverVolume}
      />

      {whooshSfx?.audioFile ? (
        <SoundCue
          src={staticFile(whooshSfx.audioFile)}
          atFrame={8}
          durationSeconds={whooshSfx.durationSeconds}
          volume={props.sfxVolume}
        />
      ) : null}

      {popSfx?.audioFile ? (
        <SoundCue
          src={staticFile(popSfx.audioFile)}
          sceneId="${slug}-payoff"
          onWord="music"
          sceneStartFrame={324}
          fallbackFrame={24}
          durationSeconds={popSfx.durationSeconds}
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
              cacheKey="${slug}-hero-card"
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
  interpolate,
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
  VoiceoverTrack,
} from '@make-pictures/core';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from '../generated/audio-manifest';

export const ${pascalName}Schema = z.object({
  headline: z.string().describe('Texts & Labels :: Headline'),
  subheadline: z.string().describe('Texts & Labels :: Subheadline'),
  badgeLabel: z.string().describe('Texts & Labels :: Kit Badge'),
  accentColor: z.string().describe('Colors & Style :: Primary Accent'),
  secondaryColor: z.string().describe('Colors & Style :: Secondary Accent'),
  voiceoverVolume: z.number().min(0).max(1.5).describe('Audio :: Voiceover Volume'),
  musicVolume: z.number().min(0).max(1).describe('Audio :: Music Base Volume'),
  sfxVolume: z.number().min(0).max(1).describe('Audio :: SFX Volume'),
});

export type ${pascalName}Props = z.infer<typeof ${pascalName}Schema>;

const DIALOGUE_SEGMENTS = [
  { sceneId: '${slug}-intro', fromFrame: 12, durationInFrames: 300 },
  { sceneId: '${slug}-payoff', fromFrame: 324, durationInFrames: 306 },
];

export const ${pascalName}: React.FC<${pascalName}Props> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Frame 0 Clean Board Rule: opacity starts at 0 on frame === 0
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
  const introVo = VOICEOVER_MANIFEST['${slug}-intro'];
  const payoffVo = VOICEOVER_MANIFEST['${slug}-payoff'];
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

      <VoiceoverTrack
        voiceover={introVo}
        fromFrame={12}
        volume={props.voiceoverVolume}
      />

      <VoiceoverTrack
        voiceover={payoffVo}
        fromFrame={324}
        volume={props.voiceoverVolume}
      />

      {whooshSfx?.audioFile ? (
        <SoundCue
          src={staticFile(whooshSfx.audioFile)}
          atFrame={8}
          durationSeconds={whooshSfx.durationSeconds}
          volume={props.sfxVolume}
        />
      ) : null}

      {popSfx?.audioFile ? (
        <SoundCue
          src={staticFile(popSfx.audioFile)}
          atFrame={322}
          durationSeconds={popSfx.durationSeconds}
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

export function buildScaffoldProductionIndexTs(params: {
  slug: string;
  title: string;
  pascalName: string;
  kit: ScaffoldKitId;
}): string {
  const { slug, title, pascalName, kit } = params;
  const usesThree = kit === 'paper-diorama-3d' || kit === 'isometric-3d';

  return `import { defineProduction, type ProductionManifest } from '@make-pictures/core';
import productionJson from './production.json';
import {
  ${pascalName},
  ${pascalName}Schema,
} from './compositions/${pascalName}';
import defaultProps from './compositions/${pascalName}.props.json';
import { VOICEOVER_MANIFEST } from './generated/audio-manifest';

const manifest = productionJson as ProductionManifest;

export default defineProduction({
  id: '${slug}',
  title: '${title}',
  origin: 'production',
  manifest,
  voiceoverManifest: VOICEOVER_MANIFEST,
  compositions: [
    {
      id: '${pascalName}',
      title: '${title}',
      subtitle: '60 FPS Capsule • ${kit}',
      group: 'Productions (${title})',
      kit: '${kit}',
      fps: 60,
      width: 1920,
      height: 1080,
      durationInFrames: 648,
      usesThree: ${usesThree},
      propsFile: 'productions/${slug}/compositions/${pascalName}.props.json',
      sceneTimeline: [
        {
          sceneId: '${slug}-intro',
          fromFrame: 12,
          durationInFrames: 300,
          label: '1. Intro',
        },
        {
          sceneId: '${slug}-payoff',
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
      component: ${pascalName},
      schema: ${pascalName}Schema,
      defaultProps,
    },
  ],
});
`;
}

export function buildPrepopulatedVoiceovers(
  manifest: ProductionManifest
): Record<string, SceneVoiceoverData> {
  const fps = manifest.fps || 60;
  const records: Record<string, SceneVoiceoverData> = {};

  for (const scene of manifest.scenes) {
    const dur = scene.durationInSeconds || 5.0;
    const { words, alignment } = buildSyntheticWordTimestamps(
      scene.text,
      dur,
      fps
    );
    records[scene.id] = {
      sceneId: scene.id,
      text: scene.text,
      textHash: computeSceneCacheHash(scene),
      voiceId: scene.voiceId || 'TX3LPaxmHKxFdv7VOQHJ',
      modelId: 'eleven_multilingual_v2',
      provider: 'synthetic-fallback',
      fps,
      durationInSeconds: dur,
      // Empty audioFile until `make-pictures audio` synthesizes real `.mp3` files on disk
      audioFile: '',
      generatedAt: new Date().toISOString(),
      words,
      alignment,
    };
  }

  return records;
}

/**
 * Scaffolds a clean, self-contained production capsule inside `<studioDir>/productions/<slug>/`
 * and creates `<studioDir>/public/_productions/<slug> -> ../../productions/<slug>/assets`.
 */
export async function runNewProductionCommand(
  options: NewProductionOptions
): Promise<{ productionDir: string; compositionId: string }> {
  const { rootDir, studioDir, dirRel } = resolveWorkspaceContext({
    cwd: options.cwd ?? options.rootDir,
    dir: options.dir,
  });

  const slug = normalizeProductionSlug(options.slug);
  const kit: ScaffoldKitId = options.kit ?? 'motion-diagrams-2d';
  const lang: 'pl' | 'en' = options.lang ?? 'en';
  const pascalName = slugToPascalCase(slug);
  const title = slugToHumanTitle(slug);

  const productionDir = path.join(studioDir, 'productions', slug);
  if (fs.existsSync(productionDir) && !options.force) {
    throw new Error(
      `Production "${path.relative(rootDir, productionDir)}" already exists. Pass --force to overwrite.`
    );
  }

  fs.mkdirSync(path.join(productionDir, 'compositions'), { recursive: true });
  fs.mkdirSync(path.join(productionDir, 'assets', 'voiceovers'), {
    recursive: true,
  });
  fs.mkdirSync(path.join(productionDir, 'assets', 'music'), {
    recursive: true,
  });
  fs.mkdirSync(path.join(productionDir, 'assets', 'sfx'), { recursive: true });
  fs.mkdirSync(path.join(productionDir, 'assets', 'videos'), {
    recursive: true,
  });
  fs.mkdirSync(path.join(productionDir, 'generated'), { recursive: true });

  const manifest = buildScaffoldProductionManifest(slug, title, kit, lang);
  fs.writeFileSync(
    path.join(productionDir, 'production.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );

  const defaultProps = buildScaffoldPropsJson(title, kit, lang);
  fs.writeFileSync(
    path.join(productionDir, 'compositions', `${pascalName}.props.json`),
    `${JSON.stringify(defaultProps, null, 2)}\n`,
    'utf8'
  );

  fs.writeFileSync(
    path.join(productionDir, 'compositions', `${pascalName}.tsx`),
    buildScaffoldCompositionTsx({ slug, pascalName, kit }),
    'utf8'
  );

  writeProductionAudioManifest({
    productionDir,
    voiceovers: options.prepopulateTimestamps
      ? buildPrepopulatedVoiceovers(manifest)
      : {},
    music: null,
    sfx: {},
  });

  fs.writeFileSync(
    path.join(productionDir, 'index.ts'),
    buildScaffoldProductionIndexTs({ slug, title, pascalName, kit }),
    'utf8'
  );

  const linkPath = ensureProductionPublicSymlink(studioDir, slug);
  const dirFlagHint = dirRel !== '.' ? ` --dir=${dirRel}` : '';

  console.log('==============================================================');
  console.log(
    ` 🎬 Scaffolded Isolated Production Capsule: ${path.relative(rootDir, productionDir)}`
  );
  console.log('==============================================================');
  console.log(
    `  • Manifest:     ${path.relative(rootDir, path.join(productionDir, 'production.json'))}`
  );
  console.log(
    `  • Composition:  ${path.relative(rootDir, path.join(productionDir, 'compositions', `${pascalName}.tsx`))} (${kit})`
  );
  console.log(
    `  • Props JSON:   ${path.relative(rootDir, path.join(productionDir, 'compositions', `${pascalName}.props.json`))}`
  );
  console.log(
    `  • Asset Mirror: ${path.relative(rootDir, linkPath)} -> ../../productions/${slug}/assets`
  );
  console.log('\nNext steps:');
  console.log(`  1. npx make-pictures audio --production=${slug}${dirFlagHint}`);
  console.log(`  2. npx make-pictures qa ${pascalName}${dirFlagHint}`);
  console.log(`  3. npx make-pictures render ${pascalName}${dirFlagHint}`);

  return { productionDir, compositionId: pascalName };
}
