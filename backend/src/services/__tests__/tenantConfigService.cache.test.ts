import { TenantConfigService } from '../tenantConfigService.js';
import { getRedisClient } from '../rateLimitService.js';

jest.mock('../rateLimitService.js', () => ({
  getRedisClient: jest.fn(),
}));

describe('TenantConfigService caching', () => {
  const mockedGetRedisClient = getRedisClient as jest.MockedFunction<typeof getRedisClient>;
  const query = jest.fn();
  const dbPool = { query } as any;
  const redisMock = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
  };

  let service: TenantConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetRedisClient.mockReturnValue(redisMock as any);
    service = new TenantConfigService(dbPool);
  });

  it('returns a config from Redis when present', async () => {
    redisMock.get.mockResolvedValueOnce(JSON.stringify({ primary_color: '#123456' }));

    const result = await service.getConfig(7, 'branding');

    expect(redisMock.get).toHaveBeenCalledWith('tenant-config:7:branding');
    expect(query).not.toHaveBeenCalled();
    expect(result).toEqual({ primary_color: '#123456' });
  });

  it('writes a config to Redis after a database miss', async () => {
    redisMock.get.mockResolvedValueOnce(null);
    redisMock.setex.mockResolvedValueOnce('OK');
    query.mockResolvedValueOnce({ rows: [{ config_value: { require_2fa: true } }] });

    const result = await service.getConfig(4, 'security_settings');

    expect(query).toHaveBeenCalledTimes(1);
    expect(redisMock.setex).toHaveBeenCalledWith(
      'tenant-config:4:security_settings',
      300,
      JSON.stringify({ require_2fa: true })
    );
    expect(result).toEqual({ require_2fa: true });
  });

  it('caches the aggregated organization config payload for five minutes', async () => {
    redisMock.get.mockResolvedValueOnce(null);
    redisMock.setex.mockResolvedValueOnce('OK');
    query.mockResolvedValueOnce({
      rows: [
        { config_key: 'branding', config_value: { primary_color: '#000000' } },
        { config_key: 'security_settings', config_value: { require_2fa: true } },
      ],
    });

    const result = await service.getAllConfigs(9);

    expect(redisMock.setex).toHaveBeenCalledWith(
      'tenant-config:9:all',
      300,
      JSON.stringify({
        branding: { primary_color: '#000000' },
        security_settings: { require_2fa: true },
      })
    );
    expect(result).toEqual({
      branding: { primary_color: '#000000' },
      security_settings: { require_2fa: true },
    });
  });

  it('invalidates both the per-key and aggregate cache entries after writes', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, config_key: 'branding' }] });

    await service.setConfig(3, 'branding', { primary_color: '#ffffff' });

    expect(redisMock.del).toHaveBeenCalledWith('tenant-config:3:all', 'tenant-config:3:branding');
  });

  it('falls back to the database when Redis is unavailable', async () => {
    mockedGetRedisClient.mockReturnValueOnce(null);
    query.mockResolvedValueOnce({ rows: [{ config_value: { default_currency: 'USD' } }] });

    const result = await service.getConfig(12, 'payment_settings');

    expect(query).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ default_currency: 'USD' });
  });
});
