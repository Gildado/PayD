import { Router } from 'express';
import { PayrollAuditController } from '../controllers/payrollAuditController.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { isolateOrganization } from '../middlewares/rbac.js';

const router = Router();

// Apply authentication to all payroll audit routes
router.use(authenticateJWT);
router.use(isolateOrganization);

/**
 * @swagger
 * tags:
 *   name: Payroll Audit
 *   description: Detailed payroll-specific audit logs
 */

/**
 * @swagger
 * /api/v1/payroll/audit:
 *   get:
 *     summary: List payroll audit logs
 *     tags: [Payroll Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
/**
 * @swagger
 * /api/v1/payroll/audit/export:
 *   get:
 *     summary: Export audit logs as CSV
 *     tags: [Payroll Audit]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file
 */
/**
 * @swagger
 * /api/v1/payroll/audit/summary:
 *   get:
 *     summary: Get audit summary statistics
 *     tags: [Payroll Audit]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
/**
 * @swagger
 * /api/v1/payroll/audit/payroll-run/{payrollRunId}:
 *   get:
 *     summary: Get audit logs for a specific payroll run
 *     tags: [Payroll Audit]
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
/**
 * @swagger
 * /api/v1/payroll/audit/employee/{employeeId}:
 *   get:
 *     summary: Get audit logs for a specific employee
 *     tags: [Payroll Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
/**
 * @swagger
 * /api/v1/payroll/audit/{id}:
 *   get:
 *     summary: Get specific audit log by ID
 *     tags: [Payroll Audit]
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

router.get('/', PayrollAuditController.getAuditLogs);
router.get('/export', PayrollAuditController.exportAuditLogsCsv);
router.get('/summary', PayrollAuditController.getAuditSummary);
router.get('/payroll-run/:payrollRunId', PayrollAuditController.getAuditLogsByPayrollRun);
router.get('/employee/:employeeId', PayrollAuditController.getAuditLogsByEmployee);
router.get('/:id', PayrollAuditController.getAuditLogById);

export default router;
