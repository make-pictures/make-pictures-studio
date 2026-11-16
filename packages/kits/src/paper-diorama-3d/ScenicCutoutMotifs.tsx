import React, { useCallback, useMemo } from 'react';
import { interpolateColors } from 'remotion';
import {
  createSeededRandom,
  formatHeadingText,
  resolveArtWorld,
  useStudioStyle,
  type ArtWorld,
  type StylePreset,
} from '@make-pictures/core';
import { PaperCutout3D, type PaperCutoutDep } from './PaperCutout3D';

/**
 * Guaranteed minimum clear pixel margin on all 4 canvas edges so `whiteBorderPx`
 * die-cut dilation (14px + kraft edge + stroke width) never clips flat.
 */
export const SCENIC_CUTOUT_INNER_MARGIN_PX = 38;

export interface ScenicCutoutColorOverrides {
  /** Primary motif accent override (defaults to `style.palette.accentPrimary`) */
  primaryColor?: string;
  /** Alias for `primaryColor` for prop ergonomics across scaffolds */
  accentColor?: string;
  /** Secondary motif accent override (defaults to `style.palette.accentSecondary`) */
  secondaryColor?: string;
  /** Surface / highlight fill override (defaults to `style.palette.bgSurface`) */
  surfaceColor?: string;
  /** Contour ink stroke override (defaults to `style.palette.inkBorder` / `textPrimary`) */
  inkColor?: string;
}

export interface ScenicCutoutCommonProps extends ScenicCutoutColorOverrides {
  /** Optional cache key override */
  cacheKey?: string;
  /** World width in 3D units */
  width?: number;
  /** World height in 3D units */
  height?: number;
  /** Offscreen canvas pixel width */
  pixelWidth?: number;
  /** Offscreen canvas pixel height */
  pixelHeight?: number;
  /** Thickness of the cream-white Paper Mario die-cut border in pixels (default 14) */
  whiteBorderPx?: number;
  /** 3D position [x, y, z] */
  position?: [number, number, number];
  /** 3D rotation [rx, ry, rz] in radians */
  rotation?: [number, number, number];
  /** 3D scale */
  scale?: number | [number, number, number];
  /** Anchor point (default 'bottom') */
  anchor?: 'bottom' | 'center' | 'top';
  /** Cardboard thickness in 3D units */
  thickness?: number;
  /** Cast 3D silhouette shadow (default true) */
  castShadow?: boolean;
  /** Receive 3D shadow (default true) */
  receiveShadow?: boolean;
  /** Opacity (default 1) */
  opacity?: number;
  /** Deterministic variation seed */
  seed?: string | number;
}

export interface ScenicCutoutPalette {
  artWorld: ArtWorld;
  isDark: boolean;
  primary: string;
  secondary: string;
  surface: string;
  elevated: string;
  canvas: string;
  ink: string;
  textPrimary: string;
  textSecondary: string;
  sunCore: string;
  sunGlow: string;
  snowLight: string;
  snowShadow: string;
  foliageLight: string;
  foliageMid: string;
  foliageDeep: string;
  woodLight: string;
  woodMid: string;
  woodDark: string;
  brassLight: string;
  brassDark: string;
  displayFont: string;
  bodyFont: string;
  headingCase: 'sentence' | 'uppercase';
}

function safeBlendColor(t: number, colorA: string, colorB: string): string {
  try {
    return interpolateColors(t, [0, 1], [colorA, colorB]);
  } catch {
    return t < 0.5 ? colorA : colorB;
  }
}

function resolveSafeMarginPx(whiteBorderPx: number = 14): number {
  return Math.max(SCENIC_CUTOUT_INNER_MARGIN_PX, Math.ceil(whiteBorderPx + 24));
}

export function resolveScenicCutoutPalette(
  style: StylePreset,
  overrides?: ScenicCutoutColorOverrides
): ScenicCutoutPalette {
  const { palette, surface, typography } = style;
  const artWorld = resolveArtWorld(style);
  const isDark = surface.isDark;

  const primary =
    overrides?.primaryColor ?? overrides?.accentColor ?? palette.accentPrimary;
  const secondary = overrides?.secondaryColor ?? palette.accentSecondary;
  const resolvedSurface = overrides?.surfaceColor ?? palette.bgSurface;
  const ink =
    overrides?.inkColor ??
    (isDark
      ? safeBlendColor(0.55, palette.inkBorder, palette.textSecondary)
      : safeBlendColor(0.62, palette.textPrimary, palette.inkBorder));

  const sunCore = isDark
    ? safeBlendColor(0.35, '#FEF3C7', primary)
    : '#FFFBEB';
  const sunGlow = isDark
    ? safeBlendColor(0.55, primary, '#F59E0B')
    : safeBlendColor(0.45, '#FDE68A', primary);

  const snowLight = isDark
    ? safeBlendColor(0.22, '#F8FAFC', primary)
    : '#FFFDF8';
  const snowShadow = isDark
    ? safeBlendColor(0.45, '#64748B', secondary)
    : safeBlendColor(0.32, '#CBD5E1', secondary);

  const foliageMid = safeBlendColor(0.42, '#0F766E', secondary);
  const foliageLight = safeBlendColor(
    0.45,
    foliageMid,
    isDark ? '#6EE7B7' : '#A7F3D0'
  );
  const foliageDeep = safeBlendColor(
    0.55,
    foliageMid,
    isDark ? '#042F2E' : '#064E3B'
  );

  const woodMid = isDark
    ? safeBlendColor(0.38, '#78350F', palette.bgElevated)
    : safeBlendColor(0.28, '#B45309', primary);
  const woodLight = safeBlendColor(0.38, woodMid, '#FDE68A');
  const woodDark = safeBlendColor(0.48, woodMid, '#451A03');

  const brassLight = safeBlendColor(0.25, '#FBBF24', sunCore);
  const brassDark = safeBlendColor(0.35, '#B45309', primary);

  return {
    artWorld,
    isDark,
    primary,
    secondary,
    surface: resolvedSurface,
    elevated: palette.bgElevated,
    canvas: palette.bgCanvas,
    ink,
    textPrimary: palette.textPrimary,
    textSecondary: palette.textSecondary,
    sunCore,
    sunGlow,
    snowLight,
    snowShadow,
    foliageLight,
    foliageMid,
    foliageDeep,
    woodLight,
    woodMid,
    woodDark,
    brassLight,
    brassDark,
    displayFont: typography.displayFont,
    bodyFont: typography.bodyFont,
    headingCase: typography.headingCase,
  };
}

function buildPaletteCacheDeps(
  pal: ScenicCutoutPalette,
  extra: ReadonlyArray<PaperCutoutDep>
): PaperCutoutDep[] {
  return [
    pal.artWorld,
    pal.isDark,
    pal.primary,
    pal.secondary,
    pal.surface,
    pal.elevated,
    pal.ink,
    pal.textPrimary,
    pal.displayFont,
    pal.headingCase,
    ...extra,
  ];
}

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

// ============================================================================
// 6. StarryCosmosBackdropCutout3D — Deep Midnight-Indigo Dome, Stars & Nebulae
// ============================================================================

export interface StarryCosmosBackdropDrawOptions {
  seed?: string | number;
  whiteBorderPx?: number;
}

function drawFourPointPaperStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  fillColor: string,
  strokeColor: string
): void {
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerR);
  ctx.quadraticCurveTo(cx + innerR, cy - innerR, cx + outerR, cy);
  ctx.quadraticCurveTo(cx + innerR, cy + innerR, cx, cy + outerR);
  ctx.quadraticCurveTo(cx - innerR, cy + innerR, cx - outerR, cy);
  ctx.quadraticCurveTo(cx - innerR, cy - innerR, cx, cy - outerR);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

export function drawStarryCosmosBackdropMotif(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pal: ScenicCutoutPalette,
  options?: StarryCosmosBackdropDrawOptions
): void {
  const pad = resolveSafeMarginPx(options?.whiteBorderPx);
  const rng = createSeededRandom(
    `starry-cosmos:${String(options?.seed ?? 'v1')}`
  );

  const left = pad + 8;
  const right = w - pad - 8;
  const top = pad + 8;
  const bottom = h - pad - 6;
  const iw = right - left;
  const cx = w * 0.5;

  const plinthH = 24;
  const springY = bottom - plinthH;
  const outerR = Math.max(60, Math.min(iw * 0.45, springY - top - 8));
  const innerR = outerR * 0.86;

  const frameMidnight = safeBlendColor(0.28, '#1E1B4B', pal.surface);
  const frameRim = safeBlendColor(0.32, '#312E81', pal.primary);
  const cosmosCore = safeBlendColor(0.16, '#090D26', pal.canvas);
  const cosmosMid = safeBlendColor(0.22, '#131C47', pal.secondary);
  const cosmosHorizon = safeBlendColor(0.26, '#1E295E', pal.primary);

  // 1. Outer celestial arch frame
  const frameGrad = ctx.createLinearGradient(
    cx - outerR,
    springY - outerR,
    cx + outerR,
    bottom
  );
  frameGrad.addColorStop(0, frameRim);
  frameGrad.addColorStop(0.55, frameMidnight);
  frameGrad.addColorStop(1, '#0F172A');

  ctx.fillStyle = frameGrad;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 4.2;
  ctx.beginPath();
  ctx.moveTo(cx - outerR, springY);
  ctx.arc(cx, springY, outerR, Math.PI, Math.PI * 2);
  ctx.lineTo(cx + outerR, springY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 2. Deep midnight-indigo cosmic dome vault
  const vaultGrad = ctx.createRadialGradient(
    cx,
    springY - innerR * 0.35,
    innerR * 0.08,
    cx,
    springY - innerR * 0.2,
    innerR
  );
  vaultGrad.addColorStop(0, cosmosMid);
  vaultGrad.addColorStop(0.58, cosmosCore);
  vaultGrad.addColorStop(1, cosmosHorizon);

  ctx.fillStyle = vaultGrad;
  ctx.beginPath();
  ctx.moveTo(cx - innerR, springY);
  ctx.arc(cx, springY, innerR, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();

  // 3. Clipped subtle nebula bands, orbital arc & deterministic paper starfield
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - innerR, springY);
  ctx.arc(cx, springY, innerR, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // Nebula ribbon A (indigo-violet / primary wash)
  const nebGradA = ctx.createLinearGradient(
    cx - innerR * 0.78,
    springY - innerR * 0.3,
    cx + innerR * 0.78,
    springY - innerR * 0.65
  );
  nebGradA.addColorStop(0, 'rgba(99, 102, 241, 0.05)');
  nebGradA.addColorStop(0.5, 'rgba(129, 140, 248, 0.28)');
  nebGradA.addColorStop(1, 'rgba(56, 189, 248, 0.08)');
  ctx.fillStyle = nebGradA;
  ctx.beginPath();
  ctx.moveTo(cx - innerR * 0.82, springY - innerR * 0.16);
  ctx.bezierCurveTo(
    cx - innerR * 0.34,
    springY - innerR * 0.56,
    cx + innerR * 0.2,
    springY - innerR * 0.28,
    cx + innerR * 0.8,
    springY - innerR * 0.58
  );
  ctx.lineTo(cx + innerR * 0.72, springY - innerR * 0.36);
  ctx.bezierCurveTo(
    cx + innerR * 0.18,
    springY - innerR * 0.12,
    cx - innerR * 0.32,
    springY - innerR * 0.34,
    cx - innerR * 0.78,
    springY - innerR * 0.06
  );
  ctx.closePath();
  ctx.fill();

  // Nebula ribbon B (warm gold-amber / cyan Stardust band)
  const nebGradB = ctx.createLinearGradient(
    cx - innerR * 0.62,
    springY - innerR * 0.72,
    cx + innerR * 0.64,
    springY - innerR * 0.24
  );
  nebGradB.addColorStop(0, 'rgba(251, 191, 36, 0.04)');
  nebGradB.addColorStop(0.5, 'rgba(253, 230, 138, 0.20)');
  nebGradB.addColorStop(1, 'rgba(167, 139, 250, 0.06)');
  ctx.fillStyle = nebGradB;
  ctx.beginPath();
  ctx.moveTo(cx - innerR * 0.64, springY - innerR * 0.58);
  ctx.bezierCurveTo(
    cx - innerR * 0.18,
    springY - innerR * 0.78,
    cx + innerR * 0.24,
    springY - innerR * 0.54,
    cx + innerR * 0.68,
    springY - innerR * 0.22
  );
  ctx.lineTo(cx + innerR * 0.58, springY - innerR * 0.12);
  ctx.bezierCurveTo(
    cx + innerR * 0.18,
    springY - innerR * 0.38,
    cx - innerR * 0.2,
    springY - innerR * 0.62,
    cx - innerR * 0.58,
    springY - innerR * 0.44
  );
  ctx.closePath();
  ctx.fill();

  // Delicate brass celestial trajectory ring
  ctx.strokeStyle = 'rgba(253, 230, 138, 0.36)';
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 8]);
  ctx.beginPath();
  ctx.arc(cx, springY, innerR * 0.72, Math.PI + 0.12, Math.PI * 2 - 0.12);
  ctx.stroke();
  ctx.setLineDash([]);

  // Deterministic background pinprick ivory & gold stars
  for (let i = 0; i < 16; i++) {
    const angle = Math.PI + 0.18 + rng() * (Math.PI - 0.36);
    const radiusFrac = 0.22 + rng() * 0.58;
    const sx = cx + Math.cos(angle) * innerR * radiusFrac;
    const sy = springY + Math.sin(angle) * innerR * radiusFrac;
    const dotR = 1.8 + rng() * 2.1;
    ctx.fillStyle = i % 3 === 0 ? '#FDE68A' : '#FFFDF7';
    ctx.globalAlpha = 0.65 + rng() * 0.32;
    ctx.beginPath();
    ctx.arc(sx, sy, dotR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 7 sculpted 4-point golden & ivory paper stars
  const starAnchors = [
    { a: Math.PI + 0.36, r: 0.68, size: 11, gold: true },
    { a: Math.PI + 0.72, r: 0.54, size: 8.5, gold: false },
    { a: Math.PI + 1.12, r: 0.76, size: 13, gold: true },
    { a: Math.PI + 1.48, r: 0.42, size: 9.5, gold: false },
    { a: Math.PI + 1.88, r: 0.68, size: 11.5, gold: true },
    { a: Math.PI + 2.28, r: 0.52, size: 8.5, gold: false },
    { a: Math.PI + 2.66, r: 0.66, size: 10.5, gold: true },
  ];

  for (const st of starAnchors) {
    const jitterA = (rng() - 0.5) * 0.06;
    const jitterR = (rng() - 0.5) * 0.04;
    const ang = st.a + jitterA;
    const dist = innerR * (st.r + jitterR);
    const sx = cx + Math.cos(ang) * dist;
    const sy = Math.min(springY - 20, springY + Math.sin(ang) * dist);
    drawFourPointPaperStar(
      ctx,
      sx,
      sy,
      st.size,
      st.size * 0.32,
      st.gold ? '#FBBF24' : '#FFFBEB',
      '#0F172A'
    );
  }

  ctx.restore();

  // 4. Crisp inner arch brass/ink contour + grounded base plinth
  ctx.strokeStyle = safeBlendColor(0.5, '#FDE68A', pal.brassLight);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - innerR, springY);
  ctx.arc(cx, springY, innerR, Math.PI, Math.PI * 2);
  ctx.stroke();

  const plinthW = Math.min(iw - 4, outerR * 2 + 24);
  ctx.fillStyle = safeBlendColor(0.35, '#1E293B', pal.elevated);
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 3.8;
  ctx.beginPath();
  ctx.roundRect(cx - plinthW * 0.5, springY, plinthW, plinthH, 7);
  ctx.fill();
  ctx.stroke();
}

export type StarryCosmosBackdropCutout3DProps = ScenicCutoutCommonProps;

export const StarryCosmosBackdropCutout3D: React.FC<
  StarryCosmosBackdropCutout3DProps
> = ({
  cacheKey = 'scenic-starry-cosmos',
  width = 6.2,
  height = 3.5,
  pixelWidth = 864,
  pixelHeight = 488,
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
  seed = 'cosmos-v1',
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
    () => buildPaletteCacheDeps(pal, [seed, whiteBorderPx]),
    [pal, seed, whiteBorderPx]
  );

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      drawStarryCosmosBackdropMotif(ctx, w, h, pal, { seed, whiteBorderPx });
    },
    [pal, seed, whiteBorderPx]
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
// 7. EarthriseCutout3D — Sapphire Ocean Globe, Emerald Continents & Cloud Swirls
// ============================================================================

export interface EarthriseDrawOptions {
  seed?: string | number;
  whiteBorderPx?: number;
}

export function drawEarthriseMotif(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pal: ScenicCutoutPalette,
  options?: EarthriseDrawOptions
): void {
  const pad = resolveSafeMarginPx(options?.whiteBorderPx);
  const rng = createSeededRandom(`earthrise:${String(options?.seed ?? 'v1')}`);

  const cx = w * 0.5;
  const cy = h * 0.5;
  const haloR = Math.max(36, Math.min(w, h) * 0.5 - pad - 8);
  const oceanR = haloR * 0.88;

  // 1. Luminous atmospheric rim disc
  const atmoGrad = ctx.createRadialGradient(
    cx - haloR * 0.22,
    cy - haloR * 0.22,
    oceanR * 0.65,
    cx,
    cy,
    haloR
  );
  atmoGrad.addColorStop(0, '#E0F2FE');
  atmoGrad.addColorStop(0.72, '#7DD3FC');
  atmoGrad.addColorStop(1, safeBlendColor(0.25, '#1D4ED8', pal.primary));

  ctx.fillStyle = atmoGrad;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 2. Sapphire ocean sphere
  const oceanGrad = ctx.createRadialGradient(
    cx - oceanR * 0.3,
    cy - oceanR * 0.32,
    oceanR * 0.1,
    cx + oceanR * 0.1,
    cy + oceanR * 0.12,
    oceanR
  );
  oceanGrad.addColorStop(0, '#38BDF8');
  oceanGrad.addColorStop(0.48, '#0284C7');
  oceanGrad.addColorStop(0.84, '#1E3A8A');
  oceanGrad.addColorStop(1, '#0F172A');

  ctx.fillStyle = oceanGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, oceanR, 0, Math.PI * 2);
  ctx.fill();

  // 3. Clipped emerald/sage paper continents & swirling cream cloud ribbons
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, oceanR - 1.5, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  const shift = (rng() - 0.5) * oceanR * 0.05;
  const landLight = safeBlendColor(0.22, '#6EE7B7', pal.foliageLight);
  const landMid = safeBlendColor(0.22, '#10B981', pal.foliageMid);
  const landDeep = safeBlendColor(0.25, '#047857', pal.foliageDeep);

  // Upper-left sculpted landmass
  const landGradA = ctx.createLinearGradient(
    cx - oceanR * 0.65,
    cy - oceanR * 0.6,
    cx + oceanR * 0.1,
    cy + oceanR * 0.2
  );
  landGradA.addColorStop(0, landLight);
  landGradA.addColorStop(0.6, landMid);
  landGradA.addColorStop(1, landDeep);

  ctx.fillStyle = landGradA;
  ctx.strokeStyle = '#064E3B';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(cx - oceanR * 0.66 + shift, cy - oceanR * 0.24);
  ctx.bezierCurveTo(
    cx - oceanR * 0.54,
    cy - oceanR * 0.68,
    cx - oceanR * 0.06,
    cy - oceanR * 0.64,
    cx + oceanR * 0.08,
    cy - oceanR * 0.34
  );
  ctx.bezierCurveTo(
    cx + oceanR * 0.18,
    cy - oceanR * 0.12,
    cx - oceanR * 0.08,
    cy + oceanR * 0.14,
    cx - oceanR * 0.34,
    cy + oceanR * 0.08
  );
  ctx.bezierCurveTo(
    cx - oceanR * 0.58,
    cy + oceanR * 0.04,
    cx - oceanR * 0.72,
    cy - oceanR * 0.08,
    cx - oceanR * 0.66 + shift,
    cy - oceanR * 0.24
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Lower-right / equatorial emerald-sage continent
  ctx.fillStyle = landMid;
  ctx.beginPath();
  ctx.moveTo(cx + oceanR * 0.06, cy + oceanR * 0.04);
  ctx.bezierCurveTo(
    cx + oceanR * 0.38,
    cy - oceanR * 0.16,
    cx + oceanR * 0.68,
    cy + oceanR * 0.08,
    cx + oceanR * 0.54,
    cy + oceanR * 0.44
  );
  ctx.bezierCurveTo(
    cx + oceanR * 0.38,
    cy + oceanR * 0.66,
    cx + oceanR * 0.04,
    cy + oceanR * 0.58,
    cx - oceanR * 0.04,
    cy + oceanR * 0.3
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Swirling cream paper cloud ribbons
  ctx.fillStyle = '#FFFDF7';
  ctx.globalAlpha = 0.88;
  ctx.beginPath();
  ctx.moveTo(cx - oceanR * 0.74, cy - oceanR * 0.06);
  ctx.bezierCurveTo(
    cx - oceanR * 0.32,
    cy - oceanR * 0.28,
    cx + oceanR * 0.22,
    cy - oceanR * 0.38,
    cx + oceanR * 0.66,
    cy - oceanR * 0.16
  );
  ctx.bezierCurveTo(
    cx + oceanR * 0.48,
    cy - oceanR * 0.04,
    cx - oceanR * 0.18,
    cy - oceanR * 0.12,
    cx - oceanR * 0.66,
    cy + oceanR * 0.08
  );
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - oceanR * 0.46, cy + oceanR * 0.34);
  ctx.bezierCurveTo(
    cx - oceanR * 0.08,
    cy + oceanR * 0.18,
    cx + oceanR * 0.34,
    cy + oceanR * 0.24,
    cx + oceanR * 0.62,
    cy + oceanR * 0.38
  );
  ctx.bezierCurveTo(
    cx + oceanR * 0.32,
    cy + oceanR * 0.48,
    cx - oceanR * 0.12,
    cy + oceanR * 0.36,
    cx - oceanR * 0.46,
    cy + oceanR * 0.46
  );
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Subtle lunar-perspective terminator shadow crescent on lower-right limb
  ctx.fillStyle = 'rgba(15, 23, 42, 0.34)';
  ctx.beginPath();
  ctx.arc(
    cx + oceanR * 0.2,
    cy + oceanR * 0.22,
    oceanR * 0.74,
    Math.PI * 1.85,
    Math.PI * 2.65
  );
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // 4. Sunlit crescent rim highlight & crisp outer ocean contour
  ctx.strokeStyle = '#FFFDF7';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(cx, cy, oceanR - 2, Math.PI * 0.85, Math.PI * 1.68);
  ctx.stroke();

  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(cx, cy, oceanR, 0, Math.PI * 2);
  ctx.stroke();
}

export type EarthriseCutout3DProps = ScenicCutoutCommonProps;

export const EarthriseCutout3D: React.FC<EarthriseCutout3DProps> = ({
  cacheKey = 'scenic-earthrise',
  width = 1.85,
  height = 1.85,
  pixelWidth = 420,
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
  seed = 'earthrise-v1',
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
    () => buildPaletteCacheDeps(pal, [seed, whiteBorderPx]),
    [pal, seed, whiteBorderPx]
  );

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      drawEarthriseMotif(ctx, w, h, pal, { seed, whiteBorderPx });
    },
    [pal, seed, whiteBorderPx]
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
// 8. LunarCraterRidgeCutout3D — Silver-Chalk Lunar Horizon & Shadowed Craters
// ============================================================================

export interface LunarCraterRidgeDrawOptions {
  seed?: string | number;
  ridgeVariant?: 'far' | 'near';
  whiteBorderPx?: number;
}

export function drawLunarCraterRidgeMotif(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pal: ScenicCutoutPalette,
  options?: LunarCraterRidgeDrawOptions
): void {
  const pad = resolveSafeMarginPx(options?.whiteBorderPx);
  const variant = options?.ridgeVariant ?? 'near';
  const rng = createSeededRandom(
    `lunar-ridge:${variant}:${String(options?.seed ?? 'v1')}`
  );

  const left = pad + 8;
  const right = w - pad - 8;
  const top = pad + 8;
  const bottom = h - pad - 6;
  const iw = right - left;
  const ih = bottom - top;
  const baseY = bottom - 4;

  const isFar = variant === 'far';
  const chalkTop = isFar
    ? safeBlendColor(0.18, '#E7E5E4', pal.snowLight)
    : safeBlendColor(0.12, '#FAF8F5', pal.snowLight);
  const chalkMid = isFar
    ? safeBlendColor(0.18, '#B8B4AE', pal.surface)
    : safeBlendColor(0.15, '#DDD9D2', pal.surface);
  const chalkShadow = isFar
    ? safeBlendColor(0.2, '#78716C', pal.elevated)
    : safeBlendColor(0.18, '#A8A29E', pal.elevated);
  const craterBowl = isFar ? '#44403C' : '#57534E';

  const ridgeGrad = ctx.createLinearGradient(0, top, 0, baseY);
  ridgeGrad.addColorStop(0, chalkTop);
  ridgeGrad.addColorStop(0.54, chalkMid);
  ridgeGrad.addColorStop(1, chalkShadow);

  const wobble = (rng() - 0.5) * iw * 0.02;

  // 1. Undulating lunar horizon silhouette (distinct profiles for 'far' vs 'near')
  ctx.fillStyle = ridgeGrad;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(left + 4, baseY);

  if (isFar) {
    ctx.lineTo(left + 4, top + ih * 0.44);
    ctx.bezierCurveTo(
      left + iw * 0.14,
      top + ih * 0.12,
      left + iw * 0.28 + wobble,
      top + ih * 0.08,
      left + iw * 0.42,
      top + ih * 0.3
    );
    ctx.bezierCurveTo(
      left + iw * 0.56,
      top + ih * 0.46,
      left + iw * 0.7 + wobble,
      top + ih * 0.06,
      left + iw * 0.84,
      top + ih * 0.22
    );
    ctx.bezierCurveTo(
      left + iw * 0.92,
      top + ih * 0.3,
      right - 4,
      top + ih * 0.36,
      right - 4,
      baseY
    );
  } else {
    ctx.lineTo(left + 4, top + ih * 0.34);
    ctx.bezierCurveTo(
      left + iw * 0.18,
      top + ih * 0.2,
      left + iw * 0.34 + wobble,
      top + ih * 0.36,
      left + iw * 0.5,
      top + ih * 0.26
    );
    ctx.bezierCurveTo(
      left + iw * 0.66,
      top + ih * 0.16,
      left + iw * 0.82 + wobble,
      top + ih * 0.24,
      right - 4,
      top + ih * 0.38
    );
    ctx.lineTo(right - 4, baseY);
  }

  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 2. Shadowed elliptical craters with raised sunlit silver-chalk rims
  const craters = isFar
    ? [
        { cx: left + iw * 0.22, cy: top + ih * 0.56, rx: iw * 0.055, ry: ih * 0.085 },
        { cx: left + iw * 0.48, cy: top + ih * 0.68, rx: iw * 0.044, ry: ih * 0.07 },
        { cx: left + iw * 0.76, cy: top + ih * 0.54, rx: iw * 0.062, ry: ih * 0.09 },
      ]
    : [
        { cx: left + iw * 0.18, cy: top + ih * 0.6, rx: iw * 0.062, ry: ih * 0.095 },
        { cx: left + iw * 0.39, cy: top + ih * 0.72, rx: iw * 0.045, ry: ih * 0.072 },
        { cx: left + iw * 0.64, cy: top + ih * 0.62, rx: iw * 0.068, ry: ih * 0.1 },
        { cx: left + iw * 0.84, cy: top + ih * 0.74, rx: iw * 0.04, ry: ih * 0.068 },
      ];

  for (const cr of craters) {
    // Raised sunlit outer rim
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(cr.cx, cr.cy, cr.rx, cr.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Shadowed inner crater bowl
    const bowlGrad = ctx.createLinearGradient(
      cr.cx - cr.rx,
      cr.cy - cr.ry,
      cr.cx + cr.rx,
      cr.cy + cr.ry
    );
    bowlGrad.addColorStop(0, craterBowl);
    bowlGrad.addColorStop(0.65, chalkShadow);
    bowlGrad.addColorStop(1, chalkMid);

    ctx.fillStyle = bowlGrad;
    ctx.beginPath();
    ctx.ellipse(
      cr.cx + cr.rx * 0.04,
      cr.cy + cr.ry * 0.08,
      cr.rx * 0.78,
      cr.ry * 0.68,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // 3. Deterministic lunar regolith pebbles inside safe interior band
  for (let i = 0; i < 8; i++) {
    const px = left + iw * (0.12 + rng() * 0.76);
    const py = top + ih * (0.52 + rng() * 0.3);
    ctx.fillStyle = i % 2 === 0 ? '#FAF8F5' : craterBowl;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.ellipse(px, py, 4.5 + rng() * 4, 2.2 + rng() * 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export interface LunarCraterRidgeCutout3DProps extends ScenicCutoutCommonProps {
  /** Parallax horizon layer variant ('far' taller pewter ridge vs 'near' sunlit Tranquility plain) */
  ridgeVariant?: 'far' | 'near';
}

export const LunarCraterRidgeCutout3D: React.FC<
  LunarCraterRidgeCutout3DProps
> = ({
  cacheKey = 'scenic-lunar-crater-ridge',
  ridgeVariant = 'near',
  width,
  height,
  pixelWidth = 860,
  pixelHeight = 320,
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
  seed = 'lunar-ridge-v1',
}) => {
  const style = useStudioStyle();
  const resolvedWidth = width ?? (ridgeVariant === 'far' ? 6.2 : 6.4);
  const resolvedHeight = height ?? (ridgeVariant === 'far' ? 1.85 : 1.38);

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
    () => buildPaletteCacheDeps(pal, [seed, ridgeVariant, whiteBorderPx]),
    [pal, seed, ridgeVariant, whiteBorderPx]
  );

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      drawLunarCraterRidgeMotif(ctx, w, h, pal, {
        seed,
        ridgeVariant,
        whiteBorderPx,
      });
    },
    [pal, seed, ridgeVariant, whiteBorderPx]
  );

  return (
    <PaperCutout3D
      cacheKey={cacheKey}
      cacheDeps={cacheDeps}
      width={resolvedWidth}
      height={resolvedHeight}
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
// 9. LunarLanderCutout3D — Apollo 11 Eagle Paper Craft & 60 FPS Braking Plume
// ============================================================================

export interface LunarLanderDrawOptions {
  seed?: string | number;
  thrusterIntensity?: number;
  whiteBorderPx?: number;
}

export function drawLunarLanderMotif(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pal: ScenicCutoutPalette,
  options?: LunarLanderDrawOptions
): void {
  const pad = resolveSafeMarginPx(options?.whiteBorderPx);
  const rng = createSeededRandom(
    `lunar-lander:${String(options?.seed ?? 'v1')}`
  );
  const nozzleLit = (options?.thrusterIntensity ?? 0) > 0.02;

  const left = pad + 10;
  const right = w - pad - 10;
  const top = pad + 10;
  const bottom = h - pad - 10;
  const iw = right - left;
  const ih = bottom - top;
  const cx = w * 0.5;

  const dishTopY = top + ih * 0.03;
  const cabinTopY = top + ih * 0.14;
  const cabinBotY = top + ih * 0.45;
  const descentTopY = top + ih * 0.43;
  const descentBotY = top + ih * 0.68;
  const nozzleBotY = top + ih * 0.77;
  const footpadY = top + ih * 0.94;

  // 1. Splayed landing legs, A-frame cross-trusses, ladder & round footpads
  const outerFootOffset = iw * 0.36;
  const innerFootOffset = iw * 0.145;
  const legShoulderOffset = iw * 0.2;

  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 4.5;
  for (const sgn of [-1, 1] as const) {
    const shoulderX = cx + sgn * legShoulderOffset;
    const hipX = cx + sgn * (legShoulderOffset * 0.92);
    const outerFootX = cx + sgn * outerFootOffset;
    const kneeX = cx + sgn * (outerFootOffset * 0.78);
    const kneeY = descentBotY + (footpadY - descentBotY) * 0.34;

    // Upper gold-foil strut + lower silver oleo leg
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(shoulderX, descentTopY + ih * 0.05);
    ctx.lineTo(kneeX, kneeY);
    ctx.stroke();

    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(hipX, descentBotY - 4);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(outerFootX, footpadY);
    ctx.stroke();

    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(kneeX, kneeY);
    ctx.lineTo(outerFootX, footpadY);
    ctx.stroke();

    // Inner secondary strut
    const innerTopX = cx + sgn * (iw * 0.095);
    const innerFootX = cx + sgn * innerFootOffset;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 4.6;
    ctx.beginPath();
    ctx.moveTo(innerTopX, descentBotY - 2);
    ctx.lineTo(innerFootX, footpadY - ih * 0.015);
    ctx.stroke();

    // Ladder rungs on front-left inner strut
    if (sgn === -1) {
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 2.2;
      for (let r = 1; r <= 5; r++) {
        const t = r / 6;
        const rx = innerTopX + (innerFootX - innerTopX) * t;
        const ry =
          descentBotY - 2 + (footpadY - ih * 0.015 - (descentBotY - 2)) * t;
        ctx.beginPath();
        ctx.moveTo(rx - 7, ry);
        ctx.lineTo(rx + 7, ry);
        ctx.stroke();
      }
    }
  }

  // 4 round lunar footpads
  const footpadXs = [
    cx - outerFootOffset,
    cx - innerFootOffset,
    cx + innerFootOffset,
    cx + outerFootOffset,
  ];
  const footpadYs = [
    footpadY,
    footpadY - ih * 0.015,
    footpadY - ih * 0.015,
    footpadY,
  ];
  for (let i = 0; i < footpadXs.length; i++) {
    ctx.fillStyle = '#F59E0B';
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.ellipse(
      footpadXs[i]!,
      footpadYs[i]!,
      iw * 0.055,
      ih * 0.02,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.stroke();
  }

  // 2. Flared titanium-charcoal descent engine bell
  const nozTopHalf = iw * 0.052;
  const nozBotHalf = iw * 0.088;
  const nozGrad = ctx.createLinearGradient(
    cx - nozBotHalf,
    descentBotY,
    cx + nozBotHalf,
    nozzleBotY
  );
  nozGrad.addColorStop(0, '#475569');
  nozGrad.addColorStop(0.7, '#1E293B');
  nozGrad.addColorStop(1, nozzleLit ? '#B45309' : '#0F172A');

  ctx.fillStyle = nozGrad;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(cx - nozTopHalf, descentBotY - 4);
  ctx.lineTo(cx + nozTopHalf, descentBotY - 4);
  ctx.lineTo(cx + nozBotHalf, nozzleBotY);
  ctx.lineTo(cx - nozBotHalf, nozzleBotY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (nozzleLit) {
    ctx.strokeStyle = '#FEF3C7';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(cx - nozBotHalf + 3, nozzleBotY - 1);
    ctx.lineTo(cx + nozBotHalf - 3, nozzleBotY - 1);
    ctx.stroke();
  }

  // 3. Octagonal Kapton gold-foil descent stage
  const descOuterHalf = iw * 0.22;
  const descMidHalf = iw * 0.115;

  // Left & Right angled copper-gold octagonal side bays
  const sideFoilGrad = ctx.createLinearGradient(
    cx - descOuterHalf,
    descentTopY,
    cx + descOuterHalf,
    descentBotY
  );
  sideFoilGrad.addColorStop(0, '#FBBF24');
  sideFoilGrad.addColorStop(0.5, '#D97706');
  sideFoilGrad.addColorStop(1, '#92400E');

  ctx.fillStyle = sideFoilGrad;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 3.8;
  ctx.beginPath();
  ctx.roundRect(
    cx - descOuterHalf,
    descentTopY,
    descOuterHalf * 2,
    descentBotY - descentTopY,
    8
  );
  ctx.fill();
  ctx.stroke();

  // Central bright Kapton gold-foil bay
  const centerFoilGrad = ctx.createLinearGradient(
    cx - descMidHalf,
    descentTopY,
    cx + descMidHalf,
    descentBotY
  );
  centerFoilGrad.addColorStop(0, '#FEF08A');
  centerFoilGrad.addColorStop(0.48, '#F59E0B');
  centerFoilGrad.addColorStop(1, '#B45309');

  ctx.fillStyle = centerFoilGrad;
  ctx.beginPath();
  ctx.fillRect(
    cx - descMidHalf,
    descentTopY + 2,
    descMidHalf * 2,
    descentBotY - descentTopY - 4
  );
  ctx.strokeRect(
    cx - descMidHalf,
    descentTopY + 2,
    descMidHalf * 2,
    descentBotY - descentTopY - 4
  );

  // Deterministic crinkly Kapton foil facet highlights
  ctx.strokeStyle = 'rgba(255, 251, 235, 0.55)';
  ctx.lineWidth = 2;
  for (let f = 0; f < 5; f++) {
    const fx = cx - descOuterHalf + 18 + f * ((descOuterHalf * 2 - 36) / 4);
    const fy = descentTopY + 12 + rng() * (descentBotY - descentTopY - 32);
    ctx.beginPath();
    ctx.moveTo(fx - 10, fy);
    ctx.lineTo(fx + 10, fy + 10);
    ctx.stroke();
  }

  // 4. Top communications mast & parabolic S-Band dish antenna (drawn right before cabin overlap)
  const mastTopY = dishTopY + ih * 0.055;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx - iw * 0.02, cabinTopY + 8);
  ctx.lineTo(cx - iw * 0.02, mastTopY);
  ctx.moveTo(cx + iw * 0.07, cabinTopY + 10);
  ctx.lineTo(cx + iw * 0.09, dishTopY + 6);
  ctx.stroke();

  ctx.fillStyle = '#FAF8F5';
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(
    cx - iw * 0.02,
    mastTopY,
    iw * 0.062,
    Math.PI * 1.08,
    Math.PI * 1.92
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 5. Iconic faceted ivory/charcoal Apollo ascent cabin + RCS pods + triangular windows
  const cabHalfW = iw * 0.185;
  const cabTopHalfW = iw * 0.12;
  const cabMidY = cabinTopY + (cabinBotY - cabinTopY) * 0.42;

  // Left & Right RCS thruster pods
  ctx.fillStyle = '#CBD5E1';
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 3;
  for (const sgn of [-1, 1] as const) {
    ctx.beginPath();
    ctx.roundRect(
      cx + sgn * (cabHalfW + iw * 0.012) - iw * 0.026,
      cabMidY - 12,
      iw * 0.052,
      24,
      5
    );
    ctx.fill();
    ctx.stroke();
  }

  // Charcoal side equipment cheeks + sculpted ivory central crew hull
  ctx.fillStyle = '#334155';
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 3.8;
  ctx.beginPath();
  ctx.moveTo(cx - cabTopHalfW, cabinTopY);
  ctx.lineTo(cx + cabTopHalfW, cabinTopY);
  ctx.lineTo(cx + cabHalfW, cabMidY);
  ctx.lineTo(cx + cabHalfW * 0.86, cabinBotY);
  ctx.lineTo(cx - cabHalfW * 0.86, cabinBotY);
  ctx.lineTo(cx - cabHalfW, cabMidY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const cabinGrad = ctx.createLinearGradient(
    cx - cabTopHalfW,
    cabinTopY,
    cx + cabTopHalfW,
    cabinBotY
  );
  cabinGrad.addColorStop(0, '#FFFDF9');
  cabinGrad.addColorStop(0.65, '#E2E8F0');
  cabinGrad.addColorStop(1, '#CBD5E1');

  ctx.fillStyle = cabinGrad;
  ctx.beginPath();
  ctx.moveTo(cx - cabTopHalfW * 0.84, cabinTopY + 4);
  ctx.lineTo(cx + cabTopHalfW * 0.84, cabinTopY + 4);
  ctx.lineTo(cx + cabHalfW * 0.72, cabMidY);
  ctx.lineTo(cx + cabHalfW * 0.62, cabinBotY - 2);
  ctx.lineTo(cx - cabHalfW * 0.62, cabinBotY - 2);
  ctx.lineTo(cx - cabHalfW * 0.72, cabMidY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Left & Right inward-canted triangular rendezvous/pilot windows
  for (const sgn of [-1, 1] as const) {
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(cx + sgn * (iw * 0.03), cabinTopY + ih * 0.065);
    ctx.lineTo(cx + sgn * (iw * 0.105), cabinTopY + ih * 0.095);
    ctx.lineTo(cx + sgn * (iw * 0.045), cabinTopY + ih * 0.145);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Specular window glint
    ctx.strokeStyle = '#7DD3FC';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx + sgn * (iw * 0.045), cabinTopY + ih * 0.085);
    ctx.lineTo(cx + sgn * (iw * 0.082), cabinTopY + ih * 0.1);
    ctx.stroke();
  }

  // Forward square ingress hatch
  const hatchW = iw * 0.072;
  const hatchH = ih * 0.09;
  ctx.fillStyle = '#475569';
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.roundRect(
    cx - hatchW * 0.5,
    cabinBotY - hatchH - 8,
    hatchW,
    hatchH,
    4
  );
  ctx.fill();
  ctx.stroke();
}

export interface LunarLanderCutout3DProps extends ScenicCutoutCommonProps {
  /** Braking engine plume intensity (0..1; cleanly hidden when <= 0.02) */
  thrusterIntensity?: number;
}

export const LunarLanderCutout3D: React.FC<LunarLanderCutout3DProps> = ({
  cacheKey = 'scenic-lunar-lander',
  width = 2.45,
  height = 2.28,
  pixelWidth = 560,
  pixelHeight = 520,
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
  seed = 'apollo-lander-v1',
  thrusterIntensity = 0,
}) => {
  const style = useStudioStyle();
  const clampedThruster = Math.max(0, Math.min(1, thrusterIntensity));
  const isThrusterActive = clampedThruster > 0.02;
  const thrusterStateDep = isThrusterActive ? 1 : 0;

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

  // Quantize canvas texture state to firing vs off (1 vs 0) in cacheDeps while scaling the
  // 3D plume mesh smoothly on every frame at 60 FPS without regenerating offscreen canvases!
  const cacheDeps = useMemo(
    () => buildPaletteCacheDeps(pal, [seed, thrusterStateDep, whiteBorderPx]),
    [pal, seed, thrusterStateDep, whiteBorderPx]
  );

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      drawLunarLanderMotif(ctx, w, h, pal, {
        seed,
        thrusterIntensity: thrusterStateDep,
        whiteBorderPx,
      });
    },
    [pal, seed, thrusterStateDep, whiteBorderPx]
  );

  const yOffset =
    anchor === 'bottom' ? height * 0.5 : anchor === 'top' ? -height * 0.5 : 0;
  // Engine bell exit lip sits around 71% down from top of cutout -> local Y above footpads
  const nozzleExitLocalY = yOffset + height * (0.5 - 0.71);
  const maxPlumeLength = height * 0.24;
  const plumeZ = -(thickness + 0.036);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <PaperCutout3D
        cacheKey={cacheKey}
        cacheDeps={cacheDeps}
        width={width}
        height={height}
        pixelWidth={pixelWidth}
        pixelHeight={pixelHeight}
        whiteBorderPx={whiteBorderPx}
        position={[0, 0, 0]}
        anchor={anchor}
        thickness={thickness}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
        opacity={opacity}
        draw={draw}
      />

      {isThrusterActive && (
        <group
          name="lunar-thruster-plume"
          position={[0, nozzleExitLocalY, plumeZ]}
          scale={[
            0.7 + 0.35 * clampedThruster,
            clampedThruster,
            1,
          ]}
        >
          {/* Soft outer golden-amber braking halo */}
          <mesh
            position={[0, -maxPlumeLength * 0.42, -0.006]}
            rotation={[Math.PI, 0, 0]}
            castShadow={false}
          >
            <coneGeometry args={[width * 0.13, maxPlumeLength * 0.84, 12]} />
            <meshBasicMaterial
              color="#FBBF24"
              transparent
              opacity={0.36 * clampedThruster * opacity}
              depthWrite={false}
            />
          </mesh>

          {/* Mid amber braking plume */}
          <mesh
            position={[0, -maxPlumeLength * 0.5, 0]}
            rotation={[Math.PI, 0, 0]}
            castShadow={false}
          >
            <coneGeometry args={[width * 0.095, maxPlumeLength, 12]} />
            <meshBasicMaterial
              color="#F59E0B"
              transparent
              opacity={0.78 * clampedThruster * opacity}
              depthWrite={false}
            />
          </mesh>

          {/* Bright cream-ivory inner core */}
          <mesh
            position={[0, -maxPlumeLength * 0.34, 0.006]}
            rotation={[Math.PI, 0, 0]}
            castShadow={false}
          >
            <coneGeometry args={[width * 0.052, maxPlumeLength * 0.68, 10]} />
            <meshBasicMaterial
              color="#FEF3C7"
              transparent
              opacity={0.94 * clampedThruster * opacity}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}
    </group>
  );
};
