import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { CSVUploader } from '../CSVUploader';

const mockNotifySuccess = vi.fn();
const mockNotifyError = vi.fn();

vi.mock('../../hooks/useNotification', () => ({
  useNotification: () => ({
    notifySuccess: mockNotifySuccess,
    notifyError: mockNotifyError,
  }),
}));

const createCSVContent = (headers: string[], rows: string[][]) => {
  const headerLine = headers.join(',');
  const dataLines = rows.map((row) => row.join(','));
  return [headerLine, ...dataLines].join('\n');
};

const createMockFile = (content: string, name = 'test.csv'): File => {
  const blob = new Blob([content], { type: 'text/csv' });
  return new File([blob], name, { type: 'text/csv' });
};

describe('CSVUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders upload zone with required columns info', () => {
    render(<CSVUploader requiredColumns={['name', 'email']} onDataParsed={vi.fn()} />);

    expect(screen.getByRole('region', { name: /csv file upload/i })).toBeTruthy();
    expect(screen.getByText(/required columns:/i)).toBeTruthy();
    expect(screen.getByText(/name, email/i)).toBeTruthy();
  });

  test('upload zone has button role and is keyboard accessible', () => {
    render(<CSVUploader requiredColumns={['name']} onDataParsed={vi.fn()} />);

    const zone = screen.getByRole('button', { name: /upload csv file/i });
    expect(zone).toBeTruthy();
    expect(zone.getAttribute('tabindex')).toBe('0');
  });

  test('parses valid CSV file and calls onDataParsed', async () => {
    const onDataParsed = vi.fn();
    const csvContent = createCSVContent(
      ['name', 'email', 'amount'],
      [
        ['John', 'john@test.com', '100'],
        ['Jane', 'jane@test.com', '200'],
      ]
    );
    const file = createMockFile(csvContent);

    render(
      <CSVUploader requiredColumns={['name', 'email', 'amount']} onDataParsed={onDataParsed} />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onDataParsed).toHaveBeenCalled();
    });

    const data = onDataParsed.mock.calls[0][0];
    expect(data).toHaveLength(2);
    expect(data[0].isValid).toBe(true);
    expect(data[1].isValid).toBe(true);
    expect(data[0].data.name).toBe('John');
  });

  test('shows error for non-CSV file', async () => {
    const blob = new Blob(['not a csv'], { type: 'text/plain' });
    const file = new File([blob], 'test.txt', { type: 'text/plain' });

    render(<CSVUploader requiredColumns={['name']} onDataParsed={vi.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockNotifyError).toHaveBeenCalledWith(
        'Invalid file format',
        'Only .csv files are accepted.'
      );
    });
  });

  test('shows error for missing required columns', async () => {
    const csvContent = createCSVContent(['name'], [['John']]);
    const file = createMockFile(csvContent);

    render(<CSVUploader requiredColumns={['name', 'email']} onDataParsed={vi.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText(/missing required columns/i)).toBeTruthy();
    });
  });

  test('shows drag state on drag enter', () => {
    render(<CSVUploader requiredColumns={['name']} onDataParsed={vi.fn()} />);

    const zone = screen.getByRole('button', { name: /upload csv file/i });
    fireEvent.dragEnter(zone);

    expect(zone.className).toContain('border-[var(--accent)]');
  });

  test('marks rows with missing required fields as invalid', async () => {
    const onDataParsed = vi.fn();
    const csvContent = createCSVContent(
      ['name', 'email'],
      [
        ['John', ''],
        ['', 'jane@test.com'],
      ]
    );
    const file = createMockFile(csvContent);

    render(<CSVUploader requiredColumns={['name', 'email']} onDataParsed={onDataParsed} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onDataParsed).toHaveBeenCalled();
    });

    const data = onDataParsed.mock.calls[0][0];
    expect(data[0].isValid).toBe(false);
    expect(data[1].isValid).toBe(false);
  });

  test('runs custom validators on parsed data', async () => {
    const onDataParsed = vi.fn();
    const csvContent = createCSVContent(['name', 'amount'], [['John', '50']]);
    const file = createMockFile(csvContent);
    const validators = {
      amount: (value: string) => {
        const num = Number(value);
        return num < 100 ? 'Amount must be at least 100' : null;
      },
    };

    render(
      <CSVUploader
        requiredColumns={['name', 'amount']}
        onDataParsed={onDataParsed}
        validators={validators}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onDataParsed).toHaveBeenCalled();
    });

    const data = onDataParsed.mock.calls[0][0];
    expect(data[0].errors).toContain('Amount must be at least 100');
  });

  test('shows success notification on valid parse', async () => {
    const csvContent = createCSVContent(['name', 'email'], [['John', 'john@test.com']]);
    const file = createMockFile(csvContent);

    render(<CSVUploader requiredColumns={['name', 'email']} onDataParsed={vi.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockNotifySuccess).toHaveBeenCalledWith(
        'CSV parsed successfully',
        '1 row ready to upload'
      );
    });
  });

  test('shows file summary after successful parse', async () => {
    const csvContent = createCSVContent(
      ['name', 'email'],
      [
        ['John', 'john@test.com'],
        ['Jane', 'jane@test.com'],
      ]
    );
    const file = createMockFile(csvContent);

    render(<CSVUploader requiredColumns={['name', 'email']} onDataParsed={vi.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('test.csv')).toBeTruthy();
    });

    expect(screen.getByText(/2 valid rows/i)).toBeTruthy();
  });

  test('displays data preview table after parsing', async () => {
    const csvContent = createCSVContent(['name', 'email'], [['John', 'john@test.com']]);
    const file = createMockFile(csvContent);

    render(<CSVUploader requiredColumns={['name', 'email']} onDataParsed={vi.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Data Preview')).toBeTruthy();
    });

    expect(screen.getByText('John')).toBeTruthy();
  });

  test('handles duplicate columns error', async () => {
    const csvContent = 'name,name,email\nJohn,Smith,john@test.com';
    const file = createMockFile(csvContent);

    render(<CSVUploader requiredColumns={['name', 'email']} onDataParsed={vi.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText(/duplicate columns found/i)).toBeTruthy();
    });
  });
});
