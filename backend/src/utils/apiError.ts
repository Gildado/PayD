/**
 * Standardized API Error Response Utility (#439)
 *
 * Ensures every error returned by the API follows the shape:
 *   { code: string, message: string, details: unknown[] }
 *
 * Usage:
 *   res.status(400).json(apiErrorResponse('VALIDATION_ERROR', 'Invalid input', issues));
 *   res.status(500).json(apiErrorResponse('INTERNAL_ERROR', 'Unexpected failure'));
 */

export interface ApiErrorResponse {
  code: string;
  message: string;
  details: unknown[];
}

/**
 * Build a standardized error response object.
 *
 * @param code    Machine-readable error code (e.g. "VALIDATION_ERROR")
 * @param message Human-readable description of the error
 * @param details Optional array of extra context (e.g. ZodIssue[], field errors)
 */
export function apiErrorResponse(
  code: string,
  message: string,
  details: unknown[] = []
): ApiErrorResponse {
  return { code, message, details };
}

/** Common error code constants used across the application */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNPROCESSABLE: 'UNPROCESSABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  BAD_REQUEST: 'BAD_REQUEST',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
