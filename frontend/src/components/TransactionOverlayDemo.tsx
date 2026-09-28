import { Button, Heading, Text } from '@stellar/design-system';
import { useTranslation } from 'react-i18next';
import { useTransactionNotifications } from '../hooks/useTransactionNotifications';
import { Play, CheckCircle, XCircle } from 'lucide-react';

/**
 * Demo component to test the Transaction Pending Overlay
 * Add this to any route to test the notification system
 */
export function TransactionOverlayDemo() {
  const { t } = useTranslation();
  const { addTransaction, updateTransaction } = useTransactionNotifications();

  const simulateTransaction = (
    type: 'payment' | 'bulk-upload' | 'cross-asset',
    finalStatus: 'confirmed' | 'failed'
  ) => {
    const txId = `demo-${Date.now()}`;

    const descriptions = {
      payment: t('transactionDemo.descriptionPayment'),
      'bulk-upload': t('transactionDemo.descriptionBulkUpload'),
      'cross-asset': t('transactionDemo.descriptionCrossAsset'),
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
          description: t('transactionDemo.completedSuccessfully', {
            description: descriptions[type],
          }),
        });
      } else {
        updateTransaction(txId, {
          status: 'failed',
          description: t('transactionDemo.failedInsufficientBalance', {
            description: descriptions[type],
          }),
        });
      }
    }, delay);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="rounded-xl border border-[var(--border-hi)] bg-[var(--surface)] p-6 mb-6">
        <Heading as="h2" size="lg" weight="bold" addlClassName="mb-2">
          {t('transactionDemo.title')}
        </Heading>
        <Text as="p" size="sm" addlClassName="text-[var(--muted)] mb-6">
          {t('transactionDemo.subtitle')}
        </Text>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Success Scenarios */}
          <div className="space-y-3">
            <Text as="p" size="sm" weight="bold" addlClassName="text-[var(--success)] mb-2">
              <CheckCircle className="inline h-4 w-4 mr-1" />
              {t('transactionDemo.successScenarios')}
            </Text>

            <Button
              variant="secondary"
              size="md"
              onClick={() => simulateTransaction('payment', 'confirmed')}
              icon={<Play className="h-4 w-4" />}
            >
              {t('transactionDemo.paymentSuccess')}
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={() => simulateTransaction('bulk-upload', 'confirmed')}
              icon={<Play className="h-4 w-4" />}
            >
              {t('transactionDemo.bulkUploadSuccess')}
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={() => simulateTransaction('cross-asset', 'confirmed')}
              icon={<Play className="h-4 w-4" />}
            >
              {t('transactionDemo.crossAssetSuccess')}
            </Button>
          </div>

          {/* Failure Scenarios */}
          <div className="space-y-3">
            <Text as="p" size="sm" weight="bold" addlClassName="text-[var(--danger)] mb-2">
              <XCircle className="inline h-4 w-4 mr-1" />
              {t('transactionDemo.failureScenarios')}
            </Text>

            <Button
              variant="secondary"
              size="md"
              onClick={() => simulateTransaction('payment', 'failed')}
              icon={<Play className="h-4 w-4" />}
            >
              {t('transactionDemo.paymentFailure')}
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={() => simulateTransaction('bulk-upload', 'failed')}
              icon={<Play className="h-4 w-4" />}
            >
              {t('transactionDemo.bulkUploadFailure')}
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={() => simulateTransaction('cross-asset', 'failed')}
              icon={<Play className="h-4 w-4" />}
            >
              {t('transactionDemo.crossAssetFailure')}
            </Button>
          </div>
        </div>

        {/* Multiple Transactions */}
        <div className="mt-6 pt-6 border-t border-[var(--border-hi)]">
          <Text as="p" size="sm" weight="bold" addlClassName="mb-3">
            {t('transactionDemo.stressTest')}
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
            {t('transactionDemo.trigger5Transactions')}
          </Button>
        </div>
      </div>

      {/* Instructions */}
      <div className="rounded-xl border border-[var(--border-hi)] bg-[var(--surface-hi)] p-6">
        <Heading as="h3" size="md" weight="bold" addlClassName="mb-3">
          {t('transactionDemo.whatToLookFor')}
        </Heading>
        <ul className="space-y-2 text-sm text-[var(--muted)]">
          <li className="flex items-start gap-2">
            <span className="text-[var(--accent)] mt-0.5">•</span>
            <span>{t('transactionDemo.hintBottomRight')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--accent)] mt-0.5">•</span>
            <span>{t('transactionDemo.hintPendingSpinner')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--accent)] mt-0.5">•</span>
            <span>{t('transactionDemo.hintConfirmedCheckmark')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--accent)] mt-0.5">•</span>
            <span>{t('transactionDemo.hintFailedIcon')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--accent)] mt-0.5">•</span>
            <span>{t('transactionDemo.hintAutoDismiss')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--accent)] mt-0.5">•</span>
            <span>{t('transactionDemo.hintMaxFive')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--accent)] mt-0.5">•</span>
            <span>{t('transactionDemo.hintSmoothAnimations')}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
