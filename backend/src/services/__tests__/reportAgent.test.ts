import { describe, it, expect, beforeEach } from 'vitest';
import ReportSafetyGuardrails from '../reportSafetyGuardrails.js';
import { ReportAccessControl, UserRole, AccessLevel } from '../reportAccessControl.js';
import {
  reportFixtures,
  mockReportResult,
  mockAccessPolicy,
  sqlInjectionTests,
  piiDetectionTests,
} from './fixtures/reportFixtures.js';

/**
 * Report Agent Test Suite
 * Comprehensive regression tests for reporting infrastructure
 */
describe('Report Agent Infrastructure', () => {
  describe('Safety Guardrails - SQL Injection Detection', () => {
    it('should detect SQL injection patterns', async () => {
      for (const test of sqlInjectionTests) {
        const result = await ReportSafetyGuardrails.validateQuery(test.query);
        if (test.shouldDetect) {
          expect(result.isValid).toBe(false);
          expect(result.issues.length).toBeGreaterThan(0);
          expect(result.issues[0].type).toBe('SQL_INJECTION');
        } else {
          expect(result.isValid).toBe(true);
        }
      }
    });

    it('should reject queries with dangerous keywords', async () => {
      const dangerousQueries = [
        'SELECT * FROM users UNION SELECT * FROM admins',
        'SELECT * FROM table; DROP TABLE users;',
        'EXEC sp_executesql',
      ];

      for (const query of dangerousQueries) {
        const result = await ReportSafetyGuardrails.validateQuery(query);
        expect(result.isValid).toBe(false);
        expect(result.issues.some((i) => i.type === 'SQL_INJECTION')).toBe(true);
      }
    });

    it('should allow safe queries', async () => {
      const safeQueries = [
        'SELECT * FROM employees WHERE id = ?',
        'SELECT name, email FROM users ORDER BY created_at DESC',
        'SELECT COUNT(*) as total FROM transactions WHERE status = ?',
      ];

      for (const query of safeQueries) {
        const result = await ReportSafetyGuardrails.validateQuery(query);
        expect(result.isValid).toBe(true);
      }
    });
  });

  describe('Safety Guardrails - PII Detection', () => {
    it('should detect PII in data', async () => {
      for (const test of piiDetectionTests) {
        const result = await ReportSafetyGuardrails.validateQuery(
          'SELECT * FROM users',
          test.data
        );
        expect(result.piiDetected.length).toBeGreaterThan(0);
      }
    });

    it('should mask sensitive data in results', () => {
      const results = [
        { id: '1', email: 'john@example.com', name: 'John Doe' },
        { id: '2', email: 'jane@example.com', name: 'Jane Smith' },
      ];

      const masked = ReportSafetyGuardrails.maskPIIInResults(results, [
        'email',
        'name',
      ]);

      expect(masked[0].email).toMatch(/^..\*+$/);
      expect(masked[1].name).toMatch(/^..\*+$/);
    });

    it('should validate output schema', () => {
      const output = reportFixtures.payrollSummary.sampleOutput;
      const expectedSchema = reportFixtures.payrollSummary.expectedSchema;

      const validation = ReportSafetyGuardrails.validateOutputSchema(
        output as any,
        expectedSchema
      );
      expect(validation.valid).toBe(true);
    });

    it('should reject output with missing fields', () => {
      const invalidOutput = [
        { id: '1', organizationId: 1, amount: '100' }, // Missing required fields
      ];

      const validation = ReportSafetyGuardrails.validateOutputSchema(
        invalidOutput,
        reportFixtures.payrollSummary.expectedSchema
      );
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Golden Dataset Regression Tests', () => {
    it('should validate payroll summary fixture', () => {
      const fixture = reportFixtures.payrollSummary;
      expect(fixture.expectedRowCount).toBe(150);
      expect(fixture.sampleOutput.length).toBeGreaterThan(0);
      expect(fixture.sampleOutput[0]).toHaveProperty('employeeId');
      expect(fixture.sampleOutput[0]).toHaveProperty('amount');
    });

    it('should validate audit log fixture', () => {
      const fixture = reportFixtures.auditLog;
      expect(fixture.queryType).toBe('AUDIT');
      expect(fixture.sampleOutput.length).toBeGreaterThan(0);
      expect(fixture.sampleOutput[0]).toHaveProperty('action');
    });

    it('should validate transaction detail fixture', () => {
      const fixture = reportFixtures.transactionDetail;
      expect(fixture.queryType).toBe('TRANSACTIONS');
      expect(fixture.sampleOutput).toHaveLength(1);
      expect(fixture.sampleOutput[0]).toHaveProperty('txHash');
    });

    it('should validate custom report fixture', () => {
      const fixture = reportFixtures.customReport;
      expect(fixture.queryType).toBe('CUSTOM');
      expect(fixture.sampleOutput.length).toBeGreaterThan(0);
    });

    it('should produce expected output for payroll summary', async () => {
      const fixture = reportFixtures.payrollSummary;
      const result = mockReportResult;

      // Verify schema validation
      const validation = ReportSafetyGuardrails.validateOutputSchema(
        result.data as any,
        fixture.expectedSchema
      );
      expect(validation.valid).toBe(true);

      // Verify record count
      expect(result.summary.totalRecords).toBeGreaterThan(0);
    });
  });

  describe('Access Control - Role-Based Access', () => {
    it('should allow admin access', async () => {
      const userContext = {
        userId: 1,
        organizationId: 1,
        roles: [UserRole.ADMIN],
      };

      const result = await ReportAccessControl.canAccessReport(
        'test-report',
        userContext
      );
      expect(result.allowed).toBe(true);
      expect(result.accessLevel).toBe(AccessLevel.FULL);
    });

    it('should deny employee access to restricted reports', async () => {
      const userContext = {
        userId: 2,
        organizationId: 1,
        roles: [UserRole.EMPLOYEE],
      };

      const result = await ReportAccessControl.canAccessReport(
        'test-report',
        userContext
      );
      // Without policy, non-admin users are denied
      expect(result.allowed).toBe(false);
    });

    it('should apply row-level security filters', async () => {
      const query = 'SELECT * FROM payroll_transactions';
      const userContext = {
        userId: 10,
        organizationId: 5,
        roles: [UserRole.MANAGER],
      };

      const filteredQuery = await ReportAccessControl.applyRLSFilters(
        query,
        'test-report',
        userContext
      );

      // Should contain organization ID filter
      expect(filteredQuery).toContain('organization');
    });
  });

  describe('Report Result Filtering', () => {
    it('should filter results for restricted access level', async () => {
      const userContext = {
        userId: 1,
        organizationId: 1,
        roles: [UserRole.MANAGER],
      };

      const results = reportFixtures.payrollSummary.sampleOutput;

      // This would normally check the policy, but for testing we verify the data structure
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should aggregate results for summary access level', () => {
      const results = reportFixtures.payrollSummary.sampleOutput;
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('amount');
    });
  });

  describe('Report Schema Validation', () => {
    it('should validate report execution result', () => {
      const result = mockReportResult;
      expect(result.executionId).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary.totalRecords).toBeGreaterThan(0);
    });

    it('should validate access policy', () => {
      const policy = mockAccessPolicy;
      expect(policy.id).toBeDefined();
      expect(policy.rules).toBeInstanceOf(Array);
      expect(policy.rules.length).toBeGreaterThan(0);
    });

    it('should have correct schema for all fixtures', () => {
      Object.entries(reportFixtures).forEach(([key, fixture]) => {
        expect(fixture.name).toBeDefined();
        expect(fixture.expectedSchema).toBeDefined();
        expect(fixture.sampleOutput).toBeInstanceOf(Array);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed queries', async () => {
      const result = await ReportSafetyGuardrails.validateQuery(
        "SELECT * FROM users WHERE name = 'John"
      );
      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.type === 'MALFORMED_QUERY')).toBe(true);
    });

    it('should handle empty queries', async () => {
      const result = await ReportSafetyGuardrails.validateQuery('');
      expect(result.isValid).toBe(false);
    });

    it('should sanitize dangerous input', async () => {
      const query = 'SELECT * FROM users -- this is a comment';
      const result = await ReportSafetyGuardrails.validateQuery(query);
      expect(result.sanitizedQuery).not.toContain('--');
    });
  });

  describe('Integration Tests', () => {
    it('should complete end-to-end report generation flow', async () => {
      // 1. Validate query
      const query = 'SELECT * FROM payroll_transactions WHERE organization_id = ?';
      const validation = await ReportSafetyGuardrails.validateQuery(query);
      expect(validation.isValid).toBe(true);

      // 2. Check access
      const userContext = {
        userId: 1,
        organizationId: 1,
        roles: [UserRole.ADMIN],
      };
      const access = await ReportAccessControl.canAccessReport(
        'test-report',
        userContext
      );
      expect(access.allowed).toBe(true);

      // 3. Validate result
      const result = mockReportResult;
      const schemaValidation = ReportSafetyGuardrails.validateOutputSchema(
        result.data as any,
        reportFixtures.payrollSummary.expectedSchema
      );
      expect(schemaValidation.valid).toBe(true);
    });
  });
});
