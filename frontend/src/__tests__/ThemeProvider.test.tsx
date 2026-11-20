import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, beforeEach, vi } from 'vitest';
import { ThemeProvider } from '../providers/ThemeProvider';
import { useTheme } from '../hooks/useTheme';

function ThemeProbe() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button type="button" onClick={toggleTheme}>
        toggle
      </button>
    </div>
  );
}

function PreferenceProbe() {
  const { theme, preference, setPreference } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="preference">{preference}</span>
      <button type="button" onClick={() => setPreference('system')}>
        use-system
      </button>
      <button type="button" onClick={() => setPreference('light')}>
        use-light
      </button>
    </div>
  );
}

/**
 * A controllable `prefers-color-scheme`: `setDark` flips the OS setting and
 * fires the `change` event like a browser does.
 */
function mockColorScheme(initiallyDark: boolean) {
  let dark = initiallyDark;
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const isScheme = (query: string) => query === '(prefers-color-scheme: dark)';
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return isScheme(query) ? dark : false;
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: (e: MediaQueryListEvent) => void) => {
      if (isScheme(query)) listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (e: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  return {
    setDark(next: boolean) {
      dark = next;
      act(() => {
        listeners.forEach((listener) => listener({ matches: next } as MediaQueryListEvent));
      });
    },
    listenerCount: () => listeners.size,
  };
}

function BrandProbe() {
  const { brandConfig, setBrandConfig, resetBrandConfig } = useTheme();
  return (
    <div>
      <span data-testid="org-name">{brandConfig.orgName || 'none'}</span>
      <button
        type="button"
        onClick={() =>
          setBrandConfig({
            primaryColor: '#ff0055',
            accentColor: '#aa0033',
            orgName: 'Acme Corp',
          })
        }
      >
        set-brand
      </button>
      <button type="button" onClick={resetBrandConfig}>
        reset-brand
      </button>
    </div>
  );
}

describe('ThemeProvider', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    localStorage.removeItem('payd-theme');
    localStorage.removeItem('payd-org-brand');
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  test('restores theme from localStorage on mount', () => {
    localStorage.setItem('payd-theme', 'dark');
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  test('persists theme when toggled', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    await user.click(screen.getByRole('button', { name: /toggle/i }));
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(localStorage.getItem('payd-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  test('applies and resets white-label brand theme configuration', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <BrandProbe />
      </ThemeProvider>
    );
    expect(screen.getByTestId('org-name')).toHaveTextContent('none');

    await user.click(screen.getByRole('button', { name: /set-brand/i }));
    expect(screen.getByTestId('org-name')).toHaveTextContent('Acme Corp');
    expect(document.documentElement.getAttribute('data-org-name')).toBe('Acme Corp');
    expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('#ff0055');

    expect(document.documentElement.style.getPropertyValue('--brand-on-primary')).toBe('#ffffff');

    await user.click(screen.getByRole('button', { name: /reset-brand/i }));
    expect(screen.getByTestId('org-name')).toHaveTextContent('none');
    expect(document.documentElement.getAttribute('data-org-name')).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('');
  });

  test('ignores non-hex brand colours instead of writing them into CSS', () => {
    localStorage.setItem(
      'payd-org-brand',
      JSON.stringify({ primaryColor: 'red; background:url(x)', accentColor: '#14b8a6' })
    );
    render(
      <ThemeProvider>
        <BrandProbe />
      </ThemeProvider>
    );
    expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--brand-accent')).toBe('#14b8a6');
  });

  describe('system preference (#1872)', () => {
    test('with nothing saved, the OS colour scheme is the initial default', () => {
      mockColorScheme(true);
      render(
        <ThemeProvider>
          <PreferenceProbe />
        </ThemeProvider>
      );
      expect(screen.getByTestId('preference')).toHaveTextContent('system');
      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      // Following the OS by default is not a choice, so nothing is written.
      expect(localStorage.getItem('payd-theme')).toBeNull();
    });

    test('an unrecognised saved value falls back to the OS scheme', () => {
      mockColorScheme(true);
      localStorage.setItem('payd-theme', 'sepia');
      render(
        <ThemeProvider>
          <PreferenceProbe />
        </ThemeProvider>
      );
      expect(screen.getByTestId('preference')).toHaveTextContent('system');
      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    });

    test('system follows the OS setting live', () => {
      const os = mockColorScheme(false);
      render(
        <ThemeProvider>
          <PreferenceProbe />
        </ThemeProvider>
      );
      expect(screen.getByTestId('theme')).toHaveTextContent('light');

      os.setDark(true);
      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

      os.setDark(false);
      expect(screen.getByTestId('theme')).toHaveTextContent('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    test('an explicit choice ignores OS changes', async () => {
      const user = userEvent.setup();
      const os = mockColorScheme(true);
      render(
        <ThemeProvider>
          <PreferenceProbe />
        </ThemeProvider>
      );
      await user.click(screen.getByRole('button', { name: 'use-light' }));
      expect(screen.getByTestId('theme')).toHaveTextContent('light');

      os.setDark(false);
      os.setDark(true);
      expect(screen.getByTestId('theme')).toHaveTextContent('light');
      expect(document.documentElement.getAttribute('data-theme-preference')).toBe('light');
    });

    test('choosing system is persisted and restored on the next load', async () => {
      const user = userEvent.setup();
      mockColorScheme(true);
      localStorage.setItem('payd-theme', 'light');
      const { unmount } = render(
        <ThemeProvider>
          <PreferenceProbe />
        </ThemeProvider>
      );
      expect(screen.getByTestId('theme')).toHaveTextContent('light');

      await user.click(screen.getByRole('button', { name: 'use-system' }));
      expect(localStorage.getItem('payd-theme')).toBe('system');
      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      unmount();

      render(
        <ThemeProvider>
          <PreferenceProbe />
        </ThemeProvider>
      );
      expect(screen.getByTestId('preference')).toHaveTextContent('system');
      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    });

    test('toggling from system makes an explicit choice opposite to what is shown', async () => {
      const user = userEvent.setup();
      mockColorScheme(true);
      render(
        <ThemeProvider>
          <ThemeProbe />
        </ThemeProvider>
      );
      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      await user.click(screen.getByRole('button', { name: /toggle/i }));
      expect(screen.getByTestId('theme')).toHaveTextContent('light');
      expect(localStorage.getItem('payd-theme')).toBe('light');
    });

    test('a choice made in another tab is picked up, including system', () => {
      mockColorScheme(true);
      render(
        <ThemeProvider>
          <PreferenceProbe />
        </ThemeProvider>
      );
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', { key: 'payd-theme', newValue: 'light' }));
      });
      expect(screen.getByTestId('preference')).toHaveTextContent('light');

      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', { key: 'payd-theme', newValue: 'system' })
        );
      });
      expect(screen.getByTestId('preference')).toHaveTextContent('system');
      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    });

    test('stops listening to the OS when unmounted', () => {
      const os = mockColorScheme(false);
      const { unmount } = render(
        <ThemeProvider>
          <PreferenceProbe />
        </ThemeProvider>
      );
      expect(os.listenerCount()).toBeGreaterThan(0);
      unmount();
      expect(os.listenerCount()).toBe(0);
    });
  });
});
