import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKeyboardShortcutsStore } from '../stores/keyboardShortcutsStore';

export interface KeyboardShortcut {
  id: string;
  /** The letter key, combined with Cmd (Mac) / Ctrl (Windows/Linux). */
  key: string;
  description: string;
  action: () => void;
}

/**
 * Letters that most browsers reserve for their own chrome (new tab/window,
 * close tab, quit) and will not deliver to page JS as a cancelable event, or
 * will re-trigger their own behavior even after `preventDefault()`. Used to
 * warn during development if a shortcut is added on one of these keys,
 * rather than silently failing to work for some users.
 */
const BROWSER_RESERVED_KEYS = new Set(['t', 'w', 'q']);

export function getReservedConflicts(shortcuts: KeyboardShortcut[]): KeyboardShortcut[] {
  return shortcuts.filter((shortcut) => BROWSER_RESERVED_KEYS.has(shortcut.key.toLowerCase()));
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/**
 * Global keyboard shortcut system for common payroll operations.
 *
 * - `?` toggles the shortcuts help overlay (always active, even when the
 *   shortcut preference below is off, since it's how a user discovers/
 *   re-enables them).
 * - Cmd/Ctrl + a letter triggers the matching shortcut's action.
 * - Disabled entirely while focus is inside a text input/textarea/select/
 *   contenteditable element, so typing "n", "e", etc. never misfires.
 * - The enabled/disabled preference is persisted in localStorage via
 *   `useKeyboardShortcutsStore`.
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const enabled = useKeyboardShortcutsStore((state) => state.enabled);
  const setEnabled = useKeyboardShortcutsStore((state) => state.setEnabled);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const shortcuts = useMemo<KeyboardShortcut[]>(
    () => [
      {
        id: 'search',
        key: 'k',
        description: 'Search documentation',
        action: () => {
          void navigate('/help');
        },
      },
      {
        id: 'new-payroll',
        key: 'n',
        description: 'Create a new payroll',
        action: () => {
          void navigate('/payroll');
        },
      },
      {
        id: 'employee-list',
        key: 'e',
        description: 'View employee list',
        action: () => {
          void navigate('/employee');
        },
      },
      {
        id: 'history',
        key: 'h',
        description: 'View transaction history',
        action: () => {
          void navigate('/transactions');
        },
      },
    ],
    [navigate]
  );

  const openHelp = useCallback(() => setIsHelpOpen(true), []);
  const closeHelp = useCallback(() => setIsHelpOpen(false), []);
  const toggleHelp = useCallback(() => setIsHelpOpen((open) => !open), []);

  useEffect(() => {
    if (import.meta.env.DEV) {
      const conflicts = getReservedConflicts(shortcuts);
      if (conflicts.length > 0) {
        console.warn(
          '[useKeyboardShortcuts] These shortcuts use browser-reserved keys and may not work consistently:',
          conflicts.map((s) => s.id).join(', ')
        );
      }
    }
  }, [shortcuts]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;

      if (event.key === '?' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        toggleHelp();
        return;
      }

      if (event.key === 'Escape' && isHelpOpen) {
        closeHelp();
        return;
      }

      if (!enabled) return;

      const modifierPressed = event.metaKey || event.ctrlKey;
      if (!modifierPressed || event.altKey || event.shiftKey) return;

      const shortcut = shortcuts.find(
        (candidate) => candidate.key === event.key.toLowerCase()
      );
      if (shortcut) {
        event.preventDefault();
        shortcut.action();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, isHelpOpen, shortcuts, toggleHelp, closeHelp]);

  return {
    shortcuts,
    enabled,
    setEnabled,
    isHelpOpen,
    openHelp,
    closeHelp,
    toggleHelp,
  };
}
