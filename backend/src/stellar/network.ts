import { Networks } from '@stellar/stellar-sdk';

export enum StellarNetwork {
  TESTNET = 'testnet',
  MAINNET = 'mainnet',
}

export interface NetworkConfig {
  network: StellarNetwork;
  networkPassphrase: string;
  horizonUrl: string;
}

const NETWORK_DEFAULTS: Record<StellarNetwork, Omit<NetworkConfig, 'network'>> = {
  [StellarNetwork.TESTNET]: {
    networkPassphrase: Networks.TESTNET,
    horizonUrl: 'https://horizon-testnet.stellar.org',
  },
  [StellarNetwork.MAINNET]: {
    networkPassphrase: Networks.PUBLIC,
    horizonUrl: 'https://horizon.stellar.org',
  },
};

/**
 * Resolves the active Stellar network configuration from environment
 * variables with sensible defaults for testnet development.
 *
 * Environment variables:
 *   STELLAR_NETWORK           - "testnet" | "mainnet" (default: "testnet")
 *   STELLAR_NETWORK_PASSPHRASE - Override the default passphrase
 *   STELLAR_HORIZON_URL        - Override the default Horizon URL
 */
export function getNetworkConfig(): NetworkConfig {
  const env = (process.env.STELLAR_NETWORK || 'testnet').toLowerCase();
  const network =
    env === 'mainnet' || env === 'public' ? StellarNetwork.MAINNET : StellarNetwork.TESTNET;

  const defaults = NETWORK_DEFAULTS[network];

  return {
    network,
    networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || defaults.networkPassphrase,
    horizonUrl: process.env.STELLAR_HORIZON_URL || defaults.horizonUrl,
  };
}
