import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TransactionSimulationPanel } from '../TransactionSimulationPanel';
import type { SimulationResult } from '../../services/transactionSimulation';

function makeResult(overrides: Partial<SimulationResult> = {}): SimulationResult {
  return {
    success: true,
    severity: 'success',
    title: 'Simulation Passed',
    description: 'The transaction was simulated successfully.',
    errors: [],
    envelopeXdr: 'AAAA',
    simulatedAt: new Date('2026-01-01T12:00:00Z'),
    ...overrides,
  };
}

describe('TransactionSimulationPanel', () => {
  it('renders nothing when there is no result, no error, and not simulating', () => {
    const { container } = render(<TransactionSimulationPanel result={null} isSimulating={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a loading state while simulating', () => {
    render(<TransactionSimulationPanel result={null} isSimulating={true} />);
    expect(screen.getByText(/simulating transaction/i)).toBeInTheDocument();
  });

  it('shows the process error state when simulation could not run at all', () => {
    render(
      <TransactionSimulationPanel
        result={null}
        isSimulating={false}
        processError="Could not reach the network"
      />
    );
    expect(screen.getByText('Simulation unavailable')).toBeInTheDocument();
    expect(screen.getByText('Could not reach the network')).toBeInTheDocument();
  });

  it('renders the success status and description for a passing simulation', () => {
    render(<TransactionSimulationPanel result={makeResult()} isSimulating={false} />);
    expect(screen.getByText('Simulation Passed')).toBeInTheDocument();
  });

  it('renders per-operation error diagnostics for a failing simulation', () => {
    const result = makeResult({
      success: false,
      severity: 'error',
      title: 'Transaction Would Fail',
      errors: [
        {
          code: 'op_underfunded',
          message: 'Underfunded operation',
          severity: 'error',
          operationIndex: 0,
        },
      ],
    });
    render(<TransactionSimulationPanel result={result} isSimulating={false} />);
    expect(screen.getByText('op_underfunded')).toBeInTheDocument();
    expect(screen.getByText('Underfunded operation')).toBeInTheDocument();
    expect(screen.getByText('OP#1')).toBeInTheDocument();
  });

  it('renders balance changes with debit/credit signs', () => {
    render(
      <TransactionSimulationPanel
        result={makeResult()}
        isSimulating={false}
        balanceChanges={[
          { label: 'You send', asset: 'USDC', amount: 100, direction: 'debit' },
          { label: 'Recipient receives', asset: 'NGN', amount: 155000, direction: 'credit' },
        ]}
      />
    );
    expect(screen.getByText('You send')).toBeInTheDocument();
    expect(screen.getByText(/−100 USDC/)).toBeInTheDocument();
    expect(screen.getByText(/\+155,000 NGN/)).toBeInTheDocument();
  });

  it('renders the payment route as ordered asset hops', () => {
    render(
      <TransactionSimulationPanel
        result={makeResult()}
        isSimulating={false}
        route={['USDC', 'XLM', 'NGN']}
      />
    );
    expect(screen.getByText('USDC')).toBeInTheDocument();
    expect(screen.getByText('XLM')).toBeInTheDocument();
    expect(screen.getByText('NGN')).toBeInTheDocument();
  });

  it('does not render a route section for a single-hop (direct) path', () => {
    render(
      <TransactionSimulationPanel result={makeResult()} isSimulating={false} route={['USDC']} />
    );
    expect(screen.queryByText('Payment route')).not.toBeInTheDocument();
  });

  it('renders fee estimate line items', () => {
    render(
      <TransactionSimulationPanel
        result={makeResult()}
        isSimulating={false}
        feeEstimate={[
          { label: 'Network base fee', value: '0.0000100 XLM' },
          { label: 'Path fee (est.)', value: '1.5000 NGN' },
        ]}
      />
    );
    expect(screen.getByText('Network base fee')).toBeInTheDocument();
    expect(screen.getByText('0.0000100 XLM')).toBeInTheDocument();
  });

  it('flags slippage above the warning threshold', () => {
    render(
      <TransactionSimulationPanel
        result={makeResult()}
        isSimulating={false}
        slippagePercent={2.5}
      />
    );
    expect(screen.getByText(/2\.50% — high/)).toBeInTheDocument();
  });

  it('does not flag slippage at or below the warning threshold', () => {
    render(
      <TransactionSimulationPanel
        result={makeResult()}
        isSimulating={false}
        slippagePercent={0.5}
      />
    );
    expect(screen.getByText('0.50%')).toBeInTheDocument();
  });

  it('respects a custom slippage warning threshold', () => {
    render(
      <TransactionSimulationPanel
        result={makeResult()}
        isSimulating={false}
        slippagePercent={3}
        slippageWarningThreshold={5}
      />
    );
    expect(screen.getByText('3.00%')).toBeInTheDocument();
  });

  it('calls onReset when the reset button is clicked', async () => {
    const onReset = () => {
      resetCalled = true;
    };
    let resetCalled = false;
    render(
      <TransactionSimulationPanel result={makeResult()} isSimulating={false} onReset={onReset} />
    );
    screen.getByText('Clear Simulation').click();
    expect(resetCalled).toBe(true);
  });

  it('renders resource fee breakdown for Soroban simulations and allows expanding', () => {
    const sorobanResult = makeResult({
      simulationType: 'soroban',
      resourceBreakdown: {
        cpuInstructions: 1635562,
        memoryBytes: 1295756,
        readOnlyLedgerEntries: 2,
        readWriteLedgerEntries: 1,
        totalLedgerEntries: 3,
        minResourceFee: 10476,
      },
    });

    render(<TransactionSimulationPanel result={sorobanResult} isSimulating={false} />);

    // Breakdown header should be present
    const breakdown = screen.getByTestId('resource-fee-breakdown');
    expect(breakdown).toBeInTheDocument();
    expect(screen.getByText(/Resource Fee Breakdown/i)).toBeInTheDocument();

    // Toggle button should be initially closed
    const toggleBtn = screen.getByTestId('resource-breakdown-toggle');
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('resource-breakdown-content')).not.toBeInTheDocument();

    // Click to expand
    toggleBtn.click();
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('resource-breakdown-content')).toBeInTheDocument();

    // Check CPU instructions
    expect(screen.getByText(/1,635,562 instructions/)).toBeInTheDocument();
    // Check Memory usage
    expect(screen.getByText(/1.24 MB/)).toBeInTheDocument();
    // Check Ledger Entries breakdown
    expect(screen.getByText(/3 entries \(2 read-only, 1 read-write\)/)).toBeInTheDocument();
    // Check Min resource fee
    expect(screen.getByText(/10,476 stroops/)).toBeInTheDocument();

    // Click again to collapse
    toggleBtn.click();
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('resource-breakdown-content')).not.toBeInTheDocument();
  });

  it('hides resource fee breakdown for classic payments', () => {
    const classicResult = makeResult({
      simulationType: 'classic',
      resourceBreakdown: undefined,
    });

    render(<TransactionSimulationPanel result={classicResult} isSimulating={false} />);

    expect(screen.queryByTestId('resource-fee-breakdown')).not.toBeInTheDocument();
    expect(screen.queryByText(/Resource Fee Breakdown/i)).not.toBeInTheDocument();
  });
});
