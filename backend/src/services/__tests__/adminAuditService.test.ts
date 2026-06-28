/**
 * Integration tests for AdminAuditService (issue #696)
 *
 * Uses a mock pg Pool — no real database connection required.
 */

import { AdminAuditService } from '../adminAuditService.js';
import type { Pool } from 'pg';

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

const baseEntry = {
  organizationId: 1,
  actionType: 'employee_created' as const,
  resourceType: 'employee',
};

// ── log() ─────────────────────────────────────────────────────────────────────

describe('AdminAuditService.log()', () => {
  it('inserts a row with the correct parameters', async () => {
    const mockRow = { id: '1', organization_id: 1, action_type: 'employee_created' };
    const mockPool = { query: jest.fn().mockResolvedValue({ rows: [mockRow] }) } as unknown as Pool;
    const svc = new AdminAuditService(mockPool);

    const result = await svc.log({
      organizationId: 1,
      actionType: 'employee_created',
      resourceType: 'employee',
      resourceId: 42,
      oldState: { name: 'Alice' },
      newState: { name: 'Bob' },
      actorId: 7,
      actorEmail: 'admin@example.com',
      actorIp: '10.0.0.1',
      userAgent: 'jest-test',
      requestId: 'req-123',
      severity: 'info',
      metadata: { note: 'test' },
    });

    expect(mockPool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = (mockPool.query as jest.Mock).mock.calls[0];
    expect(sql).toContain('INSERT INTO admin_audit_log');
    expect(params[0]).toBe(1);                           // organizationId
    expect(params[1]).toBe('employee_created');          // actionType
    expect(params[2]).toBe('employee');                  // resourceType
    expect(params[3]).toBe('42');                        // resourceId
    expect(JSON.parse(params[4])).toEqual({ name: 'Alice' }); // oldState
    expect(JSON.parse(params[5])).toEqual({ name: 'Bob' });   // newState
    expect(params[6]).toBe(7);                           // actorId
    expect(params[7]).toBe('admin@example.com');         // actorEmail
    expect(result).toEqual(mockRow);
  });

  it('returns null and does not throw when the insert fails', async () => {
    const mockPool = {
      query: jest.fn().mockRejectedValue(new Error('DB down')),
    } as unknown as Pool;
    const svc = new AdminAuditService(mockPool);

    const result = await svc.log(baseEntry);
    expect(result).toBeNull();
  });

  it('defaults severity to "info" when not provided', async () => {
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: '1' }] }),
    } as unknown as Pool;
    const svc = new AdminAuditService(mockPool);

    await svc.log(baseEntry);
    const params = (mockPool.query as jest.Mock).mock.calls[0][1];
    expect(params[11]).toBe('info');
  });

  it('stores null for optional fields when not provided', async () => {
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: '2' }] }),
    } as unknown as Pool;
    const svc = new AdminAuditService(mockPool);

    await svc.log(baseEntry);
    const params = (mockPool.query as jest.Mock).mock.calls[0][1];
    expect(params[3]).toBeNull();  // resourceId
    expect(params[4]).toBeNull();  // oldState
    expect(params[5]).toBeNull();  // newState
    expect(params[6]).toBeNull();  // actorId
    expect(params[12]).toBeNull(); // metadata
  });
});

// ── list() ────────────────────────────────────────────────────────────────────

describe('AdminAuditService.list()', () => {
  it('returns rows and total count', async () => {
    const mockRows = [
      { id: '1', organization_id: 1, action_type: 'payment_sent', created_at: '2025-01-01' },
    ];
    const mockPool = makePairPool(mockRows, { count: '1' });
    const svc = new AdminAuditService(mockPool);

    const { rows, total } = await svc.list(1);
    expect(rows).toEqual(mockRows);
    expect(total).toBe(1);
  });

  it('caps limit at 200', async () => {
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    } as unknown as Pool;
    const svc = new AdminAuditService(mockPool);

    await svc.list(1, { limit: 9999 });
    const params = (mockPool.query as jest.Mock).mock.calls[0][1];
    const limitIndex = params.length - 2;
    expect(params[limitIndex]).toBe(200);
  });

  it('applies actionType filter', async () => {
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    } as unknown as Pool;
    const svc = new AdminAuditService(mockPool);

    await svc.list(1, { actionType: 'employee_created' });
    const [sql, params] = (mockPool.query as jest.Mock).mock.calls[0];
    expect(sql).toContain('action_type = $2');
    expect(params[1]).toBe('employee_created');
  });

  it('applies severity filter', async () => {
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    } as unknown as Pool;
    const svc = new AdminAuditService(mockPool);

    await svc.list(1, { severity: 'critical' });
    const [sql, params] = (mockPool.query as jest.Mock).mock.calls[0];
    expect(sql).toContain('severity = $');
    expect(params).toContain('critical');
  });

  it('applies fromDate and toDate filters', async () => {
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    } as unknown as Pool;
    const svc = new AdminAuditService(mockPool);
    const from = new Date('2025-01-01');
    const to   = new Date('2025-12-31');

    await svc.list(1, { fromDate: from, toDate: to });
    const [sql, params] = (mockPool.query as jest.Mock).mock.calls[0];
    expect(sql).toContain('created_at >=');
    expect(sql).toContain('created_at <=');
    expect(params).toContain(from.toISOString());
    expect(params).toContain(to.toISOString());
  });
});

// ── summary() ────────────────────────────────────────────────────────────────

describe('AdminAuditService.summary()', () => {
  it('returns aggregated summary data', async () => {
    const mockPool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [{ total: '10', critical_count: '2', warning_count: '3' }],
        })
        .mockResolvedValueOnce({
          rows: [{ action_type: 'employee_created', count: '5' }],
        })
        .mockResolvedValueOnce({
          rows: [{ resource_type: 'employee', count: '5' }],
        })
        .mockResolvedValueOnce({
          rows: [{ actor_email: 'admin@example.com', count: '5' }],
        }),
    } as unknown as Pool;
    const svc = new AdminAuditService(mockPool);

    const summary = await svc.summary(1);

    expect(summary.totalActions).toBe(10);
    expect(summary.criticalCount).toBe(2);
    expect(summary.warningCount).toBe(3);
    expect(summary.byActionType[0]).toEqual({ action_type: 'employee_created', count: 5 });
    expect(summary.byResourceType[0]).toEqual({ resource_type: 'employee', count: 5 });
    expect(summary.byActor[0]).toEqual({ actor_email: 'admin@example.com', count: 5 });
  });
});

// ── exportCsv() ───────────────────────────────────────────────────────────────

describe('AdminAuditService.exportCsv()', () => {
  it('returns CSV with header and data rows', async () => {
    const mockRows = [
      {
        id: '1',
        organization_id: 1,
        action_type: 'employee_created',
        resource_type: 'employee',
        resource_id: '42',
        actor_email: 'admin@example.com',
        actor_ip: '10.0.0.1',
        severity: 'info',
        request_id: 'req-1',
        created_at: '2025-01-01T00:00:00Z',
      },
    ];
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: mockRows }),
    } as unknown as Pool;
    const svc = new AdminAuditService(mockPool);

    const csv = await svc.exportCsv(1);
    const lines = csv.split('\n');

    expect(lines[0]).toContain('action_type');
    expect(lines[1]).toContain('employee_created');
    expect(lines[1]).toContain('admin@example.com');
  });

  it('escapes commas inside field values', async () => {
    const mockRows = [
      {
        id: '2',
        organization_id: 1,
        action_type: 'config,updated',
        resource_type: 'config',
        resource_id: null,
        actor_email: null,
        actor_ip: null,
        severity: 'warning',
        request_id: null,
        created_at: '2025-06-01T00:00:00Z',
      },
    ];
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: mockRows }),
    } as unknown as Pool;
    const svc = new AdminAuditService(mockPool);

    const csv = await svc.exportCsv(1);
    expect(csv).toContain('"config,updated"');
  });
});
