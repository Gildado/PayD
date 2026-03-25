import { useState } from 'react';
import { StrKey } from '@stellar/stellar-sdk';
import { CSVUploader, CSVRow } from '../components/CSVUploader';
import { Button, Card } from '@stellar/design-system';

const REQUIRED_COLUMNS = ['name', 'wallet_address', 'amount', 'currency'];

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

export default function BulkPayrollUpload() {
  const [parsedRows, setParsedRows] = useState<CSVRow[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const validRows = parsedRows.filter((r) => r.isValid);
  const invalidRows = parsedRows.filter((r) => !r.isValid);

  const handleSubmit = () => {
    if (validRows.length === 0) return;
    // In production this would POST validRows to the backend payroll API
    console.log('Submitting payroll batch:', validRows.map((r) => r.data));
    setSubmitted(true);
  };

  const handleReset = () => {
    setParsedRows([]);
    setSubmitted(false);
  };

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
            <Button variant="secondary" size="md" onClick={handleReset}>
              Upload Another File
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Bulk Payroll Upload</h1>
        <p className="text-gray-600">
          Upload a CSV file to process multiple payroll payments at once. Required columns:{' '}
          <code className="bg-gray-100 px-1 rounded text-sm">{REQUIRED_COLUMNS.join(', ')}</code>
        </p>
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
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 space-x-4">
            <span className="text-green-700 font-medium">{validRows.length} valid</span>
            {invalidRows.length > 0 && (
              <span className="text-red-600 font-medium">{invalidRows.length} with errors</span>
            )}
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            disabled={validRows.length === 0}
          >
            Submit {validRows.length} Payment{validRows.length !== 1 ? 's' : ''}
          </Button>
        </div>
      )}
    </div>
  );
}
