import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, X } from 'lucide-react';
import styles from './EmployeeRemovalConfirmModal.module.css';

/**
 * Props for EmployeeRemovalConfirmModal component
 */
export interface EmployeeRemovalConfirmModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Employee name being removed */
  employeeName: string;
  /** Employee ID being removed */
  employeeId: string;
  /** Callback when user confirms removal */
  onConfirm: (employeeId: string) => void;
  /** Callback when user cancels removal */
  onCancel: () => void;
  /** Optional custom label for remove button */
  confirmLabel?: string;
  /** Optional custom label for cancel button */
  cancelLabel?: string;
  /** Optional CSS class to apply to backdrop */
  className?: string;
  /** Whether removal is in progress (shows loading state) */
  isLoading?: boolean;
}

/**
 * EmployeeRemovalConfirmModal Component
 *
 * A fully accessible confirmation dialog for removing employees from the system.
 * Includes keyboard navigation, focus management, ARIA attributes, and responsive design.
 *
 * @example
 * ```tsx
 * const [showRemovalModal, setShowRemovalModal] = useState(false);
 * const [selectedEmployee, setSelectedEmployee] = useState<{ id: string; name: string } | null>(null);
 *
 * const handleRemoveEmployee = (employeeId: string) => {
 *   const employee = employees.find(e => e.id === employeeId);
 *   setSelectedEmployee(employee || null);
 *   setShowRemovalModal(true);
 * };
 *
 * const handleConfirmRemoval = (employeeId: string) => {
 *   // API call or state update
 *   updateEmployees((prev) => prev.filter((e) => e.id !== employeeId));
 *   setShowRemovalModal(false);
 * };
 *
 * return (
 *   <>
 *     <EmployeeRemovalConfirmModal
 *       isOpen={showRemovalModal}
 *       employeeName={selectedEmployee?.name || ''}
 *       employeeId={selectedEmployee?.id || ''}
 *       onConfirm={handleConfirmRemoval}
 *       onCancel={() => setShowRemovalModal(false)}
 *     />
 *   </>
 * );
 * ```
 */
export const EmployeeRemovalConfirmModal: React.FC<EmployeeRemovalConfirmModalProps> = ({
  isOpen,
  employeeName,
  employeeId,
  onConfirm,
  onCancel,
  confirmLabel,
  cancelLabel,
  className,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Translations with fallbacks
  const defaultConfirmLabel = confirmLabel || t('common.remove', 'Remove');
  const defaultCancelLabel = cancelLabel || t('common.cancel', 'Cancel');
  const title = t('employeeRemoval.title', 'Remove Employee');
  const subtitle = t('employeeRemoval.subtitle', 'Are you sure you want to remove this employee?');
  const warningText = t(
    'employeeRemoval.warning',
    'This action cannot be undone. All employee records and associated data will be deleted.'
  );
  const confirmationText = t('employeeRemoval.confirmation', 'Confirm by clicking Remove below.');

  // Handle keyboard events
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Escape key closes modal
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }

      // Tab key for focus management
      if (event.key === 'Tab') {
        const dialog = modalRef.current;
        if (!dialog) return;

        const focusableElements = dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        // Shift+Tab from first element moves to last
        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
        // Tab from last element moves to first
        else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Focus on cancel button when modal opens
    if (cancelButtonRef.current) {
      setTimeout(() => cancelButtonRef.current?.focus(), 100);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  // Handle confirm action
  const handleConfirmClick = () => {
    onConfirm(employeeId);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`${styles.backdrop} ${className || ''}`}
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-removal-title"
        aria-describedby="employee-removal-description"
      >
        {/* Close Button */}
        <button
          onClick={onCancel}
          className={styles.closeButton}
          aria-label={t('common.close', 'Close')}
          disabled={isLoading}
        >
          <X size={20} />
        </button>

        {/* Modal Content */}
        <div className={styles.content}>
          {/* Header with Warning Icon */}
          <div className={styles.header}>
            <div className={styles.iconWrapper}>
              <AlertTriangle size={32} />
            </div>
            <h2 id="employee-removal-title" className={styles.title}>
              {title}
            </h2>
          </div>

          {/* Employee Name Highlight */}
          <div className={styles.employeeSection}>
            <p className={styles.label}>
              {t('employeeRemoval.employeeToRemove', 'Employee to be removed:')}
            </p>
            <p className={styles.employeeName}>{employeeName}</p>
          </div>

          {/* Description and Warning */}
          <div id="employee-removal-description" className={styles.description}>
            <p className={styles.subtitle}>{subtitle}</p>

            {/* Warning Box */}
            <div className={styles.warningBox} role="alert">
              <div className={styles.warningIcon}>
                <AlertTriangle size={20} />
              </div>
              <div className={styles.warningContent}>
                <p className={styles.warningTitle}>
                  {t('employeeRemoval.warningTitle', 'Permanent Action')}
                </p>
                <p className={styles.warningText}>{warningText}</p>
              </div>
            </div>

            <p className={styles.confirmationText}>{confirmationText}</p>
          </div>

          {/* Action Buttons */}
          <div className={styles.actions}>
            <button
              ref={cancelButtonRef}
              onClick={onCancel}
              className={styles.cancelButton}
              disabled={isLoading}
              aria-label={t('common.cancel', 'Cancel removal')}
            >
              {defaultCancelLabel}
            </button>
            <button
              onClick={handleConfirmClick}
              className={styles.removeButton}
              disabled={isLoading}
              aria-label={t('employeeRemoval.confirmRemove', 'Confirm removal of {name}', {
                name: employeeName,
              })}
            >
              {isLoading && <span className={styles.loadingSpinner} aria-hidden="true" />}
              {defaultConfirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

EmployeeRemovalConfirmModal.displayName = 'EmployeeRemovalConfirmModal';
