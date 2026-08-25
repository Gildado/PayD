import React, { useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { Theme, ThemeContext, OrgBrandConfig } from '../hooks/useTheme';

const STORAGE_KEY = 'payd-theme';
const BRAND_STORAGE_KEY = 'payd-org-brand';

function readStoredTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'light' || saved === 'dark' ? saved : 'dark';
}

function readStoredBrand(): OrgBrandConfig {
  try {
    const saved = localStorage.getItem(BRAND_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function persistTheme(next: Theme) {
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(STORAGE_KEY, next);
}

function applyBrandTheme(brand: OrgBrandConfig) {
  const root = document.documentElement;
  if (brand.primaryColor) {
    root.style.setProperty('--brand-primary', brand.primaryColor);
  } else {
    root.style.removeProperty('--brand-primary');
  }

  if (brand.accentColor) {
    root.style.setProperty('--brand-accent', brand.accentColor);
  } else {
    root.style.removeProperty('--brand-accent');
  }

  if (brand.headerBg) {
    root.style.setProperty('--brand-header-bg', brand.headerBg);
  } else {
    root.style.removeProperty('--brand-header-bg');
  }

  if (brand.orgName) {
    root.setAttribute('data-org-name', brand.orgName);
  } else {
    root.removeAttribute('data-org-name');
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());
  const [brandConfig, setBrandConfigState] = useState<OrgBrandConfig>(() => readStoredBrand());

  useLayoutEffect(() => {
    persistTheme(theme);
  }, [theme]);

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
          setBrandConfigState(JSON.parse(e.newValue));
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
      value={{ theme, toggleTheme, brandConfig, setBrandConfig, resetBrandConfig }}
    >
      {children}
    </ThemeContext>
  );
};

