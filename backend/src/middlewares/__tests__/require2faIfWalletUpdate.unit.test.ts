import { NextFunction, Request, Response } from 'express';
import { require2FA } from '../require2fa.js';
import { require2FAIfWalletUpdate } from '../require2faIfWalletUpdate.js';
import { createNext, createReq, createRes } from './mockExpress';

jest.mock('../require2fa', () => ({
  require2FA: jest.fn(),
}));

const mockRequire2FA = require2FA as jest.Mock;

describe('require2FAIfWalletUpdate', () => {
  let next: jest.Mock & NextFunction;
  let res: ReturnType<typeof createRes>;

  beforeEach(() => {
    jest.clearAllMocks();
    next = createNext() as jest.Mock & NextFunction;
    res = createRes();
  });

  it('delegates to require2FA when the body contains wallet_address', () => {
    const req = createReq({ body: { wallet_address: 'GABC' } });

    require2FAIfWalletUpdate(req, res, next);

    expect(mockRequire2FA).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('skips 2FA and calls next when no wallet update is present', () => {
    const req = createReq({ body: { name: 'Alice' } });

    require2FAIfWalletUpdate(req, res, next);

    expect(mockRequire2FA).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('skips 2FA when the body is missing entirely', () => {
    const req = createReq({ body: undefined });

    require2FAIfWalletUpdate(req, res, next);

    expect(mockRequire2FA).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
