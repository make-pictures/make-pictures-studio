import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

export const SplitStorySlotContext = React.createContext<boolean>(false);

export interface SplitStoryLayoutProps {
  primary: React.ReactNode;
  secondary: React.ReactNode;
  startFrame?: number;
  gap?: number;
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
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isVertical = height > width;

  if (frame < Math.max(2, startFrame)) return null;

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
            <div style={{ minWidth: 0 }}>{primary}</div>
            <div style={{ minWidth: 0 }}>{secondary}</div>
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
          <div style={{ minWidth: 0 }}>{primary}</div>
          <div style={{ minWidth: 0 }}>{secondary}</div>
        </div>
      </AbsoluteFill>
    </SplitStorySlotContext.Provider>
  );
};
