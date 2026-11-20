/**
 * Independent tests for each upgrade-modal step component.
 * Steps are rendered on their own (no orchestrator / focus-trap shell) with
 * stub props, asserting behaviour, callbacks and DOM tab order.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ContractRecord, MigrationStep, UpgradeSimulationResult } from '../../services/contractUpgrade';
import type { ModalState } from '../../utils/upgradeModalMachine';
import InputStep from '../upgradeModal/InputStep';
import SimulatingStep from '../upgradeModal/SimulatingStep';
import ReviewStep from '../upgradeModal/ReviewStep';
import AuthorizeStep from '../upgradeModal/AuthorizeStep';
import ExecutingStep from '../upgradeModal/ExecutingStep';
import { DoneStep, FailedStep } from '../upgradeModal/TerminalSteps';
import { StepBreadcrumb, HashDiff, MigrationStepRow } from '../upgradeModal/Shared';

// Avoid CSS-module / framer-motion noise from the real panel.
vi.mock('../ContractErrorPanel', () => ({
  ContractErrorPanel: ({ title }: { title?: string }) => (
    <div data-testid="contract-error-panel">{title}</div>
  ),
}));

const HASH = 'a'.repeat(64);
const contract: ContractRecord = {
  id: 7,
  name: 'Payroll Core',
  description: null,
  network: 'testnet',
  contract_id: 'CABC123',
  current_wasm_hash: 'b'.repeat(64),
  version: '1.2.0',
  last_upgraded_at: '2026-01-02T00:00:00Z',
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
  warnings: ['Warning one'],
  error: null,
};
const migrationSteps: MigrationStep[] = [
  { id: '1', name: 'Migrate state', status: 'completed', message: null },
  { id: '2', name: 'Verify state', status: 'running', message: 'Working' },
];

/** Adds focusable sentinels so tab order through a step can be asserted. */
function WithSentinels({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <button type="button">before</button>
      {children}
      <button type="button">after</button>
    </div>
  );
}

let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => {
  user = userEvent.setup();
});

describe('upgrade modal step components', () => {
  describe('InputStep', () => {
    const inputState = (overrides: Partial<Extract<ModalState, { step: 'input' }>> = {}): Extract<ModalState, { step: 'input' }> => ({
      step: 'input',
      wasmHash: HASH,
      validating: false,
      validationError: null,
      ...overrides,
    });

    it('renders current contract state, input and validation error', () => {
      render(
        <InputStep
          contract={contract}
          state={inputState({ validationError: 'Bad hash' })}
          language="en"
          onWasmHashChange={vi.fn()}
          onValidateAndSimulate={vi.fn()}
        />
      );
      expect(screen.getByText('b'.repeat(64))).toBeInTheDocument();
      expect(screen.getByText('Bad hash')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/64-character hex/i)).toHaveValue(HASH);
    });

    it('forwards input changes and validate clicks', async () => {
      const onChange = vi.fn();
      const onValidate = vi.fn();
      render(
        <InputStep
          contract={contract}
          state={inputState()}
          language="en"
          onWasmHashChange={onChange}
          onValidateAndSimulate={onValidate}
        />
      );
      fireEvent.change(screen.getByPlaceholderText(/64-character hex/i), {
        target: { value: '  ABCD  ' },
      });
      expect(onChange).toHaveBeenCalledWith('  ABCD  ');
      await user.click(screen.getByRole('button', { name: /validate & simulate/i }));
      expect(onValidate).toHaveBeenCalledOnce();
    });

    it('disables the action while validating or when the hash is empty', () => {
      const { rerender } = render(
        <InputStep
          contract={contract}
          state={inputState({ validating: true })}
          language="en"
          onWasmHashChange={vi.fn()}
          onValidateAndSimulate={vi.fn()}
        />
      );
      expect(screen.getByRole('button', { name: /validating/i })).toBeDisabled();
      rerender(
        <InputStep
          contract={contract}
          state={inputState({ wasmHash: '' })}
          language="en"
          onWasmHashChange={vi.fn()}
          onValidateAndSimulate={vi.fn()}
        />
      );
      expect(screen.getByRole('button', { name: /validate & simulate/i })).toBeDisabled();
    });

    it('keeps tab order: input then action button', async () => {
      render(
        <WithSentinels>
          <InputStep
            contract={contract}
            state={inputState()}
            language="en"
            onWasmHashChange={vi.fn()}
            onValidateAndSimulate={vi.fn()}
          />
        </WithSentinels>
      );
      await user.tab();
      expect(screen.getByRole('button', { name: 'before' })).toHaveFocus();
      await user.tab();
      expect(screen.getByPlaceholderText(/64-character hex/i)).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: /validate & simulate/i })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
    });
  });

  describe('SimulatingStep', () => {
    it('shows the simulating copy and exposes no focusable elements', async () => {
      render(
        <WithSentinels>
          <SimulatingStep />
        </WithSentinels>
      );
      expect(screen.getByText('Simulating Upgrade')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /close|cancel/i })).not.toBeInTheDocument();
      await user.tab();
      expect(screen.getByRole('button', { name: 'before' })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
    });
  });

  describe('ReviewStep', () => {
    const reviewState = (success = true): Extract<ModalState, { step: 'review' }> => ({
      step: 'review',
      upgradeLogId: 7,
      simulation: { ...simulation, success },
      wasmHash: HASH,
    });

    it('shows diff, warnings, cost and fires cancel / proceed', async () => {
      const onCancel = vi.fn();
      const onAccept = vi.fn();
      render(
        <ReviewStep
          contract={contract}
          state={reviewState()}
          language="en"
          onCancel={onCancel}
          onAcceptReview={onAccept}
        />
      );
      expect(screen.getByText('Simulation Passed')).toBeInTheDocument();
      expect(screen.getAllByText('b'.repeat(64)).length).toBeGreaterThan(0);
      expect(screen.getByText('Warning one')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /^cancel$/i }));
      expect(onCancel).toHaveBeenCalledOnce();
      await user.click(screen.getByRole('button', { name: /proceed/i }));
      expect(onAccept).toHaveBeenCalledOnce();
    });

    it('hides Proceed when the simulation failed', () => {
      render(
        <ReviewStep
          contract={contract}
          state={reviewState(false)}
          language="en"
          onCancel={vi.fn()}
          onAcceptReview={vi.fn()}
        />
      );
      expect(screen.getByText('Simulation Failed')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /proceed/i })).not.toBeInTheDocument();
    });

    it('keeps tab order: cancel then proceed', async () => {
      render(
        <WithSentinels>
          <ReviewStep
            contract={contract}
            state={reviewState()}
            language="en"
            onCancel={vi.fn()}
            onAcceptReview={vi.fn()}
          />
        </WithSentinels>
      );
      await user.tab();
      expect(screen.getByRole('button', { name: 'before' })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: /^cancel$/i })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: /proceed/i })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
    });
  });

  describe('AuthorizeStep', () => {
    const authorizeState = (secret: string): Extract<ModalState, { step: 'authorize' }> => ({
      step: 'authorize',
      upgradeLogId: 7,
      wasmHash: HASH,
      adminSecret: secret,
    });

    it('forwards secret changes, cancel and execute', async () => {
      const onSecret = vi.fn();
      const onCancel = vi.fn();
      const onExecute = vi.fn();
      render(
        <AuthorizeStep
          contract={contract}
          state={authorizeState('Ssecret')}
          onSecretChange={onSecret}
          onCancel={onCancel}
          onExecute={onExecute}
        />
      );
      fireEvent.change(screen.getByPlaceholderText('S...'), { target: { value: 'Snew' } });
      expect(onSecret).toHaveBeenCalledWith('Snew');
      await user.click(screen.getByRole('button', { name: /^cancel$/i }));
      expect(onCancel).toHaveBeenCalledOnce();
      await user.click(screen.getByRole('button', { name: /execute upgrade/i }));
      expect(onExecute).toHaveBeenCalledOnce();
    });

    it('disables Execute with an empty secret and preserves tab order', async () => {
      const { rerender } = render(
        <WithSentinels>
          <AuthorizeStep
            contract={contract}
            state={authorizeState('')}
            onSecretChange={vi.fn()}
            onCancel={vi.fn()}
            onExecute={vi.fn()}
          />
        </WithSentinels>
      );
      expect(screen.getByRole('button', { name: /execute upgrade/i })).toBeDisabled();
      rerender(
        <WithSentinels>
          <AuthorizeStep
            contract={contract}
            state={authorizeState('Ssecret')}
            onSecretChange={vi.fn()}
            onCancel={vi.fn()}
            onExecute={vi.fn()}
          />
        </WithSentinels>
      );
      await user.tab(); // before
      await user.tab(); // password input
      expect(document.activeElement).toHaveAttribute('type', 'password');
      await user.tab();
      expect(screen.getByRole('button', { name: /^cancel$/i })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: /execute upgrade/i })).toHaveFocus();
    });
  });

  describe('ExecutingStep', () => {
    const executingState = (): Extract<ModalState, { step: 'executing' }> => ({
      step: 'executing',
      upgradeLogId: 7,
      txHash: 'tx123',
      migrationSteps,
      overallStatus: 'executing',
    });

    it('renders progress, transaction info, status and migration rows', async () => {
      const onCopy = vi.fn();
      render(
        <ExecutingStep contract={contract} state={executingState()} onCopyTxHash={onCopy} />
      );
      expect(screen.getByText('tx123')).toBeInTheDocument();
      expect(screen.getByText('1/2 (50%)')).toBeInTheDocument();
      expect(screen.getByText('Migrate state')).toBeInTheDocument();
      expect(screen.getByText('Verify state')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /copy transaction hash/i }));
      expect(onCopy).toHaveBeenCalledWith('tx123');
    });

    it('keeps tab order: explorer link then copy button', async () => {
      render(
        <WithSentinels>
          <ExecutingStep contract={contract} state={executingState()} onCopyTxHash={vi.fn()} />
        </WithSentinels>
      );
      await user.tab(); // before
      await user.tab();
      expect(screen.getByRole('link', { name: /view on stellar expert/i })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: /copy transaction hash/i })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
    });

    it('shows the initializing state when there are no migration steps', () => {
      const state: Extract<ModalState, { step: 'executing' }> = {
        ...executingState(),
        migrationSteps: [],
        txHash: null,
      };
      render(<ExecutingStep contract={contract} state={state} onCopyTxHash={vi.fn()} />);
      expect(screen.getByText('Initializing…')).toBeInTheDocument();
      expect(screen.getByText(/waiting for migration to start/i)).toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });

  describe('TerminalSteps', () => {
    it('DoneStep shows the tx hash and fires close / copy in tab order', async () => {
      const onClose = vi.fn();
      const onCopy = vi.fn();
      const state: Extract<ModalState, { step: 'done' }> = {
        step: 'done',
        txHash: 'tx999',
        wasmHash: HASH,
      };
      render(
        <WithSentinels>
          <DoneStep
            contract={contract}
            state={state}
            onClose={onClose}
            onCopyTxHash={onCopy}
          />
        </WithSentinels>
      );
      expect(screen.getByText('tx999')).toBeInTheDocument();
      await user.tab(); // before
      await user.tab();
      expect(screen.getByRole('link', { name: /view on stellar expert/i })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: /copy transaction hash/i })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: /^done$/i })).toHaveFocus();
      await user.click(screen.getByRole('button', { name: /copy transaction hash/i }));
      expect(onCopy).toHaveBeenCalledWith('tx999');
      await user.click(screen.getByRole('button', { name: /^done$/i }));
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('FailedStep renders the parsed error panel and fires close / retry in tab order', async () => {
      const onClose = vi.fn();
      const onTryAgain = vi.fn();
      const state: Extract<ModalState, { step: 'failed' }> = { step: 'failed', error: 'boom' };
      render(
        <WithSentinels>
          <FailedStep state={state} onClose={onClose} onTryAgain={onTryAgain} />
        </WithSentinels>
      );
      expect(screen.getByTestId('contract-error-panel')).toBeInTheDocument();
      await user.tab(); // before
      await user.tab();
      expect(screen.getByRole('button', { name: /^close$/i })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: /try again/i })).toHaveFocus();
      await user.click(screen.getByRole('button', { name: /try again/i }));
      expect(onTryAgain).toHaveBeenCalledOnce();
      await user.click(screen.getByRole('button', { name: /^close$/i }));
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  describe('Shared', () => {
    it('StepBreadcrumb marks completed/current steps', () => {
      render(<StepBreadcrumb current={3} />);
      expect(screen.getByText('✓ Input')).toBeInTheDocument();
      expect(screen.getByText('✓ Simulate')).toBeInTheDocument();
      expect(screen.getByText('3. Review')).toBeInTheDocument();
      expect(screen.getByText('4. Authorize')).toBeInTheDocument();
    });

    it('HashDiff shows old and new hashes', () => {
      render(<HashDiff label="Hash change" oldHash="old" newHash="new" />);
      expect(screen.getByText('old')).toBeInTheDocument();
      expect(screen.getByText('new')).toBeInTheDocument();
    });

    it('MigrationStepRow shows name and message', () => {
      render(<MigrationStepRow step={migrationSteps[1]} />);
      expect(screen.getByText('Verify state')).toBeInTheDocument();
      expect(screen.getByText('Working')).toBeInTheDocument();
    });
  });
});
