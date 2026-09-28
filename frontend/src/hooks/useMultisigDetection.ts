import { useCallback, useState } from 'react';
import { detectMultisig, type MultisigInfo } from '../services/multisigDetection';

/**
 * Hook for detecting on-chain multisig configuration of a Stellar account.
 *
 * Returns the detection state plus a `detect` function that can be called
 * imperatively (e.g. on button press or when an account address changes).
 *
 * Issue: https://github.com/Gildado/PayD/issues/171
 */
export function useMultisigDetection() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<MultisigInfo | null>(null);

  const detect = useCallback(async (accountId: string) => {
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const result = await detectMultisig(accountId);
      if (result.success && result.info) {
        setInfo(result.info);
      } else {
        setError(result.error ?? 'Detection failed.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error during detection.');
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setInfo(null);
    setError(null);
    setLoading(false);
  }, []);

  return { detect, reset, loading, error, info };
}
