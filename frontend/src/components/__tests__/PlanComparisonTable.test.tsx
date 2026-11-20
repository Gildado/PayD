import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlanComparisonTable } from '../PlanComparisonTable';

vi.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: string) => fallback ?? _k,
    i18n: { language: 'en' },
  }),
}));

describe('PlanComparisonTable Component (#1484)', () => {
  it('renders table heading, plans and default tiers', () => {
    render(<PlanComparisonTable />);

    expect(
      screen.getByRole('heading', {
        name: /Flexible Plans Designed for Scalable Workforce Payroll/i,
      })
    ).toBeInTheDocument();

    // Default plans
    expect(screen.getAllByText('Self-Serve').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Managed Payroll').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Enterprise Treasury').length).toBeGreaterThanOrEqual(1);
  });

  it('supports toggling between monthly and annual billing with discounted rates', () => {
    render(<PlanComparisonTable />);

    const monthlyButton = screen.getByRole('button', { name: /Monthly Billing/i });
    const annualButton = screen.getByRole('button', { name: /Annual Billing/i });

    expect(annualButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Save 20%')).toBeInTheDocument();

    // Switch to monthly
    fireEvent.click(monthlyButton);
    expect(monthlyButton).toHaveAttribute('aria-pressed', 'true');
    expect(annualButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('invokes callback when a plan CTA is clicked', () => {
    const onSelectMock = vi.fn();
    render(<PlanComparisonTable onPlanSelect={onSelectMock} />);

    const ctaButtons = screen.getAllByRole('button', { name: /Start 14-Day Free Trial/i });
    fireEvent.click(ctaButtons[0]);

    expect(onSelectMock).toHaveBeenCalledWith('managed', expect.any(String));
  });

  it('renders semantic table structure with col and row headers for accessibility', () => {
    render(<PlanComparisonTable />);

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();

    // Category headings should be present
    expect(screen.getByText(/Payroll Automation & Distribution/i)).toBeInTheDocument();
    expect(screen.getByText(/Governance & Security Compliance/i)).toBeInTheDocument();
    expect(screen.getByText(/Support & Infrastructure SLAs/i)).toBeInTheDocument();

    // Check inclusion icons
    expect(screen.getAllByLabelText(/Included in/i).length).toBeGreaterThan(0);
  });

  it('allows mobile tier selection through mobile tab switcher', () => {
    render(<PlanComparisonTable />);

    const selfServeMobileBtn = screen.getAllByRole('button', { name: 'Self-Serve' });
    fireEvent.click(selfServeMobileBtn[0]);

    const descriptions = screen.getAllByText(/Ideal for early-stage teams & DAO contributors/i);
    expect(descriptions.length).toBeGreaterThanOrEqual(1);
  });
});
