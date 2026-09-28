import {
  BASE_FEE,
  Contract,
  Networks,
  rpc,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { simulateTransaction } from './transactionSimulation';
import axiosInstance from '../api/axiosInstance';

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

const DEFAULT_RPC_URL =
  (import.meta.env.PUBLIC_STELLAR_RPC_URL as string | undefined) ||
  'https://soroban-testnet.stellar.org';

export interface PayrollRunRecord {
  id: number;
  batch_id: string;
  status: 'draft' | 'pending' | 'processing' | 'completed' | 'failed';
  total_amount: string;
  asset_code: string;
  created_at: string;
}

export interface PayrollRecipientStatus {
  id: number;
  employee_id: number;
  employee_first_name?: string;
  employee_last_name?: string;
  employee_email?: string;
  amount: string;
  status: 'pending' | 'completed' | 'failed';
  tx_hash?: string;
}

export interface PayrollRunSummary {
  payroll_run: PayrollRunRecord;
  items: PayrollRecipientStatus[];
  summary: {
    total_employees: number;
    total_amount: string;
  };
}

export interface OnChainPaymentStatus {
  index: number;
  recipient: string | null;
  amount: string | null;
  status: 'pending' | 'confirmed' | 'failed' | 'refunded' | 'unknown';
}

export interface OnChainBatchState {
  batchId: number;
  status: string | null;
  successCount: number;
  failCount: number;
  totalSent: string | null;
  items: OnChainPaymentStatus[];
}

interface PayrollRunSummaryResponse {
  success: boolean;
  data: PayrollRunSummary;
}

export interface RetryInvocationOptions {
  contractId: string;
  batchId: string | number;
  paymentIndex?: number;
  sourceAddress: string;
  signTransaction: (xdr: string) => Promise<string>;
  rpcUrl?: string;
}

export interface OnChainBatchStateOptions {
  contractId: string;
  batchId: string | number;
  recipientCount: number;
  sourceAddress: string;
  rpcUrl?: string;
}

function getNetworkPassphrase(): string {
  const network = (import.meta.env.PUBLIC_STELLAR_NETWORK as string | undefined)?.toUpperCase();
  return network === 'MAINNET' ? Networks.PUBLIC : Networks.TESTNET;
}

function getReadMethodName(key: 'batch' | 'payment' | 'retry'): string {
  if (key === 'batch') {
    return (
      (import.meta.env.VITE_BULK_PAYMENT_GET_BATCH_METHOD as string | undefined) || 'get_batch'
    );
  }

  if (key === 'payment') {
    return (
      (import.meta.env.VITE_BULK_PAYMENT_GET_PAYMENT_METHOD as string | undefined) ||
      'get_payment_entry'
    );
  }

  return (
    (import.meta.env.VITE_BULK_PAYMENT_RETRY_METHOD as string | undefined) || 'retry_failed_batch'
  );
}

function toBatchIdValue(batchId: string | number): string | number {
  if (typeof batchId === 'number') return batchId;

  const trimmed = batchId.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }

  const numericTail = trimmed.match(/(\d+)$/);
  if (numericTail) {
    return Number.parseInt(numericTail[1], 10);
  }

  return trimmed;
}

function parseNumeric(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function safeString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

function parseStatusValue(value: unknown): OnChainPaymentStatus['status'] {
  if (typeof value === 'number') {
    if (value === 0) return 'pending';
    if (value === 1) return 'confirmed';
    if (value === 2) return 'failed';
    if (value === 3) return 'refunded';
  }

  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (['pending', '0'].includes(normalized)) return 'pending';
    if (['sent', 'confirmed', 'completed', '1'].includes(normalized)) return 'confirmed';
    if (['failed', '2'].includes(normalized)) return 'failed';
    if (['refunded', '3'].includes(normalized)) return 'refunded';
  }

  return 'unknown';
}

function parseBatchState(nativeValue: unknown, batchId: number): Omit<OnChainBatchState, 'items'> {
  if (Array.isArray(nativeValue)) {
    const values = nativeValue as unknown[];
    const totalSent = values[2];
    const successCount = values[3];
    const failCount = values[4];
    const status = values[5];
    return {
      batchId,
      totalSent: safeString(totalSent),
      successCount: parseNumeric(successCount),
      failCount: parseNumeric(failCount),
      status: safeString(status),
    };
  }

  if (nativeValue && typeof nativeValue === 'object') {
    const record = nativeValue as Record<string, unknown>;
    return {
      batchId,
      totalSent: safeString(record.total_sent),
      successCount: parseNumeric(record.success_count),
      failCount: parseNumeric(record.fail_count),
      status: safeString(record.status),
    };
  }

  return {
    batchId,
    totalSent: null,
    successCount: 0,
    failCount: 0,
    status: null,
  };
}

function parsePaymentState(index: number, nativeValue: unknown): OnChainPaymentStatus {
  if (Array.isArray(nativeValue)) {
    const values = nativeValue as unknown[];
    const recipient = values[0];
    const amount = values[1];
    const status = values[3];
    return {
      index,
      recipient: safeString(recipient),
      amount: safeString(amount),
      status: parseStatusValue(status),
    };
  }

  if (nativeValue && typeof nativeValue === 'object') {
    const record = nativeValue as Record<string, unknown>;
    return {
      index,
      recipient: safeString(record.recipient),
      amount: safeString(record.amount),
      status: parseStatusValue(record.status),
    };
  }

  return {
    index,
    recipient: null,
    amount: null,
    status: 'unknown',
  };
}

async function simulateReadContract<T>(
  contractId: string,
  sourceAddress: string,
  method: string,
  args: Array<string | number>,
  rpcUrl?: string
): Promise<T> {
  const normalizedRpcUrl = normalizeBaseUrl(rpcUrl || DEFAULT_RPC_URL);
  const server = new rpc.Server(normalizedRpcUrl, {
    allowHttp: normalizedRpcUrl.startsWith('http://'),
  });
  const account = await server.getAccount(sourceAddress);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call(method, ...args.map((arg) => nativeToScVal(arg))))
    .setTimeout(60)
    .build();

  const rpcResponse = await fetch(normalizedRpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'simulateTransaction',
      params: { transaction: tx.toXDR() },
    }),
  });

  if (!rpcResponse.ok) {
    throw new Error(`Failed to read bulk payment state (${rpcResponse.status})`);
  }

  const payload = (await rpcResponse.json()) as {
    result?: { retval?: string };
    error?: { message?: string };
  };

  if (payload.error?.message) {
    throw new Error(payload.error.message);
  }

  if (!payload.result?.retval) {
    throw new Error(`Contract method "${method}" returned no value.`);
  }

  const retval = xdr.ScVal.fromXDR(payload.result.retval, 'base64');
  return scValToNative(retval) as T;
}

/** organizationId is ignored; runs are scoped by the signed-in employer JWT. */
export async function fetchPayrollRuns(
  _organizationId: number,
  page = 1,
  limit = 20
): Promise<{ data: PayrollRunRecord[]; total: number }> {
  const response = await axiosInstance.get<{
    success: boolean;
    data: { data: PayrollRunRecord[]; total: number };
  }>(`/api/v1/payroll-bonus/runs`, {
    params: { page, limit },
  });

  return response.data.data;
}

export async function fetchPayrollRunSummary(runId: number): Promise<PayrollRunSummary> {
  const response = await axiosInstance.get<PayrollRunSummaryResponse>(
    `/api/v1/payroll-bonus/runs/${runId}`
  );
  return response.data.data;
}

export function getTxExplorerUrl(
  txHash: string,
  network: 'testnet' | 'public' = 'testnet'
): string {
  return `https://stellar.expert/explorer/${network}/tx/${txHash}`;
}

export async function fetchPayrollRunOnChainState(
  options: OnChainBatchStateOptions
): Promise<OnChainBatchState> {
  const parsedBatchId = toBatchIdValue(options.batchId);
  if (typeof parsedBatchId !== 'number') {
    throw new Error('This batch ID cannot be mapped to an on-chain batch number.');
  }

  const batchNative = await simulateReadContract<unknown>(
    options.contractId,
    options.sourceAddress,
    getReadMethodName('batch'),
    [parsedBatchId],
    options.rpcUrl
  );

  const items = await Promise.all(
    Array.from({ length: options.recipientCount }, async (_, index) => {
      try {
        const paymentNative = await simulateReadContract<unknown>(
          options.contractId,
          options.sourceAddress,
          getReadMethodName('payment'),
          [parsedBatchId, index],
          options.rpcUrl
        );
        return parsePaymentState(index, paymentNative);
      } catch {
        return {
          index,
          recipient: null,
          amount: null,
          status: 'unknown',
        } satisfies OnChainPaymentStatus;
      }
    })
  );

  return {
    ...parseBatchState(batchNative, parsedBatchId),
    items,
  };
}

export async function retryFailedPayment(
  options: RetryInvocationOptions
): Promise<{ txHash: string }> {
  const rpcUrl = normalizeBaseUrl(options.rpcUrl || DEFAULT_RPC_URL);
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  const account = await server.getAccount(options.sourceAddress);
  const contract = new Contract(options.contractId);
  const methodName = getReadMethodName('retry');
  const parsedBatchId = toBatchIdValue(options.batchId);
  const args =
    options.paymentIndex != null && methodName !== 'retry_failed_batch'
      ? [nativeToScVal(parsedBatchId), nativeToScVal(options.paymentIndex)]
      : [nativeToScVal(parsedBatchId)];

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call(methodName, ...args))
    .setTimeout(60)
    .build();

  const simulation = await simulateTransaction({
    envelopeXdr: tx.toXDR(),
  });

  if (!simulation.success) {
    throw new Error(simulation.description || 'Simulation failed for retry transaction');
  }

  const prepared = await server.prepareTransaction(tx);
  const signedXdr = await options.signTransaction(prepared.toXDR());
  const signedTx = TransactionBuilder.fromXDR(signedXdr, getNetworkPassphrase());
  const submitted = await server.sendTransaction(signedTx);

  if (submitted.status === 'ERROR') {
    throw new Error('Retry submission failed on Soroban RPC.');
  }

  return { txHash: submitted.hash };
}

export async function executePayroll(
  runId: number | string,
  organizationId: number | string
): Promise<{ success: boolean; jobId: string }> {
  const response = await axiosInstance.post<{ success: boolean; jobId: string }>(
    `/api/v1/payroll-bonus/runs/${runId}/execute`,
    { organizationId }
  );

  return response.data;
}
