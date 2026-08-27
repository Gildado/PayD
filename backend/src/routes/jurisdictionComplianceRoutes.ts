/**
 * API routes for Jurisdiction Compliance Report Agent
 */

import { Router } from 'express';
import type { Pool } from 'pg';
import { JurisdictionComplianceController } from '../controllers/jurisdictionComplianceController.js';
import { authMiddleware } from '../middlewares/auth.js';

export function createJurisdictionComplianceRouter(pool: Pool): Router {
  const router = Router();
  const controller = new JurisdictionComplianceController(pool);

  router.get('/compliance/jurisdiction-report', authMiddleware, controller.generateReport);

  return router;
}
