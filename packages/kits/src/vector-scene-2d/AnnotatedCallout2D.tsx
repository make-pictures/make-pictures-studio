import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  formatFontFamilyCss,
  getCardChromeStyle,
  getStyleSpringConfig,
  useStudioStyle,
} from '@make-pictures/core';

export interface AnnotatedCallout2DProps {
  target: [number, number];
  labelPosition: [number, number];
  label: string;
  startFrame?: number;
  accentColor?: string;
}

export const AnnotatedCallout2D: React.FC<AnnotatedCallout2DProps> = ({
  target,
  labelPosition,
  label,
  startFrame = 8,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();

  const effectiveStart = Math.max(2, startFrame);
  if (frame < effectiveStart) return null;

  const progress = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(style, 'emphasis'),
  });
  const accent = accentColor ?? style.palette.accentPrimary;

  const [tx, ty] = target;
  const [lx, ly] = labelPosition;
  const dx = lx - tx;
  const dy = ly - ty;
  const lineLen = Math.max(1, Math.hypot(dx, dy));

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', inset: 0 }}
      >
        <circle cx={tx} cy={ty} r={8 * progress} fill={accent} />
        <line
          x1={tx}
          y1={ty}
          x2={lx}
          y2={ly}
          stroke={accent}
          strokeWidth={3}
          strokeDasharray={lineLen}
          strokeDashoffset={lineLen * (1 - progress)}
        />
      </svg>
      <div
        style={getCardChromeStyle(style, {
          boxSizing: 'border-box',
          position: 'absolute',
          left: lx,
          top: ly,
          transform: 'translate(-50%, -50%)',
          padding: '12px 20px',
          opacity: progress,
          fontFamily: formatFontFamilyCss(style.typography.bodyFont, 'body'),
          fontSize: 22,
          fontWeight: 600,
        })}
      >
        {label}
      </div>
    </AbsoluteFill>
  );
};
