import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SchedulingWizard } from '../SchedulingWizard';
import type { SchedulingConfig } from '../../utils/scheduling';

describe('SchedulingWizard', () => {
  it('hydrates the wizard from an existing schedule config', () => {
    const initialConfig: SchedulingConfig = {
      frequency: 'biweekly',
      dayOfWeek: 2,
      timeOfDay: '14:45',
      preferences: [{ id: '1', name: 'Alice', amount: '1000', currency: 'EURC' }],
    };

    render(
      <SchedulingWizard initialConfig={initialConfig} onComplete={vi.fn()} onCancel={vi.fn()} />
    );

    expect(
      screen.getByRole('button', { name: /schedulingWizard\.frequency_biweekly/i })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/schedulingWizard\.runTime/i)).toHaveValue('14:45');
  });

  it('blocks navigation when the schedule configuration is invalid', () => {
    render(<SchedulingWizard onComplete={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/schedulingWizard\.dayOfMonth/i), {
      target: { value: '40' },
    });
    fireEvent.click(screen.getByRole('button', { name: /schedulingWizard\.continue/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/choose a day between 1 and 31/i);
    expect(
      screen.getByRole('heading', { name: /schedulingWizard\.stepSetSchedule/i })
    ).toBeInTheDocument();
  });

  it('returns the edited payout preferences on confirmation', () => {
    const onComplete = vi.fn<(config: SchedulingConfig) => void>();

    render(<SchedulingWizard onComplete={onComplete} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /schedulingWizard\.continue/i }));

    const currencySelectors = screen.getAllByLabelText(
      /schedulingWizard\.selectPayoutCurrencyAriaLabel/i
    );
    fireEvent.change(currencySelectors[0], { target: { value: 'EURC' } });

    fireEvent.click(screen.getByRole('button', { name: /schedulingWizard\.continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /schedulingWizard\.confirmSchedule/i }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const submittedConfig = onComplete.mock.calls[0]?.[0];

    expect(submittedConfig.preferences[0]?.id).toBe('1');
    expect(submittedConfig.preferences[0]?.currency).toBe('EURC');
  });

  // ---------------------------------------------------------------------------
  // Keyboard Navigation & Accessibility Tests
  // ---------------------------------------------------------------------------

  it('renders dialog ARIA role and live region for screen reader step announcements', () => {
    render(<SchedulingWizard onComplete={vi.fn()} onCancel={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    const liveRegion = screen.getByText(/Step 1 of 3/i);
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
  });

  it('closes wizard when Escape key is pressed', () => {
    const onCancel = vi.fn();
    render(<SchedulingWizard onComplete={vi.fn()} onCancel={onCancel} />);

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('navigates wizard steps using Arrow keys on the step list', () => {
    render(<SchedulingWizard onComplete={vi.fn()} onCancel={vi.fn()} />);

    const stepList = screen.getByLabelText(/schedulingWizard\.stepsAriaLabel/i);

    // Press ArrowRight to move from Step 1 to Step 2
    fireEvent.keyDown(stepList, { key: 'ArrowRight' });
    expect(screen.getByText(/Step 2 of 3/i)).toBeInTheDocument();

    // Press ArrowLeft to return to Step 1
    fireEvent.keyDown(stepList, { key: 'ArrowLeft' });
    expect(screen.getByText(/Step 1 of 3/i)).toBeInTheDocument();
  });

  it('traps focus within the dialog when tabbing', async () => {
    const user = userEvent.setup();
    render(<SchedulingWizard onComplete={vi.fn()} onCancel={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    const focusableElements = dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus last element and press Tab -> should wrap around to first element
    lastElement.focus();
    expect(document.activeElement).toBe(lastElement);

    await user.tab();
    expect(document.activeElement).toBe(firstElement);

    // Focus first element and press Shift+Tab -> should wrap around to last element
    firstElement.focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(lastElement);
  });
});
