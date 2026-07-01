import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockQuery(...args),
}));

vi.mock('../../api/axiosInstance', () => ({
  default: { get: vi.fn().mockRejectedValue(new Error('mock')) },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<object>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock('@stellar/design-system', () => ({
  Card: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('../../utils/exportChart', () => ({
  exportAsPng: vi.fn(),
  exportAsSvg: vi.fn(),
}));

import PayrollAnalytics from '../PayrollAnalytics';

function mockSuccessData() {
  mockQuery.mockReturnValue({
    data: {
      summary: { totalPayroll: 500000, totalTransactions: 350, successRate: 94.2, activeEmployees: 42 },
      trends: [
        { month: 'Jan 25', total: 40000, count: 16 },
        { month: 'Feb 25', total: 42000, count: 17 },
      ],
      currencyBreakdown: [
        { currency: 'USDC', value: 62 },
        { currency: 'XLM', value: 28 },
      ],
      paymentMetrics: [
        { month: 'Jan 25', success: 80, failure: 5, pending: 2 },
        { month: 'Feb 25', success: 85, failure: 3, pending: 1 },
      ],
      departmentBreakdown: [
        { department: 'Engineering', total: 200000, headcount: 18 },
        { department: 'Sales', total: 100000, headcount: 10 },
      ],
    },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  });
}

describe('PayrollAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders export PNG buttons for each chart', () => {
    mockSuccessData();
    render(<PayrollAnalytics />);

    const pngButtons = screen.getAllByRole('button', { name: /export.*PNG/i });
    expect(pngButtons.length).toBe(4);
  });

  it('renders export SVG buttons for each chart', () => {
    mockSuccessData();
    render(<PayrollAnalytics />);

    const svgButtons = screen.getAllByRole('button', { name: /export.*SVG/i });
    expect(svgButtons.length).toBe(4);
  });

  it('calls exportAsPng when PNG button is clicked', async () => {
    mockSuccessData();
    const { exportAsPng } = await import('../../utils/exportChart');
    render(<PayrollAnalytics />);

    const pngButtons = screen.getAllByRole('button', { name: /export.*PNG/i });
    fireEvent.click(pngButtons[0]);

    expect(exportAsPng).toHaveBeenCalled();
  });

  it('calls exportAsSvg when SVG button is clicked', async () => {
    mockSuccessData();
    const { exportAsSvg } = await import('../../utils/exportChart');
    render(<PayrollAnalytics />);

    const svgButtons = screen.getAllByRole('button', { name: /export.*SVG/i });
    fireEvent.click(svgButtons[0]);

    expect(exportAsSvg).toHaveBeenCalled();
  });
});
