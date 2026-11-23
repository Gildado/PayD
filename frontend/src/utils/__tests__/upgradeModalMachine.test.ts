/**
 * Unit tests for the pure upgrade-modal state machine.
 * No React / DOM involved. A stub `t` is passed wherever translations are
 * needed (the global setup mock only covers `useTranslation`, not this util).
 */

import { describe, it, expect } from 'vitest';
import {
  WASM_HASH_PATTERN,
  createInitialState,
  validateHashInput,
  updateWasmHash,
  setValidating,
  setValidationError,
  toSimulating,
  toReview,
  toAuthorize,
  updateAdminSecret,
  toExecuting,
  updateExecutionStatus,
  toDone,
  toFailed,
  isBusy,
  canCancel,
  stepIndex,
  type ModalState,
  type Translate,
} from '../upgradeModalMachine';
import type { MigrationStep, UpgradeSimulationResult } from '../../services/contractUpgrade';

const EN: Record<string, string> = {
  'upgradeModal.wasmHashRequired': 'WASM hash is required.',
  'upgradeModal.wasmHashFormatError': 'WASM hash must be exactly 64 lowercase hex characters.',
};
const t: Translate = (key) => EN[key] ?? key;

const VALID_HASH = 'a'.repeat(64);
const simulation: UpgradeSimulationResult = {
  success: true,
  estimatedFee: '100',
  estimatedFeeXlm: '0.0000100',
  cpuInstructions: '1000',
  memoryBytes: '2048',
  latestLedger: 42,
  transactionData: null,
  warnings: [],
  error: null,
};
const steps: MigrationStep[] = [
  { id: '1', name: 'Migrate', status: 'completed', message: null },
  { id: '2', name: 'Verify', status: 'running', message: 'working' },
];

function reviewState(): ModalState {
  return toReview(7, simulation, VALID_HASH);
}
function authorizeState(): ModalState {
  return toAuthorize(reviewState(), 'Ssecret');
}
function executingState(): ModalState {
  return toExecuting(7, 'txhash', steps, 'executing');
}

describe('upgradeModalMachine', () => {
  describe('createInitialState', () => {
    it('returns a clean input step', () => {
      expect(createInitialState()).toEqual({
        step: 'input',
        wasmHash: '',
        validating: false,
        validationError: null,
      });
    });
  });

  describe('WASM_HASH_PATTERN / validateHashInput', () => {
    it('accepts a 64-character hex hash (case-insensitive)', () => {
      expect(WASM_HASH_PATTERN.test(VALID_HASH)).toBe(true);
      expect(WASM_HASH_PATTERN.test('A'.repeat(64))).toBe(true);
      expect(validateHashInput(`  ${VALID_HASH}  `, t)).toBeNull();
    });

    it('reports the required error for empty / whitespace input', () => {
      expect(validateHashInput('', t)).toBe(EN['upgradeModal.wasmHashRequired']);
      expect(validateHashInput('   ', t)).toBe(EN['upgradeModal.wasmHashRequired']);
    });

    it('reports the format error for a malformed hash', () => {
      expect(WASM_HASH_PATTERN.test('abc')).toBe(false);
      expect(WASM_HASH_PATTERN.test(`g${'a'.repeat(63)}`)).toBe(false);
      expect(validateHashInput('abc', t)).toBe(EN['upgradeModal.wasmHashFormatError']);
    });
  });

  describe('input editing transitions', () => {
    it('updateWasmHash lowercases, trims and clears validation errors', () => {
      const errored = setValidationError(createInitialState(), 'bad');
      const next = updateWasmHash(errored, '  ABCDEF  ');
      expect(next).toEqual({
        step: 'input',
        wasmHash: 'abcdef',
        validating: false,
        validationError: null,
      });
    });

    it('setValidating toggles the flag and clears errors when starting', () => {
      const errored = setValidationError(createInitialState(), 'bad');
      const validating = setValidating(errored, true);
      expect(validating).toMatchObject({ step: 'input', validating: true, validationError: null });
      expect(setValidating(validating, false)).toMatchObject({
        step: 'input',
        validating: false,
      });
    });

    it('setValidationError stops validation and records the message', () => {
      const validating = setValidating(createInitialState(), true);
      expect(setValidationError(validating, 'nope')).toEqual({
        step: 'input',
        wasmHash: '',
        validating: false,
        validationError: 'nope',
      });
    });

    it('input-only helpers ignore non-input states', () => {
      const state = reviewState();
      expect(updateWasmHash(state, 'x')).toBe(state);
      expect(setValidating(state, true)).toBe(state);
      expect(setValidationError(state, 'x')).toBe(state);
    });
  });

  describe('step transitions', () => {
    it('toSimulating builds the simulating state', () => {
      expect(toSimulating()).toEqual({ step: 'simulating' });
    });

    it('toReview carries log id, simulation and hash', () => {
      expect(reviewState()).toEqual({
        step: 'review',
        upgradeLogId: 7,
        simulation,
        wasmHash: VALID_HASH,
      });
    });

    it('toAuthorize derives from review and defaults an empty secret', () => {
      expect(toAuthorize(reviewState())).toEqual({
        step: 'authorize',
        upgradeLogId: 7,
        wasmHash: VALID_HASH,
        adminSecret: '',
      });
      expect(authorizeState()).toMatchObject({ step: 'authorize', adminSecret: 'Ssecret' });
      const executing = executingState();
      expect(toAuthorize(executing)).toBe(executing);
    });

    it('updateAdminSecret trims and is authorize-only', () => {
      expect(updateAdminSecret(authorizeState(), '  Snew  ')).toMatchObject({
        step: 'authorize',
        adminSecret: 'Snew',
      });
      const review = reviewState();
      expect(updateAdminSecret(review, 'x')).toBe(review);
    });

    it('toExecuting defaults to no steps / executing status', () => {
      expect(toExecuting(7, 'tx')).toEqual({
        step: 'executing',
        upgradeLogId: 7,
        txHash: 'tx',
        migrationSteps: [],
        overallStatus: 'executing',
      });
    });

    it('updateExecutionStatus preserves the log id and is executing-only', () => {
      const updated = updateExecutionStatus(executingState(), {
        txHash: 'newtx',
        migrationSteps: steps,
        overallStatus: 'completed',
      });
      expect(updated).toEqual({
        step: 'executing',
        upgradeLogId: 7,
        txHash: 'newtx',
        migrationSteps: steps,
        overallStatus: 'completed',
      });
      const review = reviewState();
      expect(updateExecutionStatus(review, {
        txHash: null,
        migrationSteps: [],
        overallStatus: 'pending',
      })).toBe(review);
    });

    it('toDone / toFailed build terminal states', () => {
      expect(toDone(VALID_HASH, 'tx')).toEqual({
        step: 'done',
        txHash: 'tx',
        wasmHash: VALID_HASH,
      });
      expect(toFailed('boom')).toEqual({ step: 'failed', error: 'boom' });
    });
  });

  describe('derived helpers', () => {
    it('isBusy is true only for simulating and executing', () => {
      expect(isBusy(toSimulating())).toBe(true);
      expect(isBusy(executingState())).toBe(true);
      for (const state of [
        createInitialState(),
        reviewState(),
        authorizeState(),
        toDone(VALID_HASH, 'tx'),
        toFailed('boom'),
      ]) {
        expect(isBusy(state)).toBe(false);
      }
    });

    it('canCancel is the inverse of isBusy', () => {
      expect(canCancel(createInitialState())).toBe(true);
      expect(canCancel(toSimulating())).toBe(false);
      expect(canCancel(executingState())).toBe(false);
      expect(canCancel(toFailed('boom'))).toBe(true);
    });

    it('stepIndex maps steps to 1-based breadcrumb positions', () => {
      expect(stepIndex(createInitialState())).toBe(1);
      expect(stepIndex(toSimulating())).toBe(2);
      expect(stepIndex(reviewState())).toBe(3);
      expect(stepIndex(authorizeState())).toBe(4);
      expect(stepIndex(executingState())).toBe(5);
      expect(stepIndex(toDone(VALID_HASH, 'tx'))).toBe(5);
      expect(stepIndex(toFailed('boom'))).toBe(5);
    });
  });
});
