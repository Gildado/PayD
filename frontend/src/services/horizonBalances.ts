/**
 * Minimal Horizon account reads for employer dashboard and UI balances.
 */

interface HorizonBalance {
  asset_type?: string;
  balance?: string;
}

interface HorizonAccountBalancesResponse {
  balances?: HorizonBalance[];
}

export async function fetchNativeXlmBalance(
  accountId: string,
  horizonUrl: string
): Promise<string | null> {
  const response = await fetch(`${horizonUrl}/accounts/${encodeURIComponent(accountId)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as HorizonAccountBalancesResponse;
  const native = data.balances?.find((b) => b.asset_type === 'native');
  if (!native?.balance) return null;
  return native.balance;
}
