import { describe, it, expect } from 'vitest';
import { parseContractError } from '../contractErrorParser';

describe('contractErrorParser utils', () => {
  it('parses a known contract error code from simulation string', () => {
    const simulationError = 'Error(Contract, #3)'; // Unauthorized access
    const result = parseContractError(undefined, simulationError);
    expect(result.code).toBe('CONTRACT_ERR_3');
    expect(result.message).toBe('Unauthorized access');
  });

  it('parses a generic error pattern from simulation string', () => {
    const simulationError = 'transaction failed: insufficient funds';
    const result = parseContractError(undefined, simulationError);
    expect(result.code).toBe('INSUFFICIENT_FUNDS');
    expect(result.message).toContain('Insufficient balance');
  });

  it('handles unknown simulation errors gracefully', () => {
    const simulationError = 'something totally weird happened';
    const result = parseContractError(undefined, simulationError);
    expect(result.code).toBe('UNKNOWN_CONTRACT_ERROR');
    expect(result.message).toBe(simulationError);
  });

  it('returns a fallback for missing error information', () => {
    const result = parseContractError();
    expect(result.code).toBe('UNKNOWN_CONTRACT_ERROR');
    expect(result.suggestedAction).toContain('Check your network connection');
  });
});
