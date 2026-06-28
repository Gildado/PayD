import { Request, Response } from 'express';
import { StellarThrottlingService } from '../services/stellarThrottlingService.js';
import logger from '../utils/logger.js';

/**
 * Controller for managing Stellar transaction throttling
 */
export class StellarThrottlingController {
  /**
   * Get current throttling status
   */
  static getStatus(req: Request, res: Response): void {
    try {
      const service = StellarThrottlingService.getInstance();
      const status = service.getStatus();

      res.json({
        success: true,
        data: {
          ...status,
          utilizationRate: ((status.maxTokens - status.currentTokens) / status.maxTokens) * 100,
          queueUtilization: (status.queueSize / status.maxQueueSize) * 100,
        },
      });
    } catch (error) {
      logger.error('Error getting throttling status', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get throttling status',
      });
    }
  }

  /**
   * Get throttling metrics
   */
  static getMetrics(req: Request, res: Response): void {
    try {
      const service = StellarThrottlingService.getInstance();
      const metrics = service.getMetrics();
      const status = service.getStatus();

      const successRate =
        metrics.totalSubmitted > 0
          ? ((metrics.totalSuccessful / metrics.totalSubmitted) * 100).toFixed(2)
          : '0.00';

      const throttleRate =
        metrics.totalSubmitted > 0
          ? ((metrics.totalThrottled / metrics.totalSubmitted) * 100).toFixed(2)
          : '0.00';

      res.json({
        success: true,
        data: {
          ...metrics,
          successRate: `${successRate}%`,
          throttleRate: `${throttleRate}%`,
          currentStatus: {
            tpm: status.tpm,
            currentTokens: status.currentTokens,
            queueSize: status.queueSize,
            isProcessing: status.isProcessing,
          },
        },
      });
    } catch (error) {
      logger.error('Error getting throttling metrics', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get throttling metrics',
      });
    }
  }

  /**
   * Get current configuration
   */
  static getConfig(req: Request, res: Response): void {
    try {
      const service = StellarThrottlingService.getInstance();
      const config = service.getConfig();

      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      logger.error('Error getting throttling config', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get throttling configuration',
      });
    }
  }

  /**
   * Update throttling configuration
   */
  static updateConfig(req: Request, res: Response): void {
    try {
      const service = StellarThrottlingService.getInstance();
      const { tpm, maxQueueSize, refillIntervalMs } = req.body;

      const updates: {
        tpm?: number;
        maxQueueSize?: number;
        refillIntervalMs?: number;
      } = {};

      if (typeof tpm === 'number' && tpm > 0 && tpm <= 10000) {
        updates.tpm = tpm;
      } else if (tpm !== undefined) {
        return res.status(400).json({
          success: false,
          error: 'Invalid TPM value. Must be between 1 and 10000',
        });
      }

      if (typeof maxQueueSize === 'number' && maxQueueSize > 0 && maxQueueSize <= 100000) {
        updates.maxQueueSize = maxQueueSize;
      } else if (maxQueueSize !== undefined) {
        return res.status(400).json({
          success: false,
          error: 'Invalid maxQueueSize value. Must be between 1 and 100000',
        });
      }

      if (
        typeof refillIntervalMs === 'number' &&
        refillIntervalMs >= 100 &&
        refillIntervalMs <= 60000
      ) {
        updates.refillIntervalMs = refillIntervalMs;
      } else if (refillIntervalMs !== undefined) {
        return res.status(400).json({
          success: false,
          error: 'Invalid refillIntervalMs value. Must be between 100 and 60000',
        });
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid configuration updates provided',
        });
      }

      service.updateConfig(updates);

      res.json({
        success: true,
        message: 'Throttling configuration updated successfully',
        data: service.getConfig(),
      });
    } catch (error) {
      logger.error('Error updating throttling config', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update throttling configuration',
      });
    }
  }

  /**
   * Clear the transaction queue
   */
  static clearQueue(req: Request, res: Response): void {
    try {
      const service = StellarThrottlingService.getInstance();
      const clearedCount = service.clearQueue();

      res.json({
        success: true,
        message: `Cleared ${clearedCount} transactions from queue`,
        data: {
          clearedCount,
        },
      });
    } catch (error) {
      logger.error('Error clearing queue', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to clear queue',
      });
    }
  }

  /**
   * Reset metrics
   */
  static resetMetrics(req: Request, res: Response): void {
    try {
      const service = StellarThrottlingService.getInstance();
      service.resetMetrics();

      res.json({
        success: true,
        message: 'Metrics reset successfully',
      });
    } catch (error) {
      logger.error('Error resetting metrics', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to reset metrics',
      });
    }
  }

  /**
   * Health check for throttling service
   */
  static healthCheck(req: Request, res: Response): void {
    try {
      const service = StellarThrottlingService.getInstance();
      const status = service.getStatus();
      const hasCapacity = service.hasCapacity();

      const health = {
        status: hasCapacity ? 'healthy' : 'degraded',
        hasCapacity,
        currentTokens: status.currentTokens,
        queueSize: status.queueSize,
        queueUtilization: (status.queueSize / status.maxQueueSize) * 100,
      };

      const httpStatus = hasCapacity ? 200 : 503;

      res.status(httpStatus).json({
        success: true,
        data: health,
      });
    } catch (error) {
      logger.error('Error checking throttling health', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to check throttling health',
      });
    }
  }
}

export default StellarThrottlingController;
