import React, { useCallback } from 'react';
import { toast } from 'sonner';
import {
  NotificationContext,
  type NotifyPromiseMessages,
  type WalletEventType,
} from '../hooks/useNotification';
import { AppToaster } from '../components/common/Toast/AppToaster';
import { getTxExplorerUrl } from '../utils/stellarExpert';

const buildTxExplorerLink = (txHash: string) => getTxExplorerUrl(txHash);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const notify = useCallback((message: string) => {
    toast(message);
  }, []);

  const notifySuccess = useCallback((message: string, description?: string) => {
    toast.success(message, { description });
  }, []);

  const notifyError = useCallback((message: string, description?: string) => {
    toast.error(message, { description });
  }, []);

  const notifyInfo = useCallback((message: string, description?: string) => {
    toast.info(message, { description });
  }, []);

  const notifyWarning = useCallback((message: string, description?: string) => {
    toast.warning(message, { description });
  }, []);

  const notifyPromise = useCallback(
    <T,>(promise: Promise<T>, messages: NotifyPromiseMessages<T>): Promise<T> => {
      toast.promise(promise, {
        loading: messages.loading,
        success: messages.success,
        error: messages.error,
        description: messages.description,
      });
      return promise;
    },
    []
  );

  const notifyPaymentSuccess = useCallback((txHash: string, label = 'Payment submitted') => {
    toast.success(label, {
      description: (
        <a
          href={buildTxExplorerLink(txHash)}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          View transaction: {txHash.slice(0, 8)}...{txHash.slice(-8)}
        </a>
      ),
    });
  }, []);

  const notifyPaymentFailure = useCallback((reason: string, txHash?: string) => {
    const suffix = txHash ? ` (tx: ${txHash.slice(0, 8)}...${txHash.slice(-8)})` : '';
    toast.error('Payment failed', { description: `${reason}${suffix}` });
  }, []);

  const notifyWalletEvent = useCallback((event: WalletEventType, detail?: string) => {
    switch (event) {
      case 'connected':
        toast.success('Wallet connected', { description: detail });
        break;
      case 'reconnected':
        toast.success('Wallet reconnected', { description: detail });
        break;
      case 'switched':
        toast.success('Wallet switched', { description: detail });
        break;
      case 'disconnected':
        toast('Wallet disconnected', { description: detail });
        break;
      case 'required':
        toast.error('Wallet required', { description: detail });
        break;
      case 'connection_failed':
        toast.error('Wallet connection failed', { description: detail });
        break;
      default:
        break;
    }
  }, []);

  const notifyApiError = useCallback((context: string, detail?: string) => {
    toast.error(`${context}`, {
      description: detail || 'Request failed. Please retry.',
    });
  }, []);

  return (
    <NotificationContext
      value={{
        notify,
        notifySuccess,
        notifyError,
        notifyInfo,
        notifyWarning,
        notifyPromise,
        notifyPaymentSuccess,
        notifyPaymentFailure,
        notifyWalletEvent,
        notifyApiError,
      }}
    >
      {children}
      <AppToaster />
    </NotificationContext>
  );
};
