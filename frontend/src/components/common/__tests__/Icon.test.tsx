import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  StandardIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  CreditCardIcon,
  QuoteIcon,
  resolveIconSize,
} from '../Icon';

describe('StandardIcon system', () => {
  it('resolves standard size tokens correctly', () => {
    expect(resolveIconSize('xs')).toBe(14);
    expect(resolveIconSize('sm')).toBe(16);
    expect(resolveIconSize('md')).toBe(20);
    expect(resolveIconSize('lg')).toBe(24);
    expect(resolveIconSize('xl')).toBe(32);
    expect(resolveIconSize(28)).toBe(28);
  });

  it('renders decorative icon with aria-hidden="true" by default', () => {
    const { container } = render(<ArrowRightIcon size="sm" />);
    const svg = container.querySelector('svg');

    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('width', '16');
    expect(svg).toHaveAttribute('height', '16');
    expect(svg).toHaveAttribute('stroke-width', '1.75');
    expect(svg).toHaveAttribute('focusable', 'false');
  });

  it('renders accessible icon with role="img" when aria-label is provided', () => {
    render(<CheckCircleIcon size="md" aria-label="Success verified" />);
    const icon = screen.getByRole('img', { name: 'Success verified' });

    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('aria-label', 'Success verified');
    expect(icon).not.toHaveAttribute('aria-hidden');
  });

  it('applies design token tone classes', () => {
    const { container } = render(<CreditCardIcon tone="accent" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('text-accent');
  });

  it('renders from the StandardIcon namespace', () => {
    const { container } = render(<StandardIcon.Quote size="lg" tone="accent2" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveClass('text-accent2');
  });
});
