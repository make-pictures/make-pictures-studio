import { interpolateColors } from 'remotion';
import { resolveArtWorld, type ArtWorld, type StylePreset } from "../../..";
import type { PaperCutoutDep } from '../PaperCutout3D';

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
  /** Respects Frame 0 clean-board invariant (default true) */
  cleanFrameZero?: boolean;
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

export function safeBlendColor(t: number, colorA: string, colorB: string): string {
  try {
    return interpolateColors(t, [0, 1], [colorA, colorB]);
  } catch {
    return t < 0.5 ? colorA : colorB;
  }
}

export function resolveSafeMarginPx(whiteBorderPx: number = 14): number {
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

export function buildPaletteCacheDeps(
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
