import { useCallback, useEffect, useRef, useState } from 'react';
import { contractService } from '../services/contracts';
import type { NetworkType } from '../services/contracts.types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ContractMetric {
  label: string;
  value: string | number;
  unit?: string;
  status: 'ok' | 'warn' | 'error' | 'loading';
}

export interface ContractMetrics {
  bulk_payment: {
    batchCount: ContractMetric;
    isPaused: ContractMetric;
    sequence: ContractMetric;
  };
  revenue_split: {
    distributionCount: ContractMetric;
    isPaused: ContractMetric;
    totalDistributed: ContractMetric;
  };
  vesting_escrow: {
    vestedAmount: ContractMetric;
    claimableAmount: ContractMetric;
    isActive: ContractMetric;
  };
  cross_asset_payment: {
    paymentCount: ContractMetric;
    pendingAdmin: ContractMetric;
  };
  lastRefreshed: Date | null;
}

export interface UseContractMetricsResult {
  metrics: ContractMetrics;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

function loadingMetric(label: string): ContractMetric {
  return { label, value: '—', status: 'loading' };
}

function errorMetric(label: string): ContractMetric {
  return { label, value: 'N/A', status: 'error' };
}

function buildDefaultMetrics(): ContractMetrics {
  return {
    bulk_payment: {
      batchCount: loadingMetric('Total Batches'),
      isPaused: loadingMetric('Paused'),
      sequence: loadingMetric('Sequence'),
    },
    revenue_split: {
      distributionCount: loadingMetric('Distributions'),
      isPaused: loadingMetric('Paused'),
      totalDistributed: loadingMetric('Total Distributed'),
    },
    vesting_escrow: {
      vestedAmount: loadingMetric('Vested Amount'),
      claimableAmount: loadingMetric('Claimable'),
      isActive: loadingMetric('Active'),
    },
    cross_asset_payment: {
      paymentCount: loadingMetric('Payment Count'),
      pendingAdmin: loadingMetric('Pending Admin'),
    },
    lastRefreshed: null,
  };
}

// ── Soroban RPC helpers ───────────────────────────────────────────────────────

async function simulateReadCall(
  contractId: string,
  method: string,
  sourceAccount: string,
  network: NetworkType
): Promise<unknown> {
  const { rpc, Contract, TransactionBuilder, Networks, BASE_FEE, scValToNative } = await import(
    '@stellar/stellar-sdk'
  );

  const rpcUrl =
    network === 'mainnet'
      ? 'https://soroban-rpc.stellar.org'
      : 'https://soroban-testnet.stellar.org';

  const server = new rpc.Server(rpcUrl, { allowHttp: false });
  const account = await server.getAccount(sourceAccount);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET,
  })
    .addOperation(contract.call(method))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }

  const returnVal = sim.result?.retval;
  if (!returnVal) return null;
  return scValToNative(returnVal);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Fetches aggregate read-only metrics from deployed PayD Soroban contracts.
 *
 * Uses Soroban `simulateTransaction` (no signatures required) to read contract
 * state. Falls back to placeholder error metrics when a contract is not
 * reachable or not configured.
 *
 * @param sourceAccount - A valid Stellar public key used as the read-source
 *   for transaction simulation. Does not need to sign anything.
 * @param network - Target network ('testnet' | 'mainnet').
 * @param autoRefreshMs - Optional polling interval in milliseconds.
 *   Pass `0` to disable auto-refresh (default).
 */
export function useContractMetrics(
  sourceAccount: string | null,
  network: NetworkType = 'testnet',
  autoRefreshMs = 0
): UseContractMetricsResult {
  const [metrics, setMetrics] = useState<ContractMetrics>(buildDefaultMetrics);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    if (!sourceAccount) {
      setError('No source account provided for contract metrics.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await contractService.initialize();
    } catch {
      setError('Failed to initialise contract registry.');
      setIsLoading(false);
      return;
    }

    const getContractId = (type: string) =>
      contractService.getContractId(type as never, network) ?? null;

    const safeRead = async (
      contractId: string | null,
      method: string,
      label: string
    ): Promise<ContractMetric> => {
      if (!contractId) return { label, value: 'Not configured', status: 'warn' };
      try {
        const val = await simulateReadCall(contractId, method, sourceAccount, network);
        const display =
          typeof val === 'boolean'
            ? val
              ? 'Yes'
              : 'No'
            : typeof val === 'bigint'
              ? val.toString()
              : val == null
                ? '—'
                : typeof val === 'object'
                  ? JSON.stringify(val)
                  : String(val as string | number | symbol);
        return { label, value: display, status: 'ok' };
      } catch {
        return errorMetric(label);
      }
    };

    const bulkId = getContractId('bulk_payment');
    const splitId = getContractId('revenue_split');
    const vestingId = getContractId('vesting_escrow');
    const crossId = getContractId('cross_asset_payment');

    const [
      batchCount,
      bulkPaused,
      sequence,
      distributionCount,
      splitPaused,
      vestedAmount,
      claimableAmount,
      paymentCount,
    ] = await Promise.all([
      safeRead(bulkId, 'get_batch_count', 'Total Batches'),
      safeRead(bulkId, 'is_paused', 'Paused'),
      safeRead(bulkId, 'get_sequence', 'Sequence'),
      safeRead(splitId, 'get_distribution_count', 'Distributions'),
      safeRead(splitId, 'is_paused', 'Paused'),
      safeRead(vestingId, 'get_vested_amount', 'Vested Amount'),
      safeRead(vestingId, 'get_claimable_amount', 'Claimable'),
      safeRead(crossId, 'get_payment_count', 'Payment Count'),
    ]);

    // Vesting active state derived from config
    const vestingActive: ContractMetric = vestingId
      ? await safeRead(vestingId, 'get_config', 'Active').then((m) => ({
          ...m,
          label: 'Active',
          value: m.status === 'ok' ? 'Yes' : m.value,
        }))
      : errorMetric('Active');

    // Pending admin for cross_asset_payment
    const pendingAdmin: ContractMetric = crossId
      ? await safeRead(crossId, 'get_pending_admin', 'Pending Admin').then((m) => ({
          ...m,
          value: m.value === '—' || m.value === 'null' ? 'None' : m.value,
        }))
      : errorMetric('Pending Admin');

    setMetrics({
      bulk_payment: {
        batchCount,
        isPaused: bulkPaused,
        sequence,
      },
      revenue_split: {
        distributionCount,
        isPaused: splitPaused,
        totalDistributed: { label: 'Total Distributed', value: '—', status: 'ok' },
      },
      vesting_escrow: {
        vestedAmount,
        claimableAmount,
        isActive: vestingActive,
      },
      cross_asset_payment: {
        paymentCount,
        pendingAdmin,
      },
      lastRefreshed: new Date(),
    });

    setIsLoading(false);
  }, [sourceAccount, network]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  useEffect(() => {
    if (!autoRefreshMs || autoRefreshMs <= 0) return;
    intervalRef.current = setInterval(() => void fetch(), autoRefreshMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetch, autoRefreshMs]);

  return { metrics, isLoading, error, refresh: () => void fetch() };
}
