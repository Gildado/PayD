/**
 * Freighter wallet utilities.
 * Contributors: see FE-2 for full implementation.
 */

/**
 * Check if Freighter wallet extension is installed.
 * TODO: Implement with @stellar/freighter-api (contributor task FE-2)
 */
export async function isFreighterInstalled(): Promise<boolean> {
  return false
}

/**
 * Connect to Freighter and get the user's public key.
 * TODO: Implement with @stellar/freighter-api (contributor task FE-2)
 */
export async function connectWallet(): Promise<string | null> {
  return null
}

/**
 * Sign a Soroban transaction XDR using Freighter.
 * TODO: Implement signing flow (contributor task FE-2)
 */
export async function signTransaction(xdr: string, network: string): Promise<string> {
  throw new Error('Not implemented — see FE-2')
}
