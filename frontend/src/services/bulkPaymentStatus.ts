import {
  BASE_FEE,
  Contract,
  Networks,
  rpc,
  TransactionBuilder,
  nativeToScVal,
} from '@stellar/stellar-sdk';
import { simulateTransaction } from './transactionSimulation';

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000';
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

interface PayrollRunsListResponse {
  success: boolean;
  data: {
    data: PayrollRunRecord[];
    total: number;
  };
}

interface PayrollRunSummaryResponse {
  success: boolean;
  data: PayrollRunSummary;
}

export interface RetryInvocationOptions {
  contractId: string;
  batchId: string;
  sourceAddress: string;
  signTransaction: (xdr: string) => Promise<string>;
  rpcUrl?: string;
}

function getNetworkPassphrase(): string {
  const network = (import.meta.env.PUBLIC_STELLAR_NETWORK as string | undefined)?.toUpperCase();
  return network === 'MAINNET' ? Networks.PUBLIC : Networks.TESTNET;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

export async function fetchPayrollRuns(
  organizationId: number,
  page = 1,
  limit = 20
): Promise<{ data: PayrollRunRecord[]; total: number }> {
  const response = await fetch(
    `${normalizeBaseUrl(API_BASE_URL)}/api/v1/payroll-bonus/runs?organizationId=${organizationId}&page=${page}&limit=${limit}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch payroll runs (${response.status})`);
  }

  const payload = (await response.json()) as PayrollRunsListResponse;
  return payload.data;
}

export async function fetchPayrollRunSummary(runId: number): Promise<PayrollRunSummary> {
  const response = await fetch(
    `${normalizeBaseUrl(API_BASE_URL)}/api/v1/payroll-bonus/runs/${runId}`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch payroll run summary (${response.status})`);
  }

  const payload = (await response.json()) as PayrollRunSummaryResponse;
  return payload.data;
}

export function getTxExplorerUrl(
  txHash: string,
  network: 'testnet' | 'public' = 'testnet'
): string {
  return `https://stellar.expert/explorer/${network}/tx/${txHash}`;
}

export async function retryFailedBatch(
  options: RetryInvocationOptions
): Promise<{ txHash: string }> {
  const rpcUrl = normalizeBaseUrl(options.rpcUrl || DEFAULT_RPC_URL);
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  const account = await server.getAccount(options.sourceAddress);
  const contract = new Contract(options.contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call('retry_failed_batch', nativeToScVal(options.batchId)))
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
