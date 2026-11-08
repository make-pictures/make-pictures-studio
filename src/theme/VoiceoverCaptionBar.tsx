import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { getActiveWordAtFrame, getSceneVoiceover } from '../utils/timestamps';
import { FONTS } from './fonts';
import { SPRING_PRESETS, THEME } from './tokens';

export interface VoiceoverCaptionBarProps {
  sceneId: string;
  accentColor?: string;
}

export const VoiceoverCaptionBar: React.FC<VoiceoverCaptionBarProps> = ({
  sceneId,
  accentColor = THEME.colors.accents.cyan,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const voiceover = getSceneVoiceover(sceneId);

  if (!voiceover || voiceover.words.length === 0) {
    return null;
  }

  const enterProgress = spring({
    frame: frame - 6,
    fps,
    config: SPRING_PRESETS.snappy,
  });

  const exitOpacity = interpolate(
    frame,
    [durationInFrames - 22, durationInFrames - 4],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const activeWord = getActiveWordAtFrame(sceneId, frame);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        opacity: enterProgress * exitOpacity,
        transform: `translateY(${interpolate(enterProgress, [0, 1], [18, 0])}px)`,
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          padding: '12px 24px',
          borderRadius: THEME.radii.pill,
          backgroundColor: 'rgba(11, 14, 23, 0.78)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: THEME.borders.thin,
          boxShadow:
            '0 18px 42px rgba(0, 0, 0, 0.65), 0 1px 0 rgba(255,255,255,0.08) inset',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '7px 8px',
          fontFamily: FONTS.sans,
          fontSize: 18,
          fontWeight: 500,
          letterSpacing: '-0.01em',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: accentColor,
            boxShadow: `0 0 12px ${accentColor}`,
            marginRight: 6,
            flexShrink: 0,
          }}
        />
        {voiceover.words.map((item, idx) => {
          const isCurrent = activeWord?.index === idx;
          const isSpoken = frame >= item.startFrame;

          return (
            <span
              key={`${item.word}-${idx}`}
              style={{
                color: isCurrent
                  ? '#FFFFFF'
                  : isSpoken
                  ? 'rgba(248, 250, 252, 0.88)'
                  : 'rgba(148, 163, 184, 0.48)',
                textShadow: isCurrent ? `0 0 18px ${accentColor}88` : 'none',
                backgroundColor: isCurrent
                  ? `${accentColor}22`
                  : 'transparent',
                padding: '1px 5px',
                borderRadius: 6,
                transition: 'color 60ms linear',
              }}
            >
              {item.word}
            </span>
          );
        })}
      </div>
    </div>
  );
};
