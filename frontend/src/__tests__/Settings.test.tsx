import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

const mockChangeLanguage = vi.fn().mockResolvedValue(undefined);
const mockToggleTheme = vi.fn();
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

vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    theme: 'dark',
    toggleTheme: mockToggleTheme,
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

import Settings from '../pages/Settings';

describe('Settings', () => {
  test('renders settings title', () => {
    render(<Settings />);
    expect(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeTruthy();
  });

  test('renders language section heading', () => {
    render(<Settings />);
    expect(screen.getByRole('heading', { name: 'Language', level: 2 })).toBeTruthy();
  });

  test('renders language options as buttons', () => {
    render(<Settings />);
    expect(screen.getAllByText('English').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Español').length).toBeGreaterThan(0);
  });

  test('changes language when a language button is clicked', () => {
    render(<Settings />);
    const spanishButton = screen.getByRole('button', { name: /Select Español/i });
    fireEvent.click(spanishButton);
    expect(mockChangeLanguage).toHaveBeenCalledWith('es');
  });

  test('shows success toast when language is changed', () => {
    render(<Settings />);
    const spanishButton = screen.getByRole('button', { name: /Select Español/i });
    fireEvent.click(spanishButton);
    expect(mockNotifySuccess).toHaveBeenCalledWith('Language updated to Español');
  });

  test('shows current language indicator', () => {
    render(<Settings />);
    expect(screen.getByText(/Current Language/)).toBeTruthy();
  });

  test('renders language description text', () => {
    render(<Settings />);
    expect(screen.getByText('Choose your preferred language')).toBeTruthy();
  });

  test('renders language buttons as interactive', () => {
    render(<Settings />);
    const englishButton = screen.getByRole('button', { name: /Select English/i });
    fireEvent.click(englishButton);
    expect(mockChangeLanguage).toHaveBeenCalledWith('en');
  });

  test('renders appearance section heading', () => {
    render(<Settings />);
    expect(screen.getByRole('heading', { name: 'Appearance', level: 2 })).toBeTruthy();
  });

  test('renders dark and light theme buttons', () => {
    render(<Settings />);
    expect(screen.getByRole('button', { name: /Dark/i, hidden: false })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Light/i, hidden: false })).toBeTruthy();
  });

  test('dark button is aria-pressed when theme is dark', () => {
    render(<Settings />);
    const darkButtons = screen.getAllByRole('button');
    const darkButton = darkButtons.find(
      (b) => b.textContent?.includes('Dark') && b.getAttribute('aria-pressed') === 'true'
    );
    expect(darkButton).toBeTruthy();
  });

  test('toggleTheme is called when light mode is selected', () => {
    render(<Settings />);
    const buttons = screen.getAllByRole('button');
    const lightButton = buttons.find((b) => b.textContent?.includes('Light'));
    expect(lightButton).toBeTruthy();
    fireEvent.click(lightButton!);
    expect(mockToggleTheme).toHaveBeenCalled();
  });

  test('toggleTheme is not called when already selected theme is clicked', () => {
    vi.clearAllMocks();
    render(<Settings />);
    const buttons = screen.getAllByRole('button');
    const darkButton = buttons.find(
      (b) => b.textContent?.includes('Dark') && b.getAttribute('aria-pressed') === 'true'
    );
    expect(darkButton).toBeTruthy();
    fireEvent.click(darkButton!);
    expect(mockToggleTheme).not.toHaveBeenCalled();
  });
});
