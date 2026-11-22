import crypto from 'crypto';
import { getRedisClient } from '../services/rateLimitService.js';
import logger from '../utils/logger.js';

/**
 * Configuration for PKCE management
 */
export interface OAuthPKCEConfig {
  /**
   * TTL for PKCE verifiers in seconds
   * @default 600 (10 minutes)
   */
  verifierTtlSeconds?: number;
}

const DEFAULT_CONFIG: Required<OAuthPKCEConfig> = {
  verifierTtlSeconds: 600, // 10 minutes
};

/**
 * PKCE pair with code verifier and code challenge
 */
export interface PKCEPair {
  codeVerifier: string;
  codeChallenge: string;
}

/**
 * Generates a code verifier for PKCE
 * Per RFC 7636, should be 43-128 characters of unreserved characters
 */
function generateCodeVerifier(): string {
  // Generate 32 random bytes and base64url encode
  const verifier = crypto
    .randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return verifier.substring(0, 128);
}

/**
 * Generates a code challenge from a code verifier
 * Uses SHA256 hash and base64url encoding (S256 method)
 */
function generateCodeChallenge(codeVerifier: string): string {
  return crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generates a new PKCE pair (verifier + challenge)
 */
export function generatePKCEPair(): PKCEPair {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  return { codeVerifier, codeChallenge };
}

/**
 * Stores PKCE verifier in Redis for later verification
 */
export async function storeVerifier(
  userId: number | string,
  codeVerifier: string,
  config: OAuthPKCEConfig = {}
): Promise<void> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const redis = getRedisClient();
  const key = `oauth_pkce:${userId}`;

  try {
    await redis.setex(key, cfg.verifierTtlSeconds, codeVerifier);
  } catch (error) {
    logger.error('Failed to store PKCE verifier', { error, userId });
    throw error;
  }
}

/**
 * Verifies a code challenge against the stored verifier
 */
export async function verifyCodeChallenge(
  userId: number | string,
  codeChallenge: string,
  config: OAuthPKCEConfig = {}
): Promise<boolean> {
  const redis = getRedisClient();
  const key = `oauth_pkce:${userId}`;

  try {
    const storedVerifier = await redis.get(key);

    if (!storedVerifier) {
      logger.warn('No stored PKCE verifier found for verification', { userId });
      return false;
    }

    // Regenerate the challenge from stored verifier
    const expectedChallenge = generateCodeChallenge(storedVerifier);

    if (expectedChallenge !== codeChallenge) {
      logger.warn('PKCE challenge mismatch detected', {
        userId,
        expectedLength: expectedChallenge.length,
        receivedLength: codeChallenge.length,
      });
      return false;
    }

    // Clear the verifier after successful verification
    await redis.del(key);
    return true;
  } catch (error) {
    logger.error('Failed to verify PKCE challenge', { error, userId });
    return false;
  }
}

/**
 * Clears stored verifier (called on error or timeout)
 */
export async function clearVerifier(userId: number | string): Promise<void> {
  const redis = getRedisClient();
  const key = `oauth_pkce:${userId}`;

  try {
    await redis.del(key);
  } catch (error) {
    logger.error('Failed to clear PKCE verifier', { error, userId });
  }
}
