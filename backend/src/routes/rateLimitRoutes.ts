import { Router } from 'express';
import { RateLimitController } from '../controllers/rateLimitController.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Rate Limiting
 *   description: API rate limit management
 */

/**
 * @swagger
 * /api/v1/rate-limit/status:
 *   get:
 *     summary: Get current rate limit status
 *     tags: [Rate Limiting]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
/**
 * @swagger
 * /api/v1/rate-limit/tiers:
 *   get:
 *     summary: List available rate limit tiers
 *     tags: [Rate Limiting]
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/status', RateLimitController.getStatus);
router.get('/tiers', RateLimitController.getTiers);

export default router;
