import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PayrollAnalytics from '../pages/PayrollAnalytics';

// Mock axiosInstance so tests don't hit the network
vi.mock('../api/axiosInstance', () => ({
  default: {
    get: vi.fn().mockRejectedValue(new Error('Network error')),
  },
}));

// recharts relies on SVG APIs not available in jsdom — stub out the components
vi.mock('recharts', () => {
  const MockChart = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="recharts-mock">{children}</div>
  );
  return {
    LineChart: MockChart,
    AreaChart: MockChart,
    BarChart: MockChart,
    PieChart: MockChart,
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
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  };
});

// framer-motion: avoid animation side-effects in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@stellar/design-system', () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderComponent() {
  return render(
    <MemoryRouter>
      <QueryClientProvider client={makeClient()}>
        <PayrollAnalytics />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('PayrollAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page heading', () => {
    renderComponent();
    expect(screen.getByText('Payroll')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  it('renders the date range filter section', () => {
    renderComponent();
    expect(screen.getByLabelText('Select start date for analytics')).toBeInTheDocument();
    expect(screen.getByLabelText('Select end date for analytics')).toBeInTheDocument();
  });

  it('renders quick preset buttons', () => {
    renderComponent();
    expect(screen.getByText('3M')).toBeInTheDocument();
    expect(screen.getByText('6M')).toBeInTheDocument();
    expect(screen.getByText('YTD')).toBeInTheDocument();
    expect(screen.getByText('1Y')).toBeInTheDocument();
  });

  it('applies a preset and marks it as active', async () => {
    renderComponent();
    const btn3M = screen.getByText('3M');
    fireEvent.click(btn3M);
    await waitFor(() => {
      expect(btn3M).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clears the active preset when a date input changes', async () => {
    renderComponent();
    const btn6M = screen.getByText('6M');
    fireEvent.click(btn6M);
    await waitFor(() => expect(btn6M).toHaveAttribute('aria-pressed', 'true'));

    const startInput = screen.getByLabelText('Select start date for analytics');
    fireEvent.change(startInput, { target: { value: '2025-01-01' } });
    await waitFor(() => {
      expect(btn6M).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('renders chart type toggle buttons', () => {
    renderComponent();
    expect(screen.getByLabelText('Line chart')).toBeInTheDocument();
    expect(screen.getByLabelText('Area chart')).toBeInTheDocument();
  });

  it('toggles the trend chart type to area', async () => {
    renderComponent();
    const areaBtn = screen.getByLabelText('Area chart');
    fireEvent.click(areaBtn);
    await waitFor(() => {
      expect(areaBtn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('renders the refresh button', () => {
    renderComponent();
    expect(screen.getByLabelText('Refresh analytics')).toBeInTheDocument();
  });

  it('shows fallback mock data after API failure', async () => {
    renderComponent();
    // After the query settles (falls back to mock), summary cards should appear
    await waitFor(
      () => {
        expect(screen.getByText('Total Payroll')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('renders the export CSV button', async () => {
    renderComponent();
    await waitFor(() => screen.getByTitle('Export CSV'), { timeout: 3000 });
    expect(screen.getByTitle('Export CSV')).toBeInTheDocument();
  });
});
