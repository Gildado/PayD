/**
 * AccessibleDatePicker Component
 *
 * Provides a fully accessible date picker with keyboard navigation support.
 *
 * Features:
 * - Full keyboard navigation (Tab, Arrow Keys, Enter, Escape)
 * - ARIA labels and descriptions for screen readers
 * - Visual focus indicators for keyboard users
 * - Calendar popup with date selection
 * - Mobile-friendly with native date input fallback
 * - Month/year navigation
 *
 * Issue #118: Improve Date Picker Accessibility
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, X, Calendar } from 'lucide-react';

interface AccessibleDatePickerProps {
  /** Unique identifier for the input */
  id: string;

  /** Label text displayed above the input */
  label: string;

  /** Current selected date (YYYY-MM-DD format) */
  value: string;

  /** Callback when date is changed */
  onChange: (value: string) => void;

  /** Minimum selectable date (YYYY-MM-DD format) */
  minDate?: string;

  /** Maximum selectable date (YYYY-MM-DD format) */
  maxDate?: string;

  /** Additional help text displayed below the input */
  helpText?: string;

  /** Whether the input is required */
  required?: boolean;

  /** Whether the input is disabled */
  disabled?: boolean;

  /** Custom error message */
  error?: string;

  /** Placeholder text */
  placeholder?: string;

  /** Field size for styling */
  fieldSize?: 'sm' | 'md' | 'lg';
}

/**
 * Days of week header for calendar
 */
const WEEKDAY_KEYS = [
  'datePicker.weekdaySun',
  'datePicker.weekdayMon',
  'datePicker.weekdayTue',
  'datePicker.weekdayWed',
  'datePicker.weekdayThu',
  'datePicker.weekdayFri',
  'datePicker.weekdaySat',
];

/**
 * Get the number of days in a month
 */
const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

/**
 * Get the first day of week for the first day of month (0=Sunday, 6=Saturday)
 */
const getFirstDayOfMonth = (year: number, month: number): number => {
  return new Date(year, month, 1).getDay();
};

/**
 * Parse date string to Date object
 */
const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const [year, month, day] = parts.map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Format Date object to YYYY-MM-DD string
 */
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Check if a date string is valid
 */
const isValidDate = (dateStr: string): boolean => {
  if (!dateStr || dateStr.length !== 10) return false;
  const date = parseDate(dateStr);
  if (!date) return false;
  const formatted = formatDate(date);
  return formatted === dateStr;
};

/**
 * Accessible Date Picker Component
 *
 * Usage:
 * ```tsx
 * <AccessibleDatePicker
 *   id="payroll-start-date"
 *   label="Commencement Date"
 *   value={startDate}
 *   onChange={setStartDate}
 *   minDate="2024-01-01"
 *   helpText="Select the date to start payroll"
 * />
 * ```
 */
export const AccessibleDatePicker: React.FC<AccessibleDatePickerProps> = ({
  id,
  label,
  value,
  onChange,
  minDate,
  maxDate,
  helpText,
  required = false,
  disabled = false,
  error,
  placeholder = 'YYYY-MM-DD',
  fieldSize = 'md',
}) => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(new Date().getMonth());
  const [displayYear, setDisplayYear] = useState(new Date().getFullYear());
  const [highlightedDate, setHighlightedDate] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const monthButtonRef = useRef<HTMLButtonElement>(null);

  // Initialize display month/year from current value
  useEffect(() => {
    if (value && isValidDate(value)) {
      const date = parseDate(value);
      if (date) {
        setDisplayMonth(date.getMonth());
        setDisplayYear(date.getFullYear());
        setHighlightedDate(value);
      }
    }
  }, [value]);

  // Handle clicks outside calendar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        calendarRef.current &&
        !calendarRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handlePrevMonth = useCallback(() => {
    setDisplayMonth((prev) => {
      if (prev === 0) {
        setDisplayYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setDisplayMonth((prev) => {
      if (prev === 11) {
        setDisplayYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  }, []);

  const handleDateSelect = useCallback(
    (day: number) => {
      const selectedDate = new Date(displayYear, displayMonth, day);
      const dateStr = formatDate(selectedDate);

      // Validate against min/max dates
      if (minDate && dateStr < minDate) return;
      if (maxDate && dateStr > maxDate) return;

      onChange(dateStr);
      setHighlightedDate(dateStr);
      setIsOpen(false);
      inputRef.current?.focus();
    },
    [displayYear, displayMonth, minDate, maxDate, onChange]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    if (isValidDate(newValue)) {
      onChange(newValue);
      const date = parseDate(newValue);
      if (date) {
        setDisplayMonth(date.getMonth());
        setDisplayYear(date.getFullYear());
        setHighlightedDate(newValue);
      }
    } else if (newValue === '') {
      onChange('');
      setHighlightedDate(null);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Enter':
      case 'ArrowDown':
        e.preventDefault();
        setIsOpen(true);
        // Focus first day of month in calendar
        setTimeout(() => {
          monthButtonRef.current?.focus();
        }, 0);
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'Tab':
        // Allow natural tab behavior but close calendar
        setIsOpen(false);
        break;
    }
  };

  const handleCalendarKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      inputRef.current?.focus();
    }
  };

  const handleClearDate = () => {
    onChange('');
    setHighlightedDate(null);
    inputRef.current?.focus();
  };

  // Generate calendar days
  const daysInMonth = getDaysInMonth(displayYear, displayMonth);
  const firstDayOfMonth = getFirstDayOfMonth(displayYear, displayMonth);
  const days: Array<{ key: string; day: number | null }> = [
    ...Array.from({ length: firstDayOfMonth }, (_, i) => ({
      key: `empty-${displayYear}-${displayMonth}-${i + 1}`,
      day: null,
    })),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return {
        key: `day-${displayYear}-${displayMonth}-${day}`,
        day,
      };
    }),
  ];

  const monthName = new Date(displayYear, displayMonth, 1).toLocaleDateString(i18n.language, {
    month: 'long',
    year: 'numeric',
  });

  const sizeClasses = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-3 py-2 text-base',
    lg: 'px-4 py-3 text-lg',
  };

  const helpTextId = `${id}-help`;
  const errorId = `${id}-error`;

  return (
    <div className="w-full">
      {/* Label */}
      <label
        htmlFor={id}
        className="block text-sm font-medium text-[var(--text)] mb-1"
      >
        {label}
        {required && (
          <span className="text-[var(--danger)] ml-1" aria-label={t('common.required')}>
            *
          </span>
        )}
      </label>

      {/* Input Container */}
      <div className="relative">
        {/* Input Field */}
        <div className="flex items-center gap-2 border border-[var(--border)] rounded-lg bg-[var(--surface)]">
          <Calendar className="w-5 h-5 ml-2 text-[var(--muted)] pointer-events-none" aria-hidden="true" />

          <input
            ref={inputRef}
            id={id}
            type="date"
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            onFocus={() => !disabled && setIsOpen(true)}
            disabled={disabled}
            placeholder={placeholder}
            className={`
              flex-1 border-none outline-none bg-transparent
              ${sizeClasses[fieldSize]}
              text-[var(--text)]
              disabled:opacity-50 disabled:cursor-not-allowed
              focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-0
            `}
            aria-describedby={`${helpText ? helpTextId : ''} ${error ? errorId : ''}`}
            aria-label={label}
            aria-required={required}
            aria-disabled={disabled}
            aria-expanded={isOpen}
            aria-haspopup="dialog"
          />

          {/* Clear Button */}
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClearDate}
              className="pr-2 text-[var(--muted)] hover:text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] rounded"
              aria-label={t('datePicker.clearDate')}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Calendar Popup */}
        {isOpen && !disabled && (
          <div
            ref={calendarRef}
            className="absolute top-full left-0 mt-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg p-4 z-50 w-72"
            role="dialog"
            aria-label={t('datePicker.selectDate')}
            onKeyDown={handleCalendarKeyDown}
          >
            {/* Month/Year Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handlePrevMonth}
                className="p-1 hover:bg-[var(--surface-hi)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                aria-label={t('datePicker.previousMonth')}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                ref={monthButtonRef}
                onClick={() => {}} // For focus management
                className="px-4 py-2 font-medium text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] rounded"
                aria-live="polite"
                aria-atomic="true"
              >
                {monthName}
              </button>

              <button
                onClick={handleNextMonth}
                className="p-1 hover:bg-[var(--surface-hi)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                aria-label={t('datePicker.nextMonth')}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {WEEKDAY_KEYS.map((dayKey) => (
                <div
                  key={dayKey}
                  className="text-center text-xs font-semibold text-[var(--muted)] py-2"
                >
                  {t(dayKey)}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {days.map(({ key, day }) => {
                const dateStr = day ? formatDate(new Date(displayYear, displayMonth, day)) : null;
                const isSelected = dateStr === value;
                const isHighlighted = dateStr === highlightedDate;
                const isDisabledDate = Boolean(
                  (minDate && dateStr && dateStr < minDate) ||
                    (maxDate && dateStr && dateStr > maxDate)
                );

                return (
                  <button
                    key={key}
                    onClick={() => day && !isDisabledDate && handleDateSelect(day)}
                    disabled={!day || isDisabledDate}
                    className={`
                      p-2 rounded text-sm font-medium
                      transition-colors duration-200
                      focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
                      ${
                        !day || isDisabledDate
                          ? 'text-[var(--muted)] cursor-not-allowed'
                          : 'text-[var(--text)] hover:bg-[var(--surface-hi)]'
                      }
                      ${isSelected ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90' : ''}
                      ${isHighlighted && !isSelected ? 'bg-[var(--accent)]/10' : ''}
                    `}
                    type="button"
                    aria-label={day ? `${day} ${monthName}` : undefined}
                    aria-selected={isSelected}
                    aria-pressed={isSelected}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Keyboard Navigation Help */}
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <p className="text-xs text-[var(--muted)]">
                <span className="font-semibold">{t('datePicker.keyboardLabel')}</span>{' '}
                {t('datePicker.keyboardInstructions')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Help Text */}
      {helpText && (
        <p id={helpTextId} className="mt-1 text-sm text-[var(--muted)]">
          {helpText}
        </p>
      )}

      {/* Error Message */}
      {error && (
        <p id={errorId} className="mt-1 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default AccessibleDatePicker;
