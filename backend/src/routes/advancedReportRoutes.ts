import { Router } from 'express';
import { AdvancedReportService } from '../services/advancedReportService.js';
import type { Pool } from 'pg';

export function createAdvancedReportRouter(pool: Pool): Router {
  const router = Router();
  const reportService = new AdvancedReportService(pool);

  router.get('/payroll-cost-forecast', async (req, res) => {
    try {
      const orgId = Number(req.query.organizationId);
      if (!orgId) {
        return res.status(400).json({ success: false, message: 'organizationId query parameter is required' });
      }
      const report = await reportService.generatePayrollCostForecast(orgId);
      return res.json({ success: true, data: report });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
    }
  });

  return router;
}
