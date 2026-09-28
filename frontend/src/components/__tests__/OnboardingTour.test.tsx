import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { OnboardingTour } from '../OnboardingTour';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

// Mock react-joyride
vi.mock('react-joyride', () => ({
  default: ({
    run,
    steps,
    callback,
  }: {
    run: boolean;
    steps: unknown[];
    callback: (data: { status: string }) => void;
  }) => {
    if (!run) return null;
    return (
      <div data-testid="joyride-mock">
        <div>Steps: {steps.length}</div>
        <button onClick={() => callback({ status: 'finished' })}>Complete Tour</button>
      </div>
    );
  },
  STATUS: {
    FINISHED: 'finished',
    SKIPPED: 'skipped',
  },
}));

describe('OnboardingTour', () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when run is true', () => {
    const { getByTestId } = render(<OnboardingTour run={true} onComplete={mockOnComplete} />);

    expect(getByTestId('joyride-mock')).toBeInTheDocument();
  });

  it('does not render when run is false', () => {
    const { queryByTestId } = render(<OnboardingTour run={false} onComplete={mockOnComplete} />);

    expect(queryByTestId('joyride-mock')).not.toBeInTheDocument();
  });

  it('has correct number of tour steps', () => {
    const { getByText } = render(<OnboardingTour run={true} onComplete={mockOnComplete} />);

    // Should have 6 steps based on the implementation
    expect(getByText('Steps: 6')).toBeInTheDocument();
  });

  it('calls onComplete when tour is finished', () => {
    const { getByText } = render(<OnboardingTour run={true} onComplete={mockOnComplete} />);

    const completeButton = getByText('Complete Tour');
    completeButton.click();

    expect(mockOnComplete).toHaveBeenCalledTimes(1);
  });
});
