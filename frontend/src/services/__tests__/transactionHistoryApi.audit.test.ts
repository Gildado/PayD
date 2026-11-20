/**
 * Pilot for generated API types (issue #1808): fetchAuditRecords uses the
 * response type generated from backend/openapi.json.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.hoisted(() => vi.fn());

vi.mock('../../api/axiosInstance', () => ({
  default: { get: getMock },
}));

import type { components } from '../../api/generated/openapi';
import { fetchAuditRecords } from '../transactionHistoryApi';

type GeneratedAuditListResponse = components['schemas']['AuditListResponse'];

const sample: GeneratedAuditListResponse = {
  data: [
    {
      id: 1,
      tx_hash: 'abc',
      source_account: 'GSRC',
      fee_charged: '100',
      successful: true,
      created_at: '2026-01-01T00:00:00Z',
      stellar_created_at: '2026-01-01T00:00:00Z',
    },
  ],
  total: 1,
  page: 1,
  totalPages: 1,
};

describe('fetchAuditRecords (generated types pilot)', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('calls GET /api/v1/audit with mapped query params and returns the page', async () => {
    getMock.mockResolvedValueOnce({ data: sample });

    const result = await fetchAuditRecords({
      page: 2,
      limit: 25,
      startDate: '2026-01-01',
      endDate: '',
      search: 'abc',
    } as Parameters<typeof fetchAuditRecords>[0]);

    expect(getMock).toHaveBeenCalledTimes(1);
    const [url, config] = getMock.mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(url).toBe('/api/v1/audit');
    expect(config.params).toMatchObject({
      page: 2,
      limit: 25,
      dateFrom: '2026-01-01',
      dateTo: undefined,
      search: 'abc',
    });
    expect(result).toEqual(sample);
  });

  it('wraps failures with a categorized error state', async () => {
    getMock.mockRejectedValueOnce(Object.assign(new Error('bad'), { response: { status: 400 } }));

    await expect(
      fetchAuditRecords({ page: 1, limit: 10 } as Parameters<typeof fetchAuditRecords>[0])
    ).rejects.toMatchObject({ errorState: { type: 'client', statusCode: 400, retryable: false } });
  });
});
