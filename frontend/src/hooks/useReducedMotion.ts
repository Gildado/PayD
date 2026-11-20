import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function getInitial(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY).matches;
}

/**
 * Tracks the user's `prefers-reduced-motion` OS/browser preference live.
 *
 * Every animation added under the shared motion pattern (see
 * `frontend/src/styles/MOTION_PATTERNS.md`) must consult this hook — or the
 * `data-motion-safe="false"` attribute it drives on `<html>` — before playing
 * a non-essential transition or keyframe animation.
 *
 * Usage:
 *   const reduceMotion = useReducedMotion();
 *   <div className={reduceMotion ? '' : 'motion-success-pop'}>
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(getInitial);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);

    // Safari < 14 fallback: addListener/removeListener
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  return reduced;
}
