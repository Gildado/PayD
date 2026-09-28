/**
 * Centralized asset registry for all supported stablecoins.
 *
 * Issuers for well-known assets (USDC, EURC) default to Circle's published
 * Stellar testnet addresses and can be overridden via environment variables
 * for mainnet or custom deployments.
 *
 * ORGUSD is an organization-issued asset whose issuer must always be set in
 * the environment.
 */

export interface SupportedAsset {
  /** Stellar asset code (e.g. 'USDC', 'EURC', 'ORGUSD', 'XLM') */
  code: string;
  /** Human-readable display label */
  label: string;
  /**
   * Stellar account address of the asset issuer.
   * `null` for the native XLM asset.
   */
  issuer: string | null;
}

// ---------------------------------------------------------------------------
// Known issuers – all configurable via environment variables
// Testnet defaults are Circle's published test-token addresses.
// ---------------------------------------------------------------------------

/** Circle USDC – testnet: GBBD47…, mainnet: GA5ZSE… */
const USDC_ISSUER =
  process.env.USDC_ISSUER_PUBLIC ?? 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

/**
 * Circle EURC – set EURC_ISSUER_PUBLIC for your network.
 * Mainnet: GDHU6W…  No official testnet issuer from Circle; configure your
 * own or use a local test issuer.
 */
const EURC_ISSUER =
  process.env.EURC_ISSUER_PUBLIC ?? 'GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP';

/** Organization-specific custom stablecoin; must be set in .env */
const ORGUSD_ISSUER = process.env.ORGUSD_ISSUER_PUBLIC ?? '';

// ---------------------------------------------------------------------------

export const SUPPORTED_ASSETS: SupportedAsset[] = [
  {
    code: 'USDC',
    label: 'USD Coin (USDC)',
    issuer: USDC_ISSUER,
  },
  {
    code: 'EURC',
    label: 'Euro Coin (EURC)',
    issuer: EURC_ISSUER,
  },
  {
    code: 'ORGUSD',
    label: 'Org USD (ORGUSD)',
    issuer: ORGUSD_ISSUER,
  },
  {
    code: 'XLM',
    label: 'Stellar Lumens (XLM)',
    issuer: null,
  },
];

/** Return the full asset definition for a given code, or undefined if unknown. */
export function getAssetByCode(code: string): SupportedAsset | undefined {
  return SUPPORTED_ASSETS.find((a) => a.code === code);
}

/**
 * Return the issuer address for a given asset code.
 * Returns `null` for XLM.
 * Throws if the asset code is unrecognised.
 */
export function getAssetIssuer(code: string): string | null {
  if (code === 'XLM') return null;
  const asset = getAssetByCode(code);
  if (!asset) {
    throw new Error(`Unsupported asset code: "${code}". Add it to config/assets.ts.`);
  }
  if (!asset.issuer) {
    throw new Error(
      `Issuer for "${code}" is not configured. Set ${code}_ISSUER_PUBLIC in your environment.`
    );
  }
  return asset.issuer;
}

/** Return all supported asset definitions. */
export function getSupportedAssets(): SupportedAsset[] {
  return SUPPORTED_ASSETS;
}
