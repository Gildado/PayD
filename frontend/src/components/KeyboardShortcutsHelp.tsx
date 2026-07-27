import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
              {t('common.keyboardShortcuts')}
            </h2>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label={t('common.close')}
            title={t('common.close')}
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
            <span className={styles.description}>{t('common.showThisHelp')}</span>
            <kbd className={styles.kbd}>?</kbd>
          </li>
        </ul>

        <label className={styles.toggleRow}>
          <span>{t('common.enableKeyboardShortcuts')}</span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onSetEnabled(event.target.checked)}
            aria-label={t('common.enableKeyboardShortcuts')}
          />
        </label>
      </div>
    </>
  );
};

export default KeyboardShortcutsHelp;