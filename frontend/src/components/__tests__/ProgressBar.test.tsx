import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from '../ProgressBar';

describe('ProgressBar', () => {
  it('renders with correct progress value', () => {
    render(<ProgressBar value={50} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '50');
  });

  it('clamps values between 0 and 100', () => {
    const { rerender } = render(<ProgressBar value={150} />);
    let progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '100');

    rerender(<ProgressBar value={-50} />);
    progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '0');
  });

  it('shows label when showLabel prop is true', () => {
    render(<ProgressBar value={75} showLabel={true} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('Progress')).toBeInTheDocument();
  });

  it('shows completion message when value is 100', () => {
    render(<ProgressBar value={100} />);
    expect(screen.getByText('✓ Complete')).toBeInTheDocument();
  });

  it('applies correct variant styles', () => {
    const { container } = render(<ProgressBar value={50} variant="success" />);
    const progressFill = container.querySelector('[role="progressbar"] > div > div');
    expect(progressFill).toHaveClass('bg-gradient-to-r', 'from-green-500', 'to-emerald-400');
  });

  it('has correct accessibility attributes', () => {
    render(<ProgressBar value={50} ariaLabel="Upload progress" />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '50');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    expect(progressBar).toHaveAttribute('aria-label', 'Upload progress');
  });

  it('applies different size classes', () => {
    const { container, rerender } = render(<ProgressBar value={50} size="sm" />);
    let progressContainer = container.querySelector('[role="progressbar"]');
    expect(progressContainer?.querySelector('.h-1')).toBeInTheDocument();

    rerender(<ProgressBar value={50} size="md" />);
    progressContainer = container.querySelector('[role="progressbar"]');
    expect(progressContainer?.querySelector('.h-2')).toBeInTheDocument();
  });
});
