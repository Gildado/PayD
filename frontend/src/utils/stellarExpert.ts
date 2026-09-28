/**
 * Stellar Expert Explorer URL helpers.
 *
 * Centralises the construction of Stellar Expert links so every component
 * uses a consistent URL scheme.  The `network` parameter accepts the values
 * used internally by the app ('MAINNET', 'TESTNET', 'PUBLIC', 'public',
 * 'testnet') and maps them to the two path segments that Stellar Expert
 * recognises: `public` and `testnet`.
 *
 * When no network is supplied the helper falls back to the
 * `VITE_STELLAR_EXPLORER_TX_URL` environment variable (which itself defaults
 * to testnet), keeping behaviour consistent with the rest of the app.
 */

const EXPLORER_BASE =
  (import.meta.env.VITE_STELLAR_EXPLORER_TX_URL as string | undefined) ||
  'https://stellar.expert/explorer/testnet/tx/';

/**
 * Resolve a human-friendly network string to the specific path segment
 * recognized by Stellar Expert (`public` or `testnet`).
 *
 * @param network - Network identifier (e.g., 'MAINNET', 'TESTNET', 'public')
 * @returns The corresponding path segment: `'public'` or `'testnet'`
 */
function resolveNetwork(network: string): 'public' | 'testnet' {
  const lower = network.toLowerCase();
  return lower === 'mainnet' || lower === 'public' ? 'public' : 'testnet';
}

/**
 * Build a full Stellar Expert transaction explorer URL.
 *
 * @param txHash - The 64-character hex transaction hash
 * @param network - Optional network identifier; when omitted, the
 *                `VITE_STELLAR_EXPLORER_TX_URL` env var is used as a base
 * @returns The complete transaction explorer URL
 */
export function getTxExplorerUrl(txHash: string, network?: string): string {
  if (network) {
    const net = resolveNetwork(network);
    return `https://stellar.expert/explorer/${net}/tx/${txHash}`;
  }
  const base = EXPLORER_BASE.endsWith('/') ? EXPLORER_BASE : `${EXPLORER_BASE}/`;
  return `${base}${txHash}`;
}
