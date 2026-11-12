import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  SPRING_PRESETS,
  THEME,
  formatFontFamilyCss,
  useStudioStyle,
} from '@make-pictures/core';

export interface Point2D {
  x: number;
  y: number;
}

export interface DataFlowEdgeProps {
  id: string;
  from: Point2D;
  to: Point2D;
  curveOffsetY?: number;
  color?: string;
  secondaryColor?: string;
  drawStartFrame?: number;
  flowStartFrame?: number;
  flowEndFrame?: number;
  packetCount?: number;
  traverseFrames?: number;
  direction?: 'forward' | 'reverse';
  label?: string;
  subLabel?: string;
  labelOffsetY?: number;
}

export function evaluateCubicBezier(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  t: number
): Point2D {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

export const DataFlowEdge: React.FC<DataFlowEdgeProps> = ({
  id,
  from,
  to,
  curveOffsetY = -70,
  color,
  secondaryColor,
  drawStartFrame = 0,
  flowStartFrame = 30,
  flowEndFrame = 600,
  packetCount = 2,
  traverseFrames = 96,
  direction = 'forward',
  label,
  subLabel,
  labelOffsetY = -28,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const studioStyle = useStudioStyle();

  const resolvedColor = color ?? studioStyle.palette.accentPrimary;
  const endColor =
    secondaryColor ??
    (color === undefined ? studioStyle.palette.accentSecondary : resolvedColor);
  const monoFontCss = formatFontFamilyCss(
    studioStyle.typography.monoFont,
    'mono'
  );
  const isDark = studioStyle.surface.isDark;

  const dx = to.x - from.x;

  const p0 = from;
  const p1: Point2D = {
    x: from.x + dx * 0.36,
    y: from.y + curveOffsetY,
  };
  const p2: Point2D = {
    x: from.x + dx * 0.64,
    y: to.y + curveOffsetY,
  };
  const p3 = to;

  const pathData = `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;

  const drawProgress = spring({
    frame: frame - drawStartFrame,
    fps,
    config: SPRING_PRESETS.smooth,
  });

  if (drawProgress <= 0.005) {
    return null;
  }

  const isFlowActive = frame >= flowStartFrame && frame <= flowEndFrame;
  const flowFadeIn = interpolate(
    frame,
    [flowStartFrame, flowStartFrame + 16],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const flowFadeOut = interpolate(
    frame,
    [flowEndFrame - 18, flowEndFrame],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const flowAlpha = isFlowActive ? flowFadeIn * flowFadeOut : 0;

  const midPoint = evaluateCubicBezier(p0, p1, p2, p3, 0.5);

  const pathLengthEstimate = 1600;
  const dashOffset = interpolate(
    drawProgress,
    [0, 1],
    [pathLengthEstimate, 0]
  );

  const gradId = `edge-grad-${id}`;

  const packets: Array<{ head: Point2D; trail: Point2D[]; opacity: number }> = [];
  if (flowAlpha > 0.01) {
    for (let i = 0; i < packetCount; i++) {
      const staggerFrames = Math.round((i / packetCount) * traverseFrames);
      const localElapsed = frame - flowStartFrame - staggerFrames;
      if (localElapsed < 0) continue;

      const rawProgress = (localElapsed % traverseFrames) / traverseFrames;
      const t = direction === 'forward' ? rawProgress : 1 - rawProgress;

      const edgeFade =
        interpolate(t, [0, 0.08, 0.92, 1], [0, 1, 1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }) * flowAlpha;

      const head = evaluateCubicBezier(p0, p1, p2, p3, t);
      const trail: Point2D[] = [];
      const trailSteps = 5;
      for (let s = 1; s <= trailSteps; s++) {
        const dt = s * 0.016 * (direction === 'forward' ? -1 : 1);
        const clampedT = Math.max(0, Math.min(1, t + dt));
        trail.push(evaluateCubicBezier(p0, p1, p2, p3, clampedT));
      }

      packets.push({ head, trail, opacity: edgeFade });
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    >
      <svg
        width={1920}
        height={1080}
        viewBox="0 0 1920 1080"
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
      >
        <defs>
          <linearGradient
            id={gradId}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={resolvedColor} />
            <stop offset="100%" stopColor={endColor} />
          </linearGradient>
        </defs>

        <path
          d={pathData}
          fill="none"
          stroke={isDark ? 'rgba(255, 255, 255, 0.12)' : studioStyle.palette.inkBorder}
          strokeOpacity={isDark ? 1 : 0.45}
          strokeWidth={2}
          strokeDasharray={pathLengthEstimate}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />

        <path
          d={pathData}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={2}
          strokeDasharray="6 10"
          strokeOpacity={0.32 * drawProgress + 0.35 * flowAlpha}
          strokeLinecap="round"
        />

        {flowAlpha > 0.01 && (
          <>
            <path
              d={pathData}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth={11}
              strokeOpacity={0.14 * flowAlpha}
              strokeLinecap="round"
            />
            <path
              d={pathData}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth={3}
              strokeOpacity={0.62 * flowAlpha}
              strokeLinecap="round"
            />
          </>
        )}

        <circle
          cx={from.x}
          cy={from.y}
          r={4.5}
          fill={resolvedColor}
          opacity={drawProgress}
        />
        <circle
          cx={to.x}
          cy={to.y}
          r={4.5}
          fill={endColor}
          opacity={drawProgress}
        />

        {packets.map((pkt, idx) => (
          <g key={`pkt-${idx}`} opacity={pkt.opacity}>
            {pkt.trail.map((pt, tIdx) => {
              const ratio = 1 - (tIdx + 1) / (pkt.trail.length + 1);
              return (
                <circle
                  key={`trail-${tIdx}`}
                  cx={pt.x}
                  cy={pt.y}
                  r={5.2 * ratio}
                  fill={resolvedColor}
                  opacity={0.4 * ratio}
                />
              );
            })}
            <circle
              cx={pkt.head.x}
              cy={pkt.head.y}
              r={16}
              fill={resolvedColor}
              opacity={0.14}
            />
            <circle
              cx={pkt.head.x}
              cy={pkt.head.y}
              r={10}
              fill={resolvedColor}
              opacity={0.28}
            />
            <circle
              cx={pkt.head.x}
              cy={pkt.head.y}
              r={5.2}
              fill={studioStyle.palette.bgSurface}
              stroke={resolvedColor}
              strokeWidth={2.5}
            />
          </g>
        ))}
      </svg>

      {label && drawProgress > 0.4 && (
        <div
          style={{
            position: 'absolute',
            left: midPoint.x,
            top: midPoint.y + labelOffsetY,
            transform: `translate3d(-50%, -50%, 0) scale(${interpolate(
              drawProgress,
              [0.4, 1],
              [0.85, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            )})`,
            opacity: interpolate(drawProgress, [0.4, 0.9], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            padding: '5px 12px',
            borderRadius: THEME.radii.pill,
            backgroundColor: studioStyle.palette.bgSurface,
            border: `1px solid ${
              flowAlpha > 0.2 ? `${resolvedColor}77` : studioStyle.palette.inkBorder
            }`,
            boxShadow:
              flowAlpha > 0.2
                ? `0 0 20px ${resolvedColor}33, 0 8px 20px rgba(0,0,0,0.22)`
                : '0 8px 20px rgba(0,0,0,0.16)',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            whiteSpace: 'nowrap',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: resolvedColor,
              boxShadow: flowAlpha > 0.2 ? `0 0 8px ${resolvedColor}` : 'none',
            }}
          />
          <span
            style={{
              fontFamily: monoFontCss,
              fontSize: 11,
              fontWeight: 600,
              color: studioStyle.palette.textPrimary,
              letterSpacing: '0.04em',
            }}
          >
            {label}
          </span>
          {subLabel && (
            <span
              style={{
                fontFamily: monoFontCss,
                fontSize: 10.5,
                color: studioStyle.palette.textSecondary,
              }}
            >
              • {subLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
