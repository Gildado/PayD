/**
 * Contract Validator Utility
 * Validates Soroban contract entries for the Contract Address Registry API
 */

export interface ContractEntry {
  /** The 57-character Stellar contract ID (starts with 'C'). */
  contractId: string;
  /** The Stellar network name ('testnet' or 'mainnet'). */
  network: string;
  /** The type of contract (e.g., 'payment', 'token'). */
  contractType: string;
  /** Semantic version of the contract implementation. */
  version: string;
  /** Ledger sequence number when the contract was deployed. */
  deployedAt: number;
}

export interface ValidationResult {
  /** Whether the object passed all validation checks. */
  isValid: boolean;
  /** Array of human-readable error messages; empty when `isValid` is `true`. */
  errors: string[];
}

/**
 * Validates a Stellar/Soroban contract address format.
 * Must start with 'C' followed by exactly 56 base32 alphanumeric characters.
 *
 * @param contractId - The contract ID string to validate
 * @returns `true` if the format is valid, `false` otherwise
 */
export function validateContractId(contractId: string): boolean {
  const stellarContractRegex = /^C[A-Z0-9]{56}$/;
  return stellarContractRegex.test(contractId);
}

/**
 * Validates the Stellar network identifier.
 *
 * @param network - Network name; must be `'testnet'` or `'mainnet'`
 * @returns `true` if the network value is recognised, `false` otherwise
 */
export function validateNetwork(network: string): boolean {
  return network === 'testnet' || network === 'mainnet';
}

/**
 * Validates the ledger sequence number at which the contract was deployed.
 *
 * @param deployedAt - Ledger sequence number; must be a positive integer
 * @returns `true` if the value is a positive integer, `false` otherwise
 */
export function validateDeployedAt(deployedAt: number): boolean {
  // Ledger sequence is best-effort metadata; allow `0` when unknown/unset.
  return Number.isInteger(deployedAt) && deployedAt >= 0;
}

/**
 * Validates a complete contract entry against required fields and format rules.
 *
 * @param entry - Partial contract entry object to validate
 * @returns Validation result with isValid flag and array of error messages
 */
export function validateContractEntry(entry: Partial<ContractEntry>): ValidationResult {
  const errors: string[] = [];

  // Check required fields
  if (!entry.contractId) {
    errors.push('Missing required field: contractId');
  } else if (!validateContractId(entry.contractId)) {
    errors.push(
      `Invalid contractId format: ${entry.contractId}. Must be C followed by 56 alphanumeric characters`
    );
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
    errors.push(
      `Invalid deployedAt value: ${entry.deployedAt}. Must be a non-negative integer (0 when unknown)`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
