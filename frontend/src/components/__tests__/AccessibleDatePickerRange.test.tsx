/**
 * AccessibleDatePicker: range mode, ARIA grid keyboard navigation and the
 * month/year quick jump (#1871).
 */
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AccessibleDatePicker, DateRange } from '../AccessibleDatePicker';
import { addMonths, applyRangeSelection, isValidDate } from '../datePickerUtils';

/** The grid cell holding the given day of the visible month. */
const cell = (day: number, monthYear = 'March 2024') =>
  screen
    .getByRole('button', { name: new RegExp(`^${day} ${monthYear}`) })
    .closest('[role="gridcell"]');

const dayButton = (day: number, monthYear = 'March 2024') =>
  screen.getByRole('button', { name: new RegExp(`^${day} ${monthYear}`) });

function RangeHarness({
  initial = { start: '', end: '' },
  onChange = vi.fn(),
  minDate,
  maxDate,
}: {
  initial?: DateRange;
  onChange?: (r: DateRange) => void;
  minDate?: string;
  maxDate?: string;
}) {
  const [range, setRange] = useState(initial);
  return (
    <AccessibleDatePicker
      mode="range"
      id="period"
      label="Export period"
      value={range}
      minDate={minDate}
      maxDate={maxDate}
      onChange={(next) => {
        onChange(next);
        setRange(next);
      }}
    />
  );
}

function SingleHarness({
  initial,
  minDate,
  maxDate,
}: {
  initial: string;
  minDate?: string;
  maxDate?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <AccessibleDatePicker
      id="pay-date"
      label="Pay date"
      value={value}
      onChange={setValue}
      minDate={minDate}
      maxDate={maxDate}
    />
  );
}

describe('datePickerUtils', () => {
  it('starts, completes and restarts a range', () => {
    expect(applyRangeSelection({ start: '', end: '' }, '2024-03-10')).toEqual({
      start: '2024-03-10',
      end: '',
    });
    expect(applyRangeSelection({ start: '2024-03-10', end: '' }, '2024-03-15')).toEqual({
      start: '2024-03-10',
      end: '2024-03-15',
    });
    expect(applyRangeSelection({ start: '2024-03-10', end: '2024-03-15' }, '2024-04-01')).toEqual({
      start: '2024-04-01',
      end: '',
    });
  });

  it('orders the range when the second pick is before the first', () => {
    expect(applyRangeSelection({ start: '2024-03-10', end: '' }, '2024-03-02')).toEqual({
      start: '2024-03-02',
      end: '2024-03-10',
    });
    // Only an end typed: the pick completes it on the correct side.
    expect(applyRangeSelection({ start: '', end: '2024-03-10' }, '2024-03-20')).toEqual({
      start: '2024-03-10',
      end: '2024-03-20',
    });
  });

  it('allows a one-day range', () => {
    expect(applyRangeSelection({ start: '2024-03-10', end: '' }, '2024-03-10')).toEqual({
      start: '2024-03-10',
      end: '2024-03-10',
    });
  });

  it('clamps month moves to the last day of shorter months', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2023-01-31', 1)).toBe('2023-02-28');
    expect(addMonths('2024-03-31', -1)).toBe('2024-02-29');
    expect(addMonths('2024-02-29', 12)).toBe('2025-02-28');
  });

  it('rejects impossible dates', () => {
    expect(isValidDate('2024-02-29')).toBe(true);
    expect(isValidDate('2023-02-29')).toBe(false);
    expect(isValidDate('2024-13-01')).toBe(false);
  });
});

describe('AccessibleDatePicker - range mode', () => {
  it('renders a labelled group with start and end inputs', () => {
    render(<RangeHarness />);
    const group = screen.getByRole('group', { name: 'Export period' });
    expect(within(group).getByLabelText('Start date')).toHaveAttribute('id', 'period-start');
    expect(within(group).getByLabelText('End date')).toHaveAttribute('id', 'period-end');
  });

  it('selects a range with two clicks and closes on the second', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RangeHarness initial={{ start: '2024-03-01', end: '2024-03-02' }} onChange={onChange} />
    );

    await user.click(screen.getByLabelText('Start date'));
    await user.click(dayButton(10));
    expect(onChange).toHaveBeenLastCalledWith({ start: '2024-03-10', end: '' });
    // Still open to pick the end, and the status announces what happens next.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Start date March 10, 2024 selected/);

    await user.click(dayButton(15));
    expect(onChange).toHaveBeenLastCalledWith({ start: '2024-03-10', end: '2024-03-15' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('End date')).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Selected March 10, 2024 to March 15, 2024'
    );
  });

  it('swaps the ends when the second pick is before the first', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RangeHarness initial={{ start: '2024-03-20', end: '' }} onChange={onChange} />);

    await user.click(screen.getByLabelText('Start date'));
    await user.click(dayButton(5));
    expect(onChange).toHaveBeenLastCalledWith({ start: '2024-03-05', end: '2024-03-20' });
  });

  it('marks every day of the range selected, inclusive of both boundaries', async () => {
    const user = userEvent.setup();
    render(<RangeHarness initial={{ start: '2024-03-10', end: '2024-03-15' }} />);

    await user.click(screen.getByLabelText('Start date'));
    const grid = screen.getByRole('grid');
    expect(grid).toHaveAttribute('aria-multiselectable', 'true');

    for (const day of [10, 11, 12, 13, 14, 15]) {
      expect(cell(day)).toHaveAttribute('aria-selected', 'true');
    }
    expect(cell(9)).toHaveAttribute('aria-selected', 'false');
    expect(cell(16)).toHaveAttribute('aria-selected', 'false');
    expect(dayButton(10)).toHaveAccessibleName('10 March 2024, start of range');
    expect(dayButton(15)).toHaveAccessibleName('15 March 2024, end of range');
  });

  it('can be selected entirely from the keyboard, across months', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RangeHarness initial={{ start: '2024-03-30', end: '' }} onChange={onChange} />);

    await user.tab(); // start input
    await user.keyboard('{Enter}');
    expect(dayButton(30)).toHaveFocus();

    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(dayButton(2, 'April 2024')).toHaveFocus();
    expect(screen.getByRole('grid')).toHaveAccessibleName('April 2024');

    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith({ start: '2024-03-30', end: '2024-04-02' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('previews the range while the end is being chosen', async () => {
    const user = userEvent.setup();
    render(<RangeHarness initial={{ start: '2024-03-10', end: '' }} />);

    await user.click(screen.getByLabelText('Start date'));
    await user.hover(dayButton(13));
    expect(dayButton(12).className).toContain('bg-[var(--accent)]/10');
    expect(dayButton(14).className).not.toContain('bg-[var(--accent)]/10');
  });

  it('does not let a range cross minDate or maxDate', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RangeHarness
        initial={{ start: '2024-03-10', end: '' }}
        minDate="2024-03-05"
        maxDate="2024-03-12"
        onChange={onChange}
      />
    );

    await user.click(screen.getByLabelText('Start date'));
    expect(dayButton(4)).toBeDisabled();
    expect(dayButton(13)).toBeDisabled();
    expect(dayButton(5)).toBeEnabled();
    expect(dayButton(12)).toBeEnabled();

    // Keyboard focus stops at the boundary instead of landing on a disabled day.
    await user.keyboard('{Enter}');
    expect(dayButton(10)).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(dayButton(12)).toHaveFocus();
    await user.keyboard('{PageDown}');
    expect(dayButton(12)).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith({ start: '2024-03-10', end: '2024-03-12' });
  });

  it('typing a start after the end clears the end', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RangeHarness initial={{ start: '2024-03-10', end: '2024-03-15' }} onChange={onChange} />
    );

    const start = screen.getByLabelText('Start date');
    await user.clear(start);
    await user.type(start, '2024-03-20');
    expect(onChange).toHaveBeenLastCalledWith({ start: '2024-03-20', end: '' });
  });

  it('typing an end before the start clears the start', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RangeHarness initial={{ start: '2024-03-10', end: '2024-03-15' }} onChange={onChange} />
    );

    const end = screen.getByLabelText('End date');
    await user.clear(end);
    await user.type(end, '2024-03-01');
    expect(onChange).toHaveBeenLastCalledWith({ start: '', end: '2024-03-01' });
  });

  it('clear empties both ends', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RangeHarness initial={{ start: '2024-03-10', end: '2024-03-15' }} onChange={onChange} />
    );

    await user.click(screen.getByLabelText('Clear date'));
    expect(onChange).toHaveBeenLastCalledWith({ start: '', end: '' });
  });
});

describe('AccessibleDatePicker - grid keyboard navigation', () => {
  it('exposes the calendar as a grid labelled by the month, with one tab stop', async () => {
    const user = userEvent.setup();
    render(<SingleHarness initial="2024-03-15" />);

    await user.click(screen.getByLabelText('Pay date'));
    const grid = screen.getByRole('grid', { name: 'March 2024' });
    expect(within(grid).getAllByRole('columnheader')).toHaveLength(7);
    expect(within(grid).getAllByRole('row').length).toBeGreaterThanOrEqual(5);

    const tabbable = within(grid)
      .getAllByRole('button')
      .filter((b) => b.getAttribute('tabindex') === '0');
    expect(tabbable).toEqual([dayButton(15)]);
  });

  it('moves by day, week, week edge, month and year', async () => {
    const user = userEvent.setup();
    render(<SingleHarness initial="2024-03-15" />);

    await user.click(screen.getByLabelText('Pay date'));
    await user.keyboard('{Enter}');
    expect(dayButton(15)).toHaveFocus(); // Friday

    await user.keyboard('{ArrowLeft}');
    expect(dayButton(14)).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(dayButton(21)).toHaveFocus();
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(dayButton(7)).toHaveFocus();
    await user.keyboard('{Home}');
    expect(dayButton(3)).toHaveFocus(); // Sunday
    await user.keyboard('{End}');
    expect(dayButton(9)).toHaveFocus(); // Saturday

    await user.keyboard('{PageDown}');
    expect(dayButton(9, 'April 2024')).toHaveFocus();
    await user.keyboard('{Shift>}{PageDown}{/Shift}');
    expect(dayButton(9, 'April 2025')).toHaveFocus();
    await user.keyboard('{Shift>}{PageUp}{/Shift}{PageUp}');
    expect(dayButton(9, 'March 2024')).toHaveFocus();
  });

  it('selects the focused day with Enter and does not reopen the calendar', async () => {
    const user = userEvent.setup();
    render(<SingleHarness initial="2024-03-15" />);

    const input = screen.getByLabelText('Pay date');
    await user.click(input);
    await user.keyboard('{Enter}{ArrowRight}{Enter}');

    expect(input).toHaveValue('2024-03-16');
    expect(input).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Escape from the grid closes and returns focus to the input', async () => {
    const user = userEvent.setup();
    render(<SingleHarness initial="2024-03-15" />);

    const input = screen.getByLabelText('Pay date');
    await user.click(input);
    await user.keyboard('{Enter}{ArrowRight}{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(input).toHaveValue('2024-03-15');
  });
});

describe('AccessibleDatePicker - month/year quick jump', () => {
  it('jumps to a chosen month and year', async () => {
    const user = userEvent.setup();
    render(<SingleHarness initial="2024-03-15" />);

    await user.click(screen.getByLabelText('Pay date'));
    const heading = screen.getByRole('button', { name: 'March 2024' });
    expect(heading).toHaveAttribute('aria-expanded', 'false');

    await user.click(heading);
    expect(heading).toHaveAttribute('aria-expanded', 'true');
    await user.selectOptions(screen.getByLabelText('Year'), '2030');
    await user.selectOptions(screen.getByLabelText('Month'), 'June');

    expect(screen.getByRole('grid', { name: 'June 2030' })).toBeInTheDocument();
    // The roving tab stop follows to the same day of the new month.
    expect(dayButton(15, 'June 2030')).toHaveAttribute('tabindex', '0');
  });

  it('limits the choices to minDate/maxDate', async () => {
    const user = userEvent.setup();
    render(<SingleHarness initial="2024-03-15" minDate="2024-02-10" maxDate="2025-05-01" />);

    await user.click(screen.getByLabelText('Pay date'));
    await user.click(screen.getByRole('button', { name: 'March 2024' }));

    const years = within(screen.getByLabelText('Year'))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(years).toEqual(['2024', '2025']);

    const month = (name: string) =>
      within(screen.getByLabelText('Month')).getByRole('option', { name });
    expect(month('January')).toBeDisabled();
    expect(month('February')).toBeEnabled();
    expect(month('December')).toBeEnabled();
  });

  it('disables previous/next month at the bounds', async () => {
    const user = userEvent.setup();
    render(<SingleHarness initial="2024-03-15" minDate="2024-03-01" maxDate="2024-03-31" />);

    await user.click(screen.getByLabelText('Pay date'));
    expect(screen.getByLabelText('Previous month')).toBeDisabled();
    expect(screen.getByLabelText('Next month')).toBeDisabled();
  });
});
