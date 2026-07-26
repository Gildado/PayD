import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface KeyboardShortcutsState {
  /** Whether global keyboard shortcuts are active. Persisted per-browser. */
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

export const useKeyboardShortcutsStore = create<KeyboardShortcutsState>()(
  persist(
    (set) => ({
      enabled: true,
      setEnabled: (enabled) => set({ enabled }),
    }),
    { name: 'payd-keyboard-shortcuts' }
  )
);
