import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import en from '../locales/en/translation.json';

// Global i18n mock — makes `useTranslation().t(key)` return the English
// translation so tests can match against human-readable text.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrVars?: string | Record<string, string>) => {
      const lookup = (obj: Record<string, unknown>, path: string): string | undefined => {
        const result = path.split('.').reduce<unknown>((acc, part) => {
          if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
            return (acc as Record<string, unknown>)[part];
          }
          return undefined;
        }, obj);
        return typeof result === 'string' ? result : undefined;
      };
      const translated = lookup(en as Record<string, unknown>, key);
      let text: string;
      if (translated !== undefined) {
        text = translated;
      } else if (typeof fallbackOrVars === 'string') {
        text = fallbackOrVars;
      } else {
        text = key;
      }
      const vars = typeof fallbackOrVars === 'object' ? fallbackOrVars : undefined;
      if (vars) {
        return Object.entries(vars).reduce<string>(
          (str, [k, v]) => str.replace(new RegExp(`{{${k}}}`, 'g'), v),
          text,
        );
      }
      return text;
    },
    i18n: {
      language: 'en',
      changeLanguage: vi.fn().mockResolvedValue(undefined),
    },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
  I18nextProvider: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as unknown as typeof IntersectionObserver;
