import crypto from 'crypto';
import { getRedisClient } from '../services/rateLimitService.js';
import logger from '../utils/logger.js';

/**
 * Configuration for OAuth state management
 */
export interface OAuthStateConfig {
  /**
   * TTL for state tokens in seconds
   * @default 300 (5 minutes)
   */
  stateTtlSeconds?: number;
}

const DEFAULT_CONFIG: Required<OAuthStateConfig> = {
  stateTtlSeconds: 300, // 5 minutes
};

/**
 * Generates a cryptographically secure state token
 */
export function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Stores state token in Redis, bound to a session or user context
 */
export async function storeState(
  userId: number | string,
  config: OAuthStateConfig = {}
): Promise<string> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const redis = getRedisClient();
  const state = generateState();
  const key = `oauth_state:${userId}`;

  try {
    await redis.setex(key, cfg.stateTtlSeconds, state);
    return state;
  } catch (error) {
    logger.error('Failed to store OAuth state', { error, userId });
    throw error;
  }
}

/**
 * Verifies a state token matches what was stored for the user
 */
export async function verifyState(
  userId: number | string,
  state: string,
  config: OAuthStateConfig = {}
): Promise<boolean> {
  const redis = getRedisClient();
  const key = `oauth_state:${userId}`;

  try {
    const storedState = await redis.get(key);

    if (!storedState) {
      logger.warn('No stored state found for verification', { userId });
      return false;
    }

    if (storedState !== state) {
      logger.warn('State mismatch detected', {
        userId,
        expectedLength: storedState.length,
        receivedLength: state.length,
      });
      return false;
    }

    // Clear the state after successful verification
    await redis.del(key);
    return true;
  } catch (error) {
    logger.error('Failed to verify OAuth state', { error, userId });
    return false;
  }
}

/**
 * Clears stored state (called on error or timeout)
 */
export async function clearState(userId: number | string): Promise<void> {
  const redis = getRedisClient();
  const key = `oauth_state:${userId}`;

  try {
    await redis.del(key);
  } catch (error) {
    logger.error('Failed to clear OAuth state', { error, userId });
  }
}
