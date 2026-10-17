import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { StatCard, StatCardGrid } from '../common/StatCard';

function renderGrid(children: React.ReactNode, label?: string) {
  return render(
    <MemoryRouter>
      <StatCardGrid label={label}>{children}</StatCardGrid>
    </MemoryRouter>
  );
}

describe('StatCard', () => {
  it('pairs each label with its value in a description list', () => {
    const { container } = renderGrid(
      <>
        <StatCard label="Total Payroll" value="$12,000" />
        <StatCard label="Success Rate" value="98.5%" />
      </>
    );

    const terms = container.querySelectorAll('dl > div > .stat-card-head > dt');
    expect(Array.from(terms).map((dt) => dt.textContent)).toEqual([
      'Total Payroll',
      'Success Rate',
    ]);
    expect(screen.getByText('$12,000').tagName).toBe('DD');
  });

  it('names the grid as a group when a label is given', () => {
    renderGrid(<StatCard label="Events" value={4} />, 'Payroll summary');
    expect(screen.getByRole('group', { name: 'Payroll summary' })).toBeInTheDocument();
  });

  it('hides decorative icons from assistive tech', () => {
    const { container } = renderGrid(
      <StatCard label="Events" value={4} icon={<svg data-testid="icon" />} />
    );
    expect(container.querySelector('.stat-card-icon')).toHaveAttribute('aria-hidden', 'true');
  });

  it('marks a rising good metric as positive and states the direction in text', () => {
    const { container } = renderGrid(
      <StatCard
        label="Success Rate"
        value="99%"
        trend={{ value: '+2%', direction: 'up', label: 'vs last month' }}
      />
    );
    const trend = container.querySelector('.stat-card-trend')!;
    expect(trend).toHaveAttribute('data-sentiment', 'positive');
    expect(trend).toHaveTextContent('Up +2%');
    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });

  it('marks a rising bad metric as negative and a neutral trend as neutral', () => {
    const { container } = renderGrid(
      <>
        <StatCard
          label="Failures"
          value="12"
          trend={{ value: '+4', direction: 'up', upIsGood: false }}
        />
        <StatCard
          label="Spend"
          value="$9k"
          trend={{ value: '+10%', direction: 'up', neutral: true }}
        />
      </>
    );
    const [failures, spend] = container.querySelectorAll('.stat-card-trend');
    expect(failures).toHaveAttribute('data-sentiment', 'negative');
    expect(spend).toHaveAttribute('data-sentiment', 'neutral');
  });

  it('renders an arrow link whose accessible name includes the metric', () => {
    renderGrid(
      <StatCard label="Active Employees" value={42} href="/employee" linkLabel="Manage roster" />
    );
    const link = screen.getByRole('link', { name: /manage roster: active employees/i });
    expect(link).toHaveAttribute('href', '/employee');
    expect(link).toHaveClass('link-arrow');
  });

  it('applies tone and emphasis as data attributes for theming', () => {
    const { container } = renderGrid(
      <StatCard label="Claimable" value="10" tone="success" emphasizeValue />
    );
    const card = container.querySelector('.stat-card')!;
    expect(card).toHaveAttribute('data-tone', 'success');
    expect(card).toHaveAttribute('data-emphasis', 'true');
    expect(within(card as HTMLElement).queryByRole('link')).toBeNull();
  });
});
