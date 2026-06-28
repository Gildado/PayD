/**
 * @file src/routes/circuitBreakerRoutes.ts
 * @description REST endpoints for circuit-breaker observability and management.
 *              Part of the API & Database Scaling effort (Issue #256 – Part 11).
 *
 * Routes
 * ──────
 *   GET  /api/v1/circuit-breakers              – list all circuits
 *   GET  /api/v1/circuit-breakers/summary      – health summary (admin dashboard)
 *   GET  /api/v1/circuit-breakers/:name        – single circuit snapshot
 *   GET  /api/v1/circuit-breakers/:name/events – recent events for a circuit
 *   POST /api/v1/circuit-breakers/:name/reset  – manually reset a circuit
 */

import { Router } from 'express';
import { CircuitBreakerController } from '../controllers/circuitBreakerController.js';

const router = Router();
const ctrl = new CircuitBreakerController();

/**
 * @swagger
 * tags:
 *   name: Circuit Breakers
 *   description: Circuit-breaker state management and observability (Issue #256 Part 11)
 */

/**
 * @swagger
 * /api/v1/circuit-breakers:
 *   get:
 *     summary: List all registered circuit breakers and their current state
 *     tags: [Circuit Breakers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of circuit-breaker snapshots
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CircuitSnapshot'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     count: { type: integer }
 */
router.get('/', (req, res, next) => ctrl.listAll(req, res, next));

/**
 * @swagger
 * /api/v1/circuit-breakers/summary:
 *   get:
 *     summary: Aggregated health summary across all circuit breakers
 *     tags: [Circuit Breakers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Summary with open/closed/half-open counts
 */
router.get('/summary', (req, res, next) => ctrl.getSummary(req, res, next));

/**
 * @swagger
 * /api/v1/circuit-breakers/{name}:
 *   get:
 *     summary: Get the current snapshot for a named circuit breaker
 *     tags: [Circuit Breakers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema: { type: string }
 *         description: Circuit name (e.g. "database", "redis", "stellar-api")
 *     responses:
 *       200:
 *         description: Circuit snapshot
 *       404:
 *         description: Circuit not found
 */
router.get('/:name', (req, res, next) => ctrl.getOne(req, res, next));

/**
 * @swagger
 * /api/v1/circuit-breakers/{name}/events:
 *   get:
 *     summary: Return recent state-change and failure events for a circuit
 *     tags: [Circuit Breakers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: sinceHours
 *         schema: { type: integer, default: 24 }
 *     responses:
 *       200:
 *         description: List of events
 *       400:
 *         description: Invalid query parameters
 */
router.get('/:name/events', (req, res, next) => ctrl.getEvents(req, res, next));

/**
 * @swagger
 * /api/v1/circuit-breakers/{name}/reset:
 *   post:
 *     summary: Manually reset a circuit breaker to CLOSED state
 *     tags: [Circuit Breakers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Circuit reset successfully
 *       404:
 *         description: Circuit not found
 */
router.post('/:name/reset', (req, res, next) => ctrl.reset(req, res, next));

export default router;
