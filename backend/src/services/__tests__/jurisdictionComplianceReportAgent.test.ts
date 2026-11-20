/**
 * Tests for JurisdictionComplianceReportAgent
 */

import { jest, describe, it, expect } from '@jest/globals';
import { JurisdictionComplianceReportAgent } from '../jurisdictionComplianceReportAgent.js';
import type { Pool } from 'pg';
import { FIXTURE_TAX_ROWS, FIXTURE_EXPECTED, FIXTURE_ORG_ID } from './fixtures/jurisdictionComplianceFixture.js';

function makePool(rows: any[]): Pool {
  const query = jest.fn().mockResolvedValue({ rows });
  return { query } as unknown as Pool;
}

describe('JurisdictionComplianceReportAgent', () => {
  describe('execute()', () => {
    it('throws when organizationId is missing', async () => {
      const pool = makePool([]);
      const agent = new JurisdictionComplianceReportAgent(pool);
      await expect(agent.execute({})).rejects.toThrow('organizationId is required');
    });

    it('generates correct jurisdiction compliance report', async () => {
      const pool = makePool(FIXTURE_TAX_ROWS);
      const agent = new JurisdictionComplianceReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      expect(result.format).toBe('JSON');
      expect(result.data).toHaveLength(1);

      const report = result.data![0] as any;
      expect(report.schemaVersion).toBe('1.0');
      expect(report.organizationId).toBe(FIXTURE_ORG_ID);
      expect(report.summary.totalJurisdictions).toBe(FIXTURE_EXPECTED.totalJurisdictions);
      expect(report.summary.totalTaxWithheld).toBe(FIXTURE_EXPECTED.totalWithheld);
      expect(report.summary.totalTaxRemitted).toBe(FIXTURE_EXPECTED.totalRemitted);
      expect(report.summary.totalPendingRemittance).toBe(FIXTURE_EXPECTED.totalPending);

      expect(report.jurisdictions).toHaveLength(2);
      const usCa = report.jurisdictions.find((j: any) => j.jurisdiction === 'US-CA');
      expect(usCa.complianceStatus).toBe(FIXTURE_EXPECTED.usCaStatus);

      const deBy = report.jurisdictions.find((j: any) => j.jurisdiction === 'DE-BY');
      expect(deBy.complianceStatus).toBe(FIXTURE_EXPECTED.deByStatus);

      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('validate()', () => {
    it('returns valid', async () => {
      const pool = makePool([]);
      const agent = new JurisdictionComplianceReportAgent(pool);
      const v = await agent.validate();
      expect(v.isValid).toBe(true);
      expect(v.issues).toHaveLength(0);
      expect(v.piiDetected).toHaveLength(0);
    });
  });
});
