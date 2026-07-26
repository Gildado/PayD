import React, { useEffect, useRef } from 'react';
import { X, Keyboard } from 'lucide-react';
import type { KeyboardShortcut } from '../hooks/useKeyboardShortcuts';
import { formatShortcutKey } from '../utils/keyboardShortcutFormat';
import styles from './KeyboardShortcutsHelp.module.css';

export interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  shortcuts: KeyboardShortcut[];
  enabled: boolean;
  onSetEnabled: (enabled: boolean) => void;
  onClose: () => void;
}

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  isOpen,
  shortcuts,
  enabled,
  onSetEnabled,
  onClose,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      modalRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <>
      <div
        className={styles.backdrop}
        onClick={handleBackdropClick}
        role="presentation"
        aria-hidden="true"
      />
      <div
        className={styles.modal}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-shortcuts-title"
        tabIndex={-1}
      >
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <Keyboard size={18} aria-hidden="true" />
            <h2 id="keyboard-shortcuts-title" className={styles.title}>
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <ul className={styles.list}>
          {shortcuts.map((shortcut) => (
            <li key={shortcut.id} className={styles.row}>
              <span className={styles.description}>{shortcut.description}</span>
              <kbd className={styles.kbd}>{formatShortcutKey(shortcut.key)}</kbd>
            </li>
          ))}
          <li className={styles.row}>
            <span className={styles.description}>Show this help</span>
            <kbd className={styles.kbd}>?</kbd>
          </li>
        </ul>

        <label className={styles.toggleRow}>
          <span>Enable keyboard shortcuts</span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onSetEnabled(event.target.checked)}
            aria-label="Enable keyboard shortcuts"
          />
        </label>
      </div>
    </>
  );
};

export default KeyboardShortcutsHelp;
