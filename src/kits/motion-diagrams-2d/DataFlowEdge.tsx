import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONTS, SPRING_PRESETS, THEME } from '../../theme';

export interface Point2D {
  x: number;
  y: number;
}

export interface DataFlowEdgeProps {
  id: string;
  from: Point2D;
  to: Point2D;
  /** Vertical arch offset in px (negative arches upward, positive downward) */
  curveOffsetY?: number;
  color?: string;
  secondaryColor?: string;
  drawStartFrame?: number;
  flowStartFrame?: number;
  flowEndFrame?: number;
  /** Number of simultaneous glowing data packets along the curve */
  packetCount?: number;
  /** Frames required for a single packet to traverse 0 -> 1 along the curve */
  traverseFrames?: number;
  direction?: 'forward' | 'reverse';
  label?: string;
  subLabel?: string;
  labelOffsetY?: number;
}

/**
 * Evaluates a 2D point on a cubic Bézier curve at parameter t in [0, 1].
 */
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
  color = THEME.colors.accents.cyan,
  secondaryColor,
  drawStartFrame = 0,
  flowStartFrame = 30,
  flowEndFrame = 600,
  packetCount = 3,
  traverseFrames = 65,
  direction = 'forward',
  label,
  subLabel,
  labelOffsetY = -28,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const endColor = secondaryColor ?? color;
  const dx = to.x - from.x;

  // Control points for a smooth S-curve or arch
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

  const isFlowActive = frame >= flowStartFrame && frame <= flowEndFrame;
  const flowFadeIn = interpolate(
    frame,
    [flowStartFrame, flowStartFrame + 14],
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

  // Midpoint for optional protocol pill badge
  const midPoint = evaluateCubicBezier(p0, p1, p2, p3, 0.5);

  const pathLengthEstimate = 1600;
  const dashOffset = interpolate(
    drawProgress,
    [0, 1],
    [pathLengthEstimate, 0]
  );

  const gradId = `edge-grad-${id}`;
  const glowFilterId = `edge-glow-${id}`;

  // Compute packet positions
  const packets: Array<{ head: Point2D; trail: Point2D[]; opacity: number }> = [];
  if (flowAlpha > 0.01) {
    for (let i = 0; i < packetCount; i++) {
      const staggerFrames = Math.round((i / packetCount) * traverseFrames);
      const localElapsed = frame - flowStartFrame - staggerFrames;
      if (localElapsed < 0) continue;

      const rawProgress = (localElapsed % traverseFrames) / traverseFrames;
      const t = direction === 'forward' ? rawProgress : 1 - rawProgress;

      // Smooth fade at the very ends of the curve [0..0.08] and [0.92..1]
      const edgeFade =
        interpolate(t, [0, 0.08, 0.92, 1], [0, 1, 1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }) * flowAlpha;

      const head = evaluateCubicBezier(p0, p1, p2, p3, t);
      const trail: Point2D[] = [];
      const trailSteps = 6;
      for (let s = 1; s <= trailSteps; s++) {
        const dt = (s * 0.018) * (direction === 'forward' ? -1 : 1);
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
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={endColor} />
          </linearGradient>

          <filter
            id={glowFilterId}
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Base Subtle Guide Track */}
        <path
          d={pathData}
          fill="none"
          stroke="rgba(255, 255, 255, 0.09)"
          strokeWidth={2}
          strokeDasharray={pathLengthEstimate}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />

        {/* Dashed Technical Overlay Track */}
        <path
          d={pathData}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={2}
          strokeDasharray="6 10"
          strokeOpacity={0.32 * drawProgress + 0.35 * flowAlpha}
          strokeLinecap="round"
        />

        {/* Active Neon Core Beam */}
        {flowAlpha > 0.01 && (
          <path
            d={pathData}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={3}
            strokeOpacity={0.58 * flowAlpha}
            filter={`url(#${glowFilterId})`}
            strokeLinecap="round"
          />
        )}

        {/* Anchor Terminal Dots */}
        <circle
          cx={from.x}
          cy={from.y}
          r={4.5}
          fill={color}
          opacity={drawProgress}
        />
        <circle
          cx={to.x}
          cy={to.y}
          r={4.5}
          fill={endColor}
          opacity={drawProgress}
        />

        {/* Flowing Data Packets + Comet Trails */}
        {packets.map((pkt, idx) => (
          <g key={`pkt-${idx}`} opacity={pkt.opacity}>
            {pkt.trail.map((pt, tIdx) => {
              const ratio = 1 - (tIdx + 1) / (pkt.trail.length + 1);
              return (
                <circle
                  key={`trail-${tIdx}`}
                  cx={pt.x}
                  cy={pt.y}
                  r={5.5 * ratio}
                  fill={color}
                  opacity={0.42 * ratio}
                />
              );
            })}
            {/* Outer Glow Halo */}
            <circle
              cx={pkt.head.x}
              cy={pkt.head.y}
              r={13}
              fill={color}
              opacity={0.28}
              filter={`url(#${glowFilterId})`}
            />
            {/* Bright White-Hot Packet Core */}
            <circle
              cx={pkt.head.x}
              cy={pkt.head.y}
              r={5.2}
              fill="#FFFFFF"
              stroke={color}
              strokeWidth={2.5}
            />
          </g>
        ))}
      </svg>

      {/* Midpoint Protocol Pill Badge */}
      {label && drawProgress > 0.4 && (
        <div
          style={{
            position: 'absolute',
            left: midPoint.x,
            top: midPoint.y + labelOffsetY,
            transform: `translate(-50%, -50%) scale(${interpolate(
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
            backgroundColor: 'rgba(9, 10, 15, 0.88)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: `1px solid ${
              flowAlpha > 0.2 ? `${color}77` : 'rgba(255,255,255,0.1)'
            }`,
            boxShadow:
              flowAlpha > 0.2
                ? `0 0 20px ${color}33, 0 8px 20px rgba(0,0,0,0.6)`
                : '0 8px 20px rgba(0,0,0,0.6)',
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
              backgroundColor: color,
              boxShadow: flowAlpha > 0.2 ? `0 0 8px ${color}` : 'none',
            }}
          />
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 11,
              fontWeight: 600,
              color: THEME.colors.textPrimary,
              letterSpacing: '0.04em',
            }}
          >
            {label}
          </span>
          {subLabel && (
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 10.5,
                color: THEME.colors.textSecondary,
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
