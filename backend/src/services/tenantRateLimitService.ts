import { getRedisClient } from './rateLimitService.js';
import tenantConfigService from './tenantConfigService.js';
import logger from '../utils/logger.js';

export type TenantPlan = 'free' | 'pro' | 'enterprise';

export interface TenantRateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
  plan: TenantPlan;
}

const PLAN_LIMITS: Record<TenantPlan, { maxRequests: number; windowMs: number }> = {
  free:       { maxRequests: 100,   windowMs: 60 * 60 * 1000 },
  pro:        { maxRequests: 1000,  windowMs: 60 * 60 * 1000 },
  enterprise: { maxRequests: 10000, windowMs: 60 * 60 * 1000 },
};

async function resolvePlan(organizationId: number): Promise<TenantPlan> {
  try {
    const plan = await tenantConfigService.getConfig(organizationId, 'rate_limit_plan');
    if (plan && plan in PLAN_LIMITS) return plan as TenantPlan;
  } catch {
    // fall through to default
  }
  return 'free';
}

export async function checkTenantRateLimit(
  organizationId: number
): Promise<TenantRateLimitResult> {
  const plan = await resolvePlan(organizationId);
  const { maxRequests, windowMs } = PLAN_LIMITS[plan];
  const key = `ratelimit:tenant:${organizationId}`;
  const now = Date.now();

  const redis = getRedisClient();
  if (redis) {
    try {
      const results = await redis
        .multi()
        .zremrangebyscore(key, '-inf', now - windowMs)
        .zcard(key)
        .zadd(key, now, `${now}-${Math.random()}`)
        .pttl(key)
        .exec();

      if (results) {
        const currentCount = (results[1]?.[1] as number) || 0;
        const ttl = (results[3]?.[1] as number) || windowMs;

        if (ttl < 0) await redis.pexpire(key, windowMs);

        const remaining = Math.max(0, maxRequests - currentCount - 1);
        const resetAt = new Date(now + (ttl > 0 ? ttl : windowMs));

        if (currentCount >= maxRequests) {
          return {
            allowed: false,
            limit: maxRequests,
            remaining: 0,
            resetAt,
            retryAfter: Math.ceil((ttl > 0 ? ttl : windowMs) / 1000),
            plan,
          };
        }
        return { allowed: true, limit: maxRequests, remaining, resetAt, plan };
      }
    } catch (err) {
      logger.error('Tenant rate limit Redis error, allowing request', { error: err, organizationId });
    }
  }

  return { allowed: true, limit: maxRequests, remaining: maxRequests - 1, resetAt: new Date(now + windowMs), plan };
}

export async function setTenantPlan(organizationId: number, plan: TenantPlan): Promise<void> {
  if (!(plan in PLAN_LIMITS)) throw new Error(`Unknown plan: ${plan}`);
  await tenantConfigService.setConfig(organizationId, 'rate_limit_plan', plan, 'API rate limit plan');
}

export function getPlanLimits(): Record<TenantPlan, { maxRequests: number; windowMs: number }> {
  return PLAN_LIMITS;
}
