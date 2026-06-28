import { parsePaginationParams, createPaginatedResult } from '../pagination.js';

// ─── parsePaginationParams ────────────────────────────────────────────────────

describe('parsePaginationParams', () => {
  it('returns defaults when called with no arguments', () => {
    const result = parsePaginationParams();
    expect(result.page).toBe(1);
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  it('parses numeric string arguments correctly', () => {
    const result = parsePaginationParams('3', '20');
    expect(result.page).toBe(3);
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(40); // (3 - 1) * 20
  });

  it('accepts numeric arguments directly', () => {
    const result = parsePaginationParams(2, 10);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(10); // (2 - 1) * 10
  });

  it('clamps page to minimum of 1 for a zero/negative value', () => {
    expect(parsePaginationParams('0').page).toBe(1);
    expect(parsePaginationParams('-5').page).toBe(1);
  });

  it('clamps limit to minimum of 1', () => {
    expect(parsePaginationParams('1', '0').limit).toBe(1);
    expect(parsePaginationParams('1', '-10').limit).toBe(1);
  });

  it('clamps limit to maximum of 500', () => {
    expect(parsePaginationParams('1', '9999').limit).toBe(500);
  });

  it('calculates offset correctly for page > 1', () => {
    const { offset } = parsePaginationParams('5', '100');
    expect(offset).toBe(400); // (5 - 1) * 100
  });
});

// ─── createPaginatedResult ────────────────────────────────────────────────────

describe('createPaginatedResult', () => {
  it('returns a well-formed paginated envelope', () => {
    const data = [1, 2, 3];
    const result = createPaginatedResult(data, 30, 1, 10);
    expect(result.data).toBe(data);
    expect(result.total).toBe(30);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.pageCount).toBe(3);
    expect(result.hasMore).toBe(true);
  });

  it('sets hasMore to false on the last page', () => {
    const result = createPaginatedResult(['a', 'b'], 12, 3, 5);
    // pageCount = ceil(12/5) = 3; page=3 is the last page
    expect(result.hasMore).toBe(false);
  });

  it('computes pageCount via ceiling division', () => {
    // 11 items / 5 per page → ceil(2.2) = 3 pages
    const result = createPaginatedResult([], 11, 1, 5);
    expect(result.pageCount).toBe(3);
  });

  it('works with an empty data array', () => {
    const result = createPaginatedResult([], 0, 1, 10);
    expect(result.data).toHaveLength(0);
    expect(result.hasMore).toBe(false);
    expect(result.pageCount).toBe(0);
  });

  it('is generic and preserves the data item type', () => {
    type Item = { id: number };
    const items: Item[] = [{ id: 1 }];
    const result = createPaginatedResult<Item>(items, 1, 1, 10);
    expect(result.data[0].id).toBe(1);
  });
});
