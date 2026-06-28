/**
 * Supported payout assets for the PayD UI.
 *
 * Issuers here match the backend asset registry defaults; override them via
 * the VITE_* env vars when targeting mainnet or a custom issuer.
 */

export interface SupportedAsset {
  code: string;
  label: string;
  /** Stellar account of the issuer. null for native XLM. */
  issuer: string | null;
}

export const SUPPORTED_ASSETS: SupportedAsset[] = [
  {
    code: 'USDC',
    label: 'USD Coin (USDC)',
    issuer:
      (import.meta.env.VITE_USDC_ISSUER as string | undefined) ??
      'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  },
  {
    code: 'EURC',
    label: 'Euro Coin (EURC)',
    issuer:
      (import.meta.env.VITE_EURC_ISSUER as string | undefined) ??
      'GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP',
  },
  {
    code: 'ORGUSD',
    label: 'Org USD (ORGUSD)',
    issuer: (import.meta.env.VITE_ORGUSD_ISSUER as string | undefined) ?? null,
  },
  {
    code: 'XLM',
    label: 'Stellar Lumens (XLM)',
    issuer: null,
  },
];

export function getAssetByCode(code: string): SupportedAsset | undefined {
  return SUPPORTED_ASSETS.find((a) => a.code === code);
}
