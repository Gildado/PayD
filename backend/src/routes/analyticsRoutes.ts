import { Router } from 'express';
import { AnalyticsController } from '../controllers/analyticsController.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { isolateOrganization } from '../middlewares/rbac.js';

const router = Router();

router.use(authenticateJWT);
router.use(isolateOrganization);

/**
 * @swagger
 * tags:
 *   name: Analytics
 *   description: Payroll expenditure analytics and reporting
 */

/**
 * @swagger
 * /api/v1/analytics/payroll:
 *   get:
 *     summary: Get payroll expenditure analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Organization identifier
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start of the date range (ISO 8601). Defaults to 12 months ago.
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End of the date range (ISO 8601). Defaults to today.
 *     responses:
 *       200:
 *         description: Payroll analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     trends:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           month:
 *                             type: string
 *                           total:
 *                             type: number
 *                           count:
 *                             type: integer
 *                     currencyBreakdown:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           currency:
 *                             type: string
 *                           value:
 *                             type: number
 *                     paymentMetrics:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           month:
 *                             type: string
 *                           success:
 *                             type: integer
 *                           failure:
 *                             type: integer
 *                           pending:
 *                             type: integer
 *                     departmentBreakdown:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           department:
 *                             type: string
 *                           total:
 *                             type: number
 *                           headcount:
 *                             type: integer
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalPayroll:
 *                           type: number
 *                         totalTransactions:
 *                           type: integer
 *                         successRate:
 *                           type: number
 *                         activeEmployees:
 *                           type: integer
 *       400:
 *         description: Missing or invalid query parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/payroll', AnalyticsController.getPayrollAnalytics);

export default router;
