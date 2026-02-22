import { useState } from "react";
import { useWallet } from "../providers/WalletProvider";

/**
 * Convenience hook for signing Stellar transactions via the connected wallet.
 * Wraps the wallet context's signTransaction with loading and error state.
 *
 * Usage:
 *   const { sign, isSigning, error, isReady } = useWalletSigning();
 *   const signedXdr = await sign(transactionXdr);
 */
export function useWalletSigning() {
  const { signTransaction, address } = useWallet();
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sign = async (xdr: string): Promise<string> => {
    setIsSigning(true);
    setError(null);
    try {
      const signedXdr = await signTransaction(xdr);
      return signedXdr;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Signing failed";
      setError(message);
      throw e;
    } finally {
      setIsSigning(false);
    }
  };

  return { sign, isSigning, error, isReady: !!address };
}
