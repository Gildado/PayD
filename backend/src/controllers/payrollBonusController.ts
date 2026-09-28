import { Request, Response } from 'express';
import { PayrollBonusService } from '../services/payrollBonusService.js';
import { PayrollAuditService } from '../services/payrollAuditService.js';
import logger from '../utils/logger.js';

export class PayrollBonusController {
  static async createPayrollRun(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      const { periodStart, periodEnd, assetCode } = req.body;

      if (!organizationId || !periodStart || !periodEnd) {
        res.status(400).json({
          error:
            'Missing required fields: periodStart, periodEnd (user must belong to an organization)',
        });
        return;
      }

      const payrollRun = await PayrollBonusService.createPayrollRun(
        organizationId,
        new Date(periodStart),
        new Date(periodEnd),
        assetCode || 'XLM'
      );

      await PayrollAuditService.logRunCreated(
        organizationId,
        payrollRun.id,
        { type: 'user', id: req.user?.id?.toString(), email: req.user?.email },
        { ipAddress: req.ip, userAgent: req.get('user-agent') }
      );

      res.status(201).json({
        success: true,
        data: payrollRun,
      });
    } catch (error) {
      logger.error('Failed to create payroll run', error);
      res.status(500).json({
        error: 'Failed to create payroll run',
        message: (error as Error).message,
      });
    }
  }

  static async getPayrollRun(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organizationId;
      const run = await PayrollBonusService.getPayrollRunById(parseInt(id as string, 10));
      if (!run || run.organization_id !== organizationId) {
        res.status(404).json({ error: 'Payroll run not found' });
        return;
      }

      const summary = await PayrollBonusService.getPayrollRunSummary(parseInt(id as string, 10));

      if (!summary) {
        res.status(404).json({ error: 'Payroll run not found' });
        return;
      }

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error('Failed to get payroll run', error);
      res.status(500).json({
        error: 'Failed to get payroll run',
        message: (error as Error).message,
      });
    }
  }

  static async listPayrollRuns(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      const { page, limit } = req.query;

      if (!organizationId) {
        res.status(400).json({ error: 'User must belong to an organization' });
        return;
      }

      const result = await PayrollBonusService.listPayrollRuns(
        organizationId,
        parseInt(page as string, 10) || 1,
        parseInt(limit as string, 10) || 20
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to list payroll runs', error);
      res.status(500).json({
        error: 'Failed to list payroll runs',
        message: (error as Error).message,
      });
    }
  }

  static async addBonusItem(req: Request, res: Response): Promise<void> {
    try {
      const { payrollRunId, employeeId, amount, description, metadata } = req.body;
      const organizationId = req.user?.organizationId;

      if (!payrollRunId || !employeeId || !amount) {
        res.status(400).json({
          error: 'Missing required fields: payrollRunId, employeeId, amount',
        });
        return;
      }

      // Verify payroll run belongs to organization
      const run = await PayrollBonusService.getPayrollRunById(payrollRunId);
      if (!run || run.organization_id !== organizationId) {
        res.status(404).json({ error: 'Payroll run not found' });
        return;
      }

      const item = await PayrollBonusService.addBonusItem({
        payroll_run_id: payrollRunId,
        employee_id: employeeId,
        amount,
        description,
        metadata,
      });

      // Log audit entry for bonus item addition
      await PayrollAuditService.logItemAdded(
        organizationId!,
        payrollRunId,
        item.id,
        employeeId,
        amount,
        run.asset_code,
        { type: 'user', id: req.user?.id?.toString(), email: req.user?.email },
        {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          itemType: 'bonus',
          description,
          payoutMetadata: metadata,
        }
      );

      res.status(201).json({
        success: true,
        data: item,
      });
    } catch (error) {
      logger.error('Failed to add bonus item', error);
      res.status(500).json({
        error: 'Failed to add bonus item',
        message: (error as Error).message,
      });
    }
  }

  static async addBatchBonusItems(req: Request, res: Response): Promise<void> {
    try {
      const { payrollRunId, items } = req.body;
      const organizationId = req.user?.organizationId;

      if (!payrollRunId || !items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          error: 'Missing required fields: payrollRunId, items (array)',
        });
        return;
      }

      for (const item of items) {
        if (!item.employeeId || !item.amount) {
          res.status(400).json({
            error: 'Each item must have employeeId and amount',
          });
          return;
        }
      }

      // Verify payroll run belongs to organization
      const run = await PayrollBonusService.getPayrollRunById(payrollRunId);
      if (!run || run.organization_id !== organizationId) {
        res.status(404).json({ error: 'Payroll run not found' });
        return;
      }

      const formattedItems = items.map((item) => ({
        employee_id: item.employeeId,
        amount: item.amount,
        description: item.description,
        metadata: item.metadata,
      }));

      const insertedItems = await PayrollBonusService.addBatchBonusItems(
        payrollRunId,
        formattedItems
      );

      // Log audit entries for each bonus item
      for (let i = 0; i < insertedItems.length; i++) {
        const item = insertedItems[i]!;
        const originalItem = items[i]!;

        await PayrollAuditService.logItemAdded(
          organizationId!,
          payrollRunId,
          item.id,
          item.employee_id,
          item.amount,
          run.asset_code,
          { type: 'user', id: req.user?.id?.toString(), email: req.user?.email },
          {
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            itemType: 'bonus',
            description: originalItem.description,
            payoutMetadata: originalItem.metadata,
          }
        );
      }

      res.status(201).json({
        success: true,
        data: insertedItems,
        count: insertedItems.length,
      });
    } catch (error) {
      logger.error('Failed to add batch bonus items', error);
      res.status(500).json({
        error: 'Failed to add batch bonus items',
        message: (error as Error).message,
      });
    }
  }

  static async getPayrollItems(req: Request, res: Response): Promise<void> {
    try {
      const { payrollRunId } = req.params;
      const { itemType } = req.query;

      const items = await PayrollBonusService.getPayrollItems(
        parseInt(payrollRunId as string, 10),
        itemType as 'base' | 'bonus' | undefined
      );

      res.json({
        success: true,
        data: items,
        count: items.length,
      });
    } catch (error) {
      logger.error('Failed to get payroll items', error);
      res.status(500).json({
        error: 'Failed to get payroll items',
        message: (error as Error).message,
      });
    }
  }

  static async deletePayrollItem(req: Request, res: Response): Promise<void> {
    try {
      const { itemId } = req.params;
      const organizationId = req.user?.organizationId;
      const itemIdInt = parseInt(itemId as string, 10);

      // Fetch item before deletion so we can log it
      const item = await PayrollBonusService.getPayrollItemById(itemIdInt);

      if (!item) {
        res.status(404).json({ error: 'Payroll item not found' });
        return;
      }

      const deleted = await PayrollBonusService.deletePayrollItem(itemIdInt);

      if (!deleted) {
        res.status(404).json({ error: 'Payroll item not found' });
        return;
      }

      // Log audit entry for item deletion
      if (organizationId) {
        await PayrollAuditService.log({
          organizationId,
          payrollRunId: item.payroll_run_id,
          payrollItemId: itemIdInt,
          employeeId: item.employee_id,
          action: 'item_deleted',
          actorType: 'user',
          actorId: req.user?.id?.toString(),
          actorEmail: req.user?.email,
          amount: item.amount,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          metadata: { item_type: item.item_type },
        });
      }

      res.json({
        success: true,
        message: 'Payroll item deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete payroll item', error);
      res.status(500).json({
        error: 'Failed to delete payroll item',
        message: (error as Error).message,
      });
    }
  }

  static async updatePayrollRunStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const organizationId = req.user?.organizationId;

      if (!status || !['draft', 'pending', 'processing', 'completed', 'failed'].includes(status)) {
        res.status(400).json({
          error: 'Invalid status. Must be one of: draft, pending, processing, completed, failed',
        });
        return;
      }

      const existing = await PayrollBonusService.getPayrollRunById(parseInt(id as string, 10));
      if (!existing || existing.organization_id !== organizationId) {
        res.status(404).json({ error: 'Payroll run not found' });
        return;
      }

      const payrollRun = await PayrollBonusService.updatePayrollRunStatus(
        parseInt(id as string, 10),
        status
      );

      if (!payrollRun) {
        res.status(404).json({ error: 'Payroll run not found' });
        return;
      }

      await PayrollAuditService.logRunStatusChanged(
        organizationId,
        payrollRun.id,
        existing.status,
        payrollRun.status,
        { type: 'user', id: req.user?.id?.toString(), email: req.user?.email },
        { ipAddress: req.ip, userAgent: req.get('user-agent') }
      );

      res.json({
        success: true,
        data: payrollRun,
      });
    } catch (error) {
      logger.error('Failed to update payroll run status', error);
      res.status(500).json({
        error: 'Failed to update payroll run status',
        message: (error as Error).message,
      });
    }
  }

  static async listBonusesByType(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      const { bonusType } = req.params;
      const { page, limit } = req.query;

      if (!organizationId) {
        res.status(400).json({ error: 'User must belong to an organization' });
        return;
      }

      const validTypes = ['performance', 'referral', 'project', 'retention', 'spot', 'other'];
      if (!validTypes.includes(bonusType as string)) {
        res
          .status(400)
          .json({ error: `Invalid bonus_type. Must be one of: ${validTypes.join(', ')}` });
        return;
      }

      const result = await PayrollBonusService.listBonusesByType(
        organizationId,
        bonusType as any,
        Number.parseInt(page as string, 10) || 1,
        Number.parseInt(limit as string, 10) || 20
      );

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Failed to list bonuses by type', error);
      res
        .status(500)
        .json({ error: 'Failed to list bonuses by type', message: (error as Error).message });
    }
  }

  static async getPerformanceBonuses(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      const { minScore, page, limit } = req.query;

      if (!organizationId) {
        res.status(400).json({ error: 'User must belong to an organization' });
        return;
      }

      const parsedMinScore = minScore !== undefined ? Number(minScore) : 0;
      if (isNaN(parsedMinScore) || parsedMinScore < 0 || parsedMinScore > 100) {
        res.status(400).json({ error: 'minScore must be a number between 0 and 100' });
        return;
      }

      const result = await PayrollBonusService.getPerformanceBonusesByScore(
        organizationId,
        parsedMinScore,
        Number.parseInt(page as string, 10) || 1,
        Number.parseInt(limit as string, 10) || 20
      );

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Failed to get performance bonuses', error);
      res
        .status(500)
        .json({ error: 'Failed to get performance bonuses', message: (error as Error).message });
    }
  }

  static async getBonusHistory(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      const { page, limit } = req.query;

      if (!organizationId) {
        res.status(400).json({ error: 'User must belong to an organization' });
        return;
      }

      const result = await PayrollBonusService.getOrganizationBonusHistory(
        organizationId,
        parseInt(page as string, 10) || 1,
        parseInt(limit as string, 10) || 20
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to get bonus history', error);
      res.status(500).json({
        error: 'Failed to get bonus history',
        message: (error as Error).message,
      });
    }
  }
}
