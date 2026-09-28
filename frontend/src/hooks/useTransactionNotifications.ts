import { use } from 'react';
import { TransactionContext } from '../contexts/TransactionContextInstance';

export function useTransactionNotifications() {
  const context = use(TransactionContext);
  if (!context) {
    throw new Error('useTransactionNotifications must be used within TransactionProvider');
  }
  return context;
}
