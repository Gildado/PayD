/**
 * @file src/middlewares/circuitBreakerMiddleware.ts
 * @description Express middleware factory that wraps a named circuit breaker
 *              around a route handler.  Part of the API & Database Scaling
 *              effort (Issue #256 – Part 11).
 *
 * Usage
 * ─────
 *   router.get('/payments', circuitBreakerGuard('stellar-api'), handler);
 *
 * When the named circuit is OPEN the middleware responds with 503 and a
 * Retry-After header so clients can back off gracefully.
 */

import type { Request, Response, NextFunction } from 'express';
import {
  circuitBreakerService,
  CircuitOpenError,
  CircuitBreakerOptions,
} from '../services/circuitBreakerService.js';
import { apiErrorResponse, ErrorCodes } from '../utils/apiError.js';
import logger from '../utils/logger.js';

/**
 * Returns an Express middleware that guards a route behind the named circuit.
 *
 * @param name    Circuit name (must match a registered circuit or will auto-register)
 * @param opts    Optional configuration override for auto-registration
 */
export function circuitBreakerGuard(
  name: string,
  opts: CircuitBreakerOptions = {},
) {
  circuitBreakerService.register(name, opts);

  return async function circuitBreakerMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const snapshot = circuitBreakerService.get(name);

    if (snapshot?.state === 'OPEN') {
      const openedMs = snapshot.openedAt ? snapshot.openedAt.getTime() : Date.now();
      const recoveryMs = opts.recoveryMs ?? 30_000;
      const retryAfterSec = Math.ceil(
        Math.max(0, recoveryMs - (Date.now() - openedMs)) / 1000,
      );

      logger.warn(
        `[circuitBreakerMiddleware] Circuit "${name}" is OPEN – rejecting ${req.method} ${req.path}`,
      );

      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(503).json({
        ...apiErrorResponse(
          ErrorCodes.INTERNAL_ERROR,
          `Service "${name}" is temporarily unavailable. Please retry after ${retryAfterSec}s.`,
        ),
        circuit: name,
        retryAfterSeconds: retryAfterSec,
      });
      return;
    }

    next();
  };
}

/**
 * Wraps an async route handler so that any thrown error is recorded as a
 * circuit-breaker failure for the given circuit name.
 *
 * Use this when the circuit-breaker failure tracking should happen inside the
 * handler rather than at the middleware level (e.g., for database calls).
 *
 * @param name    Circuit name
 * @param fn      Async function to execute through the circuit
 */
export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  return circuitBreakerService.execute(name, fn);
}
