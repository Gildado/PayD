import { Router } from 'express';
import { MigrationStatusController } from '../controllers/migrationStatusController.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Migrations
 *   description: Database migration status and rollback history (Issue #698)
 */

/**
 * @swagger
 * /api/v1/migrations/status:
 *   get:
 *     summary: Full migration status report
 *     description: Returns applied migrations, pending migrations with rollback availability, and recent rollback history.
 *     tags: [Migrations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Migration status report
 *       500:
 *         description: Internal server error
 */
router.get('/status', MigrationStatusController.getStatus);

/**
 * @swagger
 * /api/v1/migrations/applied:
 *   get:
 *     summary: List applied migrations
 *     tags: [Migrations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of applied migrations with checksums and timestamps
 */
router.get('/applied', MigrationStatusController.getApplied);

/**
 * @swagger
 * /api/v1/migrations/rollbacks:
 *   get:
 *     summary: Migration rollback history
 *     tags: [Migrations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Rollback event log, most recent first
 */
router.get('/rollbacks', MigrationStatusController.getRollbackHistory);

export default router;
