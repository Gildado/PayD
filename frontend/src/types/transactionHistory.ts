/**
 * Type definitions for Transaction History feature
 *
 * This module defines all TypeScript interfaces and types used throughout
 * the transaction history feature, including filters, timeline items,
 * API responses, and error states.
 */

// ============================================================================
// Filter Types
// ============================================================================

/**
 * Filter parameters for transaction history queries
 * All fields are optional strings (empty string means no filter applied)
 */
export interface HistoryFilters {
  /** Transaction hash or actor search term */
  search: string;

  /** Transaction status filter: 'confirmed' | 'pending' | 'failed' | '' */
  status: string;

  /** Employee name or wallet address filter */
  employee: string;

  /** Asset code filter (e.g., 'USDC', 'XLM', 'EURC') */
  asset: string;

  /** Start date for date range filter (ISO date string) */
  startDate: string;

  /** End date for date range filter (ISO date string) */
  endDate: string;
}

// ============================================================================
// Timeline Item Types
// ============================================================================

/**
 * Unified timeline item representing either a classic Stellar transaction
 * or a contract event
 */
export interface TimelineItem {
  /** Unique identifier for the timeline item */
  id: string;

  /** Type of timeline item */
  kind: 'classic' | 'contract';

  /** ISO 8601 timestamp of when the item was created */
  createdAt: string;

  /** Status of the item: 'confirmed' | 'pending' | 'failed' | 'indexed' */
  status: string;

  /** Formatted amount string */
  amount: string;

  /** Asset code (e.g., 'USDC', 'XLM') */
  asset: string;

  /** Source account or contract ID */
  actor: string;

  /** Transaction hash (null for some contract events) */
  txHash: string | null;

  /** Display label for the timeline item */
  label: string;

  /** Badge text to display ('Classic' | 'Contract Event') */
  badge: string;
}

// ============================================================================
// Backend API Response Types - Audit API
// ============================================================================

/**
 * Individual audit record from the backend audit API
 */
export interface AuditRecord {
  /** Unique identifier for the audit record */
  id: number;

  /** Stellar transaction hash */
  tx_hash: string;

  /** Source account public key */
  source_account: string;

  /** Fee charged for the transaction (in stroops) */
  fee_charged: string;

  /** Whether the transaction was successful */
  successful: boolean;

  /** Timestamp when the record was created in our database */
  created_at: string;

  /** Timestamp from the Stellar ledger */
  stellar_created_at: string;
}

/**
 * Response from the audit API endpoint
 */
export interface AuditApiResponse {
  /** Array of audit records */
  data: AuditRecord[];

  /** Total number of records matching the query */
  total: number;

  /** Current page number */
  page: number;

  /** Total number of pages available */
  totalPages: number;
}

// ============================================================================
// Backend API Response Types - Contract Events API
// ============================================================================

/**
 * Individual contract event from the contract events API
 */
export interface ContractEvent {
  /** Unique identifier for the event */
  event_id: string;

  /** Contract ID that emitted the event */
  contract_id: string;

  /** Type of event (e.g., 'transfer', 'payment', 'approval') */
  event_type: string;

  /** Event payload containing event-specific data */
  payload: {
    /** Amount involved in the event (optional) */
    amount?: string;

    /** Asset code (optional) */
    asset_code?: string;

    /** Additional payload fields */
    [key: string]: unknown;
  };

  /** Ledger sequence number where the event occurred */
  ledger_sequence: number;

  /** Transaction hash associated with the event */
  tx_hash: string;

  /** Timestamp when the event was created */
  created_at: string;
}

/**
 * Response from the contract events API endpoint
 */
export interface ContractEventsApiResponse {
  /** Whether the request was successful */
  success: boolean;

  /** Array of contract events */
  data: ContractEvent[];

  /** Pagination metadata */
  pagination: {
    /** Current page number */
    page: number;

    /** Number of items per page */
    limit: number;

    /** Total number of events matching the query */
    total: number;

    /** Total number of pages available */
    totalPages: number;
  };
}

// ============================================================================
// API Request Options Types
// ============================================================================

/**
 * Options for fetching audit records
 */
export interface FetchAuditOptions {
  /** Page number (1-indexed) */
  page: number;

  /** Number of items per page */
  limit: number;

  /** Optional status filter */
  status?: string;

  /** Optional employee filter */
  employee?: string;

  /** Optional asset filter */
  asset?: string;

  /** Optional start date filter (ISO date string) */
  startDate?: string;

  /** Optional end date filter (ISO date string) */
  endDate?: string;

  /** Optional search term */
  search?: string;
}

/**
 * Options for fetching contract events
 */
export interface FetchContractEventsOptions {
  /** Contract ID to fetch events from */
  contractId: string;

  /** Page number (1-indexed) */
  page: number;

  /** Number of items per page */
  limit: number;

  /** Optional event type filter */
  eventType?: string;

  /** Optional category filter */
  category?: string;
}

/**
 * Options for fetching a unified history page
 */
export interface FetchHistoryPageOptions {
  /** Page number (1-indexed) */
  page: number;

  /** Number of items per page */
  limit: number;

  /** Filter parameters */
  filters: HistoryFilters;
}

/**
 * Result from fetching a unified history page
 */
export interface FetchHistoryPageResult {
  /** Array of timeline items (merged and sorted) */
  items: TimelineItem[];

  /** Whether there are more pages available */
  hasMore: boolean;

  /** Total number of items across all pages */
  total: number;
}

// ============================================================================
// Error State Types
// ============================================================================

/**
 * Error type categories
 */
export type ErrorType = 'network' | 'client' | 'server' | 'validation';

/**
 * Structured error state for UI display
 */
export interface ErrorState {
  /** Type of error */
  type: ErrorType;

  /** Human-readable error message */
  message: string;

  /** HTTP status code (if applicable) */
  statusCode?: number;

  /** Whether the error is retryable */
  retryable: boolean;
}

// ============================================================================
// Hook Return Types
// ============================================================================

/**
 * Options for useTransactionHistory hook
 */
export interface UseTransactionHistoryOptions {
  /** Filter parameters */
  filters: HistoryFilters;

  /** Current page number */
  page: number;

  /** Number of items per page */
  limit: number;
}

/**
 * Return type for useTransactionHistory hook
 */
export interface UseTransactionHistoryResult {
  /** Timeline items data (undefined during initial load) */
  data: TimelineItem[] | undefined;

  /** Whether initial data is loading */
  isLoading: boolean;

  /** Whether additional pages are being loaded */
  isLoadingMore: boolean;

  /** Error state (null if no error) */
  error: Error | null;

  /** Whether more pages are available */
  hasMore: boolean;

  /** Function to fetch the next page */
  fetchNextPage: () => Promise<unknown>;

  /** Function to retry after an error */
  retry: () => void;

  /** Function to refetch the current data (for real-time updates) */
  refetch: () => void;
}

/**
 * Return type for useFilterState hook
 */
export interface UseFilterStateResult {
  /** Current filter values */
  filters: HistoryFilters;

  /** Debounced filter values (delayed by 300ms) */
  debouncedFilters: HistoryFilters;

  /** Function to update a single filter value */
  updateFilter: (key: keyof HistoryFilters, value: string) => void;

  /** Function to reset all filters to empty values */
  resetFilters: () => void;

  /** Number of active (non-empty) filters */
  activeFilterCount: number;
}
