/**
 * Example: BulkPayrollUpload with FeeEstimationConfirmModal Integration
 *
 * This file demonstrates how to integrate the FeeEstimationConfirmModal
 * into the existing BulkPayrollUpload component.
 *
 * File: pages/BulkPayrollUpload.tsx
 */

import { useState, useCallback } from 'react';
import { StrKey } from '@stellar/stellar-sdk';
import { CSVUploader, type CSVRow } from '../components/CSVUploader';
import { FeeEstimationConfirmModal } from '../components/FeeEstimationConfirmModal';
import { Button, Card } from '@stellar/design-system';
import { useNotification } from '../hooks/useNotification';
import { useWallet } from '../hooks/useWallet';

// Type declaration for gtag (from Google Analytics)
declare const gtag:
  | ((command: string, action: string, data?: Record<string, unknown>) => void)
  | undefined;

const REQUIRED_COLUMNS = ['name', 'wallet_address', 'amount', 'currency'];

/**
 * Validators for CSV data
 */
const validators: Record<string, (value: string) => string | null> = {
  wallet_address: (value) => {
    if (!StrKey.isValidEd25519PublicKey(value)) {
      return 'Invalid Stellar wallet address';
    }
    return null;
  },
  amount: (value) => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      return 'Amount must be a positive number';
    }
    return null;
  },
  currency: (value) => {
    const supported = ['XLM', 'USDC', 'EURC'];
    if (!supported.includes(value.toUpperCase())) {
      return `Currency must be one of: ${supported.join(', ')}`;
    }
    return null;
  },
};

/**
 * BulkPayrollUpload with integrated fee estimation modal
 */
export default function BulkPayrollUpload() {
  // State management
  const [parsedRows, setParsedRows] = useState<CSVRow[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hooks
  const { notifySuccess, notifyError } = useNotification();
  const { address } = useWallet();

  // Derived state
  const validRows = parsedRows.filter((r) => r.isValid);
  const invalidRows = parsedRows.filter((r) => !r.isValid);

  // Calculate total amount
  const totalAmount = validRows.reduce((sum, row) => {
    const amount = parseFloat(row.data.amount);
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);

  // Get primary currency (from first valid row)
  const primaryCurrency = validRows[0]?.data.currency?.toUpperCase() || 'XLM';

  /**
   * Handle opening the fee estimation modal
   */
  const handleReviewPayment = useCallback(() => {
    if (validRows.length === 0) {
      notifyError('No valid payments', 'Please fix validation errors before proceeding');
      return;
    }
    setShowFeeModal(true);
  }, [validRows.length, notifyError]);

  /**
   * Handle confirming fees and submitting the batch
   */
  const handleConfirmFees = useCallback(async () => {
    if (!address) {
      notifyError('Wallet not connected', 'Please connect your wallet before proceeding');
      return;
    }

    setIsSubmitting(true);
    try {
      // Prepare payload
      const payload = {
        sender: address,
        payments: validRows.map((row) => ({
          recipient: row.data.wallet_address,
          amount: parseFloat(row.data.amount),
          currency: row.data.currency.toUpperCase(),
          name: row.data.name,
        })),
        totalAmount,
        currency: primaryCurrency,
        timestamp: new Date().toISOString(),
      };

      // Submit to backend API
      const response = await fetch('/api/payroll/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = (await response.json()) as { batchId: string; txHash?: string };

      // Success! Close modal and show confirmation
      setShowFeeModal(false);
      setSubmitted(true);

      notifySuccess('Batch submitted', `Batch ID: ${data.batchId}`);

      // Optional: Track in analytics
      if (typeof gtag !== 'undefined') {
        gtag('event', 'payroll_batch_submitted', {
          paymentCount: validRows.length,
          totalAmount,
          currency: primaryCurrency,
        });
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const msg = typeof errorMsg === 'string' ? errorMsg : 'Unknown error occurred';
      notifyError('Submission failed', msg);
      console.error('Batch submission error:', error);
      // Modal stays open, user can retry
    } finally {
      setIsSubmitting(false);
    }
  }, [address, validRows, totalAmount, primaryCurrency, notifySuccess, notifyError]);

  /**
   * Handle closing the fee modal without submitting
   */
  const handleCancelFees = useCallback(() => {
    setShowFeeModal(false);
  }, []);

  /**
   * Handle resetting the form to upload another file
   */
  const handleReset = useCallback(() => {
    setParsedRows([]);
    setSubmitted(false);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Success State
  // ─────────────────────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card>
          <div className="p-8 text-center space-y-4">
            <div className="text-5xl">✓</div>
            <h2 className="text-2xl font-bold">Payroll Batch Submitted</h2>
            <p className="text-gray-600">
              {validRows.length} payment{validRows.length !== 1 ? 's' : ''} queued for processing.
            </p>
            <p className="text-sm text-gray-500">
              You will receive updates as payments are confirmed on the network.
            </p>
            <Button variant="secondary" size="md" onClick={handleReset}>
              Upload Another File
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Main Form
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Bulk Payroll Upload</h1>
        <p className="text-gray-600">
          Upload a CSV file to process multiple payroll payments at once. Required columns:{' '}
          <code className="bg-gray-100 px-1 rounded text-sm">{REQUIRED_COLUMNS.join(', ')}</code>
        </p>
      </div>

      {/* CSV Uploader */}
      <Card>
        <div className="p-6">
          <CSVUploader
            requiredColumns={REQUIRED_COLUMNS}
            validators={validators}
            onDataParsed={setParsedRows}
          />
        </div>
      </Card>

      {/* Results Summary & Actions */}
      {parsedRows.length > 0 && (
        <>
          {/* Status Summary */}
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm space-y-1">
              <p className="text-gray-700">
                <span className="text-green-700 font-medium">{validRows.length} valid</span>
                {invalidRows.length > 0 && (
                  <>
                    {' '}
                    <span className="text-red-600 font-medium">
                      {invalidRows.length} with errors
                    </span>
                  </>
                )}
              </p>
              {validRows.length > 0 && (
                <p className="text-gray-600">
                  Total:{' '}
                  <span className="font-semibold">
                    {totalAmount} {primaryCurrency}
                  </span>
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {invalidRows.length > 0 && (
                <Button variant="secondary" size="lg" disabled>
                  {invalidRows.length} Errors - Fix before continuing
                </Button>
              )}
              <Button
                variant="primary"
                onClick={handleReviewPayment}
                disabled={validRows.length === 0 || isSubmitting}
                size="lg"
              >
                Review & Confirm Payment
              </Button>
            </div>
          </div>

          {/* Error Details */}
          {invalidRows.length > 0 && (
            <Card>
              <div className="p-4">
                <h3 className="text-lg font-semibold text-red-600 mb-3">
                  {invalidRows.length} Row{invalidRows.length !== 1 ? 's' : ''} with Errors
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {invalidRows.map((row) => (
                    <div
                      key={row.rowNumber}
                      className="text-sm text-gray-600 p-2 bg-red-50 rounded"
                    >
                      Row {row.rowNumber}: {row.errors?.join(', ') || 'Unknown error'}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Fee Estimation Modal */}
      <FeeEstimationConfirmModal
        isOpen={showFeeModal}
        paymentCount={validRows.length}
        totalAmount={totalAmount.toFixed(2)}
        currency={primaryCurrency}
        onConfirm={() => {
          void handleConfirmFees();
        }}
        onCancel={handleCancelFees}
        confirmLabel={isSubmitting ? 'Submitting...' : 'Confirm & Pay'}
        cancelLabel="Back to Upload"
      />
    </div>
  );
}
