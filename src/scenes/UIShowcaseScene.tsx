import React from 'react';
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
import { ScreenFrame } from '../components/ui-showcase/ScreenFrame';
import {
  AmbientBackground,
  FONTS,
  SPRING_PRESETS,
  THEME,
  useStudioFontsReady,
  VoiceoverCaptionBar,
} from '../theme';

export interface UIShowcaseSceneProps {
  showCaptions?: boolean;
}

export const UIShowcaseScene: React.FC<UIShowcaseSceneProps> = ({
  showCaptions = false,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  useStudioFontsReady();

  const headerProgress = spring({
    frame: frame - 2,
    fps,
    config: SPRING_PRESETS.snappy,
  });

  const exitOpacity = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ opacity: exitOpacity }}>
      <AmbientBackground
        primaryGlowColor={THEME.colors.accents.blue}
        secondaryGlowColor={THEME.colors.accents.cyan}
      />

      <Sequence from={8} durationInFrames={30}>
        <Audio src={staticFile('sfx/whoosh.wav')} volume={0.35} />
      </Sequence>
      <Sequence from={45} durationInFrames={15}>
        <Audio src={staticFile('sfx/click.wav')} volume={0.4} />
      </Sequence>

      {/* Top Subtle Section Label */}
      {headerProgress > 0.002 && (
        <div
          style={{
            position: 'absolute',
            top: 44,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            opacity: headerProgress,
            transform: `translate3d(0, ${interpolate(
              headerProgress,
              [0, 1],
              [14, 0]
            )}px, 0)`,
            zIndex: 10,
          }}
        >
          <div
            style={{
              padding: '6px 16px',
              borderRadius: THEME.radii.pill,
              backgroundColor: 'rgba(15, 18, 29, 0.92)',
              border: THEME.borders.thin,
              fontFamily: FONTS.mono,
              fontSize: 12,
              color: THEME.colors.accents.cyan,
              letterSpacing: '0.07em',
            }}
          >
            PRODUCTION UI SHOWCASE • SCREEN STUDIO 3D FRAME
          </div>
        </div>
      )}

      {/* 3D macOS Window Frame with native 60 FPS GPU telemetry canvas */}
      <ScreenFrame
        windowTitle="make.pictures — Production Telemetry (eu-central-1)"
        urlBadge="app.make.pictures/realtime/streams"
        width={1360}
        height={720}
        enterFrame={4}
        exitFrame={durationInFrames - 24}
        accentColor={THEME.colors.accents.cyan}
        showLiveTelemetryOverlay={true}
      />

      {showCaptions && (
        <VoiceoverCaptionBar
          sceneId="ui-showcase"
          accentColor={THEME.colors.accents.cyan}
        />
      )}
    </AbsoluteFill>
  );
};
