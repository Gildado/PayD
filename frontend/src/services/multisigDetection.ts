/**
 * Multisig Support Detection Service
 *
 * Queries the Stellar network to detect whether an account requires multiple
 * signatures, and exposes the threshold & signer configuration so the UI can
 * guide partial signing flows.
 *
 * Issues: https://github.com/Gildado/PayD/issues/171
 *         https://github.com/Gildado/PayD/issues/389 (issuer-aware Horizon URL)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of the Horizon /accounts/{id} response fields we consume. */
interface HorizonAccountResponse {
  thresholds?: {
    low_threshold: number;
    med_threshold: number;
    high_threshold: number;
  };
  signers?: Array<{ key: string; weight: number; type: string }>;
}

export interface AccountSigner {
  /** Stellar public key (G…) or pre-auth tx hash / sha256 hash. */
  key: string;
  /** Weight assigned to this signer. */
  weight: number;
  /** Signer type as returned by Horizon. */
  type: 'ed25519_public_key' | 'sha256_hash' | 'preauth_tx';
}

export interface MultisigThresholds {
  /** Weight required for low-security operations (e.g. allow_trust). */
  low: number;
  /** Weight required for medium-security operations (e.g. payment). */
  med: number;
  /** Weight required for high-security operations (e.g. set_options). */
  high: number;
}

export interface MultisigInfo {
  /** The queried Stellar account address. */
  accountId: string;
  /** Whether the account requires more than one signature for medium ops. */
  isMultisig: boolean;
  /** The threshold configuration. */
  thresholds: MultisigThresholds;
  /** All signers attached to the account. */
  signers: AccountSigner[];
  /** The master key weight (0 means the master key alone cannot sign). */
  masterWeight: number;
  /**
   * Minimum number of distinct signatures needed to meet the medium
   * threshold, assuming signers are used in descending weight order.
   */
  requiredSignatureCount: number;
  /**
   * Total signing weight available across all signers. If this is less
   * than the required threshold, the account is effectively locked.
   */
  totalWeight: number;
}

export interface MultisigDetectionResult {
  success: boolean;
  info: MultisigInfo | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Horizon URL helper
// ---------------------------------------------------------------------------

function getHorizonUrl(): string {
  const envUrl = import.meta.env.PUBLIC_STELLAR_HORIZON_URL as string | undefined;
  return envUrl?.replace(/\/+$/, '') || 'https://horizon-testnet.stellar.org';
}

/**
 * Resolves the Horizon base URL for the wallet network when no env override is set.
 * Keeps issuer multisig checks aligned with testnet vs public/mainnet.
 */
export function getHorizonUrlForNetwork(network: 'TESTNET' | 'PUBLIC'): string {
  const envUrl = import.meta.env.PUBLIC_STELLAR_HORIZON_URL as string | undefined;
  if (envUrl) return envUrl.replace(/\/+$/, '');
  return network === 'PUBLIC'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org';
}

// ---------------------------------------------------------------------------
// Core detection
// ---------------------------------------------------------------------------

/**
 * Fetches account details from Horizon and derives multisig configuration.
 *
 * @param accountId - Stellar public key (G…) to inspect.
 * @param options - Optional `horizonUrl` override (e.g. match connected wallet network).
 * @returns A result object with multisig information or an error.
 */
export async function detectMultisig(
  accountId: string,
  options?: { horizonUrl?: string }
): Promise<MultisigDetectionResult> {
  if (!accountId || !accountId.startsWith('G') || accountId.length !== 56) {
    return {
      success: false,
      info: null,
      error: 'Invalid Stellar account address. Must be a 56-character G… public key.',
    };
  }

  const horizonUrl = options?.horizonUrl ?? getHorizonUrl();

  try {
    const response = await fetch(`${horizonUrl}/accounts/${encodeURIComponent(accountId)}`, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          info: null,
          error: 'Account not found on the Stellar network. It may not be funded yet.',
        };
      }
      return {
        success: false,
        info: null,
        error: `Horizon returned status ${response.status}. Please try again later.`,
      };
    }

    const data: HorizonAccountResponse = (await response.json()) as HorizonAccountResponse;

    const thresholds: MultisigThresholds = {
      low: data.thresholds?.low_threshold ?? 0,
      med: data.thresholds?.med_threshold ?? 0,
      high: data.thresholds?.high_threshold ?? 0,
    };

    const signers: AccountSigner[] = (data.signers ?? []).map((s) => ({
      key: s.key,
      weight: s.weight,
      type: s.type as AccountSigner['type'],
    }));

    const masterSigner = signers.find((s) => s.key === accountId);
    const masterWeight = masterSigner?.weight ?? 0;

    // Calculate total available weight
    const totalWeight = signers.reduce((sum, s) => sum + s.weight, 0);

    // Calculate minimum signatures needed to meet the medium threshold.
    const requiredSignatureCount = computeMinSignatures(signers, thresholds.med);

    // An account is multisig if the medium threshold exceeds any single
    // signer's weight — meaning at least two distinct signatures are needed.
    const maxSingleWeight = signers.length > 0 ? Math.max(...signers.map((s) => s.weight)) : 0;
    const isMultisig = thresholds.med > maxSingleWeight;

    return {
      success: true,
      info: {
        accountId,
        isMultisig,
        thresholds,
        signers,
        masterWeight,
        requiredSignatureCount,
        totalWeight,
      },
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      info: null,
      error: err instanceof Error ? err.message : 'Failed to fetch account details.',
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Computes the minimum number of signatures from `signers` needed to reach
 * `threshold`. Uses a greedy approach — picks the heaviest signers first.
 */
function computeMinSignatures(signers: AccountSigner[], threshold: number): number {
  if (threshold === 0) return 0;

  const sorted = [...signers].filter((s) => s.weight > 0).sort((a, b) => b.weight - a.weight);

  let accumulated = 0;
  let count = 0;

  for (const signer of sorted) {
    accumulated += signer.weight;
    count += 1;
    if (accumulated >= threshold) return count;
  }

  // If we exhaust all signers without meeting threshold, return total + 1
  // to indicate the account is effectively locked.
  return signers.length + 1;
}

/**
 * Returns a human-readable summary of the multisig configuration suitable
 * for display in UI badges or tooltips.
 */
export function summarizeMultisig(info: MultisigInfo): string {
  if (!info.isMultisig) {
    return 'Standard account — single signature required.';
  }

  const { requiredSignatureCount, signers } = info;
  const activeSigners = signers.filter((s) => s.weight > 0).length;

  if (requiredSignatureCount > activeSigners) {
    return `Account is locked — requires ${info.thresholds.med} weight but only ${info.totalWeight} is available.`;
  }

  return `Multi-signature account — ${requiredSignatureCount}-of-${activeSigners} signatures required.`;
}
