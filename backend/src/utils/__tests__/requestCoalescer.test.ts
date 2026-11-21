import { jest, describe, it, expect } from '@jest/globals';
import { RequestCoalescer } from '../requestCoalescer.js';
import { mapWithConcurrency } from '../concurrencyPool.js';

const deferred = <T>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('RequestCoalescer', () => {
  it('shares one in-flight run among concurrent calls with the same key', async () => {
    const coalescer = new RequestCoalescer<string, number>();
    const gate = deferred<number>();
    const fn = jest.fn(() => gate.promise);

    const a = coalescer.run('acct', fn);
    const b = coalescer.run('acct', fn);
    const c = coalescer.run('acct', fn);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(coalescer.pendingCount).toBe(1);

    gate.resolve(42);
    await expect(Promise.all([a, b, c])).resolves.toEqual([42, 42, 42]);
  });

  it('does not coalesce different keys', async () => {
    const coalescer = new RequestCoalescer<string, string>();
    const fn = jest.fn(async () => 'ok');

    await Promise.all([coalescer.run('a', fn), coalescer.run('b', fn)]);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('is not a cache: a call after settlement triggers a new run', async () => {
    const coalescer = new RequestCoalescer<string, number>();
    let n = 0;
    const fn = jest.fn(async () => ++n);

    expect(await coalescer.run('k', fn)).toBe(1);
    expect(coalescer.pendingCount).toBe(0);
    expect(await coalescer.run('k', fn)).toBe(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('propagates rejection to every waiter and clears the entry', async () => {
    const coalescer = new RequestCoalescer<string, number>();
    const gate = deferred<number>();
    const fn = jest.fn(() => gate.promise);

    const a = coalescer.run('k', fn);
    const b = coalescer.run('k', fn);
    gate.reject(new Error('horizon down'));

    await expect(a).rejects.toThrow('horizon down');
    await expect(b).rejects.toThrow('horizon down');
    expect(coalescer.pendingCount).toBe(0);
  });
});

describe('mapWithConcurrency', () => {
  it('never exceeds the configured concurrency', async () => {
    let active = 0;
    let peak = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);

    await mapWithConcurrency(items, 3, async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return null;
    });

    expect(peak).toBe(3);
  });

  it('preserves input order in results', async () => {
    const results = await mapWithConcurrency([30, 10, 20], 2, async (ms, i) => {
      await new Promise((r) => setTimeout(r, ms));
      return i;
    });

    expect(results.map((r) => (r.status === 'fulfilled' ? r.value : null))).toEqual([0, 1, 2]);
  });

  it('settles failures individually without aborting the batch', async () => {
    const results = await mapWithConcurrency([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error('bad');
      return n * 10;
    });

    expect(results[0]).toEqual({ status: 'fulfilled', value: 10 });
    expect(results[1].status).toBe('rejected');
    expect(results[2]).toEqual({ status: 'fulfilled', value: 30 });
  });

  it('handles an empty input', async () => {
    await expect(mapWithConcurrency([], 4, async () => 1)).resolves.toEqual([]);
  });

  it('rejects non-positive or non-integer limits', async () => {
    await expect(mapWithConcurrency([1], 0, async () => 1)).rejects.toThrow(RangeError);
    await expect(mapWithConcurrency([1], 1.5, async () => 1)).rejects.toThrow(RangeError);
  });
});
