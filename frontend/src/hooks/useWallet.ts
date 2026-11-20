import { createContext, use } from 'react';
import type { WalletConnectionStatus } from './useWalletManager';

export interface WalletContextType {
  address: string | null;
  /** Kit wallet id, e.g. "freighter". */
  walletName: string | null;
  /** Human-readable wallet name, e.g. "Freighter". */
  walletDisplayName?: string | null;
  /** Derived connection state; drives every wallet indicator in the UI. */
  status?: WalletConnectionStatus;
  network: 'TESTNET' | 'PUBLIC';
  setNetwork: (network: 'TESTNET' | 'PUBLIC') => void;
  isConnecting: boolean;
  isInitialized: boolean;
  walletExtensionAvailable: boolean;
  connect: () => Promise<string | null>;
  requireWallet: () => Promise<string | null>;
  /** Opens the picker in "switch" mode; the current wallet stays active until the new one approves. */
  switchWallet?: () => Promise<string | null>;
  disconnect: () => void;
  signTransaction: (xdr: string) => Promise<string>;
}

export const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = use(WalletContext);
  if (!context) throw new Error('useWallet must be used within WalletProvider');
  return context;
};
