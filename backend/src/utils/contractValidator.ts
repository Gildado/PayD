/**
 * Contract Validator Utility
 * Validates Soroban contract entries for the Contract Address Registry API
 */

export interface ContractEntry {
  contractId: string;
  network: string;
  contractType: string;
  version: string;
  deployedAt: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates a Stellar contract address format
 * Format: C followed by exactly 56 alphanumeric characters
 */
export function validateContractId(contractId: string): boolean {
  const stellarContractRegex = /^C[A-Z0-9]{56}$/;
  return stellarContractRegex.test(contractId);
}

/**
 * Validates network value
 */
export function validateNetwork(network: string): boolean {
  return network === 'testnet' || network === 'mainnet';
}

/**
 * Validates deployedAt ledger sequence
 */
export function validateDeployedAt(deployedAt: number): boolean {
  return Number.isInteger(deployedAt) && deployedAt > 0;
}

/**
 * Validates a complete contract entry
 */
export function validateContractEntry(entry: Partial<ContractEntry>): ValidationResult {
  const errors: string[] = [];

  // Check required fields
  if (!entry.contractId) {
    errors.push('Missing required field: contractId');
  } else if (!validateContractId(entry.contractId)) {
    errors.push(`Invalid contractId format: ${entry.contractId}. Must be C followed by 56 alphanumeric characters`);
  }

  if (!entry.network) {
    errors.push('Missing required field: network');
  } else if (!validateNetwork(entry.network)) {
    errors.push(`Invalid network value: ${entry.network}. Must be "testnet" or "mainnet"`);
  }

  if (!entry.contractType) {
    errors.push('Missing required field: contractType');
  }

  if (!entry.version) {
    errors.push('Missing required field: version');
  }

  if (entry.deployedAt === undefined || entry.deployedAt === null) {
    errors.push('Missing required field: deployedAt');
  } else if (!validateDeployedAt(entry.deployedAt)) {
    errors.push(`Invalid deployedAt value: ${entry.deployedAt}. Must be a positive integer`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
