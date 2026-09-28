/**
 * Heuristics for Stellar auth errors that often indicate multisig / partial signing.
 */

/**
 * Regex that matches common multisig / auth failure messages returned by
 * Stellar/Soroban tooling.
 */
const MULTISIG_AUTH_PATTERN =
  /tx_bad_auth|op_bad_auth|bad[_\s]?auth|wrong signer|additional signature|low signature weight/i;

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
