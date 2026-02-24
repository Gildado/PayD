'use client'

/**
 * Hook to interact with the Treasury contract.
 * Contributors: see FE-6 for full implementation.
 */
export function useTreasury() {
  // TODO: Implement treasury data fetching and actions (contributor task FE-6)
  return {
    signers: [],
    threshold: 0,
    proposals: [],
    isLoading: true,
    deposit: async (_token: string, _amount: number) => {},
    createWithdrawal: async (_token: string, _recipient: string, _amount: number) => {},
    approveWithdrawal: async (_proposalId: number) => {},
  }
}
