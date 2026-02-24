/**
 * Multi-Tenant Data Isolation Integration Tests
 * 
 * These tests verify that Row-Level Security (RLS) policies properly isolate
 * data between different organizations/tenants.
 */

import { Pool } from 'pg';
import { config } from '../config/env';

describe('Multi-Tenant Data Isolation', () => {
  let pool: Pool;
  let org1Id: number;
  let org2Id: number;
  let employee1Id: number;
  let employee2Id: number;
  let transaction1Id: number;
  let transaction2Id: number;

  beforeAll(async () => {
    // Create a dedicated pool for testing
    pool = new Pool({
      connectionString: config.DATABASE_URL,
    });

    // Create test organizations
    const org1Result = await pool.query(
      "INSERT INTO organizations (name) VALUES ('Test Org 1') RETURNING id"
    );
    org1Id = org1Result.rows[0].id;

    const org2Result = await pool.query(
      "INSERT INTO organizations (name) VALUES ('Test Org 2') RETURNING id"
    );
    org2Id = org2Result.rows[0].id;

    // Create test employees for each organization
    const emp1Result = await pool.query(
      `INSERT INTO employees (organization_id, first_name, last_name, email, status)
       VALUES ($1, 'John', 'Doe', 'john.doe@org1.com', 'active') RETURNING id`,
      [org1Id]
    );
    employee1Id = emp1Result.rows[0].id;

    const emp2Result = await pool.query(
      `INSERT INTO employees (organization_id, first_name, last_name, email, status)
       VALUES ($1, 'Jane', 'Smith', 'jane.smith@org2.com', 'active') RETURNING id`,
      [org2Id]
    );
    employee2Id = emp2Result.rows[0].id;

    // Create test transactions for each organization
    const tx1Result = await pool.query(
      `INSERT INTO transactions (organization_id, employee_id, tx_hash, amount, asset_code, status)
       VALUES ($1, $2, 'hash1_org1', 100.50, 'USDC', 'completed') RETURNING id`,
      [org1Id, employee1Id]
    );
    transaction1Id = tx1Result.rows[0].id;

    const tx2Result = await pool.query(
      `INSERT INTO transactions (organization_id, employee_id, tx_hash, amount, asset_code, status)
       VALUES ($1, $2, 'hash2_org2', 200.75, 'USDC', 'completed') RETURNING id`,
      [org2Id, employee2Id]
    );
    transaction2Id = tx2Result.rows[0].id;
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM transactions WHERE organization_id IN ($1, $2)', [org1Id, org2Id]);
    await pool.query('DELETE FROM employees WHERE organization_id IN ($1, $2)', [org1Id, org2Id]);
    await pool.query('DELETE FROM organizations WHERE id IN ($1, $2)', [org1Id, org2Id]);
    await pool.end();
  });

  describe('Employee Data Isolation', () => {
    it('should only return employees from the current tenant (Org 1)', async () => {
      const client = await pool.connect();
      try {
        // Set tenant context to Org 1
        await client.query('SET LOCAL app.current_tenant_id = $1', [org1Id]);

        // Query employees
        const result = await client.query('SELECT * FROM employees');

        // Should only see Org 1 employees
        expect(result.rows.length).toBe(1);
        expect(result.rows[0].id).toBe(employee1Id);
        expect(result.rows[0].organization_id).toBe(org1Id);
        expect(result.rows[0].email).toBe('john.doe@org1.com');
      } finally {
        client.release();
      }
    });

    it('should only return employees from the current tenant (Org 2)', async () => {
      const client = await pool.connect();
      try {
        // Set tenant context to Org 2
        await client.query('SET LOCAL app.current_tenant_id = $1', [org2Id]);

        // Query employees
        const result = await client.query('SELECT * FROM employees');

        // Should only see Org 2 employees
        expect(result.rows.length).toBe(1);
        expect(result.rows[0].id).toBe(employee2Id);
        expect(result.rows[0].organization_id).toBe(org2Id);
        expect(result.rows[0].email).toBe('jane.smith@org2.com');
      } finally {
        client.release();
      }
    });

    it('should not allow querying employees from another tenant by ID', async () => {
      const client = await pool.connect();
      try {
        // Set tenant context to Org 1
        await client.query('SET LOCAL app.current_tenant_id = $1', [org1Id]);

        // Try to query Org 2 employee
        const result = await client.query('SELECT * FROM employees WHERE id = $1', [employee2Id]);

        // Should return no results due to RLS
        expect(result.rows.length).toBe(0);
      } finally {
        client.release();
      }
    });

    it('should not allow updating employees from another tenant', async () => {
      const client = await pool.connect();
      try {
        // Set tenant context to Org 1
        await client.query('SET LOCAL app.current_tenant_id = $1', [org1Id]);

        // Try to update Org 2 employee
        const result = await client.query(
          'UPDATE employees SET first_name = $1 WHERE id = $2 RETURNING *',
          ['Hacked', employee2Id]
        );

        // Should not update due to RLS
        expect(result.rows.length).toBe(0);

        // Verify the employee was not modified
        const verifyResult = await pool.query(
          'SELECT first_name FROM employees WHERE id = $1',
          [employee2Id]
        );
        expect(verifyResult.rows[0].first_name).toBe('Jane');
      } finally {
        client.release();
      }
    });

    it('should not allow deleting employees from another tenant', async () => {
      const client = await pool.connect();
      try {
        // Set tenant context to Org 1
        await client.query('SET LOCAL app.current_tenant_id = $1', [org1Id]);

        // Try to delete Org 2 employee
        const result = await client.query(
          'DELETE FROM employees WHERE id = $1 RETURNING *',
          [employee2Id]
        );

        // Should not delete due to RLS
        expect(result.rows.length).toBe(0);

        // Verify the employee still exists
        const verifyResult = await pool.query(
          'SELECT id FROM employees WHERE id = $1',
          [employee2Id]
        );
        expect(verifyResult.rows.length).toBe(1);
      } finally {
        client.release();
      }
    });

    it('should prevent inserting employees with wrong organization_id', async () => {
      const client = await pool.connect();
      try {
        // Set tenant context to Org 1
        await client.query('SET LOCAL app.current_tenant_id = $1', [org1Id]);

        // Try to insert employee with Org 2 ID
        await expect(
          client.query(
            `INSERT INTO employees (organization_id, first_name, last_name, email, status)
             VALUES ($1, 'Malicious', 'User', 'malicious@org2.com', 'active')`,
            [org2Id]
          )
        ).rejects.toThrow();
      } finally {
        client.release();
      }
    });
  });

  describe('Transaction Data Isolation', () => {
    it('should only return transactions from the current tenant (Org 1)', async () => {
      const client = await pool.connect();
      try {
        // Set tenant context to Org 1
        await client.query('SET LOCAL app.current_tenant_id = $1', [org1Id]);

        // Query transactions
        const result = await client.query('SELECT * FROM transactions');

        // Should only see Org 1 transactions
        expect(result.rows.length).toBe(1);
        expect(result.rows[0].id).toBe(transaction1Id);
        expect(result.rows[0].organization_id).toBe(org1Id);
        expect(result.rows[0].tx_hash).toBe('hash1_org1');
      } finally {
        client.release();
      }
    });

    it('should only return transactions from the current tenant (Org 2)', async () => {
      const client = await pool.connect();
      try {
        // Set tenant context to Org 2
        await client.query('SET LOCAL app.current_tenant_id = $1', [org2Id]);

        // Query transactions
        const result = await client.query('SELECT * FROM transactions');

        // Should only see Org 2 transactions
        expect(result.rows.length).toBe(1);
        expect(result.rows[0].id).toBe(transaction2Id);
        expect(result.rows[0].organization_id).toBe(org2Id);
        expect(result.rows[0].tx_hash).toBe('hash2_org2');
      } finally {
        client.release();
      }
    });

    it('should not allow querying transactions from another tenant', async () => {
      const client = await pool.connect();
      try {
        // Set tenant context to Org 1
        await client.query('SET LOCAL app.current_tenant_id = $1', [org1Id]);

        // Try to query Org 2 transaction
        const result = await client.query('SELECT * FROM transactions WHERE id = $1', [transaction2Id]);

        // Should return no results due to RLS
        expect(result.rows.length).toBe(0);
      } finally {
        client.release();
      }
    });

    it('should prevent cross-tenant employee references in transactions', async () => {
      const client = await pool.connect();
      try {
        // Set tenant context to Org 1
        await client.query('SET LOCAL app.current_tenant_id = $1', [org1Id]);

        // Try to create transaction with Org 2 employee
        await expect(
          client.query(
            `INSERT INTO transactions (organization_id, employee_id, tx_hash, amount, asset_code, status)
             VALUES ($1, $2, 'malicious_hash', 50.00, 'USDC', 'pending')`,
            [org1Id, employee2Id]
          )
        ).rejects.toThrow(/does not belong to organization/);
      } finally {
        client.release();
      }
    });
  });

  describe('Search and Filter Isolation', () => {
    it('should only search employees within tenant scope', async () => {
      const client = await pool.connect();
      try {
        // Set tenant context to Org 1
        await client.query('SET LOCAL app.current_tenant_id = $1', [org1Id]);

        // Search for any employee (should only find Org 1)
        const result = await client.query(
          `SELECT * FROM employees WHERE search_vector @@ plainto_tsquery('english', 'Doe OR Smith')`
        );

        // Should only find John Doe from Org 1
        expect(result.rows.length).toBe(1);
        expect(result.rows[0].last_name).toBe('Doe');
      } finally {
        client.release();
      }
    });

    it('should only search transactions within tenant scope', async () => {
      const client = await pool.connect();
      try {
        // Set tenant context to Org 2
        await client.query('SET LOCAL app.current_tenant_id = $1', [org2Id]);

        // Search for any transaction hash
        const result = await client.query(
          `SELECT * FROM transactions WHERE search_vector @@ plainto_tsquery('english', 'hash')`
        );

        // Should only find Org 2 transaction
        expect(result.rows.length).toBe(1);
        expect(result.rows[0].tx_hash).toBe('hash2_org2');
      } finally {
        client.release();
      }
    });
  });

  describe('No Tenant Context', () => {
    it('should return no employees when tenant context is not set', async () => {
      const client = await pool.connect();
      try {
        // Don't set tenant context
        const result = await client.query('SELECT * FROM employees');

        // Should return no results due to RLS
        expect(result.rows.length).toBe(0);
      } finally {
        client.release();
      }
    });

    it('should return no transactions when tenant context is not set', async () => {
      const client = await pool.connect();
      try {
        // Don't set tenant context
        const result = await client.query('SELECT * FROM transactions');

        // Should return no results due to RLS
        expect(result.rows.length).toBe(0);
      } finally {
        client.release();
      }
    });
  });
});
