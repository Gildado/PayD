import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders with title', () => {
    render(<EmptyState title="No results found" />);
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="No results" description="Please try adjusting your filters" />);
    expect(screen.getByText('Please try adjusting your filters')).toBeInTheDocument();
  });

  it('renders primary action button', async () => {
    const user = userEvent.setup();
    const onPrimaryClick = vi.fn();
    render(
      <EmptyState title="Empty" primaryAction={{ label: 'Add Item', onClick: onPrimaryClick }} />
    );

    const button = screen.getByRole('button', { name: 'Add Item' });
    await user.click(button);
    expect(onPrimaryClick).toHaveBeenCalled();
  });

  it('renders secondary action button', async () => {
    const user = userEvent.setup();
    const onSecondaryClick = vi.fn();
    render(
      <EmptyState title="Empty" secondaryAction={{ label: 'Go Back', onClick: onSecondaryClick }} />
    );

    const button = screen.getByRole('button', { name: 'Go Back' });
    await user.click(button);
    expect(onSecondaryClick).toHaveBeenCalled();
  });

  it('has status role for accessibility', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<EmptyState title="Empty" className="custom-class" />);
    expect(container.querySelector('div')).toHaveClass('custom-class');
  });

  it('renders custom icon', () => {
    render(<EmptyState title="Empty" icon={<span data-testid="custom-icon">📭</span>} />);
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('applies the illustration motion system', () => {
    render(<EmptyState title="Empty" />);
    expect(document.querySelector('.motion-empty-illustration')).toHaveClass(
      'motion-empty-illustration'
    );
    expect(document.querySelector('.motion-empty-illustration-halo')).toBeInTheDocument();
    expect(document.querySelector('.motion-empty-illustration-orbit-one')).toBeInTheDocument();
  });

  it('marks the illustration static when reduced motion is preferred', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    render(<EmptyState title="Empty" />);

    expect(document.querySelector('.motion-empty-illustration')).toHaveClass(
      'motion-empty-illustration-reduced'
    );
    vi.unstubAllGlobals();
  });

  it.each(['employees', 'transactions', 'reports', 'search'] as const)(
    'renders the %s illustration as decorative art',
    (illustration) => {
      const { container } = render(<EmptyState title="Empty" illustration={illustration} />);
      const art = container.querySelector('svg.empty-state-art');
      expect(art).toBeInTheDocument();
      expect(art?.closest('[aria-hidden="true"]')).not.toBeNull();
      expect(container.querySelector('.motion-empty-illustration')).not.toBeInTheDocument();
    }
  );

  it('uses the requested heading level for the title', () => {
    render(<EmptyState title="No employees yet" headingLevel={2} />);
    expect(screen.getByRole('heading', { level: 2, name: 'No employees yet' })).toBeInTheDocument();
  });

  it('styles the primary action as a solid CTA and the secondary as an arrow link', () => {
    render(
      <EmptyState
        title="Empty"
        primaryAction={{ label: 'Add employee', onClick: vi.fn() }}
        secondaryAction={{ label: 'Import CSV', onClick: vi.fn() }}
      />
    );
    expect(screen.getByRole('button', { name: 'Add employee' })).toHaveClass('rounded-full');
    expect(screen.getByRole('button', { name: 'Import CSV' }).querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
  });
});
