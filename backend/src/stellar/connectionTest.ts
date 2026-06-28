import { getStellarServer, getActiveNetworkConfig } from './client.js';

export interface ConnectionTestResult {
  connected: boolean;
  network: string;
  horizonUrl: string;
  latencyMs: number;
  ledgerSequence?: number;
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
