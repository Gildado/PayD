import { Router } from 'express';
import { DbScalingController } from '../controllers/dbScalingController.js';

const router = Router();
const ctrl = new DbScalingController();

/**
 * @swagger
 * tags:
 *   name: DB Scaling
 *   description: Database connection pool and performance monitoring (Issue #260 Part 15)
 */

/**
 * @swagger
 * /api/v1/db-scaling/pool:
 *   get:
 *     summary: Get current database connection pool stats
 *     tags: [DB Scaling]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pool stats returned successfully
 *       500:
 *         description: Internal server error
 */
router.get('/pool', (req, res, next) => ctrl.getPoolStats(req, res, next));

/**
 * @swagger
 * /api/v1/db-scaling/health:
 *   get:
 *     summary: Database connectivity health check with latency
 *     tags: [DB Scaling]
 *     responses:
 *       200:
 *         description: Database is reachable
 *       503:
 *         description: Database is unreachable
 */
router.get('/health', (req, res, next) => ctrl.healthCheck(req, res, next));

/**
 * @swagger
 * /api/v1/db-scaling/slow-queries:
 *   get:
 *     summary: List queries exceeding a mean execution time threshold
 *     tags: [DB Scaling]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: threshold
 *         schema:
 *           type: number
 *         description: Mean execution time threshold in ms (default 1000)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         description: Max rows to return (default 20, max 100)
 *     responses:
 *       200:
 *         description: Slow query list
 *       400:
 *         description: Invalid query parameters
 */
router.get('/slow-queries', (req, res, next) => ctrl.getSlowQueries(req, res, next));

/**
 * @swagger
 * /api/v1/db-scaling/index-usage:
 *   get:
 *     summary: Return index usage statistics from pg_stat_user_indexes
 *     tags: [DB Scaling]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Index usage data
 */
router.get('/index-usage', (req, res, next) => ctrl.getIndexUsage(req, res, next));

/**
 * @swagger
 * /api/v1/db-scaling/config:
 *   get:
 *     summary: Return current connection pool configuration
 *     tags: [DB Scaling]
 *     responses:
 *       200:
 *         description: Pool min/max configuration
 */
router.get('/config', (req, res) => ctrl.getPoolConfig(req, res));

// Issue #289 — table bloat
router.get('/table-bloat', (req, res, next) => ctrl.getTableBloat(req, res, next));

// Issue #290 — cache hit rate
router.get('/cache-hit-rate', (req, res, next) => ctrl.getCacheHitRate(req, res, next));

// Issue #291 — long-running transactions (?minDurationSec=10)
router.get('/long-running-transactions', (req, res, next) => ctrl.getLongRunningTransactions(req, res, next));

// Issue #292 — vacuum / analyse stats
router.get('/vacuum-stats', (req, res, next) => ctrl.getVacuumStats(req, res, next));

// ── Part 37 (#282) ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/db-scaling/connection-breakdown:
 *   get:
 *     summary: Active connections grouped by state and application (Part 37)
 *     description: >
 *       Aggregates pg_stat_activity rows for the current database by backend
 *       state and application_name. Useful for spotting connection leaks or
 *       idle-in-transaction buildup per client.
 *     tags: [DB Scaling]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Connection breakdown rows
 *       500:
 *         description: Internal server error
 */
router.get('/connection-breakdown', (req, res, next) => ctrl.getConnectionBreakdown(req, res, next));

/**
 * @swagger
 * /api/v1/db-scaling/db-settings:
 *   get:
 *     summary: Scaling-relevant PostgreSQL configuration parameters (Part 37)
 *     description: >
 *       Returns a curated subset of pg_settings that affect connection pooling,
 *       memory allocation, WAL sizing, autovacuum, and query timeouts.
 *     tags: [DB Scaling]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Database settings list
 *       500:
 *         description: Internal server error
 */
router.get('/db-settings', (req, res, next) => ctrl.getDbSettings(req, res, next));

// ── Part 38 (#283) ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/db-scaling/seq-scan-stats:
 *   get:
 *     summary: Tables with high sequential scan counts (Part 38)
 *     description: >
 *       Lists user tables ordered by seq_scan descending. A high seqScanRatio
 *       indicates missing or unused indexes worth investigating.
 *     tags: [DB Scaling]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Sequential scan statistics per table
 *       400:
 *         description: Invalid limit parameter
 *       500:
 *         description: Internal server error
 */
router.get('/seq-scan-stats', (req, res, next) => ctrl.getSeqScanStats(req, res, next));

/**
 * @swagger
 * /api/v1/db-scaling/wal-stats:
 *   get:
 *     summary: WAL generation statistics since last stats reset (Part 38)
 *     description: >
 *       Queries pg_stat_wal for cumulative WAL records, bytes written,
 *       buffer overflows, and write/sync timing.
 *     tags: [DB Scaling]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: WAL statistics snapshot
 *       500:
 *         description: Internal server error
 */
router.get('/wal-stats', (req, res, next) => ctrl.getWalStats(req, res, next));

// ── Part 42 (#287) ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/db-scaling/bgwriter-stats:
 *   get:
 *     summary: Background writer and checkpoint statistics (Part 42)
 *     description: >
 *       Queries pg_stat_bgwriter for checkpoint counts, buffer writes,
 *       and allocation metrics since the last stats reset.
 *     tags: [DB Scaling]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bgwriter statistics snapshot
 *       500:
 *         description: Internal server error
 */
router.get('/bgwriter-stats', (req, res, next) => ctrl.getBgwriterStats(req, res, next));

/**
 * @swagger
 * /api/v1/db-scaling/temp-file-usage:
 *   get:
 *     summary: Temporary file spill usage for the current database (Part 42)
 *     description: >
 *       Returns temp_files and temp_bytes from pg_stat_database. High values
 *       indicate queries exceeding work_mem and spilling sorts/hashes to disk.
 *     tags: [DB Scaling]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Temp file usage snapshot
 *       500:
 *         description: Internal server error
 */
router.get('/temp-file-usage', (req, res, next) => ctrl.getTempFileUsage(req, res, next));

// ── Part 50 (#295) ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/db-scaling/database-stats:
 *   get:
 *     summary: Database-wide transaction and conflict statistics (Part 50)
 *     description: >
 *       Aggregates xact_commit/rollback, block cache hit ratio, deadlocks,
 *       and temp usage from pg_stat_database for the current database.
 *     tags: [DB Scaling]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Database statistics snapshot
 *       500:
 *         description: Internal server error
 */
router.get('/database-stats', (req, res, next) => ctrl.getDatabaseStats(req, res, next));

/**
 * @swagger
 * /api/v1/db-scaling/block-io-stats:
 *   get:
 *     summary: Block I/O and session timing statistics (Part 50)
 *     description: >
 *       Returns cumulative blk_read_time, blk_write_time, session_time,
 *       active_time, and idle_in_transaction_time from pg_stat_database.
 *     tags: [DB Scaling]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Block I/O timing snapshot
 *       500:
 *         description: Internal server error
 */
router.get('/block-io-stats', (req, res, next) => ctrl.getBlockIoStats(req, res, next));

// ── Part 39 (#284) ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/db-scaling/lock-contention:
 *   get:
 *     summary: Active lock-wait chains between database backends (Part 39)
 *     description: >
 *       Returns rows from pg_locks + pg_stat_activity where one backend is
 *       blocking another. An empty array means no lock waits are active.
 *     tags: [DB Scaling]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lock contention rows (may be empty)
 *       500:
 *         description: Internal server error
 */
router.get('/lock-contention', (req, res, next) => ctrl.getLockContention(req, res, next));

/**
 * @swagger
 * /api/v1/db-scaling/unused-indexes:
 *   get:
 *     summary: Indexes with zero scans since last statistics reset (Part 39)
 *     description: >
 *       Lists non-primary, non-unique indexes never used by the query planner.
 *       These are candidates for removal to reduce write overhead and storage.
 *     tags: [DB Scaling]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unused index list
 *       500:
 *         description: Internal server error
 */
router.get('/unused-indexes', (req, res, next) => ctrl.getUnusedIndexes(req, res, next));

// ── Part 40 (#285) ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/db-scaling/replication-lag:
 *   get:
 *     summary: Streaming replication lag per standby replica (Part 40)
 *     description: >
 *       Queries pg_stat_replication for LSN distances between primary and each
 *       connected standby. Returns an empty array when no replicas are configured.
 *     tags: [DB Scaling]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Replication lag per replica (may be empty)
 *       500:
 *         description: Internal server error
 */
router.get('/replication-lag', (req, res, next) => ctrl.getReplicationLag(req, res, next));

/**
 * @swagger
 * /api/v1/db-scaling/table-sizes:
 *   get:
 *     summary: Per-table disk usage including indexes and TOAST (Part 40)
 *     description: >
 *       Returns total on-disk size for each public-schema table broken down into
 *       heap, index, and TOAST segments. Ordered by total size descending.
 *     tags: [DB Scaling]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 30
 *           maximum: 100
 *         description: Maximum number of tables to return
 *     responses:
 *       200:
 *         description: Table size breakdown
 *       400:
 *         description: Invalid limit parameter
 *       500:
 *         description: Internal server error
 */
router.get('/table-sizes', (req, res, next) => ctrl.getTableSizes(req, res, next));

// ── Part 41 (#286) ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/db-scaling/bgwriter-stats:
 *   get:
 *     summary: Background writer and checkpoint activity statistics (Part 41)
 *     description: >
 *       Returns a single-row snapshot from pg_stat_bgwriter covering checkpoint
 *       frequency (timed vs requested), buffer write counts per writer, backend
 *       fsync calls, and checkpoint I/O durations. Useful for tuning
 *       checkpoint_completion_target and bgwriter_lru_maxpages.
 *     tags: [DB Scaling]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: BGWriter stats snapshot
 *       500:
 *         description: Internal server error
 */
router.get('/bgwriter-stats', (req, res, next) => ctrl.getBgwriterStats(req, res, next));

/**
 * @swagger
 * /api/v1/db-scaling/database-stats:
 *   get:
 *     summary: Database-level statistics for the current database (Part 41)
 *     description: >
 *       Returns a snapshot from pg_stat_database for the active database,
 *       including transaction throughput (commits/rollbacks), overall buffer
 *       cache hit ratio, temporary file usage, deadlock count, and conflict
 *       count since the last stats reset.
 *     tags: [DB Scaling]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Database-level stats snapshot
 *       500:
 *         description: Internal server error
 */
router.get('/database-stats', (req, res, next) => ctrl.getDatabaseStats(req, res, next));

// ── Part 49 (#294) ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/db-scaling/table-io-stats:
 *   get:
 *     summary: Per-table I/O statistics from pg_statio_user_tables (Part 49)
 *     description: >
 *       Returns heap, index, and TOAST block read/hit counts per table ordered
 *       by total disk reads descending.  The computed heapCacheHitRatio reveals
 *       tables that are cache-cold and driving physical I/O.
 *     tags: [DB Scaling]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 30
 *           maximum: 100
 *         description: Maximum number of tables to return
 *     responses:
 *       200:
 *         description: Per-table I/O snapshot
 *       400:
 *         description: Invalid limit parameter
 *       500:
 *         description: Internal server error
 */
router.get('/table-io-stats', (req, res, next) => ctrl.getTableIoStats(req, res, next));

/**
 * @swagger
 * /api/v1/db-scaling/index-usage-stats:
 *   get:
 *     summary: Per-index access statistics from pg_stat_user_indexes (Part 49)
 *     description: >
 *       Returns scan count, rows read, and rows fetched per index ordered by
 *       scan frequency descending.  Indexes with zero idx_scan are candidates
 *       for removal; hot indexes with high idx_tup_read inform cache sizing.
 *     tags: [DB Scaling]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 30
 *           maximum: 100
 *         description: Maximum number of indexes to return
 *     responses:
 *       200:
 *         description: Per-index usage snapshot
 *       400:
 *         description: Invalid limit parameter
 *       500:
 *         description: Internal server error
 */
router.get('/index-usage-stats', (req, res, next) => ctrl.getIndexUsageStats(req, res, next));

export default router;
