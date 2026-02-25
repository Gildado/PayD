import { createContext, use } from 'react';
import { WalletNetwork } from '@creit.tech/stellar-wallets-kit';

export type NetworkName = 'testnet' | 'mainnet';

export interface StellarNetworkConfig {
  name: NetworkName;
  displayName: string;
  networkPassphrase: string;
  horizonUrl: string;
  rpcUrl: string;
  walletNetwork: WalletNetwork;
}

export interface ContractRegistry {
  bulkPayment: string;
  crossAssetPayment: string;
  vestingEscrow: string;
  revenueSplit: string;
}

export interface NetworkContextType {
  network: NetworkName;
  config: StellarNetworkConfig;
  contracts: ContractRegistry | null;
  isTestnet: boolean;
  switchNetwork: (network: NetworkName) => void;
}

export const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const useNetwork = () => {
  const context = use(NetworkContext);
  if (!context) throw new Error('useNetwork must be used within NetworkProvider');
  return context;
};
