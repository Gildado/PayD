import { createContext, use } from 'react';

export type Theme = 'light' | 'dark';

export interface OrgBrandConfig {
  primaryColor?: string;
  accentColor?: string;
  headerBg?: string;
  logoUrl?: string;
  orgName?: string;
}

export interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  brandConfig: OrgBrandConfig;
  setBrandConfig: (config: OrgBrandConfig | ((prev: OrgBrandConfig) => OrgBrandConfig)) => void;
  resetBrandConfig: () => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = use(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};

