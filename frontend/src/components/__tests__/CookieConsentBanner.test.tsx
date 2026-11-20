import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CookieConsentBanner, COOKIE_CONSENT_KEY } from '../CookieConsentBanner';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
  }),
}));

describe('CookieConsentBanner component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders landmark and text when forceVisible=true', () => {
    render(
      <MemoryRouter>
        <CookieConsentBanner forceVisible />
      </MemoryRouter>
    );

    const region = screen.getByRole('region', {
      name: 'Cookie and regulatory compliance disclosure',
    });
    expect(region).toBeInTheDocument();
    expect(screen.getByText('Regulatory & Cookie Disclosure')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept all cookies' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept necessary cookies only' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss notification' })).toBeInTheDocument();
  }, 20000);

  it('does not render when consent is already recorded in localStorage', () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ consent: 'all' }));

    render(
      <MemoryRouter>
        <CookieConsentBanner />
      </MemoryRouter>
    );

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('saves "all" consent to localStorage when Accept All is clicked', () => {
    const handleConsent = vi.fn();
    render(
      <MemoryRouter>
        <CookieConsentBanner forceVisible onConsentChange={handleConsent} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Accept all cookies' }));

    const saved = JSON.parse(localStorage.getItem(COOKIE_CONSENT_KEY) ?? '{}');
    expect(saved.consent).toBe('all');
    expect(handleConsent).toHaveBeenCalledWith('all');
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('saves "necessary" consent to localStorage when Necessary Only is clicked', () => {
    const handleConsent = vi.fn();
    render(
      <MemoryRouter>
        <CookieConsentBanner forceVisible onConsentChange={handleConsent} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Accept necessary cookies only' }));

    const saved = JSON.parse(localStorage.getItem(COOKIE_CONSENT_KEY) ?? '{}');
    expect(saved.consent).toBe('necessary');
    expect(handleConsent).toHaveBeenCalledWith('necessary');
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('dismisses banner on close button click', () => {
    render(
      <MemoryRouter>
        <CookieConsentBanner forceVisible />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
});
