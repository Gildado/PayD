export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  pageCount: number;
}

export function parsePaginationParams(
  page?: string | number,
  limit?: string | number,
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

export function createPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
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
