import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import ConnectAccount from '../components/ConnectAccount';
import AppNav from './AppNav';
import { BrandLogo } from './BrandLogo';
import { LanguageSelector } from './LanguageSelector';
import { ThemeToggle } from './ThemeToggle';
import { useTranslation } from 'react-i18next';
import { Breadcrumb } from './Breadcrumb';
import { NetworkSwitcher } from './NetworkSwitcher';
import { OfflineBanner } from './OfflineBanner';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import { Footer } from './Footer';
import { CookieConsentBanner } from './CookieConsentBanner';

// ── Page Wrapper ───────────────────────
const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-col flex-1">{children}</div>
);

// ── Layout ────────────────────────────
const AppLayout: React.FC = () => {
  const location = useLocation();
  useTranslation();
  const { shortcuts, enabled, setEnabled, isHelpOpen, closeHelp } = useKeyboardShortcuts();

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      {/* Header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 h-(--header-h) items-center px-4 sm:px-8 lg:px-16 flex justify-between backdrop-blur-[20px] backdrop-saturate-180 border-b motion-safe:transition-[background-color,border-color] motion-safe:duration-(--motion-duration-normal) motion-safe:ease-[var(--motion-ease-in-out)]"
        style={{
          background: 'color-mix(in srgb, var(--bg) 85%, transparent)',
          borderColor: 'var(--border-hi)',
        }}
      >
        {/* Logo */}
        <NavLink
          className="flex items-center gap-2.5 rounded-lg outline-none motion-safe:transition-transform motion-safe:duration-(--motion-duration-fast) motion-safe:ease-[var(--motion-ease-out)] hover:scale-[1.03] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-(--accent)/50"
          to="/"
        >
          <BrandLogo />
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
        <OfflineBanner />
        <PageWrapper>
          <div key={location.pathname} className="flex flex-col flex-1 px-6 py-8">
            <Breadcrumb />
            <Outlet />
          </div>
        </PageWrapper>
      </main>

      {/* Footer */}
      <Footer />

      {/* Mainnet Cookie & Legal Disclosure Banner */}
      <CookieConsentBanner />

      <KeyboardShortcutsHelp
        isOpen={isHelpOpen}
        shortcuts={shortcuts}
        enabled={enabled}
        onSetEnabled={setEnabled}
        onClose={closeHelp}
      />
    </div>
  );
};

export default AppLayout;
