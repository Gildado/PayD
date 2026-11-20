/**
 * @file src/utils/etag.ts
 * @description Weak ETag helpers for conditional GET responses (#1810).
 *
 * The ETag is derived from the exact serialized response body, so identical
 * data always yields the same tag and any change to the payload yields a new one.
 * Clients that send `If-None-Match` with a matching tag receive `304 Not Modified`
 * with no body, saving bandwidth on mostly-static endpoints such as `/rates`.
 */

import crypto from 'crypto';
import type { Request, Response } from 'express';

/**
 * Compute a weak ETag (`W/"<hex>"`) for a response body.
 * Pure function: same input always produces the same tag.
 */
export function computeWeakETag(body: string | Buffer): string {
  const digest = crypto.createHash('sha256').update(body).digest('hex').slice(0, 32);
  return `W/"${digest}"`;
}

/** Strip the optional `W/` prefix so weak and strong tags compare by opaque value. */
function opaqueTag(tag: string): string {
  return tag.trim().replace(/^W\//, '');
}

/**
 * Decide whether an `If-None-Match` header matches the current ETag.
 * Per RFC 9110 §13.1.2 the comparison is weak: `W/` prefixes are ignored.
 * A `*` value matches any current representation.
 *
 * @param header - Raw `If-None-Match` header value (may be undefined).
 * @param etag   - The ETag of the current representation.
 */
export function ifNoneMatchMatches(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  if (header.trim() === '*') return true;

  const current = opaqueTag(etag);
  return header
    .split(',')
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.length > 0)
    .some((candidate) => opaqueTag(candidate) === current);
}

/**
 * Send a JSON payload with a weak ETag, answering `304 Not Modified` when the
 * client already holds the current representation.
 *
 * Callers set their own `Cache-Control` before calling this helper.
 */
export function sendJsonWithETag(req: Request, res: Response, payload: unknown): void {
  const body = JSON.stringify(payload);
  const etag = computeWeakETag(body);

  res.set('ETag', etag);

  if (ifNoneMatchMatches(req.headers['if-none-match'], etag)) {
    res.status(304).end();
    return;
  }

  res.type('application/json').send(body);
}
