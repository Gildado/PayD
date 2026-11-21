/**
 * UpgradeConfirmModal orchestrator: owns state, side effects (service calls,
 * polling, notifications) and the modal shell DOM — kept in the original
 * order so focus/keyboard order is unchanged. Step logic lives in the pure
 * `upgradeModalMachine`; step JSX lives under `./upgradeModal/`.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import {
  type ContractRecord,
  validateWasmHash,
  simulateUpgrade,
  executeUpgrade,
  fetchUpgradeStatus,
  cancelUpgrade,
} from '../services/contractUpgrade';
import { useNotification } from '../hooks/useNotification';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
  type ModalState,
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
  stepIndex,
} from '../utils/upgradeModalMachine';
import { StepBreadcrumb } from './upgradeModal/Shared';
import InputStep from './upgradeModal/InputStep';
import SimulatingStep from './upgradeModal/SimulatingStep';
import ReviewStep from './upgradeModal/ReviewStep';
import AuthorizeStep from './upgradeModal/AuthorizeStep';
import ExecutingStep from './upgradeModal/ExecutingStep';
import { DoneStep, FailedStep } from './upgradeModal/TerminalSteps';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UpgradeConfirmModalProps {
  contract: ContractRecord;
  /** Wallet address of the currently connected admin — used as initiatedBy */
  adminAddress: string;
  onClose: () => void;
  onUpgradeComplete: (newWasmHash: string) => void;
}

// ---------------------------------------------------------------------------
// UpgradeConfirmModal (orchestrator)
// ---------------------------------------------------------------------------

export default function UpgradeConfirmModal({
  contract,
  adminAddress,
  onClose,
  onUpgradeComplete,
}: UpgradeConfirmModalProps) {
  const { t, i18n } = useTranslation();
  const { notifySuccess, notifyError } = useNotification();

  const [modal, setModal] = useState<ModalState>(createInitialState);

  // Polling ref — cleared on unmount or when we reach a terminal step
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Keep `onClose` inline: useFocusTrap re-runs its setup on each new identity,
  // which preserves the original initial-focus behaviour on every render.
  useFocusTrap(modalRef, {
    isOpen: true,
    onClose: () => {
      if (!isBusy(modal)) {
        void handleCancel();
      }
    },
  });

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => clearPoll(), [clearPoll]);

  // ── Step 1: validate & proceed to simulation ─────────────────────────────

  async function handleValidateAndSimulate() {
    if (modal.step !== 'input') return;
    const { wasmHash } = modal;

    const validationError = validateHashInput(wasmHash, t);
    if (validationError) {
      setModal((m) => setValidationError(m, validationError));
      return;
    }

    setModal((m) => setValidating(m, true));

    try {
      // Validate against backend registry + on-chain check
      const { valid, reason } = await validateWasmHash(contract.id, wasmHash.trim());
      if (!valid) {
        setModal((m) => setValidationError(m, reason ?? t('upgradeModal.validationFailed')));
        return;
      }
    } catch {
      setModal((m) => setValidationError(m, t('upgradeModal.couldNotReachBackend')));
      return;
    }

    // ── Proceed to simulation ────────────────────────────────────────────
    setModal(toSimulating());

    try {
      const { upgradeLogId, simulation } = await simulateUpgrade(
        contract.id,
        wasmHash.trim(),
        adminAddress
      );

      setModal(toReview(upgradeLogId, simulation, wasmHash.trim()));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('upgradeModal.simulationFailed');
      setModal(toFailed(message));
    }
  }

  // ── Step 3: accept review, advance to authorize ──────────────────────────

  function handleAcceptReview() {
    if (modal.step !== 'review') return;
    setModal(toAuthorize(modal));
  }

  // ── Step 4: execute the upgrade ──────────────────────────────────────────

  async function handleExecute() {
    if (modal.step !== 'authorize') return;
    const { upgradeLogId, wasmHash, adminSecret } = modal;

    if (!adminSecret.trim()) {
      notifyError(t('upgradeModal.missingSecretTitle'), t('upgradeModal.missingSecretMessage'));
      return;
    }

    try {
      const result = await executeUpgrade(upgradeLogId, adminSecret.trim());

      setModal(toExecuting(upgradeLogId, result.txHash ?? null));

      // Poll migration progress every 3 seconds
      pollRef.current = setInterval(() => {
        void (async () => {
          try {
            const log = await fetchUpgradeStatus(upgradeLogId);

            setModal((m) =>
              updateExecutionStatus(m, {
                txHash: log.tx_hash,
                migrationSteps: log.migration_steps,
                overallStatus: log.status,
              })
            );

            // Reached terminal state — stop polling
            if (log.status === 'completed') {
              clearPoll();
              notifySuccess(
                t('upgradeModal.upgradeCompleteTitle'),
                t('upgradeModal.upgradeCompleteMessage')
              );
              setModal(toDone(wasmHash, log.tx_hash ?? result.txHash));
              onUpgradeComplete(wasmHash);
            } else if (log.status === 'failed') {
              clearPoll();
              notifyError(
                t('upgradeModal.upgradeFailedTitle'),
                log.error_message ?? t('upgradeModal.upgradeOrMigrationFailed')
              );
              setModal(toFailed(log.error_message ?? t('upgradeModal.upgradeFailedGeneric')));
            }
          } catch {
            // Network blip — keep polling silently
          }
        })();
      }, 3_000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('upgradeModal.executionFailed');
      notifyError(t('upgradeModal.executionFailedTitle'), message);
      setModal(toFailed(message));
    }
  }

  // ── Cancel (only valid for pre-execution states) ─────────────────────────

  const handleCancel = useCallback(async () => {
    if (modal.step === 'review' || modal.step === 'authorize' || modal.step === 'executing') {
      try {
        const logId = 'upgradeLogId' in modal ? modal.upgradeLogId : null;
        if (logId) {
          await cancelUpgrade(logId);
        }
      } catch {
        // Best-effort cancel; ignore errors
      }
    }
    clearPoll();
    onClose();
  }, [modal, clearPoll, onClose]);

  function copyToClipboard(text: string) {
    void navigator.clipboard.writeText(text).then(() => {
      notifySuccess(t('upgradeModal.copiedTitle'), t('upgradeModal.copiedToClipboard'));
    });
  }

  function handleBackdropClick() {
    if (isBusy(modal)) return;
    void handleCancel();
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBusy(modal)) {
        e.preventDefault();
        void handleCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [modal, handleCancel]);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        tabIndex={-1}
        className="relative w-full max-w-2xl mx-4 bg-surface border border-hi rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-hi">
          <div>
            <h2 id="upgrade-modal-title" className="text-lg font-black tracking-tight">
              {t('upgradeModal.upgradeContract')}
            </h2>
            <p className="text-xs text-muted font-mono mt-0.5">{contract.name}</p>
          </div>
          {!isBusy(modal) && (
            <button
              onClick={() => void handleCancel()}
              className="p-1.5 rounded-lg hover:bg-white/5 text-muted hover:text-text transition-colors"
              aria-label={t('common.close')}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Step breadcrumb */}
        <div className="px-6 pt-4">
          <StepBreadcrumb current={stepIndex(modal)} />
        </div>

        {/* Step content */}
        <div className="px-6 pb-6 max-h-[70vh] overflow-y-auto">
          {modal.step === 'input' && (
            <InputStep
              contract={contract}
              state={modal}
              language={i18n.language}
              onWasmHashChange={(value) => setModal((m) => updateWasmHash(m, value))}
              onValidateAndSimulate={() => void handleValidateAndSimulate()}
            />
          )}

          {modal.step === 'simulating' && <SimulatingStep />}

          {modal.step === 'review' && (
            <ReviewStep
              contract={contract}
              state={modal}
              language={i18n.language}
              onCancel={() => void handleCancel()}
              onAcceptReview={handleAcceptReview}
            />
          )}

          {modal.step === 'authorize' && (
            <AuthorizeStep
              contract={contract}
              state={modal}
              onSecretChange={(value) => setModal((m) => updateAdminSecret(m, value))}
              onCancel={() => void handleCancel()}
              onExecute={() => void handleExecute()}
            />
          )}

          {modal.step === 'executing' && (
            <ExecutingStep
              contract={contract}
              state={modal}
              onCopyTxHash={copyToClipboard}
            />
          )}

          {modal.step === 'done' && (
            <DoneStep
              contract={contract}
              state={modal}
              onClose={onClose}
              onCopyTxHash={copyToClipboard}
            />
          )}

          {modal.step === 'failed' && (
            <FailedStep
              state={modal}
              onClose={onClose}
              onTryAgain={() => setModal(createInitialState())}
            />
          )}
        </div>
      </div>
    </div>
  );
}
