import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { DeliveryChannel, ReportFormat, type DeliveryConfig, type ReportResult } from '../reportSchema.js';

const sendMail = jest.fn();
const fetchMock = jest.fn();

jest.unstable_mockModule('nodemailer', () => ({
  default: {
    createTransport: () => ({ sendMail }),
  },
}));

jest.unstable_mockModule('node-fetch', () => ({
  default: fetchMock,
}));

const { EmailDeliveryChannel } = await import('../deliveryChannels/emailDeliveryChannel.js');
const { WebhookDeliveryChannel } = await import('../deliveryChannels/webhookDeliveryChannel.js');

function reportResult(): ReportResult {
  return {
    executionId: crypto.randomUUID(),
    format: ReportFormat.JSON,
    data: [],
    summary: {
      totalRecords: 1,
      processedRecords: 1,
      failedRecords: 0,
      generatedAt: new Date('2024-03-15T00:00:00Z'),
      generatedBy: 1,
    },
    metadata: {
      version: '1.0',
      schema: 'test',
      checksum: 'abc',
    },
  };
}

describe('delivery channel retries', () => {
  beforeEach(() => {
    sendMail.mockReset();
    fetchMock.mockReset();
  });

  it('retries transient email send failures before succeeding', async () => {
    sendMail
      .mockRejectedValueOnce(new Error('451 temporary local problem'))
      .mockResolvedValueOnce({ messageId: 'ok' });

    const config: DeliveryConfig = {
      id: crypto.randomUUID(),
      reportId: crypto.randomUUID(),
      channel: DeliveryChannel.EMAIL,
      enabled: true,
      config: {
        recipients: ['ops@payd.app'],
        subject: 'Restore drill',
      },
      retryPolicy: {
        maxRetries: 2,
        backoffMs: 1,
        backoffMultiplier: 1,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await new EmailDeliveryChannel().deliver(reportResult(), config);

    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it('retries webhook 5xx responses before succeeding', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'temporarily unavailable',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        text: async () => '',
      });

    const config: DeliveryConfig = {
      id: crypto.randomUUID(),
      reportId: crypto.randomUUID(),
      channel: DeliveryChannel.WEBHOOK,
      enabled: true,
      config: {
        url: 'https://hooks.example.test/payd',
      },
      retryPolicy: {
        maxRetries: 2,
        backoffMs: 1,
        backoffMultiplier: 1,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await new WebhookDeliveryChannel().deliver(reportResult(), config);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
