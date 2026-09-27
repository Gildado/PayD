import { rpc } from '@stellar/stellar-sdk';
import logger from '../utils/logger.js';

export interface SorobanRpcFailoverConfig {
  endpoints: string[];
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
}

export class SorobanRpcClientWithFailover {
  private endpoints: string[];
  private currentEndpointIndex: number = 0;
  private maxRetries: number;
  private initialBackoffMs: number;
  private maxBackoffMs: number;
  private clients: Map<string, rpc.Server> = new Map();
  private failureCounters: Map<string, number> = new Map();
  private lastFailureTime: Map<string, number> = new Map();

  constructor(config: SorobanRpcFailoverConfig) {
    if (!config.endpoints || config.endpoints.length === 0) {
      throw new Error('At least one Soroban RPC endpoint must be configured');
    }
    this.endpoints = config.endpoints.filter((url) => url && url.length > 0);
    this.maxRetries = config.maxRetries ?? 3;
    this.initialBackoffMs = config.initialBackoffMs ?? 100;
    this.maxBackoffMs = config.maxBackoffMs ?? 5000;

    this.endpoints.forEach((endpoint) => {
      this.failureCounters.set(endpoint, 0);
      this.lastFailureTime.set(endpoint, 0);
    });
  }

  private getClientForEndpoint(endpoint: string): rpc.Server {
    if (!this.clients.has(endpoint)) {
      this.clients.set(endpoint, new rpc.Server(endpoint));
    }
    return this.clients.get(endpoint)!;
  }

  private getCurrentClient(): rpc.Server {
    const endpoint = this.endpoints[this.currentEndpointIndex];
    return this.getClientForEndpoint(endpoint);
  }

  private getCurrentEndpoint(): string {
    return this.endpoints[this.currentEndpointIndex];
  }

  private async waitBeforeRetry(attempt: number): Promise<void> {
    const backoff = Math.min(
      this.initialBackoffMs * Math.pow(2, attempt),
      this.maxBackoffMs,
    );
    await new Promise((resolve) => setTimeout(resolve, backoff));
  }

  private recordFailure(endpoint: string): void {
    const counter = (this.failureCounters.get(endpoint) ?? 0) + 1;
    this.failureCounters.set(endpoint, counter);
    this.lastFailureTime.set(endpoint, Date.now());
    logger.warn(`Soroban RPC endpoint failed: ${endpoint} (failures: ${counter})`);
  }

  private recordSuccess(endpoint: string): void {
    this.failureCounters.set(endpoint, 0);
    logger.debug(`Soroban RPC endpoint recovered: ${endpoint}`);
  }

  private selectNextEndpoint(): void {
    this.currentEndpointIndex = (this.currentEndpointIndex + 1) % this.endpoints.length;
    logger.info(
      `Switched to Soroban RPC endpoint: ${this.getCurrentEndpoint()}`,
    );
  }

  async call<T>(
    method: (client: rpc.Server) => Promise<T>,
    operationName: string = 'soroban_rpc_call',
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const client = this.getCurrentClient();
        const endpoint = this.getCurrentEndpoint();
        const result = await method(client);
        this.recordSuccess(endpoint);
        return result;
      } catch (error) {
        const endpoint = this.getCurrentEndpoint();
        lastError = error instanceof Error ? error : new Error(String(error));
        this.recordFailure(endpoint);

        if (attempt < this.maxRetries - 1) {
          this.selectNextEndpoint();
          await this.waitBeforeRetry(attempt);
        }
      }
    }

    logger.error(
      `Soroban RPC call failed after ${this.maxRetries} attempts: ${operationName}`,
      lastError,
    );
    throw lastError ?? new Error('Soroban RPC call failed after all retries');
  }

  async getHealth(): Promise<{ isHealthy: boolean; activeEndpoint: string }> {
    try {
      const client = this.getCurrentClient();
      await client.getHealth();
      return { isHealthy: true, activeEndpoint: this.getCurrentEndpoint() };
    } catch (error) {
      logger.warn('Current Soroban RPC endpoint unhealthy, attempting failover');
      this.recordFailure(this.getCurrentEndpoint());
      this.selectNextEndpoint();

      for (let i = 1; i < this.endpoints.length; i++) {
        try {
          const client = this.getCurrentClient();
          await client.getHealth();
          return { isHealthy: true, activeEndpoint: this.getCurrentEndpoint() };
        } catch {
          this.recordFailure(this.getCurrentEndpoint());
          this.selectNextEndpoint();
        }
      }

      return { isHealthy: false, activeEndpoint: this.getCurrentEndpoint() };
    }
  }

  getActiveEndpoint(): string {
    return this.getCurrentEndpoint();
  }

  getEndpointStatus(): Record<string, { failures: number; lastFailure: number }> {
    const status: Record<string, { failures: number; lastFailure: number }> = {};
    this.endpoints.forEach((endpoint) => {
      status[endpoint] = {
        failures: this.failureCounters.get(endpoint) ?? 0,
        lastFailure: this.lastFailureTime.get(endpoint) ?? 0,
      };
    });
    return status;
  }
}

let cachedClientWithFailover: SorobanRpcClientWithFailover | null = null;

export function initializeSorobanRpcWithFailover(
  config: SorobanRpcFailoverConfig,
): SorobanRpcClientWithFailover {
  cachedClientWithFailover = new SorobanRpcClientWithFailover(config);
  return cachedClientWithFailover;
}

export function getSorobanRpcClientWithFailover(): SorobanRpcClientWithFailover | null {
  return cachedClientWithFailover;
}

export function resetSorobanRpcWithFailover(): void {
  cachedClientWithFailover = null;
}
