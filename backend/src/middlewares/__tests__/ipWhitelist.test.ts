import { describe, it, expect, jest } from '@jest/globals';
import { Request, Response } from 'express';
import tenantConfigService from '../../services/tenantConfigService.js';
import { isIpAllowed, parseIp, parseWhitelistEntry, optionalIpWhitelist } from '../ipWhitelist.js';

const mockGetSecuritySettings = jest.spyOn(tenantConfigService, 'getSecuritySettings');

describe('parseIp', () => {
  it('parses IPv4 and IPv6', () => {
    expect(parseIp('192.168.1.1')?.version).toBe(4);
    expect(parseIp('2001:db8::1')?.version).toBe(6);
    expect(parseIp('::1')?.version).toBe(6);
  });

  it('treats IPv4-mapped IPv6 as IPv4 (both notations)', () => {
    expect(parseIp('::ffff:10.0.0.1')).toEqual(parseIp('10.0.0.1'));
    expect(parseIp('::ffff:a00:1')).toEqual(parseIp('10.0.0.1'));
  });

  it('rejects invalid input', () => {
    for (const bad of [
      '',
      'abc',
      '256.1.1.1',
      '1.2.3',
      '1:2:3',
      '1::2::3',
      'gggg::1',
      '1.2.3.4.5',
    ]) {
      expect(parseIp(bad)).toBeNull();
    }
  });
});

describe('parseWhitelistEntry', () => {
  it('rejects invalid prefixes', () => {
    expect(parseWhitelistEntry('10.0.0.0/33')).toBeNull();
    expect(parseWhitelistEntry('10.0.0.0/-1')).toBeNull();
    expect(parseWhitelistEntry('10.0.0.0/x')).toBeNull();
    expect(parseWhitelistEntry('2001:db8::/129')).toBeNull();
    expect(parseWhitelistEntry('nonsense/8')).toBeNull();
  });
});

describe('isIpAllowed', () => {
  it('matches exact IPs', () => {
    expect(isIpAllowed('1.2.3.4', ['1.2.3.4'])).toBe(true);
    expect(isIpAllowed('1.2.3.5', ['1.2.3.4'])).toBe(false);
  });

  it('matches IPv4 CIDR ranges', () => {
    expect(isIpAllowed('10.1.2.3', ['10.0.0.0/8'])).toBe(true);
    expect(isIpAllowed('11.0.0.1', ['10.0.0.0/8'])).toBe(false);
    expect(isIpAllowed('192.168.1.200', ['192.168.1.128/25'])).toBe(true);
    expect(isIpAllowed('192.168.1.100', ['192.168.1.128/25'])).toBe(false);
    expect(isIpAllowed('8.8.8.8', ['0.0.0.0/0'])).toBe(true);
    expect(isIpAllowed('1.2.3.4', ['1.2.3.4/32'])).toBe(true);
  });

  it('matches IPv6 exact and CIDR', () => {
    expect(isIpAllowed('2001:db8::1', ['2001:0db8:0:0:0:0:0:1'])).toBe(true);
    expect(isIpAllowed('2001:db8:abcd::1', ['2001:db8::/32'])).toBe(true);
    expect(isIpAllowed('2001:db9::1', ['2001:db8::/32'])).toBe(false);
    expect(isIpAllowed('::1', ['::1/128'])).toBe(true);
  });

  it('handles IPv4-mapped client addresses against IPv4 rules', () => {
    expect(isIpAllowed('::ffff:10.1.2.3', ['10.0.0.0/8'])).toBe(true);
    expect(isIpAllowed('::ffff:11.1.2.3', ['10.0.0.0/8'])).toBe(false);
  });

  it('handles IPv4-mapped whitelist entries', () => {
    expect(isIpAllowed('10.1.2.3', ['::ffff:10.1.2.3'])).toBe(true);
    expect(isIpAllowed('10.1.2.3', ['::ffff:10.0.0.0/104'])).toBe(true);
  });

  it('does not mix IPv4 and IPv6 families', () => {
    expect(isIpAllowed('2001:db8::1', ['0.0.0.0/0'])).toBe(false);
    expect(isIpAllowed('1.2.3.4', ['::/0'])).toBe(false);
  });

  it('ignores invalid entries and rejects invalid clients', () => {
    expect(isIpAllowed('1.2.3.4', ['garbage', '1.2.3.0/24'])).toBe(true);
    expect(isIpAllowed('garbage', ['0.0.0.0/0'])).toBe(false);
    expect(isIpAllowed('1.2.3.4', ['garbage'])).toBe(false);
  });
});

describe('optionalIpWhitelist', () => {
  const res = () =>
    ({
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }) as unknown as Response;
  const req = (ip: string) =>
    ({ user: { organizationId: 1 }, headers: { 'x-forwarded-for': ip } }) as unknown as Request;

  it('allows IPs inside a CIDR range', async () => {
    mockGetSecuritySettings.mockResolvedValue({
      ip_whitelist: ['10.0.0.0/8', '2001:db8::/32'],
    } as never);
    const next = jest.fn();
    await optionalIpWhitelist(req('::ffff:10.2.3.4'), res(), next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks IPs outside every range', async () => {
    mockGetSecuritySettings.mockResolvedValue({ ip_whitelist: ['10.0.0.0/8'] } as never);
    const r = res();
    const next = jest.fn();
    await optionalIpWhitelist(req('203.0.113.9'), r, next);
    expect(next).not.toHaveBeenCalled();
    expect(r.status).toHaveBeenCalledWith(403);
  });
});
