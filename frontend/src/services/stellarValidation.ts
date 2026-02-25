import { Horizon } from '@stellar/stellar-sdk';

const BASE_RESERVE = 0.5; // XLM

export interface BatchItem {
  id: string;
  name: string;
  walletAddress: string;
  amount: string;
  assetCode: string;
}

export interface EmployeeValidationResult {
  id: string;
  name: string;
  walletAddress: string;
  accountExists: boolean;
  missingTrustlines: string[];
  success: boolean;
}

export interface ValidationReport {
  orgHasSufficientXlm: boolean;
  orgXlmBalance: number;
  requiredXlm: number;
  employeeResults: EmployeeValidationResult[];
  success: boolean;
}

export async function validateBatchRequirements(
  orgPublicKey: string,
  batchConfig: BatchItem[],
  estimatedFeesStroops: number,
  horizonUrl?: string
): Promise<ValidationReport> {
  const url = horizonUrl || import.meta.env.PUBLIC_STELLAR_HORIZON_URL?.replace(/\/+$/, '') || 'https://horizon-testnet.stellar.org';
  const server = new Horizon.Server(url);

  let orgBalance = 0;
  try {
    const orgAccount = await server.loadAccount(orgPublicKey);
    const xlmBalance = orgAccount.balances.find((b) => b.asset_type === 'native');
    orgBalance = xlmBalance ? parseFloat(xlmBalance.balance) : 0;
  } catch (err) {
    // Org account might not exist
  }

  // Base Reserve + Estimated Fees (converted to XLM)
  const requiredXlm = BASE_RESERVE + (estimatedFeesStroops / 10000000);
  const orgHasSufficientXlm = orgBalance >= requiredXlm;

  const employeeResults: EmployeeValidationResult[] = [];

  for (const item of batchConfig) {
    let accountExists = false;
    const missingTrustlines: string[] = [];

    if (!item.walletAddress || item.walletAddress.length < 50) {
      employeeResults.push({
        id: item.id,
        name: item.name,
        walletAddress: item.walletAddress || '',
        accountExists: false,
        missingTrustlines: item.assetCode !== 'XLM' ? [item.assetCode] : [],
        success: false
      });
      continue;
    }

    try {
      const empAccount = await server.loadAccount(item.walletAddress);
      accountExists = true;

      if (item.assetCode !== 'XLM') {
        const hasTrustline = empAccount.balances.some((b) =>
          ('asset_code' in b && b.asset_code === item.assetCode)
        );
        if (!hasTrustline) {
          missingTrustlines.push(item.assetCode);
        }
      }
    } catch {
      accountExists = false;
      if (item.assetCode !== 'XLM') {
        missingTrustlines.push(item.assetCode);
      }
    }

    const success = accountExists && missingTrustlines.length === 0;

    employeeResults.push({
      id: item.id,
      name: item.name,
      walletAddress: item.walletAddress,
      accountExists,
      missingTrustlines,
      success,
    });
  }

  const allEmployeesSuccess = employeeResults.every((r) => r.success);
  const success = orgHasSufficientXlm && allEmployeesSuccess;

  return {
    orgHasSufficientXlm,
    orgXlmBalance: orgBalance,
    requiredXlm,
    employeeResults,
    success,
  };
}
