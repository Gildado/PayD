/**
 * Integration tests for the DB Scaling endpoints (Parts 39, 40, 41 & 49).
 * Integration tests for the DB Scaling endpoints (Parts 37, 38, 39, 40, 42 & 50).
 *
 * Issues #282 (Part 37) — connection breakdown, db settings
 * Issues #283 (Part 38) — seq scan stats, WAL stats
 * Issues #284 (Part 39) — lock contention, unused indexes
 * Issues #285 (Part 40) — replication lag, table sizes
 * Issues #286 (Part 41) — bgwriter stats, database stats
 * Issues #294 (Part 49) — table I/O stats, index usage stats
 * Issues #287 (Part 42) — bgwriter stats, temp file usage
 * Issues #295 (Part 50) — database stats, block I/O stats
 *
 * Strategy
 * ─────────
 * DbScalingService is instantiated at module level inside the controller.
 * We replace it with a Jest mock factory before importing the app so that
 * every method is a jest.fn() and no real PostgreSQL connection is needed.
 */

import request from 'supertest';
import app from '../app.js';

// ─── Mock DbScalingService ────────────────────────────────────────────────────

const mockGetLockContention   = jest.fn();
const mockGetUnusedIndexes    = jest.fn();
const mockGetReplicationLag   = jest.fn();
const mockGetTableSizes       = jest.fn();
const mockGetBgwriterStats    = jest.fn();
const mockGetDatabaseStats    = jest.fn();
const mockGetTableIoStats     = jest.fn();
const mockGetIndexUsageStats  = jest.fn();

// Also stub the methods used by existing controller handlers so the mock
// implementation is complete (prevents "not a function" errors from other routes
// if the test runner resolves them).
const mockGetPoolStats             = jest.fn();
const mockRunHealthCheck           = jest.fn();
const mockGetSlowQueries           = jest.fn();
const mockGetIndexUsage            = jest.fn();
const mockGetPoolConfig            = jest.fn();
const mockGetTableBloat            = jest.fn();
const mockGetCacheHitRate          = jest.fn();
const mockGetLongRunningTransactions = jest.fn();
const mockGetVacuumStats           = jest.fn();
const mockGetConnectionBreakdown   = jest.fn();
const mockGetDbSettings            = jest.fn();
const mockGetSeqScanStats          = jest.fn();
const mockGetWalStats              = jest.fn();
const mockGetBgwriterStats         = jest.fn();
const mockGetTempFileUsage         = jest.fn();
const mockGetDatabaseStats         = jest.fn();
const mockGetBlockIoStats          = jest.fn();

jest.mock('../services/dbScalingService.js', () => ({
  DbScalingService: jest.fn().mockImplementation(() => ({
    getPoolStats:               mockGetPoolStats,
    runHealthCheck:             mockRunHealthCheck,
    getSlowQueries:             mockGetSlowQueries,
    getIndexUsage:              mockGetIndexUsage,
    getPoolConfig:              mockGetPoolConfig,
    getTableBloat:              mockGetTableBloat,
    getCacheHitRate:            mockGetCacheHitRate,
    getLongRunningTransactions: mockGetLongRunningTransactions,
    getVacuumStats:             mockGetVacuumStats,
    getConnectionBreakdown:     mockGetConnectionBreakdown,
    getDbSettings:              mockGetDbSettings,
    getSeqScanStats:            mockGetSeqScanStats,
    getWalStats:                mockGetWalStats,
    getBgwriterStats:           mockGetBgwriterStats,
    getTempFileUsage:           mockGetTempFileUsage,
    getDatabaseStats:           mockGetDatabaseStats,
    getBlockIoStats:            mockGetBlockIoStats,
    getLockContention:          mockGetLockContention,
    getUnusedIndexes:           mockGetUnusedIndexes,
    getReplicationLag:          mockGetReplicationLag,
    getTableSizes:              mockGetTableSizes,
    getBgwriterStats:           mockGetBgwriterStats,
    getDatabaseStats:           mockGetDatabaseStats,
    getTableIoStats:            mockGetTableIoStats,
    getIndexUsageStats:         mockGetIndexUsageStats,
  })),
}));

afterEach(() => jest.clearAllMocks());

// ─── Part 37: GET /api/v1/db-scaling/connection-breakdown ────────────────────

describe('GET /api/v1/db-scaling/connection-breakdown', () => {
  it('returns 200 with connection groups by state and application', async () => {
    mockGetConnectionBreakdown.mockResolvedValue([
      { state: 'active', applicationName: 'payd-api', count: 5 },
      { state: 'idle',   applicationName: 'payd-api', count: 12 },
    ]);

    const res = await request(app).get('/api/v1/db-scaling/connection-breakdown');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({ state: 'active', count: 5 });
  });

  it('returns 200 with empty array when no connections exist', async () => {
    mockGetConnectionBreakdown.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/db-scaling/connection-breakdown');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns 500 when the service throws', async () => {
    mockGetConnectionBreakdown.mockRejectedValue(new Error('pg error'));

    const res = await request(app).get('/api/v1/db-scaling/connection-breakdown');

    expect(res.status).toBe(500);
  });
});

// ─── Part 37: GET /api/v1/db-scaling/db-settings ───────────────────────────

describe('GET /api/v1/db-scaling/db-settings', () => {
  it('returns 200 with scaling-relevant pg_settings', async () => {
    mockGetDbSettings.mockResolvedValue([
      { name: 'max_connections', setting: '100', unit: null, category: 'Connections and Authentication / Connection Settings' },
      { name: 'shared_buffers',  setting: '16384', unit: '8kB', category: 'Resource Usage / Memory' },
    ]);

    const res = await request(app).get('/api/v1/db-scaling/db-settings');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0]).toMatchObject({ name: 'max_connections', setting: '100' });
  });

  it('returns 500 when the service throws', async () => {
    mockGetDbSettings.mockRejectedValue(new Error('pg error'));

    const res = await request(app).get('/api/v1/db-scaling/db-settings');

    expect(res.status).toBe(500);
  });
});

// ─── Part 38: GET /api/v1/db-scaling/seq-scan-stats ──────────────────────────

describe('GET /api/v1/db-scaling/seq-scan-stats', () => {
  it('returns 200 with sequential scan statistics', async () => {
    mockGetSeqScanStats.mockResolvedValue([
      { table: 'audit_logs', seqScans: 500, idxScans: 50, seqTupRead: 10000, idxTupFetch: 200, seqScanRatio: 0.909 },
    ]);

    const res = await request(app).get('/api/v1/db-scaling/seq-scan-stats');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0]).toMatchObject({ table: 'audit_logs', seqScans: 500 });
  });

  it('respects the ?limit query parameter', async () => {
    mockGetSeqScanStats.mockResolvedValue([]);

    await request(app).get('/api/v1/db-scaling/seq-scan-stats?limit=5');

    expect(mockGetSeqScanStats).toHaveBeenCalledWith(5);
  });

  it('returns 400 for an invalid limit', async () => {
    const res = await request(app).get('/api/v1/db-scaling/seq-scan-stats?limit=abc');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 500 when the service throws', async () => {
    mockGetSeqScanStats.mockRejectedValue(new Error('pg error'));

    const res = await request(app).get('/api/v1/db-scaling/seq-scan-stats');

    expect(res.status).toBe(500);
  });
});

// ─── Part 38: GET /api/v1/db-scaling/wal-stats ──────────────────────────────

describe('GET /api/v1/db-scaling/wal-stats', () => {
  it('returns 200 with WAL generation statistics', async () => {
    mockGetWalStats.mockResolvedValue({
      walRecords: 1000, walFpi: 50, walBytes: 5242880,
      walBuffersFull: 2, walWrite: 100, walSync: 80,
      walWriteTimeMs: 150, walSyncTimeMs: 200,
    });

    const res = await request(app).get('/api/v1/db-scaling/wal-stats');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ walBytes: 5242880, walRecords: 1000 });
  });

  it('returns 500 when the service throws', async () => {
    mockGetWalStats.mockRejectedValue(new Error('pg error'));

    const res = await request(app).get('/api/v1/db-scaling/wal-stats');

    expect(res.status).toBe(500);
  });
});

// ─── Part 42: GET /api/v1/db-scaling/bgwriter-stats ──────────────────────────

describe('GET /api/v1/db-scaling/bgwriter-stats', () => {
  it('returns 200 with bgwriter statistics', async () => {
    mockGetBgwriterStats.mockResolvedValue({
      checkpointsTimed: 100, checkpointsReq: 5,
      checkpointWriteTimeMs: 5000, checkpointSyncTimeMs: 2000,
      buffersCheckpoint: 1000, buffersClean: 500, maxwrittenClean: 10,
      buffersBackend: 200, buffersBackendFsync: 50, buffersAlloc: 300,
    });

    const res = await request(app).get('/api/v1/db-scaling/bgwriter-stats');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ checkpointsTimed: 100, buffersCheckpoint: 1000 });
  });

  it('returns 500 when the service throws', async () => {
    mockGetBgwriterStats.mockRejectedValue(new Error('pg error'));

    const res = await request(app).get('/api/v1/db-scaling/bgwriter-stats');

    expect(res.status).toBe(500);
  });
});

// ─── Part 42: GET /api/v1/db-scaling/temp-file-usage ────────────────────────

describe('GET /api/v1/db-scaling/temp-file-usage', () => {
  it('returns 200 with temp file usage for current database', async () => {
    mockGetTempFileUsage.mockResolvedValue({
      database: 'payd', tempFiles: 42, tempBytes: 1048576, tempBytesPretty: '1024 kB',
    });

    const res = await request(app).get('/api/v1/db-scaling/temp-file-usage');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ tempFiles: 42, tempBytes: 1048576 });
  });

  it('returns 500 when the service throws', async () => {
    mockGetTempFileUsage.mockRejectedValue(new Error('pg error'));

    const res = await request(app).get('/api/v1/db-scaling/temp-file-usage');

    expect(res.status).toBe(500);
  });
});

// ─── Part 50: GET /api/v1/db-scaling/database-stats ─────────────────────────

describe('GET /api/v1/db-scaling/database-stats', () => {
  it('returns 200 with database-wide statistics', async () => {
    mockGetDatabaseStats.mockResolvedValue({
      database: 'payd', numBackends: 10, xactCommit: 50000, xactRollback: 100,
      blksRead: 1000, blksHit: 99000, cacheHitRatio: 0.99, deadlocks: 0,
      tempFiles: 5, tempBytes: 524288,
    });

    const res = await request(app).get('/api/v1/db-scaling/database-stats');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ xactCommit: 50000, cacheHitRatio: 0.99 });
  });

  it('returns 500 when the service throws', async () => {
    mockGetDatabaseStats.mockRejectedValue(new Error('pg error'));

    const res = await request(app).get('/api/v1/db-scaling/database-stats');

    expect(res.status).toBe(500);
  });
});

// ─── Part 50: GET /api/v1/db-scaling/block-io-stats ─────────────────────────

describe('GET /api/v1/db-scaling/block-io-stats', () => {
  it('returns 200 with block I/O timing statistics', async () => {
    mockGetBlockIoStats.mockResolvedValue({
      database: 'payd', blkReadTimeMs: 1500, blkWriteTimeMs: 800,
      sessionTimeMs: 3600000, activeTimeMs: 1800000, idleInTransactionTimeMs: 5000,
    });

    const res = await request(app).get('/api/v1/db-scaling/block-io-stats');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ blkReadTimeMs: 1500, sessionTimeMs: 3600000 });
  });

  it('returns 500 when the service throws', async () => {
    mockGetBlockIoStats.mockRejectedValue(new Error('pg error'));

    const res = await request(app).get('/api/v1/db-scaling/block-io-stats');

    expect(res.status).toBe(500);
  });
});

// ─── Part 39: GET /api/v1/db-scaling/lock-contention ─────────────────────────

describe('GET /api/v1/db-scaling/lock-contention', () => {
  it('returns 200 with an array of lock-wait rows', async () => {
    mockGetLockContention.mockResolvedValue([
      {
        waitingPid:   1234,
        blockingPid:  5678,
        lockType:     'relation',
        relation:     'employees',
        waitingQuery: 'UPDATE employees SET ...',
        waitDuration: '00:00:05.123',
      },
    ]);

    const res = await request(app).get('/api/v1/db-scaling/lock-contention');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0]).toMatchObject({
      waitingPid:  1234,
      blockingPid: 5678,
      lockType:    'relation',
      relation:    'employees',
    });
  });

  it('returns 200 with an empty array when no lock waits exist', async () => {
    mockGetLockContention.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/db-scaling/lock-contention');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('returns 500 when the service throws', async () => {
    mockGetLockContention.mockRejectedValue(new Error('pg error'));

    const res = await request(app).get('/api/v1/db-scaling/lock-contention');

    expect(res.status).toBe(500);
  });
});

// ─── Part 39: GET /api/v1/db-scaling/unused-indexes ─────────────────────────

describe('GET /api/v1/db-scaling/unused-indexes', () => {
  it('returns 200 with a list of unused indexes', async () => {
    mockGetUnusedIndexes.mockResolvedValue([
      { table: 'transactions', index: 'idx_tx_ref_old', indexSizeBytes: 8192 },
      { table: 'employees',    index: 'idx_emp_dept',   indexSizeBytes: 4096 },
    ]);

    const res = await request(app).get('/api/v1/db-scaling/unused-indexes');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({
      table:          'transactions',
      index:          'idx_tx_ref_old',
      indexSizeBytes: 8192,
    });
  });

  it('returns 200 with empty array when all indexes are used', async () => {
    mockGetUnusedIndexes.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/db-scaling/unused-indexes');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns 500 when the service throws', async () => {
    mockGetUnusedIndexes.mockRejectedValue(new Error('pg error'));

    const res = await request(app).get('/api/v1/db-scaling/unused-indexes');

    expect(res.status).toBe(500);
  });
});

// ─── Part 40: GET /api/v1/db-scaling/replication-lag ────────────────────────

describe('GET /api/v1/db-scaling/replication-lag', () => {
  it('returns 200 with replication lag rows for each replica', async () => {
    mockGetReplicationLag.mockResolvedValue([
      {
        clientAddr:     '10.0.0.2',
        state:          'streaming',
        sentLsn:        '0/5000000',
        writeLsn:       '0/4FFF000',
        flushLsn:       '0/4FFE000',
        replayLsn:      '0/4FFD000',
        writeLagBytes:  4096,
        flushLagBytes:  8192,
        replayLagBytes: 12288,
      },
    ]);

    const res = await request(app).get('/api/v1/db-scaling/replication-lag');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0]).toMatchObject({
      clientAddr:     '10.0.0.2',
      state:          'streaming',
      replayLagBytes: 12288,
    });
  });

  it('returns 200 with empty array when no replicas are configured', async () => {
    mockGetReplicationLag.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/db-scaling/replication-lag');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('returns 500 when the service throws', async () => {
    mockGetReplicationLag.mockRejectedValue(new Error('pg error'));

    const res = await request(app).get('/api/v1/db-scaling/replication-lag');

    expect(res.status).toBe(500);
  });
});

// ─── Part 40: GET /api/v1/db-scaling/table-sizes ────────────────────────────

describe('GET /api/v1/db-scaling/table-sizes', () => {
  const fakeTables = [
    {
      table:       'transactions',
      totalBytes:  1073741824,
      tableBytes:  536870912,
      indexBytes:  268435456,
      toastBytes:  268435456,
      totalPretty: '1024 MB',
    },
    {
      table:       'employees',
      totalBytes:  52428800,
      tableBytes:  26214400,
      indexBytes:  16777216,
      toastBytes:  9437184,
      totalPretty: '50 MB',
    },
  ];

  it('returns 200 with table size breakdown', async () => {
    mockGetTableSizes.mockResolvedValue(fakeTables);

    const res = await request(app).get('/api/v1/db-scaling/table-sizes');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({
      table:       'transactions',
      totalBytes:  1073741824,
      totalPretty: '1024 MB',
    });
  });

  it('respects the ?limit query parameter', async () => {
    mockGetTableSizes.mockResolvedValue(fakeTables.slice(0, 1));

    const res = await request(app).get('/api/v1/db-scaling/table-sizes?limit=1');

    expect(res.status).toBe(200);
    expect(mockGetTableSizes).toHaveBeenCalledWith(1);
  });

  it('caps limit at 100', async () => {
    mockGetTableSizes.mockResolvedValue([]);

    await request(app).get('/api/v1/db-scaling/table-sizes?limit=999');

    expect(mockGetTableSizes).toHaveBeenCalledWith(100);
  });

  it('returns 400 for a non-numeric limit', async () => {
    const res = await request(app).get('/api/v1/db-scaling/table-sizes?limit=abc');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 500 when the service throws', async () => {
    mockGetTableSizes.mockRejectedValue(new Error('pg error'));

    const res = await request(app).get('/api/v1/db-scaling/table-sizes');

    expect(res.status).toBe(500);
  });
});

// ─── Part 41: GET /api/v1/db-scaling/bgwriter-stats ──────────────────────────

describe('GET /api/v1/db-scaling/bgwriter-stats', () => {
  const fakeBgwriter = {
    checkpointsTimed:      142,
    checkpointsRequested:  3,
    buffersCheckpoint:     28500,
    buffersClean:          4200,
    maxWrittenClean:       1,
    buffersBackend:        9300,
    buffersBackendFsync:   0,
    buffersAlloc:          15000,
    checkpointWriteTimeMs: 32500.5,
    checkpointSyncTimeMs:  1200.3,
    statsResetAt:          '2026-01-01T00:00:00.000Z',
  };

  it('returns 200 with bgwriter stats snapshot', async () => {
    mockGetBgwriterStats.mockResolvedValue(fakeBgwriter);

    const res = await request(app).get('/api/v1/db-scaling/bgwriter-stats');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      checkpointsTimed:     142,
      checkpointsRequested: 3,
      buffersCheckpoint:    28500,
      buffersBackend:       9300,
    });
  });

  it('returns 200 with zero-valued snapshot when pg returns no row', async () => {
    mockGetBgwriterStats.mockResolvedValue({
      checkpointsTimed: 0, checkpointsRequested: 0,
      buffersCheckpoint: 0, buffersClean: 0, maxWrittenClean: 0,
      buffersBackend: 0, buffersBackendFsync: 0, buffersAlloc: 0,
      checkpointWriteTimeMs: 0, checkpointSyncTimeMs: 0, statsResetAt: null,
    });

    const res = await request(app).get('/api/v1/db-scaling/bgwriter-stats');

    expect(res.status).toBe(200);
    expect(res.body.data.checkpointsTimed).toBe(0);
    expect(res.body.data.statsResetAt).toBeNull();
  });

  it('returns 500 when the service throws', async () => {
    mockGetBgwriterStats.mockRejectedValue(new Error('pg error'));

    const res = await request(app).get('/api/v1/db-scaling/bgwriter-stats');

    expect(res.status).toBe(500);
  });
});

// ─── Part 41: GET /api/v1/db-scaling/database-stats ──────────────────────────

describe('GET /api/v1/db-scaling/database-stats', () => {
  const fakeDbStats = {
    dbName:         'payd_production',
    numBackends:    12,
    xactCommit:     5000000,
    xactRollback:   3200,
    blksRead:       800000,
    blksHit:        9200000,
    cacheHitRatio:  0.92,
    tempFiles:      14,
    tempBytes:      104857600,
    deadlocks:      2,
    conflictsTotal: 0,
    statsResetAt:   '2026-01-01T00:00:00.000Z',
  };

  it('returns 200 with database-level stats', async () => {
    mockGetDatabaseStats.mockResolvedValue(fakeDbStats);

    const res = await request(app).get('/api/v1/db-scaling/database-stats');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      dbName:       'payd_production',
      numBackends:  12,
      xactCommit:   5000000,
      deadlocks:    2,
      cacheHitRatio: 0.92,
    });
  });

  it('returns a cacheHitRatio of 1 when no blocks have been read or hit', async () => {
    mockGetDatabaseStats.mockResolvedValue({
      ...fakeDbStats,
      blksRead: 0,
      blksHit:  0,
      cacheHitRatio: 1,
    });

    const res = await request(app).get('/api/v1/db-scaling/database-stats');

    expect(res.status).toBe(200);
    expect(res.body.data.cacheHitRatio).toBe(1);
  });

  it('returns 500 when the service throws', async () => {
    mockGetDatabaseStats.mockRejectedValue(new Error('pg error'));

    const res = await request(app).get('/api/v1/db-scaling/database-stats');

    expect(res.status).toBe(500);
  });
});

// ─── Part 49: GET /api/v1/db-scaling/table-io-stats ──────────────────────────

describe('GET /api/v1/db-scaling/table-io-stats', () => {
  const fakeTableIo = [
    {
      table:              'payroll_items',
      heapBlksRead:       12000,
      heapBlksHit:        980000,
      heapCacheHitRatio:  0.9878,
      idxBlksRead:        3000,
      idxBlksHit:         450000,
      toastBlksRead:      0,
      toastBlksHit:       0,
    },
  ];

  it('returns 200 with per-table I/O snapshot', async () => {
    mockGetTableIoStats.mockResolvedValue(fakeTableIo);

    const res = await request(app).get('/api/v1/db-scaling/table-io-stats');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0]).toMatchObject({
      table:             'payroll_items',
      heapBlksRead:      12000,
      heapCacheHitRatio: 0.9878,
    });
  });

  it('returns 400 when limit is invalid', async () => {
    const res = await request(app).get('/api/v1/db-scaling/table-io-stats?limit=0');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 500 when the service throws', async () => {
    mockGetTableIoStats.mockRejectedValue(new Error('pg error'));

    const res = await request(app).get('/api/v1/db-scaling/table-io-stats');

    expect(res.status).toBe(500);
  });
});

// ─── Part 49: GET /api/v1/db-scaling/index-usage-stats ───────────────────────

describe('GET /api/v1/db-scaling/index-usage-stats', () => {
  const fakeIndexUsage = [
    {
      table:       'payroll_items',
      index:       'payroll_items_employee_id_idx',
      idxScan:     82000,
      idxTupRead:  1640000,
      idxTupFetch: 1580000,
    },
    {
      table:       'employees',
      index:       'employees_org_id_idx',
      idxScan:     0,
      idxTupRead:  0,
      idxTupFetch: 0,
    },
  ];

  it('returns 200 with per-index usage snapshot', async () => {
    mockGetIndexUsageStats.mockResolvedValue(fakeIndexUsage);

    const res = await request(app).get('/api/v1/db-scaling/index-usage-stats');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0]).toMatchObject({
      table:   'payroll_items',
      index:   'payroll_items_employee_id_idx',
      idxScan: 82000,
    });
    expect(res.body.data[1].idxScan).toBe(0);
  });

  it('returns 400 when limit is invalid', async () => {
    const res = await request(app).get('/api/v1/db-scaling/index-usage-stats?limit=abc');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 500 when the service throws', async () => {
    mockGetIndexUsageStats.mockRejectedValue(new Error('pg error'));

    const res = await request(app).get('/api/v1/db-scaling/index-usage-stats');

    expect(res.status).toBe(500);
  });
});
