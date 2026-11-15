import React, { useContext } from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  createSeededRandom,
  formatFontFamilyCss,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioStyle,
  type WordTimestamp,
} from '@make-pictures/core';
import { SplitStorySlotContext } from './SplitStoryLayout';

export interface HighlightQuoteStageProps {
  quote: string;
  highlightPhrase?: string;
  author?: string;
  startFrame?: number;
  highlightFrame?: number;
  words?: ReadonlyArray<WordTimestamp>;
  embedded?: boolean;
  styleOverrides?: React.CSSProperties;
}

export function resolveHighlightStartFrame(params: {
  effectiveStart: number;
  highlightFrame: number;
  highlightPhrase?: string;
  words?: ReadonlyArray<WordTimestamp>;
}): number {
  const { effectiveStart, highlightFrame, highlightPhrase, words } = params;
  if (highlightPhrase && words && words.length > 0) {
    const firstToken = highlightPhrase
      .trim()
      .split(/\s+/)[0]
      ?.toLocaleLowerCase('pl-PL')
      .replace(/[^\p{L}\p{N}]+/gu, '');
    if (firstToken) {
      const matched = words.find(
        (w) => w.normalizedWord.toLocaleLowerCase('pl-PL') === firstToken
      );
      if (matched) return Math.max(effectiveStart + 4, matched.startFrame);
    }
  }
  return Math.max(effectiveStart + 8, highlightFrame);
}

export const HighlightQuoteStage: React.FC<HighlightQuoteStageProps> = ({
  quote,
  highlightPhrase,
  author,
  startFrame = 2,
  highlightFrame = 26,
  words,
  embedded,
  styleOverrides,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const optics = resolveStyleOptics(style);
  const inSplitSlot = useContext(SplitStorySlotContext);
  const isEmbedded = embedded ?? inSplitSlot;
  const isVertical = height > width;

  const effectiveStart = Math.max(2, startFrame);
  if (frame < effectiveStart) return null;

  const enter = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });

  const resolvedHighlightFrame = resolveHighlightStartFrame({
    effectiveStart,
    highlightFrame,
    highlightPhrase,
    words,
  });

  const markSweep =
    frame < resolvedHighlightFrame
      ? 0
      : spring({
          frame: frame - resolvedHighlightFrame,
          fps,
          config: getStyleSpringConfig(style, 'emphasis'),
        });

  const seededTilt =
    optics.lightingRig === 'studio-macro'
      ? 0
      : Number(
          ((createSeededRandom(`quote:${quote}`)() - 0.5) * 1.1).toFixed(2)
        );

  const renderQuoteWithHighlight = () => {
    if (!highlightPhrase || !quote.includes(highlightPhrase)) {
      return quote;
    }
    const idx = quote.indexOf(highlightPhrase);
    const before = quote.slice(0, idx);
    const after = quote.slice(idx + highlightPhrase.length);
    const isDark = style.surface.isDark;

    return (
      <>
        {before}
        <span
          style={{
            position: 'relative',
            display: 'inline-block',
            padding: '0 6px',
            textShadow:
              isDark && markSweep > 0.05
                ? `0 0 ${Math.round(14 + optics.halation * 24)}px ${style.palette.accentPrimary}88`
                : 'none',
          }}
        >
          <svg
            data-ink-brush="true"
            viewBox="0 0 220 38"
            preserveAspectRatio="none"
            style={{
              position: 'absolute',
              left: -2,
              right: -2,
              bottom: 1,
              width: 'calc(100% + 4px)',
              height: isDark ? '34%' : '56%',
              transformOrigin: 'left center',
              transform: `scaleX(${markSweep.toFixed(4)})`,
              mixBlendMode: isDark ? 'screen' : 'multiply',
              pointerEvents: 'none',
            }}
          >
            <path
              d="M3,20 C44,10 112,14 217,12 C219,21 215,31 211,32 C138,34 58,31 2,33 Z"
              fill={style.palette.accentPrimary}
              opacity={isDark ? 0.52 : 0.28}
            />
          </svg>
          <span style={{ position: 'relative' }}>{highlightPhrase}</span>
        </span>
        {after}
      </>
    );
  };

  const translateY = interpolate(enter, [0, 1], [22, 0]);
  const quoteCard = (
    <div
      style={getTactileSurfaceStyle(style, {
        elevation: isEmbedded ? 'resting' : 'lifted',
        tiltDeg: isEmbedded ? 0 : seededTilt,
        overrides: {
          position: 'relative',
          boxSizing: 'border-box',
          width: isEmbedded ? '100%' : undefined,
          maxWidth: isEmbedded ? undefined : isVertical ? 824 : 1220,
          padding: isEmbedded
            ? isVertical
              ? '30px 34px 30px 42px'
              : '38px 46px 38px 54px'
            : isVertical
              ? '40px 42px 40px 52px'
              : '52px 62px 52px 72px',
          borderRadius: Math.max(0, Math.round(6 * style.surface.radiusScale)),
          opacity: enter,
          transform: `translateY(${translateY.toFixed(2)}px)`,
          ...styleOverrides,
        },
      })}
    >
      {/* Editorial Margin Column Hairline + Accent Lead */}
      <div
        style={{
          position: 'absolute',
          left: isEmbedded ? 18 : 26,
          top: 24,
          bottom: 24,
          width: 2,
          backgroundColor: style.palette.inkBorder,
        }}
      >
        <div
          style={{
            width: 3,
            height: `${Math.round(enter * 44)}%`,
            backgroundColor: style.palette.accentPrimary,
          }}
        />
      </div>

      <div
        style={{
          fontFamily: formatFontFamilyCss(
            style.typography.displayFont,
            'display'
          ),
          fontSize: isEmbedded
            ? isVertical
              ? 35
              : 42
            : isVertical
              ? 46
              : 56,
          fontWeight: 600,
          lineHeight: 1.24,
          color: style.palette.textPrimary,
        }}
      >
        „{renderQuoteWithHighlight()}”
      </div>
      {author ? (
        <div
          style={{
            marginTop: isEmbedded ? 18 : 24,
            fontFamily: formatFontFamilyCss(style.typography.monoFont, 'mono'),
            fontSize: isEmbedded ? 17 : 19,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: style.palette.textSecondary,
          }}
        >
          — {author}
        </div>
      ) : null}
    </div>
  );

  if (isEmbedded) {
    return quoteCard;
  }

  return (
    <AbsoluteFill
      style={{
        boxSizing: 'border-box',
        justifyContent: isVertical ? 'flex-start' : 'center',
        alignItems: isVertical ? 'flex-start' : 'center',
        paddingLeft: isVertical ? 56 : 160,
        paddingRight: isVertical ? 190 : 160,
        paddingTop: isVertical ? 300 : 0,
        pointerEvents: 'none',
      }}
    >
      {quoteCard}
    </AbsoluteFill>
  );
};
