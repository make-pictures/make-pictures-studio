import type { StylePreset } from './schema';

export * from './schema';
export * from './typographyScale';

export const BUILT_IN_STYLE_IDS = [
  'minimal-product',
  'editorial-press',
  'archival-chronicle',
  'cyber-telemetry',
  'brutalist-poster',
  'sketch-notebook',
  'tactile-craft',
  'retro-pc',
  'soft-clay',
  'glass-studio',
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
    artWorld: 'atelier',
    preferredSpace: '2d',
    spaces: ['2d', '2.5d'],
    palette: {
      bgCanvas: '#F1F5F9',
      bgSurface: '#FFFFFF',
      bgElevated: '#E2E8F0',
      textPrimary: '#0F172A',
      textSecondary: '#475569',
      accentPrimary: '#2563EB',
      accentSecondary: '#0EA5E9',
      inkBorder: '#CBD5E1',
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
    material3d: {
      finish: 'frosted-glass',
      bevelRadius: 0.1,
      studioHdr: 'clean-atelier',
    },
    motion: {
      profile: 'snappy-product',
      cameraHandheld: 0,
    },
    optics: {
      lightingRig: 'studio-macro',
      typographyGrammar: 'swiss-spatial',
      lightAngleDeg: -20,
      aperture: 0.36,
      halation: 0.08,
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
    artWorld: 'editorial-gallery',
    preferredSpace: '2.5d',
    spaces: ['2.5d', '2d'],
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
    material3d: {
      finish: 'matte-ceramic',
      bevelRadius: 0.06,
      studioHdr: 'warm-softbox',
    },
    motion: {
      profile: 'editorial-calm',
      cameraHandheld: 0.012,
    },
    optics: {
      lightingRig: 'window-gobo',
      typographyGrammar: 'swiss-spatial',
      lightAngleDeg: -28,
      aperture: 0.45,
      halation: 0.16,
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
    artWorld: 'editorial-gallery',
    preferredSpace: '2.5d',
    spaces: ['2.5d', '2d'],
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
    material3d: {
      finish: 'matte-ceramic',
      bevelRadius: 0.06,
      studioHdr: 'warm-softbox',
    },
    motion: {
      profile: 'cinematic-fluid',
      cameraHandheld: 0.015,
    },
    optics: {
      lightingRig: 'window-gobo',
      typographyGrammar: 'swiss-spatial',
      lightAngleDeg: -34,
      aperture: 0.54,
      halation: 0.26,
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
    artWorld: 'atelier',
    preferredSpace: '2d',
    spaces: ['2d', '3d'],
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
    material3d: {
      finish: 'frosted-glass',
      bevelRadius: 0.08,
      studioHdr: 'neon-grid',
    },
    motion: {
      profile: 'snappy-product',
      cameraHandheld: 0,
    },
    optics: {
      lightingRig: 'darkroom-halation',
      typographyGrammar: 'optical-gate',
      lightAngleDeg: -24,
      aperture: 0.5,
      halation: 0.58,
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
    artWorld: 'editorial-gallery',
    preferredSpace: '2d',
    spaces: ['2d'],
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
    material3d: {
      finish: 'matte-ceramic',
      bevelRadius: 0.02,
      studioHdr: 'clean-atelier',
    },
    motion: {
      profile: 'tactile-pop',
      cameraHandheld: 0.05,
    },
    optics: {
      lightingRig: 'darkroom-halation',
      typographyGrammar: 'risograph-poster',
      lightAngleDeg: -38,
      aperture: 0.32,
      halation: 0.28,
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
    artWorld: 'illustrative',
    preferredSpace: '2d',
    spaces: ['2d', '2.5d'],
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
    material3d: {
      finish: 'soft-clay',
      bevelRadius: 0.1,
      studioHdr: 'warm-softbox',
    },
    motion: {
      profile: 'tactile-pop',
      cameraHandheld: 0.03,
    },
    optics: {
      lightingRig: 'window-gobo',
      typographyGrammar: 'risograph-poster',
      lightAngleDeg: -26,
      aperture: 0.38,
      halation: 0.12,
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
    artWorld: 'illustrative',
    preferredSpace: '2.5d',
    spaces: ['2.5d'],
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
    material3d: {
      finish: 'soft-clay',
      bevelRadius: 0.14,
      studioHdr: 'warm-softbox',
    },
    motion: {
      profile: 'tactile-pop',
      cameraHandheld: 0.05,
    },
    optics: {
      lightingRig: 'window-gobo',
      typographyGrammar: 'risograph-poster',
      lightAngleDeg: -30,
      aperture: 0.48,
      halation: 0.2,
    },
    audioDefaults: {
      musicMood: 'paper-expedition',
      voiceArchetype: 'storyteller-expressive',
    },
  },

  'retro-pc': {
    id: 'retro-pc',
    name: 'Retro-PC',
    description:
      'Klasyczny interfejs komputerowy CRT i estetyka systemów lat 80./90. z fosforowym kontrastem i pikselową precyzją.',
    recommendedFor: ['technologia', 'sieci', 'retro-os', 'edukacja', 'kod'],
    artWorld: 'atelier',
    preferredSpace: '2d',
    spaces: ['2d', '3d'],
    palette: {
      bgCanvas: '#0C141C',
      bgSurface: '#13202C',
      bgElevated: '#1D3142',
      textPrimary: '#ECFDF5',
      textSecondary: '#94B8C8',
      accentPrimary: '#38BDF8',
      accentSecondary: '#4ADE80',
      inkBorder: '#2E4F66',
    },
    typography: {
      displayFont: 'Space Grotesk',
      bodyFont: 'IBM Plex Mono',
      monoFont: 'IBM Plex Mono',
      headingCase: 'sentence',
      displayTrackingEm: -0.01,
    },
    surface: {
      backdropType: 'blueprint-grid',
      cardTreatment: 'brutalist-hard',
      radiusScale: 0.25,
      grainOpacity: 0.04,
      isDark: true,
    },
    material3d: {
      finish: 'retro-voxel',
      bevelRadius: 0.04,
      studioHdr: 'neon-grid',
    },
    motion: {
      profile: 'snappy-product',
      cameraHandheld: 0,
    },
    optics: {
      lightingRig: 'darkroom-halation',
      typographyGrammar: 'optical-gate',
      lightAngleDeg: -22,
      aperture: 0.42,
      halation: 0.48,
    },
    audioDefaults: {
      musicMood: 'ambient-tech',
      voiceArchetype: 'crisp-tech',
    },
  },

  'soft-clay': {
    id: 'soft-clay',
    name: 'Soft-Clay 3D',
    description:
      'Ciepła, miękka modelina studyjna z zaokrąglonymi bryłami, światłem softboxa i ekspresyjnymi postaciami 3D.',
    recommendedFor: ['podcast', 'animacja-3d', 'opowieść', 'edukacja', 'marka'],
    artWorld: 'illustrative',
    preferredSpace: '3d',
    spaces: ['3d'],
    palette: {
      bgCanvas: '#F6EFE6',
      bgSurface: '#FFFDF9',
      bgElevated: '#FDE6D2',
      textPrimary: '#231815',
      textSecondary: '#6B564B',
      accentPrimary: '#EA580C',
      accentSecondary: '#0D9488',
      inkBorder: '#E7D5C4',
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
      cardTreatment: 'minimal-clean',
      radiusScale: 1.45,
      grainOpacity: 0.03,
      isDark: false,
    },
    material3d: {
      finish: 'soft-clay',
      bevelRadius: 0.14,
      studioHdr: 'warm-softbox',
    },
    motion: {
      profile: 'tactile-pop',
      cameraHandheld: 0.02,
    },
    optics: {
      lightingRig: 'studio-macro',
      typographyGrammar: 'swiss-spatial',
      lightAngleDeg: -26,
      aperture: 0.44,
      halation: 0.14,
    },
    audioDefaults: {
      musicMood: 'warm-story',
      voiceArchetype: 'storyteller-expressive',
    },
  },

  'glass-studio': {
    id: 'glass-studio',
    name: 'Glass Studio',
    description:
      'Krystaliczne szkło akrylowe i anodyzowany metal w jasnym studiu przestrzennym do nowoczesnych prezentacji 3D i 2D.',
    recommendedFor: ['produkt-3d', 'saas', 'technologia', 'design', 'launch'],
    artWorld: 'atelier',
    preferredSpace: '3d',
    spaces: ['3d', '2d'],
    palette: {
      bgCanvas: '#EEF2FF',
      bgSurface: '#FFFFFF',
      bgElevated: '#E0E7FF',
      textPrimary: '#0F172A',
      textSecondary: '#475569',
      accentPrimary: '#4F46E5',
      accentSecondary: '#06B6D4',
      inkBorder: '#C7D2FE',
    },
    typography: {
      displayFont: 'Plus Jakarta Sans',
      bodyFont: 'Inter',
      monoFont: 'JetBrains Mono',
      headingCase: 'sentence',
      displayTrackingEm: -0.025,
    },
    surface: {
      backdropType: 'mesh-aura',
      cardTreatment: 'glass-glow',
      radiusScale: 1.25,
      grainOpacity: 0.01,
      isDark: false,
    },
    material3d: {
      finish: 'frosted-glass',
      bevelRadius: 0.1,
      studioHdr: 'clean-atelier',
    },
    motion: {
      profile: 'cinematic-fluid',
      cameraHandheld: 0,
    },
    optics: {
      lightingRig: 'studio-macro',
      typographyGrammar: 'swiss-spatial',
      lightAngleDeg: -22,
      aperture: 0.4,
      halation: 0.12,
    },
    audioDefaults: {
      musicMood: 'upbeat-launch',
      voiceArchetype: 'crisp-tech',
    },
  },
};
