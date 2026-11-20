import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Footer } from '../Footer';

vi.mock('../../stores/networkStore', () => ({
  useNetworkStore: () => ({ network: 'MAINNET', setNetwork: vi.fn() }),
}));

vi.mock('../stores/networkStore', () => ({
  useNetworkStore: () => ({ network: 'MAINNET', setNetwork: vi.fn() }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: string) => fallback ?? _k,
    i18n: { language: 'en' },
  }),
}));

describe('Footer Component (#1485)', () => {
  it('renders structured link column headings for Product, Company, Resources, Legal', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /Product/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Company/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Resources/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Legal/i })).toBeInTheDocument();
  });

  it('renders brand logo, tagline and social links', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/PayD GitHub Repository/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/PayD Twitter \/ X/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/PayD Community Discord/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/PayD LinkedIn/i)).toBeInTheDocument();
  });

  it('renders bottom bar with version, environment, stellar network and license', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    const versionBadge = screen.getByLabelText(/app version/i);
    expect(versionBadge.textContent).toMatch(/^v\d/);

    const envBadge = screen.getByLabelText(/environment/i);
    expect(envBadge).toBeInTheDocument();

    const networkIndicator = screen.getByLabelText(/connected to stellar/i);
    expect(networkIndicator.textContent).toContain('MAINNET');

    const licenseLinks = screen.getAllByRole('link', { name: /apache license/i });
    expect(licenseLinks.length).toBeGreaterThanOrEqual(1);
  });
});
