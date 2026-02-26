/**
 * UpgradeConfirmModal
 *
 * A focused multi-step modal that guides the admin through the full
 * Soroban contract upgrade lifecycle:
 *
 *   Step 1 — INPUT      Enter and validate new WASM hash
 *   Step 2 — SIMULATING  Loading state while Soroban RPC simulates
 *   Step 3 — REVIEW      Show simulation diff, cost, warnings
 *   Step 4 — AUTHORIZE   Admin secret key entry + final confirm
 *   Step 5 — EXECUTING   Progress bar + migration steps
 *   Step 6 — DONE/FAILED Terminal state with tx hash or error
 *
 * State transitions are represented as a discriminated union so
 * TypeScript enforces that every render branch accesses only the
 * data that exists for that step (no optional field sprawl).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  Copy,
  RefreshCw,
} from 'lucide-react';
import {
  type ContractRecord,
  type UpgradeSimulationResult,
  type UpgradeLog,
  type MigrationStep,
  validateWasmHash,
  simulateUpgrade,
  executeUpgrade,
  fetchUpgradeStatus,
  cancelUpgrade,
} from '../services/contractUpgrade';
import { useNotification } from '../hooks/useNotification';

// ---------------------------------------------------------------------------
// Style constants (consistent with AdminPanel.tsx)
// ---------------------------------------------------------------------------

const INPUT_CLASS =
  'w-full bg-black/20 border border-hi rounded-xl p-4 text-text outline-none ' +
  'focus:border-accent/50 focus:bg-accent/5 transition-all font-mono text-sm';

const LABEL_CLASS = 'block text-xs font-bold uppercase tracking-widest text-muted mb-2 ml-1';

// ---------------------------------------------------------------------------
// Modal step discriminated union
// ---------------------------------------------------------------------------

type ModalState =
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
      overallStatus: UpgradeLog['status'];
    }
  | { step: 'done'; txHash: string; wasmHash: string }
  | { step: 'failed'; error: string };

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Step progress indicator */
function StepBreadcrumb({ current }: { current: number }) {
  const steps = ['Input', 'Simulate', 'Review', 'Authorize', 'Execute'];
  return (
    <div className="flex items-center gap-1 text-xs text-muted mb-6">
      {steps.map((label, i) => (
        <span key={label} className="flex items-center gap-1">
          <span
            className={`px-2 py-0.5 rounded font-bold uppercase tracking-widest ${
              i + 1 === current
                ? 'text-accent bg-accent/10'
                : i + 1 < current
                  ? 'text-emerald-500'
                  : 'text-muted/50'
            }`}
          >
            {i + 1 < current ? '✓' : `${i + 1}.`} {label}
          </span>
          {i < steps.length - 1 && <ChevronRight className="w-3 h-3 text-muted/30" />}
        </span>
      ))}
    </div>
  );
}

/** Diff row showing old → new WASM hash */
function HashDiff({
  label,
  oldHash,
  newHash,
}: {
  label: string;
  oldHash: string;
  newHash: string;
}) {
  return (
    <div className="grid gap-1 text-xs font-mono">
      <span className="text-muted text-[10px] uppercase tracking-widest">{label}</span>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-red-400/80 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
          <span className="text-red-500 font-bold">−</span>
          <span className="break-all">{oldHash}</span>
        </div>
        <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
          <span className="text-emerald-500 font-bold">+</span>
          <span className="break-all">{newHash}</span>
        </div>
      </div>
    </div>
  );
}

/** Individual migration step row */
function MigrationStepRow({ step }: { step: MigrationStep }) {
  const icon = {
    pending: <div className="w-4 h-4 rounded-full border border-muted/40 bg-transparent" />,
    running: <Loader2 className="w-4 h-4 text-accent animate-spin" />,
    completed: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    failed: <XCircle className="w-4 h-4 text-red-500" />,
  }[step.status];

  const textColor = {
    pending: 'text-muted',
    running: 'text-text',
    completed: 'text-emerald-400',
    failed: 'text-red-400',
  }[step.status];

  return (
    <div className="flex items-start gap-3 py-3 border-b border-hi/50 last:border-0">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${textColor}`}>{step.name}</p>
        {step.message && <p className="text-xs text-muted mt-0.5">{step.message}</p>}
      </div>
    </div>
  );
}

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
// UpgradeConfirmModal
// ---------------------------------------------------------------------------

export default function UpgradeConfirmModal({
  contract,
  adminAddress,
  onClose,
  onUpgradeComplete,
}: UpgradeConfirmModalProps) {
  const { notifySuccess, notifyError } = useNotification();

  const [modal, setModal] = useState<ModalState>({
    step: 'input',
    wasmHash: '',
    validating: false,
    validationError: null,
  });

  // Polling ref — cleared on unmount or when we reach a terminal step
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => clearPoll(), [clearPoll]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  function currentStepIndex(): number {
    const map: Record<ModalState['step'], number> = {
      input: 1,
      simulating: 2,
      review: 3,
      authorize: 4,
      executing: 5,
      done: 5,
      failed: 5,
    };
    return map[modal.step];
  }

  // ── Step 1: validate & proceed to simulation ─────────────────────────────

  async function handleValidateAndSimulate() {
    if (modal.step !== 'input') return;
    const { wasmHash } = modal;

    if (!wasmHash.trim()) {
      setModal((m) =>
        m.step === 'input' ? { ...m, validationError: 'WASM hash is required.' } : m
      );
      return;
    }

    // Client-side format pre-check to avoid unnecessary round-trip
    if (!/^[0-9a-f]{64}$/i.test(wasmHash.trim())) {
      setModal((m) =>
        m.step === 'input'
          ? { ...m, validationError: 'WASM hash must be exactly 64 lowercase hex characters.' }
          : m
      );
      return;
    }

    setModal((m) => (m.step === 'input' ? { ...m, validating: true, validationError: null } : m));

    try {
      // Validate against backend registry + on-chain check
      const { valid, reason } = await validateWasmHash(contract.id, wasmHash.trim());
      if (!valid) {
        setModal((m) =>
          m.step === 'input'
            ? { ...m, validating: false, validationError: reason ?? 'Validation failed.' }
            : m
        );
        return;
      }
    } catch {
      setModal((m) =>
        m.step === 'input'
          ? { ...m, validating: false, validationError: 'Could not reach backend for validation.' }
          : m
      );
      return;
    }

    // ── Proceed to simulation ────────────────────────────────────────────
    setModal({ step: 'simulating' });

    try {
      const { upgradeLogId, simulation } = await simulateUpgrade(
        contract.id,
        wasmHash.trim(),
        adminAddress
      );

      setModal({
        step: 'review',
        upgradeLogId,
        simulation,
        wasmHash: wasmHash.trim(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Simulation failed';
      setModal({ step: 'failed', error: message });
    }
  }

  // ── Step 3: accept review, advance to authorize ──────────────────────────

  function handleAcceptReview() {
    if (modal.step !== 'review') return;
    setModal({
      step: 'authorize',
      upgradeLogId: modal.upgradeLogId,
      wasmHash: modal.wasmHash,
      adminSecret: '',
    });
  }

  // ── Step 4: execute the upgrade ──────────────────────────────────────────

  async function handleExecute() {
    if (modal.step !== 'authorize') return;
    const { upgradeLogId, wasmHash, adminSecret } = modal;

    if (!adminSecret.trim()) {
      notifyError(
        'Missing secret',
        'Admin secret key is required to sign the upgrade transaction.'
      );
      return;
    }

    try {
      const result = await executeUpgrade(upgradeLogId, adminSecret.trim());

      setModal({
        step: 'executing',
        upgradeLogId,
        txHash: result.txHash ?? null,
        migrationSteps: [],
        overallStatus: 'executing',
      });

      // Poll migration progress every 3 seconds
      pollRef.current = setInterval(() => {
        void (async () => {
          try {
            const log = await fetchUpgradeStatus(upgradeLogId);

            setModal({
              step: 'executing',
              upgradeLogId,
              txHash: log.tx_hash,
              migrationSteps: log.migration_steps,
              overallStatus: log.status,
            });

            // Reached terminal state — stop polling
            if (log.status === 'completed') {
              clearPoll();
              notifySuccess(
                'Upgrade Complete',
                'Contract upgraded and migration finished successfully.'
              );
              setModal({ step: 'done', txHash: log.tx_hash ?? result.txHash, wasmHash });
              onUpgradeComplete(wasmHash);
            } else if (log.status === 'failed') {
              clearPoll();
              notifyError('Upgrade Failed', log.error_message ?? 'Upgrade or migration failed.');
              setModal({ step: 'failed', error: log.error_message ?? 'Upgrade failed.' });
            }
          } catch {
            // Network blip — keep polling silently
          }
        })();
      }, 3_000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Execution failed';
      notifyError('Execution Failed', message);
      setModal({ step: 'failed', error: message });
    }
  }

  // ── Cancel (only valid for pre-execution states) ─────────────────────────

  async function handleCancel() {
    if (modal.step === 'review' || modal.step === 'authorize') {
      try {
        const logId = modal.upgradeLogId;
        await cancelUpgrade(logId);
      } catch {
        // Best-effort cancel; ignore errors
      }
    }
    clearPoll();
    onClose();
  }

  // ── Copy to clipboard helper ─────────────────────────────────────────────

  function copyToClipboard(text: string) {
    void navigator.clipboard.writeText(text).then(() => {
      notifySuccess('Copied', 'Copied to clipboard.');
    });
  }

  // ── Backdrop click only closes in non-executing, non-simulating states ───

  function handleBackdropClick() {
    if (['executing', 'simulating'].includes(modal.step)) return;
    void handleCancel();
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="relative w-full max-w-2xl mx-4 bg-surface border border-hi rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-hi">
          <div>
            <h2 className="text-lg font-black tracking-tight">Upgrade Contract</h2>
            <p className="text-xs text-muted font-mono mt-0.5">{contract.name}</p>
          </div>
          {!['executing', 'simulating'].includes(modal.step) && (
            <button
              onClick={() => void handleCancel()}
              className="p-1.5 rounded-lg hover:bg-white/5 text-muted hover:text-text transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Step breadcrumb */}
        <div className="px-6 pt-4">
          <StepBreadcrumb current={currentStepIndex()} />
        </div>

        {/* Step content */}
        <div className="px-6 pb-6 max-h-[70vh] overflow-y-auto">
          {/* ── Step 1: INPUT ─────────────────────────────────────────── */}
          {modal.step === 'input' && (
            <div className="flex flex-col gap-5">
              {/* Current contract state */}
              <div className="p-4 bg-black/20 border border-hi rounded-xl">
                <p className={LABEL_CLASS}>Current Deployed WASM Hash</p>
                <p className="font-mono text-xs text-muted break-all leading-relaxed">
                  {contract.current_wasm_hash}
                </p>
                <div className="flex items-center gap-3 mt-3 text-xs text-muted">
                  <span>
                    Version: <span className="text-text font-bold">{contract.version}</span>
                  </span>
                  <span>·</span>
                  <span>
                    Network: <span className="text-text font-bold">{contract.network}</span>
                  </span>
                  {contract.last_upgraded_at && (
                    <>
                      <span>·</span>
                      <span>
                        Last upgraded:{' '}
                        <span className="text-text">
                          {new Date(contract.last_upgraded_at).toLocaleDateString()}
                        </span>
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* New WASM hash input */}
              <div>
                <label className={LABEL_CLASS}>New WASM Hash</label>
                <input
                  type="text"
                  value={modal.wasmHash}
                  onChange={(e) =>
                    setModal((m) =>
                      m.step === 'input'
                        ? {
                            ...m,
                            wasmHash: e.target.value.toLowerCase().trim(),
                            validationError: null,
                          }
                        : m
                    )
                  }
                  className={`${INPUT_CLASS} ${modal.validationError ? 'border-red-500/60' : ''}`}
                  placeholder="64-character hex SHA-256 of the new WASM bytecode"
                  spellCheck={false}
                  maxLength={64}
                  autoComplete="off"
                />
                {modal.validationError && (
                  <p className="mt-2 text-xs text-red-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {modal.validationError}
                  </p>
                )}
                <p className="mt-2 text-xs text-muted">
                  Upload the WASM bytecode first via{' '}
                  <code className="font-mono bg-black/30 px-1 rounded">
                    stellar contract upload
                  </code>{' '}
                  to obtain the hash.
                </p>
              </div>

              <button
                onClick={() => void handleValidateAndSimulate()}
                disabled={modal.validating || !modal.wasmHash.trim()}
                className="flex items-center justify-center gap-2 py-3.5 bg-accent/20 text-accent border border-accent/40 font-black rounded-xl hover:bg-accent hover:text-black transition-all uppercase tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {modal.validating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Validating…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" /> Validate & Simulate
                  </>
                )}
              </button>
            </div>
          )}

          {/* ── Step 2: SIMULATING ────────────────────────────────────── */}
          {modal.step === 'simulating' && (
            <div className="flex flex-col items-center justify-center py-12 gap-5">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-2 border-accent/20 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-accent animate-spin" />
                </div>
              </div>
              <div className="text-center">
                <p className="font-bold text-lg">Simulating Upgrade</p>
                <p className="text-sm text-muted mt-1">
                  Pre-flighting the transaction via Soroban RPC…
                </p>
              </div>
            </div>
          )}

          {/* ── Step 3: REVIEW ────────────────────────────────────────── */}
          {modal.step === 'review' && (
            <div className="flex flex-col gap-5">
              {/* Simulation status */}
              <div
                className={`flex items-start gap-3 p-4 rounded-xl border ${
                  modal.simulation.success
                    ? 'bg-emerald-500/5 border-emerald-500/30'
                    : 'bg-red-500/5 border-red-500/30'
                }`}
              >
                {modal.simulation.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <p
                    className={`font-bold text-sm ${modal.simulation.success ? 'text-emerald-400' : 'text-red-400'}`}
                  >
                    {modal.simulation.success ? 'Simulation Passed' : 'Simulation Failed'}
                  </p>
                  {modal.simulation.error && (
                    <p className="text-xs text-red-400 mt-0.5">{modal.simulation.error}</p>
                  )}
                </div>
              </div>

              {/* Warnings */}
              {modal.simulation.warnings.length > 0 && (
                <div className="flex flex-col gap-2">
                  {modal.simulation.warnings.map((w) => (
                    <div
                      key={w}
                      className="flex items-start gap-2 p-3 bg-yellow-500/5 border border-yellow-500/30 rounded-xl text-xs text-yellow-400"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      {w}
                    </div>
                  ))}
                </div>
              )}

              {/* Hash diff */}
              <HashDiff
                label="WASM Hash Change"
                oldHash={contract.current_wasm_hash}
                newHash={modal.wasmHash}
              />

              {/* Cost breakdown */}
              {modal.simulation.success && (
                <div className="p-4 bg-black/20 border border-hi rounded-xl">
                  <p className={LABEL_CLASS}>Estimated Cost</p>
                  <dl className="grid grid-cols-2 gap-3 mt-3 text-sm">
                    <div>
                      <dt className="text-muted text-xs">Network Fee</dt>
                      <dd className="font-bold font-mono">
                        {modal.simulation.estimatedFeeXlm} XLM
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted text-xs">CPU Instructions</dt>
                      <dd className="font-bold font-mono">
                        {modal.simulation.cpuInstructions === 'N/A'
                          ? 'N/A'
                          : Number(modal.simulation.cpuInstructions).toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted text-xs">Memory</dt>
                      <dd className="font-bold font-mono">
                        {modal.simulation.memoryBytes === 'N/A'
                          ? 'N/A'
                          : `${(Number(modal.simulation.memoryBytes) / 1024).toFixed(1)} KB`}
                      </dd>
                    </div>
                    {modal.simulation.latestLedger > 0 && (
                      <div>
                        <dt className="text-muted text-xs">Ledger</dt>
                        <dd className="font-bold font-mono">
                          #{modal.simulation.latestLedger.toLocaleString()}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => void handleCancel()}
                  className="flex-1 py-3 border border-hi rounded-xl text-sm font-bold text-muted hover:text-text hover:bg-white/5 transition-all uppercase tracking-widest"
                >
                  Cancel
                </button>
                {modal.simulation.success && (
                  <button
                    onClick={handleAcceptReview}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-accent/20 text-accent border border-accent/40 rounded-xl text-sm font-black hover:bg-accent hover:text-black transition-all uppercase tracking-widest"
                  >
                    Proceed <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Step 4: AUTHORIZE ─────────────────────────────────────── */}
          {modal.step === 'authorize' && (
            <div className="flex flex-col gap-5">
              {/* Irreversibility warning */}
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-bold text-red-400">This action is irreversible</p>
                  <p className="text-red-400/80 text-xs mt-1">
                    The contract will be upgraded on-chain immediately after signing. Ensure you
                    have thoroughly reviewed the new WASM and simulation results.
                  </p>
                </div>
              </div>

              {/* Compact diff reminder */}
              <div className="p-4 bg-black/20 border border-hi rounded-xl">
                <p className={LABEL_CLASS}>Upgrade Summary</p>
                <div className="flex flex-col gap-2 mt-2 text-xs font-mono">
                  <div className="flex gap-2">
                    <span className="text-muted w-12 shrink-0">From</span>
                    <span className="text-red-400 break-all">
                      {contract.current_wasm_hash.slice(0, 24)}…
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted w-12 shrink-0">To</span>
                    <span className="text-emerald-400 break-all">
                      {modal.wasmHash.slice(0, 24)}…
                    </span>
                  </div>
                </div>
              </div>

              {/* Admin secret key */}
              <div>
                <label className={LABEL_CLASS}>Admin Secret Key (S…)</label>
                <input
                  type="password"
                  value={modal.adminSecret}
                  onChange={(e) =>
                    setModal((m) =>
                      m.step === 'authorize' ? { ...m, adminSecret: e.target.value.trim() } : m
                    )
                  }
                  className={INPUT_CLASS}
                  placeholder="S..."
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="mt-1.5 text-xs text-muted">
                  Your secret key is used only to sign this transaction and is never stored.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => void handleCancel()}
                  className="flex-1 py-3 border border-hi rounded-xl text-sm font-bold text-muted hover:text-text hover:bg-white/5 transition-all uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleExecute()}
                  disabled={!modal.adminSecret.trim()}
                  className="flex-1 py-3 bg-red-500/20 text-red-400 border border-red-500/40 rounded-xl text-sm font-black hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Execute Upgrade
                </button>
              </div>
            </div>
          )}

          {/* ── Step 5: EXECUTING ─────────────────────────────────────── */}
          {modal.step === 'executing' && (
            <div className="flex flex-col gap-5">
              {/* Transaction info */}
              {modal.txHash && (
                <div className="p-4 bg-black/20 border border-hi rounded-xl">
                  <p className={LABEL_CLASS}>Transaction Hash</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono text-xs text-text break-all leading-relaxed">
                      {modal.txHash}
                    </code>
                    <button
                      onClick={() => copyToClipboard(modal.txHash!)}
                      className="p-1.5 hover:bg-white/5 rounded text-muted hover:text-text transition-colors shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Overall status badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-muted">
                  Status:
                </span>
                <span
                  className={`px-3 py-1 rounded text-xs font-black uppercase tracking-widest border ${
                    modal.overallStatus === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'
                      : modal.overallStatus === 'failed'
                        ? 'bg-red-500/20 text-red-500 border-red-500/30'
                        : 'bg-accent/20 text-accent border-accent/30'
                  }`}
                >
                  {modal.overallStatus}
                </span>
                {['executing', 'pending'].includes(modal.overallStatus) && (
                  <Loader2 className="w-4 h-4 text-accent animate-spin" />
                )}
              </div>

              {/* Migration steps */}
              <div className="border border-hi rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-hi bg-black/20">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted">
                    Post-Upgrade Migration
                  </p>
                </div>
                <div className="px-4 divide-y divide-hi/30">
                  {modal.migrationSteps.length === 0 ? (
                    <div className="flex items-center gap-2 py-4 text-muted text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Waiting for migration to start…
                    </div>
                  ) : (
                    modal.migrationSteps.map((s) => <MigrationStepRow key={s.id} step={s} />)
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 6a: DONE ─────────────────────────────────────────── */}
          {modal.step === 'done' && (
            <div className="flex flex-col items-center gap-5 py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <div className="text-center">
                <p className="text-xl font-black">Upgrade Complete</p>
                <p className="text-sm text-muted mt-1">
                  Contract and migration finished successfully.
                </p>
              </div>
              <div className="w-full p-4 bg-black/20 border border-hi rounded-xl">
                <p className={LABEL_CLASS}>Transaction Hash</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-xs break-all">{modal.txHash}</code>
                  <button
                    onClick={() => copyToClipboard(modal.txHash)}
                    className="p-1.5 hover:bg-white/5 rounded text-muted hover:text-text transition-colors shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-full py-3 bg-accent/20 text-accent border border-accent/40 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-accent hover:text-black transition-all"
              >
                Done
              </button>
            </div>
          )}

          {/* ── Step 6b: FAILED ───────────────────────────────────────── */}
          {modal.step === 'failed' && (
            <div className="flex flex-col items-center gap-5 py-8">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <div className="text-center">
                <p className="text-xl font-black">Upgrade Failed</p>
                <p className="text-sm text-muted mt-1">
                  The upgrade did not complete successfully.
                </p>
              </div>
              <div className="w-full p-4 bg-red-500/5 border border-red-500/30 rounded-xl">
                <p className="text-xs text-red-400 break-words">{modal.error}</p>
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 border border-hi rounded-xl text-sm font-bold text-muted hover:text-text hover:bg-white/5 transition-all uppercase tracking-widest"
                >
                  Close
                </button>
                <button
                  onClick={() =>
                    setModal({
                      step: 'input',
                      wasmHash: '',
                      validating: false,
                      validationError: null,
                    })
                  }
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-black/20 border border-hi rounded-xl text-sm font-bold hover:bg-white/5 transition-all uppercase tracking-widest"
                >
                  <RefreshCw className="w-4 h-4" /> Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
