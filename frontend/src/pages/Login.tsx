import React, { useState } from 'react';
import {
  ArrowRight,
  BriefcaseBusiness,
  Chrome,
  Github,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { clearPostAuthRedirect, storePostAuthRedirect } from '../providers/authRedirect';

type LoginLocationState = {
  from?: {
    pathname?: string;
  };
};

function getDestinationLabel(pathname?: string): string {
  switch (pathname) {
    case '/':
      return 'your PayD dashboard';
    case '/portal':
      return 'your employee portal';
    case '/payroll':
    case '/employer/payroll':
      return 'payroll operations';
    case '/employee':
    case '/employer/employee':
      return 'employee management';
    case '/transactions':
    case '/employer/transactions':
      return 'transaction history';
    default: {
      if (!pathname || pathname === '/') return 'your PayD dashboard';
      const lastSegment = pathname.split('/').filter(Boolean).pop();
      return lastSegment ? lastSegment.replace(/-/g, ' ') : 'your workspace';
    }
  }
}

function getErrorMessage(errorCode: string | null): string | null {
  switch (errorCode) {
    case 'no_token':
      return 'We could not complete sign-in. Choose a provider below and try again.';
    default:
      return null;
  }
}

const Login: React.FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const backendUrl = (import.meta.env.VITE_BACKEND_URL as string) || 'http://localhost:4000';
  const locationState = location.state as LoginLocationState | null;
  const redirectPath = locationState?.from?.pathname ?? '/';
  const destinationLabel = getDestinationLabel(redirectPath);
  const authError = getErrorMessage(searchParams.get('error'));

  // Track which provider failed so we can suggest the alternative
  const failedProvider = searchParams.get('provider') ?? null;
  const [retryCount, setRetryCount] = useState(0);
  const showAlternativeSuggestion = retryCount >= 1 || authError !== null;

  const providers = [
    {
      id: 'google',
      label: 'Continue with Google',
      description: 'Best for teams already using Google Workspace for payroll operations.',
      href: `${backendUrl}/auth/google`,
      icon: Chrome,
      iconClassName: 'text-[var(--accent)]',
      ringClassName: 'from-[rgba(74,240,184,0.22)] to-transparent',
    },
    {
      id: 'github',
      label: 'Continue with GitHub',
      description: 'Great for builders, contributors, and technical operators managing PayD.',
      href: `${backendUrl}/auth/github`,
      icon: Github,
      iconClassName: 'text-[var(--accent2)]',
      ringClassName: 'from-[rgba(124,111,247,0.22)] to-transparent',
    },
  ] as const;

  // When there's an error, surface the alternative provider first
  const orderedProviders =
    authError && failedProvider
      ? [...providers].sort((a) => (a.id === failedProvider ? 1 : -1))
      : providers;

  const trustSignals = [
    {
      title: 'Secure sign-in',
      description:
        'OAuth handles authentication here. Wallet secrets are never requested on this screen.',
      icon: ShieldCheck,
    },
    {
      title: 'Role-aware workspace',
      description:
        'Employer and employee experiences remain separated after authentication completes.',
      icon: BriefcaseBusiness,
    },
    {
      title: 'Wallet-ready flow',
      description:
        'After sign-in, you can connect Stellar wallets only when payment actions actually need them.',
      icon: Wallet,
    },
  ] as const;

  const handleProviderIntent = () => {
    if (redirectPath === '/') {
      clearPostAuthRedirect();
      return;
    }

    storePostAuthRedirect(redirectPath);
  };

  const handleRetry = () => {
    setRetryCount((c) => c + 1);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--bg)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(74,240,184,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(124,111,247,0.14),transparent_28%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[-8rem] top-12 h-64 w-64 rounded-full bg-[rgba(74,240,184,0.12)] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-8 right-[-6rem] h-72 w-72 rounded-full bg-[rgba(124,111,247,0.14)] blur-3xl"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] lg:gap-8">
          <section
            aria-labelledby="login-title"
            className="card glass noise relative overflow-hidden border-[color:var(--border-hi)] p-6 sm:p-8 lg:p-10"
          >
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(74,240,184,0.7),transparent)]"
            />

            <div className="mb-8 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-hi)] bg-[color:rgba(255,255,255,0.04)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden />
                Secure OAuth
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[color:rgba(74,240,184,0.28)] bg-[color:rgba(74,240,184,0.08)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                Continue to {destinationLabel}
              </span>
            </div>

            <div className="max-w-2xl">
              <p className="mb-3 text-sm font-medium uppercase tracking-[0.28em] text-[var(--muted)]">
                PayD Access
              </p>
              <h1
                id="login-title"
                className="max-w-xl text-4xl font-black tracking-tight sm:text-5xl"
              >
                Sign in with the provider your team already trusts.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
                Reach your payroll workspace quickly, keep authentication centralized, and move into
                wallet and payment actions only when the workflow actually requires them.
              </p>
            </div>

            {authError ? (
              <div
                role="alert"
                className="mt-6 rounded-2xl border border-[color:rgba(255,123,114,0.28)] bg-[color:rgba(255,123,114,0.10)] px-4 py-4 text-sm text-[var(--text)]"
              >
                <p>{authError}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <a
                    href={location.pathname + location.search}
                    onClick={handleRetry}
                    className="inline-flex items-center gap-2 rounded-xl border border-[color:rgba(255,123,114,0.40)] bg-[color:rgba(255,123,114,0.14)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[color:rgba(255,123,114,0.22)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                    aria-label="Retry sign-in"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden />
                    Try again
                  </a>
                  {showAlternativeSuggestion && (
                    <p className="text-xs text-[var(--muted)]">
                      Or try a different provider below — both options connect the same workspace.
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            <div className="mt-8 grid gap-4">
              {orderedProviders.map((provider) => {
                const ProviderIcon = provider.icon;
                const isFailedProvider = provider.id === failedProvider;

                return (
                  <a
                    key={provider.id}
                    href={provider.href}
                    onClick={handleProviderIntent}
                    className={`group relative overflow-hidden rounded-3xl border p-5 text-left shadow-[var(--shadow-card)] transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)] min-h-[88px] ${
                      isFailedProvider
                        ? 'border-[color:rgba(255,123,114,0.28)] bg-[color:rgba(255,123,114,0.06)] hover:bg-[color:rgba(255,123,114,0.10)]'
                        : 'border-[var(--border-hi)] bg-[color:rgba(255,255,255,0.03)] hover:border-[color:rgba(74,240,184,0.28)] hover:bg-[color:rgba(255,255,255,0.05)]'
                    }`}
                    aria-label={`${provider.label}. ${provider.description}`}
                  >
                    <div
                      aria-hidden="true"
                      className={`absolute inset-0 bg-[radial-gradient(circle_at_top_left,var(--tw-gradient-stops))] opacity-0 transition-opacity duration-200 group-hover:opacity-100 ${provider.ringClassName}`}
                    />
                    <div className="relative flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-hi)] bg-[var(--surface)]">
                        <ProviderIcon className={`h-5 w-5 ${provider.iconClassName}`} aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-base font-bold text-[var(--text)]">
                            {provider.label}
                          </span>
                          <ArrowRight
                            className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--accent)]"
                            aria-hidden
                          />
                        </div>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
                          {provider.description}
                        </p>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>

            <div className="mt-8 grid gap-3 rounded-3xl border border-[var(--border-hi)] bg-[var(--surface)]/80 p-5 sm:grid-cols-3">
              {trustSignals.map((signal) => {
                const SignalIcon = signal.icon;

                return (
                  <div
                    key={signal.title}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4"
                  >
                    <SignalIcon className="h-5 w-5 text-[var(--accent)]" aria-hidden />
                    <h2 className="mt-3 text-sm font-bold text-[var(--text)]">{signal.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      {signal.description}
                    </p>
                  </div>
                );
              })}
            </div>

            <p className="mt-6 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Secure · Encrypted · Non-custodial
            </p>
          </section>

          <aside className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <section className="card border-[var(--border-hi)] bg-[var(--surface)]/90 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--muted)]">
                Why this flow works
              </p>
              <ul className="mt-4 space-y-4">
                <li className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4">
                  <p className="text-sm font-bold text-[var(--text)]">Role-aware return path</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    PayD now remembers where protected navigation started and returns users there
                    after OAuth.
                  </p>
                </li>
                <li className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4">
                  <p className="text-sm font-bold text-[var(--text)]">Focused first decision</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    Provider choice is the only primary action here, which keeps the entry point
                    calm on mobile and desktop.
                  </p>
                </li>
              </ul>
            </section>

            <section className="card border-[color:rgba(124,111,247,0.25)] bg-[linear-gradient(180deg,rgba(124,111,247,0.10),rgba(13,17,23,0.96))] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--muted)]">
                Next after sign-in
              </p>
              <ol className="mt-4 space-y-3">
                <li className="flex gap-3 rounded-2xl border border-[var(--border)] bg-[color:rgba(255,255,255,0.04)] p-4">
                  <span className="font-mono text-sm font-bold text-[var(--accent2)]">01</span>
                  <div>
                    <p className="text-sm font-bold text-[var(--text)]">Verify identity</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                      OAuth confirms who you are before any payroll data is shown.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3 rounded-2xl border border-[var(--border)] bg-[color:rgba(255,255,255,0.04)] p-4">
                  <span className="font-mono text-sm font-bold text-[var(--accent2)]">02</span>
                  <div>
                    <p className="text-sm font-bold text-[var(--text)]">Restore context</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                      You return to the screen that prompted sign-in instead of restarting from
                      scratch.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3 rounded-2xl border border-[var(--border)] bg-[color:rgba(255,255,255,0.04)] p-4">
                  <span className="font-mono text-sm font-bold text-[var(--accent2)]">03</span>
                  <div>
                    <p className="text-sm font-bold text-[var(--text)]">Connect and act</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                      Wallet interactions stay in later steps like payroll, multisig checks, and
                      transaction signing.
                    </p>
                  </div>
                </li>
              </ol>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
};

export default Login;
