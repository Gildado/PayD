import axios from 'axios';
import { pool } from '../../config/database.js';
import { WEBHOOK_EVENTS, WebhookService } from '../webhook.service.js';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}));

jest.mock('../../config/database.js', () => ({
  __esModule: true,
  pool: {
    query: jest.fn(),
  },
}));

describe('WebhookService', () => {
  const mockedAxiosPost = axios.post as jest.Mock;
  const mockedQuery = pool.query as jest.Mock;
  const subscription = {
    id: 'sub_123',
    organization_id: 77,
    url: 'https://example.com/webhooks/payd',
    secret: 'super-secret-webhook-key',
    events: ['*'],
    is_active: true,
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockedAxiosPost.mockReset();
    mockedQuery.mockReset();
    mockedQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM webhook_subscriptions')) {
        return { rows: [subscription] };
      }

      return { rows: [], rowCount: 1 };
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('retries failed deliveries with exponential backoff until one succeeds', async () => {
    const timeoutSpy = jest.spyOn(global, 'setTimeout');
    mockedAxiosPost
      .mockRejectedValueOnce(new Error('temporary outage'))
      .mockRejectedValueOnce(new Error('receiver still unavailable'))
      .mockResolvedValueOnce({ status: 200, data: { delivered: true } });

    const dispatchPromise = WebhookService.dispatch(WEBHOOK_EVENTS.PAYMENT_COMPLETED, 77, {
      paymentId: 'pay_123',
    });

    await jest.runAllTimersAsync();
    await dispatchPromise;

    expect(mockedAxiosPost).toHaveBeenCalledTimes(3);
    expect(timeoutSpy.mock.calls.map(([, delay]) => delay)).toEqual([1000, 2000]);
    expect(mockedQuery).toHaveBeenCalledTimes(4);
    expect(mockedQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO webhook_delivery_logs'),
      expect.arrayContaining(['sub_123', WEBHOOK_EVENTS.PAYMENT_COMPLETED, expect.any(String), 1])
    );
    expect(mockedQuery).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO webhook_delivery_logs'),
      expect.arrayContaining(['sub_123', WEBHOOK_EVENTS.PAYMENT_COMPLETED, expect.any(String), 2])
    );
    expect(mockedQuery).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('INSERT INTO webhook_delivery_logs'),
      expect.arrayContaining(['sub_123', WEBHOOK_EVENTS.PAYMENT_COMPLETED, expect.any(String), 3])
    );
  });

  it('stops after the maximum number of attempts and logs each failed delivery', async () => {
    const timeoutSpy = jest.spyOn(global, 'setTimeout');
    mockedAxiosPost.mockRejectedValue(new Error('endpoint offline'));

    const dispatchPromise = WebhookService.dispatch(WEBHOOK_EVENTS.PAYMENT_FAILED, 77, {
      paymentId: 'pay_456',
    });

    await jest.runAllTimersAsync();
    await dispatchPromise;

    expect(mockedAxiosPost).toHaveBeenCalledTimes(4);
    expect(timeoutSpy.mock.calls.map(([, delay]) => delay)).toEqual([1000, 2000, 4000]);
    expect(mockedQuery).toHaveBeenCalledTimes(5);
    expect(mockedQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('INSERT INTO webhook_delivery_logs'),
      expect.arrayContaining(['sub_123', WEBHOOK_EVENTS.PAYMENT_FAILED, expect.any(String), null, null, 'endpoint offline', 4])
    );
  });
});
