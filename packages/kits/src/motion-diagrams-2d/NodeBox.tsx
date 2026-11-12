import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  SPRING_PRESETS,
  STUDIO_THEME,
  THEME,
  formatFontFamilyCss,
  getCardChromeStyle,
  useStudioStyle,
} from '@make-pictures/core';

/**
 * Single Source of Truth for node coordinates on the 2D canvas.
 * Use `portTop`, `portBottom`, `portLeft`, and `portRight` to connect SVG edges
 * mathematically to card borders without manual coordinate guessing.
 */
export interface NodeBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export const portRight = (n: NodeBox, dy = 0) => ({
  x: n.cx + n.w / 2,
  y: n.cy + dy,
});

export const portLeft = (n: NodeBox, dy = 0) => ({
  x: n.cx - n.w / 2,
  y: n.cy + dy,
});

export const portTop = (n: NodeBox, dx = 0) => ({
  x: n.cx + dx,
  y: n.cy - n.h / 2,
});

export const portBottom = (n: NodeBox, dx = 0) => ({
  x: n.cx + dx,
  y: n.cy + n.h / 2,
});

export interface WorldBoxProps {
  node: NodeBox;
  scale?: number;
  opacity?: number;
  zIndex?: number;
  /** Optional explicit surface variant (`'transparent'` | `'dark'` | `'light'`); inherits `StylePreset` card chrome when omitted */
  variant?: 'card' | 'transparent' | 'dark' | 'light';
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const WorldBox: React.FC<WorldBoxProps> = ({
  node,
  scale = 1,
  opacity = 1,
  zIndex = 2,
  variant,
  style,
  children,
}) => {
  const studioStyle = useStudioStyle();
  const bodyFontCss = formatFontFamilyCss(
    studioStyle.typography.bodyFont,
    'body'
  );

  let chromeStyle: React.CSSProperties;
  if (variant === 'transparent') {
    chromeStyle = {
      backgroundColor: 'transparent',
      color: studioStyle.palette.textPrimary,
    };
  } else if (variant === 'dark') {
    chromeStyle = {
      backgroundColor: 'rgba(13, 15, 26, 0.90)',
      color: THEME.colors.textPrimary,
      border: '1.5px solid rgba(255, 255, 255, 0.12)',
      borderRadius: 24,
      boxShadow: THEME.shadows.card,
    };
  } else if (variant === 'light') {
    chromeStyle = {
      backgroundColor: STUDIO_THEME.colors.bgSurface,
      color: STUDIO_THEME.colors.text.primary,
      border: `1.5px solid ${STUDIO_THEME.colors.border.subtle}`,
      borderRadius: 24,
      boxShadow: STUDIO_THEME.shadows.cardElevated,
    };
  } else {
    chromeStyle = getCardChromeStyle(studioStyle);
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: node.cx - node.w / 2,
        top: node.cy - node.h / 2,
        width: node.w,
        height: node.h,
        boxSizing: 'border-box',
        transformOrigin: 'center center',
        transform: `scale(${scale})`,
        opacity,
        zIndex,
        fontFamily: bodyFontCss,
        ...chromeStyle,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export interface FlowCurveProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** Vertical arch offset for horizontal connections */
  curveY?: number;
  /** Horizontal detour arch offset for vertical connections (e.g. bypassing section headers) */
  curveX?: number;
  orientation?: 'horizontal' | 'vertical';
  color?: string;
  activeFromFrame: number;
  /** Packet traversal time in frames @ 60 FPS (recommended: 92..120 frames) */
  packetSpeedFrames?: number;
  packetCount?: number;
  strokeWidth?: number;
  dashed?: boolean;
  blocked?: boolean;
}

/**
 * Animated SVG Bézier connection line with mathematical port terminals
 * and smooth 60 FPS data packet flow.
 */
export const FlowCurve: React.FC<FlowCurveProps> = ({
  from,
  to,
  curveY = 0,
  curveX = 0,
  orientation = 'horizontal',
  color,
  activeFromFrame,
  packetSpeedFrames = 100,
  packetCount = 2,
  strokeWidth = 4,
  dashed = false,
  blocked = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const studioStyle = useStudioStyle();
  const resolvedColor = color ?? studioStyle.palette.accentPrimary;
  const terminalFill = studioStyle.palette.bgSurface;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const p0 = from;
  const p1 =
    orientation === 'vertical'
      ? { x: from.x + curveX, y: from.y + dy * 0.45 }
      : { x: from.x + dx * 0.4, y: from.y + curveY };
  const p2 =
    orientation === 'vertical'
      ? { x: to.x + curveX, y: to.y - dy * 0.45 }
      : { x: from.x + dx * 0.6, y: to.y + curveY };
  const p3 = to;

  const d = `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;

  const drawProgress = spring({
    frame: frame - activeFromFrame,
    fps,
    config: SPRING_PRESETS.smooth,
  });

  if (drawProgress <= 0.01) return null;

  const evalBezier = (t: number) => {
    const u = 1 - t;
    return {
      x:
        u * u * u * p0.x +
        3 * u * u * t * p1.x +
        3 * u * t * t * p2.x +
        t * t * t * p3.x,
      y:
        u * u * u * p0.y +
        3 * u * u * t * p1.y +
        3 * u * t * t * p2.y +
        t * t * t * p3.y,
    };
  };

  const packets: Array<{ x: number; y: number; alpha: number }> = [];
  if (!blocked && frame >= activeFromFrame + 10) {
    for (let i = 0; i < packetCount; i++) {
      const offset = (i / packetCount) * packetSpeedFrames;
      const elapsed = frame - (activeFromFrame + 10) - offset;
      if (elapsed < 0) continue;
      const t = (elapsed % packetSpeedFrames) / packetSpeedFrames;
      const alpha =
        t < 0.1 ? t / 0.1 : t > 0.9 ? (1 - t) / 0.1 : 1;
      const pt = evalBezier(t);
      packets.push({ x: pt.x, y: pt.y, alpha });
    }
  }

  return (
    <svg
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 1,
        height: 1,
        overflow: 'visible',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      <path
        d={d}
        fill="none"
        stroke={resolvedColor}
        strokeWidth={strokeWidth + 6}
        strokeOpacity={0.14 * drawProgress}
        strokeLinecap="round"
      />
      <path
        d={d}
        fill="none"
        stroke={resolvedColor}
        strokeWidth={strokeWidth}
        strokeOpacity={0.85 * drawProgress}
        strokeDasharray={dashed ? '10 10' : undefined}
        strokeLinecap="round"
      />
      <circle
        cx={from.x}
        cy={from.y}
        r={6}
        fill={terminalFill}
        stroke={resolvedColor}
        strokeWidth={3}
        opacity={drawProgress}
      />
      <circle
        cx={to.x}
        cy={to.y}
        r={6}
        fill={terminalFill}
        stroke={resolvedColor}
        strokeWidth={3}
        opacity={drawProgress}
      />
      {packets.map((pkt, idx) => (
        <g key={idx} opacity={pkt.alpha * drawProgress}>
          <circle cx={pkt.x} cy={pkt.y} r={12} fill={resolvedColor} opacity={0.22} />
          <circle
            cx={pkt.x}
            cy={pkt.y}
            r={6.5}
            fill={terminalFill}
            stroke={resolvedColor}
            strokeWidth={3}
          />
        </g>
      ))}
    </svg>
  );
};
