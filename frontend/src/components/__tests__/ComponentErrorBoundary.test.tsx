import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach } from 'vitest';

vi.mock('@sentry/react', () => ({
  default: {
    captureException: vi.fn(),
  },
  captureException: vi.fn(),
}));

import ComponentErrorBoundary from '../ComponentErrorBoundary';

const BrokenComponent = () => {
  throw new Error('Test error');
};

const SafeComponent = () => <div>All good</div>;

describe('ComponentErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('renders children when no error', () => {
    render(
      <ComponentErrorBoundary>
        <SafeComponent />
      </ComponentErrorBoundary>
    );

    expect(screen.getByText('All good')).toBeTruthy();
  });

  test('renders error state when child throws', () => {
    render(
      <ComponentErrorBoundary componentName="TestComponent">
        <BrokenComponent />
      </ComponentErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/TestComponent encountered an error/i)).toBeTruthy();
  });

  test('shows generic error label when no componentName', () => {
    render(
      <ComponentErrorBoundary>
        <BrokenComponent />
      </ComponentErrorBoundary>
    );

    expect(screen.getByText('Component Error')).toBeTruthy();
  });

  test('renders try again button that resets error state', () => {
    const { rerender } = render(
      <ComponentErrorBoundary componentName="TestComponent">
        <BrokenComponent />
      </ComponentErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeTruthy();

    rerender(
      <ComponentErrorBoundary componentName="TestComponent">
        <SafeComponent />
      </ComponentErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('All good')).toBeTruthy();
  });

  test('renders custom fallback when provided', () => {
    render(
      <ComponentErrorBoundary fallback={<div>Custom error UI</div>}>
        <BrokenComponent />
      </ComponentErrorBoundary>
    );

    expect(screen.getByText('Custom error UI')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('has accessible error message', () => {
    render(
      <ComponentErrorBoundary componentName="Dashboard">
        <BrokenComponent />
      </ComponentErrorBoundary>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeTruthy();
    expect(alert.getAttribute('aria-live')).toBe('assertive');
  });
});
