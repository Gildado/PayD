/**
 * Advanced Report Routes
 */

import { Router } from 'express';
import type { Pool } from 'pg';
import { AdvancedReportController } from '../controllers/advancedReportController.js';

export function createAdvancedReportRouter(pool: Pool): Router {
  const router = Router();
  const controller = new AdvancedReportController(pool);

  router.get('/payroll/monthly-digest', controller.getMonthlyPayrollDigest);

  return router;
}

export default createAdvancedReportRouter;
