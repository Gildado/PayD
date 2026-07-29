import { Horizon, rpc } from '@stellar/stellar-sdk';
import { getNetworkConfig, NetworkConfig } from './network.js';

let cachedServer: Horizon.Server | null = null;
let cachedConfig: NetworkConfig | null = null;
let cachedSorobanServer: rpc.Server | null = null;

/**
 * Returns a cached Horizon server instance configured for the active
 * Stellar network. The instance is created once and reused across calls.
 */
export function getStellarServer(): Horizon.Server {
  if (!cachedServer) {
    const config = getNetworkConfig();
    cachedServer = new Horizon.Server(config.horizonUrl);
    cachedConfig = config;
  }
  return cachedServer;
}

/**
 * Returns a cached Soroban RPC server instance for the active Stellar
 * network, or `null` if no Soroban RPC URL is configured (e.g. mainnet
 * without `STELLAR_SOROBAN_RPC_URL` set — see network.ts).
 */
export function getSorobanServer(): rpc.Server | null {
  const config = getActiveNetworkConfig();
  if (!config.sorobanRpcUrl) return null;
  if (!cachedSorobanServer) {
    cachedSorobanServer = new rpc.Server(config.sorobanRpcUrl);
  }
  return cachedSorobanServer;
}

/**
 * Returns the resolved network configuration (network name, passphrase,
 * and Horizon URL) for the currently active Stellar environment.
 */
export function getActiveNetworkConfig(): NetworkConfig {
  if (!cachedConfig) {
    cachedConfig = getNetworkConfig();
  }
  return cachedConfig;
}

/**
 * Clears the cached server and config so the next call to
 * `getStellarServer()` or `getActiveNetworkConfig()` re-reads
 * the environment. Useful for tests or runtime network switching.
 */
export function resetClient(): void {
  cachedServer = null;
  cachedConfig = null;
  cachedSorobanServer = null;
}
