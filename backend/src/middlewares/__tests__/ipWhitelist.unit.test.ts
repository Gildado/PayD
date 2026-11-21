import { NextFunction, Request, Response } from 'express';
import tenantConfigService from '../../services/tenantConfigService.js';
import { optionalIpWhitelist } from '../ipWhitelist.js';
import { createNext, createReq, createRes } from './mockExpress';

jest.mock('../../services/tenantConfigService', () => ({
  __esModule: true,
  default: { getSecuritySettings: jest.fn() },
}));

const mockGetSettings = tenantConfigService.getSecuritySettings as jest.Mock;

describe('optionalIpWhitelist', () => {
  let next: jest.Mock & NextFunction;
  let res: ReturnType<typeof createRes>;

  beforeEach(() => {
    jest.clearAllMocks();
    next = createNext() as jest.Mock & NextFunction;
    res = createRes();
  });

  it('skips checks when there is no organization (no user)', async () => {
    await optionalIpWhitelist(createReq({}), res, next);

    expect(mockGetSettings).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('allows a client whose IP is on the whitelist', async () => {
    mockGetSettings.mockResolvedValue({ ip_whitelist: ['203.0.113.10'] });
    const req = createReq({
      user: { id: 1, organizationId: 7, role: 'EMPLOYER' },
      headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
    });

    await optionalIpWhitelist(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).not.toHaveBeenCalled();
  });

  it('blocks a client whose IP is not on the whitelist with 403', async () => {
    mockGetSettings.mockResolvedValue({ ip_whitelist: ['203.0.113.10'] });
    const req = createReq({
      user: { id: 1, organizationId: 7, role: 'EMPLOYER' },
      headers: { 'x-forwarded-for': '198.51.100.99' },
    });

    await optionalIpWhitelist(req, res, next);

    expect(res._status).toHaveBeenCalledWith(403);
    expect(res._json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Access denied from this IP address' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 when the settings lookup throws', async () => {
    mockGetSettings.mockRejectedValue(new Error('boom'));
    const req = createReq({ user: { id: 1, organizationId: 7, role: 'EMPLOYER' } });

    await optionalIpWhitelist(req, res, next);

    expect(res._status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
