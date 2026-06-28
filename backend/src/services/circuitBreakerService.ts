/**
 * @file src/services/circuitBreakerService.ts
 * @description Circuit-breaker implementation for resilient API & database
 *              access.  Part of the API & Database Scaling effort (Issue #256
 *              – Part 11).
 *
 * Pattern overview
 * ────────────────
 * CLOSED   → all calls pass through; failure counter increments on errors.
 * OPEN     → all calls are rejected immediately; re-check after recoveryMs.
 * HALF_OPEN → a limited probe call is allowed to test recovery; success →
 *             CLOSED, failure → OPEN again.
 *
 * Every state transition is persisted to `circuit_breaker_state` and logged
 * to `circuit_breaker_events` so operators can observe circuit health via the
 * management API.
 */

import { EventEmitter } from 'events';
import { getPool } from './dbPoolService.js';
import logger from '../utils/logger.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export type CircuitEventType =
  | 'FAILURE'
  | 'SUCCESS'
  | 'OPENED'
  | 'CLOSED'
  | 'HALF_OPENED'
  | 'RESET';

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before the circuit opens. Default: 5 */
  failureThreshold?: number;
  /** Number of consecutive successes in HALF_OPEN before closing. Default: 2 */
  successThreshold?: number;
  /** Milliseconds to wait in OPEN state before probing. Default: 30 000 */
  recoveryMs?: number;
  /** Whether to persist state changes to the DB. Default: true */
  persist?: boolean;
}

export interface CircuitSnapshot {
  name: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureAt: Date | null;
  openedAt: Date | null;
  updatedAt: Date;
}

export class CircuitOpenError extends Error {
  constructor(name: string) {
    super(`Circuit "${name}" is OPEN – request rejected`);
    this.name = 'CircuitOpenError';
  }
}

// ─── In-process circuit state ─────────────────────────────────────────────────

interface CircuitInternalState {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureAt: Date | null;
  openedAt: Date | null;
  updatedAt: Date;
  options: Required<CircuitBreakerOptions>;
}

// ─── CircuitBreakerService ─────────────────────────────────────────────────────

export class CircuitBreakerService extends EventEmitter {
  private static _instance: CircuitBreakerService | null = null;

  private circuits = new Map<string, CircuitInternalState>();

  private constructor() {
    super();
  }

  static getInstance(): CircuitBreakerService {
    if (!CircuitBreakerService._instance) {
      CircuitBreakerService._instance = new CircuitBreakerService();
    }
    return CircuitBreakerService._instance;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Register (or re-configure) a named circuit.  Must be called once at
   * application start before any `execute()` calls for that name.
   */
  register(name: string, opts: CircuitBreakerOptions = {}): void {
    if (!this.circuits.has(name)) {
      this.circuits.set(name, {
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0,
        lastFailureAt: null,
        openedAt: null,
        updatedAt: new Date(),
        options: {
          failureThreshold: opts.failureThreshold ?? 5,
          successThreshold: opts.successThreshold ?? 2,
          recoveryMs: opts.recoveryMs ?? 30_000,
          persist: opts.persist ?? true,
        },
      });
      logger.info(`[CircuitBreaker] Registered circuit "${name}"`);
    }
  }

  /**
   * Execute `fn` through the named circuit breaker.
   * Throws `CircuitOpenError` when the circuit is OPEN and not yet in recovery.
   */
  async execute<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const circuit = this._getOrRegister(name);

    if (circuit.state === 'OPEN') {
      const elapsed = Date.now() - (circuit.openedAt?.getTime() ?? 0);
      if (elapsed < circuit.options.recoveryMs) {
        throw new CircuitOpenError(name);
      }
      // Recovery window elapsed → allow one probe
      await this._transitionTo(name, circuit, 'HALF_OPEN');
    }

    try {
      const result = await fn();
      await this._onSuccess(name, circuit);
      return result;
    } catch (err) {
      await this._onFailure(name, circuit, err as Error);
      throw err;
    }
  }

  /**
   * Manually reset a circuit to CLOSED regardless of current state.
   */
  async reset(name: string): Promise<void> {
    const circuit = this._getOrRegister(name);
    const from = circuit.state;
    circuit.state = 'CLOSED';
    circuit.failureCount = 0;
    circuit.successCount = 0;
    circuit.openedAt = null;
    circuit.updatedAt = new Date();
    await this._persist(name, circuit);
    await this._logEvent(name, 'RESET', from, 'CLOSED', 0, 'Manual reset');
    this.emit('reset', { name, from });
    logger.info(`[CircuitBreaker] Circuit "${name}" manually reset to CLOSED`);
  }

  /** Return a snapshot of all registered circuits. */
  getAll(): CircuitSnapshot[] {
    return Array.from(this.circuits.entries()).map(([name, c]) =>
      this._toSnapshot(name, c),
    );
  }

  /** Return a snapshot of a specific circuit, or null if unknown. */
  get(name: string): CircuitSnapshot | null {
    const c = this.circuits.get(name);
    return c ? this._toSnapshot(name, c) : null;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _getOrRegister(name: string): CircuitInternalState {
    if (!this.circuits.has(name)) {
      this.register(name);
    }
    return this.circuits.get(name)!;
  }

  private async _onSuccess(name: string, circuit: CircuitInternalState): Promise<void> {
    await this._logEvent(name, 'SUCCESS', circuit.state, circuit.state, circuit.failureCount);

    if (circuit.state === 'HALF_OPEN') {
      circuit.successCount += 1;
      if (circuit.successCount >= circuit.options.successThreshold) {
        await this._transitionTo(name, circuit, 'CLOSED');
      } else {
        circuit.updatedAt = new Date();
        await this._persist(name, circuit);
      }
    } else if (circuit.state === 'CLOSED') {
      // Reset failure streak on any success in CLOSED state
      if (circuit.failureCount > 0) {
        circuit.failureCount = 0;
        circuit.updatedAt = new Date();
        await this._persist(name, circuit);
      }
    }
  }

  private async _onFailure(name: string, circuit: CircuitInternalState, err: Error): Promise<void> {
    circuit.failureCount += 1;
    circuit.successCount = 0;
    circuit.lastFailureAt = new Date();
    circuit.updatedAt = new Date();

    await this._logEvent(
      name,
      'FAILURE',
      circuit.state,
      circuit.state,
      circuit.failureCount,
      err.message,
    );

    logger.warn(
      `[CircuitBreaker] "${name}" failure ${circuit.failureCount}/${circuit.options.failureThreshold}: ${err.message}`,
    );

    if (
      circuit.state !== 'OPEN' &&
      circuit.failureCount >= circuit.options.failureThreshold
    ) {
      await this._transitionTo(name, circuit, 'OPEN');
    } else {
      await this._persist(name, circuit);
    }
  }

  private async _transitionTo(
    name: string,
    circuit: CircuitInternalState,
    next: CircuitState,
  ): Promise<void> {
    const from = circuit.state;
    circuit.state = next;
    circuit.updatedAt = new Date();

    if (next === 'OPEN') {
      circuit.openedAt = new Date();
      circuit.successCount = 0;
    } else if (next === 'CLOSED') {
      circuit.failureCount = 0;
      circuit.successCount = 0;
      circuit.openedAt = null;
    } else if (next === 'HALF_OPEN') {
      circuit.successCount = 0;
    }

    const eventType: CircuitEventType =
      next === 'OPEN' ? 'OPENED' : next === 'CLOSED' ? 'CLOSED' : 'HALF_OPENED';

    await this._persist(name, circuit);
    await this._logEvent(name, eventType, from, next, circuit.failureCount);
    this.emit('stateChange', { name, from, to: next });

    logger.info(`[CircuitBreaker] "${name}" transitioned ${from} → ${next}`);
  }

  private async _persist(name: string, circuit: CircuitInternalState): Promise<void> {
    if (!circuit.options.persist) return;
    try {
      const pool = getPool();
      await pool.query(
        `INSERT INTO circuit_breaker_state
           (name, state, failure_count, success_count, last_failure_at, opened_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (name) DO UPDATE
           SET state          = EXCLUDED.state,
               failure_count  = EXCLUDED.failure_count,
               success_count  = EXCLUDED.success_count,
               last_failure_at= EXCLUDED.last_failure_at,
               opened_at      = EXCLUDED.opened_at,
               updated_at     = NOW()`,
        [
          name,
          circuit.state,
          circuit.failureCount,
          circuit.successCount,
          circuit.lastFailureAt,
          circuit.openedAt,
        ],
      );
    } catch (err) {
      logger.warn({ err }, `[CircuitBreaker] Failed to persist state for "${name}"`);
    }
  }

  private async _logEvent(
    name: string,
    eventType: CircuitEventType,
    fromState: CircuitState | undefined,
    toState: CircuitState | undefined,
    failureCount: number,
    message?: string,
  ): Promise<void> {
    try {
      const pool = getPool();
      await pool.query(
        `INSERT INTO circuit_breaker_events
           (breaker_name, event_type, from_state, to_state, failure_count, message)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [name, eventType, fromState ?? null, toState ?? null, failureCount, message ?? null],
      );
    } catch (err) {
      logger.warn({ err }, `[CircuitBreaker] Failed to log event for "${name}"`);
    }
  }

  private _toSnapshot(name: string, c: CircuitInternalState): CircuitSnapshot {
    return {
      name,
      state: c.state,
      failureCount: c.failureCount,
      successCount: c.successCount,
      lastFailureAt: c.lastFailureAt,
      openedAt: c.openedAt,
      updatedAt: c.updatedAt,
    };
  }
}

export const circuitBreakerService = CircuitBreakerService.getInstance();

// ─── Pre-register well-known circuits ────────────────────────────────────────

circuitBreakerService.register('database',    { failureThreshold: 5, recoveryMs: 30_000 });
circuitBreakerService.register('redis',       { failureThreshold: 3, recoveryMs: 15_000 });
circuitBreakerService.register('stellar-api', { failureThreshold: 5, recoveryMs: 60_000 });
circuitBreakerService.register('email',       { failureThreshold: 3, recoveryMs: 60_000 });
