/**
 * AccessibleDatePicker Component
 *
 * Provides a fully accessible date picker with keyboard navigation support.
 *
 * Features:
 * - Single date or date range (`mode="range"`, #1871)
 * - Calendar exposed as an ARIA grid with a roving tab stop
 * - Full keyboard navigation: arrows (day/week), Home/End (start/end of week),
 *   Page Up/Down (month), Shift+Page Up/Down (year), Enter/Space, Escape
 * - Month/year quick jump from the calendar heading
 * - ARIA labels and descriptions for screen readers
 * - Visual focus indicators for keyboard users
 * - Mobile-friendly with native date input fallback
 * - Polished transition/interaction states (#1383)
 *
 * Issue #118: Improve Date Picker Accessibility
 */

import React, { useRef, useState, useEffect, useCallback, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, X, Calendar } from 'lucide-react';
import {
  DateRange,
  addDays,
  addMonths,
  applyRangeSelection,
  clampDate,
  dateInMonth,
  endOfWeek,
  formatDate,
  getDaysInMonth,
  getFirstDayOfMonth,
  isOutOfBounds,
  isValidDate,
  isWithin,
  parseDate,
  startOfWeek,
} from './datePickerUtils';

export type { DateRange } from './datePickerUtils';

interface BaseDatePickerProps {
  /** Unique identifier for the input (range mode: `${id}-start` / `${id}-end`) */
  id: string;

  /** Label text displayed above the input */
  label: string;

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

interface SingleDatePickerProps extends BaseDatePickerProps {
  mode?: 'single';

  /** Current selected date (YYYY-MM-DD format) */
  value: string;

  /** Callback when date is changed */
  onChange: (value: string) => void;
}

interface RangeDatePickerProps extends BaseDatePickerProps {
  mode: 'range';

  /** Current range; either end may be '' while it is being chosen */
  value: DateRange;

  /** Callback when either end of the range changes */
  onChange: (value: DateRange) => void;
}

export type AccessibleDatePickerProps = SingleDatePickerProps | RangeDatePickerProps;

type RangeEnd = 'start' | 'end';

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

/** Years offered by the quick jump when no min/max date bounds them. */
const YEARS_BACK = 100;
const YEARS_AHEAD = 10;

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
 *
 * <AccessibleDatePicker
 *   mode="range"
 *   id="export-period"
 *   label="Export period"
 *   value={{ start, end }}
 *   onChange={({ start, end }) => setPeriod(start, end)}
 * />
 * ```
 */
export const AccessibleDatePicker: React.FC<AccessibleDatePickerProps> = (props) => {
  const {
    id,
    label,
    minDate,
    maxDate,
    helpText,
    required = false,
    disabled = false,
    error,
    placeholder = 'YYYY-MM-DD',
    fieldSize = 'md',
  } = props;
  const isRange = props.mode === 'range';
  const singleValue = props.mode === 'range' ? '' : props.value;
  const range: DateRange = props.mode === 'range' ? props.value : { start: '', end: '' };

  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(new Date().getMonth());
  const [displayYear, setDisplayYear] = useState(new Date().getFullYear());
  const [focusedDate, setFocusedDate] = useState(() => formatDate(new Date()));
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [quickJumpOpen, setQuickJumpOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  // Which range input opened the calendar, so focus can go back to it.
  const [activeEnd, setActiveEnd] = useState<RangeEnd>('start');

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // Bumped whenever the focused day should take DOM focus (keyboard open/move).
  const [gridFocusRequest, setGridFocusRequest] = useState(0);
  const handledFocusRequestRef = useRef(0);
  // Programmatic focus back to an input must not re-open the calendar.
  const suppressOpenRef = useRef(false);

  const reactId = useId();
  const monthLabelId = `${id}-month-label${reactId}`;
  const quickJumpId = `${id}-quick-jump${reactId}`;

  const focusInput = useCallback((which: RangeEnd = 'start') => {
    suppressOpenRef.current = true;
    (which === 'end' ? endInputRef : inputRef).current?.focus();
    suppressOpenRef.current = false;
  }, []);

  const showMonthOf = useCallback((dateStr: string) => {
    const date = parseDate(dateStr)!;
    setDisplayMonth(date.getMonth());
    setDisplayYear(date.getFullYear());
  }, []);

  /** Moves the roving focus (and the visible month) to `dateStr`, kept inside min/max. */
  const moveFocusTo = useCallback(
    (dateStr: string, focusGrid: boolean) => {
      const next = clampDate(dateStr, minDate, maxDate);
      setFocusedDate(next);
      showMonthOf(next);
      if (focusGrid) setGridFocusRequest((n) => n + 1);
    },
    [minDate, maxDate, showMonthOf]
  );

  const openCalendar = useCallback(
    (fromKeyboard: boolean, which: RangeEnd = 'start') => {
      if (disabled) return;
      setActiveEnd(which);
      const preferred =
        props.mode === 'range'
          ? (which === 'end' ? props.value.end || props.value.start : props.value.start) ||
            props.value.end
          : props.value;
      const anchor = isValidDate(preferred) ? preferred : formatDate(new Date());
      moveFocusTo(anchor, fromKeyboard);
      setIsOpen(true);
    },
    [disabled, props.mode, props.value, moveFocusTo]
  );

  const closeCalendar = useCallback(() => {
    setIsOpen(false);
    setQuickJumpOpen(false);
    setHoverDate(null);
  }, []);

  // Put DOM focus on the roving cell after keyboard navigation re-renders the grid.
  useEffect(() => {
    if (!isOpen || gridFocusRequest === handledFocusRequestRef.current) return;
    handledFocusRequestRef.current = gridFocusRequest;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focusedDate}"]`)?.focus();
  }, [isOpen, focusedDate, gridFocusRequest]);

  // Handle clicks outside the inputs and calendar
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeCalendar();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closeCalendar]);

  const handlePrevMonth = () => {
    const first = dateInMonth(displayYear, displayMonth - 1, 1);
    showMonthOf(first);
    setFocusedDate(
      clampDate(
        dateInMonth(displayYear, displayMonth - 1, parseDate(focusedDate)!.getDate()),
        minDate,
        maxDate
      )
    );
  };

  const handleNextMonth = () => {
    const first = dateInMonth(displayYear, displayMonth + 1, 1);
    showMonthOf(first);
    setFocusedDate(
      clampDate(
        dateInMonth(displayYear, displayMonth + 1, parseDate(focusedDate)!.getDate()),
        minDate,
        maxDate
      )
    );
  };

  const jumpTo = (year: number, month: number) => {
    const day = parseDate(focusedDate)!.getDate();
    setDisplayYear(year);
    setDisplayMonth(month);
    setFocusedDate(clampDate(dateInMonth(year, month, day), minDate, maxDate));
  };

  const formatForSpeech = (dateStr: string) =>
    parseDate(dateStr)!.toLocaleDateString(i18n.language, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const handleDateSelect = (dateStr: string) => {
    if (isOutOfBounds(dateStr, minDate, maxDate)) return;

    if (props.mode !== 'range') {
      props.onChange(dateStr);
      closeCalendar();
      focusInput();
      return;
    }

    const next = applyRangeSelection(props.value, dateStr);
    props.onChange(next);
    setFocusedDate(dateStr);
    if (next.start && next.end) {
      setAnnouncement(
        t('datePicker.rangeSelected', {
          start: formatForSpeech(next.start),
          end: formatForSpeech(next.end),
        })
      );
      closeCalendar();
      focusInput('end');
    } else {
      setAnnouncement(t('datePicker.rangeStartSelected', { date: formatForSpeech(dateStr) }));
    }
  };

  const handleSingleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (props.mode === 'range') return;
    const newValue = e.target.value;

    if (isValidDate(newValue)) {
      props.onChange(newValue);
      showMonthOf(newValue);
      setFocusedDate(clampDate(newValue, minDate, maxDate));
    } else if (newValue === '') {
      props.onChange('');
    }
  };

  // Typing keeps the range ordered by clearing the other end when it would be crossed.
  const handleRangeInputChange = (which: RangeEnd) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (props.mode !== 'range') return;
    const newValue = e.target.value;
    const { start, end } = props.value;

    if (newValue === '') {
      props.onChange(which === 'start' ? { start: '', end } : { start, end: '' });
      return;
    }
    if (!isValidDate(newValue)) return;

    props.onChange(
      which === 'start'
        ? { start: newValue, end: end && end < newValue ? '' : end }
        : { start: start && start > newValue ? '' : start, end: newValue }
    );
    showMonthOf(newValue);
    setFocusedDate(clampDate(newValue, minDate, maxDate));
  };

  const handleInputKeyDown = (which: RangeEnd) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Enter':
      case 'ArrowDown':
        e.preventDefault();
        openCalendar(true, which);
        break;
      case 'Escape':
        e.preventDefault();
        closeCalendar();
        break;
      case 'Tab':
        // Allow natural tab behavior but close calendar
        closeCalendar();
        break;
    }
  };

  const handleInputFocus = (which: RangeEnd) => () => {
    if (suppressOpenRef.current || disabled) return;
    openCalendar(false, which);
  };

  const handleCalendarKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeCalendar();
      focusInput(activeEnd);
    }
  };

  const handleGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let next: string | null = null;
    switch (e.key) {
      case 'ArrowLeft':
        next = addDays(focusedDate, -1);
        break;
      case 'ArrowRight':
        next = addDays(focusedDate, 1);
        break;
      case 'ArrowUp':
        next = addDays(focusedDate, -7);
        break;
      case 'ArrowDown':
        next = addDays(focusedDate, 7);
        break;
      case 'Home':
        next = startOfWeek(focusedDate);
        break;
      case 'End':
        next = endOfWeek(focusedDate);
        break;
      case 'PageUp':
        next = addMonths(focusedDate, e.shiftKey ? -12 : -1);
        break;
      case 'PageDown':
        next = addMonths(focusedDate, e.shiftKey ? 12 : 1);
        break;
      default:
        return;
    }
    e.preventDefault();
    moveFocusTo(next, true);
  };

  const handleClearDate = () => {
    if (props.mode === 'range') props.onChange({ start: '', end: '' });
    else props.onChange('');
    focusInput();
  };

  // ── Calendar model ───────────────────────────────────────────────────────
  const daysInMonth = getDaysInMonth(displayYear, displayMonth);
  const firstDayOfMonth = getFirstDayOfMonth(displayYear, displayMonth);
  const cells: Array<{ key: string; date: string | null }> = [
    ...Array.from({ length: firstDayOfMonth }, (_, i) => ({ key: `lead-${i}`, date: null })),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const date = formatDate(new Date(displayYear, displayMonth, i + 1));
      return { key: date, date };
    }),
  ];
  for (let i = 0; cells.length % 7 !== 0; i++) cells.push({ key: `trail-${i}`, date: null });
  const weeks: Array<typeof cells> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  // The one day reachable with Tab: the focused day if visible and enabled,
  // otherwise the first enabled day of the month.
  const visibleEnabled = cells
    .map((c) => c.date)
    .filter((d): d is string => d !== null && !isOutOfBounds(d, minDate, maxDate));
  const tabbableDate = visibleEnabled.includes(focusedDate)
    ? focusedDate
    : (visibleEnabled[0] ?? null);

  // While the end of a range is being chosen, preview up to the hovered/focused day.
  const pickingEnd = isRange && Boolean(range.start) !== Boolean(range.end);
  const rangeAnchor = range.start || range.end;
  const previewTarget = pickingEnd ? (hoverDate ?? focusedDate) : null;
  const [previewStart, previewEnd] =
    previewTarget && rangeAnchor
      ? previewTarget < rangeAnchor
        ? [previewTarget, rangeAnchor]
        : [rangeAnchor, previewTarget]
      : ['', ''];

  const today = formatDate(new Date());

  const monthName = new Date(displayYear, displayMonth, 1).toLocaleDateString(i18n.language, {
    month: 'long',
    year: 'numeric',
  });

  const currentYear = new Date().getFullYear();
  const minYear = Math.min(
    minDate ? parseDate(minDate)!.getFullYear() : currentYear - YEARS_BACK,
    displayYear
  );
  const maxYear = Math.max(
    maxDate ? parseDate(maxDate)!.getFullYear() : currentYear + YEARS_AHEAD,
    displayYear
  );
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);
  const monthOptions = Array.from({ length: 12 }, (_, m) => ({
    value: m,
    label: new Date(displayYear, m, 1).toLocaleDateString(i18n.language, { month: 'long' }),
    // A month is unavailable when every day of it is outside min/max.
    disabled: Boolean(
      (minDate && dateInMonth(displayYear, m, 31) < minDate) ||
        (maxDate && dateInMonth(displayYear, m, 1) > maxDate)
    ),
  }));
  const prevDisabled = Boolean(minDate && dateInMonth(displayYear, displayMonth - 1, 31) < minDate);
  const nextDisabled = Boolean(maxDate && dateInMonth(displayYear, displayMonth + 1, 1) > maxDate);

  const sizeClasses = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-3 py-2 text-base',
    lg: 'px-4 py-3 text-lg',
  };

  const helpTextId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy =
    [helpText ? helpTextId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined;

  const hasValue = isRange ? Boolean(range.start || range.end) : Boolean(singleValue);

  const inputClassName = `
    flex-1 min-w-0 border-none outline-none bg-transparent
    ${sizeClasses[fieldSize]}
    text-[var(--text)]
    disabled:opacity-50 disabled:cursor-not-allowed
    focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-0
  `;

  const requiredMarker = required && (
    <span className="text-[var(--danger)] ml-1" aria-label={t('common.required')}>
      *
    </span>
  );

  const inputRow = (
    <div className="flex items-center gap-2 border border-[var(--border)] rounded-lg bg-[var(--surface)]">
      <Calendar
        className="w-5 h-5 ml-2 shrink-0 text-[var(--muted)] pointer-events-none"
        aria-hidden="true"
      />

      {props.mode === 'range' ? (
        <>
          <input
            ref={inputRef}
            id={`${id}-start`}
            type="date"
            value={range.start}
            min={minDate}
            max={range.end || maxDate}
            onChange={handleRangeInputChange('start')}
            onKeyDown={handleInputKeyDown('start')}
            onFocus={handleInputFocus('start')}
            disabled={disabled}
            placeholder={placeholder}
            className={inputClassName}
            aria-describedby={describedBy}
            aria-label={t('datePicker.rangeStart')}
            aria-required={required}
            aria-disabled={disabled}
            aria-expanded={isOpen && activeEnd === 'start'}
            aria-haspopup="dialog"
          />
          <span className="text-[var(--muted)]" aria-hidden="true">
            –
          </span>
          <input
            ref={endInputRef}
            id={`${id}-end`}
            type="date"
            value={range.end}
            min={range.start || minDate}
            max={maxDate}
            onChange={handleRangeInputChange('end')}
            onKeyDown={handleInputKeyDown('end')}
            onFocus={handleInputFocus('end')}
            disabled={disabled}
            placeholder={placeholder}
            className={inputClassName}
            aria-describedby={describedBy}
            aria-label={t('datePicker.rangeEnd')}
            aria-required={required}
            aria-disabled={disabled}
            aria-expanded={isOpen && activeEnd === 'end'}
            aria-haspopup="dialog"
          />
        </>
      ) : (
        <input
          ref={inputRef}
          id={id}
          type="date"
          value={singleValue}
          min={minDate}
          max={maxDate}
          onChange={handleSingleInputChange}
          onKeyDown={handleInputKeyDown('start')}
          onFocus={handleInputFocus('start')}
          disabled={disabled}
          placeholder={placeholder}
          className={inputClassName}
          aria-describedby={describedBy}
          aria-label={label}
          aria-required={required}
          aria-disabled={disabled}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
        />
      )}

      {/* Clear Button */}
      {hasValue && !disabled && (
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
  );

  const calendar = isOpen && !disabled && (
    <div
      className="absolute top-full left-0 mt-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg p-4 z-50 w-72"
      role="dialog"
      aria-label={t('datePicker.selectDate')}
      onKeyDown={handleCalendarKeyDown}
    >
      {/* Month/Year Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={handlePrevMonth}
          disabled={prevDisabled}
          className="p-1 hover:bg-[var(--surface-hi)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label={t('datePicker.previousMonth')}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Opens the month/year quick jump */}
        <button
          type="button"
          id={monthLabelId}
          onClick={() => setQuickJumpOpen((o) => !o)}
          className="px-4 py-2 font-medium text-[var(--text)] hover:bg-[var(--surface-hi)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] rounded"
          aria-live="polite"
          aria-atomic="true"
          aria-expanded={quickJumpOpen}
          aria-controls={quickJumpOpen ? quickJumpId : undefined}
          title={t('datePicker.chooseMonthYear')}
        >
          {monthName}
        </button>

        <button
          type="button"
          onClick={handleNextMonth}
          disabled={nextDisabled}
          className="p-1 hover:bg-[var(--surface-hi)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label={t('datePicker.nextMonth')}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Month/Year Quick Jump */}
      {quickJumpOpen && (
        <div
          id={quickJumpId}
          role="group"
          aria-label={t('datePicker.chooseMonthYear')}
          className="flex gap-2 mb-3"
        >
          <select
            value={displayMonth}
            onChange={(e) => jumpTo(displayYear, Number(e.target.value))}
            aria-label={t('datePicker.month')}
            className="flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value} disabled={m.disabled}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            value={displayYear}
            onChange={(e) => jumpTo(Number(e.target.value), displayMonth)}
            aria-label={t('datePicker.year')}
            className="w-24 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Calendar grid */}
      <div
        ref={gridRef}
        role="grid"
        aria-labelledby={monthLabelId}
        aria-multiselectable={isRange || undefined}
        onKeyDown={handleGridKeyDown}
        onMouseLeave={() => setHoverDate(null)}
      >
        <div role="row" className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAY_KEYS.map((dayKey) => (
            <div
              key={dayKey}
              role="columnheader"
              className="text-center text-xs font-semibold text-[var(--muted)] py-2"
            >
              {t(dayKey)}
            </div>
          ))}
        </div>

        {weeks.map((week) => (
          <div role="row" key={week[0].key} className="grid grid-cols-7 gap-1 mb-1">
            {week.map(({ key, date: dateStr }) => {
              if (!dateStr) {
                return <div role="gridcell" key={key} aria-hidden="true" />;
              }

              const day = parseDate(dateStr)!.getDate();
              const isDisabledDate = isOutOfBounds(dateStr, minDate, maxDate);
              const isRangeStart = isRange && dateStr === range.start;
              const isRangeEnd = isRange && dateStr === range.end;
              const isSelected = isRange
                ? range.start && range.end
                  ? isWithin(dateStr, range.start, range.end)
                  : isRangeStart || isRangeEnd
                : dateStr === singleValue;
              const isEndpoint = isRange ? isRangeStart || isRangeEnd : isSelected;
              const isPreview =
                !isSelected && Boolean(previewStart) && isWithin(dateStr, previewStart, previewEnd);

              let dayLabel = `${day} ${monthName}`;
              if (isRangeStart) dayLabel += `, ${t('datePicker.rangeStartMarker')}`;
              if (isRangeEnd) dayLabel += `, ${t('datePicker.rangeEndMarker')}`;

              return (
                <div role="gridcell" key={dateStr} aria-selected={isSelected}>
                  <button
                    type="button"
                    data-date={dateStr}
                    tabIndex={dateStr === tabbableDate ? 0 : -1}
                    onClick={() => handleDateSelect(dateStr)}
                    onMouseEnter={() => pickingEnd && setHoverDate(dateStr)}
                    onFocus={() => setFocusedDate(dateStr)}
                    disabled={isDisabledDate}
                    className={`
                      w-full p-2 rounded text-sm font-medium
                      transition-colors duration-200
                      focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
                      ${
                        isDisabledDate
                          ? 'text-[var(--muted)] cursor-not-allowed'
                          : 'text-[var(--text)] hover:bg-[var(--surface-hi)]'
                      }
                      ${isEndpoint ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90' : ''}
                      ${isSelected && !isEndpoint ? 'bg-[var(--accent)]/20' : ''}
                      ${isPreview ? 'bg-[var(--accent)]/10' : ''}
                      ${dateStr === today && !isEndpoint ? 'underline underline-offset-4' : ''}
                    `}
                    aria-label={dayLabel}
                    aria-current={dateStr === today ? 'date' : undefined}
                  >
                    {day}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Keyboard Navigation Help */}
      <div className="mt-4 pt-4 border-t border-[var(--border)]">
        <p className="text-xs text-[var(--muted)]">
          <span className="font-semibold">{t('datePicker.keyboardLabel')}</span>{' '}
          {t('datePicker.keyboardInstructions')}
        </p>
      </div>
    </div>
  );

  return (
    <div className="w-full">
      {isRange ? (
        // A range is two inputs, so the visible label names the group.
        <fieldset className="border-0 p-0 m-0 min-w-0">
          <legend className="block text-sm font-medium text-[var(--text)] mb-1">
            {label}
            {requiredMarker}
          </legend>
          <div ref={containerRef} className="relative">
            {inputRow}
            {calendar}
          </div>
        </fieldset>
      ) : (
        <>
          {/* Label */}
          <label htmlFor={id} className="block text-sm font-medium text-[var(--text)] mb-1">
            {label}
            {requiredMarker}
          </label>

          <div ref={containerRef} className="relative">
            {inputRow}
            {calendar}
          </div>
        </>
      )}

      {/* Range progress for screen readers */}
      {isRange && (
        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
      )}

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
