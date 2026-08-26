/**
 * Trustline Adoption Report Agent (#1318)
 *
 * Reports on trustline setup adoption across assets and organizations.
 * Sources data from trustlineService.ts and employee wallet records.
 *
 * Output schema:
 *   - summary: totalEmployees, totalWithTrustlines, adoptionRate, totalAssets
 *   - byAsset: per-asset trustline adoption stats
 *   - byDepartment: per-department adoption breakdown
 *   - recentSetups: recently established trustlines
 *   - recommendations: adoption improvement suggestions
 */

import type { Pool } from 'pg';
import {
  type IReportAgent,
  type ReportResult,
  type SafetyValidation,
  ReportFormat,
} from './reportSchema.js';

export interface TrustlineAdoptionFilters {
  organizationId: number;
  assetCode?: string;
  department?: string;
  startDate?: string;
  endDate?: string;
}

export interface AssetTrustline {
  assetCode: string;
  assetIssuer: string;
  totalEmployees: number;
  trustlinesEstablished: number;
  adoptionRate: number;
  avgBalance: string;
}

export interface DepartmentAdoption {
  department: string | null;
  totalEmployees: number;
  trustlinesEstablished: number;
  adoptionRate: number;
  assetsUsed: number;
}

export interface RecentSetup {
  employeeId: number;
  employeeName: string;
  walletAddress: string;
  assetCode: string;
  assetIssuer: string;
  lastCheckedAt: Date;
  balance: string;
}

export interface AdoptionRecommendation {
  type: 'action' | 'insight' | 'success';
  message: string;
  affectedCount?: number;
  assetCode?: string;
  department?: string;
}

export interface TrustlineAdoptionReport {
  schemaVersion: string;
  summary: {
    totalEmployees: number;
    totalWithTrustlines: number;
    adoptionRate: number;
    totalAssets: number;
    totalTrustlines: number;
    avgTrustlinesPerEmployee: number;
  };
  byAsset: AssetTrustline[];
  byDepartment: DepartmentAdoption[];
  recentSetups: RecentSetup[];
  recommendations: AdoptionRecommendation[];
}

export class TrustlineAdoptionReportAgent implements IReportAgent {
  id = 'trustline-adoption';
  name = 'Trustline Adoption Report';
  description = 'Reports on trustline setup adoption across assets and organizations';

  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async execute(filters?: Record<string, any>): Promise<ReportResult> {
    const f = filters as TrustlineAdoptionFilters | undefined;
    const organizationId = f?.organizationId ?? 0;
    if (!organizationId) {
      throw new Error('organizationId is required');
    }

    const assetCode = f?.assetCode;
    const department = f?.department;
    const startDate = f?.startDate;
    const endDate = f?.endDate;

    const employeeConditions = ['e.organization_id = $1', 'e.deleted_at IS NULL'];
    const trustlineConditions = ['e.organization_id = $1', 'e.deleted_at IS NULL', 't.status = $2'];
    const params: any[] = [organizationId];
    const trustlineParams: any[] = [organizationId, 'established'];
    let paramIndex = 2;
    let trustlineParamIndex = 3;

    if (department) {
      employeeConditions.push(`e.department = $${paramIndex}`);
      params.push(department);
      paramIndex++;
      trustlineConditions.push(`e.department = $${trustlineParamIndex}`);
      trustlineParams.push(department);
      trustlineParamIndex++;
    }

    if (assetCode) {
      trustlineConditions.push(`t.asset_code = $${trustlineParamIndex}`);
      trustlineParams.push(assetCode);
      trustlineParamIndex++;
    }

    if (startDate) {
      trustlineConditions.push(`t.last_checked_at >= $${trustlineParamIndex}`);
      trustlineParams.push(startDate);
      trustlineParamIndex++;
    }

    if (endDate) {
      trustlineConditions.push(`t.last_checked_at <= $${trustlineParamIndex}`);
      trustlineParams.push(endDate);
      trustlineParamIndex++;
    }

    // Summary statistics
    const totalEmployeesResult = await this.pool.query(
      `SELECT COUNT(DISTINCT e.id)::int AS total
      FROM employees e
      WHERE ${employeeConditions.join(' AND ')}`,
      params
    );
    const totalEmployees = totalEmployeesResult.rows[0]?.total ?? 0;

    const trustlineStatsResult = await this.pool.query(
      `SELECT
        COUNT(DISTINCT e.id)::int AS employees_with_trustlines,
        COUNT(DISTINCT t.asset_code)::int AS total_assets,
        COUNT(*)::int AS total_trustlines,
        COALESCE(AVG(trustlines_per_employee), 0)::numeric(10,2) AS avg_trustlines
      FROM employees e
      JOIN trustlines t ON t.employee_id = e.id
      LEFT JOIN (
        SELECT employee_id, COUNT(*)::int AS trustlines_per_employee
        FROM trustlines
        WHERE status = 'established'
        GROUP BY employee_id
      ) tpe ON tpe.employee_id = e.id
      WHERE ${trustlineConditions.join(' AND ')}`,
      trustlineParams
    );

    const totalWithTrustlines = trustlineStatsResult.rows[0]?.employees_with_trustlines ?? 0;
    const totalAssets = trustlineStatsResult.rows[0]?.total_assets ?? 0;
    const totalTrustlines = trustlineStatsResult.rows[0]?.total_trustlines ?? 0;
    const avgTrustlinesPerEmployee = parseFloat(trustlineStatsResult.rows[0]?.avg_trustlines ?? '0');

    const adoptionRate = totalEmployees > 0
      ? Math.round((totalWithTrustlines / totalEmployees) * 10000) / 100
      : 0;

    // By asset
    const assetResult = await this.pool.query(
      `SELECT
        t.asset_code,
        t.asset_issuer,
        COUNT(DISTINCT e.id)::int AS employees_with_asset,
        COUNT(*)::int AS trustlines_established,
        COALESCE(AVG(CAST(t.balance AS numeric)), 0)::numeric(18,7) AS avg_balance
      FROM trustlines t
      JOIN employees e ON e.id = t.employee_id
      WHERE ${trustlineConditions.join(' AND ')}
      GROUP BY t.asset_code, t.asset_issuer
      ORDER BY trustlines_established DESC`,
      trustlineParams
    );

    const byAsset: AssetTrustline[] = assetResult.rows.map((row) => ({
      assetCode: row.asset_code,
      assetIssuer: row.asset_issuer,
      totalEmployees,
      trustlinesEstablished: row.trustlines_established,
      adoptionRate: totalEmployees > 0
        ? Math.round((row.employees_with_asset / totalEmployees) * 10000) / 100
        : 0,
      avgBalance: String(row.avg_balance),
    }));

    // By department
    const deptResult = await this.pool.query(
      `SELECT
        e.department,
        COUNT(DISTINCT e.id)::int AS total_employees,
        COUNT(DISTINCT CASE WHEN t.id IS NOT NULL THEN e.id END)::int AS with_trustlines,
        COUNT(DISTINCT t.asset_code)::int AS assets_used
      FROM employees e
      LEFT JOIN trustlines t ON t.employee_id = e.id AND t.status = 'established'
      WHERE ${employeeConditions.join(' AND ')}
      GROUP BY e.department
      ORDER BY with_trustlines DESC`,
      params
    );

    const byDepartment: DepartmentAdoption[] = deptResult.rows.map((row) => ({
      department: row.department,
      totalEmployees: row.total_employees,
      trustlinesEstablished: row.with_trustlines,
      adoptionRate: row.total_employees > 0
        ? Math.round((row.with_trustlines / row.total_employees) * 10000) / 100
        : 0,
      assetsUsed: row.assets_used,
    }));

    // Recent setups
    const recentResult = await this.pool.query(
      `SELECT
        e.id AS employee_id,
        CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
        t.wallet_address,
        t.asset_code,
        t.asset_issuer,
        t.last_checked_at,
        COALESCE(t.balance, '0') AS balance
      FROM trustlines t
      JOIN employees e ON e.id = t.employee_id
      WHERE ${trustlineConditions.join(' AND ')}
      ORDER BY t.last_checked_at DESC
      LIMIT 20`,
      trustlineParams
    );

    const recentSetups: RecentSetup[] = recentResult.rows.map((row) => ({
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      walletAddress: row.wallet_address,
      assetCode: row.asset_code,
      assetIssuer: row.asset_issuer,
      lastCheckedAt: row.last_checked_at,
      balance: row.balance,
    }));

    // Generate recommendations
    const recommendations: AdoptionRecommendation[] = [];

    if (adoptionRate >= 80) {
      recommendations.push({
        type: 'success',
        message: `Excellent trustline adoption rate of ${adoptionRate}%. Most employees are onboarded.`,
        affectedCount: totalWithTrustlines,
      });
    } else if (adoptionRate < 50) {
      recommendations.push({
        type: 'action',
        message: `Low trustline adoption rate of ${adoptionRate}%. Consider onboarding campaign.`,
        affectedCount: totalEmployees - totalWithTrustlines,
      });
    }

    // Department-specific recommendations
    for (const dept of byDepartment) {
      if (dept.adoptionRate < 40 && dept.totalEmployees > 5) {
        recommendations.push({
          type: 'action',
          message: `${dept.department || 'Unassigned'} department has low adoption (${dept.adoptionRate}%). Target for onboarding.`,
          affectedCount: dept.totalEmployees - dept.trustlinesEstablished,
          department: dept.department || undefined,
        });
      }
    }

    // Asset-specific insights
    for (const asset of byAsset) {
      if (asset.adoptionRate > 75) {
        recommendations.push({
          type: 'success',
          message: `${asset.assetCode} has strong adoption (${asset.adoptionRate}%).`,
          assetCode: asset.assetCode,
        });
      } else if (asset.adoptionRate < 30) {
        recommendations.push({
          type: 'insight',
          message: `${asset.assetCode} has low adoption (${asset.adoptionRate}%). Consider promotion or review utility.`,
          assetCode: asset.assetCode,
          affectedCount: totalEmployees - asset.trustlinesEstablished,
        });
      }
    }

    if (recommendations.length === 0) {
      recommendations.push({
        type: 'insight',
        message: `Monitoring ${totalTrustlines} trustlines across ${totalAssets} assets for ${totalEmployees} employees.`,
      });
    }

    const report: TrustlineAdoptionReport = {
      schemaVersion: '1.0',
      summary: {
        totalEmployees,
        totalWithTrustlines,
        adoptionRate,
        totalAssets,
        totalTrustlines,
        avgTrustlinesPerEmployee,
      },
      byAsset,
      byDepartment,
      recentSetups,
      recommendations,
    };

    return {
      executionId: crypto.randomUUID(),
      format: ReportFormat.JSON,
      data: [report as unknown as Record<string, any>],
      summary: {
        totalRecords: totalTrustlines,
        processedRecords: totalTrustlines,
        failedRecords: 0,
        generatedAt: new Date(),
        generatedBy: 0,
      },
      metadata: {
        version: '1.0',
        schema: 'trustline-adoption',
        checksum: '',
      },
    };
  }

  async validate(): Promise<SafetyValidation> {
    return { isValid: true, issues: [], piiDetected: [] };
  }
}
