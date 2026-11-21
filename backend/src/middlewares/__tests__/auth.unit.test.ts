import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateJWT } from '../auth.js';
import { createNext, createReq, createRes } from './mockExpress';

jest.mock('../../config/env', () => ({
  config: { JWT_SECRET: 'test-secret', DATABASE_URL: 'postgres://test' },
}));
jest.mock('jsonwebtoken', () => ({
  __esModule: true,
  default: { verify: jest.fn() },
}));

const mockVerify = jwt.verify as jest.Mock;

describe('authenticateJWT', () => {
  let next: jest.Mock & NextFunction;
  let res: ReturnType<typeof createRes>;

  beforeEach(() => {
    jest.clearAllMocks();
    next = createNext() as jest.Mock & NextFunction;
    res = createRes();
  });

  it('authenticates a valid bearer token and attaches the user', () => {
    const payload = {
      id: 1,
      organizationId: 7,
      role: 'EMPLOYER',
      walletAddress: 'GABC',
    };
    mockVerify.mockReturnValue(payload);
    const req = createReq({ headers: { authorization: 'Bearer goodtoken' } });

    authenticateJWT(req, res, next);

    expect(mockVerify).toHaveBeenCalledWith('goodtoken', 'test-secret');
    expect((req as Request & { user?: unknown }).user).toEqual(payload);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).not.toHaveBeenCalled();
  });

  it('rejects a missing bearer token with 401', () => {
    const req = createReq({ headers: {} });

    authenticateJWT(req, res, next);

    expect(res._status).toHaveBeenCalledWith(401);
    expect(res._json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'UNAUTHORIZED' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a malformed / invalid token with 403', () => {
    mockVerify.mockImplementation(() => {
      throw new Error('bad signature');
    });
    const req = createReq({ headers: { authorization: 'Bearer badtoken' } });

    authenticateJWT(req, res, next);

    expect(mockVerify).toHaveBeenCalled();
    expect(res._status).toHaveBeenCalledWith(403);
    expect(res._json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'FORBIDDEN' })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
