import type React from 'react';
import type { StyleFontFamily, StylePreset } from './schema';

const SERIF_FAMILIES = new Set<StyleFontFamily>([
  'Fraunces',
  'Instrument Serif',
  'Playfair Display',
]);

const MONO_FAMILIES = new Set<StyleFontFamily>([
  'JetBrains Mono',
  'IBM Plex Mono',
]);

export function formatFontFamilyCss(
  family: StyleFontFamily,
  role: 'display' | 'body' | 'mono' = 'body'
): string {
  const quoted = family.includes(' ') ? `'${family}'` : family;
  if (role === 'mono' || MONO_FAMILIES.has(family)) {
    return `${quoted}, ui-monospace, SFMono-Regular, Menlo, monospace`;
  }
  if (SERIF_FAMILIES.has(family)) {
    return `${quoted}, Georgia, 'Times New Roman', serif`;
  }
  if (family === 'Caveat') {
    return `${quoted}, 'Bradley Hand', cursive, sans-serif`;
  }
  return `${quoted}, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
}

export function formatHeadingText(text: string, style: StylePreset): string {
  return style.typography.headingCase === 'uppercase'
    ? text.toLocaleUpperCase('pl-PL')
    : text;
}

export function getCardChromeStyle(
  style: StylePreset,
  overrides?: React.CSSProperties
): React.CSSProperties {
  const baseRadius = Math.round(22 * style.surface.radiusScale);
  const { palette, surface } = style;

  let base: React.CSSProperties;

  switch (surface.cardTreatment) {
    case 'brutalist-hard':
      base = {
        backgroundColor: palette.bgSurface,
        color: palette.textPrimary,
        border: `3px solid ${palette.inkBorder}`,
        borderRadius: baseRadius,
        boxShadow: `6px 6px 0px ${palette.inkBorder}`,
      };
      break;

    case 'editorial-ink':
      base = {
        backgroundColor: palette.bgSurface,
        color: palette.textPrimary,
        border: `1.5px solid ${palette.inkBorder}`,
        borderRadius: baseRadius,
        boxShadow: `0 10px 28px rgba(24, 22, 21, 0.07)`,
      };
      break;

    case 'glass-glow':
      base = {
        backgroundColor: surface.isDark
          ? 'rgba(15, 23, 42, 0.84)'
          : 'rgba(255, 255, 255, 0.84)',
        color: palette.textPrimary,
        border: `1.5px solid ${palette.inkBorder}`,
        borderRadius: baseRadius,
        boxShadow: `0 20px 50px rgba(0, 0, 0, 0.36), 0 0 28px ${palette.accentPrimary}22`,
        backdropFilter: 'blur(16px)',
      };
      break;

    case 'tactile-cutout':
      base = {
        backgroundColor: palette.bgSurface,
        color: palette.textPrimary,
        border: `5px solid #FFFFFF`,
        borderRadius: baseRadius,
        boxShadow:
          '0 18px 34px rgba(31, 41, 55, 0.14), 0 3px 8px rgba(31, 41, 55, 0.08)',
      };
      break;

    case 'minimal-clean':
    default:
      base = {
        backgroundColor: palette.bgSurface,
        color: palette.textPrimary,
        border: `1px solid ${palette.inkBorder}`,
        borderRadius: baseRadius,
        boxShadow: surface.isDark
          ? '0 18px 40px rgba(0, 0, 0, 0.4)'
          : '0 16px 36px rgba(15, 23, 42, 0.07)',
      };
      break;
  }

  return overrides ? { ...base, ...overrides } : base;
}

export function getStyleSpringConfig(
  style: StylePreset,
  role: 'enter' | 'emphasis' | 'camera' = 'enter'
): { damping: number; stiffness: number; mass: number } {
  if (role === 'camera') {
    return style.motion.profile === 'cinematic-fluid'
      ? { damping: 200, stiffness: 58, mass: 1.25 }
      : { damping: 200, stiffness: 82, mass: 1.05 };
  }

  switch (style.motion.profile) {
    case 'editorial-calm':
      return role === 'emphasis'
        ? { damping: 200, stiffness: 120, mass: 0.95 }
        : { damping: 200, stiffness: 92, mass: 1.05 };

    case 'cinematic-fluid':
      return role === 'emphasis'
        ? { damping: 200, stiffness: 108, mass: 1.05 }
        : { damping: 200, stiffness: 76, mass: 1.15 };

    case 'tactile-pop':
      return role === 'emphasis'
        ? { damping: 18, stiffness: 230, mass: 0.82 }
        : { damping: 22, stiffness: 195, mass: 0.88 };

    case 'snappy-product':
    default:
      return role === 'emphasis'
        ? { damping: 200, stiffness: 190, mass: 0.85 }
        : { damping: 200, stiffness: 145, mass: 0.92 };
  }
}
