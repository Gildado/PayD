import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorState } from '../ErrorState';

describe('ErrorState', () => {
  it('renders with title', () => {
    render(<ErrorState title="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders message when provided', () => {
    render(<ErrorState title="Error" message="Failed to load data. Please try again." />);
    expect(screen.getByText('Failed to load data. Please try again.')).toBeInTheDocument();
  });

  it('renders error code when provided', () => {
    render(<ErrorState title="Error" code="404" />);
    expect(screen.getByText(/Error: 404/)).toBeInTheDocument();
  });

  it('renders retry button with onRetry callback', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState title="Error" onRetry={onRetry} />);

    const retryButton = screen.getByRole('button', { name: 'Try Again' });
    await user.click(retryButton);
    expect(onRetry).toHaveBeenCalled();
  });

  it('shows loading state when retrying', () => {
    render(<ErrorState title="Error" onRetry={() => {}} isRetrying={true} />);
    expect(screen.getByText('Retrying...')).toBeInTheDocument();
  });

  it('disables retry button when isRetrying is true', () => {
    render(<ErrorState title="Error" onRetry={() => {}} isRetrying={true} />);
    const retryButton = screen.getByRole('button', { name: 'Retrying...' });
    expect(retryButton).toBeDisabled();
  });

  it('renders action button when provided', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<ErrorState title="Error" action={{ label: 'Contact Support', onClick: onAction }} />);

    const actionButton = screen.getByRole('button', { name: 'Contact Support' });
    await user.click(actionButton);
    expect(onAction).toHaveBeenCalled();
  });

  it('has alert role for accessibility', () => {
    render(<ErrorState title="Error" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<ErrorState title="Error" className="custom-class" />);
    const errorState = container.firstChild;
    expect(errorState).toHaveClass('custom-class');
  });
});
