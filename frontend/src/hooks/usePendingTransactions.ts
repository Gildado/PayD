import { useState, useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';
import type { PendingTransaction } from '../components/TransactionPendingOverlay';

const MAX_NOTIFICATIONS = 5;
const AUTO_DISMISS_DELAY = 5000; // 5 seconds for confirmed/failed

export function usePendingTransactions() {
  const [transactions, setTransactions] = useState<PendingTransaction[]>([]);
  const { socket } = useSocket();

  // Add a new pending transaction
  const addTransaction = useCallback((tx: Omit<PendingTransaction, 'timestamp'>) => {
    const newTx: PendingTransaction = {
      ...tx,
      timestamp: Date.now(),
    };

    setTransactions((prev) => {
      const filtered = prev.slice(0, MAX_NOTIFICATIONS - 1);
      return [newTx, ...filtered];
    });

    return newTx.id;
  }, []);

  // Dismiss a transaction
  const dismissTransaction = useCallback((id: string) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
  }, []);

  // Update transaction status
  const updateTransaction = useCallback(
    (id: string, updates: Partial<PendingTransaction>) => {
      setTransactions((prev) => prev.map((tx) => (tx.id === id ? { ...tx, ...updates } : tx)));

      // Auto-dismiss after delay if confirmed or failed
      if (updates.status === 'confirmed' || updates.status === 'failed') {
        setTimeout(() => {
          dismissTransaction(id);
        }, AUTO_DISMISS_DELAY);
      }
    },
    [dismissTransaction]
  );

  // Listen for WebSocket transaction updates
  useEffect(() => {
    if (!socket) return;

    const handleTransactionUpdate = (data: {
      id: string;
      status: 'pending' | 'confirmed' | 'failed';
      hash?: string;
    }) => {
      updateTransaction(data.id, {
        status: data.status,
        hash: data.hash,
      });
    };

    socket.on('transaction:update', handleTransactionUpdate);

    return () => {
      socket.off('transaction:update', handleTransactionUpdate);
    };
  }, [socket, updateTransaction]);

  return {
    transactions,
    addTransaction,
    updateTransaction,
    dismissTransaction,
  };
}
