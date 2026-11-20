import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

interface CorrelationStore {
  correlationId: string;
  /** Optional — links this unit of work back to an HTTP request. */
  requestId?: string;
}

const correlationStorage = new AsyncLocalStorage<CorrelationStore>();

export const getCorrelationId = (): string | undefined =>
  correlationStorage.getStore()?.correlationId;

export const getCorrelationStore = (): CorrelationStore | undefined =>
  correlationStorage.getStore();

/**
 * Run `fn` inside an async context that carries `correlationId`.
 * All logger calls made within `fn` (and any async code it spawns)
 * will automatically include the correlation ID.
 */
export function withCorrelationId<T>(
  correlationId: string,
  fn: () => T,
  requestId?: string,
): T {
  return correlationStorage.run({ correlationId, requestId }, fn);
}

/**
 * Generate a fresh correlation ID.
 * Use when no upstream ID is available (e.g. background jobs, cron tasks).
 */
export const generateCorrelationId = (): string => randomUUID();
