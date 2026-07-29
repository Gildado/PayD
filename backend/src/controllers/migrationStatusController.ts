import { Request, Response, NextFunction } from 'express';
import { MigrationStatusService } from '../services/migrationStatusService.js';
import logger from '../utils/logger.js';

const service = new MigrationStatusService();

export class MigrationStatusController {
  /**
   * GET /api/v1/migrations/status
   * Full migration status: applied, pending, and rollback history.
   */
  static async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await service.getStatus();
      res.json({ success: true, data: report });
    } catch (err) {
      logger.error({ err }, '[MigrationStatusController] getStatus failed');
      next(err);
    }
  }

  /**
   * GET /api/v1/migrations/applied
   * List only migrations that have been applied to this database.
   */
  static async getApplied(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const applied = await service.getApplied();
      res.json({ success: true, data: applied, count: applied.length });
    } catch (err) {
      logger.error({ err }, '[MigrationStatusController] getApplied failed');
      next(err);
    }
  }

  /**
   * GET /api/v1/migrations/rollbacks
   * History of rollback events, ordered most-recent first.
   */
  static async getRollbackHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = Math.min(Number(req.query['limit'] ?? 20), 100);
      const history = await service.getRollbackHistory(limit);
      res.json({ success: true, data: history, count: history.length });
    } catch (err) {
      logger.error({ err }, '[MigrationStatusController] getRollbackHistory failed');
      next(err);
    }
  }

  /**
   * GET /api/v1/migrations/history
   * Full history of migration execution attempts (success/failure/dry-run),
   * ordered most-recent first (#1039).
   */
  static async getRunHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = Math.min(Number(req.query['limit'] ?? 20), 100);
      const history = await service.getRunHistory(limit);
      res.json({ success: true, data: history, count: history.length });
    } catch (err) {
      logger.error({ err }, '[MigrationStatusController] getRunHistory failed');
      next(err);
    }
  }

  /**
   * GET /api/v1/migrations/history/summary
   * Aggregate success/failure counts over the most recent runs, plus the
   * most recent failure (if any) — useful for a single at-a-glance health check.
   */
  static async getRunSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = Math.min(Number(req.query['limit'] ?? 50), 100);
      const summary = await service.getRunSummary(limit);
      res.json({ success: true, data: summary });
    } catch (err) {
      logger.error({ err }, '[MigrationStatusController] getRunSummary failed');
      next(err);
    }
  }
}
