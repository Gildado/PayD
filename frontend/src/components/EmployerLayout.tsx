import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Menu,
  ArrowLeft,
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

const ORG_NAME =
  (import.meta.env.VITE_ORG_DISPLAY_NAME as string | undefined)?.trim() || 'Organization';

function formatXlm(balance: string | null | undefined): string {
  if (balance == null) return '—';
  const n = Number(balance);
  if (!Number.isFinite(n)) return balance;
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 6 })} XLM`;
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
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { address } = useWallet();
  const { data: xlmBalance, isFetching: balanceLoading } = useNativeXlmBalance();
  const { transactions, dismissTransaction } = useTransactionNotifications();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const NavItems = (
    <>
      <NavLink to="/employer/payroll" className={navLinkClass}>
        <CreditCard className={iconClass} aria-hidden />
        <span>Payroll</span>
      </NavLink>
      <NavLink to="/employer/employee" className={navLinkClass}>
        <Users className={iconClass} aria-hidden />
        <span>Employees</span>
      </NavLink>
      <NavLink to="/employer/bulk-upload" className={navLinkClass}>
        <Upload className={iconClass} aria-hidden />
        <span>Bulk upload</span>
      </NavLink>
      <NavLink to="/employer/analytics" className={navLinkClass}>
        <BarChart3 className={iconClass} aria-hidden />
        <span>Analytics</span>
      </NavLink>
      <NavLink to="/employer/reports" className={navLinkClass}>
        <FileText className={iconClass} aria-hidden />
        <span>Reports</span>
      </NavLink>
      <NavLink to="/employer/cross-asset-payment" className={navLinkClass}>
        <Globe className={iconClass} aria-hidden />
        <span>Cross-asset</span>
      </NavLink>
      <NavLink to="/employer/transactions" className={navLinkClass}>
        <History className={iconClass} aria-hidden />
        <span>Transactions</span>
      </NavLink>
      <NavLink to="/employer/revenue-split" className={navLinkClass}>
        <PieChart className={iconClass} aria-hidden />
        <span>Revenue split</span>
      </NavLink>
      <NavLink to="/employer/settings" className={navLinkClass}>
        <Settings className={iconClass} aria-hidden />
        <span>Settings</span>
      </NavLink>
      <NavLink
        to="/"
        className="mt-4 flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        <ArrowLeft className={iconClass} aria-hidden />
        <span>Full site navigation</span>
      </NavLink>
    </>
  );

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Mobile overlay */}
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      {/* Sidebar */}
      <aside
        id="employer-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-[var(--border-hi)] bg-[color-mix(in_srgb,var(--surface)_96%,transparent)] backdrop-blur-xl transition-transform duration-200 lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        aria-label="Employer navigation"
      >
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4 lg:pt-4">
          <Text
            as="p"
            size="sm"
            weight="bold"
            addlClassName="mb-2 px-3 text-[var(--muted)] uppercase tracking-wider"
          >
            Employer
          </Text>
          <nav className="flex flex-col gap-1" aria-label="Employer pages">
            {NavItems}
          </nav>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col lg:pl-72">
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
                {ORG_NAME}
              </Heading>
              <Breadcrumb />
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div
              className="flex min-w-0 max-w-[9rem] flex-col rounded-lg border border-[var(--border-hi)] bg-[var(--surface)] px-2 py-1 text-right sm:max-w-none sm:min-w-[8rem] sm:px-3 sm:py-1.5"
              role="status"
              aria-live="polite"
              aria-label="Wallet XLM balance"
            >
              <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)] sm:text-[10px]">
                Balance
              </span>
              <span
                className="truncate font-mono text-xs text-[var(--accent)] sm:text-sm"
                aria-busy={balanceLoading}
              >
                {!address ? 'Connect wallet' : balanceLoading ? '…' : formatXlm(xlmBalance ?? null)}
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
