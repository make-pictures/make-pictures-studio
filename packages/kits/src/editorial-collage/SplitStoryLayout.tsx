import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  getStyleSpringConfig,
  resolveStyleOptics,
  useStudioStyle,
} from '@make-pictures/core';

export const SplitStorySlotContext = React.createContext<boolean>(false);

export interface SplitStoryLayoutProps {
  primary: React.ReactNode;
  secondary: React.ReactNode;
  startFrame?: number;
  gap?: number;
  /** Optional composition frame at which optical rack focus glides from `primary` to `secondary` */
  focusShiftFrame?: number;
  /** Initial focal behavior before `focusShiftFrame` (`'both'` when omitted unless `focusShiftFrame` is set) */
  initialFocus?: 'both' | 'primary';
}

export function computeSplitStoryVerticalBounds(
  width = 1080,
  height = 1920
): {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
} {
  const scaleX = width / 1080;
  const scaleY = height / 1920;
  return {
    left: Math.round(52 * scaleX),
    top: Math.round(240 * scaleY),
    width: Math.round(840 * scaleX),
    maxHeight: Math.round(1120 * scaleY),
  };
}

export const SplitStoryLayout: React.FC<SplitStoryLayoutProps> = ({
  primary,
  secondary,
  startFrame = 2,
  gap = 40,
  focusShiftFrame,
  initialFocus,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const optics = resolveStyleOptics(style);
  const isVertical = height > width;

  if (frame < Math.max(2, startFrame)) return null;

  const mode =
    initialFocus ?? (typeof focusShiftFrame === 'number' ? 'primary' : 'both');

  const shiftProgress =
    typeof focusShiftFrame === 'number' && frame >= focusShiftFrame
      ? spring({
          frame: frame - focusShiftFrame,
          fps,
          config: getStyleSpringConfig(style, 'camera'),
        })
      : 0;

  const maxBlur = Math.max(1.8, optics.aperture * 7.5);
  const primaryBlur =
    mode === 'both' ? 0 : interpolate(shiftProgress, [0, 1], [0, maxBlur]);
  const secondaryBlur =
    mode === 'both' ? 0 : interpolate(shiftProgress, [0, 1], [maxBlur, 0]);

  const primaryStyle: React.CSSProperties = {
    minWidth: 0,
    filter: primaryBlur < 0.25 ? 'none' : `blur(${primaryBlur.toFixed(2)}px)`,
    opacity:
      mode === 'both' ? 1 : interpolate(shiftProgress, [0, 1], [1, 0.82]),
    transform:
      mode === 'both'
        ? undefined
        : `scale(${interpolate(shiftProgress, [0, 1], [1, 0.985]).toFixed(4)})`,
    transformOrigin: 'center center',
  };

  const secondaryStyle: React.CSSProperties = {
    minWidth: 0,
    filter:
      secondaryBlur < 0.25 ? 'none' : `blur(${secondaryBlur.toFixed(2)}px)`,
    opacity:
      mode === 'both' ? 1 : interpolate(shiftProgress, [0, 1], [0.82, 1]),
    transform:
      mode === 'both'
        ? undefined
        : `scale(${interpolate(shiftProgress, [0, 1], [0.985, 1]).toFixed(4)})`,
    transformOrigin: 'center center',
  };

  if (isVertical) {
    // Strictly inside 9:16 Golden Safe Box: x in [40, 910], y in [220, 1380]
    const bounds = computeSplitStoryVerticalBounds(width, height);
    return (
      <SplitStorySlotContext.Provider value={true}>
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
          <div
            style={{
              position: 'absolute',
              left: bounds.left,
              top: bounds.top,
              width: bounds.width,
              maxHeight: bounds.maxHeight,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: 28,
            }}
          >
            <div style={primaryStyle}>{primary}</div>
            <div style={secondaryStyle}>{secondary}</div>
          </div>
        </AbsoluteFill>
      </SplitStorySlotContext.Provider>
    );
  }

  return (
    <SplitStorySlotContext.Provider value={true}>
      <AbsoluteFill
        style={{
          boxSizing: 'border-box',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '96px 120px',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 1640,
            display: 'grid',
            gridTemplateColumns: '1.08fr 0.92fr',
            gap,
            alignItems: 'center',
          }}
        >
          <div style={primaryStyle}>{primary}</div>
          <div style={secondaryStyle}>{secondary}</div>
        </div>
      </AbsoluteFill>
    </SplitStorySlotContext.Provider>
  );
};
