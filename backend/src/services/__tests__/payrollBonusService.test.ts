import { PayrollBonusService } from '../payrollBonusService.js';
import { pool } from '../../config/database.js';

jest.mock('../../config/database.js', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

const mockPool = pool as { query: jest.Mock; connect: jest.Mock };

const makeClient = (overrides: Record<string, jest.Mock> = {}) => ({
  query: jest.fn(),
  release: jest.fn(),
  ...overrides,
});

describe('PayrollBonusService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── createPayrollRun ───────────────────────────────────────────────────────

  describe('createPayrollRun', () => {
    it('inserts a new payroll run and returns it', async () => {
      const fakeRun = { id: 1, organization_id: 10, status: 'draft', asset_code: 'XLM' };
      mockPool.query.mockResolvedValueOnce({ rows: [fakeRun] });

      const result = await PayrollBonusService.createPayrollRun(
        10,
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        'XLM'
      );

      expect(result).toEqual(fakeRun);
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toContain('INSERT INTO payroll_runs');
      expect(params[0]).toBe(10);
      expect(params[4]).toBe('XLM');
    });

    it('defaults asset_code to XLM when not supplied', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 2 }] });
      await PayrollBonusService.createPayrollRun(1, new Date(), new Date());
      const [, params] = mockPool.query.mock.calls[0];
      expect(params[4]).toBe('XLM');
    });
  });

  // ── addBonusItem ──────────────────────────────────────────────────────────

  describe('addBonusItem', () => {
    it('inserts a bonus item and triggers total recalc', async () => {
      const fakeItem = { id: 5, payroll_run_id: 1, item_type: 'bonus', bonus_type: null };
      mockPool.query
        .mockResolvedValueOnce({ rows: [fakeItem] }) // INSERT
        .mockResolvedValueOnce({ rows: [{ total_base: 0, total_bonus: 500, total: 500 }] }) // SELECT for totals
        .mockResolvedValueOnce({ rows: [] }); // UPDATE totals

      const result = await PayrollBonusService.addBonusItem({
        payroll_run_id: 1,
        employee_id: 2,
        amount: '500.00',
      });

      expect(result).toEqual(fakeItem);
      expect(mockPool.query).toHaveBeenCalledTimes(3);
    });

    it('passes bonus_type and performance_score when supplied', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ id: 6, bonus_type: 'performance', performance_score: 92 }],
        })
        .mockResolvedValueOnce({ rows: [{ total_base: 0, total_bonus: 200, total: 200 }] })
        .mockResolvedValueOnce({ rows: [] });

      await PayrollBonusService.addBonusItem({
        payroll_run_id: 1,
        employee_id: 3,
        amount: '200.00',
        bonus_type: 'performance',
        performance_score: 92,
      });

      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toContain('bonus_type');
      expect(sql).toContain('performance_score');
      expect(params[5]).toBe('performance');
      expect(params[6]).toBe(92);
    });

    it('stores null for bonus_type when not provided', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 7, bonus_type: null }] })
        .mockResolvedValueOnce({ rows: [{ total_base: 0, total_bonus: 100, total: 100 }] })
        .mockResolvedValueOnce({ rows: [] });

      await PayrollBonusService.addBonusItem({ payroll_run_id: 1, employee_id: 4, amount: '100' });

      const [, params] = mockPool.query.mock.calls[0];
      expect(params[5]).toBeNull(); // bonus_type
      expect(params[6]).toBeNull(); // performance_score
    });
  });

  // ── addBatchBonusItems ────────────────────────────────────────────────────

  describe('addBatchBonusItems', () => {
    it('inserts all items in a transaction and commits', async () => {
      const client = makeClient();
      mockPool.connect.mockResolvedValueOnce(client);
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 10 }] }) // INSERT item 1
        .mockResolvedValueOnce({ rows: [{ id: 11 }] }) // INSERT item 2
        .mockResolvedValueOnce({}); // COMMIT

      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total_base: 0, total_bonus: 300, total: 300 }] })
        .mockResolvedValueOnce({ rows: [] });

      const items = [
        { employee_id: 1, amount: '100', bonus_type: 'referral' as const },
        { employee_id: 2, amount: '200', performance_score: 88 },
      ];

      const result = await PayrollBonusService.addBatchBonusItems(1, items);

      expect(result).toHaveLength(2);
      expect(client.query).toHaveBeenCalledWith('COMMIT');
      expect(client.release).toHaveBeenCalled();
    });

    it('rolls back and rethrows on insert error', async () => {
      const client = makeClient();
      mockPool.connect.mockResolvedValueOnce(client);
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('DB error'));

      await expect(
        PayrollBonusService.addBatchBonusItems(1, [{ employee_id: 1, amount: '50' }])
      ).rejects.toThrow('DB error');

      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
      expect(client.release).toHaveBeenCalled();
    });
  });

  // ── listBonusesByType ─────────────────────────────────────────────────────

  describe('listBonusesByType', () => {
    it('returns filtered bonuses and total count', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }, { id: 3 }] });

      const { data, total } = await PayrollBonusService.listBonusesByType(10, 'performance');

      expect(total).toBe(3);
      expect(data).toHaveLength(3);
      const [, countParams] = mockPool.query.mock.calls[0];
      expect(countParams[1]).toBe('performance');
    });

    it('returns empty result when no matching bonuses', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const { data, total } = await PayrollBonusService.listBonusesByType(10, 'spot');
      expect(total).toBe(0);
      expect(data).toHaveLength(0);
    });
  });

  // ── getPerformanceBonusesByScore ──────────────────────────────────────────

  describe('getPerformanceBonusesByScore', () => {
    it('filters by minimum score and orders by score descending', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '2' }] }).mockResolvedValueOnce({
        rows: [
          { id: 1, performance_score: 95 },
          { id: 2, performance_score: 88 },
        ],
      });

      const { data, total } = await PayrollBonusService.getPerformanceBonusesByScore(10, 85);

      expect(total).toBe(2);
      expect(data[0]?.performance_score).toBe(95);
    });

    it('defaults minScore to 0 when not provided', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 9, performance_score: 50 }] });

      await PayrollBonusService.getPerformanceBonusesByScore(10);

      const [, params] = mockPool.query.mock.calls[0];
      expect(params[1]).toBe(0);
    });
  });

  // ── deletePayrollItem ────────────────────────────────────────────────────

  describe('deletePayrollItem', () => {
    it('returns false when item does not exist', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      const result = await PayrollBonusService.deletePayrollItem(999);
      expect(result).toBe(false);
    });

    it('deletes item and recalculates totals', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ payroll_run_id: 1 }] }) // SELECT run
        .mockResolvedValueOnce({ rows: [] }) // DELETE
        .mockResolvedValueOnce({ rows: [{ total_base: 100, total_bonus: 0, total: 100 }] }) // SELECT for totals
        .mockResolvedValueOnce({ rows: [] }); // UPDATE totals

      const result = await PayrollBonusService.deletePayrollItem(5);
      expect(result).toBe(true);
    });
  });
});
