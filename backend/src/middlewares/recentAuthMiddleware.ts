/**
 * Recent Authentication Middleware
 * 
 * Enforces re-authentication for destructive admin operations.
 * Requires that the user's authentication session is recent (within maxAgeSeconds)
 * before allowing access to sensitive endpoints like freeze, clawback, or contract upgrades.
 * 
 * Works in conjunction with require2FAForAdmin to provide defense-in-depth:
 * - require2FAForAdmin: Verifies 2FA token on each request
 * - recentAuth: Verifies the underlying JWT session is recent
 */

import { Request, Response, NextFunction } from 'express';
import { apiErrorResponse, ErrorCodes } from '../utils/apiError.js';
import logger from '../utils/logger.js';

/**
 * Extracts the token issue time from the JWT payload
 * Assumes authenticateJWT middleware has already run and set req.user
 */
function getTokenIssuedAt(req: Request): number | null {
  // JWT payload should have 'iat' (issued at) claim
  const user = req.user as any;
  
  if (!user || !user.iat) {
    return null;
  }

  return user.iat;
}

/**
 * Middleware factory that enforces recent authentication
 * 
 * @param maxAgeSeconds - Maximum age of the authentication token in seconds
 * @returns Express middleware
 * 
 * @example
 * // Require re-auth within last 5 minutes for freeze operations
 * router.post('/freeze', authenticateJWT, recentAuth(300), freezeController.freeze);
 */
export function recentAuth(maxAgeSeconds: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;

    if (!userId) {
      logger.warn('recentAuth: No authenticated user found', {
        path: req.path,
        method: req.method,
      });

      return res.status(401).json(
        apiErrorResponse(
          ErrorCodes.UNAUTHORIZED,
          'Authentication required for this action'
        )
      );
    }

    const tokenIssuedAt = getTokenIssuedAt(req);

    if (!tokenIssuedAt) {
      logger.warn('recentAuth: Could not extract token issued time', {
        userId,
        path: req.path,
        method: req.method,
      });

      return res.status(401).json(
        apiErrorResponse(
          ErrorCodes.UNAUTHORIZED,
          'Invalid authentication token'
        )
      );
    }

    const currentTime = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
    const tokenAge = currentTime - tokenIssuedAt;

    if (tokenAge > maxAgeSeconds) {
      const ageMinutes = Math.floor(tokenAge / 60);
      const maxMinutes = Math.floor(maxAgeSeconds / 60);

      logger.warn('recentAuth: Token too old for sensitive operation', {
        userId,
        path: req.path,
        method: req.method,
        tokenAgeSeconds: tokenAge,
        maxAgeSeconds,
        tokenAgeMinutes: ageMinutes,
        maxMinutes,
      });

      return res.status(401).json(
        apiErrorResponse(
          ErrorCodes.UNAUTHORIZED,
          `This action requires recent authentication. Please re-authenticate. (Session age: ${ageMinutes}m, max: ${maxMinutes}m)`
        )
      );
    }

    logger.debug('recentAuth: Token age check passed', {
      userId,
      tokenAgeSeconds: tokenAge,
      maxAgeSeconds,
    });

    next();
  };
}

/**
 * Common time limits for different sensitivity levels
 */
export const RecentAuthLimits = {
  /** Very sensitive operations (contract upgrades) - 5 minutes */
  CRITICAL: 5 * 60,
  
  /** Destructive operations (freeze, clawback) - 15 minutes */
  DESTRUCTIVE: 15 * 60,
  
  /** Admin operations (org management) - 30 minutes */
  ADMIN: 30 * 60,
  
  /** Standard sensitive operations - 1 hour */
  STANDARD: 60 * 60,
} as const;
