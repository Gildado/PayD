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
});
