import { RateLimitService } from '../rateLimitService.js';

describe('RateLimitService without Redis', () => {
  it('continues using a process-local rate limit when Redis is disabled', async () => {
    const service = new RateLimitService(null);

    const firstRequest = await service.checkRateLimit('redis-disabled-test', 'strict');
    let lastRequest = firstRequest;

    for (let attempt = 1; attempt < 20; attempt += 1) {
      lastRequest = await service.checkRateLimit('redis-disabled-test', 'strict');
    }

    const overLimitRequest = await service.checkRateLimit('redis-disabled-test', 'strict');

    expect(firstRequest.allowed).toBe(true);
    expect(lastRequest.allowed).toBe(true);
    expect(overLimitRequest.allowed).toBe(false);
    expect(overLimitRequest.limit).toBe(20);
  });
});
