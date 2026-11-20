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
import { getWalletDisplayName } from '../utils/walletDisplay';

const LAST_WALLET_STORAGE_KEY = 'payd:last_wallet_name';
const SUPPORTED_MODAL_WALLETS = [FREIGHTER_ID, LOBSTR_ID] as const;

export type SelectableWallet = {
  id: string;
  name: string;
  icon?: string;
  /** Where to install the wallet when it isn't detected. */
  url?: string;
  isAvailable: boolean;
};

/**
 * Single source of truth for the wallet UI:
 * - restoring    — silent reconnect of the last wallet on page load
 * - disconnected — no wallet; offer "Connect"
 * - connecting   — waiting for the user to approve in their wallet
 * - switching    — connected, and approving a different wallet
 * - connected    — address available for signing
 * - error        — last attempt failed; `connectionError` holds why
 */
export type WalletConnectionStatus =
  | 'restoring'
  | 'disconnected'
  | 'connecting'
  | 'switching'
  | 'connected'
  | 'error';

export type WalletModalMode = 'connect' | 'switch';

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
  const [walletModalMode, setWalletModalMode] = useState<WalletModalMode>('connect');
  const [connectingWalletId, setConnectingWalletId] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const kitRef = useRef<StellarWalletsKit | null>(null);
  // Mirrors of state read inside callbacks without re-creating them.
  const addressRef = useRef<string | null>(null);
  const walletNameRef = useRef<string | null>(null);
  useEffect(() => {
    addressRef.current = address;
    walletNameRef.current = walletName;
  }, [address, walletName]);

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
        url: wallet.url,
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

      const previousAddress = addressRef.current;
      const previousWallet = walletNameRef.current;

      // Re-selecting the wallet that's already connected is a no-op.
      if (previousAddress && previousWallet === selectedWalletId) {
        setWalletModalOpen(false);
        return previousAddress;
      }

      setIsConnecting(true);
      setConnectingWalletId(selectedWalletId);
      setConnectionError(null);
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
          previousAddress ? 'switched' : 'connected',
          `${newAddress.slice(0, 6)}...${newAddress.slice(-4)} via ${selectedWalletId}`
        );
        setWalletModalOpen(false); // Close on success
        return newAddress;
      } catch (error) {
        console.error('Failed to connect wallet:', error);
        // A failed switch must leave the previous wallet in charge of signing.
        if (previousAddress && previousWallet) {
          kit.setWallet(previousWallet);
        }
        const message = error instanceof Error ? error.message : 'Please try again.';
        setConnectionError(message);
        notifyWalletEvent('connection_failed', message);
        throw error;
      } finally {
        setIsConnecting(false);
        setConnectingWalletId(null);
      }
    },
    [notifyWalletEvent, connectionTimeoutMs]
  );

  const openWalletModal = useCallback(
    async (mode: WalletModalMode): Promise<null> => {
      const options = await loadWalletOptions();
      if (options.length === 0) {
        notifyWalletEvent('connection_failed', 'No supported wallet providers were found.');
        return null;
      }
      setConnectionError(null);
      setWalletModalMode(mode);
      setWalletModalOpen(true);
      return null;
    },
    [loadWalletOptions, notifyWalletEvent]
  );

  const connect = useCallback(
    async (): Promise<string | null> => openWalletModal('connect'),
    [openWalletModal]
  );

  /** Pick a different wallet while keeping the current one until the new one approves. */
  const switchWallet = useCallback(
    async (): Promise<string | null> => openWalletModal(addressRef.current ? 'switch' : 'connect'),
    [openWalletModal]
  );

  const closeWalletModal = useCallback(() => {
    setWalletModalOpen(false);
    setConnectionError(null);
  }, []);

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
    setConnectionError(null);
    localStorage.removeItem(LAST_WALLET_STORAGE_KEY);
    notifyWalletEvent('disconnected');
  }, [notifyWalletEvent]);

  const signTransaction = useCallback(async (xdr: string) => {
    const kit = kitRef.current;
    if (!kit) throw new Error('Wallet kit not initialized');
    const result = await kit.signTransaction(xdr);
    return result.signedTxXdr;
  }, []);

  let status: WalletConnectionStatus;
  if (!isInitialized) status = 'restoring';
  else if (isConnecting) status = address ? 'switching' : 'connecting';
  else if (address) status = 'connected';
  else if (connectionError) status = 'error';
  else status = 'disconnected';

  return {
    address,
    walletName,
    walletDisplayName: getWalletDisplayName(walletName),
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
    setWalletModalOpen,
    walletModalMode,
    closeWalletModal,
    walletOptions,
    connectWithWallet,
    connectingWalletId,
    connectionError,
  };
}
