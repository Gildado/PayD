import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StrKey } from '@stellar/stellar-sdk';
import { CSVUploader, CSVRow } from '../components/CSVUploader';
import { Button, Card } from '@stellar/design-system';
import { IssuerMultisigBanner } from '../components/IssuerMultisigBanner';
import { SUPPORTED_ASSETS } from '../config/assets';

const REQUIRED_COLUMNS = ['name', 'wallet_address', 'amount', 'currency'];

const SUPPORTED_CURRENCY_CODES = SUPPORTED_ASSETS.map((a) => a.code);

export default function BulkPayrollUpload() {
  const { t } = useTranslation();
  const [parsedRows, setParsedRows] = useState<CSVRow[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validators = useMemo<Record<string, (value: string) => string | null>>(
    () => ({
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
        if (!SUPPORTED_CURRENCY_CODES.includes(value.toUpperCase())) {
          const supportedLabels = SUPPORTED_CURRENCY_CODES.map(
            (code) => `${code} (${t(`assets.${code}`, code)})`
          ).join(', ');
          return `Currency must be one of: ${supportedLabels}`;
        }
        return null;
      },
    }),
    [t]
  );

  const validRows = parsedRows.filter((r) => r.isValid);
  const invalidRows = parsedRows.filter((r) => !r.isValid);

  const handleSubmit = async () => {
    if (validRows.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      // In production this would POST validRows to the backend payroll API
      await Promise.resolve(
        console.log(
          'Submitting payroll batch:',
          validRows.map((r) => r.data)
        )
      );
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setParsedRows([]);
    setSubmitted(false);
    setIsSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="flex w-full flex-1 flex-col items-center justify-start px-4 py-6 sm:px-6 lg:px-8">
        <div className="w-full max-w-2xl">
          <Card>
            <div className="p-8 text-center space-y-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-[rgba(74,240,184,0.1)] border-2 border-[var(--accent)] flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-[var(--accent)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-black text-[var(--text)] mb-2">
                  Payroll Batch Submitted
                </h2>
                <p className="text-[var(--muted)] text-base">
                  {validRows.length} payment{validRows.length !== 1 ? 's' : ''} queued for
                  processing on the Stellar network.
                </p>
              </div>
              <div className="pt-4">
                <Button variant="secondary" size="md" onClick={handleReset}>
                  Upload Another File
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-start px-4 py-6 sm:px-6 lg:px-8">
      <div className="w-full max-w-5xl space-y-6">
        <div className="card glass noise border-[var(--border-hi)] p-6 sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
            Bulk Operations
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-[var(--text)]">
            CSV Upload <span className="text-[var(--accent)]">& Validation</span>
          </h1>
          <p className="mt-3 text-sm sm:text-base leading-6 text-[var(--muted)] max-w-3xl">
            Upload a CSV file to process multiple payroll payments at once. The system validates
            each row and provides a preview before submission.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-xs text-[var(--muted)]">Required columns:</span>
            {REQUIRED_COLUMNS.map((col) => (
              <code
                key={col}
                className="text-xs bg-[var(--surface-hi)] px-2 py-1 rounded border border-[var(--border)] text-[var(--accent)] font-mono"
              >
                {col}
              </code>
            ))}
          </div>
          <IssuerMultisigBanner />
        </div>

        <Card>
          <div className="p-6">
            <CSVUploader
              requiredColumns={REQUIRED_COLUMNS}
              validators={validators}
              onDataParsed={setParsedRows}
            />
          </div>
        </Card>

        {parsedRows.length > 0 && (
          <div className="card border-[var(--border-hi)] bg-[var(--surface)]/95 p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[var(--success)]" />
                  <span className="text-sm font-semibold text-[var(--text)]">
                    {validRows.length} valid row{validRows.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {invalidRows.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[var(--danger)]" />
                    <span className="text-sm font-semibold text-[var(--danger)]">
                      {invalidRows.length} with error{invalidRows.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  void handleSubmit();
                }}
                disabled={validRows.length === 0 || isSubmitting}
                aria-label={
                  isSubmitting
                    ? 'Submitting payroll batch…'
                    : `Submit ${validRows.length} payment${validRows.length !== 1 ? 's' : ''}`
                }
                aria-busy={isSubmitting}
              >
                {isSubmitting
                  ? 'Submitting…'
                  : `Submit ${validRows.length} Payment${validRows.length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
