import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useReducedMotion } from '../hooks/useReducedMotion';
import {
  getBarAnimationProps,
  getLineAnimationProps,
  getAreaAnimationProps,
  getPieAnimationProps,
} from '../utils/chartAnimation';

describe('Reduced motion support', () => {
  let listeners: ((e: MediaQueryListEvent) => void)[] = [];
  let matches = false;

  beforeEach(() => {
    listeners = [];
    matches = false;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((_type: string, listener: (e: MediaQueryListEvent) => void) => {
        listeners.push(listener);
      }),
      removeEventListener: vi.fn((_type: string, listener: (e: MediaQueryListEvent) => void) => {
        listeners = listeners.filter((l) => l !== listener);
      }),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to false when prefers-reduced-motion does not match', () => {
    matches = false;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('detects when prefers-reduced-motion is true', () => {
    matches = true;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('reacts dynamically to media query change events', () => {
    matches = false;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      listeners.forEach((listener) =>
        listener({
          matches: true,
          media: '(prefers-reduced-motion: reduce)',
        } as MediaQueryListEvent)
      );
    });

    expect(result.current).toBe(true);
  });

  it('disables chart animations when reduced motion is requested', () => {
    expect(getBarAnimationProps(true)).toEqual({ isAnimationActive: false });
    expect(getLineAnimationProps(true)).toEqual({ isAnimationActive: false });
    expect(getAreaAnimationProps(true)).toEqual({ isAnimationActive: false });
    expect(getPieAnimationProps(true)).toEqual({ isAnimationActive: false });
  });

  it('enables chart animations when motion is safe', () => {
    expect(getBarAnimationProps(false).isAnimationActive).toBe(true);
    expect(getLineAnimationProps(false).isAnimationActive).toBe(true);
    expect(getAreaAnimationProps(false).isAnimationActive).toBe(true);
    expect(getPieAnimationProps(false).isAnimationActive).toBe(true);
  });
});
