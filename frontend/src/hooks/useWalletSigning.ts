import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWallet } from './useWallet';
import { useNotification } from './useNotification';
import { useNetworkStore } from '../stores/networkStore';
import { simulateTransaction } from '../services/transactionSimulation';
import { isWalletNetworkMismatch, mapSigningError } from '../utils/signingErrors';

/**
 * Convenience hook for signing Stellar transactions via the connected wallet.
 * Wraps the wallet context's signTransaction with loading and error state.
 *
 * Usage:
 *   const { sign, isSigning, error, isReady, isNetworkMismatch } = useWalletSigning();
 *   const signedXdr = await sign(transactionXdr);
 */
export function useWalletSigning() {
  const {
    signTransaction,
    address,
    requireWallet,
    isConnecting,
    network: walletNetwork,
  } = useWallet();
  const { network: appNetwork } = useNetworkStore();
  const { notifyError } = useNotification();
  const { t } = useTranslation();
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNetworkMismatch = Boolean(address && isWalletNetworkMismatch(appNetwork, walletNetwork));

  const sign = async (xdr: string, skipSimulation = false): Promise<string> => {
    setIsSigning(true);
    setError(null);
    try {
      const connectedAddress = await requireWallet();
      if (!connectedAddress) {
        throw new Error('Wallet not connected. Please connect and try again.');
      }

      if (isWalletNetworkMismatch(appNetwork, walletNetwork)) {
        throw new Error(
          `Network mismatch: wallet is on ${walletNetwork}, but app is set to ${appNetwork}.`
        );
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
      const { message } = mapSigningError(e, t);
      setError(message);
      notifyError(t('wallet.signingErrors.title', { defaultValue: 'Signing failed' }), message);
      throw e;
    } finally {
      setIsSigning(false);
    }
  };

  return {
    sign,
    isSigning,
    error,
    isNetworkMismatch,
    isReady: !!address && !isConnecting && !isNetworkMismatch,
  };
}
