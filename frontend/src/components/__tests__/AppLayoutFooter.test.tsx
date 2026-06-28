import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AppLayout from '../AppLayout';

// Stub out all heavy dependencies so we can test just the footer markup
vi.mock('../ConnectAccount', () => ({ default: () => <div>Connect</div> }));
vi.mock('./AppNav', () => ({ default: () => null }));
vi.mock('../AppNav', () => ({ default: () => null }));
vi.mock('../LanguageSelector', () => ({ LanguageSelector: () => null }));
vi.mock('../ThemeToggle', () => ({ ThemeToggle: () => null }));
vi.mock('../NetworkSwitcher', () => ({ NetworkSwitcher: () => null }));
vi.mock('../Breadcrumb', () => ({ Breadcrumb: () => null }));
vi.mock('../../stores/networkStore', () => ({
  useNetworkStore: () => ({ network: 'MAINNET', setNetwork: vi.fn() }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));

describe('AppLayout footer', () => {
  test('renders a version badge starting with "v"', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppLayout />
      </MemoryRouter>
    );

    // The version badge text matches /^v\d+\.\d+\.\d+/ (e.g. "v0.0.1")
    const badge = screen.getByLabelText(/app version/i);
    expect(badge.textContent).toMatch(/^v\d/);
  });

  test('renders an environment badge', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppLayout />
      </MemoryRouter>
    );

    const envBadge = screen.getByLabelText(/environment/i);
    expect(envBadge).toBeInTheDocument();
    // In test mode, MODE is 'test' which resolves to 'dev' label
    expect(envBadge.textContent).toBeTruthy();
  });

  test('renders Stellar network indicator with current network', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppLayout />
      </MemoryRouter>
    );

    const networkIndicator = screen.getByLabelText(/connected to stellar/i);
    expect(networkIndicator).toBeInTheDocument();
    expect(networkIndicator.textContent).toContain('MAINNET');
  });

  test('renders the Apache License link', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppLayout />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /apache license/i })).toBeInTheDocument();
  });
});
