import React from 'react';
import { Link, useLocation } from 'react-router-dom';
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
  const { pathname } = useLocation();

  if (EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const crumbs = buildCrumbs(pathname);

  if (crumbs.length <= 1) return null;

  return (
    <nav
      aria-label="Breadcrumb navigation"
      className="flex items-center gap-1 text-xs"
      style={{ color: 'var(--muted)' }}
    >
      <ol className="flex items-center gap-1 list-none m-0 p-0">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={crumb.href} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 opacity-50" aria-hidden="true" />}
              {isLast ? (
                <span className="font-medium" style={{ color: 'var(--text)' }} aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.href}
                  className="transition-colors hover:underline focus:outline-none focus:ring-2 focus:ring-accent/50 rounded px-1"
                  style={{ color: 'var(--muted)' }}
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
