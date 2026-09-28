import { createContext } from 'react';
import type { PendingTransaction } from '../components/TransactionPendingOverlay';

export interface TransactionContextValue {
  transactions: PendingTransaction[];
  addTransaction: (tx: Omit<PendingTransaction, 'timestamp'>) => string;
  updateTransaction: (id: string, updates: Partial<PendingTransaction>) => void;
  dismissTransaction: (id: string) => void;
}

export const TransactionContext = createContext<TransactionContextValue | null>(null);
