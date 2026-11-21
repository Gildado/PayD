import { describe, expect, it } from 'vitest';
import {
  getProblemErrorMessage,
  isProblemType,
  parseProblemDetails,
  PROBLEM_TYPES,
} from '../problemDetails';

const validationProblem = {
  type: 'urn:payd:error:validation-error',
  title: 'Validation failed',
  status: 400,
  detail: 'Request validation failed',
  instance: '/api/v1/employees',
  code: 'VALIDATION_ERROR',
  message: 'Request validation failed',
  details: [{ path: 'email', message: 'Invalid email address', code: 'invalid_string' }],
  errors: [{ path: 'email', message: 'Invalid email address', code: 'invalid_string' }],
  requestId: 'req-1',
};

describe('parseProblemDetails', () => {
  it('parses a full problem document', () => {
    const problem = parseProblemDetails(validationProblem);

    expect(problem).toEqual({
      type: PROBLEM_TYPES.validationError,
      title: 'Validation failed',
      status: 400,
      detail: 'Request validation failed',
      instance: '/api/v1/employees',
      code: 'VALIDATION_ERROR',
      errors: [{ path: 'email', message: 'Invalid email address', code: 'invalid_string' }],
      requestId: 'req-1',
    });
  });

  it('returns null for legacy error bodies without a problem type', () => {
    expect(parseProblemDetails({ error: 'Validation Error' })).toBeNull();
    expect(parseProblemDetails({ code: 'NOT_FOUND', message: 'x' })).toBeNull();
  });

  it('returns null for non-object bodies (e.g. HTML from a proxy)', () => {
    expect(parseProblemDetails('<html>502</html>')).toBeNull();
    expect(parseProblemDetails(null)).toBeNull();
    expect(parseProblemDetails(undefined)).toBeNull();
    expect(parseProblemDetails(['urn:payd:error:x'])).toBeNull();
  });

  it('falls back to message when detail is missing', () => {
    const problem = parseProblemDetails({
      type: 'urn:payd:error:conflict',
      status: 409,
      message: 'Dup',
    });
    expect(problem?.detail).toBe('Dup');
    expect(problem?.errors).toEqual([]);
  });

  it('drops non-object field errors and normalises the rest', () => {
    const problem = parseProblemDetails({
      type: 'urn:payd:error:validation-error',
      status: 400,
      errors: [null, 'x', { path: 'a', message: 'ok' }, { path: 5 }],
    });
    expect(problem?.errors).toEqual([{ path: 'a', message: 'ok' }, {}]);
  });
});

describe('isProblemType', () => {
  it('matches by stable type, not by title or status', () => {
    const problem = parseProblemDetails(validationProblem);
    expect(isProblemType(problem, PROBLEM_TYPES.validationError)).toBe(true);
    expect(isProblemType(problem, PROBLEM_TYPES.notFound)).toBe(false);
    expect(isProblemType(null, PROBLEM_TYPES.validationError)).toBe(false);
  });
});

describe('getProblemErrorMessage', () => {
  it('prefers problem detail', () => {
    expect(getProblemErrorMessage(validationProblem, 'fallback')).toBe('Request validation failed');
  });

  it('uses legacy message and error fields', () => {
    expect(getProblemErrorMessage({ message: 'legacy msg' }, 'fallback')).toBe('legacy msg');
    expect(getProblemErrorMessage({ error: 'Not Found' }, 'fallback')).toBe('Not Found');
  });

  it('uses the fallback when nothing usable is present', () => {
    expect(getProblemErrorMessage(undefined, 'fallback')).toBe('fallback');
    expect(getProblemErrorMessage({ message: '' }, 'fallback')).toBe('fallback');
  });
});
