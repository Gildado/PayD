import logger from '../utils/logger.js';
import { withRetry, RetryOptions } from '../utils/retry.js';
import { circuitBreakerService } from './circuitBreakerService.js';

export interface ConnectionRetryConfig {
  serviceName: string;
  circuitBreakerName?: string;
  retryOptions?: RetryOptions;
}

export interface ConnectionHealth {
  healthy: boolean;
  lastChecked: Date;
  lastError?: string;
  consecutiveFailures: number;
}

export class ConnectionRetryService {
  private healthMap = new Map<string, ConnectionHealth>();

  constructor() {}

  async executeWithRetry<T>(
    config: ConnectionRetryConfig,
    fn: () => Promise<T>
  ): Promise<T> {
    const { serviceName, circuitBreakerName, retryOptions } = config;

    const executeFn = async (): Promise<T> => {
      try {
        const result = await fn();
        this.recordSuccess(serviceName);
        return result;
      } catch (error) {
        this.recordFailure(serviceName, error as Error);
        throw error;
      }
    };

    if (circuitBreakerName) {
      return circuitBreakerService.execute(circuitBreakerName, () =>
        withRetry(executeFn, retryOptions)
      );
    }

    return withRetry(executeFn, retryOptions);
  }

  private recordSuccess(serviceName: string): void {
    this.healthMap.set(serviceName, {
      healthy: true,
      lastChecked: new Date(),
      consecutiveFailures: 0,
    });
  }

  private recordFailure(serviceName: string, error: Error): void {
    const current = this.healthMap.get(serviceName);
    const consecutiveFailures = (current?.consecutiveFailures ?? 0) + 1;

    this.healthMap.set(serviceName, {
      healthy: false,
      lastChecked: new Date(),
      lastError: error.message,
      consecutiveFailures,
    });

    if (consecutiveFailures >= 5) {
      logger.error(
        `[ConnectionRetryService] ${serviceName} has ${consecutiveFailures} consecutive failures`
      );
    }
  }

  getHealth(serviceName: string): ConnectionHealth | undefined {
    return this.healthMap.get(serviceName);
  }

  getAllHealth(): Map<string, ConnectionHealth> {
    return new Map(this.healthMap);
  }

  resetHealth(serviceName: string): void {
    this.healthMap.delete(serviceName);
  }
}

export const connectionRetryService = new ConnectionRetryService();
