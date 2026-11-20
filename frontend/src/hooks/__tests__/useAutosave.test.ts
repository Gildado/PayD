import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAutosave } from '../useAutosave';

vi.mock('../../utils/localStorage', () => {
  return {
    LocalStorageHelper: vi.fn(function () {
      return {
        get: vi.fn().mockReturnValue(null),
        set: vi.fn(),
        remove: vi.fn(),
      };
    }),
  };
});

import { LocalStorageHelper } from '../../utils/localStorage';

describe('useAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with saving=false, no error, no lastSaved', () => {
    const { result } = renderHook(() => useAutosave('key', { name: 'test' }));
    expect(result.current.saving).toBe(false);
    expect(result.current.saveError).toBeNull();
    expect(result.current.lastSaved).toBeNull();
  });

  it('sets saving=true while debounce is pending and false after successful write', async () => {
    const { result, rerender } = renderHook(({ data }) => useAutosave('key', data, 500), {
      initialProps: { data: { name: 'a' } },
    });

    // First cycle is skipped
    rerender({ data: { name: 'b' } });

    expect(result.current.saving).toBe(true);
    expect(result.current.saveError).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.saving).toBe(false);
    expect(result.current.saveError).toBeNull();
    expect(result.current.lastSaved).toBeInstanceOf(Date);
  });

  it('sets saveError and clears saving when localStorage write throws', async () => {
    const mockInstance = {
      get: vi.fn().mockReturnValue(null),
      set: vi.fn().mockImplementation(() => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      }),
      remove: vi.fn(),
    };
    vi.mocked(LocalStorageHelper)
      .mockImplementationOnce(function () {
        return mockInstance as never;
      })
      .mockImplementationOnce(function () {
        return mockInstance as never;
      });

    const { result, rerender } = renderHook(({ data }) => useAutosave('key', data, 300), {
      initialProps: { data: { name: 'a' } },
    });

    rerender({ data: { name: 'b' } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.saving).toBe(false);
    expect(result.current.saveError).not.toBeNull();
    expect(result.current.saveError).toMatch(/could not be saved/i);
    expect(result.current.lastSaved).toBeNull();
  });

  it('clears saveError when clearSavedData is called', async () => {
    const mockInstance = {
      get: vi.fn().mockReturnValue(null),
      set: vi.fn().mockImplementation(() => {
        throw new Error('Storage unavailable');
      }),
      remove: vi.fn(),
    };
    vi.mocked(LocalStorageHelper)
      .mockImplementationOnce(function () {
        return mockInstance as never;
      })
      .mockImplementationOnce(function () {
        return mockInstance as never;
      });

    const { result, rerender } = renderHook(({ data }) => useAutosave('key', data, 100), {
      initialProps: { data: { v: 1 } },
    });

    rerender({ data: { v: 2 } });

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.saveError).not.toBeNull();

    act(() => {
      result.current.clearSavedData();
    });

    expect(result.current.saveError).toBeNull();
  });

  it('debounces: cancels pending save when data changes again before delay', async () => {
    const mockSet = vi.fn();
    const mockInstance = {
      get: vi.fn().mockReturnValue(null),
      set: mockSet,
      remove: vi.fn(),
    };
    vi.mocked(LocalStorageHelper)
      .mockImplementationOnce(function () {
        return mockInstance as never;
      })
      .mockImplementationOnce(function () {
        return mockInstance as never;
      });

    const { rerender } = renderHook(({ data }) => useAutosave('key', data, 500), {
      initialProps: { data: 'a' },
    });

    rerender({ data: 'b' });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    rerender({ data: 'c' });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Only one write should have happened (for 'c')
    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  it('allows retrying a failed save via retrySave', async () => {
    let shouldFail = true;
    const mockSet = vi.fn().mockImplementation(() => {
      if (shouldFail) {
        throw new Error('QuotaExceeded');
      }
    });

    const mockInstance = {
      get: vi.fn().mockReturnValue(null),
      set: mockSet,
      remove: vi.fn(),
    };

    vi.mocked(LocalStorageHelper)
      .mockImplementationOnce(function () {
        return mockInstance as never;
      })
      .mockImplementationOnce(function () {
        return mockInstance as never;
      });

    const { result, rerender } = renderHook(({ data }) => useAutosave('key', data, 100), {
      initialProps: { data: { step: 1 } },
    });

    rerender({ data: { step: 2 } });
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.saveError).not.toBeNull();
    expect(result.current.lastSaved).toBeNull();

    // Now storage recovers and retry is triggered
    shouldFail = false;
    act(() => {
      result.current.retrySave();
    });

    expect(result.current.saveError).toBeNull();
    expect(result.current.lastSaved).toBeInstanceOf(Date);
    expect(mockSet).toHaveBeenCalledTimes(2);
  });

  it('queues writes while offline and flushes on reconnect', async () => {
    const mockSet = vi.fn();
    const mockInstance = {
      get: vi.fn().mockReturnValue(null),
      set: mockSet,
      remove: vi.fn(),
    };

    vi.mocked(LocalStorageHelper)
      .mockImplementationOnce(function () {
        return mockInstance as never;
      })
      .mockImplementationOnce(function () {
        return mockInstance as never;
      });

    // Mock navigator.onLine as false (offline)
    const onLineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    const { result, rerender } = renderHook(({ data }) => useAutosave('key', data, 100), {
      initialProps: { data: { draft: 'initial' } },
    });

    rerender({ data: { draft: 'offline-edit' } });
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // Write should be queued, not executed yet while offline
    expect(mockSet).not.toHaveBeenCalled();
    expect(result.current.isOffline).toBe(true);

    // Reconnect event fired
    onLineSpy.mockReturnValue(true);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    // Queued writes flush immediately on reconnect
    expect(mockSet).toHaveBeenCalledWith({ draft: 'offline-edit' });
    expect(result.current.isOffline).toBe(false);
    expect(result.current.lastSaved).toBeInstanceOf(Date);

    onLineSpy.mockRestore();
  });
});
