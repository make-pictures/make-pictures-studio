import { ThreeCanvas } from '@remotion/three';
import React, { useMemo } from 'react';
import { Clapperboard } from 'lucide-react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import {
  type CameraImpulse,
  DirectorCamera3D,
  getSceneVoiceover,
  type ShotSpec3D,
  SmartMusicBed,
  SoundCue,
  type StageAnchor3D,
  useStudioFontsReady,
} from '@make-pictures/core';
import {
  AnimatedMetricCounter,
  CinematicLensOverlay,
  ContactShadowDisc3D,
  ImpactKeywordCard,
  PaperCloudCutout3D,
  PaperCutout3D,
  PaperMountainBackdrop3D,
  PaperPineTree3D,
  PaperStageLighting3D,
  ParticleField,
  PopUpBookBase3D,
  PopUpHinge3D,
  StagePostProcessing3D,
  WordByWordStage,
} from '@make-pictures/kits';
import { VOICEOVER_MANIFEST } from '../../src/generated/voiceover-data';
import directorShowcaseDefaults from './DirectorShowcase.props.json';

export const directorShowcaseSchema = z.object({
  heroHeadline: z.string().describe('Texts & Labels :: Hero Headline'),
  heroSublabel: z.string().describe('Texts & Labels :: Hero Sublabel'),
  eyebrowBadge: z.string().describe('Texts & Labels :: Eyebrow Badge'),
  accentColor: z.string().describe('Colors & Style :: Primary Accent'),
  secondaryColor: z.string().describe('Colors & Style :: Secondary Accent'),
  skyBackground: z.string().describe('Colors & Style :: Stage Sky Color'),
  handheldIntensity: z
    .number()
    .min(0)
    .max(0.5)
    .describe('Cinematography & VFX :: Handheld Drift'),
  vignetteIntensity: z
    .number()
    .min(0)
    .max(0.8)
    .describe('Cinematography & VFX :: Lens Vignette'),
  warmLightLeak: z
    .number()
    .min(0)
    .max(0.6)
    .describe('Cinematography & VFX :: Warm Light Leak'),
  showWordStage: z
    .boolean()
    .describe('Texts & Labels :: Show Word-by-Word Stage'),
  voiceoverVolume: z
    .number()
    .min(0)
    .max(1.5)
    .describe('Audio :: Voiceover Volume'),
  musicBaseVolume: z
    .number()
    .min(0)
    .max(0.8)
    .describe('Audio :: Music Base Volume'),
  musicDuckedVolume: z
    .number()
    .min(0)
    .max(0.4)
    .describe('Audio :: Music Ducked Volume'),
  sfxVolume: z.number().min(0).max(1).describe('Audio :: SFX Volume'),
});

export type DirectorShowcaseProps = z.infer<typeof directorShowcaseSchema>;

export const DIRECTOR_SHOWCASE_ANCHORS: Record<string, StageAnchor3D> = {
  stageCenter: { position: [0, 0, -1.0], height: 2.2, radius: 4.1 },
  heroMonolith: { position: [0, 0, 0.45], height: 2.25, radius: 1.9 },
  leftClapper: { position: [-4.45, 0, -0.55], height: 2.1, radius: 1.35 },
  rightAudioTower: { position: [4.45, 0, -0.55], height: 2.1, radius: 1.35 },
};

export const DIRECTOR_SHOWCASE_SHOTS: ShotSpec3D[] = [
  {
    fromFrame: 0,
    shot: 'establishing-wide',
    target: 'stageCenter',
    transition: 'cut',
    fov: 35,
    label: '1. Establishing Wide • Stage Unfold',
  },
  {
    fromFrame: 210,
    shot: 'medium',
    target: 'leftClapper',
    transition: 'glide',
    angleDeg: -18,
    fov: 33,
    label: '2. Medium Glide • Shot DSL',
  },
  {
    fromFrame: 430,
    shot: 'medium',
    target: 'rightAudioTower',
    transition: 'whip',
    angleDeg: 18,
    fov: 33,
    label: '3. Whip-Pan • Auto-Ducking Audio',
  },
  {
    fromFrame: 640,
    shot: 'low-angle-hero',
    target: 'heroMonolith',
    transition: 'glide',
    dollyZoomDeltaFov: -4,
    fov: 34,
    label: '4. Hero Push-In • 60 FPS Finale',
  },
];

const CAMERA_IMPULSES: CameraImpulse[] = [
  { frame: 432, intensity: 0.22, decayFrames: 20 },
  { frame: 648, intensity: 0.18, decayFrames: 22 },
];

const DIALOGUE_SEGMENTS = [
  { sceneId: 'starter-story', fromFrame: 0, durationInFrames: 870 },
];

function drawFeatureTower(
  ctx: CanvasRenderingContext2D,
  badge: string,
  title: string,
  accent: string
) {
  ctx.fillStyle = '#FFFDF9';
  ctx.strokeStyle = accent;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.roundRect(28, 28, 284, 324, 24);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = `${accent}20`;
  ctx.beginPath();
  ctx.roundRect(64, 58, 212, 48, 999);
  ctx.fill();

  ctx.fillStyle = accent;
  ctx.font = '800 20px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(badge, 170, 90, 184);

  ctx.fillStyle = '#0F172A';
  ctx.font = '800 32px Inter, sans-serif';
  ctx.fillText(title, 170, 218, 236);

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(88, 266, 164, 14, 999);
  ctx.fill();
}

export const DirectorShowcase: React.FC<Partial<DirectorShowcaseProps>> = (
  rawProps
) => {
  const props: DirectorShowcaseProps = {
    ...directorShowcaseDefaults,
    ...rawProps,
  };
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  useStudioFontsReady();

  // Strict Frame 0 Clean Board Rule: frame === 0 renders clean background only
  const stageOpacity = interpolate(frame, [0, 1, 14], [0, 0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const unfoldProgress = interpolate(frame, [2, 48], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const cloudDrift = Math.sin(frame * 0.032) * 0.24;

  const initialCamera = useMemo(
    () => ({
      fov: 35,
      position: [0, 3.8, 10.4] as [number, number, number],
    }),
    []
  );

  const hasVoiceover = Boolean(
    getSceneVoiceover('starter-story') ?? VOICEOVER_MANIFEST['starter-story']
  );

  return (
    <AbsoluteFill style={{ backgroundColor: props.skyBackground }}>
      {/* Smart Auto-Ducking Background Score */}
      <SmartMusicBed
        src={staticFile('sfx/bgm-paper-expedition.wav')}
        dialogueSegments={DIALOGUE_SEGMENTS}
        voiceoverManifest={VOICEOVER_MANIFEST}
        baseVolume={props.musicBaseVolume}
        duckedVolume={props.musicDuckedVolume}
      />

      {/* Synchronized Narration */}
      {hasVoiceover && (
        <Audio
          src={staticFile('voiceovers/starter-story.mp3')}
          volume={props.voiceoverVolume}
        />
      )}

      {/* Frame & Word-Synced Sound Cues */}
      <SoundCue
        src={staticFile('sfx/whoosh.wav')}
        atFrame={430}
        volume={props.sfxVolume}
      />
      <SoundCue
        src={staticFile('sfx/pop.wav')}
        sceneId="starter-story"
        onWord="selects"
        fallbackFrame={260}
        voiceoverManifest={VOICEOVER_MANIFEST}
        volume={props.sfxVolume * 0.95}
      />
      <SoundCue
        src={staticFile('sfx/triumph-chord.wav')}
        sceneId="starter-story"
        onWord="sixty"
        fallbackFrame={660}
        voiceoverManifest={VOICEOVER_MANIFEST}
        volume={props.sfxVolume * 0.85}
      />

      {/* 3D Stage with DirectorCamera3D Shot DSL & Volumetric StagePostProcessing3D */}
      <AbsoluteFill style={{ opacity: stageOpacity }}>
        <ThreeCanvas
          width={width}
          height={height}
          shadows
          camera={initialCamera}
        >
          <DirectorCamera3D
            anchors={DIRECTOR_SHOWCASE_ANCHORS}
            shots={DIRECTOR_SHOWCASE_SHOTS}
            handheldIntensity={props.handheldIntensity}
            impulses={CAMERA_IMPULSES}
            seed={2026}
          />
          <PaperStageLighting3D preset="golden-hour" />
          <StagePostProcessing3D
            fogColor={props.skyBackground}
            fogDensity={0.014}
            spotlightBeams={2}
            beamColor="#FDE68A"
            beamOpacity={0.085}
            depthHaze
            hazeColor={props.accentColor}
            hazeOpacity={0.12}
          />

          <PopUpBookBase3D
            floorTheme="warm-parquet"
            nextFloorTheme="warm-parquet"
            pageTurnProgress={0}
          />

          <PaperCloudCutout3D
            position={[-4.2 + cloudDrift, 4.3, -4.1]}
            scale={0.95}
            tint="#E0E7FF"
            idSuffix="dir-left"
          />
          <PaperCloudCutout3D
            position={[4.1 - cloudDrift, 4.5, -4.3]}
            scale={1.02}
            tint="#FEF3C7"
            idSuffix="dir-right"
          />

          <PopUpHinge3D foldProgress={unfoldProgress} position={[0, 0, -5.0]}>
            <PaperMountainBackdrop3D position={[0, 0, 0]} />
          </PopUpHinge3D>

          <PopUpHinge3D foldProgress={unfoldProgress} position={[-4.8, 0, -2.1]}>
            <PaperPineTree3D position={[0, 0, 0]} scale={1.08} />
          </PopUpHinge3D>
          <PopUpHinge3D foldProgress={unfoldProgress} position={[4.8, 0, -2.0]}>
            <PaperPineTree3D position={[0, 0, 0]} scale={1.05} />
          </PopUpHinge3D>

          {/* Left Feature Tower: Shot DSL */}
          <ContactShadowDisc3D
            position={[-4.45, 0.015, -0.55]}
            radius={1.05}
            opacity={0.28 * unfoldProgress}
          />
          <PopUpHinge3D
            foldProgress={unfoldProgress}
            position={[-4.45, 0, -0.55]}
          >
            <PaperCutout3D
              cacheKey="director-tower-shot-dsl"
              cacheDeps={[props.accentColor]}
              width={2.15}
              height={2.4}
              pixelWidth={340}
              pixelHeight={380}
              whiteBorderPx={14}
              position={[0, 0, 0]}
              thickness={0.05}
              draw={(ctx) =>
                drawFeatureTower(ctx, 'SHOT DSL', 'Whip & Glide', props.accentColor)
              }
            />
          </PopUpHinge3D>

          {/* Right Feature Tower: Auto-Ducking Score */}
          <ContactShadowDisc3D
            position={[4.45, 0.015, -0.55]}
            radius={1.05}
            opacity={0.28 * unfoldProgress}
          />
          <PopUpHinge3D
            foldProgress={unfoldProgress}
            position={[4.45, 0, -0.55]}
          >
            <PaperCutout3D
              cacheKey="director-tower-smart-audio"
              cacheDeps={[props.secondaryColor]}
              width={2.15}
              height={2.4}
              pixelWidth={340}
              pixelHeight={380}
              whiteBorderPx={14}
              position={[0, 0, 0]}
              thickness={0.05}
              draw={(ctx) =>
                drawFeatureTower(
                  ctx,
                  '-14 LUFS',
                  'Smart Audio',
                  props.secondaryColor
                )
              }
            />
          </PopUpHinge3D>

          {/* Center Hero Monolith */}
          <ContactShadowDisc3D
            position={[0, 0.015, 0.45]}
            radius={1.55}
            scaleX={1.5}
            scaleZ={0.75}
            opacity={0.32 * unfoldProgress}
          />
          <PopUpHinge3D foldProgress={unfoldProgress} position={[0, 0, 0.45]}>
            <PaperCutout3D
              cacheKey="director-hero-monolith"
              cacheDeps={[
                props.heroHeadline,
                props.heroSublabel,
                props.accentColor,
              ]}
              width={4.9}
              height={2.05}
              pixelWidth={700}
              pixelHeight={280}
              whiteBorderPx={14}
              position={[0, 0, 0]}
              thickness={0.055}
              draw={(ctx) => {
                ctx.fillStyle = '#FFFDF9';
                ctx.strokeStyle = props.accentColor;
                ctx.lineWidth = 8;
                ctx.beginPath();
                ctx.roundRect(28, 28, 644, 224, 26);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#0F172A';
                ctx.font = '800 42px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(props.heroHeadline, 350, 126, 596);

                ctx.fillStyle = '#475569';
                ctx.font = '600 24px Inter, sans-serif';
                ctx.fillText(props.heroSublabel, 350, 180, 596);
              }}
            />
          </PopUpHinge3D>
        </ThreeCanvas>
      </AbsoluteFill>

      {/* Deterministic Atmospheric Dust Motes */}
      <ParticleField
        preset="dust-motes"
        count={32}
        intensity={0.8}
        seed={2026}
        cleanFrameZero
      />

      {/* Kinetic Typography HUD Cards */}
      {frame >= 2 && (
        <AbsoluteFill style={{ pointerEvents: 'none', opacity: stageOpacity }}>
          <div style={{ position: 'absolute', bottom: 42, left: 52 }}>
            <ImpactKeywordCard
              eyebrow={props.eyebrowBadge}
              keyword={props.heroHeadline}
              sublabel="Camera Rig • Lens VFX • Smart Music"
              badge="60 FPS"
              icon={<Clapperboard size={26} color={props.accentColor} />}
              accentColor={props.accentColor}
              variant="dark"
              enterFrame={8}
              exitFrame={620}
              style={{ transform: 'scale(0.68)', transformOrigin: 'bottom left' }}
            />
          </div>

          <div style={{ position: 'absolute', top: 44, right: 56 }}>
            <AnimatedMetricCounter
              value={60}
              suffix=" FPS"
              label="GPU ANGLE + -14 LUFS"
              badge="REALTIME"
              accentColor={props.secondaryColor}
              variant="dark"
              startFrame={14}
              durationInFrames={56}
              fontSize={44}
            />
          </div>

          {props.showWordStage && (
            <WordByWordStage
              sceneId="starter-story"
              voiceoverManifest={VOICEOVER_MANIFEST}
              wordsPerBeat={4}
              accentColor={props.accentColor}
              variant="transparent"
              fontSize={48}
              style={{ justifyContent: 'flex-end', paddingBottom: 56 }}
            />
          )}
        </AbsoluteFill>
      )}

      {/* Velocity-Coupled Cinema Optical Lens Overlay */}
      {frame >= 2 && (
        <CinematicLensOverlay
          vignetteIntensity={props.vignetteIntensity}
          warmLightLeak={props.warmLightLeak}
          grainOpacity={0.04}
          seed={77}
        />
      )}
    </AbsoluteFill>
  );
};
