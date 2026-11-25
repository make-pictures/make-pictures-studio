import fs from 'node:fs';
import path from 'node:path';
import {
  BUILT_IN_STYLE_IDS,
  BUILT_IN_STYLES,
  DimensionalSpaceSchema,
  isBuiltInStyleId,
  type BuiltInStyleId,
  type DimensionalSpace,
  type StylePreset,
  type VoiceArchetype,
} from '@make-pictures/remotion/style/presets';
import {
  DEFAULT_ELEVENLABS_MODEL_ID,
  VOICE_ARCHETYPE_TO_ELEVENLABS_ID_BY_LANG,
  getDefaultVoiceIdForArchetype,
  getDefaultVoiceIdForLang,
} from '@make-pictures/remotion/audio/voices';
import type {
  AudioManifestFile,
  MusicMoodPreset,
  SceneVoiceoverData,
} from '@make-pictures/remotion/types';
import {
  buildSyntheticWordTimestamps,
  computeSceneCacheHash,
  writeProductionAudioManifest,
} from './audio';
import { loadWorkspaceCustomStyles } from './styles';
import {
  loadMakePicturesConfig,
  resolveWorkspaceContext,
} from './workspace-paths';
import {
  blankCommentsPreservingNewlines,
  readJsxOpeningTagEnd,
} from '../utils/jsx-source-scan';

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

/**
 * Legacy English-default voice archetype map kept for backwards compatibility.
 * Prefer `getDefaultVoiceIdForArchetype(archetype, lang)` so Polish (`pl`)
 * productions always receive native Polish voices instead of English premades.
 */
export const VOICE_ARCHETYPE_TO_ELEVENLABS_ID: Record<VoiceArchetype, string> =
  VOICE_ARCHETYPE_TO_ELEVENLABS_ID_BY_LANG.en;

export { VOICE_ARCHETYPE_TO_ELEVENLABS_ID_BY_LANG, getDefaultVoiceIdForArchetype };

export function defaultKitAndStyleForSpace(space: DimensionalSpace): {
  kit: ScaffoldKitId;
  styleId: BuiltInStyleId;
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

export interface NewProductionOptions {
  rootDir?: string;
  cwd?: string;
  dir?: string;
  slug: string;
  space?: DimensionalSpace;
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
  if (!styleId || !styleId.trim()) {
    return BUILT_IN_STYLES['minimal-product'];
  }
  const requested = styleId.trim();
  const { styles: customStyles } = loadWorkspaceCustomStyles(studioDir);
  const matchedCustom = customStyles.find((s) => s.id === requested);
  if (matchedCustom) {
    return matchedCustom;
  }
  if (isBuiltInStyleId(requested)) {
    return BUILT_IN_STYLES[requested];
  }
  const available = [
    ...BUILT_IN_STYLE_IDS,
    ...customStyles.map((s) => s.id),
  ].join(', ');
  throw new Error(
    `Unknown style "${requested}". Available styles: ${available}. Run \`npx make-pictures styles\` to list all styles.`
  );
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
): AudioManifestFile {
  const isPl = lang === 'pl';
  const resolvedStyle = options?.style ?? BUILT_IN_STYLES['minimal-product'];
  const mood: MusicMoodPreset = options?.style
    ? resolvedStyle.audioDefaults.musicMood
    : moodForKit(kit);
  const voiceId =
    options?.voiceId?.trim() ||
    getDefaultVoiceIdForArchetype(
      resolvedStyle.audioDefaults.voiceArchetype,
      lang
    );

  return {
    id: slug,
    title,
    fps: 60,
    lang,
    modelId: DEFAULT_ELEVENLABS_MODEL_ID,
    scenes: [
      {
        id: `${slug}-intro`,
        title: isPl ? 'Scena 1 — Wprowadzenie' : 'Scene 1 — Opening Scene',
        durationInSeconds: 3.0,
        durationInFrames: 180,
        voiceId,
        speaker: 'Narrator',
        acousticPreset: 'clean',
        text: isPl
          ? `${title} otwiera spokojną opowieść pełną światła i ruchu.`
          : `${title} opens a calm visual story shaped by light.`,
      },
      {
        id: `${slug}-payoff`,
        title: isPl ? 'Scena 2 — Rozwinięcie' : 'Scene 2 — Core Insight',
        durationInSeconds: 3.0,
        durationInFrames: 180,
        voiceId,
        speaker: kit === 'isometric-3d' ? 'Partner' : 'Narrator',
        acousticPreset: 'clean',
        text: isPl
          ? 'Muzyka miękko ustępuje narracji, zostawiając przestrzeń na każdy obraz.'
          : 'Warm music yields gently to narration, giving every image room to breathe.',
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

export function buildScaffoldDefaultProps(
  title: string,
  _kit: ScaffoldKitId,
  lang: 'pl' | 'en',
  style: StylePreset = BUILT_IN_STYLES['minimal-product']
): Record<string, unknown> {
  const isPl = lang === 'pl';
  return {
    styleId: style.id,
    headline: title,
    subheadline: isPl
      ? 'Spokojna opowieść w świetle i ruchu'
      : 'Calm visual storytelling in light and motion',
    badgeLabel: isPl ? 'Rozdział 01' : 'Chapter 01',
    accentColor: style.palette.accentPrimary,
    secondaryColor: style.palette.accentSecondary,
    voiceoverVolume: 1.0,
    musicVolume: 0.25,
    sfxVolume: 0.22,
  };
}

function buildSchemaBlock(
  pascalName: string,
  defaultPropsObj: Record<string, unknown>,
  lang: 'pl' | 'en' = 'pl'
): string {
  const isPl = lang === 'pl';
  return `export const ${pascalName}Schema = z.object({
  styleId: z.string().describe('${isPl ? 'Kolory & Styl :: Styl bazowy (Style ID)' : 'Color & Style :: Base Style ID'}'),
  headline: z.string().describe('${isPl ? 'Teksty & Napisy :: Nagłówek' : 'Copy :: Headline'}'),
  subheadline: z.string().describe('${isPl ? 'Teksty & Napisy :: Podtytuł' : 'Copy :: Subheadline'}'),
  badgeLabel: z.string().describe('${isPl ? 'Teksty & Napisy :: Etykieta rozdziału' : 'Copy :: Chapter Badge'}'),
  accentColor: z.string().describe('${isPl ? 'Kolory & Styl :: Akcent główny' : 'Color & Style :: Primary Accent'}'),
  secondaryColor: z.string().describe('${isPl ? 'Kolory & Styl :: Akcent drugi' : 'Color & Style :: Secondary Accent'}'),
  voiceoverVolume: z.number().min(0).max(1.5).describe('${isPl ? 'Audio :: Głośność lektora' : 'Audio :: Voiceover Volume'}'),
  musicVolume: z.number().min(0).max(1).describe('${isPl ? 'Audio :: Głośność muzyki' : 'Audio :: Music Volume'}'),
  sfxVolume: z.number().min(0).max(1).describe('${isPl ? 'Audio :: Głośność SFX' : 'Audio :: SFX Volume'}'),
});

export type ${pascalName}Props = z.infer<typeof ${pascalName}Schema>;

export const default${pascalName}Props: ${pascalName}Props = ${JSON.stringify(
    defaultPropsObj,
    null,
    2
  )};`;
}

function buildAudioJsxBlock(): string {
  return `{MUSIC_MANIFEST?.audioFile ? (
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
}

export function buildScaffoldCompositionTsx(params: {
  slug: string;
  pascalName: string;
  kit: ScaffoldKitId;
  styleId?: string;
  lang?: 'pl' | 'en';
  title?: string;
  style?: StylePreset;
}): string {
  const { slug, pascalName, kit, styleId, lang = 'pl' } = params;
  const isPl = lang === 'pl';
  const resolvedStyle =
    params.style ??
    (styleId && isBuiltInStyleId(styleId)
      ? BUILT_IN_STYLES[styleId]
      : BUILT_IN_STYLES['minimal-product']);
  const defaultPropsObj = buildScaffoldDefaultProps(
    params.title ?? slugToHumanTitle(slug),
    kit,
    lang,
    resolvedStyle
  );
  if (styleId && !params.style) {
    defaultPropsObj.styleId = styleId;
  }
  const schemaBlock = buildSchemaBlock(pascalName, defaultPropsObj, lang);
  const audioBlock = buildAudioJsxBlock();

  switch (kit) {
    case 'editorial-collage':
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
} from '@make-pictures/remotion';
import {
  ChapterTitleCard,
  EditorialDeskStage,
  EditorialMediaCard,
  HighlightQuoteStage,
  SplitStoryLayout,
} from '@make-pictures/remotion/kits/editorial-collage';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from './generated/audio-manifest';

${schemaBlock}

const DIALOGUE_SEGMENTS = [
  { sceneId: '${slug}-intro', fromFrame: 42, durationInFrames: 180 },
  { sceneId: '${slug}-payoff', fromFrame: 402, durationInFrames: 180 },
];

const IntroEditorialScene: React.FC<${pascalName}Props> = (props) => {
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

const PayoffEditorialScene: React.FC<${pascalName}Props> = (props) => {
  const { width, height } = useVideoConfig();
  const payoffVo = VOICEOVER_MANIFEST['${slug}-payoff'];
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

export const ${pascalName}: React.FC<${pascalName}Props> = (props) => {
  const introVo = VOICEOVER_MANIFEST['${slug}-intro'];
  const payoffVo = VOICEOVER_MANIFEST['${slug}-payoff'];
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

    case 'kinetic-typography':
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
} from '@make-pictures/remotion';
import {
  ImpactKeywordCard,
  WordByWordStage,
} from '@make-pictures/remotion/kits/kinetic-typography';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from './generated/audio-manifest';

${schemaBlock}

const DIALOGUE_SEGMENTS = [
  { sceneId: '${slug}-intro', fromFrame: 42, durationInFrames: 180 },
  { sceneId: '${slug}-payoff', fromFrame: 402, durationInFrames: 180 },
];

const IntroKineticScene: React.FC<${pascalName}Props> = (props) => (
  <AbsoluteFill>
    <ScenicBackdropLayers seed="${slug}-kinetic-intro" />
    <StageLightingRig renderBaseFill={false} />
    <OpticalStage2D startFrame={2}>
      <DepthPlane z={0}>
        <WordByWordStage
          sceneId="${slug}-intro"
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

const PayoffKeywordScene: React.FC<${pascalName}Props> = (props) => {
  const { width, height } = useVideoConfig();
  const isVertical = height > width;

  return (
    <AbsoluteFill>
      <ScenicBackdropLayers seed="${slug}-kinetic-payoff" />
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

export const ${pascalName}: React.FC<${pascalName}Props> = (props) => {
  const introVo = VOICEOVER_MANIFEST['${slug}-intro'];
  const payoffVo = VOICEOVER_MANIFEST['${slug}-payoff'];
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

    case 'data-storytelling':
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
} from '@make-pictures/remotion';
import {
  AnimatedBarRace,
  DataStoryStage2D,
  MetricComparisonCard,
  TimelineTrack,
} from '@make-pictures/remotion/kits/data-storytelling';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from './generated/audio-manifest';

${schemaBlock}

const DIALOGUE_SEGMENTS = [
  { sceneId: '${slug}-intro', fromFrame: 42, durationInFrames: 180 },
  { sceneId: '${slug}-payoff', fromFrame: 402, durationInFrames: 180 },
];

const IntroDataScene: React.FC<${pascalName}Props> = (props) => {
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
          valueSuffix="${isPl ? ' pkt' : ' pts'}"
          startFrame={2}
          items={[
            {
              id: 'clarity',
              label: '${isPl ? 'Czytelność narracji' : 'Narrative clarity'}',
              value: 96,
              color: props.accentColor,
            },
            {
              id: 'harmony',
              label: '${isPl ? 'Spójność światła i barwy' : 'Light and color harmony'}',
              value: 91,
              color: props.secondaryColor,
            },
            {
              id: 'pacing',
              label: '${isPl ? 'Spokojny rytm ujęć' : 'Calm shot pacing'}',
              value: 88,
            },
          ]}
        />
      </AbsoluteFill>
    </DataStoryStage2D>
  );
};

const PayoffDataScene: React.FC<${pascalName}Props> = (props) => {
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
            beforeLabel="${isPl ? 'Statyczny slajd' : 'Static slide'}"
            beforeValue={31}
            afterLabel="${isPl ? 'Żywy obraz' : 'Living frame'}"
            afterValue={94}
            unit="${isPl ? ' pkt' : ' pts'}"
            afterColor={props.accentColor}
            startFrame={2}
          />
          <TimelineTrack
            startFrame={24}
            milestones={[
              { id: 'e1', era: '01', label: '${isPl ? 'Pomysł' : 'Concept'}', fromFrame: 24 },
              { id: 'e2', era: '02', label: '${isPl ? 'Świat sztuki' : 'Art world'}', fromFrame: 120 },
              { id: 'e3', era: '03', label: '${isPl ? 'Gotowy film' : 'Finished film'}', fromFrame: 216 },
            ]}
          />
        </div>
      </AbsoluteFill>
    </DataStoryStage2D>
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

    case 'motion-diagrams-2d':
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
} from '@make-pictures/remotion';
import {
  RetroPcWindowStage2D,
  type RetroPcHopSpec,
} from '@make-pictures/remotion/kits/motion-diagrams-2d';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from './generated/audio-manifest';

${schemaBlock}

const DIALOGUE_SEGMENTS = [
  { sceneId: '${slug}-intro', fromFrame: 42, durationInFrames: 180 },
  { sceneId: '${slug}-payoff', fromFrame: 402, durationInFrames: 180 },
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

const IntroRetroPcScene: React.FC<${pascalName}Props> = (props) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isVertical = height > width;

  if (frame < 2) {
    return null;
  }

  const progress = interpolate(frame, [16, 300], [0.08, 0.54], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <StageLightingRig renderBaseFill={false} seed="${slug}-retro-intro" />
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

const PayoffRetroPcScene: React.FC<${pascalName}Props> = (props) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isVertical = height > width;

  if (frame < 2) {
    return null;
  }

  const progress = interpolate(frame, [10, 290], [0.54, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <StageLightingRig renderBaseFill={false} seed="${slug}-retro-payoff" />
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

export const ${pascalName}: React.FC<${pascalName}Props> = (props) => {
  const introVo = VOICEOVER_MANIFEST['${slug}-intro'];
  const payoffVo = VOICEOVER_MANIFEST['${slug}-payoff'];
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
              render: () => <IntroRetroPcScene {...props} />,
            },
            {
              id: 'payoff',
              durationInFrames: 360,
              render: () => <PayoffRetroPcScene {...props} />,
            },
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
} from '@make-pictures/remotion';
import {
  DataFlowEdge,
  MotionDiagramStage2D,
  SystemNode,
  portBottom,
  portLeft,
  portRight,
  portTop,
  type NodeBox,
} from '@make-pictures/remotion/kits/motion-diagrams-2d';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from './generated/audio-manifest';

${schemaBlock}

const DIALOGUE_SEGMENTS = [
  { sceneId: '${slug}-intro', fromFrame: 42, durationInFrames: 180 },
  { sceneId: '${slug}-payoff', fromFrame: 402, durationInFrames: 180 },
];

const HORIZONTAL_NODES = {
  first: { cx: 560, cy: 540, w: 430, h: 192 },
  second: { cx: 1360, cy: 540, w: 430, h: 192 },
} satisfies Record<string, NodeBox>;

const VERTICAL_NODES = {
  first: { cx: 475, cy: 560, w: 600, h: 184 },
  second: { cx: 475, cy: 940, w: 600, h: 184 },
} satisfies Record<string, NodeBox>;

const IntroDiagramScene: React.FC<${pascalName}Props> = (props) => {
  const { width, height } = useVideoConfig();
  const style = useStudioStyle();
  const isVertical = height > width;
  const nodes = isVertical ? VERTICAL_NODES : HORIZONTAL_NODES;

  return (
    <MotionDiagramStage2D
      renderBaseFill={false}
      nodes={nodes}
      shots={[
        {
          fromFrame: 0,
          target: ['first', 'second'],
          transition: 'cut',
          padding: isVertical ? 120 : 150,
        },
        {
          fromFrame: 168,
          target: ['first', 'second'],
          transition: 'glide',
          padding: isVertical ? 108 : 136,
        },
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
        label="${isPl ? 'Światło i rytm' : 'Light and rhythm'}"
      />

      <SystemNode
        id="first"
        badge={props.badgeLabel}
        title={props.headline}
        subtitle="${isPl ? 'Pomysł i narracja sceny' : 'Scene idea and narrative'}"
        statusText="${isPl ? 'Spokojne otwarcie' : 'Calm opening'}"
        activeStatusText="${isPl ? 'Przepływ aktywny' : 'Flow active'}"
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
        title="${isPl ? 'Kierunek sztuki' : 'Art direction'}"
        subtitle={props.subheadline}
        statusText="${isPl ? 'Oczekiwanie' : 'Standing by'}"
        activeStatusText="${isPl ? 'Kompozycja gotowa' : 'Composition ready'}"
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

const PayoffDiagramScene: React.FC<${pascalName}Props> = (props) => {
  const { width, height } = useVideoConfig();
  const style = useStudioStyle();
  const isVertical = height > width;
  const nodes = isVertical ? VERTICAL_NODES : HORIZONTAL_NODES;

  return (
    <MotionDiagramStage2D
      renderBaseFill={false}
      nodes={nodes}
      shots={[
        {
          fromFrame: 0,
          target: ['first', 'second'],
          transition: 'cut',
          padding: isVertical ? 120 : 150,
        },
        {
          fromFrame: 174,
          target: 'second',
          transition: 'glide',
          padding: isVertical ? 132 : 172,
        },
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
        label="${isPl ? 'Płynny obraz' : 'Fluid motion'}"
      />

      <SystemNode
        id="first"
        title="${isPl ? 'Kierunek sztuki' : 'Art direction'}"
        subtitle="${isPl ? 'Spójna paleta i typografia' : 'Cohesive palette and typography'}"
        statusText="${isPl ? 'Zharmonizowany' : 'Harmonized'}"
        activeStatusText="${isPl ? 'Prowadzenie ostrości' : 'Focus guidance'}"
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
        title="${isPl ? 'Gotowy film' : 'Finished film'}"
        subtitle={props.subheadline}
        statusText="${isPl ? 'Przygotowanie' : 'Preparing'}"
        activeStatusText="${isPl ? 'Czysty dźwięk i obraz' : 'Clean sound and picture'}"
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

export const ${pascalName}: React.FC<${pascalName}Props> = (props) => {
  const introVo = VOICEOVER_MANIFEST['${slug}-intro'];
  const payoffVo = VOICEOVER_MANIFEST['${slug}-payoff'];
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
              render: () => <IntroDiagramScene {...props} />,
            },
            {
              id: 'payoff',
              durationInFrames: 360,
              render: () => <PayoffDiagramScene {...props} />,
            },
          ]}
        />
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
  CINEMATIC_SPRINGS,
  ContinuousSceneFlow,
  SmartMusicBed,
  SoundCue,
  StyleProvider,
  VoiceoverTrack,
  useStudioStyle,
} from '@make-pictures/remotion';
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
} from '@make-pictures/remotion/kits/paper-diorama-3d';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from './generated/audio-manifest';

${schemaBlock}

const DIALOGUE_SEGMENTS = [
  { sceneId: '${slug}-intro', fromFrame: 42, durationInFrames: 180 },
  { sceneId: '${slug}-payoff', fromFrame: 402, durationInFrames: 180 },
];

const DioramaLandscapeScene: React.FC<${pascalName}Props> = (props) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const isVertical = height > width;

  if (frame < 2) {
    return null;
  }

  const stageReveal = spring({
    frame: frame - 2,
    fps,
    config: CINEMATIC_SPRINGS.entrance,
  });
  const archFold = spring({
    frame: frame - 4,
    fps,
    config: CINEMATIC_SPRINGS.entrance,
  });
  const mountainFold = spring({
    frame: frame - 14,
    fps,
    config: CINEMATIC_SPRINGS.entrance,
  });
  const groveFold = spring({
    frame: frame - 24,
    fps,
    config: CINEMATIC_SPRINGS.emphasis,
  });

  const cloudDrift = Math.sin(frame * 0.034) * 0.22;
  const camDriftX = Math.sin(frame * 0.032) * 0.24;
  const camZ = interpolate(
    frame,
    [0, 360],
    isVertical ? [13.2, 12.0] : [9.6, 8.6],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  return (
    <AbsoluteFill style={{ opacity: stageReveal }}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows
        camera={{ position: [0, 3.1, camZ], fov: 36 }}
      >
        <PaperCameraRig3D
          cameraPos={[camDriftX, isVertical ? 3.15 : 2.95, camZ]}
          lookAt={[0, isVertical ? 1.55 : 1.35, -0.4]}
          fov={36}
        />
        <PaperStageLighting3D
          preset={style.surface.isDark ? 'spotlight' : 'golden-hour'}
        />
        <DioramaStage3D
          variant="minimal-plinth"
          surfacePattern="spotlight"
          accentColor={props.accentColor}
        >
          <PopUpHinge3D foldProgress={archFold} position={[0, 0, -2.2]}>
            <SunburstArchCutout3D
              accentColor={props.accentColor}
              secondaryColor={props.secondaryColor}
            />
          </PopUpHinge3D>

          <PopUpHinge3D foldProgress={mountainFold} position={[0, 0, -1.25]}>
            <MountainRangeCutout3D
              accentColor={props.accentColor}
              secondaryColor={props.secondaryColor}
            />
          </PopUpHinge3D>

          <CloudCanopyCutout3D
            position={[-1.55 + cloudDrift, 2.35, -0.65]}
            anchor="center"
            width={2.8}
            height={1.1}
            seed="cloud-left"
          />
          <CloudCanopyCutout3D
            position={[1.65 - cloudDrift * 0.7, 2.55, -0.15]}
            anchor="center"
            width={2.5}
            height={1.0}
            seed="cloud-right"
          />

          <PopUpHinge3D foldProgress={groveFold} position={[-2.05, 0, 0.45]}>
            <PineGroveCutout3D
              accentColor={props.accentColor}
              secondaryColor={props.secondaryColor}
              seed="grove-left"
            />
          </PopUpHinge3D>

          <PopUpHinge3D foldProgress={groveFold} position={[2.05, 0, 0.95]}>
            <PineGroveCutout3D
              accentColor={props.accentColor}
              secondaryColor={props.secondaryColor}
              seed="grove-right"
            />
          </PopUpHinge3D>
        </DioramaStage3D>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

const DioramaAtelierScene: React.FC<${pascalName}Props> = (props) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const isVertical = height > width;

  if (frame < 2) {
    return null;
  }

  const stageReveal = spring({
    frame: frame - 2,
    fps,
    config: CINEMATIC_SPRINGS.entrance,
  });
  const deskFold = spring({
    frame: frame - 8,
    fps,
    config: CINEMATIC_SPRINGS.entrance,
  });

  const cloudDrift = Math.sin(frame * 0.036) * 0.18;
  const camDriftX = Math.cos(frame * 0.032) * 0.18;
  const camZ = interpolate(
    frame,
    [0, 360],
    isVertical ? [12.4, 11.4] : [8.8, 7.9],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  return (
    <AbsoluteFill style={{ opacity: stageReveal }}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows
        camera={{ position: [0, 2.85, camZ], fov: 35 }}
      >
        <PaperCameraRig3D
          cameraPos={[camDriftX, isVertical ? 2.95 : 2.75, camZ]}
          lookAt={[0, isVertical ? 1.35 : 1.15, 0.1]}
          fov={35}
        />
        <PaperStageLighting3D
          preset={style.surface.isDark ? 'spotlight' : 'golden-hour'}
        />
        <DioramaStage3D
          variant="minimal-plinth"
          surfacePattern="spotlight"
          accentColor={props.accentColor}
        >
          <SunburstArchCutout3D
            position={[0, 0, -2.15]}
            accentColor={props.accentColor}
            secondaryColor={props.secondaryColor}
          />
          <MountainRangeCutout3D
            position={[0, 0, -1.25]}
            accentColor={props.accentColor}
            secondaryColor={props.secondaryColor}
          />
          <CloudCanopyCutout3D
            position={[-1.4 + cloudDrift, 2.4, -0.65]}
            anchor="center"
            width={2.6}
            height={1.05}
            seed="atelier-cloud"
          />
          <PineGroveCutout3D
            position={[-2.15, 0, -0.05]}
            accentColor={props.accentColor}
            secondaryColor={props.secondaryColor}
            seed="atelier-grove-l"
          />
          <PineGroveCutout3D
            position={[2.15, 0, 0.45]}
            accentColor={props.accentColor}
            secondaryColor={props.secondaryColor}
            seed="atelier-grove-r"
          />
          <PopUpHinge3D foldProgress={deskFold} position={[0, 0, 1.0]}>
            <AtelierDeskCutout3D
              plaqueTitle={props.headline}
              accentColor={props.accentColor}
              secondaryColor={props.secondaryColor}
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

        <ContinuousSceneFlow
          crossDissolveFrames={48}
          style={{ backgroundColor: 'transparent' }}
          scenes={[
            {
              id: 'intro',
              durationInFrames: 360,
              usesThree: true,
              render: () => <DioramaLandscapeScene {...props} />,
            },
            {
              id: 'payoff',
              durationInFrames: 360,
              usesThree: true,
              render: () => <DioramaAtelierScene {...props} />,
            },
          ]}
        />
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
  SmartMusicBed,
  SoundCue,
  StyleProvider,
  VoiceoverTrack,
  formatFontFamilyCss,
  formatHeadingText,
  getTactileSurfaceStyle,
  useStudioStyle,
} from '@make-pictures/remotion';
import { DirectorCamera3D } from '@make-pictures/remotion/camera';
import {
  ClayCharacter3D,
  PodcastStudioSet3D,
  StudioHdrRig3D,
  computePodcastStudioLayout,
} from '@make-pictures/remotion/kits/isometric-3d';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from './generated/audio-manifest';

${schemaBlock}

const DIALOGUE_SEGMENTS = [
  { sceneId: '${slug}-intro', fromFrame: 42, durationInFrames: 180 },
  { sceneId: '${slug}-payoff', fromFrame: 402, durationInFrames: 180 },
];

const PodcastStudioTurn: React.FC<
  ${pascalName}Props & { activeSpeaker: 'A' | 'B' }
> = (props) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const isVertical = height > width;

  if (frame < 2) {
    return null;
  }

  const stageReveal = spring({
    frame: frame - 2,
    fps,
    config: CINEMATIC_SPRINGS.entrance,
  });

  const layout = computePodcastStudioLayout({ compactVertical: isVertical });
  const speakerAWeight = props.activeSpeaker === 'A' ? 1 : 0;
  const speakerBWeight = props.activeSpeaker === 'B' ? 1 : 0;
  // Calm <= 0.055 rad/frame syllable envelope fallback before real TTS words
  const cadencePulse =
    0.42 + 0.28 * Math.sin(frame * 0.044) + 0.16 * Math.cos(frame * 0.034);
  const activeAccent =
    props.activeSpeaker === 'A' ? props.accentColor : props.secondaryColor;

  return (
    <AbsoluteFill style={{ opacity: stageReveal }}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows
        camera={{ position: [0, 3.6, 7.6], fov: 35 }}
      >
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
                  {
                    fromFrame: 0,
                    shot: 'medium-two-shot',
                    target: 'leftHost',
                    secondaryTarget: 'rightHost',
                    transition: 'cut',
                  },
                  {
                    fromFrame: 180,
                    shot: 'medium-two-shot',
                    target: 'leftHost',
                    secondaryTarget: 'rightHost',
                    angleDeg: 7,
                    transition: 'glide',
                  },
                ]
              : [
                  {
                    fromFrame: 0,
                    shot: 'medium-two-shot',
                    target: 'rightHost',
                    secondaryTarget: 'leftHost',
                    angleDeg: -6,
                    transition: 'cut',
                  },
                  {
                    fromFrame: 168,
                    shot: 'medium',
                    target: 'rightHost',
                    secondaryTarget: 'leftHost',
                    transition: 'glide',
                  },
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

      {/* Architectural Conversation Nameplate (strictly inside 9:16 Safe Box x in [40, 910], y in [220, 1380]) */}
      <div
        style={getTactileSurfaceStyle(style, {
          elevation: 'resting',
          overrides: {
            position: 'absolute',
            left: isVertical ? 76 : 72,
            top: isVertical ? 248 : 56,
            width: isVertical ? 788 : 540,
            padding: '16px 22px',
            borderRadius: Math.max(
              0,
              Math.round(10 * style.surface.radiusScale)
            ),
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
            fontFamily: formatFontFamilyCss(
              style.typography.displayFont,
              'display'
            ),
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

export const ${pascalName}: React.FC<${pascalName}Props> = (props) => {
  const introVo = VOICEOVER_MANIFEST['${slug}-intro'];
  const payoffVo = VOICEOVER_MANIFEST['${slug}-payoff'];
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
              usesThree: true,
              render: () => <PodcastStudioTurn {...props} activeSpeaker="A" />,
            },
            {
              id: 'payoff',
              durationInFrames: 360,
              usesThree: true,
              render: () => <PodcastStudioTurn {...props} activeSpeaker="B" />,
            },
          ]}
        />
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
} from '@make-pictures/remotion';
import {
  AnnotatedCallout2D,
  ComparisonSplit2D,
  StoryCard2D,
  VectorSceneStage2D,
} from '@make-pictures/remotion/kits/vector-scene-2d';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from './generated/audio-manifest';

${schemaBlock}

const DIALOGUE_SEGMENTS = [
  { sceneId: '${slug}-intro', fromFrame: 42, durationInFrames: 180 },
  { sceneId: '${slug}-payoff', fromFrame: 402, durationInFrames: 180 },
];

const IntroVectorScene: React.FC<${pascalName}Props> = (props) => {
  const { width, height } = useVideoConfig();
  const isVertical = height > width;

  return (
    <VectorSceneStage2D
      renderBaseFill={false}
      foregroundCallouts={
        <AnnotatedCallout2D
          target={isVertical ? [360, 650] : [960, 560]}
          labelPosition={isVertical ? [590, 860] : [1180, 790]}
          label="${isPl ? 'Punkt skupienia' : 'Focal point'}"
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

const PayoffVectorScene: React.FC<${pascalName}Props> = (props) => (
  <VectorSceneStage2D renderBaseFill={false}>
    <ComparisonSplit2D
      startFrame={2}
      focusShiftFrame={150}
      left={{
        tag: '${isPl ? 'Punkt wyjścia' : 'Starting point'}',
        title: props.headline,
        detail: props.subheadline,
      }}
      right={{
        tag: '${isPl ? 'Kierunek sztuki' : 'Art direction'}',
        title: props.styleId,
        detail: '${isPl ? 'Spójne światło, faktura i płynny ruch' : 'Cohesive light, texture, and fluid motion'}',
      }}
    />
  </VectorSceneStage2D>
);

export const ${pascalName}: React.FC<${pascalName}Props> = (props) => {
  const introVo = VOICEOVER_MANIFEST['${slug}-intro'];
  const payoffVo = VOICEOVER_MANIFEST['${slug}-payoff'];
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
              render: () => <IntroVectorScene {...props} />,
            },
            {
              id: 'payoff',
              durationInFrames: 360,
              render: () => <PayoffVectorScene {...props} />,
            },
          ]}
        />
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

  return `import {
  ${pascalName},
  ${pascalName}Schema,
  default${pascalName}Props,
} from './${pascalName}';
import { VOICEOVER_MANIFEST } from './generated/audio-manifest';

export const compositionMeta = {
  id: '${pascalName}',
  slug: '${slug}',
  title: '${title}',
  kit: '${kit}',
  fps: 60,
  width: 1920,
  height: 1080,
  durationInFrames: 720,
  usesThree: ${usesThree},
  sceneTimeline: [
    {
      sceneId: '${slug}-intro',
      fromFrame: 42,
      durationInFrames: 180,
      label: '1. Intro',
    },
    {
      sceneId: '${slug}-payoff',
      fromFrame: 402,
      durationInFrames: 180,
      label: '2. Payoff',
    },
  ],
} as const;

export {
  ${pascalName},
  ${pascalName}Schema,
  default${pascalName}Props,
  VOICEOVER_MANIFEST,
};
`;
}

export function buildPrepopulatedVoiceovers(
  manifest: AudioManifestFile
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
      voiceId:
        scene.voiceId ||
        manifest.voiceId ||
        getDefaultVoiceIdForLang(manifest.lang),
      modelId:
        scene.modelId || manifest.modelId || DEFAULT_ELEVENLABS_MODEL_ID,
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

function findLastTopLevelImportEnd(source: string): number {
  const cleaned = blankCommentsPreservingNewlines(source);
  // Matches both `import ... from '...'` (single or multiline) and side-effect `import '...'`, with or without trailing `;`
  const importStmtRe =
    /^[ \t]*import\s+(?:(?:type\s+)?[\s\S]*?\bfrom\s+['"][^'"]+['"]|['"][^'"]+['"])[ \t]*;?[ \t]*$/gm;
  let lastEnd = -1;
  let m: RegExpExecArray | null;
  while ((m = importStmtRe.exec(cleaned)) !== null) {
    lastEnd = m.index + m[0].length;
  }
  return lastEnd;
}

/**
 * Registers a newly scaffolded composition inside `<studioDir>/src/Root.tsx` using standard
 * Remotion `<Composition id=... component=... schema=... defaultProps=... />` syntax.
 * Creates a clean `src/Root.tsx` if none exists yet, handles semicolon-less (`semi: false`) imports
 * and single-element `<Composition />` roots cleanly, and is idempotent if `id` is already present.
 */
export function registerCompositionInRootTsx(params: {
  rootTsxPath: string;
  compositionId: string;
  importRelPath: string;
  durationInFrames?: number;
  fps?: number;
  width?: number;
  height?: number;
}): { updated: boolean; created: boolean; warning?: string } {
  const {
    rootTsxPath,
    compositionId,
    importRelPath,
    durationInFrames = 720,
    fps = 60,
    width = 1920,
    height = 1080,
  } = params;

  const schemaName = `${compositionId}Schema`;
  const defaultPropsName = `default${compositionId}Props`;
  const normalizedImport = importRelPath.replace(/\\/g, '/').replace(/\.tsx?$/, '');
  const importLine = `import { ${compositionId}, ${schemaName}, ${defaultPropsName} } from '${normalizedImport}';`;
  const compElement = `      <Composition
        id="${compositionId}"
        component={${compositionId}}
        schema={${schemaName}}
        defaultProps={${defaultPropsName}}
        durationInFrames={${durationInFrames}}
        fps={${fps}}
        width={${width}}
        height={${height}}
      />`;

  if (!fs.existsSync(rootTsxPath)) {
    fs.mkdirSync(path.dirname(rootTsxPath), { recursive: true });
    const freshRoot = `import React from 'react';
import { Composition } from 'remotion';
${importLine}

export const RemotionRoot: React.FC = () => {
  return (
    <>
${compElement}
    </>
  );
};
`;
    fs.writeFileSync(rootTsxPath, freshRoot, 'utf8');
    return { updated: true, created: true };
  }

  const existing = fs.readFileSync(rootTsxPath, 'utf8');
  const escapedId = compositionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`\\bid\\s*=\\s*["']${escapedId}["']`).test(existing)) {
    return { updated: false, created: false };
  }

  let next = existing;
  const lastImportEnd = findLastTopLevelImportEnd(next);
  if (lastImportEnd !== -1) {
    next = `${next.slice(0, lastImportEnd)}\n${importLine}${next.slice(lastImportEnd)}`;
  } else {
    next = `${importLine}\n${next}`;
  }

  const fragmentCloseIdx = next.lastIndexOf('</>');
  const reactFragmentCloseIdx = next.lastIndexOf('</React.Fragment>');
  const insertionIdx =
    fragmentCloseIdx !== -1 ? fragmentCloseIdx : reactFragmentCloseIdx;

  if (insertionIdx !== -1) {
    next = `${next.slice(0, insertionIdx)}${compElement}\n    ${next.slice(insertionIdx)}`;
    fs.writeFileSync(rootTsxPath, next, 'utf8');
    return { updated: true, created: false };
  }

  // Fallback for single-element Root.tsx without a `<>...</>` fragment: wrap the existing <Composition ... /> in a fragment
  const cleanedNext = blankCommentsPreservingNewlines(next);
  const compRe = /<Composition(?=[\s>/])/g;
  let lastCompStart = -1;
  let lastCompEnd = -1;
  let cm: RegExpExecArray | null;
  while ((cm = compRe.exec(cleanedNext)) !== null) {
    const tagEnd = readJsxOpeningTagEnd(cleanedNext, cm.index);
    if (tagEnd === -1) continue;
    const isSelfClosing = cleanedNext.slice(cm.index, tagEnd + 1).trimEnd().endsWith('/>');
    if (isSelfClosing) {
      lastCompStart = cm.index;
      lastCompEnd = tagEnd + 1;
    } else {
      const closeIdx = cleanedNext.indexOf('</Composition>', tagEnd + 1);
      if (closeIdx !== -1) {
        lastCompStart = cm.index;
        lastCompEnd = closeIdx + '</Composition>'.length;
      }
    }
    compRe.lastIndex = tagEnd + 1;
  }

  if (lastCompStart !== -1 && lastCompEnd !== -1) {
    const existingElement = next.slice(lastCompStart, lastCompEnd);
    const wrapped = `<>\n      ${existingElement}\n${compElement}\n    </>`;
    next = `${next.slice(0, lastCompStart)}${wrapped}${next.slice(lastCompEnd)}`;
    fs.writeFileSync(rootTsxPath, next, 'utf8');
    return { updated: true, created: false };
  }

  return {
    updated: false,
    created: false,
    warning: `Could not auto-insert <Composition id="${compositionId}" /> into ${rootTsxPath}. Please register it manually in your RemotionRoot component.`,
  };
}

/**
 * Scaffolds a clean video directory inside `<studioDir>/<videosDir>/<slug>/`
 * (`audio.json`, `<PascalId>.tsx`, `generated/audio-manifest.ts`, `index.ts`)
 * and registers `<Composition>` in `src/Root.tsx` using standard Remotion defaults.
 */
export async function runNewProductionCommand(
  options: NewProductionOptions
): Promise<{ productionDir: string; compositionId: string; rootTsxPath: string }> {
  const { rootDir, studioDir, dirRel } = resolveWorkspaceContext({
    cwd: options.cwd ?? options.rootDir,
    dir: options.dir,
  });
  const config = loadMakePicturesConfig(studioDir, rootDir);

  const slug = normalizeProductionSlug(options.slug);
  if (options.space !== undefined) {
    const parsedSpace = DimensionalSpaceSchema.safeParse(options.space);
    if (!parsedSpace.success) {
      throw new Error(
        `Invalid --space value "${String(options.space)}". Expected one of: 2d, 2.5d, 3d.`
      );
    }
  }
  if (options.kit && !isValidScaffoldKitId(options.kit)) {
    throw new Error(
      `Unknown visual kit "${options.kit}". Supported kits: ${SCENES_KIT_IDS.join(', ')}`
    );
  }
  const spaceDefaults = options.space
    ? defaultKitAndStyleForSpace(options.space)
    : undefined;
  const kit: ScaffoldKitId =
    options.kit ?? spaceDefaults?.kit ?? 'vector-scene-2d';
  const lang: 'pl' | 'en' = options.lang ?? config.lang ?? 'en';
  const resolvedStyle = resolveScaffoldStyle(
    studioDir,
    options.style ?? spaceDefaults?.styleId
  );
  const pascalName = slugToPascalCase(slug);
  const title = slugToHumanTitle(slug);

  const productionDir = path.resolve(studioDir, config.videosDir, slug);
  if (fs.existsSync(productionDir) && !options.force) {
    throw new Error(
      `Video directory "${path.relative(rootDir, productionDir)}" already exists. Pass --force to overwrite.`
    );
  }

  fs.mkdirSync(path.join(productionDir, 'generated'), { recursive: true });

  const manifest = buildScaffoldProductionManifest(slug, title, kit, lang, {
    style: resolvedStyle,
    voiceId: options.voice,
  });
  fs.writeFileSync(
    path.join(productionDir, 'audio.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );

  fs.writeFileSync(
    path.join(productionDir, `${pascalName}.tsx`),
    buildScaffoldCompositionTsx({
      slug,
      pascalName,
      kit,
      styleId: resolvedStyle.id,
      lang,
      title,
      style: resolvedStyle,
    }),
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

  const configuredEntryPath = path.resolve(studioDir, config.entryPoint);
  const rootTsxPath = path.join(path.dirname(configuredEntryPath), 'Root.tsx');
  const rawRelImport = path.relative(
    path.dirname(rootTsxPath),
    path.join(productionDir, pascalName)
  );
  const importRelPath = rawRelImport.startsWith('.')
    ? rawRelImport
    : `./${rawRelImport}`;

  const regResult = registerCompositionInRootTsx({
    rootTsxPath,
    compositionId: pascalName,
    importRelPath,
    durationInFrames: 720,
    fps: config.fps,
    width: 1920,
    height: 1080,
  });

  const dirFlagHint = dirRel !== '.' ? ` --dir=${dirRel}` : '';

  console.log('==============================================================');
  console.log(
    ` 🎬 Scaffolded Remotion Video: ${path.relative(rootDir, productionDir)}`
  );
  console.log('==============================================================');
  console.log(
    `  • Audio Spec:   ${path.relative(rootDir, path.join(productionDir, 'audio.json'))}`
  );
  console.log(
    `  • Composition:  ${path.relative(rootDir, path.join(productionDir, `${pascalName}.tsx`))} (${kit}, style: ${resolvedStyle.id})`
  );
  if (regResult.updated) {
    console.log(
      `  • Registered:   ${path.relative(rootDir, rootTsxPath)} (<Composition id="${pascalName}" />)`
    );
  } else if (regResult.warning) {
    console.warn(`  ⚠️  ${regResult.warning}`);
  }
  console.log('\nNext steps:');
  console.log(`  1. npx make-pictures audio ${slug} --mock${dirFlagHint}`);
  console.log(`  2. npx remotion studio`);
  console.log(`  3. npx make-pictures qa ${pascalName}${dirFlagHint}`);
  console.log(`  4. npx make-pictures render ${pascalName}${dirFlagHint}`);

  return { productionDir, compositionId: pascalName, rootTsxPath };
}
