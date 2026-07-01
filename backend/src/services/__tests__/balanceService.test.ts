import { BalanceService } from '../balanceService.js';

jest.mock('../stellarService.js', () => ({
  StellarService: {
    getServer: jest.fn().mockReturnValue({
      loadAccount: jest.fn(),
    }),
  },
}));

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { StellarService } from '../stellarService.js';

const mockServer = StellarService.getServer() as any;

describe('BalanceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAssetBalance', () => {
    it('returns native XLM balance', async () => {
      mockServer.loadAccount.mockResolvedValue({
        balances: [{ asset_type: 'native', balance: '100.0000000' }],
      });

      const result = await BalanceService.getAssetBalance('GABC', 'XLM', null);

      expect(result.balance).toBe('100.0000000');
      expect(result.exists).toBe(true);
    });

    it('returns custom asset balance', async () => {
      mockServer.loadAccount.mockResolvedValue({
        balances: [
          {
            asset_type: 'credit_alphanum4',
            asset_code: 'USDC',
            asset_issuer: 'GISSUER',
            balance: '500.0000000',
          },
        ],
      });

      const result = await BalanceService.getAssetBalance('GABC', 'USDC', 'GISSUER');

      expect(result.balance).toBe('500.0000000');
      expect(result.exists).toBe(true);
    });

    it('returns zero when trustline missing', async () => {
      mockServer.loadAccount.mockResolvedValue({
        balances: [{ asset_type: 'native', balance: '50.0000000' }],
      });

      const result = await BalanceService.getAssetBalance('GABC', 'USDC', 'GISSUER');

      expect(result.balance).toBe('0');
      expect(result.exists).toBe(false);
    });
  });

  describe('preflightCheck', () => {
    it('returns sufficient when balance covers payments', async () => {
      mockServer.loadAccount.mockResolvedValue({
        balances: [
          {
            asset_type: 'credit_alphanum4',
            asset_code: 'USDC',
            asset_issuer: 'GISSUER',
            balance: '1000.0000000',
          },
        ],
      });

      const result = await BalanceService.preflightCheck('GABC', 'USDC', 'GISSUER', [
        { employeeId: '1', employeeName: 'Alice', walletAddress: 'GALICE', amount: '500' },
      ]);

      expect(result.sufficient).toBe(true);
      expect(result.shortfall).toBe('0');
    });

    it('returns insufficient when balance is below total', async () => {
      mockServer.loadAccount.mockResolvedValue({
        balances: [
          {
            asset_type: 'credit_alphanum4',
            asset_code: 'USDC',
            asset_issuer: 'GISSUER',
            balance: '100.0000000',
          },
        ],
      });

      const result = await BalanceService.preflightCheck('GABC', 'USDC', 'GISSUER', [
        { employeeId: '1', employeeName: 'Alice', walletAddress: 'GALICE', amount: '500' },
      ]);

      expect(result.sufficient).toBe(false);
      expect(parseFloat(result.shortfall)).toBeGreaterThan(0);
    });
  });

  describe('preflightCheckWithAutoRefund', () => {
    it('returns immediately if balance is sufficient', async () => {
      mockServer.loadAccount.mockResolvedValue({
        balances: [
          {
            asset_type: 'credit_alphanum4',
            asset_code: 'USDC',
            asset_issuer: 'GISSUER',
            balance: '1000.0000000',
          },
        ],
      });

      const refundFn = jest.fn();

      const result = await BalanceService.preflightCheckWithAutoRefund(
        'GABC',
        'USDC',
        'GISSUER',
        [{ employeeId: '1', employeeName: 'Alice', walletAddress: 'GALICE', amount: '500' }],
        refundFn
      );

      expect(result.sufficient).toBe(true);
      expect(refundFn).not.toHaveBeenCalled();
    });

    it('calls refund function and re-checks when insufficient', async () => {
      let callCount = 0;
      mockServer.loadAccount.mockImplementation(() => {
        callCount++;
        if (callCount <= 1) {
          return Promise.resolve({
            balances: [
              {
                asset_type: 'credit_alphanum4',
                asset_code: 'USDC',
                asset_issuer: 'GISSUER',
                balance: '100.0000000',
              },
            ],
          });
        }
        return Promise.resolve({
          balances: [
            {
              asset_type: 'credit_alphanum4',
              asset_code: 'USDC',
              asset_issuer: 'GISSUER',
              balance: '2000.0000000',
            },
          ],
        });
      });

      const refundFn = jest.fn().mockResolvedValue(undefined);

      const result = await BalanceService.preflightCheckWithAutoRefund(
        'GABC',
        'USDC',
        'GISSUER',
        [{ employeeId: '1', employeeName: 'Alice', walletAddress: 'GALICE', amount: '500' }],
        refundFn
      );

      expect(refundFn).toHaveBeenCalledTimes(1);
      expect(result.sufficient).toBe(true);
    });

    it('returns original result when refund function is not provided', async () => {
      mockServer.loadAccount.mockResolvedValue({
        balances: [
          {
            asset_type: 'credit_alphanum4',
            asset_code: 'USDC',
            asset_issuer: 'GISSUER',
            balance: '10.0000000',
          },
        ],
      });

      const result = await BalanceService.preflightCheckWithAutoRefund(
        'GABC',
        'USDC',
        'GISSUER',
        [{ employeeId: '1', employeeName: 'Alice', walletAddress: 'GALICE', amount: '500' }]
      );

      expect(result.sufficient).toBe(false);
    });

    it('returns original result when refund function throws', async () => {
      mockServer.loadAccount.mockResolvedValue({
        balances: [
          {
            asset_type: 'credit_alphanum4',
            asset_code: 'USDC',
            asset_issuer: 'GISSUER',
            balance: '10.0000000',
          },
        ],
      });

      const refundFn = jest.fn().mockRejectedValue(new Error('Refund failed'));

      const result = await BalanceService.preflightCheckWithAutoRefund(
        'GABC',
        'USDC',
        'GISSUER',
        [{ employeeId: '1', employeeName: 'Alice', walletAddress: 'GALICE', amount: '500' }],
        refundFn
      );

      expect(result.sufficient).toBe(false);
      expect(refundFn).toHaveBeenCalledTimes(1);
    });
  });
});
