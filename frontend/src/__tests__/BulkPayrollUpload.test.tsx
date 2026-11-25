import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BulkPayrollUpload from '../pages/BulkPayrollUpload';
import { CSVRow } from '../components/CSVUploader';

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
      setQueryData: vi.fn(),
    }),
    useQuery: () => ({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    }),
    useMutation: () => ({
      mutate: vi.fn(),
      isPending: false,
      error: null,
    }),
  };
});

vi.mock('../components/CSVUploader', () => ({
  CSVUploader: ({
    onDataParsed,
  }: {
    onDataParsed: (rows: CSVRow[]) => void;
    requiredColumns: string[];
    validators?: Record<string, (v: string) => string | null>;
  }) => (
    <button
      data-testid="mock-csv-uploader"
      onClick={() =>
        onDataParsed([
          {
            rowNumber: 2,
            data: {
              name: 'Alice',
              wallet_address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
              amount: '100',
              currency: 'USDC',
            },
            errors: [],
            fieldErrors: [],
            isValid: true,
          },
        ])
      }
    >
      Load valid rows
    </button>
  ),
}));

vi.mock('../components/IssuerMultisigBanner', () => ({
  IssuerMultisigBanner: () => null,
}));

// Preflight is covered by its own tests; keep the submit button enabled here.
vi.mock('../hooks/usePreflightCheck', () => ({
  usePreflightCheck: () => ({
    results: [],
    summary: { hasIssues: false, total: 0, passed: 0, failed: 0 },
    isRunning: false,
    refetch: vi.fn(),
    rerun: vi.fn(),
  }),
}));

vi.mock('@stellar/design-system', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    'aria-busy': ariaBusy,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { 'aria-busy'?: boolean }) => (
    <button onClick={onClick} disabled={disabled} aria-busy={ariaBusy} {...rest}>
      {children}
    </button>
  ),
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('BulkPayrollUpload — double-submit prevention (#939)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submit button is disabled while submission is in flight', async () => {
    let resolveSubmit!: () => void;
    const submitPromise = new Promise<void>((res) => {
      resolveSubmit = res;
    });

    vi.spyOn(console, 'log').mockImplementationOnce(() => submitPromise as unknown as void);

    renderWithQuery(<BulkPayrollUpload />);
    fireEvent.click(screen.getByTestId('mock-csv-uploader'));

    const submitBtn = screen.getByRole('button', { name: /submit/i });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(submitBtn).toBeDisabled();
    });

    resolveSubmit();
  });

  it('a second click during submission does not fire a duplicate request', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    renderWithQuery(<BulkPayrollUpload />);
    fireEvent.click(screen.getByTestId('mock-csv-uploader'));

    const submitBtn = screen.getByRole('button', { name: /submit/i });

    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/payroll batch submitted/i)).toBeInTheDocument();
    });

    // console.log('Submitting payroll batch:', ...) fires once, not three times
    expect(consoleSpy).toHaveBeenCalledTimes(1);
  });
});
