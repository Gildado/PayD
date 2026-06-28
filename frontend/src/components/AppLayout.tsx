import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import ConnectAccount from '../components/ConnectAccount';
import AppNav from './AppNav';
import { LanguageSelector } from './LanguageSelector';
import { ThemeToggle } from './ThemeToggle';
import { useTranslation } from 'react-i18next';
import { Breadcrumb } from './Breadcrumb';
import { NetworkSwitcher } from './NetworkSwitcher';
import { useNetworkStore } from '../stores/networkStore';

const APP_VERSION = (import.meta.env.PUBLIC_APP_VERSION as string | undefined)?.trim() ?? '0.0.1';
const APP_ENV = import.meta.env.MODE;

// ── Page Wrapper ───────────────────────
const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-col flex-1">{children}</div>
);

// ── Layout ────────────────────────────
const AppLayout: React.FC = () => {
  const location = useLocation();
  useTranslation();
  const { network } = useNetworkStore();

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      {/* Header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 h-(--header-h) items-center px-4 sm:px-8 lg:px-16 flex justify-between backdrop-blur-[20px] backdrop-saturate-180 border-b"
        style={{
          background: 'color-mix(in srgb, var(--bg) 85%, transparent)',
          borderColor: 'var(--border-hi)',
        }}
      >
        {/* Logo */}
        <NavLink className="flex items-center gap-2.5" to="/">
          <div className="w-8 h-8 rounded-lg grid place-items-center font-extrabold text-black text-sm tracking-tight shadow-[0_0_20px_rgba(74,240,184,0.3)] bg-linear-to-br from-(--accent) to-(--accent2)">
            P
          </div>
          <span className="text-lg font-extrabold tracking-tight">
            Pay<span className="text-(--accent)">D</span>
          </span>
          <span className="text-[9px] font-normal font-mono text-(--muted) tracking-widest uppercase border border-(--border-hi) px-1.5 py-0.5 rounded ml-0.5">
            BETA
          </span>
        </NavLink>

        {/* Nav */}
        <div className="flex items-center gap-6 ml-auto">
          <AppNav />
          <div className="ml-4 flex items-center gap-3">
            <NetworkSwitcher />
            <LanguageSelector />
            <ThemeToggle />
            <ConnectAccount />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex flex-col flex-1 pt-(--header-h)">
        <PageWrapper>
          <div key={location.pathname} className="flex flex-col flex-1 px-6 py-8">
            <Breadcrumb />
            <Outlet />
          </div>
        </PageWrapper>
      </main>

      {/* Footer */}
      <footer
        className="flex flex-wrap justify-between items-center gap-2 px-6 py-5 border-t text-xs font-mono text-(--muted)"
        style={{ borderColor: 'var(--border-hi)' }}
      >
        <span>
          © {new Date().getFullYear()} PayD — Licensed under the{' '}
          <a
            href="http://www.apache.org/licenses/LICENSE-2.0"
            target="_blank"
            rel="noopener noreferrer"
            className="text-(--accent) hover:underline"
          >
            Apache License 2.0
          </a>
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="px-1.5 py-0.5 rounded border text-[10px] uppercase tracking-widest"
            style={{ borderColor: 'var(--border-hi)' }}
            aria-label={`App version ${APP_VERSION}`}
          >
            v{APP_VERSION}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded border text-[10px] uppercase tracking-widest ${
              APP_ENV === 'production'
                ? 'border-green-500/40 text-green-500'
                : 'border-yellow-500/40 text-yellow-500'
            }`}
            aria-label={`Environment: ${APP_ENV}`}
          >
            {APP_ENV === 'production' ? 'production' : APP_ENV === 'staging' ? 'staging' : 'dev'}
          </span>
          <div className="flex items-center gap-1.5" aria-label={`Connected to Stellar ${network}`}>
            <div
              className={`w-1.5 h-1.5 rounded-full shadow-[0_0_6px_var(--accent)] ${
                network === 'TESTNET' ? 'bg-yellow-500' : 'bg-(--accent)'
              }`}
            />
            STELLAR · {network}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;
