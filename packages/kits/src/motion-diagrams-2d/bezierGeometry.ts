export interface Point2D {
  x: number;
  y: number;
}

export interface CubicBezierCurve2D {
  p0: Point2D;
  p1: Point2D;
  p2: Point2D;
  p3: Point2D;
  /** Ready-to-use `d` attribute for an SVG `<path>` element */
  d: string;
  /** Point on the curve for `t ∈ [0, 1]` — 100% aligned with `<path d={d}>` */
  pointAt: (t: number) => Point2D;
}

export function evaluateCubicBezier(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  t: number
): Point2D {
  const u = Math.max(0, Math.min(1, t));
  const inv = 1 - u;
  const b0 = inv * inv * inv;
  const b1 = 3 * inv * inv * u;
  const b2 = 3 * inv * u * u;
  const b3 = u * u * u;
  return {
    x: b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x,
    y: b0 * p0.y + b1 * p1.y + b2 * p2.y + b3 * p3.y,
  };
}

export function evaluateCubicBezierAngleDeg(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  t: number,
  reverse = false
): number {
  const clamped = Math.max(0, Math.min(1, t));
  const u = 1 - clamped;
  const tx =
    3 * u * u * (p1.x - p0.x) +
    6 * u * clamped * (p2.x - p1.x) +
    3 * clamped * clamped * (p3.x - p2.x);
  const ty =
    3 * u * u * (p1.y - p0.y) +
    6 * u * clamped * (p2.y - p1.y) +
    3 * clamped * clamped * (p3.y - p2.y);
  const sign = reverse ? -1 : 1;
  return (Math.atan2(ty * sign, tx * sign) * 180) / Math.PI;
}

export function buildCubicBezierPath(
  from: Point2D,
  to: Point2D,
  options: {
    orientation?: 'horizontal' | 'vertical';
    curveX?: number;
    curveY?: number;
  } = {}
): CubicBezierCurve2D {
  const orientation = options.orientation ?? 'horizontal';
  let p1: Point2D;
  let p2: Point2D;

  if (orientation === 'vertical') {
    const midY = (from.y + to.y) / 2;
    const dx = options.curveX ?? 0;
    p1 = { x: from.x + dx, y: midY };
    p2 = { x: to.x + dx, y: midY };
  } else {
    const midX = (from.x + to.x) / 2;
    const dy = options.curveY ?? 0;
    p1 = { x: midX, y: from.y + dy };
    p2 = { x: midX, y: to.y + dy };
  }

  const d = `M ${from.x} ${from.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${to.x} ${to.y}`;
  return {
    p0: from,
    p1,
    p2,
    p3: to,
    d,
    pointAt: (t: number) => evaluateCubicBezier(from, p1, p2, to, t),
  };
}
