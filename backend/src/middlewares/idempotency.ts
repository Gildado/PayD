import { Request, Response, NextFunction } from 'express';
import {
  getIdempotencyService,
  type IdempotencyService,
} from '../services/idempotencyService.js';
import logger from '../utils/logger.js';

const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type IdempotencyStore = Pick<
  IdempotencyService,
  'getExistingResponse' | 'recordRequest' | 'recordResponse'
>;

export interface IdempotencyRequest extends Request {
  idempotencyKey?: string;
  idempotencyRecordId?: string;
}

async function applyIdempotency(
  req: IdempotencyRequest,
  res: Response,
  next: NextFunction,
  requireUuidV4: boolean,
  serviceProvider: () => IdempotencyService
): Promise<void> {
  const idempotencyKey = req.get(IDEMPOTENCY_KEY_HEADER);

  if (!idempotencyKey && !requireUuidV4) {
    next();
    return;
  }

  if (!idempotencyKey || (requireUuidV4 && !UUID_V4_PATTERN.test(idempotencyKey))) {
    res.status(400).json({
      error: 'A UUID v4 Idempotency-Key header is required for this endpoint.',
    });
    return;
  }

  try {
    const idempotencyService = serviceProvider();
    const organizationId = (req as Request & { organizationId?: string }).organizationId;
    const existingRecord = await idempotencyService.getExistingResponse(
      idempotencyKey,
      organizationId
    );

    if (existingRecord && existingRecord.response_status > 0) {
      logger.info(`Returning cached idempotent response for key: ${idempotencyKey}`);
      res.status(existingRecord.response_status);
      try {
        res.json(JSON.parse(existingRecord.response_body));
      } catch {
        res.send(existingRecord.response_body);
      }
      return;
    }

    if (existingRecord) {
      res.status(409).json({
        error: 'Conflict',
        message: 'A request with this idempotency key is already in progress.',
      });
      return;
    }

    req.idempotencyKey = idempotencyKey;
    const record = await idempotencyService.recordRequest(
      idempotencyKey,
      req.body,
      organizationId
    );
    req.idempotencyRecordId = record.id;

    const originalSend = res.send.bind(res);
    let responseStored = false;

    res.send = ((body?: unknown): Response => {
      if (responseStored) {
        return res;
      }
      responseStored = true;

      const responseBody =
        typeof body === 'string' ? body : JSON.stringify(body ?? '');

      void idempotencyService
        .recordResponse(record.id, responseBody, res.statusCode)
        .then(() => {
          res.send = originalSend;
          originalSend(body);
        })
        .catch((error) => {
          logger.error('Failed to store idempotency response:', error);
          res.send = originalSend;
          if (!res.headersSent) {
            res.status(503);
            res.setHeader('Content-Type', 'application/json');
            originalSend(
              JSON.stringify({
                error: 'Service Unavailable',
                message: 'Idempotency storage is temporarily unavailable.',
              })
            );
          }
        });

      return res;
    }) as Response['send'];

    next();
  } catch (error) {
    logger.error('Idempotency middleware error:', error);

    if ((error as { code?: string })?.code === '23505') {
      res.status(409).json({
        error: 'Conflict',
        message: 'A request with this idempotency key is already in progress.',
      });
      return;
    }

    res.status(503).json({
      error: 'Service Unavailable',
      message: 'Idempotency storage is temporarily unavailable.',
    });
  }
}

export function createIdempotencyMiddleware(
  options: {
    requireUuidV4?: boolean;
    serviceProvider?: () => IdempotencyStore;
  } = {}
) {
  const { requireUuidV4 = false, serviceProvider = getIdempotencyService } = options;

  return (req: IdempotencyRequest, res: Response, next: NextFunction): Promise<void> =>
    applyIdempotency(req, res, next, requireUuidV4, serviceProvider);
}

export const idempotencyMiddleware = createIdempotencyMiddleware();
export const strictIdempotencyMiddleware = createIdempotencyMiddleware({
  requireUuidV4: true,
});
