import { useEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';
import type { StyleFontFamily, StylePreset } from './schema';

const GOOGLE_FONT_SPEC_BY_FAMILY: Record<StyleFontFamily, string> = {
  Inter: 'Inter:wght@400;500;600;700;800',
  'Plus Jakarta Sans': 'Plus+Jakarta+Sans:wght@500;600;700;800',
  'DM Sans': 'DM+Sans:ital,wght@0,400;0,500;0,700;1,400',
  'Space Grotesk': 'Space+Grotesk:wght@500;600;700',
  Syne: 'Syne:wght@600;700;800',
  'Archivo Black': 'Archivo+Black',
  Outfit: 'Outfit:wght@500;600;700;800',
  Fraunces: 'Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,700;1,9..144,600',
  'Instrument Serif': 'Instrument+Serif:ital@0;1',
  'Playfair Display': 'Playfair+Display:ital,wght@0,600;0,700;0,800;1,600',
  Caveat: 'Caveat:wght@600;700',
  'JetBrains Mono': 'JetBrains+Mono:wght@400;500;600;700',
  'IBM Plex Mono': 'IBM+Plex+Mono:wght@400;500;600',
};

const loadedFontUrls = new Set<string>();

export function buildGoogleFontsStylesheetUrl(style: StylePreset): string {
  const uniqueFamilies = Array.from(
    new Set<StyleFontFamily>([
      style.typography.displayFont,
      style.typography.bodyFont,
      style.typography.monoFont,
    ])
  );
  const query = uniqueFamilies
    .map((fam) => `family=${GOOGLE_FONT_SPEC_BY_FAMILY[fam]}`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}

export function useStyleFontsReady(style: StylePreset): boolean {
  const href = buildGoogleFontsStylesheetUrl(style);
  const isServer = typeof document === 'undefined';
  const [ready, setReady] = useState<boolean>(
    () => isServer || loadedFontUrls.has(href)
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (loadedFontUrls.has(href)) {
      setReady(true);
      return;
    }

    const handle = delayRender(`Loading style fonts (${style.id})`, {
      timeoutInMilliseconds: 10000,
    });
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      loadedFontUrls.add(href);
      setReady(true);
      continueRender(handle);
    };

    const fallbackTimer = window.setTimeout(finish, 2500);

    let linkEl = document.querySelector<HTMLLinkElement>(
      `link[data-mp-style-fonts="${href}"]`
    );
    if (!linkEl) {
      linkEl = document.createElement('link');
      linkEl.rel = 'stylesheet';
      linkEl.href = href;
      linkEl.dataset.mpStyleFonts = href;
      document.head.appendChild(linkEl);
    }

    const onLinkReady = () => {
      if (document.fonts && typeof document.fonts.ready?.then === 'function') {
        document.fonts.ready.then(finish, finish);
      } else {
        finish();
      }
    };

    linkEl.addEventListener('load', onLinkReady, { once: true });
    linkEl.addEventListener('error', finish, { once: true });

    if (linkEl.sheet) {
      onLinkReady();
    }

    return () => {
      window.clearTimeout(fallbackTimer);
      finish();
    };
  }, [href, style.id]);

  return ready;
}
