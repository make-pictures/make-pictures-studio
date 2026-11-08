import React from 'react';
import { Sparkles } from 'lucide-react';
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
  AmbientBackground,
  FONTS,
  SPRING_PRESETS,
  THEME,
  VoiceoverCaptionBar,
} from '../theme';

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const badgeSpring = spring({
    frame: frame - 8,
    fps,
    config: SPRING_PRESETS.snappy,
  });

  const titleSpring = spring({
    frame: frame - 18,
    fps,
    config: SPRING_PRESETS.smooth,
  });

  const subSpring = spring({
    frame: frame - 34,
    fps,
    config: SPRING_PRESETS.smooth,
  });

  const exitOpacity = interpolate(
    frame,
    [durationInFrames - 22, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ opacity: exitOpacity }}>
      <AmbientBackground
        primaryGlowColor={THEME.colors.accents.cyan}
        secondaryGlowColor={THEME.colors.accents.violet}
      />

      <Sequence from={10} durationInFrames={30}>
        <Audio src={staticFile('sfx/whoosh.wav')} volume={0.35} />
      </Sequence>

      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 160px',
          textAlign: 'center',
        }}
      >
        {/* Top Kinetic Pill Badge */}
        <div
          style={{
            opacity: badgeSpring,
            transform: `translateY(${interpolate(
              badgeSpring,
              [0, 1],
              [22, 0]
            )}px) scale(${interpolate(badgeSpring, [0, 1], [0.9, 1])})`,
            padding: '8px 18px',
            borderRadius: THEME.radii.pill,
            backgroundColor: 'rgba(15, 18, 29, 0.85)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(0, 240, 255, 0.35)',
            boxShadow: '0 0 32px rgba(0, 240, 255, 0.16)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 28,
          }}
        >
          <Sparkles size={15} color={THEME.colors.accents.cyan} />
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 12.5,
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: THEME.colors.textPrimary,
              textTransform: 'uppercase',
            }}
          >
            VIDEO-AS-CODE STUDIO • ARCHITECTURE AAA
          </span>
        </div>

        {/* Hero Title */}
        <h1
          style={{
            margin: 0,
            opacity: titleSpring,
            transform: `translateY(${interpolate(
              titleSpring,
              [0, 1],
              [34, 0]
            )}px)`,
            fontFamily: FONTS.sans,
            fontSize: 84,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1.06,
            background:
              'linear-gradient(180deg, #FFFFFF 0%, #E2E8F0 60%, #94A3B8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Aether Engine
        </h1>

        {/* Subtitle */}
        <p
          style={{
            margin: '24px 0 0 0',
            maxWidth: 920,
            opacity: subSpring,
            transform: `translateY(${interpolate(
              subSpring,
              [0, 1],
              [24, 0]
            )}px)`,
            fontFamily: FONTS.sans,
            fontSize: 27,
            fontWeight: 400,
            letterSpacing: '-0.015em',
            lineHeight: 1.45,
            color: THEME.colors.textSecondary,
          }}
        >
          Natywna orkiestracja agentów AI, strumieniowe przetwarzanie kontekstu
          i niezawodna warstwa zapisu w czasie rzeczywistym.
        </p>
      </AbsoluteFill>

      <VoiceoverCaptionBar
        sceneId="intro"
        accentColor={THEME.colors.accents.cyan}
      />
    </AbsoluteFill>
  );
};
