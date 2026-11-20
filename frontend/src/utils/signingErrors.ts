import type { StellarNetwork } from '../stores/networkStore';

/**
 * Heuristics for Stellar auth errors that often indicate multisig / partial signing,
 * as well as user-rejected, locked-wallet, and network-mismatch wallet failures.
 */

export type SigningErrorCategory =
  | 'user_rejected'
  | 'locked_wallet'
  | 'network_mismatch'
  | 'multisig_auth'
  | 'unknown';

export type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/**
 * Regex that matches common multisig / auth failure messages returned by
 * Stellar/Soroban tooling.
 */
const MULTISIG_AUTH_PATTERN =
  /tx_bad_auth|op_bad_auth|bad[_\s]?auth|wrong signer|additional signature|low signature weight/i;

const USER_REJECTED_PATTERN =
  /user\s*(declined|rejected|denied|cancel+ed)|rejected by user|declined by user|request\s*(rejected|declined|denied|cancel+ed)|action_rejected|4001/i;

const LOCKED_WALLET_PATTERN =
  /wallet\s*(is\s*)?locked|locked\s*wallet|unlock\s*(your\s*)?wallet|passphrase\s*required|password\s*required|not\s*unlocked/i;

const NETWORK_MISMATCH_PATTERN =
  /network\s*mismatch|wrong\s*network|different\s*network|network\s*passphrase\s*mismatch|switch\s*(your\s*)?(wallet\s*)?network|testnet.*mainnet|mainnet.*testnet|pubnet.*testnet|testnet.*pubnet/i;

const DEFAULT_SIGNING_ERROR_MESSAGES: Record<
  Exclude<SigningErrorCategory, 'multisig_auth'>,
  string
> = {
  user_rejected:
    "Transaction signing was cancelled in your wallet. Review the details and try again when you're ready.",
  locked_wallet:
    'Your wallet appears to be locked. Unlock your wallet extension and try signing again.',
  network_mismatch:
    'Your wallet is on a different Stellar network than the app. Switch your wallet or app network so they match, then try again.',
  unknown: 'Signing failed. Please check your wallet and try again.',
};

const SIGNING_ERROR_I18N_KEYS: Record<Exclude<SigningErrorCategory, 'multisig_auth'>, string> = {
  user_rejected: 'wallet.signingErrors.userRejected',
  locked_wallet: 'wallet.signingErrors.lockedWallet',
  network_mismatch: 'wallet.signingErrors.networkMismatch',
  unknown: 'wallet.signingErrors.unknown',
};

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
}

/**
 * Classify a wallet signing error into a known actionable category.
 */
export function classifySigningError(error: unknown): SigningErrorCategory {
  const message = extractErrorMessage(error);
  if (!message) return 'unknown';
  if (USER_REJECTED_PATTERN.test(message)) return 'user_rejected';
  if (LOCKED_WALLET_PATTERN.test(message)) return 'locked_wallet';
  if (NETWORK_MISMATCH_PATTERN.test(message)) return 'network_mismatch';
  if (isLikelyPartialSigningOrMultisigAuth(message)) return 'multisig_auth';
  return 'unknown';
}

/**
 * Map a wallet signing error to an actionable, localized user-facing message.
 */
export function mapSigningError(
  error: unknown,
  t?: TranslateFn
): { category: SigningErrorCategory; message: string } {
  const raw = extractErrorMessage(error);
  const category = classifySigningError(error);

  if (category === 'multisig_auth') {
    return { category, message: appendPartialSigningHint(raw) };
  }

  if (category === 'unknown' && raw.trim().length > 0) {
    return { category, message: raw };
  }

  const key = SIGNING_ERROR_I18N_KEYS[category];
  const fallback = DEFAULT_SIGNING_ERROR_MESSAGES[category];
  const translated = t ? t(key, { defaultValue: fallback }) : fallback;
  const message = translated && translated !== key ? translated : fallback;

  return { category, message };
}

/**
 * Normalize a wallet network (`TESTNET` | `PUBLIC`) to `StellarNetwork` (`TESTNET` | `MAINNET`).
 */
export function normalizeWalletNetwork(
  walletNetwork?: 'TESTNET' | 'PUBLIC' | null
): StellarNetwork | null {
  if (!walletNetwork) return null;
  return walletNetwork === 'PUBLIC' ? 'MAINNET' : 'TESTNET';
}

/**
 * Returns `true` when a connected wallet's network differs from the app's selected network.
 */
export function isWalletNetworkMismatch(
  appNetwork: StellarNetwork,
  walletNetwork?: 'TESTNET' | 'PUBLIC' | null
): boolean {
  const normalized = normalizeWalletNetwork(walletNetwork);
  if (!normalized) return false;
  return normalized !== appNetwork;
}

/**
 * Heuristic predicate that identifies messages likely caused by partial
 * signing or multisig misconfiguration.
 *
 * @param message - Error message returned by the wallet or simulation
 * @returns `true` when the message indicates partial signing or multisig auth issues
 */
export function isLikelyPartialSigningOrMultisigAuth(message: string): boolean {
  return MULTISIG_AUTH_PATTERN.test(message);
}

/**
 * Append a short actionable hint to auth-related errors to guide developers or
 * end users through resolving multisig/partial-signing situations.
 *
 * If the message already contains an explicit multisig hint, it will be
 * returned unchanged.
 *
 * @param message - Original error string
 * @returns Possibly augmented message with an actionable hint
 */
export function appendPartialSigningHint(message: string): string {
  if (!isLikelyPartialSigningOrMultisigAuth(message)) return message;
  if (/partial signature|multisig|additional signer/i.test(message)) return message;
  return `${message} If this account uses multisig, collect the required signatures on the transaction XDR before submitting.`;
}
