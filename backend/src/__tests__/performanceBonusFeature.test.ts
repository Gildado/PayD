import { PayrollBonusService } from '../services/payrollBonusService';
import { PayrollAuditService } from '../services/payrollAuditService';
import { pool } from '../config/database';

/**
 * Integration tests for Performance Bonus Feature
 *
 * Acceptance Criteria:
 * 1. API supports adding one-time bonus items to a payroll run
 * 2. Audit logs and receipts distinguish between base and bonus
 * 3. Payroll engine correctly aggregates totals
 */
describe('Performance Bonus Feature', () => {
  let testOrgId: number;
  let testEmployeeId: number;
  let testPayrollRunId: number;

  beforeAll(async () => {
    // Create test organization
    const orgResult = await pool.query(
      `INSERT INTO organizations (name, public_key, created_at) 
       VALUES ($1, $2, NOW()) 
       RETURNING id`,
      ['Test Org', 'GTEST123456789']
    );
    testOrgId = orgResult.rows[0].id;

    // Create test employee
    const empResult = await pool.query(
      `INSERT INTO employees (organization_id, first_name, last_name, email, wallet_address, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW()) 
       RETURNING id`,
      [testOrgId, 'John', 'Doe', 'john.doe@test.com', 'GEMPLOYEE123456789']
    );
    testEmployeeId = empResult.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup
    await pool.query('DELETE FROM payroll_audit_logs WHERE organization_id = $1', [testOrgId]);
    await pool.query(
      'DELETE FROM payroll_items WHERE payroll_run_id IN (SELECT id FROM payroll_runs WHERE organization_id = $1)',
      [testOrgId]
    );
    await pool.query('DELETE FROM payroll_runs WHERE organization_id = $1', [testOrgId]);
    await pool.query('DELETE FROM employees WHERE organization_id = $1', [testOrgId]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [testOrgId]);
  });

  describe('Acceptance Criterion 1: API supports adding one-time bonus items', () => {
    it('should create a payroll run', async () => {
      const payrollRun = await PayrollBonusService.createPayrollRun(
        testOrgId,
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        'XLM'
      );

      expect(payrollRun).toBeDefined();
      expect(payrollRun.organization_id).toBe(testOrgId);
      expect(payrollRun.status).toBe('draft');
      testPayrollRunId = payrollRun.id;
    });

    it('should add a base salary item', async () => {
      const baseItem = await PayrollBonusService.addBaseSalaryItem(
        testPayrollRunId,
        testEmployeeId,
        '1000.0000000',
        'January payroll base payout'
      );

      expect(baseItem).toBeDefined();
      expect(baseItem.item_type).toBe('base');
      expect(baseItem.amount).toBe('1000.0000000');
      expect(baseItem.employee_id).toBe(testEmployeeId);
      expect(baseItem.metadata).toBe('January payroll base payout');
    });

    it('should add a single bonus item', async () => {
      const bonusItem = await PayrollBonusService.addBonusItem({
        payroll_run_id: testPayrollRunId,
        employee_id: testEmployeeId,
        amount: '500.0000000',
        description: 'Q1 Performance Bonus',
        metadata: 'Manager-approved bonus payout',
      });

      expect(bonusItem).toBeDefined();
      expect(bonusItem.item_type).toBe('bonus');
      expect(bonusItem.amount).toBe('500.0000000');
      expect(bonusItem.description).toBe('Q1 Performance Bonus');
      expect(bonusItem.metadata).toBe('Manager-approved bonus payout');
    });

    it('should add multiple bonus items in batch', async () => {
      const bonusItems = await PayrollBonusService.addBatchBonusItems(testPayrollRunId, [
        {
          employee_id: testEmployeeId,
          amount: '250.0000000',
          description: 'Project completion bonus',
        },
        {
          employee_id: testEmployeeId,
          amount: '150.0000000',
          description: 'Referral bonus',
        },
      ]);

      expect(bonusItems).toHaveLength(2);
      expect(bonusItems[0]?.item_type).toBe('bonus');
      expect(bonusItems[1]?.item_type).toBe('bonus');
    });

    it('should retrieve items filtered by type', async () => {
      const baseItems = await PayrollBonusService.getPayrollItems(testPayrollRunId, 'base');
      const bonusItems = await PayrollBonusService.getPayrollItems(testPayrollRunId, 'bonus');

      expect(baseItems).toHaveLength(1);
      expect(bonusItems).toHaveLength(3); // 1 single + 2 batch
      expect(baseItems[0]?.item_type).toBe('base');
      expect(bonusItems.every((item) => item.item_type === 'bonus')).toBe(true);
    });
  });

  describe('Acceptance Criterion 2: Audit logs distinguish between base and bonus', () => {
    it('should log bonus item addition with item_type in metadata', async () => {
      const auditLog = await PayrollAuditService.logItemAdded(
        testOrgId,
        testPayrollRunId,
        999, // mock item id
        testEmployeeId,
        '300.0000000',
        'XLM',
        { type: 'user', id: '1', email: 'admin@test.com' },
        {
          itemType: 'bonus',
          description: 'Test bonus for audit',
        }
      );

      expect(auditLog).toBeDefined();
      expect(auditLog.action).toBe('item_added');
      expect(auditLog.metadata).toBeDefined();
      expect(auditLog.metadata.item_type).toBe('bonus');
      expect(auditLog.metadata.description).toBe('Test bonus for audit');
    });

    it('should log transaction success with item_type', async () => {
      const auditLog = await PayrollAuditService.logTransactionSucceeded(
        testOrgId,
        testPayrollRunId,
        999,
        testEmployeeId,
        'TXHASH123456789',
        12345,
        '500.0000000',
        'XLM',
        'bonus'
      );

      expect(auditLog).toBeDefined();
      expect(auditLog.action).toBe('transaction_succeeded');
      expect(auditLog.metadata.item_type).toBe('bonus');
      expect(auditLog.tx_hash).toBe('TXHASH123456789');
    });

    it('should retrieve audit logs and verify metadata contains item_type', async () => {
      const { data: logs } = await PayrollAuditService.getAuditLogs(
        { organizationId: testOrgId, payrollRunId: testPayrollRunId },
        1,
        100
      );

      const bonusLogs = logs.filter((log) => log.metadata?.item_type === 'bonus');
      expect(bonusLogs.length).toBeGreaterThan(0);
    });
  });

  describe('Acceptance Criterion 3: Payroll engine correctly aggregates totals', () => {
    it('should calculate correct totals for base and bonus separately', async () => {
      const summary = await PayrollBonusService.getPayrollRunSummary(testPayrollRunId);

      expect(summary).toBeDefined();
      expect(summary?.summary.total_base_items).toBe(1);
      expect(summary?.summary.total_bonus_items).toBe(3);

      // Base: 1000
      expect(parseFloat(summary?.summary.total_base_amount || '0')).toBe(1000);

      // Bonus: 500 + 250 + 150 = 900
      expect(parseFloat(summary?.summary.total_bonus_amount || '0')).toBe(900);

      // Total: 1000 + 900 = 1900
      expect(parseFloat(summary?.summary.total_amount || '0')).toBe(1900);
    });

    it('should update payroll run totals correctly', async () => {
      const payrollRun = await PayrollBonusService.getPayrollRunById(testPayrollRunId);

      expect(payrollRun).toBeDefined();
      expect(parseFloat(payrollRun?.total_base_amount || '0')).toBe(1000);
      expect(parseFloat(payrollRun?.total_bonus_amount || '0')).toBe(900);
      expect(parseFloat(payrollRun?.total_amount || '0')).toBe(1900);
    });

    it('should maintain correct totals after deleting a bonus item', async () => {
      const items = await PayrollBonusService.getPayrollItems(testPayrollRunId, 'bonus');
      const itemToDelete = items[0];

      if (itemToDelete) {
        await PayrollBonusService.deletePayrollItem(itemToDelete.id);

        const updatedSummary = await PayrollBonusService.getPayrollRunSummary(testPayrollRunId);

        // After deleting one 500 bonus: 900 - 500 = 400
        expect(parseFloat(updatedSummary?.summary.total_bonus_amount || '0')).toBe(400);

        // Total: 1000 + 400 = 1400
        expect(parseFloat(updatedSummary?.summary.total_amount || '0')).toBe(1400);
      }
    });
  });

  describe('Bonus History and Reporting', () => {
    it('should retrieve organization bonus history', async () => {
      const { data: bonusHistory, total } = await PayrollBonusService.getOrganizationBonusHistory(
        testOrgId,
        1,
        20
      );

      expect(bonusHistory).toBeDefined();
      expect(total).toBeGreaterThan(0);
      expect(bonusHistory.every((item) => item.item_type === 'bonus')).toBe(true);
    });
  });
});
