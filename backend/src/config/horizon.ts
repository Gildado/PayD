import { Horizon, Networks } from '@stellar/stellar-sdk';
import logger from '../utils/logger.js';

export type StellarNetwork = 'testnet' | 'mainnet';

export interface HorizonConfig {
  network: StellarNetwork;
  horizonUrl: string;
  networkPassphrase: string;
  maxRetries: number;
  retryDelayMs: number;
  retryDelayMaxMs: number;
}

const NETWORK_CONFIGS: Record<StellarNetwork, { url: string; passphrase: string }> = {
  testnet: {
    url: 'https://horizon-testnet.stellar.org',
    passphrase: Networks.TESTNET,
  },
  mainnet: {
    url: 'https://horizon.stellar.org',
    passphrase: Networks.PUBLIC,
  },
};

function getNetwork(): StellarNetwork {
  const env = process.env.STELLAR_NETWORK?.toLowerCase();
  if (env === 'mainnet' || env === 'public') return 'mainnet';
  return 'testnet';
}

export function getHorizonConfig(): HorizonConfig {
  const network = getNetwork();
  const defaults = NETWORK_CONFIGS[network];

  return {
    network,
    horizonUrl: process.env.STELLAR_HORIZON_URL || defaults.url,
    networkPassphrase: defaults.passphrase,
    maxRetries: parseInt(process.env.STELLAR_MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.STELLAR_RETRY_DELAY_MS || '1000', 10),
    retryDelayMaxMs: parseInt(process.env.STELLAR_RETRY_DELAY_MAX_MS || '10000', 10),
  };
}

export function createHorizonServer(config?: HorizonConfig): Horizon.Server {
  const cfg = config || getHorizonConfig();
  logger.info(`Initializing Horizon client: ${cfg.network} (${cfg.horizonUrl})`);
  return new Horizon.Server(cfg.horizonUrl);
}

export async function checkHorizonHealth(server: Horizon.Server): Promise<{
  healthy: boolean;
  network: StellarNetwork;
  horizonUrl: string;
  latestLedger?: number;
  error?: string;
}> {
  const config = getHorizonConfig();

  try {
    const root = await server.root();
    return {
      healthy: true,
      network: config.network,
      horizonUrl: config.horizonUrl,
      latestLedger: root.history_latest_ledger,
    };
  } catch (error: any) {
    return {
      healthy: false,
      network: config.network,
      horizonUrl: config.horizonUrl,
      error: error.message,
    };
  }
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: { maxRetries?: number; delayMs?: number; maxDelayMs?: number }
): Promise<T> {
  const config = getHorizonConfig();
  const maxRetries = options?.maxRetries ?? config.maxRetries;
  const baseDelay = options?.delayMs ?? config.retryDelayMs;
  const maxDelay = options?.maxDelayMs ?? config.retryDelayMaxMs;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      const status = error?.response?.status;
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw error;
      }

      if (attempt === maxRetries) break;

      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      logger.warn(
        `Horizon request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms: ${error.message}`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Retry failed with unknown error');
}
