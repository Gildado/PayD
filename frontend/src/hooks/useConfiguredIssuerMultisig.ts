import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SUPPORTED_ASSETS, type SupportedAsset } from '../config/assets';
import { useWallet } from './useWallet';
import {
  detectMultisig,
  getHorizonUrlForNetwork,
  summarizeMultisig,
  type MultisigDetectionResult,
  type MultisigInfo,
} from '../services/multisigDetection';

export interface IssuerMultisigEntry {
  code: string;
  issuer: string;
  result: MultisigDetectionResult;
  info: MultisigInfo | null;
  summary: string | null;
}

/**
 * Loads on-chain multisig configuration for configured payout asset issuers,
 * using the same Horizon endpoint as the selected wallet network.
 */
export function useConfiguredIssuerMultisig() {
  const { network, isInitialized } = useWallet();
  const horizonUrl = useMemo(() => getHorizonUrlForNetwork(network), [network]);

  const issuers = useMemo(
    () =>
      SUPPORTED_ASSETS.filter((a): a is SupportedAsset & { issuer: string } => Boolean(a.issuer)),
    []
  );

  const query = useQuery({
    queryKey: ['configured-issuer-multisig', horizonUrl, ...issuers.map((i) => i.issuer)],
    queryFn: async (): Promise<IssuerMultisigEntry[]> => {
      const rows: IssuerMultisigEntry[] = [];
      for (const asset of issuers) {
        const result = await detectMultisig(asset.issuer, { horizonUrl });
        const info = result.success && result.info ? result.info : null;
        rows.push({
          code: asset.code,
          issuer: asset.issuer,
          result,
          info,
          summary: info ? summarizeMultisig(info) : null,
        });
      }
      return rows;
    },
    enabled: isInitialized && issuers.length > 0,
    staleTime: 120_000,
  });

  const multisigIssuers = useMemo(
    () => query.data?.filter((row) => row.info?.isMultisig) ?? [],
    [query.data]
  );

  return { ...query, multisigIssuers, horizonUrl };
}
