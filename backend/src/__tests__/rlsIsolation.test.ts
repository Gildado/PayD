/**
 * Multi-Tenant RLS Isolation Verification Tests (#1049)
 * 
 * Verifies Row-Level Security policies prevent cross-tenant data access.
 * Tests run in CI on every PR to catch RLS policy regressions.
 * 
 * Test Strategy:
 * 1. Create test records in tenant A context
 * 2. Query same table in tenant B context
 * 3. Verify tenant B sees zero results
 * 4. Repeat for all RLS-protected tables
 */

import { PrismaClient } from '@prisma/client';
import { pool } from '../config/database.js';

describe('Multi-Tenant RLS Isolation Tests', () => {
  const prisma = new PrismaClient();
  const TENANT_A_ID = 'test-tenant-a-' + Date.now();
  const TENANT_B_ID = 'test-tenant-b-' + Date.now();

  beforeAll(async () => {
    // Ensure test database connection
    await pool.query('SELECT 1');
  });

  afterAll(async () => {
    // Cleanup test data
    await pool.query('DELETE FROM employees WHERE tenant_id = $1 OR tenant_id = $2', [
      TENANT_A_ID,
      TENANT_B_ID,
    ]);
    await pool.query('DELETE FROM payrolls WHERE tenant_id = $1 OR tenant_id = $2', [
      TENANT_A_ID,
      TENANT_B_ID,
    ]);
    await pool.query('DELETE FROM payments WHERE tenant_id = $1 OR tenant_id = $2', [
      TENANT_A_ID,
      TENANT_B_ID,
    ]);

    await prisma.$disconnect();
    await pool.end();
  });

  /**
   * Helper to set tenant context via PostgreSQL SET LOCAL
   */
  async function setTenantContext(tenantId: string): Promise<void> {
    await pool.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
  }

  /**
   * Test RLS isolation for employees table
   */
  describe('employees table RLS', () => {
    it('should isolate employee records between tenants', async () => {
      const client = await pool.connect();
      try {
        // Start transaction
        await client.query('BEGIN');

        // Set tenant A context and create employee
        await client.query(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
        const insertResult = await client.query(
          `INSERT INTO employees (id, tenant_id, name, email, status) 
           VALUES (gen_random_uuid(), $1, 'Alice Test', 'alice@tenant-a.test', 'active') 
           RETURNING id`,
          [TENANT_A_ID]
        );
        const employeeId = insertResult.rows[0].id;

        // Verify tenant A can see the employee
        const tenantAQuery = await client.query(
          'SELECT * FROM employees WHERE id = $1',
          [employeeId]
        );
        expect(tenantAQuery.rows.length).toBe(1);
        expect(tenantAQuery.rows[0].tenant_id).toBe(TENANT_A_ID);

        // Switch to tenant B context
        await client.query(`SET LOCAL app.current_tenant_id = '${TENANT_B_ID}'`);

        // Verify tenant B CANNOT see tenant A's employee
        const tenantBQuery = await client.query(
          'SELECT * FROM employees WHERE id = $1',
          [employeeId]
        );
        expect(tenantBQuery.rows.length).toBe(0);

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });
  });

  /**
   * Test RLS isolation for payrolls table
   */
  describe('payrolls table RLS', () => {
    it('should isolate payroll records between tenants', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Set tenant A context
        await client.query(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);

        // Create payroll for tenant A
        const insertResult = await client.query(
          `INSERT INTO payrolls (id, tenant_id, period_start, period_end, status) 
           VALUES (gen_random_uuid(), $1, NOW(), NOW() + INTERVAL '1 month', 'draft') 
           RETURNING id`,
          [TENANT_A_ID]
        );
        const payrollId = insertResult.rows[0].id;

        // Verify tenant A can see it
        const tenantAQuery = await client.query(
          'SELECT * FROM payrolls WHERE id = $1',
          [payrollId]
        );
        expect(tenantAQuery.rows.length).toBe(1);

        // Switch to tenant B context
        await client.query(`SET LOCAL app.current_tenant_id = '${TENANT_B_ID}'`);

        // Verify tenant B CANNOT see it
        const tenantBQuery = await client.query(
          'SELECT * FROM payrolls WHERE id = $1',
          [payrollId]
        );
        expect(tenantBQuery.rows.length).toBe(0);

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });
  });

  /**
   * Test RLS isolation for payments table
   */
  describe('payments table RLS', () => {
    it('should isolate payment records between tenants', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        await client.query(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);

        const insertResult = await client.query(
          `INSERT INTO payments (id, tenant_id, amount, currency, status) 
           VALUES (gen_random_uuid(), $1, 1000, 'USD', 'pending') 
           RETURNING id`,
          [TENANT_A_ID]
        );
        const paymentId = insertResult.rows[0].id;

        const tenantAQuery = await client.query(
          'SELECT * FROM payments WHERE id = $1',
          [paymentId]
        );
        expect(tenantAQuery.rows.length).toBe(1);

        await client.query(`SET LOCAL app.current_tenant_id = '${TENANT_B_ID}'`);

        const tenantBQuery = await client.query(
          'SELECT * FROM payments WHERE id = $1',
          [paymentId]
        );
        expect(tenantBQuery.rows.length).toBe(0);

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });
  });

  /**
   * Test RLS policies survive database migrations
   */
  describe('RLS policy persistence', () => {
    it('should maintain RLS policies after schema changes', async () => {
      const client = await pool.connect();
      try {
        // Check that RLS is enabled on critical tables
        const rlsCheck = await client.query(`
          SELECT schemaname, tablename, rowsecurity 
          FROM pg_tables 
          WHERE schemaname = 'public' 
          AND tablename IN ('employees', 'payrolls', 'payments')
        `);

        expect(rlsCheck.rows.length).toBeGreaterThan(0);
        
        // All should have row security enabled
        rlsCheck.rows.forEach(row => {
          expect(row.rowsecurity).toBe(true);
        });

        // Check that policies exist
        const policyCheck = await client.query(`
          SELECT tablename, policyname 
          FROM pg_policies 
          WHERE schemaname = 'public' 
          AND tablename IN ('employees', 'payrolls', 'payments')
        `);

        expect(policyCheck.rows.length).toBeGreaterThan(0);
      } finally {
        client.release();
      }
    });
  });

  /**
   * Generate report of RLS verification status
   */
  describe('RLS verification report', () => {
    it('should generate per-table RLS status report', async () => {
      const tables = ['employees', 'payrolls', 'payments'];
      const report: Record<string, { rlsEnabled: boolean; policiesCount: number }> = {};

      const client = await pool.connect();
      try {
        for (const table of tables) {
          // Check RLS enabled
          const rlsCheck = await client.query(
            'SELECT rowsecurity FROM pg_tables WHERE tablename = $1',
            [table]
          );
          const rlsEnabled = rlsCheck.rows[0]?.rowsecurity || false;

          // Count policies
          const policyCount = await client.query(
            'SELECT COUNT(*) FROM pg_policies WHERE tablename = $1',
            [table]
          );
          const policiesCount = parseInt(policyCount.rows[0].count);

          report[table] = { rlsEnabled, policiesCount };
        }

        console.log('\n=== RLS Verification Report ===');
        console.table(report);

        // Assert all tables have RLS enabled
        Object.entries(report).forEach(([table, status]) => {
          expect(status.rlsEnabled).toBe(true);
          expect(status.policiesCount).toBeGreaterThan(0);
        });
      } finally {
        client.release();
      }
    });
  });
});
