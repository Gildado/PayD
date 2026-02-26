/**
 * ContractErrorPanel
 *
 * Collapsible error panel that decodes and displays Soroban contract
 * invocation failures. Uses `parseContractError` to map known XDR result
 * codes to human-readable descriptions and suggested remediation steps.
 * Falls back to a raw XDR display with a copy button for unknown codes.
 *
 * Issue: https://github.com/Gildado/PayD/issues/82
 */

import React, { useState } from 'react';
import { parseContractError } from '../services/contractErrorParser';
import type { ContractErrorResult } from '../services/contractErrorParser';
import styles from './ContractErrorPanel.module.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  /**
   * The result XDR or Soroban error string from a failed contract invocation.
   * When null/undefined the panel renders nothing.
   */
  resultXdr: string | null | undefined;
  /** Optional callback fired when the user dismisses the panel */
  onDismiss?: () => void;
}

// ---------------------------------------------------------------------------
// Icons (inline SVG — no extra deps)
// ---------------------------------------------------------------------------

const ErrorCircleIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

const LightbulbIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="9" y1="18" x2="15" y2="18" />
    <line x1="10" y1="22" x2="14" y2="22" />
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
  </svg>
);

const CopyIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// ---------------------------------------------------------------------------
// Sub-component: CopyButton
// ---------------------------------------------------------------------------

interface CopyButtonProps {
  text: string;
}

const CopyButton: React.FC<CopyButtonProps> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — silently skip
    }
  };

  return (
    <button
      onClick={() => {
        void handleCopy();
      }}
      className={`${styles.copyBtn} ${copied ? styles.copyBtnCopied : ''}`}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? 'Copied!' : 'Copy XDR'}
    </button>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const ContractErrorPanel: React.FC<Props> = ({ resultXdr, onDismiss }) => {
  const [isOpen, setIsOpen] = useState(true);

  if (!resultXdr) return null;

  const parsed: ContractErrorResult = parseContractError(resultXdr);
  const { error } = parsed;

  return (
    <div className={styles.container} role="alert" aria-live="polite">
      {/* Collapsible header */}
      <div
        className={styles.header}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <span className={styles.headerIcon}>
          <ErrorCircleIcon />
        </span>
        <span className={styles.headerTitle}>Contract Invocation Failed</span>
        <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>
          <ChevronDownIcon />
        </span>
      </div>

      {/* Collapsible body */}
      {isOpen && (
        <div className={styles.body}>
          <div className={styles.errorCard}>
            {/* Error code badge */}
            <div className={styles.codeRow}>
              <span className={styles.codeLabel}>Error Code</span>
              <span className={styles.codeBadge}>{error.code}</span>
            </div>

            {/* Human-readable description */}
            <p className={styles.description}>{error.description}</p>

            {/* Suggested action */}
            <div className={styles.actionBox}>
              <span className={styles.actionIcon}>
                <LightbulbIcon />
              </span>
              <span className={styles.actionText}>{error.suggestedAction}</span>
            </div>

            {/* Raw XDR fallback for unknown errors */}
            {!parsed.known && error.rawXdr && (
              <div className={styles.rawXdrSection}>
                <span className={styles.rawXdrLabel}>Raw XDR</span>
                <div className={styles.rawXdrBox}>
                  <pre className={styles.rawXdrText}>{error.rawXdr}</pre>
                </div>
                <CopyButton text={error.rawXdr} />
              </div>
            )}
          </div>

          {onDismiss && (
            <button onClick={onDismiss} className={styles.dismissBtn}>
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ContractErrorPanel;
