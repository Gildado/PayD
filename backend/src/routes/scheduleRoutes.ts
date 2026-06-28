import { Request, Response, Router } from 'express';
import { PayrollScheduleService } from '../services/payrollScheduleService.js';
import { PayrollSchedulerService } from '../services/payrollSchedulerService.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { authorizeRoles, isolateOrganization } from '../middlewares/rbac.js';
import logger from '../utils/logger.js';

const router = Router();

router.use(authenticateJWT);
router.use(authorizeRoles('EMPLOYER'));
router.use(isolateOrganization);

/**
 * List all payroll schedules for the organization
 * GET /api/schedules
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).organizationId;
    const activeOnly = req.query.active === 'true';

    const schedules = await PayrollScheduleService.listByOrganization(orgId, activeOnly);

    res.json({ success: true, data: schedules });
  } catch (error) {
    logger.error('GET /api/schedules failed', error);
    res.status(500).json({
      error: 'Failed to list schedules',
      message: (error as Error).message,
    });
  }
});

/**
 * Get a specific schedule
 * GET /api/schedules/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const scheduleId = parseInt(req.params.id, 10);
    const schedule = await PayrollScheduleService.getById(scheduleId);

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const orgId = (req as any).organizationId;
    if (schedule.organization_id !== orgId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ success: true, data: schedule });
  } catch (error) {
    logger.error('GET /api/schedules/:id failed', error);
    res.status(500).json({
      error: 'Failed to get schedule',
      message: (error as Error).message,
    });
  }
});

/**
 * Create a new payroll schedule
 * POST /api/schedules
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).organizationId;
    const { name, frequency, timezone, asset_code } = req.body;

    if (!name || !frequency) {
      return res.status(400).json({
        error: 'Missing required fields: name, frequency',
      });
    }

    if (!['weekly', 'biweekly', 'monthly'].includes(frequency)) {
      return res.status(400).json({
        error: 'Invalid frequency. Must be: weekly, biweekly, or monthly',
      });
    }

    const schedule = await PayrollScheduleService.create({
      organization_id: orgId,
      name,
      frequency,
      timezone,
      asset_code,
    });

    // Schedule the recurring job
    await PayrollSchedulerService.scheduleJob(schedule.id);

    res.status(201).json({ success: true, data: schedule });
  } catch (error) {
    logger.error('POST /api/schedules failed', error);
    res.status(500).json({
      error: 'Failed to create schedule',
      message: (error as Error).message,
    });
  }
});

/**
 * Update a payroll schedule
 * PATCH /api/schedules/:id
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const scheduleId = parseInt(req.params.id, 10);
    const existing = await PayrollScheduleService.getById(scheduleId);

    if (!existing) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const orgId = (req as any).organizationId;
    if (existing.organization_id !== orgId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updates = req.body;
    const schedule = await PayrollScheduleService.update(scheduleId, updates);

    // If frequency changed, reschedule the job
    if (updates.frequency) {
      await PayrollSchedulerService.unscheduleJob(scheduleId);
      if (schedule?.is_active) {
        await PayrollSchedulerService.scheduleJob(scheduleId);
      }
    }

    res.json({ success: true, data: schedule });
  } catch (error) {
    logger.error('PATCH /api/schedules/:id failed', error);
    res.status(500).json({
      error: 'Failed to update schedule',
      message: (error as Error).message,
    });
  }
});

/**
 * Deactivate a payroll schedule
 * POST /api/schedules/:id/deactivate
 */
router.post('/:id/deactivate', async (req: Request, res: Response) => {
  try {
    const scheduleId = parseInt(req.params.id, 10);
    const existing = await PayrollScheduleService.getById(scheduleId);

    if (!existing) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const orgId = (req as any).organizationId;
    if (existing.organization_id !== orgId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await PayrollSchedulerService.unscheduleJob(scheduleId);
    const schedule = await PayrollScheduleService.deactivate(scheduleId);

    res.json({ success: true, data: schedule });
  } catch (error) {
    logger.error('POST /api/schedules/:id/deactivate failed', error);
    res.status(500).json({
      error: 'Failed to deactivate schedule',
      message: (error as Error).message,
    });
  }
});

/**
 * Delete a payroll schedule
 * DELETE /api/schedules/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const scheduleId = parseInt(req.params.id, 10);
    const existing = await PayrollScheduleService.getById(scheduleId);

    if (!existing) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const orgId = (req as any).organizationId;
    if (existing.organization_id !== orgId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await PayrollSchedulerService.unscheduleJob(scheduleId);
    await PayrollScheduleService.delete(scheduleId);

    res.json({ success: true, message: 'Schedule deleted' });
  } catch (error) {
    logger.error('DELETE /api/schedules/:id failed', error);
    res.status(500).json({
      error: 'Failed to delete schedule',
      message: (error as Error).message,
    });
  }
});

/**
 * Manually trigger a schedule run
 * POST /api/schedules/:id/trigger
 */
router.post('/:id/trigger', async (req: Request, res: Response) => {
  try {
    const scheduleId = parseInt(req.params.id, 10);
    const existing = await PayrollScheduleService.getById(scheduleId);

    if (!existing) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const orgId = (req as any).organizationId;
    if (existing.organization_id !== orgId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!existing.is_active) {
      return res.status(400).json({ error: 'Schedule is not active' });
    }

    await PayrollSchedulerService.processScheduledRun({
      scheduleId: existing.id,
      organizationId: existing.organization_id,
      scheduledAt: new Date().toISOString(),
    });

    res.json({ success: true, message: 'Schedule triggered successfully' });
  } catch (error) {
    logger.error('POST /api/schedules/:id/trigger failed', error);
    res.status(500).json({
      error: 'Failed to trigger schedule',
      message: (error as Error).message,
    });
  }
});

export default router;
