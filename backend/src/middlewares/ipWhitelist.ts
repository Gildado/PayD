import { Request, Response, NextFunction } from 'express';
import tenantConfigService, { SecuritySettings } from '../services/tenantConfigService.js';
import logger from '../utils/logger.js';

type IpVersion = 4 | 6;

interface ParsedIp {
  version: IpVersion;
  value: bigint;
  mappedFromIpv6: boolean;
}

interface IpRange {
  version: IpVersion;
  network: bigint;
  mask: bigint;
  prefix: number;
}

const IPV4_PART = /^(0|[1-9]\d{0,2})$/;
const IPV6_GROUP = /^[0-9a-fA-F]{1,4}$/;

function cleanIpCandidate(raw: string): string {
  let value = raw.trim();
  if (value.startsWith('[')) {
    const closingBracket = value.indexOf(']');
    if (closingBracket !== -1) {
      value = value.slice(1, closingBracket);
    }
  }
  const zoneIndex = value.indexOf('%');
  if (zoneIndex !== -1) {
    value = value.slice(0, zoneIndex);
  }
  return value.trim();
}

export function extractClientIp(req: Request): string {
  const headerValue = (value: string | string[] | undefined): string => {
    if (Array.isArray(value)) {
      return value[0] ?? '';
    }
    return value ?? '';
  };

  const forwardedFor = headerValue(req.headers['x-forwarded-for']).split(',')[0] ?? '';
  const realIp = headerValue(req.headers['x-real-ip']);

  return (
    cleanIpCandidate(forwardedFor) || cleanIpCandidate(realIp) || cleanIpCandidate(req.ip ?? '')
  );
}

function parseIpv4(raw: string): bigint | null {
  const parts = raw.split('.');
  if (parts.length !== 4) {
    return null;
  }

  let value = 0n;
  for (const part of parts) {
    if (!IPV4_PART.test(part)) {
      return null;
    }
    const octet = Number(part);
    if (octet > 255) {
      return null;
    }
    value = (value << 8n) | BigInt(octet);
  }

  return value;
}

function parseIpv6(raw: string): { value: bigint; mappedFromIpv6: boolean } | null {
  let input = raw;
  let ipv4Tail: bigint | null = null;

  const tailMatch = input.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (tailMatch) {
    ipv4Tail = parseIpv4(tailMatch[1]);
    if (ipv4Tail === null) {
      return null;
    }
    input = input.slice(0, -tailMatch[1].length);
    if (input.endsWith(':') && input[input.length - 2] !== ':') {
      input = input.slice(0, -1);
    }
  }

  const expandGroups = (section: string): number[] | null => {
    if (!section) {
      return [];
    }
    const groups = section.split(':');
    const values: number[] = [];
    for (const group of groups) {
      if (!IPV6_GROUP.test(group)) {
        return null;
      }
      values.push(parseInt(group, 16));
    }
    return values;
  };

  const sections = input.split('::');
  if (sections.length > 2) {
    return null;
  }

  let groups: number[];
  if (sections.length === 2) {
    const left = expandGroups(sections[0]);
    const right = expandGroups(sections[1]);
    if (left === null || right === null) {
      return null;
    }
    const missing = 8 - left.length - right.length - (ipv4Tail === null ? 0 : 2);
    if (missing < 0) {
      return null;
    }
    groups = [...left, ...new Array<number>(missing).fill(0), ...right];
  } else {
    const parsed = expandGroups(sections[0]);
    if (parsed === null) {
      return null;
    }
    groups = parsed;
  }

  if (ipv4Tail !== null) {
    groups.push(Number((ipv4Tail >> 16n) & 0xffffn));
    groups.push(Number(ipv4Tail & 0xffffn));
  }

  if (groups.length !== 8) {
    return null;
  }

  let value = 0n;
  for (const group of groups) {
    value = (value << 16n) | BigInt(group);
  }

  return { value, mappedFromIpv6: true };
}

export function parseIp(raw: string): ParsedIp | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const value = cleanIpCandidate(raw);
  if (!value) {
    return null;
  }

  if (value.includes(':')) {
    const parsed = parseIpv6(value);
    if (!parsed) {
      return null;
    }
    const isMapped = parsed.value >> 32n === 0xffffn && parsed.value >> 48n === 0n;
    if (isMapped) {
      return { version: 4, value: parsed.value & 0xffffffffn, mappedFromIpv6: true };
    }
    return { version: 6, value: parsed.value, mappedFromIpv6: false };
  }

  const ipv4 = parseIpv4(value);
  if (ipv4 === null) {
    return null;
  }
  return { version: 4, value: ipv4, mappedFromIpv6: false };
}

export function parseWhitelistEntry(raw: string): IpRange | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const value = raw.trim();
  if (!value) {
    return null;
  }

  const segments = value.split('/');
  if (segments.length > 2) {
    return null;
  }

  const address = parseIp(segments[0]);
  if (!address) {
    return null;
  }

  let prefix: number;
  if (segments.length === 1) {
    prefix = address.version === 4 ? 32 : 128;
  } else {
    const prefixText = segments[1];
    if (!/^\d+$/.test(prefixText)) {
      return null;
    }
    prefix = Number(prefixText);

    if (address.mappedFromIpv6) {
      if (prefix < 96 || prefix > 128) {
        return null;
      }
      prefix -= 96;
    } else if (prefix > (address.version === 4 ? 32 : 128)) {
      return null;
    }
  }

  const total = address.version === 4 ? 32n : 128n;
  const mask = ((1n << total) - 1n) ^ ((1n << (total - BigInt(prefix))) - 1n);

  return {
    version: address.version,
    network: address.value & mask,
    mask,
    prefix,
  };
}

export function isIpAllowed(clientIp: string, whitelist: readonly string[]): boolean {
  const client = parseIp(clientIp);
  if (!client) {
    return false;
  }

  return whitelist.some((entry) => {
    const range = parseWhitelistEntry(entry);
    return (
      range !== null &&
      range.version === client.version &&
      (client.value & range.mask) === range.network
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
    logger.error('IP whitelist middleware error', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
