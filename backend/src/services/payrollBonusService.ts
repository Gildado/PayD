import { pool } from '../config/database.js';
import logger from '../utils/logger.js';

export interface PayrollRun {
  id: number;
  organization_id: number;
  batch_id: string;
  status: 'draft' | 'pending' | 'processing' | 'completed' | 'failed';
  period_start: Date;
  period_end: Date;
  total_base_amount: string;
  total_bonus_amount: string;
  total_amount: string;
  asset_code: string;
  created_at: Date;
  updated_at: Date;
  processed_at?: Date;
}

export type BonusType = 'performance' | 'referral' | 'project' | 'retention' | 'spot' | 'other';

export interface PayrollItem {
  id: number;
  payroll_run_id: number;
  employee_id: number;
  item_type: 'base' | 'bonus';
  bonus_type?: BonusType | null;
  performance_score?: number | null;
  amount: string;
  description?: string;
  metadata?: string;
  tx_hash?: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: Date;
  updated_at: Date;
}

export interface PayrollItemWithEmployee extends PayrollItem {
  employee_first_name?: string;
  employee_last_name?: string;
  employee_email?: string;
  employee_wallet_address?: string;
}

export interface CreateBonusItemInput {
  payroll_run_id: number;
  employee_id: number;
  amount: string;
  description?: string;
  metadata?: string;
  bonus_type?: BonusType;
  performance_score?: number;
}

export interface PayrollRunSummary {
  payroll_run: PayrollRun;
  items: PayrollItemWithEmployee[];
  summary: {
    total_employees: number;
    total_base_items: number;
    total_bonus_items: number;
    total_base_amount: string;
    total_bonus_amount: string;
    total_amount: string;
    by_status: {
      pending: number;
      completed: number;
      failed: number;
    };
  };
}

function generateBatchId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `PAYROLL-${timestamp}-${random}`.toUpperCase();
}

export class PayrollBonusService {
  static async createPayrollRun(
    organizationId: number,
    periodStart: Date,
    periodEnd: Date,
    assetCode: string = 'XLM'
  ): Promise<PayrollRun> {
    const batchId = generateBatchId();
    const result = await pool.query(
      `INSERT INTO payroll_runs (organization_id, batch_id, period_start, period_end, asset_code)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [organizationId, batchId, periodStart, periodEnd, assetCode]
    );
    return result.rows[0];
  }

  static async getPayrollRunById(id: number): Promise<PayrollRun | null> {
    const result = await pool.query('SELECT * FROM payroll_runs WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async getPayrollRunByBatchId(batchId: string): Promise<PayrollRun | null> {
    const result = await pool.query('SELECT * FROM payroll_runs WHERE batch_id = $1', [batchId]);
    return result.rows[0] || null;
  }

  static async listPayrollRuns(
    organizationId: number,
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: PayrollRun[]; total: number }> {
    const offset = (page - 1) * limit;
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM payroll_runs WHERE organization_id = $1',
      [organizationId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await pool.query(
      `SELECT * FROM payroll_runs 
       WHERE organization_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    );

    return { data: dataResult.rows, total };
  }

  static async addBaseSalaryItem(
    payrollRunId: number,
    employeeId: number,
    amount: string,
    metadata?: string
  ): Promise<PayrollItem> {
    const result = await pool.query(
      `INSERT INTO payroll_items (payroll_run_id, employee_id, item_type, amount, metadata)
       VALUES ($1, $2, 'base', $3, $4)
       RETURNING *`,
      [payrollRunId, employeeId, amount, metadata || null]
    );

    await this.updatePayrollRunTotals(payrollRunId);

    return result.rows[0];
  }

  static async addBonusItem(input: CreateBonusItemInput): Promise<PayrollItem> {
    const result = await pool.query(
      `INSERT INTO payroll_items
         (payroll_run_id, employee_id, item_type, amount, description, metadata, bonus_type, performance_score)
       VALUES ($1, $2, 'bonus', $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.payroll_run_id,
        input.employee_id,
        input.amount,
        input.description || null,
        input.metadata || null,
        input.bonus_type || null,
        input.performance_score ?? null,
      ]
    );

    await this.updatePayrollRunTotals(input.payroll_run_id);

    return result.rows[0];
  }

  static async addBatchBonusItems(
    payrollRunId: number,
    items: Array<{
      employee_id: number;
      amount: string;
      description?: string;
      metadata?: string;
      bonus_type?: BonusType;
      performance_score?: number;
    }>
  ): Promise<PayrollItem[]> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertedItems: PayrollItem[] = [];

      for (const item of items) {
        const result = await client.query(
          `INSERT INTO payroll_items
             (payroll_run_id, employee_id, item_type, amount, description, metadata, bonus_type, performance_score)
           VALUES ($1, $2, 'bonus', $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            payrollRunId,
            item.employee_id,
            item.amount,
            item.description || null,
            item.metadata || null,
            item.bonus_type || null,
            item.performance_score ?? null,
          ]
        );
        insertedItems.push(result.rows[0]);
      }

      await client.query('COMMIT');
      await this.updatePayrollRunTotals(payrollRunId);

      return insertedItems;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getPayrollItems(
    payrollRunId: number,
    itemType?: 'base' | 'bonus'
  ): Promise<PayrollItemWithEmployee[]> {
    let query = `
      SELECT pi.*, e.first_name as employee_first_name, e.last_name as employee_last_name,
             e.email as employee_email, e.wallet_address as employee_wallet_address
      FROM payroll_items pi
      JOIN employees e ON pi.employee_id = e.id
      WHERE pi.payroll_run_id = $1
    `;
    const params: (number | string)[] = [payrollRunId];

    if (itemType) {
      query += ' AND pi.item_type = $2';
      params.push(itemType);
    }

    query += ' ORDER BY pi.created_at ASC';

    const result = await pool.query(query, params);
    return result.rows;
  }

  static async getPayrollRunSummary(payrollRunId: number): Promise<PayrollRunSummary | null> {
    const payrollRun = await this.getPayrollRunById(payrollRunId);
    if (!payrollRun) return null;

    const items = await this.getPayrollItems(payrollRunId);

    const uniqueEmployees = new Set(items.map((item) => item.employee_id));
    const baseItems = items.filter((item) => item.item_type === 'base');
    const bonusItems = items.filter((item) => item.item_type === 'bonus');

    const summary = {
      total_employees: uniqueEmployees.size,
      total_base_items: baseItems.length,
      total_bonus_items: bonusItems.length,
      total_base_amount: baseItems
        .reduce((sum, item) => sum + parseFloat(item.amount), 0)
        .toFixed(7),
      total_bonus_amount: bonusItems
        .reduce((sum, item) => sum + parseFloat(item.amount), 0)
        .toFixed(7),
      total_amount: items.reduce((sum, item) => sum + parseFloat(item.amount), 0).toFixed(7),
      by_status: {
        pending: items.filter((item) => item.status === 'pending').length,
        completed: items.filter((item) => item.status === 'completed').length,
        failed: items.filter((item) => item.status === 'failed').length,
      },
    };

    return {
      payroll_run: payrollRun,
      items,
      summary,
    };
  }

  /**
   * Get payroll item by transaction hash (for receipt generation)
   */
  static async getPayrollItemByTxHash(txHash: string): Promise<PayrollItemWithEmployee | null> {
    const result = await pool.query(
      `SELECT pi.*, e.first_name as employee_first_name, e.last_name as employee_last_name,
              e.email as employee_email, e.wallet_address as employee_wallet_address
       FROM payroll_items pi
       JOIN employees e ON pi.employee_id = e.id
       WHERE pi.tx_hash = $1
       LIMIT 1`,
      [txHash]
    );
    return result.rows[0] || null;
  }

  static async updatePayrollRunTotals(payrollRunId: number): Promise<void> {
    const result = await pool.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN item_type = 'base' THEN amount ELSE 0 END), 0) as total_base,
        COALESCE(SUM(CASE WHEN item_type = 'bonus' THEN amount ELSE 0 END), 0) as total_bonus,
        COALESCE(SUM(amount), 0) as total
       FROM payroll_items 
       WHERE payroll_run_id = $1`,
      [payrollRunId]
    );

    const { total_base, total_bonus, total } = result.rows[0];

    await pool.query(
      `UPDATE payroll_runs 
       SET total_base_amount = $1, total_bonus_amount = $2, total_amount = $3 
       WHERE id = $4`,
      [total_base, total_bonus, total, payrollRunId]
    );
  }

  static async updatePayrollRunStatus(
    payrollRunId: number,
    status: PayrollRun['status']
  ): Promise<PayrollRun | null> {
    const processedAt = status === 'completed' ? new Date() : null;
    const result = await pool.query(
      `UPDATE payroll_runs 
       SET status = $1, processed_at = $2 
       WHERE id = $3 
       RETURNING *`,
      [status, processedAt, payrollRunId]
    );
    return result.rows[0] || null;
  }

  static async updateItemStatus(
    itemId: number,
    status: PayrollItem['status'],
    txHash?: string
  ): Promise<PayrollItem | null> {
    const result = await pool.query(
      `UPDATE payroll_items 
       SET status = $1, tx_hash = COALESCE($2, tx_hash) 
       WHERE id = $3 
       RETURNING *`,
      [status, txHash || null, itemId]
    );
    return result.rows[0] || null;
  }

  static async getPayrollItemById(itemId: number): Promise<PayrollItem | null> {
    const result = await pool.query('SELECT * FROM payroll_items WHERE id = $1', [itemId]);
    return result.rows[0] || null;
  }

  static async deletePayrollItem(itemId: number): Promise<boolean> {
    const item = await pool.query('SELECT payroll_run_id FROM payroll_items WHERE id = $1', [
      itemId,
    ]);
    if (item.rows.length === 0) return false;

    const payrollRunId = item.rows[0].payroll_run_id;

    await pool.query('DELETE FROM payroll_items WHERE id = $1', [itemId]);
    await this.updatePayrollRunTotals(payrollRunId);

    return true;
  }

  /**
   * Fetch bonus items filtered by bonus_type for an organisation.
   * Enables reporting like "show all referral bonuses this quarter".
   */
  static async listBonusesByType(
    organizationId: number,
    bonusType: BonusType,
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: PayrollItemWithEmployee[]; total: number }> {
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM payroll_items pi
       JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
       WHERE pr.organization_id = $1 AND pi.bonus_type = $2`,
      [organizationId, bonusType]
    );
    const total = Number.parseInt(countResult.rows[0].count, 10);

    const dataResult = await pool.query(
      `SELECT pi.*, e.first_name as employee_first_name, e.last_name as employee_last_name,
              e.email as employee_email, e.wallet_address as employee_wallet_address
       FROM payroll_items pi
       JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
       JOIN employees e ON pi.employee_id = e.id
       WHERE pr.organization_id = $1 AND pi.bonus_type = $2
       ORDER BY pi.created_at DESC
       LIMIT $3 OFFSET $4`,
      [organizationId, bonusType, limit, offset]
    );

    return { data: dataResult.rows, total };
  }

  /**
   * Fetch performance-based bonuses, optionally filtered by minimum score.
   * Useful for "show all employees who scored above 85" reports.
   */
  static async getPerformanceBonusesByScore(
    organizationId: number,
    minScore: number = 0,
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: PayrollItemWithEmployee[]; total: number }> {
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM payroll_items pi
       JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
       WHERE pr.organization_id = $1
         AND pi.bonus_type = 'performance'
         AND pi.performance_score >= $2`,
      [organizationId, minScore]
    );
    const total = Number.parseInt(countResult.rows[0].count, 10);

    const dataResult = await pool.query(
      `SELECT pi.*, e.first_name as employee_first_name, e.last_name as employee_last_name,
              e.email as employee_email, e.wallet_address as employee_wallet_address
       FROM payroll_items pi
       JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
       JOIN employees e ON pi.employee_id = e.id
       WHERE pr.organization_id = $1
         AND pi.bonus_type = 'performance'
         AND pi.performance_score >= $2
       ORDER BY pi.performance_score DESC, pi.created_at DESC
       LIMIT $3 OFFSET $4`,
      [organizationId, minScore, limit, offset]
    );

    return { data: dataResult.rows, total };
  }

  static async getOrganizationBonusHistory(
    organizationId: number,
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: PayrollItemWithEmployee[]; total: number }> {
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM payroll_items pi
       JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
       WHERE pr.organization_id = $1 AND pi.item_type = 'bonus'`,
      [organizationId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await pool.query(
      `SELECT pi.*, e.first_name as employee_first_name, e.last_name as employee_last_name,
              e.email as employee_email, e.wallet_address as employee_wallet_address,
              pr.batch_id, pr.period_start, pr.period_end
       FROM payroll_items pi
       JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
       JOIN employees e ON pi.employee_id = e.id
       WHERE pr.organization_id = $1 AND pi.item_type = 'bonus'
       ORDER BY pi.created_at DESC
       LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    );

    return { data: dataResult.rows, total };
  }
}
