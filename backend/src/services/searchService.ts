import { Pool } from 'pg';
import pool from '../config/database.js';

export interface SearchFilters {
  query?: string;
  q?: string; // shorthand alias for query
  status?: string[];
  department?: string;
  position?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class SearchService {
  private pool: Pool;

  constructor(poolInstance: Pool = pool) {
    this.pool = poolInstance;
  }

  async searchEmployees(
    organizationId: number,
    filters: SearchFilters
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const {
      query,
      q,
      status,
      department,
      position,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = filters;

    // Support ?q= as a shorthand for ?query=
    const searchTerm = (query || q || '').trim();

    const offset = (page - 1) * limit;
    const params: (string | number | string[])[] = [organizationId];
    let paramIndex = 2;

    // Build WHERE clause
    const conditions: string[] = ['organization_id = $1', 'deleted_at IS NULL'];

    // Full-text search across name, email, department, position
    if (searchTerm) {
      conditions.push(
        `(search_vector @@ plainto_tsquery('english', $${paramIndex})
          OR first_name ILIKE $${paramIndex + 1}
          OR last_name ILIKE $${paramIndex + 1}
          OR email ILIKE $${paramIndex + 1}
          OR wallet_address ILIKE $${paramIndex + 1}
          OR department ILIKE $${paramIndex + 1}
          OR position ILIKE $${paramIndex + 1})`
      );
      params.push(searchTerm, `%${searchTerm}%`);
      paramIndex += 2;
    }

    // Status filter
    if (status && status.length > 0) {
      conditions.push(`status = ANY($${paramIndex}::text[])`);
      params.push(status);
      paramIndex++;
    }

    // Department filter (exact, case-insensitive)
    if (department && department.trim()) {
      conditions.push(`LOWER(department) = LOWER($${paramIndex})`);
      params.push(department.trim());
      paramIndex++;
    }

    // Position filter (partial match)
    if (position && position.trim()) {
      conditions.push(`position ILIKE $${paramIndex}`);
      params.push(`%${position.trim()}%`);
      paramIndex++;
    }

    // Date range filter
    if (dateFrom) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      conditions.push(`created_at <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Validate sort column
    const allowedSortColumns = [
      'created_at', 'first_name', 'last_name', 'email',
      'status', 'department', 'position', 'base_salary',
    ];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM employees
      WHERE ${whereClause}
    `;

    // Data query with relevance ranking when a search term is provided
    const dataQuery = `
      SELECT
        id,
        organization_id,
        first_name,
        last_name,
        email,
        wallet_address,
        status,
        position,
        department,
        base_salary,
        base_currency,
        hire_date,
        created_at,
        updated_at
        ${searchTerm ? `, ts_rank(search_vector, plainto_tsquery('english', $2)) as rank` : ''}
      FROM employees
      WHERE ${whereClause}
      ORDER BY ${searchTerm ? 'rank DESC,' : ''} ${sortColumn} ${order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const [countResult, dataResult] = await Promise.all([
      this.pool.query(countQuery, params.slice(0, -2)),
      this.pool.query(dataQuery, params),
    ]);

    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    return {
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async searchTransactions(
    _organizationId: number,
    filters: SearchFilters
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const {
      query,
      status,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = filters;

    const offset = (page - 1) * limit;
    const params: (string | number | boolean)[] = [];
    let paramIndex = 1;

    // Build WHERE clause against transaction_audit_logs columns
    const conditions: string[] = [];

    // Keyword search on tx_hash or source_account
    if (query && query.trim()) {
      conditions.push(`(tx_hash ILIKE $${paramIndex} OR source_account ILIKE $${paramIndex})`);
      params.push(`%${query.trim()}%`);
      paramIndex++;
    }

    // Status filter: map 'completed'/'confirmed' → successful=true, 'failed' → successful=false
    if (status && status.length > 0) {
      const successStatuses = ['completed', 'confirmed', 'success'];
      const failStatuses = ['failed', 'error'];
      const wantsSuccess = status.some((s) => successStatuses.includes(s));
      const wantsFail = status.some((s) => failStatuses.includes(s));
      if (wantsSuccess && !wantsFail) {
        conditions.push(`successful = $${paramIndex++}`);
        params.push(true);
      } else if (wantsFail && !wantsSuccess) {
        conditions.push(`successful = $${paramIndex++}`);
        params.push(false);
      }
      // If both or neither are matched, omit the filter (return all)
    }

    // Date range on stellar_created_at
    if (dateFrom) {
      conditions.push(`stellar_created_at >= $${paramIndex++}`);
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push(`stellar_created_at <= $${paramIndex++}`);
      params.push(dateTo);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate sort column against actual table columns
    const allowedSortColumns = ['created_at', 'stellar_created_at', 'tx_hash', 'fee_charged'];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const countQuery = `
      SELECT COUNT(*) as total
      FROM transaction_audit_logs
      ${whereClause}
    `;

    const dataQuery = `
      SELECT
        id,
        tx_hash,
        source_account,
        ledger_sequence,
        stellar_created_at,
        fee_charged,
        operation_count,
        memo,
        successful,
        created_at
      FROM transaction_audit_logs
      ${whereClause}
      ORDER BY ${sortColumn} ${order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const [countResult, dataResult] = await Promise.all([
      this.pool.query(countQuery, params.slice(0, -2)),
      this.pool.query(dataQuery, params),
    ]);

    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    return {
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }
}

export default new SearchService();
