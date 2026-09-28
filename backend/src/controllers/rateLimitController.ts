import { Request, Response } from 'express';
import { rateLimitService, RateLimitTierName } from '../services/rateLimitService.js';
import {
  checkTenantRateLimit,
  setTenantPlan as setTenantPlanService,
  getPlanLimits,
  TenantPlan,
} from '../services/tenantRateLimitService.js';

export class RateLimitController {
  static async getStatus(req: Request, res: Response): Promise<void> {
    const { identifier, tier } = req.query;

    if (!identifier) {
      res.status(400).json({
        error: 'Missing required parameter: identifier',
      });
      return;
    }

    const tierName = (tier as RateLimitTierName) || 'api';
    if (!['auth', 'api', 'data', 'strict'].includes(tierName)) {
      res.status(400).json({
        error: 'Invalid tier',
        message: 'tier must be one of: auth, api, data, strict',
      });
      return;
    }

    const tierConfig = rateLimitService.getTierConfig(tierName);

    const result = await rateLimitService.checkRateLimit(identifier as string, tierName);

    res.json({
      success: true,
      data: {
        identifier,
        tier: tierName,
        tierConfig: {
          windowMs: tierConfig.windowMs,
          maxRequests: tierConfig.maxRequests,
        },
        currentStatus: {
          allowed: result.allowed,
          limit: result.limit,
          remaining: result.remaining,
          resetAt: result.resetAt.toISOString(),
          retryAfter: result.retryAfter,
        },
      },
    });
  }

  static async getTiers(_req: Request, res: Response): Promise<void> {
    const tiers = {
      auth: rateLimitService.getTierConfig('auth'),
      api: rateLimitService.getTierConfig('api'),
      data: rateLimitService.getTierConfig('data'),
      strict: rateLimitService.getTierConfig('strict'),
    };

    res.json({
      success: true,
      data: {
        tiers,
        description: {
          auth: 'Stricter limits for authentication endpoints',
          api: 'Standard limits for API operations',
          data: 'Higher limits for data retrieval endpoints',
          strict: 'Very strict limits for sensitive operations',
        },
      },
    });
  }

  static async getTenantStatus(req: Request, res: Response): Promise<void> {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(403).json({ success: false, error: 'No organization associated with this account' });
      return;
    }

    const result = await checkTenantRateLimit(organizationId);
    res.json({
      success: true,
      data: {
        organizationId,
        plan: result.plan,
        limit: result.limit,
        remaining: result.remaining,
        resetAt: result.resetAt.toISOString(),
        allowed: result.allowed,
        retryAfter: result.retryAfter,
        planLimits: getPlanLimits(),
      },
    });
  }

  static async setTenantPlan(req: Request, res: Response): Promise<void> {
    const { organizationId, plan } = req.body as { organizationId?: number; plan?: string };

    if (!organizationId || !plan) {
      res.status(400).json({ success: false, error: 'organizationId and plan are required' });
      return;
    }

    const validPlans: TenantPlan[] = ['free', 'pro', 'enterprise'];
    if (!validPlans.includes(plan as TenantPlan)) {
      res.status(400).json({
        success: false,
        error: `Invalid plan. Must be one of: ${validPlans.join(', ')}`,
      });
      return;
    }

    await setTenantPlanService(organizationId, plan as TenantPlan);
    res.json({
      success: true,
      data: { organizationId, plan, limits: getPlanLimits()[plan as TenantPlan] },
    });
  }
}
