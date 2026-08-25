/**
 * Tests for ReportAgentAuditService
 *
 * Uses a mock pg Pool — no real database connection required.
 */

import { jest, describe, it, expect } from '@jest/globals';
import { ReportAgentAuditService } from '../reportAgentAuditService.js';
import type { Pool } from 'pg';
import {
  FIXTURE_AUDIT_ENTRIES,
  FIXTURE_EXPECTED,
  FIXTURE_ROWS,
  FIXTURE_ORG_ID,
} from './fixtures/reportAgentAuditFixture.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePool(rows: unknown[], count = rows.length) {
  return {
    query: jest
      .fn()
      .mockResolvedValueOnce({ rows })
      .mockResolvedValue({ rows: [{ count: String(count) }] }),
  } as unknown as Pool;
}

function makePairPool(dataRows: unknown[], countRow: { count: string }) {
  return {
    query: jest
      .fn()
      .mockResolvedValueOnce({ rows: dataRows })
      .mockResolvedValueOnce({ rows: [countRow] }),
  } as unknown as Pool;
}

const baseEntry = FIXTURE_AUDIT_ENTRIES[0];

// ── log() ─────────────────────────────────────────────────────────────────────

describe('ReportAgentAuditService.log()', () => {
  it('inserts a row with the correct parameters', async () => {
    const mockRow = FIXTURE_ROWS[0];
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [mockRow] }),
    } as unknown as Pool;
    const svc = new ReportAgentAuditService(mockPool);

    const result = await svc.log(baseEntry);

    expect(mockPool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = (mockPool.query as jest.Mock).mock.calls[0];
    expect(sql).toContain('INSERT INTO report_agent_audit_log');
    expect(params[0]).toBe(FIXTURE_ORG_ID);
    expect(params[1]).toBe('report_generated');
    expect(params[2]).toBe('rpt-payroll-summary');
    expect(params[3]).toBe('Payroll Summary');
    expect(params[4]).toBe('agent_payroll');
    expect(params[5]).toBe('user');
    expect(params[6]).toBe(10);
    expect(params[7]).toBe('alice@example.com');
    expect(params[8]).toBe('PDF');
    expect(params[9]).toBe(150);
    expect(params[10]).toBe(1200);
    expect(params[11]).toBe('success');
    expect(result).toEqual(mockRow);
  });

  it('returns null and does not throw when the insert fails', async () => {
    const mockPool = {
      query: jest.fn().mockRejectedValue(new Error('DB down')),
    } as unknown as Pool;
    const svc = new ReportAgentAuditService(mockPool);

    const result = await svc.log(baseEntry);
    expect(result).toBeNull();
  });

  it('defaults severity to "info" when not provided', async () => {
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: '1' }] }),
    } as unknown as Pool;
    const svc = new ReportAgentAuditService(mockPool);

    const entryWithoutSeverity = { ...baseEntry };
    delete (entryWithoutSeverity as any).severity;
    await svc.log(entryWithoutSeverity);

    const params = (mockPool.query as jest.Mock).mock.calls[0][1];
    expect(params[18]).toBe('info');
  });

  it('stores null for optional fields when not provided', async () => {
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: '2' }] }),
    } as unknown as Pool;
    const svc = new ReportAgentAuditService(mockPool);

    const minimalEntry = {
      organizationId: FIXTURE_ORG_ID,
      actionType: 'report_generated',
      reportId: 'rpt-1',
      actorType: 'system' as const,
    };
    await svc.log(minimalEntry);

    const params = (mockPool.query as jest.Mock).mock.calls[0][1];
    expect(params[3]).toBeNull();  // reportName
    expect(params[4]).toBeNull();  // agentId
    expect(params[6]).toBeNull();  // actorId
    expect(params[7]).toBeNull();  // actorEmail
    expect(params[8]).toBeNull();  // format
    expect(params[9]).toBeNull();  // rowCount
    expect(params[10]).toBeNull(); // durationMs
    expect(params[11]).toBeNull(); // status
    expect(params[12]).toBeNull(); // errorMessage
    expect(params[13]).toBeNull(); // filters
    expect(params[14]).toBeNull(); // metadata
  });

  it('serializes filters and metadata as JSON', async () => {
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: '3' }] }),
    } as unknown as Pool;
    const svc = new ReportAgentAuditService(mockPool);

    const entryWithJson = {
      ...baseEntry,
      filters: { startDate: '2024-01-01', endDate: '2024-12-31' },
      metadata: { channel: 'email', recipients: ['a@b.com'] },
    };
    await svc.log(entryWithJson);

    const params = (mockPool.query as jest.Mock).mock.calls[0][1];
    expect(JSON.parse(params[13])).toEqual({ startDate: '2024-01-01', endDate: '2024-12-31' });
    expect(JSON.parse(params[14])).toEqual({ channel: 'email', recipients: ['a@b.com'] });
  });
});

// ── list() ────────────────────────────────────────────────────────────────────

describe('ReportAgentAuditService.list()', () => {
  it('returns rows and total count', async () => {
    const mockRows = FIXTURE_ROWS.slice(0, 3);
    const mockPool = makePairPool(mockRows, { count: '3' });
    const svc = new ReportAgentAuditService(mockPool);

    const { rows, total } = await svc.list(FIXTURE_ORG_ID);
    expect(rows).toEqual(mockRows);
    expect(total).toBe(3);
  });

  it('caps limit at 200', async () => {
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    } as unknown as Pool;
    const svc = new ReportAgentAuditService(mockPool);

    await svc.list(FIXTURE_ORG_ID, { limit: 9999 });
    const params = (mockPool.query as jest.Mock).mock.calls[0][1];
    const limitIndex = params.length - 2;
    expect(params[limitIndex]).toBe(200);
  });

  it('applies actionType filter', async () => {
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    } as unknown as Pool;
    const svc = new ReportAgentAuditService(mockPool);

    await svc.list(FIXTURE_ORG_ID, { actionType: 'report_generated' });
    const [sql, params] = (mockPool.query as jest.Mock).mock.calls[0];
    expect(sql).toContain('action_type = $2');
    expect(params[1]).toBe('report_generated');
  });

  it('applies reportId filter', async () => {
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    } as unknown as Pool;
    const svc = new ReportAgentAuditService(mockPool);

    await svc.list(FIXTURE_ORG_ID, { reportId: 'rpt-payroll-summary' });
    const [sql, params] = (mockPool.query as jest.Mock).mock.calls[0];
    expect(sql).toContain('report_id = $');
    expect(params).toContain('rpt-payroll-summary');
  });

  it('applies severity filter', async () => {
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    } as unknown as Pool;
    const svc = new ReportAgentAuditService(mockPool);

    await svc.list(FIXTURE_ORG_ID, { severity: 'critical' });
    const [sql, params] = (mockPool.query as jest.Mock).mock.calls[0];
    expect(sql).toContain('severity = $');
    expect(params).toContain('critical');
  });

  it('applies status filter', async () => {
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    } as unknown as Pool;
    const svc = new ReportAgentAuditService(mockPool);

    await svc.list(FIXTURE_ORG_ID, { status: 'failed' });
    const [sql, params] = (mockPool.query as jest.Mock).mock.calls[0];
    expect(sql).toContain('status = $');
    expect(params).toContain('failed');
  });

  it('applies fromDate and toDate filters', async () => {
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    } as unknown as Pool;
    const svc = new ReportAgentAuditService(mockPool);
    const from = new Date('2024-01-01');
    const to = new Date('2024-12-31');

    await svc.list(FIXTURE_ORG_ID, { fromDate: from, toDate: to });
    const [sql, params] = (mockPool.query as jest.Mock).mock.calls[0];
    expect(sql).toContain('created_at >=');
    expect(sql).toContain('created_at <=');
    expect(params).toContain(from.toISOString());
    expect(params).toContain(to.toISOString());
  });

  it('applies actorType filter', async () => {
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    } as unknown as Pool;
    const svc = new ReportAgentAuditService(mockPool);

    await svc.list(FIXTURE_ORG_ID, { actorType: 'user' });
    const [sql, params] = (mockPool.query as jest.Mock).mock.calls[0];
    expect(sql).toContain('actor_type = $');
    expect(params).toContain('user');
  });
});

// ── summary() ────────────────────────────────────────────────────────────────

describe('ReportAgentAuditService.summary()', () => {
  it('returns aggregated summary data', async () => {
    const mockPool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [{
            total: String(FIXTURE_EXPECTED.totalEntries),
            success_count: String(FIXTURE_EXPECTED.successCount),
            failed_count: String(FIXTURE_EXPECTED.failedCount),
            critical_count: String(FIXTURE_EXPECTED.criticalCount),
            warning_count: String(FIXTURE_EXPECTED.warningCount),
            avg_duration: String(FIXTURE_EXPECTED.avgDurationMs),
            total_rows: String(FIXTURE_EXPECTED.totalRowsGenerated),
          }],
        })
        .mockResolvedValueOnce({
          rows: Object.entries(FIXTURE_EXPECTED.actionBreakdown).map(([action_type, count]) => ({
            action_type,
            count: String(count),
          })),
        })
        .mockResolvedValueOnce({
          rows: Object.entries(FIXTURE_EXPECTED.reportBreakdown).map(([report_id, count]) => ({
            report_id,
            report_name: null,
            count: String(count),
          })),
        })
        .mockResolvedValueOnce({
          rows: [
            { actor_email: 'alice@example.com', count: '5' },
            { actor_email: 'bob@example.com', count: '2' },
            { actor_email: 'charlie@example.com', count: '1' },
          ],
        }),
    } as unknown as Pool;
    const svc = new ReportAgentAuditService(mockPool);

    const summary = await svc.summary(FIXTURE_ORG_ID);

    expect(summary.totalActions).toBe(FIXTURE_EXPECTED.totalEntries);
    expect(summary.successCount).toBe(FIXTURE_EXPECTED.successCount);
    expect(summary.failedCount).toBe(FIXTURE_EXPECTED.failedCount);
    expect(summary.criticalCount).toBe(FIXTURE_EXPECTED.criticalCount);
    expect(summary.warningCount).toBe(FIXTURE_EXPECTED.warningCount);
    expect(summary.avgDurationMs).toBeCloseTo(FIXTURE_EXPECTED.avgDurationMs, 1);
    expect(summary.totalRowsGenerated).toBe(FIXTURE_EXPECTED.totalRowsGenerated);
    expect(summary.byActionType).toHaveLength(8);
    expect(summary.byActionType[0]).toEqual({ action_type: 'report_generated', count: 3 });
    expect(summary.byReport).toHaveLength(4);
    expect(summary.byReport[0]).toEqual({ report_id: 'rpt-payroll-summary', report_name: null, count: 6 });
    expect(summary.byActor).toHaveLength(3);
  });

  it('returns zero counts when no data matches', async () => {
    const mockPool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [{
            total: '0', success_count: '0', failed_count: '0',
            critical_count: '0', warning_count: '0', avg_duration: null, total_rows: '0',
          }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
    } as unknown as Pool;
    const svc = new ReportAgentAuditService(mockPool);

    const summary = await svc.summary(999);
    expect(summary.totalActions).toBe(0);
    expect(summary.avgDurationMs).toBeNull();
    expect(summary.byActionType).toHaveLength(0);
  });
});

// ── exportCsv() ───────────────────────────────────────────────────────────────

describe('ReportAgentAuditService.exportCsv()', () => {
  it('returns CSV with header and data rows', async () => {
    const mockRows = FIXTURE_ROWS.slice(0, 3);
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: mockRows }),
    } as unknown as Pool;
    const svc = new ReportAgentAuditService(mockPool);

    const csv = await svc.exportCsv(FIXTURE_ORG_ID);
    const lines = csv.split('\n');

    expect(lines[0]).toContain('action_type');
    expect(lines[0]).toContain('report_id');
    expect(lines[0]).toContain('actor_email');
    expect(lines[0]).toContain('severity');
    expect(lines).toHaveLength(4); // header + 3 rows
    expect(lines[1]).toContain('report_generated');
    expect(lines[1]).toContain('alice@example.com');
  });

  it('escapes commas inside field values', async () => {
    const mockRows = [{
      ...FIXTURE_ROWS[0],
      report_name: 'Payroll, Summary',
      error_message: null,
    }];
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: mockRows }),
    } as unknown as Pool;
    const svc = new ReportAgentAuditService(mockPool);

    const csv = await svc.exportCsv(FIXTURE_ORG_ID);
    expect(csv).toContain('"Payroll, Summary"');
  });

  it('escapes quotes inside field values', async () => {
    const mockRows = [{
      ...FIXTURE_ROWS[0],
      error_message: 'Query "timeout" error',
    }];
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: mockRows }),
    } as unknown as Pool;
    const svc = new ReportAgentAuditService(mockPool);

    const csv = await svc.exportCsv(FIXTURE_ORG_ID);
    expect(csv).toContain('""timeout""');
  });
});

// ── Fixture dataset regression ────────────────────────────────────────────────

describe('Report Agent Audit Fixture Dataset', () => {
  it('has the expected number of entries', () => {
    expect(FIXTURE_AUDIT_ENTRIES).toHaveLength(FIXTURE_EXPECTED.totalEntries);
  });

  it('has correct success/failure counts', () => {
    const successes = FIXTURE_AUDIT_ENTRIES.filter((e) => e.status === 'success').length;
    const failures = FIXTURE_AUDIT_ENTRIES.filter((e) => e.status === 'failed').length;
    expect(successes).toBe(FIXTURE_EXPECTED.successCount);
    expect(failures).toBe(FIXTURE_EXPECTED.failedCount);
  });

  it('has correct severity counts', () => {
    const critical = FIXTURE_AUDIT_ENTRIES.filter((e) => e.severity === 'critical').length;
    const warning = FIXTURE_AUDIT_ENTRIES.filter((e) => e.severity === 'warning').length;
    expect(critical).toBe(FIXTURE_EXPECTED.criticalCount);
    expect(warning).toBe(FIXTURE_EXPECTED.warningCount);
  });

  it('has correct action type breakdown', () => {
    const counts: Record<string, number> = {};
    for (const entry of FIXTURE_AUDIT_ENTRIES) {
      counts[entry.actionType] = (counts[entry.actionType] || 0) + 1;
    }
    expect(counts).toEqual(FIXTURE_EXPECTED.actionBreakdown);
  });

  it('has correct report breakdown', () => {
    const counts: Record<string, number> = {};
    for (const entry of FIXTURE_AUDIT_ENTRIES) {
      counts[entry.reportId] = (counts[entry.reportId] || 0) + 1;
    }
    expect(counts).toEqual(FIXTURE_EXPECTED.reportBreakdown);
  });

  it('FIXTURE_ROWS matches FIXTURE_AUDIT_ENTRIES length', () => {
    expect(FIXTURE_ROWS).toHaveLength(FIXTURE_AUDIT_ENTRIES.length);
  });

  it('FIXTURE_ROWS have valid DB-shape fields', () => {
    for (const row of FIXTURE_ROWS) {
      expect(row.id).toBeDefined();
      expect(row.organization_id).toBe(FIXTURE_ORG_ID);
      expect(row.action_type).toBeDefined();
      expect(row.report_id).toBeDefined();
      expect(row.actor_type).toBeDefined();
      expect(row.severity).toBeDefined();
      expect(row.created_at).toBeDefined();
    }
  });
});
