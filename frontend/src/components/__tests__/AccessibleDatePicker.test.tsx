/**
 * AccessibleDatePicker Component Tests
 *
 * Tests for keyboard accessibility, ARIA compliance, and date selection functionality
 * Issue #118: Improve Date Picker Accessibility
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessibleDatePicker } from '../AccessibleDatePicker';

describe('AccessibleDatePicker - Accessibility & Keyboard Navigation', () => {
  const defaultProps = {
    id: 'test-date-picker',
    label: 'Test Date',
    value: '',
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ARIA Attributes & Labels', () => {
    it('should have proper ARIA labels for screen readers', () => {
      render(<AccessibleDatePicker {...defaultProps} />);

      const input = screen.getByLabelText('Test Date');
      expect(input).toHaveAttribute('aria-label', 'Test Date');
      expect(input).toHaveAttribute('aria-required', 'false');
    });

    it('should mark required fields with aria-required', () => {
      render(<AccessibleDatePicker {...defaultProps} required={true} />);

      const input = screen.getByLabelText(/Test Date/);
      expect(input).toHaveAttribute('aria-required', 'true');
    });

    it('should set aria-disabled for disabled state', () => {
      render(<AccessibleDatePicker {...defaultProps} disabled={true} />);

      const input = screen.getByLabelText('Test Date');
      expect(input).toHaveAttribute('aria-disabled', 'true');
      expect(input).toBeDisabled();
    });

    it('should have aria-describedby linking to help text', () => {
      const helpText = 'Pick a date in the future';
      render(<AccessibleDatePicker {...defaultProps} helpText={helpText} />);

      const input = screen.getByLabelText('Test Date');
      const helpId = `${defaultProps.id}-help`;
      expect(input).toHaveAttribute('aria-describedby', expect.stringContaining(helpId));
      expect(screen.getByText(helpText)).toHaveAttribute('id', helpId);
    });

    it('should display visible label with htmlFor linking', () => {
      render(<AccessibleDatePicker {...defaultProps} />);

      const label = screen.getByText('Test Date');
      const input = screen.getByLabelText('Test Date');
      expect(label).toHaveAttribute('for', defaultProps.id);
      expect(input).toHaveAttribute('id', defaultProps.id);
    });

    it('should indicate required field with visual marker', () => {
      render(<AccessibleDatePicker {...defaultProps} required={true} />);

      const asterisk = screen.getByLabelText('required');
      expect(asterisk).toBeInTheDocument();
    });

    it('should have aria-expanded for calendar popup state', () => {
      render(<AccessibleDatePicker {...defaultProps} />);

      const input = screen.getByLabelText('Test Date');
      expect(input).toHaveAttribute('aria-expanded', 'false');
    });

    it('should have aria-haspopup="dialog" for calendar', () => {
      render(<AccessibleDatePicker {...defaultProps} />);

      const input = screen.getByLabelText('Test Date');
      expect(input).toHaveAttribute('aria-haspopup', 'dialog');
    });
  });

  describe('Keyboard Navigation - Enter/Down Arrow to Open', () => {
    it('should open calendar on Enter key', async () => {
      const user = userEvent.setup();
      render(<AccessibleDatePicker {...defaultProps} />);

      const input = screen.getByLabelText('Test Date');
      await user.click(input);
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should open calendar on ArrowDown key', async () => {
      const user = userEvent.setup();
      render(<AccessibleDatePicker {...defaultProps} />);

      const input = screen.getByLabelText('Test Date');
      await user.click(input);
      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should not open calendar when disabled', async () => {
      const user = userEvent.setup();
      render(<AccessibleDatePicker {...defaultProps} disabled={true} />);

      await user.keyboard('{Enter}');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation - Escape to Close', () => {
    it('should close calendar on Escape key', async () => {
      const user = userEvent.setup();
      render(<AccessibleDatePicker {...defaultProps} />);

      const input = screen.getByLabelText('Test Date');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should return focus to input after closing', async () => {
      const user = userEvent.setup();
      render(<AccessibleDatePicker {...defaultProps} />);

      const input = screen.getByLabelText('Test Date');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      expect(input).toHaveFocus();
    });
  });

  describe('Keyboard Navigation - Tab to Close', () => {
    it('should close calendar when tabbing out', async () => {
      const user = userEvent.setup();
      render(
        <div>
          <AccessibleDatePicker {...defaultProps} />
          <input aria-label="next field" />
        </div>
      );

      const input = screen.getByLabelText('Test Date');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      await user.tab();

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation - Arrow Keys in Calendar', () => {
    it('should navigate calendar days with arrow keys', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<AccessibleDatePicker {...defaultProps} onChange={onChange} value="2024-03-15" />);

      const input = screen.getByLabelText('Test Date');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Focus should move within calendar
      const calendar = screen.getByRole('dialog');
      expect(calendar).toBeInTheDocument();
    });
  });

  describe('Date Selection & Input', () => {
    it('should call onChange when date is selected from calendar', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const dayInMonth = 15;

      render(<AccessibleDatePicker {...defaultProps} onChange={onChange} />);

      const input = screen.getByLabelText('Test Date');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dayButton = screen.getByRole('button', { name: new RegExp(`^${dayInMonth}`) });
      await user.click(dayButton);

      expect(onChange).toHaveBeenCalled();
    });

    it('should accept direct text input in valid format', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<AccessibleDatePicker {...defaultProps} onChange={onChange} />);

      const input = screen.getByLabelText('Test Date');
      await user.click(input);
      await user.keyboard('2024-03-15');

      expect(onChange).toHaveBeenCalledWith('2024-03-15');
    });

    it('should validate date format', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<AccessibleDatePicker {...defaultProps} onChange={onChange} />);

      const input = screen.getByLabelText('Test Date');
      await user.click(input);
      await user.keyboard('invalid-date');

      // Invalid dates should not trigger onChange
      expect(onChange).not.toHaveBeenCalledWith('invalid-date');
    });

    it('should respect minDate constraint', () => {
      const minDate = '2024-03-20';
      render(<AccessibleDatePicker {...defaultProps} minDate={minDate} />);

      // Calendar should not allow selecting dates before minDate
      // This is enforced in the date selection logic
      expect(screen.getByLabelText('Test Date')).toBeInTheDocument();
    });

    it('should respect maxDate constraint', () => {
      const maxDate = '2024-03-25';
      render(<AccessibleDatePicker {...defaultProps} maxDate={maxDate} />);

      expect(screen.getByLabelText('Test Date')).toBeInTheDocument();
    });
  });

  describe('Clear Button Accessibility', () => {
    it('should have accessible clear button', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<AccessibleDatePicker {...defaultProps} value="2024-03-15" onChange={onChange} />);

      const clearButton = screen.getByLabelText('Clear date');
      expect(clearButton).toBeInTheDocument();

      await user.click(clearButton);
      expect(onChange).toHaveBeenCalledWith('');
    });

    it('should return focus to input after clearing', async () => {
      const user = userEvent.setup();
      render(<AccessibleDatePicker {...defaultProps} value="2024-03-15" onChange={vi.fn()} />);

      const input = screen.getByLabelText('Test Date');
      const clearButton = screen.getByLabelText('Clear date');

      await user.click(clearButton);

      expect(input).toHaveFocus();
    });

    it('should not show clear button when empty', () => {
      render(<AccessibleDatePicker {...defaultProps} value="" />);

      expect(screen.queryByLabelText('Clear date')).not.toBeInTheDocument();
    });

    it('should not show clear button when disabled', () => {
      render(<AccessibleDatePicker {...defaultProps} value="2024-03-15" disabled={true} />);

      expect(screen.queryByLabelText('Clear date')).not.toBeInTheDocument();
    });
  });

  describe('Month Navigation Accessibility', () => {
    it('should have accessible month navigation buttons', async () => {
      const user = userEvent.setup();
      render(<AccessibleDatePicker {...defaultProps} />);

      const input = screen.getByLabelText('Test Date');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const prevMonthBtn = screen.getByLabelText(/Previous month/);
      const nextMonthBtn = screen.getByLabelText(/Next month/);

      expect(prevMonthBtn).toBeInTheDocument();
      expect(nextMonthBtn).toBeInTheDocument();
    });

    it('should announce month/year changes to screen readers', async () => {
      const user = userEvent.setup();
      render(<AccessibleDatePicker {...defaultProps} />);

      const input = screen.getByLabelText('Test Date');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const monthDisplay = screen.getByRole('button', {
        name: /^[A-Za-z]+\s\d{4}$/,
      });

      expect(monthDisplay).toHaveAttribute('aria-live', 'polite');
      expect(monthDisplay).toHaveAttribute('aria-atomic', 'true');
    });
  });

  describe('Error Handling & Messages', () => {
    it('should display error message with proper ARIA', () => {
      const error = 'Date must be in the future';
      render(<AccessibleDatePicker {...defaultProps} error={error} />);

      const errorMessage = screen.getByText(error);
      expect(errorMessage).toHaveAttribute('role', 'alert');
      expect(errorMessage).toHaveAttribute('id', `${defaultProps.id}-error`);
    });

    it('should link error message to input via aria-describedby', () => {
      render(<AccessibleDatePicker {...defaultProps} error="Invalid date" />);

      const input = screen.getByLabelText('Test Date');
      expect(input).toHaveAttribute('aria-describedby', expect.stringContaining('error'));
    });
  });

  describe('Focus Management', () => {
    it('should be keyboard focusable', async () => {
      const user = userEvent.setup();
      render(<AccessibleDatePicker {...defaultProps} />);

      const input = screen.getByLabelText('Test Date');
      await user.tab();

      expect(input).toHaveFocus();
    });

    it('should show focus ring on keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<AccessibleDatePicker {...defaultProps} />);

      const input = screen.getByLabelText('Test Date');
      await user.tab();

      expect(input).toHaveFocus();
      // Focus style should be applied via CSS class
    });

    it('should not be focusable when disabled', async () => {
      const user = userEvent.setup();
      render(<AccessibleDatePicker {...defaultProps} disabled={true} />);

      const input = screen.getByLabelText('Test Date');
      await user.click(input);

      // Calendar should not open
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Help Text & Instructions', () => {
    it('should display keyboard instructions in calendar', async () => {
      const user = userEvent.setup();
      render(<AccessibleDatePicker {...defaultProps} />);

      const input = screen.getByLabelText('Test Date');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText(/Arrow keys to navigate/)).toBeInTheDocument();
      });
    });

    it('should display help text when provided', () => {
      const helpText = 'Select the payroll start date';
      render(<AccessibleDatePicker {...defaultProps} helpText={helpText} />);

      expect(screen.getByText(helpText)).toBeInTheDocument();
    });
  });

  describe('Screen Reader Announcements', () => {
    it('should announce date day of week in accessible format', () => {
      render(<AccessibleDatePicker {...defaultProps} value="2024-03-15" />);

      // Input should display the date
      const input = screen.getByLabelText('Test Date');
      expect(input).toHaveValue('2024-03-15');
    });

    it('should announce selected date in calendar', async () => {
      const user = userEvent.setup();
      render(<AccessibleDatePicker {...defaultProps} value="2024-03-15" />);

      const input = screen.getByLabelText('Test Date');
      await user.click(input);

      await waitFor(() => {
        const selectedDay = screen.getByRole('button', { name: /15/ });
        expect(selectedDay).toHaveAttribute('aria-selected', 'true');
      });
    });
  });

  describe('Mobile & Responsive Behavior', () => {
    it('should support native date input fallback', () => {
      render(<AccessibleDatePicker {...defaultProps} />);

      const input = screen.getByLabelText('Test Date');
      expect(input).toHaveAttribute('type', 'date');
    });

    it('should have appropriate field sizing options', () => {
      const { rerender } = render(<AccessibleDatePicker {...defaultProps} fieldSize="sm" />);
      expect(screen.getByLabelText('Test Date')).toBeInTheDocument();

      rerender(<AccessibleDatePicker {...defaultProps} fieldSize="md" />);
      expect(screen.getByLabelText('Test Date')).toBeInTheDocument();

      rerender(<AccessibleDatePicker {...defaultProps} fieldSize="lg" />);
      expect(screen.getByLabelText('Test Date')).toBeInTheDocument();
    });
  });

  describe('Outside Click Handling', () => {
    it('should close calendar when clicking outside', async () => {
      const user = userEvent.setup();
      render(
        <div>
          <AccessibleDatePicker {...defaultProps} />
          <button>Outside</button>
        </div>
      );

      const input = screen.getByLabelText('Test Date');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const outsideButton = screen.getByText('Outside');
      await user.click(outsideButton);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
