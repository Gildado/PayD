import { Request, Response, NextFunction } from 'express';
import {
  recordFailedLoginAttempt,
  clearFailedLoginAttempts,
  credentialStuffingProtection,
  getAccountLockoutStatus,
  CredentialStuffingConfig,
} from '../credentialStuffingMiddleware.js';
import * as rateLimitService from '../../services/rateLimitService.js';
import * as auditService from '../../services/auditEventService.js';
import logger from '../../utils/logger.js';

jest.mock('../../services/rateLimitService.js');
jest.mock('../../services/auditEventService.js');
jest.mock('../../utils/logger.js', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('Credential Stuffing Protection Middleware', () => {
  let mockRedis: any;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRedis = {
      get: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      setex: jest.fn(),
      lpush: jest.fn(),
      del: jest.fn(),
    };

    (rateLimitService.getRedisClient as jest.Mock).mockReturnValue(mockRedis);
    (auditService.auditEventService as any) = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    mockReq = {
      body: { username: 'testuser', password: 'password' },
      ip: '192.168.1.1',
      headers: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
    };

    mockNext = jest.fn();
  });

  describe('recordFailedLoginAttempt', () => {
    it('should record first failed attempt and return not locked status', async () => {
      mockRedis.get.mockResolvedValue(null); // Not locked
      mockRedis.incr.mockResolvedValue(1); // First attempt
      mockRedis.expire.mockResolvedValue(true);

      const result = await recordFailedLoginAttempt('testuser', {}, '192.168.1.1');

      expect(result).toEqual({
        isLocked: false,
        failedAttempts: 1,
        remainingAttempts: 4, // 5 - 1
      });

      expect(mockRedis.incr).toHaveBeenCalledWith('failed_login:testuser');
      expect(auditService.auditEventService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'FAILED_LOGIN_ATTEMPT',
          accountIdentifier: 'testuser',
          ip: '192.168.1.1',
          details: expect.objectContaining({
            attemptNumber: 1,
            remainingAttempts: 4,
          }),
        })
      );
    });

    it('should lock account after max failed attempts', async () => {
      mockRedis.get.mockResolvedValue(null); // Not locked
      mockRedis.incr.mockResolvedValue(5); // Max attempts reached
      mockRedis.expire.mockResolvedValue(true);
      mockRedis.setex.mockResolvedValue(true);
      mockRedis.lpush.mockResolvedValue(true);

      const result = await recordFailedLoginAttempt(
        'testuser',
        { maxFailedAttempts: 5 },
        '192.168.1.1'
      );

      expect(result.isLocked).toBe(true);
      expect(result.failedAttempts).toBe(5);
      expect(result.lockoutExpiresAt).toBeInstanceOf(Date);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'locked_account:testuser',
        expect.any(Number),
        expect.any(String)
      );

      expect(auditService.auditEventService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ACCOUNT_LOCKED',
          accountIdentifier: 'testuser',
        })
      );
    });

    it('should track attempts by IP when trackByIp is enabled', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(true);

      await recordFailedLoginAttempt('testuser', { trackByIp: true }, '192.168.1.1');

      expect(mockRedis.incr).toHaveBeenCalledWith('failed_login:testuser:192.168.1.1');
    });

    it('should return locked status if account already locked', async () => {
      const futureTime = Date.now() + 10 * 60 * 1000;
      mockRedis.get.mockResolvedValue(futureTime.toString()); // Already locked

      const result = await recordFailedLoginAttempt('testuser', {}, '192.168.1.1');

      expect(result.isLocked).toBe(true);
      expect(result.lockoutExpiresAt).toBeInstanceOf(Date);

      // Should not increment attempts if already locked
      expect(mockRedis.incr).not.toHaveBeenCalled();
    });

    it('should calculate exponential backoff when enabled', async () => {
      mockRedis.get.mockResolvedValueOnce(null); // Not locked
      mockRedis.get.mockResolvedValueOnce('10'); // 10 attempts
      const cfg: CredentialStuffingConfig = {
        maxFailedAttempts: 5,
        exponentialBackoff: true,
        lockoutDurationMs: 15 * 60 * 1000,
      };

      // Simulate already locked with exponential backoff
      const result = await recordFailedLoginAttempt('testuser', cfg, '192.168.1.1');

      // Should return locked status
      expect(result.isLocked).toBe(true);
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.incr.mockRejectedValue(new Error('Redis error'));

      const result = await recordFailedLoginAttempt('testuser', {}, '192.168.1.1');

      expect(result).toEqual({ isLocked: false });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('clearFailedLoginAttempts', () => {
    it('should clear attempts counter and lockout', async () => {
      mockRedis.del.mockResolvedValue(2);

      await clearFailedLoginAttempts('testuser', {}, '192.168.1.1');

      expect(mockRedis.del).toHaveBeenCalledWith('failed_login:testuser');
      expect(mockRedis.del).toHaveBeenCalledWith('locked_account:testuser');
    });

    it('should handle errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      await clearFailedLoginAttempts('testuser', {}, '192.168.1.1');

      expect(logger.error).toHaveBeenCalledWith(
        'Error clearing failed login attempts',
        expect.any(Object)
      );
    });
  });

  describe('credentialStuffingProtection middleware', () => {
    it('should allow request if account not locked', async () => {
      mockRedis.get.mockResolvedValue(null); // Not locked

      const middleware = credentialStuffingProtection();
      await middleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject request if account is locked', async () => {
      const futureTime = Date.now() + 10 * 60 * 1000;
      mockRedis.get.mockResolvedValue(futureTime.toString());

      const middleware = credentialStuffingProtection();
      await middleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'ACCOUNT_LOCKED',
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should extract username from body', async () => {
      mockRedis.get.mockResolvedValue(null);

      const middleware = credentialStuffingProtection();
      await middleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRedis.get).toHaveBeenCalledWith('locked_account:testuser');
    });

    it('should proceed if no username in request', async () => {
      mockReq.body = {}; // No username

      const middleware = credentialStuffingProtection();
      await middleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should set Retry-After header on lockout', async () => {
      const futureTime = Date.now() + 5 * 60 * 1000;
      mockRedis.get.mockResolvedValue(futureTime.toString());

      const middleware = credentialStuffingProtection();
      await middleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const middleware = credentialStuffingProtection();
      await middleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getAccountLockoutStatus', () => {
    it('should return locked status if account is locked', async () => {
      const futureTime = Date.now() + 10 * 60 * 1000;
      mockRedis.get.mockResolvedValueOnce(futureTime.toString()); // lockout
      mockRedis.get.mockResolvedValueOnce('7'); // attempts

      const result = await getAccountLockoutStatus('testuser', {}, '192.168.1.1');

      expect(result.isLocked).toBe(true);
      expect(result.lockoutExpiresAt).toBeInstanceOf(Date);
      expect(result.failedAttempts).toBe(7);
    });

    it('should return not locked status if account is not locked', async () => {
      mockRedis.get.mockResolvedValueOnce(null); // No lockout
      mockRedis.get.mockResolvedValueOnce('2'); // attempts

      const result = await getAccountLockoutStatus('testuser', {}, '192.168.1.1');

      expect(result.isLocked).toBe(false);
      expect(result.failedAttempts).toBe(2);
      expect(result.remainingAttempts).toBe(3); // 5 - 2
    });

    it('should handle errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await getAccountLockoutStatus('testuser', {}, '192.168.1.1');

      expect(result).toEqual({ isLocked: false });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Window expiry behavior', () => {
    it('should reset attempts counter after window expires', async () => {
      // First set of calls: attempts exist and are within window
      mockRedis.get.mockResolvedValueOnce(null); // Not locked
      mockRedis.incr.mockResolvedValueOnce(1); // First attempt
      mockRedis.expire.mockResolvedValueOnce(true); // Set expiry

      const result1 = await recordFailedLoginAttempt(
        'testuser',
        { attemptWindowMs: 60000 }, // 1 minute
        '192.168.1.1'
      );

      expect(result1.failedAttempts).toBe(1);

      // After window expires, attempts counter would be gone from Redis
      jest.clearAllMocks();
      mockRedis.get.mockResolvedValueOnce(null); // Not locked (lockout expired)
      mockRedis.incr.mockResolvedValueOnce(1); // Start fresh counter
      mockRedis.expire.mockResolvedValueOnce(true);

      const result2 = await recordFailedLoginAttempt(
        'testuser',
        { attemptWindowMs: 60000 },
        '192.168.1.1'
      );

      // Should start from 1 again
      expect(result2.failedAttempts).toBe(1);
    });
  });
});
