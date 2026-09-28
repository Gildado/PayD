import { Request, Response, NextFunction } from 'express';
import tenantConfigService, { SecuritySettings } from '../services/tenantConfigService.js';

function extractClientIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim();
  const realIp = req.headers['x-real-ip']?.toString().trim();
  return forwardedFor || realIp || req.ip || '';
}

function normalizeIp(ip: string): string {
  return ip.replace(/^::ffff:/, '').trim();
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
      .map((ip) => normalizeIp(String(ip)))
      .filter(Boolean);

    if (whitelist.length === 0) {
      return next();
    }

    const clientIp = normalizeIp(extractClientIp(req));
    if (!clientIp || !whitelist.includes(clientIp)) {
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
