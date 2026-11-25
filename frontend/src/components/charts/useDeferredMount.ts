import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export interface DeferredMount {
  /** Attach to the element that should be observed. */
  ref: RefObject<HTMLDivElement | null>;
  /** True once the element is near the viewport (or immediately when
   * IntersectionObserver is unavailable, e.g. in unit-test environments). */
  visible: boolean;
}

/**
 * Defers mounting expensive below-the-fold content until its container is
 * near the viewport. Uses a generous rootMargin so charts are ready by the
 * time the user scrolls to them, while keeping them out of the initial render.
 */
export function useDeferredMount(rootMargin = '200px'): DeferredMount {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;

    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  return { ref, visible };
}
