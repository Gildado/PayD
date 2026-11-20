import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { StellarService } from '../stellarService.js';
import {
  BalanceService,
  getBalanceLookupConcurrency,
  DEFAULT_BALANCE_LOOKUP_CONCURRENCY,
  MAX_BALANCE_LOOKUP_CONCURRENCY,
} from '../balanceService.js';

/**
 * Coalescing and batch behaviour of BalanceService (issue #1806).
 *
 * Uses jest.spyOn rather than jest.mock so the suite runs under the project's
 * ESM Jest configuration (NODE_OPTIONS=--experimental-vm-modules).
 */
describe('BalanceService coalescing and batch lookups', () => {
  let loadAccount: jest.Mock<(pk: string) => Promise<any>>;
  let getServerSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    loadAccount = jest.fn<(pk: string) => Promise<any>>();
    getServerSpy = jest.spyOn(StellarService, 'getServer').mockReturnValue({ loadAccount } as any);
  });

  afterEach(() => {
    getServerSpy.mockRestore();
  });

  describe('getBalanceLookupConcurrency', () => {
    it('falls back to the default when unset or invalid', () => {
      expect(getBalanceLookupConcurrency(undefined)).toBe(DEFAULT_BALANCE_LOOKUP_CONCURRENCY);
      expect(getBalanceLookupConcurrency('')).toBe(DEFAULT_BALANCE_LOOKUP_CONCURRENCY);
      expect(getBalanceLookupConcurrency('abc')).toBe(DEFAULT_BALANCE_LOOKUP_CONCURRENCY);
      expect(getBalanceLookupConcurrency('0')).toBe(DEFAULT_BALANCE_LOOKUP_CONCURRENCY);
      expect(getBalanceLookupConcurrency('-3')).toBe(DEFAULT_BALANCE_LOOKUP_CONCURRENCY);
    });

    it('honours a valid configured value', () => {
      expect(getBalanceLookupConcurrency('8')).toBe(8);
    });

    it('clamps values above the hard cap', () => {
      expect(getBalanceLookupConcurrency('10000')).toBe(MAX_BALANCE_LOOKUP_CONCURRENCY);
    });
  });

  describe('request coalescing', () => {
    it('concurrent identical lookups share one loadAccount fetch', async () => {
      let resolveLoad!: (v: unknown) => void;
      loadAccount.mockReturnValue(
        new Promise((res) => {
          resolveLoad = res;
        })
      );

      const calls = Promise.all([
        BalanceService.getAssetBalance('GCOALESCE', 'XLM', null),
        BalanceService.getAssetBalance('GCOALESCE', 'XLM', null),
        BalanceService.getAssetBalance('GCOALESCE', 'XLM', null),
      ]);

      resolveLoad({ balances: [{ asset_type: 'native', balance: '7.0000000' }] });
      const results = await calls;

      expect(loadAccount).toHaveBeenCalledTimes(1);
      results.forEach((r) => expect(r.balance).toBe('7.0000000'));
    });

    it('different accounts are fetched independently', async () => {
      loadAccount.mockResolvedValue({ balances: [{ asset_type: 'native', balance: '1.0000000' }] });

      await Promise.all([
        BalanceService.getAssetBalance('GONE', 'XLM', null),
        BalanceService.getAssetBalance('GTWO', 'XLM', null),
      ]);

      expect(loadAccount).toHaveBeenCalledTimes(2);
    });

    it('a failed shared fetch rejects every waiter and is not cached', async () => {
      loadAccount.mockRejectedValue(new Error('404 not found'));

      const results = await Promise.allSettled([
        BalanceService.getAssetBalance('GFAIL', 'XLM', null),
        BalanceService.getAssetBalance('GFAIL', 'XLM', null),
      ]);
      expect(loadAccount).toHaveBeenCalledTimes(1);
      expect(results.every((r) => r.status === 'rejected')).toBe(true);

      loadAccount.mockResolvedValue({ balances: [{ asset_type: 'native', balance: '2.0000000' }] });
      const retry = await BalanceService.getAssetBalance('GFAIL', 'XLM', null);
      expect(retry.balance).toBe('2.0000000');
      expect(loadAccount).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAssetBalancesBatch', () => {
    it('keeps input order, settles failures individually, and respects the limit', async () => {
      let active = 0;
      let peak = 0;
      loadAccount.mockImplementation(async (pk: string) => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 2));
        active--;
        if (pk === 'GBAD') throw new Error('boom');
        return { balances: [{ asset_type: 'native', balance: String(pk.length) }] };
      });

      const requests = ['GA1', 'GBAD', 'GA3', 'GA4', 'GA5'].map((accountPublicKey) => ({
        accountPublicKey,
        assetCode: 'XLM',
        assetIssuer: null,
      }));

      const results = await BalanceService.getAssetBalancesBatch(requests, 2);

      expect(peak).toBeLessThanOrEqual(2);
      expect(results).toHaveLength(5);
      expect(results[0]).toEqual({ status: 'fulfilled', value: { balance: '3', exists: true } });
      expect(results[1]?.status).toBe('rejected');
      expect(results[4]?.status).toBe('fulfilled');
    });
  });
});
