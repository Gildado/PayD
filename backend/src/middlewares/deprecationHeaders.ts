import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

interface DeprecationConfig {
  deprecationDate?: string;
  sunsetDate?: string;
  successorPath?: string;
  message?: string;
}

const DEFAULT_CONFIG: DeprecationConfig = {
  deprecationDate: new Date().toISOString().split('T')[0],
  sunsetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString(),
  message: 'This API version is deprecated. Please migrate to the latest version.',
};

export function deprecationHeadersMiddleware(config: DeprecationConfig = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return (req: Request, res: Response, next: NextFunction) => {
    const successorPath = finalConfig.successorPath
      ? finalConfig.successorPath.replace(/\/v1\//, '/v2/')
      : req.path.replace(/\/v1\//, '/v2/');

    res.setHeader('Deprecated', 'true');
    if (finalConfig.sunsetDate) {
      res.setHeader('Sunset', finalConfig.sunsetDate);
    }
    res.setHeader('Link', `<${successorPath}>; rel="successor-version"`);
    res.setHeader('X-API-Warn', finalConfig.message);

    next();
  };
}

export interface RouteDeprecationInfo {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  deprecatedSince: string;
  sunsetDate: string;
  successorPath: string;
  replacementDetails?: string;
}

export class DeprecationTracker {
  private deprecatedRoutes: Map<string, RouteDeprecationInfo> = new Map();

  registerDeprecatedRoute(info: RouteDeprecationInfo): void {
    const key = `${info.method} ${info.path}`;
    this.deprecatedRoutes.set(key, info);
    logger.info(`Registered deprecated route: ${key}`);
  }

  getDeprecatedRouteInfo(method: string, path: string): RouteDeprecationInfo | undefined {
    const key = `${method} ${path}`;
    return this.deprecatedRoutes.get(key);
  }

  getAllDeprecatedRoutes(): RouteDeprecationInfo[] {
    return Array.from(this.deprecatedRoutes.values());
  }

  logDeprecatedRouteUsage(method: string, path: string, clientInfo?: string): void {
    const info = this.getDeprecatedRouteInfo(method, path);
    if (info) {
      logger.warn(
        `Deprecated route used: ${method} ${path} ` +
        `(successor: ${info.successorPath}) ` +
        `(sunset: ${info.sunsetDate})` +
        (clientInfo ? ` [${clientInfo}]` : ''),
      );
    }
  }
}

let tracker: DeprecationTracker | null = null;

export function getDeprecationTracker(): DeprecationTracker {
  if (!tracker) {
    tracker = new DeprecationTracker();
  }
  return tracker;
}

export function trackingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const tracker = getDeprecationTracker();
  const clientIp = req.ip;
  tracker.logDeprecatedRouteUsage(req.method, req.path, clientIp);
  next();
}
