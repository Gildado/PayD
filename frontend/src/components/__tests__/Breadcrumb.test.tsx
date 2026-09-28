import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Breadcrumb, buildCrumbs } from '../Breadcrumb';

// ── pure-function unit tests (no DOM needed) ──────────────────────────────

describe('buildCrumbs', () => {
  test('returns only Home for root path', () => {
    const crumbs = buildCrumbs('/');
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0]).toEqual({ label: 'Home', href: '/' });
  });

  test('builds two crumbs for a single-segment path', () => {
    const crumbs = buildCrumbs('/settings');
    expect(crumbs).toHaveLength(2);
    expect(crumbs[1]).toEqual({ label: 'Settings', href: '/settings' });
  });

  test('builds three crumbs for nested employer route', () => {
    const crumbs = buildCrumbs('/employer/payroll');
    expect(crumbs).toHaveLength(3);
    expect(crumbs[1]).toEqual({ label: 'Employer', href: '/employer' });
    expect(crumbs[2]).toEqual({ label: 'Payroll', href: '/employer/payroll' });
  });

  test('uses slug as label for unknown segments', () => {
    const crumbs = buildCrumbs('/unknown-page');
    expect(crumbs[1].label).toBe('Unknown-page');
  });

  test('maps all known route labels correctly', () => {
    const cases: Array<[string, string]> = [
      ['/employer/employee', 'Employees'],
      ['/employer/analytics', 'Analytics'],
      ['/employer/bulk-upload', 'Bulk Upload'],
      ['/employer/cross-asset-payment', 'Cross-Asset Payment'],
      ['/employer/transactions', 'Transactions'],
      ['/employer/revenue-split', 'Revenue Split'],
      ['/employer/reports', 'Reports'],
      ['/help', 'Help Center'],
    ];
    for (const [path, label] of cases) {
      const crumbs = buildCrumbs(path);
      expect(crumbs[crumbs.length - 1].label).toBe(label);
    }
  });
});

// ── component rendering tests ─────────────────────────────────────────────

describe('Breadcrumb component', () => {
  test('renders nothing on root path', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <Breadcrumb />
      </MemoryRouter>
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('renders nothing on excluded login path', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/login']}>
        <Breadcrumb />
      </MemoryRouter>
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('renders breadcrumb nav for /settings', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <Breadcrumb />
      </MemoryRouter>
    );
    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  test('current page segment has aria-current="page"', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <Breadcrumb />
      </MemoryRouter>
    );
    const current = screen.getByText('Settings');
    expect(current).toHaveAttribute('aria-current', 'page');
  });

  test('renders correct links for /employer/payroll', () => {
    render(
      <MemoryRouter initialEntries={['/employer/payroll']}>
        <Breadcrumb />
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /employer/i })).toHaveAttribute('href', '/employer');
    expect(screen.getByText('Payroll')).toHaveAttribute('aria-current', 'page');
  });
});
