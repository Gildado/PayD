import { Request, Response, NextFunction } from 'express';
import { checkTenantRateLimit } from '../services/tenantRateLimitService.js';

export function tenantRateLimit() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      next();
      return;
    }

    const result = await checkTenantRateLimit(organizationId);

    res.setHeader('X-RateLimit-Limit', result.limit);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());
    res.setHeader('X-RateLimit-Plan', result.plan);

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter ?? 60);
      res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: `Rate limit exceeded for ${result.plan} plan (${result.limit} requests/hour). Upgrade your plan for higher limits.`,
        resetAt: result.resetAt.toISOString(),
        retryAfter: result.retryAfter,
      });
      return;
    }

    next();
  };
}
