import React from 'react';
import { Bot, Cpu, Database } from 'lucide-react';
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
  AmbientBackground,
  FONTS,
  getWordTriggerFrame,
  SPRING_PRESETS,
  THEME,
  useStudioFontsReady,
  VoiceoverCaptionBar,
} from '@make-pictures/core';
import {
  CodePayloadToast,
  DataFlowEdge,
  SystemNode,
} from '@make-pictures/kits/motion-diagrams-2d';
import architectureDefaults from '../../examples/aether-promo/ArchitectureDemo.props.json';

export const architectureDemoSchema = z.object({
  headline: z.string().describe('Text & Labels :: Section Headline'),
  appNodeTitle: z.string().describe('Text & Labels :: Node 1 (Client App)'),
  agentNodeTitle: z.string().describe('Text & Labels :: Node 2 (AI Agent)'),
  dbNodeTitle: z.string().describe('Text & Labels :: Node 3 (Database)'),
  primaryGlowColor: z.string().describe('Colors & Style :: Ingress Accent'),
  secondaryGlowColor: z
    .string()
    .describe('Colors & Style :: Orchestrator Accent'),
  tertiaryGlowColor: z.string().describe('Colors & Style :: Storage Accent'),
  showCaptions: z.boolean().describe('Captions :: Show Voiceover Subtitles'),
  voiceoverVolume: z
    .number()
    .min(0)
    .max(1.5)
    .describe('Audio :: Voiceover Volume'),
  sfxVolume: z.number().min(0).max(1).describe('Audio :: SFX Volume'),
});

export type ArchitectureDemoProps = z.infer<typeof architectureDemoSchema>;

export interface ArchitectureDemoSceneProps
  extends Partial<ArchitectureDemoProps> {
  /** Whether to include scene-level voiceover audio (true when rendered standalone) */
  includeAudio?: boolean;
}

export const ArchitectureDemoScene: React.FC<ArchitectureDemoSceneProps> = ({
  includeAudio = false,
  ...rawProps
}) => {
  const props: ArchitectureDemoProps = {
    ...architectureDefaults,
    ...rawProps,
  };
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  useStudioFontsReady();

  // Synchronize key timeline triggers with word timestamps from /public/voiceovers/architecture-demo.json
  const requestTriggerFrame = getWordTriggerFrame(
    'architecture-demo',
    'sends',
    46
  );
  const dbTriggerFrame = getWordTriggerFrame(
    'architecture-demo',
    'After',
    309
  );

  // Calm packet traversal duration along each Bézier edge (96 frames = 1.6s @ 60 FPS per AGENTS.md Section 4)
  const edge1TraverseFrames = 96;
  const edge2TraverseFrames = 96;

  // Exact frame when the first packet arrives at "AI Agent / API"
  const agentArrivalFrame = requestTriggerFrame + edge1TraverseFrames;
  // Exact frame when the first packet arrives at "PostgreSQL"
  const postgresArrivalFrame = dbTriggerFrame + edge2TraverseFrames;
  const allSyncedFrame = getWordTriggerFrame(
    'architecture-demo',
    'PostgreSQL',
    525
  );

  // Node center coordinates on the 1920x1080 canvas
  const nodeWidth = 350;
  const nodeHeight = 192;

  const appNodePos = { x: 330, y: 470 };
  const agentNodePos = { x: 960, y: 350 };
  const dbNodePos = { x: 1590, y: 470 };

  // Header entrance animation (starts at frame - 2 so frame 0 is a clean background)
  const headerProgress = spring({
    frame: frame - 2,
    fps,
    config: SPRING_PRESETS.snappy,
  });

  const sceneExitOpacity = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Pipeline status badge in top-right corner
  const pipelinePhase =
    frame >= postgresArrivalFrame
      ? {
          label: 'STATE: PERSISTED IN POSTGRESQL',
          color: props.tertiaryGlowColor,
        }
      : frame >= agentArrivalFrame
      ? {
          label: 'STATE: AI AGENT INFERENCE',
          color: props.secondaryGlowColor,
        }
      : frame >= requestTriggerFrame
      ? {
          label: 'STATE: DISPATCHING PAYLOAD',
          color: props.primaryGlowColor,
        }
      : {
          label: 'STATE: ARCHITECTURE READY',
          color: THEME.colors.textSecondary,
        };

  return (
    <AbsoluteFill style={{ opacity: sceneExitOpacity }}>
      <AmbientBackground
        primaryGlowColor={props.primaryGlowColor}
        secondaryGlowColor={props.secondaryGlowColor}
        tertiaryGlowColor={props.tertiaryGlowColor}
      />

      {/* Optional standalone audio when previewing ArchitectureDemo directly */}
      {includeAudio && (
        <Audio
          src={staticFile('voiceovers/architecture-demo.mp3')}
          volume={props.voiceoverVolume}
        />
      )}

      {/* Subtle SFX synchronized with packet dispatch & node arrival */}
      <Sequence from={requestTriggerFrame} durationInFrames={30}>
        <Audio
          src={staticFile('sfx/whoosh.wav')}
          volume={props.sfxVolume * 0.88}
        />
      </Sequence>
      <Sequence from={agentArrivalFrame} durationInFrames={20}>
        <Audio
          src={staticFile('sfx/pop.wav')}
          volume={Math.min(1, props.sfxVolume * 1.1)}
        />
      </Sequence>
      <Sequence from={dbTriggerFrame} durationInFrames={30}>
        <Audio
          src={staticFile('sfx/whoosh.wav')}
          volume={props.sfxVolume * 0.88}
        />
      </Sequence>
      <Sequence from={postgresArrivalFrame} durationInFrames={20}>
        <Audio
          src={staticFile('sfx/pop.wav')}
          volume={Math.min(1, props.sfxVolume * 1.1)}
        />
      </Sequence>

      {/* Top Section Header */}
      {headerProgress > 0.002 && (
        <div
          style={{
            position: 'absolute',
            top: 56,
            left: 96,
            right: 96,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            opacity: headerProgress,
            transform: `translate3d(0, ${interpolate(
              headerProgress,
              [0, 1],
              [18, 0]
            )}px, 0)`,
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 12px',
                borderRadius: THEME.radii.pill,
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: THEME.borders.thin,
                fontFamily: FONTS.mono,
                fontSize: 11.5,
                color: THEME.colors.accents.cyan,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              <span>ARCHITECTURE & DATA FLOW</span>
              <span style={{ color: THEME.colors.textMuted }}>•</span>
              <span style={{ color: THEME.colors.textSecondary }}>60 FPS</span>
            </div>
            <h2
              style={{
                margin: '12px 0 0 0',
                fontFamily: FONTS.sans,
                fontSize: 38,
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: THEME.colors.textPrimary,
              }}
            >
              {props.headline}
            </h2>
          </div>

          {/* Live Telemetry Pill */}
          <div
            style={{
              padding: '10px 18px',
              borderRadius: THEME.radii.pill,
              backgroundColor: 'rgba(15, 18, 29, 0.94)',
              border: `1px solid ${pipelinePhase.color}55`,
              boxShadow: `0 0 24px ${pipelinePhase.color}22`,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontFamily: FONTS.mono,
              fontSize: 12,
              fontWeight: 600,
              color: THEME.colors.textPrimary,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: pipelinePhase.color,
                boxShadow: `0 0 12px ${pipelinePhase.color}`,
              }}
            />
            <span>{pipelinePhase.label}</span>
          </div>
        </div>
      )}

      {/* SVG Bézier Edge 1: Web Client App -> AI Agent / API */}
      <DataFlowEdge
        id="app-to-agent"
        from={{ x: appNodePos.x + nodeWidth / 2, y: appNodePos.y - 10 }}
        to={{ x: agentNodePos.x - nodeWidth / 2, y: agentNodePos.y }}
        curveOffsetY={-75}
        color={props.primaryGlowColor}
        secondaryColor={props.secondaryGlowColor}
        drawStartFrame={24}
        flowStartFrame={requestTriggerFrame}
        flowEndFrame={durationInFrames - 25}
        packetCount={2}
        traverseFrames={edge1TraverseFrames}
        direction="forward"
        label="POST /v1/agent/analyze"
        subLabel="JSON Stream"
      />

      {/* SVG Bézier Edge 2: AI Agent / API -> PostgreSQL */}
      <DataFlowEdge
        id="agent-to-postgres"
        from={{ x: agentNodePos.x + nodeWidth / 2, y: agentNodePos.y }}
        to={{ x: dbNodePos.x - nodeWidth / 2, y: dbNodePos.y - 10 }}
        curveOffsetY={-75}
        color={props.secondaryGlowColor}
        secondaryColor={props.tertiaryGlowColor}
        drawStartFrame={42}
        flowStartFrame={dbTriggerFrame}
        flowEndFrame={durationInFrames - 25}
        packetCount={2}
        traverseFrames={edge2TraverseFrames}
        direction="forward"
        label="INSERT INTO insights"
        subLabel="pgvector TLS"
      />

      {/* Node 1: Web Client App */}
      <SystemNode
        id="web-client"
        title={props.appNodeTitle}
        subtitle="Next.js Edge Runtime • Client Gateway"
        badge="APP CORE"
        statusText="IDLE • READY"
        activeStatusText="DISPATCHING CONTEXT"
        icon={Cpu}
        x={appNodePos.x}
        y={appNodePos.y}
        width={nodeWidth}
        height={nodeHeight}
        accentColor={props.primaryGlowColor}
        enterFrame={8}
        activeRanges={[
          [requestTriggerFrame - 6, agentArrivalFrame + 40],
          [allSyncedFrame, durationInFrames - 20],
        ]}
        metricsLabel="RPS"
        metricsValue="2,450/s"
      />

      {/* Node 2: AI Agent / API */}
      <SystemNode
        id="ai-agent"
        title={props.agentNodeTitle}
        subtitle="Orchestrator • Structured Tool Calling"
        badge="LLM ENGINE"
        statusText="STANDBY • WARM"
        activeStatusText="INFERENCE • 28ms"
        icon={Bot}
        x={agentNodePos.x}
        y={agentNodePos.y}
        width={nodeWidth}
        height={nodeHeight}
        accentColor={props.secondaryGlowColor}
        enterFrame={16}
        activeRanges={[
          [agentArrivalFrame, postgresArrivalFrame + 30],
          [allSyncedFrame, durationInFrames - 20],
        ]}
        metricsLabel="TOKENS"
        metricsValue="1,840/s"
      />

      {/* Node 3: PostgreSQL */}
      <SystemNode
        id="postgresql"
        title={props.dbNodeTitle}
        subtitle="Primary Cluster + pgvector HNSW Index"
        badge="STORAGE"
        statusText="LISTENING :5432"
        activeStatusText="COMMITTED • ACID OK"
        icon={Database}
        x={dbNodePos.x}
        y={dbNodePos.y}
        width={nodeWidth}
        height={nodeHeight}
        accentColor={props.tertiaryGlowColor}
        enterFrame={24}
        activeRanges={[[postgresArrivalFrame, durationInFrames - 20]]}
        metricsLabel="COMMIT"
        metricsValue="4.2ms"
      />

      {/* Code Payload Toast 1: Request Payload from Web Client to AI Agent */}
      <CodePayloadToast
        x={580}
        y={650}
        width={430}
        methodBadge="POST"
        endpoint="/v1/agent/analyze"
        latencyText="TLS 1.3 • 14ms"
        accentColor={THEME.colors.accents.cyan}
        startFrame={requestTriggerFrame + 14}
        endFrame={dbTriggerFrame + 35}
        code={`{
  "requestId": "req_99f2a8c",
  "source": "web-client",
  "intent": "architecture_audit",
  "stream": true
}`}
      />

      {/* Code Payload Toast 2: Persisted Result from AI Agent to PostgreSQL */}
      <CodePayloadToast
        x={1340}
        y={650}
        width={450}
        methodBadge="SQL WRITE"
        endpoint="PostgreSQL • insights"
        latencyText="200 OK • 4.2ms"
        accentColor={THEME.colors.accents.emerald}
        startFrame={dbTriggerFrame + 16}
        endFrame={durationInFrames - 28}
        code={`{
  "table": "agent_insights",
  "status": "committed",
  "vectorDim": 1536,
  "confidence": 0.994
}`}
      />

      {/* Optional Word-by-Word Voiceover Subtitles */}
      {props.showCaptions && (
        <VoiceoverCaptionBar
          sceneId="architecture-demo"
          accentColor={
            frame >= postgresArrivalFrame
              ? props.tertiaryGlowColor
              : frame >= agentArrivalFrame
              ? props.secondaryGlowColor
              : props.primaryGlowColor
          }
        />
      )}
    </AbsoluteFill>
  );
};
