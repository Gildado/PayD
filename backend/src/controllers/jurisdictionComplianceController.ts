/**
 * Controller for Jurisdiction Compliance Report Agent
 */

import type { Request, Response } from 'express';
import type { Pool } from 'pg';
import { JurisdictionComplianceReportAgent } from '../services/jurisdictionComplianceReportAgent.js';

export class JurisdictionComplianceController {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  generateReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const organizationId = Number(req.query.organizationId || (req as any).user?.organizationId);
      if (!organizationId) {
        res.status(400).json({ error: 'organizationId query parameter or auth context is required' });
        return;
      }

      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const agent = new JurisdictionComplianceReportAgent(this.pool);
      const result = await agent.execute({ organizationId, startDate, endDate });

      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  };
}
