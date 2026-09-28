import React, { useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import { NotificationContext } from '../hooks/useNotification';
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

  const notifyWalletEvent = useCallback(
    (
      event: 'connected' | 'disconnected' | 'reconnected' | 'required' | 'connection_failed',
      detail?: string
    ) => {
      switch (event) {
        case 'connected':
          toast.success('Wallet connected', { description: detail });
          break;
        case 'reconnected':
          toast.success('Wallet reconnected', { description: detail });
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
    },
    []
  );

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
        notifyPaymentSuccess,
        notifyPaymentFailure,
        notifyWalletEvent,
        notifyApiError,
      }}
    >
      {children}
      <Toaster richColors position="top-right" closeButton />
    </NotificationContext>
  );
};
