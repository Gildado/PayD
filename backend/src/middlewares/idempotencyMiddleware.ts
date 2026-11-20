import { Request, Response, NextFunction } from 'express';
import {
  IdempotencyService,
  type IdempotencyRecord,
} from '../services/idempotencyService.js';
import logger from '../utils/logger.js';

export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
export const IDEMPOTENCY_REPLAYED_HEADER = 'Idempotency-Replayed';

/**
 * Extracts the tenant scope used to namespace idempotency keys. Falls back
 * to the raw client IP when no authenticated organization is available.
 */
function getTenantScope(req: Request): string {
  return (
    (req.user as { organizationId?: string } | undefined)?.organizationId ??
    req.ip ??
    'anonymous'
  );
}

/**
 * Idempotency middleware for mutating endpoints (issue #1025).
 *
 * Behaviour:
 * - Missing/invalid key (must be a UUID v4) → 400 Bad Request
 * - Key already completed → replay stored response with
 *   `Idempotency-Replayed: true`
 * - Key currently in flight (concurrent duplicate) → 409 Conflict
 * - Otherwise: acquire lock, execute handler, store response, release lock
 */
export function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const rawKey = req.get(IDEMPOTENCY_KEY_HEADER);

  if (!IdempotencyService.isValidKey(rawKey)) {
    res.status(400).json({
      error:
        `Missing or invalid ${IDEMPOTENCY_KEY_HEADER} header. ` +
        'A UUID v4 value is required for this endpoint.',
    });
    return;
  }

  const key = rawKey;
  const tenantScope = getTenantScope(req);

  (async () => {
    // 1. Replay a previously stored response if present.
    const existing = await IdempotencyService.getResponse(tenantScope, key);
    if (existing) {
      logger.info(`[idempotency] Replaying cached response for key ${key}`);
      res.set(IDEMPOTENCY_REPLAYED_HEADER, 'true');
      res.set('Content-Type', existing.contentType || 'application/json');
      res.status(existing.statusCode).send(existing.body);
      return;
    }

    // 2. Reject concurrent duplicates while the first request is in flight.
    const acquired = await IdempotencyService.acquire(tenantScope, key);
    if (!acquired) {
      res.status(409).json({
        error: 'Conflict',
        detail: `A request with ${IDEMPOTENCY_KEY_HEADER} "${key}" is already in progress.`,
      });
      return;
    }

    // 3. Wrap res.send so the first response is captured and stored before
    //    it is flushed to the client.
    const originalSend = res.send.bind(res);
    let persisted = false;

    res.send = ((body?: unknown): Response => {
      if (!persisted && typeof body !== 'undefined') {
        persisted = true;
        const record: IdempotencyRecord = {
          statusCode: res.statusCode,
          body: typeof body === 'string' ? body : JSON.stringify(body),
          contentType: res.get('Content-Type') ?? 'application/json',
          createdAt: new Date().toISOString(),
        };

        void IdempotencyService.storeResponse(tenantScope, key, record)
          .catch((err) =>
            logger.error(`[idempotency] Error storing response for ${key}:`, err),
          )
          .finally(() => {
            void IdempotencyService.releaseLock(tenantScope, key);
          });
      }
      return originalSend(body);
    }) as Response['send'];

    // 4. If the downstream pipeline errors out, free the key so the client
    //    can retry safely with the same idempotency key.
    res.on('close', () => {
      if (!res.writableEnded && !persisted) {
        void IdempotencyService.markFailed(tenantScope, key);
      }
    });

    next();
  })().catch((err) => {
    logger.error('[idempotency] Middleware failure:', err);
    // Fail open on internal middleware errors rather than blocking traffic.
    next();
  });
}
