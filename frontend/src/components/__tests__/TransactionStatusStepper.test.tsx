import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TransactionStatusStepper } from '../TransactionStatusStepper';

function stepStates(container: HTMLElement) {
  return Array.from(container.querySelectorAll('.tx-step')).map((li) =>
    li.getAttribute('data-state')
  );
}

describe('TransactionStatusStepper', () => {
  it('renders the three lifecycle stages as an ordered list', () => {
    render(<TransactionStatusStepper status="pending" />);
    const list = screen.getByRole('list', { name: 'Transaction progress' });
    expect(list.tagName).toBe('OL');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it.each([
    ['pending', ['current', 'upcoming', 'upcoming']],
    ['processing', ['complete', 'current', 'upcoming']],
    ['confirmed', ['complete', 'complete', 'complete']],
  ] as const)('maps %s to the right step states', (status, expected) => {
    const { container } = render(<TransactionStatusStepper status={status} />);
    expect(stepStates(container)).toEqual(expected);
  });

  it('marks only the live stage with aria-current="step"', () => {
    render(<TransactionStatusStepper status="processing" />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]).not.toHaveAttribute('aria-current');
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[2]).not.toHaveAttribute('aria-current');
  });

  it('pins a failure to the processing stage by default', () => {
    const { container } = render(<TransactionStatusStepper status="failed" />);
    expect(stepStates(container)).toEqual(['complete', 'error', 'upcoming']);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Transaction failed during the Processing stage.'
    );
  });

  it('can pin a failure to the pending stage (rejected in the wallet)', () => {
    const { container } = render(<TransactionStatusStepper status="failed" failedAt="pending" />);
    expect(stepStates(container)).toEqual(['error', 'upcoming', 'upcoming']);
    expect(screen.getByText('Stopped here')).toBeInTheDocument();
  });

  it('exposes each step state as text, not only colour', () => {
    render(<TransactionStatusStepper status="processing" />);
    expect(screen.getByText('(completed)', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('(in progress)', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('(not started)', { exact: false })).toBeInTheDocument();
  });

  it('announces transitions through a polite live region', () => {
    const { rerender } = render(<TransactionStatusStepper status="pending" />);
    const live = screen.getByRole('status');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveTextContent(/waiting for signature/i);

    rerender(<TransactionStatusStepper status="confirmed" />);
    expect(screen.getByRole('status')).toHaveTextContent(/confirmed on the stellar network/i);
  });

  it('omits its own live region when nested in another one', () => {
    render(<TransactionStatusStepper status="pending" announce={false} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('supports vertical orientation and a compact size', () => {
    const { container } = render(
      <TransactionStatusStepper status="pending" orientation="vertical" size="sm" />
    );
    const root = container.querySelector('.tx-stepper')!;
    expect(root).toHaveAttribute('data-orientation', 'vertical');
    expect(root).toHaveAttribute('data-size', 'sm');
  });
});
