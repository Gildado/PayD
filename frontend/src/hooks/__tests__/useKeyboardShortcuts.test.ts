import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getReservedConflicts, useKeyboardShortcuts } from '../useKeyboardShortcuts';
import { useKeyboardShortcutsStore } from '../../stores/keyboardShortcutsStore';

const navigateMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

function dispatchKeyDown(init: KeyboardEventInit, target: EventTarget = window) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    useKeyboardShortcutsStore.setState({ enabled: true });
  });

  afterEach(() => {
    useKeyboardShortcutsStore.setState({ enabled: true });
  });

  it('exposes the four documented shortcuts', () => {
    const { result } = renderHook(() => useKeyboardShortcuts());
    const ids = result.current.shortcuts.map((s) => s.id).sort();
    expect(ids).toEqual(['employee-list', 'history', 'new-payroll', 'search']);
  });

  it('navigates to /payroll on Cmd/Ctrl+N', () => {
    renderHook(() => useKeyboardShortcuts());
    act(() => {
      dispatchKeyDown({ key: 'n', ctrlKey: true });
    });
    expect(navigateMock).toHaveBeenCalledWith('/payroll');
  });

  it('navigates to /employee on Cmd/Ctrl+E', () => {
    renderHook(() => useKeyboardShortcuts());
    act(() => {
      dispatchKeyDown({ key: 'e', metaKey: true });
    });
    expect(navigateMock).toHaveBeenCalledWith('/employee');
  });

  it('navigates to /transactions on Cmd/Ctrl+H', () => {
    renderHook(() => useKeyboardShortcuts());
    act(() => {
      dispatchKeyDown({ key: 'h', ctrlKey: true });
    });
    expect(navigateMock).toHaveBeenCalledWith('/transactions');
  });

  it('navigates to /help on Cmd/Ctrl+K', () => {
    renderHook(() => useKeyboardShortcuts());
    act(() => {
      dispatchKeyDown({ key: 'k', metaKey: true });
    });
    expect(navigateMock).toHaveBeenCalledWith('/help');
  });

  it('does nothing without a modifier key', () => {
    renderHook(() => useKeyboardShortcuts());
    act(() => {
      dispatchKeyDown({ key: 'n' });
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('ignores shortcuts when typing in a text input', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      dispatchKeyDown({ key: 'n', ctrlKey: true }, input);
    });

    expect(navigateMock).not.toHaveBeenCalled();
    input.remove();
  });

  it('does not navigate when shortcuts are disabled via preference', () => {
    act(() => {
      useKeyboardShortcutsStore.setState({ enabled: false });
    });
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      dispatchKeyDown({ key: 'n', ctrlKey: true });
    });

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('toggles the help overlay with "?" even when shortcuts are disabled', () => {
    act(() => {
      useKeyboardShortcutsStore.setState({ enabled: false });
    });
    const { result } = renderHook(() => useKeyboardShortcuts());
    expect(result.current.isHelpOpen).toBe(false);

    act(() => {
      dispatchKeyDown({ key: '?' });
    });

    expect(result.current.isHelpOpen).toBe(true);
  });

  it('closes the help overlay on Escape', () => {
    const { result } = renderHook(() => useKeyboardShortcuts());
    act(() => result.current.openHelp());
    expect(result.current.isHelpOpen).toBe(true);

    act(() => {
      dispatchKeyDown({ key: 'Escape' });
    });

    expect(result.current.isHelpOpen).toBe(false);
  });
});

describe('getReservedConflicts', () => {
  it('flags shortcuts on browser-reserved letters', () => {
    const conflicts = getReservedConflicts([
      { id: 'ok', key: 'e', description: '', action: () => {} },
      { id: 'reserved', key: 't', description: '', action: () => {} },
    ]);
    expect(conflicts.map((c) => c.id)).toEqual(['reserved']);
  });

  it('returns an empty array when nothing conflicts', () => {
    const conflicts = getReservedConflicts([
      { id: 'search', key: 'k', description: '', action: () => {} },
    ]);
    expect(conflicts).toEqual([]);
  });
});
