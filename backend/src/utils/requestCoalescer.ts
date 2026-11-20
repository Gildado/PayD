/**
 * Request coalescer (in-flight de-duplication).
 *
 * While a fetch for `key` is pending, every further call with the same key
 * receives the same promise instead of starting a new fetch. The entry is
 * removed as soon as the shared promise settles, so this is NOT a cache:
 * later calls always hit the underlying source again.
 *
 * Used by BalanceService so that concurrent Horizon `loadAccount` calls for the
 * same account share a single network round-trip (issue #1806).
 */
export class RequestCoalescer<K, V> {
  private readonly inFlight = new Map<K, Promise<V>>();

  /**
   * Run `fn` for `key`, or join the pending run for that key if one exists.
   */
  run(key: K, fn: () => Promise<V>): Promise<V> {
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      try {
        return await fn();
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }

  /** Number of distinct keys currently in flight. */
  get pendingCount(): number {
    return this.inFlight.size;
  }
}
