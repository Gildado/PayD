import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import type { PassThrough } from 'stream';
import {
  DeliveryChannel,
  ReportFormat,
  type DeliveryConfig,
  type ReportResult,
} from '../reportSchema.js';

const sendMail = jest.fn();
const fetchMock = jest.fn();
let csvContent = Buffer.from('id,name\n1,Ada\n');

const generateCustomCsv = jest.fn(
  async (_columns: unknown, _rows: unknown, stream: PassThrough) => {
    const finished = new Promise<void>((resolve) => stream.once('finish', () => resolve()));
    stream.write(csvContent);
    stream.end();
    await finished;
  }
);

const generateCustomPdf = jest.fn(
  async (_title: string, _columns: unknown, _rows: unknown, stream: PassThrough) => {
    const finished = new Promise<void>((resolve) => stream.once('finish', () => resolve()));
    stream.write(Buffer.from('%PDF-1.4\n'));
    stream.end();
    await finished;
  }
);

jest.unstable_mockModule('../exportService.js', () => ({
  ExportService: { generateCustomCsv, generateCustomPdf },
}));

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
const { verifyExportDownloadToken } = await import('../../utils/exportDownloadToken.js');

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

function emailConfig(): DeliveryConfig {
  return {
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
}

describe('delivery channel retries', () => {
  beforeEach(() => {
    sendMail.mockReset();
    fetchMock.mockReset();
    generateCustomCsv.mockClear();
    generateCustomPdf.mockClear();
    csvContent = Buffer.from('id,name\n1,Ada\n');
  });

  it('retries transient email send failures before succeeding', async () => {
    sendMail
      .mockRejectedValueOnce(new Error('451 temporary local problem'))
      .mockResolvedValueOnce({ messageId: 'ok' });

    await new EmailDeliveryChannel().deliver(reportResult(), emailConfig());

    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it('attaches a generated CSV report', async () => {
    const result = {
      ...reportResult(),
      format: ReportFormat.CSV,
      data: [{ id: 1, name: 'Ada' }],
    };

    await new EmailDeliveryChannel().deliver(result, emailConfig());

    const options = sendMail.mock.calls[0][0];
    expect(generateCustomCsv).toHaveBeenCalledTimes(1);
    expect(options.attachments).toHaveLength(1);
    expect(options.attachments[0]).toMatchObject({
      filename: `report-${result.executionId}.csv`,
      contentType: 'text/csv',
    });
    expect(Buffer.from(options.attachments[0].content).toString()).toContain('id,name');
    expect(options.html).not.toContain('/reports/');
  });

  it('attaches a generated PDF report', async () => {
    const result = {
      ...reportResult(),
      format: ReportFormat.PDF,
      data: [{ id: 1, name: 'Ada' }],
    };

    await new EmailDeliveryChannel().deliver(result, emailConfig());

    const options = sendMail.mock.calls[0][0];
    expect(generateCustomPdf).toHaveBeenCalledTimes(1);
    expect(options.attachments).toHaveLength(1);
    expect(options.attachments[0]).toMatchObject({
      filename: `report-${result.executionId}.pdf`,
      contentType: 'application/pdf',
    });
    expect(Buffer.from(options.attachments[0].content).toString()).toContain('%PDF-');
  });

  it('falls back to a signed download link for oversized reports', async () => {
    csvContent = Buffer.alloc(10 * 1024 * 1024 + 1, 'x');
    const result = {
      ...reportResult(),
      format: ReportFormat.CSV,
      data: [{ id: 1, name: 'Ada' }],
    };
    const previousFrontendUrl = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = 'https://app.payd.test';

    try {
      await new EmailDeliveryChannel().deliver(result, emailConfig());

      const options = sendMail.mock.calls[0][0];
      expect(options.attachments).toEqual([]);
      expect(options.html).toContain('https://app.payd.test/reports/');

      const tokenMatch = options.html.match(/token=([^"'&]+)/);
      const token = tokenMatch?.[1];
      expect(token).toBeDefined();
      expect(verifyExportDownloadToken(decodeURIComponent(token ?? ''))).toMatchObject({
        kind: 'report',
        executionId: result.executionId,
        format: ReportFormat.CSV,
      });
    } finally {
      if (previousFrontendUrl === undefined) delete process.env.FRONTEND_URL;
      else process.env.FRONTEND_URL = previousFrontendUrl;
    }
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
