import { useCallback, useEffect, useState } from 'react';

export type StudioThemeMode = 'system' | 'light' | 'dark';
export type ResolvedStudioTheme = 'light' | 'dark';

export const STUDIO_THEME_STORAGE_KEY = 'mp-studio-theme';

export interface UseStudioThemeResult {
  themeMode: StudioThemeMode;
  resolvedTheme: ResolvedStudioTheme;
  setThemeMode: (mode: StudioThemeMode) => void;
  cycleThemeMode: () => void;
}

function isValidThemeMode(value: unknown): value is StudioThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

function readStoredThemeMode(): StudioThemeMode {
  if (typeof window === 'undefined') {
    return 'system';
  }
  try {
    const raw = window.localStorage.getItem(STUDIO_THEME_STORAGE_KEY);
    if (isValidThemeMode(raw)) {
      return raw;
    }
  } catch {
    // Ignore storage access errors in restricted/sandboxed contexts
  }
  return 'system';
}

function readSystemPrefersDark(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false;
  }
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function useStudioTheme(): UseStudioThemeResult {
  const [themeMode, setThemeModeState] = useState<StudioThemeMode>(() =>
    readStoredThemeMode()
  );
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() =>
    readSystemPrefersDark()
  );

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }

    let mql: MediaQueryList;
    try {
      mql = window.matchMedia('(prefers-color-scheme: dark)');
    } catch {
      return;
    }

    setSystemPrefersDark(mql.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleChange);
      return () => mql.removeEventListener('change', handleChange);
    }

    if (typeof mql.addListener === 'function') {
      mql.addListener(handleChange);
      return () => mql.removeListener(handleChange);
    }
  }, []);

  const resolvedTheme: ResolvedStudioTheme =
    themeMode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : themeMode;

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const root = document.documentElement;
    if (!root) {
      return;
    }
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const setThemeMode = useCallback((nextMode: StudioThemeMode) => {
    if (!isValidThemeMode(nextMode)) {
      return;
    }
    setThemeModeState(nextMode);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STUDIO_THEME_STORAGE_KEY, nextMode);
      } catch {
        // Ignore storage write errors
      }
    }
  }, []);

  const cycleThemeMode = useCallback(() => {
    setThemeModeState((prev) => {
      const next: StudioThemeMode =
        prev === 'system' ? 'light' : prev === 'light' ? 'dark' : 'system';
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(STUDIO_THEME_STORAGE_KEY, next);
        } catch {
          // Ignore storage write errors
        }
      }
      return next;
    });
  }, []);

  return {
    themeMode,
    resolvedTheme,
    setThemeMode,
    cycleThemeMode,
  };
}
