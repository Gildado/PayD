import { pool } from '../config/database.js';
import {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  EmployeeQueryInput,
} from '../schemas/employeeSchema.js';
import { webhookNotificationService, WEBHOOK_EVENTS } from './webhookNotificationService.js';
import { StrKey } from '@stellar/stellar-sdk';
import { withRetry } from '../utils/retry.js';

export class EmployeeService {
  private validateStellarAddress(address?: string) {
    if (address && !StrKey.isValidEd25519PublicKey(address)) {
      throw new Error(`Invalid Stellar wallet address: ${address}`);
    }
  }

  async create(data: CreateEmployeeInput, dbClient?: any) {
    this.validateStellarAddress(data.wallet_address);
    const executor = dbClient || pool;
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

    const result = await withRetry(() => executor.query(query, values)) as any;
    const employee = result.rows[0];

    EmployeeService.dispatchWebhook(organization_id, WEBHOOK_EVENTS.EMPLOYEE_ADDED, employee).catch(
      (err: any) => console.error('Failed to dispatch employee.added webhook:', err)
    );

    return employee;
  }

  private static async dispatchWebhook(
    organization_id: number,
    eventType: string,
    payload: any
  ): Promise<void> {
    try {
      await webhookNotificationService.dispatch(eventType, payload, organization_id);
    } catch (error) {
      console.error(`Webhook dispatch failed for ${eventType}:`, error);
    }
  }

  async findAll(organization_id: number, params: EmployeeQueryInput) {
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

    const result = await withRetry(() => pool.query(query, values)) as any;

    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
    const employees = result.rows.map((row: any) => {
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

  async findById(id: number, organization_id: number) {
    const query = `
      SELECT * FROM employees
      WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
    `;
    const result = await withRetry(() => pool.query(query, [id, organization_id])) as any;
    return result.rows[0] || null;
  }

  async update(id: number, organization_id: number, data: UpdateEmployeeInput) {
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

    const result = await withRetry(() => pool.query(query, values)) as any;
    const employee = result.rows[0] || null;

    if (employee) {
      EmployeeService.dispatchWebhook(
        organization_id,
        WEBHOOK_EVENTS.EMPLOYEE_UPDATED,
        employee
      ).catch((err: any) => console.error('Failed to dispatch employee.updated webhook:', err));
    }

    return employee;
  }

  async delete(id: number, organization_id: number) {
    const query = `
      UPDATE employees
      SET deleted_at = NOW(), status = 'inactive'
      WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
      RETURNING *;
    `;
    const result = await withRetry(() => pool.query(query, [id, organization_id])) as any;
    const employee = result.rows[0] || null;

    if (employee) {
      EmployeeService.dispatchWebhook(
        organization_id,
        WEBHOOK_EVENTS.EMPLOYEE_DELETED,
        employee
      ).catch((err: any) => console.error('Failed to dispatch employee.deleted webhook:', err));
    }

    return employee;
  }
}

export const employeeService = new EmployeeService();
