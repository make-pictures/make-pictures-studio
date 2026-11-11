import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Code2, Cpu, Film, Mic, Sparkles, Wand2 } from 'lucide-react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import {
  getWordTriggerFrame,
  SPRING_PRESETS,
  STUDIO_FONTS,
  STUDIO_THEME,
} from '@make-pictures/core';
import {
  type CameraKeyframe,
  CameraRig,
  FlowCurve,
  type NodeBox,
  portBottom,
  portLeft,
  portRight,
  portTop,
  WorldBox,
} from '@make-pictures/kits/motion-diagrams-2d';
import starterStoryDefaults from './StarterStory.props.json';
import starterStoryVerticalDefaults from './StarterStoryVertical.props.json';

export const starterStorySchema = z.object({
  promptTitle: z.string().describe('Text & Labels :: Card 1 — Title'),
  promptSubtitle: z.string().describe('Text & Labels :: Card 1 — Subtitle'),
  voiceTitle: z.string().describe('Text & Labels :: Card 2 — Voice Title'),
  outputTitle: z.string().describe('Text & Labels :: Final Card — Title'),
  outputSubtitle: z.string().describe('Text & Labels :: Final Card — Subtitle'),
  primaryAccent: z.string().describe('Colors & Style :: Primary Accent'),
  secondaryAccent: z.string().describe('Colors & Style :: Secondary Accent'),
  outputAccent: z.string().describe('Colors & Style :: Output Accent'),
  voiceoverVolume: z
    .number()
    .min(0)
    .max(1.5)
    .describe('Audio :: Voiceover Volume'),
  sfxVolume: z.number().min(0).max(1).describe('Audio :: SFX Volume'),
  overviewZoom: z
    .number()
    .min(0.45)
    .max(1.15)
    .describe('2D Camera :: Overview Zoom'),
  cameraOffsetX: z
    .number()
    .min(-350)
    .max(350)
    .describe('2D Camera :: Pan Offset X (px)'),
  cameraOffsetY: z
    .number()
    .min(-250)
    .max(250)
    .describe('2D Camera :: Pan Offset Y (px)'),
});

export type StarterStoryProps = z.infer<typeof starterStorySchema>;

export const starterStoryVerticalSchema = z.object({
  promptTitle: z.string().describe('Text & Labels :: Card 1 — Title'),
  promptSubtitle: z.string().describe('Text & Labels :: Card 1 — Subtitle'),
  voiceTitle: z.string().describe('Text & Labels :: Card 2 — Voice Title'),
  outputTitle: z.string().describe('Text & Labels :: Final Card — Title'),
  outputSubtitle: z.string().describe('Text & Labels :: Final Card — Subtitle'),
  primaryAccent: z.string().describe('Colors & Style :: Primary Accent'),
  secondaryAccent: z.string().describe('Colors & Style :: Secondary Accent'),
  outputAccent: z.string().describe('Colors & Style :: Output Accent'),
  voiceoverVolume: z
    .number()
    .min(0)
    .max(1.5)
    .describe('Audio :: Voiceover Volume'),
  sfxVolume: z.number().min(0).max(1).describe('Audio :: SFX Volume'),
  overviewZoom: z
    .number()
    .min(0.45)
    .max(1.05)
    .describe('Shorts 9:16 Camera :: Overview Zoom'),
  cameraOffsetY: z
    .number()
    .min(-350)
    .max(350)
    .describe('Shorts 9:16 Camera :: Vertical Offset Y (px)'),
});

export type StarterStoryVerticalProps = z.infer<
  typeof starterStoryVerticalSchema
>;

export const WORLD_NODES = {
  promptCard: { cx: 560, cy: 540, w: 420, h: 280 } as NodeBox,
  voiceNode: { cx: 1120, cy: 540, w: 420, h: 280 } as NodeBox,

  kitPaper: { cx: 1840, cy: 330, w: 390, h: 182 } as NodeBox,
  kitIso: { cx: 1840, cy: 540, w: 390, h: 182 } as NodeBox,
  kitDiagrams: { cx: 1840, cy: 750, w: 390, h: 182 } as NodeBox,
  renderCore: { cx: 2470, cy: 540, w: 440, h: 360 } as NodeBox,
};

export const VERTICAL_WORLD_NODES = {
  promptCard: { cx: 475, cy: 420, w: 780, h: 250 } as NodeBox,
  voiceNode: { cx: 475, cy: 760, w: 780, h: 250 } as NodeBox,

  kitPaper: { cx: 475, cy: 1180, w: 780, h: 176 } as NodeBox,
  kitIso: { cx: 475, cy: 1410, w: 780, h: 176 } as NodeBox,
  kitDiagrams: { cx: 475, cy: 1640, w: 780, h: 176 } as NodeBox,
  renderCore: { cx: 475, cy: 1960, w: 780, h: 250 } as NodeBox,
};

interface StationCardProps {
  node: NodeBox;
  enterFrame: number;
  badge: string;
  title: string;
  subtitle: string;
  accentColor: string;
  icon: LucideIcon;
}

const StationCard: React.FC<StationCardProps> = ({
  node,
  enterFrame,
  badge,
  title,
  subtitle,
  accentColor,
  icon: Icon,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - Math.max(2, enterFrame),
    fps,
    config: SPRING_PRESETS.snappy,
  });

  if (frame === 0 || progress <= 0.002) return null;

  return (
    <WorldBox
      node={node}
      scale={0.88 + 0.12 * progress}
      opacity={progress}
      style={{
        backgroundColor: STUDIO_THEME.colors.bgSurface,
        borderRadius: 28,
        border: `2.5px solid ${accentColor}44`,
        boxShadow: STUDIO_THEME.shadows.cardElevated,
        padding: node.h <= 200 ? '18px 26px' : '26px 30px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        willChange: 'transform, opacity',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            width: node.h <= 200 ? 48 : 54,
            height: node.h <= 200 ? 48 : 54,
            borderRadius: 16,
            backgroundColor: `${accentColor}16`,
            border: `2px solid ${accentColor}44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={node.h <= 200 ? 24 : 27} color={accentColor} />
        </div>
        <span
          style={{
            fontFamily: STUDIO_FONTS.mono,
            fontSize: 13,
            fontWeight: 700,
            color: accentColor,
            backgroundColor: `${accentColor}12`,
            padding: '6px 14px',
            borderRadius: 999,
            letterSpacing: '0.06em',
          }}
        >
          {badge}
        </span>
      </div>

      <div>
        <div
          style={{
            fontSize: node.h <= 200 ? 25 : 28,
            fontWeight: 800,
            color: STUDIO_THEME.colors.text.primary,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: node.h <= 200 ? 16 : 17,
            fontWeight: 600,
            color: STUDIO_THEME.colors.text.secondary,
            marginTop: 5,
          }}
        >
          {subtitle}
        </div>
      </div>
    </WorldBox>
  );
};

export const StarterStory: React.FC<Partial<StarterStoryProps>> = (
  rawProps
) => {
  const props: StarterStoryProps = { ...starterStoryDefaults, ...rawProps };
  const frame = useCurrentFrame();

  const voiceTrigger = getWordTriggerFrame('starter-story', 'generates', 261);
  const kitsTrigger = getWordTriggerFrame('starter-story', 'selects', 388);
  const renderTrigger = getWordTriggerFrame('starter-story', 'renders', 509);
  const overviewTrigger = getWordTriggerFrame('starter-story', 'Create', 704);

  const keyframes: CameraKeyframe[] = [
    {
      startFrame: 0,
      x: 840 + props.cameraOffsetX,
      y: 540 + props.cameraOffsetY,
      zoom: 1.0,
    },
    {
      startFrame: kitsTrigger - 15,
      x: 2150 + props.cameraOffsetX,
      y: 540 + props.cameraOffsetY,
      zoom: 0.96,
      flightZoomDip: -0.06,
    },
    {
      startFrame: overviewTrigger - 24,
      x: 1520 + props.cameraOffsetX,
      y: 540 + props.cameraOffsetY,
      zoom: props.overviewZoom,
    },
  ];

  return (
    <AbsoluteFill>
      <Audio
        src={staticFile('voiceovers/starter-story.mp3')}
        volume={props.voiceoverVolume}
      />

      <Sequence from={4} durationInFrames={25}>
        <Audio src={staticFile('sfx/pop.wav')} volume={props.sfxVolume} />
      </Sequence>
      <Sequence from={kitsTrigger - 12} durationInFrames={30}>
        <Audio
          src={staticFile('sfx/whoosh.wav')}
          volume={props.sfxVolume * 0.92}
        />
      </Sequence>
      <Sequence from={renderTrigger} durationInFrames={25}>
        <Audio
          src={staticFile('sfx/pop.wav')}
          volume={Math.min(1, props.sfxVolume * 1.08)}
        />
      </Sequence>

      <CameraRig keyframes={keyframes} stageWidth={1920} stageHeight={1080}>
        {frame > 0 && (
          <>
            <FlowCurve
              from={portRight(WORLD_NODES.promptCard)}
              to={portLeft(WORLD_NODES.voiceNode)}
              activeFromFrame={voiceTrigger - 12}
              color={props.primaryAccent}
              packetSpeedFrames={98}
              packetCount={2}
            />

            <FlowCurve
              from={portRight(WORLD_NODES.voiceNode, -35)}
              to={portLeft(WORLD_NODES.kitPaper)}
              curveY={-40}
              activeFromFrame={kitsTrigger}
              color={STUDIO_THEME.colors.accents.amber}
              packetSpeedFrames={104}
              packetCount={2}
            />
            <FlowCurve
              from={portRight(WORLD_NODES.voiceNode)}
              to={portLeft(WORLD_NODES.kitIso)}
              activeFromFrame={kitsTrigger + 8}
              color={props.secondaryAccent}
              packetSpeedFrames={104}
              packetCount={2}
            />
            <FlowCurve
              from={portRight(WORLD_NODES.voiceNode, 35)}
              to={portLeft(WORLD_NODES.kitDiagrams)}
              curveY={40}
              activeFromFrame={kitsTrigger + 16}
              color={props.outputAccent}
              packetSpeedFrames={104}
              packetCount={2}
            />

            <FlowCurve
              from={portRight(WORLD_NODES.kitPaper)}
              to={portLeft(WORLD_NODES.renderCore, -60)}
              activeFromFrame={renderTrigger - 12}
              color={STUDIO_THEME.colors.accents.amber}
              packetSpeedFrames={98}
              packetCount={2}
            />
            <FlowCurve
              from={portRight(WORLD_NODES.kitIso)}
              to={portLeft(WORLD_NODES.renderCore)}
              activeFromFrame={renderTrigger - 6}
              color={props.secondaryAccent}
              packetSpeedFrames={98}
              packetCount={2}
            />
            <FlowCurve
              from={portRight(WORLD_NODES.kitDiagrams)}
              to={portLeft(WORLD_NODES.renderCore, 60)}
              activeFromFrame={renderTrigger}
              color={props.outputAccent}
              packetSpeedFrames={98}
              packetCount={2}
            />

            <StationCard
              node={WORLD_NODES.promptCard}
              enterFrame={2}
              badge="STEP 1 • PROMPT"
              title={props.promptTitle}
              subtitle={props.promptSubtitle}
              accentColor={props.primaryAccent}
              icon={Wand2}
            />

            <StationCard
              node={WORLD_NODES.voiceNode}
              enterFrame={voiceTrigger - 10}
              badge="STEP 2 • AUDIO"
              title={props.voiceTitle}
              subtitle="SHA-256 word timestamps"
              accentColor={props.secondaryAccent}
              icon={Mic}
            />

            <StationCard
              node={WORLD_NODES.kitPaper}
              enterFrame={kitsTrigger}
              badge="KIT 1"
              title="Paper Diorama 3D"
              subtitle="2.5D cutouts & Pop-Up Book"
              accentColor={STUDIO_THEME.colors.accents.amber}
              icon={Sparkles}
            />
            <StationCard
              node={WORLD_NODES.kitIso}
              enterFrame={kitsTrigger + 8}
              badge="KIT 2"
              title="Isometric 3D Studio"
              subtitle="3D characters & dialogue"
              accentColor={props.secondaryAccent}
              icon={Cpu}
            />
            <StationCard
              node={WORLD_NODES.kitDiagrams}
              enterFrame={kitsTrigger + 16}
              badge="KIT 3"
              title="Motion Diagrams 2D"
              subtitle="One-Shot camera & ports"
              accentColor={props.outputAccent}
              icon={Code2}
            />

            <StationCard
              node={WORLD_NODES.renderCore}
              enterFrame={renderTrigger - 10}
              badge="make.pictures"
              title={props.outputTitle}
              subtitle={props.outputSubtitle}
              accentColor={props.outputAccent}
              icon={Film}
            />
          </>
        )}
      </CameraRig>
    </AbsoluteFill>
  );
};

export const StarterStoryVertical: React.FC<
  Partial<StarterStoryVerticalProps>
> = (rawProps) => {
  const props: StarterStoryVerticalProps = {
    ...starterStoryVerticalDefaults,
    ...rawProps,
  };
  const frame = useCurrentFrame();

  const voiceTrigger = getWordTriggerFrame('starter-story', 'generates', 261);
  const kitsTrigger = getWordTriggerFrame('starter-story', 'selects', 388);
  const renderTrigger = getWordTriggerFrame('starter-story', 'renders', 509);
  const overviewTrigger = getWordTriggerFrame('starter-story', 'Create', 704);

  const keyframes: CameraKeyframe[] = [
    { startFrame: 0, x: 540, y: 750 + props.cameraOffsetY, zoom: 1.0 },
    {
      startFrame: kitsTrigger - 15,
      x: 540,
      y: 1758 + props.cameraOffsetY,
      zoom: 0.94,
    },
    {
      startFrame: overviewTrigger - 24,
      x: 505,
      y: 1465 + props.cameraOffsetY,
      zoom: props.overviewZoom,
    },
  ];

  return (
    <AbsoluteFill>
      <Audio
        src={staticFile('voiceovers/starter-story.mp3')}
        volume={props.voiceoverVolume}
      />

      <Sequence from={4} durationInFrames={25}>
        <Audio src={staticFile('sfx/pop.wav')} volume={props.sfxVolume} />
      </Sequence>
      <Sequence from={kitsTrigger - 12} durationInFrames={30}>
        <Audio
          src={staticFile('sfx/whoosh.wav')}
          volume={props.sfxVolume * 0.92}
        />
      </Sequence>
      <Sequence from={renderTrigger} durationInFrames={25}>
        <Audio
          src={staticFile('sfx/pop.wav')}
          volume={Math.min(1, props.sfxVolume * 1.08)}
        />
      </Sequence>

      <CameraRig keyframes={keyframes} stageWidth={1080} stageHeight={1920}>
        {frame > 0 && (
          <>
            <FlowCurve
              from={portBottom(VERTICAL_WORLD_NODES.promptCard)}
              to={portTop(VERTICAL_WORLD_NODES.voiceNode)}
              orientation="vertical"
              activeFromFrame={voiceTrigger - 12}
              color={props.primaryAccent}
              packetSpeedFrames={98}
              packetCount={2}
            />
            <FlowCurve
              from={portBottom(VERTICAL_WORLD_NODES.voiceNode)}
              to={portTop(VERTICAL_WORLD_NODES.kitPaper)}
              orientation="vertical"
              activeFromFrame={kitsTrigger}
              color={STUDIO_THEME.colors.accents.amber}
              packetSpeedFrames={104}
              packetCount={2}
            />
            <FlowCurve
              from={portBottom(VERTICAL_WORLD_NODES.kitPaper)}
              to={portTop(VERTICAL_WORLD_NODES.kitIso)}
              orientation="vertical"
              activeFromFrame={kitsTrigger + 8}
              color={props.secondaryAccent}
              packetSpeedFrames={96}
              packetCount={2}
            />
            <FlowCurve
              from={portBottom(VERTICAL_WORLD_NODES.kitIso)}
              to={portTop(VERTICAL_WORLD_NODES.kitDiagrams)}
              orientation="vertical"
              activeFromFrame={kitsTrigger + 16}
              color={props.outputAccent}
              packetSpeedFrames={96}
              packetCount={2}
            />
            <FlowCurve
              from={portBottom(VERTICAL_WORLD_NODES.kitDiagrams)}
              to={portTop(VERTICAL_WORLD_NODES.renderCore)}
              orientation="vertical"
              activeFromFrame={renderTrigger - 10}
              color={props.outputAccent}
              packetSpeedFrames={98}
              packetCount={2}
            />

            <StationCard
              node={VERTICAL_WORLD_NODES.promptCard}
              enterFrame={2}
              badge="STEP 1 • PROMPT"
              title={props.promptTitle}
              subtitle={props.promptSubtitle}
              accentColor={props.primaryAccent}
              icon={Wand2}
            />
            <StationCard
              node={VERTICAL_WORLD_NODES.voiceNode}
              enterFrame={voiceTrigger - 10}
              badge="STEP 2 • AUDIO"
              title={props.voiceTitle}
              subtitle="SHA-256 word timestamps"
              accentColor={props.secondaryAccent}
              icon={Mic}
            />
            <StationCard
              node={VERTICAL_WORLD_NODES.kitPaper}
              enterFrame={kitsTrigger}
              badge="KIT 1"
              title="Paper Diorama 3D"
              subtitle="2.5D cutouts & Pop-Up Book"
              accentColor={STUDIO_THEME.colors.accents.amber}
              icon={Sparkles}
            />
            <StationCard
              node={VERTICAL_WORLD_NODES.kitIso}
              enterFrame={kitsTrigger + 8}
              badge="KIT 2"
              title="Isometric 3D Studio"
              subtitle="3D characters & dialogue"
              accentColor={props.secondaryAccent}
              icon={Cpu}
            />
            <StationCard
              node={VERTICAL_WORLD_NODES.kitDiagrams}
              enterFrame={kitsTrigger + 16}
              badge="KIT 3"
              title="Motion Diagrams 2D"
              subtitle="One-Shot camera & ports"
              accentColor={props.outputAccent}
              icon={Code2}
            />
            <StationCard
              node={VERTICAL_WORLD_NODES.renderCore}
              enterFrame={renderTrigger - 10}
              badge="make.pictures"
              title={props.outputTitle}
              subtitle={props.outputSubtitle}
              accentColor={props.outputAccent}
              icon={Film}
            />
          </>
        )}
      </CameraRig>
    </AbsoluteFill>
  );
};
