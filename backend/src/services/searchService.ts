import { Pool } from 'pg';
import pool from '../config/database';

export interface SearchFilters {
  query?: string;
  status?: string[];
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
      status,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = filters;

    const offset = (page - 1) * limit;
    const params: (string | number | string[])[] = [organizationId];
    let paramIndex = 2;

    // Build WHERE clause
    const conditions: string[] = ['organization_id = $1'];

    // Full-text search
    if (query && query.trim()) {
      conditions.push(`search_vector @@ plainto_tsquery('english', $${paramIndex})`);
      params.push(query.trim());
      paramIndex++;
    }

    // Status filter
    if (status && status.length > 0) {
      conditions.push(`status = ANY($${paramIndex}::text[])`);
      params.push(status);
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
    const allowedSortColumns = ['created_at', 'first_name', 'last_name', 'email', 'status'];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM employees
      WHERE ${whereClause}
    `;

    // Data query with ranking for full-text search
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
        created_at,
        updated_at
        ${query ? `, ts_rank(search_vector, plainto_tsquery('english', $${params.indexOf(query.trim()) + 1})) as rank` : ''}
      FROM employees
      WHERE ${whereClause}
      ORDER BY ${query ? 'rank DESC,' : ''} ${sortColumn} ${order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const [countResult, dataResult] = await Promise.all([
      this.pool.query(countQuery, params.slice(0, paramIndex - 1)),
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
    organizationId: number,
    filters: SearchFilters
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const {
      query,
      status,
      dateFrom,
      dateTo,
      amountMin,
      amountMax,
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = filters;

    const offset = (page - 1) * limit;
    const params: (string | number | string[])[] = [organizationId];
    let paramIndex = 2;

    // Build WHERE clause
    const conditions: string[] = ['organization_id = $1'];

    // Full-text search
    if (query && query.trim()) {
      conditions.push(`search_vector @@ plainto_tsquery('english', $${paramIndex})`);
      params.push(query.trim());
      paramIndex++;
    }

    // Status filter
    if (status && status.length > 0) {
      conditions.push(`status = ANY($${paramIndex}::text[])`);
      params.push(status);
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

    // Amount range filter
    if (amountMin !== undefined) {
      conditions.push(`amount >= $${paramIndex}`);
      params.push(amountMin);
      paramIndex++;
    }

    if (amountMax !== undefined) {
      conditions.push(`amount <= $${paramIndex}`);
      params.push(amountMax);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Validate sort column
    const allowedSortColumns = ['created_at', 'amount', 'status', 'tx_hash'];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM transactions
      WHERE ${whereClause}
    `;

    // Data query with ranking for full-text search
    const dataQuery = `
      SELECT 
        t.id,
        t.organization_id,
        t.employee_id,
        t.tx_hash,
        t.amount,
        t.asset_code,
        t.status,
        t.transaction_type,
        t.created_at,
        t.updated_at,
        e.first_name as employee_first_name,
        e.last_name as employee_last_name
        ${query ? `, ts_rank(t.search_vector, plainto_tsquery('english', $${params.indexOf(query.trim()) + 1})) as rank` : ''}
      FROM transactions t
      LEFT JOIN employees e ON t.employee_id = e.id
      WHERE ${whereClause}
      ORDER BY ${query ? 'rank DESC,' : ''} ${sortColumn} ${order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const [countResult, dataResult] = await Promise.all([
      this.pool.query(countQuery, params.slice(0, paramIndex - 1)),
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
