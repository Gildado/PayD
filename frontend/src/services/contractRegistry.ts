import { ContractRegistry, NetworkName } from '../hooks/useNetwork';

const API_BASE = '/api/v1';

const STATIC_CONTRACTS: Record<NetworkName, ContractRegistry> = {
  testnet: {
    bulkPayment: '',
    crossAssetPayment: '',
    vestingEscrow: '',
    revenueSplit: '',
  },
  mainnet: {
    bulkPayment: '',
    crossAssetPayment: '',
    vestingEscrow: '',
    revenueSplit: '',
  },
};

/**
 * Fetches the contract registry for the given network from the backend.
 * Falls back to static placeholder config when the endpoint is unavailable
 * (pending implementation of issue #078).
 */
export async function fetchContractRegistry(network: NetworkName): Promise<ContractRegistry> {
  try {
    const res = await fetch(`${API_BASE}/registry/contracts?network=${network}`);
    if (!res.ok) return STATIC_CONTRACTS[network];
    const data = (await res.json()) as ContractRegistry;
    return data;
  } catch {
    return STATIC_CONTRACTS[network];
  }
}
