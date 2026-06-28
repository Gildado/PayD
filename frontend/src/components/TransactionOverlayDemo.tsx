import { Button, Heading, Text } from '@stellar/design-system';
import { useTransactionNotifications } from '../hooks/useTransactionNotifications';
import { Play, CheckCircle, XCircle } from 'lucide-react';

/**
 * Demo component to test the Transaction Pending Overlay
 * Add this to any route to test the notification system
 */
export function TransactionOverlayDemo() {
  const { addTransaction, updateTransaction } = useTransactionNotifications();

  const simulateTransaction = (
    type: 'payment' | 'bulk-upload' | 'cross-asset',
    finalStatus: 'confirmed' | 'failed'
  ) => {
    const txId = `demo-${Date.now()}`;

    const descriptions = {
      payment: 'Processing payroll payment to 5 employees',
      'bulk-upload': 'Uploading 50 employee records',
      'cross-asset': 'Converting USDC to XLM for payment',
    };

    // Add pending notification
    addTransaction({
      id: txId,
      type,
      status: 'pending',
      description: descriptions[type],
    });

    // Simulate processing time (2-4 seconds)
    const delay = 2000 + Math.random() * 2000;

    setTimeout(() => {
      if (finalStatus === 'confirmed') {
        updateTransaction(txId, {
          status: 'confirmed',
          hash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          description: `${descriptions[type]} - Completed successfully`,
        });
      } else {
        updateTransaction(txId, {
          status: 'failed',
          description: `${descriptions[type]} - Failed: Insufficient balance`,
        });
      }
    }, delay);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="rounded-xl border border-[var(--border-hi)] bg-[var(--surface)] p-6 mb-6">
        <Heading as="h2" size="lg" weight="bold" addlClassName="mb-2">
          Transaction Overlay Demo
        </Heading>
        <Text as="p" size="sm" addlClassName="text-[var(--muted)] mb-6">
          Test the transaction notification system with simulated transactions. Notifications will
          appear in the bottom-right corner.
        </Text>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Success Scenarios */}
          <div className="space-y-3">
            <Text as="p" size="sm" weight="bold" addlClassName="text-[var(--success)] mb-2">
              <CheckCircle className="inline h-4 w-4 mr-1" />
              Success Scenarios
            </Text>

            <Button
              variant="secondary"
              size="md"
              onClick={() => simulateTransaction('payment', 'confirmed')}
              icon={<Play className="h-4 w-4" />}
            >
              Payment Success
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={() => simulateTransaction('bulk-upload', 'confirmed')}
              icon={<Play className="h-4 w-4" />}
            >
              Bulk Upload Success
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={() => simulateTransaction('cross-asset', 'confirmed')}
              icon={<Play className="h-4 w-4" />}
            >
              Cross-Asset Success
            </Button>
          </div>

          {/* Failure Scenarios */}
          <div className="space-y-3">
            <Text as="p" size="sm" weight="bold" addlClassName="text-[var(--danger)] mb-2">
              <XCircle className="inline h-4 w-4 mr-1" />
              Failure Scenarios
            </Text>

            <Button
              variant="secondary"
              size="md"
              onClick={() => simulateTransaction('payment', 'failed')}
              icon={<Play className="h-4 w-4" />}
            >
              Payment Failure
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={() => simulateTransaction('bulk-upload', 'failed')}
              icon={<Play className="h-4 w-4" />}
            >
              Bulk Upload Failure
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={() => simulateTransaction('cross-asset', 'failed')}
              icon={<Play className="h-4 w-4" />}
            >
              Cross-Asset Failure
            </Button>
          </div>
        </div>

        {/* Multiple Transactions */}
        <div className="mt-6 pt-6 border-t border-[var(--border-hi)]">
          <Text as="p" size="sm" weight="bold" addlClassName="mb-3">
            Stress Test
          </Text>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              // Trigger 5 transactions rapidly
              setTimeout(() => simulateTransaction('payment', 'confirmed'), 0);
              setTimeout(() => simulateTransaction('bulk-upload', 'confirmed'), 500);
              setTimeout(() => simulateTransaction('cross-asset', 'failed'), 1000);
              setTimeout(() => simulateTransaction('payment', 'confirmed'), 1500);
              setTimeout(() => simulateTransaction('bulk-upload', 'failed'), 2000);
            }}
            icon={<Play className="h-4 w-4" />}
          >
            Trigger 5 Transactions
          </Button>
        </div>
      </div>

      {/* Instructions */}
      <div className="rounded-xl border border-[var(--border-hi)] bg-[var(--surface-hi)] p-6">
        <Heading as="h3" size="md" weight="bold" addlClassName="mb-3">
          What to Look For
        </Heading>
        <ul className="space-y-2 text-sm text-[var(--muted)]">
          <li className="flex items-start gap-2">
            <span className="text-[var(--accent)] mt-0.5">•</span>
            <span>Notifications appear in the bottom-right corner</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--accent)] mt-0.5">•</span>
            <span>Pending transactions show a spinner and progress bar</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--accent)] mt-0.5">•</span>
            <span>Confirmed transactions show a checkmark and explorer link</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--accent)] mt-0.5">•</span>
            <span>Failed transactions show an error icon</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--accent)] mt-0.5">•</span>
            <span>Completed transactions auto-dismiss after 5 seconds</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--accent)] mt-0.5">•</span>
            <span>Maximum 5 notifications displayed at once</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--accent)] mt-0.5">•</span>
            <span>Smooth slide-in/out animations</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
