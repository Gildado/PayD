/**
 * Contract Error Parser
 *
 * Decodes Soroban invocation failures from XDR result codes into structured,
 * human-readable error objects. Mirrors the pattern established in
 * transactionSimulation.ts for Horizon errors, but targets Soroban contract
 * invocation failures specifically.
 *
 * Issue: https://github.com/Gildado/PayD/issues/82
 */

// ---------------------------------------------------------------------------
// Known contract error code mappings
// ---------------------------------------------------------------------------

/**
 * Soroban host-level error codes returned inside the InvokeHostFunctionResult XDR.
 * Keys are the canonical string codes surfaced by the Soroban RPC error field.
 */
const CONTRACT_ERROR_MESSAGES: Record<
  string,
  { description: string; suggestedAction: string }
> = {
  // ── Invocation failures ──────────────────────────────────────────────
  invoke_host_function_trapped: {
    description: 'The contract function panicked during execution.',
    suggestedAction: 'Check the contract arguments for out-of-range values or invalid state.',
  },
  invoke_host_function_malformed: {
    description: 'The invocation arguments are malformed or do not match the contract ABI.',
    suggestedAction: 'Verify the argument types and ordering expected by the contract function.',
  },

  // ── Authorization failures ───────────────────────────────────────────
  auth_required: {
    description: 'The caller is not authorized to invoke this contract function.',
    suggestedAction: 'Ensure the signing account has the required role or approval.',
  },
  bad_auth: {
    description: 'Contract authorization check failed — signature invalid or missing.',
    suggestedAction: 'Re-sign the transaction with the correct account keypair.',
  },

  // ── Footprint / resource failures ───────────────────────────────────
  insufficient_refundable_fee: {
    description: 'The fee is too low to cover Soroban resource usage for this invocation.',
    suggestedAction: 'Increase the base fee or resource fee to meet the contract execution cost.',
  },
  resource_limit_exceeded: {
    description: 'Contract execution exceeded CPU, memory, or ledger entry limits.',
    suggestedAction:
      'Simplify the invocation or batch fewer items per call to reduce resource usage.',
  },
  invalid_ledger_entry_access: {
    description: 'The contract attempted to access a ledger entry not declared in the footprint.',
    suggestedAction:
      'Re-simulate the transaction to refresh the footprint before submitting.',
  },

  // ── Contract-defined error codes (numeric, surfaced as strings) ──────
  contract_error_0: {
    description: 'Contract error code 0 — operation not permitted in the current contract state.',
    suggestedAction: 'Check that the contract is in the expected state before invoking.',
  },
  contract_error_1: {
    description: 'Contract error code 1 — arithmetic overflow or underflow detected.',
    suggestedAction: 'Verify that amount values are within the accepted range for this contract.',
  },
  contract_error_2: {
    description: 'Contract error code 2 — vesting schedule has not started yet.',
    suggestedAction: 'Wait until the vesting start date before claiming tokens.',
  },
  contract_error_3: {
    description: 'Contract error code 3 — no vested tokens are available to claim at this time.',
    suggestedAction: 'Check the vesting schedule to confirm the claimable amount.',
  },
  contract_error_4: {
    description: 'Contract error code 4 — recipient address is not registered in this contract.',
    suggestedAction: 'Confirm the recipient was added during contract initialization.',
  },
  contract_error_5: {
    description: 'Contract error code 5 — insufficient token balance in the contract escrow.',
    suggestedAction: 'Ensure the contract was funded before attempting a withdrawal.',
  },

  // ── Payroll-specific codes ───────────────────────────────────────────
  payroll_duplicate_period: {
    description: 'A payroll disbursement for this period has already been processed.',
    suggestedAction: 'Advance to the next pay period before submitting.',
  },
  payroll_employee_not_found: {
    description: 'The specified employee ID does not exist in the payroll contract.',
    suggestedAction: 'Register the employee before scheduling a payment.',
  },

  // ── Cross-asset payment codes ────────────────────────────────────────
  swap_slippage_exceeded: {
    description: 'The swap could not be completed — price moved beyond the slippage tolerance.',
    suggestedAction: 'Increase slippage tolerance or retry when market conditions stabilize.',
  },
  no_liquidity: {
    description: 'Insufficient liquidity in the pool for this asset pair.',
    suggestedAction: 'Try a different asset pair or reduce the payment amount.',
  },

  // ── Generic fallback ─────────────────────────────────────────────────
  unknown_contract_error: {
    description: 'An unrecognised contract error occurred.',
    suggestedAction: 'Copy the raw XDR and open a support ticket for further investigation.',
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A structured, parsed representation of a single contract error */
export interface ContractError {
  /** The canonical error code string */
  code: string;
  /** Human-readable description of what the error means */
  description: string;
  /** Suggested action for the user to resolve the issue */
  suggestedAction: string;
  /**
   * The raw XDR result string, included when the error code was not
   * recognised so the user can inspect or copy it directly.
   */
  rawXdr?: string;
}

/** The full result of calling `parseContractError` */
export interface ContractErrorResult {
  /** Whether a known error mapping was found */
  known: boolean;
  /** The primary parsed error */
  error: ContractError;
  /**
   * The original result XDR passed in — always preserved so the UI can
   * render a copy button regardless of whether the error was recognised.
   */
  resultXdr: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Attempts to extract a canonical error code string from a Soroban result XDR
 * or error message string.
 *
 * The Soroban RPC `simulateTransaction` response surfaces errors as plain
 * strings (e.g. "HostError: Value(ContractError(3))") or as result_xdr
 * blobs. This function normalises both forms into the lookup key used by
 * `CONTRACT_ERROR_MESSAGES`.
 */
function extractErrorCode(resultXdr: string): string | null {
  const lower = resultXdr.toLowerCase();

  // Direct key match — highest priority (e.g. from structured RPC error fields)
  const directMatch = Object.keys(CONTRACT_ERROR_MESSAGES).find((key) =>
    lower.includes(key.toLowerCase())
  );
  if (directMatch) return directMatch;

  // Soroban host error pattern: "ContractError(N)" → contract_error_N
  const contractErrMatch = /contracterror\((\d+)\)/i.exec(resultXdr);
  if (contractErrMatch) {
    const numericKey = `contract_error_${contractErrMatch[1]}`;
    if (numericKey in CONTRACT_ERROR_MESSAGES) return numericKey;
  }

  // Soroban invoke_host_function result codes surfaced in result XDR strings
  if (lower.includes('trapped')) return 'invoke_host_function_trapped';
  if (lower.includes('malformed')) return 'invoke_host_function_malformed';
  if (lower.includes('resourcelimitexceeded') || lower.includes('resource_limit'))
    return 'resource_limit_exceeded';
  if (lower.includes('insufficientrefundablefee') || lower.includes('refundable_fee'))
    return 'insufficient_refundable_fee';
  if (lower.includes('invalidledgerentryaccess') || lower.includes('ledger_entry_access'))
    return 'invalid_ledger_entry_access';
  if (lower.includes('authrequired') || lower.includes('auth_required')) return 'auth_required';
  if (lower.includes('badauth') || lower.includes('bad_auth')) return 'bad_auth';

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Decodes a Soroban invocation failure from an XDR result code string into a
 * structured `ContractErrorResult`.
 *
 * For known error codes the result includes a human-readable description and a
 * suggested action. For unknown codes the raw XDR is surfaced so the user can
 * inspect or copy it.
 *
 * @param resultXdr - The result XDR or error string from a failed invocation.
 *   This can be a base64-encoded XDR blob, a Soroban RPC error message string,
 *   or any representation that contains recognisable error tokens.
 *
 * @example
 * // Known error
 * const result = parseContractError('HostError: Value(ContractError(2))');
 * // result.known === true
 * // result.error.code === 'contract_error_2'
 * // result.error.description === 'Vesting schedule has not started yet.'
 *
 * @example
 * // Unknown error — falls back to raw XDR display
 * const result = parseContractError('AAAABAAAAAgAAAAA...');
 * // result.known === false
 * // result.error.rawXdr is set to the original string
 */
export function parseContractError(resultXdr: string): ContractErrorResult {
  if (!resultXdr || resultXdr.trim() === '') {
    return {
      known: true,
      error: {
        code: 'unknown_contract_error',
        ...CONTRACT_ERROR_MESSAGES.unknown_contract_error,
      },
      resultXdr,
    };
  }

  const code = extractErrorCode(resultXdr);

  if (code && code in CONTRACT_ERROR_MESSAGES) {
    return {
      known: true,
      error: {
        code,
        ...CONTRACT_ERROR_MESSAGES[code],
      },
      resultXdr,
    };
  }

  // Unknown error — fall back to raw XDR display
  return {
    known: false,
    error: {
      code: 'unknown_contract_error',
      description: 'An unrecognised contract error occurred.',
      suggestedAction:
        'Copy the raw XDR below and open a support ticket for further investigation.',
      rawXdr: resultXdr,
    },
    resultXdr,
  };
}

/**
 * Returns all currently mapped error codes and their metadata.
 * Useful for generating documentation or test fixtures.
 */
export function getAllContractErrorCodes(): Array<
  { code: string } & { description: string; suggestedAction: string }
> {
  return Object.entries(CONTRACT_ERROR_MESSAGES).map(([code, meta]) => ({ code, ...meta }));
}
