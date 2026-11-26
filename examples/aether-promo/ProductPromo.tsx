import React, { memo, useMemo } from 'react';
import { Bike, Check, Clock, Home, Smartphone, Store } from 'lucide-react';
import {
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import {
  FillLayer,
  ClippedSurfaceChrome,
  ContinuousSceneFlow,
  SmartMusicBed,
  SoundCue,
  StyleProvider,
  VoiceoverTrack,
  formatFontFamilyCss,
  formatHeadingText,
  getCardChromeStyle,
  getStyleSpringConfig,
  useStudioFontsReady,
  useStudioStyle,
  type ContinuousSceneSpec,
  type DialogueDuckingSegment,
  type ShotSpec2D,
} from '@make-pictures/remotion';
import {
  FloatingEditorialDisplay,
  PaperRibbonTimeline,
  type PaperTimelineMilestone,
} from '@make-pictures/remotion/kits/editorial-collage';
import {
  DataFlowEdge,
  MotionDiagramStage2D,
  SystemNode,
  portLeft,
  portRight,
  type NodeBox,
} from '@make-pictures/remotion/kits/motion-diagrams-2d';
import {
  BrowserFrame,
  PhoneFrame,
  ScreenSpotlightOverlay,
} from '@make-pictures/remotion/kits/product-frames';
import { VectorSceneStage2D } from '@make-pictures/remotion/kits/vector-scene-2d';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from './generated/audio-manifest';
import {
  DEFAULT_PRODUCT_PROMO_TIMING,
  DISPATCH_BAKERY_BADGE_POS,
  DISPATCH_DOOR_BADGE_POS,
  DISPATCH_MAP_ASPECT,
  DISPATCH_ROUTE_POINTS,
  DOORSTEP_HIGHLIGHTS,
  FLOW_EDGES,
  FLOW_NODE_COPY,
  FLOW_WORLD_NODES,
  PROMO_CROSS_DISSOLVE_FRAMES,
  buildDispatchRoutePrefixSvgPath,
  buildDispatchRouteSvgPath,
  evaluateDispatchRouteAtProgress,
  resolveDispatchEtaStatus,
  type FlowNodeId,
} from './productPromoTiming';

export type ProductPromoLang = 'en' | 'pl';

export const productPromoSchema = z.object({
  styleId: z
    .string()
    .describe('Colors & Style :: Product Theme (Style ID)'),
  lang: z
    .enum(['en', 'pl'])
    .optional()
    .default('en')
    .describe('Text & Labels :: Display Language'),
  brandName: z.string().describe('Text & Labels :: Bakery Brand Name'),
  heroTitle: z.string().describe('Text & Labels :: Opener Headline'),
  heroSubtitle: z.string().describe('Text & Labels :: Opener Subline'),
  closingHeadline: z.string().describe('Text & Labels :: Finale Headline'),
  closingSubline: z.string().describe('Text & Labels :: Finale Subline'),
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

export type ProductPromoProps = z.infer<typeof productPromoSchema>;

export const productPromoDefaultProps: ProductPromoProps = {
  styleId: 'minimal-product',
  lang: 'en',
  brandName: 'Sunbeam Bakery',
  heroTitle: 'One Tap to Your Door',
  heroSubtitle:
    'Order warm morning pastries in a single tap — and watch them glide straight to your doorstep.',
  closingHeadline: 'Effortless From Tap to Table',
  closingSubline:
    'Thoughtful choreography turns one simple tap into a warm morning at your door.',
  voiceoverVolume: 1,
  musicVolume: 0.24,
  sfxVolume: 0.2,
};

const productPromoDefaults = productPromoDefaultProps;

// ============================================================================
// Module-level hoisted constants (zero per-frame allocations at 60 FPS)
// ============================================================================
const SCORE_SRC = MUSIC_MANIFEST?.audioFile
  ? staticFile(MUSIC_MANIFEST.audioFile)
  : null;

const BAKERY_BOX_SRC = staticFile('examples/aether-promo/images/bakery-box.png');
const NEIGHBORHOOD_MAP_SRC = staticFile(
  'examples/aether-promo/images/neighborhood-map.png'
);

const DUCKING_SEGMENTS: DialogueDuckingSegment[] =
  DEFAULT_PRODUCT_PROMO_TIMING.voTimeline.map((seg) => ({
    sceneId: seg.sceneId,
    fromFrame: seg.fromFrame,
    durationInFrames: seg.durationInFrames,
  }));

const RESOLVED_SFX_BEATS = DEFAULT_PRODUCT_PROMO_TIMING.sfxTimeline
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

const ACT2_SHOTS: ShotSpec2D[] = [
  {
    fromFrame: 0,
    target: ['phone', 'bakery', 'courier', 'doorstep'],
    transition: 'cut',
    zoom: 1,
    label: 'Four-Step Choreography Overview',
  },
];

const FLOW_NODE_ICONS: Record<FlowNodeId, typeof Smartphone> = {
  phone: Smartphone,
  bakery: Store,
  courier: Bike,
  doorstep: Home,
};

const ROUTE_SVG_W = DISPATCH_MAP_ASPECT.width;
const ROUTE_SVG_H = DISPATCH_MAP_ASPECT.height;

const FULL_DISPATCH_ROUTE_SVG_PATH = buildDispatchRouteSvgPath(
  ROUTE_SVG_W,
  ROUTE_SVG_H
);

const DOORSTEP_CARDS_WITH_SRCS = DOORSTEP_HIGHLIGHTS.map((card) => ({
  ...card,
  resolvedSrc: staticFile(card.imageSrc),
}));

const PL_MILESTONE_LABELS: Record<string, string> = {
  'tap-en': 'Zamówienie',
  'flow-en': 'Choreografia',
  'live-sync-en': 'Na żywo',
  'doorstep-en': 'Pod drzwiami',
};

const PL_FLOW_WORLD_NODES: Record<FlowNodeId, NodeBox> = {
  phone: { cx: 200, cy: 596, w: 428, h: 192 },
  bakery: { cx: 706, cy: 496, w: 428, h: 192 },
  courier: { cx: 1214, cy: 596, w: 428, h: 192 },
  doorstep: { cx: 1720, cy: 496, w: 428, h: 192 },
};

const PL_ACT2_SHOTS: ShotSpec2D[] = [
  {
    fromFrame: 0,
    target: ['phone', 'bakery', 'courier', 'doorstep'],
    transition: 'cut',
    zoom: 0.91,
    label: 'Cztery kroki choreografii',
  },
];

const PL_FLOW_NODE_TEXT: Record<
  FlowNodeId,
  { stepTag: string; title: string; sentence: string }
> = {
  phone: {
    stepTag: '01 • TWÓJ TELEFON',
    title: 'Koszyk jednym kliknięciem',
    sentence: 'Ciepłe wypieki wybrane jednym ruchem kciuka.',
  },
  bakery: {
    stepTag: '02 • PIEKARNIA ZA ROGIEM',
    title: 'Prosto z pieca',
    sentence: 'Piekarze pakują pudełko, gdy lukier wciąż lśni.',
  },
  courier: {
    stepTag: '03 • NAJBLIŻSZY KURIER',
    title: 'Słoneczna trasa rowerowa',
    sentence: 'Najbliższy rowerzysta rusza cichą aleją.',
  },
  doorstep: {
    stepTag: '04 • TWOJE DRZWI',
    title: 'Ciepła dostawa',
    sentence: 'Świeże śniadanie dociera dokładnie na czas.',
  },
};

const PL_FLOW_EDGE_LABELS: Record<string, string> = {
  'edge-phone-bakery': 'Zamówienie wysłane',
  'edge-bakery-courier': 'Zapakowane ciepłe',
  'edge-courier-doorstep': '2 przecznice stąd',
};

const FLOW_NODE_COPY_PL = FLOW_NODE_COPY.map((node) => ({
  ...node,
  ...PL_FLOW_NODE_TEXT[node.id],
}));

const FLOW_EDGES_PL = FLOW_EDGES.map((edge) => ({
  ...edge,
  from: portRight(PL_FLOW_WORLD_NODES[edge.fromNodeId]),
  to: portLeft(PL_FLOW_WORLD_NODES[edge.toNodeId]),
  label: PL_FLOW_EDGE_LABELS[edge.id] ?? edge.label,
  labelOffsetY: edge.curveOffsetY < 0 ? -114 : 114,
}));

const PL_DOORSTEP_CARDS_TEXT: Record<
  string,
  { title: string; sentence: string }
> = {
  'instant-handoff': {
    title: 'Błyskawiczne przekazanie',
    sentence: 'Piekarnia widzi Twój koszyk w sekundzie, gdy tylko klikniesz.',
  },
  'live-street-view': {
    title: 'Podgląd trasy na żywo',
    sentence: 'Śledź kuriera przecznica po przecznicy bez żadnych domysłów.',
  },
  'always-warm': {
    title: 'Zawsze ciepłe',
    sentence: 'Mądre zgranie czasu łączy gorący piec z najbliższym rowerzystą.',
  },
  'happy-mornings': {
    title: 'Spokojne poranki',
    sentence: 'Mniej wypatrywania przez okno, więcej kawy przy stole.',
  },
};

const DOORSTEP_CARDS_PL = DOORSTEP_CARDS_WITH_SRCS.map((card) => {
  const localized = PL_DOORSTEP_CARDS_TEXT[card.id];
  return localized ? { ...card, ...localized } : card;
});

function resolveDispatchEtaStatusPl(progress01: number) {
  const p = Math.max(0, Math.min(1, progress01));
  if (p >= 0.94) {
    return {
      etaLabel: 'Pod drzwiami!',
      stageLabel: 'Ciepła paczka dostarczona',
      stepIndex: 2 as const,
    };
  }
  if (p >= 0.52) {
    return {
      etaLabel: '4 min',
      stageLabel: '2 przecznice stąd, ul. Klonowa',
      stepIndex: 1 as const,
    };
  }
  return {
    etaLabel: '12 min',
    stageLabel: 'Świeżo z piekarni za rogiem',
    stepIndex: 0 as const,
  };
}

export function getProductPromoCopy(lang: ProductPromoLang) {
  if (lang === 'pl') {
    return {
      defaultBrandName: 'Piekarnia Słoneczna',
      defaultHeroTitle: 'Jednym kliknięciem pod Twoje drzwi',
      defaultHeroSubtitle:
        'Zamów ciepłe poranne wypieki jednym dotknięciem — i patrz, jak jadą prosto pod Twoje drzwi.',
      defaultClosingHeadline: 'Lekkość od kliknięcia do stołu',
      defaultClosingSubline:
        'Przemyślana choreografia zamienia jedno dotknięcie w ciepły poranek pod drzwiami.',
      milestones: DEFAULT_PRODUCT_PROMO_TIMING.milestones.map((m) => ({
        ...m,
        label: PL_MILESTONE_LABELS[m.id] ?? m.label,
      })),
      act1: {
        badgeSuffix: 'Poranna dostawa',
        confirmed: 'Zamówienie potwierdzone ✓',
        readyIn: 'Gotowe za 15 min',
        openNow: 'Otwarte',
        itemTitle: 'Poranny zestaw',
        price: '54,00 zł',
        itemDesc: 'Chleb na zakwasie i cynamonka',
        ctaConfirmed: 'W piecu ✓',
        ctaIdle: 'Zamów pod drzwi',
      },
      act2: {
        eyebrow: '02  •  CHOREOGRAFIA',
        headline: 'Cztery kroki, zero domysłów',
        subline:
          'Jedno kliknięcie budzi piekarnię, dobiera najbliższego kuriera i wyznacza trasę.',
        worldNodes: PL_FLOW_WORLD_NODES,
        shots: PL_ACT2_SHOTS,
        nodes: FLOW_NODE_COPY_PL,
        edges: FLOW_EDGES_PL,
      },
      act3: {
        eyebrow: '03  •  ŚLEDZENIE NA ŻYWO',
        headline: 'Dwa ekrany, jeden rytm',
        subline:
          'Tablica piekarni i Twój telefon działają w idealnej synchronizacji.',
        browserUrl: 'sloneczna-piekarnia.przyklad/dostawa',
        bakeryBadge: 'Piekarnia',
        doorBadge: 'Twoje drzwi',
        spotlightLabel: 'Kurier na żywo',
        phoneHeader: 'Dostawa na żywo',
        stepOven: 'Piec',
        stepBike: 'Rower',
        stepDoor: 'Drzwi',
        itemTitle: 'Poranny zestaw',
        itemSub: 'Ciepły i zamknięty',
        resolveEta: resolveDispatchEtaStatusPl,
      },
      act4: {
        eyebrow: '04  •  PORANNY FINAŁ',
        cards: DOORSTEP_CARDS_PL,
      },
    };
  }
  return {
    defaultBrandName: productPromoDefaults.brandName,
    defaultHeroTitle: productPromoDefaults.heroTitle,
    defaultHeroSubtitle: productPromoDefaults.heroSubtitle,
    defaultClosingHeadline: productPromoDefaults.closingHeadline,
    defaultClosingSubline: productPromoDefaults.closingSubline,
    milestones: DEFAULT_PRODUCT_PROMO_TIMING.milestones,
    act1: {
      badgeSuffix: 'Morning Delivery',
      confirmed: 'Order Confirmed ✓',
      readyIn: 'Ready in 15 min',
      openNow: 'Open Now',
      itemTitle: 'Morning Box',
      price: '$14.00',
      itemDesc: 'Sourdough & Cinnamon Roll',
      ctaConfirmed: 'Baking Now ✓',
      ctaIdle: 'Send to My Door',
    },
      act2: {
        eyebrow: '02  •  CHOREOGRAPHY',
        headline: 'Four Steps, Zero Guesswork',
        subline:
          'Your tap wakes the kitchen, pairs the closest bike, and picks the sunny route.',
        worldNodes: FLOW_WORLD_NODES,
        shots: ACT2_SHOTS,
        nodes: FLOW_NODE_COPY,
        edges: FLOW_EDGES,
      },
    act3: {
      eyebrow: '03  •  LIVE SYNC TRACKER',
      headline: 'Two Screens, One Rhythm',
      subline:
        'The bakery board and your pocket screen stay perfectly in step.',
      browserUrl: 'sunbeam-bakery.example/dispatch',
      bakeryBadge: 'Bakery',
      doorBadge: 'Your Door',
      spotlightLabel: 'Live Rider Sync',
      phoneHeader: 'Live Delivery',
      stepOven: 'Oven',
      stepBike: 'Bike',
      stepDoor: 'Door',
      itemTitle: 'Morning Box',
      itemSub: 'Warm & sealed',
      resolveEta: resolveDispatchEtaStatus,
    },
    act4: {
      eyebrow: '04  •  WARM MORNING FINALE',
      cards: DOORSTEP_CARDS_WITH_SRCS,
    },
  };
}

function toCrispTranslateY(enter: number, startOffsetPx: number): string {
  if (enter >= 0.999) return 'none';
  const dy = Math.round((1 - enter) * startOffsetPx);
  return dy === 0 ? 'none' : `translateY(${dy}px)`;
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
      <FillLayer
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

// ============================================================================
// Act 1 — One Tap Order (`VectorSceneStage2D` + Two-Column Hero + `PhoneFrame`)
// ============================================================================
const Act1OneTapOrder: React.FC<{
  brandName: string;
  heroTitle: string;
  heroSubtitle: string;
  milestones: ReadonlyArray<PaperTimelineMilestone>;
  copy: ReturnType<typeof getProductPromoCopy>['act1'];
}> = memo(({ brandName, heroTitle, heroSubtitle, milestones, copy }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  useStudioFontsReady();
  const style = useStudioStyle();

  const displayFont = useMemo(
    () => formatFontFamilyCss(style.typography.displayFont, 'display'),
    [style.typography.displayFont]
  );
  const bodyFont = useMemo(
    () => formatFontFamilyCss(style.typography.bodyFont, 'body'),
    [style.typography.bodyFont]
  );
  const monoFont = useMemo(
    () => formatFontFamilyCss(style.typography.monoFont, 'mono'),
    [style.typography.monoFont]
  );

  const heroEnter =
    frame < 4
      ? 0
      : spring({
          frame: frame - 4,
          fps,
          config: getStyleSpringConfig(style, 'enter'),
        });
  const badgeEnter =
    frame < 10
      ? 0
      : spring({
          frame: frame - 10,
          fps,
          config: getStyleSpringConfig(style, 'enter'),
        });

  // Phone tap moment synced 1:1 to `phone-tap-confirm` SFX cue (`startFrame + 36`)
  const tapFrame = 36;
  const isConfirmed = frame >= tapFrame;
  const tapPress = interpolate(
    frame,
    [tapFrame - 6, tapFrame - 1, tapFrame + 6],
    [0, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const buttonScale =
    tapPress > 0.005 ? Number((1 - tapPress * 0.055).toFixed(4)) : 1;

  const rippleProgress = interpolate(frame, [tapFrame - 4, tapFrame + 28], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const showRipple = frame >= tapFrame - 4 && frame <= tapFrame + 28;

  const confirmPop = isConfirmed
    ? spring({
        frame: frame - tapFrame,
        fps,
        config: { damping: 14, stiffness: 210, mass: 0.75 },
      })
    : 0;
  const confirmPillTransform =
    !isConfirmed
      ? toCrispTranslateY(badgeEnter, 14)
      : confirmPop >= 0.999
        ? 'none'
        : `scale(${(0.94 + 0.06 * confirmPop).toFixed(4)})`;

  return (
    <FillLayer style={{ boxSizing: 'border-box' }}>
      <VectorSceneStage2D renderBaseFill={false} seed={5101}>
        <FillLayer
          style={{
            display: 'grid',
            gridTemplateColumns: '1.15fr 0.85fr',
            alignItems: 'center',
            gap: 72,
            padding: '84px 124px 128px 124px',
            boxSizing: 'border-box',
          }}
        >
          {/* Left Column: Sunny Product Story Opener */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'center',
              gap: 24,
              maxWidth: 820,
              opacity: heroEnter >= 0.999 ? 1 : heroEnter,
              transform: toCrispTranslateY(heroEnter, 18),
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 20px',
                borderRadius: 999,
                backgroundColor: style.palette.bgSurface,
                border: `1.5px solid ${style.palette.inkBorder}`,
                boxShadow: '0 6px 18px rgba(15, 23, 42, 0.06)',
                boxSizing: 'border-box',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: '#EA580C',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: monoFont,
                  fontSize: 19,
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: style.palette.textPrimary,
                }}
              >
                {brandName} • {copy.badgeSuffix}
              </span>
            </div>

            <div
              style={{
                fontFamily: displayFont,
                fontSize: 74,
                fontWeight: 800,
                lineHeight: 1.06,
                letterSpacing: '-0.025em',
                color: style.palette.textPrimary,
                textWrap: 'balance',
                boxSizing: 'border-box',
              }}
            >
              {heroTitle}
            </div>

            <div
              style={{
                width: 88,
                height: 4,
                borderRadius: 2,
                backgroundColor: '#EA580C',
                boxSizing: 'border-box',
              }}
            />

            <div
              style={{
                fontFamily: bodyFont,
                fontSize: 25,
                fontWeight: 500,
                lineHeight: 1.44,
                color: style.palette.textSecondary,
                maxWidth: 740,
                boxSizing: 'border-box',
              }}
            >
              {heroSubtitle}
            </div>

            {/* Live Confirmation Status Pill */}
            <div
              style={{
                marginTop: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 26px',
                borderRadius: 18,
                backgroundColor: isConfirmed ? '#ECFDF5' : style.palette.bgSurface,
                border: `2px solid ${isConfirmed ? '#0F766E' : style.palette.inkBorder}`,
                boxShadow: isConfirmed
                  ? '0 14px 28px rgba(15, 118, 110, 0.14)'
                  : '0 10px 24px rgba(15, 23, 42, 0.06)',
                opacity: badgeEnter >= 0.999 ? 1 : badgeEnter,
                transform: confirmPillTransform,
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  backgroundColor: isConfirmed ? '#0F766E' : '#FFF7ED',
                  border: isConfirmed ? 'none' : '1.5px solid #FDBA74',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxSizing: 'border-box',
                }}
              >
                {isConfirmed ? (
                  <Check size={20} color="#FFFFFF" strokeWidth={2.8} />
                ) : (
                  <Clock size={19} color="#EA580C" strokeWidth={2.4} />
                )}
              </div>
              <span
                style={{
                  fontFamily: displayFont,
                  fontSize: 22,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: isConfirmed ? '#0F766E' : style.palette.textPrimary,
                }}
              >
                {isConfirmed ? copy.confirmed : copy.readyIn}
              </span>
            </div>
          </div>

          {/* Right Column: Sunbeam Bakery Mobile App in PhoneFrame */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
            }}
          >
            <PhoneFrame width={394} height={776} theme="light" enterFrame={6}>
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#FFFDF8',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '56px 24px 30px 24px',
                  boxSizing: 'border-box',
                }}
              >
                {/* App Top Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxSizing: 'border-box',
                  }}
                >
                  <div
                    style={{
                      fontFamily: displayFont,
                      fontSize: 21,
                      fontWeight: 800,
                      color: '#1C1917',
                    }}
                  >
                    {brandName}
                  </div>
                  <div
                    style={{
                      fontFamily: bodyFont,
                      fontSize: 18,
                      fontWeight: 600,
                      color: '#0F766E',
                      backgroundColor: '#ECFDF5',
                      padding: '4px 12px',
                      borderRadius: 999,
                    }}
                  >
                    {copy.openNow}
                  </div>
                </div>

                {/* Warm Bakery Box Illustration */}
                <div
                  style={{
                    width: '100%',
                    height: 274,
                    borderRadius: 20,
                    overflow: 'hidden',
                    border: '1.5px solid #EDE4D5',
                    boxShadow: '0 12px 24px rgba(28, 25, 23, 0.08)',
                    boxSizing: 'border-box',
                  }}
                >
                  <Img
                    src={BAKERY_BOX_SRC}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </div>

                {/* Menu Item Details */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    boxSizing: 'border-box',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: displayFont,
                        fontSize: 26,
                        fontWeight: 800,
                        color: '#1C1917',
                        lineHeight: 1.15,
                      }}
                    >
                      {copy.itemTitle}
                    </div>
                    <div
                      style={{
                        fontFamily: displayFont,
                        fontSize: 22,
                        fontWeight: 800,
                        fontVariantNumeric: 'tabular-nums',
                        color: '#EA580C',
                      }}
                    >
                      {copy.price}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: bodyFont,
                      fontSize: 19,
                      fontWeight: 500,
                      color: '#57534E',
                      lineHeight: 1.35,
                    }}
                  >
                    {copy.itemDesc}
                  </div>
                </div>

                {/* Tactile Order Button + Clean Tap Ripple */}
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: 64,
                      borderRadius: 18,
                      backgroundColor: isConfirmed ? '#0F766E' : '#EA580C',
                      boxShadow: isConfirmed
                        ? '0 10px 22px rgba(15, 118, 110, 0.28)'
                        : '0 10px 22px rgba(234, 88, 12, 0.28)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      transform:
                        buttonScale === 1 ? 'none' : `scale(${buttonScale})`,
                      boxSizing: 'border-box',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: displayFont,
                        fontSize: 21,
                        fontWeight: 700,
                        color: '#FFFFFF',
                        letterSpacing: '0.01em',
                      }}
                    >
                      {isConfirmed ? copy.ctaConfirmed : copy.ctaIdle}
                    </span>
                  </div>

                  {showRipple && (
                    <div
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        width: 44,
                        height: 44,
                        marginLeft: -22,
                        marginTop: -22,
                        borderRadius: '50%',
                        border: '3px solid #FFFFFF',
                        backgroundColor: 'rgba(255, 255, 255, 0.25)',
                        opacity: Number((1 - rippleProgress).toFixed(3)),
                        transform: `scale(${(0.75 + rippleProgress * 2.1).toFixed(3)})`,
                        pointerEvents: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  )}
                </div>
              </div>
            </PhoneFrame>
          </div>
        </FillLayer>
      </VectorSceneStage2D>

      <PaperRibbonTimeline
        milestones={milestones}
        activeId="tap-en"
        position="bottom"
        enterFrame={8}
      />
    </FillLayer>
  );
});
Act1OneTapOrder.displayName = 'Act1OneTapOrder';

// ============================================================================
// Act 2 — Four-Step Choreography (`MotionDiagramStage2D` + `SystemNode` + `DataFlowEdge`)
// ============================================================================
const Act2FourStepFlow: React.FC<{
  durationInFrames: number;
  milestones: ReadonlyArray<PaperTimelineMilestone>;
  copy: ReturnType<typeof getProductPromoCopy>['act2'];
}> = memo(({ durationInFrames, milestones, copy }) => (
  <FillLayer style={{ boxSizing: 'border-box' }}>
    <MotionDiagramStage2D
      renderBaseFill={false}
      seed={5102}
      nodes={copy.worldNodes}
      shots={copy.shots}
      handheldIntensity={0}
    >
      {copy.edges.map((edge) => (
        <DataFlowEdge
          key={edge.id}
          id={edge.id}
          from={edge.from}
          to={edge.to}
          curveOffsetY={edge.curveOffsetY}
          color={edge.color}
          secondaryColor={edge.secondaryColor}
          drawStartFrame={edge.drawStartFrame}
          flowStartFrame={edge.drawStartFrame + 16}
          flowEndFrame={Math.max(edge.drawStartFrame + 140, durationInFrames - 18)}
          packetCount={1}
          traverseFrames={96}
          label={edge.label}
          labelT={edge.labelT}
          labelOffsetX={edge.labelOffsetX}
          labelOffsetY={edge.labelOffsetY}
        />
      ))}

      {copy.nodes.map((node, idx) => {
        const box = copy.worldNodes[node.id];
        return (
          <SystemNode
            key={node.id}
            id={node.id}
            nodeId={node.id}
            badge={node.stepTag}
            title={node.title}
            subtitle={node.sentence}
            icon={FLOW_NODE_ICONS[node.id]}
            x={box.cx}
            y={box.cy}
            width={box.w}
            height={box.h}
            accentColor={node.accentColor}
            enterFrame={6 + idx * 14}
            activeRanges={[[26 + idx * 48, durationInFrames]]}
          />
        );
      })}
    </MotionDiagramStage2D>

    <FloatingEditorialDisplay
      eyebrow={copy.eyebrow}
      headline={copy.headline}
      subline={copy.subline}
      align="left"
      position="top"
      tone="dark-on-light"
      headlinePx={46}
      sublinePx={22}
      enterFrame={4}
    />

    <PaperRibbonTimeline
      milestones={milestones}
      activeId="flow-en"
      position="bottom"
      enterFrame={6}
    />
  </FillLayer>
));
Act2FourStepFlow.displayName = 'Act2FourStepFlow';

// ============================================================================
// Act 3 — Live Sync Tracker (`BrowserFrame` Map Route + `PhoneFrame` Live ETA)
// ============================================================================
const Act3LiveSyncTracker: React.FC<{
  brandName: string;
  durationInFrames: number;
  milestones: ReadonlyArray<PaperTimelineMilestone>;
  copy: ReturnType<typeof getProductPromoCopy>['act3'];
}> = memo(({ brandName, durationInFrames, milestones, copy }) => {
  const frame = useCurrentFrame();
  useStudioFontsReady();
  const style = useStudioStyle();

  const displayFont = useMemo(
    () => formatFontFamilyCss(style.typography.displayFont, 'display'),
    [style.typography.displayFont]
  );
  const bodyFont = useMemo(
    () => formatFontFamilyCss(style.typography.bodyFont, 'body'),
    [style.typography.bodyFont]
  );
  const monoFont = useMemo(
    () => formatFontFamilyCss(style.typography.monoFont, 'mono'),
    [style.typography.monoFont]
  );

  // Single source of truth for map route SVG, bike rider badge, and phone ETA
  const routeEndFrame = Math.max(220, durationInFrames - 135);
  const routeProgress = interpolate(frame, [28, routeEndFrame], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const riderPt = evaluateDispatchRouteAtProgress(routeProgress);
  const liveStatus = copy.resolveEta(routeProgress);
  const isArrived = liveStatus.stepIndex === 2;
  const doorBadgeOpacity = interpolate(routeProgress, [0.88, 0.94], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const activeRouteSvgPath =
    routeProgress > 0.004
      ? buildDispatchRoutePrefixSvgPath(ROUTE_SVG_W, ROUTE_SVG_H, routeProgress)
      : '';

  // Keep spotlight rect comfortably inside BrowserFrame edges
  const spotX = Math.max(4, Math.min(78, riderPt.x * 100 - 9));
  const spotY = Math.max(14, Math.min(72, riderPt.y * 100 - 12));

  return (
    <FillLayer style={{ boxSizing: 'border-box' }}>
      <VectorSceneStage2D renderBaseFill={false} seed={5103}>
        <FillLayer
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 54,
            padding: '204px 84px 112px 84px',
            boxSizing: 'border-box',
          }}
        >
          {/* Left: Bakery Dispatch Board in BrowserFrame */}
          <BrowserFrame
            url={copy.browserUrl}
            title={brandName}
            variant="macos"
            theme="light"
            width={1080}
            aspectRatio="1376 / 768"
            enterFrame={6}
            accentColor="#EA580C"
            imageSrc={NEIGHBORHOOD_MAP_SRC}
            objectFit="cover"
            style={{ flexShrink: 0 }}
          >
            {/* Single-Source 27-Point Road + Park Trail Centerline Overlay */}
            <svg
              viewBox={`0 0 ${ROUTE_SVG_W} ${ROUTE_SVG_H}`}
              preserveAspectRatio="none"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
              aria-hidden="true"
            >
              {/* Warm cream halo so route reads crisply over white streets & park path */}
              <path
                d={FULL_DISPATCH_ROUTE_SVG_PATH}
                fill="none"
                stroke="rgba(255, 253, 248, 0.88)"
                strokeWidth={13}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Resting dashed street/trail guide */}
              <path
                d={FULL_DISPATCH_ROUTE_SVG_PATH}
                fill="none"
                stroke="#94A3B8"
                strokeWidth={4.5}
                strokeDasharray="10 10"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Exact arc-length coral route prefix terminating dead-center under bike pin */}
              {activeRouteSvgPath && (
                <path
                  d={activeRouteSvgPath}
                  fill="none"
                  stroke="#EA580C"
                  strokeWidth={7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {/* Crisp street-curb start & finish dots */}
              <circle
                cx={DISPATCH_ROUTE_POINTS.p0.x * ROUTE_SVG_W}
                cy={DISPATCH_ROUTE_POINTS.p0.y * ROUTE_SVG_H}
                r={7}
                fill="#FFFDF8"
                stroke="#EA580C"
                strokeWidth={3.5}
              />
              <circle
                cx={DISPATCH_ROUTE_POINTS.p3.x * ROUTE_SVG_W}
                cy={DISPATCH_ROUTE_POINTS.p3.y * ROUTE_SVG_H}
                r={7}
                fill={isArrived ? '#0F766E' : '#FFFDF8'}
                stroke={isArrived ? '#0F766E' : '#2563EB'}
                strokeWidth={3.5}
              />
            </svg>

            {/* Bakery Courtyard Marker (cleanly west of vertical avenue) */}
            <div
              style={{
                position: 'absolute',
                left: `${(DISPATCH_BAKERY_BADGE_POS.x * 100).toFixed(2)}%`,
                top: `${(DISPATCH_BAKERY_BADGE_POS.y * 100).toFixed(2)}%`,
                transform: 'translate(-50%, -50%)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 999,
                backgroundColor: '#FFFDF8',
                border: '2px solid #EA580C',
                boxShadow: '0 6px 16px rgba(28, 25, 23, 0.16)',
                boxSizing: 'border-box',
              }}
            >
              <Store size={18} color="#EA580C" strokeWidth={2.4} />
                <span
                  style={{
                    fontFamily: displayFont,
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#1C1917',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {copy.bakeryBadge}
                </span>
              </div>

              {/* Doorstep Courtyard Marker (fades cleanly before emerald arrival pill lands) */}
              {doorBadgeOpacity > 0.01 && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${(DISPATCH_DOOR_BADGE_POS.x * 100).toFixed(2)}%`,
                    top: `${(DISPATCH_DOOR_BADGE_POS.y * 100).toFixed(2)}%`,
                    transform: 'translate(-50%, -50%)',
                    opacity: Number(doorBadgeOpacity.toFixed(3)),
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 14px',
                    borderRadius: 999,
                    backgroundColor: '#FFFDF8',
                    border: '2px solid #2563EB',
                    boxShadow: '0 6px 16px rgba(28, 25, 23, 0.16)',
                    boxSizing: 'border-box',
                  }}
                >
                  <Home size={18} color="#2563EB" strokeWidth={2.4} />
                  <span
                    style={{
                      fontFamily: displayFont,
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#1C1917',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {copy.doorBadge}
                  </span>
                </div>
              )}

              {/* Live Gliding Bike Rider Pin */}
              <div
                style={{
                  position: 'absolute',
                  left: `${(riderPt.x * 100).toFixed(2)}%`,
                  top: `${(riderPt.y * 100).toFixed(2)}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 5,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 999,
                  backgroundColor: isArrived ? '#0F766E' : '#EA580C',
                  border: '2.5px solid #FFFFFF',
                  boxShadow: '0 10px 24px rgba(234, 88, 12, 0.35)',
                  boxSizing: 'border-box',
                }}
              >
                <Bike size={20} color="#FFFFFF" strokeWidth={2.4} />
                <span
                  style={{
                    fontFamily: monoFont,
                    fontSize: 18,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: '#FFFFFF',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {liveStatus.etaLabel}
                </span>
              </div>

              {/* Screen Spotlight highlighting active courier mid-ride */}
              <ScreenSpotlightOverlay
                x={spotX}
                y={spotY}
                width={18}
                height={24}
                startFrame={116}
                endFrame={276}
                label={copy.spotlightLabel}
                accentColor="#EA580C"
                dimOpacity={0.22}
              />
            </BrowserFrame>

            {/* Right: Customer Pocket Live Tracker in PhoneFrame */}
            <PhoneFrame
              width={356}
              height={664}
              theme="light"
              enterFrame={12}
              style={{ flexShrink: 0 }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#FFFDF8',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '50px 22px 28px 22px',
                  boxSizing: 'border-box',
                }}
              >
                {/* Pocket Header */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    boxSizing: 'border-box',
                  }}
                >
                  <div
                    style={{
                      fontFamily: monoFont,
                      fontSize: 18,
                      fontWeight: 700,
                      letterSpacing: '0.07em',
                      textTransform: 'uppercase',
                      color: '#EA580C',
                    }}
                  >
                    {copy.phoneHeader}
                  </div>
                  <div
                    style={{
                      fontFamily: displayFont,
                      fontSize: 22,
                      fontWeight: 800,
                      color: '#1C1917',
                    }}
                  >
                    {brandName}
                  </div>
                </div>

                {/* Big Synced ETA Display */}
                <div
                  style={{
                    padding: '22px 20px',
                    borderRadius: 20,
                    backgroundColor: isArrived ? '#ECFDF5' : '#FFF7ED',
                    border: `2px solid ${isArrived ? '#0F766E' : '#FDBA74'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    boxSizing: 'border-box',
                  }}
                >
                  <div
                    style={{
                      fontFamily: displayFont,
                      fontSize: isArrived ? 36 : 46,
                      fontWeight: 800,
                      fontVariantNumeric: 'tabular-nums',
                      lineHeight: 1.08,
                      color: isArrived ? '#0F766E' : '#1C1917',
                    }}
                  >
                    {liveStatus.etaLabel}
                  </div>
                  <div
                    style={{
                      fontFamily: bodyFont,
                      fontSize: 19,
                      fontWeight: 600,
                      color: isArrived ? '#0F766E' : '#57534E',
                      lineHeight: 1.32,
                    }}
                  >
                    {liveStatus.stageLabel}
                  </div>
                </div>

                {/* Synced 3-Step Route Progress Bar */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    boxSizing: 'border-box',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: 12,
                      borderRadius: 999,
                      backgroundColor: '#EDE4D5',
                      overflow: 'hidden',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.max(8, Math.round(routeProgress * 100))}%`,
                        height: '100%',
                        borderRadius: 999,
                        backgroundColor: isArrived ? '#0F766E' : '#EA580C',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontFamily: bodyFont,
                      fontSize: 18,
                      fontWeight: 600,
                      color: '#57534E',
                    }}
                  >
                    <span style={{ color: '#1C1917' }}>{copy.stepOven}</span>
                    <span
                      style={{
                        color: liveStatus.stepIndex >= 1 ? '#1C1917' : '#94A3B8',
                      }}
                    >
                      {copy.stepBike}
                    </span>
                    <span style={{ color: isArrived ? '#0F766E' : '#94A3B8' }}>
                      {copy.stepDoor}
                    </span>
                  </div>
                </div>

                {/* Mini Order Summary Card */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 14px',
                    borderRadius: 16,
                    backgroundColor: '#F8F5EF',
                    border: '1.5px solid #E7DEC8',
                    boxSizing: 'border-box',
                  }}
                >
                  <div
                    style={{
                      width: 78,
                      height: 60,
                      borderRadius: 12,
                      overflow: 'hidden',
                      flexShrink: 0,
                      boxSizing: 'border-box',
                    }}
                  >
                    <Img
                      src={BAKERY_BOX_SRC}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: displayFont,
                        fontSize: 20,
                        fontWeight: 700,
                        color: '#1C1917',
                      }}
                    >
                      {copy.itemTitle}
                    </div>
                    <div
                      style={{
                        fontFamily: bodyFont,
                        fontSize: 18,
                        fontWeight: 500,
                        color: '#57534E',
                      }}
                    >
                      {copy.itemSub}
                    </div>
                  </div>
                </div>
              </div>
            </PhoneFrame>
          </FillLayer>
        </VectorSceneStage2D>

        <FloatingEditorialDisplay
          eyebrow={copy.eyebrow}
          headline={copy.headline}
          subline={copy.subline}
          align="left"
          position="top"
          tone="dark-on-light"
          headlinePx={46}
          sublinePx={22}
          enterFrame={4}
        />

        <PaperRibbonTimeline
          milestones={milestones}
          activeId="live-sync-en"
          position="bottom"
          enterFrame={6}
        />
      </FillLayer>
    );
  });
  Act3LiveSyncTracker.displayName = 'Act3LiveSyncTracker';

  // ============================================================================
  // Act 4 — Warm Morning Finale (`VectorSceneStage2D` + 2x2 Illustrated Editorial Cards)
  // ============================================================================
  const Act4MorningFinale: React.FC<{
    closingHeadline: string;
    closingSubline: string;
    durationInFrames: number;
    milestones: ReadonlyArray<PaperTimelineMilestone>;
    copy: ReturnType<typeof getProductPromoCopy>['act4'];
  }> = memo(({ closingHeadline, closingSubline, durationInFrames, milestones, copy }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    useStudioFontsReady();
    const style = useStudioStyle();

    const displayFont = useMemo(
      () => formatFontFamilyCss(style.typography.displayFont, 'display'),
      [style.typography.displayFont]
    );
    const bodyFont = useMemo(
      () => formatFontFamilyCss(style.typography.bodyFont, 'body'),
      [style.typography.bodyFont]
    );

    const effectiveStart = 8;
    const staggerFrames = 10;

    return (
      <FillLayer style={{ boxSizing: 'border-box' }}>
        <VectorSceneStage2D renderBaseFill={false} seed={5104}>
          <FillLayer
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '204px 80px 112px 80px',
              boxSizing: 'border-box',
            }}
          >
            <div
              data-illustrated-feature-grid-2x2="true"
              style={{
                width: '100%',
                maxWidth: 1560,
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                alignItems: 'stretch',
                gap: 28,
                boxSizing: 'border-box',
              }}
            >
              {copy.cards.map((card, idx) => {
              const cardStart = effectiveStart + idx * staggerFrames;
              const enter =
                frame < cardStart
                  ? 0
                  : spring({
                      frame: frame - cardStart,
                      fps,
                      config: getStyleSpringConfig(style, 'enter'),
                    });
              const accent = card.accentColor ?? style.palette.accentPrimary;
              const kenBurnsScale = interpolate(
                frame,
                [cardStart, Math.max(cardStart + 240, durationInFrames)],
                [1, 1.04],
                {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }
              );

              return (
                <div
                  key={card.id}
                  style={getCardChromeStyle(style, {
                    position: 'relative',
                    display: 'grid',
                    gridTemplateColumns: '248px 1fr',
                    alignItems: 'center',
                    gap: 26,
                    padding: '22px 28px 22px 22px',
                    borderRadius: 20,
                    backgroundColor: '#FFFDF8',
                    boxShadow: '0 14px 32px rgba(28, 25, 23, 0.08)',
                    height: 'auto',
                    boxSizing: 'border-box',
                    opacity: enter >= 0.999 ? 1 : enter,
                    transform: toCrispTranslateY(enter, 18),
                  })}
                >
                  <ClippedSurfaceChrome
                    topBarHeight={3}
                    topBarColor={accent}
                    specularRim={!style.surface.isDark}
                  />

                  {/* Left: Full-bleed 4:3 gouache illustration with subtle Ken Burns drift */}
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      width: 248,
                      height: 186,
                      borderRadius: 14,
                      overflow: 'hidden',
                      border: '1.5px solid rgba(28, 25, 23, 0.08)',
                      boxShadow: '0 8px 18px rgba(28, 25, 23, 0.08)',
                      backgroundColor: '#F5EFE4',
                      flexShrink: 0,
                      boxSizing: 'border-box',
                    }}
                  >
                    <Img
                      src={card.resolvedSrc}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        transform: `scale(${kenBurnsScale.toFixed(4)})`,
                        transformOrigin: '50% 50%',
                      }}
                    />
                  </div>

                  {/* Right: Warm editorial headline + 1 crisp sentence */}
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      gap: 10,
                      boxSizing: 'border-box',
                    }}
                  >
                    <div
                      aria-hidden="true"
                      style={{
                        width: 34,
                        height: 3.5,
                        borderRadius: 2,
                        backgroundColor: accent,
                      }}
                    />
                    <div
                      style={{
                        fontFamily: displayFont,
                        fontSize: 28,
                        fontWeight: 800,
                        lineHeight: 1.18,
                        letterSpacing: '-0.015em',
                        color: style.palette.textPrimary,
                      }}
                    >
                      {formatHeadingText(card.title, style)}
                    </div>
                    <div
                      style={{
                        fontFamily: bodyFont,
                        fontSize: 20,
                        fontWeight: 500,
                        lineHeight: 1.42,
                        color: style.palette.textSecondary,
                      }}
                    >
                      {card.sentence}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </FillLayer>
      </VectorSceneStage2D>

      <FloatingEditorialDisplay
        eyebrow={copy.eyebrow}
        headline={closingHeadline}
        subline={closingSubline}
        align="left"
        position="top"
        tone="dark-on-light"
        headlinePx={48}
        sublinePx={22}
        enterFrame={4}
      />

      <PaperRibbonTimeline
        milestones={milestones}
        activeId="doorstep-en"
        position="bottom"
        enterFrame={6}
      />
    </FillLayer>
  );
});
Act4MorningFinale.displayName = 'Act4MorningFinale';

// ============================================================================
// Root Orchestrator (`ContinuousSceneFlow` + Audio Bed + Clean Frame 0)
// ============================================================================
interface ProductPromoStageInnerProps {
  lang: ProductPromoLang;
  brandName: string;
  heroTitle: string;
  heroSubtitle: string;
  closingHeadline: string;
  closingSubline: string;
  voiceoverVolume: number;
  musicVolume: number;
  sfxVolume: number;
}

const ProductPromoStageInner: React.FC<ProductPromoStageInnerProps> = memo(
  ({
    lang,
    brandName,
    heroTitle,
    heroSubtitle,
    closingHeadline,
    closingSubline,
    voiceoverVolume,
    musicVolume,
    sfxVolume,
  }) => {
    const outerStyle = useStudioStyle();
    const timing = DEFAULT_PRODUCT_PROMO_TIMING;
    const copy = useMemo(() => getProductPromoCopy(lang), [lang]);

    const scenes = useMemo<ContinuousSceneSpec[]>(() => {
      const s1 = timing.sceneById['tap-en'];
      const s2 = timing.sceneById['flow-en'];
      const s3 = timing.sceneById['live-sync-en'];
      const s4 = timing.sceneById['doorstep-en'];

      // Nominal slot durations sum 1:1 to `timing.totalDurationInFrames`
      return [
        {
          id: s1.id,
          durationInFrames: s2.startFrame - s1.startFrame,
          usesThree: false,
          render: () => (
            <Act1OneTapOrder
              brandName={brandName}
              heroTitle={heroTitle}
              heroSubtitle={heroSubtitle}
              milestones={copy.milestones}
              copy={copy.act1}
            />
          ),
        },
        {
          id: s2.id,
          durationInFrames: s3.startFrame - s2.startFrame,
          usesThree: false,
          render: () => (
            <Act2FourStepFlow
              durationInFrames={s2.durationInFrames}
              milestones={copy.milestones}
              copy={copy.act2}
            />
          ),
        },
        {
          id: s3.id,
          durationInFrames: s4.startFrame - s3.startFrame,
          usesThree: false,
          render: () => (
            <Act3LiveSyncTracker
              brandName={brandName}
              durationInFrames={s3.durationInFrames}
              milestones={copy.milestones}
              copy={copy.act3}
            />
          ),
        },
        {
          id: s4.id,
          durationInFrames: s4.durationInFrames,
          usesThree: false,
          render: () => (
            <Act4MorningFinale
              closingHeadline={closingHeadline}
              closingSubline={closingSubline}
              durationInFrames={s4.durationInFrames}
              milestones={copy.milestones}
              copy={copy.act4}
            />
          ),
        },
      ];
    }, [
      brandName,
      heroTitle,
      heroSubtitle,
      closingHeadline,
      closingSubline,
      timing,
      copy,
    ]);

    return (
      <FillLayer style={{ boxSizing: 'border-box' }}>
        <ContinuousSceneFlow
          scenes={scenes}
          crossDissolveFrames={PROMO_CROSS_DISSOLVE_FRAMES}
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
      </FillLayer>
    );
  }
);
ProductPromoStageInner.displayName = 'ProductPromoStageInner';

export const ProductPromo: React.FC<Partial<ProductPromoProps>> = (
  rawProps
) => {
  const merged: ProductPromoProps = {
    ...(productPromoDefaults as ProductPromoProps),
    ...rawProps,
    lang: rawProps.lang ?? 'en',
  };
  const copy = getProductPromoCopy(merged.lang);
  const resolvedBrandName =
    merged.lang === 'pl' && merged.brandName === productPromoDefaults.brandName
      ? copy.defaultBrandName
      : merged.brandName;
  const resolvedHeroTitle =
    merged.lang === 'pl' && merged.heroTitle === productPromoDefaults.heroTitle
      ? copy.defaultHeroTitle
      : merged.heroTitle;
  const resolvedHeroSubtitle =
    merged.lang === 'pl' &&
    merged.heroSubtitle === productPromoDefaults.heroSubtitle
      ? copy.defaultHeroSubtitle
      : merged.heroSubtitle;
  const resolvedClosingHeadline =
    merged.lang === 'pl' &&
    merged.closingHeadline === productPromoDefaults.closingHeadline
      ? copy.defaultClosingHeadline
      : merged.closingHeadline;
  const resolvedClosingSubline =
    merged.lang === 'pl' &&
    merged.closingSubline === productPromoDefaults.closingSubline
      ? copy.defaultClosingSubline
      : merged.closingSubline;

  return (
    <StyleProvider style={merged.styleId} renderBackdrop>
      <ProductPromoStageInner
        lang={merged.lang}
        brandName={resolvedBrandName}
        heroTitle={resolvedHeroTitle}
        heroSubtitle={resolvedHeroSubtitle}
        closingHeadline={resolvedClosingHeadline}
        closingSubline={resolvedClosingSubline}
        voiceoverVolume={merged.voiceoverVolume}
        musicVolume={merged.musicVolume}
        sfxVolume={merged.sfxVolume}
      />
    </StyleProvider>
  );
};
