import { Pool, PoolClient } from 'pg';
import { pool } from '../config/database.js';
import {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  EmployeeQueryInput,
} from '../schemas/employeeSchema.js';
import { webhookNotificationService, WEBHOOK_EVENTS } from './webhookNotificationService.js';
import { StrKey } from '@stellar/stellar-sdk';
import { withRetry } from '../utils/retry.js';
import { CacheService } from './cacheService.js';
import { HttpError } from '../utils/httpError.js';
import {
  buildCursorPage,
  buildKeysetClause,
  buildOrderBy,
  CursorOrdering,
  MAX_CURSOR_PAGE_SIZE,
  parseCursorQuery,
} from '../utils/cursorPagination.js';
import logger from '../utils/logger.js';

const EMPLOYEE_CACHE_TTL = 5 * 60; // 5 minutes (#1037)
const employeeCache = new CacheService({ ttlSeconds: EMPLOYEE_CACHE_TTL, keyPrefix: 'emp' });

function employeeCacheKey(organizationId: number, employeeId: number): string {
  // Tenant-scoped key prevents cross-tenant data leaks (#1037).
  return `${organizationId}:${employeeId}`;
}

export interface EmployeeRow {
  id: number;
  organization_id: number;
  first_name: string;
  last_name: string;
  email: string;
  wallet_address: string | null;
  position: string | null;
  department: string | null;
  status: string;
  base_salary: number;
  base_currency: string;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  country: string | null;
  job_title: string | null;
  hire_date: string | null;
  date_of_birth: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  withdrawal_preference: string;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_routing_number: string | null;
  mobile_money_provider: string | null;
  mobile_money_account: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  total_count?: string;
  [column: string]: unknown;
}

export type EmployeeDto = Omit<EmployeeRow, 'total_count'>;

export interface EmployeePagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface EmployeePage {
  data: EmployeeDto[];
  pagination: EmployeePagination;
}

export interface EmployeeCursorPage {
  data: EmployeeDto[];
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
}

type EmployeeExecutor = Pool | PoolClient;

export class EmployeeService {
  private validateStellarAddress(address?: string): void {
    if (address && !StrKey.isValidEd25519PublicKey(address)) {
      throw new Error(`Invalid Stellar wallet address: ${address}`);
    }
  }

  async create(data: CreateEmployeeInput, dbClient?: EmployeeExecutor): Promise<EmployeeDto> {
    this.validateStellarAddress(data.wallet_address);
    const executor = (dbClient ?? pool) as Pool;
    const {
      organization_id,
      first_name,
      last_name,
      email,
      wallet_address,
      position,
      department,
      status,
      base_salary,
      base_currency,
      phone,
      address_line1,
      address_line2,
      city,
      state_province,
      postal_code,
      country,
      job_title,
      hire_date,
      date_of_birth,
      emergency_contact_name,
      emergency_contact_phone,
      withdrawal_preference,
      bank_name,
      bank_account_number,
      bank_routing_number,
      mobile_money_provider,
      mobile_money_account,
      notes,
    } = data;

    const query = `
      INSERT INTO employees (
        organization_id, first_name, last_name, email, wallet_address,
        position, department, status, base_salary, base_currency,
        phone, address_line1, address_line2, city, state_province,
        postal_code, country, job_title, hire_date, date_of_birth,
        emergency_contact_name, emergency_contact_phone,
        withdrawal_preference, bank_name, bank_account_number,
        bank_routing_number, mobile_money_provider, mobile_money_account,
        notes
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29
      )
      RETURNING *;
    `;

    const values = [
      organization_id,
      first_name,
      last_name,
      email,
      wallet_address || null,
      position || null,
      department || null,
      status || 'active',
      base_salary || 0,
      base_currency || 'USDC',
      phone || null,
      address_line1 || null,
      address_line2 || null,
      city || null,
      state_province || null,
      postal_code || null,
      country || null,
      job_title || null,
      hire_date || null,
      date_of_birth || null,
      emergency_contact_name || null,
      emergency_contact_phone || null,
      withdrawal_preference || 'bank',
      bank_name || null,
      bank_account_number || null,
      bank_routing_number || null,
      mobile_money_provider || null,
      mobile_money_account || null,
      notes || null,
    ];

    const result = await withRetry(() => executor.query<EmployeeRow>(query, values));
    const employee = result.rows[0];
    if (!employee) {
      throw new Error('Failed to create employee: no row returned');
    }

    EmployeeService.dispatchWebhook(organization_id, WEBHOOK_EVENTS.EMPLOYEE_ADDED, employee).catch(
      (err: unknown) => logger.error('Failed to dispatch employee.added webhook', err)
    );

    return employee;
  }

  private static async dispatchWebhook(
    organization_id: number,
    eventType: string,
    payload: EmployeeDto
  ): Promise<void> {
    try {
      await webhookNotificationService.dispatch(eventType, payload, organization_id);
    } catch (error) {
      logger.error(`Webhook dispatch failed for ${eventType}`, error);
    }
  }

  async findAll(
    organization_id: number,
    params: EmployeeQueryInput
  ): Promise<EmployeePage | EmployeeCursorPage> {
    const {
      page = 1,
      limit = 10,
      q,
      search,
      status,
      department,
      hire_date_from,
      hire_date_to,
      withdrawal_preference,
      salary_min,
      salary_max,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = params;
    // `q` is the canonical search param; `search` is kept for backwards compatibility
    const searchTerm = q ?? search;
    const offset = (page - 1) * limit;

    const allowedSortColumns = [
      'created_at',
      'first_name',
      'last_name',
      'email',
      'hire_date',
      'base_salary',
    ];
    const sortColumn = allowedSortColumns.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order === 'asc' ? 'ASC' : 'DESC';

    let whereClause = `WHERE deleted_at IS NULL`;
    const values: (string | number)[] = [];
    let paramIndex = 1;

    if (organization_id) {
      whereClause += ` AND organization_id = $${paramIndex++}`;
      values.push(organization_id);
    }

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      values.push(status);
    }

    if (department) {
      whereClause += ` AND department = $${paramIndex++}`;
      values.push(department);
    }

    let ftsParamIndex: number | null = null;
    if (searchTerm) {
      ftsParamIndex = paramIndex;
      whereClause += ` AND (
        search_vector @@ plainto_tsquery('english', $${paramIndex})
        OR wallet_address ILIKE $${paramIndex + 1}
      )`;
      values.push(searchTerm, `%${searchTerm}%`);
      paramIndex += 2;
    }

    if (hire_date_from) {
      whereClause += ` AND hire_date >= $${paramIndex++}`;
      values.push(hire_date_from);
    }

    if (hire_date_to) {
      whereClause += ` AND hire_date <= $${paramIndex++}`;
      values.push(hire_date_to);
    }

    if (withdrawal_preference) {
      whereClause += ` AND withdrawal_preference = $${paramIndex++}`;
      values.push(withdrawal_preference);
    }

    if (salary_min !== undefined) {
      whereClause += ` AND base_salary >= $${paramIndex++}`;
      values.push(salary_min);
    }

    if (salary_max !== undefined) {
      whereClause += ` AND base_salary <= $${paramIndex++}`;
      values.push(salary_max);
    }

    // Keyset pagination (issue #1807). Cursor order is (created_at, id), so it
    // cannot be combined with full-text ranking or other sort columns.
    if (params.cursor !== undefined) {
      if (searchTerm) {
        throw HttpError.badRequest('cursor pagination cannot be combined with q or search');
      }
      if (sortColumn !== 'created_at') {
        throw HttpError.badRequest('cursor pagination only supports sort_by=created_at');
      }

      const parsedCursor = parseCursorQuery(
        { cursor: params.cursor, limit },
        { defaultLimit: 10, maxLimit: MAX_CURSOR_PAGE_SIZE }
      );
      const ordering: CursorOrdering = {
        sortColumn: 'created_at',
        idColumn: 'id',
        order: sortDirection,
      };
      const keyset = buildKeysetClause(ordering, parsedCursor.cursor, paramIndex);
      const cursorQuery = `
        SELECT * FROM employees
        ${whereClause}${keyset.sql}
        ${buildOrderBy(ordering)}
        LIMIT $${keyset.nextIndex}
      `;
      const cursorResult = await withRetry(() =>
        pool.query<EmployeeRow>(cursorQuery, [...values, ...keyset.values, parsedCursor.limit + 1])
      );

      const page = buildCursorPage(cursorResult.rows, parsedCursor.limit, 'created_at');
      return {
        data: page.data,
        limit: page.limit,
        hasMore: page.hasMore,
        nextCursor: page.nextCursor,
      };
    }

    const orderBy =
      ftsParamIndex !== null
        ? `ORDER BY ts_rank(search_vector, plainto_tsquery('english', $${ftsParamIndex})) DESC, ${sortColumn} ${sortDirection}`
        : `ORDER BY ${sortColumn} ${sortDirection}`;

    const query = `
      SELECT *, count(*) OVER() as total_count
      FROM employees
      ${whereClause}
      ${orderBy}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    values.push(limit, offset);

    const result = await withRetry(() => pool.query<EmployeeRow>(query, values));

    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
    const employees = result.rows.map((row: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omit total_count from employee entity
    const total = result.rows.length > 0 ? parseInt(result.rows[0]?.total_count ?? '0', 10) : 0;
    const employees = result.rows.map((row): EmployeeDto => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { total_count, ...employee } = row;
      return employee;
    });

    return {
      data: employees,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: number, organization_id: number): Promise<EmployeeDto | null> {
    const cacheKey = employeeCacheKey(organization_id, id);
    return employeeCache.remember(cacheKey, async () => {
      const query = `
        SELECT * FROM employees
        WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
      `;
      const result = await withRetry(() => pool.query<EmployeeRow>(query, [id, organization_id]));
      return result.rows[0] ?? null;
    });
  }

  async update(
    id: number,
    organization_id: number,
    data: UpdateEmployeeInput
  ): Promise<EmployeeDto | null> {
    if (data.wallet_address) {
      this.validateStellarAddress(data.wallet_address);
    }
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    let paramIndex = 1;

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    });

    if (fields.length === 0) return null;

    values.push(id, organization_id);
    const query = `
      UPDATE employees
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex++} AND organization_id = $${paramIndex} AND deleted_at IS NULL
      RETURNING *;
    `;

    const result = await withRetry(() => pool.query<EmployeeRow>(query, values));
    const employee = result.rows[0] ?? null;

    if (employee) {
      // Invalidate cache immediately so the next read reflects the update (#1037).
      await employeeCache.delete(employeeCacheKey(organization_id, id));

      EmployeeService.dispatchWebhook(
        organization_id,
        WEBHOOK_EVENTS.EMPLOYEE_UPDATED,
        employee
      ).catch((err: unknown) => logger.error('Failed to dispatch employee.updated webhook', err));
    }

    return employee;
  }

  async delete(id: number, organization_id: number): Promise<EmployeeDto | null> {
    const query = `
      UPDATE employees
      SET deleted_at = NOW(), status = 'inactive'
      WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
      RETURNING *;
    `;
    const result = await withRetry(() => pool.query<EmployeeRow>(query, [id, organization_id]));
    const employee = result.rows[0] ?? null;

    if (employee) {
      // Invalidate cache on soft-delete (#1037).
      await employeeCache.delete(employeeCacheKey(organization_id, id));

      EmployeeService.dispatchWebhook(
        organization_id,
        WEBHOOK_EVENTS.EMPLOYEE_DELETED,
        employee
      ).catch((err: unknown) => logger.error('Failed to dispatch employee.deleted webhook', err));
    }

    return employee;
  }
}

export const employeeService = new EmployeeService();
