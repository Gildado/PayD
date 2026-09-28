import { StellarThrottlingService } from '../stellarThrottlingService';
import { StellarService } from '../stellarService';
import { ThrottlingService } from '../throttlingService';
import { Transaction } from '@stellar/stellar-sdk';

jest.mock('../stellarService');
jest.mock('../throttlingService');

describe('StellarThrottlingService', () => {
  let service: StellarThrottlingService;
  let mockThrottlingService: jest.Mocked<ThrottlingService>;

  beforeEach(() => {
    jest.clearAllMocks();
    StellarThrottlingService.resetInstance();
    ThrottlingService.resetInstance();

    mockThrottlingService = {
      submit: jest.fn(),
      getStatus: jest.fn(),
      getConfig: jest.fn(),
      updateConfig: jest.fn(),
      clearQueue: jest.fn(),
      hasCapacity: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
    } as any;

    (ThrottlingService.getInstance as jest.Mock).mockReturnValue(mockThrottlingService);

    service = StellarThrottlingService.getInstance();
  });

  afterEach(() => {
    StellarThrottlingService.resetInstance();
  });

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = StellarThrottlingService.getInstance();
      const instance2 = StellarThrottlingService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('submitTransaction', () => {
    it('should submit transaction successfully', async () => {
      const mockTransaction = {} as Transaction;
      const mockResult = {
        hash: 'abc123',
        ledger: 12345,
        success: true,
      };

      mockThrottlingService.submit.mockImplementation(async (id, execute) => {
        return execute();
      });

      (StellarService.submitTransaction as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.submitTransaction(mockTransaction);

      expect(result).toEqual(mockResult);
      expect(mockThrottlingService.submit).toHaveBeenCalled();
      expect(StellarService.submitTransaction).toHaveBeenCalledWith(mockTransaction);
    });

    it('should handle transaction submission failure', async () => {
      const mockTransaction = {} as Transaction;
      const mockError = new Error('Transaction failed');

      mockThrottlingService.submit.mockImplementation(async (id, execute) => {
        return execute();
      });

      (StellarService.submitTransaction as jest.Mock).mockRejectedValue(mockError);

      await expect(service.submitTransaction(mockTransaction)).rejects.toThrow(
        'Transaction failed'
      );
    });

    it('should submit with priority flag', async () => {
      const mockTransaction = {} as Transaction;
      const mockResult = {
        hash: 'abc123',
        ledger: 12345,
        success: true,
      };

      mockThrottlingService.submit.mockImplementation(async (id, execute) => {
        return execute();
      });

      (StellarService.submitTransaction as jest.Mock).mockResolvedValue(mockResult);

      await service.submitTransaction(mockTransaction, { priority: true });

      expect(mockThrottlingService.submit).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        true
      );
    });

    it('should retry on failure when retryOnFailure is true', async () => {
      const mockTransaction = {} as Transaction;
      const mockResult = {
        hash: 'abc123',
        ledger: 12345,
        success: true,
      };

      let attemptCount = 0;
      mockThrottlingService.submit.mockImplementation(async (id, execute) => {
        return execute();
      });

      (StellarService.submitTransaction as jest.Mock).mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Temporary failure');
        }
        return mockResult;
      });

      const result = await service.submitTransaction(mockTransaction, {
        retryOnFailure: true,
        maxRetries: 3,
        retryDelayMs: 10,
      });

      expect(result).toEqual(mockResult);
      expect(attemptCount).toBe(2);
    });

    it('should fail after max retries', async () => {
      const mockTransaction = {} as Transaction;

      mockThrottlingService.submit.mockImplementation(async (id, execute) => {
        return execute();
      });

      (StellarService.submitTransaction as jest.Mock).mockRejectedValue(
        new Error('Persistent failure')
      );

      await expect(
        service.submitTransaction(mockTransaction, {
          retryOnFailure: true,
          maxRetries: 2,
          retryDelayMs: 10,
        })
      ).rejects.toThrow('Persistent failure');
    });

    it('should update metrics on successful submission', async () => {
      const mockTransaction = {} as Transaction;
      const mockResult = {
        hash: 'abc123',
        ledger: 12345,
        success: true,
      };

      mockThrottlingService.submit.mockImplementation(async (id, execute) => {
        return execute();
      });

      mockThrottlingService.getStatus.mockReturnValue({
        tpm: 100,
        currentTokens: 50,
        maxTokens: 100,
        queueSize: 0,
        maxQueueSize: 1000,
        processedCount: 1,
        rejectedCount: 0,
        isProcessing: false,
      });

      (StellarService.submitTransaction as jest.Mock).mockResolvedValue(mockResult);

      await service.submitTransaction(mockTransaction);

      const metrics = service.getMetrics();
      expect(metrics.totalSubmitted).toBe(1);
      expect(metrics.totalSuccessful).toBe(1);
      expect(metrics.totalFailed).toBe(0);
    });

    it('should update metrics on failed submission', async () => {
      const mockTransaction = {} as Transaction;

      mockThrottlingService.submit.mockImplementation(async (id, execute) => {
        return execute();
      });

      mockThrottlingService.getStatus.mockReturnValue({
        tpm: 100,
        currentTokens: 50,
        maxTokens: 100,
        queueSize: 0,
        maxQueueSize: 1000,
        processedCount: 0,
        rejectedCount: 0,
        isProcessing: false,
      });

      (StellarService.submitTransaction as jest.Mock).mockRejectedValue(new Error('Failed'));

      await expect(service.submitTransaction(mockTransaction)).rejects.toThrow();

      const metrics = service.getMetrics();
      expect(metrics.totalSubmitted).toBe(1);
      expect(metrics.totalSuccessful).toBe(0);
      expect(metrics.totalFailed).toBe(1);
    });
  });

  describe('getMetrics', () => {
    it('should return current metrics', () => {
      mockThrottlingService.getStatus.mockReturnValue({
        tpm: 100,
        currentTokens: 50,
        maxTokens: 100,
        queueSize: 5,
        maxQueueSize: 1000,
        processedCount: 10,
        rejectedCount: 0,
        isProcessing: false,
      });

      const metrics = service.getMetrics();

      expect(metrics).toHaveProperty('totalSubmitted');
      expect(metrics).toHaveProperty('totalSuccessful');
      expect(metrics).toHaveProperty('totalFailed');
      expect(metrics).toHaveProperty('totalThrottled');
      expect(metrics).toHaveProperty('averageWaitTime');
      expect(metrics).toHaveProperty('currentQueueDepth');
      expect(metrics.currentQueueDepth).toBe(5);
    });
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

      mockThrottlingService.getStatus.mockReturnValue(mockStatus);

      const status = service.getStatus();

      expect(status).toEqual(mockStatus);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const newConfig = { tpm: 200 };

      service.updateConfig(newConfig);

      expect(mockThrottlingService.updateConfig).toHaveBeenCalledWith(newConfig);
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const mockConfig = {
        tpm: 100,
        maxQueueSize: 1000,
        refillIntervalMs: 1000,
      };

      mockThrottlingService.getConfig.mockReturnValue(mockConfig);

      const config = service.getConfig();

      expect(config).toEqual(mockConfig);
    });
  });

  describe('clearQueue', () => {
    it('should clear the queue', () => {
      mockThrottlingService.clearQueue.mockReturnValue(5);

      const cleared = service.clearQueue();

      expect(cleared).toBe(5);
      expect(mockThrottlingService.clearQueue).toHaveBeenCalled();
    });
  });

  describe('hasCapacity', () => {
    it('should return true when has capacity', () => {
      mockThrottlingService.hasCapacity.mockReturnValue(true);

      const hasCapacity = service.hasCapacity();

      expect(hasCapacity).toBe(true);
    });

    it('should return false when no capacity', () => {
      mockThrottlingService.hasCapacity.mockReturnValue(false);

      const hasCapacity = service.hasCapacity();

      expect(hasCapacity).toBe(false);
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics', async () => {
      const mockTransaction = {} as Transaction;
      const mockResult = {
        hash: 'abc123',
        ledger: 12345,
        success: true,
      };

      mockThrottlingService.submit.mockImplementation(async (id, execute) => {
        return execute();
      });

      mockThrottlingService.getStatus.mockReturnValue({
        tpm: 100,
        currentTokens: 50,
        maxTokens: 100,
        queueSize: 0,
        maxQueueSize: 1000,
        processedCount: 1,
        rejectedCount: 0,
        isProcessing: false,
      });

      (StellarService.submitTransaction as jest.Mock).mockResolvedValue(mockResult);

      await service.submitTransaction(mockTransaction);

      let metrics = service.getMetrics();
      expect(metrics.totalSubmitted).toBe(1);

      service.resetMetrics();

      metrics = service.getMetrics();
      expect(metrics.totalSubmitted).toBe(0);
      expect(metrics.totalSuccessful).toBe(0);
      expect(metrics.totalFailed).toBe(0);
    });
  });

  describe('events', () => {
    it('should emit stellar:transaction:success event', async () => {
      const mockTransaction = {} as Transaction;
      const mockResult = {
        hash: 'abc123',
        ledger: 12345,
        success: true,
      };

      mockThrottlingService.submit.mockImplementation(async (id, execute) => {
        return execute();
      });

      (StellarService.submitTransaction as jest.Mock).mockResolvedValue(mockResult);

      const eventHandler = jest.fn();
      service.on('stellar:transaction:success', eventHandler);

      await service.submitTransaction(mockTransaction);

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          hash: 'abc123',
        })
      );
    });

    it('should emit stellar:transaction:error event on failure', async () => {
      const mockTransaction = {} as Transaction;

      mockThrottlingService.submit.mockImplementation(async (id, execute) => {
        return execute();
      });

      (StellarService.submitTransaction as jest.Mock).mockRejectedValue(new Error('Failed'));

      const eventHandler = jest.fn();
      service.on('stellar:transaction:error', eventHandler);

      await expect(service.submitTransaction(mockTransaction)).rejects.toThrow();

      expect(eventHandler).toHaveBeenCalled();
    });
  });
});
