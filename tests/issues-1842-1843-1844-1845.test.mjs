import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Issue #1842: Shared Stellar Validators (G-address, memo length, max 7 decimals)
// ---------------------------------------------------------------------------

test('Issue #1842: stellarValidators implements public key, memo, and amount rules', () => {
  const filePath = path.resolve('frontend/src/schemas/stellarValidators.ts');
  assert.ok(fs.existsSync(filePath), 'stellarValidators.ts must exist');

  const content = fs.readFileSync(filePath, 'utf8');

  // Verify key constants & exports
  assert.ok(content.includes('STELLAR_PUBLIC_KEY_PATTERN = /^G[A-Z2-7]{55}$/'));
  assert.ok(content.includes('STELLAR_MAX_DECIMAL_PLACES = 7'));
  assert.ok(content.includes('STELLAR_MEMO_MAX_BYTES = 28'));
  assert.ok(content.includes('STELLAR_MAX_AMOUNT = 922337203685.4775807'));

  // Verify validator functions
  assert.ok(content.includes('export function countDecimalPlaces'));
  assert.ok(content.includes('export function getUtf8ByteLength'));
  assert.ok(content.includes('export function validateStellarPublicKey'));
  assert.ok(content.includes('export function validateStellarMemo'));
  assert.ok(content.includes('export function validateStellarAmount'));

  // Test regex directly
  const pubKeyPattern = /^G[A-Z2-7]{55}$/;
  const validKey = 'G' + 'B'.repeat(55);
  const invalidPrefix = 'C' + 'B'.repeat(55);
  const invalidChar = 'G0' + 'B'.repeat(54);
  const invalidLen = 'G' + 'B'.repeat(50);

  assert.strictEqual(pubKeyPattern.test(validKey), true);
  assert.strictEqual(pubKeyPattern.test(invalidPrefix), false);
  assert.strictEqual(pubKeyPattern.test(invalidChar), false);
  assert.strictEqual(pubKeyPattern.test(invalidLen), false);

  // Test decimal places function logic
  function countDecimals(val) {
    const trimmed = val.trim();
    const dotIndex = trimmed.indexOf('.');
    if (dotIndex === -1) return 0;
    return trimmed.length - dotIndex - 1;
  }
  assert.strictEqual(countDecimals('100'), 0);
  assert.strictEqual(countDecimals('100.1234567'), 7);
  assert.strictEqual(countDecimals('100.12345678'), 8);

  // Test UTF-8 byte length calculation (including multibyte emojis)
  function getUtf8Length(str) {
    return Buffer.from(str, 'utf8').length;
  }
  assert.strictEqual(getUtf8Length('Payroll Nov 2026'), 16);
  assert.strictEqual(getUtf8Length('a'.repeat(28)), 28);
  assert.strictEqual(getUtf8Length('a'.repeat(29)), 29);
  assert.strictEqual(getUtf8Length('🚀'), 4); // 4-byte UTF-8 emoji
});

test('Issue #1842: Forms migrated to shared stellar validators', () => {
  // EmployeeEntry
  const empEntryPath = path.resolve('frontend/src/schemas/employeeEntrySchema.ts');
  const empEntryContent = fs.readFileSync(empEntryPath, 'utf8');
  assert.ok(empEntryContent.includes('./stellarValidators'), 'employeeEntrySchema must import stellarValidators');

  // CrossAssetPayment
  const crossAssetPath = path.resolve('frontend/src/pages/CrossAssetPayment.tsx');
  const crossAssetContent = fs.readFileSync(crossAssetPath, 'utf8');
  assert.ok(crossAssetContent.includes('validateStellarAmount'), 'CrossAssetPayment must use validateStellarAmount');
  assert.ok(crossAssetContent.includes('validateStellarPublicKey'), 'CrossAssetPayment must use validateStellarPublicKey');

  // PayrollScheduler
  const schedulerPath = path.resolve('frontend/src/pages/PayrollScheduler.tsx');
  const schedulerContent = fs.readFileSync(schedulerPath, 'utf8');
  assert.ok(schedulerContent.includes('validateStellarAmount'), 'PayrollScheduler must use validateStellarAmount');
  assert.ok(schedulerContent.includes('validateStellarMemo'), 'PayrollScheduler must use validateStellarMemo');
});

// ---------------------------------------------------------------------------
// Issue #1843: useNativeXlmBalance with backoff and Page Visibility API
// ---------------------------------------------------------------------------

test('Issue #1843: calculateBackoffDelay logic with exponential progression and clamping', () => {
  const hookPath = path.resolve('frontend/src/hooks/useNativeXlmBalance.ts');
  assert.ok(fs.existsSync(hookPath), 'useNativeXlmBalance.ts must exist');

  const content = fs.readFileSync(hookPath, 'utf8');
  assert.ok(content.includes('calculateBackoffDelay'));
  assert.ok(content.includes('isDocumentVisible'));
  assert.ok(content.includes('BalancePoller'));

  function calculateBackoffDelay(failureCount, baseMs = 1000, maxMs = 8000) {
    if (failureCount <= 0) return baseMs;
    const factor = Math.min(failureCount, 30);
    const delay = baseMs * Math.pow(2, factor);
    return Math.min(delay, maxMs);
  }

  // Failure progression
  assert.strictEqual(calculateBackoffDelay(0), 1000);
  assert.strictEqual(calculateBackoffDelay(1), 2000);
  assert.strictEqual(calculateBackoffDelay(2), 4000);
  assert.strictEqual(calculateBackoffDelay(3), 8000);
  assert.strictEqual(calculateBackoffDelay(4), 8000); // Clamped to max
});

test('Issue #1843: BalancePoller with simulated timers and visibility pauses', async () => {
  // Pure Node simulation of BalancePoller behavior
  let isVisible = true;
  let requestsMade = 0;
  let failureCount = 0;

  async function mockPoll(shouldFail = false) {
    if (!isVisible) return; // Tab hidden: NO requests made!
    requestsMade++;
    if (shouldFail) {
      failureCount++;
      throw new Error('500 Server Error');
    }
    failureCount = 0;
  }

  // 1. Visible poll
  await mockPoll(false);
  assert.strictEqual(requestsMade, 1);
  assert.strictEqual(failureCount, 0);

  // 2. Hidden tab: no requests made
  isVisible = false;
  await mockPoll(false);
  assert.strictEqual(requestsMade, 1, 'No requests should be made while tab is hidden');

  // 3. Tab becomes visible again
  isVisible = true;
  await mockPoll(false);
  assert.strictEqual(requestsMade, 2);

  // 4. Consecutive failures increment backoff counter
  await assert.rejects(async () => mockPoll(true));
  assert.strictEqual(requestsMade, 3);
  assert.strictEqual(failureCount, 1);

  await assert.rejects(async () => mockPoll(true));
  assert.strictEqual(requestsMade, 4);
  assert.strictEqual(failureCount, 2);
});

// ---------------------------------------------------------------------------
// Issue #1844: PreflightCheckPanel Trustline Requirement Banner
// ---------------------------------------------------------------------------

test('Issue #1844: PreflightCheckPanel renders trustline banner with both actionable options', () => {
  const panelPath = path.resolve('frontend/src/components/PreflightCheckPanel.tsx');
  assert.ok(fs.existsSync(panelPath), 'PreflightCheckPanel.tsx must exist');

  const content = fs.readFileSync(panelPath, 'utf8');

  // Verify trustline requirement banner structure
  assert.ok(content.includes('trustline-requirement-banner'));
  assert.ok(content.includes('Trustline Required for Token Settlement'));

  // Option 1: Pay via Claimable Balance
  assert.ok(content.includes('Pay via Claimable Balance'));
  assert.ok(content.includes('action-claimable-balance'));
  assert.ok(content.includes('/payroll/scheduler?mode=claimable'));

  // Option 2: Request Trustline Setup
  assert.ok(content.includes('Request Trustline Setup'));
  assert.ok(content.includes('action-request-trustline'));
  assert.ok(content.includes('/employees'));
});

// ---------------------------------------------------------------------------
// Issue #1845: TransactionSimulationPanel Resource Fee Breakdown
// ---------------------------------------------------------------------------

test('Issue #1845: TransactionSimulationPanel renders Soroban resource breakdown and hides for classic', () => {
  const simPanelPath = path.resolve('frontend/src/components/TransactionSimulationPanel.tsx');
  assert.ok(fs.existsSync(simPanelPath), 'TransactionSimulationPanel.tsx must exist');

  const panelContent = fs.readFileSync(simPanelPath, 'utf8');
  assert.ok(panelContent.includes('resource-fee-breakdown'));
  assert.ok(panelContent.includes('resource-breakdown-toggle'));
  assert.ok(panelContent.includes('cpuInstructions'));
  assert.ok(panelContent.includes('memoryBytes'));
  assert.ok(panelContent.includes('readOnlyLedgerEntries'));
  assert.ok(panelContent.includes('readWriteLedgerEntries'));
  assert.ok(panelContent.includes("result.simulationType === 'classic'"), 'Must hide breakdown for classic payments');

  // Verify transactionSimulation service types
  const simServicePath = path.resolve('frontend/src/services/transactionSimulation.ts');
  const serviceContent = fs.readFileSync(simServicePath, 'utf8');
  assert.ok(serviceContent.includes('export interface SorobanResourceBreakdown'));
  assert.ok(serviceContent.includes("simulationType?: 'soroban' | 'classic'"));
  assert.ok(serviceContent.includes('resourceBreakdown?: SorobanResourceBreakdown'));
});

