import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchHistoryPage } from '../services/transactionHistoryApi';
import type {
  UseTransactionHistoryOptions,
  UseTransactionHistoryResult,
} from '../types/transactionHistory';

/**
 * Custom hook for fetching and managing transaction history data with pagination.
 *
 * This hook uses TanStack Query's useInfiniteQuery to:
 * - Fetch transaction history data from the backend
 * - Cache results for 30 seconds (staleTime)
 * - Support pagination with "Load More" functionality
 * - Handle errors with retry capability (1 automatic retry)
 * - Cancel in-flight requests on unmount
 * - Deduplicate concurrent requests with identical parameters
 *
 * The query key includes all filter parameters to ensure proper cache invalidation
 * when filters change.
 *
 * @param options - Options including filters, page, and limit
 * @returns Transaction history data, loading states, error state, and pagination functions
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, hasMore, fetchNextPage, retry } = useTransactionHistory({
 *   filters: { status: 'confirmed', asset: 'USDC' },
 *   page: 1,
 *   limit: 20,
 * });
 *
 * // Display data
 * {data?.map(item => <TimelineItem key={item.id} item={item} />)}
 *
 * // Load more button
 * <button onClick={fetchNextPage} disabled={!hasMore}>Load More</button>
 *
 * // Retry on error
 * {error && <button onClick={retry}>Retry</button>}
 * ```
 *
 * Requirements: 1.1, 2.1, 7.2
 */
export function useTransactionHistory(
  options: UseTransactionHistoryOptions
): UseTransactionHistoryResult {
  const { filters, page, limit } = options;

  // Set up useInfiniteQuery with proper query key structure
  const query = useInfiniteQuery({
    // Query key includes page, limit, and all filter parameters for proper cache invalidation
    queryKey: [
      'transactionHistory',
      {
        page,
        limit,
        filters,
      },
    ],

    // Query function that calls fetchHistoryPage
    queryFn: async ({ pageParam = 1, signal }) => {
      return fetchHistoryPage(
        {
          page: pageParam,
          limit,
          filters,
        },
        signal
      );
    },

    // Initial page parameter
    initialPageParam: 1,

    // Function to get the next page parameter
    getNextPageParam: (lastPage, allPages) => {
      // If there are more pages, return the next page number
      if (lastPage.hasMore) {
        return allPages.length + 1;
      }
      // Otherwise, return undefined to indicate no more pages
      return undefined;
    },

    // Configure staleTime to 30 seconds
    staleTime: 30 * 1000, // 30 seconds in milliseconds

    // Configure retry to 1 attempt
    retry: 1,
  });

  // Extract data from all pages and flatten into a single array
  const data = query.data?.pages.flatMap((page) => page.items);

  // Determine if there are more pages to load
  const hasMore = query.hasNextPage ?? false;

  // Determine if we're loading more (not initial load)
  const isLoadingMore = query.isFetchingNextPage;

  return {
    data,
    isLoading: query.isLoading,
    isLoadingMore,
    error: query.error,
    hasMore,
    fetchNextPage: () => query.fetchNextPage(),
    retry: () => void query.refetch(),
    refetch: () => void query.refetch(),
  };
}
