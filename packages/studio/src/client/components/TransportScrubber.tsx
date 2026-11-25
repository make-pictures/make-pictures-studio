import React, { useEffect, useRef } from 'react';
import type { SubscribeFrame } from '../hooks/useRemotionPlayer';

export interface TransportScrubberProps {
  resetKey: string;
  fps: number;
  maxFrameIndex: number;
  ariaLabel: string;
  getFrame: () => number;
  subscribeFrame: SubscribeFrame;
  onScrub: (frame: number) => void;
}

export function formatStudioTimecode(frame: number, fps: number): string {
  const safeFps = fps > 0 ? fps : 60;
  const totalSec = Math.max(0, frame) / safeFps;
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  const hundredths = Math.floor((totalSec - Math.floor(totalSec)) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(
    2,
    '0'
  )}.${String(hundredths).padStart(2, '0')}`;
}

function formatScrubberLabel(
  frame: number,
  fps: number,
  maxFrameIndex: number
): string {
  return `${formatStudioTimecode(frame, fps)} • f:${frame}/${maxFrameIndex}`;
}

/**
 * Isolated 60 FPS transport scrubber & tabular timecode pill.
 * Subscribes directly to `useRemotionPlayer`'s imperative frame stream and mutates
 * the range input value + timecode text node via refs so playback triggers ZERO
 * React re-renders in `StageViewport`, `StyleLabShowcase`, or `<Player />`.
 */
export const TransportScrubber: React.FC<TransportScrubberProps> = React.memo(
  ({
    resetKey,
    fps,
    maxFrameIndex,
    ariaLabel,
    getFrame,
    subscribeFrame,
    onScrub,
  }) => {
    const rangeRef = useRef<HTMLInputElement>(null);
    const timecodeRef = useRef<HTMLSpanElement>(null);

    const safeMax = Math.max(0, maxFrameIndex);
    const sliderMax = Math.max(1, safeMax);
    const initialFrame = Math.min(Math.max(0, Math.round(getFrame())), safeMax);

    useEffect(() => {
      const applyFrame = (rawFrame: number) => {
        const clamped = Math.min(Math.max(0, Math.round(rawFrame)), safeMax);
        const input = rangeRef.current;
        if (input) {
          const nextValue = String(clamped);
          if (input.value !== nextValue) {
            input.value = nextValue;
          }
        }
        const pill = timecodeRef.current;
        if (pill) {
          pill.textContent = formatScrubberLabel(clamped, fps, safeMax);
        }
      };

      applyFrame(getFrame());
      return subscribeFrame(applyFrame);
    }, [resetKey, fps, safeMax, getFrame, subscribeFrame]);

    return (
      <div className="mp-scrubber-wrap">
        <input
          ref={rangeRef}
          type="range"
          className="mp-timeline-slider"
          min={0}
          max={sliderMax}
          defaultValue={initialFrame}
          aria-label={ariaLabel}
          onChange={(e) => {
            onScrub(Number(e.target.value));
          }}
        />
        <span ref={timecodeRef} className="mp-timecode-pill mp-tabular">
          {formatScrubberLabel(initialFrame, fps, safeMax)}
        </span>
      </div>
    );
  }
);

TransportScrubber.displayName = 'TransportScrubber';
