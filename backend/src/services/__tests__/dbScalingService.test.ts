import { DbScalingService } from '../dbScalingService.js';

jest.mock('@prisma/client', () => {
  const mockPrisma = {
    $queryRaw: jest.fn(),
    $on: jest.fn(),
  };
  return { PrismaClient: jest.fn(() => mockPrisma) };
});

describe('DbScalingService', () => {
  let service: DbScalingService;
  let mockQueryRaw: jest.Mock;

  beforeEach(() => {
    const { PrismaClient } = jest.requireMock('@prisma/client') as {
      PrismaClient: jest.Mock;
    };
    mockQueryRaw = PrismaClient.mock.results[0]?.value.$queryRaw as jest.Mock;
    service = new DbScalingService();
    mockQueryRaw = (service as unknown as { prisma: { $queryRaw: jest.Mock } }).prisma.$queryRaw;
  });

  afterEach(() => jest.clearAllMocks());

  describe('getPoolStats', () => {
    it('returns parsed pool statistics', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ active: 3n, idle: 7n, waiting: 0n }]);
      const stats = await service.getPoolStats();
      expect(stats).toEqual({
        activeConnections: 3,
        idleConnections: 7,
        waitingRequests: 0,
        maxConnections: expect.any(Number),
      });
    });

    it('handles empty result gracefully', async () => {
      mockQueryRaw.mockResolvedValueOnce([]);
      const stats = await service.getPoolStats();
      expect(stats.activeConnections).toBe(0);
      expect(stats.idleConnections).toBe(0);
    });
  });

  describe('runHealthCheck', () => {
    it('returns ok=true when query succeeds', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
      const result = await service.runHealthCheck();
      expect(result.ok).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns ok=false when query throws', async () => {
      mockQueryRaw.mockRejectedValueOnce(new Error('connection refused'));
      const result = await service.runHealthCheck();
      expect(result.ok).toBe(false);
    });
  });

  describe('getSlowQueries', () => {
    it('maps raw rows to typed objects', async () => {
      mockQueryRaw.mockResolvedValueOnce([
        { query: 'SELECT * FROM employees', calls: 42n, mean_exec_time: 1500.5, total_exec_time: 63021 },
      ]);
      const rows = await service.getSlowQueries(1000, 10);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ query: 'SELECT * FROM employees', calls: 42, avgMs: 1501 });
    });
  });

  describe('getIndexUsage', () => {
    it('maps raw rows correctly', async () => {
      mockQueryRaw.mockResolvedValueOnce([
        { relname: 'employees', indexrelname: 'employees_pkey', idx_scan: 100n, idx_tup_read: 500n },
      ]);
      const usage = await service.getIndexUsage();
      expect(usage[0]).toEqual({ table: 'employees', index: 'employees_pkey', scans: 100, tuplesRead: 500 });
    });
  });

  describe('getPoolConfig', () => {
    it('returns min and max from env or defaults', () => {
      const config = service.getPoolConfig();
      expect(config).toHaveProperty('min');
      expect(config).toHaveProperty('max');
      expect(config.max).toBeGreaterThan(0);
    });
  });
});
