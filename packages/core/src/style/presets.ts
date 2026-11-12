import type { StylePreset } from './schema';

export * from './schema';

export const BUILT_IN_STYLE_IDS = [
  'minimal-product',
  'editorial-press',
  'archival-chronicle',
  'cyber-telemetry',
  'brutalist-poster',
  'sketch-notebook',
  'tactile-craft',
] as const;

export type BuiltInStyleId = (typeof BUILT_IN_STYLE_IDS)[number];

export function isBuiltInStyleId(id: string): id is BuiltInStyleId {
  return (BUILT_IN_STYLE_IDS as readonly string[]).includes(id);
}

export const BUILT_IN_STYLES: Record<BuiltInStyleId, StylePreset> = {
  'minimal-product': {
    id: 'minimal-product',
    name: 'Minimal Product',
    description:
      'Jasny, precyzyjny styl produktowy dla SaaS, prezentacji funkcji, raportów i nowoczesnych explainerów.',
    recommendedFor: ['saas', 'produkt', 'biznes', 'onboarding', 'dane'],
    palette: {
      bgCanvas: '#F8FAFC',
      bgSurface: '#FFFFFF',
      bgElevated: '#F1F5F9',
      textPrimary: '#0F172A',
      textSecondary: '#475569',
      accentPrimary: '#2563EB',
      accentSecondary: '#0EA5E9',
      inkBorder: '#E2E8F0',
    },
    typography: {
      displayFont: 'Plus Jakarta Sans',
      bodyFont: 'Inter',
      monoFont: 'JetBrains Mono',
      headingCase: 'sentence',
      displayTrackingEm: -0.025,
    },
    surface: {
      backdropType: 'solid',
      cardTreatment: 'minimal-clean',
      radiusScale: 1,
      grainOpacity: 0,
      isDark: false,
    },
    motion: {
      profile: 'snappy-product',
      cameraHandheld: 0,
    },
    audioDefaults: {
      musicMood: 'upbeat-launch',
      voiceArchetype: 'crisp-tech',
    },
  },

  'editorial-press': {
    id: 'editorial-press',
    name: 'Editorial Press',
    description:
      'Ciepły, szeryfowy styl magazynowo-prasowy inspirowany dziennikarstwem danych i esejami wideo.',
    recommendedFor: ['dokument', 'dziennikarstwo', 'esej', 'ekonomia', 'nauka'],
    palette: {
      bgCanvas: '#F6F3EC',
      bgSurface: '#FFFDF8',
      bgElevated: '#EDE7DA',
      textPrimary: '#181615',
      textSecondary: '#57524B',
      accentPrimary: '#C83E2B',
      accentSecondary: '#1D4ED8',
      inkBorder: '#D5CCBC',
    },
    typography: {
      displayFont: 'Fraunces',
      bodyFont: 'DM Sans',
      monoFont: 'IBM Plex Mono',
      headingCase: 'sentence',
      displayTrackingEm: -0.02,
    },
    surface: {
      backdropType: 'editorial-paper',
      cardTreatment: 'editorial-ink',
      radiusScale: 0.45,
      grainOpacity: 0.05,
      isDark: false,
    },
    motion: {
      profile: 'editorial-calm',
      cameraHandheld: 0.04,
    },
    audioDefaults: {
      musicMood: 'news-pulse',
      voiceArchetype: 'calm-editorial',
    },
  },

  'archival-chronicle': {
    id: 'archival-chronicle',
    name: 'Archival Chronicle',
    description:
      'Szlachetna kronika historyczna i kulturalna: pergamin, terakota, stare złoto i klasyczna typografia.',
    recommendedFor: ['historia', 'kultura', 'biografia', 'sztuka', 'kulinaria'],
    palette: {
      bgCanvas: '#EFE7D6',
      bgSurface: '#F9F4E8',
      bgElevated: '#E4D8C1',
      textPrimary: '#231B15',
      textSecondary: '#615145',
      accentPrimary: '#9E3B24',
      accentSecondary: '#B07D2B',
      inkBorder: '#C7B69C',
    },
    typography: {
      displayFont: 'Playfair Display',
      bodyFont: 'DM Sans',
      monoFont: 'IBM Plex Mono',
      headingCase: 'sentence',
      displayTrackingEm: -0.01,
    },
    surface: {
      backdropType: 'editorial-paper',
      cardTreatment: 'editorial-ink',
      radiusScale: 0.35,
      grainOpacity: 0.08,
      isDark: false,
    },
    motion: {
      profile: 'cinematic-fluid',
      cameraHandheld: 0.06,
    },
    audioDefaults: {
      musicMood: 'warm-story',
      voiceArchetype: 'documentary-warm',
    },
  },

  'cyber-telemetry': {
    id: 'cyber-telemetry',
    name: 'Cyber Telemetry',
    description:
      'Ciemny interfejs inżynieryjny z siatką techniczną, poświatą szkła i precyzyjną telemetrią.',
    recommendedFor: ['architektura', 'ai', 'devops', 'cybersecurity', 'kod'],
    palette: {
      bgCanvas: '#070B14',
      bgSurface: '#0F172A',
      bgElevated: '#1E293B',
      textPrimary: '#F8FAFC',
      textSecondary: '#94A3B8',
      accentPrimary: '#00F5D4',
      accentSecondary: '#8B5CF6',
      inkBorder: '#1E3A5F',
    },
    typography: {
      displayFont: 'Space Grotesk',
      bodyFont: 'Inter',
      monoFont: 'JetBrains Mono',
      headingCase: 'sentence',
      displayTrackingEm: -0.02,
    },
    surface: {
      backdropType: 'blueprint-grid',
      cardTreatment: 'glass-glow',
      radiusScale: 0.85,
      grainOpacity: 0.03,
      isDark: true,
    },
    motion: {
      profile: 'snappy-product',
      cameraHandheld: 0,
    },
    audioDefaults: {
      musicMood: 'ambient-tech',
      voiceArchetype: 'crisp-tech',
    },
  },

  'brutalist-poster': {
    id: 'brutalist-poster',
    name: 'Brutalist Poster',
    description:
      'Wysokokontrastowy plakat neo-brutalistyczny z ostrymi kątami, grubym obrysem i twardym cieniem.',
    recommendedFor: ['social-reels', 'manifest', 'kampania', 'muzyka', 'trendy'],
    palette: {
      bgCanvas: '#FFF8E7',
      bgSurface: '#FFFFFF',
      bgElevated: '#FFE156',
      textPrimary: '#0A0A0A',
      textSecondary: '#2E2E2E',
      accentPrimary: '#FF2A85',
      accentSecondary: '#2563EB',
      inkBorder: '#0A0A0A',
    },
    typography: {
      displayFont: 'Syne',
      bodyFont: 'Space Grotesk',
      monoFont: 'JetBrains Mono',
      headingCase: 'uppercase',
      displayTrackingEm: 0.02,
    },
    surface: {
      backdropType: 'halftone-dots',
      cardTreatment: 'brutalist-hard',
      radiusScale: 0,
      grainOpacity: 0.04,
      isDark: false,
    },
    motion: {
      profile: 'tactile-pop',
      cameraHandheld: 0.05,
    },
    audioDefaults: {
      musicMood: 'upbeat-launch',
      voiceArchetype: 'storyteller-expressive',
    },
  },

  'sketch-notebook': {
    id: 'sketch-notebook',
    name: 'Sketch Notebook',
    description:
      'Jasny notatnik z papierem w kratkę i odręcznymi nagłówkami do lekcji, kursów i tłumaczenia pojęć.',
    recommendedFor: ['edukacja', 'kurs', 'matematyka', 'notatki', 'szkoła'],
    palette: {
      bgCanvas: '#FBFBF7',
      bgSurface: '#FFFFFF',
      bgElevated: '#FEF3C7',
      textPrimary: '#1E293B',
      textSecondary: '#475569',
      accentPrimary: '#0D9488',
      accentSecondary: '#F59E0B',
      inkBorder: '#94A3B8',
    },
    typography: {
      displayFont: 'Caveat',
      bodyFont: 'DM Sans',
      monoFont: 'IBM Plex Mono',
      headingCase: 'sentence',
      displayTrackingEm: 0,
    },
    surface: {
      backdropType: 'blueprint-grid',
      cardTreatment: 'editorial-ink',
      radiusScale: 0.7,
      grainOpacity: 0.03,
      isDark: false,
    },
    motion: {
      profile: 'tactile-pop',
      cameraHandheld: 0.03,
    },
    audioDefaults: {
      musicMood: 'warm-story',
      voiceArchetype: 'storyteller-expressive',
    },
  },

  'tactile-craft': {
    id: 'tactile-craft',
    name: 'Tactile Craft',
    description:
      'Miękkie, warstwowe wycinanki z ciepłą aurą świetlną do opowieści przygodowych i narracji 2.5D.',
    recommendedFor: ['opowieść', 'podróże', 'lifestyle', 'animacja-2.5d', 'dzieci'],
    palette: {
      bgCanvas: '#F5EFE6',
      bgSurface: '#FFFFFF',
      bgElevated: '#FDE68A',
      textPrimary: '#1F2937',
      textSecondary: '#4B5563',
      accentPrimary: '#EA580C',
      accentSecondary: '#059669',
      inkBorder: '#E5DEC9',
    },
    typography: {
      displayFont: 'Outfit',
      bodyFont: 'Plus Jakarta Sans',
      monoFont: 'JetBrains Mono',
      headingCase: 'sentence',
      displayTrackingEm: -0.015,
    },
    surface: {
      backdropType: 'mesh-aura',
      cardTreatment: 'tactile-cutout',
      radiusScale: 1.35,
      grainOpacity: 0.05,
      isDark: false,
    },
    motion: {
      profile: 'tactile-pop',
      cameraHandheld: 0.05,
    },
    audioDefaults: {
      musicMood: 'paper-expedition',
      voiceArchetype: 'storyteller-expressive',
    },
  },
};
