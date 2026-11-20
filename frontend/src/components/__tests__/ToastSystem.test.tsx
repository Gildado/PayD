import { act, render, renderHook, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

const sonnerMock = vi.hoisted(() => ({
  success: vi.fn(() => 'toast-1'),
  error: vi.fn(() => 'toast-2'),
  warning: vi.fn(() => 'toast-3'),
  info: vi.fn(() => 'toast-4'),
  promise: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), sonnerMock),
  Toaster: (props: { theme?: string; containerAriaLabel?: string }) => (
    <section data-testid="toaster" data-theme={props.theme} aria-label={props.containerAriaLabel} />
  ),
}));

import { ToastProvider } from '../../providers/ToastProvider';
import { NotificationProvider } from '../../providers/NotificationProvider';
import { useToast } from '../../hooks/useToast';
import { useNotification } from '../../hooks/useNotification';
import { ThemeContext, type ThemeContextType } from '../../hooks/useTheme';

const toastWrapper = ({ children }: { children: ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);
const notificationWrapper = ({ children }: { children: ReactNode }) => (
  <NotificationProvider>{children}</NotificationProvider>
);

describe('global toast system (#1500)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mounts a single themed toaster that follows the app theme', () => {
    const theme = { theme: 'dark' } as ThemeContextType;
    render(
      <ThemeContext value={theme}>
        <NotificationProvider>
          <span>app</span>
        </NotificationProvider>
      </ThemeContext>
    );
    const toaster = screen.getByTestId('toaster');
    expect(toaster).toHaveAttribute('data-theme', 'dark');
    expect(toaster).toHaveAttribute('aria-label', 'Notifications');
  });

  it('falls back to the light theme outside ThemeProvider', () => {
    render(<NotificationProvider>app</NotificationProvider>);
    expect(screen.getByTestId('toaster')).toHaveAttribute('data-theme', 'light');
  });

  it('routes useToast calls through the shared toaster', () => {
    const { result } = renderHook(() => useToast(), { wrapper: toastWrapper });

    let id = '';
    act(() => {
      id = result.current.showSuccess('Schedule saved', 'Done');
    });

    expect(sonnerMock.success).toHaveBeenCalledWith(
      'Done',
      expect.objectContaining({ description: 'Schedule saved' })
    );
    expect(id).toBe('toast-1');

    act(() => result.current.removeToast(id));
    expect(sonnerMock.dismiss).toHaveBeenCalledWith('toast-1');
  });

  it('uses the message as the title when no title is given', () => {
    const { result } = renderHook(() => useToast(), { wrapper: toastWrapper });
    act(() => {
      result.current.showError('Could not save');
    });
    expect(sonnerMock.error).toHaveBeenCalledWith(
      'Could not save',
      expect.objectContaining({ description: undefined })
    );
  });

  it('exposes info and warning helpers on useNotification', () => {
    const { result } = renderHook(() => useNotification(), { wrapper: notificationWrapper });
    act(() => {
      result.current.notifyInfo('Heads up', 'detail');
      result.current.notifyWarning('Careful');
    });
    expect(sonnerMock.info).toHaveBeenCalledWith('Heads up', { description: 'detail' });
    expect(sonnerMock.warning).toHaveBeenCalledWith('Careful', { description: undefined });
  });

  it('tracks async actions with notifyPromise and returns the same promise', async () => {
    const { result } = renderHook(() => useNotification(), { wrapper: notificationWrapper });
    const work = Promise.resolve(42);

    const returned = result.current.notifyPromise(work, {
      loading: 'Submitting payroll…',
      success: (n) => `Paid ${n} employees`,
      error: 'Payroll failed',
    });

    expect(returned).toBe(work);
    await expect(returned).resolves.toBe(42);
    expect(sonnerMock.promise).toHaveBeenCalledWith(
      work,
      expect.objectContaining({ loading: 'Submitting payroll…', error: 'Payroll failed' })
    );
  });
});
