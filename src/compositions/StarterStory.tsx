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
import {
  CameraKeyframe,
  CameraRig,
  FlowCurve,
  NodeBox,
  portBottom,
  portLeft,
  portRight,
  portTop,
  WorldBox,
} from '../kits/motion-diagrams-2d';
import { SPRING_PRESETS, STUDIO_FONTS, STUDIO_THEME } from '../theme';
import { getWordTriggerFrame } from '../utils/timestamps';

/**
 * ============================================================================
 * 16:9 HORIZONTAL WORLD NODES (`WORLD_NODES`)
 * ============================================================================
 * Single Source of Truth for every station and card on the 16:9 canvas.
 * All SVG connection lines attach mathematically to `portRight`, `portLeft`,
 * `portTop`, and `portBottom`.
 */
export const WORLD_NODES = {
  // Station 1: Script & AI Agent (x ~ 820, y = 540)
  promptCard: { cx: 560, cy: 540, w: 420, h: 280 } as NodeBox,
  voiceNode: { cx: 1120, cy: 540, w: 420, h: 280 } as NodeBox,

  // Station 2: 60 FPS Visual Kits Engine (x ~ 2140, y = 540)
  kitPaper: { cx: 1840, cy: 330, w: 390, h: 182 } as NodeBox,
  kitIso: { cx: 1840, cy: 540, w: 390, h: 182 } as NodeBox,
  kitDiagrams: { cx: 1840, cy: 750, w: 390, h: 182 } as NodeBox,
  renderCore: { cx: 2470, cy: 540, w: 440, h: 360 } as NodeBox,
};

/**
 * ============================================================================
 * 9:16 VERTICAL WORLD NODES (`VERTICAL_WORLD_NODES`)
 * ============================================================================
 * Dedicated vertical stacking layout for mobile Shorts / Reels (1080x1920).
 */
export const VERTICAL_WORLD_NODES = {
  promptCard: { cx: 540, cy: 520, w: 820, h: 290 } as NodeBox,
  voiceNode: { cx: 540, cy: 960, w: 820, h: 290 } as NodeBox,

  kitPaper: { cx: 540, cy: 1520, w: 820, h: 200 } as NodeBox,
  kitIso: { cx: 540, cy: 1760, w: 820, h: 200 } as NodeBox,
  kitDiagrams: { cx: 540, cy: 2000, w: 820, h: 200 } as NodeBox,
  renderCore: { cx: 540, cy: 2420, w: 820, h: 330 } as NodeBox,
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

  // Rule 2 (AGENTS.md): Frame 0 must be a clean empty canvas
  const progress = spring({
    frame: frame - Math.max(2, enterFrame),
    fps,
    config: SPRING_PRESETS.snappy,
  });

  if (frame === 0) return null;

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
        padding: node.h <= 220 ? '20px 28px' : '28px 32px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
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
            width: 56,
            height: 56,
            borderRadius: 18,
            backgroundColor: `${accentColor}16`,
            border: `2px solid ${accentColor}44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={28} color={accentColor} />
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
            fontSize: 28,
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
            fontSize: 17,
            fontWeight: 600,
            color: STUDIO_THEME.colors.text.secondary,
            marginTop: 6,
          }}
        >
          {subtitle}
        </div>
      </div>
    </WorldBox>
  );
};

export const StarterStory: React.FC = () => {
  const frame = useCurrentFrame();

  // Synchronize camera & stations with word timestamps from `starter-story` in `scenes.json`
  const voiceTrigger = getWordTriggerFrame('starter-story', 'ElevenLabs', 95);
  const kitsTrigger = getWordTriggerFrame('starter-story', 'styl', 220);
  const renderTrigger = getWordTriggerFrame('starter-story', 'animację', 340);
  const overviewTrigger = getWordTriggerFrame('starter-story', 'Twórz', 460);

  const keyframes: CameraKeyframe[] = [
    { startFrame: 0, x: 840, y: 540, zoom: 1.0 },
    {
      startFrame: kitsTrigger - 15,
      x: 2150,
      y: 540,
      zoom: 0.96,
      flightZoomDip: -0.08,
    },
    {
      startFrame: overviewTrigger - 25,
      x: 1520,
      y: 540,
      zoom: 0.72,
    },
  ];

  return (
    <AbsoluteFill>
      <Audio src={staticFile('voiceovers/starter-story.mp3')} />

      <Sequence from={4} durationInFrames={25}>
        <Audio src={staticFile('sfx/pop.wav')} volume={0.35} />
      </Sequence>
      <Sequence from={kitsTrigger - 12} durationInFrames={30}>
        <Audio src={staticFile('sfx/whoosh.wav')} volume={0.32} />
      </Sequence>
      <Sequence from={renderTrigger} durationInFrames={25}>
        <Audio src={staticFile('sfx/pop.wav')} volume={0.38} />
      </Sequence>

      <CameraRig keyframes={keyframes} stageWidth={1920} stageHeight={1080}>
        {frame > 0 && (
          <>
            {/* Mathematical Port-to-Port Flow Curves */}
            <FlowCurve
              from={portRight(WORLD_NODES.promptCard)}
              to={portLeft(WORLD_NODES.voiceNode)}
              activeFromFrame={voiceTrigger - 10}
              color={STUDIO_THEME.colors.accents.violet}
              packetSpeedFrames={96}
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
              color={STUDIO_THEME.colors.accents.indigo}
              packetSpeedFrames={104}
              packetCount={2}
            />
            <FlowCurve
              from={portRight(WORLD_NODES.voiceNode, 35)}
              to={portLeft(WORLD_NODES.kitDiagrams)}
              curveY={40}
              activeFromFrame={kitsTrigger + 16}
              color={STUDIO_THEME.colors.accents.emerald}
              packetSpeedFrames={104}
              packetCount={2}
            />

            <FlowCurve
              from={portRight(WORLD_NODES.kitPaper)}
              to={portLeft(WORLD_NODES.renderCore, -60)}
              activeFromFrame={renderTrigger - 12}
              color={STUDIO_THEME.colors.accents.amber}
              packetSpeedFrames={96}
              packetCount={2}
            />
            <FlowCurve
              from={portRight(WORLD_NODES.kitIso)}
              to={portLeft(WORLD_NODES.renderCore)}
              activeFromFrame={renderTrigger - 6}
              color={STUDIO_THEME.colors.accents.indigo}
              packetSpeedFrames={96}
              packetCount={2}
            />
            <FlowCurve
              from={portRight(WORLD_NODES.kitDiagrams)}
              to={portLeft(WORLD_NODES.renderCore, 60)}
              activeFromFrame={renderTrigger}
              color={STUDIO_THEME.colors.accents.emerald}
              packetSpeedFrames={96}
              packetCount={2}
            />

            {/* Station 1 Nodes */}
            <StationCard
              node={WORLD_NODES.promptCard}
              enterFrame={2}
              badge="KROK 1 • POMYSŁ"
              title="Scenariusz w JSON"
              subtitle="Antigravity + Claude Code"
              accentColor={STUDIO_THEME.colors.accents.violet}
              icon={Wand2}
            />

            <StationCard
              node={WORLD_NODES.voiceNode}
              enterFrame={voiceTrigger - 8}
              badge="KROK 2 • AUDIO"
              title="Lektor ElevenLabs"
              subtitle="Timestampy słów SHA-256"
              accentColor={STUDIO_THEME.colors.accents.indigo}
              icon={Mic}
            />

            {/* Station 2 Visual Kits */}
            <StationCard
              node={WORLD_NODES.kitPaper}
              enterFrame={kitsTrigger}
              badge="KIT 1"
              title="Paper Diorama 3D"
              subtitle="Wycinanki 2.5D & Pop-Up Book"
              accentColor={STUDIO_THEME.colors.accents.amber}
              icon={Sparkles}
            />
            <StationCard
              node={WORLD_NODES.kitIso}
              enterFrame={kitsTrigger + 8}
              badge="KIT 2"
              title="Isometric 3D Studio"
              subtitle="Postacie 3D i dialogi"
              accentColor={STUDIO_THEME.colors.accents.indigo}
              icon={Cpu}
            />
            <StationCard
              node={WORLD_NODES.kitDiagrams}
              enterFrame={kitsTrigger + 16}
              badge="KIT 3"
              title="Motion Diagrams 2D"
              subtitle="Kamera One-Shot i porty"
              accentColor={STUDIO_THEME.colors.accents.emerald}
              icon={Code2}
            />

            {/* Station 3 Output */}
            <StationCard
              node={WORLD_NODES.renderCore}
              enterFrame={renderTrigger - 10}
              badge="make.pictures"
              title="Gotowy film 60 FPS"
              subtitle="Poziomo 16:9 oraz Shorts 9:16"
              accentColor={STUDIO_THEME.colors.accents.emerald}
              icon={Film}
            />
          </>
        )}
      </CameraRig>
    </AbsoluteFill>
  );
};

export const StarterStoryVertical: React.FC = () => {
  const frame = useCurrentFrame();

  const voiceTrigger = getWordTriggerFrame('starter-story', 'ElevenLabs', 95);
  const kitsTrigger = getWordTriggerFrame('starter-story', 'styl', 220);
  const renderTrigger = getWordTriggerFrame('starter-story', 'animację', 340);
  const overviewTrigger = getWordTriggerFrame('starter-story', 'Twórz', 460);

  const keyframes: CameraKeyframe[] = [
    { startFrame: 0, x: 540, y: 740, zoom: 1.0 },
    {
      startFrame: kitsTrigger - 15,
      x: 540,
      y: 1960,
      zoom: 0.96,
    },
    {
      startFrame: overviewTrigger - 25,
      x: 540,
      y: 1480,
      zoom: 0.72,
    },
  ];

  return (
    <AbsoluteFill>
      <Audio src={staticFile('voiceovers/starter-story.mp3')} />

      <Sequence from={4} durationInFrames={25}>
        <Audio src={staticFile('sfx/pop.wav')} volume={0.35} />
      </Sequence>
      <Sequence from={kitsTrigger - 12} durationInFrames={30}>
        <Audio src={staticFile('sfx/whoosh.wav')} volume={0.32} />
      </Sequence>

      <CameraRig keyframes={keyframes} stageWidth={1080} stageHeight={1920}>
        {frame > 0 && (
          <>
            <FlowCurve
              from={portBottom(VERTICAL_WORLD_NODES.promptCard)}
              to={portTop(VERTICAL_WORLD_NODES.voiceNode)}
              orientation="vertical"
              activeFromFrame={voiceTrigger - 10}
              color={STUDIO_THEME.colors.accents.violet}
              packetSpeedFrames={96}
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
              from={portBottom(VERTICAL_WORLD_NODES.kitDiagrams)}
              to={portTop(VERTICAL_WORLD_NODES.renderCore)}
              orientation="vertical"
              activeFromFrame={renderTrigger - 10}
              color={STUDIO_THEME.colors.accents.emerald}
              packetSpeedFrames={96}
              packetCount={2}
            />

            <StationCard
              node={VERTICAL_WORLD_NODES.promptCard}
              enterFrame={2}
              badge="KROK 1 • POMYSŁ"
              title="Scenariusz w JSON"
              subtitle="Antigravity + Claude Code"
              accentColor={STUDIO_THEME.colors.accents.violet}
              icon={Wand2}
            />
            <StationCard
              node={VERTICAL_WORLD_NODES.voiceNode}
              enterFrame={voiceTrigger - 8}
              badge="KROK 2 • AUDIO"
              title="Lektor ElevenLabs"
              subtitle="Timestampy słów SHA-256"
              accentColor={STUDIO_THEME.colors.accents.indigo}
              icon={Mic}
            />
            <StationCard
              node={VERTICAL_WORLD_NODES.kitPaper}
              enterFrame={kitsTrigger}
              badge="KIT 1"
              title="Paper Diorama 3D"
              subtitle="Wycinanki 2.5D & Pop-Up Book"
              accentColor={STUDIO_THEME.colors.accents.amber}
              icon={Sparkles}
            />
            <StationCard
              node={VERTICAL_WORLD_NODES.kitIso}
              enterFrame={kitsTrigger + 8}
              badge="KIT 2"
              title="Isometric 3D Studio"
              subtitle="Postacie 3D i dialogi"
              accentColor={STUDIO_THEME.colors.accents.indigo}
              icon={Cpu}
            />
            <StationCard
              node={VERTICAL_WORLD_NODES.kitDiagrams}
              enterFrame={kitsTrigger + 16}
              badge="KIT 3"
              title="Motion Diagrams 2D"
              subtitle="Kamera One-Shot i porty"
              accentColor={STUDIO_THEME.colors.accents.emerald}
              icon={Code2}
            />
            <StationCard
              node={VERTICAL_WORLD_NODES.renderCore}
              enterFrame={renderTrigger - 10}
              badge="make.pictures"
              title="Gotowy film 60 FPS"
              subtitle="Poziomo 16:9 oraz Shorts 9:16"
              accentColor={STUDIO_THEME.colors.accents.emerald}
              icon={Film}
            />
          </>
        )}
      </CameraRig>
    </AbsoluteFill>
  );
};
