import type { Request, Response } from 'express';
import { AnomalySummaryDigestAgent } from '../services/anomalySummaryDigestAgent.js';
import { pool } from '../config/database.js';

export class AnomalySummaryDigestController {
  static async getDigest(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = req.query.organizationId ? Number(req.query.organizationId) : 1;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const agent = new AnomalySummaryDigestAgent(pool);
      const result = await agent.execute({ organizationId, startDate, endDate });

      res.json({
        success: true,
        data: result.data[0],
        metadata: result.metadata,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
      });
    }
  }
}
