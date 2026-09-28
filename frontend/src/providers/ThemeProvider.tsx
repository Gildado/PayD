import React, { useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { Theme, ThemeContext, OrgBrandConfig } from '../hooks/useTheme';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { normalizeHexColor, readableTextOn, sanitizeOrgName } from '../utils/brand';

const STORAGE_KEY = 'payd-theme';
const BRAND_STORAGE_KEY = 'payd-org-brand';

function readStoredTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'light' || saved === 'dark' ? saved : 'light';
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

function persistTheme(next: Theme) {
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(STORAGE_KEY, next);
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
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());
  const [brandConfig, setBrandConfigState] = useState<OrgBrandConfig>(() => readStoredBrand());
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    persistTheme(theme);
  }, [theme]);

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
      if (e.key === STORAGE_KEY && e.newValue) {
        if (e.newValue === 'light' || e.newValue === 'dark') {
          setTheme(e.newValue);
        }
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

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

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
      value={{ theme, toggleTheme, brandConfig, setBrandConfig, resetBrandConfig, reducedMotion }}
    >
      {children}
    </ThemeContext>
  );
};
