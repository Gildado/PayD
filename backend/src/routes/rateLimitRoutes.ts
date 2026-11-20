import { Router } from 'express';
import { RateLimitController } from '../controllers/rateLimitController.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { authorizeRoles } from '../middlewares/rbac.js';

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

/**
 * @swagger
 * /api/v1/rate-limit/tenant/status:
 *   get:
 *     summary: Get per-tenant rate limit status for the current organization
 *     tags: [Rate Limiting]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/tenant/status', authenticateJWT, RateLimitController.getTenantStatus);

/**
 * @swagger
 * /api/v1/rate-limit/tenant/plan:
 *   put:
 *     summary: Set the rate limit plan for a tenant (admin only)
 *     tags: [Rate Limiting]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [organizationId, plan]
 *             properties:
 *               organizationId:
 *                 type: integer
 *               plan:
 *                 type: string
 *                 enum: [free, pro, enterprise]
 *     responses:
 *       200:
 *         description: Plan updated
 */
router.put(
  '/tenant/plan',
  authenticateJWT,
  authorizeRoles('EMPLOYER'),
  RateLimitController.setTenantPlan
);

export default router;
