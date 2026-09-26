import { EventEmitter } from 'events';
import {
  _resetLifecycleForTests,
  getInFlightRequests,
  inFlightRequestMiddleware,
  isShuttingDown,
  setShuttingDown,
  waitForInFlightRequests,
} from '../lifecycle.js';

describe('lifecycle utilities', () => {
  beforeEach(() => {
    _resetLifecycleForTests();
  });

  it('tracks shutdown state', () => {
    expect(isShuttingDown()).toBe(false);

    setShuttingDown(true);

    expect(isShuttingDown()).toBe(true);
  });

  it('tracks in-flight requests and resolves when they drain', async () => {
    const res = new EventEmitter() as any;
    res.writableEnded = false;

    inFlightRequestMiddleware({} as any, res, () => undefined);

    expect(getInFlightRequests()).toBe(1);

    const waitForDrain = waitForInFlightRequests(1000);
    res.writableEnded = true;
    res.emit('finish');

    await expect(waitForDrain).resolves.toBe(true);
    expect(getInFlightRequests()).toBe(0);
  });

  it('returns false when in-flight requests exceed the drain timeout', async () => {
    const res = new EventEmitter() as any;
    res.writableEnded = false;

    inFlightRequestMiddleware({} as any, res, () => undefined);
    expect(getInFlightRequests()).toBe(1);

    await expect(waitForInFlightRequests(5)).resolves.toBe(false);
  });
});
