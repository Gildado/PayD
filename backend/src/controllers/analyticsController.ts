import { Request, Response } from 'express';
import { pool } from '../config/database.js';
import logger from '../utils/logger.js';

interface MonthlyTrend {
  month: string;
  total: number;
  count: number;
}

interface CurrencyShare {
  currency: string;
  value: number;
}

interface PaymentMetric {
  month: string;
  success: number;
  failure: number;
  pending: number;
}

interface DepartmentStat {
  department: string;
  total: number;
  headcount: number;
}

interface AnalyticsSummary {
  totalPayroll: number;
  totalTransactions: number;
  successRate: number;
  activeEmployees: number;
}

export class AnalyticsController {
  static async getPayrollAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId, startDate, endDate } = req.query as Record<string, string>;

      if (!organizationId) {
        res.status(400).json({ success: false, error: 'Missing required parameter: organizationId' });
        return;
      }

      const orgId = parseInt(organizationId, 10);
      if (isNaN(orgId)) {
        res.status(400).json({ success: false, error: 'organizationId must be a valid integer' });
        return;
      }

      const start = startDate ? new Date(startDate) : new Date(new Date().setFullYear(new Date().getFullYear() - 1));
      const end = endDate ? new Date(endDate) : new Date();

      const [trends, currencyBreakdown, paymentMetrics, departmentBreakdown, summary] =
        await Promise.all([
          AnalyticsController.fetchMonthlyTrends(orgId, start, end),
          AnalyticsController.fetchCurrencyBreakdown(orgId, start, end),
          AnalyticsController.fetchPaymentMetrics(orgId, start, end),
          AnalyticsController.fetchDepartmentBreakdown(orgId, start, end),
          AnalyticsController.fetchSummary(orgId, start, end),
        ]);

      res.json({
        success: true,
        data: {
          trends,
          currencyBreakdown,
          paymentMetrics,
          departmentBreakdown,
          summary,
          meta: { startDate: start.toISOString(), endDate: end.toISOString() },
        },
      });
    } catch (error) {
      logger.error('GET /api/v1/analytics/payroll failed', { error });
      res.status(500).json({ success: false, error: 'Failed to retrieve payroll analytics' });
    }
  }

  private static async fetchMonthlyTrends(
    orgId: number,
    start: Date,
    end: Date,
  ): Promise<MonthlyTrend[]> {
    const result = await pool.query<{ month: string; total: string; count: string }>(
      `SELECT
         TO_CHAR(DATE_TRUNC('month', created_at), 'Mon ''YY') AS month,
         COALESCE(SUM(amount), 0)::text                       AS total,
         COUNT(*)::text                                        AS count
       FROM transactions
       WHERE organization_id = $1
         AND created_at >= $2
         AND created_at <= $3
         AND status = 'completed'
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY DATE_TRUNC('month', created_at)`,
      [orgId, start, end],
    );

    return result.rows.map((r) => ({
      month: r.month,
      total: parseFloat(r.total),
      count: parseInt(r.count, 10),
    }));
  }

  private static async fetchCurrencyBreakdown(
    orgId: number,
    start: Date,
    end: Date,
  ): Promise<CurrencyShare[]> {
    const result = await pool.query<{ currency: string; total: string }>(
      `SELECT
         asset_code                AS currency,
         COALESCE(SUM(amount), 0)::text AS total
       FROM transactions
       WHERE organization_id = $1
         AND created_at >= $2
         AND created_at <= $3
         AND status = 'completed'
       GROUP BY asset_code
       ORDER BY SUM(amount) DESC`,
      [orgId, start, end],
    );

    const grandTotal = result.rows.reduce((acc, r) => acc + parseFloat(r.total), 0);
    if (grandTotal === 0) return [];

    return result.rows.map((r) => ({
      currency: r.currency,
      value: Math.round((parseFloat(r.total) / grandTotal) * 100),
    }));
  }

  private static async fetchPaymentMetrics(
    orgId: number,
    start: Date,
    end: Date,
  ): Promise<PaymentMetric[]> {
    const result = await pool.query<{
      month: string;
      status: string;
      count: string;
    }>(
      `SELECT
         TO_CHAR(DATE_TRUNC('month', created_at), 'Mon ''YY') AS month,
         status,
         COUNT(*)::text AS count
       FROM transactions
       WHERE organization_id = $1
         AND created_at >= $2
         AND created_at <= $3
       GROUP BY DATE_TRUNC('month', created_at), status
       ORDER BY DATE_TRUNC('month', created_at)`,
      [orgId, start, end],
    );

    const byMonth: Record<string, PaymentMetric> = {};
    for (const r of result.rows) {
      if (!byMonth[r.month]) {
        byMonth[r.month] = { month: r.month, success: 0, failure: 0, pending: 0 };
      }
      const count = parseInt(r.count, 10);
      if (r.status === 'completed') byMonth[r.month].success += count;
      else if (r.status === 'failed') byMonth[r.month].failure += count;
      else byMonth[r.month].pending += count;
    }

    return Object.values(byMonth);
  }

  private static async fetchDepartmentBreakdown(
    orgId: number,
    start: Date,
    end: Date,
  ): Promise<DepartmentStat[]> {
    const result = await pool.query<{ department: string; total: string; headcount: string }>(
      `SELECT
         COALESCE(e.department, 'Unassigned')            AS department,
         COALESCE(SUM(t.amount), 0)::text                AS total,
         COUNT(DISTINCT t.employee_id)::text             AS headcount
       FROM transactions t
       JOIN employees e ON e.id = t.employee_id
       WHERE t.organization_id = $1
         AND t.created_at >= $2
         AND t.created_at <= $3
         AND t.status = 'completed'
       GROUP BY e.department
       ORDER BY SUM(t.amount) DESC
       LIMIT 10`,
      [orgId, start, end],
    );

    return result.rows.map((r) => ({
      department: r.department,
      total: parseFloat(r.total),
      headcount: parseInt(r.headcount, 10),
    }));
  }

  private static async fetchSummary(
    orgId: number,
    start: Date,
    end: Date,
  ): Promise<AnalyticsSummary> {
    const result = await pool.query<{
      total_payroll: string;
      total_transactions: string;
      success_count: string;
    }>(
      `SELECT
         COALESCE(SUM(amount), 0)::text         AS total_payroll,
         COUNT(*)::text                          AS total_transactions,
         COUNT(*) FILTER (WHERE status = 'completed')::text AS success_count
       FROM transactions
       WHERE organization_id = $1
         AND created_at >= $2
         AND created_at <= $3`,
      [orgId, start, end],
    );

    const empResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM employees
       WHERE organization_id = $1
         AND status = 'active'
         AND deleted_at IS NULL`,
      [orgId],
    );

    const row = result.rows[0];
    const totalTx = parseInt(row.total_transactions, 10);
    const successCount = parseInt(row.success_count, 10);

    return {
      totalPayroll: parseFloat(row.total_payroll),
      totalTransactions: totalTx,
      successRate: totalTx > 0 ? Math.round((successCount / totalTx) * 1000) / 10 : 0,
      activeEmployees: parseInt(empResult.rows[0].count, 10),
    };
  }
}
