/**
 * Transaction History API Service
 *
 * This module provides API functions for fetching transaction history data
 * from the backend audit API and contract events API. It includes:
 * - Query parameter building
 * - Error handling with typed error responses
 * - AbortController support for request cancellation
 *
 * Requirements: 1.1, 2.1, 3.3, 4.1, 7.3, 10.1, 10.2, 10.3
 */

import type {
  FetchAuditOptions,
  AuditApiResponse,
  FetchContractEventsOptions,
  ContractEventsApiResponse,
  FetchHistoryPageOptions,
  FetchHistoryPageResult,
  ErrorState,
  TimelineItem,
  AuditRecord,
  ContractEvent,
} from '../types/transactionHistory';
import axiosInstance from '../api/axiosInstance';

// ============================================================================
// Configuration
// ============================================================================

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Categorizes an error into a structured ErrorState for UI display
 *
 * @param error - The error to categorize
 * @returns Structured error state with type, message, and retryability
 */
export function categorizeError(error: unknown): ErrorState {
  // Network errors (fetch failures, timeouts, DNS issues)
  if (error instanceof TypeError || (error instanceof Error && error.message?.includes('fetch'))) {
    return {
      type: 'network',
      message: 'Unable to connect. Please check your internet connection.',
      retryable: true,
    };
  }

  // HTTP errors with response
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { status?: number } }).response;
    const status = response?.status;

    // Client errors (4xx)
    if (status && status >= 400 && status < 500) {
      return {
        type: 'client',
        message: 'Invalid request. Please check your filters and try again.',
        statusCode: status,
        retryable: false,
      };
    }

    // Server errors (5xx)
    if (status && status >= 500) {
      return {
        type: 'server',
        message: 'Server error. Please try again later.',
        statusCode: status,
        retryable: true,
      };
    }
  }

  // Validation/parsing errors
  return {
    type: 'validation',
    message: 'Unexpected data format received.',
    retryable: false,
  };
}

// ============================================================================
// Query Parameter Building
// ============================================================================

// ============================================================================
// Audit API Functions
// ============================================================================

/**
 * Fetches audit records from the backend audit API
 *
 * @param options - Fetch options including pagination and filters
 * @returns Promise resolving to audit API response
 * @throws Error with categorized error state on failure
 *
 * Requirements: 1.1, 2.1, 3.3, 10.1, 10.2, 10.3
 */
export async function fetchAuditRecords(
  options: FetchAuditOptions,
  signal?: AbortSignal
): Promise<AuditApiResponse> {
  const { page, limit, status, employee, asset, startDate, endDate, search } = options;

  try {
    const response = await axiosInstance.get<AuditApiResponse>('/api/v1/audit', {
      params: {
        page,
        limit,
        status,
        employee,
        asset,
        startDate,
        endDate,
        search,
      },
      signal,
    });

    return response.data;
  } catch (error) {
    if (error instanceof Error && error.name === 'CanceledError') {
      throw new Error('The operation was aborted.');
    }

    const categorized = categorizeError(error);
    const enhancedError = new Error(categorized.message) as Error & { errorState?: ErrorState };
    enhancedError.errorState = categorized;
    throw enhancedError;
  }
}

// ============================================================================
// Contract Events API Functions
// ============================================================================

/**
 * Fetches contract events for a single contract from the backend API
 *
 * @param options - Fetch options including contract ID and pagination
 * @returns Promise resolving to contract events API response
 * @throws Error with categorized error state on failure
 *
 * Requirements: 4.1, 10.1, 10.2, 10.3
 */
export async function fetchContractEvents(
  options: FetchContractEventsOptions,
  signal?: AbortSignal
): Promise<ContractEventsApiResponse> {
  const { contractId, page, limit, eventType, category } = options;

  try {
    const response = await axiosInstance.get<ContractEventsApiResponse>(
      `/api/events/${contractId}`,
      {
        params: {
          page,
          limit,
          eventType,
          category,
        },
        signal,
      }
    );

    return response.data;
  } catch (error) {
    if (error instanceof Error && error.name === 'CanceledError') {
      throw new Error('The operation was aborted.');
    }

    const categorized = categorizeError(error);
    const enhancedError = new Error(categorized.message) as Error & { errorState?: ErrorState };
    enhancedError.errorState = categorized;
    throw enhancedError;
  }
}

// ============================================================================
// Data Normalization Functions
// ============================================================================

/**
 * Normalizes an audit record from the backend into a unified TimelineItem
 *
 * Normalization rules:
 * - kind: always 'classic'
 * - status: 'confirmed' if successful, 'failed' otherwise
 * - id: uses the audit record id
 * - createdAt: uses stellar_created_at (falls back to created_at)
 * - amount: uses fee_charged (formatted as string)
 * - asset: defaults to 'XLM' (native Stellar asset)
 * - actor: uses source_account
 * - txHash: uses tx_hash
 * - label: descriptive label based on status
 * - badge: always 'Classic'
 *
 * @param record - Audit record from the backend API
 * @returns Normalized TimelineItem
 *
 * Requirements: 4.2, 9.1, 9.2
 */
export function normalizeAuditRecord(record: AuditRecord): TimelineItem {
  return {
    id: `audit-${record.id}`,
    kind: 'classic',
    createdAt: record.stellar_created_at || record.created_at,
    status: record.successful ? 'confirmed' : 'failed',
    amount: record.fee_charged || '0',
    asset: 'XLM', // Audit records track fees in XLM
    actor: record.source_account || 'Unknown',
    txHash: record.tx_hash || null,
    label: record.successful ? 'Transaction Confirmed' : 'Transaction Failed',
    badge: 'Classic',
  };
}

/**
 * Normalizes a contract event from the backend into a unified TimelineItem
 *
 * Normalization rules:
 * - kind: always 'contract'
 * - status: always 'indexed' (contract events are indexed after confirmation)
 * - id: uses the event_id
 * - createdAt: uses created_at
 * - amount: extracts from payload.amount (defaults to '0')
 * - asset: extracts from payload.asset_code (defaults to 'Unknown')
 * - actor: uses contract_id
 * - txHash: uses tx_hash
 * - label: descriptive label based on event_type
 * - badge: always 'Contract Event'
 *
 * @param event - Contract event from the backend API
 * @returns Normalized TimelineItem
 *
 * Requirements: 4.2, 9.1, 9.2
 */
export function normalizeContractEvent(event: ContractEvent): TimelineItem {
  // Extract amount and asset from payload with defaults
  const amount = event.payload?.amount || '0';
  const asset = event.payload?.asset_code || 'Unknown';

  // Create a human-readable label from event type
  const label = formatEventTypeLabel(event.event_type);

  return {
    id: `contract-${event.event_id}`,
    kind: 'contract',
    createdAt: event.created_at,
    status: 'indexed',
    amount,
    asset,
    actor: event.contract_id || 'Unknown',
    txHash: event.tx_hash || null,
    label,
    badge: 'Contract Event',
  };
}

/**
 * Formats an event type string into a human-readable label
 *
 * Examples:
 * - 'transfer' → 'Transfer Event'
 * - 'payment' → 'Payment Event'
 * - 'token_mint' → 'Token Mint Event'
 *
 * @param eventType - Raw event type string
 * @returns Formatted label
 */
function formatEventTypeLabel(eventType: string): string {
  if (!eventType) return 'Contract Event';

  // Convert snake_case to Title Case and add 'Event' suffix
  const formatted = eventType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return `${formatted} Event`;
}

// ============================================================================
// Timeline Merging and Sorting
// ============================================================================

/**
 * Merges and sorts timeline items by timestamp in descending order
 *
 * @param items - Array of timeline items to merge and sort
 * @returns Sorted array with most recent items first
 *
 * Requirements: 4.2, 4.3
 */
export function mergeAndSortTimeline(items: TimelineItem[]): TimelineItem[] {
  // Sort by createdAt timestamp in descending order (most recent first)
  return [...items].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return timeB - timeA; // Descending order
  });
}

// ============================================================================
// Unified History Page Fetching
// ============================================================================

/**
 * Orchestrates parallel fetching of audit records and contract events,
 * normalizes both result sets, merges them, and returns a unified timeline
 *
 * This is the main entry point for fetching transaction history data.
 * It coordinates:
 * 1. Parallel API calls to audit and contract events endpoints
 * 2. Data normalization to unified TimelineItem format
 * 3. Merging and sorting by timestamp descending
 * 4. Calculating pagination metadata (hasMore, total)
 *
 * @param options - Fetch options including pagination and filters
 * @param signal - Optional AbortSignal for request cancellation
 * @returns Promise resolving to unified history page result
 * @throws Error with categorized error state on failure
 *
 * Requirements: 4.1, 4.2, 4.3
 */
export async function fetchHistoryPage(
  options: FetchHistoryPageOptions,
  signal?: AbortSignal
): Promise<FetchHistoryPageResult> {
  const { page, limit, filters } = options;

  // Import contract service dynamically to avoid circular dependencies
  const { contractService } = await import('./contracts');

  // Initialize contract service to get contract IDs
  await contractService.initialize();

  // Get contract IDs for fetching events
  // Using the same contracts as the existing implementation
  const contractIds = [
    contractService.getContractId('bulk_payment', 'testnet'),
    contractService.getContractId('vesting_escrow', 'testnet'),
    contractService.getContractId('revenue_split', 'testnet'),
  ].filter((id): id is string => Boolean(id));

  try {
    // Step 1: Call fetchAuditRecords and fetchContractEvents in parallel
    const [auditResponse, ...contractResponses] = await Promise.all([
      // Fetch audit records with all filters
      fetchAuditRecords(
        {
          page,
          limit,
          status: filters.status || undefined,
          employee: filters.employee || undefined,
          asset: filters.asset || undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
          search: filters.search || undefined,
        },
        signal
      ),
      // Fetch contract events from all contracts in parallel
      ...contractIds.map((contractId) =>
        fetchContractEvents(
          {
            contractId,
            page: 1, // Always fetch first page of contract events
            limit: 10, // Limit contract events per contract
          },
          signal
        ).catch((error) => {
          // If a contract event fetch fails, log and continue
          // This allows the timeline to work even if some contracts are unavailable
          console.warn(`Failed to fetch events for contract ${contractId}:`, error);
          return null;
        })
      ),
    ]);

    // Step 2: Normalize both result sets
    const normalizedAuditItems = auditResponse.data.map(normalizeAuditRecord);

    const normalizedContractItems: TimelineItem[] = [];
    contractResponses.forEach((response) => {
      if (response && response.success && response.data) {
        response.data.forEach((event) => {
          normalizedContractItems.push(normalizeContractEvent(event));
        });
      }
    });

    // Step 3: Merge and sort by timestamp descending
    const allItems = [...normalizedAuditItems, ...normalizedContractItems];
    const sortedItems = mergeAndSortTimeline(allItems);

    // Step 4: Calculate pagination metadata
    // hasMore is based on audit records pagination (primary data source)
    const hasMore = page * limit < auditResponse.total;

    // Total is the sum of audit records and contract events
    // Note: This is an approximation since contract events are not paginated the same way
    const contractEventsTotal = contractResponses.reduce((sum, response) => {
      if (response && response.success && response.pagination) {
        return sum + response.pagination.total;
      }
      return sum;
    }, 0);

    const total = auditResponse.total + contractEventsTotal;

    // Return unified result
    return {
      items: sortedItems,
      hasMore,
      total,
    };
  } catch (error) {
    // If the request was aborted, rethrow as-is
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }

    // Otherwise, categorize and rethrow
    const categorized = categorizeError(error);
    const enhancedError = new Error(categorized.message) as Error & { errorState?: ErrorState };
    enhancedError.errorState = categorized;
    throw enhancedError;
  }
}
