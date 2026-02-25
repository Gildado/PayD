import React, { useEffect, useState, useRef } from 'react';
import {
  StellarWalletsKit,
  FreighterModule,
  xBullModule,
  LobstrModule,
} from '@creit.tech/stellar-wallets-kit';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../hooks/useNotification';
import { WalletContext } from '../hooks/useWallet';
import { useNetwork } from '../hooks/useNetwork';

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const kitRef = useRef<StellarWalletsKit | null>(null);
  const { t } = useTranslation();
  const { notify, notifySuccess, notifyError } = useNotification();
  const { config } = useNetwork();

  useEffect(() => {
    // Disconnect any previously connected wallet when the network changes
    setAddress(null);
    setWalletName(null);

    const newKit = new StellarWalletsKit({
      network: config.walletNetwork,
      modules: [new FreighterModule(), new xBullModule(), new LobstrModule()],
    });
    kitRef.current = newKit;
  }, [config.walletNetwork]);

  const connect = async () => {
    const kit = kitRef.current;
    if (!kit) return;

    setIsConnecting(true);
    try {
      await kit.openModal({
        modalTitle: t('wallet.modalTitle'),
        onWalletSelected: (option) => {
          void (async () => {
            const { address } = await kit.getAddress();
            setAddress(address);
            setWalletName(option.id);
            notifySuccess(
              'Wallet connected',
              `${address.slice(0, 6)}...${address.slice(-4)} via ${option.id}`
            );
          })();
        },
        onClosed: () => {
          setIsConnecting(false);
        },
      });
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      notifyError(
        'Wallet connection failed',
        error instanceof Error ? error.message : 'Please try again.'
      );
    }
  };

  const disconnect = () => {
    setAddress(null);
    setWalletName(null);
    notify('Wallet disconnected');
  };

  const signTransaction = async (xdr: string) => {
    const kit = kitRef.current;
    if (!kit) throw new Error('Wallet kit not initialized');
    const result = await kit.signTransaction(xdr);
    return result.signedTxXdr;
  };

  return (
    <WalletContext
      value={{
        address,
        walletName,
        isConnecting,
        connect,
        disconnect,
        signTransaction,
      }}
    >
      {children}
    </WalletContext>
  );
};
