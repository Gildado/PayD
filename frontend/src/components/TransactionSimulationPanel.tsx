/**
 * TransactionSimulationPanel
 *
 * Displays the results of a transaction simulation. Surfaces clear success
 * states or detailed diagnostic errors when a transaction is predicted to fail.
 *
 * Issue: https://github.com/Gildado/PayD/issues/41
 */

import React from "react";
import type { SimulationResult } from "../services/transactionSimulation";
import styles from "./TransactionSimulationPanel.module.css";

interface Props {
  /** The simulation result to display */
  result: SimulationResult | null;
  /** Whether simulation is currently in progress */
  isSimulating: boolean;
  /** Whether an error occurred during the simulation process itself */
  processError?: string | null;
  /** Optional callback to reset/clear simulation state */
  onReset?: () => void;
}

// ── Icons ──────────────────────────────────────────────────────────────────

const SuccessIcon = () => (
  <svg
    width="18"
    height="18"
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

const WarningIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const ErrorIcon = () => (
  <svg
    width="18"
    height="18"
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

// ── Main Component ──────────────────────────────────────────────────────────

export const TransactionSimulationPanel: React.FC<Props> = ({
  result,
  isSimulating,
  processError,
  onReset,
}) => {
  // ---- Loading State ----
  if (isSimulating) {
    return (
      <div className={`${styles.container} ${styles.shimmer}`}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span className={styles.loadingText}>Simulating Transaction...</span>
        </div>
      </div>
    );
  }

  // ---- Process/Network Error ----
  if (processError) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.title}>Pre-Submission Simulation</span>
        </div>
        <div className={`${styles.statusBox} ${styles.statusError}`}>
          <div className={styles.statusIcon}>
            <WarningIcon />
          </div>
          <div className={styles.statusContent}>
            <h4 className={styles.statusTitle}>Simulation unavailable</h4>
            <p className={styles.statusDesc}>{processError}</p>
          </div>
        </div>
        {onReset && (
          <button onClick={onReset} className={styles.resetBtn}>
            Clear Results
          </button>
        )}
      </div>
    );
  }

  // ---- No Result State ----
  if (!result) return null;

  // ---- Format result severity class ----
  const getStatusClass = () => {
    switch (result.severity) {
      case "success":
        return styles.statusSuccess;
      case "warning":
        return styles.statusWarning;
      case "error":
        return styles.statusError;
      default:
        return "";
    }
  };

  const getIcon = () => {
    switch (result.severity) {
      case "success":
        return <SuccessIcon />;
      case "warning":
        return <WarningIcon />;
      case "error":
        return <ErrorIcon />;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Pre-Submission Simulation</span>
        <span className={styles.timestamp}>
          {result.simulatedAt.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </div>

      <div className={`${styles.statusBox} ${getStatusClass()}`}>
        <div className={styles.statusIcon}>{getIcon()}</div>
        <div className={styles.statusContent}>
          <h4 className={styles.statusTitle}>{result.title}</h4>
          <p className={styles.statusDesc}>{result.description}</p>
        </div>
      </div>

      {/* Error Diagnostics List */}
      {result.errors.length > 0 && (
        <div className={styles.errorList}>
          {result.errors.map((err, idx) => (
            <div key={`${err.code}-${idx}`} className={styles.errorItem}>
              <span className={styles.errorCode}>{err.code}</span>
              <span className={styles.errorLabel}>{err.message}</span>
              {err.operationIndex !== undefined && (
                <span className={styles.opIndex}>
                  OP#{err.operationIndex + 1}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {onReset && (
        <button onClick={onReset} className={styles.resetBtn}>
          {result.success ? "Clear Simulation" : "Reset and Retry"}
        </button>
      )}
    </div>
  );
};

export default TransactionSimulationPanel;
