import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';

const mockGetSecuritySettings = jest.fn<(orgId: number) => Promise<unknown>>();

jest.unstable_mockModule('../../services/tenantConfigService.js', () => ({
  default: { getSecuritySettings: mockGetSecuritySettings },
}));

const { optionalIpWhitelist } = await import('../ipWhitelist.js');

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

function mockReq(overrides: Record<string, unknown> = {}): Request {
  return {
    user: { id: 1, organizationId: 42 },
    headers: {},
    ip: '10.0.0.1',
    ...overrides,
  } as unknown as Request;
}

describe('optionalIpWhitelist', () => {
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    next = jest.fn() as unknown as NextFunction;
  });

  describe('success paths', () => {
    it('calls next() without querying settings when there is no organization', async () => {
      const req = mockReq({ user: undefined });
      const res = mockRes();

      await optionalIpWhitelist(req, res, next);

      expect(mockGetSecuritySettings).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('calls next() when security settings are missing', async () => {
      mockGetSecuritySettings.mockResolvedValue(null);
      const res = mockRes();

      await optionalIpWhitelist(mockReq(), res, next);

      expect(mockGetSecuritySettings).toHaveBeenCalledWith(42);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('calls next() when the whitelist is empty', async () => {
      mockGetSecuritySettings.mockResolvedValue({ ip_whitelist: [] });
      const res = mockRes();

      await optionalIpWhitelist(mockReq(), res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('ignores blank whitelist entries', async () => {
      mockGetSecuritySettings.mockResolvedValue({ ip_whitelist: ['', '   '] });
      const res = mockRes();

      await optionalIpWhitelist(mockReq(), res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('allows a client IP present in the whitelist (req.ip)', async () => {
      mockGetSecuritySettings.mockResolvedValue({ ip_whitelist: ['10.0.0.1'] });
      const res = mockRes();

      await optionalIpWhitelist(mockReq(), res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('uses the first x-forwarded-for address in preference to other sources', async () => {
      mockGetSecuritySettings.mockResolvedValue({ ip_whitelist: ['203.0.113.7'] });
      const req = mockReq({
        headers: { 'x-forwarded-for': '203.0.113.7, 198.51.100.2', 'x-real-ip': '1.1.1.1' },
      });

      await optionalIpWhitelist(req, mockRes(), next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('falls back to x-real-ip when x-forwarded-for is absent', async () => {
      mockGetSecuritySettings.mockResolvedValue({ ip_whitelist: ['198.51.100.9'] });
      const req = mockReq({ headers: { 'x-real-ip': '198.51.100.9' } });

      await optionalIpWhitelist(req, mockRes(), next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('normalizes IPv4-mapped IPv6 addresses on both sides', async () => {
      mockGetSecuritySettings.mockResolvedValue({ ip_whitelist: ['::ffff:192.0.2.5'] });
      const req = mockReq({ ip: '::ffff:192.0.2.5' });

      await optionalIpWhitelist(req, mockRes(), next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('failure paths', () => {
    it('returns 403 when the client IP is not whitelisted', async () => {
      mockGetSecuritySettings.mockResolvedValue({ ip_whitelist: ['192.0.2.1'] });
      const res = mockRes();

      await optionalIpWhitelist(mockReq(), res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access denied from this IP address' });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 when the client IP cannot be determined', async () => {
      mockGetSecuritySettings.mockResolvedValue({ ip_whitelist: ['192.0.2.1'] });
      const res = mockRes();

      await optionalIpWhitelist(mockReq({ ip: undefined }), res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('does not trust req.ip when x-forwarded-for names a non-whitelisted address', async () => {
      mockGetSecuritySettings.mockResolvedValue({ ip_whitelist: ['10.0.0.1'] });
      const req = mockReq({ headers: { 'x-forwarded-for': '198.51.100.99' } });
      const res = mockRes();

      await optionalIpWhitelist(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 500 when loading the settings throws', async () => {
      mockGetSecuritySettings.mockRejectedValue(new Error('db down'));
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const res = mockRes();

      await optionalIpWhitelist(mockReq(), res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
      expect(next).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });
});
