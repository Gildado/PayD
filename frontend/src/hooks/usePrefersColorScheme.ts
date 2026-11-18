import { useEffect, useState } from 'react';
import type { Theme } from './useTheme';

export const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)';

/** The OS/browser colour scheme right now; 'light' when it can't be read. */
export function getSystemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia(COLOR_SCHEME_QUERY).matches ? 'dark' : 'light';
}

/**
 * Tracks the user's `prefers-color-scheme` OS/browser preference live, so a
 * 'system' theme follows the OS when it switches (e.g. at sunset).
 */
export function usePrefersColorScheme(): Theme {
  const [scheme, setScheme] = useState<Theme>(getSystemTheme);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(COLOR_SCHEME_QUERY);
    const onChange = (e: MediaQueryListEvent) => setScheme(e.matches ? 'dark' : 'light');

    // Safari < 14 fallback: addListener/removeListener
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  return scheme;
}
