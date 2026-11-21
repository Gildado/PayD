/**
 * Parser for RFC 7807 `application/problem+json` error bodies (issue #1809).
 *
 * The backend sends every 4xx/5xx error as a problem document. Clients should
 * branch on `type` (a stable URN such as `urn:payd:error:validation-error`),
 * never on `title` or `detail`, which are human-readable and may change.
 *
 * Responses that predate problem+json (`{ code, message, details }` or
 * `{ error, details }`) are still understood so older endpoints keep working.
 * See docs/API_ERRORS.md for the full list of types.
 */

export const PROBLEM_TYPE_PREFIX = 'urn:payd:error:';

/** Stable problem type identifiers the frontend knows about. */
export const PROBLEM_TYPES = {
  validationError: `${PROBLEM_TYPE_PREFIX}validation-error`,
  badRequest: `${PROBLEM_TYPE_PREFIX}bad-request`,
  unauthorized: `${PROBLEM_TYPE_PREFIX}unauthorized`,
  forbidden: `${PROBLEM_TYPE_PREFIX}forbidden`,
  notFound: `${PROBLEM_TYPE_PREFIX}not-found`,
  conflict: `${PROBLEM_TYPE_PREFIX}conflict`,
  unprocessable: `${PROBLEM_TYPE_PREFIX}unprocessable`,
  payloadTooLarge: `${PROBLEM_TYPE_PREFIX}payload-too-large`,
  rateLimited: `${PROBLEM_TYPE_PREFIX}rate-limited`,
  internalError: `${PROBLEM_TYPE_PREFIX}internal-error`,
} as const;

export interface ProblemFieldError {
  path?: string;
  message?: string;
  code?: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  /** Legacy error code, e.g. VALIDATION_ERROR. */
  code?: string;
  /** Field-level validation failures. Empty for non-validation problems. */
  errors: ProblemFieldError[];
  requestId?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toFieldErrors = (value: unknown): ProblemFieldError[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => ({
    path: typeof item.path === 'string' ? item.path : undefined,
    message: typeof item.message === 'string' ? item.message : undefined,
    code: typeof item.code === 'string' ? item.code : undefined,
  }));
};

/**
 * Parse an error response body as a problem document.
 *
 * Returns null when the body is not a problem document (for example a legacy
 * `{ error: '...' }` body or an HTML page from a proxy).
 */
export function parseProblemDetails(data: unknown): ProblemDetails | null {
  if (!isRecord(data)) return null;
  if (typeof data.type !== 'string' || typeof data.status !== 'number') return null;

  const detail =
    typeof data.detail === 'string'
      ? data.detail
      : typeof data.message === 'string'
        ? data.message
        : '';

  return {
    type: data.type,
    title: typeof data.title === 'string' ? data.title : '',
    status: data.status,
    detail,
    instance: typeof data.instance === 'string' ? data.instance : undefined,
    code: typeof data.code === 'string' ? data.code : undefined,
    errors: toFieldErrors(data.errors ?? data.details),
    requestId: typeof data.requestId === 'string' ? data.requestId : undefined,
  };
}

/** True when the problem has the given stable type. */
export function isProblemType(
  problem: Pick<ProblemDetails, 'type'> | null | undefined,
  type: string
): boolean {
  return problem?.type === type;
}

/**
 * Best human-readable message for an error body, falling back to `fallback`.
 * Prefers `detail` from a problem document, then the legacy `message` / `error`.
 */
export function getProblemErrorMessage(data: unknown, fallback: string): string {
  const problem = parseProblemDetails(data);
  if (problem?.detail) return problem.detail;

  if (isRecord(data)) {
    if (typeof data.message === 'string' && data.message) return data.message;
    if (typeof data.error === 'string' && data.error) return data.error;
  }
  return fallback;
}
