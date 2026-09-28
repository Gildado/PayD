import { describe, expect, test } from 'vitest';
import { parseContractError } from '../utils/contractErrorParser';

describe('contractErrorParser', () => {
  test('parses known Soroban contract codes with optional hash prefixes', () => {
    const parsed = parseContractError(undefined, 'HostError: Error(Contract, #7)');

    expect(parsed.code).toBe('CONTRACT_ERR_7');
    expect(parsed.message).toContain('Amount overflow');
  });

  test('parses unknown Soroban contract codes into a readable fallback', () => {
    const parsed = parseContractError(undefined, 'Error(Contract, 42)');

    expect(parsed.code).toBe('CONTRACT_ERR_42');
    expect(parsed.message).toContain('error code 42');
  });

  test('converts multisig and auth failures into human guidance', () => {
    const parsed = parseContractError(undefined, 'tx_bad_auth while invoking host function');

    expect(parsed.code).toBe('UNAUTHORIZED');
    expect(parsed.suggestedAction).toContain('multisig');
  });

  test('converts resource budget errors into actionable messaging', () => {
    const parsed = parseContractError(undefined, 'simulation failed: exceeded the budget');

    expect(parsed.code).toBe('RESOURCE_LIMIT');
    expect(parsed.message).toContain('resource budget');
  });
});
