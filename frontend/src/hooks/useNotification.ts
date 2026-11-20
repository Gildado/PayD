import { createContext, use } from 'react';

export type WalletEventType =
  | 'connected'
  | 'disconnected'
  | 'reconnected'
  | 'switched'
  | 'required'
  | 'connection_failed';

export interface NotifyPromiseMessages<T> {
  /** Shown while the promise is pending. */
  loading: string;
  /** Shown when it resolves; may be derived from the resolved value. */
  success: string | ((result: T) => string);
  /** Shown when it rejects; may be derived from the rejection reason. */
  error: string | ((error: unknown) => string);
  /** Optional secondary line shown under the success/error title. */
  description?: string;
}

export interface NotificationContextType {
  notify: (message: string) => void;
  notifySuccess: (message: string, description?: string) => void;
  notifyError: (message: string, description?: string) => void;
  notifyInfo: (message: string, description?: string) => void;
  notifyWarning: (message: string, description?: string) => void;
  /**
   * Tracks an async action with a single toast that moves from a loading
   * state to success or error. Returns the original promise so callers can
   * keep awaiting it.
   */
  notifyPromise: <T>(promise: Promise<T>, messages: NotifyPromiseMessages<T>) => Promise<T>;
  notifyPaymentSuccess: (txHash: string, label?: string) => void;
  notifyPaymentFailure: (reason: string, txHash?: string) => void;
  notifyWalletEvent: (event: WalletEventType, detail?: string) => void;
  notifyApiError: (context: string, detail?: string) => void;
}

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = use(NotificationContext);
  if (!context) throw new Error('useNotification must be used within NotificationProvider');
  return context;
};
