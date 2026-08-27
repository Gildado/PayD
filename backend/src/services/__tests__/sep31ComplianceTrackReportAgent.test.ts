/**
 * Tests for Sep31ComplianceTrackReportAgent
 *
 * Uses a mock pg Pool — no real database connection required.
 */

import { jest, describe, it, expect } from '@jest/globals';
import { Sep31ComplianceTrackReportAgent } from '../sep31ComplianceTrackReportAgent.js';
import type { Pool } from 'pg';
import { FIXTURE_EXPECTED } from './fixtures/sep31ComplianceFixture.js';

function makePool(resolvedRows: unknown[][]): Pool {
  const query = jest.fn();
  resolvedRows.forEach((rows) => query.mockResolvedValueOnce({ rows }));
  query.mockResolvedValue({ rows: [] });
  return { query } as unknown as Pool;
}

const summaryRows = [{
  total: FIXTURE_EXPECTED.total,
  completed: FIXTURE_EXPECTED.completed,
  pending: FIXTURE_EXPECTED.pending,
  error: FIXTURE_EXPECTED.error,
  unknown: FIXTURE_EXPECTED.unknown,
  on_chain_count: FIXTURE_EXPECTED.onChainCount,
  unique_senders: FIXTURE_EXPECTED.uniqueSenders,
  unique_anchors: FIXTURE_EXPECTED.uniqueAnchors,
  period_start: new Date('2024-05-01T00:00:00Z'),
  period_end: new Date('2024-05-03T00:00:00Z'),
}];

const statusRows = [
  { status: 'completed', count: 3 },
  { status: 'pending', count: 1 },
  { status: 'error', count: 1 },
  { status: null, count: 1 },
];

const anchorRows = [
  { anchor_domain: 'acme.com', total: 3, completed: 2, pending: 1, error: 0, on_chain_count: 2 },
  { anchor_domain: 'bob.com', total: 3, completed: 1, pending: 0, error: 1, on_chain_count: 1 },
];

const trendRows = [
  { period: new Date('2024-05-03T00:00:00Z'), total: 2, completed: 1 },
  { period: new Date('2024-05-02T00:00:00Z'), total: 2, completed: 1 },
  { period: new Date('2024-05-01T00:00:00Z'), total: 2, completed: 1 },
];

const flagRows = [
  { sender_public_key: 'GC', anchor_domain: 'bob.com', anchor_transaction_id: 'at5', stellar_transaction_id: null, status: 'error', created_at: new Date('2024-05-03T00:00:00Z') },
  { sender_public_key: 'GB', anchor_domain: 'bob.com', anchor_transaction_id: 'at4', stellar_transaction_id: null, status: null, created_at: new Date('2024-05-02T00:00:00Z') },
  { sender_public_key: 'GA', anchor_domain: 'acme.com', anchor_transaction_id: 'at2', stellar_transaction_id: null, status: 'pending', created_at: new Date('2024-05-01T00:00:00Z') },
];

describe('Sep31ComplianceTrackReportAgent', () => {
  describe('execute()', () => {
    it('returns correct compliance summary', async () => {
      const pool = makePool([summaryRows, statusRows, anchorRows, trendRows, flagRows]);
      const agent = new Sep31ComplianceTrackReportAgent(pool);

      const result = await agent.execute({ organizationId: 1 });
      expect(result.format).toBe('JSON');
      expect(result.data).toHaveLength(1);

      const report = result.data![0] as any;
      expect(report.schemaVersion).toBe('1.0');
      expect(report.summary.total).toBe(FIXTURE_EXPECTED.total);
      expect(report.summary.completed).toBe(FIXTURE_EXPECTED.completed);
      expect(report.summary.pending).toBe(FIXTURE_EXPECTED.pending);
      expect(report.summary.error).toBe(FIXTURE_EXPECTED.error);
      expect(report.summary.unknown).toBe(FIXTURE_EXPECTED.unknown);
      expect(report.summary.onChainCount).toBe(FIXTURE_EXPECTED.onChainCount);
      expect(report.summary.onChainRate).toBe(FIXTURE_EXPECTED.onChainRate);
      expect(report.summary.uniqueSenders).toBe(FIXTURE_EXPECTED.uniqueSenders);
      expect(report.summary.uniqueAnchors).toBe(FIXTURE_EXPECTED.uniqueAnchors);
    });

    it('includes a status breakdown', async () => {
      const pool = makePool([summaryRows, statusRows, anchorRows, trendRows, flagRows]);
      const agent = new Sep31ComplianceTrackReportAgent(pool);

      const result = await agent.execute({ organizationId: 1 });
      const report = result.data![0] as any;

      expect(report.byStatus).toHaveLength(FIXTURE_EXPECTED.byStatusLength);
      // null status is normalised to 'unknown'
      const unknown = report.byStatus.find((s: any) => s.status === 'unknown');
      expect(unknown.count).toBe(1);
    });

    it('includes a per-anchor compliance breakdown', async () => {
      const pool = makePool([summaryRows, statusRows, anchorRows, trendRows, flagRows]);
      const agent = new Sep31ComplianceTrackReportAgent(pool);

      const result = await agent.execute({ organizationId: 1 });
      const report = result.data![0] as any;

      expect(report.byAnchor).toHaveLength(FIXTURE_EXPECTED.byAnchorLength);
      const acme = report.byAnchor.find((a: any) => a.anchorDomain === 'acme.com');
      expect(acme.anchorDomain).toBe('acme.com');
      expect(acme.completed).toBe(2);
      expect(acme.onChainCount).toBe(2);
    });

    it('includes daily trends', async () => {
      const pool = makePool([summaryRows, statusRows, anchorRows, trendRows, flagRows]);
      const agent = new Sep31ComplianceTrackReportAgent(pool);

      const result = await agent.execute({ organizationId: 1 });
      const report = result.data![0] as any;

      expect(report.trends).toHaveLength(FIXTURE_EXPECTED.trendsLength);
      expect(report.trends[0].period).toBe('2024-05-03');
    });

    it('flags records missing on-chain presence or a status', async () => {
      const pool = makePool([summaryRows, statusRows, anchorRows, trendRows, flagRows]);
      const agent = new Sep31ComplianceTrackReportAgent(pool);

      const result = await agent.execute({ organizationId: 1 });
      const report = result.data![0] as any;

      expect(report.complianceFlags).toHaveLength(FIXTURE_EXPECTED.complianceFlagsLength);
      const missingStatus = report.complianceFlags.find((fl: any) => fl.flags.includes('missing-status'));
      expect(missingStatus).toBeDefined();
      expect(missingStatus.onChain).toBe(false);
      expect(report.complianceFlags.every((fl: any) => !fl.onChain)).toBe(true);
    });

    it('applies an organization filter when provided', async () => {
      const pool = makePool([[], [], [], [], []]);
      const agent = new Sep31ComplianceTrackReportAgent(pool);

      await agent.execute({ organizationId: 7 });
      const [sql, params] = (pool.query as jest.Mock).mock.calls[0];
      expect(sql).toContain('organization_id = $1');
      expect(params[0]).toBe(7);
    });
  });

  describe('validate()', () => {
    it('returns valid', async () => {
      const pool = { query: jest.fn() } as unknown as Pool;
      const agent = new Sep31ComplianceTrackReportAgent(pool);
      const v = await agent.validate();
      expect(v.isValid).toBe(true);
      expect(v.issues).toHaveLength(0);
      expect(v.piiDetected).toHaveLength(0);
    });
  });
});
