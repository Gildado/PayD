import { createContext, use } from 'react';

export type WalletEventType =
  | 'connected'
  | 'disconnected'
  | 'reconnected'
  | 'required'
  | 'connection_failed';

export interface NotificationContextType {
  notify: (message: string) => void;
  notifySuccess: (message: string, description?: string) => void;
  notifyError: (message: string, description?: string) => void;
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
