import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { readPostAuthRedirect, storePostAuthRedirect } from '../providers/authRedirect';

const navigateMock = vi.fn();
const setTokenFromCallbackMock = vi.fn();

vi.mock('../providers/useAuth', () => ({
  useAuth: () => ({
    setTokenFromCallback: setTokenFromCallbackMock,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

import AuthCallback from '../pages/AuthCallback';

describe('AuthCallback', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    setTokenFromCallbackMock.mockReset();
    localStorage.clear();
  });

  it('restores the stored destination after successful authentication', async () => {
    storePostAuthRedirect('/employer/payroll');

    render(
      <MemoryRouter initialEntries={['/auth-callback?token=test-token']}>
        <AuthCallback />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(setTokenFromCallbackMock).toHaveBeenCalledWith('test-token', null);
    });

    expect(navigateMock).toHaveBeenCalledWith('/employer/payroll', { replace: true });
    expect(readPostAuthRedirect()).toBeNull();
  });

  it('returns to the login screen with an error when no token is present', async () => {
    storePostAuthRedirect('/employer/payroll');

    render(
      <MemoryRouter initialEntries={['/auth-callback']}>
        <AuthCallback />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login?error=no_token', { replace: true });
    });

    expect(setTokenFromCallbackMock).not.toHaveBeenCalled();
    expect(readPostAuthRedirect()).toBeNull();
  });
});
