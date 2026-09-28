/**
 * Unit tests for OrgAuditService
 *
 * Uses a mock pg Pool so no real database connection is required.
 */

import { OrgAuditService } from '../services/orgAuditService.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePool(queryResult: { rows: unknown[]; rowCount?: number }) {
  return {
    query: jest.fn().mockResolvedValue(queryResult),
  } as unknown as import('pg').Pool;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrgAuditService', () => {
  describe('log()', () => {
    it('inserts a row with the correct parameters', async () => {
      const mockRow = { id: '1', organization_id: 42, change_type: 'setting_upserted' };
      const mockPool = makePool({ rows: [mockRow] });
      const service = new OrgAuditService(mockPool);

      const result = await service.log({
        organizationId: 42,
        changeType: 'setting_upserted',
        configKey: 'payment_settings',
        oldValue: { currency: 'USD' },
        newValue: { currency: 'EUR' },
        actorId: 7,
        actorEmail: 'admin@example.com',
        actorIp: '127.0.0.1',
      });

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [sql, params] = (mockPool.query as jest.Mock).mock.calls[0];
      expect(sql).toContain('INSERT INTO org_audit_log');
      expect(params[0]).toBe(42);                           // organizationId
      expect(params[1]).toBe('setting_upserted');           // changeType
      expect(params[2]).toBe('payment_settings');           // configKey
      expect(JSON.parse(params[3])).toEqual({ currency: 'USD' }); // oldValue
      expect(JSON.parse(params[4])).toEqual({ currency: 'EUR' }); // newValue
      expect(params[5]).toBe(7);                            // actorId
      expect(params[6]).toBe('admin@example.com');          // actorEmail
      expect(result).toEqual(mockRow);
    });

    it('returns null and does not throw when the insert fails', async () => {
      const mockPool = {
        query: jest.fn().mockRejectedValue(new Error('DB error')),
      } as unknown as import('pg').Pool;
      const service = new OrgAuditService(mockPool);

      const result = await service.log({ organizationId: 1, changeType: 'name_updated' });
      expect(result).toBeNull();
    });

    it('stores null config_key when not provided', async () => {
      const mockPool = makePool({ rows: [{ id: '2' }] });
      const service = new OrgAuditService(mockPool);

      await service.log({ organizationId: 1, changeType: 'name_updated', newValue: 'Acme' });

      const params = (mockPool.query as jest.Mock).mock.calls[0][1];
      expect(params[2]).toBeNull(); // configKey
    });
  });

  describe('list()', () => {
    it('returns rows and total count', async () => {
      const mockRows = [
        { id: '1', organization_id: 10, change_type: 'setting_upserted', created_at: '2025-01-01' },
      ];
      const mockPool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: mockRows })   // data query
          .mockResolvedValueOnce({ rows: [{ count: '1' }] }), // count query
      } as unknown as import('pg').Pool;
      const service = new OrgAuditService(mockPool);

      const { rows, total } = await service.list(10);
      expect(rows).toEqual(mockRows);
      expect(total).toBe(1);
    });

    it('caps limit at 200', async () => {
      const mockPool = {
        query: jest
          .fn()
          .mockResolvedValue({ rows: [] }),
      } as unknown as import('pg').Pool;
      const service = new OrgAuditService(mockPool);

      await service.list(1, { limit: 9999 });
      const params = (mockPool.query as jest.Mock).mock.calls[0][1];
      expect(params[1]).toBe(200);
    });
  });
});
