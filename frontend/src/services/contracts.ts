/**
 * Contract Service
 * Fetches and caches contract registry data from the backend API
 *
 * Migration Guide:
 * This service replaces hardcoded contract addresses with dynamic fetching from the backend.
 * To migrate from hardcoded addresses:
 * 1. Initialize the service: await contractService.initialize()
 * 2. Get contract IDs: contractService.getContractId('bulk_payment', 'testnet')
 * 3. The service handles caching and retry logic automatically
 */

import axios, { AxiosError } from 'axios';
import { ContractRegistry, ContractType, NetworkType } from './contracts.types';

class ContractService {
  private cache: ContractRegistry | null = null;
  private lastFetch: number | null = null;
  private readonly CACHE_TTL = 3600000; // 1 hour in milliseconds
  private readonly API_BASE_URL =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:3000';
  private readonly MAX_RETRIES = 3;

  /**
   * Initialize the service by fetching the contract registry
   */
  async initialize(): Promise<void> {
    await this.fetchRegistry();
  }

  /**
   * Fetch contract registry from the backend API with retry logic
   */
  async fetchRegistry(): Promise<ContractRegistry> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const response = await axios.get<ContractRegistry>(`${this.API_BASE_URL}/api/contracts`);

        // Update cache
        this.cache = response.data;
        this.lastFetch = Date.now();

        console.info(`Contract registry fetched successfully (${response.data.count} contracts)`);
        return response.data;
      } catch (error) {
        lastError = error as Error;

        if (attempt === this.MAX_RETRIES) {
          const errorMessage =
            error instanceof AxiosError
              ? `HTTP ${error.response?.status}: ${error.message}`
              : (error as Error).message;

          console.error(
            `Failed to fetch contract registry after ${this.MAX_RETRIES} attempts:`,
            errorMessage
          );
          throw new Error(
            `Failed to fetch contracts after ${this.MAX_RETRIES} attempts: ${errorMessage}`
          );
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.warn(`Fetch attempt ${attempt} failed, retrying in ${delay}ms...`);
        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Failed to fetch contract registry');
  }

  /**
   * Check if the cache is still valid
   */
  isCacheValid(): boolean {
    if (!this.cache || !this.lastFetch) {
      return false;
    }

    const age = Date.now() - this.lastFetch;
    return age < this.CACHE_TTL;
  }

  /**
   * Get a contract ID by type and network
   * Auto-refreshes cache if expired
   */
  getContractId(contractType: ContractType, network: NetworkType): string | null {
    // Auto-refresh if cache is stale
    if (!this.isCacheValid()) {
      console.info('Cache expired, refreshing...');
      // Fire and forget - don't block on refresh
      this.fetchRegistry().catch((err) => {
        console.error('Failed to refresh cache:', err);
      });
    }

    if (!this.cache) {
      console.warn('Contract registry not initialized. Call initialize() first.');
      return null;
    }

    const contract = this.cache.contracts.find(
      (c) => c.contractType === contractType && c.network === network
    );

    return contract?.contractId || null;
  }

  /**
   * Manually refresh the contract registry
   */
  async refreshRegistry(): Promise<void> {
    this.cache = null;
    this.lastFetch = null;
    await this.fetchRegistry();
  }

  /**
   * Get all contracts from cache
   */
  getAllContracts(): ContractRegistry | null {
    return this.cache;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const contractService = new ContractService();
