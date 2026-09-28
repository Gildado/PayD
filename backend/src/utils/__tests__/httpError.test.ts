import { HttpError } from '../httpError.js';
import { ErrorCodes } from '../apiError.js';

describe('HttpError', () => {
  it('creates an error with correct properties', () => {
    const err = new HttpError(400, 'Bad input', 'CUSTOM_CODE', [{ field: 'name' }]);

    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(400);
    expect(err.message).toBe('Bad input');
    expect(err.code).toBe('CUSTOM_CODE');
    expect(err.details).toEqual([{ field: 'name' }]);
    expect(err.name).toBe('HttpError');
  });

  it('assigns default error code based on status', () => {
    expect(new HttpError(401, 'test').code).toBe(ErrorCodes.UNAUTHORIZED);
    expect(new HttpError(403, 'test').code).toBe(ErrorCodes.FORBIDDEN);
    expect(new HttpError(404, 'test').code).toBe(ErrorCodes.NOT_FOUND);
    expect(new HttpError(500, 'test').code).toBe(ErrorCodes.INTERNAL_ERROR);
  });

  describe('factory methods', () => {
    it('badRequest()', () => {
      const err = HttpError.badRequest('Invalid input');
      expect(err.status).toBe(400);
      expect(err.code).toBe(ErrorCodes.BAD_REQUEST);
    });

    it('unauthorized()', () => {
      const err = HttpError.unauthorized();
      expect(err.status).toBe(401);
      expect(err.message).toBe('Unauthorized');
    });

    it('forbidden()', () => {
      const err = HttpError.forbidden();
      expect(err.status).toBe(403);
    });

    it('notFound()', () => {
      const err = HttpError.notFound('User not found');
      expect(err.status).toBe(404);
      expect(err.message).toBe('User not found');
    });

    it('conflict()', () => {
      const err = HttpError.conflict('Already exists');
      expect(err.status).toBe(409);
      expect(err.code).toBe(ErrorCodes.CONFLICT);
    });

    it('unprocessable()', () => {
      const err = HttpError.unprocessable('Cannot process', [{ reason: 'bad' }]);
      expect(err.status).toBe(422);
      expect(err.details).toEqual([{ reason: 'bad' }]);
    });

    it('internal()', () => {
      const err = HttpError.internal();
      expect(err.status).toBe(500);
      expect(err.message).toBe('Internal server error');
    });
  });
});
