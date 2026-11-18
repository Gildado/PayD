/**
 * ThemeToggle: Light / Dark / System menu (#1872).
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ThemeToggle } from '../ThemeToggle';
import { ThemeProvider } from '../../providers/ThemeProvider';

function setOsDark(dark: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' ? dark : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
      <button type="button">elsewhere</button>
    </ThemeProvider>
  );
}

describe('ThemeToggle', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    localStorage.removeItem('payd-theme');
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  test('defaults to System and says which scheme it resolved to', () => {
    setOsDark(true);
    renderToggle();
    const button = screen.getByRole('button', { name: 'Theme: System (Dark)' });
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  test('offers light, dark and system with the current one checked', async () => {
    const user = userEvent.setup();
    setOsDark(false);
    renderToggle();

    await user.click(screen.getByRole('button', { name: /^Theme:/ }));
    expect(screen.getByRole('menu', { name: 'Theme' })).toBeInTheDocument();

    const items = screen.getAllByRole('menuitemradio');
    expect(items.map((i) => i.textContent)).toEqual(['Light', 'Dark', 'System (Light)']);
    expect(screen.getByRole('menuitemradio', { name: 'System (Light)' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
  });

  test('choosing an option applies it, persists it and closes the menu', async () => {
    const user = userEvent.setup();
    setOsDark(false);
    renderToggle();

    await user.click(screen.getByRole('button', { name: /^Theme:/ }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Dark' }));

    expect(localStorage.getItem('payd-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Theme: Dark' });
    expect(button).toHaveFocus();

    await user.click(button);
    await user.click(screen.getByRole('menuitemradio', { name: 'System (Light)' }));
    expect(localStorage.getItem('payd-theme')).toBe('system');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  test('is fully keyboard operable', async () => {
    const user = userEvent.setup();
    setOsDark(false);
    localStorage.setItem('payd-theme', 'light');
    renderToggle();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Theme: Light' })).toHaveFocus();

    // Opening puts focus on the checked option.
    await user.keyboard('{Enter}');
    expect(screen.getByRole('menuitemradio', { name: 'Light' })).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toHaveFocus();
    await user.keyboard('{ArrowDown}{ArrowDown}');
    // wraps around
    expect(screen.getByRole('menuitemradio', { name: 'Light' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitemradio', { name: /^System/ })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(localStorage.getItem('payd-theme')).toBe('system');
    expect(screen.getByRole('button', { name: 'Theme: System (Light)' })).toHaveFocus();
  });

  test('Escape closes the menu without changing the theme', async () => {
    const user = userEvent.setup();
    localStorage.setItem('payd-theme', 'dark');
    renderToggle();

    await user.click(screen.getByRole('button', { name: 'Theme: Dark' }));
    await user.keyboard('{ArrowDown}{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Theme: Dark' })).toHaveFocus();
    expect(localStorage.getItem('payd-theme')).toBe('dark');
  });

  test('clicking outside closes the menu', async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(screen.getByRole('button', { name: /^Theme:/ }));
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
