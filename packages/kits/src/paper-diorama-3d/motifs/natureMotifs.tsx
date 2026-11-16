import React, { useCallback, useMemo } from 'react';
import {
  createSeededRandom,
  formatHeadingText,
  useStudioStyle,
} from '@make-pictures/core';
import { PaperCutout3D } from '../PaperCutout3D';
import {
  buildPaletteCacheDeps,
  resolveSafeMarginPx,
  resolveScenicCutoutPalette,
  safeBlendColor,
  type ScenicCutoutCommonProps,
  type ScenicCutoutPalette,
} from './palette';

// ============================================================================
// 1. SunburstArchCutout3D — Celestial Halo & Romanesque Studio Arch
// ============================================================================

export interface SunburstArchDrawOptions {
  seed?: string | number;
  rayCount?: number;
  whiteBorderPx?: number;
}

export function drawSunburstArchMotif(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pal: ScenicCutoutPalette,
  options?: SunburstArchDrawOptions
): void {
  const pad = resolveSafeMarginPx(options?.whiteBorderPx);
  const rayCount = Math.max(7, Math.min(19, Math.round(options?.rayCount ?? 13)));
  const rng = createSeededRandom(`sunburst-arch:${String(options?.seed ?? 'v1')}`);

  const left = pad + 6;
  const right = w - pad - 6;
  const top = pad + 6;
  const bottom = h - pad - 2;
  const iw = right - left;
  const ih = bottom - top;
  const cx = w * 0.5;

  const plinthH = 26;
  const springY = bottom - plinthH;
  const outerR = Math.min(iw * 0.44, ih - plinthH - 6);
  const innerR = outerR * 0.82;
  const solarY = springY - innerR * 0.14;

  // 1. Outer architectural arch masonry frame
  const frameGrad = ctx.createLinearGradient(cx - outerR, springY - outerR, cx + outerR, bottom);
  frameGrad.addColorStop(0, pal.surface);
  frameGrad.addColorStop(0.55, pal.elevated);
  frameGrad.addColorStop(1, safeBlendColor(0.28, pal.elevated, pal.primary));

  ctx.fillStyle = frameGrad;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(cx - outerR, springY);
  ctx.arc(cx, springY, outerR, Math.PI, Math.PI * 2);
  ctx.lineTo(cx + outerR, springY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 2. Inner celestial vault gradient
  const vaultGrad = ctx.createRadialGradient(
    cx,
    solarY,
    innerR * 0.08,
    cx,
    solarY,
    innerR
  );
  vaultGrad.addColorStop(0, pal.sunCore);
  vaultGrad.addColorStop(0.42, pal.sunGlow);
  vaultGrad.addColorStop(0.82, safeBlendColor(0.55, pal.primary, pal.elevated));
  vaultGrad.addColorStop(1, safeBlendColor(0.68, pal.secondary, pal.elevated));

  ctx.fillStyle = vaultGrad;
  ctx.beginPath();
  ctx.moveTo(cx - innerR, springY);
  ctx.arc(cx, springY, innerR, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();

  // 3. Radiating tonal sunburst wedges strictly inside innerR
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - innerR, springY);
  ctx.arc(cx, springY, innerR, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  const spanRad = Math.PI - 0.14;
  const startBase = Math.PI + 0.07;
  const wedgeStep = spanRad / rayCount;
  const rayRadius = innerR * 0.97;

  for (let i = 0; i < rayCount; i++) {
    if (i % 2 !== 0) continue;
    const jitter = (rng() - 0.5) * 0.015;
    const a0 = startBase + i * wedgeStep + jitter;
    const a1 = Math.min(Math.PI * 2 - 0.04, a0 + wedgeStep * 0.58);
    ctx.fillStyle =
      i % 4 === 0
        ? pal.sunCore
        : safeBlendColor(0.32, pal.sunCore, pal.brassLight);
    ctx.globalAlpha = pal.isDark ? 0.42 : 0.68;
    ctx.beginPath();
    ctx.moveTo(cx, solarY);
    ctx.lineTo(cx + Math.cos(a0) * rayRadius, solarY + Math.sin(a0) * rayRadius);
    ctx.lineTo(cx + Math.cos(a1) * rayRadius, solarY + Math.sin(a1) * rayRadius);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // 4. Concentric brass & ink astrolabe rings
  ctx.strokeStyle = pal.brassLight;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, solarY, innerR * 0.66, Math.PI + 0.06, Math.PI * 2 - 0.06);
  ctx.stroke();

  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  ctx.arc(cx, solarY, innerR * 0.46, Math.PI + 0.08, Math.PI * 2 - 0.08);
  ctx.stroke();
  ctx.setLineDash([]);

  // 5. Rising solar disc at the arch hearth
  const sunDiscR = innerR * 0.25;
  ctx.fillStyle = pal.sunCore;
  ctx.strokeStyle = pal.brassDark;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(cx - sunDiscR, springY);
  ctx.arc(cx, springY, sunDiscR, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner arch soffit contour + keystone ornament
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(cx - innerR, springY);
  ctx.arc(cx, springY, innerR, Math.PI, Math.PI * 2);
  ctx.stroke();

  const keyW = 24;
  const keyH = outerR - innerR + 6;
  const keyTopY = springY - outerR - 2;
  ctx.fillStyle = pal.brassLight;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(cx - keyW * 0.5, Math.max(top, keyTopY), keyW, keyH, 5);
  ctx.fill();
  ctx.stroke();

  // 6. Grounded architectural stepped plinth base
  const plinthW = Math.min(iw, outerR * 2 + 32);
  ctx.fillStyle = safeBlendColor(0.35, pal.elevated, pal.ink);
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(cx - plinthW * 0.5, springY, plinthW, plinthH, 8);
  ctx.fill();
  ctx.stroke();
}

export interface SunburstArchCutout3DProps extends ScenicCutoutCommonProps {
  /** Number of radiating sunburst divisions (default 13) */
  rayCount?: number;
}

export const SunburstArchCutout3D: React.FC<SunburstArchCutout3DProps> = ({
  cacheKey = 'scenic-sunburst-arch',
  width = 5.4,
  height = 3.1,
  pixelWidth = 768,
  pixelHeight = 440,
  whiteBorderPx = 14,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  anchor = 'bottom',
  thickness = 0.044,
  castShadow = true,
  receiveShadow = true,
  opacity = 1,
  primaryColor,
  accentColor,
  secondaryColor,
  surfaceColor,
  inkColor,
  seed = 'sunburst-v1',
  rayCount = 13,
}) => {
  const style = useStudioStyle();
  const pal = useMemo(
    () =>
      resolveScenicCutoutPalette(style, {
        primaryColor,
        accentColor,
        secondaryColor,
        surfaceColor,
        inkColor,
      }),
    [style, primaryColor, accentColor, secondaryColor, surfaceColor, inkColor]
  );

  const cacheDeps = useMemo(
    () => buildPaletteCacheDeps(pal, [seed, rayCount, whiteBorderPx]),
    [pal, seed, rayCount, whiteBorderPx]
  );

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      drawSunburstArchMotif(ctx, w, h, pal, { seed, rayCount, whiteBorderPx });
    },
    [pal, seed, rayCount, whiteBorderPx]
  );

  return (
    <PaperCutout3D
      cacheKey={cacheKey}
      cacheDeps={cacheDeps}
      width={width}
      height={height}
      pixelWidth={pixelWidth}
      pixelHeight={pixelHeight}
      whiteBorderPx={whiteBorderPx}
      position={position}
      rotation={rotation}
      scale={scale}
      anchor={anchor}
      thickness={thickness}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      opacity={opacity}
      draw={draw}
    />
  );
};

// ============================================================================
// 2. MountainRangeCutout3D — Kurzgesagt / Storybook Multi-Ridge Peaks
// ============================================================================

export interface MountainRangeDrawOptions {
  seed?: string | number;
  snowCapRatio?: number;
  whiteBorderPx?: number;
}

export function drawMountainRangeMotif(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pal: ScenicCutoutPalette,
  options?: MountainRangeDrawOptions
): void {
  const pad = resolveSafeMarginPx(options?.whiteBorderPx);
  const snowRatio = Math.max(0.2, Math.min(0.52, options?.snowCapRatio ?? 0.36));
  const rng = createSeededRandom(`mountain-range:${String(options?.seed ?? 'v1')}`);

  const left = pad + 6;
  const right = w - pad - 6;
  const top = pad + 6;
  const bottom = h - pad - 4;
  const iw = right - left;
  const ih = bottom - top;
  const baseY = bottom - 12;

  const sunlitSlopeTop = safeBlendColor(0.55, pal.primary, pal.brassLight);
  const sunlitSlopeBot = safeBlendColor(0.45, pal.primary, pal.elevated);
  const shadowSlopeTop = safeBlendColor(0.58, pal.secondary, pal.ink);
  const shadowSlopeBot = safeBlendColor(0.35, pal.secondary, pal.elevated);

  // 1. Far atmospheric ridge silhouette
  ctx.fillStyle = safeBlendColor(0.55, pal.secondary, pal.elevated);
  ctx.beginPath();
  ctx.moveTo(left + iw * 0.06, baseY);
  ctx.lineTo(left + iw * 0.18, top + ih * 0.38);
  ctx.lineTo(left + iw * 0.36, top + ih * 0.24);
  ctx.lineTo(left + iw * 0.56, top + ih * 0.42);
  ctx.lineTo(left + iw * 0.69, top + ih * 0.22);
  ctx.lineTo(left + iw * 0.92, baseY);
  ctx.closePath();
  ctx.fill();

  const peaks = [
    {
      xL: left + 4,
      xPeak: left + iw * (0.25 + (rng() - 0.5) * 0.02),
      xR: left + iw * 0.56,
      yPeak: top + ih * 0.2,
      ridgeBendX: -12,
    },
    {
      xL: left + iw * 0.45,
      xPeak: left + iw * (0.76 + (rng() - 0.5) * 0.02),
      xR: right - 4,
      yPeak: top + ih * 0.16,
      ridgeBendX: 14,
    },
    {
      xL: left + iw * 0.18,
      xPeak: left + iw * 0.5,
      xR: left + iw * 0.84,
      yPeak: top + ih * 0.04,
      ridgeBendX: 10,
    },
  ];

  // 2. Draw each peak with split sunlit/shadow ridge facets & sculpted snow cap
  for (const p of peaks) {
    const midSpineX = p.xPeak + p.ridgeBendX;
    const midSpineY = p.yPeak + (baseY - p.yPeak) * 0.56;

    // Left sunlit facet
    const sunGrad = ctx.createLinearGradient(p.xL, p.yPeak, p.xPeak, baseY);
    sunGrad.addColorStop(0, sunlitSlopeTop);
    sunGrad.addColorStop(1, sunlitSlopeBot);
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.moveTo(p.xPeak, p.yPeak);
    ctx.lineTo(midSpineX, midSpineY);
    ctx.lineTo(p.xPeak + p.ridgeBendX * 0.5, baseY);
    ctx.lineTo(p.xL, baseY);
    ctx.closePath();
    ctx.fill();

    // Right shadow facet
    const shGrad = ctx.createLinearGradient(p.xPeak, p.yPeak, p.xR, baseY);
    shGrad.addColorStop(0, shadowSlopeTop);
    shGrad.addColorStop(1, shadowSlopeBot);
    ctx.fillStyle = shGrad;
    ctx.beginPath();
    ctx.moveTo(p.xPeak, p.yPeak);
    ctx.lineTo(p.xR, baseY);
    ctx.lineTo(p.xPeak + p.ridgeBendX * 0.5, baseY);
    ctx.lineTo(midSpineX, midSpineY);
    ctx.closePath();
    ctx.fill();

    // Sculpted two-tone snow cap
    const peakH = baseY - p.yPeak;
    const snowY = p.yPeak + peakH * snowRatio;
    const tSnow = snowRatio;
    const snowXL = p.xPeak + (p.xL - p.xPeak) * tSnow;
    const snowXR = p.xPeak + (p.xR - p.xPeak) * tSnow;
    const snowSpineX = p.xPeak + p.ridgeBendX * (tSnow * 1.35);

    ctx.fillStyle = pal.snowLight;
    ctx.beginPath();
    ctx.moveTo(p.xPeak, p.yPeak);
    ctx.lineTo(snowSpineX, snowY + 8);
    ctx.lineTo((snowXL + snowSpineX) * 0.5, snowY - 8);
    ctx.lineTo(snowXL, snowY + 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal.snowShadow;
    ctx.beginPath();
    ctx.moveTo(p.xPeak, p.yPeak);
    ctx.lineTo(snowXR, snowY + 5);
    ctx.lineTo((snowXR + snowSpineX) * 0.5, snowY - 6);
    ctx.lineTo(snowSpineX, snowY + 8);
    ctx.closePath();
    ctx.fill();

    // Crisp outer peak & ridge contour
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.xL, baseY);
    ctx.lineTo(p.xPeak, p.yPeak);
    ctx.lineTo(p.xR, baseY);
    ctx.stroke();

    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(p.xPeak, p.yPeak);
    ctx.lineTo(midSpineX, midSpineY);
    ctx.lineTo(p.xPeak + p.ridgeBendX * 0.5, baseY);
    ctx.stroke();
  }

  // 3. Soft valley mist band + grounded alpine plinth base
  const mistGrad = ctx.createLinearGradient(0, baseY - ih * 0.24, 0, baseY);
  mistGrad.addColorStop(0, 'rgba(255, 253, 248, 0)');
  mistGrad.addColorStop(1, pal.isDark ? 'rgba(248, 250, 252, 0.16)' : 'rgba(255, 253, 248, 0.52)');
  ctx.fillStyle = mistGrad;
  ctx.fillRect(left + 12, baseY - ih * 0.22, iw - 24, ih * 0.22);

  ctx.fillStyle = safeBlendColor(0.42, pal.foliageMid, pal.elevated);
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(left + 2, baseY - 2, iw - 4, 14, 7);
  ctx.fill();
  ctx.stroke();
}

export interface MountainRangeCutout3DProps extends ScenicCutoutCommonProps {
  /** Relative height of sunlit snow caps (0.2..0.52, default 0.36) */
  snowCapRatio?: number;
}

export const MountainRangeCutout3D: React.FC<MountainRangeCutout3DProps> = ({
  cacheKey = 'scenic-mountain-range',
  width = 5.8,
  height = 2.7,
  pixelWidth = 820,
  pixelHeight = 384,
  whiteBorderPx = 14,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  anchor = 'bottom',
  thickness = 0.046,
  castShadow = true,
  receiveShadow = true,
  opacity = 1,
  primaryColor,
  accentColor,
  secondaryColor,
  surfaceColor,
  inkColor,
  seed = 'mountains-v1',
  snowCapRatio = 0.36,
}) => {
  const style = useStudioStyle();
  const pal = useMemo(
    () =>
      resolveScenicCutoutPalette(style, {
        primaryColor,
        accentColor,
        secondaryColor,
        surfaceColor,
        inkColor,
      }),
    [style, primaryColor, accentColor, secondaryColor, surfaceColor, inkColor]
  );

  const cacheDeps = useMemo(
    () => buildPaletteCacheDeps(pal, [seed, snowCapRatio, whiteBorderPx]),
    [pal, seed, snowCapRatio, whiteBorderPx]
  );

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      drawMountainRangeMotif(ctx, w, h, pal, { seed, snowCapRatio, whiteBorderPx });
    },
    [pal, seed, snowCapRatio, whiteBorderPx]
  );

  return (
    <PaperCutout3D
      cacheKey={cacheKey}
      cacheDeps={cacheDeps}
      width={width}
      height={height}
      pixelWidth={pixelWidth}
      pixelHeight={pixelHeight}
      whiteBorderPx={whiteBorderPx}
      position={position}
      rotation={rotation}
      scale={scale}
      anchor={anchor}
      thickness={thickness}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      opacity={opacity}
      draw={draw}
    />
  );
};

// ============================================================================
// 3. CloudCanopyCutout3D — Fluffy Layered Storybook Cumulus Clouds
// ============================================================================

export interface CloudCanopyDrawOptions {
  seed?: string | number;
  tint?: string;
  whiteBorderPx?: number;
}

export function drawCloudCanopyMotif(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pal: ScenicCutoutPalette,
  options?: CloudCanopyDrawOptions
): void {
  const pad = resolveSafeMarginPx(options?.whiteBorderPx);
  const rng = createSeededRandom(`cloud-canopy:${String(options?.seed ?? 'v1')}`);

  const left = pad + 8;
  const right = w - pad - 8;
  const top = pad + 8;
  const bottom = h - pad - 6;
  const iw = right - left;
  const ih = bottom - top;
  const baseY = bottom - 6;

  const cloudTint =
    options?.tint ??
    (pal.isDark
      ? safeBlendColor(0.28, '#E2E8F0', pal.primary)
      : safeBlendColor(0.14, '#FFFDF9', pal.sunGlow));
  const cloudCrown = pal.isDark
    ? safeBlendColor(0.18, '#F8FAFC', cloudTint)
    : '#FFFFFF';
  const cloudBelly = pal.isDark
    ? safeBlendColor(0.42, '#94A3B8', pal.secondary)
    : safeBlendColor(0.24, '#FDE68A', pal.primary);

  // 1. Background secondary puff layer
  ctx.fillStyle = safeBlendColor(0.45, cloudCrown, pal.elevated);
  ctx.beginPath();
  ctx.ellipse(left + iw * 0.28, top + ih * 0.56, iw * 0.16, ih * 0.26, 0, 0, Math.PI * 2);
  ctx.ellipse(left + iw * 0.72, top + ih * 0.52, iw * 0.17, ih * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Main sculpted flat-horizon cumulus canopy
  const crestShift = (rng() - 0.5) * iw * 0.03;
  const cloudGrad = ctx.createLinearGradient(0, top, 0, baseY);
  cloudGrad.addColorStop(0, cloudCrown);
  cloudGrad.addColorStop(0.68, cloudTint);
  cloudGrad.addColorStop(1, cloudBelly);

  ctx.fillStyle = cloudGrad;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 4;

  ctx.beginPath();
  ctx.moveTo(left + iw * 0.1, baseY);
  ctx.lineTo(left + iw * 0.9, baseY);
  ctx.bezierCurveTo(
    right - 2,
    baseY,
    right - 2,
    baseY - ih * 0.44,
    left + iw * 0.84,
    baseY - ih * 0.46
  );
  ctx.bezierCurveTo(
    left + iw * 0.82,
    top + ih * 0.16,
    left + iw * 0.65,
    top + ih * 0.12,
    left + iw * 0.58 + crestShift,
    top + ih * 0.3
  );
  ctx.bezierCurveTo(
    left + iw * 0.52,
    top + 2,
    left + iw * 0.31,
    top + 4,
    left + iw * 0.27 + crestShift,
    top + ih * 0.38
  );
  ctx.bezierCurveTo(
    left + iw * 0.16,
    top + ih * 0.32,
    left + iw * 0.06,
    baseY - ih * 0.48,
    left + iw * 0.1,
    baseY - ih * 0.34
  );
  ctx.bezierCurveTo(
    left + 2,
    baseY - ih * 0.28,
    left + 2,
    baseY,
    left + iw * 0.1,
    baseY
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 3. Warm horizon underbelly band + sunlit inner puff curl accents
  ctx.fillStyle = cloudBelly;
  ctx.globalAlpha = 0.36;
  ctx.beginPath();
  ctx.ellipse(w * 0.5, baseY - ih * 0.12, iw * 0.34, ih * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = safeBlendColor(0.5, pal.ink, cloudBelly);
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(left + iw * 0.42, top + ih * 0.46, ih * 0.16, Math.PI * 1.12, Math.PI * 1.82);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(left + iw * 0.66, top + ih * 0.52, ih * 0.14, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
}

export interface CloudCanopyCutout3DProps extends ScenicCutoutCommonProps {
  /** Optional cloud tint override */
  tint?: string;
}

export const CloudCanopyCutout3D: React.FC<CloudCanopyCutout3DProps> = ({
  cacheKey = 'scenic-cloud-canopy',
  width = 3.2,
  height = 1.25,
  pixelWidth = 576,
  pixelHeight = 240,
  whiteBorderPx = 14,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  anchor = 'bottom',
  thickness = 0.038,
  castShadow = true,
  receiveShadow = true,
  opacity = 1,
  primaryColor,
  accentColor,
  secondaryColor,
  surfaceColor,
  inkColor,
  tint,
  seed = 'clouds-v1',
}) => {
  const style = useStudioStyle();
  const pal = useMemo(
    () =>
      resolveScenicCutoutPalette(style, {
        primaryColor,
        accentColor,
        secondaryColor,
        surfaceColor,
        inkColor,
      }),
    [style, primaryColor, accentColor, secondaryColor, surfaceColor, inkColor]
  );

  const cacheDeps = useMemo(
    () => buildPaletteCacheDeps(pal, [seed, tint, whiteBorderPx]),
    [pal, seed, tint, whiteBorderPx]
  );

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      drawCloudCanopyMotif(ctx, w, h, pal, { seed, tint, whiteBorderPx });
    },
    [pal, seed, tint, whiteBorderPx]
  );

  return (
    <PaperCutout3D
      cacheKey={cacheKey}
      cacheDeps={cacheDeps}
      width={width}
      height={height}
      pixelWidth={pixelWidth}
      pixelHeight={pixelHeight}
      whiteBorderPx={whiteBorderPx}
      position={position}
      rotation={rotation}
      scale={scale}
      anchor={anchor}
      thickness={thickness}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      opacity={opacity}
      draw={draw}
    />
  );
};

// ============================================================================
// 4. PineGroveCutout3D — Layered Botanical Cypress & Alpine Pine Grove
// ============================================================================

export interface PineGroveDrawOptions {
  seed?: string | number;
  treeCount?: 2 | 3;
  whiteBorderPx?: number;
}

export function drawPineGroveMotif(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pal: ScenicCutoutPalette,
  options?: PineGroveDrawOptions
): void {
  const pad = resolveSafeMarginPx(options?.whiteBorderPx);
  const treeCount = options?.treeCount ?? 3;
  const rng = createSeededRandom(`pine-grove:${String(options?.seed ?? 'v1')}`);

  const left = pad + 8;
  const right = w - pad - 8;
  const top = pad + 8;
  const bottom = h - pad - 4;
  const iw = right - left;
  const ih = bottom - top;
  const moundBaseY = bottom - 4;

  const trees =
    treeCount === 2
      ? [
          { cx: left + iw * 0.34, topY: top + ih * 0.18, halfW: iw * 0.24 },
          { cx: left + iw * 0.66, topY: top + ih * 0.05, halfW: iw * 0.27 },
        ]
      : [
          {
            cx: left + iw * 0.26,
            topY: top + ih * (0.24 + (rng() - 0.5) * 0.02),
            halfW: iw * 0.2,
          },
          {
            cx: left + iw * 0.75,
            topY: top + ih * (0.19 + (rng() - 0.5) * 0.02),
            halfW: iw * 0.21,
          },
          {
            cx: left + iw * 0.5,
            topY: top + ih * 0.03,
            halfW: iw * 0.26,
          },
        ];

  for (const tree of trees) {
    const trunkTop = moundBaseY - ih * 0.24;
    const trunkW = Math.max(14, tree.halfW * 0.24);

    // Tapered cedar trunk
    ctx.fillStyle = pal.woodDark;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tree.cx - trunkW * 0.38, trunkTop);
    ctx.lineTo(tree.cx + trunkW * 0.38, trunkTop);
    ctx.lineTo(tree.cx + trunkW * 0.55, moundBaseY - 8);
    ctx.lineTo(tree.cx - trunkW * 0.55, moundBaseY - 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3 tiered botanical foliage crowns (bottom -> top) with two-tone sunlit/shadow halves
    const crownSpan = moundBaseY - 34 - tree.topY;
    const tiers = [
      { yTop: tree.topY + crownSpan * 0.36, yBot: moundBaseY - 32, wScale: 1.0 },
      { yTop: tree.topY + crownSpan * 0.16, yBot: tree.topY + crownSpan * 0.72, wScale: 0.82 },
      { yTop: tree.topY, yBot: tree.topY + crownSpan * 0.46, wScale: 0.62 },
    ];

    for (const tier of tiers) {
      const hw = tree.halfW * tier.wScale;
      const sunGrad = ctx.createLinearGradient(
        tree.cx - hw,
        tier.yTop,
        tree.cx,
        tier.yBot
      );
      sunGrad.addColorStop(0, pal.foliageLight);
      sunGrad.addColorStop(1, pal.foliageMid);

      // Left sunlit foliage half
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.moveTo(tree.cx, tier.yTop);
      ctx.lineTo(tree.cx, tier.yBot + 4);
      ctx.quadraticCurveTo(
        tree.cx - hw * 0.52,
        tier.yBot + 8,
        tree.cx - hw,
        tier.yBot - 2
      );
      ctx.closePath();
      ctx.fill();

      // Right deep forest shadow half
      ctx.fillStyle = pal.foliageDeep;
      ctx.beginPath();
      ctx.moveTo(tree.cx, tier.yTop);
      ctx.lineTo(tree.cx + hw, tier.yBot - 2);
      ctx.quadraticCurveTo(
        tree.cx + hw * 0.52,
        tier.yBot + 8,
        tree.cx,
        tier.yBot + 4
      );
      ctx.closePath();
      ctx.fill();

      // Botanical silhouette contour + center needle stem
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(tree.cx, tier.yTop);
      ctx.lineTo(tree.cx - hw, tier.yBot - 2);
      ctx.quadraticCurveTo(tree.cx, tier.yBot + 10, tree.cx + hw, tier.yBot - 2);
      ctx.closePath();
      ctx.stroke();
    }
  }

  // Shared mossy forest mound uniting all trunks into one crisp die-cut base
  const moundGrad = ctx.createLinearGradient(left, moundBaseY - 24, right, moundBaseY);
  moundGrad.addColorStop(0, pal.foliageLight);
  moundGrad.addColorStop(0.55, pal.foliageMid);
  moundGrad.addColorStop(1, pal.foliageDeep);

  ctx.fillStyle = moundGrad;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 3.8;
  ctx.beginPath();
  ctx.moveTo(left + 8, moundBaseY);
  ctx.quadraticCurveTo(w * 0.5, moundBaseY - 28, right - 8, moundBaseY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

export interface PineGroveCutout3DProps extends ScenicCutoutCommonProps {
  /** Number of clustered pine/cypress trees (2 or 3, default 3) */
  treeCount?: 2 | 3;
}

export const PineGroveCutout3D: React.FC<PineGroveCutout3DProps> = ({
  cacheKey = 'scenic-pine-grove',
  width = 1.9,
  height = 2.1,
  pixelWidth = 384,
  pixelHeight = 420,
  whiteBorderPx = 14,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  anchor = 'bottom',
  thickness = 0.04,
  castShadow = true,
  receiveShadow = true,
  opacity = 1,
  primaryColor,
  accentColor,
  secondaryColor,
  surfaceColor,
  inkColor,
  seed = 'pines-v1',
  treeCount = 3,
}) => {
  const style = useStudioStyle();
  const pal = useMemo(
    () =>
      resolveScenicCutoutPalette(style, {
        primaryColor,
        accentColor,
        secondaryColor,
        surfaceColor,
        inkColor,
      }),
    [style, primaryColor, accentColor, secondaryColor, surfaceColor, inkColor]
  );

  const cacheDeps = useMemo(
    () => buildPaletteCacheDeps(pal, [seed, treeCount, whiteBorderPx]),
    [pal, seed, treeCount, whiteBorderPx]
  );

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      drawPineGroveMotif(ctx, w, h, pal, { seed, treeCount, whiteBorderPx });
    },
    [pal, seed, treeCount, whiteBorderPx]
  );

  return (
    <PaperCutout3D
      cacheKey={cacheKey}
      cacheDeps={cacheDeps}
      width={width}
      height={height}
      pixelWidth={pixelWidth}
      pixelHeight={pixelHeight}
      whiteBorderPx={whiteBorderPx}
      position={position}
      rotation={rotation}
      scale={scale}
      anchor={anchor}
      thickness={thickness}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      opacity={opacity}
      draw={draw}
    />
  );
};

// ============================================================================
// 5. AtelierDeskCutout3D — Studio Workbench, Brass Lamp & Open Sketchbook
// ============================================================================

export interface AtelierDeskDrawOptions {
  seed?: string | number;
  plaqueTitle?: string;
  lampOn?: boolean;
  whiteBorderPx?: number;
}

export function drawAtelierDeskMotif(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pal: ScenicCutoutPalette,
  options?: AtelierDeskDrawOptions
): void {
  const pad = resolveSafeMarginPx(options?.whiteBorderPx);
  const lampOn = options?.lampOn ?? true;
  const rng = createSeededRandom(`atelier-desk:${String(options?.seed ?? 'v1')}`);

  const left = pad + 8;
  const right = w - pad - 8;
  const top = pad + 8;
  const bottom = h - pad - 4;
  const iw = right - left;
  const ih = bottom - top;
  const cx = w * 0.5;

  const deskY = top + ih * 0.52;
  const deskH = 20;
  const apronH = 42;
  const floorRunnerY = bottom - 14;

  // 1. Warm lamp light cone (drawn behind easel & tabletop)
  const lampShadeX = left + iw * 0.29;
  const lampShadeY = top + ih * 0.2;
  if (lampOn) {
    const coneGrad = ctx.createLinearGradient(lampShadeX, lampShadeY, cx + 20, deskY);
    coneGrad.addColorStop(0, pal.isDark ? 'rgba(254, 243, 199, 0.44)' : 'rgba(253, 230, 138, 0.62)');
    coneGrad.addColorStop(1, 'rgba(253, 230, 138, 0.04)');
    ctx.fillStyle = coneGrad;
    ctx.beginPath();
    ctx.moveTo(lampShadeX - 8, lampShadeY + 12);
    ctx.lineTo(lampShadeX + 18, lampShadeY + 8);
    ctx.lineTo(cx + iw * 0.22, deskY + 2);
    ctx.lineTo(left + iw * 0.18, deskY + 2);
    ctx.closePath();
    ctx.fill();
  }

  // 2. Tapered wooden legs, stretcher rail & grounded floor runner
  const legLeftTopX = left + iw * 0.14;
  const legRightTopX = right - iw * 0.14;
  ctx.fillStyle = pal.woodDark;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 3.5;

  // Crossbar stretcher
  ctx.beginPath();
  ctx.roundRect(
    legLeftTopX - 4,
    floorRunnerY - 34,
    legRightTopX - legLeftTopX + 8,
    12,
    4
  );
  ctx.fill();
  ctx.stroke();

  // Left & Right tapered legs
  for (const [topX, sgn] of [
    [legLeftTopX, -1],
    [legRightTopX, 1],
  ] as const) {
    ctx.fillStyle = pal.woodDark;
    ctx.beginPath();
    ctx.moveTo(topX - 11, deskY + deskH);
    ctx.lineTo(topX + 11, deskY + deskH);
    ctx.lineTo(topX + 8 + sgn * 8, floorRunnerY + 2);
    ctx.lineTo(topX - 8 + sgn * 8, floorRunnerY + 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Studio floor runner uniting both legs
  ctx.fillStyle = safeBlendColor(0.45, pal.elevated, pal.primary);
  ctx.beginPath();
  ctx.roundRect(left + 12, floorRunnerY, iw - 24, 14, 7);
  ctx.fill();
  ctx.stroke();

  // 3. Workbench front apron + wood-grain tabletop
  const apronX = left + iw * 0.11;
  const apronW = iw * 0.78;
  const apronY = deskY + deskH - 2;

  ctx.fillStyle = pal.woodMid;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.roundRect(apronX, apronY, apronW, apronH, 8);
  ctx.fill();
  ctx.stroke();

  const topGrad = ctx.createLinearGradient(left, deskY, right, deskY + deskH);
  topGrad.addColorStop(0, pal.woodLight);
  topGrad.addColorStop(0.55, pal.woodMid);
  topGrad.addColorStop(1, pal.woodDark);

  ctx.fillStyle = topGrad;
  ctx.beginPath();
  ctx.roundRect(left + 6, deskY, iw - 12, deskH, 8);
  ctx.fill();
  ctx.stroke();

  // Deterministic subtle wood-grain strokes on tabletop
  ctx.strokeStyle = pal.woodDark;
  ctx.lineWidth = 1.6;
  ctx.globalAlpha = 0.35;
  for (let g = 0; g < 3; g++) {
    const gx = left + 28 + g * (iw * 0.28) + rng() * 14;
    const gy = deskY + 6 + g * 4;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(Math.min(right - 24, gx + 76 + rng() * 34), gy);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 4. Open double-page atelier sketchbook / easel on tabletop center
  const bookW = iw * 0.34;
  const bookH = ih * 0.28;
  const bookX = cx - bookW * 0.46;
  const bookY = deskY - bookH + 2;

  ctx.fillStyle = pal.snowLight;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.roundRect(bookX, bookY, bookW, bookH, 6);
  ctx.fill();
  ctx.stroke();

  // Center spine & miniature painted colour blocks inside sketchbook
  ctx.beginPath();
  ctx.moveTo(bookX + bookW * 0.5, bookY + 4);
  ctx.lineTo(bookX + bookW * 0.5, bookY + bookH - 4);
  ctx.stroke();

  ctx.fillStyle = pal.primary;
  ctx.beginPath();
  ctx.arc(bookX + bookW * 0.26, bookY + bookH * 0.45, Math.min(14, bookH * 0.22), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = pal.secondary;
  ctx.fillRect(bookX + bookW * 0.58, bookY + bookH * 0.3, bookW * 0.28, bookH * 0.16);
  ctx.fillStyle = pal.brassLight;
  ctx.fillRect(bookX + bookW * 0.58, bookY + bookH * 0.56, bookW * 0.22, bookH * 0.14);

  // 5. Poised articulated brass desk lamp on the left
  const lampBaseX = left + iw * 0.18;
  const elbowX = left + iw * 0.14;
  const elbowY = top + ih * 0.28;

  ctx.strokeStyle = pal.brassDark;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(lampBaseX, deskY - 4);
  ctx.lineTo(elbowX, elbowY);
  ctx.lineTo(lampShadeX, lampShadeY);
  ctx.stroke();

  ctx.fillStyle = pal.brassLight;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(lampBaseX - 22, deskY - 10, 44, 10, 4);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(elbowX, elbowY, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Conical brass shade
  ctx.fillStyle = pal.brassLight;
  ctx.beginPath();
  ctx.moveTo(lampShadeX - 12, lampShadeY - 8);
  ctx.lineTo(lampShadeX + 22, lampShadeY + 6);
  ctx.lineTo(lampShadeX - 8, lampShadeY + 18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 6. Ceramic studio brush cup + two fine brushes on the right
  const cupX = right - iw * 0.22;
  const cupW = 30;
  const cupH = 38;
  const cupY = deskY - cupH + 2;

  ctx.strokeStyle = pal.woodDark;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cupX + 10, cupY + 6);
  ctx.lineTo(cupX + 2, Math.max(top + 8, cupY - 24));
  ctx.moveTo(cupX + 20, cupY + 6);
  ctx.lineTo(cupX + 28, Math.max(top + 10, cupY - 20));
  ctx.stroke();

  ctx.fillStyle = pal.secondary;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(cupX, cupY, cupW, cupH, 6);
  ctx.fill();
  ctx.stroke();

  // 7. Optional concise inlaid apron nameplate (with mandatory 4th maxWidth for Polish safety!)
  const trimmedTitle = options?.plaqueTitle?.trim();
  if (trimmedTitle) {
    const maxPlateW = Math.min(apronW - 28, w - pad * 2 - 48);
    const plateH = 30;
    const plateX = cx - maxPlateW * 0.5;
    const plateY = apronY + (apronH - plateH) * 0.5;
    const formatted =
      pal.headingCase === 'uppercase'
        ? trimmedTitle.toLocaleUpperCase('pl-PL')
        : trimmedTitle;

    ctx.fillStyle = pal.surface;
    ctx.strokeStyle = pal.brassLight;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(plateX, plateY, maxPlateW, plateH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = pal.textPrimary;
    ctx.font = `700 18px "${pal.displayFont}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const safeMaxTextWidth = Math.max(80, maxPlateW - 48);
    ctx.fillText(formatted, cx, plateY + plateH * 0.5, safeMaxTextWidth);
  } else {
    // Clean brass drawer pulls when no title is provided (zero default text clutter)
    ctx.fillStyle = pal.brassLight;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2.2;
    for (const pullX of [cx - apronW * 0.2, cx + apronW * 0.2]) {
      ctx.beginPath();
      ctx.roundRect(pullX - 18, apronY + apronH * 0.5 - 4, 36, 8, 4);
      ctx.fill();
      ctx.stroke();
    }
  }
}

export interface AtelierDeskCutout3DProps extends ScenicCutoutCommonProps {
  /** Optional concise inlaid nameplate label (omitted by default; rendered with Polish-safe `maxWidth`) */
  plaqueTitle?: string;
  /** Render warm brass desk lamp light cone (default true) */
  lampOn?: boolean;
}

export const AtelierDeskCutout3D: React.FC<AtelierDeskCutout3DProps> = ({
  cacheKey = 'scenic-atelier-desk',
  width = 3.6,
  height = 1.85,
  pixelWidth = 640,
  pixelHeight = 340,
  whiteBorderPx = 14,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  anchor = 'bottom',
  thickness = 0.044,
  castShadow = true,
  receiveShadow = true,
  opacity = 1,
  primaryColor,
  accentColor,
  secondaryColor,
  surfaceColor,
  inkColor,
  seed = 'atelier-desk-v1',
  plaqueTitle,
  lampOn = true,
}) => {
  const style = useStudioStyle();
  const formattedTitle = plaqueTitle
    ? formatHeadingText(plaqueTitle, style)
    : undefined;

  const pal = useMemo(
    () =>
      resolveScenicCutoutPalette(style, {
        primaryColor,
        accentColor,
        secondaryColor,
        surfaceColor,
        inkColor,
      }),
    [style, primaryColor, accentColor, secondaryColor, surfaceColor, inkColor]
  );

  const cacheDeps = useMemo(
    () =>
      buildPaletteCacheDeps(pal, [
        seed,
        formattedTitle ?? '',
        lampOn,
        whiteBorderPx,
      ]),
    [pal, seed, formattedTitle, lampOn, whiteBorderPx]
  );

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      drawAtelierDeskMotif(ctx, w, h, pal, {
        seed,
        plaqueTitle: formattedTitle,
        lampOn,
        whiteBorderPx,
      });
    },
    [pal, seed, formattedTitle, lampOn, whiteBorderPx]
  );

  return (
    <PaperCutout3D
      cacheKey={cacheKey}
      cacheDeps={cacheDeps}
      width={width}
      height={height}
      pixelWidth={pixelWidth}
      pixelHeight={pixelHeight}
      whiteBorderPx={whiteBorderPx}
      position={position}
      rotation={rotation}
      scale={scale}
      anchor={anchor}
      thickness={thickness}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      opacity={opacity}
      draw={draw}
    />
  );
};
