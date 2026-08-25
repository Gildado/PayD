import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Menu,
  ArrowLeft,
  ChevronsLeft,
  CreditCard,
  Users,
  Upload,
  BarChart3,
  FileText,
  Globe,
  History,
  PieChart,
  Settings,
} from 'lucide-react';
import { Button, Heading, Text } from '@stellar/design-system';
import { useTranslation } from 'react-i18next';
import ConnectAccount from './ConnectAccount';
import { LanguageSelector } from './LanguageSelector';
import { ThemeToggle } from './ThemeToggle';
import ErrorBoundary from './ErrorBoundary';
import ErrorFallback from './ErrorFallback';
import { Breadcrumb } from './Breadcrumb';
import { NetworkSwitcher } from './NetworkSwitcher';
import { useNativeXlmBalance } from '../hooks/useNativeXlmBalance';
import { useTransactionNotifications } from '../hooks/useTransactionNotifications';
import { useWallet } from '../hooks/useWallet';
import { TransactionPendingOverlay } from './TransactionPendingOverlay';
import { TransactionProvider } from '../contexts/TransactionContext';

const ORG_NAME_ENV = (import.meta.env.VITE_ORG_DISPLAY_NAME as string | undefined)?.trim();

const SIDEBAR_COLLAPSED_KEY = 'payd-sidebar-collapsed';
const SIDEBAR_EXPANDED_WIDTH = 288; // 18rem / w-72
const SIDEBAR_COLLAPSED_WIDTH = 72; // 4.5rem — icon rail

function readStoredCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function formatXlm(balance: string | null | undefined, locale: string): string {
  if (balance == null) return '—';
  const n = Number(balance);
  if (!Number.isFinite(n)) return balance;
  return `${n.toLocaleString(locale, { maximumFractionDigits: 6 })} XLM`;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
    isActive
      ? 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--accent)] shadow-[0_0_20px_rgba(74,240,184,0.15)] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-8 before:w-1 before:rounded-r-full before:bg-[var(--accent)]'
      : 'text-[var(--muted)] hover:bg-white/5 hover:text-[var(--text)] hover:translate-x-0.5'
  }`;

const iconClass =
  'h-4 w-4 shrink-0 opacity-80 transition-transform duration-200 group-hover:scale-110';

const EmployerLayoutContent: React.FC = () => {
  const { t, i18n } = useTranslation();
  const orgName = ORG_NAME_ENV || t('employerLayout.organization');
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readStoredCollapsed);
  const { address } = useWallet();
  const { data: xlmBalance, isFetching: balanceLoading } = useNativeXlmBalance();
  const { transactions, dismissTransaction } = useTransactionNotifications();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      // Best-effort persistence only
    }
  }, [sidebarCollapsed]);

  const labelClass = `motion-collapse-fade ${sidebarCollapsed ? 'lg:opacity-0 lg:max-w-0' : 'opacity-100 max-w-[12rem]'}`;

  const NavItems = (
    <>
      <NavLink
        to="/employer/payroll"
        className={navLinkClass}
        title={sidebarCollapsed ? t('nav.payroll') : undefined}
      >
        <CreditCard className={iconClass} aria-hidden />
        <span className={labelClass}>{t('nav.payroll')}</span>
      </NavLink>
      <NavLink
        to="/employer/employee"
        className={navLinkClass}
        title={sidebarCollapsed ? t('nav.employees') : undefined}
      >
        <Users className={iconClass} aria-hidden />
        <span className={labelClass}>{t('nav.employees')}</span>
      </NavLink>
      <NavLink
        to="/employer/bulk-upload"
        className={navLinkClass}
        title={sidebarCollapsed ? t('employerLayout.bulkUpload') : undefined}
      >
        <Upload className={iconClass} aria-hidden />
        <span className={labelClass}>{t('employerLayout.bulkUpload')}</span>
      </NavLink>
      <NavLink
        to="/employer/analytics"
        className={navLinkClass}
        title={sidebarCollapsed ? t('breadcrumb.analytics') : undefined}
      >
        <BarChart3 className={iconClass} aria-hidden />
        <span className={labelClass}>{t('breadcrumb.analytics')}</span>
      </NavLink>
      <NavLink
        to="/employer/reports"
        className={navLinkClass}
        title={sidebarCollapsed ? t('nav.reports') : undefined}
      >
        <FileText className={iconClass} aria-hidden />
        <span className={labelClass}>{t('nav.reports')}</span>
      </NavLink>
      <NavLink
        to="/employer/cross-asset-payment"
        className={navLinkClass}
        title={sidebarCollapsed ? t('employerLayout.crossAsset') : undefined}
      >
        <Globe className={iconClass} aria-hidden />
        <span className={labelClass}>{t('employerLayout.crossAsset')}</span>
      </NavLink>
      <NavLink
        to="/employer/transactions"
        className={navLinkClass}
        title={sidebarCollapsed ? t('nav.history') : undefined}
      >
        <History className={iconClass} aria-hidden />
        <span className={labelClass}>{t('nav.history')}</span>
      </NavLink>
      <NavLink
        to="/employer/revenue-split"
        className={navLinkClass}
        title={sidebarCollapsed ? t('employerLayout.revenueSplit') : undefined}
      >
        <PieChart className={iconClass} aria-hidden />
        <span className={labelClass}>{t('employerLayout.revenueSplit')}</span>
      </NavLink>
      <NavLink
        to="/employer/settings"
        className={navLinkClass}
        title={sidebarCollapsed ? t('breadcrumb.settings') : undefined}
      >
        <Settings className={iconClass} aria-hidden />
        <span className={labelClass}>{t('breadcrumb.settings')}</span>
      </NavLink>
      <NavLink
        to="/"
        className="mt-4 flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        title={sidebarCollapsed ? t('employerLayout.fullSiteNavigation') : undefined}
      >
        <ArrowLeft className={iconClass} aria-hidden />
        <span className={labelClass}>{t('employerLayout.fullSiteNavigation')}</span>
      </NavLink>
    </>
  );

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Mobile overlay */}
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label={t('employerLayout.closeNavigationMenu')}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      {/* Sidebar */}
      <aside
        id="employer-sidebar"
        className={`motion-collapse fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-[var(--border-hi)] bg-[color-mix(in_srgb,var(--surface)_96%,transparent)] backdrop-blur-xl transition-transform duration-200 lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        aria-label={t('employerLayout.employerNavigation')}
      >
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-3 py-4 lg:pt-4">
          <div className="mb-2 flex items-center justify-between px-1">
            <Text
              as="p"
              size="sm"
              weight="bold"
              addlClassName={`motion-collapse-fade px-2 text-[var(--muted)] uppercase tracking-wider ${
                sidebarCollapsed ? 'lg:opacity-0 lg:max-w-0' : 'opacity-100 max-w-[12rem]'
              }`}
            >
              {t('nav.employer')}
            </Text>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-expanded={!sidebarCollapsed}
              aria-controls="employer-sidebar"
              title={
                sidebarCollapsed
                  ? t('employerLayout.expandSidebar')
                  : t('employerLayout.collapseSidebar')
              }
              className="hidden lg:flex shrink-0 items-center justify-center rounded-lg p-1.5 text-[var(--muted)] transition-colors duration-200 hover:bg-white/5 hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <ChevronsLeft
                className={`h-4 w-4 transition-transform duration-[var(--motion-duration-normal)] ${
                  sidebarCollapsed ? 'rotate-180' : ''
                }`}
                aria-hidden
              />
            </button>
          </div>
          <nav className="flex flex-col gap-1" aria-label={t('employerLayout.employerPages')}>
            {NavItems}
          </nav>
        </div>
      </aside>

      {/* The collapsed width only applies at the desktop breakpoint (mobile
          always shows the full-width slide-in drawer), and a Tailwind class
          can't express a value that changes at runtime — so both the
          sidebar's width and the content's offset are set via a scoped
          media-gated rule instead of inline styles. */}
      <style>{`
        @media (min-width: 1024px) {
          #employer-sidebar {
            width: ${sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH}px;
          }
          #employer-content-offset {
            padding-left: ${sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH}px;
          }
        }
      `}</style>

      <div
        id="employer-content-offset"
        className="motion-collapse flex min-h-screen flex-1 flex-col"
      >
        {/* Top bar */}
        <header
          className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[var(--border-hi)] px-4 sm:px-6"
          style={{
            background: 'color-mix(in srgb, var(--bg) 88%, transparent)',
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="tertiary"
              size="sm"
              className="lg:hidden"
              aria-expanded={mobileNavOpen}
              aria-controls="employer-sidebar"
              onClick={() => setMobileNavOpen((o) => !o)}
              icon={<Menu className="h-4 w-4" aria-hidden />}
            />
            <div className="min-w-0">
              <Heading as="h1" size="md" weight="bold" addlClassName="truncate tracking-tight">
                {orgName}
              </Heading>
              <Breadcrumb />
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div
              className="flex min-w-0 max-w-[9rem] flex-col rounded-lg border border-[var(--border-hi)] bg-[var(--surface)] px-2 py-1 text-right sm:max-w-none sm:min-w-[8rem] sm:px-3 sm:py-1.5"
              role="status"
              aria-live="polite"
              aria-label={t('employerLayout.walletXlmBalance')}
            >
              <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)] sm:text-[10px]">
                {t('employerLayout.balance')}
              </span>
              <span
                className="truncate font-mono text-xs text-[var(--accent)] sm:text-sm"
                aria-busy={balanceLoading}
              >
                {!address
                  ? t('employerLayout.connectWallet')
                  : balanceLoading
                    ? '…'
                    : formatXlm(xlmBalance ?? null, i18n.language)}
              </span>
            </div>
            <NetworkSwitcher />
            <LanguageSelector />
            <ThemeToggle />
            <ConnectAccount />
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden px-4 py-6 sm:px-6">
          <ErrorBoundary fallback={<ErrorFallback />}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* Transaction Pending Overlay */}
      <TransactionPendingOverlay transactions={transactions} onDismiss={dismissTransaction} />
    </div>
  );
};

const EmployerLayout: React.FC = () => {
  return (
    <TransactionProvider>
      <EmployerLayoutContent />
    </TransactionProvider>
  );
};

export default EmployerLayout;
