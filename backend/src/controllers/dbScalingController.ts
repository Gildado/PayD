import type { Request, Response, NextFunction } from 'express';
import { DbScalingService } from '../services/dbScalingService.js';
import logger from '../utils/logger.js';

const service = new DbScalingService();

export class DbScalingController {
  async getPoolStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await service.getPoolStats();
      res.json({ success: true, data: stats });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch pool stats');
      next(err);
    }
  }

  async healthCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await service.runHealthCheck();
      const status = result.ok ? 200 : 503;
      res.status(status).json({ success: result.ok, data: result });
    } catch (err) {
      logger.error({ err }, 'DB health check error');
      next(err);
    }
  }

  async getSlowQueries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const threshold = Number(req.query['threshold'] ?? 1000);
      const limit = Math.min(Number(req.query['limit'] ?? 20), 100);

      if (isNaN(threshold) || threshold < 0) {
        res.status(400).json({ success: false, error: 'threshold must be a non-negative number' });
        return;
      }

      const queries = await service.getSlowQueries(threshold, limit);
      res.json({ success: true, data: queries });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch slow queries');
      next(err);
    }
  }

  async getIndexUsage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const usage = await service.getIndexUsage();
      res.json({ success: true, data: usage });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch index usage');
      next(err);
    }
  }

  async getPoolConfig(req: Request, res: Response): Promise<void> {
    const config = service.getPoolConfig();
    res.json({ success: true, data: config });
  }

  /** #289 */
  async getTableBloat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await service.getTableBloat();
      res.json({ success: true, data });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch table bloat stats');
      next(err);
    }
  }

  /** #290 */
  async getCacheHitRate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await service.getCacheHitRate();
      res.json({ success: true, data });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch cache hit rate');
      next(err);
    }
  }

  /** #291 */
  async getLongRunningTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const minSec = Math.max(0, Number(req.query['minDurationSec'] ?? 10));
      const data = await service.getLongRunningTransactions(minSec);
      res.json({ success: true, data });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch long-running transactions');
      next(err);
    }
  }

  /** #292 */
  async getVacuumStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await service.getVacuumStats();
      res.json({ success: true, data });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch vacuum stats');
      next(err);
    }
  }

  // ── Part 37 (#282) ─────────────────────────────────────────────────────

  /** #282a — Connections grouped by state and application name. */
  async getConnectionBreakdown(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await service.getConnectionBreakdown();
      res.json({ success: true, data });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch connection breakdown');
      next(err);
    }
  }

  /** #282b — Scaling-relevant pg_settings parameters. */
  async getDbSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await service.getDbSettings();
      res.json({ success: true, data });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch db settings');
      next(err);
    }
  }

  // ── Part 38 (#283) ─────────────────────────────────────────────────────

  /** #283a — Tables with high sequential scan counts. */
  async getSeqScanStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = Math.min(Number(req.query['limit'] ?? 20), 100);
      if (isNaN(limit) || limit < 1) {
        res.status(400).json({ success: false, error: 'limit must be a positive integer' });
        return;
      }
      const data = await service.getSeqScanStats(limit);
      res.json({ success: true, data });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch sequential scan stats');
      next(err);
    }
  }

  /** #283b — WAL generation statistics. */
  async getWalStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await service.getWalStats();
      res.json({ success: true, data });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch WAL stats');
      next(err);
    }
  }

  // ── Part 42 (#287) ─────────────────────────────────────────────────────

  /** #287a — Background writer and checkpoint statistics. */
  async getBgwriterStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await service.getBgwriterStats();
      res.json({ success: true, data });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch bgwriter stats');
      next(err);
    }
  }

  /** #287b — Temporary file usage for the current database. */
  async getTempFileUsage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await service.getTempFileUsage();
      res.json({ success: true, data });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch temp file usage');
      next(err);
    }
  }

  // ── Part 50 (#295) ─────────────────────────────────────────────────────

  /** #295a — Database-wide transaction and conflict statistics. */
  async getDatabaseStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await service.getDatabaseStats();
      res.json({ success: true, data });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch database stats');
      next(err);
    }
  }

  /** #295b — Block I/O timing statistics. */
  async getBlockIoStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await service.getBlockIoStats();
      res.json({ success: true, data });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch block I/O stats');
      next(err);
    }
  }

  // ── Part 39 (#284) ─────────────────────────────────────────────────────

  /** #284a — Lock contention between concurrent backends. */
  async getLockContention(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await service.getLockContention();
      res.json({ success: true, data });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch lock contention');
      next(err);
    }
  }

  /** #284b — Unused indexes (zero scans since last stats reset). */
  async getUnusedIndexes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await service.getUnusedIndexes();
      res.json({ success: true, data });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch unused indexes');
      next(err);
    }
  }

  // ── Part 40 (#285) ─────────────────────────────────────────────────────

  /** #285a — Streaming replication lag per standby replica. */
  async getReplicationLag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await service.getReplicationLag();
      res.json({ success: true, data });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch replication lag');
      next(err);
    }
  }

  // ── Part 41 (#286) ─────────────────────────────────────────────────────

  /** #286a — Background writer and checkpoint statistics. */
  async getBgwriterStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await service.getBgwriterStats();
      res.json({ success: true, data });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch bgwriter stats');
      next(err);
    }
  }

  /** #286b — Database-level statistics (transactions, cache hit ratio, deadlocks, temp files). */
  async getDatabaseStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await service.getDatabaseStats();
      res.json({ success: true, data });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch database stats');
      next(err);
    }
  }

  // ── Part 49 (#294) ─────────────────────────────────────────────────────

  /** #294a — Per-table I/O stats (heap, index, TOAST blocks read vs hit). */
  async getTableIoStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = Math.min(Number(req.query['limit'] ?? 30), 100);
      if (isNaN(limit) || limit < 1) {
        res.status(400).json({ success: false, error: 'limit must be a positive integer' });
        return;
      }
      const data = await service.getTableIoStats(limit);
      res.json({ success: true, data });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch table I/O stats');
      next(err);
    }
  }

  /** #294b — Per-index access stats (scan count, rows read/fetched). */
  async getIndexUsageStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = Math.min(Number(req.query['limit'] ?? 30), 100);
      if (isNaN(limit) || limit < 1) {
        res.status(400).json({ success: false, error: 'limit must be a positive integer' });
        return;
      }
      const data = await service.getIndexUsageStats(limit);
      res.json({ success: true, data });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch index usage stats');
      next(err);
    }
  }

  /** #285b — Per-table disk usage (table + indexes + TOAST). */
  async getTableSizes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = Math.min(Number(req.query['limit'] ?? 30), 100);
      if (isNaN(limit) || limit < 1) {
        res.status(400).json({ success: false, error: 'limit must be a positive integer' });
        return;
      }
      const data = await service.getTableSizes(limit);
      res.json({ success: true, data });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch table sizes');
      next(err);
    }
  }
}
