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
});
