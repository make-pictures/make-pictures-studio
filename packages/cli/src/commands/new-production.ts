import fs from 'node:fs';
import path from 'node:path';
import {
  BUILT_IN_STYLES,
  isBuiltInStyleId,
  type StylePreset,
  type VoiceArchetype,
} from '../../../core/src/style/presets';
import type {
  MusicMoodPreset,
  ProductionManifest,
  SceneVoiceoverData,
} from '../../../core/src/index';
import {
  buildSyntheticWordTimestamps,
  computeSceneCacheHash,
  ensureProductionPublicSymlink,
  writeProductionAudioManifest,
} from './audio';
import { loadWorkspaceCustomStyles } from './styles';
import { resolveWorkspaceContext } from './workspace-paths';

export const SCENES_KIT_IDS = [
  'editorial-collage',
  'vector-scene-2d',
  'kinetic-typography',
  'data-storytelling',
  'motion-diagrams-2d',
  'paper-diorama-3d',
  'isometric-3d',
] as const;

export type ScaffoldKitId = (typeof SCENES_KIT_IDS)[number];

export function isValidScaffoldKitId(id: string): id is ScaffoldKitId {
  return (SCENES_KIT_IDS as readonly string[]).includes(id);
}

export const VOICE_ARCHETYPE_TO_ELEVENLABS_ID: Record<VoiceArchetype, string> =
  {
    'crisp-tech': 'TX3LPaxmHKxFdv7VOQHJ',
    'calm-editorial': 'EXAVITQu4vr4xnSDxMaL',
    'documentary-warm': 'nPczCjzI2devNBz1zQrb',
    'storyteller-expressive': 'JBFqnCBsd6RMkjVDRZzb',
  };

export interface NewProductionOptions {
  rootDir?: string;
  cwd?: string;
  dir?: string;
  slug: string;
  kit?: ScaffoldKitId;
  style?: string;
  voice?: string;
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

export function resolveScaffoldStyle(
  studioDir: string,
  styleId?: string
): StylePreset {
  const requested = (styleId ?? 'minimal-product').trim();
  const { styles: customStyles } = loadWorkspaceCustomStyles(studioDir);
  const matchedCustom = customStyles.find((s) => s.id === requested);
  if (matchedCustom) {
    return matchedCustom;
  }
  if (isBuiltInStyleId(requested)) {
    return BUILT_IN_STYLES[requested];
  }
  return BUILT_IN_STYLES['minimal-product'];
}

export function buildScaffoldProductionManifest(
  slug: string,
  title: string,
  kit: ScaffoldKitId,
  lang: 'pl' | 'en',
  options?: {
    style?: StylePreset;
    voiceId?: string;
  }
): ProductionManifest {
  const isPl = lang === 'pl';
  const resolvedStyle = options?.style ?? BUILT_IN_STYLES['minimal-product'];
  const mood: MusicMoodPreset = options?.style
    ? resolvedStyle.audioDefaults.musicMood
    : moodForKit(kit);
  const voiceId =
    options?.voiceId?.trim() ||
    VOICE_ARCHETYPE_TO_ELEVENLABS_ID[
      resolvedStyle.audioDefaults.voiceArchetype
    ];

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
        voiceId,
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
        voiceId,
        speaker: kit === 'isometric-3d' ? 'Partner' : 'Narrator',
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
  lang: 'pl' | 'en',
  style: StylePreset = BUILT_IN_STYLES['minimal-product']
): Record<string, unknown> {
  const isPl = lang === 'pl';
  return {
    styleId: style.id,
    headline: title,
    subheadline: isPl
      ? 'Odizolowana produkcja 60 FPS • make.pictures'
      : 'Isolated 60 FPS production • make.pictures',
    badgeLabel: kit.toUpperCase(),
    accentColor: style.palette.accentPrimary,
    secondaryColor: style.palette.accentSecondary,
    voiceoverVolume: 1.0,
    musicVolume: 0.25,
    sfxVolume: 0.35,
  };
}

function buildSchemaBlock(pascalName: string): string {
  return `export const ${pascalName}Schema = z.object({
  styleId: z.string().describe('Kolory & Styl :: Styl bazowy (Style ID)'),
  headline: z.string().describe('Teksty & Napisy :: Nagłówek'),
  subheadline: z.string().describe('Teksty & Napisy :: Podtytuł'),
  badgeLabel: z.string().describe('Teksty & Napisy :: Etykieta zestawu'),
  accentColor: z.string().describe('Kolory & Styl :: Akcent główny'),
  secondaryColor: z.string().describe('Kolory & Styl :: Akcent drugi'),
  voiceoverVolume: z.number().min(0).max(1.5).describe('Audio :: Głośność lektora'),
  musicVolume: z.number().min(0).max(1).describe('Audio :: Głośność muzyki'),
  sfxVolume: z.number().min(0).max(1).describe('Audio :: Głośność SFX'),
});

export type ${pascalName}Props = z.infer<typeof ${pascalName}Schema>;`;
}

function buildAudioJsxBlock(): string {
  return `{MUSIC_MANIFEST?.audioFile ? (
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
        ) : null}`;
}

export function buildScaffoldCompositionTsx(params: {
  slug: string;
  pascalName: string;
  kit: ScaffoldKitId;
}): string {
  const { slug, pascalName, kit } = params;
  const schemaBlock = buildSchemaBlock(pascalName);
  const audioBlock = buildAudioJsxBlock();

  switch (kit) {
    case 'editorial-collage':
      return `import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  staticFile,
} from 'remotion';
import { z } from 'zod';
import {
  SmartMusicBed,
  SoundCue,
  StyleProvider,
  VoiceoverTrack,
} from '@make-pictures/core';
import {
  ChapterTitleCard,
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
  { sceneId: '${slug}-intro', fromFrame: 12, durationInFrames: 300 },
  { sceneId: '${slug}-payoff', fromFrame: 324, durationInFrames: 306 },
];

export const ${pascalName}: React.FC<${pascalName}Props> = (props) => {
  const introVo = VOICEOVER_MANIFEST['${slug}-intro'];
  const payoffVo = VOICEOVER_MANIFEST['${slug}-payoff'];
  const whooshSfx = SFX_MANIFEST['whoosh-open'];
  const popSfx = SFX_MANIFEST['card-pop'];

  return (
    <StyleProvider style={props.styleId} renderBackdrop>
      <AbsoluteFill>
        ${audioBlock}

        <Sequence from={0} durationInFrames={220}>
          <ChapterTitleCard
            chapterLabel={props.badgeLabel}
            title={props.headline}
            subtitle={props.subheadline}
            startFrame={2}
            accentColor={props.accentColor}
          />
        </Sequence>

        <Sequence from={220} durationInFrames={210}>
          <SplitStoryLayout
            startFrame={2}
            primary={
              <EditorialMediaCard
                caption={props.headline}
                sourceTag={props.badgeLabel}
                startFrame={2}
                durationInFrames={195}
              />
            }
            secondary={
              <EditorialMediaCard
                caption={props.subheadline}
                sourceTag={props.styleId}
                startFrame={10}
                durationInFrames={195}
                zoomFrom={1.04}
                zoomTo={1.12}
              />
            }
          />
        </Sequence>

        <Sequence from={430} durationInFrames={218}>
          <HighlightQuoteStage
            quote={payoffVo?.text || props.subheadline}
            highlightPhrase="sześćdziesięciu"
            author={props.headline}
            startFrame={2}
            words={payoffVo?.words}
          />
        </Sequence>
      </AbsoluteFill>
    </StyleProvider>
  );
};
`;

    case 'kinetic-typography':
      return `import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  staticFile,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import {
  SmartMusicBed,
  SoundCue,
  StyleProvider,
  VoiceoverTrack,
} from '@make-pictures/core';
import {
  AnimatedMetricCounter,
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
  { sceneId: '${slug}-intro', fromFrame: 12, durationInFrames: 300 },
  { sceneId: '${slug}-payoff', fromFrame: 324, durationInFrames: 306 },
];

export const ${pascalName}: React.FC<${pascalName}Props> = (props) => {
  const { width, height } = useVideoConfig();
  const isVertical = height > width;

  const introVo = VOICEOVER_MANIFEST['${slug}-intro'];
  const payoffVo = VOICEOVER_MANIFEST['${slug}-payoff'];
  const whooshSfx = SFX_MANIFEST['whoosh-open'];
  const popSfx = SFX_MANIFEST['card-pop'];

  return (
    <StyleProvider style={props.styleId} renderBackdrop>
      <AbsoluteFill>
        ${audioBlock}

        <Sequence from={0} durationInFrames={320}>
          <WordByWordStage
            sceneId="${slug}-intro"
            voiceoverManifest={VOICEOVER_MANIFEST}
            fallbackText={\`\${props.headline} — \${props.subheadline}\`}
            eyebrow={props.badgeLabel}
            accentColor={props.accentColor}
            variant="transparent"
            startFrame={2}
          />
        </Sequence>

        <Sequence from={320} durationInFrames={328}>
          <AbsoluteFill
            style={{
              justifyContent: isVertical ? 'flex-start' : 'center',
              alignItems: isVertical ? 'flex-start' : 'center',
              paddingLeft: isVertical ? 54 : 120,
              paddingRight: isVertical ? 186 : 120,
              paddingTop: isVertical ? 260 : 0,
              gap: 28,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: isVertical ? 830 : 1040 }}>
              <ImpactKeywordCard
                keyword={props.headline}
                eyebrow={props.badgeLabel}
                sublabel={props.subheadline}
                badge="60 FPS"
                accentColor={props.accentColor}
                startFrame={2}
              />
              <AnimatedMetricCounter
                value={60}
                suffix=" FPS"
                label="Deterministyczny silnik wideo"
                badge="-14 LUFS"
                accentColor={props.secondaryColor}
                startFrame={14}
              />
            </div>
          </AbsoluteFill>
        </Sequence>
      </AbsoluteFill>
    </StyleProvider>
  );
};
`;

    case 'data-storytelling':
      return `import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  staticFile,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import {
  SmartMusicBed,
  SoundCue,
  StyleProvider,
  VoiceoverTrack,
} from '@make-pictures/core';
import {
  AnimatedBarRace,
  MetricComparisonCard,
} from '@make-pictures/kits/data-storytelling';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from '../generated/audio-manifest';

${schemaBlock}

const DIALOGUE_SEGMENTS = [
  { sceneId: '${slug}-intro', fromFrame: 12, durationInFrames: 300 },
  { sceneId: '${slug}-payoff', fromFrame: 324, durationInFrames: 306 },
];

export const ${pascalName}: React.FC<${pascalName}Props> = (props) => {
  const { width, height } = useVideoConfig();
  const isVertical = height > width;

  const introVo = VOICEOVER_MANIFEST['${slug}-intro'];
  const payoffVo = VOICEOVER_MANIFEST['${slug}-payoff'];
  const whooshSfx = SFX_MANIFEST['whoosh-open'];
  const popSfx = SFX_MANIFEST['card-pop'];

  return (
    <StyleProvider style={props.styleId} renderBackdrop>
      <AbsoluteFill>
        ${audioBlock}

        <Sequence from={0} durationInFrames={320}>
          <AbsoluteFill
            style={{
              justifyContent: isVertical ? 'flex-start' : 'center',
              alignItems: isVertical ? 'flex-start' : 'center',
              paddingLeft: isVertical ? 52 : 140,
              paddingRight: isVertical ? 184 : 140,
              paddingTop: isVertical ? 250 : 0,
            }}
          >
            <AnimatedBarRace
              title={props.headline}
              subtitle={props.subheadline}
              valueSuffix=" pkt"
              startFrame={2}
              items={[
                {
                  id: 'clarity',
                  label: 'Czytelność narracji',
                  value: 96,
                  color: props.accentColor,
                },
                {
                  id: 'sync',
                  label: 'Synchronizacja audio',
                  value: 91,
                  color: props.secondaryColor,
                },
                {
                  id: 'pacing',
                  label: 'Rytm ujęć 60 FPS',
                  value: 87,
                },
              ]}
            />
          </AbsoluteFill>
        </Sequence>

        <Sequence from={320} durationInFrames={328}>
          <AbsoluteFill
            style={{
              justifyContent: isVertical ? 'flex-start' : 'center',
              alignItems: isVertical ? 'flex-start' : 'center',
              paddingLeft: isVertical ? 52 : 140,
              paddingRight: isVertical ? 184 : 140,
              paddingTop: isVertical ? 260 : 0,
            }}
          >
            <MetricComparisonCard
              title={props.headline}
              beforeLabel="Ręczny montaż"
              beforeValue={24}
              afterLabel="Video-as-Code"
              afterValue={60}
              unit=" FPS"
              afterColor={props.accentColor}
              startFrame={2}
            />
          </AbsoluteFill>
        </Sequence>
      </AbsoluteFill>
    </StyleProvider>
  );
};
`;

    case 'motion-diagrams-2d':
      return `import React from 'react';
import {
  AbsoluteFill,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import {
  DirectorCamera2D,
  SmartMusicBed,
  SoundCue,
  StyleProvider,
  VoiceoverTrack,
  formatFontFamilyCss,
  formatHeadingText,
  getCardChromeStyle,
  getStyleSpringConfig,
  useStudioStyle,
} from '@make-pictures/core';
import {
  FlowCurve,
  WorldBox,
  portLeft,
  portRight,
  type NodeBox,
} from '@make-pictures/kits/motion-diagrams-2d';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from '../generated/audio-manifest';

${schemaBlock}

const DIALOGUE_SEGMENTS = [
  { sceneId: '${slug}-intro', fromFrame: 12, durationInFrames: 300 },
  { sceneId: '${slug}-payoff', fromFrame: 324, durationInFrames: 306 },
];

const SOURCE_NODE: NodeBox = { cx: 560, cy: 540, w: 460, h: 230 };
const TARGET_NODE: NodeBox = { cx: 1360, cy: 540, w: 460, h: 230 };

const DiagramCanvas: React.FC<${pascalName}Props> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = useStudioStyle();

  const sourceEnter =
    frame < 2
      ? 0
      : spring({
          frame: frame - 2,
          fps,
          config: getStyleSpringConfig(style, 'enter'),
        });
  const targetEnter =
    frame < 14
      ? 0
      : spring({
          frame: frame - 14,
          fps,
          config: getStyleSpringConfig(style, 'enter'),
        });

  return (
    <DirectorCamera2D
      nodes={{ source: SOURCE_NODE, target: TARGET_NODE }}
      shots={[
        { fromFrame: 0, target: ['source', 'target'], padding: 140 },
        { fromFrame: 320, target: 'target', padding: 180, transition: 'glide' },
      ]}
      showGrid={false}
      handheldIntensity={style.motion.cameraHandheld}
    >
      <FlowCurve
        from={portRight(SOURCE_NODE)}
        to={portLeft(TARGET_NODE)}
        curveY={-48}
        color={props.accentColor}
        activeFromFrame={18}
        packetSpeedFrames={96}
      />

      <WorldBox
        node={SOURCE_NODE}
        opacity={sourceEnter}
        scale={0.94 + 0.06 * sourceEnter}
        style={getCardChromeStyle(style, {
          padding: '28px 32px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 10,
        })}
      >
        <div
          style={{
            fontFamily: formatFontFamilyCss(style.typography.monoFont, 'mono'),
            fontSize: 16,
            fontWeight: 700,
            color: props.accentColor,
          }}
        >
          {props.badgeLabel}
        </div>
        <div
          style={{
            fontFamily: formatFontFamilyCss(style.typography.displayFont, 'display'),
            fontSize: 34,
            fontWeight: 700,
            color: style.palette.textPrimary,
          }}
        >
          {formatHeadingText(props.headline, style)}
        </div>
      </WorldBox>

      <WorldBox
        node={TARGET_NODE}
        opacity={targetEnter}
        scale={0.94 + 0.06 * targetEnter}
        style={getCardChromeStyle(style, {
          padding: '28px 32px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 10,
        })}
      >
        <div
          style={{
            fontFamily: formatFontFamilyCss(style.typography.monoFont, 'mono'),
            fontSize: 16,
            fontWeight: 700,
            color: props.secondaryColor,
          }}
        >
          60 FPS • -14 LUFS
        </div>
        <div
          style={{
            fontFamily: formatFontFamilyCss(style.typography.bodyFont, 'body'),
            fontSize: 24,
            lineHeight: 1.35,
            color: style.palette.textSecondary,
          }}
        >
          {props.subheadline}
        </div>
      </WorldBox>
    </DirectorCamera2D>
  );
};

export const ${pascalName}: React.FC<${pascalName}Props> = (props) => {
  const introVo = VOICEOVER_MANIFEST['${slug}-intro'];
  const payoffVo = VOICEOVER_MANIFEST['${slug}-payoff'];
  const whooshSfx = SFX_MANIFEST['whoosh-open'];
  const popSfx = SFX_MANIFEST['card-pop'];

  return (
    <StyleProvider style={props.styleId} renderBackdrop>
      <AbsoluteFill>
        ${audioBlock}
        <DiagramCanvas {...props} />
      </AbsoluteFill>
    </StyleProvider>
  );
};
`;

    case 'paper-diorama-3d':
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
  StyleProvider,
  VoiceoverTrack,
  useStudioStyle,
} from '@make-pictures/core';
import {
  DioramaStage3D,
  PaperCameraRig3D,
  PaperCutout3D,
  PaperStageLighting3D,
  PopUpHinge3D,
} from '@make-pictures/kits/paper-diorama-3d';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from '../generated/audio-manifest';

${schemaBlock}

const DIALOGUE_SEGMENTS = [
  { sceneId: '${slug}-intro', fromFrame: 12, durationInFrames: 300 },
  { sceneId: '${slug}-payoff', fromFrame: 324, durationInFrames: 306 },
];

const DioramaScene: React.FC<${pascalName}Props> = (props) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();

  if (frame < 2) {
    return null;
  }

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

  const camDriftX = Math.sin(frame * 0.032) * 0.28;
  const camZ = interpolate(frame, [0, 630], [9.6, 8.4], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ opacity: stageReveal }}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows
        camera={{ position: [0, 3.0, 9.6], fov: 36 }}
      >
        <PaperCameraRig3D
          cameraPos={[camDriftX, 2.95, camZ]}
          lookAt={[0, 1.35, -0.3]}
          fov={36}
        />
        <PaperStageLighting3D
          preset={style.surface.isDark ? 'dramatic-night' : 'studio-bright'}
        />
        <DioramaStage3D
          variant="minimal-plinth"
          surfacePattern="spotlight"
          accentColor={props.accentColor}
        >
          <PopUpHinge3D foldProgress={hingeFold} position={[0, 0, -0.25]}>
            <PaperCutout3D
              cacheKey="${slug}-hero-card"
              cacheDeps={[
                props.headline,
                props.subheadline,
                props.accentColor,
                style.palette.bgSurface,
                style.palette.textPrimary,
              ]}
              width={5.8}
              height={2.45}
              pixelWidth={720}
              pixelHeight={304}
              whiteBorderPx={14}
              position={[0, 0, 0]}
              thickness={0.055}
              draw={(ctx) => {
                ctx.fillStyle = style.palette.bgSurface;
                ctx.strokeStyle = props.accentColor;
                ctx.lineWidth = 8;
                ctx.beginPath();
                ctx.roundRect(28, 28, 664, 248, 26);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = style.palette.textPrimary;
                ctx.font = '800 44px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(props.headline, 360, 136, 616);

                ctx.fillStyle = style.palette.textSecondary;
                ctx.font = '600 24px Inter, sans-serif';
                ctx.fillText(props.subheadline, 360, 192, 616);
              }}
            />
          </PopUpHinge3D>
        </DioramaStage3D>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

export const ${pascalName}: React.FC<${pascalName}Props> = (props) => {
  const introVo = VOICEOVER_MANIFEST['${slug}-intro'];
  const payoffVo = VOICEOVER_MANIFEST['${slug}-payoff'];
  const whooshSfx = SFX_MANIFEST['whoosh-open'];
  const popSfx = SFX_MANIFEST['card-pop'];

  return (
    <StyleProvider style={props.styleId} renderBackdrop>
      <AbsoluteFill>
        ${audioBlock}
        <DioramaScene {...props} />
      </AbsoluteFill>
    </StyleProvider>
  );
};
`;

    case 'isometric-3d':
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
  StyleProvider,
  VoiceoverTrack,
} from '@make-pictures/core';
import {
  IsometricStage3D,
  Stylized3DCharacter,
} from '@make-pictures/kits/isometric-3d';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from '../generated/audio-manifest';

${schemaBlock}

const DIALOGUE_SEGMENTS = [
  { sceneId: '${slug}-intro', fromFrame: 12, durationInFrames: 300 },
  { sceneId: '${slug}-payoff', fromFrame: 324, durationInFrames: 306 },
];

const IsometricDialogueScene: React.FC<${pascalName}Props> = (props) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  if (frame < 2) {
    return null;
  }

  const stageReveal = spring({
    frame: frame - 2,
    fps,
    config: SPRING_PRESETS.snappy,
  });

  const turnSwitch = spring({
    frame: frame - 320,
    fps,
    config: SPRING_PRESETS.smooth,
  });

  const speakerAWeight = interpolate(turnSwitch, [0, 1], [1, 0]);
  const speakerBWeight = interpolate(turnSwitch, [0, 1], [0, 1]);
  const cadencePulse = 0.45 + 0.35 * Math.sin(frame * 0.16);

  return (
    <AbsoluteFill style={{ opacity: stageReveal }}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows
        camera={{ position: [0, 4.6, 8.6], fov: 35 }}
      >
        <IsometricStage3D
          radius={5.2}
          showGrid
          accentColor={props.accentColor}
        >
          <Stylized3DCharacter
            position={[-1.55, 0, 0.25]}
            rotationY={0.42}
            primaryColor={props.accentColor}
            accentColor={props.secondaryColor}
            speechEnergy={cadencePulse * speakerAWeight}
            speakingWeight={speakerAWeight}
            gestureWeights={{
              presentRight: speakerAWeight * 0.65,
              listenNod: speakerBWeight * 0.5,
            }}
            enterFrame={4}
          />
          <Stylized3DCharacter
            position={[1.55, 0, 0.25]}
            rotationY={-0.42}
            primaryColor={props.secondaryColor}
            accentColor={props.accentColor}
            speechEnergy={cadencePulse * speakerBWeight}
            speakingWeight={speakerBWeight}
            gestureWeights={{
              presentLeft: speakerBWeight * 0.65,
              listenNod: speakerAWeight * 0.5,
            }}
            enterFrame={10}
          />
        </IsometricStage3D>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

export const ${pascalName}: React.FC<${pascalName}Props> = (props) => {
  const introVo = VOICEOVER_MANIFEST['${slug}-intro'];
  const payoffVo = VOICEOVER_MANIFEST['${slug}-payoff'];
  const whooshSfx = SFX_MANIFEST['whoosh-open'];
  const popSfx = SFX_MANIFEST['card-pop'];

  return (
    <StyleProvider style={props.styleId} renderBackdrop>
      <AbsoluteFill>
        ${audioBlock}
        <IsometricDialogueScene {...props} />
      </AbsoluteFill>
    </StyleProvider>
  );
};
`;

    case 'vector-scene-2d':
    default:
      return `import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  staticFile,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import {
  SmartMusicBed,
  SoundCue,
  StyleProvider,
  VoiceoverTrack,
} from '@make-pictures/core';
import {
  AnnotatedCallout2D,
  ComparisonSplit2D,
  StoryCard2D,
} from '@make-pictures/kits/vector-scene-2d';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from '../generated/audio-manifest';

${schemaBlock}

const DIALOGUE_SEGMENTS = [
  { sceneId: '${slug}-intro', fromFrame: 12, durationInFrames: 300 },
  { sceneId: '${slug}-payoff', fromFrame: 324, durationInFrames: 306 },
];

export const ${pascalName}: React.FC<${pascalName}Props> = (props) => {
  const { width, height } = useVideoConfig();
  const isVertical = height > width;

  const introVo = VOICEOVER_MANIFEST['${slug}-intro'];
  const payoffVo = VOICEOVER_MANIFEST['${slug}-payoff'];
  const whooshSfx = SFX_MANIFEST['whoosh-open'];
  const popSfx = SFX_MANIFEST['card-pop'];

  return (
    <StyleProvider style={props.styleId} renderBackdrop>
      <AbsoluteFill>
        ${audioBlock}

        <Sequence from={0} durationInFrames={320}>
          <AbsoluteFill
            style={{
              justifyContent: isVertical ? 'flex-start' : 'center',
              alignItems: isVertical ? 'flex-start' : 'center',
              paddingLeft: isVertical ? 54 : 160,
              paddingRight: isVertical ? 186 : 160,
              paddingTop: isVertical ? 280 : 0,
            }}
          >
            <div style={{ width: '100%', maxWidth: isVertical ? 836 : 980 }}>
              <StoryCard2D
                title={props.headline}
                subtitle={props.subheadline}
                badge={props.badgeLabel}
                accentColor={props.accentColor}
                startFrame={2}
              />
            </div>
          </AbsoluteFill>
          <AnnotatedCallout2D
            target={isVertical ? [472, 680] : [960, 560]}
            labelPosition={isVertical ? [472, 920] : [960, 820]}
            label="60 FPS • StyleProvider"
            startFrame={18}
            accentColor={props.secondaryColor}
          />
        </Sequence>

        <Sequence from={320} durationInFrames={328}>
          <ComparisonSplit2D
            startFrame={2}
            left={{
              tag: '01 • Scena',
              title: props.headline,
              detail: props.subheadline,
            }}
            right={{
              tag: '02 • Kierunek plastyczny',
              title: props.styleId,
              detail: 'Spójna typografia, paleta i mastering -14 LUFS',
            }}
          />
        </Sequence>
      </AbsoluteFill>
    </StyleProvider>
  );
};
`;
  }
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
  if (options.kit && !isValidScaffoldKitId(options.kit)) {
    throw new Error(
      `Unknown visual kit "${options.kit}". Supported kits: ${SCENES_KIT_IDS.join(', ')}`
    );
  }
  const kit: ScaffoldKitId = options.kit ?? 'vector-scene-2d';
  const lang: 'pl' | 'en' = options.lang ?? 'en';
  const resolvedStyle = resolveScaffoldStyle(studioDir, options.style);
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

  const manifest = buildScaffoldProductionManifest(slug, title, kit, lang, {
    style: resolvedStyle,
    voiceId: options.voice,
  });
  fs.writeFileSync(
    path.join(productionDir, 'production.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );

  const defaultProps = buildScaffoldPropsJson(title, kit, lang, resolvedStyle);
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
    `  • Composition:  ${path.relative(rootDir, path.join(productionDir, 'compositions', `${pascalName}.tsx`))} (${kit}, style: ${resolvedStyle.id})`
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
