import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'errorFallback.tryAgain': 'Try Again',
        'errorFallback.goHome': 'Go Home',
        'errorFallback.pageErrorTitle': 'Something went wrong',
        'errorFallback.pageErrorDescription': 'An unexpected error occurred.',
      };
      return translations[key] ?? key;
    },
  }),
}));

import PageErrorFallback from '../PageErrorFallback';

describe('PageErrorFallback', () => {
  test('renders default title and description', () => {
    render(<PageErrorFallback />);

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('An unexpected error occurred.')).toBeTruthy();
  });

  test('renders custom title and description when provided', () => {
    render(<PageErrorFallback title="Custom Error" description="A custom error occurred" />);

    expect(screen.getByText('Custom Error')).toBeTruthy();
    expect(screen.getByText('A custom error occurred')).toBeTruthy();
  });

  test('renders try again button when showRetry is true and resetError is provided', () => {
    const resetError = vi.fn();
    render(<PageErrorFallback resetError={resetError} />);

    const retryButton = screen.getByRole('button', { name: 'Try Again' });
    expect(retryButton).toBeTruthy();

    fireEvent.click(retryButton);
    expect(resetError).toHaveBeenCalled();
  });

  test('does not render try again when showRetry is false', () => {
    render(<PageErrorFallback showRetry={false} resetError={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Try Again' })).toBeNull();
  });

  test('renders go home link', () => {
    render(<PageErrorFallback />);

    const homeLink = screen.getByRole('link', { name: 'Go Home' });
    expect(homeLink).toBeTruthy();
    expect(homeLink.getAttribute('href')).toBe('/');
  });

  test('error content has alert role for accessibility', () => {
    render(<PageErrorFallback />);

    expect(screen.getByRole('alert')).toBeTruthy();
  });

  test('renders PayD logo in header', () => {
    render(<PageErrorFallback />);

    const logoLink = screen.getByRole('link', { name: 'PayD Home' });
    expect(logoLink).toBeTruthy();
    expect(logoLink.getAttribute('href')).toBe('/');
  });

  test('renders skip to main content link', () => {
    render(<PageErrorFallback />);

    const skipLink = screen.getByText('Skip to main content');
    expect(skipLink).toBeTruthy();
    expect(skipLink.getAttribute('href')).toBe('#main-content');
  });

  test('renders footer with current year', () => {
    render(<PageErrorFallback />);

    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(year))).toBeTruthy();
  });

  test('main content has id for skip link', () => {
    render(<PageErrorFallback />);

    expect(document.getElementById('main-content')).toBeTruthy();
  });
});
