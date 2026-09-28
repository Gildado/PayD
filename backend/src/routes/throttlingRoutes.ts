import { Router } from 'express';
import { ThrottlingController } from '../controllers/throttlingController.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Throttling
 *   description: API request throttling and queuing
 */

/**
 * @swagger
 * /api/v1/throttling/status:
 *   get:
 *     summary: Get current throttling status
 *     tags: [Throttling]
 *     responses:
 *       200:
 *         description: Success
 */
/**
 * @swagger
 * /api/v1/throttling/config:
 *   get:
 *     summary: Get throttling configuration
 *     tags: [Throttling]
 *     responses:
 *       200:
 *         description: Success
 */
/**
 * @swagger
 * /api/v1/throttling/config:
 *   put:
 *     summary: Update throttling configuration
 *     tags: [Throttling]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
/**
 * @swagger
 * /api/v1/throttling/queue:
 *   delete:
 *     summary: Clear the throttling queue
 *     tags: [Throttling]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
/**
 * @swagger
 * /api/v1/throttling/metrics:
 *   get:
 *     summary: Get throttling performance metrics
 *     tags: [Throttling]
 *     responses:
 *       200:
 *         description: Success
 */

export default router;
