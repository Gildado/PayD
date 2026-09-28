import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import { Request, Response, NextFunction } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

const requestContext = new AsyncLocalStorage<{ requestId: string }>();

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const extractRequestId = (headerValue: string | string[] | undefined): string => {
  const requestId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (requestId && UUID_REGEX.test(requestId)) {
    return requestId;
  }
  return randomUUID();
};

export const getRequestId = (): string | undefined => requestContext.getStore()?.requestId;

export const runWithRequestId = <T>(requestId: string, callback: () => T): T =>
  requestContext.run({ requestId }, callback);

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = extractRequestId(req.headers[REQUEST_ID_HEADER]);

  req.requestId = requestId;
  (req as any).id = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  requestContext.run({ requestId }, () => next());
};
