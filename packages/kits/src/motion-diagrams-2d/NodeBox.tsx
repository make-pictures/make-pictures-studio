import React, { useContext } from 'react';
import { Internals, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  ClippedSurfaceChrome,
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
import {
  buildCubicBezierPath,
  evaluateCubicBezierAngleDeg,
} from './bezierGeometry';

function useOptionalRemotionFrame(): number {
  const canUseRemotion = useContext(Internals.CanUseRemotionHooks);
  const timelinePos = Internals.Timeline.useTimelinePosition();
  const seqCtx = useContext(Internals.SequenceContext);
  if (!canUseRemotion) {
    return 1;
  }
  return timelinePos - (seqCtx ? seqCtx.cumulatedFrom + seqCtx.relativeFrom : 0);
}

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
  topBarHeight?: number;
  topBarColor?: string;
  specularRim?: boolean;
  /** Respects Frame 0 clean-board invariant (returns `null` at `frame <= 0`, default `true`) */
  cleanFrameZero?: boolean;
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
  topBarHeight,
  topBarColor,
  specularRim,
  cleanFrameZero = true,
  style,
  children,
}) => {
  const frame = useOptionalRemotionFrame();
  const studioStyle = useStudioStyle();
  const focusCtx = useMotionDiagramFocus();

  if (cleanFrameZero && frame <= 0) {
    return null;
  }
  const optics = resolveStyleOptics(studioStyle);
  const bodyFontCss = formatFontFamilyCss(
    studioStyle.typography.bodyFont,
    'body'
  );

  const isDarkSurface =
    variant === 'dark'
      ? true
      : variant === 'light'
        ? false
        : studioStyle.surface.isDark;

  const resolvedFocus = focusCtx
    ? focusCtx.resolveNodeFocus(nodeId, focusState)
    : focusState === 'recessed'
      ? (() => {
          const rawB = computeCircleOfConfusionPx(-0.28, 0, optics.aperture);
          if (rawB === 0) {
            return {
              isRecessed: true,
              blurPx: 0,
              filterCss: 'none',
              opacityScale: isDarkSurface ? 0.72 : 0.88,
              scaleFactor: isDarkSurface ? 0.98 : 0.985,
            };
          }
          const b = isDarkSurface
            ? rawB
            : Number(Math.min(1.85, rawB).toFixed(2));
          return {
            isRecessed: true,
            blurPx: b,
            filterCss: isDarkSurface
              ? `blur(${b.toFixed(2)}px)`
              : `blur(${b.toFixed(2)}px) saturate(0.88)`,
            opacityScale: isDarkSurface ? 0.72 : 0.88,
            scaleFactor: isDarkSurface ? 0.98 : 0.985,
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
      {variant !== 'transparent' ? (
        <ClippedSurfaceChrome
          topBarHeight={topBarHeight}
          topBarColor={topBarColor}
          specularRim={specularRim ?? !isDarkSurface}
        />
      ) : null}
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
  packetCount = 0,
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

  const curve = buildCubicBezierPath(from, to, {
    orientation,
    curveX,
    curveY,
  });
  const { p0, p1, p2, p3, d } = curve;

  const drawProgress = spring({
    frame: frame - effectiveStart,
    fps,
    config: SPRING_PRESETS.smooth,
  });

  if (drawProgress <= 0.01) return null;

  const packets: Array<{ x: number; y: number; deg: number; alpha: number }> = [];
  if (!blocked && packetCount > 0 && frame >= effectiveStart + 8) {
    for (let i = 0; i < packetCount; i++) {
      const offset = (i / packetCount) * packetSpeedFrames;
      const elapsed = frame - (effectiveStart + 8) - offset;
      if (elapsed < 0) continue;
      const t = (elapsed % packetSpeedFrames) / packetSpeedFrames;
      const alpha = t < 0.1 ? t / 0.1 : t > 0.9 ? (1 - t) / 0.1 : 1;
      const pt = curve.pointAt(t);
      const deg = evaluateCubicBezierAngleDeg(p0, p1, p2, p3, t, false);
      packets.push({ x: pt.x, y: pt.y, deg, alpha });
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
        strokeWidth={
          grammar === 'risograph-poster' ? strokeWidth + 0.8 : strokeWidth
        }
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
