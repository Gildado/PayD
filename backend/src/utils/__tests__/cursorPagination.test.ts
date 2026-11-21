import {
  buildCursorPage,
  buildKeysetClause,
  buildOrderBy,
  decodeCursor,
  encodeCursor,
  MAX_CURSOR_PAGE_SIZE,
  parseCursorQuery,
} from '../cursorPagination.js';
import { HttpError } from '../httpError.js';

const ORDERING = { sortColumn: 'created_at', idColumn: 'id', order: 'DESC' as const };

describe('cursor encoding', () => {
  it('round-trips a timestamp position', () => {
    const position = { kind: 'timestamp' as const, sort: 1_700_000_000_000, id: 42 };
    expect(decodeCursor(encodeCursor(position))).toEqual(position);
  });

  it('round-trips a plain value position', () => {
    const position = { kind: 'value' as const, sort: 'Alice', id: 7 };
    expect(decodeCursor(encodeCursor(position))).toEqual(position);
  });

  it('produces URL-safe output', () => {
    const cursor = encodeCursor({ kind: 'value', sort: 'a+b/c?d=e', id: 1 });
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ['not base64 json', '%%%'],
    ['wrong shape', Buffer.from('{"a":1}').toString('base64url')],
    ['bad kind', Buffer.from(JSON.stringify(['nope', 1, 1])).toString('base64url')],
    ['non-integer id', Buffer.from(JSON.stringify(['value', 'x', 1.5])).toString('base64url')],
    [
      'timestamp not numeric',
      Buffer.from(JSON.stringify(['timestamp', 'x', 1])).toString('base64url'),
    ],
  ])('rejects a malformed cursor (%s) with 400', (_label, raw) => {
    expect(() => decodeCursor(raw)).toThrow(HttpError);
    try {
      decodeCursor(raw);
    } catch (e) {
      expect((e as HttpError).status).toBe(400);
    }
  });
});

describe('parseCursorQuery', () => {
  it('applies the default limit when none is supplied', () => {
    expect(parseCursorQuery({}, { defaultLimit: 15 })).toEqual({ cursor: null, limit: 15 });
  });

  it('accepts the maximum page size exactly', () => {
    expect(parseCursorQuery({ limit: String(MAX_CURSOR_PAGE_SIZE) }).limit).toBe(
      MAX_CURSOR_PAGE_SIZE
    );
  });

  it.each([['0'], ['101'], ['-1'], ['2.5'], ['abc']])('rejects limit=%s', (limit) => {
    expect(() => parseCursorQuery({ limit })).toThrow(HttpError);
  });

  it('rejects an array-valued cursor', () => {
    expect(() => parseCursorQuery({ cursor: ['a', 'b'] })).toThrow(HttpError);
  });

  it('decodes a valid cursor', () => {
    const cursor = encodeCursor({ kind: 'value', sort: 'x', id: 3 });
    expect(parseCursorQuery({ cursor, limit: '5' })).toEqual({
      cursor: { kind: 'value', sort: 'x', id: 3 },
      limit: 5,
    });
  });
});

describe('buildKeysetClause', () => {
  it('emits nothing when there is no cursor', () => {
    expect(buildKeysetClause(ORDERING, null, 3)).toEqual({ sql: '', values: [], nextIndex: 3 });
  });

  it('emits a row-value comparison for DESC ordering', () => {
    const clause = buildKeysetClause(ORDERING, { kind: 'value', sort: 'v', id: 9 }, 4, 'pal.');
    expect(clause.sql).toBe(' AND (pal.created_at, pal.id) < ($4, $5)');
    expect(clause.values).toEqual(['v', 9]);
    expect(clause.nextIndex).toBe(6);
  });

  it('uses > for ASC ordering', () => {
    const clause = buildKeysetClause(
      { ...ORDERING, order: 'ASC' },
      { kind: 'value', sort: 'v', id: 1 },
      1
    );
    expect(clause.sql).toContain('>');
  });

  it('restores timestamps as Date objects', () => {
    const ms = Date.UTC(2026, 0, 2, 3, 4, 5);
    const clause = buildKeysetClause(ORDERING, { kind: 'timestamp', sort: ms, id: 2 }, 1);
    expect(clause.values[0]).toBeInstanceOf(Date);
    expect((clause.values[0] as Date).getTime()).toBe(ms);
  });
});

describe('buildOrderBy', () => {
  it('adds the id tiebreaker so ordering is total', () => {
    expect(buildOrderBy(ORDERING)).toBe('ORDER BY created_at DESC, id DESC');
    expect(buildOrderBy(ORDERING, 'pal.')).toBe('ORDER BY pal.created_at DESC, pal.id DESC');
  });
});

describe('buildCursorPage (page boundaries)', () => {
  const row = (id: number, created: Date) => ({ id, created_at: created });
  const base = new Date('2026-01-01T00:00:00Z');
  const rows = [3, 2, 1].map((id) => row(id, new Date(base.getTime() + id * 1000)));

  it('returns no nextCursor when the result fits in one page', () => {
    const page = buildCursorPage([...rows], 3, 'created_at');
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
    expect(page.data).toHaveLength(3);
  });

  it('trims the sentinel row and emits a cursor for the last returned row', () => {
    // Query fetched limit + 1 = 3 rows for a limit of 2
    const page = buildCursorPage([...rows], 2, 'created_at');
    expect(page.hasMore).toBe(true);
    expect(page.data.map((r) => r.id)).toEqual([3, 2]);
    expect(decodeCursor(page.nextCursor!)).toEqual({
      kind: 'timestamp',
      sort: base.getTime() + 2000,
      id: 2,
    });
  });

  it('handles an empty result', () => {
    const page = buildCursorPage([], 10, 'created_at');
    expect(page).toEqual({ data: [], limit: 10, hasMore: false, nextCursor: null });
  });

  it('handles a result exactly equal to the limit (no extra row)', () => {
    const page = buildCursorPage([...rows.slice(0, 2)], 2, 'created_at');
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('encodes string sort keys as value cursors', () => {
    const named = [
      { id: 2, first_name: 'Bo' },
      { id: 1, first_name: 'Al' },
    ];
    const page = buildCursorPage([...named, { id: 0, first_name: 'Zz' }], 2, 'first_name');
    expect(decodeCursor(page.nextCursor!)).toEqual({ kind: 'value', sort: 'Al', id: 1 });
  });
});
