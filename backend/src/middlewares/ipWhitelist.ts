import { Request, Response, NextFunction } from 'express';
import tenantConfigService, { SecuritySettings } from '../services/tenantConfigService.js';

function extractClientIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim();
  const realIp = req.headers['x-real-ip']?.toString().trim();
  return forwardedFor || realIp || req.ip || '';
}

interface ParsedIp {
  version: 4 | 6;
  value: bigint;
}

function parseIpv4(ip: string): bigint | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0n;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = (value << 8n) | BigInt(n);
  }
  return value;
}

function parseIpv6(input: string): bigint | null {
  let ip = input;
  const zone = ip.indexOf('%');
  if (zone !== -1) ip = ip.slice(0, zone);
  if (!ip.includes(':')) return null;

  // Embedded IPv4 tail (e.g. ::ffff:1.2.3.4)
  const lastColon = ip.lastIndexOf(':');
  const tail = ip.slice(lastColon + 1);
  if (tail.includes('.')) {
    const v4 = parseIpv4(tail);
    if (v4 === null) return null;
    const hi = ((v4 >> 16n) & 0xffffn).toString(16);
    const lo = (v4 & 0xffffn).toString(16);
    ip = `${ip.slice(0, lastColon + 1)}${hi}:${lo}`;
  }

  const halves = ip.split('::');
  if (halves.length > 2) return null;

  const toGroups = (h: string): string[] | null => {
    if (h === '') return [];
    const groups = h.split(':');
    return groups.every((g) => /^[0-9a-fA-F]{1,4}$/.test(g)) ? groups : null;
  };

  const head = toGroups(halves[0]);
  const rest = halves.length === 2 ? toGroups(halves[1]) : [];
  if (!head || !rest) return null;

  let groups: string[];
  if (halves.length === 2) {
    const missing = 8 - head.length - rest.length;
    if (missing < 1) return null;
    groups = [...head, ...Array<string>(missing).fill('0'), ...rest];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;

  return groups.reduce((acc, g) => (acc << 16n) | BigInt(parseInt(g, 16)), 0n);
}

/** Parses an IPv4/IPv6 address; IPv4-mapped IPv6 addresses are returned as IPv4. */
export function parseIp(raw: string): ParsedIp | null {
  const ip = raw.trim().replace(/^\[|\]$/g, '');
  const v4 = parseIpv4(ip);
  if (v4 !== null) return { version: 4, value: v4 };

  const v6 = parseIpv6(ip);
  if (v6 === null) return null;
  if (v6 >> 32n === 0xffffn) {
    return { version: 4, value: v6 & 0xffffffffn };
  }
  return { version: 6, value: v6 };
}

interface WhitelistEntry {
  version: 4 | 6;
  network: bigint;
  mask: bigint;
}

/** Parses a single IP or CIDR range ("10.0.0.0/8", "2001:db8::/32"). */
export function parseWhitelistEntry(raw: string): WhitelistEntry | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const slash = trimmed.indexOf('/');
  const addr = slash === -1 ? trimmed : trimmed.slice(0, slash);
  const parsed = parseIp(addr);
  if (!parsed) return null;

  let bits = parsed.version === 4 ? 32 : 128;
  if (slash !== -1) {
    const prefixStr = trimmed.slice(slash + 1);
    if (!/^\d{1,3}$/.test(prefixStr)) return null;
    let prefix = Number(prefixStr);
    // A prefix on an IPv4-mapped IPv6 address (::ffff:a.b.c.d/N) counts from 128 bits
    if (parsed.version === 4 && addr.includes(':')) {
      if (prefix < 96 || prefix > 128) return null;
      prefix -= 96;
    }
    if (prefix > bits) return null;
    bits = prefix;
  }

  const total = parsed.version === 4 ? 32n : 128n;
  const hostBits = total - BigInt(bits);
  const mask = ((1n << total) - 1n) ^ ((1n << hostBits) - 1n);
  return { version: parsed.version, network: parsed.value & mask, mask };
}

export function isIpAllowed(clientIp: string, whitelist: string[]): boolean {
  const client = parseIp(clientIp);
  if (!client) return false;
  return whitelist.some((raw) => {
    const entry = parseWhitelistEntry(raw);
    return (
      entry !== null &&
      entry.version === client.version &&
      (client.value & entry.mask) === entry.network
    );
  });
}

export const optionalIpWhitelist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return next();
    }

    const securitySettings = (await tenantConfigService.getSecuritySettings(
      organizationId
    )) as SecuritySettings | null;

    const whitelist = (securitySettings?.ip_whitelist || [])
      .map((ip) => String(ip).trim())
      .filter(Boolean);

    if (whitelist.length === 0) {
      return next();
    }

    const clientIp = extractClientIp(req);
    if (!clientIp || !isIpAllowed(clientIp, whitelist)) {
      return res.status(403).json({
        error: 'Access denied from this IP address',
      });
    }

    next();
  } catch (error) {
    console.error('IP whitelist middleware error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
