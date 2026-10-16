import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '../pages/Home';

const mockNavigate = vi.fn();

vi.mock('@stellar/design-system', () => ({
  Icon: {
    Rocket01: () => <div data-testid="icon-rocket" />,
    CreditCard01: () => <div data-testid="icon-credit-card" />,
    Users01: () => <div data-testid="icon-users" />,
    ShieldTick: () => <div data-testid="icon-shield-tick" />,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const copy: Record<string, string> = {
        'home.titleLine1Prefix': 'Cross-Border',
        'home.titleLine1Highlight': 'Payroll',
        'home.titleLine2Prefix': 'For Global',
        'home.titleLine2Highlight': 'Teams',
        'home.titleLine2Suffix': '.',
        'home.tagline': 'Fast payouts with compliance and visibility.',
        'home.ctaManagePayroll': 'Manage Payroll',
        'home.ctaViewEmployees': 'View Employees',
        'home.card1Title': 'Card 1',
        'home.card1Body': 'Card 1 body',
        'home.card2Title': 'Card 2',
        'home.card2Body': 'Card 2 body',
        'home.card3Title': 'Card 3',
        'home.card3Body': 'Card 3 body',
        'home.statsBar.ariaLabel': 'Key platform metrics',
        'home.statsBar.organizationsMetric': '500+',
        'home.statsBar.organizationsLabel': 'Organizations Onboarded',
        'home.statsBar.organizationsDesc': 'Active businesses orchestrating payroll',
        'home.statsBar.countriesMetric': '35+',
        'home.statsBar.countriesLabel': 'Countries Supported',
        'home.statsBar.countriesDesc': 'Borderless cross-border settlement',
        'home.statsBar.contractsMetric': '100%',
        'home.statsBar.contractsLabel': 'Contracts Audited',
        'home.statsBar.contractsDesc': 'Verified Soroban smart contracts',
        'home.coreOfferings.eyebrow': 'Core Offerings',
        'home.coreOfferings.title': 'Institutional-grade tools for global teams',
        'home.coreOfferings.subtitle': 'Discover modular smart contract modules on Stellar',
        'home.coreOfferings.payroll.title': 'Payroll',
        'home.coreOfferings.payroll.tag': 'Real-Time Distribution',
        'home.coreOfferings.payroll.description': 'Automated salary payouts and settlements',
        'home.coreOfferings.payroll.linkText': 'Explore Payroll',
        'home.coreOfferings.bulkPayments.title': 'Bulk Payments',
        'home.coreOfferings.bulkPayments.tag': 'Batch Execution',
        'home.coreOfferings.bulkPayments.description': 'Disburse multi-recipient batch transfers',
        'home.coreOfferings.bulkPayments.linkText': 'Explore Bulk Payments',
        'home.coreOfferings.escrow.title': 'Escrow',
        'home.coreOfferings.escrow.tag': 'Conditional Vaults',
        'home.coreOfferings.escrow.description': 'Trustless milestone-locked vaults securing funds',
        'home.coreOfferings.escrow.linkText': 'Explore Escrow',
        'home.coreOfferings.vesting.title': 'Vesting',
        'home.coreOfferings.vesting.tag': 'Token Schedules',
        'home.coreOfferings.vesting.description': 'Customizable linear and cliff release schedules',
        'home.coreOfferings.vesting.linkText': 'Explore Vesting',
        'home.coreOfferings.revenueSplit.title': 'Revenue Split',
        'home.coreOfferings.revenueSplit.tag': 'Automated Routing',
        'home.coreOfferings.revenueSplit.description': 'Autonomous smart contract distribution',
        'home.coreOfferings.revenueSplit.linkText': 'Explore Revenue Split',
      };
      return copy[key] ?? key;
    },
    i18n: { language: 'en' },
  }),
}));

describe('Home page', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it('renders semantic landmarks and cta buttons', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('id', 'home-hero-title');
    expect(screen.getByRole('region', { name: 'Payroll platform highlights' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'securityAudits.title' })).toBeInTheDocument();

    const payrollButton = screen.getByRole('button', { name: 'Manage Payroll' });
    const employeesButton = screen.getByRole('button', { name: 'View Employees' });

    expect(payrollButton).toHaveAttribute('type', 'button');
    expect(employeesButton).toHaveAttribute('type', 'button');
  });

  it('navigates to key flows from CTA buttons', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Manage Payroll' }));
    fireEvent.click(screen.getByRole('button', { name: 'View Employees' }));

    expect(mockNavigate).toHaveBeenNthCalledWith(1, '/payroll');
    expect(mockNavigate).toHaveBeenNthCalledWith(2, '/employee');
  });

  it('renders key stats bar with organizations, countries, and contracts', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    const statsRegion = screen.getByRole('region', { name: /key platform metrics/i });
    expect(statsRegion).toBeInTheDocument();
    expect(screen.getByText('500+')).toBeInTheDocument();
    expect(screen.getByText('35+')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('renders and navigates core offerings service tiles', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    const offeringsHeading = screen.getByRole('heading', {
      name: /institutional-grade tools for global teams/i,
    });
    expect(offeringsHeading).toBeInTheDocument();

    const payrollTile = screen.getByRole('listitem', { name: /payroll:/i });
    const bulkTile = screen.getByRole('listitem', { name: /bulk payments:/i });
    const escrowTile = screen.getByRole('listitem', { name: /escrow:/i });
    const vestingTile = screen.getByRole('listitem', { name: /vesting:/i });
    const revenueSplitTile = screen.getByRole('listitem', { name: /revenue split:/i });

    expect(payrollTile).toBeInTheDocument();
    expect(bulkTile).toBeInTheDocument();
    expect(escrowTile).toBeInTheDocument();
    expect(vestingTile).toBeInTheDocument();
    expect(revenueSplitTile).toBeInTheDocument();

    fireEvent.click(payrollTile);
    expect(mockNavigate).toHaveBeenCalledWith('/payroll');

    fireEvent.click(bulkTile);
    expect(mockNavigate).toHaveBeenCalledWith('/bulk-upload');

    fireEvent.click(escrowTile);
    expect(mockNavigate).toHaveBeenCalledWith('/employer/vesting');

    fireEvent.click(vestingTile);
    expect(mockNavigate).toHaveBeenCalledWith('/employer/vesting');

    fireEvent.click(revenueSplitTile);
    expect(mockNavigate).toHaveBeenCalledWith('/revenue-split');
  });
});
