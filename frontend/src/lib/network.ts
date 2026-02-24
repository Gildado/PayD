/**
 * Stellar/Soroban network configuration.
 * Contributors: see FE-4 for full implementation.
 */

export const NETWORK = {
  name: 'Testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
  rpcUrl: 'https://soroban-testnet.stellar.org',
  horizonUrl: 'https://horizon-testnet.stellar.org',
} as const

/**
 * Contract IDs — these will be populated after deployment.
 * TODO: Add deployed contract IDs (contributor task FE-4)
 */
export const CONTRACTS = {
  treasury: '',
  payrollStream: '',
  vesting: '',
  governance: '',
} as const

/**
 * Creates a Soroban Server instance for RPC calls.
 * TODO: Implement full provider setup (contributor task FE-4)
 */
export function getSorobanServer() {
  // Return placeholder — contributor should implement with @stellar/stellar-sdk
  return null
}
