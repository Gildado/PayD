import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach } from 'vitest';

/**
 * Verifies that a crash in one Settings section (Appearance) is contained
 * by that section's ComponentErrorBoundary: the rest of the page — the
 * Language section and Offline Data section — keeps working, the crash is
 * reported to Sentry tagged with the section name, and clicking "Try
 * again" recovers just that section without a full page reload.
 */

const mockCaptureException = vi.fn();
vi.mock('@sentry/react', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

const mockChangeLanguage = vi.fn().mockResolvedValue(undefined);
const mockNotifySuccess = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'settings.title': 'Settings',
        'settings.languageLabel': 'Language',
        'settings.languageDescription': 'Choose your preferred language',
        'settings.languageEnglish': 'English',
        'settings.languageSpanish': 'Español',
        'settings.languageSaved': `Language updated to ${vars?.language ?? ''}`,
        'settings.themeLabel': 'Appearance',
        'settings.themeDescription': 'Choose your preferred color scheme',
        'settings.themeDark': 'Dark',
        'settings.themeLight': 'Light',
      };
      return translations[key] ?? key;
    },
    i18n: {
      language: 'en',
      changeLanguage: mockChangeLanguage,
    },
  }),
}));

vi.mock('../hooks/useNotification', () => ({
  useNotification: () => ({
    notifySuccess: mockNotifySuccess,
    notifyError: vi.fn(),
    notify: vi.fn(),
    notifyPaymentSuccess: vi.fn(),
    notifyPaymentFailure: vi.fn(),
    notifyWalletEvent: vi.fn(),
    notifyApiError: vi.fn(),
  }),
}));

// The Appearance section's `useTheme()` call throws until `themeState.shouldThrow`
// is flipped off, letting the test simulate "the bug gets fixed"/retry recovery.
const themeState = vi.hoisted(() => ({ shouldThrow: true }));
vi.mock('../hooks/useTheme', () => ({
  useTheme: () => {
    if (themeState.shouldThrow) {
      throw new Error('Simulated crash in appearance settings');
    }
    return { theme: 'dark', toggleTheme: vi.fn() };
  },
}));

vi.mock('../services/offlineHistoryCache', () => ({
  clearAllOfflineCaches: vi.fn().mockResolvedValue(undefined),
}));

import Settings from '../pages/Settings';

describe('Settings page — per-section error isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    themeState.shouldThrow = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('a crash in the Appearance section does not take down the rest of the page', () => {
    render(<Settings />);

    // Language section (unrelated to the crash) still renders and works.
    expect(screen.getByRole('heading', { name: 'Language', level: 2 })).toBeTruthy();
    const spanishButton = screen.getByRole('button', { name: /Select Español/i });
    fireEvent.click(spanishButton);
    expect(mockChangeLanguage).toHaveBeenCalledWith('es');

    // Offline Data section (unrelated to the crash) still renders.
    expect(screen.getByText('Offline Data')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Clear cached data/i })).toBeTruthy();

    // The Appearance heading never rendered — its section crashed instead.
    expect(screen.queryByRole('heading', { name: 'Appearance', level: 2 })).toBeNull();
  });

  test('the crashed section shows a fallback with a retry button, no layout-breaking error', () => {
    render(<Settings />);

    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBe(1);
    expect(screen.getByText(/Appearance Settings encountered an error/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  test('the error is reported to Sentry tagged with the section name', () => {
    render(<Settings />);

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [error, context] = mockCaptureException.mock.calls[0];
    expect((error as Error).message).toMatch(/Simulated crash in appearance settings/);
    expect(context).toMatchObject({ tags: { section: 'Appearance Settings' } });
  });

  test('clicking "Try again" remounts and recovers just the crashed section', () => {
    render(<Settings />);

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Appearance', level: 2 })).toBeNull();

    // Simulate the underlying issue clearing, then retry.
    themeState.shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Appearance', level: 2 })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Dark/i })).toBeTruthy();

    // Other sections were never affected by the crash or the retry.
    expect(screen.getByRole('heading', { name: 'Language', level: 2 })).toBeTruthy();
    expect(screen.getByText('Offline Data')).toBeTruthy();
  });
});
