import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  SPRING_PRESETS,
  STUDIO_THEME,
  THEME,
  computeCircleOfConfusionPx,
  formatFontFamilyCss,
  getCardChromeStyle,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioStyle,
  type TactileElevation,
} from '@make-pictures/core';
import {
  useMotionDiagramFocus,
  type MotionDiagramFocusState,
} from './MotionDiagramStage2D';

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
  nodeId?: string;
  focusState?: MotionDiagramFocusState;
  elevation?: TactileElevation;
  scale?: number;
  opacity?: number;
  zIndex?: number;
  variant?: 'card' | 'transparent' | 'dark' | 'light';
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const WorldBox: React.FC<WorldBoxProps> = ({
  node,
  nodeId,
  focusState = 'auto',
  elevation = 'resting',
  scale = 1,
  opacity = 1,
  zIndex = 2,
  variant,
  style,
  children,
}) => {
  const studioStyle = useStudioStyle();
  const focusCtx = useMotionDiagramFocus();
  const optics = resolveStyleOptics(studioStyle);
  const bodyFontCss = formatFontFamilyCss(
    studioStyle.typography.bodyFont,
    'body'
  );

  const resolvedFocus = focusCtx
    ? focusCtx.resolveNodeFocus(nodeId, focusState)
    : focusState === 'recessed'
      ? (() => {
          const b = computeCircleOfConfusionPx(-0.28, 0, optics.aperture);
          return {
            isRecessed: true,
            blurPx: b,
            filterCss: b === 0 ? 'none' : `blur(${b.toFixed(2)}px)`,
            opacityScale: 0.68,
            scaleFactor: 0.98,
          };
        })()
      : {
          isRecessed: false,
          blurPx: 0,
          filterCss: 'none',
          opacityScale: 1,
          scaleFactor: 1,
        };

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
    const baseChrome = getCardChromeStyle(studioStyle);
    const tactile = getTactileSurfaceStyle(studioStyle, { elevation });
    chromeStyle =
      studioStyle.surface.cardTreatment === 'brutalist-hard' &&
      elevation === 'resting'
        ? { ...tactile, boxShadow: baseChrome.boxShadow }
        : tactile;
  }

  return (
    <div
      data-focus-state={resolvedFocus.isRecessed ? 'recessed' : 'sharp'}
      style={{
        position: 'absolute',
        left: node.cx - node.w / 2,
        top: node.cy - node.h / 2,
        width: node.w,
        height: node.h,
        boxSizing: 'border-box',
        transformOrigin: 'center center',
        transform: `scale(${Number((scale * resolvedFocus.scaleFactor).toFixed(4))})`,
        opacity: opacity * resolvedFocus.opacityScale,
        filter: resolvedFocus.filterCss,
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
  curveY?: number;
  curveX?: number;
  orientation?: 'horizontal' | 'vertical';
  color?: string;
  activeFromFrame: number;
  packetSpeedFrames?: number;
  packetCount?: number;
  strokeWidth?: number;
  dashed?: boolean;
  blocked?: boolean;
}

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
  strokeWidth = 2.6,
  dashed = false,
  blocked = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const studioStyle = useStudioStyle();

  const effectiveStart = Math.max(2, activeFromFrame);
  if (frame <= 0 || frame < effectiveStart) {
    return null;
  }

  const optics = resolveStyleOptics(studioStyle);
  const grammar = optics.typographyGrammar;
  const resolvedColor = color ?? studioStyle.palette.accentPrimary;
  const terminalFill = studioStyle.palette.bgSurface;
  const inkBorder = studioStyle.palette.inkBorder;

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
    frame: frame - effectiveStart,
    fps,
    config: SPRING_PRESETS.smooth,
  });

  if (drawProgress <= 0.01) return null;

  const evalBezier = (t: number) => {
    const u = 1 - t;
    const x =
      u * u * u * p0.x +
      3 * u * u * t * p1.x +
      3 * u * t * t * p2.x +
      t * t * t * p3.x;
    const y =
      u * u * u * p0.y +
      3 * u * u * t * p1.y +
      3 * u * t * t * p2.y +
      t * t * t * p3.y;
    const tx =
      3 * u * u * (p1.x - p0.x) +
      6 * u * t * (p2.x - p1.x) +
      3 * t * t * (p3.x - p2.x);
    const ty =
      3 * u * u * (p1.y - p0.y) +
      6 * u * t * (p2.y - p1.y) +
      3 * t * t * (p3.y - p2.y);
    const deg = (Math.atan2(ty, tx) * 180) / Math.PI;
    return { x, y, deg };
  };

  const packets: Array<{ x: number; y: number; deg: number; alpha: number }> = [];
  if (!blocked && frame >= effectiveStart + 8) {
    for (let i = 0; i < packetCount; i++) {
      const offset = (i / packetCount) * packetSpeedFrames;
      const elapsed = frame - (effectiveStart + 8) - offset;
      if (elapsed < 0) continue;
      const t = (elapsed % packetSpeedFrames) / packetSpeedFrames;
      const alpha = t < 0.1 ? t / 0.1 : t > 0.9 ? (1 - t) / 0.1 : 1;
      const pt = evalBezier(t);
      packets.push({ ...pt, alpha });
    }
  }

  return (
    <svg
      data-flow-grammar={grammar}
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
      {/* Guide rail */}
      <path
        d={d}
        fill="none"
        stroke={inkBorder}
        strokeWidth={1.2}
        strokeOpacity={0.38 * drawProgress}
      />
      {/* Active schematic bus */}
      <path
        d={d}
        fill="none"
        stroke={resolvedColor}
        strokeWidth={grammar === 'risograph-poster' ? strokeWidth + 0.8 : strokeWidth}
        strokeOpacity={0.9 * drawProgress}
        strokeDasharray={dashed ? '8 6' : undefined}
        strokeLinecap="butt"
      />
      {/* Polymorphic Port Terminals */}
      {grammar === 'risograph-poster' ? (
        <>
          <rect
            x={from.x - 5}
            y={from.y - 5}
            width={10}
            height={10}
            fill={inkBorder}
            opacity={drawProgress}
          />
          <rect
            x={to.x - 5}
            y={to.y - 5}
            width={10}
            height={10}
            fill={resolvedColor}
            stroke={inkBorder}
            strokeWidth={1.6}
            opacity={drawProgress}
          />
        </>
      ) : grammar === 'optical-gate' ? (
        <>
          <circle
            cx={from.x}
            cy={from.y}
            r={5}
            fill={terminalFill}
            stroke={resolvedColor}
            strokeWidth={1.8}
            opacity={drawProgress}
          />
          <circle
            cx={to.x}
            cy={to.y}
            r={5}
            fill={terminalFill}
            stroke={resolvedColor}
            strokeWidth={1.8}
            opacity={drawProgress}
          />
        </>
      ) : (
        <>
          <rect
            x={from.x - 4.5}
            y={from.y - 4.5}
            width={9}
            height={9}
            fill={terminalFill}
            stroke={resolvedColor}
            strokeWidth={2}
            opacity={drawProgress}
          />
          <circle
            cx={to.x}
            cy={to.y}
            r={4.5}
            fill={terminalFill}
            stroke={resolvedColor}
            strokeWidth={2}
            opacity={drawProgress}
          />
        </>
      )}

      {/* Tangent-Aligned Signal Couriers */}
      {packets.map((pkt, idx) => (
        <g
          key={idx}
          opacity={pkt.alpha * drawProgress}
          transform={`translate(${pkt.x.toFixed(2)}, ${pkt.y.toFixed(2)}) rotate(${pkt.deg.toFixed(2)})`}
        >
          {grammar === 'risograph-poster' ? (
            <polygon
              points="9,0 -7,-6.5 -7,6.5"
              fill={resolvedColor}
              stroke={inkBorder}
              strokeWidth={1.6}
            />
          ) : grammar === 'optical-gate' ? (
            <>
              <rect
                x={-9}
                y={-3.5}
                width={18}
                height={7}
                fill={resolvedColor}
              />
              <rect
                x={-4}
                y={-1.5}
                width={10}
                height={3}
                fill="#FFFFFF"
              />
            </>
          ) : (
            <polygon
              points="8,0 -6,-5.2 -3.2,0 -6,5.2"
              fill={resolvedColor}
            />
          )}
        </g>
      ))}
    </svg>
  );
};
