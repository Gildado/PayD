import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '../pages/Home';

const mockNavigate = vi.fn();

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
      };
      return copy[key] ?? key;
    },
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

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('aria-labelledby', 'home-hero-title');
    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('id', 'home-hero-title');
    expect(screen.getByRole('region', { name: 'Payroll platform highlights' })).toBeInTheDocument();

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
});
