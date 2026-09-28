/**
 * Tests for PayrollAuditTrailReportAgent
 *
 * Uses a mock pg Pool — no real database connection required.
 */

import { jest, describe, it, expect } from '@jest/globals';
import { PayrollAuditTrailReportAgent } from '../payrollAuditTrailReportAgent.js';
import type { Pool } from 'pg';
import {
  FIXTURE_EXPECTED,
  FIXTURE_ORG_ID,
} from './fixtures/payrollAuditTrailFixture.js';

function makePool(resolvedRows: unknown[][]): Pool {
  const chain = resolvedRows.reduceRight(
    (prev, rows) => jest.fn().mockResolvedValueOnce({ rows }).mockReturnValue(prev),
    jest.fn().mockResolvedValue({ rows: [] }),
  );
  return { query: chain } as unknown as Pool;
}

describe('PayrollAuditTrailReportAgent', () => {
  describe('execute()', () => {
    it('throws when organizationId is missing', async () => {
      const pool = { query: jest.fn() } as unknown as Pool;
      const agent = new PayrollAuditTrailReportAgent(pool);
      await expect(agent.execute({})).rejects.toThrow('organizationId is required');
    });

    it('returns correct summary totals', async () => {
      // Query 1: aggregate by action + actor_type
      const aggRows = Object.entries(FIXTURE_EXPECTED.byActionCounts).flatMap(([action, count]) => [
        { action, actor_type: 'user', count },
        { action, actor_type: 'system', count: 0 },
      ]).filter(r => r.count > 0);
      // Query 2: transaction counts
      const txRows = [{
        successful: FIXTURE_EXPECTED.successfulTransactions,
        failed: FIXTURE_EXPECTED.failedTransactions,
        total_amount: FIXTURE_EXPECTED.totalAmountTransacted,
      }];
      // Query 3: timeline (empty for simplicity)
      // Query 4: flagged items (empty for simplicity)

      const pool = makePool([aggRows, txRows, [], []]);
      const agent = new PayrollAuditTrailReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      expect(result.format).toBe('JSON');
      expect(result.data).toHaveLength(1);

      const report = result.data![0] as any;
      expect(report.summary.successfulTransactions).toBe(FIXTURE_EXPECTED.successfulTransactions);
      expect(report.summary.failedTransactions).toBe(FIXTURE_EXPECTED.failedTransactions);
      expect(report.summary.totalAmountTransacted).toBe(FIXTURE_EXPECTED.totalAmountTransacted);
    });

    it('correctly aggregates by action type', async () => {
      const aggRows = [
        { action: 'run_created', actor_type: 'user', count: 1 },
        { action: 'item_added', actor_type: 'user', count: 2 },
        { action: 'transaction_succeeded', actor_type: 'system', count: 1 },
      ];
      const pool = makePool([aggRows, [{ successful: 1, failed: 0, total_amount: '500' }], [], []]);
      const agent = new PayrollAuditTrailReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      expect(report.summary.totalActions).toBe(4);
      expect(report.summary.byAction).toHaveLength(3);
      // Sorted by count desc
      expect(report.summary.byAction[0].action).toBe('item_added');
      expect(report.summary.byAction[0].count).toBe(2);
    });

    it('correctly aggregates by actor type', async () => {
      const aggRows = [
        { action: 'run_created', actor_type: 'user', count: 1 },
        { action: 'transaction_succeeded', actor_type: 'system', count: 1 },
      ];
      const pool = makePool([aggRows, [{ successful: 1, failed: 0, total_amount: '0' }], [], []]);
      const agent = new PayrollAuditTrailReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      expect(report.summary.byActorType).toHaveLength(2);
    });

    it('includes timeline entries', async () => {
      const timelineRows = [
        { id: 1, action: 'run_created', actor_type: 'user', actor_email: 'admin@example.com', employee_id: null, amount: null, tx_hash: null, old_status: null, new_status: null, error_message: null, created_at: new Date() },
      ];
      const pool = makePool([[], [{ successful: 0, failed: 0, total_amount: '0' }], timelineRows, []]);
      const agent = new PayrollAuditTrailReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      expect(report.timeline).toHaveLength(1);
      expect(report.timeline[0].action).toBe('run_created');
    });

    it('includes flagged items', async () => {
      const flaggedRows = [
        { id: 7, action: 'transaction_failed', actor_type: 'system', actor_email: null, employee_id: 20, amount: '750.50', tx_hash: 'tx-002', old_status: null, new_status: null, error_message: 'Insufficient funds', created_at: new Date() },
      ];
      const pool = makePool([[], [{ successful: 0, failed: 1, total_amount: '0' }], [], flaggedRows]);
      const agent = new PayrollAuditTrailReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      expect(report.flaggedItems).toHaveLength(1);
      expect(report.flaggedItems[0].errorMessage).toBe('Insufficient funds');
    });

    it('applies date filters when provided', async () => {
      const pool = makePool([[], [{ successful: 0, failed: 0, total_amount: '0' }], [], []]);
      const agent = new PayrollAuditTrailReportAgent(pool);

      await agent.execute({
        organizationId: FIXTURE_ORG_ID,
        startDate: '2024-01-01',
        endDate: '2024-06-30',
      });

      const [sql] = (pool.query as jest.Mock).mock.calls[0];
      expect(sql).toContain('created_at >= $2');
      expect(sql).toContain('created_at <= $3');
    });
  });

  describe('validate()', () => {
    it('returns valid', async () => {
      const pool = { query: jest.fn() } as unknown as Pool;
      const agent = new PayrollAuditTrailReportAgent(pool);
      const v = await agent.validate();
      expect(v.isValid).toBe(true);
      expect(v.issues).toHaveLength(0);
      expect(v.piiDetected).toHaveLength(0);
    });
  });
});
