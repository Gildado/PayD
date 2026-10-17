import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { WalletContext } from '../hooks/useWallet';
import { useWalletManager } from '../hooks/useWalletManager';
import { WalletConnectModal } from '../components/WalletConnectModal';

export const WalletProvider: React.FC<{
  children: React.ReactNode;
  connectionTimeoutMs?: number;
}> = ({ children, connectionTimeoutMs }) => {
  const { t } = useTranslation();

  const {
    address,
    walletName,
    walletDisplayName,
    status,
    network,
    setNetwork,
    isConnecting,
    isInitialized,
    walletExtensionAvailable,
    connect,
    requireWallet,
    switchWallet,
    disconnect,
    signTransaction,
    walletModalOpen,
    walletModalMode,
    closeWalletModal,
    walletOptions,
    connectWithWallet,
    connectingWalletId,
    connectionError,
  } = useWalletManager(connectionTimeoutMs);

  const handleSelect = (walletId: string) => {
    // Failures are surfaced through `connectionError` inside the dialog.
    connectWithWallet(walletId).catch(() => undefined);
  };

  return (
    <>
      {!walletExtensionAvailable && (
        <div className="wallet-banner" role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{t('wallet.noExtensionBanner')}</span>
        </div>
      )}

      <WalletConnectModal
        open={walletModalOpen}
        mode={walletModalMode}
        options={walletOptions}
        connectingWalletId={connectingWalletId}
        currentWalletId={walletName}
        currentAddress={address}
        error={connectionError}
        onSelect={handleSelect}
        onClose={closeWalletModal}
      />

      <WalletContext
        value={{
          address,
          walletName,
          walletDisplayName,
          status,
          network,
          setNetwork,
          isConnecting,
          isInitialized,
          walletExtensionAvailable,
          connect,
          requireWallet,
          switchWallet,
          disconnect,
          signTransaction,
        }}
      >
        {isInitialized ? (
          children
        ) : (
          <div className="wallet-restoring" role="status">
            <Loader2 size={16} className="wallet-spin" aria-hidden="true" />
            {t('wallet.restoring')}
          </div>
        )}
      </WalletContext>
    </>
  );
};
