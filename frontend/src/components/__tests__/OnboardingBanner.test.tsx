import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingBanner } from '../OnboardingBanner';
import { AuthContext, type AuthContextType } from '../../providers/AuthContext';
import { useOrgOnboardingStore } from '../../stores/orgOnboardingStore';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderAs(role: 'EMPLOYER' | 'EMPLOYEE' | null) {
  const auth = {
    user: role ? { id: '1', email: 'a@b.c', name: 'A', role } : null,
  } as AuthContextType;
  return render(
    <MemoryRouter>
      <AuthContext value={auth}>
        <OnboardingBanner />
      </AuthContext>
    </MemoryRouter>
  );
}

describe('OnboardingBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    useOrgOnboardingStore.getState().reset();
    mockNavigate.mockReset();
  });

  it('invites employers who have not started to begin setup', () => {
    renderAs('EMPLOYER');
    expect(
      screen.getByRole('heading', { name: /set up payroll in five steps/i })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /start setup/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
  });

  it('offers to resume with progress once started', () => {
    useOrgOnboardingStore.getState().goToStep(2);
    renderAs('EMPLOYER');
    expect(screen.getByRole('button', { name: /resume setup/i })).toBeInTheDocument();
    expect(screen.getByText('Step 3 of 5')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
  });

  it('is hidden for employees, signed-out users and completed setups', () => {
    const { unmount } = renderAs('EMPLOYEE');
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    unmount();

    renderAs(null);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();

    useOrgOnboardingStore.getState().complete();
    renderAs('EMPLOYER');
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});
