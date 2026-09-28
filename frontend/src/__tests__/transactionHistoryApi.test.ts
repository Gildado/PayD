/**
 * Unit Tests for Transaction History API Service
 *
 * Tests the normalization functions and API service layer
 */

import { normalizeAuditRecord, normalizeContractEvent } from '../services/transactionHistoryApi';
import type { AuditRecord, ContractEvent } from '../types/transactionHistory';
import axiosInstance from '../api/axiosInstance';
import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('../api/axiosInstance', () => ({
  default: {
    get: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('normalizeAuditRecord', () => {
  test('converts audit record to timeline item with all fields', () => {
    const auditRecord: AuditRecord = {
      id: 123,
      tx_hash: 'abc123def456',
      source_account: 'GABC123DEF456',
      fee_charged: '100',
      successful: true,
      created_at: '2024-01-15T10:30:00Z',
      stellar_created_at: '2024-01-15T10:30:00Z',
    };

    const result = normalizeAuditRecord(auditRecord);

    expect(result.id).toBe('audit-123');
    expect(result.kind).toBe('classic');
    expect(result.createdAt).toBe('2024-01-15T10:30:00Z');
    expect(result.status).toBe('confirmed');
    expect(result.amount).toBe('100');
    expect(result.asset).toBe('XLM');
    expect(result.actor).toBe('GABC123DEF456');
    expect(result.txHash).toBe('abc123def456');
    expect(result.label).toBe('Transaction Confirmed');
    expect(result.badge).toBe('Classic');
  });

  test('handles failed transactions', () => {
    const auditRecord: AuditRecord = {
      id: 456,
      tx_hash: 'failed123',
      source_account: 'GFAIL123',
      fee_charged: '50',
      successful: false,
      created_at: '2024-01-15T11:00:00Z',
      stellar_created_at: '2024-01-15T11:00:00Z',
    };

    const result = normalizeAuditRecord(auditRecord);

    expect(result.status).toBe('failed');
    expect(result.label).toBe('Transaction Failed');
  });

  test('handles missing stellar_created_at by falling back to created_at', () => {
    const auditRecord: AuditRecord = {
      id: 789,
      tx_hash: 'test123',
      source_account: 'GTEST123',
      fee_charged: '75',
      successful: true,
      created_at: '2024-01-15T12:00:00Z',
      stellar_created_at: '',
    };

    const result = normalizeAuditRecord(auditRecord);

    expect(result.createdAt).toBe('2024-01-15T12:00:00Z');
  });

  test('handles missing fee_charged with default', () => {
    const auditRecord: AuditRecord = {
      id: 999,
      tx_hash: 'nofee123',
      source_account: 'GNOFEE123',
      fee_charged: '',
      successful: true,
      created_at: '2024-01-15T13:00:00Z',
      stellar_created_at: '2024-01-15T13:00:00Z',
    };

    const result = normalizeAuditRecord(auditRecord);

    expect(result.amount).toBe('0');
  });

  test('handles missing source_account with default', () => {
    const auditRecord: AuditRecord = {
      id: 111,
      tx_hash: 'nosource123',
      source_account: '',
      fee_charged: '100',
      successful: true,
      created_at: '2024-01-15T14:00:00Z',
      stellar_created_at: '2024-01-15T14:00:00Z',
    };

    const result = normalizeAuditRecord(auditRecord);

    expect(result.actor).toBe('Unknown');
  });

  test('handles missing tx_hash with null', () => {
    const auditRecord: AuditRecord = {
      id: 222,
      tx_hash: '',
      source_account: 'GTEST123',
      fee_charged: '100',
      successful: true,
      created_at: '2024-01-15T15:00:00Z',
      stellar_created_at: '2024-01-15T15:00:00Z',
    };

    const result = normalizeAuditRecord(auditRecord);

    expect(result.txHash).toBe(null);
  });
});

describe('normalizeContractEvent', () => {
  test('converts contract event to timeline item with all fields', () => {
    const contractEvent: ContractEvent = {
      event_id: 'evt_123',
      contract_id: 'CABC123DEF456',
      event_type: 'transfer',
      payload: {
        amount: '1000',
        asset_code: 'USDC',
      },
      ledger_sequence: 12345,
      tx_hash: 'def456abc789',
      created_at: '2024-01-15T11:00:00Z',
    };

    const result = normalizeContractEvent(contractEvent);

    expect(result.id).toBe('contract-evt_123');
    expect(result.kind).toBe('contract');
    expect(result.createdAt).toBe('2024-01-15T11:00:00Z');
    expect(result.status).toBe('indexed');
    expect(result.amount).toBe('1000');
    expect(result.asset).toBe('USDC');
    expect(result.actor).toBe('CABC123DEF456');
    expect(result.txHash).toBe('def456abc789');
    expect(result.label).toBe('Transfer Event');
    expect(result.badge).toBe('Contract Event');
  });

  test('handles missing amount with default', () => {
    const contractEvent: ContractEvent = {
      event_id: 'evt_456',
      contract_id: 'CTEST123',
      event_type: 'approval',
      payload: {
        asset_code: 'XLM',
      },
      ledger_sequence: 12346,
      tx_hash: 'test123',
      created_at: '2024-01-15T12:00:00Z',
    };

    const result = normalizeContractEvent(contractEvent);

    expect(result.amount).toBe('0');
  });

  test('handles missing asset_code with default', () => {
    const contractEvent: ContractEvent = {
      event_id: 'evt_789',
      contract_id: 'CTEST456',
      event_type: 'payment',
      payload: {
        amount: '500',
      },
      ledger_sequence: 12347,
      tx_hash: 'test456',
      created_at: '2024-01-15T13:00:00Z',
    };

    const result = normalizeContractEvent(contractEvent);

    expect(result.asset).toBe('Unknown');
  });

  test('handles missing tx_hash with null', () => {
    const contractEvent: ContractEvent = {
      event_id: 'evt_999',
      contract_id: 'CTEST789',
      event_type: 'mint',
      payload: {
        amount: '2000',
        asset_code: 'EURC',
      },
      ledger_sequence: 12348,
      tx_hash: '',
      created_at: '2024-01-15T14:00:00Z',
    };

    const result = normalizeContractEvent(contractEvent);

    expect(result.txHash).toBe(null);
  });

  test('handles missing contract_id with default', () => {
    const contractEvent: ContractEvent = {
      event_id: 'evt_111',
      contract_id: '',
      event_type: 'burn',
      payload: {
        amount: '300',
        asset_code: 'USDC',
      },
      ledger_sequence: 12349,
      tx_hash: 'test789',
      created_at: '2024-01-15T15:00:00Z',
    };

    const result = normalizeContractEvent(contractEvent);

    expect(result.actor).toBe('Unknown');
  });

  test('formats event type labels correctly', () => {
    const testCases = [
      { event_type: 'transfer', expected: 'Transfer Event' },
      { event_type: 'payment', expected: 'Payment Event' },
      { event_type: 'token_mint', expected: 'Token Mint Event' },
      { event_type: 'approval_revoked', expected: 'Approval Revoked Event' },
      { event_type: '', expected: 'Contract Event' },
    ];

    testCases.forEach(({ event_type, expected }) => {
      const contractEvent: ContractEvent = {
        event_id: 'evt_test',
        contract_id: 'CTEST',
        event_type,
        payload: {},
        ledger_sequence: 12350,
        tx_hash: 'test',
        created_at: '2024-01-15T16:00:00Z',
      };

      const result = normalizeContractEvent(contractEvent);
      expect(result.label).toBe(expected);
    });
  });

  test('handles empty payload gracefully', () => {
    const contractEvent: ContractEvent = {
      event_id: 'evt_empty',
      contract_id: 'CEMPTY',
      event_type: 'custom',
      payload: {},
      ledger_sequence: 12351,
      tx_hash: 'empty123',
      created_at: '2024-01-15T17:00:00Z',
    };

    const result = normalizeContractEvent(contractEvent);

    expect(result.amount).toBe('0');
    expect(result.asset).toBe('Unknown');
    expect(result.label).toBe('Custom Event');
  });
});

// ============================================================================
// API Service Function Tests
// ============================================================================

describe('fetchAuditRecords', () => {
  test('builds query string with all filter parameters', async () => {
    const { fetchAuditRecords } = await import('../services/transactionHistoryApi');

    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: {
        data: [],
        total: 0,
        page: 1,
        totalPages: 0,
      },
      status: 200,
    });

    await fetchAuditRecords({
      page: 2,
      limit: 20,
      status: 'confirmed',
      employee: 'john@example.com',
      asset: 'USDC',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      search: 'abc123',
    });

    const [url, config] = vi.mocked(axiosInstance.get).mock.calls[0];
    expect(url).toBe('/api/v1/audit');
    expect(config?.params).toEqual({
      page: 2,
      limit: 20,
      status: 'confirmed',
      employee: 'john@example.com',
      asset: 'USDC',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      search: 'abc123',
    });
  });

  test('omits empty filter parameters from query string', async () => {
    const { fetchAuditRecords } = await import('../services/transactionHistoryApi');

    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: {
        data: [],
        total: 0,
        page: 1,
        totalPages: 0,
      },
      status: 200,
    });

    await fetchAuditRecords({
      page: 1,
      limit: 10,
      status: '',
      employee: '',
      asset: '',
      startDate: '',
      endDate: '',
      search: '',
    });

    const config = vi.mocked(axiosInstance.get).mock.calls[0][1];
    expect(config?.params).toEqual({
      page: 1,
      limit: 10,
      status: '',
      employee: '',
      asset: '',
      startDate: '',
      endDate: '',
      search: '',
    });
  });

  test('handles successful response with data', async () => {
    const { fetchAuditRecords } = await import('../services/transactionHistoryApi');

    const mockData = {
      data: [
        {
          id: 1,
          tx_hash: 'abc123',
          source_account: 'GABC123',
          fee_charged: '100',
          successful: true,
          created_at: '2024-01-15T10:00:00Z',
          stellar_created_at: '2024-01-15T10:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      totalPages: 1,
    };

    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: mockData,
      status: 200,
    });

    const result = await fetchAuditRecords({ page: 1, limit: 10 });

    expect(result).toEqual(mockData);
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  test('throws network error for fetch failure', async () => {
    const { fetchAuditRecords } = await import('../services/transactionHistoryApi');

    vi.mocked(axiosInstance.get).mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(fetchAuditRecords({ page: 1, limit: 10 })).rejects.toThrow(
      'Unable to connect. Please check your internet connection.'
    );
  });

  test('throws client error for 4xx response', async () => {
    const { fetchAuditRecords } = await import('../services/transactionHistoryApi');

    vi.mocked(axiosInstance.get).mockRejectedValue({
      response: { status: 400, data: 'Bad Request' },
    });

    await expect(fetchAuditRecords({ page: 1, limit: 10 })).rejects.toThrow(
      'Invalid request. Please check your filters and try again.'
    );
  });

  test('throws server error for 5xx response', async () => {
    const { fetchAuditRecords } = await import('../services/transactionHistoryApi');

    vi.mocked(axiosInstance.get).mockRejectedValue({
      response: { status: 500, data: 'Internal Server Error' },
    });

    await expect(fetchAuditRecords({ page: 1, limit: 10 })).rejects.toThrow(
      'Server error. Please try again later.'
    );
  });

  test('supports request cancellation via AbortController', async () => {
    const { fetchAuditRecords } = await import('../services/transactionHistoryApi');

    const abortController = new AbortController();

    vi.mocked(axiosInstance.get).mockImplementation(async (_url, config) => {
      // Simulate a delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check if aborted
      if (config?.signal?.aborted) {
        const axiosError = new Error('Canceled') as any;
        axiosError.name = 'CanceledError';
        axiosError.isAxiosError = true;
        throw axiosError;
      }

      return {
        data: { data: [], total: 0, page: 1, totalPages: 0 },
        status: 200,
      } as any;
    });

    // Abort immediately
    abortController.abort();

    await expect(fetchAuditRecords({ page: 1, limit: 10 }, abortController.signal)).rejects.toThrow(
      'The operation was aborted.'
    );
  });
});

describe('fetchContractEvents', () => {
  test('builds query string with pagination parameters', async () => {
    const { fetchContractEvents } = await import('../services/transactionHistoryApi');

    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: {
        success: true,
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      },
      status: 200,
    });

    await fetchContractEvents({
      contractId: 'CABC123',
      page: 2,
      limit: 20,
    });

    const [url, config] = vi.mocked(axiosInstance.get).mock.calls[0];
    expect(url).toBe('/api/events/CABC123');
    expect(config?.params).toEqual({
      page: 2,
      limit: 20,
    });
  });

  test('includes optional filter parameters when provided', async () => {
    const { fetchContractEvents } = await import('../services/transactionHistoryApi');

    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: {
        success: true,
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      },
      status: 200,
    });

    await fetchContractEvents({
      contractId: 'CABC123',
      page: 1,
      limit: 10,
      eventType: 'transfer',
      category: 'payment',
    });

    const config = vi.mocked(axiosInstance.get).mock.calls[0][1];
    expect(config?.params).toEqual({
      page: 1,
      limit: 10,
      eventType: 'transfer',
      category: 'payment',
    });
  });

  test('handles successful response with events', async () => {
    const { fetchContractEvents } = await import('../services/transactionHistoryApi');

    const mockData = {
      success: true,
      data: [
        {
          event_id: 'evt_123',
          contract_id: 'CABC123',
          event_type: 'transfer',
          payload: { amount: '1000', asset_code: 'USDC' },
          ledger_sequence: 12345,
          tx_hash: 'def456',
          created_at: '2024-01-15T11:00:00Z',
        },
      ],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    };

    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: mockData,
      status: 200,
    });

    const result = await fetchContractEvents({
      contractId: 'CABC123',
      page: 1,
      limit: 10,
    });

    expect(result).toEqual(mockData);
    expect(result.data).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
  });

  test('throws network error for fetch failure', async () => {
    const { fetchContractEvents } = await import('../services/transactionHistoryApi');

    vi.mocked(axiosInstance.get).mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      fetchContractEvents({ contractId: 'CABC123', page: 1, limit: 10 })
    ).rejects.toThrow('Unable to connect. Please check your internet connection.');
  });

  test('throws client error for 404 response', async () => {
    const { fetchContractEvents } = await import('../services/transactionHistoryApi');

    vi.mocked(axiosInstance.get).mockRejectedValue({
      response: { status: 404, data: 'Not Found' },
    });

    await expect(
      fetchContractEvents({ contractId: 'CABC123', page: 1, limit: 10 })
    ).rejects.toThrow('Invalid request. Please check your filters and try again.');
  });

  test('throws server error for 503 response', async () => {
    const { fetchContractEvents } = await import('../services/transactionHistoryApi');

    vi.mocked(axiosInstance.get).mockRejectedValue({
      response: { status: 503, data: 'Service Unavailable' },
    });

    await expect(
      fetchContractEvents({ contractId: 'CABC123', page: 1, limit: 10 })
    ).rejects.toThrow('Server error. Please try again later.');
  });

  test('supports request cancellation via AbortController', async () => {
    const { fetchContractEvents } = await import('../services/transactionHistoryApi');

    const abortController = new AbortController();

    vi.mocked(axiosInstance.get).mockImplementation(async (_url, config) => {
      // Check if aborted
      if (config?.signal?.aborted) {
        const axiosError = new Error('Canceled') as any;
        axiosError.name = 'CanceledError';
        axiosError.isAxiosError = true;
        throw axiosError;
      }

      return {
        data: {
          success: true,
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        },
        status: 200,
      } as any;
    });

    // Abort immediately
    abortController.abort();

    await expect(
      fetchContractEvents({ contractId: 'CABC123', page: 1, limit: 10 }, abortController.signal)
    ).rejects.toThrow('The operation was aborted.');
  });
});

describe('categorizeError', () => {
  test('categorizes TypeError as network error', async () => {
    const { categorizeError } = await import('../services/transactionHistoryApi');

    const error = new TypeError('Failed to fetch');
    const result = categorizeError(error);

    expect(result.type).toBe('network');
    expect(result.message).toContain('internet connection');
    expect(result.retryable).toBe(true);
  });

  test('categorizes 400 error as client error', async () => {
    const { categorizeError } = await import('../services/transactionHistoryApi');

    const error = { response: { status: 400 } };
    const result = categorizeError(error);

    expect(result.type).toBe('client');
    expect(result.statusCode).toBe(400);
    expect(result.retryable).toBe(false);
  });

  test('categorizes 404 error as client error', async () => {
    const { categorizeError } = await import('../services/transactionHistoryApi');

    const error = { response: { status: 404 } };
    const result = categorizeError(error);

    expect(result.type).toBe('client');
    expect(result.statusCode).toBe(404);
    expect(result.retryable).toBe(false);
  });

  test('categorizes 500 error as server error', async () => {
    const { categorizeError } = await import('../services/transactionHistoryApi');

    const error = { response: { status: 500 } };
    const result = categorizeError(error);

    expect(result.type).toBe('server');
    expect(result.statusCode).toBe(500);
    expect(result.retryable).toBe(true);
  });

  test('categorizes 503 error as server error', async () => {
    const { categorizeError } = await import('../services/transactionHistoryApi');

    const error = { response: { status: 503 } };
    const result = categorizeError(error);

    expect(result.type).toBe('server');
    expect(result.statusCode).toBe(503);
    expect(result.retryable).toBe(true);
  });

  test('categorizes unknown error as validation error', async () => {
    const { categorizeError } = await import('../services/transactionHistoryApi');

    const error = new Error('Something went wrong');
    const result = categorizeError(error);

    expect(result.type).toBe('validation');
    expect(result.retryable).toBe(false);
  });
});

// ============================================================================
// Timeline Merging and Sorting Tests
// ============================================================================

describe('mergeAndSortTimeline', () => {
  test('sorts timeline items by timestamp in descending order', async () => {
    const { mergeAndSortTimeline } = await import('../services/transactionHistoryApi');

    const items = [
      {
        id: '1',
        kind: 'classic' as const,
        createdAt: '2024-01-15T10:00:00Z',
        status: 'confirmed',
        amount: '100',
        asset: 'XLM',
        actor: 'GABC',
        txHash: 'hash1',
        label: 'Transaction 1',
        badge: 'Classic',
      },
      {
        id: '2',
        kind: 'contract' as const,
        createdAt: '2024-01-15T12:00:00Z',
        status: 'indexed',
        amount: '200',
        asset: 'USDC',
        actor: 'CABC',
        txHash: 'hash2',
        label: 'Event 1',
        badge: 'Contract Event',
      },
      {
        id: '3',
        kind: 'classic' as const,
        createdAt: '2024-01-15T11:00:00Z',
        status: 'confirmed',
        amount: '150',
        asset: 'XLM',
        actor: 'GDEF',
        txHash: 'hash3',
        label: 'Transaction 2',
        badge: 'Classic',
      },
    ];

    const result = mergeAndSortTimeline(items);

    // Should be sorted by timestamp descending (most recent first)
    expect(result[0].id).toBe('2'); // 12:00:00
    expect(result[1].id).toBe('3'); // 11:00:00
    expect(result[2].id).toBe('1'); // 10:00:00
  });

  test('handles empty array', async () => {
    const { mergeAndSortTimeline } = await import('../services/transactionHistoryApi');

    const result = mergeAndSortTimeline([]);
    expect(result).toEqual([]);
  });

  test('handles single item', async () => {
    const { mergeAndSortTimeline } = await import('../services/transactionHistoryApi');

    const items = [
      {
        id: '1',
        kind: 'classic' as const,
        createdAt: '2024-01-15T10:00:00Z',
        status: 'confirmed',
        amount: '100',
        asset: 'XLM',
        actor: 'GABC',
        txHash: 'hash1',
        label: 'Transaction 1',
        badge: 'Classic',
      },
    ];

    const result = mergeAndSortTimeline(items);
    expect(result).toEqual(items);
  });

  test('preserves all items during sort', async () => {
    const { mergeAndSortTimeline } = await import('../services/transactionHistoryApi');

    const items = [
      {
        id: '1',
        kind: 'classic' as const,
        createdAt: '2024-01-15T10:00:00Z',
        status: 'confirmed',
        amount: '100',
        asset: 'XLM',
        actor: 'GABC',
        txHash: 'hash1',
        label: 'Transaction 1',
        badge: 'Classic',
      },
      {
        id: '2',
        kind: 'contract' as const,
        createdAt: '2024-01-15T12:00:00Z',
        status: 'indexed',
        amount: '200',
        asset: 'USDC',
        actor: 'CABC',
        txHash: 'hash2',
        label: 'Event 1',
        badge: 'Contract Event',
      },
    ];

    const result = mergeAndSortTimeline(items);
    expect(result.length).toBe(2);
    expect(result.map((item) => item.id).sort()).toEqual(['1', '2']);
  });
});
