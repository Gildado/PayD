/**
 * Integration tests for contractErrorParser
 *
 * Covers every mapped error code and verifies the fallback behaviour for
 * unknown XDR strings.
 *
 * Run with: npx vitest run src/__tests__/contractErrorParser.test.ts
 *
 * Issue: https://github.com/Gildado/PayD/issues/82
 */

import { describe, it, expect } from 'vitest';
import {
  parseContractError,
  getAllContractErrorCodes,
} from '../services/contractErrorParser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wraps a numeric contract error code into the Soroban host error format. */
function sorobanHostErr(n: number): string {
  return `HostError: Value(ContractError(${n}))`;
}

// ---------------------------------------------------------------------------
// Known error code mapping
// ---------------------------------------------------------------------------

describe('parseContractError — known error codes', () => {
  it('recognises invoke_host_function_trapped via direct key', () => {
    const result = parseContractError('invoke_host_function_trapped');
    expect(result.known).toBe(true);
    expect(result.error.code).toBe('invoke_host_function_trapped');
    expect(result.error.description).toBeTruthy();
    expect(result.error.suggestedAction).toBeTruthy();
    expect(result.error.rawXdr).toBeUndefined();
  });

  it('recognises invoke_host_function_malformed via direct key', () => {
    const result = parseContractError('invoke_host_function_malformed');
    expect(result.known).toBe(true);
    expect(result.error.code).toBe('invoke_host_function_malformed');
  });

  it('recognises auth_required via direct key', () => {
    const result = parseContractError('auth_required');
    expect(result.known).toBe(true);
    expect(result.error.code).toBe('auth_required');
  });

  it('recognises bad_auth via direct key', () => {
    const result = parseContractError('bad_auth');
    expect(result.known).toBe(true);
    expect(result.error.code).toBe('bad_auth');
  });

  it('recognises insufficient_refundable_fee', () => {
    const result = parseContractError('insufficient_refundable_fee');
    expect(result.known).toBe(true);
    expect(result.error.code).toBe('insufficient_refundable_fee');
  });

  it('recognises resource_limit_exceeded', () => {
    const result = parseContractError('resource_limit_exceeded');
    expect(result.known).toBe(true);
    expect(result.error.code).toBe('resource_limit_exceeded');
  });

  it('recognises invalid_ledger_entry_access', () => {
    const result = parseContractError('invalid_ledger_entry_access');
    expect(result.known).toBe(true);
    expect(result.error.code).toBe('invalid_ledger_entry_access');
  });

  it('recognises payroll_duplicate_period', () => {
    const result = parseContractError('payroll_duplicate_period');
    expect(result.known).toBe(true);
    expect(result.error.code).toBe('payroll_duplicate_period');
  });

  it('recognises payroll_employee_not_found', () => {
    const result = parseContractError('payroll_employee_not_found');
    expect(result.known).toBe(true);
    expect(result.error.code).toBe('payroll_employee_not_found');
  });

  it('recognises swap_slippage_exceeded', () => {
    const result = parseContractError('swap_slippage_exceeded');
    expect(result.known).toBe(true);
    expect(result.error.code).toBe('swap_slippage_exceeded');
  });

  it('recognises no_liquidity', () => {
    const result = parseContractError('no_liquidity');
    expect(result.known).toBe(true);
    expect(result.error.code).toBe('no_liquidity');
  });
});

// ---------------------------------------------------------------------------
// Numeric ContractError(N) extraction
// ---------------------------------------------------------------------------

describe('parseContractError — numeric ContractError(N) codes', () => {
  it.each([0, 1, 2, 3, 4, 5])(
    'maps ContractError(%i) to contract_error_%i',
    (n) => {
      const result = parseContractError(sorobanHostErr(n));
      expect(result.known).toBe(true);
      expect(result.error.code).toBe(`contract_error_${n}`);
      expect(result.error.description).toBeTruthy();
      expect(result.error.suggestedAction).toBeTruthy();
      expect(result.error.rawXdr).toBeUndefined();
    }
  );

  it('returns rawXdr for an unmapped ContractError(99)', () => {
    const input = sorobanHostErr(99);
    const result = parseContractError(input);
    expect(result.known).toBe(false);
    expect(result.error.rawXdr).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// Token-based heuristic matching
// ---------------------------------------------------------------------------

describe('parseContractError — heuristic token matching', () => {
  it('detects "trapped" in a verbose error string', () => {
    const result = parseContractError(
      'Error executing contract: host function trapped during execution'
    );
    expect(result.known).toBe(true);
    expect(result.error.code).toBe('invoke_host_function_trapped');
  });

  it('detects "malformed" in a verbose error string', () => {
    const result = parseContractError('Invocation malformed: argument count mismatch');
    expect(result.known).toBe(true);
    expect(result.error.code).toBe('invoke_host_function_malformed');
  });

  it('detects "authrequired" (camelCase variant)', () => {
    const result = parseContractError('ContractAuthRequired: missing signer');
    expect(result.known).toBe(true);
    expect(result.error.code).toBe('auth_required');
  });

  it('detects "refundable_fee" token', () => {
    const result = parseContractError('InsufficientRefundableFee: fee too low');
    expect(result.known).toBe(true);
    expect(result.error.code).toBe('insufficient_refundable_fee');
  });

  it('detects "resource_limit" token', () => {
    const result = parseContractError('resource_limit exceeded during execution');
    expect(result.known).toBe(true);
    expect(result.error.code).toBe('resource_limit_exceeded');
  });

  it('detects "ledger_entry_access" token', () => {
    const result = parseContractError('InvalidLedgerEntryAccess: footprint mismatch');
    expect(result.known).toBe(true);
    expect(result.error.code).toBe('invalid_ledger_entry_access');
  });

  it('detects "badauth" (camelCase variant)', () => {
    const result = parseContractError('BadAuth: signature verification failed');
    expect(result.known).toBe(true);
    expect(result.error.code).toBe('bad_auth');
  });
});

// ---------------------------------------------------------------------------
// Unknown / fallback behaviour
// ---------------------------------------------------------------------------

describe('parseContractError — unknown error fallback', () => {
  it('falls back for an opaque base64 XDR blob', () => {
    const rawXdr = 'AAAABAAAAAgAAAAA3kP6AAAAAQAAAAEAAAAAAAAAB9AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlEXgQAAAAAAAAAAA==';
    const result = parseContractError(rawXdr);
    expect(result.known).toBe(false);
    expect(result.error.code).toBe('unknown_contract_error');
    expect(result.error.rawXdr).toBe(rawXdr);
    expect(result.resultXdr).toBe(rawXdr);
    expect(result.error.description).toBeTruthy();
    expect(result.error.suggestedAction).toMatch(/copy/i);
  });

  it('falls back for a completely arbitrary string', () => {
    const result = parseContractError('some random unrecognised error text');
    expect(result.known).toBe(false);
    expect(result.error.rawXdr).toBe('some random unrecognised error text');
  });

  it('handles an empty string gracefully', () => {
    const result = parseContractError('');
    expect(result.known).toBe(true); // treated as unknown_contract_error (mapped)
    expect(result.error.code).toBe('unknown_contract_error');
    expect(result.error.rawXdr).toBeUndefined();
  });

  it('handles a whitespace-only string gracefully', () => {
    const result = parseContractError('   ');
    expect(result.known).toBe(true);
    expect(result.error.code).toBe('unknown_contract_error');
  });
});

// ---------------------------------------------------------------------------
// resultXdr is always preserved
// ---------------------------------------------------------------------------

describe('parseContractError — resultXdr preservation', () => {
  it('always returns the original resultXdr for known errors', () => {
    const input = 'bad_auth';
    const result = parseContractError(input);
    expect(result.resultXdr).toBe(input);
  });

  it('always returns the original resultXdr for unknown errors', () => {
    const input = 'AAAAABCXYZ123opaque';
    const result = parseContractError(input);
    expect(result.resultXdr).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// getAllContractErrorCodes
// ---------------------------------------------------------------------------

describe('getAllContractErrorCodes', () => {
  it('returns an array of all mapped codes with description and suggestedAction', () => {
    const codes = getAllContractErrorCodes();
    expect(codes.length).toBeGreaterThan(0);
    for (const entry of codes) {
      expect(entry.code).toBeTruthy();
      expect(entry.description).toBeTruthy();
      expect(entry.suggestedAction).toBeTruthy();
    }
  });

  it('includes all contract_error_N codes (0–5)', () => {
    const codes = getAllContractErrorCodes().map((c) => c.code);
    for (let n = 0; n <= 5; n++) {
      expect(codes).toContain(`contract_error_${n}`);
    }
  });

  it('includes payroll-specific codes', () => {
    const codes = getAllContractErrorCodes().map((c) => c.code);
    expect(codes).toContain('payroll_duplicate_period');
    expect(codes).toContain('payroll_employee_not_found');
  });

  it('includes cross-asset payment codes', () => {
    const codes = getAllContractErrorCodes().map((c) => c.code);
    expect(codes).toContain('swap_slippage_exceeded');
    expect(codes).toContain('no_liquidity');
  });
});
