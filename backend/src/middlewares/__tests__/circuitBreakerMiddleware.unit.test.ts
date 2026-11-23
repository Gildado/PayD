import { NextFunction, Request, Response } from 'express';
import { circuitBreakerService } from '../../services/circuitBreakerService.js';
import { circuitBreakerGuard, withCircuitBreaker } from '../circuitBreakerMiddleware.js';
import { createNext, createReq, createRes } from './mockExpress';

jest.mock('../../services/circuitBreakerService', () => ({
  circuitBreakerService: {
    register: jest.fn(),
    get: jest.fn(),
    execute: jest.fn(),
  },
  CircuitOpenError: class CircuitOpenError extends Error {},
}));
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockGet = circuitBreakerService.get as jest.Mock;
const mockRegister = circuitBreakerService.register as jest.Mock;
const mockExecute = circuitBreakerService.execute as jest.Mock;

describe('circuitBreakerGuard', () => {
  let next: jest.Mock & NextFunction;
  let res: ReturnType<typeof createRes>;

  beforeEach(() => {
    jest.clearAllMocks();
    next = createNext() as jest.Mock & NextFunction;
    res = createRes();
  });

  it('registers the circuit and calls next when the circuit is CLOSED', async () => {
    mockGet.mockReturnValue({ state: 'CLOSED' });
    const middleware = circuitBreakerGuard('stellar-api');

    expect(mockRegister).toHaveBeenCalledWith('stellar-api', {});

    await middleware(createReq({}), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).not.toHaveBeenCalled();
  });

  it('returns 503 with Retry-After when the circuit is OPEN', async () => {
    mockGet.mockReturnValue({ state: 'OPEN', openedAt: new Date(Date.now()) });
    const middleware = circuitBreakerGuard('db', { recoveryMs: 30_000 });

    await middleware(createReq({ method: 'GET', path: '/payments' }), res, next);

    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
    expect(res._status).toHaveBeenCalledWith(503);
    expect(res._json).toHaveBeenCalledWith(
      expect.objectContaining({ circuit: 'db', retryAfterSeconds: expect.any(Number) })
    );
    expect(next).not.toHaveBeenCalled();
  });
});

describe('withCircuitBreaker', () => {
  beforeEach(() => jest.clearAllMocks());

  it('delegates execution to the circuit breaker service (success)', async () => {
    mockExecute.mockResolvedValue('ok');
    const fn = jest.fn(async () => 'ok');

    await expect(withCircuitBreaker('circuit', fn)).resolves.toBe('ok');
    expect(mockExecute).toHaveBeenCalledWith('circuit', fn);
  });

  it('propagates errors thrown by the circuit breaker service (failure)', async () => {
    mockExecute.mockRejectedValue(new Error('open'));

    await expect(withCircuitBreaker('circuit', async () => 'ok')).rejects.toThrow('open');
  });
});
