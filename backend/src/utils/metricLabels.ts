/**
 * Low-cardinality, privacy-safe label values for Prometheus metrics.
 *
 * Two rules apply everywhere request metrics are recorded:
 *   1. The `route` label is the *matched route pattern* (e.g.
 *      `/api/employees/:id`), never the concrete request path.
 *   2. Tenant/user identifiers are bucketed into a fixed number of opaque
 *      tokens. Raw IDs never appear in a label value, and the number of
 *      distinct tenant/user label values is bounded.
 */
import { createHash } from 'node:crypto';
import type { Request } from 'express';

/** Hard upper bound for any free-form label value. */
export const LABEL_VALUE_MAX_LENGTH = 64;

/** Number of opaque buckets used for tenant/user labels (cardinality cap). */
export const ID_LABEL_BUCKETS = 64;

export interface RequestMetricLabels {
  method: string;
  route: string;
  status_code: string;
  tenant: string;
  user: string;
}

type MetricRequest = Request & {
  tenantId?: number | string | null;
  organizationId?: number | string | null;
};

/** True for opaque identifier segments that must never reach a label value. */
function isIdentifierSegment(segment: string): boolean {
  if (!segment || segment.startsWith(':')) return false;
  if (/^\d+$/.test(segment)) return true; // 42
  if (/^[0-9a-f]{8}-[0-9a-f-]{8,}$/i.test(segment)) return true; // uuid
  if (/^[0-9a-f]{8,}$/i.test(segment)) return true; // hex id / hash
  // Long opaque tokens (api keys, snowflake ids, encoded ids).
  return segment.length >= 16 && /^[A-Za-z0-9_-]+$/.test(segment);
}

/** Replace identifier-shaped segments of a concrete path with `:id`. */
export function sanitizePathPattern(path: string): string {
  return path
    .split('/')
    .map((segment) => (isIdentifierSegment(segment) ? ':id' : segment))
    .join('/');
}

/**
 * Derive the Express *matched route pattern* for a request.
 *
 * Uses `req.route.path` plus `req.baseUrl` when a route matched; for unmatched
 * requests (404s) and for RegExp/array route definitions it falls back to a
 * sanitized concrete path so no raw identifier can leak into the label.
 */
export function matchedRoutePattern(
  req: Pick<MetricRequest, 'route' | 'baseUrl' | 'path'>
): string {
  const base = typeof req.baseUrl === 'string' ? req.baseUrl : '';
  const routePath = req.route?.path;

  let pattern: string;
  if (typeof routePath === 'string') {
    pattern = `${base}${routePath}`;
  } else if (Array.isArray(routePath)) {
    pattern = `${base}${routePath.find((p) => typeof p === 'string') ?? '/:id'}`;
  } else if (routePath instanceof RegExp) {
    pattern = `${base}/:id`;
  } else {
    pattern = `${base}${typeof req.path === 'string' ? req.path : '/'}`;
  }

  pattern = sanitizePathPattern(pattern);
  return pattern.length > LABEL_VALUE_MAX_LENGTH
    ? pattern.slice(0, LABEL_VALUE_MAX_LENGTH)
    : pattern;
}

/** Truncate a free-form label value, keeping a stable hash suffix. */
export function boundedLabelValue(value: unknown, maxLength = LABEL_VALUE_MAX_LENGTH): string {
  if (value === undefined || value === null || value === '') return 'none';
  const text = String(value);
  if (text.length <= maxLength) return text;
  const suffix = createHash('sha256').update(text).digest('hex').slice(0, 8);
  return `${text.slice(0, Math.max(1, maxLength - 9))}~${suffix}`;
}

/**
 * Map an identifier to one of a fixed number of opaque buckets.
 *
 * `tenant_3b` and `user_0f` reveal nothing about the underlying ID and cap the
 * cardinality of the label at `ID_LABEL_BUCKETS` values.
 */
export function bucketedIdLabel(
  value: unknown,
  prefix: 'tenant' | 'user',
  buckets = ID_LABEL_BUCKETS
): string {
  if (value === undefined || value === null || value === '') return `${prefix}_none`;
  const digest = createHash('sha256').update(String(value)).digest();
  const bucket = digest.readUInt16BE(0) % buckets;
  return `${prefix}_${bucket.toString(16).padStart(2, '0')}`;
}

/** Build the complete label set for an inbound HTTP request. */
export function buildRequestMetricLabels(req: MetricRequest, statusCode: number): RequestMetricLabels {
  const user = req.user as { id?: number | string | null; organizationId?: number | string | null } | undefined;
  return {
    method: req.method || 'UNKNOWN',
    route: matchedRoutePattern(req),
    status_code: String(statusCode),
    tenant: bucketedIdLabel(req.tenantId ?? req.organizationId ?? user?.organizationId, 'tenant'),
    user: bucketedIdLabel(user?.id, 'user'),
  };
}
