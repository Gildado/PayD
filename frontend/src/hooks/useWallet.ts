import { createContext, use } from 'react';

export interface WalletContextType {
  address: string | null;
  walletName: string | null;
  network: 'TESTNET' | 'PUBLIC';
  setNetwork: (network: 'TESTNET' | 'PUBLIC') => void;
  isConnecting: boolean;
  isInitialized: boolean;
  walletExtensionAvailable: boolean;
  connect: () => Promise<string | null>;
  requireWallet: () => Promise<string | null>;
  disconnect: () => void;
  signTransaction: (xdr: string) => Promise<string>;
}

export const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = use(WalletContext);
  if (!context) throw new Error('useWallet must be used within WalletProvider');
  return context;
};
