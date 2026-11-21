/**
 * errorHandlerMiddleware (issue #341)
 *
 * Every error response is an RFC 7807 problem document served as
 * `application/problem+json` (issue #1809). See utils/problemDetails.ts and
 * docs/API_ERRORS.md. The legacy fields `code`, `message` and `details` are kept
 * as extension members for existing clients.
 *
 * Covers four error categories:
 *   1. ZodError          – request-body / query validation failures (400)
 *   2. HTTP-tagged errors – objects carrying a numeric `status` field (4xx)
 *   3. Well-known JS     – TypeError, RangeError, SyntaxError → 400
 *   4. Everything else   – 500 (message hidden in production)
 *
 * Place this middleware last in the Express chain, after all routes.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ErrorCodes } from '../utils/apiError.js';
import {
  buildProblem,
  PROBLEM_CONTENT_TYPE,
  zodIssuesToProblemErrors,
} from '../utils/problemDetails.js';
import logger from '../utils/logger.js';

// ── HTTP-tagged error shape ────────────────────────────────────────────────────

export interface HttpError extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
  details?: unknown[];
}

// ── Classifier helpers ────────────────────────────────────────────────────────

function isZodError(err: unknown): err is ZodError {
  return err instanceof ZodError;
}

function isHttpError(err: unknown): err is HttpError {
  return (
    err instanceof Error &&
    (typeof (err as HttpError).status === 'number' ||
      typeof (err as HttpError).statusCode === 'number')
  );
}

function httpStatusFor(err: HttpError): number {
  const s = err.status ?? err.statusCode ?? 500;
  return s >= 100 && s <= 599 ? s : 500;
}

function errorCodeFor(status: number, err: HttpError): string {
  if (err.code) return err.code;
  switch (status) {
    case 400:
      return ErrorCodes.BAD_REQUEST;
    case 401:
      return ErrorCodes.UNAUTHORIZED;
    case 403:
      return ErrorCodes.FORBIDDEN;
    case 404:
      return ErrorCodes.NOT_FOUND;
    case 409:
      return ErrorCodes.CONFLICT;
    case 422:
      return ErrorCodes.UNPROCESSABLE;
    case 429:
      return ErrorCodes.RATE_LIMITED;
    default:
      return status < 500 ? ErrorCodes.BAD_REQUEST : ErrorCodes.INTERNAL_ERROR;
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandlerMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId;
  const instance = req.originalUrl ? req.originalUrl.split('?')[0] : req.path;
  const sendProblemBody = (status: number, body: ReturnType<typeof buildProblem>) => {
    res.status(status).type(PROBLEM_CONTENT_TYPE).json(body);
  };

  // ── 1. Zod validation errors ──────────────────────────────────────────────
  if (isZodError(err)) {
    const errors = zodIssuesToProblemErrors(err);

    logger.warn(`[${requestId}] Validation error on ${req.method} ${req.path}`, {
      details: errors,
    });

    sendProblemBody(
      400,
      buildProblem({
        code: ErrorCodes.VALIDATION_ERROR,
        detail: 'Request validation failed',
        instance,
        errors,
        requestId,
      })
    );
    return;
  }

  // ── 2. HTTP-tagged errors ─────────────────────────────────────────────────
  if (isHttpError(err)) {
    const status = httpStatusFor(err);
    const code = errorCodeFor(status, err);
    const message = err.message || 'An error occurred';
    const details = err.details ?? [];

    if (status >= 500) {
      logger.error(`[${requestId}] HTTP ${status} on ${req.method} ${req.path}: ${message}`, err);
    } else {
      logger.warn(`[${requestId}] HTTP ${status} on ${req.method} ${req.path}: ${message}`);
    }

    sendProblemBody(
      status,
      buildProblem({
        code,
        status,
        detail: message,
        instance,
        errors: details,
        requestId,
      })
    );
    return;
  }

  // ── 3. Client-side JS errors (likely bad input) ───────────────────────────
  if (err instanceof TypeError || err instanceof RangeError || err instanceof SyntaxError) {
    logger.warn(
      `[${requestId}] Client error (${err.constructor.name}) on ${req.method} ${req.path}: ${err.message}`
    );
    sendProblemBody(
      400,
      buildProblem({
        code: ErrorCodes.BAD_REQUEST,
        detail: err.message,
        instance,
        requestId,
      })
    );
    return;
  }

  // ── 4. Unexpected / internal errors ──────────────────────────────────────
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : 'An unexpected error occurred';

  logger.error(`[${requestId}] Unhandled error on ${req.method} ${req.path}: ${message}`, err);

  const isProd = process.env.NODE_ENV === 'production';
  sendProblemBody(
    500,
    buildProblem({
      code: ErrorCodes.INTERNAL_ERROR,
      detail: isProd ? 'An unexpected error occurred' : message,
      instance,
      requestId,
    })
  );
}
