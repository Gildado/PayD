import { getStellarServer, getSorobanServer, getActiveNetworkConfig } from './client.js';

export interface ConnectionTestResult {
  connected: boolean;
  network: string;
  horizonUrl: string;
  latencyMs: number;
  ledgerSequence?: number;
  error?: string;
}

export interface SorobanConnectionTestResult {
  configured: boolean;
  connected: boolean;
  network: string;
  rpcUrl: string;
  latencyMs: number;
  latestLedger?: number;
  error?: string;
}

/**
 * Performs a basic connectivity check against the configured Horizon
 * server by fetching fee stats. Returns network info and latency on
 * success, or an error description on failure.
 */
export async function testConnection(): Promise<ConnectionTestResult> {
  const config = getActiveNetworkConfig();
  const server = getStellarServer();
  const start = Date.now();

  try {
    const feeStats = await server.feeStats();
    const latencyMs = Date.now() - start;

    return {
      connected: true,
      network: config.network,
      horizonUrl: config.horizonUrl,
      latencyMs,
      ledgerSequence: Number(feeStats.last_ledger),
    };
  } catch (err) {
    return {
      connected: false,
      network: config.network,
      horizonUrl: config.horizonUrl,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}

/**
 * Performs a basic connectivity check against the configured Soroban RPC
 * server via its `getHealth()` method. Returns `configured: false` (rather
 * than attempting a request) when no Soroban RPC URL is resolved for the
 * active network — e.g. mainnet without `STELLAR_SOROBAN_RPC_URL` set.
 */
export async function testSorobanConnection(): Promise<SorobanConnectionTestResult> {
  const config = getActiveNetworkConfig();
  const server = getSorobanServer();

  if (!server) {
    return {
      configured: false,
      connected: false,
      network: config.network,
      rpcUrl: '',
      latencyMs: 0,
    };
  }

  const start = Date.now();
  try {
    const health = await server.getHealth();
    const latencyMs = Date.now() - start;

    return {
      configured: true,
      connected: health.status === 'healthy',
      network: config.network,
      rpcUrl: config.sorobanRpcUrl,
      latencyMs,
      latestLedger: (health as unknown as { latestLedger?: number }).latestLedger,
    };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      network: config.network,
      rpcUrl: config.sorobanRpcUrl,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}
