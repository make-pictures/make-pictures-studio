import { resolveStyleOptics, type StylePreset } from '@make-pictures/core';

export type IsometricMaterialPreset =
  | 'ceramic-maquette'
  | 'anodized-telemetry'
  | 'ink-figurine';

export type IsometricMaterialMode = IsometricMaterialPreset;

export interface IsometricMaterialTokens {
  preset: IsometricMaterialPreset;
  headColor: string;
  torsoColorFallback: string;
  limbColor: string;
  jointColor: string;
  shoeColor: string;
  visorColor: string;
  collarColor: string;
  eyeHighlightColor: string;
  roughness: number;
  metalness: number;
  limbRoughness: number;
  limbMetalness: number;
  visorStyle: 'sculpted-band' | 'slit-visor' | 'ink-mask';
  outlineRingOpacity: number;
}

export interface IsometricLightRigSpec {
  ambientIntensity: number;
  keyPosition: [number, number, number];
  keyIntensity: number;
  keyColor: string;
  rimPosition: [number, number, number];
  rimIntensity: number;
  rimColor: string;
  fillPosition: [number, number, number];
  fillIntensity: number;
  contactShadowOpacity: number;
  contactShadowColor: string;
  enableBeamsByDefault: boolean;
  beamOrigin: [number, number, number];
  beamColor: string;
  beamOpacity: number;
}

export function resolveIsometricMaterialPreset(
  style: StylePreset,
  override?: IsometricMaterialPreset
): IsometricMaterialPreset {
  if (override) {
    return override;
  }
  if (
    style.surface.cardTreatment === 'brutalist-hard' ||
    style.id === 'sketch-notebook' ||
    style.id === 'tactile-craft'
  ) {
    return 'ink-figurine';
  }
  const optics = resolveStyleOptics(style);
  if (style.surface.isDark || optics.lightingRig === 'darkroom-halation') {
    return 'anodized-telemetry';
  }
  return 'ceramic-maquette';
}

export function resolveIsometricMaterialTokens(
  style: StylePreset,
  override?: IsometricMaterialPreset
): IsometricMaterialTokens {
  const preset = resolveIsometricMaterialPreset(style, override);
  const { palette } = style;

  if (preset === 'anodized-telemetry') {
    return {
      preset,
      headColor: palette.bgElevated,
      torsoColorFallback: palette.accentPrimary,
      limbColor: palette.bgSurface,
      jointColor: palette.inkBorder,
      shoeColor: palette.bgElevated,
      visorColor: palette.bgCanvas,
      collarColor: palette.accentSecondary,
      eyeHighlightColor: palette.textPrimary,
      roughness: 0.34,
      metalness: 0.32,
      limbRoughness: 0.38,
      limbMetalness: 0.28,
      visorStyle: 'slit-visor',
      outlineRingOpacity: 0.58,
    };
  }

  if (preset === 'ink-figurine') {
    return {
      preset,
      headColor: palette.bgCanvas,
      torsoColorFallback: palette.accentPrimary,
      limbColor: palette.textPrimary,
      jointColor: palette.inkBorder,
      shoeColor: palette.textPrimary,
      visorColor: palette.textPrimary,
      collarColor: palette.inkBorder,
      eyeHighlightColor: palette.bgCanvas,
      roughness: 0.92,
      metalness: 0.02,
      limbRoughness: 0.94,
      limbMetalness: 0.02,
      visorStyle: 'ink-mask',
      outlineRingOpacity: 0.85,
    };
  }

  // 'ceramic-maquette'
  return {
    preset,
    headColor: palette.bgElevated,
    torsoColorFallback: palette.accentPrimary,
    limbColor: palette.textSecondary,
    jointColor: palette.inkBorder,
    shoeColor: palette.textPrimary,
    visorColor: palette.inkBorder,
    collarColor: palette.bgSurface,
    eyeHighlightColor: palette.bgSurface,
    roughness: 0.78,
    metalness: 0.04,
    limbRoughness: 0.82,
    limbMetalness: 0.04,
    visorStyle: 'sculpted-band',
    outlineRingOpacity: 0.48,
  };
}

export const resolveIsometricCharacterMaterial = resolveIsometricMaterialTokens;

export function computeIsometricLightRig(
  style: StylePreset
): IsometricLightRigSpec {
  const optics = resolveStyleOptics(style);
  const { palette, surface } = style;
  const rad = (optics.lightAngleDeg * Math.PI) / 180;

  const keyX = Number((Math.sin(rad) * 9.2).toFixed(3));
  const keyZ = Number((Math.cos(rad) * 8.4).toFixed(3));
  const rimX = Number((-Math.sin(rad) * 6.8).toFixed(3));
  const rimZ = Number((-Math.cos(rad) * 6.2).toFixed(3));

  const isWindow = optics.lightingRig === 'window-gobo';
  const isDarkroom = optics.lightingRig === 'darkroom-halation';

  const keyColor = isWindow
    ? '#FFF7ED'
    : isDarkroom
      ? '#E0F2FE'
      : '#FFFFFF';

  const beamColor = isWindow
    ? '#FFF7ED'
    : isDarkroom
      ? palette.accentPrimary
      : palette.bgElevated;

  return {
    ambientIntensity: surface.isDark ? 0.52 : 0.78,
    keyPosition: [keyX, 11.4, keyZ],
    keyIntensity: surface.isDark ? 1.38 : 1.16,
    keyColor,
    rimPosition: [rimX, 5.2, rimZ],
    rimIntensity: surface.isDark ? 0.86 : 0.48,
    rimColor: palette.accentSecondary,
    fillPosition: [-keyX * 0.45, 6.4, keyZ * 0.55],
    fillIntensity: surface.isDark ? 0.28 : 0.36,
    contactShadowOpacity: surface.isDark ? 0.44 : 0.28,
    contactShadowColor: surface.isDark ? '#020617' : palette.textPrimary,
    enableBeamsByDefault: isWindow || isDarkroom,
    beamOrigin: [
      Number((Math.sin(rad) * 4.6).toFixed(3)),
      8.4,
      Number((Math.cos(rad) * 3.2).toFixed(3)),
    ],
    beamColor,
    beamOpacity: isDarkroom
      ? Math.min(0.11, 0.045 + optics.halation * 0.065)
      : 0.055,
  };
}

export const resolveIsometricLightRig = computeIsometricLightRig;
