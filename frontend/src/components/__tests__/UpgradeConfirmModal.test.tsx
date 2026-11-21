/**
 * Orchestrator tests for UpgradeConfirmModal.
 *
 * Verifies that the shell's DOM order is preserved: focus starts on the
 * header Close button, tab order follows header → body, Escape dismisses on
 * the input step, and Escape is ignored while simulating.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ContractRecord, UpgradeSimulationResult } from '../../services/contractUpgrade';
import UpgradeConfirmModal from '../UpgradeConfirmModal';

const HASH = 'a'.repeat(64);

const mocks = vi.hoisted(() => ({
  validateWasmHash: vi.fn(),
  simulateUpgrade: vi.fn(),
  executeUpgrade: vi.fn(),
  fetchUpgradeStatus: vi.fn(),
  cancelUpgrade: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock('../../services/contractUpgrade', () => ({
  validateWasmHash: mocks.validateWasmHash,
  simulateUpgrade: mocks.simulateUpgrade,
  executeUpgrade: mocks.executeUpgrade,
  fetchUpgradeStatus: mocks.fetchUpgradeStatus,
  cancelUpgrade: mocks.cancelUpgrade,
}));

vi.mock('../../hooks/useNotification', () => ({
  useNotification: () => ({
    notifySuccess: mocks.notifySuccess,
    notifyError: mocks.notifyError,
  }),
}));

vi.mock('../ContractErrorPanel', () => ({
  ContractErrorPanel: ({ title }: { title?: string }) => (
    <div data-testid="contract-error-panel">{title}</div>
  ),
}));

const contract: ContractRecord = {
  id: 7,
  name: 'Payroll Core',
  description: null,
  network: 'testnet',
  contract_id: 'CABC123',
  current_wasm_hash: 'b'.repeat(64),
  version: '1.2.0',
  last_upgraded_at: null,
  last_upgraded_by: null,
  created_at: '2025-01-01T00:00:00Z',
};
const simulation: UpgradeSimulationResult = {
  success: true,
  estimatedFee: '100',
  estimatedFeeXlm: '0.0000100',
  cpuInstructions: '1234',
  memoryBytes: '2048',
  latestLedger: 42,
  transactionData: null,
  warnings: [],
  error: null,
};

function renderModal(props: Partial<React.ComponentProps<typeof UpgradeConfirmModal>> = {}) {
  const onClose = vi.fn();
  const onUpgradeComplete = vi.fn();
  const result = render(
    <UpgradeConfirmModal
      contract={contract}
      adminAddress="GADMIN"
      onClose={onClose}
      onUpgradeComplete={onUpgradeComplete}
      {...props}
    />
  );
  return { ...result, onClose, onUpgradeComplete };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.validateWasmHash.mockResolvedValue({ valid: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('UpgradeConfirmModal', () => {
  it('renders the dialog shell with header, breadcrumb and input step in order', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'upgrade-modal-title');
    expect(within(dialog).getByRole('heading', { name: 'Upgrade Contract' })).toBeInTheDocument();
    expect(screen.getByText('1. Input')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/64-character hex/i)).toBeInTheDocument();
  });

  it('sets initial DOM focus on the Close button and preserves tab order', async () => {
    const user = userEvent.setup();
    renderModal();
    const dialog = screen.getByRole('dialog');
    const close = within(dialog).getByRole('button', { name: /^close$/i });
    expect(close).toHaveFocus();

    // Populate the hash so the Validate action becomes focusable.
    fireEvent.change(screen.getByPlaceholderText(/64-character hex/i), {
      target: { value: HASH },
    });
    await user.tab();
    expect(screen.getByPlaceholderText(/64-character hex/i)).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: /validate & simulate/i })).toHaveFocus();
  });

  it('closes on Escape during the input step', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    expect(screen.getByRole('button', { name: /^close$/i })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('ignores Escape while simulating and hides the Close button', async () => {
    const user = userEvent.setup();
    // Never resolves: the modal stays on the simulating step.
    mocks.simulateUpgrade.mockImplementation(() => new Promise(() => {}));
    const { onClose } = renderModal();

    fireEvent.change(screen.getByPlaceholderText(/64-character hex/i), {
      target: { value: HASH },
    });
    await user.click(screen.getByRole('button', { name: /validate & simulate/i }));
    expect(await screen.findByText('Simulating Upgrade')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /^close$/i })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    expect(mocks.cancelUpgrade).not.toHaveBeenCalled();
  });

  it('shows client-side format errors without calling the service', async () => {
    const user = userEvent.setup();
    renderModal();
    // The action is disabled while the field is empty, so a malformed
    // (but non-empty) hash is the reachable client-side validation path.
    fireEvent.change(screen.getByPlaceholderText(/64-character hex/i), {
      target: { value: 'abc' },
    });
    await user.click(screen.getByRole('button', { name: /validate & simulate/i }));
    expect(screen.getByText(/exactly 64 lowercase hex/i)).toBeInTheDocument();
    expect(mocks.validateWasmHash).not.toHaveBeenCalled();
  });

  it('enters the failed step when simulation rejects', async () => {
    const user = userEvent.setup();
    mocks.simulateUpgrade.mockRejectedValue(new Error('rpc down'));
    renderModal();
    fireEvent.change(screen.getByPlaceholderText(/64-character hex/i), {
      target: { value: HASH },
    });
    await user.click(screen.getByRole('button', { name: /validate & simulate/i }));
    expect(await screen.findByText('Upgrade Failed')).toBeInTheDocument();
    expect(screen.getByTestId('contract-error-panel')).toBeInTheDocument();
  });

  it('runs the full flow through polling to the done step', async () => {
    mocks.simulateUpgrade.mockResolvedValue({ upgradeLogId: 7, simulation, message: 'ok' });
    mocks.executeUpgrade.mockResolvedValue({ upgradeLogId: 7, txHash: 'tx1', status: 'ok', message: 'ok' });
    mocks.fetchUpgradeStatus.mockResolvedValue({ tx_hash: 'tx1', migration_steps: [], status: 'completed' });

    // Capture the polling interval callback so the test can trigger it
    // without waiting 3 real seconds.
    let poll: (() => void) | undefined;
    const setIntervalSpy = vi
      .spyOn(globalThis, 'setInterval')
      .mockImplementation(((cb: () => void) => {
        poll = cb;
        return 1 as unknown as ReturnType<typeof setInterval>;
      }) as typeof setInterval);
    vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => {});

    const { onUpgradeComplete } = renderModal();
    fireEvent.change(screen.getByPlaceholderText(/64-character hex/i), {
      target: { value: HASH },
    });
    await userEvent.setup().click(screen.getByRole('button', { name: /validate & simulate/i }));
    await screen.findByText('Simulation Passed');
    await userEvent.setup().click(screen.getByRole('button', { name: /proceed/i }));

    fireEvent.change(screen.getByPlaceholderText('S...'), { target: { value: 'Ssecret' } });
    await userEvent.setup().click(screen.getByRole('button', { name: /execute upgrade/i }));

    // Snapshot the callback immediately: waitFor (used by findByText) also
    // calls setInterval and would otherwise overwrite `poll`.
    const componentPoll = poll;
    expect(componentPoll).toBeDefined();
    expect(await screen.findByText('Migration Progress')).toBeInTheDocument();

    await act(async () => {
      componentPoll!();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(await screen.findByText('Upgrade Complete')).toBeInTheDocument();
    expect(onUpgradeComplete).toHaveBeenCalledWith(HASH);
    expect(mocks.notifySuccess).toHaveBeenCalled();
    expect(setIntervalSpy).toHaveBeenCalled();
  });
});
