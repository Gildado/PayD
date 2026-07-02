import { getAssetByCode } from '../config/assets';

export interface PreflightCheckEmployee {
  name: string;
  walletAddress: string;
  amount: string;
  currency: string;
}

export interface PreflightIssue {
  type: string;
  message: string;
}

export interface PreflightCheckResult {
  employeeName: string;
  walletAddress: string;
  issues: PreflightIssue[];
  status: 'pass' | 'fail';
}

interface HorizonAccountResponse {
  id: string;
  balances: HorizonBalanceItem[];
}

interface HorizonBalanceItem {
  balance: string;
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
}

export function getHorizonUrl(): string {
  const envUrl = import.meta.env.PUBLIC_STELLAR_HORIZON_URL as string | undefined;
  return envUrl?.replace(/\/+$/, '') || 'https://horizon-testnet.stellar.org';
}

export async function checkAccountExists(
  accountId: string,
  horizonUrl: string
): Promise<boolean> {
  const response = await fetch(
    `${horizonUrl}/accounts/${encodeURIComponent(accountId)}`,
    { headers: { Accept: 'application/json' } }
  );

  if (response.status === 404) return false;
  if (!response.ok) {
    throw new Error(
      `Horizon account request failed: ${response.status} ${response.statusText}`
    );
  }

  return true;
}

export async function checkTrustline(
  accountId: string,
  assetCode: string,
  assetIssuer: string | null,
  horizonUrl: string
): Promise<boolean> {
  if (!assetIssuer) return true;

  const response = await fetch(
    `${horizonUrl}/accounts/${encodeURIComponent(accountId)}`,
    { headers: { Accept: 'application/json' } }
  );

  if (response.status === 404) return false;
  if (!response.ok) {
    throw new Error(
      `Horizon account request failed: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as HorizonAccountResponse;

  return data.balances.some(
    (b) =>
      b.asset_type !== 'native' &&
      b.asset_code === assetCode &&
      b.asset_issuer === assetIssuer
  );
}

export async function checkBalance(
  accountId: string,
  minBalance: string,
  horizonUrl: string
): Promise<boolean> {
  const response = await fetch(
    `${horizonUrl}/accounts/${encodeURIComponent(accountId)}`,
    { headers: { Accept: 'application/json' } }
  );

  if (response.status === 404) return false;
  if (!response.ok) {
    throw new Error(
      `Horizon account request failed: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as HorizonAccountResponse;

  const nativeBalance = data.balances.find((b) => b.asset_type === 'native');
  if (!nativeBalance) return false;

  return parseFloat(nativeBalance.balance) >= parseFloat(minBalance);
}

export async function runPreflightChecks(
  batch: PreflightCheckEmployee[],
  horizonUrl?: string
): Promise<PreflightCheckResult[]> {
  const url = horizonUrl ?? getHorizonUrl();

  const results = await Promise.all(
    batch.map(async (employee) => {
      const issues: PreflightIssue[] = [];

      try {
        const accountExists = await checkAccountExists(employee.walletAddress, url);

        if (!accountExists) {
          issues.push({
            type: 'account_not_found',
            message: `Account ${employee.walletAddress} does not exist on the Stellar network`,
          });
        } else {
          const asset = getAssetByCode(employee.currency.toUpperCase());
          if (asset && asset.code !== 'XLM') {
            const hasTrustline = await checkTrustline(
              employee.walletAddress,
              asset.code,
              asset.issuer,
              url
            );

            if (!hasTrustline) {
              issues.push({
                type: 'no_trustline',
                message: `Account does not have a trustline for ${employee.currency}`,
              });
            }
          }

          const hasMinBalance = await checkBalance(employee.walletAddress, '1', url);
          if (!hasMinBalance) {
            issues.push({
              type: 'insufficient_balance',
              message:
                'Account may not have enough XLM to cover minimum balance requirements',
            });
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error during preflight check';
        issues.push({
          type: 'check_error',
          message: errorMessage,
        });
      }

      return {
        employeeName: employee.name,
        walletAddress: employee.walletAddress,
        issues,
        status: issues.length > 0 ? 'fail' : 'pass',
      };
    })
  );

  return results;
}
