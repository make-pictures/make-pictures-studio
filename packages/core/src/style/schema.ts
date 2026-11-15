import { z } from 'zod';

const CSS_COLOR_RE =
  /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))$/;

const ColorHexField = (label: string) =>
  z
    .string()
    .regex(CSS_COLOR_RE, 'Podaj prawidłowy kolor HEX (#RRGGBB) lub rgba(...)')
    .describe(`Paleta kolorów :: ${label}`);

export const STYLE_FONT_FAMILIES = [
  'Inter',
  'Plus Jakarta Sans',
  'DM Sans',
  'Space Grotesk',
  'Syne',
  'Archivo Black',
  'Outfit',
  'Fraunces',
  'Instrument Serif',
  'Playfair Display',
  'Caveat',
  'JetBrains Mono',
  'IBM Plex Mono',
] as const;

export const StyleFontFamilySchema = z.enum(STYLE_FONT_FAMILIES);
export type StyleFontFamily = z.infer<typeof StyleFontFamilySchema>;

export const StyleBackdropTypeSchema = z.enum([
  'solid',
  'editorial-paper',
  'blueprint-grid',
  'mesh-aura',
  'halftone-dots',
  'dark-vignette',
]);
export type StyleBackdropType = z.infer<typeof StyleBackdropTypeSchema>;

export const StyleCardTreatmentSchema = z.enum([
  'minimal-clean',
  'editorial-ink',
  'brutalist-hard',
  'glass-glow',
  'tactile-cutout',
]);
export type StyleCardTreatment = z.infer<typeof StyleCardTreatmentSchema>;

export const StyleMotionProfileSchema = z.enum([
  'editorial-calm',
  'snappy-product',
  'tactile-pop',
  'cinematic-fluid',
]);
export type StyleMotionProfile = z.infer<typeof StyleMotionProfileSchema>;

export const VoiceArchetypeSchema = z.enum([
  'crisp-tech',
  'calm-editorial',
  'documentary-warm',
  'storyteller-expressive',
]);
export type VoiceArchetype = z.infer<typeof VoiceArchetypeSchema>;

export const StyleMusicMoodSchema = z.enum([
  'ambient-tech',
  'warm-story',
  'upbeat-launch',
  'news-pulse',
  'paper-expedition',
  'cinematic-drone',
  'cinematic-epic',
]);
export type StyleMusicMood = z.infer<typeof StyleMusicMoodSchema>;

export const StyleLightingRigSchema = z.enum([
  'window-gobo',
  'darkroom-halation',
  'studio-macro',
]);
export type StyleLightingRig = z.infer<typeof StyleLightingRigSchema>;

export const StyleTypographyGrammarSchema = z.enum([
  'swiss-spatial',
  'optical-gate',
  'risograph-poster',
]);
export type StyleTypographyGrammar = z.infer<
  typeof StyleTypographyGrammarSchema
>;

export const StyleOpticsSchema = z.object({
  lightingRig: StyleLightingRigSchema.describe(
    'Optyka & Światło :: Reżim oświetlenia sceny'
  ),
  typographyGrammar: StyleTypographyGrammarSchema.describe(
    'Optyka & Światło :: Gramatyka typografii kinetycznej'
  ),
  lightAngleDeg: z
    .number()
    .min(-60)
    .max(60)
    .describe('Optyka & Światło :: Kąt głównego światła (°)'),
  aperture: z
    .number()
    .min(0)
    .max(1)
    .describe('Optyka & Światło :: Przysłona / płytkość ostrości (0–1)'),
  halation: z
    .number()
    .min(0)
    .max(1)
    .describe('Optyka & Światło :: Halacja i rozproszenie świateł (0–1)'),
});
export type StyleOptics = z.infer<typeof StyleOpticsSchema>;

export const StylePresetSchema = z.object({
  id: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*$/)
    .describe('Informacje :: Identyfikator stylu (slug)'),
  name: z.string().min(2).max(80).describe('Informacje :: Nazwa stylu'),
  description: z
    .string()
    .min(4)
    .max(240)
    .describe('Informacje :: Opis kierunku plastycznego'),
  recommendedFor: z.array(z.string()).default([]).describe('Informacje :: Polecane zastosowania'),

  palette: z.object({
    bgCanvas: ColorHexField('Tło płótna (Canvas)'),
    bgSurface: ColorHexField('Tło karty (Surface)'),
    bgElevated: ColorHexField('Tło wyróżnione (Elevated)'),
    textPrimary: ColorHexField('Tekst główny'),
    textSecondary: ColorHexField('Tekst pomocniczy'),
    accentPrimary: ColorHexField('Akcent główny'),
    accentSecondary: ColorHexField('Akcent drugi'),
    inkBorder: ColorHexField('Obrys / linia (Ink Border)'),
  }),

  typography: z.object({
    displayFont: StyleFontFamilySchema.describe(
      'Typografia :: Font nagłówkowy (Display)'
    ),
    bodyFont: StyleFontFamilySchema.describe(
      'Typografia :: Font treści (Body)'
    ),
    monoFont: StyleFontFamilySchema.describe(
      'Typografia :: Font techniczny (Mono)'
    ),
    headingCase: z
      .enum(['sentence', 'uppercase'])
      .describe('Typografia :: Wielkość liter nagłówków'),
    displayTrackingEm: z
      .number()
      .min(-0.05)
      .max(0.12)
      .describe('Typografia :: Rozstrzelenie nagłówków (em)'),
  }),

  surface: z.object({
    backdropType: StyleBackdropTypeSchema.describe(
      'Powierzchnia & Tło :: Faktura tła'
    ),
    cardTreatment: StyleCardTreatmentSchema.describe(
      'Powierzchnia & Tło :: Styl kart i ramek'
    ),
    radiusScale: z
      .number()
      .min(0)
      .max(2)
      .describe('Powierzchnia & Tło :: Zaokrąglenie rogów (0–2)'),
    grainOpacity: z
      .number()
      .min(0)
      .max(0.18)
      .describe('Powierzchnia & Tło :: Ziarno analogowe (0–0.18)'),
    isDark: z
      .boolean()
      .describe('Powierzchnia & Tło :: Tryb ciemny (Dark Mode)'),
  }),

  motion: z.object({
    profile: StyleMotionProfileSchema.describe(
      'Fizyka ruchu :: Profil sprężyn'
    ),
    cameraHandheld: z
      .number()
      .min(0)
      .max(0.35)
      .describe('Fizyka ruchu :: Drganie kamery z ręki (0–0.35)'),
  }),

  optics: StyleOpticsSchema.optional(),

  audioDefaults: z.object({
    musicMood: StyleMusicMoodSchema.describe(
      'Domyślne Audio :: Nastrój muzyki'
    ),
    voiceArchetype: VoiceArchetypeSchema.describe(
      'Domyślne Audio :: Archetyp głosu lektora'
    ),
  }),
});

export type StylePreset = z.infer<typeof StylePresetSchema>;

export function deriveDefaultOpticsForSurface(
  surface: StylePreset['surface']
): StyleOptics {
  if (surface.isDark) {
    return {
      lightingRig: 'darkroom-halation',
      typographyGrammar: 'optical-gate',
      lightAngleDeg: -24,
      aperture: 0.48,
      halation: 0.52,
    };
  }
  if (
    surface.backdropType === 'halftone-dots' ||
    surface.cardTreatment === 'brutalist-hard' ||
    surface.cardTreatment === 'tactile-cutout'
  ) {
    return {
      lightingRig: 'window-gobo',
      typographyGrammar: 'risograph-poster',
      lightAngleDeg: -32,
      aperture: 0.38,
      halation: 0.16,
    };
  }
  if (
    surface.backdropType === 'editorial-paper' ||
    surface.cardTreatment === 'editorial-ink'
  ) {
    return {
      lightingRig: 'window-gobo',
      typographyGrammar: 'swiss-spatial',
      lightAngleDeg: -28,
      aperture: 0.46,
      halation: 0.18,
    };
  }
  return {
    lightingRig: 'studio-macro',
    typographyGrammar: 'swiss-spatial',
    lightAngleDeg: -22,
    aperture: 0.36,
    halation: 0.08,
  };
}

export function resolveStyleOptics(style: StylePreset): StyleOptics {
  return style.optics ?? deriveDefaultOpticsForSurface(style.surface);
}

export function withNormalizedStyleOptics(style: StylePreset): StylePreset {
  if (style.optics) return style;
  return {
    ...style,
    optics: deriveDefaultOpticsForSurface(style.surface),
  };
}
