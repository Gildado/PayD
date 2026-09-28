import {
  Address,
  BASE_FEE,
  Contract,
  Networks,
  rpc,
  TransactionBuilder,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { simulateTransaction } from './transactionSimulation';

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000';
const DEFAULT_RPC_URL =
  (import.meta.env.PUBLIC_STELLAR_RPC_URL as string | undefined) ||
  'https://soroban-testnet.stellar.org';

const READ_METHOD_CANDIDATES = (
  (import.meta.env.VITE_REVENUE_SPLIT_READ_METHODS as string | undefined) ||
  'get_allocations,get_recipients,recipients'
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const UPDATE_METHOD_CANDIDATES = (
  (import.meta.env.VITE_REVENUE_SPLIT_UPDATE_METHODS as string | undefined) ||
  'update_recipients,set_allocations'
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

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

export interface DistributionEventsOptions {
  orgPublicKey?: string;
  page?: number;
  limit?: number;
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
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function safeString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function payrollAuthHeaders(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {};
  const token = localStorage.getItem('payd_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function resolveOrgPublicKey(explicit?: string): string | null {
  if (explicit) return explicit;
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

function allocationToPercent(raw: unknown): number {
  const numeric = toNumber(raw);
  if (numeric > 100) return numeric / 100;
  return numeric;
}

function normalizeAllocationsFromNative(nativeValue: unknown): RevenueAllocation[] {
  if (!Array.isArray(nativeValue)) return [];

  return nativeValue
    .map((entry) => {
      if (Array.isArray(entry)) {
        const values = entry as unknown[];
        return {
          recipient: safeString(values[0]),
          percentage: allocationToPercent(values[1]),
        };
      }

      if (entry && typeof entry === 'object') {
        const item = entry as Record<string, unknown>;
        return {
          recipient: safeString(item.recipient ?? item.address ?? item.destination),
          percentage: allocationToPercent(
            item.percentage ?? item.weight ?? item.share ?? item.basis_points
          ),
        };
      }

      return { recipient: '', percentage: 0 };
    })
    .filter((entry) => entry.recipient);
}

async function simulateReadCall<T>(
  contractId: string,
  sourceAddress: string,
  method: string,
  rpcUrlOverride?: string
): Promise<T> {
  const rpcUrl = normalizeBaseUrl(rpcUrlOverride || DEFAULT_RPC_URL);
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  const account = await server.getAccount(sourceAddress);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call(method))
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

function buildRecipientSharesScVal(allocations: RevenueAllocation[]): xdr.ScVal {
  const entries = allocations.map((entry) => {
    const basisPoints = Math.round(entry.percentage * 100);

    return xdr.ScVal.scvMap([
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('destination'),
        val: Address.fromString(entry.recipient).toScVal(),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('basis_points'),
        val: xdr.ScVal.scvU32(basisPoints),
      }),
    ]);
  });

  return xdr.ScVal.scvVec(entries);
}

export async function fetchRevenueSplitAllocations(
  contractId: string,
  sourceAddress: string,
  rpcUrlOverride?: string
): Promise<RevenueAllocation[]> {
  const errors: string[] = [];

  for (const method of READ_METHOD_CANDIDATES) {
    try {
      const nativeValue = await simulateReadCall<unknown>(
        contractId,
        sourceAddress,
        method,
        rpcUrlOverride
      );
      const allocations = normalizeAllocationsFromNative(nativeValue);
      if (allocations.length > 0) {
        return allocations;
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `Read failed for ${method}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors[errors.length - 1]);
  }

  return [];
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
  const allocationPayload = buildRecipientSharesScVal(options.allocations);

  let lastError: Error | null = null;

  for (const method of UPDATE_METHOD_CANDIDATES) {
    try {
      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: getNetworkPassphrase(),
      })
        .addOperation(contract.call(method, allocationPayload))
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
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(`Update failed for ${method}`);
    }
  }

  throw lastError || new Error('Allocation update transaction failed.');
}

export async function fetchDistributionEvents(
  options: DistributionEventsOptions = {}
): Promise<DistributionEvent[]> {
  const orgPublicKey = resolveOrgPublicKey(options.orgPublicKey);
  if (!orgPublicKey) {
    throw new Error('Organization public key is unavailable for audit history.');
  }

  const page = options.page ?? 1;
  const limit = options.limit ?? 30;
  const response = await fetch(
    `${normalizeBaseUrl(API_BASE_URL)}/api/v1/payroll/audit?orgPublicKey=${encodeURIComponent(orgPublicKey)}&page=${page}&limit=${limit}`,
    { headers: payrollAuthHeaders() }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch distribution events (${response.status})`);
  }

  const payload = (await response.json()) as {
    success: boolean;
    data?: Array<Record<string, unknown>> | { data?: Array<Record<string, unknown>> };
  };

  const rawEvents = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.data?.data)
      ? payload.data.data
      : [];

  return rawEvents.map((event) => ({
    id: Number(event.id ?? 0),
    createdAt: safeString(event.created_at ?? event.timestamp),
    txHash: safeString(event.tx_hash) || null,
    amount: toNumber(event.amount),
    assetCode: safeString(event.asset_code ?? 'USDC') || 'USDC',
    action: safeString(event.action ?? event.category ?? 'distribution'),
    recipientLabel:
      `${safeString(event.employee_first_name)} ${safeString(event.employee_last_name)}`.trim() ||
      safeString(event.employee_email) ||
      safeString(event.recipient) ||
      'Unknown recipient',
  }));
}
