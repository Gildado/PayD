import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  BalancePoller,
  calculateBackoffDelay,
  isDocumentVisible,
  DEFAULT_POLL_INTERVAL_MS,
  MAX_BACKOFF_INTERVAL_MS,
} from '../useNativeXlmBalance';

describe('calculateBackoffDelay', () => {
  it('returns base interval when failure count is 0 or negative', () => {
    expect(calculateBackoffDelay(0)).toBe(DEFAULT_POLL_INTERVAL_MS);
    expect(calculateBackoffDelay(-1)).toBe(DEFAULT_POLL_INTERVAL_MS);
  });

  it('calculates exponential backoff progression', () => {
    const base = 1000;
    const max = 10000;

    // attempt 1: 1000 * 2^1 = 2000
    expect(calculateBackoffDelay(1, base, max)).toBe(2000);
    // attempt 2: 1000 * 2^2 = 4000
    expect(calculateBackoffDelay(2, base, max)).toBe(4000);
    // attempt 3: 1000 * 2^3 = 8000
    expect(calculateBackoffDelay(3, base, max)).toBe(8000);
    // attempt 4: 1000 * 2^4 = 16000 -> clamped to 10000
    expect(calculateBackoffDelay(4, base, max)).toBe(10000);
  });

  it('clamps delay to MAX_BACKOFF_INTERVAL_MS by default', () => {
    expect(calculateBackoffDelay(10)).toBe(MAX_BACKOFF_INTERVAL_MS);
    expect(calculateBackoffDelay(25)).toBe(MAX_BACKOFF_INTERVAL_MS);
  });
});

describe('isDocumentVisible', () => {
  const originalState = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');

  afterEach(() => {
    if (originalState) {
      Object.defineProperty(Document.prototype, 'visibilityState', originalState);
    }
  });

  it('returns true when document is visible', () => {
    Object.defineProperty(Document.prototype, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    expect(isDocumentVisible()).toBe(true);
  });

  it('returns false when document is hidden', () => {
    Object.defineProperty(Document.prototype, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    expect(isDocumentVisible()).toBe(false);
  });
});

describe('BalancePoller with fake timers', () => {
  let isVisibleMock: boolean;
  const originalState = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');

  beforeEach(() => {
    vi.useFakeTimers();
    isVisibleMock = true;
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalState) {
      Object.defineProperty(Document.prototype, 'visibilityState', originalState);
    }
  });

  it('polls at regular base interval when tab is visible', async () => {
    const mockFetch = vi.fn().mockResolvedValue('100.5');
    const poller = new BalancePoller(mockFetch, {
      baseIntervalMs: 1000,
      maxIntervalMs: 8000,
      checkVisibility: () => isVisibleMock,
    });

    poller.start();
    // Immediate initial poll on start
    await vi.advanceTimersByTimeAsync(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // After 1000ms: second poll
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // After another 1000ms: third poll
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    poller.stop();
  });

  it('pauses and makes NO requests while tab is hidden', async () => {
    const mockFetch = vi.fn().mockResolvedValue('100.5');
    isVisibleMock = false;

    const poller = new BalancePoller(mockFetch, {
      baseIntervalMs: 1000,
      maxIntervalMs: 8000,
      checkVisibility: () => isVisibleMock,
    });

    poller.start();
    // Advance timers while hidden
    await vi.advanceTimersByTimeAsync(0);
    expect(mockFetch).toHaveBeenCalledTimes(0);

    await vi.advanceTimersByTimeAsync(5000);
    // Still 0 requests while hidden
    expect(mockFetch).toHaveBeenCalledTimes(0);

    // Tab becomes visible again
    isVisibleMock = true;
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);

    // Should immediately poll once visible
    expect(mockFetch).toHaveBeenCalledTimes(1);

    poller.stop();
  });

  it('applies exponential backoff on consecutive fetch failures', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Horizon 500 error'));
    const base = 1000;
    const max = 8000;

    const poller = new BalancePoller(mockFetch, {
      baseIntervalMs: base,
      maxIntervalMs: max,
      checkVisibility: () => isVisibleMock,
    });

    poller.start();
    // Initial request fails
    await vi.advanceTimersByTimeAsync(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(poller.getFailureCount()).toBe(1);

    // With 1 failure, next delay is 1000 * 2^1 = 2000ms
    // Advance 1000ms: should NOT have polled yet
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Advance remaining 1000ms (total 2000ms): second poll executes and fails
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(poller.getFailureCount()).toBe(2);

    // With 2 failures, next delay is 1000 * 2^2 = 4000ms
    // Advance 3000ms: no poll yet
    await vi.advanceTimersByTimeAsync(3000);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Advance 1000ms (total 4000ms): third poll executes and fails
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(poller.getFailureCount()).toBe(3);

    // With 3 failures, next delay is 1000 * 2^3 = 8000ms (capped to max)
    await vi.advanceTimersByTimeAsync(7999);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(1);
    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(poller.getFailureCount()).toBe(4);

    poller.stop();
  });

  it('resets backoff to base interval upon successful fetch recovery', async () => {
    let shouldFail = true;
    const mockFetch = vi.fn().mockImplementation(async () => {
      if (shouldFail) {
        throw new Error('Network error');
      }
      return '50.00';
    });

    const poller = new BalancePoller(mockFetch, {
      baseIntervalMs: 1000,
      maxIntervalMs: 8000,
      checkVisibility: () => isVisibleMock,
    });

    poller.start();
    // Attempt 1: fails -> delay 2000ms
    await vi.advanceTimersByTimeAsync(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(poller.getFailureCount()).toBe(1);

    // Advance 2000ms -> Attempt 2
    shouldFail = false; // Recover!
    await vi.advanceTimersByTimeAsync(2000);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(poller.getFailureCount()).toBe(0);

    // Next poll should be back to base interval of 1000ms!
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    poller.stop();
  });
});

