import { useEffect, useRef } from 'react';

export interface UseFocusTrapOptions {
  /** Whether the overlay/modal is open */
  isOpen: boolean;
  /** Callback invoked when Escape key is pressed */
  onClose?: () => void;
  /** Optional element ref to focus when opening (defaults to first focusable element) */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Whether Escape key should trigger onClose (default: true) */
  enableEscape?: boolean;
  /** Delay in milliseconds before setting initial focus (e.g. for animations, default: 0) */
  focusDelayMs?: number;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Hook for full keyboard navigation and focus trapping inside modals and overlays.
 *
 * Provides:
 * - Tab and Shift+Tab wrapping within the container.
 * - Escape key dismissal.
 * - Initial focus management (focuses first focusable or custom ref).
 * - Automatic focus restoration to the previously active element on close.
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  containerRef: React.RefObject<T | null>,
  options: UseFocusTrapOptions
) {
  const {
    isOpen,
    onClose,
    initialFocusRef,
    enableEscape = true,
    focusDelayMs = 0,
  } = options;

  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Save current active element to restore on close
    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;

    const setInitialFocus = () => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (containerRef.current) {
        const focusable = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusable.length > 0) {
          focusable[0].focus();
        } else {
          containerRef.current.focus();
        }
      }
    };

    let timer: ReturnType<typeof setTimeout> | null = null;
    if (focusDelayMs > 0) {
      timer = setTimeout(setInitialFocus, focusDelayMs);
    } else {
      setInitialFocus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (enableEscape && event.key === 'Escape' && onClose) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'Tab' && containerRef.current) {
        const focusable = Array.from(
          containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null || el === document.activeElement || el.tabIndex >= 0);

        if (focusable.length === 0) {
          event.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey) {
          if (
            document.activeElement === first ||
            document.activeElement === containerRef.current ||
            !containerRef.current.contains(document.activeElement)
          ) {
            event.preventDefault();
            last.focus();
          }
        } else {
          if (
            document.activeElement === last ||
            !containerRef.current.contains(document.activeElement)
          ) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      if (
        previouslyFocusedElementRef.current &&
        typeof previouslyFocusedElementRef.current.focus === 'function'
      ) {
        previouslyFocusedElementRef.current.focus();
        previouslyFocusedElementRef.current = null;
      }
    };
  }, [isOpen, onClose, initialFocusRef, enableEscape, focusDelayMs, containerRef]);
}
