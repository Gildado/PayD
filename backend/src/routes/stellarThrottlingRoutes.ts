import { Router } from 'express';
import { StellarThrottlingController } from '../controllers/stellarThrottlingController.js';

const router = Router();

/**
 * @swagger
 * /api/stellar-throttling/status:
 *   get:
 *     summary: Get current throttling status
 *     tags: [Stellar Throttling]
 *     responses:
 *       200:
 *         description: Current throttling status
 */
router.get('/status', StellarThrottlingController.getStatus);

/**
 * @swagger
 * /api/stellar-throttling/metrics:
 *   get:
 *     summary: Get throttling metrics
 *     tags: [Stellar Throttling]
 *     responses:
 *       200:
 *         description: Throttling metrics
 */
router.get('/metrics', StellarThrottlingController.getMetrics);

/**
 * @swagger
 * /api/stellar-throttling/config:
 *   get:
 *     summary: Get current throttling configuration
 *     tags: [Stellar Throttling]
 *     responses:
 *       200:
 *         description: Current configuration
 */
router.get('/config', StellarThrottlingController.getConfig);

/**
 * @swagger
 * /api/stellar-throttling/config:
 *   put:
 *     summary: Update throttling configuration
 *     tags: [Stellar Throttling]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tpm:
 *                 type: number
 *                 description: Transactions per minute
 *               maxQueueSize:
 *                 type: number
 *                 description: Maximum queue size
 *               refillIntervalMs:
 *                 type: number
 *                 description: Token refill interval in milliseconds
 *     responses:
 *       200:
 *         description: Configuration updated successfully
 */
router.put('/config', StellarThrottlingController.updateConfig);

/**
 * @swagger
 * /api/stellar-throttling/queue/clear:
 *   post:
 *     summary: Clear the transaction queue
 *     tags: [Stellar Throttling]
 *     responses:
 *       200:
 *         description: Queue cleared successfully
 */
router.post('/queue/clear', StellarThrottlingController.clearQueue);

/**
 * @swagger
 * /api/stellar-throttling/metrics/reset:
 *   post:
 *     summary: Reset throttling metrics
 *     tags: [Stellar Throttling]
 *     responses:
 *       200:
 *         description: Metrics reset successfully
 */
router.post('/metrics/reset', StellarThrottlingController.resetMetrics);

/**
 * @swagger
 * /api/stellar-throttling/health:
 *   get:
 *     summary: Health check for throttling service
 *     tags: [Stellar Throttling]
 *     responses:
 *       200:
 *         description: Service is healthy
 *       503:
 *         description: Service is degraded
 */
router.get('/health', StellarThrottlingController.healthCheck);

export default router;
