import { useState } from 'react';
import { useWallet } from './useWallet';
import { useNotification } from './useNotification';
import { simulateTransaction } from '../services/transactionSimulation';
import { appendPartialSigningHint } from '../utils/signingErrors';

/**
 * Convenience hook for signing Stellar transactions via the connected wallet.
 * Wraps the wallet context's signTransaction with loading and error state.
 *
 * Usage:
 *   const { sign, isSigning, error, isReady } = useWalletSigning();
 *   const signedXdr = await sign(transactionXdr);
 */
export function useWalletSigning() {
  const { signTransaction, address, requireWallet, isConnecting } = useWallet();
  const { notifyError } = useNotification();
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sign = async (xdr: string, skipSimulation = false): Promise<string> => {
    setIsSigning(true);
    setError(null);
    try {
      const connectedAddress = await requireWallet();
      if (!connectedAddress) {
        throw new Error('Wallet not connected. Please connect and try again.');
      }

      if (!skipSimulation) {
        const simResult = await simulateTransaction({
          envelopeXdr: xdr,
        });
        if (!simResult.success) {
          throw new Error(simResult.description || 'Pre-flight simulation failed');
        }
      }

      const signedXdr = await signTransaction(xdr);
      return signedXdr;
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Signing failed';
      const message = appendPartialSigningHint(raw);
      setError(message);
      notifyError('Signing failed', message);
      throw e;
    } finally {
      setIsSigning(false);
    }
  };

  return { sign, isSigning, error, isReady: !!address && !isConnecting };
}
