import { NextFunction, Request, Response } from 'express';
import { IdempotencyService } from '../../services/idempotencyService.js';
import {
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_REPLAYED_HEADER,
  idempotencyMiddleware,
} from '../idempotencyMiddleware.js';
import { createNext, createReq, createRes } from './mockExpress';

jest.mock('../../services/idempotencyService', () => ({
  IdempotencyService: {
    isValidKey: jest.fn(() => true),
    getResponse: jest.fn(),
    acquire: jest.fn(),
    storeResponse: jest.fn().mockResolvedValue(undefined),
    releaseLock: jest.fn(),
    markFailed: jest.fn(),
  },
}));
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const KEY = '123e4567-e89b-42d3-a456-426614174000';
const mockIsValid = IdempotencyService.isValidKey as jest.Mock;
const mockGet = IdempotencyService.getResponse as jest.Mock;
const mockAcquire = IdempotencyService.acquire as jest.Mock;
const mockStore = IdempotencyService.storeResponse as jest.Mock;
const mockRelease = IdempotencyService.releaseLock as jest.Mock;
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('idempotencyMiddleware', () => {
  let next: jest.Mock & NextFunction;
  let res: ReturnType<typeof createRes>;
  let req: Request;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsValid.mockReturnValue(true);
    mockGet.mockResolvedValue(null);
    mockAcquire.mockResolvedValue(true);
    mockStore.mockResolvedValue(undefined);
    next = createNext() as jest.Mock & NextFunction;
    res = createRes();
    req = createReq({
      ip: '10.0.0.1',
      headers: { [IDEMPOTENCY_KEY_HEADER.toLowerCase()]: KEY },
    });
  });

  it('returns 400 when the idempotency key is missing or invalid', async () => {
    mockIsValid.mockReturnValue(false);

    idempotencyMiddleware(req, res, next);
    await flush();

    expect(res._status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('replays a stored response with a replay header (success path)', async () => {
    mockGet.mockResolvedValue({
      statusCode: 201,
      body: '{"id":1}',
      contentType: 'application/json',
    });

    idempotencyMiddleware(req, res, next);
    await flush();

    expect(res.set).toHaveBeenCalledWith(IDEMPOTENCY_REPLAYED_HEADER, 'true');
    expect(res._status).toHaveBeenCalledWith(201);
    expect(res._send).toHaveBeenCalledWith('{"id":1}');
    expect(mockAcquire).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 409 when a concurrent request already holds the key', async () => {
    mockAcquire.mockResolvedValue(false);

    idempotencyMiddleware(req, res, next);
    await flush();

    expect(res._status).toHaveBeenCalledWith(409);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next and captures/stores the first response on a fresh key', async () => {
    idempotencyMiddleware(req, res, next);
    await flush();

    expect(mockAcquire).toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);

    res.send({ id: 1 });
    await flush();

    expect(mockStore).toHaveBeenCalledWith(
      '10.0.0.1',
      KEY,
      expect.objectContaining({ statusCode: 200, body: '{"id":1}' })
    );
    expect(mockRelease).toHaveBeenCalled();
  });
});
