import React from 'react';
import { CheckCircle2, Terminal } from 'lucide-react';
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
  useStudioFontsReady,
  VoiceoverCaptionBar,
} from '../theme';

export interface OutroSceneProps {
  outroHeadline?: string;
  primaryGlowColor?: string;
  showCaptions?: boolean;
}

export const OutroScene: React.FC<OutroSceneProps> = ({
  outroHeadline = 'Ready for production.',
  primaryGlowColor = THEME.colors.accents.cyan,
  showCaptions = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  useStudioFontsReady();

  const cardProgress = spring({
    frame: frame - 4,
    fps,
    config: SPRING_PRESETS.snappy,
  });

  const ctaProgress = spring({
    frame: frame - 28,
    fps,
    config: SPRING_PRESETS.smooth,
  });

  return (
    <AbsoluteFill>
      <AmbientBackground
        primaryGlowColor={THEME.colors.accents.emerald}
        secondaryGlowColor={primaryGlowColor}
      />

      <Sequence from={10} durationInFrames={20}>
        <Audio src={staticFile('sfx/pop.wav')} volume={0.4} />
      </Sequence>

      {cardProgress > 0.002 && (
        <AbsoluteFill
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              opacity: cardProgress,
              transform: `translate3d(0, ${interpolate(
                cardProgress,
                [0, 1],
                [26, 0]
              )}px, 0) scale(${interpolate(cardProgress, [0, 1], [0.92, 1])})`,
              padding: '52px 72px',
              borderRadius: THEME.radii.xl,
              backgroundColor: 'rgba(15, 18, 29, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: THEME.shadows.glow(THEME.colors.accents.cyan, 0.7),
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              maxWidth: 920,
            }}
          >
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 16,
                backgroundColor: 'rgba(16, 185, 129, 0.16)',
                border: '1px solid rgba(16, 185, 129, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
              }}
            >
              <CheckCircle2 size={30} color={THEME.colors.accents.emerald} />
            </div>

            <h2
              style={{
                margin: 0,
                fontFamily: FONTS.sans,
                fontSize: 56,
                fontWeight: 700,
                letterSpacing: '-0.035em',
                color: THEME.colors.textPrimary,
              }}
            >
              {outroHeadline}
            </h2>

            <p
              style={{
                margin: '16px 0 32px 0',
                fontFamily: FONTS.sans,
                fontSize: 22,
                color: THEME.colors.textSecondary,
                maxWidth: 660,
                lineHeight: 1.45,
              }}
            >
              Build broadcast-grade architecture explainers and product videos
              directly from TypeScript.
            </p>

            {/* CLI CTA Pill */}
            <div
              style={{
                opacity: ctaProgress,
                transform: `translate3d(0, ${interpolate(
                  ctaProgress,
                  [0, 1],
                  [14, 0]
                )}px, 0)`,
                padding: '14px 26px',
                borderRadius: THEME.radii.md,
                backgroundColor: 'rgba(9, 10, 15, 0.94)',
                border: '1px solid rgba(0, 240, 255, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontFamily: FONTS.mono,
                fontSize: 16,
                color: THEME.colors.textPrimary,
              }}
            >
              <Terminal size={18} color={THEME.colors.accents.cyan} />
              <span style={{ color: THEME.colors.textSecondary }}>$</span>
              <span>npm run studio && npm run render</span>
            </div>
          </div>
        </AbsoluteFill>
      )}

      {showCaptions && (
        <VoiceoverCaptionBar
          sceneId="outro"
          accentColor={THEME.colors.accents.emerald}
        />
      )}
    </AbsoluteFill>
  );
};
