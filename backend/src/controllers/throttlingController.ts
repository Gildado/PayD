import { Request, Response } from 'express';
import { ThrottlingService, ThrottlingConfig } from '../services/throttlingService';

export class ThrottlingController {
  static getStatus(req: Request, res: Response): void {
    const throttlingService = ThrottlingService.getInstance();
    const status = throttlingService.getStatus();

    res.json({
      success: true,
      data: status,
    });
  }

  static getConfig(req: Request, res: Response): void {
    const throttlingService = ThrottlingService.getInstance();
    const config = throttlingService.getConfig();

    res.json({
      success: true,
      data: config,
    });
  }

  static updateConfig(req: Request, res: Response): any {
    const throttlingService = ThrottlingService.getInstance();
    const { tpm, maxQueueSize, refillIntervalMs } = req.body;

    const updates: Partial<ThrottlingConfig> = {};

    if (typeof tpm === 'number' && tpm > 0) {
      updates.tpm = tpm;
    }

    if (typeof maxQueueSize === 'number' && maxQueueSize > 0) {
      updates.maxQueueSize = maxQueueSize;
    }

    if (typeof refillIntervalMs === 'number' && refillIntervalMs > 0) {
      updates.refillIntervalMs = refillIntervalMs;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid configuration parameters provided',
      });
    }

    throttlingService.updateConfig(updates);

    res.json({
      success: true,
      message: 'Throttling configuration updated',
      data: throttlingService.getConfig(),
    });
  }

  static clearQueue(req: Request, res: Response): void {
    const throttlingService = ThrottlingService.getInstance();
    const clearedCount = throttlingService.clearQueue();

    res.json({
      success: true,
      message: `Cleared ${clearedCount} transactions from queue`,
      data: {
        clearedCount,
      },
    });
  }

  static getMetrics(req: Request, res: Response): void {
    const throttlingService = ThrottlingService.getInstance();
    const status = throttlingService.getStatus();

    const utilizationRate = status.maxTokens > 0
      ? ((status.maxTokens - status.currentTokens) / status.maxTokens) * 100
      : 0;

    const queueUtilizationRate = status.maxQueueSize > 0
      ? (status.queueSize / status.maxQueueSize) * 100
      : 0;

    const successRate = (status.processedCount + status.rejectedCount) > 0
      ? (status.processedCount / (status.processedCount + status.rejectedCount)) * 100
      : 100;

    res.json({
      success: true,
      data: {
        ...status,
        utilizationRate: utilizationRate.toFixed(2),
        queueUtilizationRate: queueUtilizationRate.toFixed(2),
        successRate: successRate.toFixed(2),
        timestamp: new Date().toISOString(),
      },
    });
  }
}
