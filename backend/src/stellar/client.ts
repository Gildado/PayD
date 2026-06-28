import { Horizon } from '@stellar/stellar-sdk';
import { getNetworkConfig, NetworkConfig } from './network.js';

let cachedServer: Horizon.Server | null = null;
let cachedConfig: NetworkConfig | null = null;

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
}
