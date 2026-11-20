import { Pool } from 'pg';
import {
  isStatementTimeoutError,
  resolveStatementTimeouts,
  queryWithClass,
  runWithQueryClass,
  statementTimeoutSql,
  type StatementTimeouts,
} from '../queryTimeouts.js';

const DEFAULTS = {
  DB_INTERACTIVE_STATEMENT_TIMEOUT_MS: '5000',
  DB_REPORTING_STATEMENT_TIMEOUT_MS: '120000',
};

const TIMEOUTS: StatementTimeouts = { interactive: 5000, reporting: 120000 };

/** Fake pool that records every statement issued on the checked-out client. */
function fakePool(options: { failOn?: RegExp } = {}) {
  const statements: string[] = [];
  const release = jest.fn();
  const client = {
    query: jest.fn(async (text: string) => {
      statements.push(text);
      if (options.failOn && options.failOn.test(text)) {
        throw new Error(`simulated failure on ${text}`);
      }
      return { rows: [{ ok: true }] };
    }),
    release,
  };
  const pool = { connect: jest.fn(async () => client) };
  return { pool, client, statements, release };
}

describe('resolveStatementTimeouts (#1811)', () => {
  it('uses the documented defaults', () => {
    expect(resolveStatementTimeouts(DEFAULTS)).toEqual({ interactive: 5000, reporting: 120000 });
  });

  it('rejects non-integer values', () => {
    expect(() =>
      resolveStatementTimeouts({ ...DEFAULTS, DB_INTERACTIVE_STATEMENT_TIMEOUT_MS: 'fast' })
    ).toThrow(/DB_INTERACTIVE_STATEMENT_TIMEOUT_MS must be an integer/);
  });

  it('rejects interactive values outside their bounds', () => {
    expect(() =>
      resolveStatementTimeouts({ ...DEFAULTS, DB_INTERACTIVE_STATEMENT_TIMEOUT_MS: '50' })
    ).toThrow(/between 100 and 60000/);
  });

  it('rejects reporting values outside their bounds', () => {
    expect(() =>
      resolveStatementTimeouts({ ...DEFAULTS, DB_REPORTING_STATEMENT_TIMEOUT_MS: '9999999' })
    ).toThrow(/between 1000 and 600000/);
  });

  it('requires reporting to be strictly longer than interactive', () => {
    expect(() =>
      resolveStatementTimeouts({
        DB_INTERACTIVE_STATEMENT_TIMEOUT_MS: '10000',
        DB_REPORTING_STATEMENT_TIMEOUT_MS: '10000',
      })
    ).toThrow(/must be greater than/);
  });
});

describe('statementTimeoutSql', () => {
  it('renders a SET LOCAL statement for a validated integer', () => {
    expect(statementTimeoutSql(5000)).toBe('SET LOCAL statement_timeout = 5000');
  });

  it('refuses anything that is not a positive integer', () => {
    expect(() => statementTimeoutSql(0)).toThrow(/Invalid statement timeout/);
    expect(() => statementTimeoutSql(1.5)).toThrow(/Invalid statement timeout/);
    expect(() => statementTimeoutSql(Number.NaN)).toThrow(/Invalid statement timeout/);
  });
});

describe('runWithQueryClass', () => {
  it('scopes the class timeout to a transaction and releases the client', async () => {
    const { pool, statements, release } = fakePool();

    await runWithQueryClass(pool, 'reporting', TIMEOUTS, async (client) => {
      await client.query('SELECT 1');
      return 'done';
    });

    expect(statements).toEqual([
      'BEGIN',
      'SET LOCAL statement_timeout = 120000',
      'SELECT 1',
      'COMMIT',
    ]);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('applies the interactive timeout to interactive queries', async () => {
    const { pool, statements } = fakePool();
    await queryWithClass(pool, 'interactive', TIMEOUTS, 'SELECT 1');

    expect(statements[1]).toBe('SET LOCAL statement_timeout = 5000');
  });

  it('rolls back and releases the client when the query fails', async () => {
    const { pool, statements, release } = fakePool({ failOn: /SELECT broken/ });

    await expect(queryWithClass(pool, 'interactive', TIMEOUTS, 'SELECT broken')).rejects.toThrow(
      /simulated failure/
    );

    expect(statements).toContain('ROLLBACK');
    expect(statements).not.toContain('COMMIT');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('releases the client even when ROLLBACK itself fails', async () => {
    const release = jest.fn();
    const client = {
      query: jest.fn(async (text: string) => {
        if (text === 'SELECT boom') throw new Error('boom');
        if (text === 'ROLLBACK') throw new Error('connection lost');
        return { rows: [] };
      }),
      release,
    };
    const pool = { connect: jest.fn(async () => client) };

    await expect(queryWithClass(pool, 'interactive', TIMEOUTS, 'SELECT boom')).rejects.toThrow(
      'boom'
    );
    expect(release).toHaveBeenCalledTimes(1);
  });
});

describe('isStatementTimeoutError', () => {
  it('recognises SQLSTATE 57014 and ignores other errors', () => {
    expect(isStatementTimeoutError({ code: '57014' })).toBe(true);
    expect(isStatementTimeoutError({ code: '23505' })).toBe(false);
    expect(isStatementTimeoutError(new Error('nope'))).toBe(false);
    expect(isStatementTimeoutError(null)).toBe(false);
  });
});

/**
 * Slow-query test against a real PostgreSQL. Runs in the migration-safety CI job
 * (TEST_DATABASE_URL points at the ephemeral database). Skipped locally unless set.
 */
const describeWithDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeWithDb('per-class statement timeouts against a real database (#1811)', () => {
  // A single connection makes it observable whether a SET LOCAL leaked to the
  // next borrower of the same pooled connection.
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 1 });

  afterAll(async () => {
    await pool.end();
  });

  it('fails an interactive slow query fast', async () => {
    const started = Date.now();

    await expect(
      runWithQueryClass(pool, 'interactive', { interactive: 300, reporting: 5000 }, (client) =>
        client.query('SELECT pg_sleep(2)')
      )
    ).rejects.toMatchObject({ code: '57014' });

    expect(Date.now() - started).toBeLessThan(1500);
  });

  it('lets a reporting query run past the interactive limit', async () => {
    const result = await runWithQueryClass(
      pool,
      'reporting',
      { interactive: 300, reporting: 5000 },
      (client) => client.query<{ done: boolean }>('SELECT pg_sleep(1), true AS done')
    );

    expect(result.rows[0].done).toBe(true);
  });

  it('does not leak the class timeout to the next borrower of the connection', async () => {
    await runWithQueryClass(pool, 'reporting', { interactive: 300, reporting: 5000 }, (client) =>
      client.query('SELECT 1')
    );

    const client = await pool.connect();
    try {
      const { rows } = await client.query<{ statement_timeout: string }>('SHOW statement_timeout');
      expect(rows[0].statement_timeout).toBe('0');
    } finally {
      client.release();
    }
  });
});
