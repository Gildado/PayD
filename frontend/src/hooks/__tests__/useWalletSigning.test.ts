import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWalletSigning } from '../useWalletSigning';
import { simulateTransaction } from '../../services/transactionSimulation';

const mockRequireWallet = vi.fn();
const mockSignTransaction = vi.fn();
const mockNotifyError = vi.fn();

vi.mock('../useWallet', () => ({
  useWallet: () => ({
    signTransaction: mockSignTransaction,
    address: 'GABCDTESTWALLETADDRESS1234567890',
    requireWallet: mockRequireWallet,
    isConnecting: false,
  }),
}));

vi.mock('../useNotification', () => ({
  useNotification: () => ({
    notifyError: mockNotifyError,
  }),
}));

vi.mock('../../services/transactionSimulation', () => ({
  simulateTransaction: vi.fn(),
}));

describe('useWalletSigning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireWallet.mockResolvedValue('GABCDTESTWALLETADDRESS1234567890');
    mockSignTransaction.mockResolvedValue('SIGNED_XDR');
    vi.mocked(simulateTransaction).mockResolvedValue({
      success: true,
      severity: 'success',
      title: 'Simulation Passed',
      description: 'ok',
      errors: [],
      envelopeXdr: 'XDR',
      simulatedAt: new Date(),
    });
  });

  it('simulates transaction before requesting wallet signature', async () => {
    const { result } = renderHook(() => useWalletSigning());

    let signedXdr = '';
    await act(async () => {
      signedXdr = await result.current.sign('TEST_XDR');
    });

    expect(signedXdr).toBe('SIGNED_XDR');
    expect(simulateTransaction).toHaveBeenCalledWith({ envelopeXdr: 'TEST_XDR' });
    expect(mockSignTransaction).toHaveBeenCalledWith('TEST_XDR');
    expect(vi.mocked(simulateTransaction).mock.invocationCallOrder[0]).toBeLessThan(
      mockSignTransaction.mock.invocationCallOrder[0]
    );
  });

  it('blocks wallet signing when preflight simulation fails', async () => {
    vi.mocked(simulateTransaction).mockResolvedValueOnce({
      success: false,
      severity: 'error',
      title: 'Transaction Would Fail',
      description: 'Insufficient balance',
      errors: [],
      envelopeXdr: 'TEST_XDR',
      simulatedAt: new Date(),
    });

    const { result } = renderHook(() => useWalletSigning());

    let caughtError: unknown;
    await act(async () => {
      try {
        await result.current.sign('TEST_XDR');
      } catch (error) {
        caughtError = error;
      }
    });

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe('Insufficient balance');
    expect(mockSignTransaction).not.toHaveBeenCalled();
    expect(mockNotifyError).toHaveBeenCalledWith('Signing failed', 'Insufficient balance');
  });

  it('allows skipping simulation when explicitly requested', async () => {
    const { result } = renderHook(() => useWalletSigning());

    await act(async () => {
      await result.current.sign('TEST_XDR', true);
    });

    expect(simulateTransaction).not.toHaveBeenCalled();
    expect(mockSignTransaction).toHaveBeenCalledWith('TEST_XDR');
  });
});
