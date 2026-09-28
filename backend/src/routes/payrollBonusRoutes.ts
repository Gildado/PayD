import { Router } from 'express';
import { PayrollBonusController } from '../controllers/payrollBonusController.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { authorizeRoles } from '../middlewares/rbac.js';
import { require2FA } from '../middlewares/require2fa.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Payroll Bonus
 *   description: One-off bonus payment runs
 */

/**
 * @swagger
 * /api/v1/payroll-bonus/runs:
 *   post:
 *     summary: Create a new payroll bonus run
 *     tags: [Payroll Bonus]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/runs', PayrollBonusController.createPayrollRun);

/**
 * @swagger
 * /api/v1/payroll-bonus/runs:
 *   get:
 *     summary: List all payroll bonus runs
 *     tags: [Payroll Bonus]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/runs', PayrollBonusController.listPayrollRuns);

/**
 * @swagger
 * /api/v1/payroll-bonus/runs/{id}:
 *   get:
 *     summary: Get details of a payroll bonus run
 *     tags: [Payroll Bonus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/runs/:id', PayrollBonusController.getPayrollRun);

/**
 * @swagger
 * /api/v1/payroll-bonus/runs/{id}/status:
 *   patch:
 *     summary: Update status of a payroll bonus run
 *     tags: [Payroll Bonus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.patch('/runs/:id/status', PayrollBonusController.updatePayrollRunStatus);

/**
 * @swagger
 * /api/v1/payroll-bonus/runs/{id}/execute:
 *   post:
 *     summary: Execute a payroll bonus run (asynchronous)
 *     tags: [Payroll Bonus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       202:
 *         description: Accepted
 */
import { PayrollQueueService } from '../services/payrollQueueService.js';
import { PayrollBonusService } from '../services/payrollBonusService.js';
import { PayrollAuditService } from '../services/payrollAuditService.js';
import logger from '../utils/logger.js';

router.post('/runs/:id/execute', async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.body;

    if (!organizationId) {
      return res.status(400).json({ error: 'Missing organizationId' });
    }

    // Check if payroll run exists
    const run = await PayrollBonusService.getPayrollRunById(parseInt(id, 10));
    if (!run) {
      return res.status(404).json({ error: 'Payroll run not found' });
    }

    if (run.status === 'processing' || run.status === 'completed') {
      return res.status(400).json({ error: `Cannot execute run in status ${run.status}` });
    }

    // Add to queue
    const jobId = await PayrollQueueService.addPayrollJob({
      payrollRunId: parseInt(id, 10),
      organizationId: parseInt(organizationId, 10),
    });

    // Update status to pending/processing in background soon
    await PayrollBonusService.updatePayrollRunStatus(parseInt(id, 10), 'pending');

    res.status(202).json({
      success: true,
      message: 'Payroll execution started in background',
      jobId,
    });
  } catch (error) {
    logger.error('Failed to trigger payroll execution', error);
    res.status(500).json({ error: 'Failed to trigger payroll execution' });
  }
});

/**
 * @swagger
 * /api/v1/payroll-bonus/items/bonus:
 *   post:
 *     summary: Add a single bonus item
 *     tags: [Payroll Bonus]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/items/bonus', PayrollBonusController.addBonusItem);

/**
 * @swagger
 * /api/v1/payroll-bonus/items/bonus/batch:
 *   post:
 *     summary: Add multiple bonus items in batch
 *     tags: [Payroll Bonus]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/items/bonus/batch', PayrollBonusController.addBatchBonusItems);

/**
 * @swagger
 * /api/v1/payroll-bonus/runs/{payrollRunId}/items:
 *   get:
 *     summary: List all items in a payroll bonus run
 *     tags: [Payroll Bonus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: payrollRunId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/runs/:payrollRunId/items', PayrollBonusController.getPayrollItems);

/**
 * @swagger
 * /api/v1/payroll-bonus/items/{itemId}:
 *   delete:
 *     summary: Delete a payroll item
 *     tags: [Payroll Bonus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.delete('/items/:itemId', PayrollBonusController.deletePayrollItem);

/**
 * @swagger
 * /api/v1/payroll-bonus/bonuses/history:
 *   get:
 *     summary: Get history of all bonuses
 *     tags: [Payroll Bonus]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/bonuses/history', PayrollBonusController.getBonusHistory);

/**
 * @swagger
 * /api/v1/payroll-bonus/bonuses/by-type/{bonusType}:
 *   get:
 *     summary: List bonus items filtered by type (performance, referral, project, etc.)
 *     tags: [Payroll Bonus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bonusType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [performance, referral, project, retention, spot, other]
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Invalid bonus type
 */
router.get('/bonuses/by-type/:bonusType', PayrollBonusController.listBonusesByType);

/**
 * @swagger
 * /api/v1/payroll-bonus/bonuses/performance:
 *   get:
 *     summary: List performance bonuses, optionally filtered by minimum score
 *     tags: [Payroll Bonus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: minScore
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *         description: Minimum performance score (0–100)
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Invalid minScore
 */
router.get('/bonuses/performance', PayrollBonusController.getPerformanceBonuses);

/**
 * @swagger
 * /api/v1/payroll-bonus/runs/{id}/report:
 *   get:
 *     summary: Get a combined payroll run report (run metadata + full audit trail)
 *     tags: [Payroll Bonus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payroll run ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Audit log page (default 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Audit log page size (default 50)
 *     responses:
 *       200:
 *         description: Combined run summary and audit trail
 *       404:
 *         description: Payroll run not found
 */
router.get('/runs/:id/report', async (req, res) => {
  try {
    const { id } = req.params;
    const { page, limit } = req.query;
    const organizationId = (req as any).user?.organizationId;

    const runId = parseInt(id, 10);

    const run = await PayrollBonusService.getPayrollRunById(runId);
    if (!run || (organizationId && run.organization_id !== organizationId)) {
      return res.status(404).json({ error: 'Payroll run not found' });
    }

    const [summary, auditResult] = await Promise.all([
      PayrollBonusService.getPayrollRunSummary(runId),
      PayrollAuditService.getAuditLogs(
        { payrollRunId: runId },
        parseInt(page as string, 10) || 1,
        parseInt(limit as string, 10) || 50
      ),
    ]);

    res.json({
      success: true,
      data: {
        run: summary,
        audit: {
          logs: auditResult.data,
          pagination: {
            page: parseInt(page as string, 10) || 1,
            limit: parseInt(limit as string, 10) || 50,
            total: auditResult.total,
            totalPages: Math.ceil(auditResult.total / (parseInt(limit as string, 10) || 50)),
          },
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get payroll run report', error);
    res.status(500).json({ error: 'Failed to get payroll run report' });
  }
});

export default router;
