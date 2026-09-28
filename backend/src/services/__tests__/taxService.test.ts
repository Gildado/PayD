import { jest } from '@jest/globals';
import { TaxService } from '../taxService.js';
import { Pool } from 'pg';

describe('TaxService', () => {
  let taxService: TaxService;
  let mockPool: any;

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
    };
    taxService = new TaxService(mockPool as unknown as Pool);
  });

  describe('createRule', () => {
    it('should create a percentage tax rule', async () => {
      const mockRule = {
        id: 1,
        organization_id: 1,
        name: 'Federal Income Tax',
        type: 'percentage',
        value: 22,
        description: 'Federal income tax at 22%',
        is_active: true,
        priority: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValue({ rows: [mockRule] });

      const result = await taxService.createRule({
        organization_id: 1,
        name: 'Federal Income Tax',
        type: 'percentage',
        value: 22,
        description: 'Federal income tax at 22%',
      });

      expect(result).toEqual(mockRule);
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query.mock.calls[0][1]).toEqual([
        1,
        'Federal Income Tax',
        'percentage',
        22,
        'Federal income tax at 22%',
        0,
      ]);
    });

    it('should create a fixed tax rule', async () => {
      const mockRule = {
        id: 2,
        organization_id: 1,
        name: 'Health Insurance',
        type: 'fixed',
        value: 150,
        description: null,
        is_active: true,
        priority: 2,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValue({ rows: [mockRule] });

      const result = await taxService.createRule({
        organization_id: 1,
        name: 'Health Insurance',
        type: 'fixed',
        value: 150,
        priority: 2,
      });

      expect(result).toEqual(mockRule);
      expect(mockPool.query.mock.calls[0][1]).toEqual([
        1,
        'Health Insurance',
        'fixed',
        150,
        null,
        2,
      ]);
    });
  });

  describe('getRules', () => {
    it('should return only active rules by default', async () => {
      const mockRules = [
        { id: 1, name: 'Tax A', is_active: true, priority: 0 },
        { id: 2, name: 'Tax B', is_active: true, priority: 1 },
      ];

      mockPool.query.mockResolvedValue({ rows: mockRules });

      const result = await taxService.getRules(1);

      expect(result).toEqual(mockRules);
      expect(mockPool.query.mock.calls[0][0]).toContain('AND is_active = TRUE');
    });

    it('should include inactive rules when requested', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await taxService.getRules(1, true);

      expect(mockPool.query.mock.calls[0][0]).not.toContain('AND is_active = TRUE');
    });
  });

  describe('updateRule', () => {
    it('should update specific fields', async () => {
      const updatedRule = { id: 1, name: 'Updated Tax', value: 25 };
      mockPool.query.mockResolvedValue({ rows: [updatedRule] });

      const result = await taxService.updateRule(1, { name: 'Updated Tax', value: 25 });

      expect(result).toEqual(updatedRule);
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it('should return null when no fields are provided', async () => {
      const result = await taxService.updateRule(1, {});

      expect(result).toBeNull();
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should return null when rule is not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await taxService.updateRule(999, { name: 'Test' });

      expect(result).toBeNull();
    });
  });

  describe('deleteRule', () => {
    it('should soft-delete a rule by deactivating it', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1, rows: [{ id: 1 }] });

      const result = await taxService.deleteRule(1);

      expect(result).toBe(true);
      expect(mockPool.query.mock.calls[0][0]).toContain('is_active = FALSE');
    });

    it('should return false when rule is not found', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0, rows: [] });

      const result = await taxService.deleteRule(999);

      expect(result).toBe(false);
    });
  });

  describe('calculateDeductions', () => {
    it('should calculate percentage deductions correctly', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          {
            id: 1,
            name: 'Income Tax',
            type: 'percentage',
            value: 20,
            is_active: true,
            priority: 0,
          },
        ],
      });

      const result = await taxService.calculateDeductions(1, 5000);

      expect(result.gross_amount).toBe(5000);
      expect(result.deductions).toHaveLength(1);
      expect(result.deductions[0].deducted_amount).toBe(1000);
      expect(result.total_tax).toBe(1000);
      expect(result.net_amount).toBe(4000);
    });

    it('should calculate fixed deductions correctly', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          {
            id: 2,
            name: 'Health Insurance',
            type: 'fixed',
            value: 150,
            is_active: true,
            priority: 0,
          },
        ],
      });

      const result = await taxService.calculateDeductions(1, 5000);

      expect(result.gross_amount).toBe(5000);
      expect(result.deductions).toHaveLength(1);
      expect(result.deductions[0].deducted_amount).toBe(150);
      expect(result.total_tax).toBe(150);
      expect(result.net_amount).toBe(4850);
    });

    it('should apply multiple rules in priority order', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          {
            id: 1,
            name: 'Federal Tax',
            type: 'percentage',
            value: 22,
            is_active: true,
            priority: 0,
          },
          { id: 2, name: 'State Tax', type: 'percentage', value: 5, is_active: true, priority: 1 },
          { id: 3, name: 'Insurance', type: 'fixed', value: 150, is_active: true, priority: 2 },
        ],
      });

      const result = await taxService.calculateDeductions(1, 10000);

      expect(result.gross_amount).toBe(10000);
      expect(result.deductions).toHaveLength(3);
      expect(result.deductions[0].deducted_amount).toBe(2200); // 22% of 10000
      expect(result.deductions[1].deducted_amount).toBe(500); // 5% of 10000
      expect(result.deductions[2].deducted_amount).toBe(150); // fixed 150
      expect(result.total_tax).toBe(2850);
      expect(result.net_amount).toBe(7150);
    });

    it('should return zero deductions when no rules exist', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await taxService.calculateDeductions(1, 5000);

      expect(result.gross_amount).toBe(5000);
      expect(result.deductions).toHaveLength(0);
      expect(result.total_tax).toBe(0);
      expect(result.net_amount).toBe(5000);
    });

    it('should clamp net amount to zero when taxes exceed gross', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 1, name: 'Heavy Tax', type: 'fixed', value: 6000, is_active: true, priority: 0 },
        ],
      });

      const result = await taxService.calculateDeductions(1, 5000);

      expect(result.total_tax).toBe(6000);
      expect(result.net_amount).toBe(0);
    });

    it('should handle zero gross amount', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Tax', type: 'percentage', value: 20, is_active: true, priority: 0 }],
      });

      const result = await taxService.calculateDeductions(1, 0);

      expect(result.total_tax).toBe(0);
      expect(result.net_amount).toBe(0);
    });
  });

  describe('generateReport', () => {
    it('should generate a compliance report with aggregated entries', async () => {
      const mockReportRows = [
        {
          rule_name: 'Income Tax',
          rule_type: 'percentage',
          rule_value: 10,
          total_gross: 50000,
          total_tax: 5000,
          total_net: 45000,
          transaction_count: 10,
        },
        {
          rule_name: 'Health Insurance',
          rule_type: 'fixed',
          rule_value: 200,
          total_gross: 20000,
          total_tax: 2000,
          total_net: 18000,
          transaction_count: 10,
        },
      ];

      mockPool.query.mockResolvedValue({ rows: mockReportRows });

      const report = await taxService.generateReport(1, '2026-01-01', '2026-01-31');

      expect(report.organization_id).toBe(1);
      expect(report.entries).toHaveLength(2);
      expect(report.summary.total_gross).toBe(70000);
      expect(report.summary.total_tax).toBe(7000);
      expect(report.summary.total_net).toBe(63000);
    });

    it('should return empty report when no data exists', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const report = await taxService.generateReport(1, '2026-01-01', '2026-01-31');

      expect(report.entries).toHaveLength(0);
      expect(report.summary.total_gross).toBe(0);
    });
  });
});
