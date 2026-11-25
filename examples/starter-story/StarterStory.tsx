import React, { memo, useMemo } from 'react';
import {
  AbsoluteFill,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import {
  ContinuousSceneFlow,
  SmartMusicBed,
  SoundCue,
  StyleProvider,
  VoiceoverTrack,
  formatFontFamilyCss,
  getStyleSpringConfig,
  useStudioFontsReady,
  useStudioStyle,
  type ContinuousSceneSpec,
  type DialogueDuckingSegment,
} from '@make-pictures/remotion';
import {
  ChapterTitleCard,
  EditorialDeskStage,
  EditorialPanoramaTrack,
  FloatingEditorialDisplay,
  PaperRibbonTimeline,
  type EditorialPanoramaItem,
  type PaperTimelineMilestone,
} from '@make-pictures/remotion/kits/editorial-collage';
import {
  HorizontalFeatureGrid2x2,
  PinnedMediaStage,
  VectorSceneStage2D,
  type HorizontalFeatureItem,
} from '@make-pictures/remotion/kits/vector-scene-2d';
import {
  AnimatedBarRace,
  DataStoryStage2D,
} from '@make-pictures/remotion/kits/data-storytelling';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from './generated/audio-manifest';
import {
  ANATOMY_IMAGE_META,
  ANATOMY_PINS,
  DEFAULT_STARTER_STORY_TIMING,
  PANORAMA_PLATES,
  QUIET_SECRETS_ITEMS,
  STARTER_CROSS_DISSOLVE_FRAMES,
  buildRailSpeedBarRaceItems,
  resolveRailSpeedEraAtLocalFrame,
} from './starterStoryTiming';

export type StarterStoryLang = 'en' | 'pl';

export const starterStorySchema = z.object({
  styleId: z
    .string()
    .describe('Colors & Style :: Editorial Theme (Style ID)'),
  lang: z
    .enum(['en', 'pl'])
    .optional()
    .default('en')
    .describe('Text & Labels :: Display Language'),
  chapterLabel: z
    .string()
    .describe('Text & Labels :: Opener Chapter Kicker'),
  headline: z.string().describe('Text & Labels :: Documentary Headline'),
  subline: z.string().describe('Text & Labels :: Documentary Subline'),
  closingHeadline: z
    .string()
    .describe('Text & Labels :: Closing Act Headline'),
  closingSubline: z.string().describe('Text & Labels :: Closing Act Subline'),
  voiceoverVolume: z
    .number()
    .min(0)
    .max(1.5)
    .describe('Audio :: Voiceover Volume'),
  musicVolume: z
    .number()
    .min(0)
    .max(1)
    .describe('Audio :: Music Score Volume'),
  sfxVolume: z.number().min(0).max(1).describe('Audio :: Sound Effects Volume'),
});

export type StarterStoryProps = z.infer<typeof starterStorySchema>;

export const starterStoryVerticalSchema = starterStorySchema;
export type StarterStoryVerticalProps = StarterStoryProps;

export const starterStoryDefaultProps: StarterStoryProps = {
  styleId: 'editorial-press',
  lang: 'en',
  chapterLabel: 'FEATURE ESSAY  •  HIGH-SPEED RAIL',
  headline: 'How a Bullet Train Never Spills a Cup',
  subline:
    'Three hundred kilometers an hour — and a full cup of green tea barely ripples.',
  closingHeadline: 'Four Quiet Secrets',
  closingSubline:
    'When thoughtful engineering disappears, blistering speed feels like a sunlit library.',
  voiceoverVolume: 1,
  musicVolume: 0.24,
  sfxVolume: 0.2,
};

export const starterStoryVerticalDefaultProps: StarterStoryVerticalProps = {
  ...starterStoryDefaultProps,
};

const starterStoryDefaults = starterStoryDefaultProps;
const starterStoryVerticalDefaults = starterStoryVerticalDefaultProps;

// ============================================================================
// Module-level hoisted constants (zero per-frame allocations at 60 FPS)
// ============================================================================
const SCORE_SRC = MUSIC_MANIFEST?.audioFile
  ? staticFile(MUSIC_MANIFEST.audioFile)
  : null;

const ANATOMY_IMAGE_SRC = staticFile(ANATOMY_IMAGE_META.src);

const PANORAMA_PLATES_RESOLVED: ReadonlyArray<EditorialPanoramaItem> =
  PANORAMA_PLATES.map((plate) => ({
    ...plate,
    src: plate.src ? staticFile(plate.src) : undefined,
  }));

const DUCKING_SEGMENTS: DialogueDuckingSegment[] =
  DEFAULT_STARTER_STORY_TIMING.voTimeline.map((seg) => ({
    sceneId: seg.sceneId,
    fromFrame: seg.fromFrame,
    durationInFrames: seg.durationInFrames,
  }));

const RESOLVED_SFX_BEATS = DEFAULT_STARTER_STORY_TIMING.sfxTimeline
  .map((cue) => {
    const entry = SFX_MANIFEST?.[cue.sfxId];
    if (!entry?.audioFile) return null;
    return {
      key: `${cue.sfxId}-${cue.fromFrame}`,
      fromFrame: cue.fromFrame,
      durationInFrames: cue.durationInFrames,
      src: staticFile(entry.audioFile),
      baseVolume: cue.volume ?? 0.2,
    };
  })
  .filter((item): item is NonNullable<typeof item> => item !== null);

const RAIL_SPEED_ITEMS_DEFAULT = buildRailSpeedBarRaceItems(
  DEFAULT_STARTER_STORY_TIMING.sceneById['speed-en'].durationInFrames,
  36
);

const SecretIconSvg: React.FC<{ id: string; color: string }> = memo(
  ({ id, color }) => {
    if (id === 'sculpted-nose') {
      return (
        <svg width={32} height={32} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path
            d="M4 21C11 21 17 19.5 27 15.5C21 12.2 13 11 4 11"
            stroke={color}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6 7.5C13 7.5 20 9 27.5 11.5"
            stroke={color}
            strokeWidth={1.6}
            strokeLinecap="round"
            opacity={0.55}
          />
          <line
            x1={4}
            y1={25}
            x2={27}
            y2={25}
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            opacity={0.65}
          />
        </svg>
      );
    }
    if (id === 'welded-steel') {
      return (
        <svg width={32} height={32} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path
            d="M5 24L13 8M27 24L19 8"
            stroke={color}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
          <line
            x1={9}
            y1={14}
            x2={23}
            y2={14}
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            opacity={0.6}
          />
          <line
            x1={7}
            y1={20}
            x2={25}
            y2={20}
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            opacity={0.6}
          />
        </svg>
      );
    }
    if (id === 'active-tilt') {
      return (
        <svg width={32} height={32} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path
            d="M5 18C9 12 23 12 27 18"
            stroke={color}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
          <circle cx={16} cy={14} r={3.5} stroke={color} strokeWidth={2} />
          <line
            x1={6}
            y1={23}
            x2={26}
            y2={23}
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            opacity={0.65}
          />
        </svg>
      );
    }
    return (
      <svg width={32} height={32} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path
          d="M7 13H21V19C21 22.3 18.3 25 15 25H13C9.7 25 7 22.3 7 19V13Z"
          stroke={color}
          strokeWidth={2.1}
          strokeLinejoin="round"
        />
        <path
          d="M21 15H23.5C25.2 15 26.5 16.3 26.5 18C26.5 19.7 25.2 21 23.5 21H21"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <line
          x1={9.5}
          y1={16.5}
          x2={18.5}
          y2={16.5}
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          opacity={0.7}
        />
        <path
          d="M12 9.5C12 8.2 13 7.5 13 6.2M16 9.5C16 8.2 17 7.5 17 6.2"
          stroke={color}
          strokeWidth={1.7}
          strokeLinecap="round"
          opacity={0.65}
        />
      </svg>
    );
  }
);
SecretIconSvg.displayName = 'SecretIconSvg';

const QUIET_SECRETS_WITH_ICONS: ReadonlyArray<HorizontalFeatureItem> =
  QUIET_SECRETS_ITEMS.map((item) => ({
    ...item,
    icon: <SecretIconSvg id={item.id} color={item.accentColor ?? '#C25934'} />,
  }));

const PL_MILESTONE_LABELS: Record<string, string> = {
  'opener-en': 'Filiżanka',
  'panorama-en': 'Panorama',
  'anatomy-en': 'Budowa',
  'speed-en': 'Wyścig prędkości',
  'secrets-en': 'Cztery sekrety',
};

const PL_PANORAMA_PLATE_TEXT: Record<
  string,
  { title: string; sourceTag: string; sentence: string }
> = {
  'plate-steam-era': {
    title: 'Para i grom',
    sourceTag: '1938 • ERA PARY',
    sentence: 'Żelazne tłoki wstrząsały każdym wagonem na łączonych szynach.',
  },
  'plate-1964-shinkansen': {
    title: 'Przełom 1964',
    sourceTag: '1964 • LINIA TOKAIDO',
    sentence: 'Japonia wypuściła smukłe pociągi elektryczne u stóp góry Fudżi.',
  },
  'plate-kingfisher-nose': {
    title: 'Cichy dziób zimorodka',
    sourceTag: 'NATURA • AERODYNAMIKA',
    sentence: 'Zimorodki nurkują czysto do rzeki bez rozbryzgu wody.',
  },
  'plate-teacup-window': {
    title: 'Spokój przy pełnej prędkości',
    sourceTag: 'DZIŚ • CICHA KABINA',
    sentence: 'Krajobraz mknie za oknem, a gorąca herbata nawet nie drgnie.',
  },
};

const PANORAMA_PLATES_PL: ReadonlyArray<EditorialPanoramaItem> =
  PANORAMA_PLATES_RESOLVED.map((plate) => {
    const localized = PL_PANORAMA_PLATE_TEXT[plate.id];
    return localized ? { ...plate, ...localized } : plate;
  });

const PL_ANATOMY_PIN_LABELS: Record<string, string> = {
  suspension: 'Aktywne tłumiki • łagodny przechył',
  cabin: 'Spawane szyny • spokojna taca',
  nose: 'Dziób zimorodka • ciche powietrze',
};

const ANATOMY_PINS_PL = ANATOMY_PINS.map((pin) => ({
  ...pin,
  label: PL_ANATOMY_PIN_LABELS[pin.id] ?? pin.label,
}));

const RAIL_SPEED_ITEMS_PL = RAIL_SPEED_ITEMS_DEFAULT.map((item) =>
  item.id === 'steam' ? { ...item, label: 'Klasyczny parowóz' } : item
);

const PL_QUIET_SECRETS_TEXT: Record<
  string,
  { title: string; sentence: string }
> = {
  'sculpted-nose': {
    title: 'Smukły dziób',
    sentence: 'Rozcina powietrze w tunelach bez głośnego uderzenia ciśnienia.',
  },
  'welded-steel': {
    title: 'Spawane szyny',
    sentence: 'Bezstykowe tory usuwają rytmiczny stukot połączeń.',
  },
  'active-tilt': {
    title: 'Aktywny przechył',
    sentence: 'Hydrauliczne amortyzatory łagodnie pochylają pudło na łukach.',
  },
  'still-teacup': {
    title: 'Nieruchoma filiżanka',
    sentence: 'Zawrotna prędkość przypomina pobyt w cichej bibliotece.',
  },
};

const QUIET_SECRETS_PL: ReadonlyArray<HorizontalFeatureItem> =
  QUIET_SECRETS_WITH_ICONS.map((item) => {
    const localized = PL_QUIET_SECRETS_TEXT[item.id];
    return localized ? { ...item, ...localized } : item;
  });

export function getStarterStoryCopy(lang: StarterStoryLang) {
  if (lang === 'pl') {
    return {
      defaultChapterLabel: 'ESEJ SPECJALNY  •  KOLEJ DUŻYCH PRĘDKOŚCI',
      defaultHeadline: 'Jak szybki pociąg nie rozlewa ani kropli',
      defaultSubline:
        'Trzysta kilometrów na godzinę — a pełna filiżanka zielonej herbaty ledwie drgnie.',
      defaultClosingHeadline: 'Cztery ciche sekrety',
      defaultClosingSubline:
        'Gdy mądra inżynieria staje się niewidoczna, zawrotna prędkość przypomina cichą bibliotekę.',
      milestones: DEFAULT_STARTER_STORY_TIMING.milestones.map((m) => ({
        ...m,
        label: PL_MILESTONE_LABELS[m.id] ?? m.label,
      })),
      panoramaPlates: PANORAMA_PLATES_PL,
      anatomy: {
        eyebrow: '03  •  PRECYZYJNA ANATOMIA',
        headline: 'Zbudowany, by sunąć w ciszy',
        subline:
          'Każda krzywizna, amortyzator i spaw służą jednej spokojnej podróży.',
        pins: ANATOMY_PINS_PL,
      },
      speed: {
        eyebrow: '04  •  SZEŚĆ DEKAD PRĘDKOŚCI',
        headline: 'Ponad 350 km/h',
        subline: 'Najszybsze pasażerskie koleje świata od 1964 roku do dziś.',
        chartTitle: 'Prędkość kolei pasażerskiej',
        chartSubtitleSuffix: 'Regularny ruch pasażerski',
        eraPrefix: 'ERA',
        eraLabels: {
          '1964': '1964',
          '1995': '1995',
          Today: 'Dziś',
        } as const,
        items: RAIL_SPEED_ITEMS_PL,
      },
      secrets: {
        eyebrow: '05  •  CZTERY CICHE SEKRETY',
        items: QUIET_SECRETS_PL,
      },
    };
  }
  return {
    defaultChapterLabel: starterStoryDefaults.chapterLabel,
    defaultHeadline: starterStoryDefaults.headline,
    defaultSubline: starterStoryDefaults.subline,
    defaultClosingHeadline: starterStoryDefaults.closingHeadline,
    defaultClosingSubline: starterStoryDefaults.closingSubline,
    milestones: DEFAULT_STARTER_STORY_TIMING.milestones,
    panoramaPlates: PANORAMA_PLATES_RESOLVED,
    anatomy: {
      eyebrow: '03  •  SCULPTED ANATOMY',
      headline: 'Built to Glide in Silence',
      subline: 'Every curve, damper, and welded joint serves one calm ride.',
      pins: ANATOMY_PINS,
    },
    speed: {
      eyebrow: '04  •  SIX DECADES OF SPEED',
      headline: 'Racing Past 350 km/h',
      subline: 'Commercial passenger rail leaders from 1964 to today.',
      chartTitle: 'Commercial Rail Speed',
      chartSubtitleSuffix: 'Regular Passenger Service',
      eraPrefix: 'ERA',
      eraLabels: {
        '1964': '1964',
        '1995': '1995',
        Today: 'Today',
      } as const,
      items: RAIL_SPEED_ITEMS_DEFAULT,
    },
    secrets: {
      eyebrow: '05  •  FOUR QUIET SECRETS',
      items: QUIET_SECRETS_WITH_ICONS,
    },
  };
}

/**
 * Isolates Clean Frame 0 (`RGB variance 0.00`) so the root stage and audio bed
 * never re-render at 60 Hz or unmount/remount across frame 0 -> 1.
 */
const CleanFrameZeroOverlay: React.FC<{ bgColor: string }> = memo(
  ({ bgColor }) => {
    const frame = useCurrentFrame();
    if (frame > 0) return null;
    return (
      <AbsoluteFill
        style={{
          backgroundColor: bgColor,
          zIndex: 9999,
          pointerEvents: 'none',
        }}
      />
    );
  }
);
CleanFrameZeroOverlay.displayName = 'CleanFrameZeroOverlay';

const VERTICAL_HEADER_STYLE: React.CSSProperties = {
  top: 242,
  left: 56,
  right: 184,
};

// ============================================================================
// Act 1 — Editorial Opener (`EditorialDeskStage` + `ChapterTitleCard`)
// ============================================================================
const Act1EditorialOpener: React.FC<{
  chapterLabel: string;
  headline: string;
  subline: string;
  isVertical: boolean;
  milestones: ReadonlyArray<PaperTimelineMilestone>;
}> = memo(({ chapterLabel, headline, subline, isVertical, milestones }) => (
  <AbsoluteFill style={{ boxSizing: 'border-box' }}>
    <EditorialDeskStage renderBaseFill={false} seed={2101}>
      {/* Constraining 16:9 measure + textWrap: balance prevents orphan widow words ("Cup") */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: isVertical ? '100%' : 1380,
          textWrap: 'balance',
          boxSizing: 'border-box',
        }}
      >
        <ChapterTitleCard
          chapterLabel={chapterLabel}
          title={headline}
          subtitle={subline}
          startFrame={4}
        />
      </div>
    </EditorialDeskStage>
    {!isVertical && (
      <PaperRibbonTimeline
        milestones={milestones}
        activeId="opener-en"
        position="bottom"
        enterFrame={10}
      />
    )}
  </AbsoluteFill>
));
Act1EditorialOpener.displayName = 'Act1EditorialOpener';

// ============================================================================
// Act 2 — Rail Evolution Panorama (`EditorialDeskStage` + `EditorialPanoramaTrack`)
// ============================================================================
const Act2RailPanorama: React.FC<{
  durationInFrames: number;
  isVertical: boolean;
  milestones: ReadonlyArray<PaperTimelineMilestone>;
  items: ReadonlyArray<EditorialPanoramaItem>;
}> = memo(({ durationInFrames, isVertical, milestones, items }) => (
  <AbsoluteFill style={{ boxSizing: 'border-box' }}>
    <EditorialDeskStage renderBaseFill={false} seed={2102}>
      <AbsoluteFill
        style={{
          boxSizing: 'border-box',
          transformOrigin: isVertical ? '470px 800px' : '960px 540px',
          transform: isVertical
            ? 'translateY(-18px) scale(0.92)'
            : 'translateY(-14px) scale(0.96)',
        }}
      >
        <EditorialPanoramaTrack
          items={items}
          startFrame={4}
          durationInFrames={durationInFrames}
          showScenicBackdrop={false}
          renderBaseFill={false}
        />
      </AbsoluteFill>
    </EditorialDeskStage>
    {!isVertical && (
      <PaperRibbonTimeline
        milestones={milestones}
        activeId="panorama-en"
        position="bottom"
        enterFrame={6}
      />
    )}
  </AbsoluteFill>
));
Act2RailPanorama.displayName = 'Act2RailPanorama';

// ============================================================================
// Act 3 — Sculpted Anatomy (`VectorSceneStage2D` + `PinnedMediaStage`)
// ============================================================================
const Act3BulletAnatomy: React.FC<{
  isVertical: boolean;
  milestones: ReadonlyArray<PaperTimelineMilestone>;
  copy: ReturnType<typeof getStarterStoryCopy>['anatomy'];
}> = memo(({ isVertical, milestones, copy }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = useStudioStyle();

  const matOpacity =
    frame < 6
      ? 0
      : spring({
          frame: frame - 6,
          fps,
          config: getStyleSpringConfig(style, 'enter'),
        });

  return (
    <AbsoluteFill style={{ boxSizing: 'border-box' }}>
      <VectorSceneStage2D renderBaseFill={false} seed={2103}>
        {isVertical ? (
          // Pure layout offset (no translate3d jitter); maxWidth 720 + left -18 keeps
          // outer nose & suspension pills comfortably inside 9:16 Safe Box x in [40, 910]
          <AbsoluteFill
            style={{
              left: -18,
              top: 82,
              boxSizing: 'border-box',
            }}
          >
            {/* Subtle museum gallery print mat hugging the 720x483 profile plate */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 122,
                top: 558,
                width: 720,
                height: 484,
                borderRadius: 12,
                border: '1px solid rgba(28, 25, 23, 0.14)',
                backgroundColor: '#F5F2E6',
                boxShadow:
                  '0 20px 44px rgba(24, 22, 21, 0.09), 0 3px 10px rgba(24, 22, 21, 0.05)',
                opacity: matOpacity,
                pointerEvents: 'none',
                boxSizing: 'border-box',
              }}
            />
            <PinnedMediaStage
              src={ANATOMY_IMAGE_SRC}
              sourceWidth={ANATOMY_IMAGE_META.sourceWidth}
              sourceHeight={ANATOMY_IMAGE_META.sourceHeight}
              maxWidth={720}
              maxHeight={490}
              startFrame={6}
              pins={copy.pins}
            />
          </AbsoluteFill>
        ) : (
          <AbsoluteFill
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '194px 60px 104px 60px',
              boxSizing: 'border-box',
            }}
          >
            {/* Bold 1134x761 museum print mat framing the 1264x848 profile plate */}
            <div
              style={{
                width: 1134,
                height: 761,
                borderRadius: 12,
                border: '1px solid rgba(28, 25, 23, 0.14)',
                backgroundColor: '#F5F2E6',
                boxShadow:
                  '0 24px 52px rgba(24, 22, 21, 0.09), 0 4px 12px rgba(24, 22, 21, 0.05)',
                opacity: matOpacity,
                boxSizing: 'border-box',
              }}
            >
              <PinnedMediaStage
                src={ANATOMY_IMAGE_SRC}
                sourceWidth={ANATOMY_IMAGE_META.sourceWidth}
                sourceHeight={ANATOMY_IMAGE_META.sourceHeight}
                maxWidth={1134}
                maxHeight={761}
                startFrame={6}
                pins={copy.pins}
              />
            </div>
          </AbsoluteFill>
        )}
      </VectorSceneStage2D>

      <FloatingEditorialDisplay
        eyebrow={copy.eyebrow}
        headline={copy.headline}
        subline={copy.subline}
        align="left"
        position="top"
        tone="dark-on-light"
        headlinePx={isVertical ? 42 : 48}
        sublinePx={isVertical ? 20 : 22}
        enterFrame={4}
        style={isVertical ? VERTICAL_HEADER_STYLE : undefined}
      />

      {!isVertical && (
        <PaperRibbonTimeline
          milestones={milestones}
          activeId="anatomy-en"
          position="bottom"
          enterFrame={6}
        />
      )}
    </AbsoluteFill>
  );
});
Act3BulletAnatomy.displayName = 'Act3BulletAnatomy';

// ============================================================================
// Act 4 — Six Decades of Speed (`DataStoryStage2D` + `AnimatedBarRace`)
// ============================================================================
const Act4SpeedBarRace: React.FC<{
  durationInFrames: number;
  isVertical: boolean;
  milestones: ReadonlyArray<PaperTimelineMilestone>;
  copy: ReturnType<typeof getStarterStoryCopy>['speed'];
}> = memo(({ durationInFrames, isVertical, milestones, copy }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  useStudioFontsReady();
  const style = useStudioStyle();

  const activeEra = resolveRailSpeedEraAtLocalFrame(
    frame,
    durationInFrames,
    36
  );
  const localizedEra = copy.eraLabels[activeEra];

  const badgeEnter =
    frame < 6
      ? 0
      : spring({
          frame: frame - 6,
          fps,
          config: getStyleSpringConfig(style, 'enter'),
        });

  // Snap to 'none' once settled (zero Chromium sub-pixel text jitter!)
  const badgeDyPx = Math.round((1 - badgeEnter) * -10);
  const badgeTransform =
    badgeEnter >= 0.999 || badgeDyPx === 0
      ? 'none'
      : `translateY(${badgeDyPx}px)`;

  const monoFont = useMemo(
    () => formatFontFamilyCss(style.typography.monoFont, 'mono'),
    [style.typography.monoFont]
  );

  return (
    <AbsoluteFill style={{ boxSizing: 'border-box' }}>
      <DataStoryStage2D renderBaseFill={false} seed={2104}>
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isVertical
              ? '528px 184px 552px 56px'
              : '208px 96px 116px 96px',
            boxSizing: 'border-box',
          }}
        >
          <AnimatedBarRace
            items={copy.items}
            title={copy.chartTitle}
            subtitle={`${localizedEra}  •  ${copy.chartSubtitleSuffix}`}
            valueSuffix=" km/h"
            decimals={0}
            startFrame={8}
            staggerFrames={6}
            safeBox9x16
            style={{ width: isVertical ? 788 : 1420 }}
          />
        </AbsoluteFill>
      </DataStoryStage2D>

      <FloatingEditorialDisplay
        eyebrow={copy.eyebrow}
        headline={copy.headline}
        subline={copy.subline}
        align="left"
        position="top"
        tone="dark-on-light"
        headlinePx={isVertical ? 42 : 48}
        sublinePx={isVertical ? 20 : 22}
        enterFrame={4}
        style={isVertical ? VERTICAL_HEADER_STYLE : undefined}
      />

      {/* Dynamic Era Pill (`tabular-nums`, >= 21px, crisp settled transform: none) */}
      <div
        style={{
          position: 'absolute',
          right: isVertical ? undefined : 76,
          left: isVertical ? 56 : undefined,
          top: isVertical ? 458 : 56,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 22px',
          borderRadius: 999,
          backgroundColor: style.palette.bgSurface,
          border: `1.5px solid ${style.palette.inkBorder}`,
          boxShadow: '0 8px 20px rgba(24, 22, 21, 0.08)',
          opacity: badgeEnter >= 0.999 ? 1 : badgeEnter,
          transform: badgeTransform,
          boxSizing: 'border-box',
          pointerEvents: 'none',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: style.palette.accentPrimary,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: monoFont,
            fontSize: 21,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: style.palette.textPrimary,
          }}
        >
          {copy.eraPrefix} • {localizedEra}
        </span>
      </div>

      {!isVertical && (
        <PaperRibbonTimeline
          milestones={milestones}
          activeId="speed-en"
          position="bottom"
          enterFrame={6}
        />
      )}
    </AbsoluteFill>
  );
});
Act4SpeedBarRace.displayName = 'Act4SpeedBarRace';

// ============================================================================
// Act 5 — Four Quiet Secrets (`VectorSceneStage2D` + `HorizontalFeatureGrid2x2`)
// ============================================================================
const Act5QuietSecrets: React.FC<{
  closingHeadline: string;
  closingSubline: string;
  isVertical: boolean;
  milestones: ReadonlyArray<PaperTimelineMilestone>;
  copy: ReturnType<typeof getStarterStoryCopy>['secrets'];
}> = memo(({ closingHeadline, closingSubline, isVertical, milestones, copy }) => (
  <AbsoluteFill style={{ boxSizing: 'border-box' }}>
    <VectorSceneStage2D renderBaseFill={false} seed={2105}>
      {isVertical ? (
        // Pure layout offset (no translate3d/scale jitter) cleanly inside 9:16 Safe Box
        <AbsoluteFill
          style={{
            top: 222,
            boxSizing: 'border-box',
          }}
        >
          <HorizontalFeatureGrid2x2
            items={copy.items}
            startFrame={8}
            staggerFrames={10}
            maxWidth={790}
            styleOverrides={{ gap: 16 }}
          />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill
          style={{
            paddingTop: 152,
            paddingBottom: 92,
            boxSizing: 'border-box',
          }}
        >
          <HorizontalFeatureGrid2x2
            items={copy.items}
            startFrame={8}
            staggerFrames={10}
            maxWidth={1520}
          />
        </AbsoluteFill>
      )}
    </VectorSceneStage2D>

    <FloatingEditorialDisplay
      eyebrow={copy.eyebrow}
      headline={closingHeadline}
      subline={closingSubline}
      align="left"
      position="top"
      tone="dark-on-light"
      headlinePx={isVertical ? 40 : 48}
      sublinePx={isVertical ? 20 : 22}
      enterFrame={4}
      style={isVertical ? VERTICAL_HEADER_STYLE : undefined}
    />

    {!isVertical && (
      <PaperRibbonTimeline
        milestones={milestones}
        activeId="secrets-en"
        position="bottom"
        enterFrame={6}
      />
    )}
  </AbsoluteFill>
));
Act5QuietSecrets.displayName = 'Act5QuietSecrets';

// ============================================================================
// Root Orchestrator (`ContinuousSceneFlow` + Audio Bed + Clean Frame 0)
// ============================================================================
interface StarterStoryStageInnerProps {
  lang: StarterStoryLang;
  chapterLabel: string;
  headline: string;
  subline: string;
  closingHeadline: string;
  closingSubline: string;
  voiceoverVolume: number;
  musicVolume: number;
  sfxVolume: number;
  isVertical: boolean;
}

const StarterStoryStageInner: React.FC<StarterStoryStageInnerProps> = memo(
  ({
    lang,
    chapterLabel,
    headline,
    subline,
    closingHeadline,
    closingSubline,
    voiceoverVolume,
    musicVolume,
    sfxVolume,
    isVertical,
  }) => {
    const outerStyle = useStudioStyle();
    const timing = DEFAULT_STARTER_STORY_TIMING;
    const copy = useMemo(() => getStarterStoryCopy(lang), [lang]);

    const scenes = useMemo<ContinuousSceneSpec[]>(() => {
      const s1 = timing.sceneById['opener-en'];
      const s2 = timing.sceneById['panorama-en'];
      const s3 = timing.sceneById['anatomy-en'];
      const s4 = timing.sceneById['speed-en'];
      const s5 = timing.sceneById['secrets-en'];

      // Nominal slot durations sum 1:1 to `timing.totalDurationInFrames` so
      // ContinuousSceneFlow boundaries align cleanly with voiceover/SFX/milestones.
      return [
        {
          id: s1.id,
          durationInFrames: s2.startFrame - s1.startFrame,
          usesThree: false,
          render: () => (
            <Act1EditorialOpener
              chapterLabel={chapterLabel}
              headline={headline}
              subline={subline}
              isVertical={isVertical}
              milestones={copy.milestones}
            />
          ),
        },
        {
          id: s2.id,
          durationInFrames: s3.startFrame - s2.startFrame,
          usesThree: false,
          render: () => (
            <Act2RailPanorama
              durationInFrames={s2.durationInFrames}
              isVertical={isVertical}
              milestones={copy.milestones}
              items={copy.panoramaPlates}
            />
          ),
        },
        {
          id: s3.id,
          durationInFrames: s4.startFrame - s3.startFrame,
          usesThree: false,
          render: () => (
            <Act3BulletAnatomy
              isVertical={isVertical}
              milestones={copy.milestones}
              copy={copy.anatomy}
            />
          ),
        },
        {
          id: s4.id,
          durationInFrames: s5.startFrame - s4.startFrame,
          usesThree: false,
          render: () => (
            <Act4SpeedBarRace
              durationInFrames={s4.durationInFrames}
              isVertical={isVertical}
              milestones={copy.milestones}
              copy={copy.speed}
            />
          ),
        },
        {
          id: s5.id,
          durationInFrames: s5.durationInFrames,
          usesThree: false,
          render: () => (
            <Act5QuietSecrets
              closingHeadline={closingHeadline}
              closingSubline={closingSubline}
              isVertical={isVertical}
              milestones={copy.milestones}
              copy={copy.secrets}
            />
          ),
        },
      ];
    }, [
      chapterLabel,
      headline,
      subline,
      closingHeadline,
      closingSubline,
      isVertical,
      timing,
      copy,
    ]);

    return (
      <AbsoluteFill style={{ boxSizing: 'border-box' }}>
        <ContinuousSceneFlow
          scenes={scenes}
          crossDissolveFrames={STARTER_CROSS_DISSOLVE_FRAMES}
        />

        {timing.voTimeline.map((seg) => (
          <Sequence
            key={seg.sceneId}
            from={seg.fromFrame}
            durationInFrames={seg.durationInFrames}
            layout="none"
          >
            <VoiceoverTrack
              voiceover={VOICEOVER_MANIFEST[seg.sceneId]}
              fromFrame={0}
              durationInFrames={seg.durationInFrames}
              volume={voiceoverVolume}
            />
          </Sequence>
        ))}

        {SCORE_SRC && (
          <SmartMusicBed
            src={SCORE_SRC}
            dialogueSegments={DUCKING_SEGMENTS}
            voiceoverManifest={VOICEOVER_MANIFEST}
            baseVolume={musicVolume}
            duckedVolume={Math.min(musicVolume * 0.34, 0.085)}
            fadeOutFrames={90}
          />
        )}

        {RESOLVED_SFX_BEATS.map((cue) => (
          <Sequence
            key={cue.key}
            from={cue.fromFrame}
            durationInFrames={cue.durationInFrames}
            layout="none"
          >
            <SoundCue
              src={cue.src}
              atFrame={0}
              durationInFrames={cue.durationInFrames}
              volume={Math.min(1, cue.baseVolume * (sfxVolume / 0.2))}
            />
          </Sequence>
        ))}

        <CleanFrameZeroOverlay bgColor={outerStyle.palette.bgCanvas} />
      </AbsoluteFill>
    );
  }
);
StarterStoryStageInner.displayName = 'StarterStoryStageInner';

export const StarterStory: React.FC<Partial<StarterStoryProps>> = (
  rawProps
) => {
  const merged: StarterStoryProps = {
    ...(starterStoryDefaults as StarterStoryProps),
    ...rawProps,
    lang: rawProps.lang ?? 'en',
  };
  const copy = getStarterStoryCopy(merged.lang);
  const resolvedChapterLabel =
    merged.lang === 'pl' &&
    merged.chapterLabel === starterStoryDefaults.chapterLabel
      ? copy.defaultChapterLabel
      : merged.chapterLabel;
  const resolvedHeadline =
    merged.lang === 'pl' && merged.headline === starterStoryDefaults.headline
      ? copy.defaultHeadline
      : merged.headline;
  const resolvedSubline =
    merged.lang === 'pl' && merged.subline === starterStoryDefaults.subline
      ? copy.defaultSubline
      : merged.subline;
  const resolvedClosingHeadline =
    merged.lang === 'pl' &&
    merged.closingHeadline === starterStoryDefaults.closingHeadline
      ? copy.defaultClosingHeadline
      : merged.closingHeadline;
  const resolvedClosingSubline =
    merged.lang === 'pl' &&
    merged.closingSubline === starterStoryDefaults.closingSubline
      ? copy.defaultClosingSubline
      : merged.closingSubline;

  return (
    <StyleProvider style={merged.styleId} renderBackdrop>
      <StarterStoryStageInner
        lang={merged.lang}
        chapterLabel={resolvedChapterLabel}
        headline={resolvedHeadline}
        subline={resolvedSubline}
        closingHeadline={resolvedClosingHeadline}
        closingSubline={resolvedClosingSubline}
        voiceoverVolume={merged.voiceoverVolume}
        musicVolume={merged.musicVolume}
        sfxVolume={merged.sfxVolume}
        isVertical={false}
      />
    </StyleProvider>
  );
};

export const StarterStoryVertical: React.FC<
  Partial<StarterStoryVerticalProps>
> = (rawProps) => {
  const merged: StarterStoryVerticalProps = {
    ...(starterStoryVerticalDefaults as StarterStoryVerticalProps),
    ...rawProps,
    lang: rawProps.lang ?? 'en',
  };
  const copy = getStarterStoryCopy(merged.lang);
  const resolvedChapterLabel =
    merged.lang === 'pl' &&
    merged.chapterLabel === starterStoryVerticalDefaults.chapterLabel
      ? copy.defaultChapterLabel
      : merged.chapterLabel;
  const resolvedHeadline =
    merged.lang === 'pl' &&
    merged.headline === starterStoryVerticalDefaults.headline
      ? copy.defaultHeadline
      : merged.headline;
  const resolvedSubline =
    merged.lang === 'pl' &&
    merged.subline === starterStoryVerticalDefaults.subline
      ? copy.defaultSubline
      : merged.subline;
  const resolvedClosingHeadline =
    merged.lang === 'pl' &&
    merged.closingHeadline === starterStoryVerticalDefaults.closingHeadline
      ? copy.defaultClosingHeadline
      : merged.closingHeadline;
  const resolvedClosingSubline =
    merged.lang === 'pl' &&
    merged.closingSubline === starterStoryVerticalDefaults.closingSubline
      ? copy.defaultClosingSubline
      : merged.closingSubline;

  return (
    <StyleProvider style={merged.styleId} renderBackdrop>
      <StarterStoryStageInner
        lang={merged.lang}
        chapterLabel={resolvedChapterLabel}
        headline={resolvedHeadline}
        subline={resolvedSubline}
        closingHeadline={resolvedClosingHeadline}
        closingSubline={resolvedClosingSubline}
        voiceoverVolume={merged.voiceoverVolume}
        musicVolume={merged.musicVolume}
        sfxVolume={merged.sfxVolume}
        isVertical
      />
    </StyleProvider>
  );
};
