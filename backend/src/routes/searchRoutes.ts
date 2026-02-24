import { Router } from 'express';
import searchController from '../controllers/searchController';
import  authenticateJWT  from '../middlewares/auth';
import { isolateOrganization } from '../middlewares/rbac';
import { requireTenantContext } from '../middleware/tenantContext';

const router = Router();

/**
 * @route GET /api/search/organizations/:organizationId/employees
 * @desc Search and filter employees
 * @query query - Full-text search query
 * @query status - Comma-separated status values (active,inactive,pending)
 * @query dateFrom - Start date (ISO 8601)
 * @query dateTo - End date (ISO 8601)
 * @query page - Page number (default: 1)
 * @query limit - Items per page (default: 20)
 * @query sortBy - Sort column (created_at, first_name, last_name, email, status)
 * @query sortOrder - Sort order (asc, desc)
 */
router.get(
  '/organizations/:organizationId/employees',
  requireTenantContext,
  searchController.searchEmployees.bind(searchController)
);

/**
 * @route GET /api/search/organizations/:organizationId/transactions
 * @desc Search and filter transactions
 * @query query - Full-text search query (tx_hash, asset_code)
 * @query status - Comma-separated status values (pending,completed,failed)
 * @query dateFrom - Start date (ISO 8601)
 * @query dateTo - End date (ISO 8601)
 * @query amountMin - Minimum amount
 * @query amountMax - Maximum amount
 * @query page - Page number (default: 1)
 * @query limit - Items per page (default: 20)
 * @query sortBy - Sort column (created_at, amount, status, tx_hash)
 * @query sortOrder - Sort order (asc, desc)
 */
router.get(
  '/organizations/:organizationId/transactions',
  requireTenantContext,
  searchController.searchTransactions.bind(searchController)
);

export default router;