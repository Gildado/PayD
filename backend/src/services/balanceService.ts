import { StellarService } from './stellarService.js';
import logger from '../utils/logger.js';
import { RequestCoalescer } from '../utils/requestCoalescer.js';
import { mapWithConcurrency } from '../utils/concurrencyPool.js';

/** Default number of concurrent Horizon lookups used by batch balance fetches. */
export const DEFAULT_BALANCE_LOOKUP_CONCURRENCY = 5;
/** Hard upper bound so a misconfigured env value cannot flood Horizon. */
export const MAX_BALANCE_LOOKUP_CONCURRENCY = 50;

/**
 * Resolves the batch lookup concurrency from `BALANCE_LOOKUP_CONCURRENCY`.
 * Invalid or non-positive values fall back to the default; values above the
 * hard cap are clamped to it.
 */
export function getBalanceLookupConcurrency(
  raw: string | undefined = process.env.BALANCE_LOOKUP_CONCURRENCY
): number {
  const parsed = parseInt(raw ?? '', 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_BALANCE_LOOKUP_CONCURRENCY;
  }
  return Math.min(parsed, MAX_BALANCE_LOOKUP_CONCURRENCY);
}

export interface BalanceLookupRequest {
  accountPublicKey: string;
  assetCode: string;
  assetIssuer: string | null;
}

export type BalanceLookupResult = { balance: string; exists: boolean };

export interface PaymentEntry {
  employeeId: string;
  employeeName: string;
  walletAddress: string;
  amount: string;
}

export interface ShortfallDetail {
  employeeId: string;
  employeeName: string;
  amount: string;
}

export interface PreflightResult {
  sufficient: boolean;
  distributionAccount: string;
  assetCode: string;
  availableBalance: string;
  totalRequired: string;
  shortfall: string;
  scheduledPayments: number;
  breakdown: ShortfallDetail[];
}

export class BalanceService {
  /**
   * Shared in-flight `loadAccount` calls, keyed by account public key.
   * Concurrent lookups for the same account (any asset) share one Horizon request.
   */
  private static readonly accountCoalescer = new RequestCoalescer<string, any>();

  /**
   * Fetch an account from Horizon, coalescing concurrent identical requests.
   */
  static loadAccountCoalesced(accountPublicKey: string): Promise<any> {
    return BalanceService.accountCoalescer.run(accountPublicKey, () =>
      StellarService.getServer().loadAccount(accountPublicKey)
    );
  }

  /**
   * Query Horizon for the balance of a given asset on an account.
   * Returns "0" and exists=false if the account has no trustline for the asset.
   * Pass assetCode='XLM' and assetIssuer=null (or '') to query the native balance.
   * Concurrent calls for the same account share a single Horizon fetch.
   */
  static async getAssetBalance(
    accountPublicKey: string,
    assetCode: string,
    assetIssuer: string | null
  ): Promise<BalanceLookupResult> {
    const account = await BalanceService.loadAccountCoalesced(accountPublicKey);

    if (assetCode === 'XLM') {
      const nativeEntry = account.balances.find((b: any) => b.asset_type === 'native');
      return nativeEntry
        ? { balance: (nativeEntry as any).balance, exists: true }
        : { balance: '0', exists: false };
    }

    const entry = account.balances.find(
      (b: any) =>
        (b.asset_type === 'credit_alphanum12' || b.asset_type === 'credit_alphanum4') &&
        b.asset_code === assetCode &&
        b.asset_issuer === assetIssuer
    );

    if (!entry) {
      return { balance: '0', exists: false };
    }

    return { balance: (entry as any).balance, exists: true };
  }

  /**
   * @deprecated Use `getAssetBalance` instead.
   * Kept for backward-compatibility with existing callers that specify ORGUSD.
   */
  static async getOrgUsdBalance(
    accountPublicKey: string,
    assetIssuer: string
  ): Promise<{ balance: string; exists: boolean }> {
    return BalanceService.getAssetBalance(accountPublicKey, 'ORGUSD', assetIssuer);
  }

  /**
   * Batch balance lookup with bounded concurrency (issue #1806).
   *
   * Runs `getAssetBalance` for every request with at most `concurrency`
   * Horizon calls in flight. Results keep the input order and are settled
   * individually, so one failing account does not fail the whole batch.
   *
   * @param requests    - Lookups to perform
   * @param concurrency - Max parallel lookups; defaults to BALANCE_LOOKUP_CONCURRENCY
   */
  static async getAssetBalancesBatch(
    requests: BalanceLookupRequest[],
    concurrency: number = getBalanceLookupConcurrency()
  ): Promise<PromiseSettledResult<BalanceLookupResult>[]> {
    return mapWithConcurrency(requests, concurrency, (req) =>
      BalanceService.getAssetBalance(req.accountPublicKey, req.assetCode, req.assetIssuer)
    );
  }

  /**
   * Run a preflight balance check before payroll execution.
   * Compares the distribution account's balance of `assetCode` against
   * the total of all scheduled payments. Returns a shortfall report when
   * the balance is insufficient.
   *
   * @param distributionAccount - Stellar public key of the paying account
   * @param assetCode           - Asset code to check ('USDC', 'EURC', 'ORGUSD', 'XLM', …)
   * @param assetIssuer         - Issuer address; null / '' for XLM
   * @param payments            - List of payment entries to total up
   */
  static async preflightCheck(
    distributionAccount: string,
    assetCode: string,
    assetIssuer: string | null,
    payments: PaymentEntry[]
  ): Promise<PreflightResult> {
    const { balance, exists } = await BalanceService.getAssetBalance(
      distributionAccount,
      assetCode,
      assetIssuer
    );

    const available = parseFloat(balance);
    const totalRequired = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

    const shortfall = totalRequired - available;
    const sufficient = exists && available >= totalRequired;

    const breakdown: ShortfallDetail[] = payments.map((p) => ({
      employeeId: p.employeeId,
      employeeName: p.employeeName,
      amount: p.amount,
    }));

    return {
      sufficient,
      distributionAccount,
      assetCode,
      availableBalance: balance,
      totalRequired: totalRequired.toFixed(7),
      shortfall: sufficient ? '0' : shortfall.toFixed(7),
      scheduledPayments: payments.length,
      breakdown,
    };
  }

  /**
   * Performs a preflight check and, if insufficient, attempts auto-refunding
   * by invoking the on-chain `check_and_refund` contract function, then
   * re-checks the balance.
   *
   * Falls back to the standard preflight result if auto-refund is unavailable
   * or fails.
   */
  static async preflightCheckWithAutoRefund(
    distributionAccount: string,
    assetCode: string,
    assetIssuer: string | null,
    payments: PaymentEntry[],
    contractRefundFn?: () => Promise<void>
  ): Promise<PreflightResult> {
    const initial = await BalanceService.preflightCheck(
      distributionAccount,
      assetCode,
      assetIssuer,
      payments
    );

    if (initial.sufficient) {
      return initial;
    }

    if (!contractRefundFn) {
      return initial;
    }

    try {
      logger.info(
        `Auto-refund triggered for ${distributionAccount}: shortfall=${initial.shortfall} ${assetCode}`
      );
      await contractRefundFn();

      const recheck = await BalanceService.preflightCheck(
        distributionAccount,
        assetCode,
        assetIssuer,
        payments
      );

      if (recheck.sufficient) {
        logger.info(
          `Auto-refund successful for ${distributionAccount}: balance now ${recheck.availableBalance}`
        );
      } else {
        logger.warn(
          `Auto-refund completed but balance still insufficient: ${recheck.availableBalance} < ${recheck.totalRequired}`
        );
      }

      return recheck;
    } catch (refundError) {
      logger.warn('Auto-refund attempt failed, returning original preflight result', {
        error: refundError instanceof Error ? refundError.message : 'Unknown error',
      });
      return initial;
    }
  }
}
