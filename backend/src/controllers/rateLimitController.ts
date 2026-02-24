import { Request, Response } from 'express';
import { rateLimitService, RateLimitTierName } from '../services/rateLimitService';

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
    const tierConfig = rateLimitService.getTierConfig(tierName);

    const result = await rateLimitService.checkRateLimit(
      identifier as string,
      tierName
    );

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
}
