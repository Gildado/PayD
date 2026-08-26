/**
 * Tests for TrustlineAdoptionReportAgent
 *
 * Uses a mock pg Pool — no real database connection required.
 */

import { jest, describe, it, expect } from '@jest/globals';
import { TrustlineAdoptionReportAgent } from '../trustlineAdoptionReportAgent.js';
import type { Pool } from 'pg';
import {
  FIXTURE_EXPECTED,
  FIXTURE_ORG_ID,
} from './fixtures/trustlineAdoptionFixture.js';

function makePool(resolvedRows: unknown[][]): Pool {
  const chain = resolvedRows.reduceRight(
    (prev, rows) => jest.fn().mockResolvedValueOnce({ rows }).mockReturnValue(prev),
    jest.fn().mockResolvedValue({ rows: [] }),
  );
  return { query: chain } as unknown as Pool;
}

describe('TrustlineAdoptionReportAgent', () => {
  describe('execute()', () => {
    it('throws when organizationId is missing', async () => {
      const pool = { query: jest.fn() } as unknown as Pool;
      const agent = new TrustlineAdoptionReportAgent(pool);
      await expect(agent.execute({})).rejects.toThrow('organizationId is required');
    });

    it('returns correct summary with adoption metrics', async () => {
      const totalEmployeesRows = [{ total: FIXTURE_EXPECTED.totalEmployees }];
      const trustlineStatsRows = [{
        employees_with_trustlines: FIXTURE_EXPECTED.totalWithTrustlines,
        total_assets: FIXTURE_EXPECTED.totalAssets,
        total_trustlines: FIXTURE_EXPECTED.totalTrustlines,
        avg_trustlines: FIXTURE_EXPECTED.avgTrustlinesPerEmployee,
      }];
      const assetRows: unknown[] = [];
      const deptRows: unknown[] = [];
      const recentRows: unknown[] = [];

      const pool = makePool([totalEmployeesRows, trustlineStatsRows, assetRows, deptRows, recentRows]);
      const agent = new TrustlineAdoptionReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      expect(result.format).toBe('JSON');
      expect(result.data).toHaveLength(1);

      const report = result.data![0] as any;
      expect(report.schemaVersion).toBe('1.0');
      expect(report.summary.totalEmployees).toBe(FIXTURE_EXPECTED.totalEmployees);
      expect(report.summary.totalWithTrustlines).toBe(FIXTURE_EXPECTED.totalWithTrustlines);
      expect(report.summary.adoptionRate).toBe(FIXTURE_EXPECTED.adoptionRate);
      expect(report.summary.totalAssets).toBe(FIXTURE_EXPECTED.totalAssets);
      expect(report.summary.totalTrustlines).toBe(FIXTURE_EXPECTED.totalTrustlines);
      expect(report.summary.avgTrustlinesPerEmployee).toBe(FIXTURE_EXPECTED.avgTrustlinesPerEmployee);
    });

    it('includes per-asset breakdown', async () => {
      const totalEmployeesRows = [{ total: 5 }];
      const trustlineStatsRows = [{ employees_with_trustlines: 4, total_assets: 2, total_trustlines: 6, avg_trustlines: 1.5 }];
      const assetRows = [
        { asset_code: 'USDC', asset_issuer: 'GISSUER1...', employees_with_asset: 4, trustlines_established: 4, avg_balance: 1325 },
        { asset_code: 'EURC', asset_issuer: 'GISSUER2...', employees_with_asset: 2, trustlines_established: 2, avg_balance: 625 },
      ];
      const deptRows: unknown[] = [];
      const recentRows: unknown[] = [];

      const pool = makePool([totalEmployeesRows, trustlineStatsRows, assetRows, deptRows, recentRows]);
      const agent = new TrustlineAdoptionReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      expect(report.byAsset).toHaveLength(2);
      expect(report.byAsset[0].assetCode).toBe('USDC');
      expect(report.byAsset[0].trustlinesEstablished).toBe(FIXTURE_EXPECTED.usdc.trustlinesEstablished);
      expect(report.byAsset[0].adoptionRate).toBe(FIXTURE_EXPECTED.usdc.adoptionRate);
    });

    it('includes per-department breakdown', async () => {
      const totalEmployeesRows = [{ total: 5 }];
      const trustlineStatsRows = [{ employees_with_trustlines: 4, total_assets: 2, total_trustlines: 6, avg_trustlines: 1.5 }];
      const assetRows: unknown[] = [];
      const deptRows = [
        { department: 'Engineering', total_employees: 3, with_trustlines: 3, assets_used: 2 },
        { department: 'Sales', total_employees: 2, with_trustlines: 1, assets_used: 1 },
      ];
      const recentRows: unknown[] = [];

      const pool = makePool([totalEmployeesRows, trustlineStatsRows, assetRows, deptRows, recentRows]);
      const agent = new TrustlineAdoptionReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      expect(report.byDepartment).toHaveLength(2);
      expect(report.byDepartment[0].department).toBe('Engineering');
      expect(report.byDepartment[0].adoptionRate).toBe(FIXTURE_EXPECTED.engineering.adoptionRate);
      expect(report.byDepartment[1].department).toBe('Sales');
      expect(report.byDepartment[1].adoptionRate).toBe(FIXTURE_EXPECTED.sales.adoptionRate);
    });

    it('includes recent trustline setups', async () => {
      const totalEmployeesRows = [{ total: 5 }];
      const trustlineStatsRows = [{ employees_with_trustlines: 4, total_assets: 2, total_trustlines: 6, avg_trustlines: 1.5 }];
      const assetRows: unknown[] = [];
      const deptRows: unknown[] = [];
      const recentRows = [
        { employee_id: 1, employee_name: 'Alice A', wallet_address: 'GALICE...', asset_code: 'USDC', asset_issuer: 'GISSUER1...', last_checked_at: new Date(), balance: '1000' },
        { employee_id: 2, employee_name: 'Bob B', wallet_address: 'GBOB...', asset_code: 'USDC', asset_issuer: 'GISSUER1...', last_checked_at: new Date(), balance: '2000' },
      ];

      const pool = makePool([totalEmployeesRows, trustlineStatsRows, assetRows, deptRows, recentRows]);
      const agent = new TrustlineAdoptionReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      expect(report.recentSetups).toHaveLength(2);
      expect(report.recentSetups[0].employeeName).toBe('Alice A');
      expect(report.recentSetups[0].assetCode).toBe('USDC');
    });

    it('generates recommendations based on adoption data', async () => {
      const totalEmployeesRows = [{ total: 100 }];
      const trustlineStatsRows = [{ employees_with_trustlines: 85, total_assets: 3, total_trustlines: 120, avg_trustlines: 1.4 }];
      const assetRows = [
        { asset_code: 'USDC', asset_issuer: 'G...', employees_with_asset: 80, trustlines_established: 80, avg_balance: 1000 },
      ];
      const deptRows: unknown[] = [];
      const recentRows: unknown[] = [];

      const pool = makePool([totalEmployeesRows, trustlineStatsRows, assetRows, deptRows, recentRows]);
      const agent = new TrustlineAdoptionReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      expect(report.recommendations.length).toBeGreaterThan(0);
      // High adoption should trigger success message
      const successRec = report.recommendations.find((r: any) => r.type === 'success');
      expect(successRec).toBeDefined();
    });

    it('identifies low adoption departments', async () => {
      const totalEmployeesRows = [{ total: 20 }];
      const trustlineStatsRows = [{ employees_with_trustlines: 8, total_assets: 1, total_trustlines: 8, avg_trustlines: 1.0 }];
      const assetRows: unknown[] = [];
      const deptRows = [
        { department: 'Engineering', total_employees: 10, with_trustlines: 8, assets_used: 1 },
        { department: 'Sales', total_employees: 10, with_trustlines: 2, assets_used: 1 },
      ];
      const recentRows: unknown[] = [];

      const pool = makePool([totalEmployeesRows, trustlineStatsRows, assetRows, deptRows, recentRows]);
      const agent = new TrustlineAdoptionReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      // Sales dept with 20% adoption should trigger action recommendation
      const salesAction = report.recommendations.find((r: any) => 
        r.type === 'action' && r.department === 'Sales'
      );
      expect(salesAction).toBeDefined();
    });

    it('applies filters when provided', async () => {
      const pool = makePool([[], [], [], [], []]);
      const agent = new TrustlineAdoptionReportAgent(pool);

      await agent.execute({
        organizationId: FIXTURE_ORG_ID,
        assetCode: 'USDC',
        department: 'Engineering',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      const [sql] = (pool.query as jest.Mock).mock.calls[1];
      expect(sql).toContain('t.asset_code = $3');
      expect(sql).toContain('e.department = $2');
      expect(sql).toContain('t.last_checked_at >= $4');
      expect(sql).toContain('t.last_checked_at <= $5');
    });
  });

  describe('validate()', () => {
    it('returns valid', async () => {
      const pool = { query: jest.fn() } as unknown as Pool;
      const agent = new TrustlineAdoptionReportAgent(pool);
      const v = await agent.validate();
      expect(v.isValid).toBe(true);
      expect(v.issues).toHaveLength(0);
      expect(v.piiDetected).toHaveLength(0);
    });
  });
});
