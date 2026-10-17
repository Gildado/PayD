#!/usr/bin/env node
/**
 * Master verification runner for all 4 Anomaly Detection Agents:
 * - Issue #1200: CSV Import Anomaly/Injection Detection Agent
 * - Issue #1201: Fee Estimation Drift Detection Agent
 * - Issue #1202: Unauthorized Trustline Change Detection Agent
 * - Issue #1203: Claimable Balance Abuse Detection Agent
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const suites = [
  { name: 'Issue #1200: CSV Import Anomaly Detection', script: 'verify-csv-anomaly.mjs' },
  { name: 'Issue #1201: Fee Estimation Drift Detection', script: 'verify-fee-drift.mjs' },
  { name: 'Issue #1202: Unauthorized Trustline Change Detection', script: 'verify-trustline-anomaly.mjs' },
  { name: 'Issue #1203: Claimable Balance Abuse Detection', script: 'verify-claimable-abuse.mjs' },
];

console.log('======================================================================');
console.log('PAYD: MASTER ANOMALY AGENT VERIFICATION RUNNER');
console.log('======================================================================\n');

let allPassed = true;
const results = [];

for (const suite of suites) {
  console.log(`>>> Running: ${suite.name} ...`);
  const scriptPath = join(__dirname, suite.script);
  const result = spawnSync('node', ['--experimental-strip-types', scriptPath], {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status === 0) {
    results.push({ name: suite.name, status: 'PASSED' });
  } else {
    results.push({ name: suite.name, status: 'FAILED' });
    allPassed = false;
  }
  console.log('');
}

console.log('======================================================================');
console.log('SUMMARY OF RESULTS:');
console.log('======================================================================');
for (const r of results) {
  const icon = r.status === 'PASSED' ? '✓' : '✗';
  console.log(`  ${icon} [${r.status}] ${r.name}`);
}
console.log('======================================================================');

if (!allPassed) {
  console.error('\nSome verification suites failed.');
  process.exit(1);
} else {
  console.log('\nAll 4 Anomaly Detection Agents passed all verification suites successfully!');
}
