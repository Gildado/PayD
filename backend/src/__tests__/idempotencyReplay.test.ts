/**
 * Idempotency Replay Regression Tests (Issue #1765)
 *
 * Verifies replay behavior for all payment-initiating routes:
 * 1. POST /api/v1/bulk-payments/batch (strictIdempotencyMiddleware - UUID v4 required)
 * 2. POST /api/payments/sep31/initiate (idempotencyMiddleware - standard tier)
 * 3. POST /api/payments/sep24/withdraw/interactive (idempotencyMiddleware - standard tier)
 * 4. POST /schedules/:id/trigger (idempotencyMiddleware - standard tier)
 */

import type { NextFunction, Request, Response } from 'express';
import {
  createIdempotencyMiddleware,
  idempotencyMiddleware,
  strictIdempotencyMiddleware,
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_REPLAYED_HEADER,
} from '../middlewares/idempotency.js';
import {
  createNext,
  createReq,
  createRes,
} from '../middlewares/__tests__/mockExpress.js';

describe('Idempotency Replay Regression Suite (#1765)', () => {
  const VALID_UUID = '123e4567-e89b-42d3-a456-426614174000';
  let mockStore: {
    getExistingResponse: jest.Mock;
    recordRequest: jest.Mock;
    recordResponse: jest.Mock;
  };

  beforeEach(() => {
    mockStore = {
      getExistingResponse: jest.fn().mockResolvedValue(null),
      recordRequest: jest.fn().mockResolvedValue({ id: 'rec-123' }),
      recordResponse: jest.fn().mockResolvedValue(undefined),
    };
  });

  describe('Route 1: POST /api/v1/bulk-payments/batch (Strict Tier)', () => {
    it('replays cached 200 response when key was previously completed', async () => {
      mockStore.getExistingResponse.mockResolvedValue({
        id: 'rec-123',
        key: VALID_UUID,
        response_status: 200,
        response_body: JSON.stringify({ success: true, batchId: 'batch-001' }),
      });

      const mw = createIdempotencyMiddleware({
        requireUuidV4: true,
        serviceProvider: () => mockStore as any,
      });

      const req = createReq({
        method: 'POST',
        url: '/api/v1/bulk-payments/batch',
        headers: { [IDEMPOTENCY_KEY_HEADER]: VALID_UUID },
      });
      const res = createRes();
      const next = createNext();

      await mw(req, res, next);

      expect(res._status).toHaveBeenCalledWith(200);
      expect(res.setHeader).toHaveBeenCalledWith(IDEMPOTENCY_REPLAYED_HEADER, 'true');
      expect(res._json).toHaveBeenCalledWith({ success: true, batchId: 'batch-001' });
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects batch request with 400 when Idempotency-Key is missing', async () => {
      const mw = createIdempotencyMiddleware({
        requireUuidV4: true,
        serviceProvider: () => mockStore as any,
      });

      const req = createReq({
        method: 'POST',
        url: '/api/v1/bulk-payments/batch',
        headers: {},
      });
      const res = createRes();
      const next = createNext();

      await mw(req, res, next);

      expect(res._status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 409 Conflict when request is in flight (response_status = 0)', async () => {
      mockStore.getExistingResponse.mockResolvedValue({
        id: 'rec-123',
        key: VALID_UUID,
        response_status: 0,
        response_body: '',
      });

      const mw = createIdempotencyMiddleware({
        requireUuidV4: true,
        serviceProvider: () => mockStore as any,
      });

      const req = createReq({
        method: 'POST',
        url: '/api/v1/bulk-payments/batch',
        headers: { [IDEMPOTENCY_KEY_HEADER]: VALID_UUID },
      });
      const res = createRes();
      const next = createNext();

      await mw(req, res, next);

      expect(res._status).toHaveBeenCalledWith(409);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Route 2: POST /api/payments/sep31/initiate (Standard Tier)', () => {
    it('replays cached response for remittance initiation', async () => {
      const key = 'sep31-transfer-key-abc';
      mockStore.getExistingResponse.mockResolvedValue({
        id: 'rec-sep31',
        key,
        response_status: 201,
        response_body: JSON.stringify({ id: 'tx-sep31-01', status: 'pending' }),
      });

      const mw = createIdempotencyMiddleware({
        requireUuidV4: false,
        serviceProvider: () => mockStore as any,
      });

      const req = createReq({
        method: 'POST',
        url: '/api/payments/sep31/initiate',
        headers: { [IDEMPOTENCY_KEY_HEADER]: key },
      });
      const res = createRes();
      const next = createNext();

      await mw(req, res, next);

      expect(res._status).toHaveBeenCalledWith(201);
      expect(res.setHeader).toHaveBeenCalledWith(IDEMPOTENCY_REPLAYED_HEADER, 'true');
      expect(res._json).toHaveBeenCalledWith({ id: 'tx-sep31-01', status: 'pending' });
      expect(next).not.toHaveBeenCalled();
    });

    it('passes through transparently when no key is provided', async () => {
      const mw = createIdempotencyMiddleware({
        requireUuidV4: false,
        serviceProvider: () => mockStore as any,
      });

      const req = createReq({
        method: 'POST',
        url: '/api/payments/sep31/initiate',
        headers: {},
      });
      const res = createRes();
      const next = createNext();

      await mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res._status).not.toHaveBeenCalled();
    });
  });

  describe('Route 3: POST /api/payments/sep24/withdraw/interactive (Standard Tier)', () => {
    it('replays interactive withdrawal URL response', async () => {
      const key = 'sep24-withdraw-key-def';
      mockStore.getExistingResponse.mockResolvedValue({
        id: 'rec-sep24',
        key,
        response_status: 200,
        response_body: JSON.stringify({ type: 'interactive_customer_info_needed', url: 'https://anchor.example/sep24' }),
      });

      const mw = createIdempotencyMiddleware({
        requireUuidV4: false,
        serviceProvider: () => mockStore as any,
      });

      const req = createReq({
        method: 'POST',
        url: '/api/payments/sep24/withdraw/interactive',
        headers: { [IDEMPOTENCY_KEY_HEADER]: key },
      });
      const res = createRes();
      const next = createNext();

      await mw(req, res, next);

      expect(res._status).toHaveBeenCalledWith(200);
      expect(res.setHeader).toHaveBeenCalledWith(IDEMPOTENCY_REPLAYED_HEADER, 'true');
      expect(res._json).toHaveBeenCalledWith({
        type: 'interactive_customer_info_needed',
        url: 'https://anchor.example/sep24',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Route 4: POST /schedules/:id/trigger (Standard Tier)', () => {
    it('replays schedule execution response', async () => {
      const key = 'schedule-trigger-key-ghi';
      mockStore.getExistingResponse.mockResolvedValue({
        id: 'rec-sched',
        key,
        response_status: 200,
        response_body: JSON.stringify({ message: 'Schedule executed successfully', executionId: 42 }),
      });

      const mw = createIdempotencyMiddleware({
        requireUuidV4: false,
        serviceProvider: () => mockStore as any,
      });

      const req = createReq({
        method: 'POST',
        url: '/schedules/123/trigger',
        headers: { [IDEMPOTENCY_KEY_HEADER]: key },
      });
      const res = createRes();
      const next = createNext();

      await mw(req, res, next);

      expect(res._status).toHaveBeenCalledWith(200);
      expect(res.setHeader).toHaveBeenCalledWith(IDEMPOTENCY_REPLAYED_HEADER, 'true');
      expect(res._json).toHaveBeenCalledWith({
        message: 'Schedule executed successfully',
        executionId: 42,
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
