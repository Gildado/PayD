import { pool } from '../config/database';
import {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  EmployeeQueryInput,
} from '../schemas/employeeSchema';

export class EmployeeService {
  async create(data: CreateEmployeeInput, dbClient?: any) {
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
    } = data;

    const query = `
      INSERT INTO employees (
        organization_id, first_name, last_name, email, wallet_address, position, department, status, base_salary, base_currency
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
    ];

    const result = await executor.query(query, values);
    return result.rows[0];
  }

  async findAll(organization_id: number, params: EmployeeQueryInput) {
    const { page = 1, limit = 10, search, status, department } = params;
    const offset = (page - 1) * limit;

    let query = `
      SELECT *, count(*) OVER() as total_count
      FROM employees
      WHERE deleted_at IS NULL
    `;
    const values: (string | number)[] = [];
    let paramIndex = 1;

    if (organization_id) {
      query += ` AND organization_id = $${paramIndex++}`;
      values.push(organization_id);
    }

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      values.push(status);
    }

    if (department) {
      query += ` AND department = $${paramIndex++}`;
      values.push(department);
    }

    if (search) {
      // Use full-text search vector if possible, or ILIKE for simplicity
      query += ` AND (
        first_name ILIKE $${paramIndex} OR
        last_name ILIKE $${paramIndex} OR
        email ILIKE $${paramIndex} OR
        position ILIKE $${paramIndex}
      )`;
      values.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
    const employees = result.rows.map((row) => {
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
    const result = await pool.query(query, [id, organization_id]);
    return result.rows[0] || null;
  }

  async update(id: number, organization_id: number, data: UpdateEmployeeInput) {
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

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  async delete(id: number, organization_id: number) {
    const query = `
      UPDATE employees
      SET deleted_at = NOW(), status = 'inactive'
      WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
      RETURNING *;
    `;
    const result = await pool.query(query, [id, organization_id]);
    return result.rows[0] || null;
  }
}

export const employeeService = new EmployeeService();
