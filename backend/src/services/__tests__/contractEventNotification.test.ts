import { pool } from '../../config/database.js';
import { notificationService } from '../notificationService.js';
import { contractEventIndexer } from '../contractEventIndexerService.js';

jest.mock('../../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../notificationService', () => ({
  notificationService: { sendWorkflowNotification: jest.fn() },
}));

describe('contract event notification delivery', () => {
  const event = {
    id: 'event-1',
    contractId: 'contract-1',
    contractType: 'payment',
    eventType: 'payment_confirmed',
    payload: {},
    ledgerSequence: 42,
    txHash: 'tx-1',
    timestamp: new Date('2026-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CONTRACT_EVENT_NOTIFICATION_RECIPIENTS = JSON.stringify({
      payment_confirmed: [{ organizationId: 7, employeeId: 11 }],
    });
  });

  afterEach(() => {
    delete process.env.CONTRACT_EVENT_NOTIFICATION_RECIPIENTS;
  });

  it('sends a configured event notification exactly once for an event id', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rowCount: 1 });
    (notificationService.sendWorkflowNotification as jest.Mock).mockResolvedValue({
      success: true,
      messageId: 'msg-1',
    });

    await (
      contractEventIndexer as unknown as {
        handleEventNotification: (value: typeof event) => Promise<void>;
      }
    ).handleEventNotification(event);

    expect(notificationService.sendWorkflowNotification).toHaveBeenCalledTimes(1);
    expect(notificationService.sendWorkflowNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 7,
        employeeId: 11,
        eventKey: 'event-1',
      })
    );

    (pool.query as jest.Mock).mockResolvedValueOnce({ rowCount: 0 });
    await (
      contractEventIndexer as unknown as {
        handleEventNotification: (value: typeof event) => Promise<void>;
      }
    ).handleEventNotification(event);

    expect(notificationService.sendWorkflowNotification).toHaveBeenCalledTimes(1);
  });
});
