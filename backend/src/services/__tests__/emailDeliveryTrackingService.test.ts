import {
  EmailDeliveryTrackingService,
  EmailDeliveryStatus,
  BounceType,
} from '../emailDeliveryTrackingService.js';
import { pool } from '../../config/database.js';

jest.mock('../../config/database.js', () => ({
  pool: {
    query: jest.fn(),
  },
}));

describe('EmailDeliveryTrackingService', () => {
  let service: EmailDeliveryTrackingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = EmailDeliveryTrackingService.getInstance();
  });

  describe('trackEmailSent', () => {
    it('inserts a sent record into email_delivery_logs', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await service.trackEmailSent('msg123', 'user@example.com', 'sendgrid', { meta: 'val' });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO email_delivery_logs'),
        ['msg123', 'user@example.com', EmailDeliveryStatus.SENT, 'sendgrid', JSON.stringify({ meta: 'val' })]
      );
    });
  });

  describe('processDeliveryEvent', () => {
    it('updates status for delivered event', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await service.processDeliveryEvent({
        messageId: 'msg123',
        email: 'user@example.com',
        status: EmailDeliveryStatus.DELIVERED,
        provider: 'sendgrid',
        timestamp: new Date(),
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE email_delivery_logs'),
        expect.arrayContaining([EmailDeliveryStatus.DELIVERED, null, null, expect.any(String), 'msg123'])
      );
    });

    it('handles hard bounce by flagging email as invalid', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await service.processDeliveryEvent({
        messageId: 'msg123',
        email: 'user@example.com',
        status: EmailDeliveryStatus.BOUNCED,
        provider: 'resend',
        bounceType: BounceType.HARD,
        bounceReason: 'User unknown',
        timestamp: new Date(),
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO invalid_emails'),
        ['user@example.com', 'User unknown']
      );
    });
  });

  describe('getDeliveryStatusByMessageId', () => {
    it('returns delivery status for message ID', async () => {
      const mockRecord = { message_id: 'msg123', status: 'delivered', email: 'user@example.com' };
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockRecord] });

      const result = await service.getDeliveryStatusByMessageId('msg123');
      expect(result).toEqual(mockRecord);
    });
  });
});
