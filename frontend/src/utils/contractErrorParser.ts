import { xdr } from '@stellar/stellar-sdk';

export interface ContractErrorDetail {
  code: string;
  message: string;
  suggestedAction: string;
  rawXdr?: string;
  errorContext?: string;
}

// Map of known contract error codes (from bulk_payment and general patterns)
const CONTRACT_ERROR_MAPPING: Record<number, { message: string; action: string }> = {
  1: {
    message: 'Contract already initialized',
    action: 'The contract has already been set up. No further initialization is required.',
  },
  2: {
    message: 'Contract not initialized',
    action: 'Please initialize the contract before performing this operation.',
  },
  3: {
    message: 'Unauthorized access',
    action: 'Ensure you are signed in with the correct account and have the required permissions.',
  },
  4: {
    message: 'Empty payment batch',
    action: 'Please add at least one payment to the batch before submitting.',
  },
  5: {
    message: 'Batch size too large',
    action:
      'The batch exceeds the maximum allowed size (100). Please split it into smaller batches.',
  },
  6: {
    message: 'Invalid payment amount',
    action: 'The payment amount must be greater than zero.',
  },
  7: {
    message: 'Amount overflow',
    action:
      'The total batch amount exceeds the capacity of the contract. Please reduce the amounts.',
  },
  8: {
    message: 'Sequence mismatch',
    action: 'The transaction sequence is out of sync. Please refresh and try again.',
  },
  9: {
    message: 'Batch not found',
    action: 'The requested batch could not be found. Please verify the batch ID.',
  },
};

const GENERIC_ERROR_PATTERNS: Array<{
  pattern: RegExp;
  code: string;
  message: string;
  suggestedAction: string;
}> = [
  {
    pattern: /insufficient (balance|funds)/i,
    code: 'INSUFFICIENT_FUNDS',
    message: 'Insufficient balance to complete the contract action.',
    suggestedAction: 'Fund the signing wallet or reduce the requested amount before retrying.',
  },
  {
    pattern: /tx_bad_auth|op_bad_auth|unauthorized/i,
    code: 'UNAUTHORIZED',
    message: 'The connected wallet is not authorized for this contract action.',
    suggestedAction: 'Switch to the required signer or collect the remaining multisig approvals.',
  },
  {
    pattern: /resource limit|budget exceeded|exceeded the budget/i,
    code: 'RESOURCE_LIMIT',
    message: 'The Soroban simulation exceeded its resource budget.',
    suggestedAction: 'Try a smaller batch or split the action into multiple transactions.',
  },
  {
    pattern: /storage|footprint/i,
    code: 'STORAGE_ERROR',
    message: 'The contract failed while accessing Soroban storage.',
    suggestedAction:
      'Refresh the page and retry. If the issue persists, verify the contract state.',
  },
];

/**
 * Attempts to extract a numeric contract error code from a raw error message string.
 * Look for patterns like `Error(Contract, #123)`.
 *
 * @param rawMessage - Raw error message from simulation or execution
 * @returns Structured error detail if a known code is found, `null` otherwise
 */
function parseContractCode(rawMessage: string): ContractErrorDetail | null {
  const errorMatch = rawMessage.match(/Error\(Contract,\s*#?(\d+)\)/i);
  if (!errorMatch) {
    return null;
  }

  const code = parseInt(errorMatch[1], 10);
  const mapped = CONTRACT_ERROR_MAPPING[code];

  if (mapped) {
    return {
      code: `CONTRACT_ERR_${code}`,
      message: mapped.message,
      suggestedAction: mapped.action,
    };
  }

  return {
    code: `CONTRACT_ERR_${code}`,
    message: `Contract reverted with error code ${code}.`,
    suggestedAction:
      'Review the contract inputs and current state, then retry with corrected parameters.',
  };
}

/**
 * Matches a raw error message against generic regex patterns for common
 * Soroban/Stellar errors (e.g. insufficient funds, resource limits).
 *
 * @param rawMessage - Raw error message string
 * @returns Structured error detail if a pattern matches, `null` otherwise
 */
function parseGenericContractError(rawMessage: string): ContractErrorDetail | null {
  for (const entry of GENERIC_ERROR_PATTERNS) {
    if (entry.pattern.test(rawMessage)) {
      return {
        code: entry.code,
        message: entry.message,
        suggestedAction: entry.suggestedAction,
      };
    }
  }

  return null;
}

/**
 * Parses a Soroban execution result XDR or simulation error string into a
 * structured format with a human-readable message and suggested action.
 *
 * @param resultXdr - Optional base64-encoded TransactionResult XDR
 * @param simulationError - Optional raw error message from simulation
 * @returns A structured `ContractErrorDetail` object
 */
export function parseContractError(
  resultXdr?: string,
  simulationError?: string
): ContractErrorDetail {
  // 1. Check for known error messages in simulation string (Matches transactionSimulation.ts pattern)
  if (simulationError) {
    const parsedContractCode = parseContractCode(simulationError);
    if (parsedContractCode) {
      return parsedContractCode;
    }

    const parsedGenericError = parseGenericContractError(simulationError);
    if (parsedGenericError) {
      return parsedGenericError;
    }
  }

  // 2. Decode XDR if available
  if (resultXdr) {
    try {
      const txResult = xdr.TransactionResult.fromXDR(resultXdr, 'base64');
      const result = txResult.result();

      // If transaction failed, we check the inner operation results
      if (result.switch() === xdr.TransactionResultCode.txFailed()) {
        const opResults = result.results();
        for (const opResult of opResults) {
          if (opResult.switch() === xdr.OperationResultCode.opInner()) {
            const tr = opResult.tr();
            if (tr.switch() === xdr.OperationType.invokeHostFunction()) {
              const ihfResult = tr.invokeHostFunctionResult();

              const ihfCode = ihfResult.switch();
              if (ihfCode !== xdr.InvokeHostFunctionResultCode.invokeHostFunctionSuccess()) {
                return {
                  code: ihfCode.name,
                  message: `Soroban execution failed: ${ihfCode.name}`,
                  suggestedAction:
                    'Review the contract state, resource limits, and input parameters.',
                  rawXdr: resultXdr,
                };
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to parse result XDR:', e);
    }
  }

  // 3. Fallback to generic responses
  return {
    code: 'UNKNOWN_CONTRACT_ERROR',
    message: simulationError || 'Soroban contract invocation failed.',
    suggestedAction:
      'Check your network connection and try again, or contact support if the issue persists.',
    rawXdr: resultXdr,
  };
}
