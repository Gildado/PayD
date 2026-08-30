/**
 * Advanced Report Controller
 *
 * Exposes API endpoints for advanced reports including the Monthly Payroll Summary Digest Agent.
 */

import type { Request, Response } from 'express';
import type { Pool } from 'pg';
import { MonthlyPayrollSummaryDigestAgent } from '../services/monthlyPayrollSummaryDigestAgent.js';

export class AdvancedReportController {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  getMonthlyPayrollDigest = async (req: Request, res: Response): Promise<void> => {
    try {
      const organizationId = req.query.organizationId || req.params.organizationId;
      const month = req.query.month as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      if (!organizationId) {
        res.status(400).json({ error: 'organizationId is required' });
        return;
      }

      const agent = new MonthlyPayrollSummaryDigestAgent(this.pool);
      const report = await agent.execute({
        organizationId: Number(organizationId),
        month,
        startDate,
        endDate,
      });

      res.status(200).json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  };
}
