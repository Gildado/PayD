import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, beforeEach } from 'vitest';
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
  beforeEach(() => {
    localStorage.removeItem('payd-theme');
    localStorage.removeItem('payd-org-brand');
  });

  test('restores theme from localStorage on mount', () => {
    localStorage.setItem('payd-theme', 'light');
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  test('persists theme when toggled', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    await user.click(screen.getByRole('button', { name: /toggle/i }));
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(localStorage.getItem('payd-theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
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

    await user.click(screen.getByRole('button', { name: /reset-brand/i }));
    expect(screen.getByTestId('org-name')).toHaveTextContent('none');
    expect(document.documentElement.getAttribute('data-org-name')).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('');
  });
});
