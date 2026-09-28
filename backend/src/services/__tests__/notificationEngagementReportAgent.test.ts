/**
 * Tests for NotificationEngagementReportAgent
 *
 * Uses a mock pg Pool — no real database connection required.
 */

import { jest, describe, it, expect } from '@jest/globals';
import { NotificationEngagementReportAgent } from '../notificationEngagementReportAgent.js';
import type { Pool } from 'pg';
import {
  FIXTURE_ROWS,
  FIXTURE_EXPECTED,
  FIXTURE_ORG_ID,
} from './fixtures/notificationEngagementFixture.js';

function makePool(resolvedRows: unknown[][]): Pool {
  const chain = resolvedRows.reduceRight(
    (prev, rows) => jest.fn().mockResolvedValueOnce({ rows }).mockReturnValue(prev),
    jest.fn().mockResolvedValue({ rows: [] }),
  );
  return { query: chain } as unknown as Pool;
}

describe('NotificationEngagementReportAgent', () => {
  describe('execute()', () => {
    it('throws when organizationId is missing', async () => {
      const pool = { query: jest.fn() } as unknown as Pool;
      const agent = new NotificationEngagementReportAgent(pool);
      await expect(agent.execute({})).rejects.toThrow('organizationId is required');
    });

    it('returns correct summary counts', async () => {
      // Query 1: summary by type+status
      const summaryRows = [
        { notification_type: 'email', status: 'sent', count: 2 },
        { notification_type: 'email', status: 'failed', count: 1 },
        { notification_type: 'email', status: 'pending', count: 1 },
        { notification_type: 'push', status: 'sent', count: 2 },
        { notification_type: 'push', status: 'failed', count: 1 },
      ];
      // Query 2: per-employee stats
      const empRows = [
        { employee_id: 10, total: 3, sent: 3, failed: 0 },
        { employee_id: 20, total: 2, sent: 0, failed: 2 },
        { employee_id: 30, total: 2, sent: 1, failed: 0 },
      ];
      // Query 3: recent failures
      const failRows = [
        { id: 4, transaction_id: 103, employee_id: 20, notification_type: 'email', error_message: 'SMTP timeout', created_at: new Date() },
        { id: 5, transaction_id: 104, employee_id: 20, notification_type: 'push', error_message: 'Device token invalid', created_at: new Date() },
      ];

      const pool = makePool([summaryRows, empRows, failRows]);
      const agent = new NotificationEngagementReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      expect(result.format).toBe('JSON');
      expect(result.data).toHaveLength(1);

      const report = result.data![0] as any;
      expect(report.summary.total).toBe(FIXTURE_EXPECTED.total);
      expect(report.summary.sent).toBe(FIXTURE_EXPECTED.sent);
      expect(report.summary.failed).toBe(FIXTURE_EXPECTED.failed);
      expect(report.summary.pending).toBe(FIXTURE_EXPECTED.pending);
    });

    it('returns correct byType breakdown', async () => {
      const summaryRows = [
        { notification_type: 'email', status: 'sent', count: 2 },
        { notification_type: 'email', status: 'failed', count: 1 },
        { notification_type: 'push', status: 'sent', count: 2 },
      ];
      const pool = makePool([summaryRows, [], []]);
      const agent = new NotificationEngagementReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      const emailType = report.summary.byType.find((t: any) => t.type === 'email');
      expect(emailType).toBeDefined();
      expect(emailType.total).toBe(3);
      expect(emailType.sent).toBe(2);
      expect(emailType.failed).toBe(1);
    });

    it('includes per-employee stats', async () => {
      const empRows = [
        { employee_id: 10, total: 5, sent: 4, failed: 1 },
      ];
      const pool = makePool([[], empRows, []]);
      const agent = new NotificationEngagementReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      expect(report.byEmployee).toHaveLength(1);
      expect(report.byEmployee[0].employeeId).toBe(10);
      expect(report.byEmployee[0].deliveryRate).toBe(80);
    });

    it('includes recent failures', async () => {
      const failRows = [
        { id: 1, transaction_id: 100, employee_id: 10, notification_type: 'email', error_message: 'Bounce', created_at: new Date() },
      ];
      const pool = makePool([[], [], failRows]);
      const agent = new NotificationEngagementReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      expect(report.recentFailures).toHaveLength(1);
      expect(report.recentFailures[0].errorMessage).toBe('Bounce');
    });

    it('applies date filters when provided', async () => {
      const pool = makePool([[], [], []]);
      const agent = new NotificationEngagementReportAgent(pool);

      await agent.execute({
        organizationId: FIXTURE_ORG_ID,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      const [sql] = (pool.query as jest.Mock).mock.calls[0];
      expect(sql).toContain('created_at >= $2');
      expect(sql).toContain('created_at <= $3');
    });
  });

  describe('validate()', () => {
    it('returns valid', async () => {
      const pool = { query: jest.fn() } as unknown as Pool;
      const agent = new NotificationEngagementReportAgent(pool);
      const v = await agent.validate();
      expect(v.isValid).toBe(true);
      expect(v.issues).toHaveLength(0);
      expect(v.piiDetected).toHaveLength(0);
    });
  });
});
