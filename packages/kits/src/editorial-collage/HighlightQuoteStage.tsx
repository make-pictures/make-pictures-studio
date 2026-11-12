import React, { useContext } from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  formatFontFamilyCss,
  getCardChromeStyle,
  getStyleSpringConfig,
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

  const renderQuoteWithHighlight = () => {
    if (!highlightPhrase || !quote.includes(highlightPhrase)) {
      return quote;
    }
    const idx = quote.indexOf(highlightPhrase);
    const before = quote.slice(0, idx);
    const after = quote.slice(idx + highlightPhrase.length);
    return (
      <>
        {before}
        <span
          style={{
            backgroundImage: `linear-gradient(120deg, ${style.palette.accentPrimary}38 0%, ${style.palette.accentPrimary}38 100%)`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: `${Math.round(markSweep * 100)}% 88%`,
            backgroundPosition: '0 82%',
            padding: '0 6px',
          }}
        >
          {highlightPhrase}
        </span>
        {after}
      </>
    );
  };

  const quoteCard = (
    <div
      style={getCardChromeStyle(style, {
        boxSizing: 'border-box',
        width: isEmbedded ? '100%' : undefined,
        maxWidth: isEmbedded ? undefined : isVertical ? 830 : 1220,
        padding: isEmbedded
          ? isVertical
            ? '32px 36px'
            : '40px 48px'
          : isVertical
            ? '42px 44px'
            : '54px 64px',
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [24, 0])}px)`,
        ...styleOverrides,
      })}
    >
      <div
        style={{
          fontFamily: formatFontFamilyCss(
            style.typography.displayFont,
            'display'
          ),
          fontSize: isEmbedded
            ? isVertical
              ? 36
              : 44
            : isVertical
              ? 48
              : 58,
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
            marginTop: isEmbedded ? 20 : 26,
            fontFamily: formatFontFamilyCss(style.typography.monoFont, 'mono'),
            fontSize: isEmbedded ? 19 : 21,
            fontWeight: 600,
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
        paddingRight: isVertical ? 186 : 160,
        paddingTop: isVertical ? 300 : 0,
        pointerEvents: 'none',
      }}
    >
      {quoteCard}
    </AbsoluteFill>
  );
};
