import fetch from 'node-fetch';
import logger from '../../utils/logger.js';
import { DeliveryConfig, ReportResult, DeliveryChannel } from '../reportSchema.js';
import { IReportDelivery } from '../reportSchema.js';

/**
 * Webhook Delivery Channel
 * Delivers reports via HTTP webhook with configurable URL and headers
 */
export class WebhookDeliveryChannel implements IReportDelivery {
  channel = DeliveryChannel.WEBHOOK;
  private maxRetries = 3;
  private retryDelayMs = 1000;

  /**
   * Delivers report via webhook
   */
  async deliver(result: ReportResult, config: DeliveryConfig): Promise<void> {
    try {
      const validation = await this.validateConfig(config);
      if (!validation) {
        throw new Error('Invalid webhook configuration');
      }

      const url = config.config.url;
      if (!url) {
        throw new Error('Webhook URL not configured');
      }

      const retryPolicy = config.retryPolicy || {
        maxRetries: 3,
        backoffMs: 1000,
        backoffMultiplier: 2,
      };

      await this.sendWithRetry(
        url,
        result,
        config,
        retryPolicy.maxRetries,
        retryPolicy.backoffMs,
        retryPolicy.backoffMultiplier
      );

      logger.info(
        `Report delivered via webhook to ${url} (execution: ${result.executionId})`
      );
    } catch (error) {
      logger.error('Error delivering report via webhook:', error);
      throw error;
    }
  }

  /**
   * Sends webhook with retry logic
   */
  private async sendWithRetry(
    url: string,
    result: ReportResult,
    config: DeliveryConfig,
    retriesLeft: number,
    delayMs: number,
    multiplier: number
  ): Promise<void> {
    try {
      const headers = this.buildHeaders(config);
      const payload = this.buildPayload(result);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        timeout: 30000,
      });

      if (!response.ok) {
        if (response.status >= 500 && retriesLeft > 0) {
          // Server error - retry
          await this.delay(delayMs);
          return this.sendWithRetry(
            url,
            result,
            config,
            retriesLeft - 1,
            delayMs * multiplier,
            multiplier
          );
        }

        throw new Error(
          `Webhook delivery failed with status ${response.status}: ${await response.text()}`
        );
      }

      logger.info(`Webhook delivery successful (status: ${response.status})`);
    } catch (error) {
      if (retriesLeft > 0 && this.isRetryableError(error)) {
        await this.delay(delayMs);
        return this.sendWithRetry(
          url,
          result,
          config,
          retriesLeft - 1,
          delayMs * multiplier,
          multiplier
        );
      }
      throw error;
    }
  }

  /**
   * Validates webhook configuration
   */
  async validateConfig(config: DeliveryConfig): Promise<boolean> {
    try {
      const url = config.config.url;
      if (!url) {
        logger.warn('Webhook URL not configured');
        return false;
      }

      try {
        new URL(url);
      } catch {
        logger.warn(`Invalid webhook URL: ${url}`);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error validating webhook config:', error);
      return false;
    }
  }

  /**
   * Builds HTTP headers for webhook
   */
  private buildHeaders(config: DeliveryConfig): Record<string, string> {
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'PayD-ReportAgent/1.0',
    };

    if (config.config.headers) {
      return { ...defaultHeaders, ...config.config.headers };
    }

    return defaultHeaders;
  }

  /**
   * Builds webhook payload
   */
  private buildPayload(result: ReportResult): Record<string, any> {
    return {
      event: 'report.generated',
      executionId: result.executionId,
      format: result.format,
      summary: result.summary,
      metadata: result.metadata,
      timestamp: new Date().toISOString(),
      recordCount: result.summary.totalRecords,
      processedCount: result.summary.processedRecords,
      failedCount: result.summary.failedRecords,
    };
  }

  /**
   * Checks if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('econnrefused') ||
        message.includes('econnreset') ||
        message.includes('etimedout') ||
        message.includes('timeout')
      );
    }
    return false;
  }

  /**
   * Delays execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default WebhookDeliveryChannel;
