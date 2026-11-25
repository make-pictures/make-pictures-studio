import type React from 'react';

const SETTLE_EPSILON = 0.002;

/**
 * Snaps an underdamped spring progress value cleanly to `0` or `1` once within
 * `epsilon` so settled overlays emit exact `opacity: 1` and `transform: 'none'`
 * instead of oscillating `0.999987 <-> 1.0` or `-0.00px <-> 0.00px`.
 */
export function snapSettledProgress(
  progress: number,
  epsilon: number = SETTLE_EPSILON
): number {
  if (!Number.isFinite(progress)) return 0;
  if (progress <= epsilon) return 0;
  if (Math.abs(1 - progress) <= epsilon) return 1;
  return progress;
}

/**
 * Builds a pixel-snapped 2D vertical translation transform that snaps to `'none'`
 * once settled (`Math.round(offsetPx) === 0`), preventing Chromium's GPU compositor
 * (`cc::PictureLayerImpl`) from locking fractional per-worker-tab subpixel raster phases
 * during parallel `--concurrency` MP4 renders.
 */
export function buildCrispTranslateYTransform(
  offsetPx: number,
  centerVertical: boolean = false
): string {
  const snapped = Number.isFinite(offsetPx) ? Math.round(offsetPx) : 0;
  const cleanZero = snapped === 0 ? 0 : snapped;

  if (centerVertical) {
    return cleanZero === 0
      ? 'translateY(-50%)'
      : `translateY(calc(-50% + ${cleanZero}px))`;
  }

  return cleanZero === 0 ? 'none' : `translateY(${cleanZero}px)`;
}

const SIMPLE_TRANSLATE3D_RE =
  /^\s*translate3d\(\s*([-+]?\d*\.?\d+)(?:px)?\s*,\s*([-+]?\d*\.?\d+)(?:px)?\s*,\s*([-+]?\d*\.?\d+)(?:px)?\s*\)(?:\s+scale\(\s*([-+]?\d*\.?\d+)\s*\))?\s*$/;

const SIMPLE_TRANSLATE_Y_RE =
  /^\s*translateY\(\s*([-+]?\d*\.?\d+)(?:px)?\s*\)(?:\s+scale\(\s*([-+]?\d*\.?\d+)\s*\))?\s*$/;

const GPU_LAYER_WILL_CHANGE_RE = /^(?:transform|opacity)(?:\s*,\s*(?:transform|opacity))*$/i;

/**
 * Sanitizes caller-supplied overlay styles (`style` prop on `FloatingEditorialDisplay`
 * and `PaperRibbonTimeline`):
 * 1. Strips persistent `willChange: 'transform'` / `'transform, opacity'` so parallel
 *    Chromium render tabs never pin stale first-frame GPU bitmaps across the whole video.
 * 2. Quantizes pure `translate3d(x, y, 0)` / `translateY(y)` + optional `scale(s)`
 *    offsets to exact integer pixels and snaps settled identity transforms to `'none'`.
 */
export function sanitizeEditorialOverlayStyle(
  customStyle?: React.CSSProperties
): React.CSSProperties | undefined {
  if (!customStyle) return undefined;

  let nextStyle: React.CSSProperties | null = null;
  const ensureCopy = (): React.CSSProperties => {
    if (!nextStyle) {
      nextStyle = { ...customStyle };
    }
    return nextStyle;
  };

  if (
    typeof customStyle.willChange === 'string' &&
    GPU_LAYER_WILL_CHANGE_RE.test(customStyle.willChange.trim())
  ) {
    const copy = ensureCopy();
    delete copy.willChange;
  }

  if (typeof customStyle.transform === 'string') {
    const raw = customStyle.transform;
    const match3d = SIMPLE_TRANSLATE3D_RE.exec(raw);
    if (match3d) {
      const tx = Math.round(Number(match3d[1]));
      const ty = Math.round(Number(match3d[2]));
      const tz = Math.round(Number(match3d[3]));
      const rawScale = match3d[4] !== undefined ? Number(match3d[4]) : 1;
      const scaleSettled = Math.abs(rawScale - 1) <= SETTLE_EPSILON;
      const cleanTx = tx === 0 ? 0 : tx;
      const cleanTy = ty === 0 ? 0 : ty;

      if (tz === 0) {
        const copy = ensureCopy();
        if (cleanTx === 0 && cleanTy === 0 && scaleSettled) {
          copy.transform = 'none';
        } else {
          const parts: string[] = [];
          if (cleanTx !== 0 || cleanTy !== 0) {
            parts.push(
              cleanTx === 0
                ? `translateY(${cleanTy}px)`
                : `translate(${cleanTx}px, ${cleanTy}px)`
            );
          }
          if (!scaleSettled) {
            parts.push(`scale(${rawScale.toFixed(4)})`);
          }
          copy.transform = parts.join(' ');
        }
      }
    } else {
      const matchY = SIMPLE_TRANSLATE_Y_RE.exec(raw);
      if (matchY) {
        const ty = Math.round(Number(matchY[1]));
        const rawScale = matchY[2] !== undefined ? Number(matchY[2]) : 1;
        const scaleSettled = Math.abs(rawScale - 1) <= SETTLE_EPSILON;
        const cleanTy = ty === 0 ? 0 : ty;
        const copy = ensureCopy();
        if (cleanTy === 0 && scaleSettled) {
          copy.transform = 'none';
        } else {
          const parts: string[] = [];
          if (cleanTy !== 0) {
            parts.push(`translateY(${cleanTy}px)`);
          }
          if (!scaleSettled) {
            parts.push(`scale(${rawScale.toFixed(4)})`);
          }
          copy.transform = parts.join(' ');
        }
      }
    }
  }

  return nextStyle ?? customStyle;
}
