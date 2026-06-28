import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('renders with correct label', () => {
    render(<StatusBadge variant="success" label="Active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders all variants correctly', () => {
    const variants = ['success', 'pending', 'warning', 'error', 'loading', 'neutral'] as const;

    variants.forEach((variant) => {
      const { unmount } = render(<StatusBadge variant={variant} label={variant} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      unmount();
    });
  });

  it('applies correct size classes', () => {
    const { container, rerender } = render(
      <StatusBadge variant="success" label="Test" size="sm" />
    );

    let badge = container.querySelector('[role="status"]');
    expect(badge).toHaveClass('text-xs', 'px-2', 'py-1');

    rerender(<StatusBadge variant="success" label="Test" size="md" />);
    badge = container.querySelector('[role="status"]');
    expect(badge).toHaveClass('text-sm', 'px-2.5', 'py-1.5');

    rerender(<StatusBadge variant="success" label="Test" size="lg" />);
    badge = container.querySelector('[role="status"]');
    expect(badge).toHaveClass('text-sm', 'px-3', 'py-2');
  });

  it('has accessible ARIA attributes', () => {
    render(<StatusBadge variant="success" label="Completed" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('aria-label', 'Status: Completed');
  });

  it('applies custom className', () => {
    const { container } = render(
      <StatusBadge variant="success" label="Test" className="custom-class" />
    );
    const badge = container.querySelector('[role="status"]');
    expect(badge).toHaveClass('custom-class');
  });

  it('renders loading variant with spinning icon', () => {
    const { container } = render(<StatusBadge variant="loading" label="Processing" />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});
