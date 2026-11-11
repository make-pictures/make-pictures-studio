import type { SpringConfig } from 'remotion';

/**
 * Dark Neon / Cyber Telemetry Theme
 */
export const THEME = {
  colors: {
    bgPrimary: '#090A0F',
    bgSecondary: '#0D0F18',
    bgElevated: 'rgba(15, 18, 29, 0.76)',
    bgGlass: 'rgba(255, 255, 255, 0.032)',
    bgGlassHover: 'rgba(255, 255, 255, 0.055)',
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
    borderBright: 'rgba(255, 255, 255, 0.18)',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    accents: {
      cyan: '#00F0FF',
      sky: '#38BDF8',
      blue: '#3B82F6',
      violet: '#8B5CF6',
      purple: '#A855F7',
      emerald: '#10B981',
      amber: '#F59E0B',
      rose: '#F43F5E',
    },
  },
  borders: {
    thin: '1px solid rgba(255, 255, 255, 0.08)',
    highlight: '1px solid rgba(255, 255, 255, 0.16)',
  },
  shadows: {
    card: '0 24px 64px -12px rgba(0, 0, 0, 0.72), 0 0 0 1px rgba(255, 255, 255, 0.06) inset',
    window:
      '0 45px 110px -15px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.08) inset',
    glow: (hexColor: string, intensity = 1) =>
      `0 0 ${Math.round(28 * intensity)}px ${hexColor}44, 0 0 ${Math.round(
        68 * intensity
      )}px ${hexColor}26, 0 20px 50px rgba(0, 0, 0, 0.75)`,
  },
  radii: {
    sm: 10,
    md: 14,
    lg: 20,
    xl: 26,
    pill: 9999,
  },
} as const;

/**
 * Light Studio / Blueprint Canvas Theme (used by One-Shot CameraRig & Isometric 3D Studio)
 */
export const STUDIO_THEME = {
  bgCanvas: '#0B1120',
  colors: {
    bgCanvas: '#F8F9FF',
    bgSurface: '#FFFFFF',
    bgSurfaceGlass: 'rgba(255, 255, 255, 0.88)',
    bgSubtle: '#EFF4FF',
    brand: {
      50: '#EFF6FF',
      100: '#DBEAFE',
      200: '#BFDBFE',
      300: '#93C5FD',
      400: '#60A5FA',
      500: '#3B82F6',
      600: '#2563EB',
      700: '#1D4ED8',
      900: '#1E3A8A',
      950: '#0F172A',
    },
    text: {
      primary: '#0B1C30',
      slate900: '#0F172A',
      secondary: '#475569',
      muted: '#64748B',
    },
    accents: {
      blue: '#2563EB',
      coral: '#FF2A85',
      violet: '#7209B7',
      ocean: '#0096C7',
      indigo: '#3A0CA3',
      emerald: '#10B981',
      emeraldSoft: '#ECFDF5',
      rose: '#F43F5E',
      roseSoft: '#FFF1F2',
      amber: '#F59E0B',
      amberSoft: '#FFFBEB',
    },
    border: {
      subtle: 'rgba(203, 213, 225, 0.55)',
      brand: 'rgba(37, 99, 235, 0.35)',
      slate: '#E2E8F0',
    },
  },
  shadows: {
    card: '0 20px 40px -12px rgba(37, 99, 235, 0.10), 0 8px 20px -6px rgba(15, 23, 42, 0.06)',
    cardElevated:
      '0 32px 64px -12px rgba(37, 99, 235, 0.16), 0 12px 28px -8px rgba(15, 23, 42, 0.08)',
    glowViolet:
      '0 0 36px rgba(114, 9, 183, 0.28), 0 24px 48px -10px rgba(114, 9, 183, 0.22)',
    glowEmerald:
      '0 0 36px rgba(16, 185, 129, 0.28), 0 24px 48px -10px rgba(16, 185, 129, 0.18)',
    glowRose:
      '0 0 36px rgba(244, 63, 94, 0.28), 0 24px 48px -10px rgba(244, 63, 94, 0.18)',
    pill: '0 4px 14px -2px rgba(37, 99, 235, 0.12), 0 2px 6px 0 rgba(15, 23, 42, 0.05)',
  },
} as const;

/**
 * AAA 60 FPS Spring Physics Presets
 * High damping (200) eliminates rubbery bounce while preserving crisp momentum.
 */
export const SPRING_PRESETS: Record<
  | 'snappy'
  | 'smooth'
  | 'gentle'
  | 'cinematic'
  | 'micro'
  | 'calmPose'
  | 'calmCamera',
  SpringConfig
> = {
  snappy: {
    damping: 200,
    stiffness: 190,
    mass: 0.85,
    overshootClamping: false,
  },
  smooth: {
    damping: 200,
    stiffness: 130,
    mass: 0.95,
    overshootClamping: false,
  },
  gentle: {
    damping: 200,
    stiffness: 110,
    mass: 1.05,
    overshootClamping: false,
  },
  cinematic: {
    damping: 200,
    stiffness: 85,
    mass: 1.15,
    overshootClamping: false,
  },
  micro: {
    damping: 200,
    stiffness: 260,
    mass: 0.65,
    overshootClamping: false,
  },
  calmPose: {
    damping: 200,
    stiffness: 26,
    mass: 1.4,
    overshootClamping: false,
  },
  calmCamera: {
    damping: 200,
    stiffness: 22,
    mass: 1.6,
    overshootClamping: false,
  },
};
