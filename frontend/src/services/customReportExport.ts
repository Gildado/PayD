const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  'http://localhost:3000';

export type PayrollExportFormat = 'csv' | 'excel' | 'pdf';

export type PayrollExportColumnId =
  | 'txHash'
  | 'employeeId'
  | 'payrollBatchId'
  | 'itemType'
  | 'amount'
  | 'assetCode'
  | 'assetIssuer'
  | 'status'
  | 'timestamp'
  | 'memo'
  | 'sourceAccount'
  | 'destAccount'
  | 'ledgerHeight'
  | 'fee'
  | 'description';

export interface PayrollExportColumn {
  id: PayrollExportColumnId;
  label: string;
  description: string;
}

export const PAYROLL_EXPORT_COLUMNS: PayrollExportColumn[] = [
  {
    id: 'txHash',
    label: 'Transaction Hash',
    description: 'Unique transaction identifier from the payroll ledger.',
  },
  {
    id: 'employeeId',
    label: 'Employee ID',
    description: 'Employee identifier resolved from the payroll memo.',
  },
  {
    id: 'payrollBatchId',
    label: 'Batch ID',
    description: 'Payroll batch grouping for the transaction.',
  },
  {
    id: 'itemType',
    label: 'Payment Type',
    description: 'Base salary or bonus payment classification.',
  },
  {
    id: 'amount',
    label: 'Amount',
    description: 'Payment amount as recorded on-chain.',
  },
  {
    id: 'assetCode',
    label: 'Asset',
    description: 'Asset code used for the transfer.',
  },
  {
    id: 'assetIssuer',
    label: 'Asset Issuer',
    description: 'Issuer of the asset, when applicable.',
  },
  {
    id: 'status',
    label: 'Status',
    description: 'Successful or failed payment status.',
  },
  {
    id: 'timestamp',
    label: 'Timestamp',
    description: 'Transaction timestamp in ISO format.',
  },
  {
    id: 'memo',
    label: 'Memo',
    description: 'Payroll memo attached to the transaction.',
  },
  {
    id: 'sourceAccount',
    label: 'Source Account',
    description: 'Organization source account.',
  },
  {
    id: 'destAccount',
    label: 'Destination Account',
    description: 'Recipient account address.',
  },
  {
    id: 'ledgerHeight',
    label: 'Ledger',
    description: 'Ledger height when the transaction landed.',
  },
  {
    id: 'fee',
    label: 'Fee',
    description: 'Fee charged for the transaction.',
  },
  {
    id: 'description',
    label: 'Description',
    description: 'Additional memo-derived description, if present.',
  },
];

export const PAYROLL_EXPORT_FORMATS: Array<{
  value: PayrollExportFormat;
  label: string;
  description: string;
}> = [
  { value: 'csv', label: 'CSV', description: 'Best for spreadsheets and data tools.' },
  { value: 'excel', label: 'Excel', description: 'Best for stakeholder-friendly workbooks.' },
  { value: 'pdf', label: 'PDF', description: 'Best for read-only sharing and archiving.' },
];

export interface PayrollTransactionRecord {
  txHash: string;
  sourceAccount: string;
  destAccount?: string;
  amount?: string;
  assetCode: string;
  assetIssuer?: string;
  operationType: string;
  memo?: string;
  memoType?: string;
  timestamp: number;
  ledgerHeight: number;
  successful: boolean;
  fee: string;
  signatures: string[];
  isPayrollRelated?: boolean;
  employeeId?: string;
  payrollBatchId?: string;
  period?: string;
  itemType?: 'base' | 'bonus';
  description?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  pageCount: number;
}

export interface PayrollPreviewResponse {
  success: boolean;
  data: PaginatedResult<PayrollTransactionRecord>;
}

export interface CustomPayrollExportOptions {
  organizationPublicKey: string;
  startDate?: string;
  endDate?: string;
  format: PayrollExportFormat;
  columns: PayrollExportColumnId[];
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function payrollAuthHeaders(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {};
  const token = localStorage.getItem('payd_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function resolveOrganizationPublicKey(): string | null {
  if (typeof localStorage === 'undefined') {
    return (import.meta.env.VITE_ORG_PUBLIC_KEY as string | undefined) || null;
  }

  return (
    localStorage.getItem('orgPublicKey') ||
    localStorage.getItem('organizationPublicKey') ||
    (import.meta.env.VITE_ORG_PUBLIC_KEY as string | undefined) ||
    null
  );
}

export function saveOrganizationPublicKey(publicKey: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem('orgPublicKey', publicKey);
  localStorage.setItem('organizationPublicKey', publicKey);
}

export async function fetchPayrollPreview(options: {
  organizationPublicKey: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<PayrollTransactionRecord>> {
  const url = new URL(`${normalizeBaseUrl(API_BASE_URL)}/api/payroll/transactions`);
  url.searchParams.set('orgPublicKey', options.organizationPublicKey);
  url.searchParams.set('page', String(options.page ?? 1));
  url.searchParams.set('limit', String(options.limit ?? 50));
  url.searchParams.set('sortBy', 'timestamp');
  url.searchParams.set('sortOrder', 'desc');

  if (options.startDate) {
    url.searchParams.set('startDate', options.startDate);
  }
  if (options.endDate) {
    url.searchParams.set('endDate', options.endDate);
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Content-Type': 'application/json',
      ...payrollAuthHeaders(),
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Failed to load payroll preview (${response.status})`);
  }

  const payload = (await response.json()) as PayrollPreviewResponse;
  if (!payload.success) {
    throw new Error('Payroll preview request failed');
  }

  return payload.data;
}

function parseFilename(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) return fallback;
  const match = contentDisposition.match(/filename="([^"]+)"/i);
  return match?.[1] || fallback;
}

export async function exportCustomPayrollReport(
  options: CustomPayrollExportOptions
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${normalizeBaseUrl(API_BASE_URL)}/api/v1/exports/payroll/custom`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...payrollAuthHeaders(),
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as { error?: string; message?: string };
      throw new Error(payload.error || payload.message || `Export failed (${response.status})`);
    }

    const detail = await response.text();
    throw new Error(detail || `Export failed (${response.status})`);
  }

  const blob = await response.blob();
  const fallbackFilename = `payroll-custom.${options.format === 'excel' ? 'xlsx' : options.format}`;
  const filename = parseFilename(response.headers.get('content-disposition'), fallbackFilename);

  return { blob, filename };
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
