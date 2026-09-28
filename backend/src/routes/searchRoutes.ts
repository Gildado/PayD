import { Router } from 'express';
import searchController from '../controllers/searchController.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { isolateOrganization } from '../middlewares/rbac.js';
import { requireTenantContext } from '../middleware/tenantContext.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Data Search
 *   description: Search and filter employees and transactions
 */

// Apply global authentication and isolation to all search routes
router.use(authenticateJWT);
router.use(isolateOrganization);
router.use(requireTenantContext);

/**
 * @swagger
 * /api/v1/search/organizations/{organizationId}/employees:
 *   get:
 *     summary: Search and filter employees
 *     tags: [Data Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/organizations/:organizationId/employees',
  searchController.searchEmployees.bind(searchController)
);

/**
 * @swagger
 * /api/v1/search/organizations/{organizationId}/transactions:
 *   get:
 *     summary: Search and filter transactions
 *     tags: [Data Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/organizations/:organizationId/transactions',
  searchController.searchTransactions.bind(searchController)
);

export default router;
