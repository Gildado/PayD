import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportDialog } from '../ExportDialog';
import { EXPORT_DEFAULTS_STORAGE_KEY } from '../../services/customReportExport';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('ExportDialog component', () => {
  beforeEach(() => {
    localStorage.removeItem(EXPORT_DEFAULTS_STORAGE_KEY);
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ExportDialog isOpen={false} onClose={vi.fn()} onExport={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog with format options, date range pickers, and column list when open', () => {
    render(<ExportDialog isOpen={true} onClose={vi.fn()} onExport={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Export Payroll History')).toBeInTheDocument();
    expect(screen.getByTestId('format-option-csv')).toBeInTheDocument();
    expect(screen.getByTestId('format-option-pdf')).toBeInTheDocument();
    expect(screen.getByTestId('format-option-excel')).toBeInTheDocument();
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
    expect(screen.getByText(/transaction hash/i)).toBeInTheDocument();
  });

  it('allows switching format between CSV and PDF', () => {
    render(<ExportDialog isOpen={true} onClose={vi.fn()} onExport={vi.fn()} />);

    const pdfOption = screen.getByTestId('format-option-pdf');
    fireEvent.click(pdfOption);

    expect(pdfOption.className).toContain('border-[var(--accent,#4f46e5)]');
  });

  it('submits with chosen columns, date range, and format', async () => {
    const onExport = vi.fn();
    render(<ExportDialog isOpen={true} onClose={vi.fn()} onExport={onExport} />);

    // Select PDF format
    fireEvent.click(screen.getByTestId('format-option-pdf'));

    // Set date range
    fireEvent.change(screen.getByLabelText(/start date/i), {
      target: { value: '2026-02-01' },
    });
    fireEvent.change(screen.getByLabelText(/end date/i), {
      target: { value: '2026-02-28' },
    });

    // Deselect all then select specific columns
    fireEvent.click(screen.getByText(/deselect all/i));
    fireEvent.click(screen.getByText('Transaction Hash'));
    fireEvent.click(screen.getByText('Amount'));

    // Submit
    fireEvent.click(screen.getByTestId('confirm-export-button'));

    await waitFor(() => {
      expect(onExport).toHaveBeenCalledWith({
        format: 'pdf',
        columns: ['txHash', 'amount'],
        startDate: '2026-02-01',
        endDate: '2026-02-28',
        reportName: 'payroll-history',
      });
    });
  });

  it('remembers user choices in localStorage when rememberDefaults is checked', async () => {
    const onExport = vi.fn();
    render(<ExportDialog isOpen={true} onClose={vi.fn()} onExport={onExport} />);

    fireEvent.click(screen.getByTestId('format-option-pdf'));
    fireEvent.click(screen.getByText(/deselect all/i));
    fireEvent.click(screen.getByText('Transaction Hash'));

    fireEvent.click(screen.getByTestId('confirm-export-button'));

    await waitFor(() => {
      expect(onExport).toHaveBeenCalled();
    });

    const stored = localStorage.getItem(EXPORT_DEFAULTS_STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.format).toBe('pdf');
    expect(parsed.columns).toEqual(['txHash']);
  });

  it('shows error and blocks export when all columns are deselected', () => {
    const onExport = vi.fn();
    render(<ExportDialog isOpen={true} onClose={vi.fn()} onExport={onExport} />);

    fireEvent.click(screen.getByText(/deselect all/i));

    expect(screen.getByRole('alert')).toHaveTextContent(/select at least one column/i);
    expect(screen.getByTestId('confirm-export-button')).toBeDisabled();
    expect(onExport).not.toHaveBeenCalled();
  });

  it('calls onClose when clicking cancel or the close button', () => {
    const onClose = vi.fn();
    render(<ExportDialog isOpen={true} onClose={onClose} onExport={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText(/close dialog/i));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
