import { Request, Response } from 'express';
import { StellarThrottlingController } from '../stellarThrottlingController';
import { StellarThrottlingService } from '../../services/stellarThrottlingService';

jest.mock('../../services/stellarThrottlingService');

describe('StellarThrottlingController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockService: jest.Mocked<StellarThrottlingService>;

  beforeEach(() => {
    mockRequest = {
      body: {},
      query: {},
    };

    mockResponse = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };

    mockService = {
      getStatus: jest.fn(),
      getMetrics: jest.fn(),
      getConfig: jest.fn(),
      updateConfig: jest.fn(),
      clearQueue: jest.fn(),
      resetMetrics: jest.fn(),
      hasCapacity: jest.fn(),
    } as any;

    (StellarThrottlingService.getInstance as jest.Mock).mockReturnValue(mockService);
  });

  describe('getStatus', () => {
    it('should return throttling status', () => {
      const mockStatus = {
        tpm: 100,
        currentTokens: 50,
        maxTokens: 100,
        queueSize: 5,
        maxQueueSize: 1000,
        processedCount: 10,
        rejectedCount: 0,
        isProcessing: false,
      };

      mockService.getStatus.mockReturnValue(mockStatus);

      StellarThrottlingController.getStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          tpm: 100,
          currentTokens: 50,
          utilizationRate: 50,
          queueUtilization: 0.5,
        }),
      });
    });

    it('should handle errors', () => {
      mockService.getStatus.mockImplementation(() => {
        throw new Error('Service error');
      });

      StellarThrottlingController.getStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get throttling status',
      });
    });
  });

  describe('getMetrics', () => {
    it('should return throttling metrics', () => {
      const mockMetrics = {
        totalSubmitted: 100,
        totalSuccessful: 95,
        totalFailed: 5,
        totalThrottled: 20,
        averageWaitTime: 150,
        currentQueueDepth: 5,
        lastSubmissionTime: new Date(),
      };

      const mockStatus = {
        tpm: 100,
        currentTokens: 50,
        maxTokens: 100,
        queueSize: 5,
        maxQueueSize: 1000,
        processedCount: 10,
        rejectedCount: 0,
        isProcessing: false,
      };

      mockService.getMetrics.mockReturnValue(mockMetrics);
      mockService.getStatus.mockReturnValue(mockStatus);

      StellarThrottlingController.getMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          totalSubmitted: 100,
          totalSuccessful: 95,
          successRate: '95.00%',
          throttleRate: '20.00%',
        }),
      });
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const mockConfig = {
        tpm: 100,
        maxQueueSize: 1000,
        refillIntervalMs: 1000,
      };

      mockService.getConfig.mockReturnValue(mockConfig);

      StellarThrottlingController.getConfig(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockConfig,
      });
    });
  });

  describe('updateConfig', () => {
    it('should update configuration with valid values', () => {
      mockRequest.body = {
        tpm: 200,
        maxQueueSize: 2000,
      };

      const updatedConfig = {
        tpm: 200,
        maxQueueSize: 2000,
        refillIntervalMs: 1000,
      };

      mockService.getConfig.mockReturnValue(updatedConfig);

      StellarThrottlingController.updateConfig(mockRequest as Request, mockResponse as Response);

      expect(mockService.updateConfig).toHaveBeenCalledWith({
        tpm: 200,
        maxQueueSize: 2000,
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Throttling configuration updated successfully',
        data: updatedConfig,
      });
    });

    it('should reject invalid TPM value', () => {
      mockRequest.body = {
        tpm: -10,
      };

      StellarThrottlingController.updateConfig(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid TPM value. Must be between 1 and 10000',
      });
    });

    it('should reject invalid maxQueueSize value', () => {
      mockRequest.body = {
        maxQueueSize: 200000,
      };

      StellarThrottlingController.updateConfig(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid maxQueueSize value. Must be between 1 and 100000',
      });
    });

    it('should reject invalid refillIntervalMs value', () => {
      mockRequest.body = {
        refillIntervalMs: 50,
      };

      StellarThrottlingController.updateConfig(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid refillIntervalMs value. Must be between 100 and 60000',
      });
    });

    it('should reject when no valid updates provided', () => {
      mockRequest.body = {};

      StellarThrottlingController.updateConfig(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'No valid configuration updates provided',
      });
    });
  });

  describe('clearQueue', () => {
    it('should clear the queue', () => {
      mockService.clearQueue.mockReturnValue(10);

      StellarThrottlingController.clearQueue(mockRequest as Request, mockResponse as Response);

      expect(mockService.clearQueue).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Cleared 10 transactions from queue',
        data: {
          clearedCount: 10,
        },
      });
    });
  });

  describe('resetMetrics', () => {
    it('should reset metrics', () => {
      StellarThrottlingController.resetMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockService.resetMetrics).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Metrics reset successfully',
      });
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when has capacity', () => {
      const mockStatus = {
        tpm: 100,
        currentTokens: 50,
        maxTokens: 100,
        queueSize: 5,
        maxQueueSize: 1000,
        processedCount: 10,
        rejectedCount: 0,
        isProcessing: false,
      };

      mockService.getStatus.mockReturnValue(mockStatus);
      mockService.hasCapacity.mockReturnValue(true);

      StellarThrottlingController.healthCheck(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          status: 'healthy',
          hasCapacity: true,
        }),
      });
    });

    it('should return degraded status when no capacity', () => {
      const mockStatus = {
        tpm: 100,
        currentTokens: 0,
        maxTokens: 100,
        queueSize: 1000,
        maxQueueSize: 1000,
        processedCount: 10,
        rejectedCount: 0,
        isProcessing: false,
      };

      mockService.getStatus.mockReturnValue(mockStatus);
      mockService.hasCapacity.mockReturnValue(false);

      StellarThrottlingController.healthCheck(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          status: 'degraded',
          hasCapacity: false,
        }),
      });
    });
  });
});
