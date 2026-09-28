import { useQuery } from '@tanstack/react-query';
import { useWallet } from './useWallet';
import { fetchNativeXlmBalance } from '../services/horizonBalances';
import { getHorizonUrlForNetwork } from '../services/multisigDetection';

/**
 * Connected wallet native XLM balance for the current Stellar network.
 */
export function useNativeXlmBalance() {
  const { address, network, isInitialized } = useWallet();
  const horizonUrl = getHorizonUrlForNetwork(network);

  return useQuery({
    queryKey: ['native-xlm-balance', address, horizonUrl],
    queryFn: () => fetchNativeXlmBalance(address!, horizonUrl),
    enabled: Boolean(isInitialized && address),
    staleTime: 30_000,
  });
}
