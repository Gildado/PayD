import { NextFunction, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { validate } from '../validate.js';
import { createNext, createReq, createRes } from './mockExpress';

describe('validate', () => {
  let next: jest.Mock & NextFunction;
  let res: ReturnType<typeof createRes>;
  const schema = z.object({ name: z.string().min(1), age: z.number().int() });

  beforeEach(() => {
    next = createNext() as jest.Mock & NextFunction;
    res = createRes();
  });

  it('replaces the request part with parsed data and calls next on success', () => {
    const req = createReq({ body: { name: 'Alice', age: 30, extra: 'stripped' } });

    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: 'Alice', age: 30 });
  });

  it('passes a ZodError to next when validation fails', () => {
    const req = createReq({ body: { name: '', age: 'not-a-number' } });

    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(ZodError);
  });

  it('can validate the query part of the request', () => {
    const querySchema = z.object({ page: z.coerce.number().int() });
    const req = createReq({ query: { page: '2' } });

    validate(querySchema, 'query')(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.query).toEqual({ page: 2 });
  });
});
