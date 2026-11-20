import fetch from 'node-fetch';
import logger from '../../utils/logger.js';
import { withRetry } from '../../utils/retry.js';
import { DeliveryConfig, ReportResult, DeliveryChannel } from '../reportSchema.js';
import { IReportDelivery } from '../reportSchema.js';

/**
 * Webhook Delivery Channel
 * Delivers reports via HTTP webhook with configurable URL and headers
 */
export class WebhookDeliveryChannel implements IReportDelivery {
  channel = DeliveryChannel.WEBHOOK;

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

      await withRetry(() => this.sendOnce(url, result, config), {
        maxRetries: retryPolicy.maxRetries,
        baseDelayMs: retryPolicy.backoffMs,
        backoffMultiplier: retryPolicy.backoffMultiplier,
        retryableErrors: ['HTTP 429', 'HTTP 500', 'HTTP 502', 'HTTP 503', 'HTTP 504'],
        onRetry: (attempt, error) => {
          logger.warn('Retrying webhook report delivery', {
            attempt,
            executionId: result.executionId,
            url,
            error: error.message,
          });
        },
      });

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
  private async sendOnce(
    url: string,
    result: ReportResult,
    config: DeliveryConfig
  ): Promise<void> {
    const headers = this.buildHeaders(config);
    const payload = this.buildPayload(result);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      timeout: 30000,
    });

    if (!response.ok) {
      const body = await response.text();
      const prefix = response.status === 429 || response.status >= 500
        ? `HTTP ${response.status}`
        : `Webhook delivery failed with status ${response.status}`;
      throw new Error(`${prefix}: ${body}`);
    }

    logger.info(`Webhook delivery successful (status: ${response.status})`);
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
      return {
        ...defaultHeaders,
        ...Object.fromEntries(
          Object.entries(config.config.headers).map(([key, value]) => [key, String(value)])
        ),
      };
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

}

export default WebhookDeliveryChannel;
