/**
 * Shared keyset (cursor) pagination helper (issue #1807).
 *
 * A cursor encodes the sort value and the primary key of the last row the
 * client has seen. The next page is selected with a row-value comparison:
 *
 *   WHERE (sort_column, id) < ($1, $2)      -- DESC ordering
 *   ORDER BY sort_column DESC, id DESC
 *
 * Because `id` is a unique tiebreaker, the ordering is total and stable: rows
 * that share a timestamp are never skipped or repeated across page boundaries,
 * and inserts that happen between requests do not shift earlier pages.
 *
 * Cursors are opaque to clients: base64url-encoded JSON. Malformed cursors
 * raise an HttpError (400) so controllers can return a consistent error.
 */

import { HttpError } from './httpError.js';

export const DEFAULT_CURSOR_PAGE_SIZE = 20;
export const MAX_CURSOR_PAGE_SIZE = 100;

export type SortOrder = 'ASC' | 'DESC';

/** Decoded cursor position. `kind` lets timestamps round-trip as Dates. */
export interface CursorPosition {
  kind: 'timestamp' | 'value';
  /** Epoch milliseconds for timestamps, otherwise the raw sort value. */
  sort: string | number;
  /** Primary key of the last row returned on the previous page. */
  id: number;
}

/** Stable ordering descriptor shared by services and the helper. */
export interface CursorOrdering {
  /** Whitelisted SQL column used as the primary sort key (never user input). */
  sortColumn: string;
  /** Whitelisted SQL column for the unique tiebreaker. Usually `id`. */
  idColumn: string;
  order: SortOrder;
}

export interface ParsedCursorQuery {
  cursor: CursorPosition | null;
  limit: number;
}

export interface CursorPage<T> {
  data: T[];
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
}

// ── Encoding ─────────────────────────────────────────────────────────────────

function toPosition(sortValue: unknown, id: unknown): CursorPosition {
  const numericId = typeof id === 'number' ? id : Number(id);
  if (!Number.isInteger(numericId)) {
    throw new Error('Cursor row is missing an integer id');
  }

  if (sortValue instanceof Date) {
    return { kind: 'timestamp', sort: sortValue.getTime(), id: numericId };
  }
  if (typeof sortValue === 'string' || typeof sortValue === 'number') {
    return { kind: 'value', sort: sortValue, id: numericId };
  }
  throw new Error('Unsupported cursor sort value type');
}

export function encodeCursor(position: CursorPosition): string {
  return Buffer.from(JSON.stringify([position.kind, position.sort, position.id])).toString(
    'base64url'
  );
}

export function decodeCursor(raw: string): CursorPosition {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    throw HttpError.badRequest('Invalid cursor');
  }

  if (!Array.isArray(parsed) || parsed.length !== 3) {
    throw HttpError.badRequest('Invalid cursor');
  }

  const [kind, sort, id] = parsed;
  const validSort =
    (kind === 'timestamp' && typeof sort === 'number' && Number.isFinite(sort)) ||
    (kind === 'value' && (typeof sort === 'string' || typeof sort === 'number'));

  if (!validSort || !Number.isInteger(id)) {
    throw HttpError.badRequest('Invalid cursor');
  }

  return { kind, sort, id } as CursorPosition;
}

// ── Query parsing ────────────────────────────────────────────────────────────

/**
 * Parse `?cursor=&limit=` into a validated cursor position and page size.
 * `limit` must be an integer in [1, maxLimit]; anything else is a 400.
 */
export function parseCursorQuery(
  query: { cursor?: unknown; limit?: unknown },
  options: { defaultLimit?: number; maxLimit?: number } = {}
): ParsedCursorQuery {
  const defaultLimit = options.defaultLimit ?? DEFAULT_CURSOR_PAGE_SIZE;
  const maxLimit = options.maxLimit ?? MAX_CURSOR_PAGE_SIZE;

  let limit = defaultLimit;
  if (query.limit !== undefined && query.limit !== '') {
    const raw = String(query.limit);
    if (!/^\d+$/.test(raw)) {
      throw HttpError.badRequest(`limit must be an integer between 1 and ${maxLimit}`);
    }
    limit = Number(raw);
    if (limit < 1 || limit > maxLimit) {
      throw HttpError.badRequest(`limit must be an integer between 1 and ${maxLimit}`);
    }
  }

  let cursor: CursorPosition | null = null;
  if (typeof query.cursor === 'string' && query.cursor !== '') {
    cursor = decodeCursor(query.cursor);
  } else if (query.cursor !== undefined && query.cursor !== '') {
    throw HttpError.badRequest('cursor must be a single string value');
  }

  return { cursor, limit };
}

// ── SQL helpers ──────────────────────────────────────────────────────────────

export interface KeysetClause {
  /** SQL fragment starting with `AND`, or empty string when there is no cursor. */
  sql: string;
  values: unknown[];
  /** The next free positional parameter index. */
  nextIndex: number;
}

/**
 * Build the keyset condition for a page that starts after `cursor`.
 *
 * Column names must come from the caller's whitelist; they are interpolated
 * into SQL. Values are always bound as parameters.
 *
 * @param prefix     Optional table alias, e.g. `pal.` (include the dot).
 * @param startIndex The first unused `$n` placeholder index.
 */
export function buildKeysetClause(
  ordering: CursorOrdering,
  cursor: CursorPosition | null,
  startIndex: number,
  prefix = ''
): KeysetClause {
  if (!cursor) {
    return { sql: '', values: [], nextIndex: startIndex };
  }

  const sortValue = cursor.kind === 'timestamp' ? new Date(cursor.sort as number) : cursor.sort;
  const operator = ordering.order === 'DESC' ? '<' : '>';
  const sortRef = `${prefix}${ordering.sortColumn}`;
  const idRef = `${prefix}${ordering.idColumn}`;

  return {
    sql: ` AND (${sortRef}, ${idRef}) ${operator} ($${startIndex}, $${startIndex + 1})`,
    values: [sortValue, cursor.id],
    nextIndex: startIndex + 2,
  };
}

/** ORDER BY fragment matching `buildKeysetClause`, e.g. `created_at DESC, id DESC`. */
export function buildOrderBy(ordering: CursorOrdering, prefix = ''): string {
  return `ORDER BY ${prefix}${ordering.sortColumn} ${ordering.order}, ${prefix}${ordering.idColumn} ${ordering.order}`;
}

// ── Page assembly ────────────────────────────────────────────────────────────

/**
 * Turn a result fetched with `LIMIT limit + 1` into a page.
 * The extra row, if present, only signals that another page exists.
 *
 * @param rows       Rows as returned by the query (may contain limit + 1 rows)
 * @param limit      Requested page size
 * @param sortField  Name of the sort column on each row (e.g. `created_at`)
 * @param idField    Name of the id column on each row (usually `id`)
 */
export function buildCursorPage<T extends Record<string, any>>(
  rows: T[],
  limit: number,
  sortField: string,
  idField = 'id'
): CursorPage<T> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const last = data[data.length - 1];

  const nextCursor =
    hasMore && last ? encodeCursor(toPosition(last[sortField], last[idField])) : null;

  return { data, limit, hasMore, nextCursor };
}
