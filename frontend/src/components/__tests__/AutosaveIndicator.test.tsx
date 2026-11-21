import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AutosaveIndicator } from '../AutosaveIndicator';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('AutosaveIndicator', () => {
  it('renders neverSaved state when no lastSaved and not saving', () => {
    render(<AutosaveIndicator saving={false} lastSaved={null} />);
    expect(screen.getByText('autosave.neverSaved')).toBeInTheDocument();
  });

  it('renders saving state when saving is true', () => {
    render(<AutosaveIndicator saving={true} lastSaved={null} />);
    expect(screen.getByText('autosave.saving')).toBeInTheDocument();
  });

  it('renders lastSaved timestamp when lastSaved is provided', () => {
    const savedTime = new Date('2026-03-01T12:00:00Z');
    render(<AutosaveIndicator saving={false} lastSaved={savedTime} />);
    expect(screen.getByText(/autosave\.saved/i)).toBeInTheDocument();
  });

  it('surfaces error state and retry button when saveError is provided', () => {
    const onRetry = vi.fn();
    render(
      <AutosaveIndicator
        saving={false}
        lastSaved={null}
        saveError="Draft could not be saved."
        onRetry={onRetry}
      />
    );

    expect(screen.getByText('Draft could not be saved.')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('surfaces offline queue state when isOffline is true and no error', () => {
    render(
      <AutosaveIndicator
        saving={false}
        lastSaved={null}
        isOffline={true}
      />
    );

    expect(screen.getByTestId('autosave-offline')).toBeInTheDocument();
  });
});
