import { render, screen, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDeferredMount } from '../useDeferredMount';

interface ObserverInstance {
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

const instances: ObserverInstance[] = [];

function Harness({ rootMargin }: { rootMargin?: string }) {
  const { ref, visible } = useDeferredMount(rootMargin);
  return <div ref={ref} data-testid="target" data-visible={visible} />;
}

function isVisible() {
  return screen.getByTestId('target').getAttribute('data-visible') === 'true';
}

function installObserver() {
  instances.length = 0;
  class MockIntersectionObserver {
    callback: IntersectionObserverCallback;
    options?: IntersectionObserverInit;
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
    takeRecords = vi.fn(() => []);

    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.callback = callback;
      this.options = options;
      instances.push(this as unknown as ObserverInstance);
    }
  }
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
}

function intersect(index = 0, isIntersecting = true) {
  const instance = instances[index];
  if (!instance) throw new Error('No IntersectionObserver was constructed');
  act(() => {
    instance.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      instance as unknown as IntersectionObserver
    );
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useDeferredMount', () => {
  it('stays hidden until the observed element is near the viewport', () => {
    installObserver();
    render(<Harness rootMargin="300px" />);

    expect(isVisible()).toBe(false);
    expect(instances).toHaveLength(1);
    expect(instances[0]?.observe).toHaveBeenCalledTimes(1);
    expect(instances[0]?.options).toEqual({ rootMargin: '300px' });

    intersect(0, false);
    expect(isVisible()).toBe(false);

    intersect(0, true);
    expect(isVisible()).toBe(true);
    expect(instances[0]?.disconnect).toHaveBeenCalled();
  });

  it('mounts immediately when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<Harness />);
    expect(isVisible()).toBe(true);
  });

  it('does not create another observer once visible', () => {
    installObserver();
    const { rerender } = render(<Harness />);
    intersect();
    expect(isVisible()).toBe(true);
    rerender(<Harness />);
    expect(instances).toHaveLength(1);
  });
});
