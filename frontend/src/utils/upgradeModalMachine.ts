/**
 * upgradeModalMachine
 *
 * Pure, framework-agnostic state machine for the contract upgrade modal.
 * No React / DOM dependencies — every helper is a deterministic function of
 * its arguments, which makes the whole flow unit-testable in isolation.
 *
 * The `ModalState` discriminated union mirrors the modal's seven steps so
 * TypeScript guarantees each render/transition only touches data that exists
 * for that step.
 */

import type {
  MigrationStep,
  UpgradeLogStatus,
  UpgradeSimulationResult,
} from '../services/contractUpgrade';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export type ModalState =
  | { step: 'input'; wasmHash: string; validating: boolean; validationError: string | null }
  | { step: 'simulating' }
  | {
      step: 'review';
      upgradeLogId: number;
      simulation: UpgradeSimulationResult;
      wasmHash: string;
    }
  | {
      step: 'authorize';
      upgradeLogId: number;
      wasmHash: string;
      adminSecret: string;
    }
  | {
      step: 'executing';
      upgradeLogId: number;
      txHash: string | null;
      migrationSteps: MigrationStep[];
      overallStatus: UpgradeLogStatus;
    }
  | { step: 'done'; txHash: string; wasmHash: string }
  | { step: 'failed'; error: string };

/** Minimal shape of the translation function needed by the machine. */
export type Translate = (key: string) => string;

/** Exact 64-character hex SHA-256 hash (case-insensitive). */
export const WASM_HASH_PATTERN = /^[0-9a-f]{64}$/i;

export function createInitialState(): ModalState {
  return { step: 'input', wasmHash: '', validating: false, validationError: null };
}

// ---------------------------------------------------------------------------
// Input validation / editing
// ---------------------------------------------------------------------------

/**
 * Client-side pre-check of the entered hash. Returns a translated error
 * string, or `null` when the input is acceptable. Kept pure so it can be
 * exercised without mounting React.
 */
export function validateHashInput(wasmHash: string, t: Translate): string | null {
  if (!wasmHash.trim()) {
    return t('upgradeModal.wasmHashRequired');
  }
  if (!WASM_HASH_PATTERN.test(wasmHash.trim())) {
    return t('upgradeModal.wasmHashFormatError');
  }
  return null;
}

/** Normalise input (lowercase + trim) and clear any previous error. */
export function updateWasmHash(state: ModalState, value: string): ModalState {
  if (state.step !== 'input') return state;
  return {
    ...state,
    wasmHash: value.toLowerCase().trim(),
    validationError: null,
  };
}

/** Flip the validating flag; starting validation clears a prior error. */
export function setValidating(state: ModalState, validating: boolean): ModalState {
  if (state.step !== 'input') return state;
  return validating ? { ...state, validating: true, validationError: null } : { ...state, validating: false };
}

/** Record a validation error and stop the validating spinner. */
export function setValidationError(state: ModalState, error: string): ModalState {
  if (state.step !== 'input') return state;
  return { ...state, validating: false, validationError: error };
}

// ---------------------------------------------------------------------------
// Step transitions
// ---------------------------------------------------------------------------

export function toSimulating(): ModalState {
  return { step: 'simulating' };
}

export function toReview(
  upgradeLogId: number,
  simulation: UpgradeSimulationResult,
  wasmHash: string
): ModalState {
  return { step: 'review', upgradeLogId, simulation, wasmHash };
}

export function toAuthorize(state: ModalState, adminSecret = ''): ModalState {
  if (state.step !== 'review') return state;
  return {
    step: 'authorize',
    upgradeLogId: state.upgradeLogId,
    wasmHash: state.wasmHash,
    adminSecret,
  };
}

/** Trimmed on change, exactly as the original input handler did. */
export function updateAdminSecret(state: ModalState, value: string): ModalState {
  if (state.step !== 'authorize') return state;
  return { ...state, adminSecret: value.trim() };
}

export function toExecuting(
  upgradeLogId: number,
  txHash: string | null,
  migrationSteps: MigrationStep[] = [],
  overallStatus: UpgradeLogStatus = 'executing'
): ModalState {
  return { step: 'executing', upgradeLogId, txHash, migrationSteps, overallStatus };
}

/** Apply a polled upgrade log to an executing state (log id is preserved). */
export function updateExecutionStatus(
  state: ModalState,
  status: {
    txHash: string | null;
    migrationSteps: MigrationStep[];
    overallStatus: UpgradeLogStatus;
  }
): ModalState {
  if (state.step !== 'executing') return state;
  return {
    ...state,
    txHash: status.txHash,
    migrationSteps: status.migrationSteps,
    overallStatus: status.overallStatus,
  };
}

export function toDone(wasmHash: string, txHash: string): ModalState {
  return { step: 'done', txHash, wasmHash };
}

export function toFailed(error: string): ModalState {
  return { step: 'failed', error };
}

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

/** Busy steps block closing (no Close button, Escape/backdrop ignored). */
export function isBusy(state: ModalState): boolean {
  return state.step === 'executing' || state.step === 'simulating';
}

/** Whether the user is allowed to dismiss the modal in this step. */
export function canCancel(state: ModalState): boolean {
  return !isBusy(state);
}

/** 1-based breadcrumb index for the current step. */
export function stepIndex(state: ModalState): number {
  const map: Record<ModalState['step'], number> = {
    input: 1,
    simulating: 2,
    review: 3,
    authorize: 4,
    executing: 5,
    done: 5,
    failed: 5,
  };
  return map[state.step];
}
