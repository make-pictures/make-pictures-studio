export interface Point2D {
  x: number;
  y: number;
}

export interface LiveNodeTransform2D {
  translateX?: number;
  translateY?: number;
  rotateDeg?: number;
  scaleX?: number;
  scaleY?: number;
}

export interface ElasticCordOptions {
  orientation?: 'horizontal' | 'vertical';
  restLength?: number;
  baseSagPx?: number;
  archOffset?: number;
  whipOffset?: number;
  tension?: number;
}

/**
 * Computes the exact world-space border port `(x, y)` of a `NodeBox` after applying
 * center-origin CSS transforms (`scale(scaleX, scaleY)` -> `rotate(rotateDeg)` ->
 * `translate(translateX, translateY)`) plus optional outward normal `outsetPx`.
 * Guarantees elastic cables and anchor rings never detach from bouncing, tilting, or squashing cards.
 */
export function computeLiveNodePort(
  box: { cx: number; cy: number; w: number; h: number },
  side: 'left' | 'right' | 'top' | 'bottom',
  transform?: LiveNodeTransform2D,
  outsetPx = 0
): Point2D {
  const sx = transform?.scaleX ?? 1;
  const sy = transform?.scaleY ?? 1;
  const tx = transform?.translateX ?? 0;
  const ty = transform?.translateY ?? 0;
  const rad = ((transform?.rotateDeg ?? 0) * Math.PI) / 180;

  let lx = 0;
  let ly = 0;
  let nx = 0;
  let ny = 0;

  switch (side) {
    case 'left':
      lx = -box.w / 2;
      nx = -1;
      break;
    case 'right':
      lx = box.w / 2;
      nx = 1;
      break;
    case 'top':
      ly = -box.h / 2;
      ny = -1;
      break;
    case 'bottom':
      ly = box.h / 2;
      ny = 1;
      break;
  }

  // Scale border point from center origin, step outward by outsetPx along local normal, then rotate & translate
  const x1 = lx * sx + nx * outsetPx;
  const y1 = ly * sy + ny * outsetPx;

  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return {
    x: box.cx + tx + (x1 * cos - y1 * sin),
    y: box.cy + ty + (x1 * sin + y1 * cos),
  };
}

/**
 * Computes a lively elastic cubic Bézier cord whose endpoints lock 1:1 to `from` and `to`:
 * - Stretches taut when `dist > restLength`
 * - Loosens and bows smoothly when `dist < restLength`
 * - Deflects cleanly by `whipOffset` for springy follow-through on moving cards
 */
export function buildElasticCordPath(
  from: Point2D,
  to: Point2D,
  options: ElasticCordOptions = {}
): CubicBezierCurve2D {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);

  const orientation =
    options.orientation ??
    (Math.abs(dy) > Math.abs(dx) * 1.35 ? 'vertical' : 'horizontal');
  const restLength = Math.max(1, options.restLength ?? Math.max(1, dist));
  const baseSagPx = options.baseSagPx ?? 24;
  const archOffset = options.archOffset ?? 0;
  const whipOffset = options.whipOffset ?? 0;
  const tension = Math.max(0.1, options.tension ?? 1.0);

  const strain = (dist - restLength) / restLength;
  const sagMultiplier =
    strain >= 0
      ? 1 / (1 + strain * 3.2 * tension)
      : 1 + Math.min(1.6, (Math.abs(strain) * 2.2) / Math.max(0.4, tension));

  const effectiveSag = (baseSagPx + archOffset) * sagMultiplier + whipOffset;

  const p0: Point2D = { x: from.x, y: from.y };
  const p3: Point2D = { x: to.x, y: to.y };

  let p1: Point2D;
  let p2: Point2D;

  if (orientation === 'vertical') {
    p1 = {
      x: from.x + dx * 0.18 + effectiveSag,
      y: from.y + dy * 0.36,
    };
    p2 = {
      x: from.x + dx * 0.82 + effectiveSag,
      y: from.y + dy * 0.64,
    };
  } else {
    p1 = {
      x: from.x + dx * 0.36,
      y: from.y + dy * 0.18 + effectiveSag,
    };
    p2 = {
      x: from.x + dx * 0.64,
      y: from.y + dy * 0.82 + effectiveSag,
    };
  }

  const d = `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} C ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}, ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`;

  return {
    p0,
    p1,
    p2,
    p3,
    d,
    pointAt: (t: number) => evaluateCubicBezier(p0, p1, p2, p3, t),
  };
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
