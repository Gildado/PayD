import { jest } from '@jest/globals';
import { timeDbQuery, dbQueryDuration } from '../metrics.js';

// ─── timeDbQuery ──────────────────────────────────────────────────────────────

describe('timeDbQuery', () => {
  it('returns the resolved value of the wrapped function', async () => {
    const result = await timeDbQuery('select', 'employees', async () => 42);
    expect(result).toBe(42);
  });

  it('re-throws errors raised by the wrapped function', async () => {
    const boom = new Error('DB down');
    await expect(
      timeDbQuery('insert', 'payroll', async () => {
        throw boom;
      }),
    ).rejects.toThrow('DB down');
  });

  it('records an observation in dbQueryDuration on success', async () => {
    const observeSpy = jest.spyOn(dbQueryDuration, 'startTimer');
    await timeDbQuery('select', 'users', async () => 'data');
    expect(observeSpy).toHaveBeenCalledWith({ operation: 'select', table: 'users' });
    observeSpy.mockRestore();
  });

  it('still stops the timer when the wrapped function throws', async () => {
    const endSpy = jest.fn();
    jest
      .spyOn(dbQueryDuration, 'startTimer')
      .mockReturnValueOnce(endSpy as unknown as ReturnType<typeof dbQueryDuration.startTimer>);

    await expect(
      timeDbQuery('delete', 'employees', async () => {
        throw new Error('oops');
      }),
    ).rejects.toThrow('oops');

    expect(endSpy).toHaveBeenCalledTimes(1);

    jest.restoreAllMocks();
  });
});
