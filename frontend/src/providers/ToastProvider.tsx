import React, { createContext, useCallback, useState } from 'react';
import { Toast, ToastContextType } from '../types/toast';
import { ToastContainer } from '../components/common/Toast/ToastContainer';

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const MAX_TOASTS = 5;

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => {
      const newToasts = [...prev, { ...toast, id }];
      if (newToasts.length > MAX_TOASTS) {
        return newToasts.slice(newToasts.length - MAX_TOASTS);
      }
      return newToasts;
    });
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

  return (
    <ToastContext.Provider
      value={{ toasts, showToast, showSuccess, showError, showWarning, showInfo, removeToast }}
    >
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};
