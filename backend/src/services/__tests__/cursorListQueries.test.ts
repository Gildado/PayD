/**
 * SQL-shape tests for keyset (cursor) listings (issue #1807).
 *
 * pool.query is spied so no database is needed. These pin the ORDER BY,
 * keyset predicate, LIMIT placeholder and bound values for each listing.
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { pool } from '../../config/database.js';
import { TransactionAuditService } from '../transactionAuditService.js';
import { PayrollAuditService } from '../payrollAuditService.js';
import { employeeService } from '../employeeService.js';
import { encodeCursor } from '../../utils/cursorPagination.js';

const sortTs = Date.UTC(2026, 0, 2, 12, 0, 0);
const cursor = encodeCursor({ kind: 'timestamp', sort: sortTs, id: 42 });

type QueryCall = [string, unknown[]];

describe('cursor listing SQL', () => {
  let querySpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    querySpy = jest.spyOn(pool, 'query').mockResolvedValue({ rows: [], rowCount: 0 } as any);
  });

  afterEach(() => {
    querySpy.mockRestore();
  });

  const lastCall = (): QueryCall => querySpy.mock.calls[querySpy.mock.calls.length - 1] as QueryCall;

  describe('TransactionAuditService.listByCursor', () => {
    it('orders by created_at, id and fetches limit + 1 rows', async () => {
      await TransactionAuditService.listByCursor(null, 5, {});

      const [sql, values] = lastCall();
      expect(sql).toContain('ORDER BY created_at DESC, id DESC');
      expect(sql).toContain('WHERE TRUE');
      expect(sql).toMatch(/LIMIT \$1$/);
      expect(values).toEqual([6]);
      expect(sql).not.toContain('OFFSET');
    });

    it('adds the keyset predicate after the filters', async () => {
      await TransactionAuditService.listByCursor(
        { kind: 'timestamp', sort: sortTs, id: 42 },
        5,
        { sourceAccount: 'GSRC' }
      );

      const [sql, values] = lastCall();
      expect(sql).toContain('WHERE source_account = $1 AND (created_at, id) < ($2, $3)');
      expect(sql).toContain('LIMIT $4');
      expect(values[0]).toBe('GSRC');
      expect(values[1]).toEqual(new Date(sortTs));
      expect(values[2]).toBe(42);
      expect(values[3]).toBe(6);
    });
  });

  describe('PayrollAuditService.getAuditLogsByCursor', () => {
    it('qualifies keyset columns with the pal alias', async () => {
      await PayrollAuditService.getAuditLogsByCursor(
        { organizationId: 7 },
        { kind: 'timestamp', sort: sortTs, id: 9 },
        20
      );

      const [sql, values] = lastCall();
      expect(sql).toContain('WHERE pal.organization_id = $1 AND (pal.created_at, pal.id) < ($2, $3)');
      expect(sql).toContain('ORDER BY pal.created_at DESC, pal.id DESC');
      expect(sql).toContain('LIMIT $4');
      expect(sql).not.toContain('OFFSET');
      expect(values).toEqual([7, new Date(sortTs), 9, 21]);
    });
  });

  describe('EmployeeService.findAll (cursor mode)', () => {
    const baseParams = {
      page: 1,
      limit: 2,
      sort_by: 'created_at',
      sort_order: 'desc',
      cursor,
    } as any;

    it('pages by created_at DESC, id DESC with no total count', async () => {
      await employeeService.findAll(3, baseParams);

      const [sql, values] = lastCall();
      expect(sql).toContain('WHERE deleted_at IS NULL AND organization_id = $1');
      expect(sql).toContain('(created_at, id) < ($2, $3)');
      expect(sql).toContain('ORDER BY created_at DESC, id DESC');
      expect(sql).toContain('LIMIT $4');
      expect(sql).not.toContain('count(*) OVER()');
      expect(values).toEqual([3, new Date(sortTs), 42, 3]);
    });

    it('returns the cursor envelope and a nextCursor when there are more rows', async () => {
      querySpy.mockResolvedValueOnce({
        rows: [
          { id: 50, created_at: new Date(sortTs + 2000) },
          { id: 49, created_at: new Date(sortTs + 1000) },
          { id: 48, created_at: new Date(sortTs) },
        ],
      } as any);

      const page = await employeeService.findAll(3, baseParams);

      expect(page).toMatchObject({ limit: 2, hasMore: true });
      expect((page as any).data.map((r: any) => r.id)).toEqual([50, 49]);
      expect((page as any).nextCursor).toEqual(expect.any(String));
    });

    it('rejects cursor mode combined with search', async () => {
      await expect(
        employeeService.findAll(3, { ...baseParams, q: 'alice' })
      ).rejects.toMatchObject({ status: 400 });
    });

    it('rejects cursor mode with a non-created_at sort column', async () => {
      await expect(
        employeeService.findAll(3, { ...baseParams, sort_by: 'first_name' })
      ).rejects.toMatchObject({ status: 400 });
    });
  });
});
