import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login';
import { consumePostAuthRedirect } from '../providers/authRedirect';

describe('Login', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('renders the provider links with the expected auth destinations', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { name: 'Sign in with the provider your team already trusts.' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /continue with google/i })).toHaveAttribute(
      'href',
      'http://localhost:4000/auth/google'
    );
    expect(screen.getByRole('link', { name: /continue with github/i })).toHaveAttribute(
      'href',
      'http://localhost:4000/auth/github'
    );
  });

  it('stores the protected destination before leaving for OAuth', () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/login',
            state: {
              from: {
                pathname: '/employer/payroll',
              },
            },
          },
        ]}
      >
        <Login />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('link', { name: /continue with google/i }));

    expect(screen.getByText(/continue to payroll operations/i)).toBeInTheDocument();
    expect(consumePostAuthRedirect()).toBe('/employer/payroll');
  });

  it('shows an accessible auth error banner when the callback returns without a token', () => {
    render(
      <MemoryRouter initialEntries={['/login?error=no_token']}>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'We could not complete sign-in. Choose a provider below and try again.'
    );
  });
});
