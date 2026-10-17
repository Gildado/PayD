const WALLET_DISPLAY_NAMES: Record<string, string> = {
  freighter: 'Freighter',
  lobstr: 'LOBSTR',
  xbull: 'xBull',
};

/** Human-readable wallet name for a Stellar Wallets Kit id ("freighter" → "Freighter"). */
export function getWalletDisplayName(walletId: string | null): string | null {
  if (!walletId) return null;
  return (
    WALLET_DISPLAY_NAMES[walletId.toLowerCase()] ??
    walletId.charAt(0).toUpperCase() + walletId.slice(1)
  );
}
