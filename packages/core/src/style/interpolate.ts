import { Easing, interpolateColors } from 'remotion';
import {
  resolveArtWorld,
  resolveStyleMaterial3D,
  resolveStyleOptics,
  resolveStyleSpaces,
  type StylePreset,
} from './schema';

interface ParsedRgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerpRounded(from: number, to: number, t: number, decimals = 4): number {
  const raw = from + (to - from) * t;
  const factor = 10 ** decimals;
  return Math.round(raw * factor) / factor;
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hslToRgb(hDeg: number, sPct: number, lPct: number): [number, number, number] {
  const h = (((hDeg % 360) + 360) % 360) / 360;
  const s = clamp(sPct / 100, 0, 1);
  const l = clamp(lPct / 100, 0, 1);

  if (s === 0) {
    const v = clampByte(l * 255);
    return [v, v, v];
  }

  const hue2rgb = (p: number, q: number, tVal: number): number => {
    let t = tVal;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    clampByte(hue2rgb(p, q, h + 1 / 3) * 255),
    clampByte(hue2rgb(p, q, h) * 255),
    clampByte(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

function parseAlphaToken(token: string | undefined): number {
  if (!token) return 1;
  const trimmed = token.trim();
  if (!trimmed) return 1;
  if (trimmed.endsWith('%')) {
    const pct = Number(trimmed.slice(0, -1));
    return Number.isFinite(pct) ? clamp(pct / 100, 0, 1) : 1;
  }
  const num = Number(trimmed);
  return Number.isFinite(num) ? clamp(num, 0, 1) : 1;
}

function parseCssColorToRgba(input: string): ParsedRgba {
  const trimmed = input.trim();

  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0]! + hex[0]!, 16),
        g: parseInt(hex[1]! + hex[1]!, 16),
        b: parseInt(hex[2]! + hex[2]!, 16),
        a: 1,
      };
    }
    if (hex.length === 4) {
      return {
        r: parseInt(hex[0]! + hex[0]!, 16),
        g: parseInt(hex[1]! + hex[1]!, 16),
        b: parseInt(hex[2]! + hex[2]!, 16),
        a: clamp(parseInt(hex[3]! + hex[3]!, 16) / 255, 0, 1),
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: 1,
      };
    }
    if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: clamp(parseInt(hex.slice(6, 8), 16) / 255, 0, 1),
      };
    }
  }

  const rgbMatch = trimmed.match(/^rgba?\(\s*([^)]+)\)$/i);
  if (rgbMatch) {
    const body = rgbMatch[1]!.trim();
    let parts: string[];
    let alphaRaw: string | undefined;
    if (body.includes(',')) {
      const commaParts = body.split(',').map((p) => p.trim());
      parts = commaParts.slice(0, 3);
      alphaRaw = commaParts[3];
    } else {
      const [channelsPart = '', slashAlpha] = body.split('/');
      parts = channelsPart.trim().split(/\s+/);
      alphaRaw = slashAlpha;
    }
    if (parts.length >= 3) {
      const parseChannel = (tok: string): number => {
        if (tok.endsWith('%')) {
          const pct = Number(tok.slice(0, -1));
          return Number.isFinite(pct) ? clampByte((pct / 100) * 255) : 0;
        }
        const n = Number(tok);
        return Number.isFinite(n) ? clampByte(n) : 0;
      };
      return {
        r: parseChannel(parts[0]!),
        g: parseChannel(parts[1]!),
        b: parseChannel(parts[2]!),
        a: parseAlphaToken(alphaRaw),
      };
    }
  }

  const hslMatch = trimmed.match(/^hsla?\(\s*([^)]+)\)$/i);
  if (hslMatch) {
    const body = hslMatch[1]!.trim();
    let parts: string[];
    let alphaRaw: string | undefined;
    if (body.includes(',')) {
      const commaParts = body.split(',').map((p) => p.trim());
      parts = commaParts.slice(0, 3);
      alphaRaw = commaParts[3];
    } else {
      const [channelsPart = '', slashAlpha] = body.split('/');
      parts = channelsPart.trim().split(/\s+/);
      alphaRaw = slashAlpha;
    }
    if (parts.length >= 3) {
      const h = Number(parts[0]!.replace(/deg$/i, ''));
      const s = Number(parts[1]!.replace(/%$/, ''));
      const l = Number(parts[2]!.replace(/%$/, ''));
      if (Number.isFinite(h) && Number.isFinite(s) && Number.isFinite(l)) {
        const [r, g, b] = hslToRgb(h, s, l);
        return { r, g, b, a: parseAlphaToken(alphaRaw) };
      }
    }
  }

  return { r: 0, g: 0, b: 0, a: 1 };
}

function formatRgbaForRemotion(rgba: ParsedRgba): string {
  return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${Number(rgba.a.toFixed(4))})`;
}

function formatPaletteOutputColor(rgba: ParsedRgba): string {
  if (rgba.a >= 0.999) {
    const hexR = clampByte(rgba.r).toString(16).padStart(2, '0');
    const hexG = clampByte(rgba.g).toString(16).padStart(2, '0');
    const hexB = clampByte(rgba.b).toString(16).padStart(2, '0');
    return `#${hexR}${hexG}${hexB}`.toUpperCase();
  }
  return `rgba(${clampByte(rgba.r)}, ${clampByte(rgba.g)}, ${clampByte(rgba.b)}, ${Number(
    clamp(rgba.a, 0, 1).toFixed(4)
  )})`;
}

export function interpolateStyleColor(
  fromColor: string,
  toColor: string,
  easedProgress: number
): string {
  const normFrom = formatRgbaForRemotion(parseCssColorToRgba(fromColor));
  const normTo = formatRgbaForRemotion(parseCssColorToRgba(toColor));
  const rawInterpolated = interpolateColors(
    clamp(easedProgress, 0, 1),
    [0, 1],
    [normFrom, normTo]
  );
  return formatPaletteOutputColor(parseCssColorToRgba(rawInterpolated));
}

/**
 * Smooth 60 FPS continuous interpolation between two `StylePreset` worlds.
 * Applies cubic smoothstep (`Easing.inOut(Easing.cubic)`) across all 8 `palette` colors,
 * `surface.radiusScale`, `surface.grainOpacity`, `motion.cameraHandheld`, and
 * `optics` (`lightAngleDeg`, `aperture`, `halation`), switching discrete tokens cleanly at `t >= 0.5`.
 */
export function interpolateStylePresets(
  fromStyle: StylePreset,
  toStyle: StylePreset,
  progress: number
): StylePreset {
  const clamped = Number.isFinite(progress) ? clamp(progress, 0, 1) : 0;
  if (clamped <= 0) {
    return fromStyle;
  }
  if (clamped >= 1) {
    return toStyle;
  }

  const eased = Easing.inOut(Easing.cubic)(clamped);
  const useTo = clamped >= 0.5;
  const activeDiscrete = useTo ? toStyle : fromStyle;
  const activeSpaces = resolveStyleSpaces(activeDiscrete);

  const fromMaterial3D = resolveStyleMaterial3D(fromStyle);
  const toMaterial3D = resolveStyleMaterial3D(toStyle);

  const fromOptics = resolveStyleOptics(fromStyle);
  const toOptics = resolveStyleOptics(toStyle);

  return {
    id: activeDiscrete.id,
    name: activeDiscrete.name,
    description: activeDiscrete.description,
    recommendedFor: [...activeDiscrete.recommendedFor],
    artWorld: resolveArtWorld(activeDiscrete),
    preferredSpace: activeSpaces.preferredSpace,
    spaces: [...activeSpaces.spaces],
    palette: {
      bgCanvas: interpolateStyleColor(
        fromStyle.palette.bgCanvas,
        toStyle.palette.bgCanvas,
        eased
      ),
      bgSurface: interpolateStyleColor(
        fromStyle.palette.bgSurface,
        toStyle.palette.bgSurface,
        eased
      ),
      bgElevated: interpolateStyleColor(
        fromStyle.palette.bgElevated,
        toStyle.palette.bgElevated,
        eased
      ),
      textPrimary: interpolateStyleColor(
        fromStyle.palette.textPrimary,
        toStyle.palette.textPrimary,
        eased
      ),
      textSecondary: interpolateStyleColor(
        fromStyle.palette.textSecondary,
        toStyle.palette.textSecondary,
        eased
      ),
      accentPrimary: interpolateStyleColor(
        fromStyle.palette.accentPrimary,
        toStyle.palette.accentPrimary,
        eased
      ),
      accentSecondary: interpolateStyleColor(
        fromStyle.palette.accentSecondary,
        toStyle.palette.accentSecondary,
        eased
      ),
      inkBorder: interpolateStyleColor(
        fromStyle.palette.inkBorder,
        toStyle.palette.inkBorder,
        eased
      ),
    },
    typography: {
      displayFont: activeDiscrete.typography.displayFont,
      bodyFont: activeDiscrete.typography.bodyFont,
      monoFont: activeDiscrete.typography.monoFont,
      headingCase: activeDiscrete.typography.headingCase,
      displayTrackingEm: clamp(
        lerpRounded(
          fromStyle.typography.displayTrackingEm,
          toStyle.typography.displayTrackingEm,
          eased,
          4
        ),
        -0.05,
        0.12
      ),
    },
    surface: {
      backdropType: activeDiscrete.surface.backdropType,
      cardTreatment: activeDiscrete.surface.cardTreatment,
      radiusScale: clamp(
        lerpRounded(
          fromStyle.surface.radiusScale,
          toStyle.surface.radiusScale,
          eased,
          4
        ),
        0,
        2
      ),
      grainOpacity: clamp(
        lerpRounded(
          fromStyle.surface.grainOpacity,
          toStyle.surface.grainOpacity,
          eased,
          4
        ),
        0,
        0.18
      ),
      isDark: activeDiscrete.surface.isDark,
    },
    material3d: {
      finish: useTo ? toMaterial3D.finish : fromMaterial3D.finish,
      bevelRadius: clamp(
        lerpRounded(
          fromMaterial3D.bevelRadius,
          toMaterial3D.bevelRadius,
          eased,
          4
        ),
        0,
        0.25
      ),
      studioHdr: useTo ? toMaterial3D.studioHdr : fromMaterial3D.studioHdr,
    },
    motion: {
      profile: activeDiscrete.motion.profile,
      cameraHandheld: clamp(
        lerpRounded(
          fromStyle.motion.cameraHandheld,
          toStyle.motion.cameraHandheld,
          eased,
          4
        ),
        0,
        0.35
      ),
    },
    optics: {
      lightingRig: useTo ? toOptics.lightingRig : fromOptics.lightingRig,
      typographyGrammar: useTo
        ? toOptics.typographyGrammar
        : fromOptics.typographyGrammar,
      lightAngleDeg: clamp(
        lerpRounded(fromOptics.lightAngleDeg, toOptics.lightAngleDeg, eased, 3),
        -60,
        60
      ),
      aperture: clamp(
        lerpRounded(fromOptics.aperture, toOptics.aperture, eased, 4),
        0,
        1
      ),
      halation: clamp(
        lerpRounded(fromOptics.halation, toOptics.halation, eased, 4),
        0,
        1
      ),
    },
    audioDefaults: {
      musicMood: activeDiscrete.audioDefaults.musicMood,
      voiceArchetype: activeDiscrete.audioDefaults.voiceArchetype,
    },
  };
}
