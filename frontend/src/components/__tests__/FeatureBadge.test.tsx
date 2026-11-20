import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { FeatureBadge, type FeatureBadgeVariant } from '../FeatureBadge';

describe('FeatureBadge Component', () => {
  it('renders with default "new" variant and label', () => {
    render(<FeatureBadge />);
    const badge = screen.getByRole('status');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent(/new/i);
    expect(badge).toHaveAttribute('aria-label', 'New');
  });

  it('renders all variants with proper semantic styling', () => {
    const variants: FeatureBadgeVariant[] = ['new', 'coming-soon', 'beta', 'in-progress'];

    variants.forEach((variant) => {
      const { unmount } = render(<FeatureBadge variant={variant} />);
      const badge = screen.getByRole('status');
      expect(badge).toBeInTheDocument();
      unmount();
    });
  });

  it('supports custom label prop', () => {
    render(<FeatureBadge variant="coming-soon" label="Launching Q2" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Launching Q2');
    expect(badge).toHaveAttribute('aria-label', 'Launching Q2');
  });

  it('supports children as label override', () => {
    render(<FeatureBadge variant="beta">Early Access</FeatureBadge>);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Early Access');
  });

  it('applies correct size classes', () => {
    const { rerender } = render(<FeatureBadge size="sm" />);
    let badge = screen.getByRole('status');
    expect(badge).toHaveClass('text-[10px]');

    rerender(<FeatureBadge size="md" />);
    badge = screen.getByRole('status');
    expect(badge).toHaveClass('text-xs');

    rerender(<FeatureBadge size="lg" />);
    badge = screen.getByRole('status');
    expect(badge).toHaveClass('text-sm');
  });

  it('renders indicator dot with optional pulse', () => {
    const { container, rerender } = render(<FeatureBadge dot={true} pulse={false} />);
    const dot = container.querySelector('.rounded-full.shrink-0');
    expect(dot).toBeInTheDocument();
    expect(dot).not.toHaveClass('animate-pulse');

    rerender(<FeatureBadge dot={true} pulse={true} />);
    const pulsedDot = container.querySelector('.animate-pulse');
    expect(pulsedDot).toBeInTheDocument();
  });

  it('allows disabling the dot to show variant icon instead', () => {
    const { container } = render(<FeatureBadge variant="new" dot={false} />);
    const svgIcon = container.querySelector('svg');
    expect(svgIcon).toBeInTheDocument();
  });

  it('derives background, text, and border from theme CSS variables', () => {
    render(<FeatureBadge variant="new" />);
    const badge = screen.getByRole('status');
    expect(badge.style.color).toContain('var(--accent2)');
    expect(badge.style.backgroundColor).toContain('color-mix(in srgb, var(--accent2) 12%, transparent)');
    expect(badge.style.borderColor).toContain('color-mix(in srgb, var(--accent2) 28%, transparent)');
  });
});
