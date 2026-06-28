/**
 * @file src/controllers/circuitBreakerController.ts
 * @description HTTP handlers for the circuit-breaker management API.
 *              Part of the API & Database Scaling effort (Issue #256 – Part 11).
 */

import type { Request, Response, NextFunction } from 'express';
import { circuitBreakerService } from '../services/circuitBreakerService.js';
import { getPool } from '../services/dbPoolService.js';
import { apiErrorResponse, ErrorCodes } from '../utils/apiError.js';
import logger from '../utils/logger.js';

export class CircuitBreakerController {
  /**
   * GET /api/v1/circuit-breakers
   * List all registered circuit breakers and their current state.
   */
  async listAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const circuits = circuitBreakerService.getAll();
      res.status(200).json({
        success: true,
        data: circuits,
        meta: { count: circuits.length },
      });
    } catch (err) {
      logger.error({ err }, '[CircuitBreakerController] Failed to list circuits');
      next(err);
    }
  }

  /**
   * GET /api/v1/circuit-breakers/:name
   * Return the snapshot for a single named circuit.
   */
  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name } = req.params;
      const snapshot = circuitBreakerService.get(name);

      if (!snapshot) {
        res.status(404).json(
          apiErrorResponse(ErrorCodes.NOT_FOUND, `Circuit "${name}" not found`),
        );
        return;
      }

      res.status(200).json({ success: true, data: snapshot });
    } catch (err) {
      logger.error({ err }, '[CircuitBreakerController] Failed to get circuit');
      next(err);
    }
  }

  /**
   * POST /api/v1/circuit-breakers/:name/reset
   * Manually reset a circuit to CLOSED state.
   */
  async reset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name } = req.params;

      const before = circuitBreakerService.get(name);
      if (!before) {
        res.status(404).json(
          apiErrorResponse(ErrorCodes.NOT_FOUND, `Circuit "${name}" not found`),
        );
        return;
      }

      await circuitBreakerService.reset(name);
      const after = circuitBreakerService.get(name);

      logger.info(
        `[CircuitBreakerController] Circuit "${name}" reset from ${before.state} to CLOSED`,
      );

      res.status(200).json({
        success: true,
        message: `Circuit "${name}" has been reset to CLOSED.`,
        data: after,
      });
    } catch (err) {
      logger.error({ err }, '[CircuitBreakerController] Failed to reset circuit');
      next(err);
    }
  }

  /**
   * GET /api/v1/circuit-breakers/:name/events
   * Return recent circuit-breaker events for a named circuit.
   */
  async getEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name } = req.params;
      const limit = Math.min(Number(req.query.limit ?? 50), 200);
      const sinceHours = Number(req.query.sinceHours ?? 24);

      if (isNaN(limit) || limit < 1) {
        res.status(400).json(
          apiErrorResponse(ErrorCodes.BAD_REQUEST, 'limit must be a positive integer'),
        );
        return;
      }

      const pool = getPool();
      const { rows } = await pool.query<{
        id: string;
        event_type: string;
        from_state: string | null;
        to_state: string | null;
        failure_count: number;
        message: string | null;
        recorded_at: Date;
      }>(
        `SELECT id, event_type, from_state, to_state, failure_count, message, recorded_at
           FROM circuit_breaker_events
          WHERE breaker_name = $1
            AND recorded_at >= NOW() - ($2 || ' hours')::INTERVAL
          ORDER BY recorded_at DESC
          LIMIT $3`,
        [name, sinceHours, limit],
      );

      res.status(200).json({
        success: true,
        data: rows,
        meta: { circuit: name, sinceHours, limit, count: rows.length },
      });
    } catch (err) {
      logger.error({ err }, '[CircuitBreakerController] Failed to fetch events');
      next(err);
    }
  }

  /**
   * GET /api/v1/circuit-breakers/summary
   * Return a summary of circuit health across all breakers (admin dashboard).
   */
  async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const circuits = circuitBreakerService.getAll();
      const open = circuits.filter((c) => c.state === 'OPEN').length;
      const halfOpen = circuits.filter((c) => c.state === 'HALF_OPEN').length;
      const closed = circuits.filter((c) => c.state === 'CLOSED').length;

      res.status(200).json({
        success: true,
        data: {
          total: circuits.length,
          closed,
          open,
          halfOpen,
          healthy: open === 0 && halfOpen === 0,
          circuits,
        },
      });
    } catch (err) {
      logger.error({ err }, '[CircuitBreakerController] Failed to get summary');
      next(err);
    }
  }
}
