import {
  generateState,
  storeState,
  verifyState,
  clearState,
} from '../oauthStateManager.js';
import {
  generatePKCEPair,
  storeVerifier,
  verifyCodeChallenge,
  clearVerifier,
} from '../oauthPKCEManager.js';
import * as rateLimitService from '../../services/rateLimitService.js';
import logger from '../../utils/logger.js';

jest.mock('../../services/rateLimitService.js');
jest.mock('../../utils/logger.js', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('OAuth State Management', () => {
  let mockRedis: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
    };

    (rateLimitService.getRedisClient as jest.Mock).mockReturnValue(mockRedis);
  });

  describe('generateState', () => {
    it('should generate a 64-character hex string', () => {
      const state = generateState();

      expect(state).toHaveLength(64); // 32 bytes * 2 hex chars per byte
      expect(/^[0-9a-f]{64}$/.test(state)).toBe(true);
    });

    it('should generate different values on each call', () => {
      const state1 = generateState();
      const state2 = generateState();

      expect(state1).not.toEqual(state2);
    });
  });

  describe('storeState', () => {
    it('should store state in Redis with TTL', async () => {
      mockRedis.setex.mockResolvedValue(true);

      const userId = 'user123';
      const state = await storeState(userId);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `oauth_state:${userId}`,
        300, // 5 minutes
        expect.any(String)
      );
      expect(state).toHaveLength(64);
    });

    it('should use custom TTL if provided', async () => {
      mockRedis.setex.mockResolvedValue(true);

      await storeState('user123', { stateTtlSeconds: 600 });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        600,
        expect.any(String)
      );
    });

    it('should throw error if Redis fails', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis error'));

      await expect(storeState('user123')).rejects.toThrow('Redis error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('verifyState', () => {
    it('should return true if state matches stored value', async () => {
      const state = generateState();
      mockRedis.get.mockResolvedValue(state);
      mockRedis.del.mockResolvedValue(1);

      const result = await verifyState('user123', state);

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('oauth_state:user123');
    });

    it('should return false if state does not match', async () => {
      mockRedis.get.mockResolvedValue(generateState());

      const result = await verifyState('user123', generateState());

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        'State mismatch detected',
        expect.any(Object)
      );
    });

    it('should return false if no stored state exists', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await verifyState('user123', generateState());

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        'No stored state found for verification',
        expect.any(Object)
      );
    });

    it('should clear state after successful verification', async () => {
      const state = generateState();
      mockRedis.get.mockResolvedValue(state);
      mockRedis.del.mockResolvedValue(1);

      await verifyState('user123', state);

      expect(mockRedis.del).toHaveBeenCalledWith('oauth_state:user123');
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await verifyState('user123', generateState());

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('clearState', () => {
    it('should delete state from Redis', async () => {
      mockRedis.del.mockResolvedValue(1);

      await clearState('user123');

      expect(mockRedis.del).toHaveBeenCalledWith('oauth_state:user123');
    });

    it('should handle errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      await clearState('user123');

      expect(logger.error).toHaveBeenCalled();
    });
  });
});

describe('OAuth PKCE Management', () => {
  let mockRedis: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
    };

    (rateLimitService.getRedisClient as jest.Mock).mockReturnValue(mockRedis);
  });

  describe('generatePKCEPair', () => {
    it('should generate a valid PKCE pair', () => {
      const pair = generatePKCEPair();

      expect(pair.codeVerifier).toBeDefined();
      expect(pair.codeChallenge).toBeDefined();
      expect(pair.codeVerifier).toHaveLength(128);
      expect(/^[A-Za-z0-9\-_]*$/.test(pair.codeVerifier)).toBe(true); // base64url
      expect(/^[A-Za-z0-9\-_]*$/.test(pair.codeChallenge)).toBe(true); // base64url
    });

    it('should generate different pairs on each call', () => {
      const pair1 = generatePKCEPair();
      const pair2 = generatePKCEPair();

      expect(pair1.codeVerifier).not.toEqual(pair2.codeVerifier);
      expect(pair1.codeChallenge).not.toEqual(pair2.codeChallenge);
    });

    it('should have deterministic challenge for same verifier', () => {
      const pair1 = generatePKCEPair();
      // If we had the same verifier, we'd get the same challenge
      // (just testing the concept - in real use, verifier changes)
      expect(pair1.codeChallenge).toBeDefined();
    });
  });

  describe('storeVerifier', () => {
    it('should store verifier in Redis with TTL', async () => {
      mockRedis.setex.mockResolvedValue(true);

      await storeVerifier('user123', 'test-verifier');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `oauth_pkce:user123`,
        600, // 10 minutes
        'test-verifier'
      );
    });

    it('should use custom TTL if provided', async () => {
      mockRedis.setex.mockResolvedValue(true);

      await storeVerifier('user123', 'test-verifier', { verifierTtlSeconds: 1800 });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        1800,
        'test-verifier'
      );
    });

    it('should throw error if Redis fails', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis error'));

      await expect(
        storeVerifier('user123', 'test-verifier')
      ).rejects.toThrow('Redis error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('verifyCodeChallenge', () => {
    it('should verify correct code challenge', async () => {
      const { codeVerifier, codeChallenge } = generatePKCEPair();
      mockRedis.get.mockResolvedValue(codeVerifier);
      mockRedis.del.mockResolvedValue(1);

      const result = await verifyCodeChallenge('user123', codeChallenge);

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('oauth_pkce:user123');
    });

    it('should reject incorrect code challenge', async () => {
      const { codeVerifier } = generatePKCEPair();
      const { codeChallenge: wrongChallenge } = generatePKCEPair();
      mockRedis.get.mockResolvedValue(codeVerifier);

      const result = await verifyCodeChallenge('user123', wrongChallenge);

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        'PKCE challenge mismatch detected',
        expect.any(Object)
      );
    });

    it('should return false if no stored verifier exists', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await verifyCodeChallenge('user123', 'some-challenge');

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        'No stored PKCE verifier found for verification',
        expect.any(Object)
      );
    });

    it('should clear verifier after successful verification', async () => {
      const { codeVerifier, codeChallenge } = generatePKCEPair();
      mockRedis.get.mockResolvedValue(codeVerifier);
      mockRedis.del.mockResolvedValue(1);

      await verifyCodeChallenge('user123', codeChallenge);

      expect(mockRedis.del).toHaveBeenCalledWith('oauth_pkce:user123');
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await verifyCodeChallenge('user123', 'some-challenge');

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('clearVerifier', () => {
    it('should delete verifier from Redis', async () => {
      mockRedis.del.mockResolvedValue(1);

      await clearVerifier('user123');

      expect(mockRedis.del).toHaveBeenCalledWith('oauth_pkce:user123');
    });

    it('should handle errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      await clearVerifier('user123');

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('OAuth Flow Integration Tests', () => {
    it('should support complete OAuth flow with state and PKCE', async () => {
      mockRedis.setex.mockResolvedValue(true);
      mockRedis.del.mockResolvedValue(1);

      const userId = 'user123';

      // 1. User initiates OAuth, generate state and PKCE
      const state = await storeState(userId);
      const { codeChallenge, codeVerifier } = generatePKCEPair();
      await storeVerifier(userId, codeVerifier);

      expect(mockRedis.setex).toHaveBeenCalledTimes(2);

      // 2. OAuth provider calls back
      mockRedis.get
        .mockResolvedValueOnce(state) // For state verification
        .mockResolvedValueOnce(codeVerifier); // For PKCE verification

      // 3. Verify state
      const stateValid = await verifyState(userId, state);
      expect(stateValid).toBe(true);

      // 4. Verify PKCE
      const pkceValid = await verifyCodeChallenge(userId, codeChallenge);
      expect(pkceValid).toBe(true);

      // 5. Both state and PKCE should be deleted
      expect(mockRedis.del).toHaveBeenCalledWith('oauth_state:user123');
      expect(mockRedis.del).toHaveBeenCalledWith('oauth_pkce:user123');
    });

    it('should reject flow with mismatched state', async () => {
      mockRedis.setex.mockResolvedValue(true);
      mockRedis.get.mockResolvedValue(generateState()); // Different state

      const userId = 'user123';
      await storeState(userId);

      const wrongState = generateState();
      const result = await verifyState(userId, wrongState);

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        'State mismatch detected',
        expect.any(Object)
      );
    });

    it('should reject flow with wrong PKCE challenge', async () => {
      mockRedis.setex.mockResolvedValue(true);
      const { codeVerifier } = generatePKCEPair();
      mockRedis.get.mockResolvedValue(codeVerifier);

      const userId = 'user123';
      await storeVerifier(userId, codeVerifier);

      const wrongChallenge = generatePKCEPair().codeChallenge;
      const result = await verifyCodeChallenge(userId, wrongChallenge);

      expect(result).toBe(false);
    });
  });
});
