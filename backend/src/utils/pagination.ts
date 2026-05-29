export interface PaginationParams {
  /** The current page number (1-based). */
  page: number;
  /** Maximum number of items per page. */
  limit: number;
  /** Number of items to skip (computed as `(page - 1) * limit`). */
  offset: number;
}

export interface PaginatedResult<T> {
  /** The subset of items for the current page. */
  data: T[];
  /** The current page number (1-based). */
  page: number;
  /** The requested limit for this page. */
  limit: number;
  /** Total number of items across all pages. */
  total: number;
  /** Whether there are more pages available after this one. */
  hasMore: boolean;
  /** Total number of pages (computed as `ceil(total / limit)`). */
  pageCount: number;
}

/**
 * Parses query parameters into safe pagination values.
 * Defaults: page=1, limit=50. Constraints: page>=1, 1<=limit<=500.
 *
 * @param page - Page number from query (string or number)
 * @param limit - Items per page from query (string or number)
 * @returns Safe pagination parameters with computed offset
 */
export function parsePaginationParams(
  page?: string | number,
  limit?: string | number
): PaginationParams {
  const pageNum = Math.max(1, parseInt(String(page) || '1', 10));
  const limitNum = Math.min(Math.max(1, parseInt(String(limit) || '50', 10)), 500);
  const offset = (pageNum - 1) * limitNum;

  return {
    page: pageNum,
    limit: limitNum,
    offset,
  };
}

/**
 * Creates a standardized paginated response envelope.
 *
 * @param data - Array of items for current page (generic type T)
 * @param total - Total item count across all pages
 * @param page - Current page number
 * @param limit - Items per page
 * @returns Complete paginated result object with metadata
 * @template T - Type of data items
 */
export function createPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  const pageCount = Math.ceil(total / limit);
  const hasMore = page < pageCount;

  return {
    data,
    page,
    limit,
    total,
    hasMore,
    pageCount,
  };
}

export interface CursorPaginationParams {
  /** The cursor pointing to the last item of the previous page */
  cursor?: string;
  /** Maximum number of items per page. */
  limit: number;
  /** Direction of pagination (forward or backward) */
  direction: 'forward' | 'backward';
}

export interface CursorPaginatedResult<T> {
  /** The subset of items for the current page. */
  data: T[];
  /** The cursor pointing to the last item of the current page. */
  nextCursor: string | null;
  /** The cursor pointing to the first item of the current page. */
  prevCursor: string | null;
  /** Whether there are more pages available after this one. */
  hasMore: boolean;
  /** The requested limit for this page. */
  limit: number;
}

export function parseCursorPaginationParams(
  cursor?: string,
  limit?: string | number,
  direction?: 'forward' | 'backward'
): CursorPaginationParams {
  const limitNum = Math.min(Math.max(1, parseInt(String(limit) || '50', 10)), 500);
  
  return {
    cursor,
    limit: limitNum,
    direction: direction || 'forward',
  };
}

export function createCursorPaginatedResult<T>(
  data: T[],
  limit: number,
  getNextCursor: (item: T) => string,
  getPrevCursor: (item: T) => string
): CursorPaginatedResult<T> {
  const hasMore = data.length > limit;
  const pageData = hasMore ? data.slice(0, limit) : data;
  
  const nextCursor = pageData.length > 0 && hasMore ? getNextCursor(pageData[pageData.length - 1]) : null;
  const prevCursor = pageData.length > 0 ? getPrevCursor(pageData[0]) : null;

  return {
    data: pageData,
    nextCursor,
    prevCursor,
    hasMore,
    limit,
  };
}
