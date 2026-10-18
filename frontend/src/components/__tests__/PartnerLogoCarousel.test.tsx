import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PartnerLogoCarousel, PARTNERS } from '../PartnerLogoCarousel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
  }),
}));

describe('PartnerLogoCarousel component', () => {
  it('renders section landmark and title', () => {
    render(<PartnerLogoCarousel />);

    const region = screen.getByRole('region', {
      name: 'Trusted by leading Web3 & financial organizations',
    });
    expect(region).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Trusted by leading Web3 & financial organizations',
      })
    ).toBeInTheDocument();
  }, 20000);

  it('renders all partner items in the marquee track', () => {
    render(<PartnerLogoCarousel />);

    const list = screen.getByRole('list', { name: 'List of partner logos' });
    expect(list).toBeInTheDocument();

    const items = screen.getAllByRole('listitem');
    // We duplicated the list for seamless infinite loop (length * 2)
    expect(items.length).toBe(PARTNERS.length * 2);
  }, 20000);

  it('toggles pause state when pause button is clicked', () => {
    render(<PartnerLogoCarousel />);

    const pauseButton = screen.getByRole('button', {
      name: 'Pause auto-scrolling partner logos',
    });
    expect(pauseButton).toHaveAttribute('aria-pressed', 'false');

    const track = screen.getByRole('list', { name: 'List of partner logos' });
    expect(track).not.toHaveClass('is-paused');

    // Click to pause
    fireEvent.click(pauseButton);
    expect(pauseButton).toHaveAttribute('aria-pressed', 'true');
    expect(track).toHaveClass('is-paused');
    expect(screen.getByText('Play')).toBeInTheDocument();

    // Click to resume
    fireEvent.click(pauseButton);
    expect(pauseButton).toHaveAttribute('aria-pressed', 'false');
    expect(track).not.toHaveClass('is-paused');
    expect(screen.getByText('Pause')).toBeInTheDocument();
  }, 20000);

  it('includes accessible badges for categories', () => {
    render(<PartnerLogoCarousel />);
    expect(screen.getAllByText('L1 Network').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Stablecoin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Rust Engine').length).toBeGreaterThan(0);
  }, 20000);
});
