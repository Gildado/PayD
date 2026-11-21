import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { useWallet } from './useWallet';
import { fetchNativeXlmBalance } from '../services/horizonBalances';
import { getHorizonUrlForNetwork } from '../services/multisigDetection';

/** Default polling interval when the tab is visible and healthy (10 seconds). */
export const DEFAULT_POLL_INTERVAL_MS = 10_000;

/** Maximum delay under exponential backoff (2 minutes). */
export const MAX_BACKOFF_INTERVAL_MS = 120_000;

/**
 * Calculates exponential backoff delay based on consecutive failure count:
 *   delay = baseIntervalMs * 2^(min(failureCount, 30))
 * Result is clamped between baseIntervalMs and maxIntervalMs.
 *
 * Time Complexity: O(1).
 * Space Complexity: O(1).
 */
export function calculateBackoffDelay(
  failureCount: number,
  baseIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  maxIntervalMs = MAX_BACKOFF_INTERVAL_MS
): number {
  if (failureCount <= 0) return baseIntervalMs;
  const factor = Math.min(failureCount, 30);
  const exponential = baseIntervalMs * Math.pow(2, factor);
  return Math.min(exponential, maxIntervalMs);
}

/**
 * Checks whether the current browser tab/document is active and visible
 * using the HTML5 Page Visibility API.
 * Returns true if executed outside a browser environment.
 */
export function isDocumentVisible(): boolean {
  if (typeof document === 'undefined') return true;
  return document.visibilityState !== 'hidden' && !document.hidden;
}

/**
 * Standalone balance poller class for orchestrating poll intervals,
 * exponential backoff, and tab visibility pauses.
 * Designed for clean testability with fake timers.
 */
export class BalancePoller {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private failureCount = 0;
  private isRunning = false;
  private visibilityHandler: (() => void) | null = null;

  constructor(
    private readonly pollFn: () => Promise<unknown>,
    private readonly options: {
      baseIntervalMs?: number;
      maxIntervalMs?: number;
      checkVisibility?: () => boolean;
    } = {}
  ) {}

  public getBaseInterval(): number {
    return this.options.baseIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  }

  public getMaxInterval(): number {
    return this.options.maxIntervalMs ?? MAX_BACKOFF_INTERVAL_MS;
  }

  public getFailureCount(): number {
    return this.failureCount;
  }

  public isPolling(): boolean {
    return this.isRunning;
  }

  private isVisible(): boolean {
    return this.options.checkVisibility ? this.options.checkVisibility() : isDocumentVisible();
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Listen for visibility change events if in browser
    if (typeof document !== 'undefined') {
      this.visibilityHandler = () => {
        if (this.isVisible() && this.isRunning) {
          // Tab became visible again — immediately execute pending poll
          void this.executePoll();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    if (this.isVisible()) {
      void this.executePoll();
    }
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (typeof document !== 'undefined' && this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  public async executePoll(): Promise<void> {
    if (!this.isRunning) return;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    // Do NOT make requests while the tab is hidden
    if (!this.isVisible()) {
      return;
    }

    try {
      await this.pollFn();
      // On success, reset failure count to 0
      this.failureCount = 0;
    } catch {
      // On failure, increment consecutive error count
      this.failureCount += 1;
    }

    // Schedule next poll interval if still running
    if (this.isRunning) {
      const nextDelay = calculateBackoffDelay(
        this.failureCount,
        this.getBaseInterval(),
        this.getMaxInterval()
      );
      this.timer = setTimeout(() => {
        void this.executePoll();
      }, nextDelay);
    }
  }
}

export interface UseNativeXlmBalanceOptions {
  /** Base poll interval in milliseconds when tab is visible (default: 10,000ms). */
  baseIntervalMs?: number;
  /** Maximum poll interval in milliseconds during backoff (default: 120,000ms). */
  maxIntervalMs?: number;
  /** Whether the query is enabled. */
  enabled?: boolean;
}

/**
 * Connected wallet native XLM balance for the current Stellar network.
 *
 * Implements Page Visibility API tab pausing (no Horizon hits while hidden)
 * and exponential backoff on network/server errors.
 */
export function useNativeXlmBalance(options?: UseNativeXlmBalanceOptions) {
  const { address, network, isInitialized } = useWallet();
  const horizonUrl = getHorizonUrlForNetwork(network);

  const baseInterval = options?.baseIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxInterval = options?.maxIntervalMs ?? MAX_BACKOFF_INTERVAL_MS;
  const isEnabled = Boolean(isInitialized && address && (options?.enabled ?? true));

  const queryKey = useMemo(
    () => ['native-xlm-balance', address, horizonUrl] as const,
    [address, horizonUrl]
  );

  const query = useQuery({
    queryKey,
    queryFn: () => fetchNativeXlmBalance(address!, horizonUrl),
    enabled: isEnabled,
    staleTime: 5_000,
    // Page Visibility API + Exponential backoff
    refetchInterval: (q) => {
      // Pause completely if tab is hidden
      if (!isDocumentVisible()) {
        return false;
      }
      const failureCount = q.state.fetchFailureCount ?? 0;
      return calculateBackoffDelay(failureCount, baseInterval, maxInterval);
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const { refetch } = query;

  // Listen for tab visibility changes to immediately refresh balance on tab focus
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (isDocumentVisible() && isEnabled) {
        void refetch();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isEnabled, refetch]);

  return query;
}
