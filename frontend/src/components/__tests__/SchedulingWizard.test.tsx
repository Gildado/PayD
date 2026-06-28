import { fireEvent, render, screen } from '@testing-library/react';
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

    expect(screen.getByRole('button', { name: /biweekly/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByLabelText(/run time/i)).toHaveValue('14:45');
  });

  it('blocks navigation when the schedule configuration is invalid', () => {
    render(<SchedulingWizard onComplete={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/day of month/i), {
      target: { value: '40' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/choose a day between 1 and 31/i);
    expect(screen.getByRole('heading', { name: /set schedule/i })).toBeInTheDocument();
  });

  it('returns the edited payout preferences on confirmation', () => {
    const onComplete = vi.fn<(config: SchedulingConfig) => void>();

    render(<SchedulingWizard onComplete={onComplete} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    const currencySelectors = screen.getAllByLabelText(/select payout currency for alice/i);
    fireEvent.change(currencySelectors[0], { target: { value: 'EURC' } });

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm schedule/i }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const submittedConfig = onComplete.mock.calls[0]?.[0];

    expect(submittedConfig.preferences[0]?.id).toBe('1');
    expect(submittedConfig.preferences[0]?.currency).toBe('EURC');
  });
});
