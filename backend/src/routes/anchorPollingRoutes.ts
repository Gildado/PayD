import { Router, Request, Response } from 'express';
import { AnchorPollingManager } from '../services/anchorPollingManager.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { isolateOrganization, authorizeRoles } from '../middlewares/rbac.js';
import logger from '../utils/logger.js';

const router = Router();

router.use(authenticateJWT);
router.use(isolateOrganization);

/**
 * GET /api/anchor/polling/:transaction_id
 * Retrieve polling status for a specific transaction
 */
router.get('/:transaction_id', async (req: Request, res: Response) => {
  try {
    const { transaction_id } = req.params;
    const { anchor_domain } = req.query;
    const organization_id = (req as any).organizationId;

    if (!anchor_domain || typeof anchor_domain !== 'string') {
      return res.status(400).json({ error: 'anchor_domain query parameter is required' });
    }

    const status = await AnchorPollingManager.getPollingStatus(
      organization_id,
      anchor_domain,
      transaction_id
    );

    if (!status) {
      return res.status(404).json({ error: 'Polling state not found' });
    }

    res.json({
      success: true,
      data: {
        transaction_id: status.transaction_id,
        anchor_domain: status.anchor_domain,
        status: status.status,
        cursor: status.cursor,
        last_polled_at: status.last_polled_at,
        retry_count: status.retry_count,
        max_retries: status.max_retries,
        next_retry_at: status.next_retry_at,
        error_message: status.error_message,
        created_at: status.created_at,
        updated_at: status.updated_at,
      },
    });
  } catch (error) {
    logger.error(`GET /api/anchor/polling/:transaction_id failed`, error);
    res.status(500).json({
      error: 'Failed to fetch polling status',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/anchor/polling/:transaction_id/resume
 * Resume polling for a transaction from last cursor
 */
router.post('/:transaction_id/resume', async (req: Request, res: Response) => {
  try {
    const { transaction_id } = req.params;
    const { anchor_domain } = req.body;
    const organization_id = (req as any).organizationId;

    if (!anchor_domain || typeof anchor_domain !== 'string') {
      return res.status(400).json({ error: 'anchor_domain is required in request body' });
    }

    const status = await AnchorPollingManager.getPollingStatus(
      organization_id,
      anchor_domain,
      transaction_id
    );

    if (!status) {
      return res.status(404).json({ error: 'Polling state not found' });
    }

    // Check if already completed
    if (status.status === 'completed' || status.status === 'timeout') {
      return res.status(409).json({
        error: `Cannot resume polling. Current status: ${status.status}`,
        status: status.status,
      });
    }

    // Resume polling
    const resumed = await AnchorPollingManager.resumePolling(
      organization_id,
      anchor_domain,
      transaction_id
    );

    res.json({
      success: true,
      message: 'Polling resumed',
      data: {
        transaction_id: resumed.transaction_id,
        status: resumed.status,
        cursor: resumed.cursor,
        retry_count: resumed.retry_count,
        next_retry_at: resumed.next_retry_at,
      },
    });
  } catch (error) {
    logger.error(`POST /api/anchor/polling/:transaction_id/resume failed`, error);
    res.status(400).json({
      error: 'Failed to resume polling',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/anchor/polling
 * List all polling states for organization
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const organization_id = (req as any).organizationId;
    const { status, page, limit } = req.query;

    const statuses = status ? (typeof status === 'string' ? [status] : status) : undefined;

    const result = await AnchorPollingManager.findByOrganization(organization_id, statuses, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });

    res.json({
      success: true,
      data: result.data.map((s) => ({
        id: s.id,
        transaction_id: s.transaction_id,
        anchor_domain: s.anchor_domain,
        status: s.status,
        cursor: s.cursor,
        last_polled_at: s.last_polled_at,
        retry_count: s.retry_count,
        max_retries: s.max_retries,
        next_retry_at: s.next_retry_at,
        error_message: s.error_message,
        created_at: s.created_at,
        updated_at: s.updated_at,
      })),
      pagination: {
        total: result.total,
        page: Number(page) || 1,
        limit: Number(limit) || 20,
      },
    });
  } catch (error) {
    logger.error('GET /api/anchor/polling failed', error);
    res.status(500).json({
      error: 'Failed to fetch polling states',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/anchor/polling/:transaction_id/mark-completed
 * Mark polling as completed
 */
router.post('/:transaction_id/mark-completed', async (req: Request, res: Response) => {
  try {
    const { transaction_id } = req.params;
    const { anchor_domain } = req.body;
    const organization_id = (req as any).organizationId;

    if (!anchor_domain || typeof anchor_domain !== 'string') {
      return res.status(400).json({ error: 'anchor_domain is required in request body' });
    }

    const updated = await AnchorPollingManager.markCompleted(
      organization_id,
      anchor_domain,
      transaction_id
    );

    res.json({
      success: true,
      message: 'Polling marked as completed',
      data: {
        transaction_id: updated.transaction_id,
        status: updated.status,
        completed_at: updated.updated_at,
      },
    });
  } catch (error) {
    logger.error(`POST /api/anchor/polling/:transaction_id/mark-completed failed`, error);
    res.status(400).json({
      error: 'Failed to mark as completed',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/anchor/polling/:transaction_id/mark-failed
 * Mark polling as failed with error message
 */
router.post('/:transaction_id/mark-failed', async (req: Request, res: Response) => {
  try {
    const { transaction_id } = req.params;
    const { anchor_domain, error_message } = req.body;
    const organization_id = (req as any).organizationId;

    if (!anchor_domain || typeof anchor_domain !== 'string') {
      return res.status(400).json({ error: 'anchor_domain is required in request body' });
    }

    if (!error_message || typeof error_message !== 'string') {
      return res.status(400).json({ error: 'error_message is required in request body' });
    }

    const updated = await AnchorPollingManager.markFailed(
      organization_id,
      anchor_domain,
      transaction_id,
      error_message
    );

    res.json({
      success: true,
      message: 'Polling marked as failed',
      data: {
        transaction_id: updated.transaction_id,
        status: updated.status,
        error_message: updated.error_message,
        failed_at: updated.updated_at,
      },
    });
  } catch (error) {
    logger.error(`POST /api/anchor/polling/:transaction_id/mark-failed failed`, error);
    res.status(400).json({
      error: 'Failed to mark as failed',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/anchor/polling/:transaction_id/mark-timeout
 * Mark polling as timeout
 */
router.post('/:transaction_id/mark-timeout', async (req: Request, res: Response) => {
  try {
    const { transaction_id } = req.params;
    const { anchor_domain } = req.body;
    const organization_id = (req as any).organizationId;

    if (!anchor_domain || typeof anchor_domain !== 'string') {
      return res.status(400).json({ error: 'anchor_domain is required in request body' });
    }

    const updated = await AnchorPollingManager.markTimeout(
      organization_id,
      anchor_domain,
      transaction_id
    );

    res.json({
      success: true,
      message: 'Polling marked as timeout',
      data: {
        transaction_id: updated.transaction_id,
        status: updated.status,
        error_message: updated.error_message,
        timeout_at: updated.updated_at,
      },
    });
  } catch (error) {
    logger.error(`POST /api/anchor/polling/:transaction_id/mark-timeout failed`, error);
    res.status(400).json({
      error: 'Failed to mark as timeout',
      message: (error as Error).message,
    });
  }
});

export default router;
