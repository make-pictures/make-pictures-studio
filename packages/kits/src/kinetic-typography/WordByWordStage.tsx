import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  FONTS,
  SPRING_PRESETS,
  STUDIO_THEME,
  THEME,
  useStudioFontsReady,
} from '../../../core/src/theme';
import type {
  SceneVoiceoverData,
  WordTimestamp,
} from '../../../core/src/types/scene';
import { getSceneVoiceover } from '../../../core/src/utils/timestamps';

export interface WordPhraseBeat {
  words: WordTimestamp[];
  startFrame: number;
  endFrame: number;
}

export interface WordByWordStageProps {
  /** Word-level timestamps (`WordTimestamp[]`) to drive rhythmic phrase beats */
  words?: ReadonlyArray<WordTimestamp>;
  /** Optional sceneId lookup into `voiceoverManifest` (used when `words` is omitted) */
  sceneId?: string;
  /** Optional isolated capsule voiceover manifest */
  voiceoverManifest?: Record<string, SceneVoiceoverData>;
  /** Optional fallback text if neither `words` nor `sceneId` has timestamps yet */
  fallbackText?: string;
  /** Composition frame offset when this scene starts (default `0`) */
  sceneStartFrame?: number;
  /** Target words per visual beat (`3..5` recommended, default `4`) */
  wordsPerBeat?: number;
  /** Highlight pill accent color (default `STUDIO_THEME.colors.brand[600]`) */
  accentColor?: string;
  /** Surface styling mode (`'transparent'` overlays 2D/3D stage cleanly) */
  variant?: 'dark' | 'light' | 'transparent';
  /** Optional top category pill */
  eyebrow?: string;
  /** Optional explicit headline font size in px */
  fontSize?: number;
  /** Constrain layout strictly inside `9:16 Golden Safe Box` when `height > width` (default `true`) */
  safeBox9x16?: boolean;
  /** Entrance start frame (clamped `>= 2` by default so Frame 0 stays clean) */
  enterFrame?: number;
  /** Alias for `enterFrame` */
  startFrame?: number;
  style?: React.CSSProperties;
}

function buildFallbackWords(
  text: string,
  fps: number,
  durationInFrames: number
): WordTimestamp[] {
  const tokens = text
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return [];

  const usableStart = Math.min(12, Math.floor(durationInFrames * 0.08));
  const usableSpan = Math.max(tokens.length * 6, durationInFrames - usableStart - 16);
  const perWord = usableSpan / tokens.length;

  return tokens.map((token, idx) => {
    const sf = Math.round(usableStart + idx * perWord);
    const ef = Math.max(sf + 4, Math.round(usableStart + (idx + 0.86) * perWord));
    return {
      word: token,
      normalizedWord: token
        .replace(/^[.,!?;:"'()[\]{}—–-]+|[.,!?;:"'()[\]{}—–-]+$/g, '')
        .toLowerCase(),
      start: sf / fps,
      end: ef / fps,
      startFrame: sf,
      endFrame: ef,
    };
  });
}

/**
 * Groups `WordTimestamp[]` into crisp rhythmic phrases of `3–5` words,
 * breaking naturally on sentence-ending punctuation or vocal pauses.
 */
export function groupWordsIntoBeats(
  words: ReadonlyArray<WordTimestamp>,
  wordsPerBeat = 4,
  fps = 60
): WordPhraseBeat[] {
  if (!words.length) return [];
  const maxWords = Math.max(2, Math.min(7, Math.round(wordsPerBeat)));
  const pauseThresholdFrames = Math.round(fps * 0.36);

  const beats: WordPhraseBeat[] = [];
  let bucket: WordTimestamp[] = [];

  const flush = () => {
    if (!bucket.length) return;
    beats.push({
      words: bucket,
      startFrame: bucket[0].startFrame,
      endFrame: bucket[bucket.length - 1].endFrame,
    });
    bucket = [];
  };

  for (let i = 0; i < words.length; i++) {
    const curr = words[i];
    const prev = bucket[bucket.length - 1];

    if (prev && curr.startFrame - prev.endFrame >= pauseThresholdFrames && bucket.length >= 2) {
      flush();
    }

    bucket.push(curr);

    const endsSentence = /[.!?;:—]$/.test(curr.word);
    const endsClause = /[,–]$/.test(curr.word) && bucket.length >= 3;

    if (bucket.length >= maxWords || (endsSentence && bucket.length >= 2) || endsClause) {
      flush();
    }
  }

  flush();
  return beats;
}

/**
 * Rhythmic 60 FPS Kinetic Typography spotlight synced to `WordTimestamp[]`.
 * Features damped active-word scale pop, glowing pill highlight, smart 3–5 word phrase beats,
 * and automatic `9:16 Golden Safe Box` (`x ∈ [40, 910], y ∈ [220, 1380]`) framing.
 */
export const WordByWordStage: React.FC<WordByWordStageProps> = ({
  words,
  sceneId,
  voiceoverManifest,
  fallbackText,
  sceneStartFrame = 0,
  wordsPerBeat = 4,
  accentColor = STUDIO_THEME.colors.brand[600],
  variant = 'transparent',
  eyebrow,
  fontSize,
  safeBox9x16 = true,
  enterFrame,
  startFrame,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  useStudioFontsReady();

  const resolvedWords = useMemo<ReadonlyArray<WordTimestamp>>(() => {
    if (words && words.length > 0) return words;
    if (sceneId) {
      const vo = getSceneVoiceover(sceneId, voiceoverManifest);
      if (vo && vo.words.length > 0) return vo.words;
      if (vo?.text) return buildFallbackWords(vo.text, fps, durationInFrames);
    }
    if (fallbackText) {
      return buildFallbackWords(fallbackText, fps, durationInFrames);
    }
    return [];
  }, [words, sceneId, voiceoverManifest, fallbackText, fps, durationInFrames]);

  const beats = useMemo(
    () => groupWordsIntoBeats(resolvedWords, wordsPerBeat, fps),
    [resolvedWords, wordsPerBeat, fps]
  );

  // Frame 0 Clean Board Rule
  const stageEnter = spring({
    frame: frame - Math.max(2, startFrame ?? enterFrame ?? 2),
    fps,
    config: SPRING_PRESETS.snappy,
  });

  if (stageEnter <= 0.005 || beats.length === 0) {
    return null;
  }

  const localFrame = frame - sceneStartFrame;

  // Locate active phrase beat at `localFrame`
  let activeBeatIndex = 0;
  for (let i = 0; i < beats.length; i++) {
    const b = beats[i];
    const nextBeat = beats[i + 1];
    if (localFrame >= b.startFrame - 4) {
      activeBeatIndex = i;
    }
    if (nextBeat && localFrame < nextBeat.startFrame - 4) {
      break;
    }
  }

  const activeBeat = beats[activeBeatIndex];
  const beatEnter = spring({
    frame: Math.max(0, localFrame - (activeBeat.startFrame - 4)),
    fps,
    config: SPRING_PRESETS.snappy,
  });

  // Locate currently spoken word inside `activeBeat`
  let activeWordIdx = -1;
  for (let i = 0; i < activeBeat.words.length; i++) {
    const w = activeBeat.words[i];
    if (localFrame >= w.startFrame - 1 && localFrame <= w.endFrame + 8) {
      activeWordIdx = i;
    }
  }

  const isVertical = height > width;
  const isLight = variant === 'light';
  const textPrimary = isLight
    ? STUDIO_THEME.colors.text.slate900
    : THEME.colors.textPrimary;

  const resolvedFontSize =
    fontSize ?? (isVertical ? 64 : 74);

  // Golden Safe Box bounds in 9:16: x ∈ [40, 910], y ∈ [220, 1380]
  const containerPaddingStyle: React.CSSProperties =
    isVertical && safeBox9x16
      ? {
          paddingLeft: Math.round(44 * (width / 1080)),
          paddingRight: Math.round((1080 - 906) * (width / 1080)),
          paddingTop: Math.round(230 * (height / 1920)),
          paddingBottom: Math.round((1920 - 1370) * (height / 1920)),
        }
      : {
          padding: '72px 120px',
        };

  const beatProgress = interpolate(
    localFrame,
    [activeBeat.startFrame, Math.max(activeBeat.startFrame + 1, activeBeat.endFrame)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor:
          variant === 'dark'
            ? THEME.colors.bgPrimary
            : variant === 'light'
              ? STUDIO_THEME.colors.bgCanvas
              : 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        opacity: stageEnter,
        pointerEvents: 'none',
        ...containerPaddingStyle,
        ...style,
      }}
    >
      <div
        style={{
          maxWidth: isVertical ? 840 : 1420,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
          transform: `translateY(${interpolate(beatEnter, [0, 1], [16, 0]).toFixed(2)}px) scale(${interpolate(stageEnter, [0, 1], [0.95, 1]).toFixed(4)})`,
        }}
      >
        {eyebrow && (
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: isVertical ? 18 : 19,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '8px 18px',
              borderRadius: 9999,
              color: isLight ? accentColor : '#FFFFFF',
              backgroundColor: isLight ? `${accentColor}16` : `${accentColor}33`,
              border: `1.5px solid ${accentColor}66`,
            }}
          >
            {eyebrow}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: isVertical ? '14px 16px' : '16px 22px',
            textAlign: 'center',
          }}
        >
          {activeBeat.words.map((w, idx) => {
            const isCurrent = idx === activeWordIdx;
            const isPast = localFrame > w.endFrame + 8;
            const wordPop = spring({
              frame: Math.max(0, localFrame - w.startFrame),
              fps,
              config: SPRING_PRESETS.micro,
            });
            const scale = isCurrent
              ? interpolate(wordPop, [0, 1], [0.96, 1.07])
              : 1;
            const yShift =
              isCurrent || isPast
                ? 0
                : interpolate(wordPop, [0, 1], [6, 0]);
            const wordOpacity = isCurrent ? 1 : isPast ? 0.94 : 0.38;

            return (
              <span
                key={`${activeBeatIndex}-${idx}-${w.startFrame}`}
                style={{
                  display: 'inline-block',
                  fontFamily: FONTS.display,
                  fontSize: resolvedFontSize,
                  fontWeight: 800,
                  lineHeight: 1.15,
                  letterSpacing: '-0.025em',
                  padding: isCurrent ? '6px 20px' : '6px 8px',
                  borderRadius: 18,
                  color: isCurrent ? '#FFFFFF' : textPrimary,
                  backgroundColor: isCurrent ? accentColor : 'transparent',
                  boxShadow: isCurrent
                    ? `0 14px 36px ${accentColor}66, 0 0 0 2px rgba(255,255,255,0.22) inset`
                    : 'none',
                  opacity: wordOpacity,
                  transform: `translateY(${yShift.toFixed(2)}px) scale(${scale.toFixed(4)})`,
                  textShadow:
                    !isCurrent && variant === 'transparent'
                      ? '0 4px 22px rgba(9, 10, 15, 0.55)'
                      : 'none',
                }}
              >
                {w.word}
              </span>
            );
          })}
        </div>

        {/* Subtle Phrase Progress Indicator */}
        <div
          style={{
            width: isVertical ? 220 : 280,
            height: 5,
            borderRadius: 9999,
            backgroundColor: isLight
              ? 'rgba(15, 23, 42, 0.10)'
              : 'rgba(255, 255, 255, 0.14)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.round(beatProgress * 100)}%`,
              height: '100%',
              borderRadius: 9999,
              backgroundColor: accentColor,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
