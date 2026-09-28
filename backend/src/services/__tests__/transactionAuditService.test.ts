import { TransactionAuditService } from '../transactionAuditService.js';
import { Pool } from 'pg';

// Mock pg Pool
jest.mock('../../config/database.js', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
  pool: {
    query: jest.fn(),
  },
}));

import { pool } from '../../config/database.js';

describe('TransactionAuditService', () => {
  const mockPool = pool as unknown as jest.Mocked<Pool>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should call pool.query with correct base SQL when no filters are provided', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '0' }] }); // Count query
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] }); // Data query

      await TransactionAuditService.list(1, 20);

      expect(mockPool.query).toHaveBeenCalledTimes(2);
      const countSql = (mockPool.query as jest.Mock).mock.calls[0][0];
      const dataSql = (mockPool.query as jest.Mock).mock.calls[1][0];
      expect(countSql).toContain('SELECT COUNT');
      expect(countSql).toContain('FROM transaction_audit_logs tal');
      expect(countSql).not.toContain('WHERE');
      expect(dataSql).toContain('SELECT tal.*');
      expect(dataSql).toContain('FROM transaction_audit_logs tal');
      expect(dataSql).not.toContain('WHERE');
    });

    it('should apply date filters correctly', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '0' }] });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await TransactionAuditService.list(1, 20, undefined, {
        dateStart: '2026-01-01',
        dateEnd: '2026-01-31',
      });

      const countQuery = (mockPool.query as jest.Mock).mock.calls[0];
      const sql = countQuery[0];
      const values = countQuery[1];

      expect(sql).toContain('tal.created_at >= $');
      expect(sql).toContain('tal.created_at <= $');
      expect(values).toContain('2026-01-01');
      expect(values).toContain('2026-01-31');
    });

    it('should apply status filter correctly', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '0' }] });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await TransactionAuditService.list(1, 20, undefined, {
        status: 'Completed',
      });

      const countQuery = (mockPool.query as jest.Mock).mock.calls[0];
      expect(countQuery[0]).toContain('tal.successful = true');
    });

    it('should apply employeeId filter correctly', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '0' }] });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await TransactionAuditService.list(1, 20, undefined, {
        employeeId: 'emp-123',
      });

      const countQuery = (mockPool.query as jest.Mock).mock.calls[0];
      expect(countQuery[0]).toContain('pal.employee_id = $');
      expect(countQuery[1]).toContain('emp-123');
    });

    it('should apply asset filter correctly', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '0' }] });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await TransactionAuditService.list(1, 20, undefined, {
        asset: 'USDC',
      });

      const countQuery = (mockPool.query as jest.Mock).mock.calls[0];
      expect(countQuery[0]).toContain('pal.asset_code = $');
      expect(countQuery[1]).toContain('USDC');
    });
  });
});
