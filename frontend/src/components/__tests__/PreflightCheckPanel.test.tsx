import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PreflightCheckPanel } from '../PreflightCheckPanel';
import type { PreflightCheckResult } from '../../services/preflightCheck';

let mockHookData: {
  results: PreflightCheckResult[];
  isRunning: boolean;
  summary: { totalPassed: number; totalFailed: number; hasIssues: boolean; readyToSubmit: boolean };
  rerun: ReturnType<typeof vi.fn>;
};

vi.mock('../../hooks/usePreflightCheck', () => ({
  usePreflightCheck: () => mockHookData,
}));

function createMockResult(
  name: string,
  status: 'pass' | 'fail',
  issues: { type: string; message: string }[] = []
): PreflightCheckResult {
  return {
    employeeName: name,
    walletAddress: `G${name.toUpperCase()}1234567890`,
    issues,
    status,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHookData = {
    results: [],
    isRunning: false,
    summary: { totalPassed: 0, totalFailed: 0, hasIssues: false, readyToSubmit: false },
    rerun: vi.fn(),
  };
});

describe('PreflightCheckPanel', () => {
  it('renders nothing when batch is empty', () => {
    const { container } = render(<PreflightCheckPanel batch={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows loading state when checks are running', () => {
    mockHookData = {
      results: [],
      isRunning: true,
      summary: { totalPassed: 0, totalFailed: 0, hasIssues: false, readyToSubmit: false },
      rerun: vi.fn(),
    };
    render(<PreflightCheckPanel batch={[{ name: 'Alice', walletAddress: 'GA', amount: '100', currency: 'USDC' }]} />);
    expect(screen.getByText(/running preflight checks/i)).toBeInTheDocument();
  });

  it('shows ready to submit banner when all pass', () => {
    mockHookData = {
      results: [
        createMockResult('Alice', 'pass'),
        createMockResult('Bob', 'pass'),
      ],
      isRunning: false,
      summary: { totalPassed: 2, totalFailed: 0, hasIssues: false, readyToSubmit: true },
      rerun: vi.fn(),
    };
    render(<PreflightCheckPanel batch={[
      { name: 'Alice', walletAddress: 'GA', amount: '100', currency: 'USDC' },
      { name: 'Bob', walletAddress: 'GB', amount: '200', currency: 'XLM' },
    ]} />);
    expect(screen.getByText('Ready to Submit')).toBeInTheDocument();
    expect(screen.getByText(/2 passed, 0 failed/i)).toBeInTheDocument();
  });

  it('shows issues detected banner when checks fail', () => {
    mockHookData = {
      results: [
        createMockResult('Alice', 'pass'),
        createMockResult('Bob', 'fail', [
          { type: 'account_not_found', message: 'Account does not exist' },
        ]),
      ],
      isRunning: false,
      summary: { totalPassed: 1, totalFailed: 1, hasIssues: true, readyToSubmit: false },
      rerun: vi.fn(),
    };
    render(<PreflightCheckPanel batch={[
      { name: 'Alice', walletAddress: 'GA', amount: '100', currency: 'USDC' },
      { name: 'Bob', walletAddress: 'GB', amount: '200', currency: 'XLM' },
    ]} />);
    expect(screen.getByText('Issues Detected')).toBeInTheDocument();
    expect(screen.getByText(/1 passed, 1 failed/i)).toBeInTheDocument();
  });

  it('renders employee names in the table', () => {
    mockHookData = {
      results: [
        createMockResult('Alice', 'pass'),
        createMockResult('Bob', 'fail', [
          { type: 'no_trustline', message: 'No trustline for USDC' },
        ]),
      ],
      isRunning: false,
      summary: { totalPassed: 1, totalFailed: 1, hasIssues: true, readyToSubmit: false },
      rerun: vi.fn(),
    };
    render(<PreflightCheckPanel batch={[
      { name: 'Alice', walletAddress: 'GA', amount: '100', currency: 'USDC' },
      { name: 'Bob', walletAddress: 'GB', amount: '200', currency: 'XLM' },
    ]} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows failure reasons in the table', () => {
    mockHookData = {
      results: [
        createMockResult('Alice', 'fail', [
          { type: 'account_not_found', message: 'Account does not exist on the Stellar network' },
          { type: 'no_trustline', message: 'No trustline for USDC' },
        ]),
      ],
      isRunning: false,
      summary: { totalPassed: 0, totalFailed: 1, hasIssues: true, readyToSubmit: false },
      rerun: vi.fn(),
    };
    render(<PreflightCheckPanel batch={[
      { name: 'Alice', walletAddress: 'GA', amount: '100', currency: 'USDC' },
    ]} />);
    expect(screen.getByText('Account does not exist on the Stellar network')).toBeInTheDocument();
    expect(screen.getByText('No trustline for USDC')).toBeInTheDocument();
  });

  it('shows export button when there are failures', () => {
    mockHookData = {
      results: [
        createMockResult('Alice', 'fail', [
          { type: 'account_not_found', message: 'Account does not exist' },
        ]),
      ],
      isRunning: false,
      summary: { totalPassed: 0, totalFailed: 1, hasIssues: true, readyToSubmit: false },
      rerun: vi.fn(),
    };
    render(<PreflightCheckPanel batch={[
      { name: 'Alice', walletAddress: 'GA', amount: '100', currency: 'USDC' },
    ]} />);
    expect(screen.getByTitle(/download failure report/i)).toBeInTheDocument();
  });

  it('hides export button when all pass', () => {
    mockHookData = {
      results: [
        createMockResult('Alice', 'pass'),
      ],
      isRunning: false,
      summary: { totalPassed: 1, totalFailed: 0, hasIssues: false, readyToSubmit: true },
      rerun: vi.fn(),
    };
    render(<PreflightCheckPanel batch={[
      { name: 'Alice', walletAddress: 'GA', amount: '100', currency: 'USDC' },
    ]} />);
    expect(screen.queryByTitle(/download failure report/i)).not.toBeInTheDocument();
  });

  it('shows re-run button', () => {
    mockHookData = {
      results: [createMockResult('Alice', 'pass')],
      isRunning: false,
      summary: { totalPassed: 1, totalFailed: 0, hasIssues: false, readyToSubmit: true },
      rerun: vi.fn(),
    };
    render(<PreflightCheckPanel batch={[
      { name: 'Alice', walletAddress: 'GA', amount: '100', currency: 'USDC' },
    ]} />);
    expect(screen.getByTitle(/re-run preflight checks/i)).toBeInTheDocument();
  });
});
