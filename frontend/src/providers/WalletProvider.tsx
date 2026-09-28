import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WalletContext } from '../hooks/useWallet';
import { useWalletManager } from '../hooks/useWalletManager';

export const WalletProvider: React.FC<{
  children: React.ReactNode;
  connectionTimeoutMs?: number;
}> = ({ children, connectionTimeoutMs }) => {
  const { t } = useTranslation();
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const {
    address,
    walletName,
    network,
    setNetwork,
    isConnecting,
    isInitialized,
    walletExtensionAvailable,
    connect,
    requireWallet,
    disconnect,
    signTransaction,
    walletModalOpen,
    setWalletModalOpen,
    walletOptions,
    connectWithWallet: baseConnectWithWallet,
  } = useWalletManager(connectionTimeoutMs);

  const connectWithWallet = async (selectedWalletId: string): Promise<string | null> => {
    setConnectionError(null);
    try {
      const result = await baseConnectWithWallet(selectedWalletId);
      if (result === null) {
        setConnectionError('Unable to connect to the selected wallet. Please try again.');
      }
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      setConnectionError(errorMessage);
      return null;
    }
  };

  return (
    <>
      {!walletExtensionAvailable && (
        <div className="sticky top-0 z-50 w-full border-b border-amber-600/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          Wallet extension not detected. Install Freighter, xBull, or Lobstr to sign transactions.
        </div>
      )}

      {walletModalOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 px-4">
          <div
            className="w-full max-w-md rounded-2xl border border-hi bg-surface p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-modal-title"
            aria-describedby={connectionError ? 'wallet-connection-error' : undefined}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 id="wallet-modal-title" className="text-lg font-black">
                {t('wallet.modalTitle') || 'Select a wallet'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setWalletModalOpen(false);
                  setConnectionError(null);
                }}
                className="rounded-lg border border-hi px-2 py-1 text-xs text-muted hover:text-text"
              >
                Close
              </button>
            </div>
            {connectionError && (
              <div
                id="wallet-connection-error"
                role="alert"
                aria-live="assertive"
                className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
              >
                {connectionError}
              </div>
            )}
            <div className="space-y-2">
              {walletOptions.map((wallet) => (
                <button
                  key={wallet.id}
                  type="button"
                  onClick={() => void connectWithWallet(wallet.id)}
                  disabled={!wallet.isAvailable || isConnecting}
                  className="flex w-full items-center justify-between rounded-xl border border-hi bg-black/20 px-4 py-3 text-left transition hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    {wallet.icon ? (
                      <img
                        src={wallet.icon}
                        alt={wallet.name}
                        loading="lazy"
                        className="h-6 w-6 rounded"
                      />
                    ) : (
                      <div className="h-6 w-6 rounded bg-white/10" />
                    )}
                    <div>
                      <p className="text-sm font-bold">{wallet.name}</p>
                      <p className="text-[11px] text-muted">
                        {wallet.isAvailable ? 'Detected on this device' : 'Not available'}
                      </p>
                    </div>
                  </div>
                  {isConnecting && <span className="text-xs text-muted">Connecting…</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <WalletContext
        value={{
          address,
          walletName,
          network,
          setNetwork,
          isConnecting,
          isInitialized,
          walletExtensionAvailable,
          connect,
          requireWallet,
          disconnect,
          signTransaction,
        }}
      >
        {isInitialized ? (
          children
        ) : (
          <div className="w-full px-4 py-3 text-xs text-zinc-400">Restoring wallet session...</div>
        )}
      </WalletContext>
    </>
  );
};
