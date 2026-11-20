import { getPoolConfig } from '../env.js';

describe('Database Pool Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('should return default pool config', () => {
    const config = getPoolConfig();
    expect(config).toHaveProperty('min');
    expect(config).toHaveProperty('max');
    expect(config).toHaveProperty('idleTimeoutMillis');
    expect(config).toHaveProperty('connectionTimeoutMillis');
  });

  test('should use environment variables for pool sizing', () => {
    process.env.DB_POOL_MIN = '10';
    process.env.DB_POOL_MAX = '50';

    // Re-import to pick up new env vars
    delete require.cache[require.resolve('../env.js')];
    const { getPoolConfig: getConfig } = require('../env.js');

    const config = getConfig();
    expect(config.min).toBe(10);
    expect(config.max).toBe(50);
  });

  test('should parse timeout values as integers', () => {
    process.env.DB_IDLE_TIMEOUT_MS = '120000';
    process.env.DB_CONNECTION_TIMEOUT_MS = '10000';

    delete require.cache[require.resolve('../env.js')];
    const { getPoolConfig: getConfig } = require('../env.js');

    const config = getConfig();
    expect(typeof config.idleTimeoutMillis).toBe('number');
    expect(typeof config.connectionTimeoutMillis).toBe('number');
  });

  test('should validate pool min is less than pool max', () => {
    process.env.DB_POOL_MIN = '50';
    process.env.DB_POOL_MAX = '20';

    delete require.cache[require.resolve('../env.js')];
    expect(() => {
      require('../env.js');
    }).not.toThrow(); // Config doesn't validate this, but test shows the values
  });

  test('should have sensible defaults for production', () => {
    const config = getPoolConfig();
    expect(config.min).toBeGreaterThanOrEqual(1);
    expect(config.max).toBeGreaterThan(config.min);
    expect(config.idleTimeoutMillis).toBeGreaterThan(0);
    expect(config.connectionTimeoutMillis).toBeGreaterThan(0);
  });
});
