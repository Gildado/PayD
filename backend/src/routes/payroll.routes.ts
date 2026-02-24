import { Request, Response, Router } from 'express';
import { payrollQueryService } from '../services/payroll-query.service';
import logger from '../utils/logger';
import { authenticateJWT } from '../middlewares/auth';
import { authorizeRoles, isolateOrganization } from '../middlewares/rbac';

const router = Router();

// Apply authentication to all payroll routes
router.use(authenticateJWT);
router.use(isolateOrganization);

/**
 * Query payroll transactions with filtering and pagination
 * GET /api/payroll/transactions
 * Query params:
 * - orgPublicKey: Organization public key (required)
 * - employeeId: Filter by employee ID
 * - batchId: Filter by payroll batch ID
 * - assetCode: Filter by asset code
 * - assetIssuer: Filter by asset issuer
 * - startDate: Start date (ISO 8601)
 * - endDate: End date (ISO 8601)
 * - page: Page number (default: 1)
 * - limit: Records per page (default: 50, max: 500)
 * - sortBy: Sort field (timestamp, amount, employeeId)
 * - sortOrder: Sort order (asc, desc)
 */
router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const {
      orgPublicKey,
      employeeId,
      batchId,
      assetCode,
      assetIssuer,
      startDate,
      endDate,
      page,
      limit,
      sortBy,
      sortOrder,
    } = req.query;

    if (!orgPublicKey) {
      return res.status(400).json({
        error: 'Missing required parameter: orgPublicKey',
      });
    }

    const query = {
      organizationPublicKey: String(orgPublicKey),
      employeeId: employeeId ? String(employeeId) : undefined,
      payrollBatchId: batchId ? String(batchId) : undefined,
      assetCode: assetCode ? String(assetCode) : undefined,
      assetIssuer: assetIssuer ? String(assetIssuer) : undefined,
      startDate: startDate ? new Date(String(startDate)) : undefined,
      endDate: endDate ? new Date(String(endDate)) : undefined,
    };

    const result = await payrollQueryService.queryPayroll(query, Number(page), Number(limit), {
      enrichPayrollData: true,
      sortBy: (sortBy as any) || 'timestamp',
      sortOrder: (sortOrder as any) || 'desc',
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('GET /api/payroll/transactions failed', error);
    res.status(500).json({
      error: 'Failed to query payroll transactions',
      message: (error as Error).message,
    });
  }
});

/**
 * Get payroll for a specific employee
 * GET /api/payroll/employees/:employeeId
 */
router.get('/employees/:employeeId', async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const { orgPublicKey, startDate, endDate, page, limit } = req.query;

    if (!orgPublicKey) {
      return res.status(400).json({
        error: 'Missing required query parameter: orgPublicKey',
      });
    }

    const result = await payrollQueryService.getEmployeePayroll(
      String(orgPublicKey),
      employeeId,
      startDate ? new Date(String(startDate)) : undefined,
      endDate ? new Date(String(endDate)) : undefined,
      Number(page),
      Number(limit)
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error(`GET /api/payroll/employees/${req.params.employeeId} failed`, error);
    res.status(500).json({
      error: 'Failed to retrieve employee payroll',
      message: (error as Error).message,
    });
  }
});

/**
 * Get employee payroll summary
 * GET /api/payroll/employees/:employeeId/summary
 */
router.get('/employees/:employeeId/summary', async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const { orgPublicKey, startDate, endDate } = req.query;

    if (!orgPublicKey) {
      return res.status(400).json({
        error: 'Missing required query parameter: orgPublicKey',
      });
    }

    const summary = await payrollQueryService.getEmployeeSummary(
      String(orgPublicKey),
      employeeId,
      startDate ? new Date(String(startDate)) : undefined,
      endDate ? new Date(String(endDate)) : undefined
    );

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error(`GET /api/payroll/employees/${req.params.employeeId}/summary failed`, error);
    res.status(500).json({
      error: 'Failed to retrieve employee summary',
      message: (error as Error).message,
    });
  }
});

/**
 * Get payroll batch details
 * GET /api/payroll/batches/:batchId
 */
router.get('/batches/:batchId', async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const { orgPublicKey, page, limit } = req.query;

    if (!orgPublicKey) {
      return res.status(400).json({
        error: 'Missing required query parameter: orgPublicKey',
      });
    }

    const result = await payrollQueryService.getPayrollBatch(
      String(orgPublicKey),
      batchId,
      Number(page),
      Number(limit)
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error(`GET /api/payroll/batches/${req.params.batchId} failed`, error);
    res.status(500).json({
      error: 'Failed to retrieve payroll batch',
      message: (error as Error).message,
    });
  }
});

/**
 * Get payroll aggregation statistics
 * GET /api/payroll/aggregation
 */
router.get('/aggregation', async (req: Request, res: Response) => {
  try {
    const { orgPublicKey, startDate, endDate, assetCode, assetIssuer } = req.query;

    if (!orgPublicKey) {
      return res.status(400).json({
        error: 'Missing required query parameter: orgPublicKey',
      });
    }

    const aggregation = await payrollQueryService.getPayrollAggregation(
      String(orgPublicKey),
      startDate ? new Date(String(startDate)) : undefined,
      endDate ? new Date(String(endDate)) : undefined,
      assetCode ? String(assetCode) : undefined,
      assetIssuer ? String(assetIssuer) : undefined
    );

    res.json({
      success: true,
      data: aggregation,
    });
  } catch (error) {
    logger.error('GET /api/payroll/aggregation failed', error);
    res.status(500).json({
      error: 'Failed to retrieve aggregation',
      message: (error as Error).message,
    });
  }
});

/**
 * Get organization-wide audit report
 * GET /api/payroll/audit
 */
router.get('/audit', async (req: Request, res: Response) => {
  try {
    const { orgPublicKey, startDate, endDate } = req.query;

    if (!orgPublicKey) {
      return res.status(400).json({
        error: 'Missing required query parameter: orgPublicKey',
      });
    }

    const report = await payrollQueryService.getOrganizationAuditReport(
      String(orgPublicKey),
      startDate ? new Date(String(startDate)) : undefined,
      endDate ? new Date(String(endDate)) : undefined
    );

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('GET /api/payroll/audit failed', error);
    res.status(500).json({
      error: 'Failed to generate audit report',
      message: (error as Error).message,
    });
  }
});

/**
 * Search transactions by memo pattern
 * GET /api/payroll/search/memo
 */
router.get('/search/memo', async (req: Request, res: Response) => {
  try {
    const { orgPublicKey, pattern, page, limit } = req.query;

    if (!orgPublicKey || !pattern) {
      return res.status(400).json({
        error: 'Missing required query parameters: orgPublicKey, pattern',
      });
    }

    const result = await payrollQueryService.searchByMemoPattern(
      String(orgPublicKey),
      String(pattern),
      Number(page),
      Number(limit)
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('GET /api/payroll/search/memo failed', error);
    res.status(500).json({
      error: 'Failed to search by memo',
      message: (error as Error).message,
    });
  }
});

/**
 * Get transaction details by hash
 * GET /api/payroll/transactions/:txHash
 */
router.get('/transactions/:txHash', async (req: Request, res: Response) => {
  try {
    const { txHash } = req.params;

    const transaction = await payrollQueryService.getTransactionDetails(txHash);

    if (!transaction) {
      return res.status(404).json({
        error: 'Transaction not found',
      });
    }

    res.json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    logger.error(`GET /api/payroll/transactions/${req.params.txHash} failed`, error);
    res.status(500).json({
      error: 'Failed to retrieve transaction',
      message: (error as Error).message,
    });
  }
});

/**
 * Get SDS rate limit information
 * GET /api/payroll/status/rate-limit
 */
router.get('/status/rate-limit', (req: Request, res: Response) => {
  try {
    const rateLimitInfo = payrollQueryService.getSDSRateLimitInfo();

    res.json({
      success: true,
      data: rateLimitInfo || { message: 'No rate limit info available' },
    });
  } catch (error) {
    logger.error('GET /api/payroll/status/rate-limit failed', error);
    res.status(500).json({
      error: 'Failed to retrieve rate limit info',
      message: (error as Error).message,
    });
  }
});

/**
 * Check SDS health status
 * GET /api/payroll/status/health
 */
router.get('/status/health', async (req: Request, res: Response) => {
  try {
    const healthy = await payrollQueryService.checkSDSHealth();

    res.json({
      success: true,
      data: {
        status: healthy ? 'healthy' : 'unhealthy',
        service: 'SDS',
      },
    });
  } catch (error) {
    logger.error('GET /api/payroll/status/health failed', error);
    res.status(500).json({
      error: 'Failed to check health',
      message: (error as Error).message,
    });
  }
});

/**
 * Clear cache (admin endpoint)
 * POST /api/payroll/cache/clear
 */
router.post('/cache/clear', (req: Request, res: Response) => {
  try {
    payrollQueryService.clearCache();

    res.json({
      success: true,
      message: 'Cache cleared successfully',
    });
  } catch (error) {
    logger.error('POST /api/payroll/cache/clear failed', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      message: (error as Error).message,
    });
  }
});

/**
 * Get cache statistics
 * GET /api/payroll/cache/stats
 */
router.get('/cache/stats', (req: Request, res: Response) => {
  try {
    const stats = payrollQueryService.getCacheStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('GET /api/payroll/cache/stats failed', error);
    res.status(500).json({
      error: 'Failed to retrieve cache stats',
      message: (error as Error).message,
    });
  }
});

export default router;
