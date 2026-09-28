import { useEffect, useState, useRef, useCallback } from 'react';
import {
  StellarWalletsKit,
  WalletNetwork,
  FreighterModule,
  FREIGHTER_ID,
  xBullModule,
  LobstrModule,
  LOBSTR_ID,
} from '@creit.tech/stellar-wallets-kit';
import { useNotification } from './useNotification';

const LAST_WALLET_STORAGE_KEY = 'payd:last_wallet_name';
const SUPPORTED_MODAL_WALLETS = [FREIGHTER_ID, LOBSTR_ID] as const;

export type SelectableWallet = {
  id: string;
  name: string;
  icon?: string;
  isAvailable: boolean;
};

function hasAnyWalletExtension(): boolean {
  if (typeof window === 'undefined') return true;
  const extendedWindow = window as Window &
    typeof globalThis & {
      freighterApi?: unknown;
      xBullSDK?: unknown;
      lobstr?: unknown;
    };

  return Boolean(extendedWindow.freighterApi || extendedWindow.xBullSDK || extendedWindow.lobstr);
}

export function useWalletManager(connectionTimeoutMs: number = 15000) {
  const [address, setAddress] = useState<string | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [walletExtensionAvailable, setWalletExtensionAvailable] = useState(true);
  const [network, setNetwork] = useState<'TESTNET' | 'PUBLIC'>('TESTNET');
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletOptions, setWalletOptions] = useState<SelectableWallet[]>([]);
  const kitRef = useRef<StellarWalletsKit | null>(null);

  const { notifyWalletEvent } = useNotification();

  useEffect(() => {
    setWalletExtensionAvailable(hasAnyWalletExtension());

    const newKit = new StellarWalletsKit({
      network: network === 'TESTNET' ? WalletNetwork.TESTNET : WalletNetwork.PUBLIC,
      modules: [new FreighterModule(), new xBullModule(), new LobstrModule()],
    });
    kitRef.current = newKit;

    const attemptSilentReconnect = async () => {
      const lastWalletName = localStorage.getItem(LAST_WALLET_STORAGE_KEY);
      if (!lastWalletName) {
        setIsInitialized(true);
        return;
      }

      setWalletName(lastWalletName);
      setIsConnecting(true);

      try {
        newKit.setWallet(lastWalletName);

        let timeoutId: ReturnType<typeof setTimeout>;
        const timeoutPromise = new Promise<{ address: string }>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error('Silent reconnection timed out')),
            connectionTimeoutMs
          );
        });

        const account = await Promise.race([newKit.getAddress(), timeoutPromise]);
        clearTimeout(timeoutId!);

        if (account?.address) {
          setAddress(account.address);
          notifyWalletEvent(
            'reconnected',
            `${account.address.slice(0, 6)}...${account.address.slice(-4)} via ${lastWalletName}`
          );
        }
      } catch (error) {
        // Silent reconnection should not block app flow.
        console.warn('Silent reconnection failed or timed out:', error);
      } finally {
        setIsConnecting(false);
        setIsInitialized(true);
      }
    };

    void attemptSilentReconnect();
  }, [notifyWalletEvent, network, connectionTimeoutMs]);

  const loadWalletOptions = useCallback(async (): Promise<SelectableWallet[]> => {
    const kit = kitRef.current;
    if (!kit) return [];
    const supported = await kit.getSupportedWallets();
    const options = supported
      .filter((wallet) =>
        SUPPORTED_MODAL_WALLETS.includes(wallet.id as (typeof SUPPORTED_MODAL_WALLETS)[number])
      )
      .map((wallet) => ({
        id: wallet.id,
        name: wallet.name,
        icon: wallet.icon,
        isAvailable: wallet.isAvailable,
      }));
    setWalletOptions(options);
    setWalletExtensionAvailable(options.some((wallet) => wallet.isAvailable));
    return options;
  }, []);

  const connectWithWallet = useCallback(
    async (selectedWalletId: string): Promise<string | null> => {
      const kit = kitRef.current;
      if (!kit) return null;

      setIsConnecting(true);
      try {
        kit.setWallet(selectedWalletId);

        let timeoutId: ReturnType<typeof setTimeout>;
        const timeoutPromise = new Promise<{ address: string }>((_, reject) => {
          timeoutId = setTimeout(
            () =>
              reject(
                new Error(
                  'Wallet connection timed out after 15 seconds. Confirm the request in your wallet and try again.'
                )
              ),
            connectionTimeoutMs
          );
        });

        const { address: newAddress } = await Promise.race([kit.getAddress(), timeoutPromise]);
        clearTimeout(timeoutId!);

        setAddress(newAddress);
        setWalletName(selectedWalletId);
        localStorage.setItem(LAST_WALLET_STORAGE_KEY, selectedWalletId);
        notifyWalletEvent(
          'connected',
          `${newAddress.slice(0, 6)}...${newAddress.slice(-4)} via ${selectedWalletId}`
        );
        setWalletModalOpen(false); // Close on success
        return newAddress;
      } catch (error) {
        console.error('Failed to connect wallet:', error);
        notifyWalletEvent(
          'connection_failed',
          error instanceof Error ? error.message : 'Please try again.'
        );
        throw error;
      } finally {
        setIsConnecting(false);
      }
    },
    [notifyWalletEvent, connectionTimeoutMs]
  );

  const connect = useCallback(async (): Promise<string | null> => {
    const options = await loadWalletOptions();
    if (options.length === 0) {
      notifyWalletEvent('connection_failed', 'No supported wallet providers were found.');
      return null;
    }
    setWalletModalOpen(true);
    return null;
  }, [loadWalletOptions, notifyWalletEvent]);

  const requireWallet = useCallback(async (): Promise<string | null> => {
    if (address) return address;
    notifyWalletEvent('required', 'Connect your wallet to continue with this contract action.');
    return connect();
  }, [address, connect, notifyWalletEvent]);

  const disconnect = useCallback(() => {
    const kit = kitRef.current;
    if (kit) {
      void kit.disconnect();
    }
    setAddress(null);
    setWalletName(null);
    localStorage.removeItem(LAST_WALLET_STORAGE_KEY);
    notifyWalletEvent('disconnected');
  }, [notifyWalletEvent]);

  const signTransaction = useCallback(async (xdr: string) => {
    const kit = kitRef.current;
    if (!kit) throw new Error('Wallet kit not initialized');
    const result = await kit.signTransaction(xdr);
    return result.signedTxXdr;
  }, []);

  return {
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
    connectWithWallet,
  };
}
