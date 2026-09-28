/**
 * Example: How to use Transaction Notifications
 *
 * This file demonstrates how to trigger transaction notifications
 * from any component within the EmployerLayout.
 */

import { useTransactionNotifications } from '../hooks/useTransactionNotifications';
import { Button } from '@stellar/design-system';

export function TransactionNotificationExample() {
  const { addTransaction, updateTransaction } = useTransactionNotifications();

  const handlePayment = async () => {
    // Add a pending transaction notification
    const txId = addTransaction({
      id: `tx-${Date.now()}`,
      type: 'payment',
      status: 'pending',
      description: 'Processing payroll payment to 5 employees',
    });

    try {
      // Simulate transaction processing
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Update to confirmed with transaction hash
      updateTransaction(txId, {
        status: 'confirmed',
        hash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      });
    } catch {
      // Update to failed
      updateTransaction(txId, {
        status: 'failed',
        description: 'Payment failed: Insufficient balance',
      });
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Transaction Notification Example</h2>
      <Button onClick={() => void handlePayment()}>Trigger Test Payment</Button>
    </div>
  );
}

/**
 * Usage in your components:
 *
 * 1. import { useState } from 'react';
 *    import { useTransactionNotifications } from '../hooks/useTransactionNotifications';
 *
 * 2. Use in your component:
 *    const { addTransaction, updateTransaction } = useTransactionNotifications();
 *
 * 3. Add a pending transaction:
 *    const txId = addTransaction({
 *      id: 'unique-tx-id',
 *      type: 'payment',
 *      status: 'pending',
 *      description: 'Your transaction description',
 *    });
 *
 * 4. Update when confirmed/failed:
 *    updateTransaction(txId, {
 *      status: 'confirmed',
 *      hash: 'transaction-hash-from-stellar',
 *    });
 */
