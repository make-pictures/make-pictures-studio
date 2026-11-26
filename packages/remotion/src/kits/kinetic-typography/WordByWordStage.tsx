import React, { useMemo } from 'react';
import { FillLayer } from '../../FillLayer';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  SPRING_PRESETS,
  formatFontFamilyCss,
  formatHeadingText,
  getSceneVoiceover,
  getStyleSpringConfig,
  resolveStyleOptics,
  useStudioFontsReady,
  useStudioStyle,
  type SceneVoiceoverData,
  type StyleTypographyGrammar,
  type WordTimestamp,
} from "../..";

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
  /** Typographic choreography grammar (defaults to `studioStyle.optics.typographyGrammar`) */
  grammar?: StyleTypographyGrammar;
  /** Primary accent color (defaults to `studioStyle.palette.accentPrimary`) */
  accentColor?: string;
  /** Surface styling mode (`'transparent'` overlays 2D/3D stage cleanly) */
  variant?: 'dark' | 'light' | 'transparent';
  /** Optional editorial index / category label */
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
  const usableSpan = Math.max(
    tokens.length * 6,
    durationInFrames - usableStart - 16
  );
  const perWord = usableSpan / tokens.length;

  return tokens.map((token, idx) => {
    const sf = Math.round(usableStart + idx * perWord);
    const ef = Math.max(
      sf + 4,
      Math.round(usableStart + (idx + 0.86) * perWord)
    );
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
      startFrame: bucket[0]!.startFrame,
      endFrame: bucket[bucket.length - 1]!.endFrame,
    });
    bucket = [];
  };

  for (let i = 0; i < words.length; i++) {
    const curr = words[i]!;
    const prev = bucket[bucket.length - 1];

    if (
      prev &&
      curr.startFrame - prev.endFrame >= pauseThresholdFrames &&
      bucket.length >= 2
    ) {
      flush();
    }

    bucket.push(curr);

    const endsSentence = /[.!?;:—]$/.test(curr.word);
    const endsClause = /[,–]$/.test(curr.word) && bucket.length >= 3;

    if (
      bucket.length >= maxWords ||
      (endsSentence && bucket.length >= 2) ||
      endsClause
    ) {
      flush();
    }
  }

  flush();
  return beats;
}

/**
 * Polymorphic 60 FPS Film Typography stage (`swiss-spatial`, `optical-gate`, `risograph-poster`).
 * Syncs multi-beat phrase depth, rack focus, and ink/gate/cutout emphasis directly to `WordTimestamp[]`.
 */
export const WordByWordStage: React.FC<WordByWordStageProps> = ({
  words,
  sceneId,
  voiceoverManifest,
  fallbackText,
  sceneStartFrame = 0,
  wordsPerBeat = 4,
  grammar,
  accentColor,
  variant,
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
  const studioStyle = useStudioStyle();
  const optics = resolveStyleOptics(studioStyle);
  const resolvedGrammar = grammar ?? optics.typographyGrammar;

  const resolvedAccent = accentColor ?? studioStyle.palette.accentPrimary;
  const secondaryAccent = studioStyle.palette.accentSecondary;
  const displayFontCss = formatFontFamilyCss(
    studioStyle.typography.displayFont,
    'display'
  );
  const monoFontCss = formatFontFamilyCss(
    studioStyle.typography.monoFont,
    'mono'
  );
  const enterSpring = getStyleSpringConfig(studioStyle, 'enter');

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

  const effectiveStart = Math.max(2, startFrame ?? enterFrame ?? 2);
  if (frame < effectiveStart || beats.length === 0) {
    return null;
  }

  const stageEnter = spring({
    frame: frame - effectiveStart,
    fps,
    config: enterSpring,
  });
  if (stageEnter <= 0.005) {
    return null;
  }

  const localFrame = frame - sceneStartFrame;

  let activeBeatIndex = 0;
  for (let i = 0; i < beats.length; i++) {
    const b = beats[i]!;
    const nextB = beats[i + 1];
    if (localFrame >= b.startFrame - 4) {
      activeBeatIndex = i;
    }
    if (nextB && localFrame < nextB.startFrame - 4) {
      break;
    }
  }

  const prevBeat = activeBeatIndex > 0 ? beats[activeBeatIndex - 1] : undefined;
  const activeBeat = beats[activeBeatIndex]!;
  const nextBeat =
    activeBeatIndex + 1 < beats.length ? beats[activeBeatIndex + 1] : undefined;

  const framesIntoBeat = Math.max(0, localFrame - (activeBeat.startFrame - 4));
  const beatEnter = spring({
    frame: framesIntoBeat,
    fps,
    config: enterSpring,
  });

  let activeWordIdx = -1;
  for (let i = 0; i < activeBeat.words.length; i++) {
    const w = activeBeat.words[i]!;
    if (localFrame >= w.startFrame - 1 && localFrame <= w.endFrame + 8) {
      activeWordIdx = i;
    }
  }

  const isVertical = height > width;
  const textPrimary =
    variant === 'dark'
      ? '#F8FAFC'
      : variant === 'light'
        ? studioStyle.surface.isDark
          ? '#0F172A'
          : studioStyle.palette.textPrimary
        : studioStyle.palette.textPrimary;

  const textSecondary =
    variant === 'dark'
      ? '#94A3B8'
      : studioStyle.palette.textSecondary;

  const resolvedBg =
    variant === 'dark'
      ? '#090A0F'
      : variant === 'light'
        ? studioStyle.palette.bgCanvas
        : 'transparent';

  const resolvedFontSize = fontSize ?? (isVertical ? 64 : 78);

  // Golden Safe Box bounds in 9:16: x ∈ [40, 910], y ∈ [220, 1380]
  const containerPaddingStyle: React.CSSProperties =
    isVertical && safeBox9x16
      ? {
          paddingLeft: Math.round(52 * (width / 1080)),
          paddingRight: Math.round((1080 - 900) * (width / 1080)),
          paddingTop: Math.round(236 * (height / 1920)),
          paddingBottom: Math.round((1920 - 1364) * (height / 1920)),
        }
      : {
          padding: '84px 140px',
        };

  const beatCounterStr = String(activeBeatIndex + 1).padStart(2, '0');
  const totalBeatsStr = String(beats.length).padStart(2, '0');

  const renderNeighborLine = (
    beat: WordPhraseBeat | undefined,
    position: 'prev' | 'next'
  ) => {
    if (!beat) return null;
    const text = beat.words
      .map((w) => formatHeadingText(w.word, studioStyle))
      .join(' ');
    const blurPx = Math.max(2.6, optics.aperture * 8.5);
    return (
      <div
        aria-hidden="true"
        style={{
          fontFamily: displayFontCss,
          fontSize: Math.round(resolvedFontSize * 0.54),
          fontWeight: 600,
          lineHeight: 1.15,
          letterSpacing: `${studioStyle.typography.displayTrackingEm}em`,
          color: textSecondary,
          opacity: position === 'prev' ? 0.28 : 0.18,
          filter: `blur(${blurPx.toFixed(2)}px)`,
          transform: `translateY(${position === 'prev' ? -4 : 4}px)`,
          userSelect: 'none',
        }}
      >
        {text}
      </div>
    );
  };

  // 1. SWISS-SPATIAL GRAMMAR (Editorial Column + Rack-Focus Context + Ink Rule)
  if (resolvedGrammar === 'swiss-spatial') {
    return (
      <FillLayer
        data-typography-grammar="swiss-spatial"
        style={{
          backgroundColor: resolvedBg,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          boxSizing: 'border-box',
          opacity: stageEnter,
          pointerEvents: 'none',
          ...containerPaddingStyle,
          ...style,
        }}
      >
        <div
          style={{
            position: 'relative',
            maxWidth: isVertical ? 816 : 1380,
            width: '100%',
            paddingLeft: isVertical ? 28 : 42,
            borderLeft: `2px solid ${studioStyle.palette.inkBorder}`,
            display: 'flex',
            flexDirection: 'column',
            gap: isVertical ? 18 : 22,
          }}
        >
          {/* Active accent cursor along the Swiss column rule */}
          <div
            style={{
              position: 'absolute',
              left: -2.5,
              top: 0,
              width: 3,
              height: Math.round(68 * beatEnter),
              backgroundColor: resolvedAccent,
            }}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              fontFamily: monoFontCss,
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: textSecondary,
            }}
          >
            <span style={{ color: resolvedAccent, fontWeight: 700 }}>
              {beatCounterStr}/{totalBeatsStr}
            </span>
            {eyebrow ? (
              <>
                <span>—</span>
                <span>{eyebrow}</span>
              </>
            ) : null}
          </div>

          {renderNeighborLine(prevBeat, 'prev')}

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              gap: isVertical ? '10px 18px' : '12px 24px',
              filter: 'none',
              transform: `translateY(${interpolate(beatEnter, [0, 1], [18, 0]).toFixed(2)}px)`,
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
              const ruleScale = isCurrent ? wordPop : 0;

              return (
                <span
                  key={`${activeBeatIndex}-${idx}-${w.startFrame}`}
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    fontFamily: displayFontCss,
                    fontSize: resolvedFontSize,
                    fontWeight: 700,
                    lineHeight: 1.08,
                    letterSpacing: `${studioStyle.typography.displayTrackingEm}em`,
                    color: isCurrent ? resolvedAccent : textPrimary,
                    opacity: isCurrent ? 1 : isPast ? 0.92 : 0.42,
                    transform: `translateY(${interpolate(wordPop, [0, 1], [8, 0]).toFixed(2)}px)`,
                  }}
                >
                  {formatHeadingText(w.word, studioStyle)}
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: -4,
                      height: 4,
                      backgroundColor: resolvedAccent,
                      transformOrigin: 'left center',
                      transform: `scaleX(${ruleScale.toFixed(4)})`,
                    }}
                  />
                </span>
              );
            })}
          </div>

          {renderNeighborLine(nextBeat, 'next')}
        </div>
      </FillLayer>
    );
  }

  // 2. OPTICAL-GATE GRAMMAR (35mm Reticle Gate + Drum Step + Chromatic Impulse)
  if (resolvedGrammar === 'optical-gate') {
    const gateFlash = Math.max(0, 1 - framesIntoBeat / 12);
    const chromaPx = Number((gateFlash * (1.8 + optics.halation * 3.4)).toFixed(2));
    const gateBlur = gateFlash * 1.6;

    return (
      <FillLayer
        data-typography-grammar="optical-gate"
        style={{
          backgroundColor: resolvedBg,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          boxSizing: 'border-box',
          opacity: stageEnter,
          pointerEvents: 'none',
          ...containerPaddingStyle,
          ...style,
        }}
      >
        <div
          style={{
            position: 'relative',
            maxWidth: isVertical ? 820 : 1380,
            width: '100%',
            padding: isVertical ? '36px 28px' : '48px 56px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
          }}
        >
          {/* Optical Gate Corner Reticles */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              opacity: 0.65,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 20,
                height: 20,
                borderTop: `2px solid ${resolvedAccent}`,
                borderLeft: `2px solid ${resolvedAccent}`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 20,
                height: 20,
                borderTop: `2px solid ${resolvedAccent}`,
                borderRight: `2px solid ${resolvedAccent}`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: 20,
                height: 20,
                borderBottom: `2px solid ${resolvedAccent}`,
                borderLeft: `2px solid ${resolvedAccent}`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 20,
                height: 20,
                borderBottom: `2px solid ${resolvedAccent}`,
                borderRight: `2px solid ${resolvedAccent}`,
              }}
            />
          </div>

          <div
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontFamily: monoFontCss,
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: textSecondary,
            }}
          >
            <span>{eyebrow ?? 'GATE 35MM'}</span>
            <span style={{ color: resolvedAccent }}>
              BEAT {beatCounterStr}/{totalBeatsStr} • F:{String(frame).padStart(4, '0')}
            </span>
          </div>

          {renderNeighborLine(prevBeat, 'prev')}

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              alignItems: 'center',
              gap: isVertical ? '12px 18px' : '14px 24px',
              textAlign: 'center',
              filter: gateBlur < 0.25 ? 'none' : `blur(${gateBlur.toFixed(2)}px)`,
              transform: `translateY(${interpolate(beatEnter, [0, 1], [22, 0]).toFixed(2)}px)`,
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

              const halationGlow =
                isCurrent && optics.halation > 0.05
                  ? `0 0 ${Math.round(16 + optics.halation * 28)}px ${resolvedAccent}88`
                  : '';
              const dispersionShadow =
                chromaPx > 0.15
                  ? `${-chromaPx}px 0 0 ${resolvedAccent}AA, ${chromaPx}px 0 0 ${secondaryAccent}AA`
                  : '';
              const combinedShadow = [halationGlow, dispersionShadow]
                .filter(Boolean)
                .join(', ');

              return (
                <span
                  key={`${activeBeatIndex}-${idx}-${w.startFrame}`}
                  style={{
                    display: 'inline-block',
                    fontFamily: displayFontCss,
                    fontSize: resolvedFontSize,
                    fontWeight: 800,
                    lineHeight: 1.1,
                    letterSpacing: `${studioStyle.typography.displayTrackingEm}em`,
                    color: isCurrent ? resolvedAccent : textPrimary,
                    opacity: isCurrent ? 1 : isPast ? 0.88 : 0.36,
                    textShadow: combinedShadow || 'none',
                    transform: `scale(${(isCurrent ? interpolate(wordPop, [0, 1], [0.97, 1.045]) : 1).toFixed(4)})`,
                  }}
                >
                  {formatHeadingText(w.word, studioStyle)}
                </span>
              );
            })}
          </div>

          {renderNeighborLine(nextBeat, 'next')}
        </div>
      </FillLayer>
    );
  }

  // 3. RISOGRAPH-POSTER GRAMMAR (Cut Poster + Alternating Tilt + Ink Misregistration)
  const posterTiltDeg = (activeBeatIndex % 2 === 0 ? -1.1 : 1.1) * beatEnter;

  return (
    <FillLayer
      data-typography-grammar="risograph-poster"
      style={{
        backgroundColor: resolvedBg,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        boxSizing: 'border-box',
        opacity: stageEnter,
        pointerEvents: 'none',
        ...containerPaddingStyle,
        ...style,
      }}
    >
      <div
        style={{
          maxWidth: isVertical ? 808 : 1380,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 18,
          transformOrigin: 'center center',
          transform: `rotate(${posterTiltDeg.toFixed(2)}deg) translateY(${interpolate(beatEnter, [0, 1], [20, 0]).toFixed(2)}px)`,
        }}
      >
        {eyebrow ? (
          <div
            style={{
              fontFamily: monoFontCss,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              padding: '5px 12px',
              backgroundColor: studioStyle.palette.bgElevated,
              color: textPrimary,
              border: `2px solid ${studioStyle.palette.inkBorder}`,
              boxShadow: `3px 3px 0px ${studioStyle.palette.inkBorder}`,
            }}
          >
            {eyebrow} • {beatCounterStr}
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: isVertical ? '12px 14px' : '14px 20px',
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

            return (
              <span
                key={`${activeBeatIndex}-${idx}-${w.startFrame}`}
                style={{
                  display: 'inline-block',
                  fontFamily: displayFontCss,
                  fontSize: resolvedFontSize,
                  fontWeight: 800,
                  lineHeight: 1.06,
                  letterSpacing: `${studioStyle.typography.displayTrackingEm}em`,
                  padding: isCurrent ? '4px 14px' : '4px 4px',
                  borderRadius: 0,
                  color: isCurrent ? '#FFFFFF' : textPrimary,
                  backgroundColor: isCurrent ? resolvedAccent : 'transparent',
                  border: isCurrent
                    ? `2px solid ${studioStyle.palette.inkBorder}`
                    : '2px solid transparent',
                  boxShadow: isCurrent ? `4px 3px 0px ${secondaryAccent}` : 'none',
                  textShadow: !isCurrent
                    ? `1.5px 1px 0px ${secondaryAccent}33`
                    : 'none',
                  opacity: isCurrent ? 1 : isPast ? 0.94 : 0.44,
                  transform: `scale(${(isCurrent ? interpolate(wordPop, [0, 1], [0.96, 1.04]) : 1).toFixed(4)})`,
                }}
              >
                {formatHeadingText(w.word, studioStyle)}
              </span>
            );
          })}
        </div>
      </div>
    </FillLayer>
  );
};
