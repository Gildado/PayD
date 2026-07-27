import React, { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Copy, CheckCircle2 } from 'lucide-react';
import type { ContractErrorDetail } from '../utils/contractErrorParser';
import { useTranslation } from 'react-i18next';
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

export const ContractErrorPanel: React.FC<Props> = ({ error, title, onClear }) => {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('contractError.defaultTitle');
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
      notifySuccess(t('contractError.copiedToClipboard'), t('contractError.rawXdrCopied'));
    } catch (e) {
      console.error('Failed to copy XDR:', e);
      notifyError(t('contractError.copyFailed'), t('contractError.couldNotWriteClipboard'));
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header} onClick={() => setIsOpen(!isOpen)}>
        <div className={styles.titleArea}>
          <AlertCircle className={styles.errorIcon} />
          <span className={styles.title}>{resolvedTitle}</span>
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
              {t('common.dismiss')}
            </button>
          )}
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {isOpen && (
        <div className={styles.content}>
          <div className={styles.errorGrid}>
            <div className={styles.label}>{t('contractError.errorCode')}</div>
            <div className={styles.valueCode}>{error.code}</div>

            <div className={styles.label}>{t('contractError.description')}</div>
            <div className={styles.value}>{error.message}</div>

            <div className={styles.label}>{t('contractError.suggestedAction')}</div>
            <div className={styles.valueHighlight}>{error.suggestedAction}</div>
          </div>

          {error.rawXdr && (
            <div className={styles.xdrSection}>
              <div className={styles.xdrHeader}>
                <span className={styles.xdrLabel}>{t('contractError.rawXdrResult')}</span>
                <button
                  className={styles.copyBtn}
                  onClick={() => {
                    void handleCopyXdr();
                  }}
                  title={t('contractError.copyXdrToClipboard')}
                >
                  {isCopied ? (
                    <CheckCircle2 size={14} className={styles.successIcon} />
                  ) : (
                    <Copy size={14} />
                  )}
                  {isCopied ? t('contractError.copied') : t('contractError.copyXdr')}
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