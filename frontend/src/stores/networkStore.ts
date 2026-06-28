import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type StellarNetwork = 'TESTNET' | 'MAINNET';

function getDefaultNetwork(): StellarNetwork {
  const env = (import.meta.env.PUBLIC_STELLAR_NETWORK as string | undefined)?.toUpperCase()?.trim();
  return env === 'TESTNET' ? 'TESTNET' : 'MAINNET';
}

interface NetworkState {
  network: StellarNetwork;
  setNetwork: (network: StellarNetwork) => void;
}

export const useNetworkStore = create<NetworkState>()(
  persist(
    (set) => ({
      network: getDefaultNetwork(),
      setNetwork: (network) => set({ network }),
    }),
    { name: 'payd-network' }
  )
);
