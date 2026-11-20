import { CacheService } from '../cacheService.js';

describe('CacheService without Redis', () => {
  it('uses the process-local cache when Redis is disabled', async () => {
    const service = new CacheService({ ttlSeconds: 60 }, null);

    await expect(service.get('missing')).resolves.toBeNull();
    await service.set('key', { value: 'cached' });

    await expect(service.get('key')).resolves.toEqual({ value: 'cached' });
  });
});
