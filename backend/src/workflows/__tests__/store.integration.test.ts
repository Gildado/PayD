jest.mock('../../config/database.js', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../utils/logger.js', () => ({ __esModule: true, default: {} }));
jest.mock('../../utils/tracing.js', () => ({ withSpan: jest.fn() }));

import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { PostgresWorkflowStore } from '../store.js';

const connectionString = process.env.WORKFLOW_TEST_DATABASE_URL;
const integration = connectionString ? describe : describe.skip;

integration('Postgres workflow persistence and migrations 061-062', () => {
  const schema = `workflow_test_${randomUUID().replaceAll('-', '')}`;
  let admin: Pool;
  let db: Pool;
  let store: PostgresWorkflowStore;

  beforeAll(async () => {
    admin = new Pool({ connectionString });
    await admin.query(`CREATE SCHEMA ${schema}`);
    db = new Pool({ connectionString, options: `-c search_path=${schema}` });
    await db.query('CREATE TABLE organizations (id INTEGER PRIMARY KEY)');
    await db.query('INSERT INTO organizations (id) VALUES (1), (2)');
    const sql = await readFile('src/db/migrations/061_create_orchestration_records.sql', 'utf8');
    await db.query(sql);
    await db.query(sql); // DDL is idempotent on the actual supported database.
    const extension = await readFile(
      'src/db/migrations/062_extend_orchestration_workflow_kinds.sql',
      'utf8'
    );
    await db.query(extension);
    await db.query(extension);
    store = new PostgresWorkflowStore(db);
  });

  afterAll(async () => {
    await db?.end();
    await admin?.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin?.end();
  });

  test('business references are unique and cannot overwrite approved payout evidence', async () => {
    const first = await store.create(1, 'contributor-reward', 'issue-1', 'staged', {
      amount: '100',
    });
    const repeat = await store.create(1, 'contributor-reward', 'issue-1', 'staged', {
      amount: '2000',
    });
    expect(repeat.id).toBe(first.id);
    expect(repeat.data).toEqual({ amount: '100' });
  });

  test('every lookup and transition is organization scoped', async () => {
    const record = await store.create(1, 'freeze-appeal', 'appeal-1', 'pending_review', {});
    await expect(store.get(2, record.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      store.transition({ ...record, organization_id: 2 }, 'executing')
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await store.list(2, 'freeze-appeal')).toEqual([]);
    expect((await store.get(1, record.id)).status).toBe('pending_review');
  });

  test('two database clients cannot claim the same operation', async () => {
    const record = await store.create(1, 'contributor-reward', 'issue-2', 'awaiting_signature', {});
    const results = await Promise.allSettled([
      store.transition(record, 'submitted'),
      store.transition(record, 'submitted'),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await store.get(1, record.id)).status).toBe('submitted');
  });

  test('migration 062 permits the new organization-scoped workflow kinds', async () => {
    const record = await store.create(
      1,
      'vesting-release-notification',
      'grant:12:2026-10-17',
      'pending',
      { grantId: 12 }
    );
    expect(record.kind).toBe('vesting-release-notification');
  });

  test('rollback is idempotent and removes the workflow table', async () => {
    const extensionRollback = await readFile(
      'src/db/rollbacks/062_extend_orchestration_workflow_kinds.sql',
      'utf8'
    );
    await expect(db.query(extensionRollback)).rejects.toThrow(
      'Cannot roll back workflow kinds while workflow records remain.'
    );
    await db.query(`DELETE FROM orchestration_records WHERE kind = 'vesting-release-notification'`);
    await db.query(extensionRollback);
    await db.query(extensionRollback);
    const rollback = await readFile(
      'src/db/rollbacks/061_create_orchestration_records.sql',
      'utf8'
    );
    await db.query(rollback);
    await db.query(rollback);
    expect(
      (await db.query("SELECT to_regclass('orchestration_records') AS table_name")).rows[0]
        .table_name
    ).toBeNull();
  });
});
