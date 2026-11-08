const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap';

if (typeof document !== 'undefined') {
  const existing = document.querySelector(`link[href="${GOOGLE_FONTS_HREF}"]`);
  if (!existing) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_HREF;
    document.head.appendChild(link);
  }
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
