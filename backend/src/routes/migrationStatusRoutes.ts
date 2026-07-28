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

/**
 * @swagger
 * /api/v1/migrations/history:
 *   get:
 *     summary: Migration execution history (success/failure/dry-run)
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
 *         description: Migration run log, most recent first (#1039)
 */
router.get('/history', MigrationStatusController.getRunHistory);

/**
 * @swagger
 * /api/v1/migrations/history/summary:
 *   get:
 *     summary: Aggregate success/failure counts for recent migration runs
 *     tags: [Migrations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Success/failure summary plus the most recent failure, if any (#1039)
 */
router.get('/history/summary', MigrationStatusController.getRunSummary);

export default router;
