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

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.removeItem('payd-theme');
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
});
