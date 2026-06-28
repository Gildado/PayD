import React, { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Copy, CheckCircle2 } from 'lucide-react';
import type { ContractErrorDetail } from '../utils/contractErrorParser';
import { useNotification } from '../hooks/useNotification';
import styles from './ContractErrorPanel.module.css';

interface Props {
  /** The parsed error detail to display */
  error: ContractErrorDetail | null;
  /** Optional title for the panel */
  title?: string;
  /** Optional callback to clear the error */
  onClear?: () => void;
}

export const ContractErrorPanel: React.FC<Props> = ({
  error,
  title = 'Contract Execution Error',
  onClear,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const { notifySuccess, notifyError } = useNotification();

  if (!error) return null;

  const handleCopyXdr = async () => {
    if (!error.rawXdr) return;
    try {
      await navigator.clipboard.writeText(error.rawXdr);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      notifySuccess('Copied to clipboard', 'Raw XDR copied successfully.');
    } catch (e) {
      console.error('Failed to copy XDR:', e);
      notifyError('Copy failed', 'Could not write to clipboard.');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header} onClick={() => setIsOpen(!isOpen)}>
        <div className={styles.titleArea}>
          <AlertCircle className={styles.errorIcon} />
          <span className={styles.title}>{title}</span>
        </div>
        <div className={styles.headerActions}>
          {onClear && (
            <button
              className={styles.clearBtn}
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
            >
              Dismiss
            </button>
          )}
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {isOpen && (
        <div className={styles.content}>
          <div className={styles.errorGrid}>
            <div className={styles.label}>Error Code</div>
            <div className={styles.valueCode}>{error.code}</div>

            <div className={styles.label}>Description</div>
            <div className={styles.value}>{error.message}</div>

            <div className={styles.label}>Suggested Action</div>
            <div className={styles.valueHighlight}>{error.suggestedAction}</div>
          </div>

          {error.rawXdr && (
            <div className={styles.xdrSection}>
              <div className={styles.xdrHeader}>
                <span className={styles.xdrLabel}>Raw XDR Result</span>
                <button
                  className={styles.copyBtn}
                  onClick={() => {
                    void handleCopyXdr();
                  }}
                  title="Copy XDR to clipboard"
                >
                  {isCopied ? (
                    <CheckCircle2 size={14} className={styles.successIcon} />
                  ) : (
                    <Copy size={14} />
                  )}
                  {isCopied ? 'Copied!' : 'Copy XDR'}
                </button>
              </div>
              <div className={styles.xdrValue}>{error.rawXdr}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContractErrorPanel;
