import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BulkPayrollUpload from '../pages/BulkPayrollUpload';
import { CSVRow } from '../components/CSVUploader';

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

    render(<BulkPayrollUpload />);
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

    render(<BulkPayrollUpload />);
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
