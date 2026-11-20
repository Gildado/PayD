import React, { createContext, useCallback, useMemo } from 'react';
import { toast as sonnerToast } from 'sonner';
import { Toast, ToastContextType } from '../types/toast';

// eslint-disable-next-line react-refresh/only-export-components
export const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * Keeps the `useToast` API for existing callers, but renders through the one
 * global toaster mounted by NotificationProvider (#1500) so every toast in
 * the app shares the same look, stacking, and accessibility behaviour.
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const message = toast.title ?? toast.message;
    const options = {
      description: toast.title ? toast.message : undefined,
      duration: toast.duration,
      action: toast.action,
    };
    return String(sonnerToast[toast.type](message, options));
  }, []);

  const showSuccess = useCallback(
    (message: string, title?: string, duration?: number) =>
      showToast({ type: 'success', message, title, duration }),
    [showToast]
  );
  const showError = useCallback(
    (message: string, title?: string, duration?: number) =>
      showToast({ type: 'error', message, title, duration }),
    [showToast]
  );
  const showWarning = useCallback(
    (message: string, title?: string, duration?: number) =>
      showToast({ type: 'warning', message, title, duration }),
    [showToast]
  );
  const showInfo = useCallback(
    (message: string, title?: string, duration?: number) =>
      showToast({ type: 'info', message, title, duration }),
    [showToast]
  );

  const removeToast = useCallback((id: string) => {
    sonnerToast.dismiss(id);
  }, []);

  const value = useMemo(
    () => ({ showToast, showSuccess, showError, showWarning, showInfo, removeToast }),
    [showToast, showSuccess, showError, showWarning, showInfo, removeToast]
  );

  return <ToastContext value={value}>{children}</ToastContext>;
};
