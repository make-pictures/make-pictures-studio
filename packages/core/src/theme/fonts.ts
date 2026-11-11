import { useEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';

const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap';

const FONT_READY_TIMEOUT_MS = 2500;

let fontRevision = 0;
let fontsLoadPromise: Promise<void> | null = null;
const fontListeners = new Set<() => void>();

function notifyFontListeners(): void {
  fontRevision += 1;
  for (const listener of fontListeners) {
    listener();
  }
}

function ensureGoogleFontsStylesheet(): void {
  if (typeof document === 'undefined') return;
  const existing = document.querySelector(`link[href="${GOOGLE_FONTS_HREF}"]`);
  if (!existing) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_HREF;
    document.head.appendChild(link);
  }
}

export function waitForStudioFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) {
    fontRevision = Math.max(fontRevision, 1);
    return Promise.resolve();
  }

  ensureGoogleFontsStylesheet();

  if (fontsLoadPromise) {
    return fontsLoadPromise;
  }

  fontsLoadPromise = new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      notifyFontListeners();
      resolve();
    };

    const timer = setTimeout(finish, FONT_READY_TIMEOUT_MS);

    Promise.allSettled([
      document.fonts.load('700 24px "Inter"'),
      document.fonts.load('800 24px "Plus Jakarta Sans"'),
      document.fonts.load('600 16px "JetBrains Mono"'),
    ])
      .then(() => document.fonts.ready)
      .then(() => {
        clearTimeout(timer);
        finish();
      })
      .catch(() => {
        clearTimeout(timer);
        finish();
      });
  });

  return fontsLoadPromise;
}

if (typeof document !== 'undefined') {
  ensureGoogleFontsStylesheet();
  void waitForStudioFonts();
}

/**
 * Ensures web fonts (`Inter`, `Plus Jakarta Sans`, `JetBrains Mono`) are loaded
 * before Remotion captures frames, and returns a revision counter so offscreen
 * 2D canvases (`PaperCutout3D`) never stay stuck with a fallback system font.
 */
export function useStudioFontsReady(): number {
  const [revision, setRevision] = useState<number>(() => fontRevision);
  const [delayHandle] = useState<number | null>(() => {
    if (typeof document === 'undefined' || fontRevision > 0) {
      return null;
    }
    try {
      return delayRender('Waiting for Studio Web typography');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let released = false;
    const release = () => {
      if (!released && delayHandle !== null) {
        released = true;
        try {
          continueRender(delayHandle);
        } catch {
          // Ignore if already continued
        }
      }
    };

    if (fontRevision > 0) {
      release();
      setRevision(fontRevision);
      return;
    }

    let active = true;
    const onUpdate = () => {
      if (active) {
        setRevision(fontRevision);
      }
    };
    fontListeners.add(onUpdate);

    void waitForStudioFonts().finally(() => {
      release();
      onUpdate();
    });

    return () => {
      active = false;
      fontListeners.delete(onUpdate);
      release();
    };
  }, [delayHandle]);

  return revision;
}

export const FONTS = {
  sans: '"Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
  display:
    '"Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", "SF Mono", Menlo, Monaco, Consolas, monospace',
} as const;

export const STUDIO_FONTS = {
  sans: '"Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", "SF Mono", Menlo, Monaco, Consolas, monospace',
} as const;
