import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';

const ROUTE_LABELS: Record<string, string> = {
  employer: 'Employer',
  payroll: 'Payroll',
  employee: 'Employees',
  analytics: 'Analytics',
  reports: 'Reports',
  'bulk-upload': 'Bulk Upload',
  'cross-asset-payment': 'Cross-Asset Payment',
  transactions: 'Transactions',
  'revenue-split': 'Revenue Split',
  settings: 'Settings',
  help: 'Help Center',
  debug: 'Debugger',
  admin: 'Admin',
  portal: 'Employee Portal',
  rewards: 'Rewards',
};

const ROUTE_LABEL_KEYS: Record<string, string> = {
  employer: 'breadcrumb.employer',
  payroll: 'breadcrumb.payroll',
  employee: 'breadcrumb.employees',
  analytics: 'breadcrumb.analytics',
  reports: 'breadcrumb.reports',
  'bulk-upload': 'breadcrumb.bulkUpload',
  'cross-asset-payment': 'breadcrumb.crossAssetPayment',
  transactions: 'breadcrumb.transactions',
  'revenue-split': 'breadcrumb.revenueSplit',
  settings: 'breadcrumb.settings',
  help: 'breadcrumb.helpCenter',
  debug: 'breadcrumb.debugger',
  admin: 'breadcrumb.admin',
  portal: 'breadcrumb.employeePortal',
  rewards: 'breadcrumb.rewards',
};

const EXCLUDED_PREFIXES = ['/login', '/auth-callback'];

interface Crumb {
  label: string;
  href: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: Crumb[] = [{ label: 'Home', href: '/' }];

  let accumulated = '';
  for (const segment of segments) {
    accumulated += `/${segment}`;
    const label = ROUTE_LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
    crumbs.push({ label, href: accumulated });
  }

  return crumbs;
}

export const Breadcrumb: React.FC = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  if (EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const crumbs = buildCrumbs(pathname);

  if (crumbs.length <= 1) return null;

  return (
    <nav
      aria-label={t('breadcrumb.navigationAriaLabel')}
      className="flex items-center gap-1 text-xs"
      style={{ color: 'var(--muted)' }}
    >
      <ol className="flex items-center gap-1 list-none m-0 p-0">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          const segs = crumb.href.split('/').filter(Boolean);
          const lastSegment = segs[segs.length - 1];
          const translatedLabel =
            i === 0
              ? t('breadcrumb.home')
              : t(ROUTE_LABEL_KEYS[lastSegment] ?? '', { defaultValue: crumb.label });
          return (
            <li key={crumb.href} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 opacity-50" aria-hidden="true" />}
              {isLast ? (
                <span className="font-medium" style={{ color: 'var(--text)' }} aria-current="page">
                  {translatedLabel}
                </span>
              ) : (
                <Link
                  to={crumb.href}
                  className="transition-colors hover:underline focus:outline-none focus:ring-2 focus:ring-accent/50 rounded px-1"
                  style={{ color: 'var(--muted)' }}
                >
                  {translatedLabel}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
