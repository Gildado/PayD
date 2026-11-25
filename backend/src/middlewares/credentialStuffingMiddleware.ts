import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../services/rateLimitService.js';
import logger from '../utils/logger.js';
import { auditEventService } from '../services/auditEventService.js';

export interface CredentialStuffingConfig {
  /**
   * Maximum failed attempts before lockout
   * @default 5
   */
  maxFailedAttempts?: number;

  /**
   * Lockout duration in milliseconds
   * @default 15 * 60 * 1000 (15 minutes)
   */
  lockoutDurationMs?: number;

  /**
   * Attempt window in milliseconds - resets failed counter if no attempt in this window
   * @default 15 * 60 * 1000 (15 minutes)
   */
  attemptWindowMs?: number;

  /**
   * Whether to use exponential backoff when re-attempting during lockout
   * @default false
   */
  exponentialBackoff?: boolean;

  /**
   * Whether to track by username alone (default) or username + IP combination
   * @default false (tracks by username alone)
   */
  trackByIp?: boolean;
}

export interface AccountLockoutStatus {
  isLocked: boolean;
  failedAttempts?: number;
  remainingAttempts?: number;
  lockoutExpiresAt?: Date;
  backoffDelayMs?: number;
}

const DEFAULT_CONFIG: Required<CredentialStuffingConfig> = {
  maxFailedAttempts: 5,
  lockoutDurationMs: 15 * 60 * 1000, // 15 minutes
  attemptWindowMs: 15 * 60 * 1000, // 15 minutes
  exponentialBackoff: false,
  trackByIp: false,
};

/**
 * Generates a unique key for tracking failed login attempts
 */
function getAttemptsKey(username: string, ip?: string): string {
  if (ip && ip !== 'unknown') {
    return `failed_login:${username}:${ip}`;
  }
  return `failed_login:${username}`;
}

/**
 * Generates a key for tracking account lockout
 */
function getLockoutKey(username: string): string {
  return `locked_account:${username}`;
}

/**
 * Generates a key for storing lockout history (audit trail)
 */
function getLockoutHistoryKey(username: string): string {
  return `lockout_history:${username}`;
}

/**
 * Records a failed login attempt and checks if account should be locked
 */
export async function recordFailedLoginAttempt(
  username: string,
  config: CredentialStuffingConfig = {},
  ip?: string
): Promise<AccountLockoutStatus> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const redis = getRedisClient();

  const attemptsKey = getAttemptsKey(username, cfg.trackByIp ? ip : undefined);
  const lockoutKey = getLockoutKey(username);

  try {
    // Check if account is currently locked
    const lockoutExpiry = await redis.get(lockoutKey);
    if (lockoutExpiry) {
      const expiresAt = new Date(Number(lockoutExpiry));
      let backoffDelayMs = cfg.lockoutDurationMs;

      if (cfg.exponentialBackoff) {
        // Calculate exponential backoff: 2^(failed_attempts - maxFailedAttempts)
        const failedAttempts = await redis.get(attemptsKey);
        const attempts = failedAttempts ? Number(failedAttempts) : 0;
        const exponent = Math.min(attempts - cfg.maxFailedAttempts + 1, 10); // Cap at 2^10
        backoffDelayMs = cfg.lockoutDurationMs * Math.pow(2, Math.max(0, exponent));
      }

      return {
        isLocked: true,
        lockoutExpiresAt: expiresAt,
        backoffDelayMs,
      };
    }

    // Increment failed attempts
    const attempts = await redis.incr(attemptsKey);
    
    // Set expiry on attempts counter if first attempt
    if (attempts === 1) {
      await redis.expire(attemptsKey, Math.ceil(cfg.attemptWindowMs / 1000));
    }

    // Check if account should be locked
    if (attempts >= cfg.maxFailedAttempts) {
      const lockoutExpiresAtTime = Date.now() + cfg.lockoutDurationMs;
      const expiresAt = new Date(lockoutExpiresAtTime);

      // Set lockout in Redis
      await redis.setex(
        lockoutKey,
        Math.ceil(cfg.lockoutDurationMs / 1000),
        lockoutExpiresAtTime.toString()
      );

      // Record lockout history for audit
      const historyKey = getLockoutHistoryKey(username);
      await redis.lpush(
        historyKey,
        JSON.stringify({
          timestamp: new Date().toISOString(),
          ip: ip || 'unknown',
          triggeredAt: attempts,
        })
      );
      await redis.expire(historyKey, 7 * 24 * 60 * 60); // Keep for 7 days

      // Emit audit event
      try {
        await auditEventService.log({
          eventType: 'ACCOUNT_LOCKED',
          accountIdentifier: username,
          ip: ip || 'unknown',
          details: {
            reason: 'CREDENTIAL_STUFFING_PROTECTION',
            failedAttempts: attempts,
            lockoutDurationMs: cfg.lockoutDurationMs,
          },
          severity: 'MEDIUM',
        });
      } catch (err) {
        logger.warn('Failed to log credential stuffing lockout event', {
          error: err,
          username,
          ip,
        });
      }

      logger.warn('Account locked due to failed login attempts', {
        username,
        ip,
        attempts,
        lockoutDurationMinutes: cfg.lockoutDurationMs / 1000 / 60,
      });

      return {
        isLocked: true,
        failedAttempts: attempts,
        lockoutExpiresAt: expiresAt,
      };
    }

    // Not locked, record the failed attempt
    try {
      await auditEventService.log({
        eventType: 'FAILED_LOGIN_ATTEMPT',
        accountIdentifier: username,
        ip: ip || 'unknown',
        details: {
          attemptNumber: attempts,
          remainingAttempts: cfg.maxFailedAttempts - attempts,
        },
        severity: 'LOW',
      });
    } catch (err) {
      logger.warn('Failed to log failed login attempt event', {
        error: err,
        username,
        ip,
      });
    }

    return {
      isLocked: false,
      failedAttempts: attempts,
      remainingAttempts: cfg.maxFailedAttempts - attempts,
    };
  } catch (error) {
    logger.error('Error recording failed login attempt', {
      error,
      username,
      ip,
    });
    // Fail open - don't lock the account on error
    return { isLocked: false };
  }
}

/**
 * Clears failed login attempts for an account (called on successful login)
 */
export async function clearFailedLoginAttempts(
  username: string,
  config: CredentialStuffingConfig = {},
  ip?: string
): Promise<void> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const redis = getRedisClient();
  const attemptsKey = getAttemptsKey(username, cfg.trackByIp ? ip : undefined);
  const lockoutKey = getLockoutKey(username);

  try {
    // Clear both attempts counter and lockout
    await Promise.all([
      redis.del(attemptsKey),
      redis.del(lockoutKey),
    ]);

    logger.debug('Cleared failed login attempts', {
      username,
      ip: cfg.trackByIp ? ip : 'not_tracked',
    });
  } catch (error) {
    logger.error('Error clearing failed login attempts', {
      error,
      username,
      ip,
    });
  }
}

/**
 * Middleware to check if account is locked and reject requests if so
 */
export function credentialStuffingProtection(config: CredentialStuffingConfig = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Extract username from request body or headers
    const username = req.body?.username || req.body?.email || req.body?.walletAddress;
    const ip =
      req.ip ||
      req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req.headers['x-real-ip']?.toString() ||
      'unknown';

    if (!username) {
      // No username to check, proceed
      return next();
    }

    try {
      const cfg = { ...DEFAULT_CONFIG, ...config };
      const redis = getRedisClient();
      const lockoutKey = getLockoutKey(username);

      // Check if account is locked
      const lockoutExpiry = await redis.get(lockoutKey);
      if (lockoutExpiry) {
        const expiresAt = new Date(Number(lockoutExpiry));
        const retryAfter = Math.ceil((expiresAt.getTime() - Date.now()) / 1000);

        res.setHeader('Retry-After', Math.max(1, retryAfter));

        return res.status(429).json({
          success: false,
          error: {
            code: 'ACCOUNT_LOCKED',
            message: 'Account is temporarily locked due to too many failed login attempts',
            retryAfter,
          },
          meta: {
            timestamp: new Date().toISOString(),
            traceId: req.headers['x-request-id'] || null,
          },
        });
      }

      next();
    } catch (error) {
      logger.error('Error in credential stuffing protection middleware', { error });
      // Fail open - proceed if check fails
      next();
    }
  };
}

/**
 * Gets current lockout status for an account
 */
export async function getAccountLockoutStatus(
  username: string,
  config: CredentialStuffingConfig = {},
  ip?: string
): Promise<AccountLockoutStatus> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const redis = getRedisClient();
  const lockoutKey = getLockoutKey(username);
  const attemptsKey = getAttemptsKey(username, cfg.trackByIp ? ip : undefined);

  try {
    const lockoutExpiry = await redis.get(lockoutKey);
    const failedAttempts = await redis.get(attemptsKey);

    if (lockoutExpiry) {
      const expiresAt = new Date(Number(lockoutExpiry));
      let backoffDelayMs = cfg.lockoutDurationMs;

      if (cfg.exponentialBackoff && failedAttempts) {
        const attempts = Number(failedAttempts);
        const exponent = Math.min(attempts - cfg.maxFailedAttempts + 1, 10);
        backoffDelayMs = cfg.lockoutDurationMs * Math.pow(2, Math.max(0, exponent));
      }

      return {
        isLocked: true,
        failedAttempts: failedAttempts ? Number(failedAttempts) : undefined,
        lockoutExpiresAt: expiresAt,
        backoffDelayMs,
      };
    }

    return {
      isLocked: false,
      failedAttempts: failedAttempts ? Number(failedAttempts) : 0,
      remainingAttempts: Math.max(
        0,
        cfg.maxFailedAttempts - (failedAttempts ? Number(failedAttempts) : 0)
      ),
    };
  } catch (error) {
    logger.error('Error getting account lockout status', {
      error,
      username,
      ip,
    });
    return { isLocked: false };
  }
}
