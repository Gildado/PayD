import { createContext, use } from 'react';

/** The theme actually applied to the page. */
export type Theme = 'light' | 'dark';

/** What the user chose; 'system' follows the OS `prefers-color-scheme` live. */
export type ThemePreference = Theme | 'system';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export interface OrgBrandConfig {
  primaryColor?: string;
  accentColor?: string;
  headerBg?: string;
  logoUrl?: string;
  orgName?: string;
}

export interface ThemeContextType {
  /** Resolved theme: the user's choice, or the OS scheme when they chose 'system'. */
  theme: Theme;
  preference: ThemePreference;
  /** What the OS `prefers-color-scheme` currently resolves to, whatever the choice. */
  systemTheme: Theme;
  setPreference: (preference: ThemePreference) => void;
  /** Switches to the opposite of the current resolved theme (an explicit choice). */
  toggleTheme: () => void;
  brandConfig: OrgBrandConfig;
  setBrandConfig: (config: OrgBrandConfig | ((prev: OrgBrandConfig) => OrgBrandConfig)) => void;
  resetBrandConfig: () => void;
  reducedMotion: boolean;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = use(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
