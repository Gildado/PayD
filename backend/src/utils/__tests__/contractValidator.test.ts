import {
  validateContractId,
  validateNetwork,
  validateDeployedAt,
  validateContractEntry,
  type ContractEntry,
} from '../contractValidator.js';

// ─── validateContractId ───────────────────────────────────────────────────────

describe('validateContractId', () => {
  const VALID_ID = 'C' + 'A'.repeat(56); // 'C' + 56 uppercase chars = 57 chars total

  it('accepts a well-formed Stellar contract ID', () => {
    expect(validateContractId(VALID_ID)).toBe(true);
  });

  it('rejects an ID that does not start with C', () => {
    expect(validateContractId('D' + 'A'.repeat(56))).toBe(false);
  });

  it('rejects an ID that is too short', () => {
    expect(validateContractId('C' + 'A'.repeat(55))).toBe(false);
  });

  it('rejects an ID that is too long', () => {
    expect(validateContractId('C' + 'A'.repeat(57))).toBe(false);
  });

  it('rejects lowercase characters', () => {
    expect(validateContractId('C' + 'a'.repeat(56))).toBe(false);
  });

  it('rejects special characters', () => {
    expect(validateContractId('C' + '!'.repeat(56))).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(validateContractId('')).toBe(false);
  });
});

// ─── validateNetwork ──────────────────────────────────────────────────────────

describe('validateNetwork', () => {
  it('accepts "testnet"', () => {
    expect(validateNetwork('testnet')).toBe(true);
  });

  it('accepts "mainnet"', () => {
    expect(validateNetwork('mainnet')).toBe(true);
  });

  it('rejects "stagingnet"', () => {
    expect(validateNetwork('stagingnet')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(validateNetwork('')).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(validateNetwork('Testnet')).toBe(false);
    expect(validateNetwork('MAINNET')).toBe(false);
  });
});

// ─── validateDeployedAt ───────────────────────────────────────────────────────

describe('validateDeployedAt', () => {
  it('accepts a positive integer', () => {
    expect(validateDeployedAt(1)).toBe(true);
    expect(validateDeployedAt(999999)).toBe(true);
  });

  it('rejects zero', () => {
    expect(validateDeployedAt(0)).toBe(false);
  });

  it('rejects negative numbers', () => {
    expect(validateDeployedAt(-1)).toBe(false);
  });

  it('rejects floating-point numbers', () => {
    expect(validateDeployedAt(1.5)).toBe(false);
  });

  it('rejects NaN', () => {
    expect(validateDeployedAt(NaN)).toBe(false);
  });
});

// ─── validateContractEntry ────────────────────────────────────────────────────

describe('validateContractEntry', () => {
  const VALID_ENTRY: ContractEntry = {
    contractId: 'C' + 'A'.repeat(56),
    network: 'testnet',
    contractType: 'payment',
    version: '1.0.0',
    deployedAt: 500000,
  };

  it('returns isValid=true for a fully valid entry', () => {
    const result = validateContractEntry(VALID_ENTRY);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('reports an error for a missing contractId', () => {
    const { contractId: _omit, ...rest } = VALID_ENTRY;
    const result = validateContractEntry(rest);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('contractId'))).toBe(true);
  });

  it('reports an error for an invalid contractId format', () => {
    const result = validateContractEntry({ ...VALID_ENTRY, contractId: 'INVALID' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('contractId'))).toBe(true);
  });

  it('reports an error for a missing network', () => {
    const { network: _omit, ...rest } = VALID_ENTRY;
    const result = validateContractEntry(rest);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('network'))).toBe(true);
  });

  it('reports an error for an invalid network', () => {
    const result = validateContractEntry({ ...VALID_ENTRY, network: 'localnet' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('network'))).toBe(true);
  });

  it('reports an error for a missing contractType', () => {
    const { contractType: _omit, ...rest } = VALID_ENTRY;
    const result = validateContractEntry(rest);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('contractType'))).toBe(true);
  });

  it('reports an error for a missing version', () => {
    const { version: _omit, ...rest } = VALID_ENTRY;
    const result = validateContractEntry(rest);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('version'))).toBe(true);
  });

  it('reports an error for a missing deployedAt', () => {
    const { deployedAt: _omit, ...rest } = VALID_ENTRY;
    const result = validateContractEntry(rest);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('deployedAt'))).toBe(true);
  });

  it('reports an error for an invalid deployedAt (zero)', () => {
    const result = validateContractEntry({ ...VALID_ENTRY, deployedAt: 0 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('deployedAt'))).toBe(true);
  });

  it('accumulates multiple errors at once', () => {
    const result = validateContractEntry({});
    expect(result.errors.length).toBeGreaterThan(1);
    expect(result.isValid).toBe(false);
  });
});
