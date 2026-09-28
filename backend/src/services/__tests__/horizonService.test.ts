import { getHorizonConfig, createHorizonServer, retryWithBackoff, checkHorizonHealth } from '../../config/horizon.js';

jest.mock('@stellar/stellar-sdk', () => ({
  Horizon: {
    Server: jest.fn().mockImplementation(() => ({
      root: jest.fn().mockResolvedValue({ history_latest_ledger: 12345 }),
    })),
  },
  Networks: {
    TESTNET: 'Test SDF Network ; September 2015',
    PUBLIC: 'Public Global Stellar Network ; September 2015',
  },
}));

describe('getHorizonConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should default to testnet', () => {
    delete process.env.STELLAR_NETWORK;
    const config = getHorizonConfig();
    expect(config.network).toBe('testnet');
    expect(config.horizonUrl).toContain('testnet');
  });

  it('should use mainnet when configured', () => {
    process.env.STELLAR_NETWORK = 'mainnet';
    const config = getHorizonConfig();
    expect(config.network).toBe('mainnet');
    expect(config.horizonUrl).toContain('horizon.stellar.org');
  });

  it('should use custom Horizon URL when provided', () => {
    process.env.STELLAR_HORIZON_URL = 'https://custom-horizon.example.com';
    const config = getHorizonConfig();
    expect(config.horizonUrl).toBe('https://custom-horizon.example.com');
  });

  it('should parse retry config from env', () => {
    process.env.STELLAR_MAX_RETRIES = '5';
    process.env.STELLAR_RETRY_DELAY_MS = '2000';
    const config = getHorizonConfig();
    expect(config.maxRetries).toBe(5);
    expect(config.retryDelayMs).toBe(2000);
  });
});

describe('createHorizonServer', () => {
  it('should create a Horizon.Server instance', () => {
    const server = createHorizonServer();
    expect(server).toBeDefined();
  });
});

describe('checkHorizonHealth', () => {
  it('should return healthy when root succeeds', async () => {
    const server = createHorizonServer();
    const health = await checkHorizonHealth(server);
    expect(health.healthy).toBe(true);
    expect(health.latestLedger).toBe(12345);
  });
});

describe('retryWithBackoff', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return immediately on success', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const result = await retryWithBackoff(fn, { maxRetries: 3, delayMs: 100 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue('success');

    const promise = retryWithBackoff(fn, { maxRetries: 3, delayMs: 100 });

    await jest.advanceTimersByTimeAsync(100);
    await jest.advanceTimersByTimeAsync(200);

    const result = await promise;
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max retries exceeded', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('persistent failure'));

    const promise = retryWithBackoff(fn, { maxRetries: 2, delayMs: 100 });

    await jest.advanceTimersByTimeAsync(100);
    await jest.advanceTimersByTimeAsync(200);

    await expect(promise).rejects.toThrow('persistent failure');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should not retry 4xx errors (except 429)', async () => {
    const error: any = new Error('bad request');
    error.response = { status: 400 };
    const fn = jest.fn().mockRejectedValue(error);

    await expect(retryWithBackoff(fn, { maxRetries: 3 })).rejects.toThrow('bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
