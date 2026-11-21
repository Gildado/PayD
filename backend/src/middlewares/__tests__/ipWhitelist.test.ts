import { Request, Response, NextFunction } from 'express';
import tenantConfigService from '../../services/tenantConfigService.js';
import {
  extractClientIp,
  isIpAllowed,
  optionalIpWhitelist,
  parseIp,
  parseWhitelistEntry,
} from '../ipWhitelist.js';

jest.mock('../../services/tenantConfigService.js', () => ({
  __esModule: true,
  default: { getSecuritySettings: jest.fn() },
}));

const getSecuritySettings = tenantConfigService.getSecuritySettings as jest.Mock;

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    user: { id: 1, organizationId: 42, role: 'EMPLOYER', email: 'admin@acme.com' },
    headers: {},
    ip: '127.0.0.1',
    ...overrides,
  } as unknown as Request;
}

describe('parseIp', () => {
  it('parses IPv4 addresses', () => {
    const parsed = parseIp('192.168.1.1');
    expect(parsed?.version).toBe(4);
    expect(parsed?.value).toBe(0xc0a80101n);
  });

  it('parses compressed and expanded IPv6 addresses to the same value', () => {
    expect(parseIp('2001:db8::1')).toEqual(parseIp('2001:0DB8:0:0:0:0:0:1'));
    expect(parseIp('::')?.version).toBe(6);
    expect(parseIp('::1')?.value).toBe(1n);
  });

  it('normalizes IPv4-mapped IPv6 addresses to IPv4', () => {
    expect(parseIp('::ffff:10.0.0.1')).toEqual(parseIp('10.0.0.1'));
    expect(parseIp('::ffff:a00:1')).toEqual(parseIp('10.0.0.1'));
    expect(parseIp('::10.0.0.1')).toEqual(parseIp('::a00:1'));
  });

  it('strips brackets, ports and zone identifiers', () => {
    expect(parseIp('[2001:db8::1]')).toEqual(parseIp('2001:db8::1'));
    expect(parseIp('[::1]:443')).toEqual(parseIp('::1'));
    expect(parseIp('fe80::1%eth0')).toEqual(parseIp('fe80::1'));
  });

  it('rejects malformed addresses', () => {
    for (const value of [
      '',
      'abc',
      '256.1.1.1',
      '1.2.3',
      '1.2.3.4.5',
      '010.0.0.1',
      '1:2:3',
      '1::2::3',
      'gggg::1',
      '1.2.3.4/24',
    ]) {
      expect(parseIp(value)).toBeNull();
    }
  });
});

describe('parseWhitelistEntry', () => {
  it('uses full-length prefixes for exact addresses', () => {
    expect(parseWhitelistEntry('1.2.3.4')?.prefix).toBe(32);
    expect(parseWhitelistEntry('::1')?.prefix).toBe(128);
  });

  it('canonicalizes the network address', () => {
    expect(parseWhitelistEntry('10.1.2.3/24')?.network).toBe(
      parseWhitelistEntry('10.1.2.0/24')?.network
    );
  });

  it('converts IPv4-mapped CIDR prefixes to IPv4 prefixes', () => {
    const mapped = parseWhitelistEntry('::ffff:10.0.0.0/104');
    expect(mapped?.version).toBe(4);
    expect(mapped?.prefix).toBe(8);
    expect(mapped?.network).toBe(parseWhitelistEntry('10.0.0.0/8')?.network);
    expect(parseWhitelistEntry('::ffff:10.1.2.3/128')?.prefix).toBe(32);
  });

  it('rejects invalid prefixes and addresses', () => {
    for (const value of [
      '/33',
      '/-1',
      '/x',
      '/129',
      'nonsense/8',
      '10.0.0.0/',
      '10.0.0.0/24/8',
      '::ffff:10.0.0.0/64',
    ]) {
      expect(parseWhitelistEntry(value)).toBeNull();
    }
  });
});

describe('isIpAllowed', () => {
  it('matches exact IPv4 addresses and CIDR ranges', () => {
    expect(isIpAllowed('1.2.3.4', ['1.2.3.4'])).toBe(true);
    expect(isIpAllowed('1.2.3.5', ['1.2.3.4'])).toBe(false);
    expect(isIpAllowed('10.255.255.255', ['10.0.0.0/8'])).toBe(true);
    expect(isIpAllowed('11.0.0.1', ['10.0.0.0/8'])).toBe(false);
    expect(isIpAllowed('192.168.1.200', ['192.168.1.128/25'])).toBe(true);
    expect(isIpAllowed('192.168.1.100', ['192.168.1.128/25'])).toBe(false);
    expect(isIpAllowed('8.8.8.8', ['0.0.0.0/0'])).toBe(true);
  });

  it('matches IPv6 addresses and CIDR ranges', () => {
    expect(isIpAllowed('2001:db8::1', ['2001:0db8:0:0:0:0:0:1'])).toBe(true);
    expect(isIpAllowed('2001:db8:abcd::1', ['2001:db8::/32'])).toBe(true);
    expect(isIpAllowed('2001:db9::1', ['2001:db8::/32'])).toBe(false);
    expect(isIpAllowed('::1', ['::1/128'])).toBe(true);
    expect(isIpAllowed('2001:db8:ffff:ffff:ffff:ffff:ffff:ffff', ['2001:db8::/32'])).toBe(true);
  });

  it('treats IPv4-mapped addresses as IPv4 in both directions', () => {
    expect(isIpAllowed('::ffff:10.1.2.3', ['10.0.0.0/8'])).toBe(true);
    expect(isIpAllowed('::ffff:a01:203', ['10.0.0.0/8'])).toBe(true);
    expect(isIpAllowed('::ffff:11.1.2.3', ['10.0.0.0/8'])).toBe(false);
    expect(isIpAllowed('10.1.2.3', ['::ffff:10.0.0.0/104'])).toBe(true);
    expect(isIpAllowed('10.1.2.3', ['::ffff:0:0/96'])).toBe(true);
  });

  it('keeps IPv4 and IPv6 families separate', () => {
    expect(isIpAllowed('2001:db8::1', ['0.0.0.0/0'])).toBe(false);
    expect(isIpAllowed('1.2.3.4', ['::/0'])).toBe(false);
  });

  it('fails closed on invalid clients and rules but ignores unrelated invalid rules', () => {
    expect(isIpAllowed('1.2.3.4', ['garbage', '1.2.3.0/24'])).toBe(true);
    expect(isIpAllowed('garbage', ['0.0.0.0/0'])).toBe(false);
    expect(isIpAllowed('1.2.3.4', ['garbage'])).toBe(false);
    expect(isIpAllowed('1.2.3.4', [])).toBe(false);
    expect(isIpAllowed('10.1.2.3', [' 10.0.0.0/8 ', 42 as unknown as string])).toBe(true);
  });
});

describe('extractClientIp', () => {
  it('uses the first forwarded address', () => {
    const req = mockReq({ headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' } });
    expect(extractClientIp(req)).toBe('203.0.113.9');
  });

  it('falls back to x-real-ip and req.ip, including array headers', () => {
    expect(extractClientIp(mockReq({ headers: { 'x-real-ip': '2001:db8::1' } }))).toBe(
      '2001:db8::1'
    );
    expect(extractClientIp(mockReq({ headers: { 'x-forwarded-for': ['::ffff:10.0.0.1'] } }))).toBe(
      '::ffff:10.0.0.1'
    );
    expect(extractClientIp(mockReq({ headers: {}, ip: undefined }))).toBe('');
  });
});

describe('optionalIpWhitelist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows requests without an organization or without configured rules', async () => {
    const next = jest.fn() as NextFunction;
    await optionalIpWhitelist(mockReq({ user: undefined }), mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(getSecuritySettings).not.toHaveBeenCalled();

    getSecuritySettings.mockResolvedValue(null);
    const next2 = jest.fn() as NextFunction;
    await optionalIpWhitelist(mockReq(), mockRes(), next2);
    expect(next2).toHaveBeenCalledTimes(1);
  });

  it('allows matching IPv4, IPv6 and mapped addresses', async () => {
    getSecuritySettings.mockResolvedValue({
      ip_whitelist: ['10.0.0.0/8', '2001:db8::/32'],
    });
    const next = jest.fn() as NextFunction;
    await optionalIpWhitelist(
      mockReq({ headers: { 'x-forwarded-for': '::ffff:10.2.3.4' } }),
      mockRes(),
      next
    );
    expect(next).toHaveBeenCalledTimes(1);

    const next2 = jest.fn() as NextFunction;
    await optionalIpWhitelist(
      mockReq({ headers: { 'x-real-ip': '2001:db8:abcd::1' } }),
      mockRes(),
      next2
    );
    expect(next2).toHaveBeenCalledTimes(1);
  });

  it('denies non-matching, invalid and missing client addresses', async () => {
    getSecuritySettings.mockResolvedValue({ ip_whitelist: ['10.0.0.0/8'] });

    for (const headers of [{ 'x-forwarded-for': '203.0.113.9' }, { 'x-forwarded-for': 'garbage' }, {}]) {
      const req = mockReq({ headers, ip: undefined });
      const res = mockRes();
      const next = jest.fn() as NextFunction;
      await optionalIpWhitelist(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access denied from this IP address' });
      expect(next).not.toHaveBeenCalled();
    }
  });

  it('denies when every configured rule is invalid', async () => {
    getSecuritySettings.mockResolvedValue({ ip_whitelist: ['garbage', '10.0.0.0/33'] });
    const res = mockRes();
    const next = jest.fn() as NextFunction;
    await optionalIpWhitelist(mockReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 when tenant settings cannot be loaded', async () => {
    getSecuritySettings.mockRejectedValue(new Error('db down'));
    const res = mockRes();
    const next = jest.fn() as NextFunction;
    await optionalIpWhitelist(mockReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
