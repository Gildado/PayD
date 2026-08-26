/**
 * Multi-tenant isolation test suite for ReportAccessControl (#1336).
 *
 * ReportAccessControl.canAccessReport/getAccessibleFields/applyRLSFilters/
 * filterReportResults are the report-agent suite's only gate between one
 * organization's data and another's. These tests specifically target
 * cross-tenant leakage paths: a user's own organizationId must be the only
 * thing that determines what they can see, never a caller-supplied value,
 * and a policy scoped to one organization must never grant access to a
 * user from a different one.
 */

import { jest } from '@jest/globals';

// jest.mock's factory runs before Jest's per-file runtime context is fully
// live under ts-jest's ESM preset -- a jest.fn() called inside the factory
// (or at module top-level) silently produces a plain function with none of
// the jest.Mock API (mockReset, mockResolvedValueOnce, ...). Registering a
// placeholder here and swapping in a real jest.fn() from inside beforeEach
// (where the runtime context is live) works around it.
jest.mock('../../config/database', () => ({
  pool: { query: undefined },
}));

import { pool } from '../../config/database.js';
import {
  ReportAccessControl,
  UserRole,
  AccessLevel,
  UserContext,
} from '../reportAccessControl.js';
import type { AccessPolicy } from '../reportSchema.js';

let mockQuery: jest.Mock;

function orgMembershipRow(belongs: boolean) {
  return { rows: belongs ? [{ id: 1 }] : [] };
}

function policyRow(policy: Partial<AccessPolicy> | null) {
  return { rows: policy ? [policy] : [] };
}

function makeUser(overrides: Partial<UserContext> = {}): UserContext {
  return {
    userId: 1,
    organizationId: 100,
    roles: [UserRole.EMPLOYEE],
    ...overrides,
  };
}

function orgScopedPolicy(organizationId: number, extra: Partial<AccessPolicy> = {}): Partial<AccessPolicy> {
  return {
    id: 'policy-1',
    reportId: 'payroll-history',
    name: 'Org-scoped payroll access',
    rules: [
      { type: 'ORG_BASED', value: String(organizationId), action: 'ALLOW' },
    ],
    ...extra,
  };
}

beforeEach(() => {
  mockQuery = jest.fn();
  (pool as { query: jest.Mock }).query = mockQuery;
});

describe('ReportAccessControl — multi-tenant isolation (#1336)', () => {
  describe('canAccessReport', () => {
    it('denies access when the user does not belong to the organization at all', async () => {
      mockQuery.mockResolvedValueOnce(orgMembershipRow(false));

      const result = await ReportAccessControl.canAccessReport(
        'payroll-history',
        makeUser({ organizationId: 999 })
      );

      expect(result.allowed).toBe(false);
      expect(result.accessLevel).toBe(AccessLevel.DENIED);
      expect(result.reason).toMatch(/does not belong/i);
      // Must short-circuit before ever fetching a policy for another org.
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('denies access when a policy is scoped to a different organization than the requesting user', async () => {
      // User belongs to org 100, but the report's policy is ORG_BASED for org 200.
      mockQuery
        .mockResolvedValueOnce(orgMembershipRow(true))
        .mockResolvedValueOnce(policyRow(orgScopedPolicy(200)));

      const result = await ReportAccessControl.canAccessReport(
        'payroll-history',
        makeUser({ organizationId: 100, roles: [UserRole.MANAGER] })
      );

      expect(result.allowed).toBe(false);
      expect(result.accessLevel).toBe(AccessLevel.DENIED);
    });

    it('allows access when the policy is scoped to the requesting user\'s own organization', async () => {
      mockQuery
        .mockResolvedValueOnce(orgMembershipRow(true))
        .mockResolvedValueOnce(policyRow(orgScopedPolicy(100)));

      const result = await ReportAccessControl.canAccessReport(
        'payroll-history',
        makeUser({ organizationId: 100 })
      );

      expect(result.allowed).toBe(true);
      expect(result.accessLevel).toBe(AccessLevel.FULL);
    });

    it('two users in different organizations get independently correct results for the same reportId', async () => {
      // Org A user: policy scoped to org A -> allowed.
      mockQuery
        .mockResolvedValueOnce(orgMembershipRow(true))
        .mockResolvedValueOnce(policyRow(orgScopedPolicy(100)));
      const orgAResult = await ReportAccessControl.canAccessReport(
        'payroll-history',
        makeUser({ userId: 1, organizationId: 100 })
      );

      // Org B user querying the same reportId: same policy (scoped to org A) -> denied.
      mockQuery
        .mockResolvedValueOnce(orgMembershipRow(true))
        .mockResolvedValueOnce(policyRow(orgScopedPolicy(100)));
      const orgBResult = await ReportAccessControl.canAccessReport(
        'payroll-history',
        makeUser({ userId: 2, organizationId: 200 })
      );

      expect(orgAResult.allowed).toBe(true);
      expect(orgBResult.allowed).toBe(false);
    });

    it('defaults to admin-only when no access policy exists for the report', async () => {
      mockQuery
        .mockResolvedValueOnce(orgMembershipRow(true))
        .mockResolvedValueOnce(policyRow(null));

      const nonAdmin = await ReportAccessControl.canAccessReport(
        'unconfigured-report',
        makeUser({ roles: [UserRole.EMPLOYEE] })
      );
      expect(nonAdmin.allowed).toBe(false);

      mockQuery
        .mockResolvedValueOnce(orgMembershipRow(true))
        .mockResolvedValueOnce(policyRow(null));

      const admin = await ReportAccessControl.canAccessReport(
        'unconfigured-report',
        makeUser({ roles: [UserRole.ADMIN] })
      );
      expect(admin.allowed).toBe(true);
      expect(admin.accessLevel).toBe(AccessLevel.FULL);
    });

    it('fails closed (denied) when the database lookup throws', async () => {
      mockQuery.mockRejectedValueOnce(new Error('connection lost'));

      const result = await ReportAccessControl.canAccessReport(
        'payroll-history',
        makeUser()
      );

      expect(result.allowed).toBe(false);
      expect(result.accessLevel).toBe(AccessLevel.DENIED);
    });
  });

  describe('applyRLSFilters — cross-tenant query scoping', () => {
    it('scopes the query to the requesting user\'s own organizationId, not a caller-supplied one', async () => {
      mockQuery.mockResolvedValueOnce(
        policyRow({
          rowLevelSecurity: {
            enabled: true,
            filters: [{ column: 'organization_id', operator: '=', value: '${organizationId}' }],
          },
        })
      );

      const filtered = await ReportAccessControl.applyRLSFilters(
        'SELECT * FROM payroll_runs',
        'payroll-history',
        makeUser({ organizationId: 100 })
      );

      expect(filtered).toContain('organization_id = 100');
      expect(filtered).not.toContain('${organizationId}');
    });

    it('produces different filtered queries for different organizations from the same base query', async () => {
      mockQuery.mockResolvedValueOnce(
        policyRow({
          rowLevelSecurity: {
            enabled: true,
            filters: [{ column: 'organization_id', operator: '=', value: '${organizationId}' }],
          },
        })
      );
      const orgAQuery = await ReportAccessControl.applyRLSFilters(
        'SELECT * FROM payroll_runs',
        'payroll-history',
        makeUser({ organizationId: 100 })
      );

      mockQuery.mockResolvedValueOnce(
        policyRow({
          rowLevelSecurity: {
            enabled: true,
            filters: [{ column: 'organization_id', operator: '=', value: '${organizationId}' }],
          },
        })
      );
      const orgBQuery = await ReportAccessControl.applyRLSFilters(
        'SELECT * FROM payroll_runs',
        'payroll-history',
        makeUser({ organizationId: 200 })
      );

      expect(orgAQuery).toContain('organization_id = 100');
      expect(orgBQuery).toContain('organization_id = 200');
      expect(orgAQuery).not.toBe(orgBQuery);
    });

    it('leaves the query unmodified when row-level security is not enabled for the policy', async () => {
      mockQuery.mockResolvedValueOnce(
        policyRow({ rowLevelSecurity: { enabled: false, filters: [] } })
      );

      const query = 'SELECT * FROM payroll_runs';
      const filtered = await ReportAccessControl.applyRLSFilters(
        query,
        'payroll-history',
        makeUser()
      );

      expect(filtered).toBe(query);
    });
  });

  describe('filterReportResults — cross-tenant result filtering', () => {
    const rows = [
      { organization_id: 100, amount: 500, employee: 'alice' },
      { organization_id: 200, amount: 700, employee: 'bob' },
    ];

    it('returns an empty array when the user is denied access, regardless of what rows were passed in', async () => {
      mockQuery.mockResolvedValueOnce(orgMembershipRow(false));

      const result = await ReportAccessControl.filterReportResults(
        rows,
        'payroll-history',
        makeUser({ organizationId: 999 })
      );

      expect(result).toEqual([]);
    });

    it('returns the raw rows unmodified at FULL access level for an in-org, allowed user', async () => {
      mockQuery
        .mockResolvedValueOnce(orgMembershipRow(true))
        .mockResolvedValueOnce(policyRow(orgScopedPolicy(100)));

      const result = await ReportAccessControl.filterReportResults(
        rows,
        'payroll-history',
        makeUser({ organizationId: 100 })
      );

      expect(result).toEqual(rows);
    });

    // Note: evaluateAccessRules (private) only ever resolves to FULL or
    // DENIED today -- a rule's ALLOW action always sets FULL, with no path
    // that produces AccessLevel.RESTRICTED/SUMMARY despite
    // filterReportResults/getAccessibleFields both having dedicated
    // handling for those levels. Flagging as a real gap surfaced while
    // writing this suite; fixing it is outside #1336's scope (test
    // coverage for the isolation behavior that exists today), so it isn't
    // exercised here pending a follow-up issue.
  });
});
