import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SocialLoginButton } from '../SocialLoginButton';

describe('SocialLoginButton', () => {
  it('renders Google button with correct label', () => {
    render(<SocialLoginButton provider="google" />);
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
  });

  it('renders GitHub button with correct label', () => {
    render(<SocialLoginButton provider="github" />);
    expect(screen.getByText('Continue with GitHub')).toBeInTheDocument();
  });

  it('calls onClick handler when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<SocialLoginButton provider="google" onClick={onClick} />);

    const button = screen.getByRole('button');
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows loading state with spinner', () => {
    const { container } = render(<SocialLoginButton provider="google" isLoading={true} />);
    expect(screen.getByText('Signing in...')).toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows loading state aria-busy attribute', () => {
    render(<SocialLoginButton provider="google" isLoading={true} />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('disables button when disabled prop is true', () => {
    render(<SocialLoginButton provider="google" disabled={true} />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('disables button when loading', () => {
    render(<SocialLoginButton provider="google" isLoading={true} />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('prevents click when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<SocialLoginButton provider="google" disabled={true} onClick={onClick} />);

    const button = screen.getByRole('button');
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders icon-only variant', () => {
    render(<SocialLoginButton provider="google" iconOnly={true} />);
    expect(screen.queryByText(/Continue/)).not.toBeInTheDocument();
  });

  it('applies custom label', () => {
    render(<SocialLoginButton provider="google" label="Sign in with Google" />);
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
  });

  it('applies size variants', () => {
    const { rerender } = render(<SocialLoginButton provider="google" size="sm" />);
    let button = screen.getByRole('button');
    expect(button).toHaveClass('px-3', 'py-1.5', 'text-xs');

    rerender(<SocialLoginButton provider="google" size="md" />);
    button = screen.getByRole('button');
    expect(button).toHaveClass('px-4', 'py-2.5', 'text-sm');

    rerender(<SocialLoginButton provider="google" size="lg" />);
    button = screen.getByRole('button');
    expect(button).toHaveClass('px-6', 'py-3', 'text-base');
  });

  it('has accessible aria labels', () => {
    render(<SocialLoginButton provider="google" />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Continue with Google');
  });

  it('applies custom className', () => {
    render(<SocialLoginButton provider="google" className="custom-class" />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('shows different styling for different providers', () => {
    const { rerender } = render(<SocialLoginButton provider="google" />);
    const googleButton = screen.getByRole('button');
    expect(googleButton).toHaveClass('bg-white');

    rerender(<SocialLoginButton provider="github" />);
    const githubButton = screen.getByRole('button');
    expect(githubButton).toHaveClass('bg-slate-900');
  });
});
