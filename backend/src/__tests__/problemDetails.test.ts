/**
 * RFC 7807 problem+json responses (issue #1809).
 */
import { describe, it, expect } from '@jest/globals';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { z } from 'zod';
import { errorHandlerMiddleware } from '../middlewares/errorHandlerMiddleware.js';
import { ErrorCodes } from '../utils/apiError.js';
import { HttpError } from '../utils/httpError.js';
import {
  buildProblem,
  PROBLEM_CONTENT_TYPE,
  PROBLEM_TYPES,
  sendProblem,
} from '../utils/problemDetails.js';

function makeApp(thrower: (req: Request, res: Response, next: NextFunction) => void) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.requestId = 'req-123';
    next();
  });
  app.get('/api/v1/thing', thrower);
  app.use(errorHandlerMiddleware);
  return app;
}

describe('buildProblem', () => {
  it('produces RFC 7807 members plus legacy extension members', () => {
    const body = buildProblem({
      code: ErrorCodes.NOT_FOUND,
      detail: 'Thing not found',
      instance: '/api/v1/thing/9',
    });

    expect(body).toEqual({
      type: 'urn:payd:error:not-found',
      title: 'Resource not found',
      status: 404,
      detail: 'Thing not found',
      instance: '/api/v1/thing/9',
      code: ErrorCodes.NOT_FOUND,
      message: 'Thing not found',
      details: [],
    });
  });

  it('exposes field errors as errors and the legacy details alias', () => {
    const errors = [{ path: 'email', message: 'Invalid', code: 'invalid_string' }];
    const body = buildProblem({ code: ErrorCodes.VALIDATION_ERROR, detail: 'bad', errors });

    expect(body.errors).toEqual(errors);
    expect(body.details).toEqual(errors);
    expect(body.status).toBe(400);
  });

  it('gives every registered code a distinct, stable type URI', () => {
    const types = Object.values(PROBLEM_TYPES).map((t) => t.type);
    expect(new Set(types).size).toBe(types.length);
    types.forEach((t) => expect(t).toMatch(/^urn:payd:error:[a-z-]+$/));
    expect(PROBLEM_TYPES[ErrorCodes.VALIDATION_ERROR].type).toBe('urn:payd:error:validation-error');
  });

  it('allows an explicit status to override the registry default', () => {
    expect(buildProblem({ code: ErrorCodes.BAD_REQUEST, status: 413, detail: 'x' }).status).toBe(
      413
    );
  });
});

describe('errorHandlerMiddleware as problem+json', () => {
  it('serves Zod validation failures as application/problem+json', async () => {
    const app = makeApp((_req, _res, next) => {
      try {
        z.object({ email: z.string().email() }).parse({ email: 'nope' });
      } catch (err) {
        next(err);
      }
    });

    const res = await request(app).get('/api/v1/thing?x=1');

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
    expect(res.body).toMatchObject({
      type: 'urn:payd:error:validation-error',
      title: 'Validation failed',
      status: 400,
      detail: 'Request validation failed',
      instance: '/api/v1/thing',
      code: ErrorCodes.VALIDATION_ERROR,
      requestId: 'req-123',
    });
    expect(res.body.errors[0]).toMatchObject({ path: 'email' });
  });

  it('serves HttpError with its own status and code', async () => {
    const app = makeApp((_req, _res, next) => {
      next(HttpError.notFound('Missing'));
    });

    const res = await request(app).get('/api/v1/thing');

    expect(res.status).toBe(404);
    expect(res.body.type).toBe('urn:payd:error:not-found');
    expect(res.body.detail).toBe('Missing');
  });

  it('hides internal error text in production', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const app = makeApp((_req, _res, next) => next(new Error('db password leaked')));
      const res = await request(app).get('/api/v1/thing');

      expect(res.status).toBe(500);
      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body.detail).toBe('An unexpected error occurred');
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});

describe('sendProblem', () => {
  it('writes the problem body with the request path as instance', async () => {
    const app = express();
    app.get('/api/v1/thing', (req, res) => {
      sendProblem(req, res, { code: ErrorCodes.FORBIDDEN, detail: 'nope' });
    });

    const res = await request(app).get('/api/v1/thing?q=1');

    expect(res.status).toBe(403);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.body).toMatchObject({
      instance: '/api/v1/thing',
      status: 403,
      title: 'Access forbidden',
    });
  });
});
