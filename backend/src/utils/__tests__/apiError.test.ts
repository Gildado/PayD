import { apiErrorResponse, ErrorCodes } from '../../utils/apiError.js';

describe('apiErrorResponse', () => {
  it('returns the correct shape with all three required fields', () => {
    const result = apiErrorResponse('VALIDATION_ERROR', 'Invalid input');
    expect(result).toEqual({ code: 'VALIDATION_ERROR', message: 'Invalid input', details: [] });
  });

  it('includes provided details array', () => {
    const details = [{ field: 'email', message: 'required' }];
    const result = apiErrorResponse('VALIDATION_ERROR', 'Validation failed', details);
    expect(result.details).toEqual(details);
  });

  it('defaults details to an empty array when omitted', () => {
    const result = apiErrorResponse('NOT_FOUND', 'Resource not found');
    expect(Array.isArray(result.details)).toBe(true);
    expect(result.details).toHaveLength(0);
  });

  it('preserves arbitrary detail shapes', () => {
    const details = [{ path: ['name'], message: 'Required' }, 'string-detail', 42];
    const result = apiErrorResponse('BAD_REQUEST', 'Bad input', details);
    expect(result.details).toEqual(details);
  });

  describe('ErrorCodes constants', () => {
    it('exposes all expected error codes', () => {
      const expected = [
        'VALIDATION_ERROR',
        'UNAUTHORIZED',
        'FORBIDDEN',
        'NOT_FOUND',
        'CONFLICT',
        'UNPROCESSABLE',
        'INTERNAL_ERROR',
        'RATE_LIMITED',
        'BAD_REQUEST',
      ];
      expected.forEach((code) => {
        expect(Object.values(ErrorCodes)).toContain(code);
      });
    });

    it('produces a valid response for every built-in code', () => {
      Object.values(ErrorCodes).forEach((code) => {
        const result = apiErrorResponse(code, 'Test message');
        expect(result).toMatchObject({ code, message: 'Test message', details: [] });
      });
    });
  });
});
