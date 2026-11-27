import { Router, Request, Response } from 'express';
import { ClaimableBalanceService } from '../services/claimableBalanceService.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { isolateOrganization, authorizeRoles } from '../middlewares/rbac.js';
import { pool } from '../config/database.js';
import { Keypair } from '@stellar/stellar-sdk';
import { validate } from '../middlewares/validate.js';
import { createClaimSchema, claimQuerySchema } from '../schemas/routeSchemas.js';
import logger from '../utils/logger.js';

const router = Router();

router.use(authenticateJWT);
router.use(isolateOrganization);

router.post('/', validate(createClaimSchema), async (req: Request, res: Response) => {
  try {
    const {
      employee_id,
      payroll_run_id,
      payroll_item_id,
      claimant_public_key,
      amount,
      asset_code,
      asset_issuer,
      sponsor_secret,
      claim_instructions,
      expires_in_days,
    } = req.body;

    const organization_id = req.organizationId;

    let sponsorKeypair: Keypair;
    try {
      sponsorKeypair = Keypair.fromSecret(sponsor_secret);
    } catch {
      return res.status(400).json({ error: 'Invalid sponsor secret key' });
    }

    const result = await ClaimableBalanceService.create({
      organization_id,
      employee_id,
      payroll_run_id,
      payroll_item_id,
      claimant_public_key,
      amount,
      asset_code,
      asset_issuer,
      sponsor_keypair: sponsorKeypair,
      claim_instructions,
      expires_in_days,
    });

    res.status(201).json({
      success: true,
      data: {
        id: result.record.id,
        balance_id: result.balance_id,
        amount: result.record.amount,
        asset_code: result.record.asset_code,
        claimant_public_key: result.record.claimant_public_key,
        status: result.record.status,
        claim_instructions: result.record.claim_instructions,
      },
    });
  } catch (error) {
    logger.error('POST /api/claims failed', error);
    res.status(500).json({
      error: 'Failed to create claimable balance',
      message: (error as Error).message,
    });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const organization_id = req.organizationId;
    const { status, page, limit } = req.query;

    const result = await ClaimableBalanceService.findPendingByOrganization(organization_id, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });

    res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: Number(page) || 1,
        limit: Number(limit) || 20,
      },
    });
  } catch (error) {
    logger.error('GET /api/claims failed', error);
    res.status(500).json({
      error: 'Failed to fetch claimable balances',
      message: (error as Error).message,
    });
  }
});

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const organization_id = req.organizationId;

    const summary = await ClaimableBalanceService.getPendingClaimsSummary(organization_id);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error('GET /api/claims/summary failed', error);
    res.status(500).json({
      error: 'Failed to fetch claims summary',
      message: (error as Error).message,
    });
  }
});

router.get('/employee/:employeeId', async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const organization_id = req.organizationId;
    const { status, page, limit } = req.query;

    const result = await ClaimableBalanceService.findByEmployee(
      Number(employeeId),
      organization_id,
      {
        status: status as string,
        page: Number(page) || 1,
        limit: Number(limit) || 20,
      }
    );

    res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: Number(page) || 1,
        limit: Number(limit) || 20,
      },
    });
  } catch (error) {
    logger.error(`GET /api/claims/employee/${req.params.employeeId} failed`, error);
    res.status(500).json({
      error: 'Failed to fetch employee claims',
      message: (error as Error).message,
    });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const organization_id = req.organizationId;

    const record = await ClaimableBalanceService.findById(Number(id), organization_id);

    if (!record) {
      return res.status(404).json({ error: 'Claimable balance not found' });
    }

    res.json({
      success: true,
      data: record,
    });
  } catch (error) {
    logger.error(`GET /api/claims/${req.params.id} failed`, error);
    res.status(500).json({
      error: 'Failed to fetch claimable balance',
      message: (error as Error).message,
    });
  }
});

router.post('/:id/mark-claimed', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const organization_id = req.organizationId;

    const record = await ClaimableBalanceService.findById(Number(id), organization_id);

    if (!record) {
      return res.status(404).json({ error: 'Claimable balance not found' });
    }

    const updated = await ClaimableBalanceService.markAsClaimed(record.balance_id);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    logger.error(`POST /api/claims/${req.params.id}/mark-claimed failed`, error);
    res.status(500).json({
      error: 'Failed to mark claimable balance as claimed',
      message: (error as Error).message,
    });
  }
});

router.post('/:id/notify', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const organization_id = req.organizationId;

    const record = await ClaimableBalanceService.findById(Number(id), organization_id);

    if (!record) {
      return res.status(404).json({ error: 'Claimable balance not found' });
    }

    await ClaimableBalanceService.markNotificationSent(record.balance_id);

    const employee = record.employee_id
      ? await pool.query('SELECT * FROM employees WHERE id = $1', [record.employee_id])
      : null;

    res.json({
      success: true,
      message: 'Notification sent',
      data: {
        balance_id: record.balance_id,
        claimant_email: employee?.rows[0]?.email || null,
        claimant_public_key: record.claimant_public_key,
      },
    });
  } catch (error) {
    logger.error(`POST /api/claims/${req.params.id}/notify failed`, error);
    res.status(500).json({
      error: 'Failed to send notification',
      message: (error as Error).message,
    });
  }
});

router.get('/instructions/generate', async (req: Request, res: Response) => {
  try {
    const { asset_code, asset_issuer, amount } = req.query;

    if (!asset_code) {
      return res.status(400).json({ error: 'asset_code is required' });
    }

    const instructions = ClaimableBalanceService.generateClaimInstructions(
      asset_code as string,
      asset_issuer as string | undefined,
      amount as string | undefined
    );

    res.json({
      success: true,
      data: { instructions },
    });
  } catch (error) {
    logger.error('GET /api/claims/instructions/generate failed', error);
    res.status(500).json({
      error: 'Failed to generate claim instructions',
      message: (error as Error).message,
    });
  }
});

router.post('/check-expired', async (req: Request, res: Response) => {
  try {
    const expiredCount = await ClaimableBalanceService.checkAndUpdateExpiredBalances();

    res.json({
      success: true,
      data: { expired_count: expiredCount },
    });
  } catch (error) {
    logger.error('POST /api/claims/check-expired failed', error);
    res.status(500).json({
      error: 'Failed to check expired balances',
      message: (error as Error).message,
    });
  }
});

// New endpoints for reclaim and expiry notification

router.get('/expiring-soon', async (req: Request, res: Response) => {
  try {
    const organization_id = (req as any).organizationId;
    const { days, page, limit } = req.query;

    const expiresWithinDays = Number(days) || 7;

    const result = await ClaimableBalanceService.getExpiringSoon(organization_id, expiresWithinDays, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });

    res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: Number(page) || 1,
        limit: Number(limit) || 20,
      },
    });
  } catch (error) {
    logger.error('GET /api/claims/expiring-soon failed', error);
    res.status(500).json({
      error: 'Failed to fetch expiring balances',
      message: (error as Error).message,
    });
  }
});

router.post('/:id/notify-expiry', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const organization_id = (req as any).organizationId;

    const record = await ClaimableBalanceService.findById(Number(id), organization_id);

    if (!record) {
      return res.status(404).json({ error: 'Claimable balance not found' });
    }

    if (record.expiry_notification_sent_at) {
      return res.status(409).json({
        error: 'Expiry notification already sent',
        sent_at: record.expiry_notification_sent_at,
      });
    }

    await ClaimableBalanceService.markExpiryNotificationSent(record.balance_id);

    // Trigger webhook
    const employee = record.employee_id
      ? await pool.query('SELECT * FROM employees WHERE id = $1', [record.employee_id])
      : null;

    res.json({
      success: true,
      message: 'Expiry notification marked as sent',
      data: {
        balance_id: record.balance_id,
        claimant_email: employee?.rows[0]?.email || null,
        expires_at: record.expires_at,
      },
    });
  } catch (error) {
    logger.error(`POST /api/claims/${req.params.id}/notify-expiry failed`, error);
    res.status(500).json({
      error: 'Failed to mark expiry notification',
      message: (error as Error).message,
    });
  }
});

router.post('/:id/reclaim', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { issuer_secret, reason } = req.body;
    const organization_id = (req as any).organizationId;

    const record = await ClaimableBalanceService.findById(Number(id), organization_id);

    if (!record) {
      return res.status(404).json({ error: 'Claimable balance not found' });
    }

    if (record.status !== 'pending') {
      return res.status(409).json({
        error: `Cannot reclaim balance with status: ${record.status}`,
      });
    }

    if (!issuer_secret) {
      return res.status(400).json({
        error: 'issuer_secret is required to sign reclaim transaction',
      });
    }

    let issuerKeypair: Keypair;
    try {
      issuerKeypair = Keypair.fromSecret(issuer_secret);
    } catch {
      return res.status(400).json({ error: 'Invalid issuer secret key' });
    }

    const result = await ClaimableBalanceService.reclaimBalance(
      record.balance_id,
      issuerKeypair,
      reason
    );

    res.status(200).json({
      success: true,
      message: 'Balance successfully reclaimed',
      data: {
        transaction_hash: result.hash,
        balance_id: result.record.balance_id,
        amount: result.record.amount,
        asset_code: result.record.asset_code,
        status: 'clawed_back',
      },
    });
  } catch (error) {
    logger.error(`POST /api/claims/${req.params.id}/reclaim failed`, error);
    res.status(400).json({
      error: 'Failed to reclaim balance',
      message: (error as Error).message,
    });
  }
});

router.get('/:id/predicate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const organization_id = (req as any).organizationId;

    const record = await ClaimableBalanceService.findById(Number(id), organization_id);

    if (!record) {
      return res.status(404).json({ error: 'Claimable balance not found' });
    }

    const predicate = await ClaimableBalanceService.getPredicate(record.balance_id);

    res.json({
      success: true,
      data: predicate,
    });
  } catch (error) {
    logger.error(`GET /api/claims/${req.params.id}/predicate failed`, error);
    res.status(500).json({
      error: 'Failed to fetch predicate',
      message: (error as Error).message,
    });
  }
});

export default router;
