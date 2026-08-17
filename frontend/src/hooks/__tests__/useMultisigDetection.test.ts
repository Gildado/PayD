import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { useMultisigDetection } from '../useMultisigDetection';
import {
  detectMultisig,
  type MultisigDetectionResult,
  type MultisigInfo,
} from '../../services/multisigDetection';

vi.mock('../../services/multisigDetection', () => ({
  detectMultisig: vi.fn(),
}));

const mockDetectMultisig = vi.mocked(detectMultisig);

describe('useMultisigDetection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useMultisigDetection());

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.info).toBeNull();
    expect(typeof result.current.detect).toBe('function');
    expect(typeof result.current.reset).toBe('function');
  });

  it('successfully detects a multi-sig account', async () => {
    const mockInfo: MultisigInfo = {
      accountId: 'G1234567890123456789012345678901234567890123456789012345',
      isMultisig: true,
      thresholds: { low: 1, med: 2, high: 3 },
      signers: [
        {
          key: 'G1234567890123456789012345678901234567890123456789012345',
          weight: 1,
          type: 'ed25519_public_key',
        },
        {
          key: 'G9876543210987654321098765432109876543210987654321098765',
          weight: 1,
          type: 'ed25519_public_key',
        },
      ],
      masterWeight: 1,
      requiredSignatureCount: 2,
      totalWeight: 2,
    };

    mockDetectMultisig.mockResolvedValueOnce({
      success: true,
      info: mockInfo,
      error: null,
    });

    const { result } = renderHook(() => useMultisigDetection());

    let detectPromise: Promise<void>;
    act(() => {
      detectPromise = result.current.detect(mockInfo.accountId);
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      await detectPromise;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.info).toEqual(mockInfo);
    expect(result.current.info?.isMultisig).toBe(true);
    expect(result.current.info?.requiredSignatureCount).toBe(2);
  });

  it('successfully detects a single-sig account', async () => {
    const mockInfo: MultisigInfo = {
      accountId: 'G1234567890123456789012345678901234567890123456789012345',
      isMultisig: false,
      thresholds: { low: 1, med: 1, high: 1 },
      signers: [
        {
          key: 'G1234567890123456789012345678901234567890123456789012345',
          weight: 1,
          type: 'ed25519_public_key',
        },
      ],
      masterWeight: 1,
      requiredSignatureCount: 1,
      totalWeight: 1,
    };

    mockDetectMultisig.mockResolvedValueOnce({
      success: true,
      info: mockInfo,
      error: null,
    });

    const { result } = renderHook(() => useMultisigDetection());

    await act(async () => {
      await result.current.detect(mockInfo.accountId);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.info?.isMultisig).toBe(false);
  });

  it('handles service failure with returned error message', async () => {
    mockDetectMultisig.mockResolvedValueOnce({
      success: false,
      info: null,
      error: 'Account not found on the Stellar network. It may not be funded yet.',
    });

    const { result } = renderHook(() => useMultisigDetection());

    await act(async () => {
      await result.current.detect('G_INVALID_OR_NOT_FOUND');
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.info).toBeNull();
    expect(result.current.error).toBe(
      'Account not found on the Stellar network. It may not be funded yet.'
    );
  });

  it('handles service failure with fallback error message when error is null', async () => {
    mockDetectMultisig.mockResolvedValueOnce({
      success: false,
      info: null,
      error: null,
    });

    const { result } = renderHook(() => useMultisigDetection());

    await act(async () => {
      await result.current.detect('G_SOMETHING');
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.info).toBeNull();
    expect(result.current.error).toBe('Detection failed.');
  });

  it('handles thrown Error instance during detection', async () => {
    mockDetectMultisig.mockRejectedValueOnce(new Error('Horizon server unreachable'));

    const { result } = renderHook(() => useMultisigDetection());

    await act(async () => {
      await result.current.detect('G1234567890123456789012345678901234567890123456789012345');
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.info).toBeNull();
    expect(result.current.error).toBe('Horizon server unreachable');
  });

  it('handles thrown non-Error values during detection', async () => {
    mockDetectMultisig.mockRejectedValueOnce('Critical network crash');

    const { result } = renderHook(() => useMultisigDetection());

    await act(async () => {
      await result.current.detect('G1234567890123456789012345678901234567890123456789012345');
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.info).toBeNull();
    expect(result.current.error).toBe('Unexpected error during detection.');
  });

  it('resets hook state when reset is called', async () => {
    mockDetectMultisig.mockResolvedValueOnce({
      success: false,
      info: null,
      error: 'Network failure',
    });

    const { result } = renderHook(() => useMultisigDetection());

    await act(async () => {
      await result.current.detect('G1234567890123456789012345678901234567890123456789012345');
    });

    expect(result.current.error).toBe('Network failure');

    act(() => {
      result.current.reset();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.info).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Property-based tests using fast-check
  // ---------------------------------------------------------------------------

  it('PBT 1: guarantees state invariants for arbitrary input strings', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(),
        fc.boolean(),
        fc.option(fc.string()),
        async (accountId, success, errorMessage) => {
          const mockResult: MultisigDetectionResult = success
            ? {
                success: true,
                info: {
                  accountId,
                  isMultisig: false,
                  thresholds: { low: 1, med: 1, high: 1 },
                  signers: [],
                  masterWeight: 1,
                  requiredSignatureCount: 1,
                  totalWeight: 1,
                },
                error: null,
              }
            : {
                success: false,
                info: null,
                error: errorMessage ?? null,
              };

          mockDetectMultisig.mockResolvedValueOnce(mockResult);

          const { result } = renderHook(() => useMultisigDetection());

          await act(async () => {
            await result.current.detect(accountId);
          });

          // Invariants:
          // 1. Loading is always false after completion
          expect(result.current.loading).toBe(false);
          // 2. Either info is set OR error is set, never both active
          if (result.current.info !== null) {
            expect(result.current.error).toBeNull();
          }
          if (result.current.error !== null) {
            expect(result.current.info).toBeNull();
          }
        }
      ),
      { numRuns: 25 }
    );
  });

  it('PBT 2: preserves multisig info structure and signature count invariants', async () => {
    const signerArb = fc.record({
      key: fc.stringMatching(/^G[A-Z0-9]{55}$/),
      weight: fc.nat({ max: 10 }),
      type: fc.constant('ed25519_public_key' as const),
    });

    const infoArb = fc.record({
      accountId: fc.stringMatching(/^G[A-Z0-9]{55}$/),
      isMultisig: fc.boolean(),
      thresholds: fc.record({
        low: fc.nat({ max: 10 }),
        med: fc.nat({ max: 10 }),
        high: fc.nat({ max: 10 }),
      }),
      signers: fc.array(signerArb, { minLength: 1, maxLength: 5 }),
      masterWeight: fc.nat({ max: 10 }),
      requiredSignatureCount: fc.nat({ max: 6 }),
      totalWeight: fc.nat({ max: 50 }),
    });

    await fc.assert(
      fc.asyncProperty(infoArb, async (generatedInfo) => {
        mockDetectMultisig.mockResolvedValueOnce({
          success: true,
          info: generatedInfo,
          error: null,
        });

        const { result } = renderHook(() => useMultisigDetection());

        await act(async () => {
          await result.current.detect(generatedInfo.accountId);
        });

        expect(result.current.info).toEqual(generatedInfo);
        expect(result.current.info?.signers.length).toBeGreaterThanOrEqual(1);
        expect(result.current.info?.totalWeight).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 25 }
    );
  });
});
