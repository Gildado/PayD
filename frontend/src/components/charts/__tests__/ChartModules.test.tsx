import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('recharts', () => {
  const chart =
    (testId: string) =>
    ({ children }: { children?: React.ReactNode }) => <div data-testid={testId}>{children}</div>;
  return {
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    LineChart: chart('line-chart'),
    AreaChart: chart('area-chart'),
    BarChart: chart('bar-chart'),
    PieChart: chart('pie-chart'),
    Line: () => null,
    Area: () => null,
    Bar: () => null,
    Pie: () => null,
    Cell: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
  };
});

import PayrollTrendChart from '../PayrollTrendChart';
import CurrencyPieChart from '../CurrencyPieChart';
import PaymentMetricsChart from '../PaymentMetricsChart';
import DepartmentChart from '../DepartmentChart';

const trends = [{ month: 'Jan 26', total: 1000, count: 2 }];
const currencies = [{ currency: 'USDC', value: 60 }];
const payments = [{ month: 'Jan 26', success: 8, failure: 1, pending: 1 }];
const departments = [{ department: 'Eng', total: 1000, headcount: 4 }];

describe('extracted chart modules render the same chart types', () => {
  it('renders the trend chart as a line chart by default', () => {
    render(<PayrollTrendChart data={trends} type="line" reduceMotion={false} />);
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument();
  });

  it('renders the trend chart as an area chart when toggled', () => {
    render(<PayrollTrendChart data={trends} type="area" reduceMotion={false} />);
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
  });

  it('renders the currency pie chart', () => {
    render(<CurrencyPieChart data={currencies} reduceMotion={false} />);
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
  });

  it('renders the payment metrics bar chart', () => {
    render(<PaymentMetricsChart data={payments} reduceMotion={false} />);
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('renders the department bar chart', () => {
    render(<DepartmentChart data={departments} reduceMotion={false} />);
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });
});
