import React, { useEffect, useLayoutEffect, useState, useCallback } from 'react';
import {
  ThemeContext,
  OrgBrandConfig,
  ThemePreference,
  isThemePreference,
} from '../hooks/useTheme';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { usePrefersColorScheme } from '../hooks/usePrefersColorScheme';
import { normalizeHexColor, readableTextOn, sanitizeOrgName } from '../utils/brand';

const STORAGE_KEY = 'payd-theme';
const BRAND_STORAGE_KEY = 'payd-org-brand';

// With no saved choice the OS `prefers-color-scheme` decides (#1872). Keep
// this in step with the pre-paint script in index.html.
function readStoredPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isThemePreference(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

function isOrgBrandConfig(value: unknown): value is OrgBrandConfig {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    (v.primaryColor === undefined || typeof v.primaryColor === 'string') &&
    (v.accentColor === undefined || typeof v.accentColor === 'string') &&
    (v.headerBg === undefined || typeof v.headerBg === 'string') &&
    (v.logoUrl === undefined || typeof v.logoUrl === 'string') &&
    (v.orgName === undefined || typeof v.orgName === 'string')
  );
}

function readStoredBrand(): OrgBrandConfig {
  try {
    const saved = localStorage.getItem(BRAND_STORAGE_KEY);
    if (!saved) return {};
    const parsed = JSON.parse(saved) as OrgBrandConfig;
    return isOrgBrandConfig(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function setOrRemove(root: HTMLElement, prop: string, value: string | null) {
  if (value) root.style.setProperty(prop, value);
  else root.style.removeProperty(prop);
}

function applyBrandTheme(brand: OrgBrandConfig) {
  const root = document.documentElement;
  // Validate org-supplied values before they reach CSS (#1505): only hex
  // colours are applied, anything else falls back to the default tokens.
  const primary = normalizeHexColor(brand.primaryColor);
  setOrRemove(root, '--brand-primary', primary);
  // Text/icons on a solid brand fill keep AA contrast whatever the colour.
  setOrRemove(root, '--brand-on-primary', primary ? readableTextOn(primary) : null);
  setOrRemove(root, '--brand-accent', normalizeHexColor(brand.accentColor));
  setOrRemove(root, '--brand-header-bg', normalizeHexColor(brand.headerBg));

  const orgName = sanitizeOrgName(brand.orgName);
  if (orgName) {
    root.setAttribute('data-org-name', orgName);
  } else {
    root.removeAttribute('data-org-name');
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const systemTheme = usePrefersColorScheme();
  const theme = preference === 'system' ? systemTheme : preference;
  const [brandConfig, setBrandConfigState] = useState<OrgBrandConfig>(() => readStoredBrand());
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-theme-preference', preference);
  }, [theme, preference]);

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-motion-safe', reducedMotion ? 'false' : 'true');
  }, [reducedMotion]);

  useLayoutEffect(() => {
    applyBrandTheme(brandConfig);
    try {
      localStorage.setItem(BRAND_STORAGE_KEY, JSON.stringify(brandConfig));
    } catch {
      // Storage quota or restriction fallback
    }
  }, [brandConfig]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        // Another tab changed (or cleared) the choice.
        if (e.newValue === null) setPreferenceState('system');
        else if (isThemePreference(e.newValue)) setPreferenceState(e.newValue);
      } else if (e.key === BRAND_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as OrgBrandConfig;
          if (isOrgBrandConfig(parsed)) {
            setBrandConfigState(parsed);
          }
        } catch {
          // Ignore malformed brand state
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage quota or restriction fallback: the choice lasts this session
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setPreference(theme === 'light' ? 'dark' : 'light');
  }, [theme, setPreference]);

  const setBrandConfig = useCallback(
    (config: OrgBrandConfig | ((prev: OrgBrandConfig) => OrgBrandConfig)) => {
      setBrandConfigState((prev) => (typeof config === 'function' ? config(prev) : config));
    },
    []
  );

  const resetBrandConfig = useCallback(() => {
    setBrandConfigState({});
    localStorage.removeItem(BRAND_STORAGE_KEY);
  }, []);

  return (
    <ThemeContext
      value={{
        theme,
        preference,
        systemTheme,
        setPreference,
        toggleTheme,
        brandConfig,
        setBrandConfig,
        resetBrandConfig,
        reducedMotion,
      }}
    >
      {children}
    </ThemeContext>
  );
};
