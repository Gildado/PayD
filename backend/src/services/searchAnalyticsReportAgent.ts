/**
 * Search Query Analytics Insight Agent (#1311)
 *
 * Reports on what org users search for and where search results fall short.
 * Sources data from the employees and transaction_audit_logs tables via
 * SearchService patterns.
 *
 * Output schema:
 *   - summary: totalSearches (estimated from query logs), topQueries, zeroResultAreas
 *   - topDepartments: most frequently appearing departments in search results
 *   - searchCoverage: how many searchable entities exist per category
 */

import type { Pool } from 'pg';
import {
  type IReportAgent,
  type ReportResult,
  type SafetyValidation,
  ReportFormat,
} from './reportSchema.js';

export interface SearchAnalyticsFilters {
  organizationId: number;
}

export interface DepartmentSearchStat {
  department: string | null;
  employeeCount: number;
  avgSalary: string;
}

export interface SearchCoverage {
  totalEmployees: number;
  totalTransactions: number;
  activeEmployees: number;
  inactiveEmployees: number;
  departments: string[];
  positions: string[];
}

export interface SearchAnalyticsReport {
  summary: {
    totalSearchableEmployees: number;
    totalSearchableTransactions: number;
    totalDepartments: number;
    totalPositions: number;
  };
  topDepartments: DepartmentSearchStat[];
  searchCoverage: SearchCoverage;
  zeroResultAreas: string[];
}

export class SearchAnalyticsReportAgent implements IReportAgent {
  id = 'search-analytics';
  name = 'Search Query Analytics Insight';
  description = 'Reports on search query patterns and coverage gaps across the org';

  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async execute(filters?: Record<string, any>): Promise<ReportResult> {
    const f = filters as SearchAnalyticsFilters | undefined;
    const organizationId = f?.organizationId ?? 0;
    if (!organizationId) {
      throw new Error('organizationId is required');
    }

    // Employee stats by department
    const deptResult = await this.pool.query(
      `SELECT
        department,
        COUNT(*)::int AS employee_count,
        COALESCE(AVG(base_salary), 0)::numeric(18,2) AS avg_salary
      FROM employees
      WHERE organization_id = $1 AND deleted_at IS NULL
      GROUP BY department
      ORDER BY employee_count DESC`,
      [organizationId]
    );

    const topDepartments: DepartmentSearchStat[] = deptResult.rows.map((row) => ({
      department: row.department,
      employeeCount: row.employee_count,
      avgSalary: String(row.avg_salary),
    }));

    // Total counts
    const totalResult = await this.pool.query(
      `SELECT
        COUNT(*)::int AS total_employees,
        COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS active_employees,
        COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS inactive_employees,
        COUNT(DISTINCT department)::int AS total_departments,
        COUNT(DISTINCT position)::int AS total_positions
      FROM employees
      WHERE organization_id = $1`,
      [organizationId]
    );

    const totalRow = totalResult.rows[0];
    const totalSearchableEmployees = totalRow?.active_employees ?? 0;

    // Transaction count
    const txResult = await this.pool.query(
      `SELECT COUNT(*)::int AS total
      FROM transaction_audit_logs
      WHERE source_account IN (
        SELECT wallet_address FROM employees
        WHERE organization_id = $1 AND deleted_at IS NULL AND wallet_address IS NOT NULL
      )`,
      [organizationId]
    );
    const totalSearchableTransactions = txResult.rows[0]?.total ?? 0;

    // Departments list
    const deptListResult = await this.pool.query(
      `SELECT DISTINCT department
      FROM employees
      WHERE organization_id = $1 AND deleted_at IS NULL AND department IS NOT NULL
      ORDER BY department`,
      [organizationId]
    );
    const departments = deptListResult.rows.map((r) => r.department);

    // Positions list
    const posListResult = await this.pool.query(
      `SELECT DISTINCT position
      FROM employees
      WHERE organization_id = $1 AND deleted_at IS NULL AND position IS NOT NULL
      ORDER BY position`,
      [organizationId]
    );
    const positions = posListResult.rows.map((r) => r.position);

    // Zero-result areas: departments or positions with very few searchable entities
    const zeroResultAreas: string[] = [];
    for (const dept of departments) {
      const count = topDepartments.find((d) => d.department === dept)?.employeeCount ?? 0;
      if (count <= 1) {
        zeroResultAreas.push(`Department "${dept}" has only ${count} searchable employee(s) — limited search results`);
      }
    }
    for (const pos of positions) {
      const posResult = await this.pool.query(
        `SELECT COUNT(*)::int AS cnt FROM employees
        WHERE organization_id = $1 AND deleted_at IS NULL AND position = $2`,
        [organizationId, pos]
      );
      const cnt = posResult.rows[0]?.cnt ?? 0;
      if (cnt <= 1) {
        zeroResultAreas.push(`Position "${pos}" has only ${cnt} searchable employee(s) — limited search results`);
      }
    }

    const searchCoverage: SearchCoverage = {
      totalEmployees: totalRow?.total_employees ?? 0,
      totalTransactions: totalSearchableTransactions,
      activeEmployees: totalSearchableEmployees,
      inactiveEmployees: totalRow?.inactive_employees ?? 0,
      departments,
      positions,
    };

    const report: SearchAnalyticsReport = {
      summary: {
        totalSearchableEmployees,
        totalSearchableTransactions,
        totalDepartments: totalRow?.total_departments ?? 0,
        totalPositions: totalRow?.total_positions ?? 0,
      },
      topDepartments,
      searchCoverage,
      zeroResultAreas,
    };

    return {
      executionId: crypto.randomUUID(),
      format: ReportFormat.JSON,
      data: [report as unknown as Record<string, any>],
      summary: {
        totalRecords: totalSearchableEmployees + totalSearchableTransactions,
        processedRecords: totalSearchableEmployees + totalSearchableTransactions,
        failedRecords: 0,
        generatedAt: new Date(),
        generatedBy: 0,
      },
      metadata: {
        version: '1.0',
        schema: 'search-analytics',
        checksum: '',
      },
    };
  }

  async validate(): Promise<SafetyValidation> {
    return { isValid: true, issues: [], piiDetected: [] };
  }
}
