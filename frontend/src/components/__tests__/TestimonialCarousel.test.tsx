import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TestimonialCarousel, DEFAULT_TESTIMONIALS } from '../TestimonialCarousel';
import { TestimonialCard } from '../TestimonialCard';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
  }),
}));

describe('TestimonialCard component', () => {
  it('renders author, company, quote, and metrics', () => {
    const item = DEFAULT_TESTIMONIALS[0];
    render(<TestimonialCard testimonial={item} />);

    expect(screen.getByText(item.author)).toBeInTheDocument();
    expect(screen.getByText(item.company)).toBeInTheDocument();
    expect(screen.getByText(`“${item.quote}”`)).toBeInTheDocument();
    expect(screen.getByText(item.metric!.value)).toBeInTheDocument();
    expect(screen.getByLabelText('Verified Customer')).toBeInTheDocument();
    expect(screen.getByLabelText('Rating: 5 out of 5 stars')).toBeInTheDocument();
  });
});

describe('TestimonialCarousel component', () => {
  it('renders carousel region with landmarks and initial slide', () => {
    render(<TestimonialCarousel />);

    expect(
      screen.getByRole('region', { name: 'Customer and partner testimonials' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Trusted by global teams on Stellar',
      })
    ).toBeInTheDocument();

    const slide = screen.getByRole('group', { name: /1 of 3: Amina Diallo/i });
    expect(slide).toBeInTheDocument();
    expect(screen.getByText('Amina Diallo')).toBeInTheDocument();
  }, 20000);

  it('navigates to next and previous slides via control buttons', () => {
    render(<TestimonialCarousel autoPlayInterval={100000} />);

    const nextBtn = screen.getByRole('button', { name: 'Next testimonial' });
    const prevBtn = screen.getByRole('button', { name: 'Previous testimonial' });

    // Click Next -> Kofi Mensah (slide 2)
    fireEvent.click(nextBtn);
    expect(screen.getByText('Kofi Mensah')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /2 of 3: Kofi Mensah/i })).toBeInTheDocument();

    // Click Next -> Elena Rostova (slide 3)
    fireEvent.click(nextBtn);
    expect(screen.getByText('Elena Rostova')).toBeInTheDocument();

    // Click Prev -> back to Kofi Mensah
    fireEvent.click(prevBtn);
    expect(screen.getByText('Kofi Mensah')).toBeInTheDocument();
  });

  it('supports direct slide selection via indicator tabs', () => {
    render(<TestimonialCarousel autoPlayInterval={100000} />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(3);

    // Select tab 3
    fireEvent.click(tabs[2]);
    expect(screen.getByText('Elena Rostova')).toBeInTheDocument();
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
  });

  it('navigates via arrow keyboard events', () => {
    render(<TestimonialCarousel autoPlayInterval={100000} />);

    const track = screen.getByLabelText('Use left and right arrow keys to navigate testimonials');

    fireEvent.keyDown(track, { key: 'ArrowRight' });
    expect(screen.getByText('Kofi Mensah')).toBeInTheDocument();

    fireEvent.keyDown(track, { key: 'ArrowLeft' });
    expect(screen.getByText('Amina Diallo')).toBeInTheDocument();
  });

  it('toggles pause on the play/pause button', () => {
    render(<TestimonialCarousel />);

    const pauseBtn = screen.getByRole('button', { name: 'Pause testimonial rotation' });
    expect(pauseBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(pauseBtn);
    expect(pauseBtn).toHaveAttribute('aria-label', 'Resume testimonial rotation');
    expect(pauseBtn).toHaveAttribute('aria-pressed', 'true');
  });
});
