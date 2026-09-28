import { Networks } from '@stellar/stellar-sdk';

export enum StellarNetwork {
  TESTNET = 'testnet',
  MAINNET = 'mainnet',
}

export interface NetworkConfig {
  network: StellarNetwork;
  networkPassphrase: string;
  horizonUrl: string;
  /** Soroban RPC URL for this network, or '' if none is configured/available. */
  sorobanRpcUrl: string;
  /** Comma-separated list of Soroban RPC endpoints for failover (optional). */
  sorobanRpcEndpoints: string[];
}

const NETWORK_DEFAULTS: Record<StellarNetwork, Omit<NetworkConfig, 'network'>> = {
  [StellarNetwork.TESTNET]: {
    networkPassphrase: Networks.TESTNET,
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    sorobanRpcEndpoints: ['https://soroban-testnet.stellar.org'],
  },
  [StellarNetwork.MAINNET]: {
    networkPassphrase: Networks.PUBLIC,
    horizonUrl: 'https://horizon.stellar.org',
    // There is no free, universally-available public Soroban RPC endpoint for
    // mainnet — operators must set STELLAR_SOROBAN_RPC_URL to their provider
    // (e.g. a self-hosted node or a paid RPC provider). Left blank so health
    // checks correctly report "not_configured" instead of guessing a URL.
    sorobanRpcUrl: '',
    sorobanRpcEndpoints: [],
  },
};

/**
 * Resolves the active Stellar network configuration from environment
 * variables with sensible defaults for testnet development.
 *
 * Environment variables:
 *   STELLAR_NETWORK                - "testnet" | "mainnet" (default: "testnet")
 *   STELLAR_NETWORK_PASSPHRASE     - Override the default passphrase
 *   STELLAR_HORIZON_URL            - Override the default Horizon URL
 *   STELLAR_SOROBAN_RPC_URL        - Override the default Soroban RPC URL (primary endpoint)
 *   STELLAR_SOROBAN_RPC_ENDPOINTS  - Comma-separated list of endpoints for failover
 */
export function getNetworkConfig(): NetworkConfig {
  const env = (process.env.STELLAR_NETWORK || 'testnet').toLowerCase();
  const network =
    env === 'mainnet' || env === 'public' ? StellarNetwork.MAINNET : StellarNetwork.TESTNET;

  const defaults = NETWORK_DEFAULTS[network];
  const sorobanRpcUrl = process.env.STELLAR_SOROBAN_RPC_URL || defaults.sorobanRpcUrl;

  let sorobanRpcEndpoints = defaults.sorobanRpcEndpoints;
  if (process.env.STELLAR_SOROBAN_RPC_ENDPOINTS) {
    sorobanRpcEndpoints = process.env.STELLAR_SOROBAN_RPC_ENDPOINTS.split(',')
      .map((url) => url.trim())
      .filter((url) => url.length > 0);
  } else if (sorobanRpcUrl) {
    sorobanRpcEndpoints = [sorobanRpcUrl];
  }

  return {
    network,
    networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || defaults.networkPassphrase,
    horizonUrl: process.env.STELLAR_HORIZON_URL || defaults.horizonUrl,
    sorobanRpcUrl,
    sorobanRpcEndpoints,
  };
}
