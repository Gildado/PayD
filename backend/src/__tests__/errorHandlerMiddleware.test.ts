/**
 * Integration tests for errorHandlerMiddleware (issue #341)
 *
 * Verifies that every error path produces a response matching the standard
 * shape: { code: string, message: string, details: unknown[] }
 */

import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { ZodError, z } from 'zod';
import { errorHandlerMiddleware, HttpError } from '../middlewares/errorHandlerMiddleware.js';
import { ErrorCodes } from '../utils/apiError.js';

// ── Test app factory ──────────────────────────────────────────────────────────

function makeApp(thrower: (req: Request, res: Response, next: NextFunction) => void) {
  const app = express();
  app.use(express.json());

  // Attach a requestId for the middleware to include in responses
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.requestId = 'test-req-id';
    next();
  });

  app.get('/test', thrower);
  app.use(errorHandlerMiddleware);
  return app;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function assertStandardShape(body: Record<string, unknown>) {
  expect(typeof body.code).toBe('string');
  expect(typeof body.message).toBe('string');
  expect(Array.isArray(body.details)).toBe(true);
}

// ── ZodError ──────────────────────────────────────────────────────────────────

describe('errorHandlerMiddleware — ZodError', () => {
  it('returns 400 with VALIDATION_ERROR code and issue details', async () => {
    const app = makeApp((_req, _res, next) => {
      const schema = z.object({ email: z.string().email() });
      try {
        schema.parse({ email: 'not-an-email' });
      } catch (err) {
        next(err);
      }
    });

    const res = await request(app).get('/test');

    expect(res.status).toBe(400);
    assertStandardShape(res.body);
    expect(res.body.code).toBe(ErrorCodes.VALIDATION_ERROR);
    expect(res.body.details.length).toBeGreaterThan(0);
    expect(res.body.details[0]).toHaveProperty('path');
    expect(res.body.details[0]).toHaveProperty('message');
  });
});

// ── HTTP-tagged errors ────────────────────────────────────────────────────────

describe('errorHandlerMiddleware — HttpError', () => {
  it.each([
    [400, ErrorCodes.BAD_REQUEST, 'Bad input'],
    [401, ErrorCodes.UNAUTHORIZED, 'Token missing'],
    [403, ErrorCodes.FORBIDDEN, 'Access denied'],
    [404, ErrorCodes.NOT_FOUND, 'Not found'],
    [409, ErrorCodes.CONFLICT, 'Already exists'],
    [422, ErrorCodes.UNPROCESSABLE, 'Unprocessable'],
    [429, ErrorCodes.RATE_LIMITED, 'Too many requests'],
  ])('status %d → code %s', async (status, expectedCode, message) => {
    const app = makeApp((_req, _res, next) => {
      const err: HttpError = Object.assign(new Error(message), { status });
      next(err);
    });

    const res = await request(app).get('/test');

    expect(res.status).toBe(status);
    assertStandardShape(res.body);
    expect(res.body.code).toBe(expectedCode);
    expect(res.body.message).toBe(message);
  });

  it('uses the error code field when provided', async () => {
    const app = makeApp((_req, _res, next) => {
      const err: HttpError = Object.assign(new Error('Custom'), {
        status: 400,
        code: 'CUSTOM_CODE',
      });
      next(err);
    });

    const res = await request(app).get('/test');
    expect(res.body.code).toBe('CUSTOM_CODE');
  });

  it('includes details array from the error when provided', async () => {
    const app = makeApp((_req, _res, next) => {
      const err: HttpError = Object.assign(new Error('With details'), {
        status: 422,
        details: [{ field: 'email', message: 'Invalid format' }],
      });
      next(err);
    });

    const res = await request(app).get('/test');
    expect(res.body.details).toHaveLength(1);
    expect(res.body.details[0]).toHaveProperty('field', 'email');
  });
});

// ── Client-side JS errors ─────────────────────────────────────────────────────

describe('errorHandlerMiddleware — client JS errors', () => {
  it.each([
    ['TypeError',   new TypeError('invalid type')],
    ['RangeError',  new RangeError('out of range')],
    ['SyntaxError', new SyntaxError('bad syntax')],
  ])('%s → 400 BAD_REQUEST', async (_label, err) => {
    const app = makeApp((_req, _res, next) => next(err));

    const res = await request(app).get('/test');

    expect(res.status).toBe(400);
    assertStandardShape(res.body);
    expect(res.body.code).toBe(ErrorCodes.BAD_REQUEST);
  });
});

// ── Unhandled / internal errors ───────────────────────────────────────────────

describe('errorHandlerMiddleware — unhandled errors', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('returns 500 INTERNAL_ERROR', async () => {
    const app = makeApp((_req, _res, next) => {
      next(new Error('Something exploded'));
    });

    const res = await request(app).get('/test');

    expect(res.status).toBe(500);
    assertStandardShape(res.body);
    expect(res.body.code).toBe(ErrorCodes.INTERNAL_ERROR);
  });

  it('hides the real message in production', async () => {
    process.env.NODE_ENV = 'production';

    const app = makeApp((_req, _res, next) => {
      next(new Error('Secret internal detail'));
    });

    const res = await request(app).get('/test');

    expect(res.status).toBe(500);
    expect(res.body.message).not.toContain('Secret internal detail');
    expect(res.body.message).toBe('An unexpected error occurred');
  });

  it('exposes the message in development', async () => {
    process.env.NODE_ENV = 'development';

    const app = makeApp((_req, _res, next) => {
      next(new Error('Dev detail'));
    });

    const res = await request(app).get('/test');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Dev detail');
  });

  it('handles non-Error thrown values', async () => {
    const app = makeApp((_req, _res, next) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      next('a plain string error' as any);
    });

    const res = await request(app).get('/test');

    expect(res.status).toBe(500);
    assertStandardShape(res.body);
  });
});

// ── Standard shape on success ─────────────────────────────────────────────────

describe('errorHandlerMiddleware — shape compliance', () => {
  it('every error response has code, message, and details fields', async () => {
    const errors: Error[] = [
      new Error('generic'),
      Object.assign(new Error('not found'), { status: 404 }),
      Object.assign(new Error('rate limited'), { status: 429 }),
    ];

    for (const err of errors) {
      const app = makeApp((_req, _res, next) => next(err));
      const res = await request(app).get('/test');

      expect(res.body).toHaveProperty('code');
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('details');
      expect(Array.isArray(res.body.details)).toBe(true);
    }
  });
});
