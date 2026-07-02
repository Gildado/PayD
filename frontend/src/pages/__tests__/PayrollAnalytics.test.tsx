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
import { exportDashboardCsv } from '../PayrollAnalytics';

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

  it('renders a full dashboard CSV export button', () => {
    mockSuccessData();
    render(<PayrollAnalytics />);

    const csvButton = screen.getByRole('button', { name: /export full dashboard as csv/i });
    expect(csvButton).toBeTruthy();
  });

  it('triggers a CSV download with all dashboard sections when the export button is clicked', () => {
    mockSuccessData();
    render(<PayrollAnalytics />);

    // Spy on DOM APIs used by exportDashboardCsv
    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    const clickSpy = vi.fn();

    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const anchor = { href: '', download: '', click: clickSpy } as unknown as HTMLAnchorElement;
        return anchor;
      }
      return document.createElement(tag);
    });

    const csvButton = screen.getByRole('button', { name: /export full dashboard as csv/i });
    fireEvent.click(csvButton);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');

    // Verify the Blob content covers all sections
    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe('text/csv');

    createElementSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('exportDashboardCsv CSV content includes all analytics sections', () => {
    const clickSpy = vi.fn();

    // Capture the content passed to the Blob constructor directly,
    // without subclassing Blob (which drops prototype methods in jsdom).
    // We use a class (not vi.fn) because Blob must be constructable with `new`.
    let capturedCsvText = '';
    const OriginalBlob = globalThis.Blob;
    class BlobCapture extends OriginalBlob {
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        if (options?.type === 'text/csv') {
          capturedCsvText = parts.map(String).join('');
        }
      }
    }
    vi.stubGlobal('Blob', BlobCapture);
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });

    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return { href: '', download: '', click: clickSpy } as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    });

    const data = {
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
      ],
      departmentBreakdown: [
        { department: 'Engineering', total: 200000, headcount: 18 },
        { department: 'Sales', total: 100000, headcount: 10 },
      ],
    };

    exportDashboardCsv(data);

    expect(capturedCsvText).not.toBe('');

    // Must include all section headers
    expect(capturedCsvText).toContain('## Summary');
    expect(capturedCsvText).toContain('## Payroll Trends');
    expect(capturedCsvText).toContain('## Currency Breakdown');
    expect(capturedCsvText).toContain('## Payment Metrics');
    expect(capturedCsvText).toContain('## Department Breakdown');

    // Must include data from each section
    expect(capturedCsvText).toContain('500000,350,94.2,42');    // summary row
    expect(capturedCsvText).toContain('Jan 25,40000,16');        // trend row
    expect(capturedCsvText).toContain('USDC,62');                // currency row
    expect(capturedCsvText).toContain('Jan 25,80,5,2');          // payment metrics row
    expect(capturedCsvText).toContain('Engineering,200000,18'); // dept row
    expect(capturedCsvText).toContain('Sales,100000,10');        // dept row

    createElementSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
