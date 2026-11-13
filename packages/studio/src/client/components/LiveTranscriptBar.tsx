import React, { useEffect, useMemo, useRef } from 'react';
import { MessageSquareText } from 'lucide-react';
import {
  getSceneVoiceover,
  type StudioCompositionEntry,
} from '@make-pictures/core';

export interface LiveTranscriptBarProps {
  composition: StudioCompositionEntry;
  currentFrame: number;
  onSeek: (frame: number) => void;
}

interface GlobalWordToken {
  id: string;
  word: string;
  globalStartFrame: number;
  globalEndFrame: number;
  segmentLabel?: string;
  segmentStartFrame?: number;
  isFirstInSegment: boolean;
}

const preventButtonFocus = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.preventDefault();
};

export const LiveTranscriptBar: React.FC<LiveTranscriptBarProps> = ({
  composition,
  currentFrame,
  onSeek,
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const tokens = useMemo<GlobalWordToken[]>(() => {
    const list: GlobalWordToken[] = [];
    const showSegmentLabels = composition.sceneTimeline.length > 1;

    composition.sceneTimeline.forEach((seg, segIdx) => {
      const vo = getSceneVoiceover(seg.sceneId);
      if (!vo || !Array.isArray(vo.words) || vo.words.length === 0) return;

      const segEndBound = seg.fromFrame + seg.durationInFrames;

      vo.words.forEach((w, wordIdx) => {
        const globalStart = seg.fromFrame + w.startFrame;
        if (
          globalStart >= composition.durationInFrames ||
          globalStart >= segEndBound
        ) {
          return;
        }
        const globalEnd = Math.min(
          composition.durationInFrames - 1,
          segEndBound - 1,
          seg.fromFrame + Math.max(w.startFrame, w.endFrame)
        );

        list.push({
          id: `${segIdx}-${seg.sceneId}-${wordIdx}`,
          word: w.word,
          globalStartFrame: globalStart,
          globalEndFrame: globalEnd,
          segmentLabel: showSegmentLabels ? seg.label ?? seg.sceneId : undefined,
          segmentStartFrame: seg.fromFrame,
          isFirstInSegment: wordIdx === 0,
        });
      });
    });

    return list;
  }, [composition]);

  const activeIndex = useMemo<number>(() => {
    let matched = -1;
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (
        currentFrame >= tok.globalStartFrame &&
        currentFrame <= tok.globalEndFrame + 3
      ) {
        matched = i;
      }
    }
    return matched;
  }, [tokens, currentFrame]);

  useEffect(() => {
    if (activeIndex < 0) return;
    const scroller = scrollerRef.current;
    const btn = wordRefs.current.get(activeIndex);
    if (!scroller || !btn) return;

    const targetScrollLeft = Math.max(
      0,
      btn.offsetLeft - scroller.clientWidth * 0.42 + btn.offsetWidth / 2
    );

    if (Math.abs(scroller.scrollLeft - targetScrollLeft) > 36) {
      scroller.scrollTo({
        left: targetScrollLeft,
        behavior: 'smooth',
      });
    }
  }, [activeIndex]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ left: 0 });
  }, [composition.id]);

  return (
    <div
      className="mp-transcript-bar"
      aria-label="Zsynchronizowany transkrypt lektora"
    >
      <div
        className="mp-transcript-label"
        title="Kliknij w dowolne słowo, aby przeskoczyć do dokładnej klatki"
      >
        <MessageSquareText
          size={13}
          style={{ color: 'var(--mp-accent)', flexShrink: 0 }}
        />
        <span>Transkrypt</span>
      </div>

      {tokens.length === 0 ? (
        <span style={{ fontSize: 12, color: 'var(--mp-text-muted)' }}>
          Brak wygenerowanych znaczników słów dla tej kompozycji (uruchom{' '}
          <code
            style={{
              fontFamily: 'var(--mp-font-mono)',
              fontSize: 11,
              padding: '1px 6px',
              borderRadius: 5,
              backgroundColor: 'var(--mp-bg-subtle)',
              border: '0.5px solid var(--mp-border-hairline)',
              color: 'var(--mp-text-secondary)',
            }}
          >
            npx make-pictures audio
          </code>
          ).
        </span>
      ) : (
        <div className="mp-transcript-scroller" ref={scrollerRef}>
          {tokens.map((tok, idx) => {
            const isActive = idx === activeIndex;
            const isPast = !isActive && currentFrame > tok.globalEndFrame + 3;

            return (
              <React.Fragment key={tok.id}>
                {tok.isFirstInSegment && tok.segmentLabel && (
                  <button
                    type="button"
                    className="mp-transcript-seg-tag"
                    onMouseDown={preventButtonFocus}
                    onClick={() =>
                      onSeek(tok.segmentStartFrame ?? tok.globalStartFrame)
                    }
                    title={`Skocz do początku segmentu (f:${
                      tok.segmentStartFrame ?? tok.globalStartFrame
                    })`}
                  >
                    {tok.segmentLabel}
                  </button>
                )}

                <button
                  type="button"
                  ref={(el) => {
                    if (el) {
                      wordRefs.current.set(idx, el);
                    } else {
                      wordRefs.current.delete(idx);
                    }
                  }}
                  className={`mp-word-chip ${isActive ? 'is-active' : ''} ${
                    isPast ? 'is-past' : ''
                  }`}
                  onMouseDown={preventButtonFocus}
                  onClick={() => onSeek(tok.globalStartFrame)}
                  title={`Skocz do klatki f:${tok.globalStartFrame} (${(
                    tok.globalStartFrame / composition.fps
                  ).toFixed(2)}s)`}
                >
                  {tok.word}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};
