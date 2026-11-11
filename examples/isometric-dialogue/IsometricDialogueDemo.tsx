import React, { useLayoutEffect, useMemo } from 'react';
import { ThreeCanvas } from '@remotion/three';
import { useThree } from '@react-three/fiber';
import { Bot, Code2, Mic, Sparkles, Zap } from 'lucide-react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  interpolateColors,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import {
  getSmoothPoseWindow,
  getSpeechStateAtFrame,
  SPRING_PRESETS,
  STUDIO_FONTS,
  STUDIO_THEME,
  useStudioFontsReady,
} from '@make-pictures/core';
import {
  IsometricStudioEnvironment,
  Stylized3DCharacter,
} from '@make-pictures/kits/isometric-3d';
import isometricDefaults from './IsometricDialogueDemo.props.json';

export const isometricDialogueSchema = z.object({
  alexName: z.string().describe('Character A (Left) :: Name'),
  alexRole: z.string().describe('Character A (Left) :: Role / Voice Badge'),
  alexColor: z.string().describe('Character A (Left) :: Suit Color'),
  maxName: z.string().describe('Character B (Right) :: Name'),
  maxRole: z.string().describe('Character B (Right) :: Role / Voice Badge'),
  maxColor: z.string().describe('Character B (Right) :: Suit Color'),
  showHudCards: z.boolean().describe('Stage & Camera :: Show Speaker HUD Cards'),
  cameraZoom: z
    .number()
    .min(110)
    .max(220)
    .describe('Stage & Camera :: Isometric Zoom'),
  cameraHeightOffset: z
    .number()
    .min(-0.8)
    .max(0.8)
    .describe('Stage & Camera :: Vertical Frame Offset'),
  voiceoverVolume: z
    .number()
    .min(0)
    .max(1.5)
    .describe('Audio :: Dialogue Volume'),
  sfxVolume: z.number().min(0).max(1).describe('Audio :: SFX Volume'),
});

export type IsometricDialogueDemoProps = z.infer<
  typeof isometricDialogueSchema
>;

const IsometricZoomRig: React.FC<{ zoom: number }> = ({ zoom }) => {
  const camera = useThree((state) => state.camera);
  useLayoutEffect(() => {
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
  }, [camera, zoom]);
  return null;
};

const TURN1_START = 36;
const TURN2_START = 296;
const TURN3_START = 548;
const CODE_MORPH_FRAME = 327;
const FINALE_ACTIVATE_FRAME = 753;

export const IsometricDialogueDemo: React.FC<
  Partial<IsometricDialogueDemoProps>
> = (rawProps) => {
  const props: IsometricDialogueDemoProps = {
    ...isometricDefaults,
    ...rawProps,
  };
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  useStudioFontsReady();

  const worldFade = interpolate(frame, [0, 1, 14], [0, 0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const speechTurn1 = getSpeechStateAtFrame('iso-line-1', frame - TURN1_START);
  const speechTurn2 = getSpeechStateAtFrame('iso-line-2', frame - TURN2_START);
  const speechTurn3 = getSpeechStateAtFrame('iso-line-3', frame - TURN3_START);

  const alexSpeakingWeight = Math.max(
    speechTurn1.speakingWeight,
    speechTurn3.speakingWeight
  );
  const maxSpeakingWeight = speechTurn2.speakingWeight;

  const alexEnergy = Math.max(speechTurn1.energy, speechTurn3.energy);
  const maxEnergy = speechTurn2.energy;

  const alexGestureWeights = {
    shrug: getSmoothPoseWindow(frame, fps, TURN1_START, TURN2_START - 10),
    listenNod: getSmoothPoseWindow(frame, fps, TURN2_START, TURN3_START - 10),
    presentRight: getSmoothPoseWindow(
      frame,
      fps,
      TURN3_START,
      FINALE_ACTIVATE_FRAME
    ),
    celebrate: getSmoothPoseWindow(frame, fps, FINALE_ACTIVATE_FRAME),
  };

  const maxGestureWeights = {
    listenNod:
      getSmoothPoseWindow(frame, fps, TURN1_START + 25, TURN2_START - 10) +
      getSmoothPoseWindow(frame, fps, TURN3_START, FINALE_ACTIVATE_FRAME),
    presentLeft: getSmoothPoseWindow(
      frame,
      fps,
      TURN2_START - 6,
      TURN3_START - 10
    ),
    celebrate: getSmoothPoseWindow(frame, fps, FINALE_ACTIVATE_FRAME),
  };

  const alexLookAtMax = getSmoothPoseWindow(
    frame,
    fps,
    TURN2_START - 8,
    TURN3_START - 8
  );
  const maxLookAtAlex =
    getSmoothPoseWindow(frame, fps, TURN1_START, TURN2_START - 12) +
    getSmoothPoseWindow(frame, fps, TURN3_START - 8);

  const alexHeadYawOffset = 0.06 + alexLookAtMax * 0.12;
  const maxHeadYawOffset = -0.05 - Math.min(1, maxLookAtAlex) * 0.12;

  const turn1Cam = spring({
    frame: frame - TURN1_START,
    fps,
    config: SPRING_PRESETS.calmCamera,
  });
  const turn2Cam = spring({
    frame: frame - (TURN2_START - 15),
    fps,
    config: SPRING_PRESETS.calmCamera,
  });
  const turn3Cam = spring({
    frame: frame - (TURN3_START - 15),
    fps,
    config: SPRING_PRESETS.calmCamera,
  });

  const focusX = -0.32 * turn1Cam + 0.64 * turn2Cam - 0.32 * turn3Cam;
  const focusY =
    1.15 + props.cameraHeightOffset + 0.05 * turn2Cam - 0.05 * turn3Cam;
  const worldScale =
    0.9 + 0.07 * turn1Cam + 0.01 * turn2Cam - 0.08 * turn3Cam;
  const worldOrbitYaw =
    0.04 * turn1Cam -
    0.09 * turn2Cam +
    0.05 * turn3Cam +
    Math.sin(frame / 140) * 0.01;

  const phase1Morph = spring({
    frame: frame - CODE_MORPH_FRAME,
    fps,
    config: SPRING_PRESETS.smooth,
  });
  const phase2Morph = spring({
    frame: frame - FINALE_ACTIVATE_FRAME,
    fps,
    config: SPRING_PRESETS.smooth,
  });
  const hudPhaseBlend = Math.min(2, phase1Morph + phase2Morph);
  const hudPillBorderColor = interpolateColors(
    hudPhaseBlend,
    [0, 1, 2],
    ['#F59E0B', props.alexColor, props.maxColor]
  );

  const currentPhase =
    phase2Morph > 0.5 ? 2 : phase1Morph > 0.5 ? 1 : 0;

  const alexBorderColor = interpolateColors(
    Math.min(1, alexSpeakingWeight),
    [0, 1],
    ['rgba(199, 210, 254, 0.85)', props.alexColor]
  );
  const maxBorderColor = interpolateColors(
    Math.min(1, maxSpeakingWeight),
    [0, 1],
    ['rgba(199, 210, 254, 0.85)', props.maxColor]
  );

  const initialCamera = useMemo(
    () => ({
      position: [11, 9.2, 11] as [number, number, number],
      zoom: 162,
      near: -50,
      far: 100,
    }),
    []
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: STUDIO_THEME.colors.bgCanvas,
        fontFamily: STUDIO_FONTS.sans,
        overflow: 'hidden',
      }}
    >
      <Sequence from={TURN1_START}>
        <Audio
          src={staticFile('voiceovers/iso-line-1.mp3')}
          volume={props.voiceoverVolume}
        />
      </Sequence>
      <Sequence from={TURN2_START}>
        <Audio
          src={staticFile('voiceovers/iso-line-2.mp3')}
          volume={props.voiceoverVolume}
        />
      </Sequence>
      <Sequence from={TURN3_START}>
        <Audio
          src={staticFile('voiceovers/iso-line-3.mp3')}
          volume={props.voiceoverVolume}
        />
      </Sequence>

      <Sequence from={CODE_MORPH_FRAME} durationInFrames={25}>
        <Audio
          src={staticFile('sfx/whoosh.wav')}
          volume={props.sfxVolume * 0.92}
        />
      </Sequence>
      <Sequence from={FINALE_ACTIVATE_FRAME} durationInFrames={20}>
        <Audio
          src={staticFile('sfx/pop.wav')}
          volume={Math.min(1, props.sfxVolume * 1.08)}
        />
      </Sequence>

      <AbsoluteFill
        style={{
          backgroundImage: `
            radial-gradient(circle at 22% 28%, rgba(165, 180, 252, 0.38) 0%, transparent 48%),
            radial-gradient(circle at 78% 32%, rgba(167, 243, 208, 0.32) 0%, transparent 50%),
            radial-gradient(circle at 50% 80%, rgba(224, 231, 255, 0.45) 0%, transparent 55%)
          `,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            'radial-gradient(rgba(37, 99, 235, 0.14) 1.5px, transparent 1.5px)',
          backgroundSize: '36px 36px',
        }}
      />

      <AbsoluteFill style={{ opacity: worldFade }}>
        <ThreeCanvas
          width={width}
          height={height}
          orthographic
          camera={initialCamera}
        >
          <IsometricZoomRig zoom={props.cameraZoom} />
          <group
            scale={[worldScale, worldScale, worldScale]}
            position={[-focusX, -focusY, 0]}
            rotation={[0, worldOrbitYaw, 0]}
          >
            <IsometricStudioEnvironment
              codeMorphFrame={CODE_MORPH_FRAME}
              finaleActivateFrame={FINALE_ACTIVATE_FRAME}
            />

            <Stylized3DCharacter
              position={[-1.95, 0, 0.45]}
              rotationY={0.58}
              primaryColor={props.alexColor}
              accentColor="#38BDF8"
              speechEnergy={alexEnergy}
              speakingWeight={alexSpeakingWeight}
              gestureWeights={alexGestureWeights}
              enterFrame={3}
              headYawOffset={alexHeadYawOffset}
            />

            <Stylized3DCharacter
              position={[1.95, 0, 0.45]}
              rotationY={-0.58}
              primaryColor={props.maxColor}
              accentColor="#34D399"
              speechEnergy={maxEnergy}
              speakingWeight={maxSpeakingWeight}
              gestureWeights={maxGestureWeights}
              enterFrame={6}
              headYawOffset={maxHeadYawOffset}
            />
          </group>
        </ThreeCanvas>
      </AbsoluteFill>

      {frame >= 4 && props.showHudCards && (
        <AbsoluteFill style={{ pointerEvents: 'none', opacity: worldFade }}>
          <div
            style={{
              position: 'absolute',
              top: 38,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.96)',
                border: `2.5px solid ${hudPillBorderColor}`,
                boxShadow: STUDIO_THEME.shadows.cardElevated,
                padding: '14px 32px',
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              {currentPhase === 2 ? (
                <Zap size={26} color={props.maxColor} />
              ) : currentPhase === 1 ? (
                <Code2 size={26} color={props.alexColor} />
              ) : (
                <Sparkles size={26} color="#D97706" />
              )}
              <span
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: STUDIO_THEME.colors.text.primary,
                }}
              >
                {currentPhase === 2
                  ? '60 FPS Multi-Voice Studio'
                  : currentPhase === 1
                  ? '3D Worlds Generated from Code'
                  : 'Manual Keyframe Editing'}
              </span>
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: 48,
              left: 64,
              backgroundColor: `rgba(255, 255, 255, ${
                0.88 + alexSpeakingWeight * 0.1
              })`,
              border: `3px solid ${alexBorderColor}`,
              boxShadow:
                alexSpeakingWeight > 0.35
                  ? STUDIO_THEME.shadows.glowViolet
                  : STUDIO_THEME.shadows.card,
              borderRadius: 28,
              padding: '18px 28px',
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              willChange: 'transform, opacity',
              transform: `translate3d(0, 0, 0) scale(${
                0.97 + alexSpeakingWeight * 0.05
              })`,
              opacity: 0.78 + alexSpeakingWeight * 0.22,
            }}
          >
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 18,
                background: props.alexColor,
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Mic size={28} />
            </div>
            <div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: STUDIO_THEME.colors.text.primary,
                }}
              >
                {props.alexName}
              </div>
              <div
                style={{
                  fontFamily: STUDIO_FONTS.mono,
                  fontSize: 12,
                  fontWeight: 700,
                  color: props.alexColor,
                  letterSpacing: '0.05em',
                }}
              >
                {props.alexRole}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                marginLeft: 10,
                height: 36,
              }}
            >
              {[0.5, 0.85, 1.0, 0.75, 0.45].map((mult, i) => (
                <div
                  key={i}
                  style={{
                    width: 6,
                    height: Math.max(8, 8 + alexEnergy * 24 * mult),
                    borderRadius: 99,
                    backgroundColor:
                      alexSpeakingWeight > 0.25 ? props.alexColor : '#CBD5E1',
                  }}
                />
              ))}
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: 48,
              right: 64,
              backgroundColor: `rgba(255, 255, 255, ${
                0.88 + maxSpeakingWeight * 0.1
              })`,
              border: `3px solid ${maxBorderColor}`,
              boxShadow:
                maxSpeakingWeight > 0.35
                  ? STUDIO_THEME.shadows.glowEmerald
                  : STUDIO_THEME.shadows.card,
              borderRadius: 28,
              padding: '18px 28px',
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              willChange: 'transform, opacity',
              transform: `translate3d(0, 0, 0) scale(${
                0.97 + maxSpeakingWeight * 0.05
              })`,
              opacity: 0.78 + maxSpeakingWeight * 0.22,
            }}
          >
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 18,
                background: props.maxColor,
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bot size={28} />
            </div>
            <div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: STUDIO_THEME.colors.text.primary,
                }}
              >
                {props.maxName}
              </div>
              <div
                style={{
                  fontFamily: STUDIO_FONTS.mono,
                  fontSize: 12,
                  fontWeight: 700,
                  color: props.maxColor,
                  letterSpacing: '0.05em',
                }}
              >
                {props.maxRole}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                marginLeft: 10,
                height: 36,
              }}
            >
              {[0.5, 0.85, 1.0, 0.8, 0.5].map((mult, i) => (
                <div
                  key={i}
                  style={{
                    width: 6,
                    height: Math.max(8, 8 + maxEnergy * 24 * mult),
                    borderRadius: 99,
                    backgroundColor:
                      maxSpeakingWeight > 0.25 ? props.maxColor : '#CBD5E1',
                  }}
                />
              ))}
            </div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
