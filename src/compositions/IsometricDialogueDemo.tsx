import React from 'react';
import { ThreeCanvas } from '@remotion/three';
import { Bot, Code2, Mic, Sparkles, Zap } from 'lucide-react';
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
import { IsometricStudioEnvironment } from '../kits/isometric-3d/IsometricStudioEnvironment';
import { Stylized3DCharacter } from '../kits/isometric-3d/Stylized3DCharacter';
import { SPRING_PRESETS, STUDIO_FONTS, STUDIO_THEME } from '../theme';
import {
  getSmoothPoseWindow,
  getSpeechStateAtFrame,
} from '../utils/dialogue';

const TURN1_START = 36; // Alex (206f -> ends 242): "Widziałeś ile czasu zajmuje ręczne klejenie prezentacji wideo?"
const TURN2_START = 280; // Max (212f -> ends 492): "Dlatego tutaj cały świat trójwymiarowy generujemy bezpośrednio z kodu."
const TURN3_START = 530; // Alex (279f -> ends 809): "Jeden skrypt, dwa głosy i pełna animacja w sześćdziesięciu klatkach na sekundę!"
const CODE_MORPH_FRAME = 305;
const FINALE_ACTIVATE_FRAME = 675;

export const IsometricDialogueDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  // Frame 0 is a clean empty board (opacity 0 at frame = 0)
  const worldFade = interpolate(frame, [0, 1, 14], [0, 0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Low-pass smoothed speech state & continuous turn-level speaking weights
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

  // Smooth spring-interpolated gesture weights for Alex (Left)
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

  // Smooth spring-interpolated gesture weights for Max (Right)
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

  // Smoothly interpolated head gaze (looking toward the table vs. toward the other speaker)
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

  // Calm Isometric Camera Choreography
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

  // Gentle camera weight shifts: toward Alex (-0.32) in Turn 1, toward Max (+0.32) in Turn 2, centered (0) in Turn 3
  const focusX = -0.32 * turn1Cam + 0.64 * turn2Cam - 0.32 * turn3Cam;
  const focusY = 1.15 + 0.05 * turn2Cam - 0.05 * turn3Cam;
  const worldScale =
    0.9 + 0.07 * turn1Cam + 0.01 * turn2Cam - 0.08 * turn3Cam;
  const worldOrbitYaw =
    0.04 * turn1Cam -
    0.09 * turn2Cam +
    0.05 * turn3Cam +
    Math.sin(frame / 140) * 0.01;

  // Current phase for minimal top status badge
  const currentPhase =
    frame >= FINALE_ACTIVATE_FRAME
      ? 2
      : frame >= CODE_MORPH_FRAME
      ? 1
      : 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: STUDIO_THEME.colors.bgCanvas,
        fontFamily: STUDIO_FONTS.sans,
        overflow: 'hidden',
      }}
    >
      {/* ==================== MULTI-VOICE DIALOGUE AUDIO TRACKS ==================== */}
      <Sequence from={TURN1_START}>
        <Audio src={staticFile('voiceovers/iso-line-1.mp3')} />
      </Sequence>
      <Sequence from={TURN2_START}>
        <Audio src={staticFile('voiceovers/iso-line-2.mp3')} />
      </Sequence>
      <Sequence from={TURN3_START}>
        <Audio src={staticFile('voiceovers/iso-line-3.mp3')} />
      </Sequence>

      {/* Subtle Studio SFX */}
      <Sequence from={CODE_MORPH_FRAME} durationInFrames={25}>
        <Audio src={staticFile('sfx/whoosh.wav')} volume={0.32} />
      </Sequence>
      <Sequence from={FINALE_ACTIVATE_FRAME} durationInFrames={20}>
        <Audio src={staticFile('sfx/pop.wav')} volume={0.38} />
      </Sequence>

      {/* ==================== INFINITE STUDIO BACKDROP ==================== */}
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
            'radial-gradient(rgba(87, 35, 231, 0.14) 1.5px, transparent 1.5px)',
          backgroundSize: '36px 36px',
        }}
      />

      {/* ==================== 3D ISOMETRIC CANVAS (@remotion/three) ==================== */}
      <AbsoluteFill style={{ opacity: worldFade }}>
        <ThreeCanvas
          width={width}
          height={height}
          orthographic
          camera={{
            position: [11, 9.2, 11],
            zoom: 162,
            near: -50,
            far: 100,
          }}
        >
          <group
            scale={[worldScale, worldScale, worldScale]}
            position={[-focusX, -focusY, 0]}
            rotation={[0, worldOrbitYaw, 0]}
          >
            {/* Isometric Studio Platform, Walls & Interactive 3D Hologram */}
            <IsometricStudioEnvironment
              codeMorphFrame={CODE_MORPH_FRAME}
              finaleActivateFrame={FINALE_ACTIVATE_FRAME}
            />

            {/* Character A (Alex — Left, Electric Violet, Voice 1: Liam) */}
            <Stylized3DCharacter
              position={[-1.95, 0, 0.45]}
              rotationY={0.58}
              primaryColor="#5723E7"
              accentColor="#38BDF8"
              speechEnergy={alexEnergy}
              speakingWeight={alexSpeakingWeight}
              gestureWeights={alexGestureWeights}
              enterFrame={3}
              headYawOffset={alexHeadYawOffset}
            />

            {/* Character B (Max — Right, Cyber Emerald, Voice 2) */}
            <Stylized3DCharacter
              position={[1.95, 0, 0.45]}
              rotationY={-0.58}
              primaryColor="#059669"
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

      {/* ==================== MINIMALIST 2D STUDIO HUD OVERLAY ==================== */}
      {frame >= 4 && (
        <AbsoluteFill style={{ pointerEvents: 'none', opacity: worldFade }}>
          {/* Top Center Scene Status Pill */}
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
                backgroundColor: 'rgba(255, 255, 255, 0.94)',
                backdropFilter: 'blur(16px)',
                border: `2.5px solid ${
                  currentPhase === 2
                    ? '#10B981'
                    : currentPhase === 1
                    ? '#6366F1'
                    : '#F59E0B'
                }`,
                boxShadow: STUDIO_THEME.shadows.cardElevated,
                padding: '14px 32px',
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              {currentPhase === 2 ? (
                <Zap size={26} color="#059669" />
              ) : currentPhase === 1 ? (
                <Code2 size={26} color="#5723E7" />
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
                  ? 'Gotowa animacja 60 FPS'
                  : currentPhase === 1
                  ? 'Świat 3D generowany z kodu'
                  : 'Tradycyjny montaż wideo'}
              </span>
            </div>
          </div>

          {/* Bottom-Left Speaker Card: Character A (Alex) */}
          <div
            style={{
              position: 'absolute',
              bottom: 48,
              left: 64,
              backgroundColor: `rgba(255, 255, 255, ${
                0.84 + alexSpeakingWeight * 0.14
              })`,
              border: `3px solid ${
                alexSpeakingWeight > 0.35
                  ? '#5723E7'
                  : 'rgba(199, 210, 254, 0.8)'
              }`,
              boxShadow:
                alexSpeakingWeight > 0.35
                  ? STUDIO_THEME.shadows.glowViolet
                  : STUDIO_THEME.shadows.card,
              borderRadius: 28,
              padding: '18px 28px',
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              transform: `scale(${0.97 + alexSpeakingWeight * 0.05})`,
              opacity: 0.78 + alexSpeakingWeight * 0.22,
            }}
          >
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 18,
                background: 'linear-gradient(135deg, #5723E7, #6366F1)',
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
                Alex
              </div>
              <div
                style={{
                  fontFamily: STUDIO_FONTS.mono,
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#5723E7',
                  letterSpacing: '0.05em',
                }}
              >
                GŁOS 1 • LIAM
              </div>
            </div>
            {/* Smooth Voice Waveform Bars */}
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
                      alexSpeakingWeight > 0.25 ? '#5723E7' : '#CBD5E1',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Bottom-Right Speaker Card: Character B (Max) */}
          <div
            style={{
              position: 'absolute',
              bottom: 48,
              right: 64,
              backgroundColor: `rgba(255, 255, 255, ${
                0.84 + maxSpeakingWeight * 0.14
              })`,
              border: `3px solid ${
                maxSpeakingWeight > 0.35
                  ? '#10B981'
                  : 'rgba(199, 210, 254, 0.8)'
              }`,
              boxShadow:
                maxSpeakingWeight > 0.35
                  ? STUDIO_THEME.shadows.glowEmerald
                  : STUDIO_THEME.shadows.card,
              borderRadius: 28,
              padding: '18px 28px',
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              transform: `scale(${0.97 + maxSpeakingWeight * 0.05})`,
              opacity: 0.78 + maxSpeakingWeight * 0.22,
            }}
          >
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 18,
                background: 'linear-gradient(135deg, #10B981, #059669)',
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
                Max
              </div>
              <div
                style={{
                  fontFamily: STUDIO_FONTS.mono,
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#059669',
                  letterSpacing: '0.05em',
                }}
              >
                GŁOS 2 • ARCHITEKT 3D
              </div>
            </div>
            {/* Smooth Voice Waveform Bars */}
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
                      maxSpeakingWeight > 0.25 ? '#10B981' : '#CBD5E1',
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
