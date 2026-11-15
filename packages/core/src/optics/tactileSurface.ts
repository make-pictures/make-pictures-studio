import type React from 'react';
import {
  getCardChromeStyle,
  resolveStyleOptics,
  type StylePreset,
} from '../style';

export type TactileElevation = 'flat' | 'resting' | 'lifted' | 'floating';

export interface TactileSurfaceOptions {
  elevation?: TactileElevation;
  tiltDeg?: number;
  lightAngleDeg?: number;
  overrides?: React.CSSProperties;
}

const ELEVATION_SPECS: Record<
  TactileElevation,
  { dist: number; blur: number; contactBlur: number; alphaScale: number }
> = {
  flat: { dist: 2, blur: 4, contactBlur: 1.5, alphaScale: 0.55 },
  resting: { dist: 9, blur: 20, contactBlur: 2.5, alphaScale: 0.9 },
  lifted: { dist: 18, blur: 34, contactBlur: 3.5, alphaScale: 1.15 },
  floating: { dist: 28, blur: 52, contactBlur: 5, alphaScale: 1.35 },
};

/**
 * Converts `lightAngleDeg` (`[-60, +60]`, where `0°` is straight from top,
 * negative angles come from top-left, positive angles from top-right) into
 * the opposite `(dx, dy)` cast-shadow vector on the table plane.
 */
export function computeDirectionalShadowVector(
  lightAngleDeg: number,
  distancePx: number
): { dx: number; dy: number } {
  const rad = (lightAngleDeg * Math.PI) / 180;
  const dx = Number((-Math.sin(rad) * distancePx).toFixed(2));
  const dy = Number((Math.cos(rad) * distancePx).toFixed(2));
  return { dx, dy };
}

/**
 * Builds physical two-stage (tight contact + directional cast) surface styling
 * coupled to `style.optics.lightAngleDeg`, `style.optics.lightingRig`, and `style.surface.cardTreatment`.
 */
export function getTactileSurfaceStyle(
  style: StylePreset,
  options?: TactileSurfaceOptions
): React.CSSProperties {
  const optics = resolveStyleOptics(style);
  const elevation = options?.elevation ?? 'resting';
  const angle = options?.lightAngleDeg ?? optics.lightAngleDeg;
  const spec = ELEVATION_SPECS[elevation];
  const { dx, dy } = computeDirectionalShadowVector(angle, spec.dist);

  const baseChrome = getCardChromeStyle(style);
  const { palette, surface } = style;

  let boxShadow: string;
  if (surface.cardTreatment === 'brutalist-hard') {
    const hardOffset = Math.max(3, Math.round(spec.dist * 0.55));
    const hardDx = angle <= 0 ? hardOffset : -hardOffset;
    boxShadow = `${hardDx}px ${hardOffset}px 0px ${palette.inkBorder}`;
  } else if (surface.isDark || optics.lightingRig === 'darkroom-halation') {
    const glowRadius = Math.round(18 + optics.halation * 34);
    const glowAlpha = Math.min(0.45, Number((0.1 + optics.halation * 0.28).toFixed(2)));
    boxShadow = `0 1.5px ${spec.contactBlur}px rgba(0, 0, 0, 0.62), ${dx}px ${dy}px ${spec.blur}px rgba(0, 0, 0, 0.52), 0 0 ${glowRadius}px rgba(255, 255, 255, ${glowAlpha * 0.16})`;
  } else {
    const contactAlpha = Number((0.12 * spec.alphaScale).toFixed(3));
    const castAlpha = Number((0.095 * spec.alphaScale).toFixed(3));
    boxShadow = `0 1.5px ${spec.contactBlur}px rgba(24, 22, 21, ${contactAlpha}), ${dx}px ${dy}px ${spec.blur}px rgba(24, 22, 21, ${castAlpha})`;
  }

  const paperTextureOverlay =
    !surface.isDark &&
    (surface.cardTreatment === 'editorial-ink' ||
      surface.cardTreatment === 'tactile-cutout')
      ? `linear-gradient(${135 + angle}deg, rgba(255,255,255,0.52) 0%, rgba(255,255,255,0) 56%)`
      : undefined;

  const tiltTransform =
    typeof options?.tiltDeg === 'number' && Math.abs(options.tiltDeg) > 0.001
      ? `rotate(${Number(options.tiltDeg.toFixed(3))}deg)`
      : undefined;

  const result: React.CSSProperties = {
    ...baseChrome,
    boxShadow,
    ...(paperTextureOverlay ? { backgroundImage: paperTextureOverlay } : {}),
    ...(tiltTransform ? { transform: tiltTransform } : {}),
  };

  if (!options?.overrides) {
    return result;
  }

  const mergedTransform =
    tiltTransform && options.overrides.transform
      ? `${options.overrides.transform} ${tiltTransform}`
      : options.overrides.transform ?? tiltTransform;

  return {
    ...result,
    ...options.overrides,
    ...(mergedTransform ? { transform: mergedTransform } : {}),
  };
}
