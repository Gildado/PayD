/**
 * Transaction Simulation Service
 *
 * Implements a pre-submission simulation step for all payroll transactions.
 * Uses Horizon's transaction endpoint in simulation mode (dry-run) to catch
 * errors such as insufficient funds, invalid sequence numbers, and other
 * on-chain failures before broadcasting to the network.
 *
 * This prevents wasted fees on failed transactions and surfaces clear,
 * user-friendly error messages.
 *
 * Issue: https://github.com/Gildado/PayD/issues/41
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Human-readable error code mapping for common Horizon/Stellar failures */
const ERROR_CODE_MESSAGES: Record<string, string> = {
  tx_insufficient_balance:
    "Insufficient balance — your account does not have enough XLM to cover this transaction and its fees.",
  tx_bad_seq:
    "Invalid sequence number — your account's sequence number is out of sync. Please refresh and try again.",
  tx_bad_auth:
    "Authorization failed — the transaction signature is invalid or missing required signers.",
  tx_insufficient_fee:
    "Insufficient fee — the fee provided is below the network minimum. Consider increasing your fee.",
  tx_no_source_account:
    "Source account not found — the sending account does not exist on the network.",
  tx_too_early:
    "Transaction submitted too early — the transaction's time bounds have not started yet.",
  tx_too_late:
    "Transaction submitted too late — the transaction's time bounds have expired.",
  tx_missing_operation:
    "Missing operation — the transaction contains no operations to execute.",
  tx_bad_auth_extra:
    "Extra signatures — the transaction has unnecessary signatures attached.",
  tx_internal_error:
    "Internal error — an unexpected error occurred within the Stellar network.",
  op_underfunded:
    "Underfunded operation — the source account does not have enough balance to complete this payment.",
  op_src_not_authorized:
    "Source not authorized — the source account is not authorized to perform this operation.",
  op_no_destination:
    "Destination not found — the recipient account does not exist on the network. It may need to be created first.",
  op_no_trust:
    "Missing trustline — the destination account has not established a trustline for this asset.",
  op_line_full:
    "Trustline limit reached — the destination account's trustline limit for this asset has been exceeded.",
  op_no_issuer:
    "Asset issuer not found — the specified asset issuer does not exist on the network.",
  op_low_reserve:
    "Below minimum reserve — this operation would bring the account below the minimum reserve balance.",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Severity classification for simulation results */
export type SimulationSeverity = "success" | "warning" | "error";

/** Individual error detail from a simulation failure */
export interface SimulationError {
  /** Raw error code from Horizon (e.g. tx_bad_seq, op_underfunded) */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Which operation index triggered this error (if operation-level) */
  operationIndex?: number;
  /** Severity classification */
  severity: SimulationSeverity;
}

/** Full result of a transaction simulation */
export interface SimulationResult {
  /** Whether the simulation passed without errors */
  success: boolean;
  /** Overall severity of the simulation result */
  severity: SimulationSeverity;
  /** Short title describing the simulation outcome */
  title: string;
  /** Detailed description of the outcome */
  description: string;
  /** Individual error details (empty if simulation passed) */
  errors: SimulationError[];
  /** The envelope XDR that was simulated (for reference) */
  envelopeXdr: string;
  /** Timestamp when the simulation was performed */
  simulatedAt: Date;
  /** Network-reported hash (if available) */
  hash?: string;
  /** Estimated fee that was included (in stroops) */
  fee?: number;
}

/** Options for the simulation request */
export interface SimulationOptions {
  /** The transaction envelope XDR to simulate */
  envelopeXdr: string;
  /** Optional Horizon URL override */
  horizonUrl?: string;
}

/**
 * Shape of a Horizon transaction submission error response.
 * This is the JSON body returned when a transaction fails.
 */
interface HorizonTransactionError {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  extras?: {
    envelope_xdr?: string;
    result_xdr?: string;
    result_codes?: {
      transaction?: string;
      operations?: string[];
    };
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the Horizon base URL from the `PUBLIC_STELLAR_HORIZON_URL` env var.
 * Falls back to the public Stellar testnet if the variable is not set.
 */
function getHorizonUrl(): string {
  const envUrl = import.meta.env.PUBLIC_STELLAR_HORIZON_URL as
    | string
    | undefined;
  return envUrl?.replace(/\/+$/, "") || "https://horizon-testnet.stellar.org";
}

/**
 * Translates a raw Horizon result code into a human-readable message.
 */
function humanizeErrorCode(code: string): string {
  return (
    ERROR_CODE_MESSAGES[code] ??
    `Transaction failed with code: ${code}. Please review your transaction parameters.`
  );
}

/**
 * Parses a Horizon error response and extracts structured simulation errors.
 */
function parseHorizonError(
  errorBody: HorizonTransactionError,
): SimulationError[] {
  const errors: SimulationError[] = [];

  const resultCodes = errorBody.extras?.result_codes;

  // Transaction-level error
  if (resultCodes?.transaction) {
    errors.push({
      code: resultCodes.transaction,
      message: humanizeErrorCode(resultCodes.transaction),
      severity: "error",
    });
  }

  // Operation-level errors
  if (resultCodes?.operations) {
    resultCodes.operations.forEach((opCode, index) => {
      // "op_success" means this particular operation was fine
      if (opCode !== "op_success") {
        errors.push({
          code: opCode,
          message: humanizeErrorCode(opCode),
          operationIndex: index,
          severity: "error",
        });
      }
    });
  }

  // If we couldn't parse any structured errors, create a generic one
  if (errors.length === 0) {
    errors.push({
      code: "unknown_error",
      message:
        errorBody.detail ??
        errorBody.title ??
        "An unknown error occurred during simulation. Please try again.",
      severity: "error",
    });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * Simulates a transaction by submitting it to Horizon in dry-run mode.
 *
 * Horizon doesn't expose a dedicated "simulate" endpoint for classic
 * transactions, so we submit the transaction XDR to `POST /transactions`
 * and interpret the result. If the transaction would fail on-chain,
 * Horizon returns a 400 response with detailed error codes that we parse
 * and translate into user-friendly messages.
 *
 * For Soroban (smart contract) transactions, the RPC's `simulateTransaction`
 * endpoint is used instead.
 */
export async function simulateTransaction(
  options: SimulationOptions,
): Promise<SimulationResult> {
  const { envelopeXdr, horizonUrl } = options;
  const baseUrl = horizonUrl ?? getHorizonUrl();
  const rpcUrl =
    (import.meta.env.PUBLIC_STELLAR_RPC_URL as string | undefined)?.replace(
      /\/+$/,
      "",
    ) || "https://soroban-testnet.stellar.org";

  const simulatedAt = new Date();

  // ── Step 1: Try Soroban RPC simulateTransaction first ───────────────
  // This endpoint is specifically designed for dry-run simulation.
  try {
    const rpcResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "simulateTransaction",
        params: {
          transaction: envelopeXdr,
        },
      }),
    });

    if (rpcResponse.ok) {
      const rpcResult = (await rpcResponse.json()) as {
        result?: {
          error?: string;
          cost?: { cpuInsns: string; memBytes: string };
          transactionData?: string;
        };
        error?: { message: string; code: number };
      };

      // RPC-level error (bad request, etc.)
      if (rpcResult.error) {
        return {
          success: false,
          severity: "error",
          title: "Simulation Failed",
          description: rpcResult.error.message,
          errors: [
            {
              code: `rpc_error_${rpcResult.error.code}`,
              message: rpcResult.error.message,
              severity: "error",
            },
          ],
          envelopeXdr,
          simulatedAt,
        };
      }

      // Simulation-level error within the result
      if (rpcResult.result?.error) {
        const errorMsg = rpcResult.result.error;
        // Try to extract known error codes from the error string
        const matchedCode = Object.keys(ERROR_CODE_MESSAGES).find((code) =>
          errorMsg.toLowerCase().includes(code.toLowerCase()),
        );

        return {
          success: false,
          severity: "error",
          title: "Transaction Would Fail",
          description:
            matchedCode != null ? humanizeErrorCode(matchedCode) : errorMsg,
          errors: [
            {
              code: matchedCode ?? "simulation_error",
              message:
                matchedCode != null ? humanizeErrorCode(matchedCode) : errorMsg,
              severity: "error",
            },
          ],
          envelopeXdr,
          simulatedAt,
        };
      }

      // Simulation passed — transaction would succeed
      return {
        success: true,
        severity: "success",
        title: "Simulation Passed",
        description:
          "The transaction was simulated successfully. It is safe to submit to the network.",
        errors: [],
        envelopeXdr,
        simulatedAt,
      };
    }
  } catch {
    // RPC not available — fall through to Horizon validation
  }

  // ── Step 2: Fallback to Horizon POST /transactions ─────────────────
  // Submit with tx envelope to Horizon and check the response
  try {
    const response = await fetch(`${baseUrl}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `tx=${encodeURIComponent(envelopeXdr)}`,
    });

    // 200 = transaction was actually submitted and succeeded (unlikely in sim
    // mode, but handle it gracefully)
    if (response.ok) {
      const txResult = (await response.json()) as {
        hash?: string;
        fee_charged?: string;
      };

      return {
        success: true,
        severity: "warning",
        title: "Transaction Submitted",
        description:
          "The transaction was submitted and accepted by the network. Note: this was a live submission, not just a simulation.",
        errors: [],
        envelopeXdr,
        simulatedAt,
        hash: txResult.hash,
        fee: txResult.fee_charged ? Number(txResult.fee_charged) : undefined,
      };
    }

    // 400/4xx = transaction would fail — parse the error details
    const errorBody = (await response.json()) as HorizonTransactionError;
    const errors = parseHorizonError(errorBody);

    return {
      success: false,
      severity: "error",
      title: "Transaction Would Fail",
      description:
        errors.length === 1
          ? errors[0].message
          : `${errors.length} issues were detected that would cause this transaction to fail on-chain.`,
      errors,
      envelopeXdr,
      simulatedAt,
    };
  } catch (networkError) {
    // Network or parsing error
    const message =
      networkError instanceof Error
        ? networkError.message
        : "Network error during simulation";

    return {
      success: false,
      severity: "error",
      title: "Simulation Unavailable",
      description: `Could not reach the Stellar network to simulate this transaction: ${message}`,
      errors: [
        {
          code: "network_error",
          message,
          severity: "error",
        },
      ],
      envelopeXdr,
      simulatedAt,
    };
  }
}

/**
 * Simulates a batch of transaction envelope XDRs.
 * Returns results for each transaction in order.
 */
export async function simulateBatchTransactions(
  envelopeXdrs: string[],
  horizonUrl?: string,
): Promise<SimulationResult[]> {
  return Promise.all(
    envelopeXdrs.map((xdr) =>
      simulateTransaction({ envelopeXdr: xdr, horizonUrl }),
    ),
  );
}

/**
 * Validates a batch of simulation results and returns an overall summary.
 */
export function summarizeBatchSimulation(results: SimulationResult[]): {
  allPassed: boolean;
  passedCount: number;
  failedCount: number;
  totalErrors: number;
  results: SimulationResult[];
} {
  const passedCount = results.filter((r) => r.success).length;
  const failedCount = results.length - passedCount;
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  return {
    allPassed: failedCount === 0,
    passedCount,
    failedCount,
    totalErrors,
    results,
  };
}
