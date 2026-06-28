import { pool } from '../config/database.js';
import logger from '../utils/logger.js';

export type PayrollAuditAction =
  | 'run_created'
  | 'run_status_changed'
  | 'item_added'
  | 'item_deleted'
  | 'item_status_changed'
  | 'transaction_submitted'
  | 'transaction_succeeded'
  | 'transaction_failed';

export type ActorType = 'system' | 'user' | 'api';

export interface PayrollAuditLog {
  id: number;
  organization_id: number;
  payroll_run_id: number | null;
  payroll_item_id: number | null;
  action: PayrollAuditAction;
  actor_type: ActorType;
  actor_id: string | null;
  actor_email: string | null;
  employee_id: number | null;
  tx_hash: string | null;
  stellar_ledger: number | null;
  amount: string | null;
  asset_code: string | null;
  old_status: string | null;
  new_status: string | null;
  metadata: Record<string, any>;
  error_message: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

export interface CreateAuditLogInput {
  organizationId: number;
  payrollRunId?: number;
  payrollItemId?: number;
  action: PayrollAuditAction;
  actorType: ActorType;
  actorId?: string;
  actorEmail?: string;
  employeeId?: number;
  txHash?: string;
  stellarLedger?: number;
  amount?: string;
  assetCode?: string;
  oldStatus?: string;
  newStatus?: string;
  metadata?: Record<string, any>;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogFilter {
  organizationId?: number;
  payrollRunId?: number;
  action?: PayrollAuditAction;
  actorType?: ActorType;
  employeeId?: number;
  txHash?: string;
  startDate?: Date;
  endDate?: Date;
  status?: 'success' | 'failed';
}

export interface AuditLogWithDetails extends PayrollAuditLog {
  payroll_batch_id?: string;
  employee_first_name?: string;
  employee_last_name?: string;
  employee_email?: string;
}

export class PayrollAuditService {
  static async log(input: CreateAuditLogInput): Promise<PayrollAuditLog> {
    const result = await pool.query(
      `INSERT INTO payroll_audit_logs (
        organization_id, payroll_run_id, payroll_item_id, action,
        actor_type, actor_id, actor_email, employee_id,
        tx_hash, stellar_ledger, amount, asset_code,
        old_status, new_status, metadata, error_message,
        ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        input.organizationId,
        input.payrollRunId || null,
        input.payrollItemId || null,
        input.action,
        input.actorType,
        input.actorId || null,
        input.actorEmail || null,
        input.employeeId || null,
        input.txHash || null,
        input.stellarLedger || null,
        input.amount || null,
        input.assetCode || null,
        input.oldStatus || null,
        input.newStatus || null,
        JSON.stringify(input.metadata || {}),
        input.errorMessage || null,
        input.ipAddress || null,
        input.userAgent || null,
      ]
    );

    const log = result.rows[0];
    logger.info('Payroll audit log created', {
      action: input.action,
      organizationId: input.organizationId,
      payrollRunId: input.payrollRunId,
      txHash: input.txHash,
    });

    return log;
  }

  static async logRunCreated(
    organizationId: number,
    payrollRunId: number,
    actor: { type: ActorType; id?: string; email?: string },
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<PayrollAuditLog> {
    return this.log({
      organizationId,
      payrollRunId,
      action: 'run_created',
      actorType: actor.type,
      actorId: actor.id,
      actorEmail: actor.email,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });
  }

  static async logRunStatusChanged(
    organizationId: number,
    payrollRunId: number,
    oldStatus: string,
    newStatus: string,
    actor: { type: ActorType; id?: string; email?: string },
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<PayrollAuditLog> {
    return this.log({
      organizationId,
      payrollRunId,
      action: 'run_status_changed',
      actorType: actor.type,
      actorId: actor.id,
      actorEmail: actor.email,
      oldStatus,
      newStatus,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });
  }

  static async logItemAdded(
    organizationId: number,
    payrollRunId: number,
    payrollItemId: number,
    employeeId: number,
    amount: string,
    assetCode: string,
    actor: { type: ActorType; id?: string; email?: string },
    context?: {
      ipAddress?: string;
      userAgent?: string;
      itemType?: 'base' | 'bonus';
      description?: string;
      payoutMetadata?: string;
    }
  ): Promise<PayrollAuditLog> {
    return this.log({
      organizationId,
      payrollRunId,
      payrollItemId,
      employeeId,
      action: 'item_added',
      actorType: actor.type,
      actorId: actor.id,
      actorEmail: actor.email,
      amount,
      assetCode,
      metadata: {
        item_type: context?.itemType || 'base',
        description: context?.description,
        payout_metadata: context?.payoutMetadata,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });
  }

  static async logTransactionSubmitted(
    organizationId: number,
    payrollRunId: number,
    payrollItemId: number,
    employeeId: number,
    txHash: string,
    amount: string,
    assetCode: string,
    actor: { type: ActorType; id?: string; email?: string },
    itemType?: 'base' | 'bonus'
  ): Promise<PayrollAuditLog> {
    return this.log({
      organizationId,
      payrollRunId,
      payrollItemId,
      employeeId,
      action: 'transaction_submitted',
      actorType: actor.type,
      actorId: actor.id,
      actorEmail: actor.email,
      txHash,
      amount,
      assetCode,
      oldStatus: 'pending',
      newStatus: 'processing',
      metadata: {
        item_type: itemType || 'base',
      },
    });
  }

  static async logTransactionSucceeded(
    organizationId: number,
    payrollRunId: number,
    payrollItemId: number,
    employeeId: number,
    txHash: string,
    stellarLedger: number,
    amount: string,
    assetCode: string,
    itemType?: 'base' | 'bonus'
  ): Promise<PayrollAuditLog> {
    return this.log({
      organizationId,
      payrollRunId,
      payrollItemId,
      employeeId,
      action: 'transaction_succeeded',
      actorType: 'system',
      txHash,
      stellarLedger,
      amount,
      assetCode,
      oldStatus: 'processing',
      newStatus: 'completed',
      metadata: {
        item_type: itemType || 'base',
      },
    });
  }

  static async logTransactionFailed(
    organizationId: number,
    payrollRunId: number,
    payrollItemId: number,
    employeeId: number,
    txHash: string,
    errorMessage: string,
    amount: string,
    assetCode: string,
    itemType?: 'base' | 'bonus'
  ): Promise<PayrollAuditLog> {
    return this.log({
      organizationId,
      payrollRunId,
      payrollItemId,
      employeeId,
      action: 'transaction_failed',
      actorType: 'system',
      txHash,
      errorMessage,
      amount,
      assetCode,
      oldStatus: 'processing',
      newStatus: 'failed',
      metadata: {
        item_type: itemType || 'base',
      },
    });
  }

  static async getAuditLogs(
    filter: AuditLogFilter,
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: AuditLogWithDetails[]; total: number }> {
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const values: (string | number | Date)[] = [];
    let paramIdx = 1;

    if (filter.organizationId) {
      conditions.push(`pal.organization_id = $${paramIdx++}`);
      values.push(filter.organizationId);
    }

    if (filter.payrollRunId) {
      conditions.push(`pal.payroll_run_id = $${paramIdx++}`);
      values.push(filter.payrollRunId);
    }

    if (filter.action) {
      conditions.push(`pal.action = $${paramIdx++}`);
      values.push(filter.action);
    }

    if (filter.actorType) {
      conditions.push(`pal.actor_type = $${paramIdx++}`);
      values.push(filter.actorType);
    }

    if (filter.employeeId) {
      conditions.push(`pal.employee_id = $${paramIdx++}`);
      values.push(filter.employeeId);
    }

    if (filter.txHash) {
      conditions.push(`pal.tx_hash = $${paramIdx++}`);
      values.push(filter.txHash);
    }

    if (filter.startDate) {
      conditions.push(`pal.created_at >= $${paramIdx++}`);
      values.push(filter.startDate);
    }

    if (filter.endDate) {
      conditions.push(`pal.created_at <= $${paramIdx++}`);
      values.push(filter.endDate);
    }

    if (filter.status === 'success') {
      conditions.push(`pal.action IN ('transaction_succeeded', 'item_added', 'run_created')`);
    } else if (filter.status === 'failed') {
      conditions.push(`pal.action = 'transaction_failed'`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM payroll_audit_logs pal ${whereClause}`,
      values.slice()
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await pool.query(
      `SELECT 
        pal.*,
        pr.batch_id as payroll_batch_id,
        e.first_name as employee_first_name,
        e.last_name as employee_last_name,
        e.email as employee_email
       FROM payroll_audit_logs pal
       LEFT JOIN payroll_runs pr ON pal.payroll_run_id = pr.id
       LEFT JOIN employees e ON pal.employee_id = e.id
       ${whereClause}
       ORDER BY pal.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...values, limit, offset]
    );

    return { data: dataResult.rows, total };
  }

  static async getAuditLogById(id: number): Promise<AuditLogWithDetails | null> {
    const result = await pool.query(
      `SELECT 
        pal.*,
        pr.batch_id as payroll_batch_id,
        e.first_name as employee_first_name,
        e.last_name as employee_last_name,
        e.email as employee_email
       FROM payroll_audit_logs pal
       LEFT JOIN payroll_runs pr ON pal.payroll_run_id = pr.id
       LEFT JOIN employees e ON pal.employee_id = e.id
       WHERE pal.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  static async getAuditSummary(
    organizationId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalActions: number;
    byAction: Record<string, number>;
    byActorType: Record<string, number>;
    successfulTransactions: number;
    failedTransactions: number;
    totalAmountTransacted: string;
  }> {
    const conditions = ['organization_id = $1'];
    const values: (number | Date)[] = [organizationId];
    let paramIdx = 2;

    if (startDate) {
      conditions.push(`created_at >= $${paramIdx++}`);
      values.push(startDate);
    }

    if (endDate) {
      conditions.push(`created_at <= $${paramIdx++}`);
      values.push(endDate);
    }

    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_actions,
        COUNT(*) FILTER (WHERE action = 'transaction_succeeded') as successful_transactions,
        COUNT(*) FILTER (WHERE action = 'transaction_failed') as failed_transactions,
        COALESCE(SUM(amount)::text, '0') as total_amount
       FROM payroll_audit_logs 
       WHERE ${conditions.join(' AND ')}`,
      values
    );

    const actionResult = await pool.query(
      `SELECT action, COUNT(*) as count 
       FROM payroll_audit_logs 
       WHERE ${conditions.join(' AND ')}
       GROUP BY action`,
      values.slice()
    );

    const actorResult = await pool.query(
      `SELECT actor_type, COUNT(*) as count 
       FROM payroll_audit_logs 
       WHERE ${conditions.join(' AND ')}
       GROUP BY actor_type`,
      values.slice()
    );

    const byAction: Record<string, number> = {};
    actionResult.rows.forEach((row) => {
      byAction[row.action] = parseInt(row.count, 10);
    });

    const byActorType: Record<string, number> = {};
    actorResult.rows.forEach((row) => {
      byActorType[row.actor_type] = parseInt(row.count, 10);
    });

    const row = result.rows[0];

    return {
      totalActions: parseInt(row.total_actions, 10),
      byAction,
      byActorType,
      successfulTransactions: parseInt(row.successful_transactions, 10) || 0,
      failedTransactions: parseInt(row.failed_transactions, 10) || 0,
      totalAmountTransacted: row.total_amount || '0',
    };
  }

  static async exportToCsv(filter: AuditLogFilter): Promise<string> {
    const { data } = await this.getAuditLogs(filter, 1, 10000);

    const headers = [
      'id',
      'created_at',
      'organization_id',
      'batch_id',
      'action',
      'actor_type',
      'actor_email',
      'employee_name',
      'employee_email',
      'tx_hash',
      'stellar_ledger',
      'amount',
      'asset_code',
      'old_status',
      'new_status',
      'error_message',
      'ip_address',
    ];

    const csvRows = [headers.join(',')];

    for (const log of data) {
      const employeeName =
        log.employee_first_name && log.employee_last_name
          ? `${log.employee_first_name} ${log.employee_last_name}`
          : '';

      const row = [
        log.id,
        log.created_at instanceof Date ? log.created_at.toISOString() : log.created_at,
        log.organization_id,
        log.payroll_batch_id || '',
        log.action,
        log.actor_type,
        log.actor_email || '',
        `"${employeeName}"`,
        log.employee_email || '',
        log.tx_hash || '',
        log.stellar_ledger || '',
        log.amount || '',
        log.asset_code || '',
        log.old_status || '',
        log.new_status || '',
        log.error_message ? `"${log.error_message.replace(/"/g, '""')}"` : '',
        log.ip_address || '',
      ];

      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }
}
