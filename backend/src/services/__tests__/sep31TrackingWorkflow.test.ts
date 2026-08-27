import { describe, it, expect, jest } from '@jest/globals';
import { Sep31TrackingService, Sep31Transaction } from '../sep31TrackingService.js';
import { Sep31TrackingWorkflow } from '../sep31TrackingWorkflow.js';
import type { Pool } from 'pg';

describe('Sep31TrackingWorkflow', () => {
  it('completes successfully on the happy-path fixture', async () => {
    const mockPool = {
      query: jest.fn().mockResolvedValue({
        rows: [{
          id: 'tx-100',
          organizationId: 1,
          senderId: 'SENDER_1',
          receiverId: 'RECEIVER_1',
          amount: '1000.00',
          assetCode: 'USDC',
          status: 'COMPLETED',
          stellarTxHash: 'HASH123',
          updatedAt: new Date(),
        }],
      }),
    } as unknown as Pool;

    const trackingService = new Sep31TrackingService(mockPool);
    const notificationCallback = jest.fn().mockResolvedValue(undefined);
    const logger = { info: jest.fn(), error: jest.fn() };

    const workflow = new Sep31TrackingWorkflow(trackingService, {
      notificationCallback,
      logger,
      initialDelayMs: 1,
    });

    const result = await workflow.executeWorkflow('tx-100', 'COMPLETED', 'HASH123');

    expect(result.status).toBe('COMPLETED');
    expect(result.stellarTxHash).toBe('HASH123');
    expect(notificationCallback).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalled();
  });

  it('retries and handles designed failure case with exponential backoff', async () => {
    let attempts = 0;
    const mockPool = {
      query: jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Database lock timeout'));
        }
        return Promise.resolve({
          rows: [{
            id: 'tx-200',
            organizationId: 1,
            senderId: 'SENDER_1',
            receiverId: 'RECEIVER_1',
            amount: '500.00',
            assetCode: 'USDC',
            status: 'PROCESSING',
            updatedAt: new Date(),
          }],
        });
      }),
    } as unknown as Pool;

    const trackingService = new Sep31TrackingService(mockPool);
    const logger = { info: jest.fn(), error: jest.fn() };

    const workflow = new Sep31TrackingWorkflow(trackingService, {
      maxRetries: 3,
      initialDelayMs: 1,
      logger,
    });

    const result = await workflow.executeWorkflow('tx-200', 'PROCESSING');

    expect(result.status).toBe('PROCESSING');
    expect(attempts).toBe(3);
    expect(logger.error).toHaveBeenCalledTimes(2);
  });
});
