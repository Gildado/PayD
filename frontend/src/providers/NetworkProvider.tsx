import React, { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { WalletNetwork } from '@creit.tech/stellar-wallets-kit';
import {
  NetworkContext,
  NetworkName,
  StellarNetworkConfig,
  ContractRegistry,
} from '../hooks/useNetwork';
import { fetchContractRegistry } from '../services/contractRegistry';

const STORAGE_KEY = 'payd-network';

const NETWORK_CONFIGS: Record<NetworkName, StellarNetworkConfig> = {
  testnet: {
    name: 'testnet',
    displayName: 'Testnet',
    networkPassphrase: 'Test SDF Network ; September 2015',
    horizonUrl:
      (import.meta.env.VITE_TESTNET_HORIZON_URL as string | undefined) ||
      'https://horizon-testnet.stellar.org',
    rpcUrl:
      (import.meta.env.VITE_TESTNET_RPC_URL as string | undefined) ||
      'https://soroban-testnet.stellar.org',
    walletNetwork: WalletNetwork.TESTNET,
  },
  mainnet: {
    name: 'mainnet',
    displayName: 'Mainnet',
    networkPassphrase: 'Public Global Stellar Network ; September 2015',
    horizonUrl:
      (import.meta.env.VITE_MAINNET_HORIZON_URL as string | undefined) ||
      'https://horizon.stellar.org',
    rpcUrl:
      (import.meta.env.VITE_MAINNET_RPC_URL as string | undefined) || 'https://horizon.stellar.org',
    walletNetwork: WalletNetwork.PUBLIC,
  },
};

function getInitialNetwork(): NetworkName {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'testnet' || stored === 'mainnet') return stored;
  return import.meta.env.MODE === 'production' ? 'mainnet' : 'testnet';
}

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [network, setNetwork] = useState<NetworkName>(getInitialNetwork);
  const [contracts, setContracts] = useState<ContractRegistry | null>(null);
  const queryClient = useQueryClient();

  // Fetch contract registry whenever network changes
  useEffect(() => {
    fetchContractRegistry(network)
      .then(setContracts)
      .catch(() => setContracts(null));
  }, [network]);

  const switchNetwork = useCallback(
    (newNetwork: NetworkName) => {
      // Clear React Query cache
      queryClient.clear();

      // Clear network-sensitive localStorage keys
      localStorage.removeItem('pending-claims');
      localStorage.removeItem('payroll-scheduler-draft');

      // Persist preference
      localStorage.setItem(STORAGE_KEY, newNetwork);

      setNetwork(newNetwork);
    },
    [queryClient]
  );

  return (
    <NetworkContext
      value={{
        network,
        config: NETWORK_CONFIGS[network],
        contracts,
        isTestnet: network === 'testnet',
        switchNetwork,
      }}
    >
      {children}
    </NetworkContext>
  );
};
