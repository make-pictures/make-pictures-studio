import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  ClippedSurfaceChrome,
  SPRING_PRESETS,
  formatFontFamilyCss,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioStyle,
} from "../..";
import {
  buildCubicBezierPath,
  evaluateCubicBezier,
  evaluateCubicBezierAngleDeg,
  type CubicBezierCurve2D,
  type Point2D,
} from './bezierGeometry';

export {
  buildCubicBezierPath,
  evaluateCubicBezier,
  evaluateCubicBezierAngleDeg,
  type CubicBezierCurve2D,
  type Point2D,
};

export interface DataFlowEdgeProps {
  id: string;
  from: Point2D;
  to: Point2D;
  curveOffsetY?: number;
  curveOffsetX?: number;
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
  labelT?: number;
  labelOffsetX?: number;
  labelOffsetY?: number;
  zIndex?: number;
}

function sampleBezierTrailPath(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  fromT: number,
  toT: number,
  segments = 8
): { d: string; startPt: Point2D; endPt: Point2D } {
  const clampedStart = Math.max(0, Math.min(1, fromT));
  const clampedEnd = Math.max(0, Math.min(1, toT));
  const pts: Point2D[] = [];
  for (let s = 0; s <= segments; s++) {
    const u = s / segments;
    const t = clampedStart + (clampedEnd - clampedStart) * u;
    pts.push(evaluateCubicBezier(p0, p1, p2, p3, t));
  }
  const d = pts
    .map((pt, idx) =>
      `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`
    )
    .join(' ');
  return {
    d,
    startPt: pts[0]!,
    endPt: pts[pts.length - 1]!,
  };
}

export const DataFlowEdge: React.FC<DataFlowEdgeProps> = ({
  id,
  from,
  to,
  curveOffsetY = -70,
  curveOffsetX,
  color,
  secondaryColor,
  drawStartFrame = 2,
  flowStartFrame = 30,
  flowEndFrame = 600,
  packetCount = 0,
  traverseFrames = 96,
  direction = 'forward',
  label,
  subLabel,
  labelT = 0.5,
  labelOffsetX,
  labelOffsetY,
  zIndex,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const studioStyle = useStudioStyle();

  const effectiveDrawStart = Math.max(2, drawStartFrame);
  if (frame <= 0 || frame < effectiveDrawStart) {
    return null;
  }

  const optics = resolveStyleOptics(studioStyle);
  const grammar = optics.typographyGrammar;
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
  const dy = to.y - from.y;
  const isVerticalSpan = Math.abs(dy) > Math.abs(dx) * 1.35;

  const curve = buildCubicBezierPath(from, to, {
    orientation: isVerticalSpan ? 'vertical' : 'horizontal',
    curveX: curveOffsetX ?? 0,
    curveY: Math.abs(curveOffsetY) < 1 ? 0 : curveOffsetY,
  });
  const { p0, p1, p2, p3, d: pathData } = curve;

  const drawProgress = spring({
    frame: frame - effectiveDrawStart,
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

  const clampedLabelT = Math.max(0, Math.min(1, labelT));
  const labelAnchor = curve.pointAt(clampedLabelT);

  // Enforce >= 26px clearance from the cubic Bézier curve at labelT
  const verticalSideSign = (curveOffsetX ?? 0) < 0 ? -1 : 1;
  const resolvedLabelOffsetX = isVerticalSpan
    ? (labelOffsetX ?? verticalSideSign * 30)
    : (labelOffsetX ?? 0);
  const resolvedLabelOffsetY = isVerticalSpan
    ? (labelOffsetY ?? 0)
    : (labelOffsetY ?? (curveOffsetY <= 0 ? -32 : 32));
  const labelTranslateX =
    isVerticalSpan && labelOffsetX === undefined
      ? verticalSideSign > 0
        ? '0%'
        : '-100%'
      : '-50%';

  const pathLengthEstimate = 1600;
  const dashOffset = interpolate(
    drawProgress,
    [0, 1],
    [pathLengthEstimate, 0]
  );

  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const gradId = `edge-grad-${safeId}`;

  const packets: Array<{
    head: Point2D;
    deg: number;
    opacity: number;
    trailD: string;
    trailStart: Point2D;
  }> = [];
  if (flowAlpha > 0.01) {
    const trailSpan = 0.17;
    for (let i = 0; i < packetCount; i++) {
      const staggerFrames = Math.round((i / packetCount) * traverseFrames);
      const localElapsed = frame - flowStartFrame - staggerFrames;
      if (localElapsed < 0) continue;

      const rawProgress = (localElapsed % traverseFrames) / traverseFrames;
      const t = direction === 'forward' ? rawProgress : 1 - rawProgress;
      const tailT =
        direction === 'forward'
          ? Math.max(0, t - trailSpan)
          : Math.min(1, t + trailSpan);

      const edgeFade =
        interpolate(t, [0, 0.08, 0.92, 1], [0, 1, 1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }) * flowAlpha;

      const head = curve.pointAt(t);
      const deg = evaluateCubicBezierAngleDeg(
        p0,
        p1,
        p2,
        p3,
        t,
        direction === 'reverse'
      );
      const sampled = sampleBezierTrailPath(p0, p1, p2, p3, tailT, t, 8);
      packets.push({
        head,
        deg,
        opacity: edgeFade,
        trailD: sampled.d,
        trailStart: sampled.startPt,
      });
    }
  }

  const plateStyle = getTactileSurfaceStyle(studioStyle, {
    elevation: 'resting',
    overrides: {
      borderRadius: Math.max(
        0,
        Math.round(5 * studioStyle.surface.radiusScale)
      ),
      borderColor:
        flowAlpha > 0.2 ? resolvedColor : studioStyle.palette.inkBorder,
      padding: '5px 11px',
    },
  });

  return (
    <div
      data-edge-grammar={grammar}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        ...(zIndex !== undefined ? { zIndex } : {}),
      }}
    >
      <svg
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 1,
          height: 1,
          overflow: 'visible',
        }}
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

          {packets.map((pkt, idx) => (
            <linearGradient
              key={`trail-grad-${idx}`}
              id={`${gradId}-trail-${idx}`}
              x1={pkt.trailStart.x}
              y1={pkt.trailStart.y}
              x2={pkt.head.x}
              y2={pkt.head.y}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={endColor} stopOpacity={0} />
              <stop offset="55%" stopColor={resolvedColor} stopOpacity={0.5} />
              <stop offset="100%" stopColor={resolvedColor} stopOpacity={1} />
            </linearGradient>
          ))}
        </defs>

        <path
          d={pathData}
          fill="none"
          stroke={
            isDark ? 'rgba(255, 255, 255, 0.18)' : studioStyle.palette.inkBorder
          }
          strokeOpacity={isDark ? 1 : 0.52}
          strokeWidth={1.6}
          strokeDasharray={pathLengthEstimate}
          strokeDashoffset={dashOffset}
        />

        <path
          d={pathData}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={1.8}
          strokeDasharray="6 8"
          strokeOpacity={0.28 * drawProgress + 0.34 * flowAlpha}
        />

        {flowAlpha > 0.01 && (
          <path
            d={pathData}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={grammar === 'risograph-poster' ? 3.2 : 2.2}
            strokeOpacity={0.68 * flowAlpha}
          />
        )}

        {/* Luminous Gradient Flow Trails Behind Traveling Couplers */}
        {packets.map((pkt, idx) => (
          <g key={`trail-${idx}`} data-flow-trail="true" opacity={pkt.opacity}>
            <path
              d={pkt.trailD}
              fill="none"
              stroke={`url(#${gradId}-trail-${idx})`}
              strokeWidth={7.5}
              strokeLinecap="round"
              opacity={isDark ? 0.34 : 0.24}
            />
            <path
              d={pkt.trailD}
              fill="none"
              stroke={`url(#${gradId}-trail-${idx})`}
              strokeWidth={grammar === 'risograph-poster' ? 3.8 : 3}
              strokeLinecap="round"
              opacity={0.95}
            />
          </g>
        ))}

        <rect
          x={from.x - 4}
          y={from.y - 4}
          width={8}
          height={8}
          fill={studioStyle.palette.bgSurface}
          stroke={resolvedColor}
          strokeWidth={1.8}
          opacity={drawProgress}
        />
        <circle
          cx={to.x}
          cy={to.y}
          r={4.2}
          fill={studioStyle.palette.bgSurface}
          stroke={endColor}
          strokeWidth={1.8}
          opacity={drawProgress}
        />

        {packets.map((pkt, idx) => (
          <g
            key={`pkt-${idx}`}
            opacity={pkt.opacity}
            transform={`translate(${pkt.head.x.toFixed(2)}, ${pkt.head.y.toFixed(2)}) rotate(${pkt.deg.toFixed(2)})`}
          >
            {grammar === 'risograph-poster' ? (
              <polygon
                points="9,0 -7,-6.5 -7,6.5"
                fill={resolvedColor}
                stroke={studioStyle.palette.inkBorder}
                strokeWidth={1.5}
              />
            ) : grammar === 'optical-gate' ? (
              <>
                <rect
                  x={-9}
                  y={-3.2}
                  width={18}
                  height={6.4}
                  fill={resolvedColor}
                />
                <rect x={-4} y={-1.2} width={10} height={2.4} fill="#FFFFFF" />
              </>
            ) : (
              <polygon points="8,0 -6,-5 -3.2,0 -6,5" fill={resolvedColor} />
            )}
          </g>
        ))}
      </svg>

      {label && drawProgress > 0.4 && (
        <div
          data-edge-label={id}
          style={{
            position: 'absolute',
            left: Math.round(labelAnchor.x + resolvedLabelOffsetX),
            top: Math.round(labelAnchor.y + resolvedLabelOffsetY),
            transform:
              drawProgress >= 0.995
                ? `translate(${labelTranslateX}, -50%)`
                : `translate(${labelTranslateX}, -50%) scale(${interpolate(
                    drawProgress,
                    [0.4, 1],
                    [0.9, 1],
                    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
                  ).toFixed(3)})`,
            opacity: interpolate(drawProgress, [0.4, 0.9], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            ...plateStyle,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          <ClippedSurfaceChrome
            topBarHeight={2}
            topBarColor={resolvedColor}
            specularRim={!isDark}
          />
          <span
            style={{
              position: 'relative',
              zIndex: 1,
              width: 6,
              height: 6,
              backgroundColor: resolvedColor,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              position: 'relative',
              zIndex: 1,
              fontFamily: monoFontCss,
              fontSize: 18,
              fontWeight: 700,
              color: studioStyle.palette.textPrimary,
              letterSpacing: '0.02em',
            }}
          >
            {label}
          </span>
          {subLabel && (
            <span
              style={{
                position: 'relative',
                zIndex: 1,
                fontFamily: monoFontCss,
                fontSize: 18,
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
