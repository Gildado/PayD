jest.mock('../../utils/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../utils/tracing.js', () => ({
  withSpan: jest.fn((_name, _attrs, operation) => operation()),
}));

import { PostgresWorkflowStore } from '../store.js';

type QueryResult = { rows: Record<string, unknown>[] };

function fakeDb(result: QueryResult | (() => QueryResult)) {
  const query = jest.fn(async () =>
    typeof result === 'function' ? result() : result
  ) as unknown as jest.Mock & { calls: unknown[][] };
  return { db: { query } as never, query };
}

describe('PostgresWorkflowStore durability', () => {
  it('persists data as JSONB under a unique business reference', async () => {
    const record = { id: 'w-1', status: 'pending' };
    const { db, query } = fakeDb({ rows: [record] });
    const store = new PostgresWorkflowStore(db);

    await store.create(1, 'contributor-reward', 'issue:123', 'pending', { amount: 100 });

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO orchestration_records');
    expect(sql).toContain('ON CONFLICT (organization_id, kind, reference)');
    expect(sql).toContain('$6::jsonb');
    expect(params[1]).toBe(1);
    expect(params[2]).toBe('contributor-reward');
    expect(params[3]).toBe('issue:123');
    expect(params[5]).toBe(JSON.stringify({ amount: 100 }));
  });

  it('transitions with an atomic compare-and-set bound to the organization', async () => {
    const updated = { id: 'w-1', status: 'sent' };
    const { db, query } = fakeDb({ rows: [updated] });
    const store = new PostgresWorkflowStore(db);

    await store.transition(
      {
        id: 'w-1',
        organization_id: 1,
        kind: 'workflow-notification-delivery',
        reference: 'evt:20',
        status: 'sending',
        data: {},
      },
      'sent'
    );

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('status = $3');
    expect(sql).toContain('organization_id = $1 AND id = $2');
    expect(params).toEqual([1, 'w-1', 'sending', 'sent', '{}']);
  });

  it('rejects a stale transition instead of overwriting another claim', async () => {
    const { db } = fakeDb({ rows: [] });
    const store = new PostgresWorkflowStore(db);

    await expect(
      store.transition(
        {
          id: 'w-1',
          organization_id: 1,
          kind: 'workflow-notification-delivery',
          reference: 'evt:20',
          status: 'sending',
          data: {},
        },
        'sent'
      )
    ).rejects.toMatchObject({ code: 'CONFLICT', httpStatus: 409 });
  });

  it('scans in-flight records across organizations for boot recovery', async () => {
    const { db, query } = fakeDb({ rows: [{ id: 'w-1' }] });
    const store = new PostgresWorkflowStore(db);

    const records = await store.listInFlight(['sending', 'submitted'], 25);

    expect(records).toHaveLength(1);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('status = ANY($1::text[])');
    expect(sql).toContain('ORDER BY updated_at ASC');
    expect(params).toEqual([['sending', 'submitted'], 25]);
  });
});
