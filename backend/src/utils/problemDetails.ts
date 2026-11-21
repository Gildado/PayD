/**
 * RFC 7807 / RFC 9457 "problem details" responses (issue #1809).
 *
 * Every 4xx/5xx error body is served as `application/problem+json` with:
 *
 *   type      Stable URN identifying the error class (see PROBLEM_TYPES).
 *             Clients should branch on `type`, not on `title` or `detail`.
 *   title     Short, human-readable summary for the type. Constant per type.
 *   status    HTTP status code, duplicated in the body as RFC 7807 requires.
 *   detail    Human-readable explanation specific to this occurrence.
 *   instance  The request path that produced the error.
 *
 * Extension members kept for backward compatibility with existing clients:
 *   code      The legacy ErrorCodes value (e.g. VALIDATION_ERROR).
 *   message   Same value as `detail`.
 *   details   Same array as `errors` (legacy name).
 *
 * Validation failures additionally carry `errors`: an array of
 * { path, message, code } entries, one per failing field.
 * See docs/API_ERRORS.md for the full list of types.
 */

import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { ErrorCodes } from './apiError.js';

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

/** Namespace for stable problem type identifiers. */
const TYPE_PREFIX = 'urn:payd:error:';

export interface ProblemType {
  /** Stable URI identifying the error class. Never change once published. */
  type: string;
  title: string;
  /** Default HTTP status for this type. */
  status: number;
  /** Legacy error code this type maps to. */
  code: string;
}

function problemType(code: string, title: string, status: number): ProblemType {
  return {
    type: `${TYPE_PREFIX}${code.toLowerCase().replace(/_/g, '-')}`,
    title,
    status,
    code,
  };
}

/** Registry of problem types. Keys are legacy ErrorCodes. */
export const PROBLEM_TYPES: Record<string, ProblemType> = {
  [ErrorCodes.VALIDATION_ERROR]: problemType(ErrorCodes.VALIDATION_ERROR, 'Validation failed', 400),
  [ErrorCodes.BAD_REQUEST]: problemType(ErrorCodes.BAD_REQUEST, 'Bad request', 400),
  [ErrorCodes.UNAUTHORIZED]: problemType(ErrorCodes.UNAUTHORIZED, 'Authentication required', 401),
  [ErrorCodes.FORBIDDEN]: problemType(ErrorCodes.FORBIDDEN, 'Access forbidden', 403),
  [ErrorCodes.NOT_FOUND]: problemType(ErrorCodes.NOT_FOUND, 'Resource not found', 404),
  [ErrorCodes.CONFLICT]: problemType(ErrorCodes.CONFLICT, 'Conflict', 409),
  [ErrorCodes.UNPROCESSABLE]: problemType(ErrorCodes.UNPROCESSABLE, 'Unprocessable request', 422),
  [ErrorCodes.PAYLOAD_TOO_LARGE]: problemType(
    ErrorCodes.PAYLOAD_TOO_LARGE,
    'Payload too large',
    413
  ),
  [ErrorCodes.RATE_LIMITED]: problemType(ErrorCodes.RATE_LIMITED, 'Too many requests', 429),
  [ErrorCodes.INTERNAL_ERROR]: problemType(ErrorCodes.INTERNAL_ERROR, 'Internal server error', 500),
};

/** One field-level validation failure. */
export interface ProblemFieldError {
  path: string;
  message: string;
  code: string;
}

export interface ProblemBody {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  code: string;
  message: string;
  details: unknown[];
  errors?: unknown[];
  requestId?: string;
}

export interface BuildProblemOptions {
  code: string;
  /** Overrides the registry status (e.g. a 404 served with a generic code). */
  status?: number;
  detail: string;
  instance?: string;
  errors?: unknown[];
  requestId?: string;
}

/** Look up the registry entry for a legacy code, falling back to a 4xx/5xx default. */
export function problemTypeFor(code: string, status: number): ProblemType {
  const registered: ProblemType | undefined = PROBLEM_TYPES[code];
  if (registered) {
    return registered;
  }
  const fallbackCode = status >= 500 ? ErrorCodes.INTERNAL_ERROR : ErrorCodes.BAD_REQUEST;
  return PROBLEM_TYPES[fallbackCode] as ProblemType;
}

export function buildProblem(options: BuildProblemOptions): ProblemBody {
  const status = options.status ?? PROBLEM_TYPES[options.code]?.status ?? 500;
  const entry = problemTypeFor(options.code, status);
  const errors = options.errors ?? [];

  const body: ProblemBody = {
    type: entry.type,
    title: entry.title,
    status,
    detail: options.detail,
    code: options.code,
    message: options.detail,
    details: errors,
  };

  if (options.instance !== undefined) body.instance = options.instance;
  if (options.errors !== undefined) body.errors = errors;
  if (options.requestId !== undefined) body.requestId = options.requestId;

  return body;
}

/** Convert ZodError issues into the field-level `errors` array. */
export function zodIssuesToProblemErrors(error: ZodError): ProblemFieldError[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

/** Send a problem+json response. Status defaults to the registry status for `code`. */
export function sendProblem(
  req: Request,
  res: Response,
  options: Omit<BuildProblemOptions, 'instance' | 'requestId'>
): Response {
  const requestId = (req as Request & { requestId?: string }).requestId;
  const body = buildProblem({
    ...options,
    instance: req.originalUrl ? req.originalUrl.split('?')[0] : req.path,
    requestId,
  });
  return res.status(body.status).type(PROBLEM_CONTENT_TYPE).json(body);
}
