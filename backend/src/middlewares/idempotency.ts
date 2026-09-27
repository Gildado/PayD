import { Request, Response, NextFunction } from 'express';
import { getIdempotencyService } from '../services/idempotencyService.js';
import logger from '../utils/logger.js';

const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

export interface IdempotencyRequest extends Request {
  idempotencyKey?: string;
  idempotencyRecordId?: string;
}

export async function idempotencyMiddleware(
  req: IdempotencyRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const idempotencyKey = req.get(IDEMPOTENCY_KEY_HEADER);

  if (!idempotencyKey) {
    return next();
  }

  try {
    const idempotencyService = getIdempotencyService();
    const organizationId = (req as any).organizationId;

    const existingRecord = await idempotencyService.getExistingResponse(
      idempotencyKey,
      organizationId,
    );

    if (existingRecord && existingRecord.response_status > 0) {
      logger.info(`Returning cached idempotent response for key: ${idempotencyKey}`);
      res.status(existingRecord.response_status);
      
      try {
        const responseBody = JSON.parse(existingRecord.response_body);
        return res.json(responseBody);
      } catch {
        return res.send(existingRecord.response_body);
      }
    }

    req.idempotencyKey = idempotencyKey;

    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    res.json = function (body: any) {
      if (req.idempotencyRecordId) {
        idempotencyService
          .recordResponse(req.idempotencyRecordId, body, res.statusCode)
          .catch((error) => {
            logger.error('Failed to record idempotency response:', error);
          });
      }
      return originalJson(body);
    };

    res.send = function (data: any) {
      if (req.idempotencyRecordId) {
        idempotencyService
          .recordResponse(req.idempotencyRecordId, data, res.statusCode)
          .catch((error) => {
            logger.error('Failed to record idempotency response:', error);
          });
      }
      return originalSend(data);
    };

    const recordResult = await idempotencyService.recordRequest(
      idempotencyKey,
      req.body,
      organizationId,
    );
    req.idempotencyRecordId = recordResult.id;

    next();
  } catch (error) {
    logger.warn('Idempotency middleware error:', error);
    next();
  }
}
