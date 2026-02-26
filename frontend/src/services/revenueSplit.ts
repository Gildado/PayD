/* eslint-disable
  @typescript-eslint/no-unsafe-assignment,
  @typescript-eslint/no-unsafe-call,
  @typescript-eslint/no-unsafe-member-access,
  @typescript-eslint/no-unsafe-argument,
  @typescript-eslint/no-base-to-string
*/
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

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000';
const DEFAULT_RPC_URL =
  (import.meta.env.PUBLIC_STELLAR_RPC_URL as string | undefined) ||
  'https://soroban-testnet.stellar.org';

const GET_ALLOCATIONS_METHOD =
  (import.meta.env.VITE_REVENUE_SPLIT_GET_ALLOCATIONS_METHOD as string | undefined) ||
  'get_allocations';
const UPDATE_ALLOCATIONS_METHOD =
  (import.meta.env.VITE_REVENUE_SPLIT_UPDATE_ALLOCATIONS_METHOD as string | undefined) ||
  'set_allocations';

export interface RevenueAllocation {
  recipient: string;
  percentage: number;
}

export interface DistributionEvent {
  id: number;
  createdAt: string;
  txHash: string | null;
  amount: number;
  assetCode: string;
  action: string;
  recipientLabel: string;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function getNetworkPassphrase(): string {
  const network = (import.meta.env.PUBLIC_STELLAR_NETWORK as string | undefined)?.toUpperCase();
  return network === 'MAINNET' ? Networks.PUBLIC : Networks.TESTNET;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeAllocationsFromNative(nativeValue: unknown): RevenueAllocation[] {
  if (!Array.isArray(nativeValue)) return [];

  return nativeValue
    .map((entry) => {
      if (Array.isArray(entry)) {
        const [recipient, percentageRaw] = entry;
        return {
          recipient: String(recipient || ''),
          percentage: toNumber(percentageRaw),
        };
      }

      if (entry && typeof entry === 'object') {
        const item = entry as Record<string, unknown>;
        return {
          recipient: String(item.recipient ?? item.address ?? ''),
          percentage: toNumber(item.percentage ?? item.weight ?? item.share),
        };
      }

      return { recipient: '', percentage: 0 };
    })
    .filter((entry) => entry.recipient);
}

export async function fetchRevenueSplitAllocations(
  contractId: string,
  sourceAddress: string,
  rpcUrlOverride?: string
): Promise<RevenueAllocation[]> {
  const rpcUrl = normalizeBaseUrl(rpcUrlOverride || DEFAULT_RPC_URL);
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  const account = await server.getAccount(sourceAddress);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call(GET_ALLOCATIONS_METHOD))
    .setTimeout(60)
    .build();

  const rpcResponse = await fetch(rpcUrl, {
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
    throw new Error(`Failed to simulate allocation read (${rpcResponse.status})`);
  }

  const payload = (await rpcResponse.json()) as {
    result?: { retval?: string; error?: string };
    error?: { message?: string };
  };

  if (payload.error?.message) {
    throw new Error(payload.error.message);
  }

  if (!payload.result?.retval) {
    return [];
  }

  const retval = xdr.ScVal.fromXDR(payload.result.retval, 'base64');
  const nativeValue = scValToNative(retval);
  return normalizeAllocationsFromNative(nativeValue);
}

export async function updateRevenueAllocations(options: {
  contractId: string;
  sourceAddress: string;
  allocations: RevenueAllocation[];
  signTransaction: (xdr: string) => Promise<string>;
  rpcUrlOverride?: string;
}): Promise<{ txHash: string }> {
  const rpcUrl = normalizeBaseUrl(options.rpcUrlOverride || DEFAULT_RPC_URL);
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  const account = await server.getAccount(options.sourceAddress);
  const contract = new Contract(options.contractId);

  const allocationPayload = options.allocations.map((entry) => [
    entry.recipient,
    Number.parseFloat(entry.percentage.toFixed(4)),
  ]);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call(UPDATE_ALLOCATIONS_METHOD, nativeToScVal(allocationPayload)))
    .setTimeout(60)
    .build();

  const simulation = await simulateTransaction({ envelopeXdr: tx.toXDR() });
  if (!simulation.success) {
    throw new Error(simulation.description || 'Simulation failed for allocation update');
  }

  const prepared = await server.prepareTransaction(tx);
  const signedXdr = await options.signTransaction(prepared.toXDR());
  const signedTx = TransactionBuilder.fromXDR(signedXdr, getNetworkPassphrase());
  const submitted = await server.sendTransaction(signedTx);

  if (submitted.status === 'ERROR') {
    throw new Error('Allocation update transaction failed.');
  }

  return { txHash: submitted.hash };
}

export async function fetchDistributionEvents(
  organizationId: number,
  page = 1,
  limit = 30
): Promise<DistributionEvent[]> {
  const response = await fetch(
    `${normalizeBaseUrl(API_BASE_URL)}/api/v1/payroll/audit?organizationId=${organizationId}&page=${page}&limit=${limit}`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch distribution events (${response.status})`);
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: Array<Record<string, unknown>>;
  };

  return (payload.data || []).map((event) => ({
    id: Number(event.id ?? 0),
    createdAt: String(event.created_at ?? ''),
    txHash: (event.tx_hash as string | null) ?? null,
    amount: toNumber(event.amount),
    assetCode: String(event.asset_code ?? 'USDC'),
    action: String(event.action ?? 'unknown'),
    recipientLabel:
      `${String(event.employee_first_name ?? '')} ${String(event.employee_last_name ?? '')}`.trim() ||
      String(event.employee_email ?? 'Unknown recipient'),
  }));
}
