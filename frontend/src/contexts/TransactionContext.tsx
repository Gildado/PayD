import { type ReactNode } from 'react';
import { usePendingTransactions } from '../hooks/usePendingTransactions';

import { TransactionContext } from './TransactionContextInstance';

export function TransactionProvider({ children }: { children: ReactNode }) {
  const transactionState = usePendingTransactions();

  return <TransactionContext value={transactionState}>{children}</TransactionContext>;
}
