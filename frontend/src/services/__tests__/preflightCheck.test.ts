import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  checkAccountExists,
  checkTrustline,
  checkBalance,
  runPreflightChecks,
  type PreflightCheckEmployee,
} from '../preflightCheck';

const mockFetch = vi.fn();
const HORIZON_URL = 'https://horizon-testnet.stellar.org';

const createJsonResponse = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 404 ? 'Not Found' : status === 500 ? 'Server Error' : 'OK',
    json: () => Promise.resolve(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = mockFetch;
});

describe('checkAccountExists', () => {
  it('returns true when account exists', async () => {
    mockFetch.mockResolvedValueOnce(createJsonResponse({ id: 'GABCDEF' }));
    const result = await checkAccountExists('GABCDEF', HORIZON_URL);
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      `${HORIZON_URL}/accounts/GABCDEF`,
      { headers: { Accept: 'application/json' } }
    );
  });

  it('returns false on 404', async () => {
    mockFetch.mockResolvedValueOnce(createJsonResponse({}, 404));
    const result = await checkAccountExists('GABCDEF', HORIZON_URL);
    expect(result).toBe(false);
  });

  it('throws on server error', async () => {
    mockFetch.mockResolvedValueOnce(createJsonResponse({}, 500));
    await expect(checkAccountExists('GABCDEF', HORIZON_URL)).rejects.toThrow(
      'Horizon account request failed: 500 Server Error'
    );
  });

  it('encodes the account ID', async () => {
    mockFetch.mockResolvedValueOnce(createJsonResponse({ id: 'test' }));
    await checkAccountExists('GABC+DEF', HORIZON_URL);
    expect(mockFetch).toHaveBeenCalledWith(
      `${HORIZON_URL}/accounts/GABC%2BDEF`,
      expect.any(Object)
    );
  });
});

describe('checkTrustline', () => {
  const usdcIssuer = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

  it('returns true when trustline exists', async () => {
    mockFetch.mockResolvedValueOnce(
      createJsonResponse({
        id: 'GABCDEF',
        balances: [
          {
            balance: '100.0000000',
            asset_type: 'credit_alphanum4',
            asset_code: 'USDC',
            asset_issuer: usdcIssuer,
          },
        ],
      })
    );
    const result = await checkTrustline('GABCDEF', 'USDC', usdcIssuer, HORIZON_URL);
    expect(result).toBe(true);
  });

  it('returns false when trustline does not exist', async () => {
    mockFetch.mockResolvedValueOnce(
      createJsonResponse({
        id: 'GABCDEF',
        balances: [
          {
            balance: '100.0000000',
            asset_type: 'native',
          },
        ],
      })
    );
    const result = await checkTrustline('GABCDEF', 'USDC', usdcIssuer, HORIZON_URL);
    expect(result).toBe(false);
  });

  it('returns true for native XLM (no trustline needed)', async () => {
    const result = await checkTrustline('GABCDEF', 'XLM', null, HORIZON_URL);
    expect(result).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns false on 404', async () => {
    mockFetch.mockResolvedValueOnce(createJsonResponse({}, 404));
    const result = await checkTrustline('GABCDEF', 'USDC', usdcIssuer, HORIZON_URL);
    expect(result).toBe(false);
  });
});

describe('checkBalance', () => {
  it('returns true when native balance meets minimum', async () => {
    mockFetch.mockResolvedValueOnce(
      createJsonResponse({
        id: 'GABCDEF',
        balances: [
          { balance: '5.0000000', asset_type: 'native' },
        ],
      })
    );
    const result = await checkBalance('GABCDEF', '1', HORIZON_URL);
    expect(result).toBe(true);
  });

  it('returns false when native balance is below minimum', async () => {
    mockFetch.mockResolvedValueOnce(
      createJsonResponse({
        id: 'GABCDEF',
        balances: [
          { balance: '0.5000000', asset_type: 'native' },
        ],
      })
    );
    const result = await checkBalance('GABCDEF', '1', HORIZON_URL);
    expect(result).toBe(false);
  });

  it('returns false on 404', async () => {
    mockFetch.mockResolvedValueOnce(createJsonResponse({}, 404));
    const result = await checkBalance('GABCDEF', '1', HORIZON_URL);
    expect(result).toBe(false);
  });

  it('returns false when account has no native balance entry', async () => {
    mockFetch.mockResolvedValueOnce(
      createJsonResponse({
        id: 'GABCDEF',
        balances: [
          { balance: '100.0000000', asset_type: 'credit_alphanum4', asset_code: 'USDC' },
        ],
      })
    );
    const result = await checkBalance('GABCDEF', '1', HORIZON_URL);
    expect(result).toBe(false);
  });

  it('returns true when balance exactly equals minimum', async () => {
    mockFetch.mockResolvedValueOnce(
      createJsonResponse({
        id: 'GABCDEF',
        balances: [
          { balance: '1.0000000', asset_type: 'native' },
        ],
      })
    );
    const result = await checkBalance('GABCDEF', '1', HORIZON_URL);
    expect(result).toBe(true);
  });
});

describe('runPreflightChecks', () => {
  const batch: PreflightCheckEmployee[] = [
    { name: 'Alice', walletAddress: 'GAICE3EYV3KGI7ND4GM4J3K4Y5K6J7K8L9M0N1O2P3Q4R5S6T7U8V9W0X', amount: '100', currency: 'USDC' },
    { name: 'Bob', walletAddress: 'GBOB4EYV3KGI7ND4GM4J3K4Y5K6J7K8L9M0N1O2P3Q4R5S6T7U8V9W0X', amount: '200', currency: 'XLM' },
    { name: 'Charlie', walletAddress: 'GCH4R4EYV3KGI7ND4GM4J3K4Y5K6J7K8L9M0N1O2P3Q4R5S6T7U8V9W0X', amount: '300', currency: 'USDC' },
  ];

  it('returns pass for employees with valid accounts', async () => {
    mockFetch.mockResolvedValue(
      createJsonResponse({
        id: 'test',
        balances: [
          { balance: '10.0000000', asset_type: 'native' },
          { balance: '500.0000000', asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5' },
        ],
      })
    );
    const results = await runPreflightChecks(batch, HORIZON_URL);
    expect(results).toHaveLength(3);
    results.forEach((r) => {
      expect(r.status).toBe('pass');
      expect(r.issues).toHaveLength(0);
    });
  });

  it('returns fail for non-existent account', async () => {
    mockFetch.mockResolvedValue(createJsonResponse({}, 404));
    const results = await runPreflightChecks(batch, HORIZON_URL);
    expect(results[0].status).toBe('fail');
    expect(results[0].issues[0].type).toBe('account_not_found');
  });

  it('reports trustline issues for non-XLM assets', async () => {
    let callCount = 0;
    mockFetch.mockImplementation(() => {
      callCount++;
      if (callCount <= 3) {
        return createJsonResponse({
          id: 'test',
          balances: [{ balance: '10.0000000', asset_type: 'native' }],
        });
      }
      return createJsonResponse({}, 200);
    });
    const results = await runPreflightChecks(batch, HORIZON_URL);
    expect(results[0].status).toBe('fail');
    expect(results[0].issues.some((i) => i.type === 'no_trustline')).toBe(true);
    expect(results[1].status).toBe('pass');
  });

  it('handles mixed results across employees', async () => {
    let callCount = 0;
    mockFetch.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return createJsonResponse({}, 404);
      }
      return createJsonResponse({
        id: 'test',
        balances: [
          { balance: '10.0000000', asset_type: 'native' },
          { balance: '500.0000000', asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5' },
        ],
      });
    });
    const results = await runPreflightChecks(batch, HORIZON_URL);
    expect(results[0].status).toBe('fail');
    expect(results[1].status).toBe('pass');
    expect(results[2].status).toBe('pass');
  });
});
