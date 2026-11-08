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
import {
  CodePayloadToast,
  DataFlowEdge,
  SystemNode,
} from '../components/diagrams';
import {
  AmbientBackground,
  FONTS,
  SPRING_PRESETS,
  THEME,
  VoiceoverCaptionBar,
} from '../theme';
import { getWordTriggerFrame } from '../utils/timestamps';

export interface ArchitectureDemoSceneProps {
  /** Whether to include scene-level voiceover audio (true when rendered standalone) */
  includeAudio?: boolean;
}

export const ArchitectureDemoScene: React.FC<ArchitectureDemoSceneProps> = ({
  includeAudio = false,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Synchronize key timeline triggers with word timestamps from /public/voiceovers/architecture-demo.json
  const requestTriggerFrame = getWordTriggerFrame(
    'architecture-demo',
    'wysyła',
    68
  );
  const dbTriggerFrame = getWordTriggerFrame(
    'architecture-demo',
    'błyskawicznej',
    310
  );

  // Packet traversal duration along each Bézier edge (in frames @ 60fps)
  const edge1TraverseFrames = 56;
  const edge2TraverseFrames = 56;

  // Exact frame when the first packet arrives at "AI Agent / API"
  const agentArrivalFrame = requestTriggerFrame + edge1TraverseFrames;
  // Exact frame when the first packet arrives at "PostgreSQL"
  const postgresArrivalFrame = dbTriggerFrame + edge2TraverseFrames;
  const allSyncedFrame = 485;

  // Node center coordinates on the 1920x1080 canvas
  const nodeWidth = 350;
  const nodeHeight = 192;

  const appNodePos = { x: 330, y: 470 };
  const agentNodePos = { x: 960, y: 350 };
  const dbNodePos = { x: 1590, y: 470 };

  // Header entrance animation
  const headerProgress = spring({
    frame: frame - 4,
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
          color: THEME.colors.accents.emerald,
        }
      : frame >= agentArrivalFrame
      ? {
          label: 'STATE: AI AGENT INFERENCE',
          color: THEME.colors.accents.violet,
        }
      : frame >= requestTriggerFrame
      ? {
          label: 'STATE: DISPATCHING PAYLOAD',
          color: THEME.colors.accents.cyan,
        }
      : {
          label: 'STATE: ARCHITECTURE READY',
          color: THEME.colors.textSecondary,
        };

  return (
    <AbsoluteFill style={{ opacity: sceneExitOpacity }}>
      <AmbientBackground
        primaryGlowColor={THEME.colors.accents.cyan}
        secondaryGlowColor={THEME.colors.accents.violet}
        tertiaryGlowColor={THEME.colors.accents.emerald}
      />

      {/* Optional standalone audio when previewing ArchitectureDemo directly */}
      {includeAudio && (
        <Audio src={staticFile('voiceovers/architecture-demo.mp3')} />
      )}

      {/* Subtle SFX synchronized with packet dispatch & node arrival */}
      <Sequence from={requestTriggerFrame} durationInFrames={30}>
        <Audio src={staticFile('sfx/whoosh.wav')} volume={0.35} />
      </Sequence>
      <Sequence from={agentArrivalFrame} durationInFrames={20}>
        <Audio src={staticFile('sfx/pop.wav')} volume={0.45} />
      </Sequence>
      <Sequence from={dbTriggerFrame} durationInFrames={30}>
        <Audio src={staticFile('sfx/whoosh.wav')} volume={0.35} />
      </Sequence>
      <Sequence from={postgresArrivalFrame} durationInFrames={20}>
        <Audio src={staticFile('sfx/pop.wav')} volume={0.45} />
      </Sequence>

      {/* Top Section Header */}
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
          transform: `translateY(${interpolate(
            headerProgress,
            [0, 1],
            [18, 0]
          )}px)`,
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
            Przepływ kontekstu i zapisu w czasie rzeczywistym
          </h2>
        </div>

        {/* Live Telemetry Pill */}
        <div
          style={{
            padding: '10px 18px',
            borderRadius: THEME.radii.pill,
            backgroundColor: 'rgba(15, 18, 29, 0.82)',
            backdropFilter: 'blur(16px)',
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

      {/* SVG Bézier Edge 1: Moja Aplikacja -> AI Agent / API */}
      <DataFlowEdge
        id="app-to-agent"
        from={{ x: appNodePos.x + nodeWidth / 2, y: appNodePos.y - 10 }}
        to={{ x: agentNodePos.x - nodeWidth / 2, y: agentNodePos.y }}
        curveOffsetY={-75}
        color={THEME.colors.accents.cyan}
        secondaryColor={THEME.colors.accents.violet}
        drawStartFrame={28}
        flowStartFrame={requestTriggerFrame}
        flowEndFrame={durationInFrames - 25}
        packetCount={3}
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
        color={THEME.colors.accents.violet}
        secondaryColor={THEME.colors.accents.emerald}
        drawStartFrame={46}
        flowStartFrame={dbTriggerFrame}
        flowEndFrame={durationInFrames - 25}
        packetCount={3}
        traverseFrames={edge2TraverseFrames}
        direction="forward"
        label="INSERT INTO insights"
        subLabel="pgvector TLS"
      />

      {/* Node 1: Moja Aplikacja */}
      <SystemNode
        id="my-app"
        title="Moja Aplikacja"
        subtitle="Next.js Edge Runtime • Client Gateway"
        badge="APP CORE"
        statusText="IDLE • READY"
        activeStatusText="DISPATCHING CONTEXT"
        icon={Cpu}
        x={appNodePos.x}
        y={appNodePos.y}
        width={nodeWidth}
        height={nodeHeight}
        accentColor={THEME.colors.accents.cyan}
        enterFrame={10}
        activeRanges={[
          [requestTriggerFrame - 6, agentArrivalFrame + 55],
          [allSyncedFrame, durationInFrames - 20],
        ]}
        metricsLabel="RPS"
        metricsValue="2,450/s"
      />

      {/* Node 2: AI Agent / API */}
      <SystemNode
        id="ai-agent"
        title="AI Agent / API"
        subtitle="Orchestrator • Structured Tool Calling"
        badge="LLM ENGINE"
        statusText="STANDBY • WARM"
        activeStatusText="INFERENCE • 28ms"
        icon={Bot}
        x={agentNodePos.x}
        y={agentNodePos.y}
        width={nodeWidth}
        height={nodeHeight}
        accentColor={THEME.colors.accents.violet}
        enterFrame={18}
        activeRanges={[
          [agentArrivalFrame, postgresArrivalFrame + 35],
          [allSyncedFrame, durationInFrames - 20],
        ]}
        metricsLabel="TOKENS"
        metricsValue="1,840/s"
      />

      {/* Node 3: PostgreSQL */}
      <SystemNode
        id="postgresql"
        title="PostgreSQL"
        subtitle="Primary Cluster + pgvector HNSW Index"
        badge="STORAGE"
        statusText="LISTENING :5432"
        activeStatusText="COMMITTED • ACID OK"
        icon={Database}
        x={dbNodePos.x}
        y={dbNodePos.y}
        width={nodeWidth}
        height={nodeHeight}
        accentColor={THEME.colors.accents.emerald}
        enterFrame={26}
        activeRanges={[[postgresArrivalFrame, durationInFrames - 20]]}
        metricsLabel="COMMIT"
        metricsValue="4.2ms"
      />

      {/* Code Payload Toast 1: Request Payload from App to AI Agent */}
      <CodePayloadToast
        x={580}
        y={650}
        width={430}
        methodBadge="POST"
        endpoint="/v1/agent/analyze"
        latencyText="TLS 1.3 • 14ms"
        accentColor={THEME.colors.accents.cyan}
        startFrame={requestTriggerFrame + 14}
        endFrame={dbTriggerFrame + 40}
        code={`{
  "requestId": "req_99f2a8c",
  "source": "moja-aplikacja",
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

      {/* Synchronized Word-by-Word Voiceover Subtitles */}
      <VoiceoverCaptionBar
        sceneId="architecture-demo"
        accentColor={
          frame >= postgresArrivalFrame
            ? THEME.colors.accents.emerald
            : frame >= agentArrivalFrame
            ? THEME.colors.accents.violet
            : THEME.colors.accents.cyan
        }
      />
    </AbsoluteFill>
  );
};
